import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  del,
  FetchResult,
  get,
  getJson,
  head,
  Json,
  patch,
  post,
  postJson,
  put,
} from "../src/index.js";

type User = { id: string; name: string };
type NewUser = { name: string };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fetchReturning(response: Response): typeof fetch {
  return async () => response;
}

describe("get / FetchResult", () => {
  it("parses 200 JSON as Ok with TResponse", async () => {
    const result = await get<User>("/users/1", {
      fetch: fetchReturning(jsonResponse(200, { id: "1", name: "ada" })),
    });
    expect(result.tag).toBe("Ok");
    if (result.tag === "Ok") {
      expect(result.data).toEqual({ id: "1", name: "ada" });
      expectTypeOf(result.data).toEqualTypeOf<User>();
    }
  });

  it("parses 201 JSON as Created with TResponse", async () => {
    const result = await get<User>("/users", {
      fetch: fetchReturning(jsonResponse(201, { id: "2", name: "grace" })),
    });
    expect(result.tag).toBe("Created");
    if (result.tag === "Created") {
      expectTypeOf(result.data).toEqualTypeOf<User>();
      expect(result.data.name).toBe("grace");
    }
  });

  it("maps 204 to NoContent without calling json", async () => {
    const response = new Response(null, { status: 204 });
    const json = vi.spyOn(response, "json");
    const result = await get<User>("/users/1", {
      fetch: fetchReturning(response),
    });
    expect(result.tag).toBe("NoContent");
    expect(json).not.toHaveBeenCalled();
  });

  it("maps 409 to Conflict and 404 to ClientError", async () => {
    const conflict = await get<User>("/users/1", {
      fetch: fetchReturning(jsonResponse(409, { error: "dup" })),
    });
    expect(conflict.tag).toBe("Conflict");
    if (conflict.tag === "Conflict") {
      expect(conflict.status).toBe(409);
      expect(typeof conflict.response.json).toBe("function");
    }

    const missing = await get<User>("/users/1", {
      fetch: fetchReturning(jsonResponse(404, { error: "nope" })),
    });
    expect(missing.tag).toBe("ClientError");
    if (missing.tag === "ClientError") {
      expect(missing.status).toBe(404);
    }
  });

  it("maps 500 to ServerError", async () => {
    const result = await get<User>("/users/1", {
      fetch: fetchReturning(jsonResponse(500, { error: "boom" })),
    });
    expect(result.tag).toBe("ServerError");
  });

  it("maps fetch reject to NetworkError", async () => {
    const err = new TypeError("offline");
    const result = await get<User>("/users/1", {
      fetch: async () => {
        throw err;
      },
    });
    expect(result.tag).toBe("NetworkError");
    if (result.tag === "NetworkError") {
      expect(result.err).toBe(err);
    }
  });

  it("maps 200 with invalid JSON to ParseError", async () => {
    const result = await get<User>("/users/1", {
      fetch: fetchReturning(new Response("not json", { status: 200 })),
    });
    expect(result.tag).toBe("ParseError");
  });

  it("types Ok/Created data as TResponse and requires every arm", () => {
    const check = (result: FetchResult<User>) => {
      const name = FetchResult.match(result, {
        Ok: ({ data }) => data.name,
        Created: ({ data }) => data.name,
        NoContent: () => "",
        Conflict: () => "",
        ClientError: () => "",
        ServerError: () => "",
        Other: () => "",
        NetworkError: () => "",
        ParseError: () => "",
      });
      expectTypeOf(name).toEqualTypeOf<string>();

      // @ts-expect-error NetworkError arm is required
      FetchResult.match(result, {
        Ok: () => "",
        Created: () => "",
        NoContent: () => "",
        Conflict: () => "",
        ClientError: () => "",
        ServerError: () => "",
        Other: () => "",
        ParseError: () => "",
      });
    };
    check(FetchResult.Ok({ id: "1", name: "ada" }));
  });

  it("narrows constructor results to that arm; extra arms are allowed", () => {
    const ok = FetchResult.Ok({ id: "1", name: "ada" });
    expectTypeOf(ok).toEqualTypeOf<{ tag: "Ok"; data: User }>();
    const name = FetchResult.match(ok, {
      Ok: ({ data }) => data.name,
    });
    expectTypeOf(name).toEqualTypeOf<string>();
    expect(name).toBe("ada");

    FetchResult.match(ok, {
      Ok: ({ data }) => data.name,
      ParseError: () => "",
    });
  });
});

describe("post / put / patch", () => {
  it("POSTs JSON body and sets Content-Type", async () => {
    let input: RequestInfo | URL | undefined;
    let init: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (req, requestInit) => {
      input = req;
      init = requestInit;
      return jsonResponse(201, { id: "1", name: "ada" });
    };
    const body: NewUser = { name: "ada" };
    const result = await post<NewUser, User>("/users", body, {
      fetch: fetchImpl,
    });
    expect(result.tag).toBe("Created");
    expect(input).toBe("/users");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify(body));
    expect(new Headers(init?.headers).get("Content-Type")).toBe(
      "application/json",
    );
  });

  it("does not clobber an existing Content-Type", async () => {
    let init: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (_req, requestInit) => {
      init = requestInit;
      return jsonResponse(200, { id: "1", name: "ada" });
    };
    await post<NewUser, User>("/users", { name: "ada" }, {
      fetch: fetchImpl,
      headers: { "Content-Type": "application/vnd.api+json" },
    });
    expect(new Headers(init?.headers).get("Content-Type")).toBe(
      "application/vnd.api+json",
    );
  });

  it("put and patch set the corresponding method", async () => {
    const methods: string[] = [];
    const fetchImpl: typeof fetch = async (_req, init) => {
      methods.push(init?.method ?? "");
      return jsonResponse(200, { id: "1", name: "ada" });
    };
    await put<NewUser, User>("/users/1", { name: "ada" }, { fetch: fetchImpl });
    await patch<NewUser, User>("/users/1", { name: "ada" }, {
      fetch: fetchImpl,
    });
    expect(methods).toEqual(["PUT", "PATCH"]);
  });
});

describe("del / head", () => {
  it("sends DELETE and HEAD", async () => {
    const methods: string[] = [];
    const fetchImpl: typeof fetch = async (_req, init) => {
      methods.push(init?.method ?? "");
      return new Response(null, { status: 204 });
    };
    expect((await del<User>("/users/1", { fetch: fetchImpl })).tag).toBe(
      "NoContent",
    );
    await head<User>("/users/1", { fetch: fetchImpl });
    expect(methods).toEqual(["DELETE", "HEAD"]);
  });
});

describe("getJson / postJson", () => {
  it("parses 200 JSON as Ok with TResponse", async () => {
    const result = await getJson<User>("/users/1", {
      fetch: fetchReturning(jsonResponse(200, { id: "1", name: "ada" })),
    });
    expect(result.tag).toBe("Ok");
    if (result.tag === "Ok") {
      expect(result.data).toEqual({ id: "1", name: "ada" });
      expectTypeOf(result.data).toEqualTypeOf<User>();
    }
  });

  it("maps 404 to Err with the Response", async () => {
    const result = await getJson<User>("/users/1", {
      fetch: fetchReturning(jsonResponse(404, { error: "nope" })),
    });
    expect(result.tag).toBe("Err");
    if (result.tag === "Err") {
      expect(result.err).toBeInstanceOf(Response);
      expect((result.err as Response).status).toBe(404);
    }
  });

  it("maps 500 to Err with the Response", async () => {
    const result = await getJson<User>("/users/1", {
      fetch: fetchReturning(jsonResponse(500, { error: "boom" })),
    });
    expect(result.tag).toBe("Err");
    if (result.tag === "Err") {
      expect((result.err as Response).status).toBe(500);
    }
  });

  it("maps fetch reject to Err", async () => {
    const err = new TypeError("offline");
    const result = await getJson<User>("/users/1", {
      fetch: async () => {
        throw err;
      },
    });
    expect(result.tag).toBe("Err");
    if (result.tag === "Err") {
      expect(result.err).toBe(err);
    }
  });

  it("maps invalid JSON to Err", async () => {
    const result = await getJson<User>("/users/1", {
      fetch: fetchReturning(new Response("not json", { status: 200 })),
    });
    expect(result.tag).toBe("Err");
  });

  it("maps an empty 204 body to Err", async () => {
    const result = await getJson<User>("/users/1", {
      fetch: async () => new Response(null, { status: 204 }),
    });
    expect(result.tag).toBe("Err");
  });

  it("POSTs JSON body and only requires Ok/Err arms", async () => {
    let method: string | undefined;
    let body: unknown;
    const result = await postJson<NewUser, User>(
      "/users",
      { name: "ada" },
      {
        fetch: async (_req, init) => {
          method = init?.method;
          body = init?.body;
          return jsonResponse(201, { id: "1", name: "ada" });
        },
      },
    );
    expect(method).toBe("POST");
    expect(body).toBe(JSON.stringify({ name: "ada" }));
    const name = Json.match(result, {
      Ok: ({ data }) => data.name,
      Err: () => "",
    });
    expectTypeOf(name).toEqualTypeOf<string>();
    expect(name).toBe("ada");
  });
});
