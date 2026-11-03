<!-- built-at: 6531742d1e8a4dd9003b627fbe750bacb8d19cab -->
<!-- updated: 2026-11-02 -->

# CODEMAP

## Overview
Macy's AI Coworker: Next.js 14 GUI + FastAPI backend walking a marketing campaign through a 10-step workflow (5 LLM skills via TritonAI/Claude, 7 deterministic automations, RAG+MCP). Backend: `uv run uvicorn api.main:app --reload` (port 8000). Frontend: `cd gui && npm run dev` (port 3000). Deploy: Vercel (gui, from `main`) + Render (api, `render.yaml`).

## Entry points
- `api/main.py` — FastAPI app, mounts all routers, M3 AI endpoints (`/api/ai/*`), health checks.
- `gui/app/layout.tsx` + `gui/app/page.tsx` — Next.js root layout and persona picker (home page).
- `ai_engine/orchestrator/orchestrator.py` — CLI: deterministic workflow stepper over `ai_engine/workflow_state.json`.
- `ai_engine/orchestrator/agent.py` — CLI: agentic tool-calling loop (`main()`), separate from the skill-invoker path.
- `mcp_servers/macys_marketing.py` / `ai_engine/mcp_server/server.py` — FastMCP server (stdio), launched via root `.mcp.json`.
- `scripts/orchestrator.py` — Quarto/HTML orchestrator UI script.

## Data flow
1. Browser (gui, Next.js/Vercel) calls FastAPI (`api/main.py`) via `gui/lib/api.ts` (`request()`/`callWithFallback`/`fetchWithFallback`), base URL from `NEXT_PUBLIC_API_URL`.
2. `api/routes/workflow.py` + `api/state.py` hold in-memory campaign state (3 seeded campaigns) for the 10-step pipeline.
3. `api/routes/skills.py` calls deterministic automations directly (`api/_skill_loader.py` lazy-imports `ai_engine/automations/*`).
4. M3 AI endpoints (`api/main.py` `/api/ai/*`) call `ai_engine/orchestrator/skill_invoker.py` → pre-fetches RAG (`ai_engine/rag/retrieval.py`) + MCP tool results → calls Claude (`claude-sonnet-4-6` via TritonAI) → parses JSON → merges into `workflow_state.json`.
5. Static-demo mode (`gui/lib/static-demo.ts`, `NEXT_PUBLIC_STATIC_DEMO=1`): `api.ts` intercepts every `request()`/live fetch and resolves from `gui/public/static-demo/*.json` + `manifest.json` (pre-captured real responses) instead of hitting the live backend — used for the Vercel-only demo with no backend running.
6. Resilience layer (separate from static-demo): `callWithFallback`/`fetchWithFallback`/`getWithOutputFallback`/`requestWithFallback` in `gui/lib/api.ts` race the live Render call against a 10s timeout and fall back to `gui/public/cached-outputs.json` / `cached-panels.json` if Render is cold/asleep (free tier sleeps after 15 min).

## File map

### api/ (FastAPI backend)
- `api/main.py` — app factory, CORS, `/health`, M3 AI endpoints (`/api/ai/chat|compliance|brief|route-revision|cascade|activity|warmup`). uses: `api/_skill_loader.py`, `api/routes/*`, `ai_engine/orchestrator/skill_invoker.py`, `ai_engine/rag/retrieval.py`.
- `api/_skill_loader.py` — lazy-loads automation modules from `ai_engine/automations/*` by file path (`SEGMENT`, `DAM`, `LOCALIZE`, `ANALYZE`, `SKU_RECOMMEND`); defines `DB_PATH`, `IMAGES_DIR`. used-by: `api/main.py`, `api/routes/skills.py`.
- `api/state.py` — in-memory campaign state store: seeded states (`_initial_state`, `_completed_spring_state`, `_planned_summer_state`), `advance/reset/request_revisions/resubmit`, evidence + audit log + escalations, persisted via `_persist/_restore` (likely to `.runtime_state.json`). used-by: `api/routes/workflow.py`, `impact.py`, `sidebar.py`.
- `api/routes/auth.py` — `/api/auth/login|logout|check`, `require_auth` dependency (bearer-token style), used by `slides_admin.py`.
- `api/routes/chat.py` — `/chat`, scripted per-persona reply logic (`_campaign_manager`, `_senior_designer`, etc.) pattern-matched on message text.
- `api/routes/images.py` — `/api/images/hero`, Unsplash-backed hero image lookup.
- `api/routes/impact.py` — `/campaigns/{id}/impact`, `/impact/portfolio`, per-step business-impact scoring.
- `api/routes/knowledge.py` — `/knowledge`, `/knowledge/{doc_id}`, serves `ai_engine/rag/knowledge_base/*.md` as API docs.
- `api/routes/personas.py` — `/personas` list.
- `api/routes/rag_compare.py` — `/api/rag/compare`, naive vs HyQ retrieval side-by-side.
- `api/routes/sidebar.py` — `/dashboard/overview`, `/segments/overview`, `/analytics/overview` (panel summaries for gui sidebar pages).
- `api/routes/skills.py` — `/skills/*` wraps each automation/skill as POST (segment, dam-search, find-dam-assets, localize, generate-report, analyze, activate, sku-recommend, check-pricing).
- `api/routes/slides_admin.py` — `/api/slides/*` CRUD for storyboard slides, commits to GitHub via `GITHUB_PAT` (used by `gui/app/story-edit`).
- `api/routes/workflow.py` — `/workflow/{persona_id}`, `/campaigns*` — core 10-step campaign CRUD, advance/approve/reject/escalate/rerun per step.

### ai_engine/ (Python AI core)
- `ai_engine/orchestrator/orchestrator.py` — `run_workflow()`, deterministic main loop over `routing_table.py`.
- `ai_engine/orchestrator/routing_table.py` — `pick_next_step`/`pick_next_skill`, 8 priority routing rules (see README).
- `ai_engine/orchestrator/skill_invoker.py` — `invoke_skill()` entry (via `_invoke_agentic_skill`/`_invoke_automation`), RAG+MCP pre-fetch (`_prefetch_rag`, `_prefetch_mcp`), Claude call (`_call_claude`), agentic tool loop. uses: `ai_engine/rag/retrieval.py`, `ai_engine/tools/*`, `utils/connect.py`-style API key. used-by: `api/main.py`.
- `ai_engine/orchestrator/agent.py` — standalone agentic CLI loop (`run_agent`), separate tool-calling demo path. uses: `agent_tools.py`, `agent_schemas.py`.
- `ai_engine/orchestrator/agent_tools.py` — `build_tool_registry()` for the agent.py loop.
- `ai_engine/orchestrator/agent_schemas.py` — Pydantic schemas for agent tool I/O.
- `ai_engine/orchestrator/seed_state.py` / `simulate_vp.py` — CLI helpers to seed/mutate `workflow_state.json` for manual testing.
- `ai_engine/workflow_state.json` — checkpointed campaign state for the orchestrator CLI path (distinct from `api/state.py`'s in-memory state).
- `ai_engine/skills/{compliance-pre-check,approval-brief-generator,revision-router,layout-copy-generator,report-generator}/` — each has `SKILL.md` (prompt contract) + `helpers.py` (deterministic post-processing of the LLM's JSON output).
- `ai_engine/automations/{audience-segment-builder,dam-asset-finder,localization-generator,localization-generator-v1,activation-scheduler,campaign-performance-analyzer,sku-recommender}/` — deterministic Python (k-means, scoring, template expansion, timezone math, regression). No LLM calls.
- `ai_engine/rag/retrieval.py` — `retrieve(query, k)`, FAISS cosine search, lazy-loads `all-MiniLM-L6-v2` via `_model_cache.py`.
- `ai_engine/rag/chunker.py` / `build_index.py` — builds `ai_engine/rag/index/` (naive, 78 chunks) from `knowledge_base/*.md`.
- `ai_engine/rag/hyq/build_hyq_index.py` / `retrieval.py` — HyQ index (381 entries: chunks + generated questions) in `ai_engine/rag/hyq/index/`.
- `ai_engine/rag/knowledge_base/*.md` — 12 simulated Macy's policy/retro/ticket docs, doc IDs documented in README.
- `ai_engine/tools/{check_pricing_conflicts,find_dam_assets,generate_locale_variants}.py` — MCP tool implementations, also callable directly.
- `ai_engine/mcp_server/server.py` — FastMCP server wrapping the 3 tools above (stdio transport).

### Top-level Python
- `rag/`, `skills/`, `automations/`, `mcp_servers/`, `scripts/` at repo root — thin re-exports/mirrors or earlier-milestone copies of the `ai_engine/` equivalents (check before editing which copy is live; `api/main.py` sys.path-inserts `ai_engine/` so that copy is authoritative for the running API).
- `milestone04/` — frozen snapshot of an earlier milestone's deliverables (own `rag/`, `skills/`, `mcp_servers/`, `scripts/orchestrator_ui.html`); not wired into the live app.
- `utils/connect.py` — `ask()`/`ask_json()`, the required wrapper for all LLM calls (routes through TritonAI `base_url`); `utils/oauth_gpt.py` — `oauth-gpt` model id, ChatGPT/Codex OAuth fallback.
- `data/generators/*.py` — one-off scripts that built `data/macys.db` and `data/images/dam/*`.
- `data/schemas/schema.sql` — SQLite schema for `data/macys.db`.
- `evals/*.py` — DeepEval suite (67 tests, `triton_judge.py` = Claude-as-judge wrapper), datasets in `evals/datasets/*.json`.
- `tests/` — pytest suite (241 tests): `automations/`, `skills/`, `integration/`, plus root-level API/connectivity/smoke tests.
- `conftest.py` — root pytest config/fixtures.

### gui/ (Next.js 14 frontend)
- `gui/app/layout.tsx` — root layout; `gui/app/page.tsx` — persona picker landing page.
- `gui/app/{campaign-manager,senior-designer,production-artist,marketing-analyst}/page.tsx` — per-persona workflow views (all render through `PersonaShell`).
- `gui/app/{dashboard,analytics,segments,impact,knowledge}/page.tsx` — standalone data panel pages (backed by `api/routes/sidebar.py`, `impact.py`, `knowledge.py`); **currently mid-merge** reconciling static-demo guards with a newer 10s live-fallback system (see git status).
- `gui/app/rag-compare/page.tsx` — naive vs HyQ retrieval demo UI.
- `gui/app/review/page.tsx` — step approval/reject/escalate review UI.
- `gui/app/evals/page.tsx` — eval dashboard (reads `gui/public/evals/latest.md`).
- `gui/app/story/page.tsx` + `gui/app/story-edit/{page.tsx,login/page.tsx}` — storyboard viewer (reveal.js) + GitHub-backed editor (auth via `api/routes/auth.py`).
- `gui/app/docs/{page.tsx,layout.tsx,[slug]/page.tsx}` — docs viewer, uses `gui/lib/docs.ts` + `gui/components/docs/*`.
- `gui/app/{architecture,ceo,thales,cascade-test,ring-test,start}/page.tsx` — misc demo/presentation pages.
- `gui/components/PersonaShell.tsx` — main shell: persona/campaign state, polling (`POLL_INTERVAL_MS`), wires `ActionPanel`, `WorkflowPipeline`, `CampaignSidebar`, `ChatSidebar`, `ApprovalCascade`, `AIRevisionRouting`, modals. Reads `IS_STATIC_DEMO` directly for UI branching.
- `gui/components/ActionPanel.tsx` — step content router → `gui/components/steps/*Content.tsx` (one per workflow step).
- `gui/components/WorkflowPipeline.tsx` — 10-step progress bar; `CampaignSidebar.tsx` — campaign list/switcher.
- `gui/components/ApprovalCascade.tsx` / `ClouCascade.tsx` / `AIRevisionRouting.tsx` — Step 6 AI cascade animations.
- `gui/components/ChatSidebar.tsx` / `AICoworkerPanel.tsx` — chat UI, uses `gui/lib/scripted-chat.ts` + `gui/lib/ai_client.ts`.
- `gui/components/CompliancePreCheck.tsx`, `AIBriefCard.tsx`, `ResubmitPanel.tsx`, `RevisionPendingPanel.tsx`, `RevisionRequestModal.tsx`, `ResultsModal.tsx`, `CampaignEditModal.tsx`, `EvidenceSidePanel.tsx` — step-6/review supporting UI.
- `gui/components/{CardRing,CardRingDynamic,Carousel3D,HeroBanner,PlacementMockup,FloatingPersonaAvatar,TopBar,SkillCard,motion.tsx}` — presentational/3D (react-three-fiber) components.
- `gui/components/PersonaContext.tsx` — `usePersona`/`usePersonas` React context.
- `gui/lib/api.ts` — all typed fetch wrappers to the FastAPI backend; `request()` is the IS_STATIC_DEMO gate point; `callWithFallback`/`fetchWithFallback`/`getWithOutputFallback`/`requestWithFallback` are the 10s-timeout cached-JSON fallback family (independent of static-demo).
- `gui/lib/static-demo.ts` — `IS_STATIC_DEMO`, `resolveStatic()` (manifest-keyed lookup into `gui/public/static-demo/*.json`), `simulateLatency()`, `isAiPath()`. New file (untracked), added for the static-demo branch.
- `gui/lib/ai_client.ts` — client helpers for AI cascade calls (compliance/brief/route-revision/cascade), `RouteRevisionResult` type.
- `gui/lib/authorities.ts`, `docs.ts`, `evidence.ts`, `example-campaigns.ts`, `scripted-chat.ts` — static lookup tables / docs loader / scripted chat → skill action map (`ACTION_TO_SKILL`).
- `gui/public/static-demo/` — captured JSON fixtures + `manifest.json` keyed by `METHOD:path[:bodyHash]` (sanitised), consumed by `static-demo.ts`. New (untracked).
- `gui/public/{cached-outputs.json,cached-panels.json}` — fallback fixtures for the `*WithFallback` functions in `api.ts` (separate mechanism from static-demo).
- `gui/public/storyboard/{scenes/*.jpg,slides.json}` — storyboard content, editable via `/story-edit`.
- `scripts/llm_capture_requests.md` — new (untracked) runbook documenting exact prompts/manifest keys used to hand-generate the static-demo JSON fixtures for the Mother's Day Beauty demo path.

## Config surface
- Root `.env` (from `.env.example`): `TRITONAI_API_KEY`.
- `gui/.env.local` / `.env.production` (from `.env.local.example`): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_STATIC_DEMO`.
- `api/routes/slides_admin.py`: `GITHUB_PAT` (storyboard editor commits).
- `ai_engine/skill_invoker.py`: `MCP_PROTOCOL_PRICING` (toggles MCP-protocol vs direct-call for pricing tool).
- `render.yaml` — Render backend deploy config.
- `.runtime_state.json` (untracked, repo root) — persisted `api/state.py` snapshot across restarts.
- `.claude/settings.json` + `.claude/hooks/*.sh` — Claude Code hooks (ruff format/check, secret scan, usage logging, stale-test check).

## Boundaries
- `ai_engine/` is the authoritative AI package at runtime (`api/main.py` sys.path-inserts it); the root-level `rag/`, `skills/`, `automations/`, `mcp_servers/` and the entire `milestone04/` directory are earlier-milestone copies — do not assume edits there affect the live API.
- `gui/lib/static-demo.ts` fallback and `gui/lib/api.ts`'s `*WithFallback` cached-JSON fallback are two independent resilience layers (static-build-time demo vs runtime cold-start resilience) — both can apply to the same call; keep them composable, not mutually exclusive (see current merge-conflict resolution task).
- Skills (LLM judgment, `ai_engine/skills/`) vs Automations (deterministic, `ai_engine/automations/`) is a deliberate architectural line — do not move logic across it without updating README's workflow table.
- `secret.md`, `.env` must stay out of git (enforced by `.claude/hooks/secret-scan.sh` and `.gitignore`).
