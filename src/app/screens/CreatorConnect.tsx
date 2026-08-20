import { ArrowRight, BadgeCheck, Camera, Flag, MapPin, Megaphone, SlidersHorizontal, Wrench } from "lucide-react";
import { useState } from "react";
import { useApp } from "../state/appState";
import { Badge, Card, DataText, GhostButton, LabelCaps, PrimaryButton } from "../../ui/primitives";

type Niche = "Tech" | "Racing" | "Lifestyle" | "Detailing";

type Creator = {
  handle: string;
  name: string;
  city: string;
  platform: string;
  niche: Niche;
  tags: string[];
  audience: string;
  engagement: string;
  verified: boolean;
  focus: string;
};

/* Invented, plausible Indian automotive creators — not real public figures. */
const creators: Creator[] = [
  {
    handle: "AARAV R.",
    name: "Aarav Raghuvanshi",
    city: "New Delhi",
    platform: "YouTube",
    niche: "Tech",
    tags: ["EV Mods", "Diagnostics"],
    audience: "214K",
    engagement: "7.8%",
    verified: true,
    focus: "Long-term EV range telemetry and OBD teardowns.",
  },
  {
    handle: "MEERA K.",
    name: "Meera Kulkarni",
    city: "Pune",
    platform: "Instagram",
    niche: "Racing",
    tags: ["Track Days", "Setup"],
    audience: "96K",
    engagement: "11.4%",
    verified: true,
    focus: "Kari and CoASTT lap notes, suspension setup logs.",
  },
  {
    handle: "GEARBOX BHAI",
    name: "Imran Shaikh",
    city: "Mumbai",
    platform: "YouTube",
    niche: "Tech",
    tags: ["DIY Fixes", "Budget Builds"],
    audience: "382K",
    engagement: "5.6%",
    verified: true,
    focus: "Hindi-first repair walkthroughs for mass-market hatchbacks.",
  },
  {
    handle: "TANVI DRIVES",
    name: "Tanvi Menon",
    city: "Bengaluru",
    platform: "Instagram",
    niche: "Lifestyle",
    tags: ["Road Trips", "Ownership"],
    audience: "158K",
    engagement: "9.2%",
    verified: false,
    focus: "Real-world highway mileage runs across South India.",
  },
  {
    handle: "SHINE THEORY",
    name: "Devansh Patel",
    city: "Ahmedabad",
    platform: "YouTube",
    niche: "Detailing",
    tags: ["PPF", "Ceramic"],
    audience: "67K",
    engagement: "12.9%",
    verified: false,
    focus: "Paint correction economics for daily-driven cars.",
  },
  {
    handle: "APEX ANITA",
    name: "Anita Fernandes",
    city: "Chennai",
    platform: "YouTube",
    niche: "Racing",
    tags: ["Sim Racing", "Track School"],
    audience: "121K",
    engagement: "8.1%",
    verified: true,
    focus: "Beginner track school series and racecraft breakdowns.",
  },
];

const filters: Array<{ label: string; value: Niche | "All"; icon: typeof Flag }> = [
  { label: "All", value: "All", icon: SlidersHorizontal },
  { label: "Tech", value: "Tech", icon: Wrench },
  { label: "Racing", value: "Racing", icon: Flag },
  { label: "Lifestyle", value: "Lifestyle", icon: Camera },
  { label: "Detailing", value: "Detailing", icon: Camera },
];

/** Creator Connect (template: creator_connect_autoflex). PRD Module C collaboration hub. */
export function CreatorConnect() {
  const app = useApp();
  const [filter, setFilter] = useState<Niche | "All">("All");
  const visible = creators.filter((creator) => filter === "All" || creator.niche === filter);

  return (
    <section aria-label="Creator network" className="flex flex-col gap-6 pb-24 lg:pb-8">
      <div>
        <LabelCaps className="text-primary block mb-1">Creator network</LabelCaps>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-on-surface">Creator Network</h2>
        <p className="text-sm text-on-surface-variant mt-1 max-w-md">
          Connect with Indian automotive specialists broadcasting real ownership data.
        </p>
      </div>

      <div aria-label="Filter creators by niche" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="group">
        {filters.map((item) => {
          const Icon = item.icon;
          const active = filter === item.value;
          return (
            <button
              aria-pressed={active}
              className={
                "shrink-0 inline-flex items-center gap-2 min-h-[44px] px-4 rounded-full border font-mono text-[10px] font-bold tracking-[0.2em] uppercase transition-colors " +
                (active
                  ? "bg-primary text-on-primary border-primary glow-ring"
                  : "bg-surface-container text-on-surface-variant border-outline-variant hover:text-on-surface hover:border-outline")
              }
              key={item.label}
              type="button"
              onClick={() => setFilter(item.value)}
            >
              <Icon aria-hidden="true" className="w-3.5 h-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((creator) => (
          <Card className="flex flex-col gap-4" key={creator.handle}>
            <div className="flex items-start gap-3">
              <div aria-hidden="true" className="w-14 h-14 shrink-0 rounded-lg bg-surface-variant border border-outline-variant flex items-center justify-center edge-highlight">
                <span className="font-mono text-sm font-bold tracking-[0.1em] text-primary">
                  {creator.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")}
                </span>
              </div>
              <div className="min-w-0">
                <h3 className="font-mono text-lg font-medium tracking-[0.05em] text-on-surface truncate flex items-center gap-1.5">
                  {creator.handle}
                  {creator.verified ? <BadgeCheck aria-hidden="true" className="w-4 h-4 text-primary shrink-0" /> : null}
                </h3>
                <p className="text-sm text-on-surface-variant flex items-center gap-1 truncate">
                  <MapPin aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
                  {creator.city} · {creator.platform}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {creator.tags.map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-sm text-on-surface-variant">{creator.focus}</p>

            <div className="grid grid-cols-2 gap-2 bg-surface-container-lowest border border-outline-variant/60 rounded-lg p-3">
              <div>
                <LabelCaps className="text-on-surface-variant block mb-1">Audience</LabelCaps>
                <DataText size="lg" className="text-on-surface">{creator.audience}</DataText>
              </div>
              <div>
                <LabelCaps className="text-on-surface-variant block mb-1">Engagement</LabelCaps>
                <DataText size="lg" className="text-on-surface">{creator.engagement}</DataText>
              </div>
            </div>

            <GhostButton
              className="w-full min-h-[44px] mt-auto hover:border-primary hover:text-primary"
              onClick={() => app.setActionMessage(`Collab request noted for ${creator.handle}. They reply within 3 working days.`)}
            >
              Connect
              <ArrowRight aria-hidden="true" className="w-4 h-4" />
            </GhostButton>
          </Card>
        ))}
      </div>

      {/* Campaign brief */}
      <Card className="scanline">
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Megaphone aria-hidden="true" className="w-4 h-4 text-primary" />
              <LabelCaps className="text-primary">Open campaign brief</LabelCaps>
            </div>
            <h3 className="font-display text-xl font-semibold text-on-surface">Monsoon Readiness Series</h3>
            <p className="text-sm text-on-surface-variant mt-1 max-w-xl">
              AutoFlex is commissioning short-form content on pre-monsoon prep: wiper and tyre checks, underbody
              anti-rust, insurance add-ons, and flooded-road protocol. Content must cite real service invoices from
              the creator's own garage log.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
              {[
                { label: "Deliverables", value: "3 REELS + 1 LONG-FORM" },
                { label: "Window", value: "SEP 01 - SEP 30" },
                { label: "Budget band", value: "₹40K - ₹1.2L" },
              ].map((item) => (
                <div className="bg-surface-container-lowest border border-outline-variant/60 rounded p-3" key={item.label}>
                  <LabelCaps className="text-on-surface-variant block mb-1">{item.label}</LabelCaps>
                  <DataText className="text-on-surface">{item.value}</DataText>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2 lg:w-56 shrink-0">
            <PrimaryButton
              className="w-full"
              onClick={() => app.setActionMessage("Campaign brief request saved. The partnerships desk will email you.")}
            >
              Pitch for this brief
            </PrimaryButton>
            <GhostButton
              className="w-full min-h-[44px]"
              onClick={() => app.setActionMessage("Creator application noted. Share your garage log to fast-track review.")}
            >
              Apply as creator
            </GhostButton>
          </div>
        </div>
      </Card>
    </section>
  );
}
