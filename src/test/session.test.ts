import { beforeEach, describe, expect, it } from "vitest";
import { CODE_RE, clearSession, formatCode, getSession, setSession, userKey } from "@/lib/session";

describe("código erm", () => {
  it("formatea y valida", () => {
    expect(formatCode("ermD72cWvdD8345B6555")).toBe("erm-D72c-WvdD-8345B-6555");
    expect(CODE_RE.test("erm-D72c-WvdD-8345B-6555")).toBe(true);
    expect(CODE_RE.test("erm-D72c-WvdD-8345-6555")).toBe(false);
  });
});

describe("aislamiento entre usuarios", () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); clearSession(); });
  const exp = () => Date.now() + 60_000;
  it("cada usuario tiene su espacio y al cambiar se borra el anterior", () => {
    setSession({ token: "a", userId: "userA", plan: "", expires: exp() });
    localStorage.setItem(userKey("active-chat.v1"), "secretoA");
    setSession({ token: "b", userId: "userB", plan: "", expires: exp() });
    expect(localStorage.getItem(userKey("active-chat.v1"))).toBeNull();
    expect(localStorage.getItem("erasmus:userA:active-chat.v1")).toBeNull();
  });
  it("cerrar sesión borra todo lo del usuario", () => {
    setSession({ token: "a", userId: "userA", plan: "", expires: exp() });
    localStorage.setItem(userKey("custom.v1"), "x");
    clearSession();
    expect(getSession()).toBeNull();
    expect(localStorage.getItem("erasmus:userA:custom.v1")).toBeNull();
  });
  it("rechaza ids peligrosos", () => {
    expect(() => setSession({ token: "a", userId: "../x", plan: "", expires: exp() })).toThrow();
  });
});
