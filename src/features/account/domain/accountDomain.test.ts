import { describe, expect, it } from "vitest";
import { hostedApiReadinessItems, privacyReadinessItems, productionLaunchItems, productionOpsItems, qaSessionItems, responsiveQaItems, seedGarage, seedPosts, starterRoutes } from "../../../core/index";
import { buildConnectionStatusCopy, buildFeedbackLoopSummary, buildFeedbackTriageSummary, buildHostedApiReadinessSummary, buildLaunchReadinessSummary, buildPrivacyReadinessSummary, buildProductionLaunchSummary, buildProductionOpsSummary, buildQaHandoffMarkdown, buildQaSessionSummary, buildResponsiveQaSummary, buildReturnNudges, buildStarterRouteProgress, buildTesterRunSummary } from "../index";

describe("account domain", () => {
  it("builds return nudges from follows, saved notes, and service proximity", () => {
    const nudges = buildReturnNudges({
      followedModelSet: new Set(["tata-nexon"]),
      followedTopicSet: new Set(),
      garage: [{ ...seedGarage[0], odometerKm: 49500 }],
      posts: seedPosts,
      savedCount: 2,
    });

    expect(nudges).toEqual([
      "New fix surfaced for Tata Nexon.",
      "2 saved notes waiting in your garage shelf.",
      "Daily drive is close to the next 10k km service checkpoint.",
    ]);
  });

  it("tracks first-run starter route progress", () => {
    const progress = buildStarterRouteProgress({
      follows: { models: ["tata-nexon"], topics: [] },
      garage: [],
      profile: { city: "Pune", displayName: "Owner" },
      routes: starterRoutes,
      savedCount: 1,
      shortlistCount: 0,
    });

    expect(progress.filter((step) => step.complete).map((step) => step.id)).toEqual(["profile", "follow", "save"]);
    expect(progress.find((step) => step.id === "garage")?.complete).toBe(false);
  });

  it("explains what still works when the browser is offline", () => {
    expect(buildConnectionStatusCopy(false)).toMatchObject({
      label: "Offline",
      tone: "offline",
    });
    expect(buildConnectionStatusCopy(false).detail).toContain("garage notes");
    expect(buildConnectionStatusCopy(true)).toMatchObject({
      label: "Online",
      tone: "online",
    });
  });

  it("summarizes a saved QA session checklist", () => {
    const summary = buildQaSessionSummary(qaSessionItems, new Set(["feed", "offline"]));

    expect(summary).toMatchObject({
      checked: 2,
      total: qaSessionItems.length,
    });
    expect(summary.remaining.map((item) => item.id)).not.toContain("feed");
  });

  it("summarizes responsive QA checks across breakpoints", () => {
    const summary = buildResponsiveQaSummary(responsiveQaItems, new Set(["phone-nav-feed", "desktop-data-tools"]));

    expect(summary).toMatchObject({
      checked: 2,
      total: responsiveQaItems.length,
    });
    expect(summary.remaining.map((item) => item.id)).not.toContain("phone-nav-feed");
  });

  it("summarizes production launch checks", () => {
    const summary = buildProductionLaunchSummary(productionLaunchItems, new Set(["production-url", "security-headers"]));

    expect(summary).toMatchObject({
      checked: 2,
      total: productionLaunchItems.length,
    });
    expect(summary.remaining.map((item) => item.id)).not.toContain("production-url");
  });

  it("summarizes production operations checks", () => {
    const summary = buildProductionOpsSummary(productionOpsItems, new Set(["backup-restore-drill", "https-only"]));

    expect(summary).toMatchObject({
      checked: 2,
      total: productionOpsItems.length,
    });
    expect(summary.remaining.map((item) => item.id)).not.toContain("https-only");
  });

  it("summarizes real-user test runs", () => {
    const summary = buildTesterRunSummary([
      {
        createdAt: "2026-07-22T10:00:00.000Z",
        friction: "Could not find the garage export.",
        id: "run-one",
        nextLoopStage: "Designer",
        outcome: "Confusing",
        scenario: "Owner exports garage on phone.",
        testerName: "Riya",
      },
      {
        createdAt: "2026-07-22T11:00:00.000Z",
        friction: "Feed helped them save a fix.",
        id: "run-two",
        nextLoopStage: "Real user",
        outcome: "Useful",
        scenario: "Buyer checks a known issue.",
        testerName: "Amit",
      },
    ]);

    expect(summary).toMatchObject({
      blocked: 0,
      confusing: 1,
      total: 2,
      useful: 1,
    });
    expect(summary.openFriction[0]?.nextLoopStage).toBe("Designer");
  });

  it("summarizes hosted API readiness without crossing service-center ownership", () => {
    const summary = buildHostedApiReadinessSummary(hostedApiReadinessItems);

    expect(summary).toMatchObject({
      beta: 3,
      later: 3,
      launchBlockers: 0,
      serviceCenterBoundaries: 1,
    });
  });

  it("summarizes privacy readiness for stored, excluded, and deletion-baseline data", () => {
    expect(buildPrivacyReadinessSummary(privacyReadinessItems)).toEqual({
      "Deletion baseline": 1,
      "Not collected": 2,
      "Stored for MVP": 2,
    });
  });

  it("builds a QA handoff report for the product loop", () => {
    const report = buildQaHandoffMarkdown({
      feedbackLoopSummary: {
        "Backend engineer": 0,
        Designer: 1,
        "Frontend engineer": 0,
        "Product owner": 2,
        "Real user": 1,
        "Tested / QA": 0,
      },
      feedbackSummary: {
        New: 2,
        Planned: 1,
        Reviewing: 0,
        Shipped: 1,
      },
      generatedAt: "2026-07-22T12:00:00.000Z",
      hostedApiSummary: buildHostedApiReadinessSummary(hostedApiReadinessItems),
      launchSummary: {
        blocked: [
          {
            area: "Deploy",
            detail: "Needs production URL.",
            label: "Production Vercel URL",
            ready: false,
          },
        ],
        ready: 7,
        total: 8,
      },
      profile: {
        city: "Pune",
        displayName: "QA Owner",
        garageRole: "Owner",
      },
      privacySummary: buildPrivacyReadinessSummary(privacyReadinessItems),
      productionLaunchSummary: buildProductionLaunchSummary(productionLaunchItems, new Set(["production-url"])),
      productionOpsSummary: buildProductionOpsSummary(productionOpsItems, new Set(["https-only"])),
      productionUrl: "https://autoflex-zeta.vercel.app",
      qaSummary: buildQaSessionSummary(qaSessionItems, new Set(["feed"])),
      responsiveQaSummary: buildResponsiveQaSummary(responsiveQaItems, new Set(["phone-nav-feed"])),
      testerRunSummary: buildTesterRunSummary([
        {
          createdAt: "2026-07-22T10:00:00.000Z",
          friction: "The install prompt was hard to find.",
          id: "run-one",
          nextLoopStage: "Designer",
          outcome: "Confusing",
          scenario: "Fresh tester tries to install the app.",
          testerName: "QA Owner",
        },
      ]),
    });

    expect(report).toContain("# Autoflex QA handoff");
    expect(report).toContain("Name: QA Owner");
    expect(report).toContain("City: Pune");
    expect(report).toContain("Role: Owner");
    expect(report).toContain("Checked: 1/");
    expect(report).toContain("## Responsive QA");
    expect(report).toContain("Tablet / Knowledge cards");
    expect(report).toContain("Production URL: https://autoflex-zeta.vercel.app");
    expect(report).toContain("Production launch checks:");
    expect(report).toContain("Deep-link refresh works");
    expect(report).toContain("Production operations:");
    expect(report).toContain("Non-default admin token set");
    expect(report).toContain("Production Vercel URL: Needs production URL.");
    expect(report).toContain("Total tester notes: 4");
    expect(report).toContain("Product owner: 2");
    expect(report).toContain("Designer: 1");
    expect(report).toContain("## Real-user test runs");
    expect(report).toContain("Confusing / Designer");
    expect(report).toContain("## Hosted API readiness");
    expect(report).toContain("Service-center boundaries: 1");
    expect(report).toContain("## Privacy readiness");
    expect(report).toContain("Not collected: 2");
    expect(report).toContain("Service-center integration remains outside this MVP loop");
  });

  it("summarizes feedback by product loop stage", () => {
    const summary = buildFeedbackLoopSummary([
      {
        createdAt: "2026-07-22T10:00:00.000Z",
        id: "feedback-product",
        loopStage: "Product owner",
        message: "Make buyer onboarding clearer.",
        status: "New",
      },
      {
        createdAt: "2026-07-22T11:00:00.000Z",
        id: "feedback-qa",
        loopStage: "Tested / QA",
        message: "Run mobile smoke check on shortlist.",
        status: "Reviewing",
      },
    ]);

    expect(summary["Product owner"]).toBe(1);
    expect(summary["Tested / QA"]).toBe(1);
    expect(summary["Real user"]).toBe(0);
  });

  it("summarizes feedback through the product loop triage states", () => {
    const summary = buildFeedbackTriageSummary([
      {
        createdAt: "2026-07-21T10:00:00.000Z",
        id: "feedback-one",
        loopStage: "Product owner",
        message: "Show ownership cost earlier.",
        status: "New",
      },
      {
        createdAt: "2026-07-21T11:00:00.000Z",
        id: "feedback-two",
        loopStage: "Tested / QA",
        message: "Garage reminders are useful.",
        status: "Shipped",
      },
      {
        createdAt: "2026-07-21T12:00:00.000Z",
        id: "feedback-three",
        loopStage: "Backend engineer",
        message: "City follows should sync.",
        status: "Planned",
      },
    ]);

    expect(summary).toEqual({
      New: 1,
      Planned: 1,
      Reviewing: 0,
      Shipped: 1,
    });
  });

  it("summarizes launch readiness and keeps blockers visible", () => {
    const summary = buildLaunchReadinessSummary([
      {
        area: "Deploy",
        detail: "Build can be deployed.",
        label: "Deploy path",
        ready: true,
      },
      {
        area: "Install",
        detail: "Manifest is available.",
        label: "Install shell",
        ready: true,
      },
      {
        area: "Trust",
        detail: "Needs final admin token.",
        label: "Admin hardening",
        ready: false,
      },
    ]);

    expect(summary).toMatchObject({
      ready: 2,
      total: 3,
    });
    expect(summary.blocked[0]?.label).toBe("Admin hardening");
  });
});
