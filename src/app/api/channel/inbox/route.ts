import { createAdminClient } from "@/lib/supabase/admin";
import { inboxAuthorized, safeHeaders, safeQuery, truncateBody } from "@/lib/channel/inbox";

export const dynamic = "force-dynamic";

/**
 * Recebe e guarda, sem interpretar, o que o channel manager enviar.
 * Desligada se CHANNEL_INBOX_SECRET não estiver configurado.
 */
async function handle(request: Request) {
  const url = new URL(request.url);
  if (!inboxAuthorized(process.env.CHANNEL_INBOX_SECRET, request.headers.get("authorization"), url.searchParams.get("key"))) {
    return new Response("não autorizado", { status: 401 });
  }
  const { body, truncated } = truncateBody(request.method === "GET" ? "" : await request.text());
  const { error } = await createAdminClient()
    .from("channel_inbox")
    .insert({
      method: request.method,
      path: url.pathname,
      query: safeQuery(url.searchParams),
      headers: safeHeaders(request.headers.entries()),
      content_type: request.headers.get("content-type"),
      body,
      truncated,
    });
  if (error) return new Response("erro ao gravar", { status: 500 });
  return new Response("ok", { status: 200, headers: { "Content-Type": "text/plain" } });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
