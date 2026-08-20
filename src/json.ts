import { createMatchable } from "@danrabydev/match";
import type { MatchableNamespace } from "./namespace.js";

export type Json<TData = unknown, TErr = unknown> =
  | { tag: "Ok"; data: TData }
  | { tag: "Err"; err: TErr };

type JsonCtors = {
  Ok: <T>(data: T) => { tag: "Ok"; data: T };
  Err: <E>(err: E) => { tag: "Err"; err: E };
};

export const Json = createMatchable({
  Ok: (data: unknown) => ({ data }),
  Err: (err: unknown) => ({ err }),
}) as unknown as MatchableNamespace<Json, JsonCtors>;

/**
 * `response.json()` without throwing. `getJson` parses every status into
 * `Json`. Status-table `get` uses this only on 200/201 (`Ok`/`Created` or
 * `ParseError`). Use it in a 4xx/5xx arm to parse an error body.
 */
export async function jsonOf<TData = unknown>(
  response: Response,
): Promise<Json<TData>> {
  try {
    const data = (await response.json()) as TData;
    return Json.Ok(data);
  } catch (err) {
    return Json.Err(err);
  }
}
