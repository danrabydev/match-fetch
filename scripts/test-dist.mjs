import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const esmPath = join(root, "../dist/index.js");
const cjsPath = join(root, "../dist/index.cjs");
if (!existsSync(esmPath) || !existsSync(cjsPath)) {
  throw new Error("dist missing; run pnpm build first");
}

const esm = await import("../dist/index.js");
const cjs = createRequire(import.meta.url)("../dist/index.cjs");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

async function smoke(api, label) {
  assert(typeof api.matchFetch === "function", `${label}: matchFetch`);
  assert(typeof api.get === "function", `${label}: get`);
  assert(typeof api.getJson === "function", `${label}: getJson`);
  assert(typeof api.isHttpErr === "function", `${label}: isHttpErr`);
  assert(typeof api.post === "function", `${label}: post`);
  assert(typeof api.del === "function", `${label}: del`);
  assert(typeof api.head === "function", `${label}: head`);
  assert(typeof api.toFetchResult === "function", `${label}: toFetchResult`);
  assert(typeof api.createStatusMatchable === "function", `${label}: createStatusMatchable`);
  assert(typeof api.ApiBase === "function", `${label}: ApiBase`);
  assert(typeof api.Http.of === "function", `${label}: Http.of`);
  assert(typeof api.Http.withDiagnostics === "function", `${label}: Http.withDiagnostics`);
  assert(typeof api.Http.peek === "function", `${label}: Http.peek`);
  assert(typeof api.FetchResult.match === "function", `${label}: FetchResult.match`);
  assert(typeof api.FetchResult.peek === "function", `${label}: FetchResult.peek`);
  assert(typeof api.Json.peek === "function", `${label}: Json.peek`);
  assert(typeof api.peekTrace === "function", `${label}: peekTrace`);
  assert(typeof api.peeker === "function", `${label}: peeker`);
  assert(typeof api.diagnostics === "function", `${label}: diagnostics`);
  assert(typeof api.enableDiagnostics === "function", `${label}: enableDiagnostics`);

  const boundHttp = api.Http.withDiagnostics({
    enabled: true,
    branches: ["ServerError"],
  });
  const server = boundHttp.of(new Response(null, { status: 500 }));
  api.Http.peek(server, { ServerError: () => {} });
  assert(api.peekTrace(server).length === 1, `${label}: peekTrace after withDiagnostics of`);
  const unbound = api.Http.of(new Response(null, { status: 500 }));
  api.Http.peek(unbound, { ServerError: () => {} });
  assert(api.peekTrace(unbound).length === 0, `${label}: unbound of has no trail`);

  const response = new Response(null, { status: 200 });
  const http = api.Http.of(response);
  assert(http.tag === "Ok", `${label}: Http.of 200`);
  assert(typeof http.response.json === "function", `${label}: Response not spread`);

  const conflict = api.Http.of(new Response(null, { status: 409 }));
  assert(conflict.tag === "Conflict", `${label}: Http.of 409`);

  const notFound = api.Http.of(new Response(null, { status: 404 }));
  assert(notFound.tag === "ClientError", `${label}: Http.of 404`);

  const urls = [];
  const client = new api.ApiBase({
    baseUrl: "https://{region}.example.com",
    fetch: async (input) => {
      urls.push(String(input));
      return new Response(JSON.stringify({ id: "1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });
  await client.get("/users/{id}", { params: { region: "api", id: "1" } });
  assert(
    urls[0] === "https://api.example.com/users/1",
    `${label}: url template substitution`,
  );
}

await smoke(esm, "esm");
await smoke(cjs, "cjs");
console.log("dist smoke ok (esm + cjs)");
