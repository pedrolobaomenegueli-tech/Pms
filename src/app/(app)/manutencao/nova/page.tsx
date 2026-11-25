import Link from "next/link";
import { loadProperties } from "@/lib/data";
import { requireUser } from "@/lib/supabase/server";
import { IssueForm } from "../IssueForm";

export const dynamic = "force-dynamic";

export default async function NewIssuePage({ searchParams }: { searchParams: Promise<{ quarto?: string; limpeza?: string }> }) {
  const { supabase } = await requireUser();
  const sp = await searchParams;
  const { properties, units } = await loadProperties(supabase);
  return (
    <div className="mx-auto max-w-xl">
      <Link href="/manutencao" className="text-sm text-slate-500 hover:underline">← Manutenção</Link>
      <h1 className="mb-3 mt-1 text-xl font-semibold">Registrar problema</h1>
      {sp.limpeza && <p className="mb-2 text-sm text-slate-600">Vinculado à limpeza em que foi encontrado.</p>}
      <div className="card">
        <IssueForm properties={properties} units={units} defaults={{ unit_id: sp.quarto, cleaning_id: sp.limpeza }} />
      </div>
    </div>
  );
}
