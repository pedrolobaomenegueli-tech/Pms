import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncAll } from "@/lib/sync/run";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorized(header: string | null): boolean {
  const m = /^Bearer\s+(.+)$/i.exec(header ?? "");
  if (!m) return false;
  // Compara hashes para tempo constante independente do tamanho
  const a = createHash("sha256").update(m[1].trim()).digest();
  const b = createHash("sha256").update(env.syncSecret).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorized(request.headers.get("authorization"))) {
    return Response.json({ error: "não autorizado" }, { status: 401 });
  }
  try {
    const summary = await syncAll(createAdminClient());
    return Response.json(summary);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
