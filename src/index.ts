export {
  diagnostics,
  disableDiagnostics,
  enableDiagnostics,
  peek,
  peeker,
  peekTrace,
  type DiagOptions,
  type MatchTraceEvent,
  type PeekTraceEvent,
  type TraceEvent,
} from "@danrabydev/match";

export { Transport, matchFetch, type MatchFetchInit } from "./transport.js";

export {
  createStatusMatchable,
  Http,
  type StatusValue,
} from "./status.js";

export { Json, jsonOf, isHttpErr, type HttpErr } from "./json.js";

export { FetchResult, toFetchResult } from "./result.js";

export type { FetchDiag } from "./namespace.js";

export {
  get,
  head,
  del,
  post,
  put,
  patch,
  getJson,
  headJson,
  delJson,
  postJson,
  putJson,
  patchJson,
} from "./verbs.js";

export {
  ApiBase,
  type ApiBaseOptions,
  type JsonGetInit,
  type JsonVerbInit,
} from "./api-base.js";

export { MissingUrlParamError } from "./url-template.js";
