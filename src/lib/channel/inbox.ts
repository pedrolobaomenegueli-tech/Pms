// Caixa de entrada do channel manager (HotelLink): guarda o que chegar,
// sem interpretar, para conhecermos o formato real antes de integrar.

import { createHash, timingSafeEqual } from "node:crypto";

/** Tamanho máximo guardado por mensagem (bytes). */
export const MAX_BODY_BYTES = 1_000_000;

/** Cabeçalhos que nunca são guardados (credenciais). */
const SECRET_HEADERS = /^(authorization|cookie|set-cookie|proxy-authorization|x-api-key|x-auth-token|x-.*(secret|token|key|signature).*)$/i;

function same(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Autoriza por "Authorization: Bearer <segredo>" ou por "?key=<segredo>"
 * (alguns channel managers só deixam configurar uma URL).
 * Sem segredo configurado, a caixa fica desligada.
 */
export function inboxAuthorized(secret: string | undefined, authHeader: string | null, queryKey: string | null): boolean {
  if (!secret || secret.length < 16) return false;
  const bearer = /^Bearer\s+(.+)$/i.exec(authHeader ?? "")?.[1]?.trim();
  return Boolean((bearer && same(bearer, secret)) || (queryKey && same(queryKey, secret)));
}

/** Copia os cabeçalhos sem credenciais. */
export function safeHeaders(headers: Iterable<[string, string]>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of headers) if (!SECRET_HEADERS.test(k)) out[k.toLowerCase()] = v;
  return out;
}

/** Remove o parâmetro "key" da query antes de guardar. */
export function safeQuery(search: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of search) if (k.toLowerCase() !== "key") out[k] = v;
  return out;
}

export function truncateBody(body: string): { body: string; truncated: boolean } {
  const bytes = new TextEncoder().encode(body);
  if (bytes.length <= MAX_BODY_BYTES) return { body, truncated: false };
  return { body: new TextDecoder().decode(bytes.slice(0, MAX_BODY_BYTES)), truncated: true };
}
