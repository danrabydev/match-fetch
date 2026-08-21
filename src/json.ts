import { createMatchable } from "@danrabydev/match";
import type { MatchableNamespace } from "./namespace.js";

export type Json<TData = unknown, TErr = unknown> =
  | { tag: "Ok"; body: TData }
  | { tag: "Err"; err: TErr };

/** HTTP failure on `getJson`: status plus parsed envelope (`body` if JSON). */
export type HttpErr<TErr = unknown> = {
  status: number;
  body: TErr | undefined;
};

export function isHttpErr<TErr = unknown>(err: unknown): err is HttpErr<TErr> {
  return (
    typeof err === "object" &&
    err !== null &&
    Object.hasOwn(err, "status") &&
    Object.hasOwn(err, "body") &&
    typeof (err as { status: unknown }).status === "number"
  );
}

type JsonCtors = {
  Ok: <T>(body: T) => { tag: "Ok"; body: T };
  Err: <E>(err: E) => { tag: "Err"; err: E };
};

export const Json = createMatchable({
  Ok: (body: unknown) => ({ body }),
  Err: (err: unknown) => ({ err }),
}) as unknown as MatchableNamespace<Json, JsonCtors>;

/**
 * `response.json()` without throwing. `getJson` uses this on 2xx (`Ok`) and
 * on 4xx/5xx (`Err` `{ status, body }`). Status-table `get` uses this on
 * 200/201 (`Ok`/`Created` or `ParseError`).
 */
export async function jsonOf<TData = unknown>(
  response: Response,
): Promise<Json<TData>> {
  try {
    const body = (await response.json()) as TData;
    return Json.Ok(body);
  } catch (err) {
    return Json.Err(err);
  }
}
