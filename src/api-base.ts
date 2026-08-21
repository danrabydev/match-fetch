import { jsonOf, Json, type Json as JsonOf } from "./json.js";
import { nsWithDiag, type FetchDiag } from "./namespace.js";
import { toFetchResult, type FetchResult } from "./result.js";
import {
  splitInit,
  Transport,
  type MatchFetchInit,
} from "./transport.js";

export type ApiBaseOptions = MatchFetchInit & {
  baseUrl?: string;
};

/** Per-request init for JSON verbs; the verb always sets `method`. */
export type JsonVerbInit = Omit<MatchFetchInit, "method">;

/** `get` / `head` / `delete` also omit `body` (no request payload). */
export type JsonGetInit = Omit<MatchFetchInit, "method" | "body">;

function isAbsoluteUrl(input: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(input) || input.startsWith("//");
}

function joinBase(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const suffix = path.replace(/^\/+/, "");
  if (suffix === "") return base;
  return `${base}/${suffix}`;
}

function mergeHeaders(
  defaults?: HeadersInit,
  request?: HeadersInit,
): Headers {
  const headers = new Headers(defaults);
  if (request !== undefined) {
    new Headers(request).forEach((value, key) => {
      headers.set(key, value);
    });
  }
  return headers;
}

/**
 * Subclassable JSON client. Constructor options are default `RequestInit`
 * plus `baseUrl` and optional `diagnostics` (stripped before `fetch`).
 * Per-request `init` overrides fields except headers, which merge (request
 * wins), and `signal`, which combines via `AbortSignal.any` when both
 * constructor and request provide one. A per-request `diagnostics` mask
 * replaces the constructor mask.
 */
export class ApiBase {
  readonly #options: ApiBaseOptions;

  constructor(options: ApiBaseOptions = {}) {
    this.#options = options;
  }

  get<TResponse>(
    input: RequestInfo | URL,
    init?: JsonGetInit,
  ): Promise<FetchResult<TResponse>> {
    return this.requestJson<TResponse>("GET", input, undefined, init);
  }

  head<TResponse>(
    input: RequestInfo | URL,
    init?: JsonGetInit,
  ): Promise<FetchResult<TResponse>> {
    return this.requestJson<TResponse>("HEAD", input, undefined, init);
  }

  delete<TResponse>(
    input: RequestInfo | URL,
    init?: JsonGetInit,
  ): Promise<FetchResult<TResponse>> {
    return this.requestJson<TResponse>("DELETE", input, undefined, init);
  }

  post<TBody, TResponse>(
    input: RequestInfo | URL,
    body: TBody,
    init?: JsonVerbInit,
  ): Promise<FetchResult<TResponse>> {
    return this.requestJson<TResponse>("POST", input, body, init);
  }

  put<TBody, TResponse>(
    input: RequestInfo | URL,
    body: TBody,
    init?: JsonVerbInit,
  ): Promise<FetchResult<TResponse>> {
    return this.requestJson<TResponse>("PUT", input, body, init);
  }

  patch<TBody, TResponse>(
    input: RequestInfo | URL,
    body: TBody,
    init?: JsonVerbInit,
  ): Promise<FetchResult<TResponse>> {
    return this.requestJson<TResponse>("PATCH", input, body, init);
  }

  getJson<TResponse, TErr = unknown>(
    input: RequestInfo | URL,
    init?: JsonGetInit,
  ): Promise<JsonOf<TResponse>> {
    return this.requestAsJson<TResponse, TErr>("GET", input, undefined, init);
  }

  headJson<TResponse, TErr = unknown>(
    input: RequestInfo | URL,
    init?: JsonGetInit,
  ): Promise<JsonOf<TResponse>> {
    return this.requestAsJson<TResponse, TErr>("HEAD", input, undefined, init);
  }

  deleteJson<TResponse, TErr = unknown>(
    input: RequestInfo | URL,
    init?: JsonGetInit,
  ): Promise<JsonOf<TResponse>> {
    return this.requestAsJson<TResponse, TErr>("DELETE", input, undefined, init);
  }

  postJson<TBody, TResponse, TErr = unknown>(
    input: RequestInfo | URL,
    body: TBody,
    init?: JsonVerbInit,
  ): Promise<JsonOf<TResponse>> {
    return this.requestAsJson<TResponse, TErr>("POST", input, body, init);
  }

  putJson<TBody, TResponse, TErr = unknown>(
    input: RequestInfo | URL,
    body: TBody,
    init?: JsonVerbInit,
  ): Promise<JsonOf<TResponse>> {
    return this.requestAsJson<TResponse, TErr>("PUT", input, body, init);
  }

  patchJson<TBody, TResponse, TErr = unknown>(
    input: RequestInfo | URL,
    body: TBody,
    init?: JsonVerbInit,
  ): Promise<JsonOf<TResponse>> {
    return this.requestAsJson<TResponse, TErr>("PATCH", input, body, init);
  }

  /**
   * Native `fetch` with merged defaults. Throws on network/abort.
   * 4th argument is already-`JSON.stringify`'d JSON and sets
   * `Content-Type: application/json` when unset. FormData/streams: `init.body`.
   */
  protected request(
    method: string,
    input: RequestInfo | URL,
    init?: JsonVerbInit,
    body?: string,
  ): Promise<Response> {
    const merged = this.mergeInit(method, init, body);
    const { fetch: fetchFn, requestInit } = splitInit(merged);
    return fetchFn(this.resolveUrl(input), requestInit);
  }

  protected requestGet(
    input: RequestInfo | URL,
    init?: JsonGetInit,
  ): Promise<Response> {
    return this.request("GET", input, init);
  }

  protected requestHead(
    input: RequestInfo | URL,
    init?: JsonGetInit,
  ): Promise<Response> {
    return this.request("HEAD", input, init);
  }

  protected requestDelete(
    input: RequestInfo | URL,
    init?: JsonGetInit,
  ): Promise<Response> {
    return this.request("DELETE", input, init);
  }

  protected requestPost<TBody>(
    input: RequestInfo | URL,
    body: TBody,
    init?: JsonVerbInit,
  ): Promise<Response> {
    return this.request("POST", input, init, JSON.stringify(body));
  }

  protected requestPut<TBody>(
    input: RequestInfo | URL,
    body: TBody,
    init?: JsonVerbInit,
  ): Promise<Response> {
    return this.request("PUT", input, init, JSON.stringify(body));
  }

  protected requestPatch<TBody>(
    input: RequestInfo | URL,
    body: TBody,
    init?: JsonVerbInit,
  ): Promise<Response> {
    return this.request("PATCH", input, init, JSON.stringify(body));
  }

  /** HTTP 404 is still `Ok`. Does not throw; network failures are `Err`. */
  protected async matchFetch(
    input: RequestInfo | URL,
    init?: MatchFetchInit,
  ): Promise<Transport> {
    const method = init?.method ?? "GET";
    const T = nsWithDiag(Transport, this.resolveDiag(init));
    try {
      const response = await this.request(method, input, init);
      return T.Ok(response);
    } catch (err) {
      return T.Err(err);
    }
  }

  protected resolveUrl(input: RequestInfo | URL): RequestInfo | URL {
    const baseUrl = this.#options.baseUrl;
    if (baseUrl === undefined || baseUrl === "") return input;
    if (typeof input !== "string") return input;
    if (isAbsoluteUrl(input)) return input;
    return joinBase(baseUrl, input);
  }

  private resolveDiag(init?: MatchFetchInit): FetchDiag | undefined {
    return init?.diagnostics ?? this.#options.diagnostics;
  }

  private mergeInit(
    method: string,
    init?: JsonVerbInit,
    body?: string,
  ): MatchFetchInit {
    const { baseUrl: _baseUrl, ...defaultInit } = this.#options;
    const headers = mergeHeaders(defaultInit.headers, init?.headers);
    if (body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const fetchFn = init?.fetch ?? defaultInit.fetch;
    const merged: MatchFetchInit = {
      ...defaultInit,
      ...init,
      method,
      headers,
    };
    const defaultSignal = defaultInit.signal ?? undefined;
    const requestSignal = init?.signal ?? undefined;
    if (defaultSignal !== undefined && requestSignal !== undefined) {
      merged.signal = AbortSignal.any([defaultSignal, requestSignal]);
    }
    if (fetchFn !== undefined) {
      merged.fetch = fetchFn;
    } else {
      delete merged.fetch;
    }
    if (body !== undefined) {
      merged.body = body;
    } else if (method === "GET" || method === "HEAD" || method === "DELETE") {
      delete merged.body;
    }
    return merged;
  }

  protected async requestJson<TResponse>(
    method: string,
    input: RequestInfo | URL,
    body?: unknown,
    init?: JsonVerbInit,
  ): Promise<FetchResult<TResponse>> {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const diag = this.resolveDiag(init);
    try {
      const response = await this.request(method, input, init, payload);
      return toFetchResult<TResponse>(Transport.Ok(response), diag);
    } catch (err) {
      return toFetchResult<TResponse>(Transport.Err(err), diag);
    }
  }

  protected async requestAsJson<TResponse, TErr = unknown>(
    method: string,
    input: RequestInfo | URL,
    body?: unknown,
    init?: JsonVerbInit,
  ): Promise<JsonOf<TResponse>> {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const diag = this.resolveDiag(init);
    const J = nsWithDiag(Json, diag);
    try {
      const response = await this.request(method, input, init, payload);
      if (!response.ok) {
        const parsed = await jsonOf<TErr>(response, diag);
        const parsedBody = parsed.tag === "Ok" ? parsed.body : undefined;
        return J.Err({ status: response.status, body: parsedBody });
      }
      return jsonOf<TResponse>(response, diag);
    } catch (err) {
      return J.Err(err);
    }
  }
}
