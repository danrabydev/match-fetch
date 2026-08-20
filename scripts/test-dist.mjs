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

function smoke(api, label) {
  assert(typeof api.matchFetch === "function", `${label}: matchFetch`);
  assert(typeof api.get === "function", `${label}: get`);
  assert(typeof api.getJson === "function", `${label}: getJson`);
  assert(typeof api.post === "function", `${label}: post`);
  assert(typeof api.del === "function", `${label}: del`);
  assert(typeof api.head === "function", `${label}: head`);
  assert(typeof api.toFetchResult === "function", `${label}: toFetchResult`);
  assert(typeof api.createStatusMatchable === "function", `${label}: createStatusMatchable`);
  assert(typeof api.ApiBase === "function", `${label}: ApiBase`);
  assert(typeof api.Http.of === "function", `${label}: Http.of`);
  assert(typeof api.FetchResult.match === "function", `${label}: FetchResult.match`);

  const response = new Response(null, { status: 200 });
  const http = api.Http.of(response);
  assert(http.tag === "Ok", `${label}: Http.of 200`);
  assert(typeof http.response.json === "function", `${label}: Response not spread`);

  const conflict = api.Http.of(new Response(null, { status: 409 }));
  assert(conflict.tag === "Conflict", `${label}: Http.of 409`);

  const notFound = api.Http.of(new Response(null, { status: 404 }));
  assert(notFound.tag === "ClientError", `${label}: Http.of 404`);
}

smoke(esm, "esm");
smoke(cjs, "cjs");
console.log("dist smoke ok (esm + cjs)");
