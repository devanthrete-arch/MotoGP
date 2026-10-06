import { afterEach, describe, expect, it, vi } from "vitest";
import { createClerkSupabaseClient, readCloudConfig } from "./supabase";

const config = { url: "https://uxzdmlqyxausmmdpmkrr.supabase.co", publishableKey: "sb_publishable_test_fixture" };
const env = { VITE_SUPABASE_URL: config.url, VITE_SUPABASE_PUBLISHABLE_KEY: config.publishableKey };

afterEach(() => vi.unstubAllGlobals());

describe("Supabase browser configuration", () => {
  it("keeps unconfigured builds offline and rejects partial configuration", () => {
    expect(readCloudConfig({})).toBeNull();
    expect(() => readCloudConfig({ VITE_SUPABASE_URL: config.url })).toThrow("both");
    expect(readCloudConfig(env)).toEqual(config);
  });

  it("rejects privileged keys and credential-bearing project URLs", () => {
    for (const key of ["sb_secret_example", `header.${btoa(JSON.stringify({ role: "service_role" }))}.signature`, "invalid"]) {
      expect(() => readCloudConfig({ ...env, VITE_SUPABASE_PUBLISHABLE_KEY: key })).toThrow("publishable key");
    }
    expect(() => readCloudConfig({ ...env, VITE_SUPABASE_URL: "https://user:password@example.com" })).toThrow("origin");
    expect(() => readCloudConfig({ ...env, VITE_SUPABASE_URL: "http://example.com" })).toThrow("HTTPS");
  });

  it("supports the legacy public anon key without treating it as a user token", () => {
    const key = `header.${btoa(JSON.stringify({ role: "anon" }))}.signature`;
    expect(readCloudConfig({ ...env, VITE_SUPABASE_PUBLISHABLE_KEY: key })?.publishableKey).toBe(key);
  });
});

describe("Clerk database requests", () => {
  it("uses the current Clerk token on every request, not a cached account token", async () => {
    const headers: Headers[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init: RequestInit) => {
      headers.push(new Headers(init.headers));
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    }));
    let token = "clerk-session-one";
    const client = createClerkSupabaseClient(config, async () => token);
    expect((await client.from("test_fixture").select().retry(false)).error).toBeNull();
    token = "clerk-session-two";
    expect((await client.from("test_fixture").select().retry(false)).error).toBeNull();
    expect(headers.map(value => value.get("authorization"))).toEqual(["Bearer clerk-session-one", "Bearer clerk-session-two"]);
    expect(headers.every(value => value.get("apikey") === config.publishableKey)).toBe(true);
  });

  it("does not fall back to an anonymous database request after sign-out", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const client = createClerkSupabaseClient(config, async () => null);
    const result = await client.from("test_fixture").select().retry(false);
    expect(result.error?.message).toContain("Sign in");
    expect(fetch).not.toHaveBeenCalled();
  });
});
