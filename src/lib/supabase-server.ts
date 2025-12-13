// src/lib/supabase-server.ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// ⚠️ Server only: ne JAMAIS exposer cette clé au navigateur
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseServer = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});