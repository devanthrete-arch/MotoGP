import type { Session } from "@supabase/supabase-js";
import type { Json } from "./database.types";
import { getSupabaseClient } from "./supabase";
import type { AutoflexBackup } from "./storage";

export type CloudBackup = {
  payload: Json;
  updatedAt: string;
};

const requireClient = () => {
  const client = getSupabaseClient();
  if (!client) throw new Error("Cloud sync is not configured for this build.");
  return client;
};

export const getCloudSession = async (): Promise<Session | null> => {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
};

export const sendCloudSignInLink = async (email: string): Promise<void> => {
  const client = requireClient();
  const redirectTo = `${window.location.origin}${window.location.pathname}#settings`;
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) throw error;
};

export const loadCloudBackup = async (userId: string): Promise<CloudBackup | null> => {
  const client = requireClient();
  const { data, error } = await client
    .from("autoflex_user_backups")
    .select("payload, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? { payload: data.payload, updatedAt: data.updated_at } : null;
};

export const saveCloudBackup = async (userId: string, backup: AutoflexBackup): Promise<string> => {
  const client = requireClient();
  const session = await getCloudSession();
  if (session?.user.id !== userId) throw new Error("The active account changed before sync completed.");
  const { data, error } = await client.rpc("sync_autoflex_workspace", {
    payload: backup as unknown as Json,
  });
  if (error) throw error;
  return data;
};

export const signOutCloud = async (): Promise<void> => {
  const client = requireClient();
  const { error } = await client.auth.signOut();
  if (error) throw error;
};
