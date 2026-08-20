import { describe, expect, expectTypeOf, it } from "vitest";
import {
  createUserApi,
  handleUser,
  handleUserJson,
  type User,
} from "../examples/user-api.js";
import type { FetchResult, HttpErr, Json } from "../src/index.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("examples/user-api", () => {
  it("gets a user with default baseUrl and Authorization", async () => {
    let url: string | undefined;
    let auth: string | null = null;
    const fetchImpl: typeof fetch = async (input, init) => {
      url = String(input);
      auth = new Headers(init?.headers).get("Authorization");
      return jsonResponse(200, { id: "1", name: "ada" });
    };
    const api = createUserApi("tok", fetchImpl);
    const result = await api.user("1");
    expect(url).toBe("https://api.example.com/users/1");
    expect(auth).toBe("Bearer tok");
    expect(handleUser(result)).toBe("ada");
    expectTypeOf(result).toEqualTypeOf<FetchResult<User>>();
  });

  it("posts a new user as Created", async () => {
    const fetchImpl: typeof fetch = async (_input, init) => {
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(JSON.stringify({ name: "ada" }));
      return jsonResponse(201, { id: "1", name: "ada" });
    };
    const api = createUserApi("tok", fetchImpl);
    expect(handleUser(await api.create({ name: "ada" }))).toBe("ada");
  });

  it("handleUser covers error arms", async () => {
    const api = createUserApi("tok", async () =>
      jsonResponse(409, { error: "dup" }),
    );
    expect(handleUser(await api.create({ name: "ada" }))).toBe("conflict 409");
  });

  it("userJson parses immediately into Json Ok/Err", async () => {
    const api = createUserApi("tok", async () =>
      jsonResponse(200, { id: "1", name: "ada" }),
    );
    const result = await api.userJson("1");
    expectTypeOf(result).toEqualTypeOf<Json<User, HttpErr>>();
    expect(handleUserJson(result)).toBe("ada");
  });
});
