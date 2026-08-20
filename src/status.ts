import { createMatchable } from "@danrabydev/match";
import type { BoundMatch } from "./namespace.js";

type ReservedVariantName = "ClientError" | "ServerError" | "Other" | "of";

const RESERVED_VARIANT_NAME_SET = new Set<string>([
  "ClientError",
  "ServerError",
  "Other",
  "of",
]);

type ForbidReservedKeys<Codes> = [
  Extract<keyof Codes, ReservedVariantName>,
] extends [never]
  ? Codes
  : never;

export type StatusValue<Codes extends Record<string, number>> =
  | {
      [K in keyof Codes]: {
        tag: K & string;
        response: Response;
        status: Codes[K];
      };
    }[keyof Codes]
  | { tag: "ClientError"; response: Response; status: number }
  | { tag: "ServerError"; response: Response; status: number }
  | { tag: "Other"; response: Response; status: number };

type StatusNamespace<Codes extends Record<string, number>> = {
  [K in keyof Codes]: (
    response: Response,
  ) => Extract<StatusValue<Codes>, { tag: K }>;
} & {
  ClientError: (
    response: Response,
  ) => Extract<StatusValue<Codes>, { tag: "ClientError" }>;
  ServerError: (
    response: Response,
  ) => Extract<StatusValue<Codes>, { tag: "ServerError" }>;
  Other: (response: Response) => Extract<StatusValue<Codes>, { tag: "Other" }>;
  match: BoundMatch<StatusValue<Codes>>;
  _tags: readonly string[];
  of: (response: Response) => StatusValue<Codes>;
};

function isReservedVariantName(name: string): name is ReservedVariantName {
  return RESERVED_VARIANT_NAME_SET.has(name);
}

/**
 * Build an HTTP-status matchable: exact named codes, then leftover
 * 4xx → `ClientError`, 5xx → `ServerError`, else `Other`.
 *
 * Payload is always `{ response, status }` — the `Response` is wrapped,
 * never spread (`createMatchable` copies enumerable own fields only).
 */
export function createStatusMatchable<const Codes extends Record<string, number>>(
  codes: ForbidReservedKeys<Codes>,
): StatusNamespace<Codes> {
  const named: Record<
    string,
    (response: Response) => { response: Response; status: number }
  > = {};
  const byStatus = new Map<number, string>();

  for (const name of Object.keys(codes)) {
    if (isReservedVariantName(name)) {
      throw new Error(`reserved status variant name: ${name}`);
    }
    const code = codes[name as keyof Codes];
    if (typeof code !== "number" || !Number.isInteger(code)) {
      throw new Error(`status code must be an integer: ${name}`);
    }
    const existing = byStatus.get(code);
    if (existing !== undefined) {
      throw new Error(`duplicate status code: ${code} (${existing}, ${name})`);
    }
    byStatus.set(code, name);
    named[name] = (response: Response) => ({ response, status: code });
  }

  const ns = createMatchable({
    ...named,
    ClientError: (response: Response) => ({
      response,
      status: response.status,
    }),
    ServerError: (response: Response) => ({
      response,
      status: response.status,
    }),
    Other: (response: Response) => ({
      response,
      status: response.status,
    }),
  } as never);

  const constructors = ns as unknown as Record<
    string,
    (response: Response) => StatusValue<Codes>
  >;

  // Snapshot before assigning `of` so a colliding variant cannot recurse.
  const lookup: Record<
    string,
    (response: Response) => StatusValue<Codes>
  > = Object.create(null);
  for (const name of Object.keys(named)) {
    lookup[name] = constructors[name]!;
  }
  lookup.ClientError = constructors.ClientError!;
  lookup.ServerError = constructors.ServerError!;
  lookup.Other = constructors.Other!;

  function of(response: Response): StatusValue<Codes> {
    const name = byStatus.get(response.status);
    if (name !== undefined) {
      return lookup[name]!(response);
    }
    const status = response.status;
    if (status >= 400 && status <= 499) {
      return lookup.ClientError!(response);
    }
    if (status >= 500 && status <= 599) {
      return lookup.ServerError!(response);
    }
    return lookup.Other!(response);
  }

  return Object.assign(ns, { of }) as unknown as StatusNamespace<Codes>;
}

export const Http = createStatusMatchable({
  Ok: 200,
  Created: 201,
  NoContent: 204,
  Conflict: 409,
});

export type Http = StatusValue<{
  Ok: 200;
  Created: 201;
  NoContent: 204;
  Conflict: 409;
}>;
