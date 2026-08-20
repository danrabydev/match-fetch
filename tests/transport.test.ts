import { describe, expect, it } from "vitest";
import { Transport, matchFetch } from "../src/index.js";

describe("matchFetch", () => {
  it("returns Ok with the same Response when fetch resolves", async () => {
    const response = new Response("ok", { status: 404 });
    const fetchImpl: typeof fetch = async () => response;
    const result = await matchFetch("/x", { fetch: fetchImpl });
    expect(result).toEqual({ tag: "Ok", response });
    expect(result.tag).toBe("Ok");
    if (result.tag === "Ok") {
      expect(result.response).toBe(response);
      expect(typeof result.response.json).toBe("function");
    }
  });

  it("returns Err when fetch rejects", async () => {
    const err = new TypeError("network");
    const fetchImpl: typeof fetch = async () => {
      throw err;
    };
    const result = await matchFetch("/x", { fetch: fetchImpl });
    expect(result).toEqual({ tag: "Err", err });
  });

  it("returns Err on AbortError", async () => {
    const err = new DOMException("aborted", "AbortError");
    const fetchImpl: typeof fetch = async () => {
      throw err;
    };
    const result = await matchFetch("/x", { fetch: fetchImpl });
    expect(result.tag).toBe("Err");
    if (result.tag === "Err") {
      expect(result.err).toBe(err);
    }
  });

  it("invokes the injected fetch and does not forward the fetch key", async () => {
    let called = false;
    let forwarded: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      called = true;
      forwarded = init;
      return new Response(null, { status: 200 });
    };
    await matchFetch("/x", { fetch: fetchImpl, method: "GET" });
    expect(called).toBe(true);
    expect(forwarded).toBeDefined();
    expect(forwarded).not.toHaveProperty("fetch");
    expect(forwarded?.method).toBe("GET");
  });
});

describe("Transport", () => {
  it("still treats HTTP 404 as Ok", async () => {
    const response = new Response(null, { status: 404 });
    const result = await matchFetch("/missing", {
      fetch: async () => response,
    });
    expect(
      Transport.match(result, {
        Ok: ({ response: res }) => res.status,
        Err: () => 0,
      }),
    ).toBe(404);
  });
});
