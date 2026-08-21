# @danrabydev/match-fetch

Fetch wrapper around [`@danrabydev/match`](https://www.npmjs.com/package/@danrabydev/match): transport failures, HTTP status, and JSON payloads are exhaustive tagged unions.

Zero extra runtime dependencies beyond `match`. Building this repo requires **Node 22.18+** (`nvm use 22`) so tsdown can load `tsdown.config.ts` (it needs `Promise.withResolvers` and native TypeScript stripping; Node 20 fails with a missing `unrun` module). The published `dist/` is ES2022.

## Installation

```bash
pnpm add @danrabydev/match-fetch @danrabydev/match
```

## Quick start — `ApiBase`

Subclass with default `baseUrl`, headers, and `fetch`. Domain methods return `FetchResult<TResponse>`:

```ts
import { ApiBase, FetchResult } from "@danrabydev/match-fetch";

type User = { id: string; name: string };
type NewUser = { name: string };

class UserApi extends ApiBase {
  constructor(token: string) {
    super({
      baseUrl: "https://api.example.com",
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  user(id: string) {
    return this.get<User>(`/users/${id}`);
  }

  create(body: NewUser) {
    return this.post<NewUser, User>("/users", body);
  }
}

const users = new UserApi(token);
const name = FetchResult.match(await users.user("1"), {
  Ok: ({ body }) => body.name,       // body: User
  Created: ({ body }) => body.name,  // body: User
  NoContent: () => "",
  Conflict: ({ status }) => `conflict ${status}`,
  ClientError: ({ status }) => `client ${status}`,
  ServerError: ({ status }) => `server ${status}`,
  Other: ({ status }) => `other ${status}`,
  NetworkError: ({ err }) => String(err),
  ParseError: ({ err }) => String(err),
});
```

Omit an arm and TypeScript reports an error.

## Simple `Json` path — `getJson`

Same request, body read immediately into `Ok.body`. Two arms only. `response.ok` (2xx) + JSON is `Ok`; 4xx/5xx are `Err` with `{ status, body }` (`body` is the parsed envelope). Network throws and 2xx parse failures are `Err` without that shape (`isHttpErr`). Empty 2xx bodies (204, HEAD) are parse `Err` — use `del` / `matchFetch` when there is no JSON.

```ts
import { getJson, Json, isHttpErr } from "@danrabydev/match-fetch";

type User = { id: string; name: string };
type ApiError = { error: string };

const result = await getJson<User, ApiError>("/users/1");
const name = Json.match(result, {
  Ok: ({ body }) => body.name, // body: User
  Err: ({ err }) =>
    isHttpErr(err) ? `http ${err.status}` : String(err),
});
```

`postJson` / `putJson` / `patchJson` take `<TBody, TResponse>` like `post`. Class methods: `getJson`, `headJson`, `deleteJson`, `postJson`, `putJson`, `patchJson`. Free functions use `delJson` (`delete` is reserved). `headJson` is almost always `Err` on a spec HEAD; use `matchFetch` for headers.

## Free verbs

Same pipeline without a class. Useful in scripts and tests.

```ts
import { get, post, FetchResult } from "@danrabydev/match-fetch";

const result = await get<User>("/users/1");
const created = await post<NewUser, User>("/users", { name: "ada" });
```

`put` and `patch` take the same `<TBody, TResponse>` pair. `head` and `del` (free-function DELETE; `delete` is a reserved word) take only `<TResponse>`, like `get`. `post` / `put` / `patch` `JSON.stringify` the body and set `Content-Type: application/json` unless the merged headers already have `Content-Type`. Verb `init` cannot set `method` (the verb wins at runtime). Use `matchFetch` if you only need HEAD headers — a 200 with an empty body is `ParseError` on the JSON pipeline.

Pass `fetch` on `init` to inject a mock (or `undici`):

```ts
await get<User>("/users/1", { fetch: mockFetch });
```

Timeout: `signal: AbortSignal.timeout(ms)` on `init`. Retry and interceptors are out of scope. A constructor-level `signal` plus a per-request `signal` are combined with `AbortSignal.any`.

## `FetchResult<TResponse>`

One matchable. 200/201 parse JSON into `body: TResponse`. 204 does not parse. 4xx/5xx keep `{ response, status }` so you can read an error body (optionally with `jsonOf`). Network throws and JSON parse throws are their own variants.

| tag | when |
| --- | --- |
| `Ok` | 200, parsed JSON (`body`) |
| `Created` | 201, parsed JSON (`body`) |
| `NoContent` | 204 |
| `Conflict` | 409 |
| `ClientError` | other 4xx |
| `ServerError` | 5xx |
| `Other` | 1xx, other 2xx, 3xx |
| `NetworkError` | `fetch` threw |
| `ParseError` | 200/201 body was not JSON |

Default headers merge with per-request headers (request wins on the same name). `baseUrl` is constructor-only: relative paths join it; absolute `http(s):` / `//` URLs and `URL` / `Request` inputs ignore it.

A constructor-level `signal` is shared across calls — once aborted, every request fails. If a call also passes `signal`, both are combined with `AbortSignal.any` (Node 22+ / current browsers).

## Two-layer primitive (raw `Response`)

Native `fetch` only rejects on network/abort. HTTP 404 still resolves. Split that into two matches when you need the `Response` itself, a custom status table, or a non-JSON body.

### Layer 1 — `Transport`

```ts
import { matchFetch, Transport } from "@danrabydev/match-fetch";

const attempt = await matchFetch("/users");
Transport.match(attempt, {
  Err: ({ err }) => `network: ${String(err)}`,
  Ok: ({ response }) => response.status, // 404 is still Ok
});
```

### Layer 2 — `Http`

Once you have a `Response`, match status only:

```ts
import { Http } from "@danrabydev/match-fetch";

Http.match(Http.of(response), {
  Ok: ({ response }) => { /* 200 */ },
  Created: ({ response }) => { /* 201 */ },
  NoContent: () => { /* 204 */ },
  Conflict: ({ response }) => { /* 409 */ },
  ClientError: ({ status }) => { /* other 4xx */ },
  ServerError: ({ status }) => { /* 5xx */ },
  Other: ({ status }) => { /* 1xx, other 2xx, 3xx */ },
});
```

Exact codes win; leftover 4xx/5xx fall into range variants. Payload is always `{ response, status }` — the `Response` is **wrapped, never spread**. `createMatchable` copies enumerable own fields only; spreading a `Response` would drop `json` / `headers`.

Apps that want 404 (or 401, 422, …) as a first-class arm create their own table. JSON verbs stay on the default table.

```ts
import { createStatusMatchable } from "@danrabydev/match-fetch";

const ApiHttp = createStatusMatchable({
  Ok: 200,
  Created: 201,
  NoContent: 204,
  NotFound: 404,
  Conflict: 409,
});
```

Range names `ClientError`, `ServerError`, and `Other` are reserved, as are `of` (the mapper), `merge`, `peek`, and `withDiagnostics`. Duplicate status codes throw at creation.

### `jsonOf`

`response.json()` without throwing. `getJson` uses this on 2xx (`Ok`) and on 4xx/5xx (`Err` `{ status, body }`). Status-table `get` still parses 200/201 into `FetchResult`.

```ts
import { jsonOf } from "@danrabydev/match-fetch";

const body = await jsonOf<ApiError>(response);
const traced = await jsonOf<ApiError>(response, {
  enabled: true,
  branches: ["Err"],
});
```

`ApiBase` exposes `protected request` / `requestGet` / `requestHead` / `requestDelete` / `requestPost` / `requestPut` / `requestPatch` for native `Response` (throws on network/abort). `protected matchFetch` wraps that in `Transport` (body unread). `protected requestJson` / `get` are the status-table JSON pipeline. `protected requestAsJson` / `getJson` parse immediately into `Json` (`Ok`/`Err`).

## Diagnostics

[`@danrabydev/match` 0.3](https://www.npmjs.com/package/@danrabydev/match) diagnostics are a **mask**, not a required logger. Pass `diagnostics` on `ApiBase` options or per-request `init` (per-request replaces the constructor mask). The key is stripped before `fetch`. Tagged values then record a trail for `peek` / `match`; read it with `peekTrace`.

```ts
import {
  ApiBase,
  FetchResult,
  peeker,
  peekTrace,
} from "@danrabydev/match-fetch";

const logErrors = peeker("http.errors", {
  ServerError: ({ status }) => console.error(status),
  NetworkError: ({ err }) => console.error(err),
});

class UserApi extends ApiBase {
  constructor(token: string) {
    super({
      baseUrl: "https://api.example.com",
      headers: { Authorization: `Bearer ${token}` },
      diagnostics: {
        enabled: true,
        branches: ["ServerError", "NetworkError"],
      },
    });
  }

  user(id: string) {
    return this.get<User>(`/users/${id}`);
  }
}

const users = new UserApi(token);
const result = await users.user("1");
FetchResult.peek(result, logErrors);
peekTrace(result);
```

`jsonOf(response, diag)`, `matchFetch(url, { diagnostics })`, and `toFetchResult(attempt, diag)` take the same mask. `Http.withDiagnostics(opts).of(response)` rebinds `of` so status values carry it. `enableDiagnostics(["ServerError"])` is a process-wide floor; `disableDiagnostics()` clears it (tests). `onPeek` / `onMatch` on the mask are optional.

## Why this pattern

| Need | What you get |
| --- | --- |
| Typed JSON client | `get<User>` → `FetchResult<User>`; `body` is `User` on 200/201 |
| Ok / Err only (body already parsed) | `getJson<User, ApiError>` → `Json<User>`; HTTP `Err` is `{ status, body }` (`isHttpErr`) |
| Shared defaults | `class UserApi extends ApiBase` |
| Exhaustive HTTP status | named 200/201/204/409, then 4xx/5xx ranges |
| Network vs HTTP | `NetworkError` is a variant, not a thrown `TypeError` |
| Raw `Response` | `matchFetch` + `Http.of` |
| Opt-in peek/match trail | `diagnostics` on `ApiBase` / `init`; `peekTrace` |

This is the TypeScript analogue of matching on a Rust `Result` and then on an HTTP status enum.

The `UserApi` subclass, typed verbs, and exhaustive `FetchResult.match` live in [`examples/`](./examples/).

## Publishing

`pnpm check` typechecks, tests, builds, smoke-tests `dist/`, then runs [publint](https://publint.dev/) and [Are The Types Wrong](https://arethetypeswrong.github.io/). Publish with provenance:

```bash
pnpm publish:npm
```

## License

MIT
