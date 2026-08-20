import { createMatchable } from "@danrabydev/match";
import { Json, jsonOf } from "./json.js";
import type { MatchableNamespace } from "./namespace.js";
import { Http } from "./status.js";
import { Transport } from "./transport.js";

export type FetchResult<TData = unknown, TErr = unknown> =
  | { tag: "Ok"; data: TData }
  | { tag: "Created"; data: TData }
  | { tag: "NoContent" }
  | { tag: "Conflict"; response: Response; status: 409 }
  | { tag: "ClientError"; response: Response; status: number }
  | { tag: "ServerError"; response: Response; status: number }
  | { tag: "Other"; response: Response; status: number }
  | { tag: "NetworkError"; err: TErr }
  | { tag: "ParseError"; err: TErr };

type FetchResultCtors = {
  Ok: <T>(data: T) => { tag: "Ok"; data: T };
  Created: <T>(data: T) => { tag: "Created"; data: T };
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
  Ok: (data: unknown) => ({ data }),
  Created: (data: unknown) => ({ data }),
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

async function parseJson<TData>(
  response: Response,
  wrap: (data: TData) => FetchResult<TData>,
): Promise<FetchResult<TData>> {
  return Json.match(await jsonOf<TData>(response), {
    Ok: ({ data }): FetchResult<TData> => wrap(data),
    Err: ({ err }): FetchResult<TData> => FetchResult.ParseError(err),
  });
}

async function fromResponse<TData>(
  response: Response,
): Promise<FetchResult<TData>> {
  return Http.match(Http.of(response), {
    Ok: ({ response: res }): Promise<FetchResult<TData>> =>
      parseJson(res, (data) => FetchResult.Ok(data)),
    Created: ({ response: res }): Promise<FetchResult<TData>> =>
      parseJson(res, (data) => FetchResult.Created(data)),
    NoContent: (): Promise<FetchResult<TData>> =>
      Promise.resolve(FetchResult.NoContent()),
    Conflict: ({ response: res }): Promise<FetchResult<TData>> =>
      Promise.resolve(FetchResult.Conflict(res)),
    ClientError: ({ response: res }): Promise<FetchResult<TData>> =>
      Promise.resolve(FetchResult.ClientError(res)),
    ServerError: ({ response: res }): Promise<FetchResult<TData>> =>
      Promise.resolve(FetchResult.ServerError(res)),
    Other: ({ response: res }): Promise<FetchResult<TData>> =>
      Promise.resolve(FetchResult.Other(res)),
  });
}

/** Map a transport attempt through default status + JSON parse (200/201 only). */
export async function toFetchResult<TData>(
  attempt: Transport,
): Promise<FetchResult<TData>> {
  return Transport.match(attempt, {
    Err: ({ err }): Promise<FetchResult<TData>> =>
      Promise.resolve(FetchResult.NetworkError(err)),
    Ok: ({ response }): Promise<FetchResult<TData>> =>
      fromResponse<TData>(response),
  });
}
