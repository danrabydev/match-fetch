import { ApiBase, type JsonGetInit, type JsonVerbInit } from "./api-base.js";
import type { Json } from "./json.js";
import type { FetchResult } from "./result.js";
import type { VerbArgs } from "./url-template.js";

const standalone = new ApiBase();

type Input = string | Request | URL;

export function get<TResponse, const TPath extends Input = string>(
  input: TPath,
  ...args: VerbArgs<{}, TPath, JsonGetInit>
): Promise<FetchResult<TResponse>> {
  return standalone.get(input, ...args);
}

export function head<TResponse, const TPath extends Input = string>(
  input: TPath,
  ...args: VerbArgs<{}, TPath, JsonGetInit>
): Promise<FetchResult<TResponse>> {
  return standalone.head(input, ...args);
}

/** Free-function DELETE (`delete` is a reserved word in import bindings). */
export function del<TResponse, const TPath extends Input = string>(
  input: TPath,
  ...args: VerbArgs<{}, TPath, JsonGetInit>
): Promise<FetchResult<TResponse>> {
  return standalone.delete(input, ...args);
}

export function post<TBody, TResponse, const TPath extends Input = string>(
  input: TPath,
  body: TBody,
  ...args: VerbArgs<{}, TPath, JsonVerbInit>
): Promise<FetchResult<TResponse>> {
  return standalone.post(input, body, ...args);
}

export function put<TBody, TResponse, const TPath extends Input = string>(
  input: TPath,
  body: TBody,
  ...args: VerbArgs<{}, TPath, JsonVerbInit>
): Promise<FetchResult<TResponse>> {
  return standalone.put(input, body, ...args);
}

export function patch<TBody, TResponse, const TPath extends Input = string>(
  input: TPath,
  body: TBody,
  ...args: VerbArgs<{}, TPath, JsonVerbInit>
): Promise<FetchResult<TResponse>> {
  return standalone.patch(input, body, ...args);
}

export function getJson<
  TResponse,
  TErr = unknown,
  const TPath extends Input = string,
>(
  input: TPath,
  ...args: VerbArgs<{}, TPath, JsonGetInit>
): Promise<Json<TResponse>> {
  return standalone.getJson<TResponse, TErr, TPath>(input, ...args);
}

export function headJson<
  TResponse,
  TErr = unknown,
  const TPath extends Input = string,
>(
  input: TPath,
  ...args: VerbArgs<{}, TPath, JsonGetInit>
): Promise<Json<TResponse>> {
  return standalone.headJson<TResponse, TErr, TPath>(input, ...args);
}

/** Free-function DELETE JSON (`deleteJson` on the class; `delete` is reserved). */
export function delJson<
  TResponse,
  TErr = unknown,
  const TPath extends Input = string,
>(
  input: TPath,
  ...args: VerbArgs<{}, TPath, JsonGetInit>
): Promise<Json<TResponse>> {
  return standalone.deleteJson<TResponse, TErr, TPath>(input, ...args);
}

export function postJson<
  TBody,
  TResponse,
  TErr = unknown,
  const TPath extends Input = string,
>(
  input: TPath,
  body: TBody,
  ...args: VerbArgs<{}, TPath, JsonVerbInit>
): Promise<Json<TResponse>> {
  return standalone.postJson<TBody, TResponse, TErr, TPath>(
    input,
    body,
    ...args,
  );
}

export function putJson<
  TBody,
  TResponse,
  TErr = unknown,
  const TPath extends Input = string,
>(
  input: TPath,
  body: TBody,
  ...args: VerbArgs<{}, TPath, JsonVerbInit>
): Promise<Json<TResponse>> {
  return standalone.putJson<TBody, TResponse, TErr, TPath>(
    input,
    body,
    ...args,
  );
}

export function patchJson<
  TBody,
  TResponse,
  TErr = unknown,
  const TPath extends Input = string,
>(
  input: TPath,
  body: TBody,
  ...args: VerbArgs<{}, TPath, JsonVerbInit>
): Promise<Json<TResponse>> {
  return standalone.patchJson<TBody, TResponse, TErr, TPath>(
    input,
    body,
    ...args,
  );
}
