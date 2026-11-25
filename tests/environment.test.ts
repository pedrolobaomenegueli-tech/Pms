import { describe, expect, it } from "vitest";
import { parseAppEnv } from "@/lib/app-env";
import { inboxAuthorized, safeHeaders, safeQuery, truncateBody, MAX_BODY_BYTES } from "@/lib/channel/inbox";

describe("ambiente", () => {
  it("produção é o padrão; só nomes de teste ligam o modo de testes", () => {
    expect(parseAppEnv(undefined)).toBe("production");
    expect(parseAppEnv("")).toBe("production");
    expect(parseAppEnv("production")).toBe("production");
    expect(parseAppEnv("staging")).toBe("staging");
    expect(parseAppEnv(" Testes ")).toBe("staging");
  });
});

describe("caixa de entrada do channel manager", () => {
  const secret = "0123456789abcdef0123";
  it("fica desligada sem segredo (ou com segredo curto)", () => {
    expect(inboxAuthorized(undefined, `Bearer ${secret}`, null)).toBe(false);
    expect(inboxAuthorized("curto", "Bearer curto", "curto")).toBe(false);
  });
  it("aceita Bearer ou ?key= e recusa valores errados", () => {
    expect(inboxAuthorized(secret, `Bearer ${secret}`, null)).toBe(true);
    expect(inboxAuthorized(secret, null, secret)).toBe(true);
    expect(inboxAuthorized(secret, "Bearer errado", "errado")).toBe(false);
    expect(inboxAuthorized(secret, null, null)).toBe(false);
  });
  it("não guarda credenciais de cabeçalho nem a chave da query", () => {
    const h = safeHeaders([
      ["Content-Type", "application/xml"],
      ["Authorization", "Bearer x"],
      ["Cookie", "a=b"],
      ["X-Api-Key", "k"],
      ["X-HotelLink-Signature", "s"],
      ["User-Agent", "HL"],
    ]);
    expect(h).toEqual({ "content-type": "application/xml", "user-agent": "HL" });
    expect(safeQuery(new URLSearchParams("key=segredo&hotelId=123"))).toEqual({ hotelId: "123" });
  });
  it("corta mensagens grandes demais", () => {
    expect(truncateBody("abc")).toEqual({ body: "abc", truncated: false });
    const big = truncateBody("x".repeat(MAX_BODY_BYTES + 10));
    expect(big.truncated).toBe(true);
    expect(big.body.length).toBe(MAX_BODY_BYTES);
  });
});
