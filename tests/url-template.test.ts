import { describe, expect, expectTypeOf, it } from "vitest";
import { ApiBase } from "../src/index.js";
import {
  substituteUrl,
  type ExtractUrlParams,
} from "../src/url-template.js";

type User = { id: string; name: string };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ExtractUrlParams", () => {
  it("pulls names from a closed {pair}", () => {
    expectTypeOf<
      ExtractUrlParams<"https://{region}.example.com/users/{id}">
    >().toEqualTypeOf<"region" | "id">();
    expectTypeOf<ExtractUrlParams<"/users">>().toEqualTypeOf<never>();
    expectTypeOf<ExtractUrlParams<string>>().toEqualTypeOf<never>();
  });
});

describe("substituteUrl", () => {
  it("encodes values and fills every placeholder", () => {
    expect(
      substituteUrl("https://{region}.example.com/users/{id}", {
        region: "api",
        id: "a/b",
      }),
    ).toBe("https://api.example.com/users/a%2Fb");
  });

  it("throws on missing names and empty {}", () => {
    expect(() => substituteUrl("/users/{id}", {})).toThrowError(
      "missing url param: id",
    );
    expect(() => substituteUrl("/users/{}", { id: "1" })).toThrowError(
      "missing url param: (empty)",
    );
  });
});

describe("ApiBase URL templates", () => {
  it("joins then substitutes baseUrl and path once", async () => {
    const urls: string[] = [];
    const api = new ApiBase<{ region: string }>({
      baseUrl: "https://{region}.example.com/v1",
      fetch: async (input) => {
        urls.push(String(input));
        return jsonResponse(200, { id: "1", name: "ada" });
      },
    });
    await api.get<User>("/users/{id}", {
      params: { region: "us", id: "1" },
    });
    expect(urls).toEqual(["https://us.example.com/v1/users/1"]);
  });

  it("accepts numeric path params", async () => {
    let url: string | undefined;
    const api = new ApiBase({
      fetch: async (input) => {
        url = String(input);
        return jsonResponse(200, { id: "1", name: "ada" });
      },
    });
    await api.get<User>("/users/{id}", { params: { id: 1 } });
    expect(url).toBe("/users/1");
  });

  it("does not forward params to fetch", async () => {
    let forwarded: RequestInit | undefined;
    const api = new ApiBase<{ region: string }>({
      baseUrl: "https://{region}.example.com",
      fetch: async (_input, init) => {
        forwarded = init;
        return jsonResponse(200, { id: "1", name: "ada" });
      },
    });
    await api.get<User>("/users/{id}", {
      params: { region: "api", id: "1" },
    });
    expect(forwarded).not.toHaveProperty("params");
    expect(forwarded).not.toHaveProperty("fetch");
  });

  it("skips baseUrl for an absolute templated path", async () => {
    let url: string | undefined;
    const api = new ApiBase<{ region: string }>({
      baseUrl: "https://{region}.example.com",
      fetch: async (input) => {
        url = String(input);
        return jsonResponse(200, { id: "1", name: "ada" });
      },
    });
    await api.get<User>("https://other.example.com/users/{id}", {
      params: { region: "us", id: "9" },
    });
    expect(url).toBe("https://other.example.com/users/9");
  });

  it("throws when a placeholder is missing at runtime", async () => {
    const api = new ApiBase({
      fetch: async () => jsonResponse(200, { id: "1", name: "ada" }),
    });
    await expect(
      api.get<User>("/users/{id}", { params: { id: "1" } } as never),
    ).resolves.toMatchObject({ tag: "Ok" });
    const path: string = "/users/{id}";
    await expect(api.get<User>(path)).rejects.toThrowError(
      "missing url param: id",
    );
  });

  it("does not require params for Request inputs", async () => {
    let url: string | undefined;
    const api = new ApiBase<{ region: string }>({
      baseUrl: "https://{region}.example.com",
      fetch: async (input) => {
        url = input instanceof Request ? input.url : String(input);
        return jsonResponse(200, { id: "1", name: "ada" });
      },
    });
    await api.get<User>(new Request("https://example.com/users/1"));
    expect(url).toBe("https://example.com/users/1");
  });

  it("still requires region on a path with no placeholders", async () => {
    const api = new ApiBase<{ region: string }>({
      baseUrl: "https://{region}.example.com",
      fetch: async () => jsonResponse(200, { id: "1", name: "ada" }),
    });
    const ok = await api.get<User>("/users", { params: { region: "api" } });
    expect(ok.tag).toBe("Ok");

    const missing = async () => {
      // @ts-expect-error region is required even when the path has no {region}
      await api.get<User>("/users");
    };
    expectTypeOf(missing).toBeFunction();
  });

  it("throws when baseUrl has a placeholder missing from params", async () => {
    const api = new ApiBase<{ region: string }>({
      baseUrl: "https://{tenant}.example.com",
      fetch: async () => jsonResponse(200, { id: "1", name: "ada" }),
    });
    await expect(
      api.get<User>("/users", { params: { region: "us" } }),
    ).rejects.toThrowError("missing url param: tenant");
  });

  it("accepts a RequestInfo | URL union", async () => {
    const urls: string[] = [];
    const api = new ApiBase({
      fetch: async (input) => {
        urls.push(input instanceof Request ? input.url : String(input));
        return jsonResponse(200, { id: "1", name: "ada" });
      },
    });
    const input: RequestInfo | URL = "/users/1";
    await api.get<User>(input);
    expect(urls).toEqual(["/users/1"]);
  });

  it("keeps init optional when there are no placeholders", async () => {
    const api = new ApiBase({
      fetch: async () => jsonResponse(200, { id: "1", name: "ada" }),
    });
    const result = await api.get<User>("/users");
    expect(result.tag).toBe("Ok");
  });

  it("type-errors when id is omitted from a literal path", async () => {
    const api = new ApiBase({
      fetch: async () => jsonResponse(200, { id: "1", name: "ada" }),
    });
    const missing = async () => {
      // @ts-expect-error id is required when the path is a literal
      await api.get("/users/{id}");
    };
    expectTypeOf(missing).toBeFunction();
    const ok = await api.get("/users/{id}", { params: { id: "1" } });
    expect(ok.tag).toBe("Ok");
  });
});
