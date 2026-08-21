import { jsonOf, Json, type Json as JsonOf } from "./json.js";
import { nsWithDiag, type FetchDiag } from "./namespace.js";
import { toFetchResult, type FetchResult } from "./result.js";
import {
  splitInit,
  Transport,
  type MatchFetchInit,
} from "./transport.js";
import {
  MissingUrlParamError,
  substituteUrl,
  type VerbArgs,
  type UrlParams,
} from "./url-template.js";

export type ApiBaseOptions = MatchFetchInit & {
  baseUrl?: string;
};

/** Per-request init for JSON verbs; the verb always sets `method`. */
export type JsonVerbInit = Omit<MatchFetchInit, "method">;

/** `get` / `head` / `delete` also omit `body` (no request payload). */
export type JsonGetInit = Omit<MatchFetchInit, "method" | "body">;

type InitBag<TInit> = TInit & { params?: UrlParams };

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

function readParams(init?: { params?: UrlParams }): UrlParams | undefined {
  return init?.params;
}

/**
 * Subclassable JSON client. Constructor options are default `RequestInit`
 * plus `baseUrl` and optional `diagnostics` (stripped before `fetch`).
 * `{name}` in `baseUrl` and the path are filled from per-call `params`
 * (`TUrlParams` plus placeholders on that path). Per-request `init`
 * overrides fields except headers, which merge (request wins), and
 * `signal`, which combines via `AbortSignal.any` when both constructor
 * and request provide one. A per-request `diagnostics` mask replaces
 * the constructor mask.
 */
export class ApiBase<
  TUrlParams extends Record<string, string | number> = {},
> {
  readonly #options: ApiBaseOptions;

  constructor(options: ApiBaseOptions = {}) {
    this.#options = options;
  }

  get<TResponse, const TPath extends string | Request | URL = string>(
    input: TPath,
    ...args: VerbArgs<TUrlParams, TPath, JsonGetInit>
  ): Promise<FetchResult<TResponse>>;
  get<TResponse>(
    input: Request | URL,
    init?: InitBag<JsonGetInit>,
  ): Promise<FetchResult<TResponse>>;
  get<TResponse>(
    input: RequestInfo | URL,
    init?: InitBag<JsonGetInit>,
  ): Promise<FetchResult<TResponse>> {
    return this.requestJson<TResponse>("GET", input, undefined, init);
  }

  head<TResponse, const TPath extends string | Request | URL = string>(
    input: TPath,
    ...args: VerbArgs<TUrlParams, TPath, JsonGetInit>
  ): Promise<FetchResult<TResponse>>;
  head<TResponse>(
    input: Request | URL,
    init?: InitBag<JsonGetInit>,
  ): Promise<FetchResult<TResponse>>;
  head<TResponse>(
    input: RequestInfo | URL,
    init?: InitBag<JsonGetInit>,
  ): Promise<FetchResult<TResponse>> {
    return this.requestJson<TResponse>("HEAD", input, undefined, init);
  }

  delete<TResponse, const TPath extends string | Request | URL = string>(
    input: TPath,
    ...args: VerbArgs<TUrlParams, TPath, JsonGetInit>
  ): Promise<FetchResult<TResponse>>;
  delete<TResponse>(
    input: Request | URL,
    init?: InitBag<JsonGetInit>,
  ): Promise<FetchResult<TResponse>>;
  delete<TResponse>(
    input: RequestInfo | URL,
    init?: InitBag<JsonGetInit>,
  ): Promise<FetchResult<TResponse>> {
    return this.requestJson<TResponse>("DELETE", input, undefined, init);
  }

  post<TBody, TResponse, const TPath extends string | Request | URL = string>(
    input: TPath,
    body: TBody,
    ...args: VerbArgs<TUrlParams, TPath, JsonVerbInit>
  ): Promise<FetchResult<TResponse>>;
  post<TBody, TResponse>(
    input: Request | URL,
    body: TBody,
    init?: InitBag<JsonVerbInit>,
  ): Promise<FetchResult<TResponse>>;
  post<TBody, TResponse>(
    input: RequestInfo | URL,
    body: TBody,
    init?: InitBag<JsonVerbInit>,
  ): Promise<FetchResult<TResponse>> {
    return this.requestJson<TResponse>("POST", input, body, init);
  }

  put<TBody, TResponse, const TPath extends string | Request | URL = string>(
    input: TPath,
    body: TBody,
    ...args: VerbArgs<TUrlParams, TPath, JsonVerbInit>
  ): Promise<FetchResult<TResponse>>;
  put<TBody, TResponse>(
    input: Request | URL,
    body: TBody,
    init?: InitBag<JsonVerbInit>,
  ): Promise<FetchResult<TResponse>>;
  put<TBody, TResponse>(
    input: RequestInfo | URL,
    body: TBody,
    init?: InitBag<JsonVerbInit>,
  ): Promise<FetchResult<TResponse>> {
    return this.requestJson<TResponse>("PUT", input, body, init);
  }

  patch<TBody, TResponse, const TPath extends string | Request | URL = string>(
    input: TPath,
    body: TBody,
    ...args: VerbArgs<TUrlParams, TPath, JsonVerbInit>
  ): Promise<FetchResult<TResponse>>;
  patch<TBody, TResponse>(
    input: Request | URL,
    body: TBody,
    init?: InitBag<JsonVerbInit>,
  ): Promise<FetchResult<TResponse>>;
  patch<TBody, TResponse>(
    input: RequestInfo | URL,
    body: TBody,
    init?: InitBag<JsonVerbInit>,
  ): Promise<FetchResult<TResponse>> {
    return this.requestJson<TResponse>("PATCH", input, body, init);
  }

  getJson<TResponse, TErr = unknown, const TPath extends string | Request | URL = string>(
    input: TPath,
    ...args: VerbArgs<TUrlParams, TPath, JsonGetInit>
  ): Promise<JsonOf<TResponse>>;
  getJson<TResponse, TErr = unknown>(
    input: Request | URL,
    init?: InitBag<JsonGetInit>,
  ): Promise<JsonOf<TResponse>>;
  getJson<TResponse, TErr = unknown>(
    input: RequestInfo | URL,
    init?: InitBag<JsonGetInit>,
  ): Promise<JsonOf<TResponse>> {
    return this.requestAsJson<TResponse, TErr>("GET", input, undefined, init);
  }

  headJson<TResponse, TErr = unknown, const TPath extends string | Request | URL = string>(
    input: TPath,
    ...args: VerbArgs<TUrlParams, TPath, JsonGetInit>
  ): Promise<JsonOf<TResponse>>;
  headJson<TResponse, TErr = unknown>(
    input: Request | URL,
    init?: InitBag<JsonGetInit>,
  ): Promise<JsonOf<TResponse>>;
  headJson<TResponse, TErr = unknown>(
    input: RequestInfo | URL,
    init?: InitBag<JsonGetInit>,
  ): Promise<JsonOf<TResponse>> {
    return this.requestAsJson<TResponse, TErr>("HEAD", input, undefined, init);
  }

  deleteJson<TResponse, TErr = unknown, const TPath extends string | Request | URL = string>(
    input: TPath,
    ...args: VerbArgs<TUrlParams, TPath, JsonGetInit>
  ): Promise<JsonOf<TResponse>>;
  deleteJson<TResponse, TErr = unknown>(
    input: Request | URL,
    init?: InitBag<JsonGetInit>,
  ): Promise<JsonOf<TResponse>>;
  deleteJson<TResponse, TErr = unknown>(
    input: RequestInfo | URL,
    init?: InitBag<JsonGetInit>,
  ): Promise<JsonOf<TResponse>> {
    return this.requestAsJson<TResponse, TErr>(
      "DELETE",
      input,
      undefined,
      init,
    );
  }

  postJson<
    TBody,
    TResponse,
    TErr = unknown,
    const TPath extends string | Request | URL = string,
  >(
    input: TPath,
    body: TBody,
    ...args: VerbArgs<TUrlParams, TPath, JsonVerbInit>
  ): Promise<JsonOf<TResponse>>;
  postJson<TBody, TResponse, TErr = unknown>(
    input: Request | URL,
    body: TBody,
    init?: InitBag<JsonVerbInit>,
  ): Promise<JsonOf<TResponse>>;
  postJson<TBody, TResponse, TErr = unknown>(
    input: RequestInfo | URL,
    body: TBody,
    init?: InitBag<JsonVerbInit>,
  ): Promise<JsonOf<TResponse>> {
    return this.requestAsJson<TResponse, TErr>("POST", input, body, init);
  }

  putJson<
    TBody,
    TResponse,
    TErr = unknown,
    const TPath extends string | Request | URL = string,
  >(
    input: TPath,
    body: TBody,
    ...args: VerbArgs<TUrlParams, TPath, JsonVerbInit>
  ): Promise<JsonOf<TResponse>>;
  putJson<TBody, TResponse, TErr = unknown>(
    input: Request | URL,
    body: TBody,
    init?: InitBag<JsonVerbInit>,
  ): Promise<JsonOf<TResponse>>;
  putJson<TBody, TResponse, TErr = unknown>(
    input: RequestInfo | URL,
    body: TBody,
    init?: InitBag<JsonVerbInit>,
  ): Promise<JsonOf<TResponse>> {
    return this.requestAsJson<TResponse, TErr>("PUT", input, body, init);
  }

  patchJson<
    TBody,
    TResponse,
    TErr = unknown,
    const TPath extends string | Request | URL = string,
  >(
    input: TPath,
    body: TBody,
    ...args: VerbArgs<TUrlParams, TPath, JsonVerbInit>
  ): Promise<JsonOf<TResponse>>;
  patchJson<TBody, TResponse, TErr = unknown>(
    input: Request | URL,
    body: TBody,
    init?: InitBag<JsonVerbInit>,
  ): Promise<JsonOf<TResponse>>;
  patchJson<TBody, TResponse, TErr = unknown>(
    input: RequestInfo | URL,
    body: TBody,
    init?: InitBag<JsonVerbInit>,
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
    init?: InitBag<JsonVerbInit>,
    body?: string,
  ): Promise<Response> {
    const merged = this.mergeInit(method, init, body);
    const { fetch: fetchFn, requestInit } = splitInit(merged);
    return fetchFn(this.resolveUrl(input, readParams(init)), requestInit);
  }

  protected requestGet<const TPath extends string | Request | URL = string>(
    input: TPath,
    ...args: VerbArgs<TUrlParams, TPath, JsonGetInit>
  ): Promise<Response>;
  protected requestGet(
    input: Request | URL,
    init?: InitBag<JsonGetInit>,
  ): Promise<Response>;
  protected requestGet(
    input: RequestInfo | URL,
    init?: InitBag<JsonGetInit>,
  ): Promise<Response> {
    return this.request("GET", input, init);
  }

  protected requestHead<const TPath extends string | Request | URL = string>(
    input: TPath,
    ...args: VerbArgs<TUrlParams, TPath, JsonGetInit>
  ): Promise<Response>;
  protected requestHead(
    input: Request | URL,
    init?: InitBag<JsonGetInit>,
  ): Promise<Response>;
  protected requestHead(
    input: RequestInfo | URL,
    init?: InitBag<JsonGetInit>,
  ): Promise<Response> {
    return this.request("HEAD", input, init);
  }

  protected requestDelete<const TPath extends string | Request | URL = string>(
    input: TPath,
    ...args: VerbArgs<TUrlParams, TPath, JsonGetInit>
  ): Promise<Response>;
  protected requestDelete(
    input: Request | URL,
    init?: InitBag<JsonGetInit>,
  ): Promise<Response>;
  protected requestDelete(
    input: RequestInfo | URL,
    init?: InitBag<JsonGetInit>,
  ): Promise<Response> {
    return this.request("DELETE", input, init);
  }

  protected requestPost<TBody, const TPath extends string | Request | URL = string>(
    input: TPath,
    body: TBody,
    ...args: VerbArgs<TUrlParams, TPath, JsonVerbInit>
  ): Promise<Response>;
  protected requestPost<TBody>(
    input: Request | URL,
    body: TBody,
    init?: InitBag<JsonVerbInit>,
  ): Promise<Response>;
  protected requestPost<TBody>(
    input: RequestInfo | URL,
    body: TBody,
    init?: InitBag<JsonVerbInit>,
  ): Promise<Response> {
    return this.request("POST", input, init, JSON.stringify(body));
  }

  protected requestPut<TBody, const TPath extends string | Request | URL = string>(
    input: TPath,
    body: TBody,
    ...args: VerbArgs<TUrlParams, TPath, JsonVerbInit>
  ): Promise<Response>;
  protected requestPut<TBody>(
    input: Request | URL,
    body: TBody,
    init?: InitBag<JsonVerbInit>,
  ): Promise<Response>;
  protected requestPut<TBody>(
    input: RequestInfo | URL,
    body: TBody,
    init?: InitBag<JsonVerbInit>,
  ): Promise<Response> {
    return this.request("PUT", input, init, JSON.stringify(body));
  }

  protected requestPatch<TBody, const TPath extends string | Request | URL = string>(
    input: TPath,
    body: TBody,
    ...args: VerbArgs<TUrlParams, TPath, JsonVerbInit>
  ): Promise<Response>;
  protected requestPatch<TBody>(
    input: Request | URL,
    body: TBody,
    init?: InitBag<JsonVerbInit>,
  ): Promise<Response>;
  protected requestPatch<TBody>(
    input: RequestInfo | URL,
    body: TBody,
    init?: InitBag<JsonVerbInit>,
  ): Promise<Response> {
    return this.request("PATCH", input, init, JSON.stringify(body));
  }

  /** HTTP 404 is still `Ok`. Does not throw; network failures are `Err`. */
  protected matchFetch<const TPath extends string | Request | URL = string>(
    input: TPath,
    ...args: VerbArgs<TUrlParams, TPath, MatchFetchInit>
  ): Promise<Transport>;
  protected matchFetch(
    input: Request | URL,
    init?: InitBag<MatchFetchInit>,
  ): Promise<Transport>;
  protected async matchFetch(
    input: RequestInfo | URL,
    init?: InitBag<MatchFetchInit>,
  ): Promise<Transport> {
    const method = init?.method ?? "GET";
    const T = nsWithDiag(Transport, this.resolveDiag(init));
    try {
      const response = await this.request(method, input, init);
      return T.Ok(response);
    } catch (err) {
      if (err instanceof MissingUrlParamError) throw err;
      return T.Err(err);
    }
  }

  protected resolveUrl(
    input: RequestInfo | URL,
    params?: UrlParams,
  ): RequestInfo | URL {
    if (typeof input !== "string") return input;
    const baseUrl = this.#options.baseUrl;
    const joined =
      baseUrl === undefined || baseUrl === "" || isAbsoluteUrl(input)
        ? input
        : joinBase(baseUrl, input);
    if (!joined.includes("{")) return joined;
    return substituteUrl(joined, params ?? {});
  }

  private resolveDiag(init?: MatchFetchInit): FetchDiag | undefined {
    return init?.diagnostics ?? this.#options.diagnostics;
  }

  private mergeInit(
    method: string,
    init?: InitBag<JsonVerbInit>,
    body?: string,
  ): MatchFetchInit {
    const { baseUrl: _baseUrl, ...defaultInit } = this.#options;
    const { params: _params, ...initRest } = init ?? {};
    const headers = mergeHeaders(defaultInit.headers, initRest.headers);
    if (body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const fetchFn = initRest.fetch ?? defaultInit.fetch;
    const merged: MatchFetchInit = {
      ...defaultInit,
      ...initRest,
      method,
      headers,
    };
    const defaultSignal = defaultInit.signal ?? undefined;
    const requestSignal = initRest.signal ?? undefined;
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
    init?: InitBag<JsonVerbInit>,
  ): Promise<FetchResult<TResponse>> {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const diag = this.resolveDiag(init);
    try {
      const response = await this.request(method, input, init, payload);
      return toFetchResult<TResponse>(Transport.Ok(response), diag);
    } catch (err) {
      if (err instanceof MissingUrlParamError) throw err;
      return toFetchResult<TResponse>(Transport.Err(err), diag);
    }
  }

  protected async requestAsJson<TResponse, TErr = unknown>(
    method: string,
    input: RequestInfo | URL,
    body?: unknown,
    init?: InitBag<JsonVerbInit>,
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
      if (err instanceof MissingUrlParamError) throw err;
      return J.Err(err);
    }
  }
}
