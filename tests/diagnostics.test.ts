import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  ApiBase,
  disableDiagnostics,
  enableDiagnostics,
  FetchResult,
  Http,
  Json,
  jsonOf,
  matchFetch,
  peekTrace,
  peeker,
  toFetchResult,
  Transport,
} from "../src/index.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function res(status: number): Response {
  return new Response(null, { status });
}

afterEach(() => {
  disableDiagnostics();
  vi.restoreAllMocks();
});

const fetchResultArms = {
  Ok: () => "ok",
  Created: () => "created",
  NoContent: () => "empty",
  Conflict: () => "conflict",
  ClientError: () => "client",
  ServerError: () => "server",
  Other: () => "other",
  NetworkError: () => "network",
  ParseError: () => "parse",
} as const;

describe("Http.withDiagnostics", () => {
  it("rebinds of so mapped values carry the mask", () => {
    const bound = Http.withDiagnostics({
      enabled: true,
      branches: ["ServerError"],
    });
    const server = bound.of(res(500));
    const unbound = Http.of(res(500));
    Http.peek(server, { ServerError: () => {} });
    Http.peek(unbound, { ServerError: () => {} });
    expect(peekTrace(server)).toEqual([
      { kind: "peek", peeker: "anonymous", tag: "ServerError", hit: true },
    ]);
    expect(peekTrace(unbound)).toEqual([]);
    expect(server.tag).toBe("ServerError");
  });

  it("is silent for tags outside branches", () => {
    const bound = Http.withDiagnostics({
      enabled: true,
      branches: ["ServerError"],
    });
    const ok = bound.of(res(200));
    Http.peek(ok, { Ok: () => {} });
    expect(peekTrace(ok)).toEqual([]);
  });
});

describe("jsonOf diagnostics", () => {
  it("records parse Err when enabled", async () => {
    const result = await jsonOf(new Response("not json"), {
      enabled: true,
      branches: ["Err"],
    });
    Json.peek(result, { Err: () => {} });
    expect(result.tag).toBe("Err");
    expect(peekTrace(result)).toEqual([
      { kind: "peek", peeker: "anonymous", tag: "Err", hit: true },
    ]);
  });

  it("is silent without a mask", async () => {
    const result = await jsonOf(new Response("not json"));
    Json.peek(result, { Err: () => {} });
    expect(peekTrace(result)).toEqual([]);
  });
});

describe("matchFetch diagnostics", () => {
  it("attaches the mask to Transport.Err", async () => {
    const err = new TypeError("network");
    const result = await matchFetch("/x", {
      fetch: async () => {
        throw err;
      },
      diagnostics: { enabled: true, branches: ["Err"] },
    });
    Transport.peek(result, { Err: () => {} });
    expect(result.tag).toBe("Err");
    expect(peekTrace(result)).toEqual([
      { kind: "peek", peeker: "anonymous", tag: "Err", hit: true },
    ]);
  });
});

describe("toFetchResult diagnostics", () => {
  it("attaches the mask to NetworkError", async () => {
    const result = await toFetchResult(
      Transport.Err(new TypeError("offline")),
      { enabled: true, branches: ["NetworkError"] },
    );
    FetchResult.peek(result, { NetworkError: () => {} });
    expect(result.tag).toBe("NetworkError");
    expect(peekTrace(result)).toEqual([
      { kind: "peek", peeker: "anonymous", tag: "NetworkError", hit: true },
    ]);
  });

  it("attaches the mask to ServerError", async () => {
    const result = await toFetchResult(
      Transport.Ok(jsonResponse(500, { error: "x" })),
      { enabled: true, branches: ["ServerError"] },
    );
    FetchResult.peek(result, { ServerError: () => {} });
    expect(result.tag).toBe("ServerError");
    expect(peekTrace(result)).toEqual([
      { kind: "peek", peeker: "anonymous", tag: "ServerError", hit: true },
    ]);
  });

  it("does not emit onMatch for discarded Http/Json intermediates", async () => {
    const events: { kind: string; tag: string }[] = [];
    const result = await toFetchResult(
      Transport.Ok(jsonResponse(500, { error: "x" })),
      {
        enabled: true,
        branches: ["Ok", "ServerError"],
        onMatch: (event) => events.push(event),
      },
    );
    expect(result.tag).toBe("ServerError");
    expect(events).toEqual([]);
    expect(FetchResult.match(result, fetchResultArms)).toBe("server");
    expect(events).toEqual([
      { kind: "match", tag: "ServerError", peekers: [] },
    ]);
  });

  it("does not emit onMatch for discarded Ok intermediates on 200", async () => {
    const events: { kind: string; tag: string }[] = [];
    const result = await toFetchResult(
      Transport.Ok(jsonResponse(200, { id: "1", name: "ada" })),
      {
        enabled: true,
        branches: ["Ok"],
        onMatch: (event) => events.push(event),
      },
    );
    expect(result.tag).toBe("Ok");
    expect(events).toEqual([]);
    expect(FetchResult.match(result, fetchResultArms)).toBe("ok");
    expect(events).toEqual([{ kind: "match", tag: "Ok", peekers: [] }]);
  });
});

describe("ApiBase diagnostics", () => {
  it("does not forward diagnostics to fetch", async () => {
    let forwarded: RequestInit | undefined;
    const api = new ApiBase({
      diagnostics: { enabled: true, branches: ["ServerError"] },
      fetch: async (_input, init) => {
        forwarded = init;
        return jsonResponse(200, { id: "1", name: "ada" });
      },
    });
    await api.get("/x");
    expect(forwarded).not.toHaveProperty("diagnostics");
    expect(forwarded).not.toHaveProperty("fetch");
  });

  it("uses the constructor mask on get ServerError", async () => {
    const api = new ApiBase({
      diagnostics: { enabled: true, branches: ["ServerError"] },
      fetch: async () => jsonResponse(500, { error: "x" }),
    });
    const result = await api.get("/x");
    const log = peeker("http.errors", {
      ServerError: () => {},
    });
    FetchResult.peek(result, log);
    expect(result.tag).toBe("ServerError");
    expect(peekTrace(result)).toEqual([
      { kind: "peek", peeker: "http.errors", tag: "ServerError", hit: true },
    ]);
  });

  it("uses the constructor mask on getJson HTTP Err", async () => {
    const api = new ApiBase({
      diagnostics: { enabled: true, branches: ["Err"] },
      fetch: async () => jsonResponse(404, { error: "nope" }),
    });
    const result = await api.getJson("/x");
    Json.peek(result, { Err: () => {} });
    expect(result.tag).toBe("Err");
    expect(peekTrace(result)).toEqual([
      { kind: "peek", peeker: "anonymous", tag: "Err", hit: true },
    ]);
  });

  it("lets per-request diagnostics replace the constructor mask", async () => {
    const api = new ApiBase({
      diagnostics: { enabled: false },
      fetch: async () => jsonResponse(500, { error: "x" }),
    });
    const silent = await api.get("/x");
    FetchResult.peek(silent, { ServerError: () => {} });
    expect(peekTrace(silent)).toEqual([]);

    const recorded = await api.get("/x", {
      diagnostics: { enabled: true, branches: ["ServerError"] },
    });
    FetchResult.peek(recorded, { ServerError: () => {} });
    expect(peekTrace(recorded)).toEqual([
      { kind: "peek", peeker: "anonymous", tag: "ServerError", hit: true },
    ]);
  });

  it("records NetworkError from get", async () => {
    const api = new ApiBase({
      diagnostics: { enabled: true, branches: ["NetworkError"] },
      fetch: async () => {
        throw new TypeError("offline");
      },
    });
    const result = await api.get("/x");
    FetchResult.peek(result, { NetworkError: () => {} });
    expect(result.tag).toBe("NetworkError");
    expect(peekTrace(result)).toEqual([
      { kind: "peek", peeker: "anonymous", tag: "NetworkError", hit: true },
    ]);
  });

  it("does not fire the enableDiagnostics floor during get", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    enableDiagnostics(["ServerError"]);
    const api = new ApiBase({
      fetch: async () => jsonResponse(500, { error: "x" }),
    });
    const result = await api.get("/x");
    expect(result.tag).toBe("ServerError");
    expect(errorSpy).not.toHaveBeenCalled();
    expect(FetchResult.match(result, fetchResultArms)).toBe("server");
    expect(errorSpy).toHaveBeenCalled();
  });

  it("allows diagnostics on verb init at the type level", async () => {
    const api = new ApiBase({
      fetch: async () => jsonResponse(200, { id: "1", name: "ada" }),
    });
    const result = await api.get("/users/1", {
      diagnostics: { enabled: true, branches: ["ParseError"] },
    });
    expect(result.tag).toBe("Ok");
    expectTypeOf(result.tag).toEqualTypeOf<
      | "Ok"
      | "Created"
      | "NoContent"
      | "Conflict"
      | "ClientError"
      | "ServerError"
      | "Other"
      | "NetworkError"
      | "ParseError"
    >();
  });
});
