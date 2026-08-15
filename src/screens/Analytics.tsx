import { Bell, Download, MessageSquare, ShieldAlert, Users, Wrench, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "../appState";
import { Badge, Card, DataText, GhostButton, LabelCaps } from "../components/ui";

const ranges = ["24H", "7D", "30D", "YTD"] as const;

/** Deterministic pseudo-series so sparklines are stable per metric (no chart lib). */
function seriesFor(seed: number, points = 12): number[] {
  const values: number[] = [];
  let state = seed * 2654435761 + 1;
  for (let i = 0; i < points; i += 1) {
    state = (state * 1103515245 + 12345) % 2147483648;
    values.push(30 + (state % 70));
  }
  return values;
}

function Sparkline({ seed }: { seed: number }) {
  const values = seriesFor(seed);
  const step = 96 / (values.length - 1);
  const path = values.map((value, index) => `${index === 0 ? "M" : "L"}${(index * step).toFixed(1)} ${(24 - (value / 100) * 22).toFixed(1)}`).join(" ");
  return (
    <svg aria-hidden="true" className="w-full h-6 text-primary/40" fill="none" preserveAspectRatio="none" viewBox="0 0 96 24">
      <path d={path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function BarSpark({ seed }: { seed: number }) {
  const values = seriesFor(seed, 8);
  return (
    <div aria-hidden="true" className="flex items-end gap-1 h-12">
      {values.map((value, index) => (
        <div
          className={"w-1.5 rounded-sm " + (index === values.length - 1 ? "bg-primary shadow-[0_0_8px_rgba(199,198,203,0.6)]" : "bg-surface-container-highest")}
          key={index}
          style={{ height: `${Math.max(14, value)}%` }}
        />
      ))}
    </div>
  );
}

/**
 * Analytics dashboard (template: analytics_dashboard_autoflex).
 * Funnel + telemetry fed entirely by the live stats memo from app state.
 */
export function Analytics() {
  const app = useApp();
  const { stats, timeline, saved } = app;
  const [range, setRange] = useState<(typeof ranges)[number]>("7D");

  const engagementRate = stats.posts ? Math.min(100, Math.round(((stats.confirmations + saved.size) / Math.max(stats.posts, 1)) * 100) / 10) : 0;

  const metrics = [
    { icon: Users, label: "Owner notes", value: stats.posts, hint: `${stats.models} models tracked` },
    { icon: Wrench, label: "Fixes shared", value: stats.fixes, hint: `${stats.confirmations} confirmations` },
    { icon: MessageSquare, label: "Follows", value: stats.follows, hint: `${saved.size} notes saved` },
    { icon: ShieldAlert, label: "Open reports", value: stats.reports, hint: "moderation queue" },
  ];

  const funnel = useMemo(() => {
    const stages = [
      { stage: "Onboarding · cars tracked", value: stats.garage + stats.shortlist },
      { stage: "Docs · service records", value: timeline.length },
      { stage: "Community · owner notes", value: stats.posts },
      { stage: "Trust · fix confirmations", value: stats.confirmations },
    ];
    const max = Math.max(1, ...stages.map((row) => row.value));
    return stages.map((row) => ({ ...row, pct: Math.round((row.value / max) * 100) }));
  }, [stats.confirmations, stats.garage, stats.posts, stats.shortlist, timeline.length]);

  return (
    <section aria-label="System telemetry" className="flex flex-col gap-6 pb-24 lg:pb-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge tone="error">Admin</Badge>
            <LabelCaps className="text-primary">System telemetry</LabelCaps>
          </div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-on-surface">System Telemetry</h2>
          <p className="text-sm text-on-surface-variant mt-1">Overview of workspace health and conversion metrics on this device.</p>
        </div>
      </div>

      {/* Range selector (visual context; totals are live lifetime counts) */}
      <div aria-label="Telemetry range" className="grid grid-cols-4 bg-surface-container border border-outline-variant rounded-lg p-1" role="group">
        {ranges.map((item) => (
          <button
            aria-pressed={range === item}
            className={
              "min-h-[44px] rounded font-mono text-[10px] font-bold tracking-[0.2em] uppercase transition-colors " +
              (range === item ? "bg-surface-container-highest text-on-surface edge-highlight" : "text-on-surface-variant hover:text-on-surface")
            }
            key={item}
            type="button"
            onClick={() => setRange(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card className="flex flex-col gap-3" key={metric.label}>
              <div className="flex items-center gap-2">
                <Icon aria-hidden="true" className="w-4 h-4 text-on-surface-variant" />
                <LabelCaps className="text-on-surface-variant">{metric.label}</LabelCaps>
              </div>
              <span className="font-mono text-4xl font-medium tracking-[0.02em] text-on-surface glow-text">
                {metric.value.toLocaleString("en-IN")}
              </span>
              <Sparkline seed={metric.value + metric.label.length} />
              <DataText className="text-outline">{metric.hint.toUpperCase()}</DataText>
            </Card>
          );
        })}
      </div>

      <Card className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between scanline">
        <div className="flex items-start gap-3">
          <Zap aria-hidden="true" className="w-5 h-5 text-primary mt-1 shrink-0" />
          <div>
            <LabelCaps className="text-on-surface-variant block mb-2">Avg engagement rate</LabelCaps>
            <span className="font-mono text-5xl font-medium text-on-surface glow-text">{engagementRate}%</span>
            <p className="text-sm text-on-surface-variant mt-2">Confirmations and saves per published owner note.</p>
          </div>
        </div>
        <BarSpark seed={stats.posts + stats.confirmations + 7} />
      </Card>

      <Card>
        <h3 className="font-mono text-xl font-medium tracking-[0.05em] text-on-surface mb-1">Conversion Funnel</h3>
        <p className="text-sm text-on-surface-variant mb-4">Onboarding to docs to community, from live records on this device.</p>
        <div className="flex flex-col gap-3">
          {funnel.map((row) => (
            <div className="flex items-center gap-3" key={row.stage}>
              <DataText className="w-14 sm:w-16 shrink-0 text-right text-on-surface text-sm">{row.pct}%</DataText>
              <div className="flex-1 min-w-0">
                <div
                  className="min-w-[2px] h-9 bg-surface-container-highest border border-outline-variant/60 rounded flex items-center px-3 overflow-hidden"
                  style={{ width: `${Math.max(row.pct, 12)}%` }}
                >
                  <span className="font-mono text-[10px] font-bold tracking-[0.15em] uppercase text-on-surface whitespace-nowrap">
                    {row.stage} ({row.value.toLocaleString("en-IN")})
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <GhostButton className="min-h-[44px]" onClick={app.downloadBackup}>
          <Download aria-hidden="true" className="w-4 h-4" />
          Export report
        </GhostButton>
        <GhostButton className="min-h-[44px]" onClick={() => app.openAccountView("notifications")}>
          <Bell aria-hidden="true" className="w-4 h-4" />
          Alert rules
        </GhostButton>
      </div>
    </section>
  );
}
