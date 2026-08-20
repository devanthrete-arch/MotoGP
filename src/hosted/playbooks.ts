import type { OwnershipPlaybook } from "../insights";
import { modelKeyFor } from "../insights";
import { CACHE_TTL, invalidateHostedNamespace, publicKey, readThroughCache } from "./cache";
import { asCount, asOneOf, asStringList, asText } from "./coerce";
import { type HostedClient, runHosted, runHostedForUser, unwrap, unwrapWrite } from "./result";
import type { Insert, ModelPlaybookRow, PlaybookEntryRow } from "./tables";

export const playbookConfidenceValues = ["Early signal", "Useful base", "Strong pattern"] as const;
export const playbookEntryKinds = ["Owner signal", "Buyer check", "Known issue", "Fix", "Cost note"] as const;

export type HostedPlaybookConfidence = (typeof playbookConfidenceValues)[number];
export type HostedPlaybookEntryKind = (typeof playbookEntryKinds)[number];

export type HostedPlaybookEntry = {
  id: string;
  playbookId: string;
  sourcePostId: string | null;
  kind: HostedPlaybookEntryKind;
  title: string;
  detail: string;
  evidenceCount: number;
  corroborations: number;
  confidence: HostedPlaybookConfidence;
};

/* -------------------------------------------------------------------------- */
/* Pure mappers                                                               */
/* -------------------------------------------------------------------------- */

export const playbookRowToLocal = (row: ModelPlaybookRow): OwnershipPlaybook => ({
  brand: asText(row.brand),
  buyerChecks: asStringList(row.buyer_checks),
  confidence: asOneOf<HostedPlaybookConfidence>(row.confidence, playbookConfidenceValues, "Early signal"),
  evidenceCount: asCount(row.evidence_count),
  headline: asText(row.headline),
  key: asText(row.id),
  model: asText(row.model),
  ownerSignals: asStringList(row.owner_signals),
});

export const playbookToRow = (
  userId: string | null,
  playbook: OwnershipPlaybook,
  corroborations = 0,
): Insert<"model_playbooks"> => ({
  brand: asText(playbook.brand, "Unknown"),
  buyer_checks: asStringList(playbook.buyerChecks),
  confidence: asOneOf<HostedPlaybookConfidence>(playbook.confidence, playbookConfidenceValues, "Early signal"),
  corroborations: asCount(corroborations),
  curated_by: userId,
  evidence_count: asCount(playbook.evidenceCount),
  headline: asText(playbook.headline).slice(0, 400),
  id: asText(playbook.key) || modelKeyFor(playbook.brand, playbook.model),
  model: asText(playbook.model, "Unknown"),
  owner_signals: asStringList(playbook.ownerSignals),
});

export const playbookEntryRowToLocal = (row: PlaybookEntryRow): HostedPlaybookEntry => ({
  confidence: asOneOf<HostedPlaybookConfidence>(row.confidence, playbookConfidenceValues, "Early signal"),
  corroborations: asCount(row.corroborations),
  detail: asText(row.detail),
  evidenceCount: asCount(row.evidence_count),
  id: asText(row.id),
  kind: asOneOf<HostedPlaybookEntryKind>(row.kind, playbookEntryKinds, "Owner signal"),
  playbookId: asText(row.playbook_id),
  sourcePostId: row.source_post_id ? asText(row.source_post_id) : null,
  title: asText(row.title),
});

export const playbookEntryToRow = (userId: string, entry: HostedPlaybookEntry): Insert<"playbook_entries"> => ({
  confidence: asOneOf<HostedPlaybookConfidence>(entry.confidence, playbookConfidenceValues, "Early signal"),
  corroborations: asCount(entry.corroborations),
  detail: asText(entry.detail).slice(0, 4000),
  evidence_count: asCount(entry.evidenceCount),
  kind: asOneOf<HostedPlaybookEntryKind>(entry.kind, playbookEntryKinds, "Owner signal"),
  playbook_id: asText(entry.playbookId),
  source_post_id: entry.sourcePostId ? asText(entry.sourcePostId) : null,
  title: asText(entry.title, "Playbook note"),
  user_id: userId,
});

/** Split a local playbook into the per-line evidence rows the hosted table stores. */
export const playbookToEntries = (playbook: OwnershipPlaybook): Omit<HostedPlaybookEntry, "id">[] => [
  ...playbook.ownerSignals.map((signal) => ({
    confidence: asOneOf<HostedPlaybookConfidence>(playbook.confidence, playbookConfidenceValues, "Early signal"),
    corroborations: 0,
    detail: "",
    evidenceCount: asCount(playbook.evidenceCount, 1),
    kind: "Owner signal" as const,
    playbookId: playbook.key,
    sourcePostId: null,
    title: signal,
  })),
  ...playbook.buyerChecks.map((check) => ({
    confidence: asOneOf<HostedPlaybookConfidence>(playbook.confidence, playbookConfidenceValues, "Early signal"),
    corroborations: 0,
    detail: "",
    evidenceCount: asCount(playbook.evidenceCount, 1),
    kind: "Buyer check" as const,
    playbookId: playbook.key,
    sourcePostId: null,
    title: check,
  })),
];

/* -------------------------------------------------------------------------- */
/* IO                                                                          */
/* -------------------------------------------------------------------------- */

export const selectPlaybookRows = async (client: HostedClient): Promise<ModelPlaybookRow[]> =>
  unwrap(await client.from("model_playbooks").select("*").order("evidence_count", { ascending: false }), []);

export const selectPlaybookEntryRows = async (client: HostedClient, playbookId?: string): Promise<PlaybookEntryRow[]> => {
  const query = client.from("playbook_entries").select("*");
  return unwrap(await (playbookId ? query.eq("playbook_id", playbookId) : query), []);
};

/** Public read: `model_playbooks` is anon-readable, so the cache key is shared. */
export const listHostedPlaybooks = (fallback: OwnershipPlaybook[] = []) =>
  readThroughCache<OwnershipPlaybook[]>(
    publicKey("playbooks", "all"),
    fallback,
    () =>
      runHosted<OwnershipPlaybook[]>(fallback, async (client) =>
        (await selectPlaybookRows(client)).map(playbookRowToLocal),
      ),
    CACHE_TTL.playbooks,
  );

export const loadHostedPlaybook = (playbookId: string, fallback: OwnershipPlaybook | null = null) =>
  readThroughCache<OwnershipPlaybook | null>(
    publicKey("playbooks", playbookId),
    fallback,
    () =>
      runHosted<OwnershipPlaybook | null>(fallback, async (client) => {
        const row = unwrap(await client.from("model_playbooks").select("*").eq("id", playbookId).maybeSingle(), null);
        return row ? playbookRowToLocal(row) : fallback;
      }),
    CACHE_TTL.playbooks,
  );

export const listHostedPlaybookEntries = (playbookId?: string, fallback: HostedPlaybookEntry[] = []) =>
  readThroughCache<HostedPlaybookEntry[]>(
    publicKey("playbook-entries", playbookId ?? "all"),
    fallback,
    () =>
      runHosted<HostedPlaybookEntry[]>(fallback, async (client) =>
        (await selectPlaybookEntryRows(client, playbookId)).map(playbookEntryRowToLocal),
      ),
    CACHE_TTL.playbooks,
  );

export const upsertHostedPlaybooks = (userId: string | null | undefined, playbooks: OwnershipPlaybook[]) =>
  runHostedForUser<OwnershipPlaybook[]>(userId, playbooks, async (client, id) => {
    if (!playbooks.length) return playbooks;
    unwrapWrite(
      await client
        .from("model_playbooks")
        .upsert(playbooks.map((playbook) => playbookToRow(id, playbook)), { onConflict: "id" }),
    );
    invalidateHostedNamespace("playbooks");
    return playbooks;
  });

export const addHostedPlaybookEntry = (userId: string | null | undefined, entry: Omit<HostedPlaybookEntry, "id">) =>
  runHostedForUser(userId, entry, async (client, id) => {
    unwrapWrite(await client.from("playbook_entries").insert(playbookEntryToRow(id, { ...entry, id: "" })));
    invalidateHostedNamespace("playbook-entries");
    return entry;
  });
