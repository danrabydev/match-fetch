# @danrabydev/match-fetch

Fetch wrapper around [`@danrabydev/match`](https://www.npmjs.com/package/@danrabydev/match): transport failures, HTTP status, and JSON payloads are exhaustive tagged unions.

Zero extra runtime dependencies beyond `match`. Building this repo requires **Node 22.18+** so tsdown can load `tsdown.config.ts` with native TypeScript stripping. The published `dist/` is ES2022.

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
  Ok: ({ data }) => data.name,       // data: User
  Created: ({ data }) => data.name,  // data: User
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

One matchable. 200/201 parse JSON into `data: TResponse`. 204 does not parse. 4xx/5xx keep `{ response, status }` so you can read an error body (optionally with `jsonOf`). Network throws and JSON parse throws are their own variants.

| tag | when |
| --- | --- |
| `Ok` | 200, parsed JSON (`data`) |
| `Created` | 201, parsed JSON (`data`) |
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

Range names `ClientError`, `ServerError`, and `Other` are reserved, as is `of` (the mapper). Duplicate status codes throw at creation.

### `jsonOf`

`response.json()` without throwing. JSON verbs use this on 200/201 (`Ok`/`Created` or `ParseError`). Use it in a `Conflict` / `ClientError` arm to parse an error body:

```ts
import { jsonOf } from "@danrabydev/match-fetch";

const body = await jsonOf<ApiError>(response);
```

`ApiBase` exposes `protected matchFetch` for FormData, streams, or a custom status table, and `protected requestJson` / exported `toFetchResult` for the default JSON pipeline (including `DELETE`).

## Why this pattern

| Need | What you get |
| --- | --- |
| Typed JSON client | `get<User>` → `FetchResult<User>`; `data` is `User` on 200/201 |
| Shared defaults | `class UserApi extends ApiBase` |
| Exhaustive HTTP status | named 200/201/204/409, then 4xx/5xx ranges |
| Network vs HTTP | `NetworkError` is a variant, not a thrown `TypeError` |
| Raw `Response` | `matchFetch` + `Http.of` |

This is the TypeScript analogue of matching on a Rust `Result` and then on an HTTP status enum.

The `UserApi` subclass, typed verbs, and exhaustive `FetchResult.match` live in [`examples/`](./examples/).

## Publishing

`pnpm check` typechecks, tests, builds, smoke-tests `dist/`, then runs [publint](https://publint.dev/) and [Are The Types Wrong](https://arethetypeswrong.github.io/). Publish with provenance:

```bash
pnpm publish:npm
```

## License

MIT
