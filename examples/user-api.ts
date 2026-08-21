/**
 * Tiny API-client app: `UserApi extends ApiBase`, typed verbs, exhaustive
 * `FetchResult.match`. Tests import this file so the example cannot rot.
 */
import {
  ApiBase,
  FetchResult,
  Json,
  isHttpErr,
  type ApiBaseOptions,
  type FetchResult as FetchResultOf,
  type Json as JsonOf,
} from "../src/index.js";

export type User = { id: string; name: string };
export type NewUser = { name: string };

export class UserApi extends ApiBase<{ region: string }> {
  constructor(readonly region: string, options: ApiBaseOptions = {}) {
    super({
      baseUrl: "https://{region}.example.com",
      ...options,
    });
  }

  user(id: string): Promise<FetchResultOf<User>> {
    return this.get("/users/{id}", {
      params: { region: this.region, id },
    });
  }

  create(body: NewUser): Promise<FetchResultOf<User>> {
    return this.post("/users", body, {
      params: { region: this.region },
    });
  }

  raw(path: string) {
    return this.matchFetch(path, { params: { region: this.region } });
  }

  userJson(id: string): Promise<JsonOf<User>> {
    return this.getJson("/users/{id}", {
      params: { region: this.region, id },
    });
  }
}

export function handleUser(result: FetchResultOf<User>): string {
  return FetchResult.match(result, {
    Ok: ({ body }) => body.name,
    Created: ({ body }) => body.name,
    NoContent: () => "",
    Conflict: ({ status }) => `conflict ${status}`,
    ClientError: ({ status }) => `client ${status}`,
    ServerError: ({ status }) => `server ${status}`,
    Other: ({ status }) => `other ${status}`,
    NetworkError: ({ err }) => `network: ${String(err)}`,
    ParseError: ({ err }) => `parse: ${String(err)}`,
  });
}

export function handleUserJson(result: JsonOf<User>): string {
  return Json.match(result, {
    Ok: ({ body }) => body.name,
    Err: ({ err }) =>
      isHttpErr(err) ? `http ${err.status}` : `err: ${String(err)}`,
  });
}

export function createUserApi(
  token: string,
  fetchImpl: typeof globalThis.fetch,
  region = "api",
) {
  return new UserApi(region, {
    headers: { Authorization: `Bearer ${token}` },
    fetch: fetchImpl,
  });
}
