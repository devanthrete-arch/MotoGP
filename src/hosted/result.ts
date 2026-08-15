import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { getSupabaseClient } from "../supabase";

export type HostedClient = SupabaseClient<Database>;

/**
 * Why a hosted call could not be served from the network.
 * None of these are errors the UI should treat as fatal: each one means
 * "keep using the local copy".
 */
export type HostedFailureReason =
  | "unconfigured" // no Supabase URL/key in this build
  | "signed-out" // no user id to scope rows to
  | "offline" // the browser reports no connection
  | "request-failed" // PostgREST/network returned an error
  | "unexpected"; // mapper or client threw something unrecognised

export type HostedSuccess<Data> = {
  ok: true;
  source: "hosted";
  data: Data;
};

export type HostedFailure<Data> = {
  ok: false;
  source: "local";
  data: Data;
  reason: HostedFailureReason;
  message: string;
};

/**
 * Discriminated result carrying usable `data` on BOTH arms.
 * On failure `data` is the local fallback the caller passed in, so callers can
 * always do `const posts = result.data` without branching.
 */
export type HostedResult<Data> = HostedSuccess<Data> | HostedFailure<Data>;

export const hostedOk = <Data>(data: Data): HostedSuccess<Data> => ({ data, ok: true, source: "hosted" });

export const hostedFallback = <Data>(
  data: Data,
  reason: HostedFailureReason,
  message: string,
): HostedFailure<Data> => ({ data, message, ok: false, reason, source: "local" });

/** Convenience for call sites that only care about the value. */
export const dataOf = <Data>(result: HostedResult<Data>): Data => result.data;

export const describeError = (error: unknown): string => {
  if (error === null || error === undefined) return "The hosted request failed.";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || "The hosted request failed.";
  if (typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return "The hosted request failed.";
};

export const isBrowserOffline = (): boolean => {
  try {
    if (typeof navigator === "undefined" || navigator === null) return false;
    if (!("onLine" in navigator)) return false;
    return navigator.onLine === false;
  } catch {
    return false;
  }
};

type ClientGuard = { ok: true; client: HostedClient } | { ok: false; reason: HostedFailureReason; message: string };

const resolveClient = (): ClientGuard => {
  let client: HostedClient | null = null;
  try {
    client = getSupabaseClient();
  } catch (error) {
    return { message: describeError(error), ok: false, reason: "unconfigured" };
  }
  if (!client) {
    return { message: "Hosted sync is not configured for this build.", ok: false, reason: "unconfigured" };
  }
  if (isBrowserOffline()) {
    return { message: "The browser is offline, so local data is being used.", ok: false, reason: "offline" };
  }
  return { client, ok: true };
};

/**
 * Runs a hosted read/write, degrading to `fallback` whenever the client is
 * missing, the browser is offline, or the request throws. Never rejects.
 */
export const runHosted = async <Data>(
  fallback: Data,
  run: (client: HostedClient) => Promise<Data>,
): Promise<HostedResult<Data>> => {
  const guard = resolveClient();
  if (!guard.ok) return hostedFallback(fallback, guard.reason, guard.message);
  try {
    return hostedOk(await run(guard.client));
  } catch (error) {
    return hostedFallback(fallback, "request-failed", describeError(error));
  }
};

/** Same as {@link runHosted}, but also short-circuits when no user is signed in. */
export const runHostedForUser = async <Data>(
  userId: string | null | undefined,
  fallback: Data,
  run: (client: HostedClient, userId: string) => Promise<Data>,
): Promise<HostedResult<Data>> => {
  if (typeof userId !== "string" || !userId.trim()) {
    return hostedFallback(fallback, "signed-out", "Sign in to sync this data across devices.");
  }
  return runHosted(fallback, (client) => run(client, userId));
};

type PostgrestLike<Data> = { data: Data | null; error: { message?: string } | null };

/** Turns PostgREST's `{ data, error }` into a value or a throw that `runHosted` catches. */
export const unwrap = <Data>(response: PostgrestLike<Data>, fallback: Data): Data => {
  if (response.error) throw new Error(describeError(response.error));
  return response.data ?? fallback;
};

export const unwrapWrite = (response: { error: { message?: string } | null }): void => {
  if (response.error) throw new Error(describeError(response.error));
};
