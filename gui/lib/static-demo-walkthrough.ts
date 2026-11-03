// Makes the Merna / Mother's Day Beauty campaign (MDC-2026-MD-001) walkable
// through all 10 workflow steps in static-demo mode.
//
// resolveStatic() (static-demo.ts) can only ever serve ONE fixed response per
// unique request signature, so /campaigns/{id}/state, /context, and
// /workflow/campaign-manager always resolved to the same frozen Step 1
// snapshot no matter how far the user advanced. This module swaps in a real
// pre-captured post-step snapshot (see scripts used to produce
// gui/public/static-demo/walkthrough_mdc-2026-md-001_step-*.json) each time
// the user advances, via a simple in-memory step pointer.
//
// Scope: this one campaign ID only. Every other campaign and every other
// persona's own /workflow/{persona} view is untouched and stays on the
// single frozen snapshot, by design.

const WALKTHROUGH_CAMPAIGN_ID = "MDC-2026-MD-001";
const INDEX_PATH = "/static-demo/walkthrough-mdc-2026-md-001.json";

type StepFiles = {
  index: number;
  state: string;
  context: string;
  audit_log: string;
  workflow: string;
};

type WalkthroughIndex = {
  campaign_id: string;
  steps: StepFiles[];
};

let indexCache: WalkthroughIndex | null = null;
// Module-level pointer. Resets to 0 on a full page reload, which is expected
// and acceptable for this demo mechanism.
let currentIndex = 0;

async function loadIndex(): Promise<WalkthroughIndex> {
  if (indexCache) return indexCache;
  const res = await fetch(INDEX_PATH, { cache: "no-store" });
  indexCache = (await res.json()) as WalkthroughIndex;
  return indexCache;
}

async function loadFile<T>(filename: string): Promise<T> {
  const res = await fetch(`/static-demo/${filename}`, { cache: "no-store" });
  return (await res.json()) as T;
}

export function isWalkthroughCampaign(campaignId: string): boolean {
  return campaignId === WALKTHROUGH_CAMPAIGN_ID;
}

export async function getWalkthroughState<T>(campaignId: string): Promise<T | null> {
  if (!isWalkthroughCampaign(campaignId)) return null;
  const idx = await loadIndex();
  return loadFile<T>(idx.steps[currentIndex].state);
}

export async function getWalkthroughContext<T>(campaignId: string): Promise<T | null> {
  if (!isWalkthroughCampaign(campaignId)) return null;
  const idx = await loadIndex();
  return loadFile<T>(idx.steps[currentIndex].context);
}

export async function getWalkthroughAuditLog<T>(campaignId: string): Promise<T | null> {
  if (!isWalkthroughCampaign(campaignId)) return null;
  const idx = await loadIndex();
  return loadFile<T>(idx.steps[currentIndex].audit_log);
}

// The 4 personas who actually own one or more of the 10 steps on this
// campaign (see api/routes/workflow.py's STEPS list). ceo and thales own no
// steps and stay on the old frozen single-snapshot path, untouched.
const STEP_OWNING_PERSONAS = new Set([
  "campaign-manager",
  "senior-designer",
  "production-artist",
  "marketing-analyst",
]);

type WorkflowStepRow = { owner_persona_id: string; [key: string]: unknown };
type WorkflowResponse = { persona_id: string; steps: WorkflowStepRow[] };

// The captured workflow file holds the canonical per-step `status` (purely a
// function of campaign progress, identical for every viewer) plus each
// step's `owner_persona_id`. `my_step` is just owner_persona_id === viewer,
// exactly how the real backend computes it (api/routes/workflow.py) — so any
// step-owning persona's correct view can be derived from the one captured
// file without capturing a separate file per persona.
export async function getWalkthroughWorkflow<T>(
  personaId: string,
  campaignId: string,
): Promise<T | null> {
  if (!STEP_OWNING_PERSONAS.has(personaId) || !isWalkthroughCampaign(campaignId)) return null;
  const idx = await loadIndex();
  const canonical = await loadFile<WorkflowResponse>(idx.steps[currentIndex].workflow);
  return {
    persona_id: personaId,
    steps: canonical.steps.map((step) => ({
      ...step,
      my_step: step.owner_persona_id === personaId,
    })),
  } as T;
}

/**
 * Called when the user completes `step`. Moves the pointer forward (if
 * `step` matches the current position) and returns the resulting real
 * captured state. Returns null if this isn't the walkthrough campaign.
 */
export async function advanceWalkthrough<T>(campaignId: string, step: number): Promise<T | null> {
  if (!isWalkthroughCampaign(campaignId)) return null;
  const idx = await loadIndex();
  if (step === currentIndex + 1) {
    currentIndex = Math.min(currentIndex + 1, idx.steps.length - 1);
  }
  // If step doesn't match (e.g. a stale retry after a page refresh reset the
  // pointer), just serve the current position rather than desyncing further.
  return loadFile<T>(idx.steps[currentIndex].state);
}

export function resetWalkthrough(campaignId: string): void {
  if (isWalkthroughCampaign(campaignId)) currentIndex = 0;
}

// Matches api/state.py's STEP_NAMES exactly, for sidebar-card fidelity.
const STEP_NAMES: Record<number, string> = {
  1: "Briefing",
  2: "Segmentation",
  3: "SKU Selection",
  4: "Creative Production",
  5: "Layout Assembly",
  6: "Approval",
  7: "Localization",
  8: "Activation",
  9: "Monitoring",
  10: "Reporting",
};

/**
 * Overrides the walkthrough campaign's entry in a /campaigns list response
 * with its real current progress, mirroring api/routes/workflow.py's
 * _merged_campaign(). Without this the sidebar's campaign card stays frozen
 * at Step 1 while the main workflow panel correctly advances.
 */
export async function applyWalkthroughToCampaigns<T extends { id: string }>(
  campaigns: T[],
): Promise<T[]> {
  const idx = await loadIndex().catch(() => null);
  if (!idx) return campaigns;
  const snapshot = await loadFile<{ current_step: number; is_complete: boolean }>(
    idx.steps[currentIndex].state,
  ).catch(() => null);
  if (!snapshot) return campaigns;

  return campaigns.map((c) => {
    if (c.id !== WALKTHROUGH_CAMPAIGN_ID) return c;
    const existing = c as unknown as { days_label?: string };
    if (snapshot.is_complete) {
      return {
        ...c,
        current_step: 10,
        current_step_name: "Reporting",
        status: "completed",
        color_indicator: "gray",
        days_label: existing.days_label ?? "Campaign complete",
      } as T;
    }
    return {
      ...c,
      current_step: snapshot.current_step,
      current_step_name: STEP_NAMES[snapshot.current_step] ?? `Step ${snapshot.current_step}`,
    } as T;
  });
}
