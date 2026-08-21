import { describe, expect, expectTypeOf, it } from "vitest";
import { createStatusMatchable, Http } from "../src/index.js";

function res(status: number): Response {
  return new Response(null, { status });
}

describe("Http.of", () => {
  it("maps named codes", () => {
    expect(Http.of(res(200)).tag).toBe("Ok");
    expect(Http.of(res(201)).tag).toBe("Created");
    expect(Http.of(res(204)).tag).toBe("NoContent");
    expect(Http.of(res(409)).tag).toBe("Conflict");
  });

  it("maps leftover 4xx to ClientError and 5xx to ServerError", () => {
    expect(Http.of(res(404)).tag).toBe("ClientError");
    expect(Http.of(res(400)).tag).toBe("ClientError");
    expect(Http.of(res(500)).tag).toBe("ServerError");
    expect(Http.of(res(503)).tag).toBe("ServerError");
  });

  it("maps 202 and 301 to Other", () => {
    expect(Http.of(res(202)).tag).toBe("Other");
    expect(Http.of(res(301)).tag).toBe("Other");
  });

  it("does not put 409 in ClientError", () => {
    const value = Http.of(res(409));
    expect(value.tag).toBe("Conflict");
    expect(value.status).toBe(409);
  });

  it("wraps Response so json remains callable", () => {
    const response = res(200);
    const value = Http.of(response);
    expect(value.response).toBe(response);
    expect(typeof value.response.json).toBe("function");
  });
});

describe("createStatusMatchable", () => {
  it("pulls extra named codes out of the 4xx range", () => {
    const ApiHttp = createStatusMatchable({
      Ok: 200,
      NotFound: 404,
      Conflict: 409,
    });
    expect(ApiHttp.of(res(404)).tag).toBe("NotFound");
    expect(ApiHttp.of(res(400)).tag).toBe("ClientError");
  });

  it("throws on duplicate status codes", () => {
    expect(() =>
      createStatusMatchable({
        Ok: 200,
        AlsoOk: 200,
      }),
    ).toThrowError("duplicate status code: 200");
  });

  it("throws on reserved range names at runtime", () => {
    expect(() =>
      createStatusMatchable({
        Ok: 200,
        ClientError: 400,
      } as never),
    ).toThrowError("reserved status variant name: ClientError");
  });

  it("rejects reserved range names at the type level", () => {
    expect(() =>
      // @ts-expect-error ClientError is a reserved range variant
      createStatusMatchable({ ClientError: 400 }),
    ).toThrowError("reserved status variant name: ClientError");
  });

  it("throws on reserved of at runtime", () => {
    expect(() =>
      createStatusMatchable({
        of: 200,
      } as never),
    ).toThrowError("reserved status variant name: of");
  });

  it("rejects of at the type level", () => {
    expect(() =>
      // @ts-expect-error of is the status mapper
      createStatusMatchable({ of: 200 }),
    ).toThrowError("reserved status variant name: of");
  });

  it("throws on reserved matchable names", () => {
    expect(() =>
      createStatusMatchable({
        match: 200,
      } as never),
    ).toThrowError("reserved variant name: match");
  });

  it("throws on reserved merge at runtime", () => {
    expect(() =>
      createStatusMatchable({
        merge: 200,
      } as never),
    ).toThrowError("reserved status variant name: merge");
  });

  it("rejects merge at the type level", () => {
    expect(() =>
      // @ts-expect-error merge is reserved by createMatchable
      createStatusMatchable({ merge: 200 }),
    ).toThrowError("reserved status variant name: merge");
  });

  it("throws on reserved peek at runtime", () => {
    expect(() =>
      createStatusMatchable({
        peek: 200,
      } as never),
    ).toThrowError("reserved status variant name: peek");
  });

  it("rejects peek at the type level", () => {
    expect(() =>
      // @ts-expect-error peek is reserved by createMatchable
      createStatusMatchable({ peek: 200 }),
    ).toThrowError("reserved status variant name: peek");
  });

  it("throws on reserved withDiagnostics at runtime", () => {
    expect(() =>
      createStatusMatchable({
        withDiagnostics: 500,
      } as never),
    ).toThrowError("reserved status variant name: withDiagnostics");
  });

  it("rejects withDiagnostics at the type level", () => {
    expect(() =>
      // @ts-expect-error withDiagnostics is reserved by createMatchable
      createStatusMatchable({ withDiagnostics: 500 }),
    ).toThrowError("reserved status variant name: withDiagnostics");
  });

  it("requires every arm for a widened of() value", () => {
    const value = Http.of(res(200));
    const tag = Http.match(value, {
      Ok: () => "ok",
      Created: () => "created",
      NoContent: () => "empty",
      Conflict: () => "conflict",
      ClientError: () => "client",
      ServerError: () => "server",
      Other: () => "other",
    });
    expect(tag).toBe("ok");
    expectTypeOf(tag).toEqualTypeOf<string>();

    const check = (status: typeof value) => {
      // @ts-expect-error Other arm is required
      Http.match(status, {
        Ok: () => "ok",
        Created: () => "created",
        NoContent: () => "empty",
        Conflict: () => "conflict",
        ClientError: () => "client",
        ServerError: () => "server",
      });
    };
    check(value);
  });
});
