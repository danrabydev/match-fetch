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
 * `response.json()` without throwing. `getJson` calls this only when
 * `response.ok`. Status-table `get` uses this on 200/201 (`Ok`/`Created`
 * or `ParseError`). Use it in an `Err` / 4xx arm to parse an error body.
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
