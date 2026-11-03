<!-- updated-at: 6531742d1e8a4dd9003b627fbe750bacb8d19cab -->
<!-- updated: 2026-11-02 -->

# CONTEXT.md — Macy's AI Coworker

A stranger's guide to this repo: what it is, how it's built, why it's built that way, and where things stand right now. See `CODEMAP.md` for the compact file-by-file navigation map — this file is the narrative and decision history around it.

## Who / what this is

- **Course project** for MGT 449 (GenAI for Business), UCSD Rady School of Management, instructed by Professor Vincent (and Professor Thales, who also appears in-app as a co-CEO persona). This is explicitly a class deliverable, not a production product — demo polish and "honest" labeling of what's really AI vs. deterministic matters more here than it would commercially.
- **Team:** Merna Saad (repo owner in this session, email mesaad@ucsd.edu, persona "Merna — Campaign Manager" in-app), Abdullah AlJarallah (persona "Abdullah — Senior Designer"), Shankar D. (persona "Shankar — Production Artist"). An "Anna — Marketing Analyst" persona also exists in the app; her real-world counterpart isn't noted elsewhere in the repo.
- **What it does:** an AI coworker that walks a Macy's marketing campaign through a 10-step workflow (brief → segment → SKU selection → creative → layout → compliance/approval → localization → activation → monitoring → reporting), using LLM judgment (Claude via TritonAI) only at the 5 steps that genuinely need it and deterministic Python everywhere else. Three seeded demo campaigns (active, completed, planned) let a viewer see the whole lifecycle without having to drive every step by hand.
- **Guiding philosophy** (stated in README "What We Learned"): "if you can write a deterministic rule, do not ask a model" — a line from an n8n Reddit post the professor/team referenced. This shaped the Skills-vs-Automations architectural split (see Boundaries below) and is treated as a standing design principle, not just a README note.

## Live URLs

- App: https://macysai.vercel.app
- Storyboard: https://macysai.vercel.app/story
- RAG comparison demo: https://macysai.vercel.app/rag-compare
- Eval dashboard: https://macysai.vercel.app/evals
- Backend (Render free tier): `macys-api-n6f3.onrender.com` — sleeps after ~15 min idle, first request after sleep takes 30–90s.

## Architecture (see CODEMAP.md for the full file map)

```
Browser (Next.js 14, Vercel)
   -> FastAPI backend (Render, api/main.py)
        -> in-memory campaign state (api/state.py, 3 seeded campaigns)
        -> ai_engine/ (the authoritative AI package at runtime)
             -> 5 LLM Skills (claude-sonnet-4-6 via TritonAI)
             -> 7 deterministic Automations (k-means, scoring, template expansion, timezone math, regression)
             -> 3 MCP tools (FastMCP, stdio transport)
             -> RAG corpus: 12 docs, naive FAISS index (78 chunks) + HyQ index (381 entries)
             -> Orchestrator: 8 deterministic routing rules, no LLM in routing
        -> SQLite (data/macys.db: 50K customers, 2K SKUs, 5K DAM assets)
   -> eval suite (DeepEval, 67 tests, Claude-as-judge)
```

Two **independent** frontend resilience layers exist in `gui/lib/`, and conflating them was the source of this session's main task:
1. **Static-demo mode** (`gui/lib/static-demo.ts`, gated by `NEXT_PUBLIC_STATIC_DEMO=1`) — serves pre-captured real API responses from `gui/public/static-demo/*.json` via a manifest lookup (`resolveStatic()`). Built so the Vercel frontend can run a full demo with zero backend, logging `[static-demo] HIT/MISS/NO MATCH` to the console for visibility. `request()` in `api.ts` already gates on `IS_STATIC_DEMO` for most calls; the sidebar panel pages (analytics/dashboard/impact/knowledge/segments) did not, until this session.
2. **Cold-start resilience** (`gui/lib/api.ts`'s `callWithFallback` / `fetchWithFallback` / `getWithOutputFallback` / `requestWithFallback`) — races a live Render call against a 10s timeout, falling back to bundled `cached-panels.json` / `cached-outputs.json` (real captured outputs) if Render is cold or the call fails. This is newer than static-demo and was added independently on `personal/main`.

These two layers are meant to **compose**, not compete: in static-demo mode, resolve from the static layer; otherwise, use the live-fallback layer. See "Recent work" below for how the 5 conflicting pages were reconciled.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 14 (App Router), Tailwind CSS, Lucide icons, Framer Motion (`gui/components/motion.tsx`) |
| Backend | FastAPI, Python 3.11, managed with `uv` |
| AI | Claude (`claude-sonnet-4-6`) via TritonAI, temperature 0.2, max 2000 tokens |
| RAG | FAISS, sentence-transformers `all-MiniLM-L6-v2` (384-dim, L2-normalized, deferred load) |
| MCP | FastMCP server, stdio transport |
| Database | SQLite (`data/macys.db`) |
| Tests | pytest (241 tests), DeepEval 4.0.2 (67 eval tests) |
| Deploy | Vercel (frontend, auto-deploy from `main`), Render (backend, auto-deploy from `main`, config in `render.yaml`) |
| Browser testing (ad hoc) | Playwright (`chromium` headless), installed into `gui/node_modules` — not a project dependency, was installed this session for one-off verification |

## Git / branch layout (as of this session)

- Current branch: `static-demo`.
- Other local branches: `main`, `add-hyq-rag`, `deploy-fix`, `refactor-skills-vs-automations`, `ui-redesign-editorial`.
- Three remotes:
  - `origin` → `mgt449-milestone03-Group-4` (course org repo, current milestone)
  - `m2-archive` → `mgt449-milestone02-Group-4` (frozen prior milestone, read-only in practice)
  - `personal` → `rsm-msaad/macys-marketing-gui` (Merna's personal fork/mirror; `personal/main` is where the newer "10s live-fallback" system landed before `static-demo` was rebased onto it)
- Recent commit history on this branch is dominated by storyboard slide edits (`reorder storyboard slides`, `add new slide to storyboard`) made via the `/story-edit` GitHub-backed editor — expect a long tail of these in `git log`; they're not noise to be alarmed by, just frequent small content edits.
- HEAD at last update: `6531742d1e8a4dd9003b627fbe750bacb8d19cab`.

## Standing decisions / conventions

- **`ai_engine/` is authoritative at runtime.** `api/main.py` sys.path-inserts it. Root-level `rag/`, `skills/`, `automations/`, `mcp_servers/`, and the entire `milestone04/` directory are earlier-milestone copies — never assume an edit there reaches the live API. Always check which copy is "live" before editing.
- **Skills vs. Automations is a deliberate, maintained line.** Skills = LLM judgment (5 of them, each with a `SKILL.md` prompt contract). Automations = deterministic Python (7 of them). Don't move logic across this line without updating the README's workflow table — there's a whole branch (`refactor-skills-vs-automations`) dedicated to this distinction, implying it was contested/revisited at least once.
- **All LLM calls must go through `utils.connect.ask()` / `ask_json()`**, which wraps TritonAI's `base_url`. Never instantiate an OpenAI/Anthropic client directly. The `TRITONAI_API_KEY` env var drives this.
- **Data/plotting stack is numpy + polars + plotnine only** for any Python analysis/plotting in this project — no pandas, matplotlib, seaborn, pyrsm, or plotly (per project `CLAUDE.md`).
- **Package management via `uv`** — `uv add`/`uv remove`, never raw `pip install` (enforced by a deny rule in `.claude/settings.json`).
- **Every function gets tests in the same change** (project `CLAUDE.md` hard rule) — happy path + edge cases, `tests/test_*.py` mirroring `src/`/`skills/` layout, run via `uv run pytest`.
- **"Honest" UI labeling is a design rule, not just a nice-to-have.** The app explicitly distinguishes `HUMAN_ONLY` / `HUMAN_PLUS_AUTOMATION` / `HUMAN_PLUS_SKILL` / `FULLY_AUTOMATED` badges, and DEMO_GUIDE.md calls out things like "Step 3 pricing check: 'Pricing helper' (not MCP)" — the team cares about not overstating what's AI vs. scripted, presumably because overstating AI involvement would undercut the course's own thesis (judgment vs. automation).
- **MCP protocol vs. direct call is togglable** via `MCP_PROTOCOL_PRICING` env var (defaults on) for `check_pricing_conflicts`; `find_dam_assets` and `generate_locale_variants` are always called as direct Python functions even though they're MCP-registered.
- **Pre-fetch pattern ("Option A") over agentic tool-looping** was chosen deliberately for most skills: gather all RAG/MCP context first, then one Claude call. Only `compliance-pre-check` and `approval-brief-generator` run agentically (Claude decides when to call `check_pricing_conflicts` mid-reasoning). Rationale per README: simpler to debug/test, predictable latency.
- **Cache-once-per-campaign pattern** for agentic skills: they fire once, then replay from the evidence store on revisit (avoids re-firing Claude on every page visit/poll).
- **Storyboard content is edited via `/story-edit`**, which commits directly to GitHub using a `GITHUB_PAT` env var — this is how non-technical team members update the 75-slide deck, explaining the long run of `reorder storyboard slides` commits in history.

## Known gotchas

- **Render free-tier cold starts.** First request after 15 min idle takes 30–90s. This is *why* the `*WithFallback` family in `api.ts` exists — don't "fix" a slow first load by removing the fallback logic.
- **Static-demo and live-fallback are separate mechanisms that must compose, not collide.** The whole point of this session's merge work. If you see a page re-diverge (e.g. someone adds a new panel page with only one of the two patterns), it should get both: `IS_STATIC_DEMO` check first → `resolveStatic()`, else fall through to the relevant `*WithFallback` call.
- **`NEXT_PUBLIC_*` env vars are inlined at build time** in Next.js — `gui/lib/static-demo.ts` reads `process.env.NEXT_PUBLIC_STATIC_DEMO` as a direct literal (not destructured, not via a variable) for exactly this reason; refactoring that line to look "cleaner" would silently break static-mode detection in production builds.
- **Two FAISS indexes exist** (naive 78-chunk vs. HyQ 381-entry) and are compared live at `/rag-compare` — don't assume there's only one RAG index when touching retrieval code.
- **`workflow_state.json` (orchestrator CLI state) and `api/state.py`'s in-memory state are two separate state stores** for two separate entry points (the CLI orchestrator vs. the live API) — don't assume editing one affects the other.
- **`.runtime_state.json`** at repo root (untracked) persists `api/state.py` across restarts — if campaign state looks "stuck" or wrong after a backend restart, this file is where to look.

## This session's work: resolving the static-demo rebase conflicts

**What happened:** The `static-demo` branch was rebased onto 75 newer commits from `personal/main`, which had independently added the `fetchWithFallback` 10s-timeout/cached-panel-fallback system to `gui/lib/api.ts`. `git stash pop` produced conflicts in 5 files, each with the identical two-conflict shape (an import block, and the data-fetching `useEffect`):

- `gui/app/analytics/page.tsx`
- `gui/app/dashboard/page.tsx`
- `gui/app/impact/page.tsx`
- `gui/app/knowledge/page.tsx`
- `gui/app/segments/page.tsx`

**Resolution pattern applied to all 5** (both behaviors preserved, not one side picked over the other):
```ts
import { fetchWithFallback } from "@/lib/api";
import { IS_STATIC_DEMO, resolveStatic } from "@/lib/static-demo";
...
useEffect(() => {
  (async () => {
    if (IS_STATIC_DEMO) {
      const data = await resolveStatic<T>("GET", "/path");
      if (data) { setX(data); return; }
    }
    fetchWithFallback<T>("/path", "cached_key")
      .then(setX)
      .catch(() => {});
  })();
}, []);
```
In static-demo mode, resolution short-circuits to the static layer (logs `[static-demo] HIT`). Otherwise it falls through to the newer live+10s-fallback behavior.

**Per-file notes:**
- `analytics`, `dashboard`, `impact` — direct application of the pattern (different types/state setters only).
- `knowledge` — also retains its `API_BASE` import, used by a separate, non-conflicted `openDoc()` fetch further down the file (per-document fetch, not covered by the `cachedKey` fallback system).
- `segments` — the static-demo side's stashed import had added an unused `PulsingDots` import from `@/components/motion`; dropped as dead code rather than carried forward. Also added a `setLoading(false)` call in the static-hit branch (this file has a `loading` state that the stashed code had forgotten to clear on a static hit; `impact` and `knowledge` already did this correctly, so `segments` was brought in line with them).

**Verification performed:**
1. `grep -rn -E '^(<{7}|={7}|>{7})' .` across the whole tree (excluding `node_modules`/`.git`/`.next`) — zero matches, all conflict markers removed.
2. `npm run build --prefix gui` — compiled successfully, zero type errors, all 34 routes generated.
3. Playwright (installed fresh into `gui/node_modules` for this check — `npx playwright install chromium`) drove a headless browser against all 5 pages on `npm run start` with the backend intentionally not running. Confirmed for every page: a `[static-demo] HIT GET /path -> filename.json` console line, and zero network requests to `onrender.com`.
4. Server stopped afterward (`lsof -ti:3000 | xargs kill`); the one-off `.verify-static-demo.js` script was deleted from `gui/`.

**Status as of last update:** the 5 files are merged correctly in the working tree and build/verify clean, but git still shows them as `UU` (unmerged) — **nothing has been staged or committed yet**. This was intentional per instruction ("do not commit yet") so the user could review the diffs first.

## Open loose ends

- **Commit the 5 resolved merge-conflict files.** Pending user review of the diffs; the merge itself is verified working. Also still untracked/modified from the same rebase: `gui/lib/static-demo.ts` (new), `gui/public/static-demo/` (new fixture directory), `scripts/llm_capture_requests.md` (new runbook), plus `.runtime_state.json` and a handful of `.env*` / `package.json` / `package-lock.json` / other `gui/app/*` and `gui/lib/*` changes already staged (`M`) from the broader static-demo branch work — these appear to be part of the same overall static-demo feature and were not touched this session beyond the 5 conflict files.
- **Playwright is now installed in `gui/node_modules`** (via `npx playwright install chromium`) purely for this session's verification — it is not added to `package.json` as a dependency. Future sessions needing browser verification again will need to re-run `npx playwright install chromium` (the browser binary cache may or may not persist) and should decide whether to formalize this as a dev dependency / project skill (the `run` skill's `/run-skill-generator` was recommended by its own instructions for exactly this kind of "had to install packages to get it working" case).
- **No project-level "run skill" exists yet** for launching the gui app for verification — this session fell back to the generic `run` skill's Playwright pattern. Worth generating a proper one if browser verification becomes routine.

## Voice / tone

No explicit brand voice doc found; the README and DEMO_GUIDE favor plain, precise, slightly technical prose with an emphasis on being "honest" about what's really AI-driven vs. deterministic — avoid oversell language ("AI-powered" everywhere) in any new copy for this app, consistent with the existing badges/labels convention.
