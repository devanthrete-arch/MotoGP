import { describe, expect, it } from "vitest";
import { productionLaunchItems, qaSessionItems, responsiveQaItems, seedGarage, seedPosts, seedTimeline, starterRoutes } from "./domain";
import {
  assessPostQuality,
  buildFeedbackTriageSummary,
  buildFeedbackLoopSummary,
  buildConnectionStatusCopy,
  buildGarageCostLedger,
  buildGarageInsights,
  buildGarageExportMarkdown,
  buildGarageReminders,
  buildInspectionChecklists,
  buildCityCircles,
  buildLaunchReadinessSummary,
  buildModelSharePayload,
  buildModerationSummary,
  buildNotificationPreview,
  buildOwnershipPlaybooks,
  buildPostSharePayload,
  buildProductionLaunchSummary,
  buildQaHandoffMarkdown,
  buildQaSessionSummary,
  buildResponsiveQaSummary,
  buildReturnNudges,
  buildShortlistComparisons,
  buildStarterRouteProgress,
  buildTesterRunSummary,
  filterPostsByMode,
  groupByModel,
  modelKeyFor,
} from "./insights";

describe("Autoflex insights", () => {
  it("normalizes model keys for follow matching", () => {
    expect(modelKeyFor("Maruti Suzuki", "Grand Vitara")).toBe("maruti-suzuki-grand-vitara");
  });

  it("groups posts into model notebooks by brand and model", () => {
    const notebooks = groupByModel(seedPosts);

    expect(notebooks.map((notebook) => notebook.key)).toContain("tata-nexon");
    expect(notebooks.find((notebook) => notebook.key === "tata-nexon")?.posts).toHaveLength(1);
  });

  it("filters following feed by followed model or topic", () => {
    const posts = filterPostsByMode(seedPosts, {
      followedModelSet: new Set(["honda-city"]),
      followedTopicSet: new Set(["Fix"]),
      mode: "following",
      query: "",
      saved: new Set(),
      selectedLabel: "All",
    });

    expect(posts.map((post) => post.id)).toEqual(["nexon-diesel-clutch", "city-hybrid-highway"]);
  });

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
      "Daily diesel is close to the next 10k km service checkpoint.",
    ]);
  });

  it("tracks first-run starter route progress", () => {
    const progress = buildStarterRouteProgress({
      feedbackCount: 0,
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
      productionLaunchSummary: buildProductionLaunchSummary(productionLaunchItems, new Set(["production-url"])),
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
    expect(report).toContain("Production Vercel URL: Needs production URL.");
    expect(report).toContain("Total tester notes: 4");
    expect(report).toContain("Product owner: 2");
    expect(report).toContain("Designer: 1");
    expect(report).toContain("## Real-user test runs");
    expect(report).toContain("Confusing / Designer");
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

  it("creates notification previews without requiring a backend", () => {
    const previews = buildNotificationPreview({
      follows: { models: ["tata-nexon"], topics: [] },
      posts: seedPosts,
      preference: { browserAlerts: true, emailDigest: true, quietHours: true },
    });

    expect(previews[0]).toBe("Browser alert: Tata Nexon has a new fix.");
  });

  it("summarizes garage service, spend, and community context", () => {
    const insights = buildGarageInsights(seedGarage, seedTimeline, seedPosts);

    expect(insights).toHaveLength(3);
    expect(insights[0].detail).toContain("km to the next 10k service marker");
    expect(insights[1].detail).toContain("₹9,550");
    expect(insights[2].detail).toContain("1 related ownership note");
  });

  it("builds garage cost ledger from vehicle timeline", () => {
    const ledger = buildGarageCostLedger(seedGarage, seedTimeline);

    expect(ledger[0]).toMatchObject({
      entryCount: 2,
      highestLoggedOdometerKm: 42000,
      totalSpend: 9550,
    });
    expect(ledger[0].costPerKm).toBeCloseTo(0.227);
    expect(ledger[0].latestEntry?.id).toBe("timeline-nexon-service");
  });

  it("builds garage reminders from mileage and timeline gaps", () => {
    const reminders = buildGarageReminders(
      [{ ...seedGarage[0], odometerKm: 49550 }],
      [
        ...seedTimeline,
        {
          amount: 0,
          happenedOn: "2025-07-01",
          id: "timeline-nexon-tyres",
          kind: "Tyres",
          note: "Tyres changed before monsoon.",
          odometerKm: 12000,
          title: "Tyre set replaced",
          vehicleId: "garage-nexon",
        },
      ],
      new Date("2026-07-20T00:00:00.000Z"),
    );

    expect(reminders.map((reminder) => reminder.title)).toEqual([
      "Plan the next service visit",
      "Log insurance renewal details",
      "Inspect tyre age and wear",
    ]);
    expect(reminders[0]).toMatchObject({
      urgency: "Soon",
      vehicleName: "Daily diesel",
    });
  });

  it("summarizes moderation queue and flags repeatedly reported posts", () => {
    const summary = buildModerationSummary([
      {
        createdAt: "2026-07-20T10:00:00.000Z",
        id: "report-1",
        postId: "post-a",
        postTitle: "Post A",
        reason: "Spam lead",
        reporterName: "Owner",
        status: "Open",
      },
      {
        createdAt: "2026-07-20T11:00:00.000Z",
        id: "report-2",
        postId: "post-a",
        postTitle: "Post A",
        reason: "Duplicate spam",
        reporterName: "Buyer",
        status: "Open",
      },
      {
        createdAt: "2026-07-20T12:00:00.000Z",
        id: "report-3",
        postId: "post-b",
        postTitle: "Post B",
        reason: "Resolved",
        reporterName: "Mod",
        status: "Dismissed",
      },
    ]);

    expect(summary).toEqual({
      dismissedReports: 1,
      openReports: 2,
      removedReports: 0,
      riskyPostIds: ["post-a"],
    });
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

  it("builds share text for posts and model notebooks", () => {
    const postShare = buildPostSharePayload(seedPosts[0]);
    const notebookShare = buildModelSharePayload(groupByModel(seedPosts)[0]);

    expect(postShare.title).toContain("Tata Nexon");
    expect(postShare.text).toContain("42,000 km");
    expect(notebookShare.text).toContain("owner note");
  });

  it("exports garage timeline as markdown", () => {
    const exportText = buildGarageExportMarkdown(seedGarage, seedTimeline);

    expect(exportText).toContain("# Autoflex garage export");
    expect(exportText).toContain("Daily diesel");
    expect(exportText).toContain("₹1,350");
  });

  it("compares buyer shortlist models against available ownership notes", () => {
    const comparisons = buildShortlistComparisons(
      [
        {
          brand: "Tata",
          budget: 1200000,
          id: "shortlist-nexon",
          model: "Nexon",
          notes: "Family compact SUV option",
          status: "Researching",
        },
        {
          brand: "Toyota",
          budget: 2200000,
          id: "shortlist-hyryder",
          model: "Hyryder",
          notes: "Needs owner data",
          status: "Test drive",
        },
      ],
      seedPosts,
    );

    expect(comparisons[0]).toMatchObject({
      confidence: "Medium",
      fixes: 1,
      relatedNotes: 1,
    });
    expect(comparisons[1]).toMatchObject({
      confidence: "Low",
      relatedNotes: 0,
    });
  });

  it("builds city circles from posts and garage vehicles", () => {
    const circles = buildCityCircles(seedPosts, seedGarage);
    const pune = circles.find((circle) => circle.city === "Pune");

    expect(pune).toMatchObject({
      city: "Pune",
      localSignal: "Active",
      topBrands: ["Tata"],
    });
    expect(pune?.hotTopics).toEqual(["Fix"]);
  });

  it("turns model notebooks into ownership playbooks", () => {
    const playbooks = buildOwnershipPlaybooks(seedPosts);
    const nexon = playbooks.find((playbook) => playbook.key === "tata-nexon");

    expect(nexon).toMatchObject({
      brand: "Tata",
      confidence: "Early signal",
      evidenceCount: 1,
      model: "Nexon",
    });
    expect(nexon?.ownerSignals).toContain("Confirmed fixes are available before the owner needs a dealer second opinion.");
    expect(nexon?.buyerChecks[0]).toBe("Ask whether the common fix has already been done and keep the bill handy.");
  });

  it("assesses post quality with actionable missing context prompts", () => {
    const strongReport = assessPostQuality(seedPosts[0]);
    const thinReport = assessPostQuality({
      body: "Good car.",
      city: "",
      label: "Owner note",
      odometerKm: 0,
      variant: "",
    });

    expect(strongReport).toMatchObject({
      grade: "Garage-grade",
      maxScore: 6,
      score: 6,
    });
    expect(thinReport).toMatchObject({
      grade: "Needs context",
      score: 0,
    });
    expect(thinReport.missingPrompts).toContain("Add odometer reading to anchor the issue, review, or cost note.");
  });

  it("builds buyer inspection checklists from shortlist evidence", () => {
    const checklists = buildInspectionChecklists(
      [
        {
          brand: "Tata",
          budget: 1200000,
          id: "shortlist-nexon",
          model: "Nexon",
          notes: "Family compact SUV option",
          status: "Researching",
        },
        {
          brand: "Toyota",
          budget: 2200000,
          id: "shortlist-hyryder",
          model: "Hyryder",
          notes: "Needs owner data",
          status: "Test drive",
        },
      ],
      seedPosts,
    );

    expect(checklists[0].checklist[0]).toMatchObject({
      priority: "High",
      title: "Verify common fix history",
    });
    expect(checklists[0].checklist.map((item) => item.title)).toContain("Match odometer-stage expectations");
    expect(checklists[1].checklist).toEqual([
      {
        detail: "Carry a short test-drive route, inspect tyres, service records, insurance claims, and cold-start behavior.",
        id: "shortlist-hyryder-baseline",
        priority: "High",
        title: "Start with a baseline inspection checklist",
      },
    ]);
  });
});
