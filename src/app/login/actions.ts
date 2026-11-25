"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { str, type ActionState } from "@/lib/ui";

export async function login(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: str(fd, "email"),
    password: String(fd.get("password") ?? ""),
  });
  if (error) return { error: "E-mail ou senha inválidos." };
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
