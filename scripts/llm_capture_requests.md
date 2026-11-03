# LLM Capture Requests

These are the exact prompts the backend would send to Claude for the Merna / Mother's Day Beauty campaign demo path. Each section contains the full system prompt (SKILL.md), the full user payload (with real RAG chunks and tool results), the expected response schema, and the exact manifest key and filename.

**Model:** `claude-sonnet-4-6` for all prompts.
**Temperature:** 0.2
**Max tokens:** 2000

After generating each response, save it as the specified JSON file under `gui/public/static-demo/` and add the key-filename pair to `gui/public/static-demo/manifest.json`.

---

## 1. Compliance Pre-Check (`POST /api/ai/compliance`)

**Manifest key:** `POST___api_ai_compliance__b3b19a7bcb29`
**Save as:** `gui/public/static-demo/POST___api_ai_compliance__b3b19a7bcb29.json`

**Expected response schema (the entire file content must match this shape):**
```json
{
  "brand_alignment": { "status": "pass | warn | fail", "reason": "string", "cited_doc": "BRAND-GL-2026-001" },
  "disclaimers": { "status": "pass | warn | fail", "reason": "string", "cited_doc": "LEGAL-DIS-2026-002" },
  "pricing_cross_check": { "status": "pass | warn | fail", "reason": "string", "cited_doc": "PRICE-RULES-2026-001" },
  "recommended_action": "proceed | revise",
  "retrieved_docs": ["BRAND-GL-2026-001", "LEGAL-DIS-2026-002", "PRICE-RULES-2026-001", "COMP-EX-2026-001"]
}
```

**Important:** This is an agentic skill. In production, Claude calls `check_pricing_conflicts` mid-reasoning. For this capture, the tool result is provided in `tool_results`. Produce the FINAL JSON output as if you had already called the tool and analyzed the result. Return ONLY the JSON object — no tool calls, no reasoning text.

### System Prompt

```
---
agentic: true
---

# Compliance Pre Check

**Workflow step:** 6a, Compliance Pre Check before VP review
**Owner persona:** Merna (the skill runs automatically when she submits)
**Input from previous step:** campaign block from workflow state (campaign_id, title, copy, tagline, skus, discount_pct, regions, estimated_spend, audience_segment, campaign_manager)
**Output to next step:** compliance_check object written to workflow state
**RAG retrieval:** BRAND-GL-2026-001, LEGAL-DIS-2026-002, PRICE-RULES-2026-001, COMP-EX-2026-001
**MCP tools available:** check_pricing_conflicts (called agentically when you need to verify pricing claims)

## Agentic mode

This skill runs in agentic mode. You have access to MCP tools that you can call mid-reasoning when you need to verify data before issuing a finding. The RAG documents have already been retrieved and are provided in `retrieved_context`. You decide when and whether to call MCP tools.

**Available tools:**
- `check_pricing_conflicts(sku_ids, proposed_discount_pct)` — Validates SKUs against MAP enforced brand list and the 50% stacking ceiling per PRICE-RULES-2026-001. Call this when the campaign includes SKUs and a discount, and you need to verify whether any SKUs have pricing conflicts before writing the pricing_cross_check finding.
- `find_dam_assets(category, region)` — Look up DAM assets with active rights. Call this if you need to verify asset availability.

**When to call tools vs. when not to:**
- If the campaign has SKUs and a discount percentage, you SHOULD call check_pricing_conflicts to verify before writing the pricing_cross_check finding.
- If you can answer from the retrieved RAG documents alone (brand alignment, disclaimers), do not call a tool.
- If you are uncertain about a pricing claim, call the tool rather than guessing.

## When to use this skill

Run this skill the moment Merna submits a campaign for approval. It is the first stop in the chain. The purpose is to catch the avoidable rework that historically eats two to three days of approval time (see TICKET-INC-2025-4471 for a textbook example). If the campaign passes, the chain moves on to the VP approval brief. If it fails, Merna gets the campaign back with specific fixes before any VP is paged.

## Instructions

1. Read the campaign block from the current_state.
2. Use the retrieved_context to check brand alignment:
   - Check that no banned words appear in the campaign copy (reference BRAND-GL-2026-001).
   - Check that the tagline is on the approved tagline list.
3. Use the retrieved_context to check disclaimers:
   - Verify that any "up to X percent off" claim includes the required "starting at" minimum disclosure (reference LEGAL-DIS-2026-002).
4. For pricing cross-check:
   - If the campaign has SKUs and a discount, call the `check_pricing_conflicts` tool to verify MAP compliance.
   - Use the tool result to determine if any SKUs violate MAP rules.
   - Reference PRICE-RULES-2026-001 in your finding.
5. For each of the three findings (brand_alignment, disclaimers, pricing_cross_check), set status to pass, warn, or fail based on what you found.
6. Set `recommended_action` to "revise" if any finding has status "fail", otherwise "proceed".
7. Return the JSON output schema.

## Output format

CRITICAL: When you are done analyzing and have called any tools you need, your FINAL response must be ONLY a JSON object. No explanatory text before or after. No markdown code fences. Just the raw JSON object matching this schema:

{
  "brand_alignment": {
    "status": "pass | warn | fail",
    "reason": "string",
    "cited_doc": "BRAND-GL-2026-001"
  },
  "disclaimers": {
    "status": "pass | warn | fail",
    "reason": "string",
    "cited_doc": "LEGAL-DIS-2026-002"
  },
  "pricing_cross_check": {
    "status": "pass | warn | fail",
    "reason": "string",
    "cited_doc": "PRICE-RULES-2026-001"
  },
  "recommended_action": "proceed | revise",
  "retrieved_docs": ["BRAND-GL-2026-001", "LEGAL-DIS-2026-002", "PRICE-RULES-2026-001", "COMP-EX-2026-001"]
}


## Available MCP Tools

You have access to the following MCP tools. Call them when you need to verify data before making a finding. Do NOT guess — if you are uncertain about a pricing claim, call check_pricing_conflicts. If you need to verify asset availability, call find_dam_assets.

After your analysis is complete, respond with ONLY a JSON object matching the Output schema. No commentary, no markdown fences.
```

### User Payload

```json
{
  "current_state": {
    "campaign_id": "MDC-2026-MD-001",
    "status": "submitted_by_sarah",
    "campaign": {
      "campaign_id": "MDC-2026-MD-001",
      "title": "Mother's Day Beauty Event",
      "audience_segment": "Beauty Enthusiasts 25-54",
      "copy": "Celebrate Mom with the gift of beauty. Up to 25% off premium skincare, fragrance, and cosmetics.",
      "tagline": "Beauty She Deserves",
      "skus": ["1406", "782", "1058", "714", "358", "934"],
      "discount_pct": 25,
      "regions": ["NY", "CA", "FL", "TX"],
      "estimated_spend": 150000,
      "campaign_manager": "Merna"
    },
    "compliance_check": null,
    "approval_brief": null,
    "approval_decision": null,
    "revision_routing": null,
    "localized_variants": null,
    "activation_schedule": null
  },
  "retrieved_context": {
    "banned words and approved taglines": [
      {
        "doc_id": "FAQ-INT-2026-001",
        "section": "How do I add a new banned word to the brand guidelines?",
        "text": "How do I add a new banned word to the brand guidelines?\n\nSubmit a request to the Brand Marketing Council. Bring a specific example of the word in use, the rationale (legal risk, brand fit, customer feedback), and a proposed replacement. The Council reviews monthly.",
        "score": 0.569
      },
      {
        "doc_id": "BRAND-GL-2026-001",
        "section": "Approved Taglines",
        "text": "Approved Taglines\n\nThe following taglines are pre approved for use in any campaign without further sign off:\n\n* The Magic of Macys\n* Find Your Magic\n* Star Rewards, Every Day\n* New In Store, New Online\n\nAny tagline outside this list requires Brand Marketing Council review before it appears in production creative.",
        "score": 0.524
      },
      {
        "doc_id": "BRAND-GL-2026-001",
        "section": "Updates",
        "text": "Updates\n\nThis document is reviewed twice a year by the Brand Marketing Council. To request a change (a new tagline, a banned word addition, a color palette update), file a request through the Brand portal with a specific example and rationale. The Council meets the second Tuesday of each month.",
        "score": 0.500
      },
      {
        "doc_id": "BRAND-GL-2026-001",
        "section": "Banned Words and Phrases",
        "text": "Banned Words and Phrases\n\nThe following terms are not permitted in any Macys campaign creative. They conflict with brand positioning or have been flagged by Legal in prior reviews.\n\n* cheap\n* basic\n* last chance\n* clearance blowout\n* dirt cheap\n* unbeatable\n* lowest prices anywhere\n* nobody beats Macys\n\nIf a campaign requires urgency language, use \"ends Sunday\", \"limited time\", or \"while supplies last\" instead.",
        "score": 0.426
      }
    ],
    "required legal disclaimers for percent off pricing": [
      {
        "doc_id": "BRAND-GL-2026-001",
        "section": "Pricing Language",
        "text": "Pricing Language\n\nAll pricing claims must follow the standard format below. This format was negotiated with Legal in 2024 and is required for compliance with state consumer protection laws.\n\n* For range claims, write \"Up to 40 percent off\" never \"40% off\" alone.\n* For tiered claims, always include the minimum: \"Up to 40 percent off, starting at 10 percent off.\"\n* Never use \"free\" without specifying conditions in the same line of copy.\n* Never use \"save big\" or \"huge savings\" as the primary headline.",
        "score": 0.665
      },
      {
        "doc_id": "LEGAL-DIS-2026-002",
        "section": "Pricing Claims",
        "text": "Pricing Claims\n\n### Up To Claims\n\nAny \"up to X percent off\" claim must include the minimum discount available in the offer. Example: \"Up to 40 percent off, starting at 10 percent off.\"\n\nThis is required by Federal Trade Commission guidance on representative pricing claims.\n\n### Compare At Pricing\n\nFollowing the 2024 New York Attorney General settlement, any \"compare at\" or \"original price\" claim must reflect a price at which the item was offered for a meaningful period within the prior 90 days. If the comparison price was a manufacturer suggested retail price rather than a Macys offered price, the disclaimer must read:\n\n\"Compare at price reflects the manufacturer suggested retail price. Item may not have been sold at this price.\"",
        "score": 0.624
      },
      {
        "doc_id": "LEGAL-DIS-2026-002",
        "section": "Sizing of Disclaimers",
        "text": "Sizing of Disclaimers\n\nDisclaimers must be at least 8 point on print, 10 point on digital, and clearly legible against background. Disclaimers may not be hidden, faded, or placed off canvas. On video, disclaimers must remain on screen for at least 4 seconds and be paired with a stable background color where possible.",
        "score": 0.555
      },
      {
        "doc_id": "COMP-EX-2026-001",
        "section": "Examples",
        "text": "Examples\n\n### Example 1, banned word \"last chance\"\n\n* **Flagged copy**: \"Last chance on Spring Beauty, ends Sunday.\"\n* **Rule tripped**: BRAND-GL-2026-001, banned word list.\n* **Fix**: \"Spring Beauty, ends Sunday.\" (urgency carried by the date, not the phrase.)\n\n### Example 2, \"up to\" missing minimum\n\n* **Flagged copy**: \"Up to 50 percent off Home Refresh.\"\n* **Rule tripped**: BRAND-GL-2026-001 pricing language plus LEGAL-DIS-2026-002 FTC representative pricing.\n* **Fix**: \"Up to 50 percent off Home Refresh, starting at 20 percent off.\"\n\n### Example 3, compare at price without 90 day basis\n\n* **Flagged copy**: \"Compare at $129, now $59.\"\n* **Rule tripped**: LEGAL-DIS-2026-002, post 2024 NY AG settlement on compare at pricing.\n* **Fix**: Either confirm and document the prior 90 day offer at $129, or change to \"Manufacturer suggested retail price $129, our price $59\" with the corresponding disclaimer.\n\n### Example 4, \"save big\" headline\n\n* **Flagged copy**: \"Save big on Bedding this weekend.\"\n* **Rule tripped**: BRAND-GL-2026-001, pricing language (\"save big\" not allowed as a primary headline).\n* **Fix**: \"Bedding refresh, 30 percent off this weekend.\"\n\n### Example 5, financing offer without TILA language\n\n* **Flagged copy**: \"Zero percent financing for 12 months on purchases over $499.\"\n* **Rule tripped**: LEGAL-DIS-2026-002, Macys Credit Card Truth in Lending disclosure.\n* **Fix**: Same headline with the required disclaimer added in the same creative unit, including \"Subject to credit approval\" and the deferred interest language.\n\n### Example 6, influencer post missing disclosure\n\n* **Flagged copy**: Instagram post from partner influencer, \"Loving my new Macys finds for fall.\"\n* **Rule tripped**: LEGAL-DIS-2026-002, endorsement disclosure (FTC).\n* **Fix**: Same post with \"#MacysPartner\" and \"Paid partnership\" tag visible in the post itself, not buried in the caption.\n\n### Example 7, restricted asset reused\n\n* **Flagged copy**: A Holiday gift guide reused a Lancome influencer collaboration asset for a non Beauty placement.\n* **Rule tripped**: DAM-TAG-2025-005, restricted asset usage outside agreement.\n* **Fix**: Asset pulled, replaced with a Macys owned alternative. Asset reuse request routed through Creative Operations for future shoots.\n\n### Example 8, Spanish call to action missing accent\n\n* **Flagged copy**: \"Compra ya y ahorra mas.\"\n* **Rule tripped**: LOC-STYLE-2025-002, neutral Latin American Spanish, missing accent.\n* **Fix**: Same line corrected with the accented form of mas (the comparative adverb, accented). Two stage Spanish review now required per the Q4 2025 retro action item.\n\n### Example 9, MAP brand discounted\n\n* **Flagged copy**: \"Levi's, 25 percent off this weekend.\"\n* **Rule tripped**: PRICE-RULES-2026-001, Levi's is a MAP enforced brand.\n* **Fix**: Creative pulled before launch. Promotional language replaced with \"Shop Levi's, new arrivals.\" Pricing Strategy notified Merchandising.\n\n### Example 10, sweepstakes missing rules\n\n* **Flagged copy**: \"Enter to win a $500 Macys gift card, sign up for emails today.\"\n* **Rule tripped**: LEGAL-DIS-2026-002, sweepstakes required language (no purchase necessary, void where prohibited, odds, end date and time zone, full rules link).\n* **Fix**: Sweepstakes mechanic relaunched with full rules linked, all required language present, plus the bonded state filings handled by Legal.",
        "score": 0.517
      }
    ],
    "MAP minimum advertised price restrictions": [
      {
        "doc_id": "PRICE-RULES-2026-001",
        "section": "Brands Under Strict MAP",
        "text": "Brands Under Strict MAP\n\nThe following brands enforce minimum advertised price under their vendor agreements. Discounts on these brands require written Merchandising approval and are typically only available during vendor sponsored events.\n\n* Levi's\n* Coach (above $500 ticket)\n* Lancome\n* Estee Lauder\n* Clinique\n* La Mer\n* Dior Beauty\n* Tag Heuer\n\nA campaign that violates MAP can result in vendor charge backs and, in repeat cases, loss of the vendor account. This is the single most cited reason for emergency creative pulls.",
        "score": 0.602
      },
      {
        "doc_id": "PRICE-RULES-2026-001",
        "section": "Purpose",
        "text": "Purpose\n\nThis document defines how promotional discounts can be combined, what categories are excluded from promotions, and how vendor MAP rules apply.",
        "score": 0.462
      },
      {
        "doc_id": "FAQ-INT-2026-001",
        "section": "How do I find out if my brand is under MAP?",
        "text": "How do I find out if my brand is under MAP?\n\nCheck PRICE-RULES-2026-001 for the standing MAP list. Brands are added throughout the year so the standing list may be out of date. When in doubt, ask Merchandising before you write the promo headline.",
        "score": 0.443
      },
      {
        "doc_id": "BRAND-GL-2026-001",
        "section": "Pricing Language",
        "text": "Pricing Language\n\nAll pricing claims must follow the standard format below. This format was negotiated with Legal in 2024 and is required for compliance with state consumer protection laws.\n\n* For range claims, write \"Up to 40 percent off\" never \"40% off\" alone.\n* For tiered claims, always include the minimum: \"Up to 40 percent off, starting at 10 percent off.\"\n* Never use \"free\" without specifying conditions in the same line of copy.\n* Never use \"save big\" or \"huge savings\" as the primary headline.",
        "score": 0.412
      }
    ],
    "past compliance flag examples": [
      {
        "doc_id": "COMP-EX-2026-001",
        "section": "Purpose",
        "text": "Purpose\n\nThis document is a reference of real compliance flags raised on past Macys campaigns. Each example shows the flagged copy, the rule that was tripped, and the fix that landed in production. Use this when drafting new creative to anticipate where reviews tend to push back.",
        "score": 0.604
      },
      {
        "doc_id": "COMP-EX-2026-001",
        "section": "Examples",
        "text": "Examples\n\n### Example 1, banned word \"last chance\"\n\n* **Flagged copy**: \"Last chance on Spring Beauty, ends Sunday.\"\n* **Rule tripped**: BRAND-GL-2026-001, banned word list.\n* **Fix**: \"Spring Beauty, ends Sunday.\" (urgency carried by the date, not the phrase.)\n\n### Example 2, \"up to\" missing minimum\n\n* **Flagged copy**: \"Up to 50 percent off Home Refresh.\"\n* **Rule tripped**: BRAND-GL-2026-001 pricing language plus LEGAL-DIS-2026-002 FTC representative pricing.\n* **Fix**: \"Up to 50 percent off Home Refresh, starting at 20 percent off.\"",
        "score": 0.356
      },
      {
        "doc_id": "DAM-TAG-2025-005",
        "section": "Asset Flagging Process",
        "text": "Asset Flagging Process\n\nIf a user finds a degraded, low resolution, or unusable asset in the DAM, the user files a flag through the DAM portal. The flag captures:\n\n* Asset ID\n* Issue type (resolution, color, retouch, rights, other)\n* Free text description\n* Urgency (standard, high)\n\nCreative Operations triages flags daily. Standard flags resolve within 5 business days. High urgency flags resolve within 1 business day.",
        "score": 0.305
      }
    ]
  },
  "tool_results": {
    "check_pricing_conflicts": {
      "status": "pass",
      "conflicts": [],
      "checked_count": 6
    }
  },
  "instruction": "Execute this skill. You have already called check_pricing_conflicts and the result is in tool_results — 6 SKUs checked, zero conflicts, status pass. Use the retrieved_context and tool_results to inform your decisions. Return ONLY a JSON object that matches the Output schema in the SKILL.md. No commentary, no markdown fences."
}
```

---

## 2. Approval Brief Generator (`POST /api/ai/brief`)

**Manifest key:** `POST___api_ai_brief__8f69878cedfe`
**Save as:** `gui/public/static-demo/POST___api_ai_brief__8f69878cedfe.json`

**Expected response schema:**
```json
{
  "campaign_goal": "string, one sentence",
  "target_audience": "string, one sentence",
  "expected_roi": "string, one sentence with benchmarked range",
  "risk_flags": ["string"],
  "ai_recommendation": "approve | revise | reject, with a one sentence rationale",
  "retrieved_docs": ["RETRO-SP-2025-BTY"]
}
```

**Important:** Before running this prompt, paste the compliance result you generated in Section 1 into the `compliance_check` field below (replacing the placeholder). The brief generator reads the compliance check to decide its recommendation.

### System Prompt

```
---
agentic: true
---

# Approval Brief Generator

**Workflow step:** 6b, generate the VP approval brief
**Owner persona:** VP (the skill runs automatically when the VP opens the approval modal)
**Input from previous step:** campaign block plus compliance_check from workflow state
**Output to next step:** approval_brief object written to workflow state
**RAG retrieval:** past campaign retros for ROI benchmarks (RETRO-SP-2025-BTY, RETRO-Q4-2025)

## Agentic mode

This skill runs in agentic mode. You have access to MCP tools that you can call mid-reasoning if you need to verify data. The RAG documents (campaign retros with ROI benchmarks) have already been retrieved and are in `retrieved_context`. You decide when and whether to call MCP tools.

**Available tools:**
- `check_pricing_conflicts(sku_ids, proposed_discount_pct)` — Validates SKUs against MAP enforced brand list. Call this if the compliance_check flagged pricing issues and you want to double-check the SKU list before writing risk_flags.
- `find_dam_assets(category, region)` — Look up DAM assets with active rights. Rarely needed for brief generation, but available if you need to verify asset readiness for a risk flag.

**When to call tools vs. when not to:**
- If compliance_check already has a pricing_cross_check finding with status "warn" or "fail", you MAY call check_pricing_conflicts to get the latest data for the risk_flags section.
- For most briefs, the retrieved retros and compliance_check are sufficient. Do not call tools unless verification adds value.

## When to use this skill

Run this skill the moment the VP opens the approval modal for a campaign that has passed compliance pre check. The goal is to give the VP a short brief (five fields) so the decision can happen in a minute rather than ten. The brief does not replace the underlying campaign document. It surfaces what the VP needs to decide.

## Instructions

1. Read the campaign block and compliance_check from the current_state.
2. Use the retrieved_context (campaign retros) to extract ROI benchmarks for the campaign's category and audience segment.
3. If the compliance_check has pricing warnings and you need to verify the current state of SKU conflicts, call check_pricing_conflicts.
4. Write the five fields of the brief:
   * `campaign_goal`: one sentence summary of the campaign purpose
   * `target_audience`: one sentence describing the segment
   * `expected_roi`: one sentence with benchmark numbers from the retrieved retros
   * `risk_flags`: list of compliance warnings from compliance_check plus any business risks you identify
   * `ai_recommendation`: approve, revise, or reject with a one sentence rationale. Rule: any "fail" in compliance_check triggers "revise"; all pass produces "approve"; warn keeps "approve" but the warning belongs in risk_flags.
5. Return the JSON output schema.

The numeric benchmarks come from the retrieved retros. Do not invent or estimate numbers.

## Output format

CRITICAL: When you are done analyzing, your FINAL response must be ONLY a JSON object. No explanatory text before or after. No markdown code fences. Just the raw JSON object:

{
  "campaign_goal": "string, one sentence",
  "target_audience": "string, one sentence",
  "expected_roi": "string, one sentence with benchmarked range",
  "risk_flags": ["string"],
  "ai_recommendation": "approve | revise | reject, with a one sentence rationale",
  "retrieved_docs": ["RETRO-SP-2025-BTY"]
}


## Available MCP Tools

You have access to the following MCP tools. Call them when you need to verify data before making a finding. After your analysis is complete, respond with ONLY a JSON object matching the Output schema. No commentary, no markdown fences.
```

### User Payload

```json
{
  "current_state": {
    "campaign_id": "MDC-2026-MD-001",
    "status": "compliance_check_complete",
    "campaign": {
      "campaign_id": "MDC-2026-MD-001",
      "title": "Mother's Day Beauty Event",
      "audience_segment": "Beauty Enthusiasts 25-54",
      "copy": "Celebrate Mom with the gift of beauty. Up to 25% off premium skincare, fragrance, and cosmetics.",
      "tagline": "Beauty She Deserves",
      "skus": ["1406", "782", "1058", "714", "358", "934"],
      "discount_pct": 25,
      "regions": ["NY", "CA", "FL", "TX"],
      "estimated_spend": 150000,
      "campaign_manager": "Merna"
    },
    "compliance_check": "<<< PASTE YOUR COMPLIANCE RESULT FROM SECTION 1 HERE >>>",
    "approval_brief": null,
    "approval_decision": null,
    "revision_routing": null,
    "localized_variants": null,
    "activation_schedule": null
  },
  "retrieved_context": {
    "Beauty Enthusiasts 25-54 campaign retro performance benchmarks": [
      {
        "doc_id": "RETRO-SP-2025-BTY",
        "section": "Performance",
        "text": "Performance\n\n* Total campaign revenue: $42.1M (plan was $39.3M)\n* Email open rate: 32 percent (segment average 26 percent)\n* Paid social ROAS: 4.2 (target was 3.5)\n* In store conversion: 18 percent uplift in Beauty department over comparable weeks in 2024\n\nThe Beauty Discovery segment (customers who had browsed but not purchased Beauty in the prior 90 days) was the standout. Conversion ran 2.1x the segment baseline. The team credits the sampling offer (free 3 product sample box with $50 purchase) as the primary driver.",
        "score": 0.555
      },
      {
        "doc_id": "RETRO-Q4-2025",
        "section": "Wins",
        "text": "Wins\n\n### Beauty Loyalists Segment Outperformed\n\nThe Beauty Loyalists segment (customers who purchased prestige Beauty in the prior 12 months and held an active Star Rewards account) outperformed plan by 23 percent. Email open rate hit 41 percent (versus a 28 percent target) and conversion ran 1.6x the segment average. The team attributes this to the early November teaser series, which front loaded gift sets before the broader Holiday push and avoided the late November inbox crush.\n\n### Cross Channel Consistency\n\nHoliday creative held a consistent look across email, paid social, site, and out of home. The Brand audit scored the campaign at 4.6 out of 5, the highest score for any Holiday in three years.\n\n### Star Rewards Multiplier Drove Repeat\n\nThe 5x Star Rewards weekend (December 6 through 8) drove a 34 percent lift in repeat purchase rate among existing members. Legal pre cleared the disclaimer two weeks ahead, which avoided the late approval risk seen in prior years.",
        "score": 0.509
      },
      {
        "doc_id": "RETRO-SP-2025-BTY",
        "section": "Segment Learnings",
        "text": "Segment Learnings\n\n### Beauty Loyalists\n\nAlready engaged. The Spring campaign confirmed that Beauty Loyalists respond best to product depth (full ingredient stories, founder content, ritual videos) rather than discount messaging. The 5 minute founder video for the new La Mer launch drove the highest watch through rate of any video in the campaign at 58 percent.\n\n### Beauty Discovery\n\nResponsive to sampling and education. Free samples plus a \"how to start\" guide outperformed pure discount creative by a wide margin. Merna noted that the educational module on the landing page (which explained how to layer products) drove a 12 percent lift in average order value among Discovery segment buyers.\n\n### Beauty Lapsed\n\nDid not move. Lapsed Beauty customers (no purchase in 12 months) returned at roughly the baseline rate despite a dedicated reactivation email series. The team flagged that the offer (10 percent off) may not be enough to reactivate in a category where competitors are aggressive on discount.",
        "score": 0.501
      },
      {
        "doc_id": "RETRO-SP-2025-BTY",
        "section": "Summary",
        "text": "Summary\n\nThe Spring 2025 Beauty launch ran March 3 through April 15, anchored by the \"Find Your Glow\" creative platform. Merna led the campaign with support from the Beauty Merchandising team. Revenue came in 7 percent ahead of plan, driven primarily by skincare and fragrance gift sets. Below are the key learnings.",
        "score": 0.480
      }
    ]
  },
  "instruction": "Execute this skill according to the SKILL.md instructions. Use the retrieved_context and compliance_check to inform your decisions. Return ONLY a JSON object that matches the Output schema. No commentary, no markdown fences."
}
```

---

## 3. Revision Router (`POST /api/ai/route-revision`)

**Manifest key:** `POST___api_ai_route-revision__c4fdb21b1171`
**Save as:** `gui/public/static-demo/POST___api_ai_route-revision__c4fdb21b1171.json`

**Expected response schema:**
```json
{
  "change_type": "copy | imagery | targeting | pricing | legal | localization",
  "owner": "string",
  "one_line_summary": "string",
  "urgency": "low | medium | high"
}
```

### System Prompt

```
# Revision Router

**Workflow step:** 6c, parse and route VP revision requests
**Owner persona:** VP (the skill runs automatically when the VP clicks revise)
**Input from previous step:** revision_comment string plus campaign context from workflow_state.json
**Output to next step:** revision_routing object written to workflow_state.json
**RAG retrieval:** minimal. Past similar revision tickets. Typical hits: TICKET-INC-2025-4471, TICKET-INC-2026-0212
**MCP tools called:** none

## When to use this skill

Run this skill when the VP clicks revise on the approval brief. The skill reads the free text revision comment, classifies what the VP is actually asking for, and produces a routing decision that lands on a named owner with an urgency level. The VP does not have to pick a routing target by hand.

## Personas

You MUST pick from these personas only. Do NOT invent new names or reference anyone not on this list:

- **Merna** (Campaign Manager): owns copy, targeting, and general campaign decisions
- **Abdullah** (Senior Designer): owns imagery, creative production, and visual assets
- **Shankar** (Localization Manager): owns localization, translations, and regional adaptations
- **Anna** (Marketing Analyst): owns pricing, merchandising coordination, and performance data

For legal issues, route to "Legal team" (not a persona, an external team).

## Instructions

1. Load `revision_comment` and the campaign block from data/workflow_state.json.
2. Classify the change type. The LLM reads the revision comment and picks one of: `copy`, `imagery`, `targeting`, `pricing`, `legal`, `localization`. This is a text understanding step, the LLM does it directly.
3. Call `helpers.lookup_owner(change_type)` to get the named owner. The mapping is deterministic, see the table below.
4. Call `helpers.assess_urgency(campaign)` to compute urgency. The helper applies the rule: spend over $500K plus launch within 5 business days returns `high`, either of those conditions alone returns `medium`, otherwise `low`.
5. The LLM writes a `one_line_summary` of the revision request, in clear plain language so the owner can act without re-reading the original comment.
6. Call `helpers.assemble_routing(...)` to package change_type, owner, urgency, one_line_summary, similar_past_tickets, and retrieved_docs.
7. Write the routing object to workflow_state.json under `revision_routing`.
8. Update `status` to `revision_requested`.

## Owner mapping

| change_type | Owner |
|-------------|-------|
| copy | Merna (campaign manager) |
| imagery | Abdullah (senior designer) |
| targeting | Merna (campaign manager) |
| pricing | Merchandising (Anna) |
| legal | Legal team |
| localization | Shankar (localization manager) |

## Output schema

Return ONLY a JSON object. No commentary, no markdown fences.

{
  "change_type": "copy | imagery | targeting | pricing | legal | localization",
  "owner": "string, named person from the personas list above",
  "urgency": "low | medium | high",
  "one_line_summary": "string"
}

## Worked example

Input `revision_comment`: "The up to 40 percent off line in the hero needs the starting at minimum, and confirm Lancome is cleared with Merch."

Classification: the VP is asking about pricing language and a MAP brand clearance. `change_type` is `pricing`.

`helpers.lookup_owner("pricing")` returns `"Merchandising (Anna)"`.

`helpers.assess_urgency(campaign)` reads `estimated_spend = 350000` and `business_days_to_launch = 6`. Neither condition fires high. Spend is under $500K and timeline is over 5 days. Result: `low`.

Output routing:

{
  "change_type": "pricing",
  "owner": "Merchandising (Anna)",
  "urgency": "low",
  "one_line_summary": "Add starting at minimum to the up to 40 percent off claim and confirm Lancome MAP clearance with Merchandising."
}
```

### User Payload

```json
{
  "current_state": {
    "campaign_id": "MDC-2026-MD-001",
    "status": "in_vp_review",
    "campaign": {
      "campaign_id": "MDC-2026-MD-001",
      "title": "Mother's Day Beauty Event",
      "audience_segment": "Beauty Enthusiasts 25-54",
      "copy": "Celebrate Mom with the gift of beauty. Up to 25% off premium skincare, fragrance, and cosmetics.",
      "tagline": "Beauty She Deserves",
      "skus": ["1406", "782", "1058", "714", "358", "934"],
      "discount_pct": 25,
      "regions": ["NY", "CA", "FL", "TX"],
      "estimated_spend": 150000,
      "campaign_manager": "Merna"
    },
    "approval_decision": "revise",
    "revision_comment": "The copy says 'Up to 25% off' but doesn't mention the starting minimum. Add the 'starting at' disclosure per our pricing language rules. Also, confirm with Merch that none of these Beauty SKUs are under MAP restrictions before we go live."
  },
  "retrieved_context": {},
  "tool_results": {},
  "instruction": "Execute this skill according to the SKILL.md instructions. The campaign estimated_spend is $150,000 (under $500K) and launch is 12 days out (over 5 business days), so urgency should be 'low'. Return ONLY a JSON object that matches the Output schema. No commentary, no markdown fences."
}
```

---

## 4. Layout Copy Generator (`POST /skills/generate-layout-copy`)

**Manifest key:** `POST___skills_generate-layout-copy__3213b9810eab`
**Save as:** `gui/public/static-demo/POST___skills_generate-layout-copy__3213b9810eab.json`

**This file already exists with a deterministic fallback. Overwrite it with the real LLM output.**

**Expected response schema (the entire file content must match this shape):**
```json
{
  "ok": true,
  "placements": {
    "web_banner": { "tagline": "string", "body": "string", "cta": "string", "visual_direction": "string" },
    "email": { "tagline": "string", "body": "string", "cta": "string", "visual_direction": "string" },
    "mobile": { "tagline": "string", "body": "string", "cta": "string", "visual_direction": "string" },
    "in_store_signage": { "tagline": "string", "body": "string", "cta": "string", "visual_direction": "string" }
  },
  "validation_errors": [],
  "generation_metadata": {
    "skill": "layout-copy-generator",
    "method": "claude_via_skill_invoker",
    "duration_ms": 3500
  }
}
```

**Note:** The outer wrapper (`ok`, `placements`, `validation_errors`, `generation_metadata`) is added by the API route. Claude only generates the inner placements object. Wrap Claude's output in the outer structure before saving.

### System Prompt

```
# Layout Copy Generator

**Workflow step:** 5, Layout Assembly
**Owner persona:** Abdullah (senior designer reviews, Merna approves)
**Input from previous steps:** campaign brief, selected segment (step 2), approved SKUs (step 3), DAM assets (step 4)
**Output to next step:** layout_copy object with 4 placements, each containing tagline, body, cta, visual_direction

## When to use this skill

Run this skill when the campaign reaches Step 5 and the designer needs marketing copy for each ad placement. The skill generates copy that matches the campaign brief, audience tone, and placement constraints. The designer reviews the copy alongside the selected DAM assets and layout specs, then approves or requests edits.

## Why this is a skill (not an automation)

Writing marketing copy that fits brand voice, character limits, and audience tone requires LLM judgment. The same brief could yield different (equally valid) taglines and body copy. There are no deterministic rules that produce good ad copy.

## Instructions

1. Read the campaign context: brief (name, category, objective, target_customer, promotional_offer), selected segment, approved SKUs, and DAM assets.
2. For each of 4 placements (web_banner, email, mobile, in_store_signage), generate:
   - **tagline**: 5 to 10 words, punchy, captures the campaign theme
   - **body**: 10 to 25 words, expands on the tagline with the key offer
   - **cta**: 2 to 5 words, action oriented (e.g., "Shop the edit", "Get yours now")
   - **visual_direction**: 1 sentence suggesting what the designer should emphasize visually

3. Tone guidelines:
   - Match the audience segment: luxury audience = elegant and aspirational, broad audience = warm and inviting
   - Mother's Day campaigns: warmth, gratitude, gift language
   - Spring/summer campaigns: freshness, color, renewal
   - Always sound like Macy's: approachable department store, not too clinical, not too casual

4. Character limits per placement:
   - web_banner: tagline max 50 chars, body max 100 chars, cta max 25 chars
   - email: tagline max 60 chars, body max 200 chars, cta max 25 chars
   - mobile: tagline max 40 chars, body max 80 chars, cta max 20 chars
   - in_store_signage: tagline max 40 chars, body max 60 chars, cta max 20 chars

5. Return ONLY a JSON object matching the output schema. No commentary.

## Output schema

{
  "web_banner": {
    "tagline": "string",
    "body": "string",
    "cta": "string",
    "visual_direction": "string"
  },
  "email": {
    "tagline": "string",
    "body": "string",
    "cta": "string",
    "visual_direction": "string"
  },
  "mobile": {
    "tagline": "string",
    "body": "string",
    "cta": "string",
    "visual_direction": "string"
  },
  "in_store_signage": {
    "tagline": "string",
    "body": "string",
    "cta": "string",
    "visual_direction": "string"
  }
}
```

### User Payload

```json
{
  "current_state": {
    "campaign": {
      "title": "Mother's Day Beauty Event",
      "copy": "Drive Beauty category revenue +20% vs last year. Win back lapsed Beauty buyers.",
      "category": "Beauty",
      "audience_segment": "Women 28-55, Star Rewards members, prior Beauty purchasers",
      "promotional_offer": [
        "25% off all Beauty",
        "Free gift with $75+ purchase",
        "Free shipping on Beauty $50+"
      ]
    },
    "status": "submitted"
  },
  "retrieved_context": {
    "brand voice guidelines and approved taglines for campaign copy": [
      {
        "doc_id": "BRAND-GL-2026-001",
        "section": "Updates",
        "text": "Updates\n\nThis document is reviewed twice a year by the Brand Marketing Council. To request a change (a new tagline, a banned word addition, a color palette update), file a request through the Brand portal with a specific example and rationale. The Council meets the second Tuesday of each month.",
        "score": 0.513
      },
      {
        "doc_id": "BRAND-GL-2026-001",
        "section": "Approved Taglines",
        "text": "Approved Taglines\n\nThe following taglines are pre approved for use in any campaign without further sign off:\n\n* The Magic of Macys\n* Find Your Magic\n* Star Rewards, Every Day\n* New In Store, New Online\n\nAny tagline outside this list requires Brand Marketing Council review before it appears in production creative.",
        "score": 0.504
      },
      {
        "doc_id": "FAQ-INT-2026-001",
        "section": "What if Legal pre cleared my copy but Brand later flagged it?",
        "text": "What if Legal pre cleared my copy but Brand later flagged it?\n\nLegal sign off does not satisfy Brand sign off. Brand can flag a Legal cleared piece for voice, visual, or tagline issues. Both must approve. If you hit a conflict between Legal and Brand recommendations, escalate to the VP of Marketing for the call.",
        "score": 0.479
      },
      {
        "doc_id": "APPRV-POL-2025-003",
        "section": "Standard Approval Tiers",
        "text": "Standard Approval Tiers\n\nEvery campaign moves through the following baseline reviewers in order:\n\n1. Marketing Manager (the campaign owner submits)\n2. Brand Review (voice, visual, tagline compliance)\n3. Channel Lead (email, paid social, site, print as applicable)\n4. Marketing Director sign off\n\nA campaign cannot move to production until all four baseline tiers have signed off.",
        "score": 0.474
      }
    ]
  },
  "tool_results": {},
  "instruction": "Execute this skill according to the SKILL.md instructions. This is a Mother's Day Beauty campaign for Women 28-55 who are Star Rewards members. The tone should be warm, grateful, gift-oriented. Use the retrieved_context for brand voice reference. Return ONLY a JSON object matching the output schema. No commentary, no markdown fences."
}
```

### How to save

Claude returns the inner placements object. Wrap it in the API route's outer structure:

```json
{
  "ok": true,
  "placements": { ... Claude's output ... },
  "validation_errors": [],
  "generation_metadata": {
    "skill": "layout-copy-generator",
    "method": "claude_via_skill_invoker",
    "duration_ms": 3500
  }
}
```

Save to `gui/public/static-demo/POST___skills_generate-layout-copy__3213b9810eab.json` (overwrites the fallback version).

---

## 5. Report Generator (`POST /skills/generate-report`)

**Manifest key:** `POST___skills_generate-report__7ee84d182093`
**Save as:** `gui/public/static-demo/POST___skills_generate-report__7ee84d182093.json`

**This file already exists with a deterministic fallback. Overwrite it with the real LLM output.**

**Expected response schema (the entire file content must match this shape):**
```json
{
  "ok": true,
  "report": {
    "executive_summary": "string — 4-6 paragraphs of markdown prose",
    "key_metrics": {
      "segment_targeted": "string",
      "skus_selected": 0,
      "compliance_status": "string",
      "approval_recommendation": "string",
      "locale_variants": 0
    },
    "recommendations": ["string"],
    "risks_and_concerns": ["string"],
    "retrieved_docs": ["string"]
  },
  "generation_metadata": {
    "skill": "report-generator",
    "method": "claude_via_skill_invoker",
    "duration_ms": 4200
  }
}
```

**Note:** The outer wrapper (`ok`, `report`, `generation_metadata`) is added by the API route. Claude only generates the inner report object. Wrap Claude's output in the outer structure before saving.

### System Prompt

```
# Report Generator

**Workflow step:** 10, Reporting
**Owner persona:** Marketing Analyst (Anna reviews and finalizes the report)
**Input from previous step:** all step outputs from Steps 1-9 plus the campaign brief and audit log
**Output to next step:** executive_report object with summary, metrics, recommendations
**RAG retrieval:** campaign retro benchmarks for context

## When to use this skill

Run this skill when the campaign has completed Steps 1-9 and the team needs an executive summary for leadership. The report draws from the full audit trail — every decision, approval, edit, rejection, and escalation across the 10-step workflow.

## Instructions

1. Read the current_state which contains all step_outputs from Steps 1-9.
2. Use the retrieved_context (campaign retros) for benchmarking context.
3. Write a 4-6 paragraph executive summary covering:
   - Campaign overview (name, category, target segment, budget)
   - Key decisions made (segment selected, SKUs locked, compliance findings, approval outcome)
   - Performance metrics if available from Step 9
   - Recommendations for next campaign cycle
   - Risks or concerns identified during the workflow
4. Extract key metrics into a structured object.
5. List actionable recommendations and any risks.

Write in a professional, concise C-suite style. Reference specific data from the step outputs, not generic statements. Every claim should trace back to an actual step output.

## Output format

CRITICAL: Return ONLY a JSON object. No explanatory text before or after. No markdown code fences.

{
  "executive_summary": "string — 4-6 paragraphs of markdown prose",
  "key_metrics": {
    "segment_targeted": "string",
    "skus_selected": 0,
    "compliance_status": "string",
    "approval_recommendation": "string",
    "locale_variants": 0
  },
  "recommendations": ["string"],
  "risks_and_concerns": ["string"],
  "retrieved_docs": ["string"]
}
```

### User Payload

```json
{
  "current_state": {
    "campaign": {
      "campaign_id": "MDC-2026-MD-001",
      "title": "Mother's Day Beauty Event",
      "category": "Beauty",
      "audience_segment": "Beauty Enthusiasts 25-54",
      "copy": "Celebrate Mom with the gift of beauty. Up to 25% off premium skincare, fragrance, and cosmetics.",
      "tagline": "Beauty She Deserves",
      "skus": ["1406", "782", "1058", "714", "358", "934"],
      "discount_pct": 25,
      "regions": ["NY", "CA", "FL", "TX"],
      "estimated_spend": 150000,
      "campaign_manager": "Merna"
    },
    "step_outputs": {
      "step_1_briefing": {
        "name": "Mother's Day Beauty Event",
        "objective": "Drive Beauty category revenue +20% vs last year. Win back lapsed Beauty buyers and acquire first-time Beauty customers from existing Macy's loyalists.",
        "target_customer": "Women 28 to 55, Star Rewards members, with prior Beauty purchases",
        "budget_total": "$1.8M"
      },
      "step_2_segmentation": {
        "segments_identified": 3,
        "primary_segment": "Beauty Enthusiasts 25-54",
        "total_clustered": 45000
      },
      "step_3_sku_selection": {
        "skus_recommended": 18,
        "skus_locked": 6,
        "category": "Beauty",
        "pricing_check": "pass, 0 MAP conflicts"
      },
      "step_4_creative_production": {
        "dam_assets_found": 12,
        "assets_selected": 5,
        "regions_covered": ["NY", "CA", "FL", "TX"]
      },
      "step_5_layout_assembly": {
        "placements_generated": 4,
        "placements": ["web_banner", "email", "mobile", "in_store_signage"]
      },
      "step_6_compliance_and_approval": {
        "compliance_status": "all pass",
        "approval_recommendation": "approve",
        "risk_flags_count": 2
      },
      "step_7_localization": {
        "locale_variants": 4,
        "regions": ["NY", "CA", "FL", "TX"],
        "languages": ["en", "es"]
      },
      "step_8_activation": {
        "channels_scheduled": ["email", "paid_social", "display", "in_store"],
        "launch_date": "2026-05-01"
      },
      "step_9_performance": {
        "campaign_revenue": "$4.8M",
        "roas": "3.8x",
        "email_open_rate": "28%",
        "new_beauty_customers": 5200
      }
    },
    "audit_log": [
      {"step": 1, "action": "submitted", "persona": "campaign-manager"},
      {"step": 2, "action": "segment_selected", "persona": "campaign-manager"},
      {"step": 3, "action": "skus_locked", "persona": "campaign-manager"},
      {"step": 4, "action": "assets_selected", "persona": "senior-designer"},
      {"step": 5, "action": "layout_approved", "persona": "senior-designer"},
      {"step": 6, "action": "compliance_passed", "persona": "system"},
      {"step": 6, "action": "vp_approved", "persona": "vp"},
      {"step": 7, "action": "localization_complete", "persona": "localization-manager"},
      {"step": 8, "action": "activation_scheduled", "persona": "campaign-manager"},
      {"step": 9, "action": "performance_reviewed", "persona": "marketing-analyst"}
    ],
    "status": "submitted"
  },
  "retrieved_context": {
    "campaign retro performance benchmarks": [
      {
        "doc_id": "FAQ-INT-2026-001",
        "section": "Who owns the post launch retro?",
        "text": "Who owns the post launch retro?\n\nThe campaign manager owns scheduling and notes. Marketing Operations owns the retro template, action item tracking, and the closeout. Retros are due within 4 weeks of campaign close.",
        "score": 0.382
      },
      {
        "doc_id": "TICKET-INC-2025-4471",
        "section": "Lessons",
        "text": "Lessons\n\nThe two revision cycles cost roughly three production days. Both were preventable. The \"big savings\" headline could have been caught at Brand review with a stronger initial revision rather than a comment plus approval. The comparative claim could have been caught at kickoff if Legal had been pre cleared on methodology. Both feed the retro action items.",
        "score": 0.356
      },
      {
        "doc_id": "RETRO-SP-2025-BTY",
        "section": "Performance",
        "text": "Performance\n\n* Total campaign revenue: $42.1M (plan was $39.3M)\n* Email open rate: 32 percent (segment average 26 percent)\n* Paid social ROAS: 4.2 (target was 3.5)\n* In store conversion: 18 percent uplift in Beauty department over comparable weeks in 2024\n\nThe Beauty Discovery segment (customers who had browsed but not purchased Beauty in the prior 90 days) was the standout. Conversion ran 2.1x the segment baseline. The team credits the sampling offer (free 3 product sample box with $50 purchase) as the primary driver.",
        "score": 0.348
      },
      {
        "doc_id": "TICKET-INC-2025-4471",
        "section": "Ticket Summary",
        "text": "Ticket Summary\n\n* **Campaign**: Memorial Day Home Category Push\n* **Submitted by**: Merna\n* **Submission date**: May 19, 2025 at 09:14 ET\n* **Final approval**: May 23, 2025 at 17:42 ET (day 5)\n* **Spend tier**: High ($612,000)\n* **Special triggers**: VP plus Legal (over $500K threshold)",
        "score": 0.335
      }
    ]
  },
  "tool_results": {},
  "instruction": "Execute this skill according to the SKILL.md instructions. The campaign completed all 10 steps successfully. Revenue was $4.8M (above $4.2M target), ROAS was 3.8x (above 3.5x goal), and 5,200 new Beauty customers were acquired (above the 5,000 target). Use the retrieved_context for benchmarking against past campaigns. Write a real executive summary, not a placeholder. Return ONLY a JSON object matching the output schema. No commentary, no markdown fences."
}
```

### How to save

Claude returns the inner report object. Wrap it in the API route's outer structure:

```json
{
  "ok": true,
  "report": { ... Claude's output ... },
  "generation_metadata": {
    "skill": "report-generator",
    "method": "claude_via_skill_invoker",
    "duration_ms": 4200
  }
}
```

Save to `gui/public/static-demo/POST___skills_generate-report__7ee84d182093.json` (overwrites the fallback version).

---

## 6. AI Chat (`POST /api/ai/chat`)

Three representative chat messages for the demo. Each requires a separate Claude call.

**Expected response schema for each (the entire file content must match this shape):**
```json
{
  "response": "string — Claude's natural language answer",
  "retrieved_docs": ["string — doc IDs cited"]
}
```

The system prompt is the same for all three. The user message and RAG context differ.

### Shared System Prompt

```
You are an AI marketing coworker at Macys. You help campaign managers, VPs, and designers reason about campaigns. You have access to internal Macys policy documents and past campaign data through retrieval. Cite document IDs (like BRAND-GL-2026-001) when you reference internal policy. Keep responses concise, helpful, and grounded in the provided context and retrieved documents. Do not invent information.
```

---

### Chat 1: "What does the compliance check look for?"

**Manifest key:** `POST___api_ai_chat__befcc6ea47c1`
**Save as:** `gui/public/static-demo/POST___api_ai_chat__befcc6ea47c1.json`

**User message (send as the user turn after the system prompt):**

```
Question: What does the compliance check look for?

Current campaign context:
{
  "campaign_id": "MDC-2026-MD-001",
  "title": "Mother's Day Beauty Event",
  "audience_segment": "Beauty Enthusiasts 25-54",
  "copy": "Celebrate Mom with the gift of beauty. Up to 25% off premium skincare, fragrance, and cosmetics.",
  "tagline": "Beauty She Deserves",
  "skus": ["1406", "782", "1058", "714", "358", "934"],
  "discount_pct": 25,
  "regions": ["NY", "CA", "FL", "TX"],
  "estimated_spend": 150000,
  "campaign_manager": "Merna"
}

Relevant internal documents:
[BRAND-GL-2026-001] Banned Words and Phrases

The following terms are not permitted in any Macys campaign creative. They conflict with brand positioning or have been flagged by Legal in prior reviews.

* cheap
* basic
* last chance
* clearance blowout
* dirt cheap
* unbeatable
* lowest prices anywhere
* nobody beats Macys

If a campaign requires urgency language, use "ends Sunday", "limited time", or "while supplies last" instead.

[BRAND-GL-2026-001] Approved Taglines

The following taglines are pre approved for use in any campaign without further sign off:

* The Magic of Macys
* Find Your Magic
* Star Rewards, Every Day
* New In Store, New Online

Any tagline outside this list requires Brand Marketing Council review before it appears in production creative.

[LEGAL-DIS-2026-002] Pricing Claims

### Up To Claims

Any "up to X percent off" claim must include the minimum discount available in the offer. Example: "Up to 40 percent off, starting at 10 percent off."

This is required by Federal Trade Commission guidance on representative pricing claims.

### Compare At Pricing

Following the 2024 New York Attorney General settlement, any "compare at" or "original price" claim must reflect a price at which the item was offered for a meaningful period within the prior 90 days.

[PRICE-RULES-2026-001] Brands Under Strict MAP

The following brands enforce minimum advertised price under their vendor agreements. Discounts on these brands require written Merchandising approval and are typically only available during vendor sponsored events.

* Levi's
* Coach (above $500 ticket)
* Lancome
* Estee Lauder
* Clinique
* La Mer
* Dior Beauty
* Tag Heuer

A campaign that violates MAP can result in vendor charge backs and, in repeat cases, loss of the vendor account.

[COMP-EX-2026-001] Purpose

This document is a reference of real compliance flags raised on past Macys campaigns. Each example shows the flagged copy, the rule that was tripped, and the fix that landed in production. Use this when drafting new creative to anticipate where reviews tend to push back.
```

**Wrap the response as:**
```json
{"response": "<Claude's answer>", "retrieved_docs": ["BRAND-GL-2026-001", "LEGAL-DIS-2026-002", "PRICE-RULES-2026-001", "COMP-EX-2026-001"]}
```

---

### Chat 2: "How did Beauty campaigns perform last year?"

**Manifest key:** `POST___api_ai_chat__26e503100879`
**Save as:** `gui/public/static-demo/POST___api_ai_chat__26e503100879.json`

**User message:**

```
Question: How did Beauty campaigns perform last year?

Current campaign context:
{
  "campaign_id": "MDC-2026-MD-001",
  "title": "Mother's Day Beauty Event",
  "audience_segment": "Beauty Enthusiasts 25-54",
  "copy": "Celebrate Mom with the gift of beauty. Up to 25% off premium skincare, fragrance, and cosmetics.",
  "tagline": "Beauty She Deserves",
  "skus": ["1406", "782", "1058", "714", "358", "934"],
  "discount_pct": 25,
  "regions": ["NY", "CA", "FL", "TX"],
  "estimated_spend": 150000,
  "campaign_manager": "Merna"
}

Relevant internal documents:
[RETRO-SP-2025-BTY] Performance

* Total campaign revenue: $42.1M (plan was $39.3M)
* Email open rate: 32 percent (segment average 26 percent)
* Paid social ROAS: 4.2 (target was 3.5)
* In store conversion: 18 percent uplift in Beauty department over comparable weeks in 2024

The Beauty Discovery segment (customers who had browsed but not purchased Beauty in the prior 90 days) was the standout. Conversion ran 2.1x the segment baseline. The team credits the sampling offer (free 3 product sample box with $50 purchase) as the primary driver.

[RETRO-SP-2025-BTY] Segment Learnings

### Beauty Loyalists
Already engaged. The Spring campaign confirmed that Beauty Loyalists respond best to product depth (full ingredient stories, founder content, ritual videos) rather than discount messaging. The 5 minute founder video for the new La Mer launch drove the highest watch through rate of any video in the campaign at 58 percent.

### Beauty Discovery
Responsive to sampling and education. Free samples plus a "how to start" guide outperformed pure discount creative by a wide margin. Merna noted that the educational module on the landing page drove a 12 percent lift in average order value among Discovery segment buyers.

### Beauty Lapsed
Did not move. Lapsed Beauty customers (no purchase in 12 months) returned at roughly the baseline rate despite a dedicated reactivation email series. The team flagged that the offer (10 percent off) may not be enough to reactivate.

[RETRO-Q4-2025] Wins

### Beauty Loyalists Segment Outperformed
The Beauty Loyalists segment outperformed plan by 23 percent. Email open rate hit 41 percent (versus a 28 percent target) and conversion ran 1.6x the segment average. The team attributes this to the early November teaser series.

### Cross Channel Consistency
Holiday creative held a consistent look across email, paid social, site, and out of home. The Brand audit scored the campaign at 4.6 out of 5, the highest score for any Holiday in three years.

### Star Rewards Multiplier Drove Repeat
The 5x Star Rewards weekend (December 6 through 8) drove a 34 percent lift in repeat purchase rate among existing members.

[RETRO-SP-2025-BTY] Summary
The Spring 2025 Beauty launch ran March 3 through April 15, anchored by the "Find Your Glow" creative platform. Merna led the campaign with support from the Beauty Merchandising team. Revenue came in 7 percent ahead of plan, driven primarily by skincare and fragrance gift sets.
```

**Wrap the response as:**
```json
{"response": "<Claude's answer>", "retrieved_docs": ["RETRO-SP-2025-BTY", "RETRO-Q4-2025"]}
```

---

### Chat 3: "What are the MAP restrictions I should know about?"

**Manifest key:** `POST___api_ai_chat__4c714edc6e0d`
**Save as:** `gui/public/static-demo/POST___api_ai_chat__4c714edc6e0d.json`

**User message:**

```
Question: What are the MAP restrictions I should know about?

Current campaign context:
{
  "campaign_id": "MDC-2026-MD-001",
  "title": "Mother's Day Beauty Event",
  "audience_segment": "Beauty Enthusiasts 25-54",
  "copy": "Celebrate Mom with the gift of beauty. Up to 25% off premium skincare, fragrance, and cosmetics.",
  "tagline": "Beauty She Deserves",
  "skus": ["1406", "782", "1058", "714", "358", "934"],
  "discount_pct": 25,
  "regions": ["NY", "CA", "FL", "TX"],
  "estimated_spend": 150000,
  "campaign_manager": "Merna"
}

Relevant internal documents:
[PRICE-RULES-2026-001] Brands Under Strict MAP

The following brands enforce minimum advertised price under their vendor agreements. Discounts on these brands require written Merchandising approval and are typically only available during vendor sponsored events.

* Levi's
* Coach (above $500 ticket)
* Lancome
* Estee Lauder
* Clinique
* La Mer
* Dior Beauty
* Tag Heuer

A campaign that violates MAP can result in vendor charge backs and, in repeat cases, loss of the vendor account. This is the single most cited reason for emergency creative pulls.

[PRICE-RULES-2026-001] Purpose

This document defines how promotional discounts can be combined, what categories are excluded from promotions, and how vendor MAP rules apply.

[FAQ-INT-2026-001] How do I find out if my brand is under MAP?

Check PRICE-RULES-2026-001 for the standing MAP list. Brands are added throughout the year so the standing list may be out of date. When in doubt, ask Merchandising before you write the promo headline.

[COMP-EX-2026-001] Example 9, MAP brand discounted

* **Flagged copy**: "Levi's, 25 percent off this weekend."
* **Rule tripped**: PRICE-RULES-2026-001, Levi's is a MAP enforced brand.
* **Fix**: Creative pulled before launch. Promotional language replaced with "Shop Levi's, new arrivals." Pricing Strategy notified Merchandising.
```

**Wrap the response as:**
```json
{"response": "<Claude's answer>", "retrieved_docs": ["PRICE-RULES-2026-001", "FAQ-INT-2026-001", "COMP-EX-2026-001"]}
```

---

## Summary

| # | Section | Endpoint | Manifest key | Filename |
|---|---------|----------|-------------|----------|
| 1 | Compliance | `POST /api/ai/compliance` | `POST___api_ai_compliance__b3b19a7bcb29` | `POST___api_ai_compliance__b3b19a7bcb29.json` |
| 2 | Brief | `POST /api/ai/brief` | `POST___api_ai_brief__8f69878cedfe` | `POST___api_ai_brief__8f69878cedfe.json` |
| 3 | Revision Router | `POST /api/ai/route-revision` | `POST___api_ai_route-revision__c4fdb21b1171` | `POST___api_ai_route-revision__c4fdb21b1171.json` |
| 4 | Layout Copy | `POST /skills/generate-layout-copy` | `POST___skills_generate-layout-copy__3213b9810eab` | `POST___skills_generate-layout-copy__3213b9810eab.json` |
| 5 | Report | `POST /skills/generate-report` | `POST___skills_generate-report__7ee84d182093` | `POST___skills_generate-report__7ee84d182093.json` |
| 6a | Chat: compliance | `POST /api/ai/chat` | `POST___api_ai_chat__befcc6ea47c1` | `POST___api_ai_chat__befcc6ea47c1.json` |
| 6b | Chat: performance | `POST /api/ai/chat` | `POST___api_ai_chat__26e503100879` | `POST___api_ai_chat__26e503100879.json` |
| 6c | Chat: MAP | `POST /api/ai/chat` | `POST___api_ai_chat__4c714edc6e0d` | `POST___api_ai_chat__4c714edc6e0d.json` |

After generating all 8 files, add these entries to `gui/public/static-demo/manifest.json`:

```json
{
  "POST___api_ai_compliance__b3b19a7bcb29": "POST___api_ai_compliance__b3b19a7bcb29.json",
  "POST___api_ai_brief__8f69878cedfe": "POST___api_ai_brief__8f69878cedfe.json",
  "POST___api_ai_route-revision__c4fdb21b1171": "POST___api_ai_route-revision__c4fdb21b1171.json",
  "POST___skills_generate-layout-copy__3213b9810eab": "POST___skills_generate-layout-copy__3213b9810eab.json",
  "POST___skills_generate-report__7ee84d182093": "POST___skills_generate-report__7ee84d182093.json",
  "POST___api_ai_chat__befcc6ea47c1": "POST___api_ai_chat__befcc6ea47c1.json",
  "POST___api_ai_chat__26e503100879": "POST___api_ai_chat__26e503100879.json",
  "POST___api_ai_chat__4c714edc6e0d": "POST___api_ai_chat__4c714edc6e0d.json"
}
```

Note: The layout-copy and report keys are already in the manifest (pointing to fallback versions). Overwriting the files is sufficient — no manifest change needed for those two.
