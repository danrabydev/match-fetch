import { toFetchResult, type FetchResult } from "./result.js";
import { matchFetch, type MatchFetchInit, type Transport } from "./transport.js";

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
 * plus `baseUrl`. Per-request `init` overrides fields except headers, which
 * merge (request wins), and `signal`, which combines via `AbortSignal.any`
 * when both constructor and request provide one.
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

  /** Raw `Response` path for non-JSON (FormData, streams, custom status tables). */
  protected matchFetch(
    input: RequestInfo | URL,
    init?: MatchFetchInit,
  ): Promise<Transport> {
    const method = init?.method ?? "GET";
    return matchFetch(this.resolveUrl(input), this.mergeInit(method, init));
  }

  protected resolveUrl(input: RequestInfo | URL): RequestInfo | URL {
    const baseUrl = this.#options.baseUrl;
    if (baseUrl === undefined || baseUrl === "") return input;
    if (typeof input !== "string") return input;
    if (isAbsoluteUrl(input)) return input;
    return joinBase(baseUrl, input);
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
    const merged = this.mergeInit(method, init, payload);
    const attempt = await matchFetch(this.resolveUrl(input), merged);
    return toFetchResult<TResponse>(attempt);
  }
}
