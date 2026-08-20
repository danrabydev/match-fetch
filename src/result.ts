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
  NetworkError: (err: unknown) => { tag: "NetworkError"; err: unknown };
  ParseError: (err: unknown) => { tag: "ParseError"; err: unknown };
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
    Ok: ({ data }) => wrap(data),
    Err: ({ err }) => FetchResult.ParseError(err) as FetchResult<TData>,
  });
}

async function fromResponse<TData>(
  response: Response,
): Promise<FetchResult<TData>> {
  return Http.match(Http.of(response), {
    Ok: ({ response: res }) =>
      parseJson(res, (data) => FetchResult.Ok(data) as FetchResult<TData>),
    Created: ({ response: res }) =>
      parseJson(res, (data) => FetchResult.Created(data) as FetchResult<TData>),
    NoContent: () => Promise.resolve(FetchResult.NoContent() as FetchResult<TData>),
    Conflict: ({ response: res }) =>
      Promise.resolve(FetchResult.Conflict(res) as FetchResult<TData>),
    ClientError: ({ response: res }) =>
      Promise.resolve(FetchResult.ClientError(res) as FetchResult<TData>),
    ServerError: ({ response: res }) =>
      Promise.resolve(FetchResult.ServerError(res) as FetchResult<TData>),
    Other: ({ response: res }) =>
      Promise.resolve(FetchResult.Other(res) as FetchResult<TData>),
  });
}

/** Map a transport attempt through default status + JSON parse (200/201 only). */
export async function toFetchResult<TData>(
  attempt: Transport,
): Promise<FetchResult<TData>> {
  return Transport.match(attempt, {
    Err: ({ err }) =>
      Promise.resolve(FetchResult.NetworkError(err) as FetchResult<TData>),
    Ok: ({ response }) => fromResponse<TData>(response),
  });
}
