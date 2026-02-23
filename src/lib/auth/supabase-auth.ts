import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type SupabaseAuthConfig = {
  url: string;
  anonKey: string;
};

export function getSupabaseAuthConfig(): SupabaseAuthConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

export function createSupabaseAuthClient() {
  const config = getSupabaseAuthConfig();

  if (!config) {
    return null;
  }

  return createClient<Database>(config.url, config.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function createSupabaseBrowserRecoveryClient() {
  const config = getSupabaseAuthConfig();

  if (!config || typeof window === "undefined") {
    return null;
  }

  return createClient<Database>(config.url, config.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: true,
    },
  });
}
