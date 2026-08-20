import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL?.trim() || "https://uxzdmlqyxausmmdpmkrr.supabase.co";
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || "sb_publishable_u0w6I8umxlBbcwT2-zGaJA_rDY0SVju";

export const isCloudSyncConfigured = Boolean(supabaseUrl && supabasePublishableKey);

let client: SupabaseClient<Database> | null = null;

export const getSupabaseClient = (): SupabaseClient<Database> | null => {
  if (!isCloudSyncConfigured) return null;
  if (!client) {
    client = createClient<Database>(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        persistSession: true,
      },
    });
  }
  return client;
};
