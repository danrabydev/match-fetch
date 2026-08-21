import { createMatchable } from "@danrabydev/match";
import { jsonOf } from "./json.js";
import {
  nsWithDiag,
  type FetchDiag,
  type MatchableNamespace,
} from "./namespace.js";
import { Http } from "./status.js";
import { Transport } from "./transport.js";

export type FetchResult<TData = unknown, TErr = unknown> =
  | { tag: "Ok"; body: TData }
  | { tag: "Created"; body: TData }
  | { tag: "NoContent" }
  | { tag: "Conflict"; response: Response; status: 409 }
  | { tag: "ClientError"; response: Response; status: number }
  | { tag: "ServerError"; response: Response; status: number }
  | { tag: "Other"; response: Response; status: number }
  | { tag: "NetworkError"; err: TErr }
  | { tag: "ParseError"; err: TErr };

type FetchResultCtors = {
  Ok: <T>(body: T) => { tag: "Ok"; body: T };
  Created: <T>(body: T) => { tag: "Created"; body: T };
  NoContent: () => { tag: "NoContent" };
  Conflict: (
    response: Response,
  ) => { tag: "Conflict"; response: Response; status: 409 };
  ClientError: (
    response: Response,
  ) => { tag: "ClientError"; response: Response; status: number };
  ServerError: (
    response: Response,
  ) => { tag: "ServerError"; response: Response; status: number };
  Other: (
    response: Response,
  ) => { tag: "Other"; response: Response; status: number };
  NetworkError: <E>(err: E) => { tag: "NetworkError"; err: E };
  ParseError: <E>(err: E) => { tag: "ParseError"; err: E };
};

export const FetchResult = createMatchable({
  Ok: (body: unknown) => ({ body }),
  Created: (body: unknown) => ({ body }),
  NoContent: () => ({}),
  Conflict: (response: Response) => ({ response, status: 409 as const }),
  ClientError: (response: Response) => ({
    response,
    status: response.status,
  }),
  ServerError: (response: Response) => ({
    response,
    status: response.status,
  }),
  Other: (response: Response) => ({ response, status: response.status }),
  NetworkError: (err: unknown) => ({ err }),
  ParseError: (err: unknown) => ({ err }),
}) as unknown as MatchableNamespace<FetchResult, FetchResultCtors>;

/** Map a transport attempt through default status + JSON parse (200/201 only). */
export async function toFetchResult<TData>(
  attempt: Transport,
  diag?: FetchDiag,
): Promise<FetchResult<TData>> {
  const FR = nsWithDiag(FetchResult, diag);

  async function parseJson(
    response: Response,
    wrap: (body: TData) => FetchResult<TData>,
  ): Promise<FetchResult<TData>> {
    // Tag checks, not Json.match: the parsed value is discarded.
    const parsed = await jsonOf<TData>(response);
    return parsed.tag === "Ok" ? wrap(parsed.body) : FR.ParseError(parsed.err);
  }

  if (attempt.tag === "Err") {
    return FR.NetworkError(attempt.err);
  }

  // Tag checks, not Http.match / Transport.match: those intermediates
  // share tags with FetchResult (Ok, ServerError, …) and must not emit.
  const mapped = Http.of(attempt.response);
  switch (mapped.tag) {
    case "Ok":
      return parseJson(mapped.response, (body) => FR.Ok(body));
    case "Created":
      return parseJson(mapped.response, (body) => FR.Created(body));
    case "NoContent":
      return FR.NoContent();
    case "Conflict":
      return FR.Conflict(mapped.response);
    case "ClientError":
      return FR.ClientError(mapped.response);
    case "ServerError":
      return FR.ServerError(mapped.response);
    case "Other":
      return FR.Other(mapped.response);
  }
}
