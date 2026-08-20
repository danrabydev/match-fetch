import { createMatchable } from "@danrabydev/match";
import type { MatchableNamespace } from "./namespace.js";

/**
 * Extra `fetch` key is stripped before forwarding `RequestInit`.
 * Timeout/retry are out of scope — pass `signal: AbortSignal.timeout(ms)`.
 */
export type MatchFetchInit = RequestInit & {
  fetch?: typeof globalThis.fetch;
};

export type Transport =
  | { tag: "Ok"; response: Response }
  | { tag: "Err"; err: unknown };

type TransportCtors = {
  Ok: (response: Response) => { tag: "Ok"; response: Response };
  Err: (err: unknown) => { tag: "Err"; err: unknown };
};

export const Transport = createMatchable({
  Ok: (response: Response) => ({ response }),
  Err: (err: unknown) => ({ err }),
}) as unknown as MatchableNamespace<Transport, TransportCtors>;

function splitInit(init?: MatchFetchInit): {
  fetch: typeof globalThis.fetch;
  requestInit: RequestInit;
} {
  if (init === undefined) {
    return { fetch: globalThis.fetch, requestInit: {} };
  }
  const { fetch: fetchFn, ...requestInit } = init;
  return {
    fetch: fetchFn ?? globalThis.fetch,
    requestInit,
  };
}

/**
 * Layer 1: network vs `Response`. HTTP 404 is still `Ok`.
 */
export async function matchFetch(
  input: RequestInfo | URL,
  init?: MatchFetchInit,
): Promise<Transport> {
  const { fetch: fetchFn, requestInit } = splitInit(init);
  try {
    const response = await fetchFn(input, requestInit);
    return Transport.Ok(response);
  } catch (err) {
    return Transport.Err(err);
  }
}
