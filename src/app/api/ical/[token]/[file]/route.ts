import { todaySP, addDays } from "@/lib/dates";
import { eventsForExport } from "@/lib/domain/rules";
import { buildIcal } from "@/lib/ical/export";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Reservation } from "@/lib/types";

export const dynamic = "force-dynamic";

const TARGETS = { "airbnb.ics": "airbnb", "booking.ics": "booking" } as const;

export async function GET(_req: Request, ctx: { params: Promise<{ token: string; file: string }> }) {
  const { token, file } = await ctx.params;
  const target = TARGETS[file as keyof typeof TARGETS];
  if (!target || !/^[a-f0-9]{16,128}$/.test(token)) return new Response("Não encontrado", { status: 404 });

  const db = createAdminClient();
  const { data: unit } = await db.from("units").select("id, name").eq("export_token", token).maybeSingle();
  if (!unit) return new Response("Não encontrado", { status: 404 });

  const today = todaySP();
  // Busca um pouco antes da janela para a detecção de eco enxergar tudo
  const { data, error } = await db
    .from("reservations")
    .select("id, unit_id, source, kind, check_in, check_out, status")
    .eq("unit_id", unit.id)
    .eq("status", "ativa")
    .gte("check_out", addDays(today, -31));
  if (error) return new Response("Erro ao gerar calendário", { status: 500 });

  const events = eventsForExport((data ?? []) as Reservation[], target, today);
  const body = buildIcal(events, { calendarName: `PMS ${unit.name}` });

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${file}"`,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
