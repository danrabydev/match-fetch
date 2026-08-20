import { describe, expect, expectTypeOf, it } from "vitest";
import { Json, jsonOf } from "../src/index.js";

type User = { id: string; name: string };

describe("jsonOf", () => {
  it("returns Ok with parsed JSON", async () => {
    const response = new Response(JSON.stringify({ id: "1", name: "ada" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    const result = await jsonOf<User>(response);
    expect(result.tag).toBe("Ok");
    if (result.tag === "Ok") {
      expect(result.data).toEqual({ id: "1", name: "ada" });
      expectTypeOf(result.data).toEqualTypeOf<User>();
    }
  });

  it("returns Err for invalid JSON", async () => {
    const response = new Response("not json", { status: 200 });
    const result = await jsonOf(response);
    expect(result.tag).toBe("Err");
  });

  it("specializes Json<User>", () => {
    const ok = Json.Ok({ id: "1", name: "ada" });
    expectTypeOf(ok).toEqualTypeOf<{ tag: "Ok"; data: User }>();
  });
});
