import { describe, expect, expectTypeOf, it } from "vitest";
import {
  ApiBase,
  type FetchResult,
  type HttpErr,
  type Json,
  type Transport,
} from "../src/index.js";

type User = { id: string; name: string };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

class Probe extends ApiBase {
  raw(input: RequestInfo | URL, init?: Parameters<ApiBase["get"]>[1]) {
    return this.matchFetch(input, init);
  }

  nativeGet(input: RequestInfo | URL, init?: Parameters<ApiBase["get"]>[1]) {
    return this.requestGet(input, init);
  }

  nativePost<TBody>(
    input: RequestInfo | URL,
    body: TBody,
    init?: Parameters<ApiBase["post"]>[2],
  ) {
    return this.requestPost(input, body, init);
  }
}

describe("ApiBase", () => {
  it("joins relative paths to baseUrl", async () => {
    const urls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      urls.push(String(input));
      return jsonResponse(200, { id: "1", name: "ada" });
    };
    const api = new ApiBase({
      baseUrl: "https://api.example.com/v1",
      fetch: fetchImpl,
    });
    await api.get<User>("users");
    await api.get<User>("/users/1");
    expect(urls).toEqual([
      "https://api.example.com/v1/users",
      "https://api.example.com/v1/users/1",
    ]);
  });

  it("ignores baseUrl for absolute URLs", async () => {
    let url: string | undefined;
    const fetchImpl: typeof fetch = async (input) => {
      url = String(input);
      return jsonResponse(200, { id: "1", name: "ada" });
    };
    const api = new ApiBase({
      baseUrl: "https://api.example.com",
      fetch: fetchImpl,
    });
    await api.get<User>("https://other.example.com/users/1");
    expect(url).toBe("https://other.example.com/users/1");
  });

  it("sends default headers; per-request header of the same name wins", async () => {
    let headers: Headers | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      headers = new Headers(init?.headers);
      return jsonResponse(200, { id: "1", name: "ada" });
    };
    const api = new ApiBase({
      headers: { Authorization: "Bearer default", "X-Trace": "a" },
      fetch: fetchImpl,
    });
    await api.get<User>("/users/1", {
      headers: { Authorization: "Bearer request" },
    });
    expect(headers?.get("Authorization")).toBe("Bearer request");
    expect(headers?.get("X-Trace")).toBe("a");
  });

  it("uses constructor fetch; per-request fetch overrides it", async () => {
    const used: string[] = [];
    const defaultFetch: typeof fetch = async () => {
      used.push("default");
      return jsonResponse(200, { id: "1", name: "ada" });
    };
    const requestFetch: typeof fetch = async () => {
      used.push("request");
      return jsonResponse(200, { id: "1", name: "ada" });
    };
    const api = new ApiBase({ fetch: defaultFetch });
    await api.get<User>("/a");
    await api.get<User>("/b", { fetch: requestFetch });
    expect(used).toEqual(["default", "request"]);
  });

  it("getJson returns Json with data already parsed", async () => {
    const api = new ApiBase({
      fetch: async () => jsonResponse(200, { id: "1", name: "ada" }),
    });
    const result = await api.getJson<User>("/users/1");
    expectTypeOf(result).toEqualTypeOf<Json<User, HttpErr>>();
    expect(result.tag).toBe("Ok");
    if (result.tag === "Ok") {
      expectTypeOf(result.data).toEqualTypeOf<User>();
      expect(result.data.name).toBe("ada");
    }
  });

  it("subclass methods return Promise<FetchResult<User>>", async () => {
    class UserApi extends ApiBase {
      user(id: string) {
        return this.get<User>(`/users/${id}`);
      }
    }
    const api = new UserApi({
      fetch: async () => jsonResponse(200, { id: "1", name: "ada" }),
    });
    const result = await api.user("1");
    expectTypeOf(result).toEqualTypeOf<FetchResult<User>>();
    expect(result.tag).toBe("Ok");
  });

  it("requestGet / requestPost return Response and throw on network", async () => {
    const api = new Probe({
      fetch: async (_input, init) => {
        expect(init?.method).toBe("GET");
        return jsonResponse(200, { id: "1", name: "ada" });
      },
    });
    const response = await api.nativeGet("/users/1");
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "1", name: "ada" });

    let posted: string | undefined;
    const poster = new Probe({
      fetch: async (_input, init) => {
        posted = String(init?.body);
        expect(init?.method).toBe("POST");
        return jsonResponse(201, { id: "1", name: "ada" });
      },
    });
    const created = await poster.nativePost("/users", { name: "ada" });
    expect(posted).toBe(JSON.stringify({ name: "ada" }));
    expect(created.status).toBe(201);

    const failing = new Probe({
      fetch: async () => {
        throw new TypeError("offline");
      },
    });
    await expect(failing.nativeGet("/users/1")).rejects.toThrow("offline");
  });

  it("protected matchFetch returns Transport", async () => {
    const response = new Response(null, { status: 404 });
    const api = new Probe({ fetch: async () => response });
    const result = await api.raw("/x");
    expectTypeOf(result).toEqualTypeOf<Transport>();
    expect(result.tag).toBe("Ok");
    if (result.tag === "Ok") {
      expect(result.response.status).toBe(404);
    }
  });

  it("delete and head set the corresponding method", async () => {
    const methods: string[] = [];
    const fetchImpl: typeof fetch = async (_input, init) => {
      methods.push(init?.method ?? "");
      return new Response(null, { status: 204 });
    };
    const api = new ApiBase({ fetch: fetchImpl });
    expect((await api.delete<User>("/users/1")).tag).toBe("NoContent");
    await api.head<User>("/users/1");
    expect(methods).toEqual(["DELETE", "HEAD"]);
  });

  it("rejects method on JSON verb init at the type level", async () => {
    const api = new ApiBase({
      fetch: async () => jsonResponse(200, { id: "1", name: "ada" }),
    });
    await api.get<User>("/users/1", {
      // @ts-expect-error method is fixed by the verb
      method: "DELETE",
    });
  });

  it("protected requestJson lets a subclass send DELETE", async () => {
    class Users extends ApiBase {
      remove(id: string) {
        return this.requestJson<User>("DELETE", `/users/${id}`);
      }
    }
    let method: string | undefined;
    const api = new Users({
      fetch: async (_input, init) => {
        method = init?.method;
        return new Response(null, { status: 204 });
      },
    });
    const result = await api.remove("1");
    expect(method).toBe("DELETE");
    expect(result.tag).toBe("NoContent");
  });

  it("combines constructor and per-request abort signals", async () => {
    const constructorCtl = new AbortController();
    const requestCtl = new AbortController();
    let forwarded: AbortSignal | undefined;
    const api = new ApiBase({
      signal: constructorCtl.signal,
      fetch: async (_input, init) => {
        forwarded = init?.signal ?? undefined;
        return jsonResponse(200, { id: "1", name: "ada" });
      },
    });
    await api.get<User>("/users/1", { signal: requestCtl.signal });
    expect(forwarded).toBeDefined();
    expect(forwarded).not.toBe(constructorCtl.signal);
    expect(forwarded).not.toBe(requestCtl.signal);
    expect(forwarded?.aborted).toBe(false);
    constructorCtl.abort();
    expect(forwarded?.aborted).toBe(true);
  });

  it("keeps a constructor-only signal", async () => {
    const ctl = new AbortController();
    let forwarded: AbortSignal | undefined;
    const api = new ApiBase({
      signal: ctl.signal,
      fetch: async (_input, init) => {
        forwarded = init?.signal ?? undefined;
        return jsonResponse(200, { id: "1", name: "ada" });
      },
    });
    await api.get<User>("/users/1");
    expect(forwarded).toBe(ctl.signal);
  });
});
