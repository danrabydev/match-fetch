import { createMatchable } from "@danrabydev/match";
import type { MatchableNamespace } from "./namespace.js";

export type Json<TData = unknown, TErr = unknown> =
  | { tag: "Ok"; data: TData }
  | { tag: "Err"; err: TErr };

/** HTTP failure on `getJson`: status plus parsed envelope (`data` if JSON). */
export type HttpErr<TErr = unknown> = {
  status: number;
  data: TErr | undefined;
};

export function isHttpErr<TErr = unknown>(err: unknown): err is HttpErr<TErr> {
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    typeof (err as { status: unknown }).status === "number" &&
    "data" in err
  );
}

type JsonCtors = {
  Ok: <T>(data: T) => { tag: "Ok"; data: T };
  Err: <E>(err: E) => { tag: "Err"; err: E };
};

export const Json = createMatchable({
  Ok: (data: unknown) => ({ data }),
  Err: (err: unknown) => ({ err }),
}) as unknown as MatchableNamespace<Json, JsonCtors>;

/**
 * `response.json()` without throwing. `getJson` uses this on 2xx (`Ok`) and
 * on 4xx/5xx (`Err` `{ status, data }`). Status-table `get` uses this on
 * 200/201 (`Ok`/`Created` or `ParseError`).
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
