# Genie agent configuration cards

These are copy-paste configurations for the three example domain agents. Create them under **Genie Agents → New**, then fill in **Configure**:
- **About:** name, description and warehouse
- **Resources:** tables
- **Instructions**
- **Common questions**

Finally, set up sharing with **Share**.

> **Why titles and descriptions matter.** Genie One, and later Copilot Studio, choose an agent based on its **title and description**. Genie suggests a title from the table names. Always replace it with a short, domain-specific business title, or questions can be routed to the wrong agent.

> **Golden rule.** Every user an agent is shared with must be able to `SELECT` **every** table in that agent. Otherwise Genie disables the whole agent for that user. See the Completions card below.

---

## 1. Drilling Performance

| Field | Value |
|---|---|
| **Title** | `Drilling Performance` |
| **Description** | `Drilling performance by well: rig, play, spud date, total depth and drilling days.` |
| **Warehouse** | Serverless Starter Warehouse |
| **Tables (Resources)** | `dbw_genie_demo.drilling.wells` |
| **Share (Can Run)** | `grp-genie-drilling`, `grp-genie-managers` |

**Instructions**
```text
Depths are in metres. Drilling time is in days. A well is identified by well_id.
"Play" means the basin or formation (Montney, Duvernay, Permian, Anadarko).
Answer only from the tables in this agent; if a question needs other data, say so.
```

**Common questions**
- Which rig has the lowest average drilling days?
- How many wells were spud per play in 2024?
- What is the deepest well and which rig drilled it?

**Verified answer:** *"Which rig has the lowest average drilling days?"* → **Rig 12, 17.52 days (66 wells)**, then Rig 34 at 17.59 and Rig 21 at 17.96.

---

## 2. Completions

| Field | Value |
|---|---|
| **Title** | `Completions` |
| **Description** | `Completion jobs by well: stage count, proppant, fluid volume and completion duration.` |
| **Warehouse** | Serverless Starter Warehouse |
| **Tables (Resources)** | `dbw_genie_demo.completions.completions` and `dbw_genie_demo.completions.well_header` (a view; see [sql/04_well_header_view.sql](../sql/04_well_header_view.sql)) |
| **Share (Can Run)** | `grp-genie-completions`, `grp-genie-managers` |

**Instructions**
```text
Proppant is in tonnes, fluid in cubic metres, completion duration in days.
Join completions to completions.well_header on well_id when play or rig is needed.
Answer only from the tables in this agent; if a question needs other data, say so.
```

**Common questions**
- What is the average proppant per stage by play?
- Which 10 wells took longest to complete?
- How many completions were done per month in 2024?

**Verified answer:** *"What is the average proppant per stage by play?"* gives the same result for the admin and for `comp.user`:

| Play | Proppant per stage (t) |
|---|---|
| Anadarko | 89.37 |
| Permian | 79.36 |
| Duvernay | 76.97 |
| Montney | 74.12 |

> **Why a view instead of `drilling.wells`.** Completions users can't read the drilling schema. If the agent included `drilling.wells`, Genie would disable it for them, with the banner *"You don't have SELECT access on 'dbw_genie_demo.drilling.wells'"* and no way to ask a question. The `completions.well_header` view exposes only `well_id`, `play` and `rig`, never drilling performance data. Completions users can read it through their existing schema grant.

---

## 3. Production

| Field | Value |
|---|---|
| **Title** | `Production` |
| **Description** | `Monthly oil and gas production volumes and decline by well, for the first 12 months after completion.` |
| **Warehouse** | Serverless Starter Warehouse |
| **Tables (Resources)** | `dbw_genie_demo.production.monthly_volumes` |
| **Share (Can Run)** | `grp-genie-managers` **only** |

**Instructions**
```text
oil_bbl is barrels of oil, gas_mcf is thousand cubic feet of gas. One row per well per month.
Month 0 is the completion month. "Decline" means the percentage drop from a well's first month.
Answer only from the tables in this agent; if a question needs other data, say so.
```

**Common questions**
- What is total oil production by month?
- Which 10 wells produced the most gas in their first 3 months?
- What is the average oil decline after 6 months?

**Verified answer:** *"Which 10 wells produced the most gas in their first 3 months?"* → W-0103 (15,855 mcf), W-0087 (15,737), W-0042 (15,509) and seven more.

**Treat the result table and SQL as the source of truth.** Genie's written summary is generated text and can occasionally misquote a number.

---

## Sharing summary

| Agent | grp-genie-drilling | grp-genie-completions | grp-genie-managers |
|---|---|---|---|
| Drilling Performance | ✅ Can Run | — | ✅ Can Run |
| Completions | — | ✅ Can Run | ✅ Can Run |
| Production | — | — | ✅ Can Run |

Sharing controls **which agents a user can see**. An agent's tables limit **what that agent answers from**. Unity Catalog grants control **which data they can read**, everywhere, including inside Genie One.

> **Genie One isn't limited by agents.** It can query any table a user can read directly, even one that's in no agent. Keep each group's grants no wider than its agents, or connect Copilot to individual agents instead of Genie One ([07 D2](../docs/07-design-decisions.md#d2-entry-point-genie-one-vs-one-tool-per-genie-space)). The *"Answer only from the tables in this agent"* line shapes the agent's wording; the **Resources** list is what limits the agent.
