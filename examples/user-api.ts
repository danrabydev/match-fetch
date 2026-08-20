/**
 * Tiny API-client app: `UserApi extends ApiBase`, typed verbs, exhaustive
 * `FetchResult.match`. Tests import this file so the example cannot rot.
 */
import {
  ApiBase,
  FetchResult,
  Json,
  type FetchResult as FetchResultOf,
  type Json as JsonOf,
} from "../src/index.js";

export type User = { id: string; name: string };
export type NewUser = { name: string };

export class UserApi extends ApiBase {
  user(id: string) {
    return this.get<User>(`/users/${id}`);
  }

  create(body: NewUser) {
    return this.post<NewUser, User>("/users", body);
  }

  raw(path: string) {
    return this.matchFetch(path);
  }

  userJson(id: string) {
    return this.getJson<User>(`/users/${id}`);
  }
}

export function handleUser(result: FetchResultOf<User>): string {
  return FetchResult.match(result, {
    Ok: ({ data }) => data.name,
    Created: ({ data }) => data.name,
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
    Ok: ({ data }) => data.name,
    Err: ({ err }) =>
      err instanceof Response ? `http ${err.status}` : `err: ${String(err)}`,
  });
}

export function createUserApi(
  token: string,
  fetchImpl: typeof globalThis.fetch,
) {
  return new UserApi({
    baseUrl: "https://api.example.com",
    headers: { Authorization: `Bearer ${token}` },
    fetch: fetchImpl,
  });
}
