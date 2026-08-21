import { createMatchable } from "@danrabydev/match";
import {
  nsWithDiag,
  type FetchDiag,
  type MatchableNamespace,
} from "./namespace.js";

/**
 * Extra `fetch` and `diagnostics` keys are stripped before forwarding
 * `RequestInit`. Timeout/retry are out of scope — pass
 * `signal: AbortSignal.timeout(ms)`.
 */
export type MatchFetchInit = RequestInit & {
  fetch?: typeof globalThis.fetch;
  /** Match 0.3 mask; stripped before `fetch`. */
  diagnostics?: FetchDiag;
};

export type Transport =
  | { tag: "Ok"; response: Response }
  | { tag: "Err"; err: unknown };

type TransportCtors = {
  Ok: (response: Response) => { tag: "Ok"; response: Response };
  Err: <E>(err: E) => { tag: "Err"; err: E };
};

export const Transport = createMatchable({
  Ok: (response: Response) => ({ response }),
  Err: (err: unknown) => ({ err }),
}) as unknown as MatchableNamespace<Transport, TransportCtors>;

export function splitInit(init?: MatchFetchInit): {
  fetch: typeof globalThis.fetch;
  requestInit: RequestInit;
  diagnostics: FetchDiag | undefined;
} {
  if (init === undefined) {
    return {
      fetch: globalThis.fetch,
      requestInit: {},
      diagnostics: undefined,
    };
  }
  const { fetch: fetchFn, diagnostics, ...requestInit } = init;
  return {
    fetch: fetchFn ?? globalThis.fetch,
    requestInit,
    diagnostics,
  };
}

/**
 * Layer 1: network vs `Response`. HTTP 404 is still `Ok`.
 */
export async function matchFetch(
  input: RequestInfo | URL,
  init?: MatchFetchInit,
): Promise<Transport> {
  const { fetch: fetchFn, requestInit, diagnostics: diag } = splitInit(init);
  const T = nsWithDiag(Transport, diag);
  try {
    const response = await fetchFn(input, requestInit);
    return T.Ok(response);
  } catch (err) {
    return T.Err(err);
  }
}
