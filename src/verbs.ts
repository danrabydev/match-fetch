import { ApiBase, type JsonGetInit, type JsonVerbInit } from "./api-base.js";
import type { Json } from "./json.js";
import type { FetchResult } from "./result.js";

const standalone = new ApiBase();

export function get<TResponse>(
  input: RequestInfo | URL,
  init?: JsonGetInit,
): Promise<FetchResult<TResponse>> {
  return standalone.get<TResponse>(input, init);
}

export function head<TResponse>(
  input: RequestInfo | URL,
  init?: JsonGetInit,
): Promise<FetchResult<TResponse>> {
  return standalone.head<TResponse>(input, init);
}

/** Free-function DELETE (`delete` is a reserved word in import bindings). */
export function del<TResponse>(
  input: RequestInfo | URL,
  init?: JsonGetInit,
): Promise<FetchResult<TResponse>> {
  return standalone.delete<TResponse>(input, init);
}

export function post<TBody, TResponse>(
  input: RequestInfo | URL,
  body: TBody,
  init?: JsonVerbInit,
): Promise<FetchResult<TResponse>> {
  return standalone.post<TBody, TResponse>(input, body, init);
}

export function put<TBody, TResponse>(
  input: RequestInfo | URL,
  body: TBody,
  init?: JsonVerbInit,
): Promise<FetchResult<TResponse>> {
  return standalone.put<TBody, TResponse>(input, body, init);
}

export function patch<TBody, TResponse>(
  input: RequestInfo | URL,
  body: TBody,
  init?: JsonVerbInit,
): Promise<FetchResult<TResponse>> {
  return standalone.patch<TBody, TResponse>(input, body, init);
}

export function getJson<TResponse, TErr = unknown>(
  input: RequestInfo | URL,
  init?: JsonGetInit,
): Promise<Json<TResponse>> {
  return standalone.getJson<TResponse, TErr>(input, init);
}

export function headJson<TResponse, TErr = unknown>(
  input: RequestInfo | URL,
  init?: JsonGetInit,
): Promise<Json<TResponse>> {
  return standalone.headJson<TResponse, TErr>(input, init);
}

/** Free-function DELETE JSON (`deleteJson` on the class; `delete` is reserved). */
export function delJson<TResponse, TErr = unknown>(
  input: RequestInfo | URL,
  init?: JsonGetInit,
): Promise<Json<TResponse>> {
  return standalone.deleteJson<TResponse, TErr>(input, init);
}

export function postJson<TBody, TResponse, TErr = unknown>(
  input: RequestInfo | URL,
  body: TBody,
  init?: JsonVerbInit,
): Promise<Json<TResponse>> {
  return standalone.postJson<TBody, TResponse, TErr>(input, body, init);
}

export function putJson<TBody, TResponse, TErr = unknown>(
  input: RequestInfo | URL,
  body: TBody,
  init?: JsonVerbInit,
): Promise<Json<TResponse>> {
  return standalone.putJson<TBody, TResponse, TErr>(input, body, init);
}

export function patchJson<TBody, TResponse, TErr = unknown>(
  input: RequestInfo | URL,
  body: TBody,
  init?: JsonVerbInit,
): Promise<Json<TResponse>> {
  return standalone.patchJson<TBody, TResponse, TErr>(input, body, init);
}
