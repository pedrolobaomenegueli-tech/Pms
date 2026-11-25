import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "../env";

/** Cliente com service role: ignora RLS. Use SOMENTE no servidor. */
export function createAdminClient() {
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
