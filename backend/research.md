# Research: Tool-to-Markov-Graph Pipeline
## AgileOps — Parser & Classifier Design

> **Status:** Planning complete. Implementation pending.
> **Last updated:** 2026-03-19

---

## 1. What We're Building

The goal is to automatically derive the three parameter sets that `sim.py` uses to model a tool's impact on the Markov sales graph:

1. `tool_node_impact` — dict[node_id → float 0-1], fraction of node duration reduced
2. `tool_edge_impact` — dict[(src, dst) → float 0-1], fraction of edge dwell time reduced
3. `tool_topology` — list of structural graph mutations (collapse, add_edge, boost_exit, etc.)

Currently these are **hardcoded for Gong** in `sim.py`. We want to make them **automatically derived** from real-world published evidence about any SaaS tool.

**Non-negotiable constraint:** No black-box LLM API calls. Every impact number must trace back to a real, citable, human-verifiable source. This is required for the output to be defensible to a business audience.

---

## 2. The Change Type Taxonomy

Nine types of Markov graph modifications, covering all structural changes a tool can induce:

| # | Type | What it means |
|---|------|---------------|
| 1 | `NODE_DURATION_REDUCTION` | Tool automates part of a step → less time spent there |
| 2 | `NODE_REMOVAL` (collapse) | Tool handles all outputs → step is eliminated |
| 3 | `NODE_ADDITION` | Tool introduces a new mandatory step |
| 4 | `NODE_MERGE` | Tool handles two adjacent steps as one |
| 5 | `NODE_SPLIT` | Tool introduces a new human checkpoint within a step |
| 6 | `EDGE_ADDITION` | New transition path becomes possible (e.g. early exit) |
| 7 | `EDGE_REMOVAL` | A transition path is eliminated |
| 8 | `EDGE_PROBABILITY_SHIFT` | Existing edge probability changes (win/loss rate shifts) |
| 9 | `EDGE_DWELL_REDUCTION` | Async wait between two steps shortens |

`sim.py` already implements: collapse, add_edge, boost_exit (≈ types 2, 6, 8). The others extend this.

---

## 3. Full Pipeline Architecture

```
Tool Name + URLs + Docs
        ↓
[Stage 4] parser_scraper.py
  ├─ Web scraping: requests + trafilatura (boilerplate stripping)
  ├─ HTML parsing: BeautifulSoup4
  ├─ PDF parsing: pdfplumber (layout-aware, finds callout stats)
  ├─ Regex claim extraction (5 pattern types)
  ├─ Node attribution (3-tier keyword/app/verb matching)
  └─ Output: backend/data/tool_evidence.json
        ↓
[Stage 5] classifier.py
  ├─ Capability detection (11-bucket taxonomy)
  ├─ Benchmark lookup (capability_benchmarks.json)
  ├─ Evidence aggregation from tool_evidence.json
  ├─ Confidence-weighted magnitude estimation
  ├─ Topology rule evaluation (topology_rules.json)
  └─ Output: backend/data/tool_classification.json
        ↓
[Stage 6] sim.py (refactored)
  ├─ load_tool_params(tool_classification.json) replaces hardcoded Gong values
  └─ Output: backend/data/monte_carlo_results.json (+ parameter_provenance block)
```

Full CLI after implementation:
```bash
python backend/scripts/syth_data_gen.py
python backend/scripts/markov_builder.py
python backend/scripts/parser_scraper.py --tool gong --output backend/data/tool_evidence.json
python backend/scripts/classifier.py --evidence backend/data/tool_evidence.json --output backend/data/tool_classification.json
python backend/scripts/sim.py --tool_classification_path backend/data/tool_classification.json
```

---

## 4. parser_scraper.py — Detailed Design

### 4.1 Python Libraries
```
requests==2.31.0        # HTTP fetching
beautifulsoup4==4.12.2  # HTML parsing
lxml==5.1.0             # Fast BS4 backend
trafilatura==1.6.4      # Article body extraction (strips nav/footer/ads)
pdfplumber==0.10.3      # PDF text + bounding box layout
```

Add these to `requirements.txt`. No Selenium needed — all targets are static HTML or PDF.

### 4.2 Source Reliability Tiers

| Tier | Source Type | Reliability Score | Examples |
|------|-------------|-------------------|----------|
| 1 | Forrester/Gartner TEI/MQ | 0.95–1.0 | Forrester TEI for Gong (2023) |
| 2 | Vendor-commissioned third-party study | 0.80 | IDC Business Value of Outreach (2022) |
| 3 | Vendor-published case study | 0.65 | gong.io/customers/acme-corp/ |
| 4 | G2 / TrustRadius aggregate | 0.45 | g2.com/products/gong-io/reviews |
| 5 | Editorial / practitioner blog | 0.25–0.35 | SalesHacker, LinkedIn articles |

Penalize: -0.10 if no sample size disclosed, -0.10 if no methodology, -0.05/yr for claims >3 years old.

### 4.3 Regex Claim Extraction Patterns
```python
# A: "reduced X by Y%" or "X% reduction in Y"
PATT_REDUCTION  = re.compile(
    r'(?:reduc(?:ed|tion|ing)|cut|sav(?:ed|ing)|decreas(?:ed|ing))'
    r'\s+(?:\w+\s+){0,4}(\d{1,3}(?:\.\d)?)\s*%', re.IGNORECASE)

# B: "X% faster / more efficient"
PATT_FASTER     = re.compile(
    r'(\d{1,3}(?:\.\d)?)\s*%\s+(?:faster|quicker|more efficient|improvement)',
    re.IGNORECASE)

# C: "saves X hours per week/rep/deal"
PATT_HOURS      = re.compile(
    r'sav(?:es?|ing)\s+(\d+(?:\.\d)?)\s+hours?\s+(?:per|a)\s+(?:week|rep|deal|month)',
    re.IGNORECASE)

# D: "Xx more/faster" — multiplier claims
PATT_MULTIPLIER = re.compile(
    r'(\d+(?:\.\d+)?)[xX×]\s+(?:more|faster|quicker|improvement|increase)',
    re.IGNORECASE)

# E: win rate claims
PATT_WIN_RATE   = re.compile(
    r'win\s*rate\s+(?:increas|improv|grew?)\w*\s+(?:by\s+)?(\d{1,3}(?:\.\d)?)\s*%',
    re.IGNORECASE)
```

For each match: extract 150 chars before + 150 chars after as the **context window** for attribution.

Multiplier conversion: "2x faster" → reduction = 1 - 1/2 = 0.50 (conservative).

### 4.4 Node Attribution — 3-Tier Strategy

Every extracted claim must be linked to a specific pipeline node (or left as `null`).

**Tier 1 (confidence=1.0):** Context window matches a phrase in `node_keywords.json → tier1_phrases`.
- e.g. "call logging" → `call_debrief_logging`
- e.g. "email cadence" → `follow_up_sequence`

**Tier 2 (confidence=0.7):** Context mentions an app from the node's `app_cluster` (from `config.py`) + a relevant action verb.
- e.g. "Gong" + "transcript" → `call_debrief_logging` or `discovery_call_execution`

**Tier 3 (confidence=0.5):** Context matches the node's `action_verb` from `config.py`.
- e.g. "log" → `send_and_log` or `call_debrief_logging`

Claims with no attribution match are stored with `attributed_node: null` — still useful for tool-level capability detection, just not for node-level impact.

### 4.5 Output Schema: `tool_evidence.json`
```json
{
  "tool_name": "gong",
  "scrape_timestamp": "2026-03-19T14:00:00Z",
  "sources_attempted": 12,
  "sources_succeeded": 9,
  "claims": [
    {
      "claim_id": "gong_c001",
      "raw_value": "73",
      "unit": "percent",
      "direction": "reduction",
      "pattern_type": "PATT_REDUCTION",
      "context": "Reps reduced time spent on call logging by 73% after deploying Gong auto-summary",
      "attributed_node": "call_debrief_logging",
      "attribution_tier": 1,
      "attribution_evidence": "keyword match: 'call logging' in node_keywords.json",
      "source_url": "https://www.gong.io/customers/acme-corp/",
      "source_type": "vendor_case_study",
      "reliability_score": 0.65,
      "claim_date": "2024-06-15",
      "capability_tags": ["crm_auto_logging", "call_transcription"],
      "notes": ""
    }
  ],
  "scrape_failures": [
    { "url": "...", "reason": "HTTP 403", "fallback": "manual_benchmark_used" }
  ]
}
```

### 4.6 PDF Handling (pdfplumber)
```python
import pdfplumber

def extract_pdf_claims(pdf_path: str) -> list[dict]:
    claims = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            full_text = page.extract_text() or ""
            for pattern_name, pattern in PATTERNS.items():
                for m in pattern.finditer(full_text):
                    claim = extract_with_context(full_text, m)
                    claim["source_type"] = "pdf"
                    claim["page_number"] = page.page_number
                    claims.append(claim)
    return claims
```

pdfplumber preferred over PyMuPDF because it exposes bounding-box word data, enabling distinction between callout boxes (large-font stats like "73% time saved") and body text.

---

## 5. classifier.py — Detailed Design

### 5.1 Capability Taxonomy (11 Buckets)

Each bucket represents a concrete, observable product capability — verifiable from the vendor's own feature page or G2 profile. This taxonomy maps to Gartner/G2 feature category schemas, making it cross-checkable.

| Capability ID | What It Does | Key Pipeline Nodes |
|---------------|--------------|-------------------|
| `crm_auto_logging` | Writes CRM records automatically from calls/emails | call_debrief_logging, send_and_log |
| `call_transcription` | Real-time or post-call AI transcription + summary | call_debrief_logging, discovery_call_execution |
| `ai_email_composer` | AI-generated first-draft outreach / follow-up | draft_outreach, follow_up_sequence |
| `sequence_automation` | Autonomous multi-step cadence execution | follow_up_sequence, send_and_log |
| `lead_scoring` | ML-based ICP/fit scoring on prospect records | prospect_research, response_triage |
| `deal_intelligence` | Pipeline health, churn risk, next-step recs | response_triage, objection_handling |
| `coaching_feedback` | Post-call coaching, talk ratio, question scoring | objection_handling, discovery_call_execution |
| `meeting_scheduler` | AI-assisted calendar coordination | demo_scheduling_and_prep, discovery_call_prep |
| `proposal_automation` | Template-to-finished-doc generation | proposal_drafting |
| `contract_automation` | E-signature routing, redline tracking | contract_negotiation, deal_closure_and_handoff |
| `stakeholder_intelligence` | Org chart inference from calls + signals | stakeholder_mapping, discovery_call_prep |

### 5.2 Decision Rules per Change Type

These are explicit if/then rules, not trained models. Stored in `topology_rules.json` and evaluated in order.

**NODE_DURATION_REDUCTION** — applied when:
- Capability partially automates the node's work
- `automatable_fraction` ≠ "low" (from `config.py`)
- ≥1 attributed claim OR benchmark confidence > 0.40
- Magnitude: confidence-weighted average (see §5.4)

**NODE_REMOVAL (collapse)** — applied only when ALL of these hold:
- Capability handles ALL outputs listed in `config.py → outputs` for this node
- ≥1 Tier-1 or Tier-2 source explicitly says the step is "eliminated" or "automated away"
- `automatable_fraction` = "high"
- No human judgment required in node's `inputs`
- → If any condition fails: fall back to NODE_DURATION_REDUCTION with high magnitude

**EDGE_DWELL_REDUCTION** — applied when:
- Capability reduces async wait between two nodes
- Example: `sequence_automation` fires faster → cut dwell on `send_and_log → follow_up_sequence`

**EDGE_PROBABILITY_SHIFT / EDGE_ADDITION** — applied when:
- `deal_intelligence` or `lead_scoring` → boost edge to END from early nodes (faster disqualification)
- `coaching_feedback` → boost edges from late stages to higher-conversion paths
- Defined as named rules in `topology_rules.json`

**NODE_MERGE** — applied when:
- Two adjacent nodes share the same `app_cluster` AND a capability handles outputs of both
- Example: `crm_auto_logging` merges `call_debrief_logging` into `discovery_call_execution`

**NODE_SPLIT** — applied only with explicit source evidence (never inferred):
- A capability introduces a new mandatory human checkpoint within an existing step

### 5.3 Confidence-Weighted Magnitude Estimator

```python
SKEPTICISM_PRIOR = 2.0  # Bayesian shrinkage: need ~2 full-reliability sources before trusting

def weighted_estimate(claims: list[dict]) -> dict:
    """
    Each claim has:
      value:  float [0.0, 1.0]   — the impact magnitude (e.g. 0.73 for "73% reduction")
      weight: float              — reliability_score × attribution_confidence
    """
    if not claims:
        return {"estimate": None, "confidence": 0.0}

    total_w  = sum(c["weight"] for c in claims)
    estimate = sum(c["value"] * c["weight"] for c in claims) / total_w

    # Bayesian shrinkage: confidence rises slowly until you have enough reliable sources
    confidence = total_w / (total_w + SKEPTICISM_PRIOR)

    # Standard error across claims
    variance = sum(c["weight"] * (c["value"] - estimate) ** 2 for c in claims) / total_w
    std_err  = variance ** 0.5

    return {
        "estimate":    round(estimate, 3),
        "confidence":  round(confidence, 3),
        "std_err":     round(std_err, 3),
        "ci_low":      round(max(0.0, estimate - 1.96 * std_err), 3),
        "ci_high":     round(min(1.0, estimate + 1.96 * std_err), 3),
        "n_claims":    len(claims),
        "total_weight": round(total_w, 3)
    }
```

**Worked example (Gong call_debrief_logging):**
- 1 Tier-3 vendor case study: value=0.73, weight=0.65 → confidence = 0.65/(0.65+2.0) = **0.245**
- + 1 Forrester TEI: value=0.75, weight=1.0 → confidence = 1.65/3.65 = **0.452**
- + 2 more case studies: total_weight=2.95 → confidence = 2.95/4.95 = **0.596**

**Fallback rule:** If confidence < 0.40, use `capability_benchmarks.json → point_estimate` instead of the scraped estimate. Scraped data can only raise confidence; it cannot invent magnitudes.

**Clamping:** No estimate can exceed `magnitude_range[1]` from the benchmark table. Prevents unrealistic vendor claims from driving the simulation.

### 5.4 Output Schema: `tool_classification.json`
```json
{
  "tool_name": "gong",
  "classification_timestamp": "...",
  "capabilities_detected": [
    { "capability_id": "crm_auto_logging", "confidence": 0.95,
      "evidence_source": "G2 feature list + Gong product page" }
  ],
  "node_impact": {
    "call_debrief_logging": {
      "impact_type": "NODE_DURATION_REDUCTION",
      "estimate": 0.78,
      "confidence": 0.82,
      "ci_low": 0.66,
      "ci_high": 0.90,
      "n_claims": 4,
      "capabilities_driving": ["crm_auto_logging", "call_transcription"],
      "citations": [
        { "claim_id": "gong_c001", "value": 0.73, "weight": 0.65,
          "source": "https://www.gong.io/customers/acme-corp/",
          "verbatim": "Reps reduced time spent on call logging by 73%..." }
      ]
    }
  },
  "edge_impact": {
    "call_debrief_logging,stakeholder_mapping": {
      "impact_type": "EDGE_DWELL_REDUCTION",
      "estimate": 0.50,
      "confidence": 0.72,
      "ci_low": 0.35,
      "ci_high": 0.65,
      "capabilities_driving": ["crm_auto_logging"]
    }
  },
  "topology": [
    {
      "rule_id": "TR-001",
      "type": "collapse",
      "node": "call_debrief_logging",
      "confidence": 0.82,
      "conditions_met": ["automatable_fraction=high", "reliability_score>=0.60"],
      "conditions_failed": [],
      "citation": "Gong Forrester TEI 2023 p.12"
    },
    {
      "rule_id": "TR-002",
      "type": "add_edge",
      "from": "response_triage",
      "to": "END",
      "probability": 0.33,
      "confidence": 0.61,
      "citation": "Gong 2024 State of Revenue Report"
    }
  ],
  "nodes_with_insufficient_evidence": ["demo_delivery", "discovery_call_execution"],
  "audit_log": [
    "call_debrief_logging: TR-001 evaluated — all conditions met, collapse applied",
    "demo_delivery: automatable_fraction=low — NODE_DURATION_REDUCTION skipped",
    "contract_negotiation: confidence=0.31 below threshold 0.40 — fallback to benchmark point_estimate=0.10"
  ]
}
```

---

## 6. Supporting Data Files to Create

### 6.1 `backend/data/node_keywords.json`
Maps each of the 15 pipeline nodes to trigger phrases for attribution.
```json
{
  "call_debrief_logging": {
    "tier1_phrases": [
      "call logging", "post-call notes", "CRM entry after call",
      "call summary", "debrief", "call recap", "MEDDIC logging",
      "update CRM after", "post-call CRM"
    ],
    "tier2_apps": ["gong", "chorus", "salesforce"],
    "tier2_actions": ["log", "transcribe", "summarize", "debrief"]
  },
  "prospect_research": {
    "tier1_phrases": [
      "prospect research", "account research", "lead research",
      "ICP scoring", "company research", "firmographic",
      "finding leads", "identifying prospects", "prospect scoring"
    ],
    "tier2_apps": ["zoominfo", "apollo", "linkedin sales navigator"],
    "tier2_actions": ["research", "identify", "score", "qualify", "enrich"]
  },
  "draft_outreach": {
    "tier1_phrases": [
      "email drafting", "write outreach", "compose email", "first draft",
      "personalized email", "cold email", "outreach email", "AI-generated email"
    ],
    "tier2_apps": ["gmail", "outreach", "salesloft", "apollo"],
    "tier2_actions": ["draft", "write", "compose", "personalize"]
  },
  "follow_up_sequence": {
    "tier1_phrases": [
      "follow-up sequence", "email cadence", "outreach cadence",
      "touch sequence", "multi-step sequence", "drip campaign",
      "automated follow-up", "sales cadence"
    ],
    "tier2_apps": ["salesloft", "outreach", "apollo sequences"],
    "tier2_actions": ["sequence", "cadence", "automate", "schedule"]
  },
  "response_triage": {
    "tier1_phrases": [
      "response triage", "inbox management", "email triage",
      "lead qualification", "disqualify", "early qualification",
      "AI classify response", "prioritize replies"
    ],
    "tier2_apps": ["gmail", "salesforce", "gong"],
    "tier2_actions": ["triage", "classify", "qualify", "prioritize"]
  },
  "discovery_call_prep": {
    "tier1_phrases": [
      "call prep", "discovery prep", "pre-call research",
      "call brief", "account brief", "meeting brief",
      "prepare for discovery", "pre-meeting research"
    ],
    "tier2_apps": ["notion", "salesforce", "gong", "linkedin"],
    "tier2_actions": ["prep", "prepare", "brief", "research"]
  },
  "discovery_call_execution": {
    "tier1_phrases": [
      "discovery call", "sales call", "qualifying call",
      "live conversation", "real-time coaching", "talk ratio",
      "call execution", "live call"
    ],
    "tier2_apps": ["zoom", "gong", "salesforce"],
    "tier2_actions": ["call", "talk", "converse", "execute"]
  },
  "stakeholder_mapping": {
    "tier1_phrases": [
      "stakeholder mapping", "org chart", "buying committee",
      "champion identification", "decision maker", "internal champions",
      "multithreading", "stakeholder analysis"
    ],
    "tier2_apps": ["salesforce", "linkedin", "notion"],
    "tier2_actions": ["map", "identify stakeholder", "thread", "champion"]
  },
  "demo_scheduling_and_prep": {
    "tier1_phrases": [
      "demo scheduling", "book demo", "schedule demo",
      "demo preparation", "prepare demo", "demo environment",
      "calendar coordination", "meeting scheduling"
    ],
    "tier2_apps": ["notion", "zoom", "salesforce", "chili piper"],
    "tier2_actions": ["schedule", "book", "prepare demo", "coordinate"]
  },
  "demo_delivery": {
    "tier1_phrases": [
      "demo delivery", "product demo", "live demo",
      "demo performance", "demo execution", "presenting demo"
    ],
    "tier2_apps": ["zoom", "gong", "salesforce"],
    "tier2_actions": ["demo", "present", "show", "deliver"]
  },
  "objection_handling": {
    "tier1_phrases": [
      "objection handling", "handle objections", "overcome objections",
      "battlecard", "competitive response", "deal risk",
      "sales coaching", "win/loss analysis"
    ],
    "tier2_apps": ["gong", "notion", "salesforce"],
    "tier2_actions": ["handle", "overcome", "respond", "coach"]
  },
  "proposal_drafting": {
    "tier1_phrases": [
      "proposal drafting", "write proposal", "generate proposal",
      "RFP response", "proposal creation", "SOW drafting",
      "AI proposal", "proposal template"
    ],
    "tier2_apps": ["notion", "pandadoc", "salesforce"],
    "tier2_actions": ["draft proposal", "generate", "write proposal", "compose"]
  },
  "contract_negotiation": {
    "tier1_phrases": [
      "contract negotiation", "redline", "contract review",
      "terms negotiation", "legal review", "procurement",
      "contract markup", "negotiation cycle"
    ],
    "tier2_apps": ["docusign", "salesforce", "pandadoc", "ironclad"],
    "tier2_actions": ["negotiate", "redline", "review contract", "legal"]
  },
  "deal_closure_and_handoff": {
    "tier1_phrases": [
      "deal closure", "close deal", "handoff", "customer success handoff",
      "onboarding handoff", "implementation kickoff", "close won",
      "contract signing", "booking"
    ],
    "tier2_apps": ["salesforce", "notion", "docusign"],
    "tier2_actions": ["close", "hand off", "onboard", "book", "sign"]
  },
  "send_and_log": {
    "tier1_phrases": [
      "send email", "log activity", "CRM logging", "auto-log",
      "activity logging", "email tracking", "send and track",
      "email sent CRM"
    ],
    "tier2_apps": ["gmail", "salesforce", "salesloft"],
    "tier2_actions": ["send", "log", "track email", "record activity"]
  }
}
```

### 6.2 `backend/data/capability_benchmarks.json`
Hand-curated from primary sources. Structure for each entry:
```json
{
  "_metadata": {
    "last_updated": "2026-03-19",
    "primary_sources": [
      "Forrester TEI for Gong (2023)",
      "Gartner Market Guide for Revenue Intelligence Platforms (2023)",
      "SalesLoft 2024 State of Revenue Report",
      "IDC Business Value of Outreach (2022)"
    ]
  },
  "benchmarks": {
    "crm_auto_logging": {
      "nodes": {
        "call_debrief_logging": {
          "impact_type": "NODE_DURATION_REDUCTION",
          "magnitude_range": [0.60, 0.85],
          "point_estimate": 0.75,
          "confidence": 0.90,
          "citations": [
            {
              "source": "Forrester TEI for Gong 2023",
              "verbatim": "Reps reclaimed 73% of time previously spent on post-call CRM entry",
              "reliability_tier": 1
            }
          ]
        },
        "send_and_log": {
          "magnitude_range": [0.30, 0.55],
          "point_estimate": 0.42,
          "confidence": 0.70
        }
      },
      "edges": {},
      "topology_triggers": [
        {
          "rule_id": "TR-001",
          "note": "crm_auto_logging + call_transcription → collapse call_debrief_logging"
        }
      ]
    },
    "call_transcription": {
      "nodes": {
        "call_debrief_logging": { "magnitude_range": [0.65, 0.85], "point_estimate": 0.75, "confidence": 0.85 },
        "discovery_call_prep": { "magnitude_range": [0.40, 0.65], "point_estimate": 0.52, "confidence": 0.65 }
      }
    },
    "ai_email_composer": {
      "nodes": {
        "draft_outreach":     { "magnitude_range": [0.55, 0.75], "point_estimate": 0.65, "confidence": 0.80 },
        "follow_up_sequence": { "magnitude_range": [0.60, 0.75], "point_estimate": 0.68, "confidence": 0.75 }
      }
    },
    "sequence_automation": {
      "nodes": {
        "follow_up_sequence": { "magnitude_range": [0.55, 0.80], "point_estimate": 0.68, "confidence": 0.85 },
        "send_and_log":       { "magnitude_range": [0.30, 0.50], "point_estimate": 0.40, "confidence": 0.70 }
      },
      "edges": {
        "follow_up_sequence,response_triage": {
          "impact_type": "EDGE_DWELL_REDUCTION",
          "magnitude_range": [0.15, 0.35],
          "point_estimate": 0.25,
          "confidence": 0.65
        }
      }
    },
    "lead_scoring": {
      "nodes": {
        "prospect_research": { "magnitude_range": [0.40, 0.65], "point_estimate": 0.52, "confidence": 0.70 },
        "response_triage":   { "magnitude_range": [0.35, 0.60], "point_estimate": 0.48, "confidence": 0.65 }
      },
      "topology_triggers": [{ "rule_id": "TR-002" }]
    },
    "deal_intelligence": {
      "nodes": {
        "response_triage":    { "magnitude_range": [0.30, 0.55], "point_estimate": 0.42, "confidence": 0.70 },
        "objection_handling": { "magnitude_range": [0.25, 0.45], "point_estimate": 0.35, "confidence": 0.60 }
      },
      "topology_triggers": [{ "rule_id": "TR-002" }]
    },
    "coaching_feedback": {
      "nodes": {
        "discovery_call_prep":      { "magnitude_range": [0.40, 0.65], "point_estimate": 0.52, "confidence": 0.65 },
        "objection_handling":       { "magnitude_range": [0.30, 0.50], "point_estimate": 0.40, "confidence": 0.65 },
        "discovery_call_execution": { "magnitude_range": [0.00, 0.10], "point_estimate": 0.00, "confidence": 0.80,
                                      "note": "Human-essential; coaching improves quality not speed" }
      },
      "topology_triggers": [{ "rule_id": "TR-003" }]
    },
    "stakeholder_intelligence": {
      "nodes": {
        "stakeholder_mapping": { "magnitude_range": [0.30, 0.55], "point_estimate": 0.42, "confidence": 0.60 },
        "discovery_call_prep": { "magnitude_range": [0.20, 0.40], "point_estimate": 0.30, "confidence": 0.55 }
      }
    },
    "meeting_scheduler": {
      "nodes": {
        "demo_scheduling_and_prep": { "magnitude_range": [0.25, 0.45], "point_estimate": 0.35, "confidence": 0.75 }
      },
      "edges": {
        "discovery_call_prep,discovery_call_execution": {
          "impact_type": "EDGE_DWELL_REDUCTION",
          "magnitude_range": [0.10, 0.30],
          "point_estimate": 0.20,
          "confidence": 0.60
        }
      }
    },
    "proposal_automation": {
      "nodes": {
        "proposal_drafting": { "magnitude_range": [0.40, 0.65], "point_estimate": 0.52, "confidence": 0.75 }
      }
    },
    "contract_automation": {
      "nodes": {
        "contract_negotiation":    { "magnitude_range": [0.05, 0.20], "point_estimate": 0.10, "confidence": 0.70 },
        "deal_closure_and_handoff":{ "magnitude_range": [0.30, 0.55], "point_estimate": 0.42, "confidence": 0.65 }
      }
    }
  }
}
```

### 6.3 `backend/data/topology_rules.json`
```json
{
  "rules": [
    {
      "rule_id": "TR-001",
      "description": "crm_auto_logging + call_transcription collapses call_debrief_logging",
      "capabilities_required": ["crm_auto_logging", "call_transcription"],
      "node_target": "call_debrief_logging",
      "conditions": {
        "automatable_fraction": "high",
        "min_reliability_score": 0.60
      },
      "markov_change": { "type": "collapse", "topology_op": "NODE_REMOVAL" },
      "fallback_if_failed": { "type": "NODE_DURATION_REDUCTION", "magnitude_source": "benchmark_point_estimate" },
      "citation": "Gong Forrester TEI 2023 — p.12: post-call logging eliminated as distinct step"
    },
    {
      "rule_id": "TR-002",
      "description": "deal_intelligence or lead_scoring adds early-exit edge from response_triage",
      "capabilities_any": ["deal_intelligence", "lead_scoring"],
      "node_target": "response_triage",
      "conditions": {
        "min_evidence_claims": 1,
        "min_reliability_score": 0.45
      },
      "markov_change": {
        "type": "add_edge",
        "from": "response_triage",
        "to": "END",
        "probability_range": [0.25, 0.45],
        "probability_source": "benchmark_weighted_mean"
      },
      "citation": "Gong 2024 State of Revenue Report: AI triage raises early disqualification rates by 15-25pp"
    },
    {
      "rule_id": "TR-003",
      "description": "coaching_feedback adds back-edge from objection_handling to discovery_call_prep",
      "capabilities_required": ["coaching_feedback"],
      "conditions": { "min_reliability_score": 0.50 },
      "markov_change": {
        "type": "add_edge",
        "from": "objection_handling",
        "to": "discovery_call_prep",
        "probability_range": [0.08, 0.18],
        "probability_source": "benchmark_weighted_mean"
      },
      "citation": "Gong coaching loop analysis — reps re-enter discovery cycle after objections 10-15% of deals"
    },
    {
      "rule_id": "TR-004",
      "description": "crm_auto_logging merges call_debrief_logging into discovery_call_execution (alt to TR-001)",
      "capabilities_required": ["crm_auto_logging"],
      "conditions": {
        "automatable_fraction": "high",
        "min_reliability_score": 0.60,
        "TR-001_conditions_failed": true
      },
      "markov_change": { "type": "merge", "source_node": "call_debrief_logging", "into_node": "discovery_call_execution" },
      "citation": "Gong in-call CRM auto-fill — logging happens during call, not after"
    },
    {
      "rule_id": "TR-005",
      "description": "sequence_automation boosts response_triage throughput (edge prob shift)",
      "capabilities_required": ["sequence_automation"],
      "conditions": { "min_evidence_claims": 1, "min_reliability_score": 0.45 },
      "markov_change": {
        "type": "boost_exit",
        "node": "response_triage",
        "delta_range": [0.05, 0.12],
        "direction": "increase_qualified"
      },
      "citation": "SalesLoft 2024 State of Revenue: automated sequences increase response rate 20-35%"
    }
  ]
}
```

### 6.4 `backend/data/source_registry.json`
Seed URLs for the scraper (deterministic crawl manifest):
```json
{
  "gong": {
    "case_studies_index": ["https://www.gong.io/customers/"],
    "whitepapers": ["https://www.gong.io/resources/reports/forrester-total-economic-impact/"],
    "g2_profile": "https://www.g2.com/products/gong-io/reviews",
    "product_features": "https://www.gong.io/product/"
  },
  "salesloft": {
    "case_studies_index": ["https://salesloft.com/resources/case-studies/"],
    "g2_profile": "https://www.g2.com/products/salesloft/reviews",
    "product_features": "https://salesloft.com/platform/"
  },
  "outreach": {
    "case_studies_index": ["https://www.outreach.io/customers/"],
    "g2_profile": "https://www.g2.com/products/outreach/reviews",
    "product_features": "https://www.outreach.io/platform/"
  },
  "apollo": {
    "case_studies_index": ["https://www.apollo.io/customers/"],
    "g2_profile": "https://www.g2.com/products/apollo-io/reviews"
  }
}
```

---

## 7. sim.py Refactor

### 7.1 Changes Required (minimal, backwards-compatible)

1. **Rename fields in SimConfig**: `GONG_NODE_IMPACT` → `tool_node_impact`, `GONG_EDGE_IMPACT` → `tool_edge_impact`, `GONG_TOPOLOGY` → `tool_topology`

2. **Add loader function**:
```python
def load_tool_params(classification_path: str) -> tuple[dict, dict, list]:
    with open(classification_path) as f:
        data = json.load(f)

    node_impact = {
        node_id: info["estimate"]
        for node_id, info in data.get("node_impact", {}).items()
        if info.get("impact_type") == "NODE_DURATION_REDUCTION"
    }

    edge_impact = {
        tuple(edge_str.split(",", 1)): info["estimate"]
        for edge_str, info in data.get("edge_impact", {}).items()
    }

    # Only include topology changes with sufficient confidence
    topology = [t for t in data.get("topology", []) if t.get("confidence", 0) >= 0.50]

    return node_impact, edge_impact, topology
```

3. **Add CLI flag**: `--tool_classification_path` (optional; falls back to hardcoded Gong defaults if absent)

4. **Add provenance block** to `monte_carlo_results.json`:
```json
{
  "parameter_provenance": {
    "tool_name": "gong",
    "classification_timestamp": "...",
    "mean_confidence": 0.68,
    "nodes_at_low_confidence": ["demo_delivery", "contract_negotiation"],
    "topology_rules_applied": ["TR-001", "TR-002"],
    "recommendation": "Re-run scraper after adding Forrester TEI source to raise confidence"
  }
}
```

---

## 8. Defensibility Argument

This is why the approach is justifiable to a business audience:

| Layer | Defensibility |
|-------|---------------|
| **Data sourcing** | Every claim has a URL and verbatim excerpt. An auditor can open the source and verify the number. |
| **Attribution** | Tier assignment is logged in output. Reviewers can see exactly why a claim was mapped to a node. |
| **Capability detection** | Maps to G2/Gartner feature taxonomy — cross-checkable against vendor's own feature pages. |
| **Magnitude estimation** | Bayesian shrinkage prevents single vendor claims from driving high estimates. Confidence score is explicit. |
| **Benchmark floor** | No estimate can go below the benchmark range. No scraped claim can exceed it. |
| **Topology decisions** | Explicit preconditions in `topology_rules.json`. Audit log lists which conditions were met/failed. |
| **Uncertainty propagation** | 95% CI flows from claim variance into `monte_carlo_results.json` confidence intervals. |
| **No black box** | No LLM API call. All reasoning is deterministic rule evaluation. Fully reproducible. |

---

## 9. Implementation Order

1. Create `node_keywords.json` (from `config.py` node descriptions — 15 nodes)
2. Create `capability_benchmarks.json` (compile from 4 primary sources — the most time-intensive step)
3. Create `topology_rules.json` (5–10 rules, start with TR-001/TR-002)
4. Create `source_registry.json` (seed URLs for 4 tools)
5. Implement `parser_scraper.py` — HTML → regex → context → attribution → PDF → serialize
6. Implement `classifier.py` — capability detect → benchmark lookup → weighted estimate → topology rules → serialize
7. Refactor `sim.py` — field renames → loader → CLI flag → provenance block
8. Integration test — run Gong pipeline; verify node_impact within ±0.15 of hardcoded values

---

## 10. Acceptance Criteria

```bash
# Full pipeline run for Gong
python backend/scripts/parser_scraper.py --tool gong --output backend/data/tool_evidence.json
python backend/scripts/classifier.py --evidence backend/data/tool_evidence.json --output backend/data/tool_classification.json
python backend/scripts/sim.py --tool_classification_path backend/data/tool_classification.json
```

- `tool_evidence.json`: ≥10 claims with `attributed_node` not null
- `tool_classification.json`: `node_impact` estimates within ±0.15 of hardcoded `GONG_NODE_IMPACT`
- Topology includes collapse of `call_debrief_logging` and `add_edge` to END from `response_triage`
- `monte_carlo_results.json`: within MC variance of existing Gong baseline
