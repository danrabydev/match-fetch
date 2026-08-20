import { ApiBase, type JsonGetInit, type JsonVerbInit } from "./api-base.js";
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
