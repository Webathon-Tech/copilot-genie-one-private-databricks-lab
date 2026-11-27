# 6. Testing and verification

A test passes only when **both** the chat answer and the **Databricks audit log** agree. The audit log proves *who*
the call ran as and *which network* it came from.

---

## 6.1 Test matrix and results (reference build)

| ID | What is tested | How | Expected | Result |
|---|---|---|---|---|
| T1 | Private DNS from the delegated subnet | Power Platform subnet diagnostics: DNS resolution | Workspace host → private endpoint IP | ✅ `10.10.2.4` via the `privatelink` CNAME |
| T2 | TCP and TLS from the delegated subnet | Diagnostics: TCP 443, TLS handshake | Connected, TLS 1.3 | ✅ From a container IP in `10.10.3.0/26` |
| T3 | Connector reaches the workspace privately | Create a connection, run *Ask Genie One* on the connector's **Test** tab | Audit shows the calls from `10.10.3.x` | ✅ `aadTokenLogin`, `mcpCall`: 200 from the delegated subnet |
| T4 | Domain question as a specialist | drill.user: *Which rig has the lowest average drilling days?* | Rig 12, 17.52 days, in one reply | ✅ |
| T5 | Cross-domain question as a manager (Genie One) | mgr.user: *Top 10 wells by proppant per stage and first-3-month oil* | Full table, W-0166 top, 39,653 bbl total, in one reply | ✅ |
| T6 | Identity reaches Databricks | Audit log | Each user's own email on every Genie call | ✅ drill.user, comp.user, mgr.user |
| T7 | Fully private | Public network access **Disabled** while running T3–T6 | All calls succeed from `10.10.3.x` | ✅ |
| T8 | Hardened public path (IP access list) | Only if the public fallback is used | Unlisted IP → 403 | Not used: the private path works |
| T9 | Permissions through Copilot | comp.user asks the drilling question; drill.user asks the cross-domain question | No restricted data returned | ✅ comp.user: `403 PERMISSION_DENIED`; drill.user: no completions or production tables visible |
| T10 | One reply per question | Cross-domain question | No "check again"; more than 3 polls allowed | ✅ About 8–15 *Get Genie One result* calls, none blocked |
| T11 | Secretless sign-in | App registration has 0 secrets; users create connections | Connections succeed | ✅ |
| T12 | Data policy in force | Read the policy back through the admin API; use the agent after the policy is applied | Groups and custom connector rules as designed; agent still answers | ✅ Policy contents verified; agent answers |
| T13 | Only assigned users can sign in | Assignment required = Yes | Group members work | ✅ |
| T14 | No dependency on the Managed MCP Servers preview | Turn the workspace preview **off**, then repeat T4/T5 and call `tools/list` on Genie One and on a per-space endpoint | Genie One and the agent answer; per-space endpoints say *managed MCP servers are not enabled* | ✅ Agent calls from `10.10.3.x` all 200 with the preview off |
| T15 | Option B: answer card in Microsoft 365 Copilot | mgr.user asks the cross-domain question | Genie's card with 39,653 bbl; one agent tool call; audit shows `resources/read` and repeated `tools/call` from `10.10.3.x` as the user | ✅ |
| T16 | Option B: follow-up from the card | Same chat: *Which of those wells produced the most oil?* | W-0131, 4,657 bbl, without a new Genie question | ✅ |
| T17 | Option B in Teams | mgr.user asks the cross-domain question in Teams | A holding message, then the full answer as text | ✅ |
| T18 | Option B permissions | drill.user asks for proppant per stage; comp.user asks the drilling question | Refused, with no numbers and no table names | ✅ |
| T19 | Credits per question | Same cross-domain question with each option, Copilot Studio test pane | Option A about 36, option B about 6 Copilot Credits | ✅ Measured |

## 6.2 Audit queries

Run in the Databricks SQL editor or through the Statement Execution API. The `system.access` schema must be enabled
by a metastore admin. The audit log system table is in **Public Preview**; for long-term evidence, also deliver
diagnostic logs ([guide 10](10-preview-features-and-production-readiness.md)). Audit data arrives with a delay that is often 15–60 minutes and occasionally longer.

**Which Copilot calls arrived, from where, as whom**
```sql
SELECT event_time, source_ip_address, user_identity.email AS user,
       service_name, action_name, response.status_code
FROM system.access.audit
WHERE event_date >= current_date() - 1
  AND (source_ip_address LIKE '10.10.3.%' OR source_ip_address LIKE '10.11.0.%')   -- the delegated subnets
  AND action_name <> 'aadTokenLogin'
ORDER BY event_time DESC
LIMIT 200;
```

**Which tables each user's questions actually read**
```sql
SELECT user_identity.email AS user, request_params.full_name_arg AS table_name,
       response.status_code, count(*) AS reads, min(event_time) AS first_read
FROM system.access.audit
WHERE event_date >= current_date() - 1
  AND service_name = 'unityCatalog' AND action_name = 'getTable'
GROUP BY ALL
ORDER BY user, first_read;
```

**Denials**
```sql
SELECT event_time, user_identity.email, service_name, action_name,
       response.status_code, response.error_message
FROM system.access.audit
WHERE event_date >= current_date() - 1
  AND response.status_code >= 400
  AND (source_ip_address LIKE '10.10.3.%' OR source_ip_address LIKE '10.11.0.%')
ORDER BY event_time DESC;
```

## 6.3 What a healthy Genie One call looks like in the audit log

| Order | `service_name` · `action_name` | Meaning |
|---|---|---|
| 1 | `accounts` · `aadTokenLogin` | The user's Entra token was accepted (from `10.10.3.x`) |
| 2 | `mcpService` · `mcpCall` (`tool_name: genie_ask`) | *Ask Genie One* |
| 3 | `genieChat` · `createGenieChatResponse` | Genie One started answering |
| 4 | `aibiGenie` · `getSpace`, `unityCatalog` · `getTable` | Genie One read the spaces and tables **this user** may use |
| 5 | `unityCatalog` · `generateTemporaryTableCredential` | The SQL ran as the user |
| 6 | `mcpService` · `mcpCall` (`tool_name: genie_poll_response`), repeated | *Get Genie One result* with attempt 1, 2, 3 … |

With **option B**, the `mcpCall` entries carry the MCP method in `request_params.json_rpc_method`: `initialize`,
`tools/list`, `resources/read` (the answer card loading) and `tools/call` repeated every few seconds (the card
polling Genie). All of them come from the delegated subnet as the user.

Observed in the reference build:

| User | Tables read through Genie One | Correct? |
|---|---|---|
| mgr.user | `completions.completions`, `completions.well_header`, `production.monthly_volumes`, `drilling.wells` | ✅ |
| comp.user | `completions.completions`, `completions.well_header` only; **never** `production.*` or `drilling.*` | ✅ |
| drill.user | `drilling.wells` only | ✅ |

The reference build reads only these tables because each user's grants match their spaces. Genie One would also read
any other table the user can read (6.5).

## 6.5 Genie One vs space scope

These behaviours were tested separately from the matrix in 6.1, with a table that the user **can read** but that is
**in none of their spaces**:

| # | User can read the table? | Table in a space the user can use? | Asked through | Result | Outcome |
|---|---|---|---|---|---|
| S1 | ✅ Yes | ✅ Yes | Space | Answers | As expected |
| S2 | ✅ Yes | ✅ Yes | Genie One | Answers, routed through the space and its business rules | As expected |
| S3 | ✅ Yes | ❌ No | Space | Refuses: data not in this space | Space scope narrows access |
| S4 | ✅ Yes | ❌ No | Genie One | Answers by querying the table directly | ⚠️ User permission wins |
| S5 | ❌ No | ✅ Yes (space shared with the user) | Space | Space disabled for that user (*no SELECT access* banner) | Permission always wins |
| S6 | ❌ No | ✅ Yes | Genie One | No data returned | Permission always wins |

| Control tested | Result |
|---|---|
| Workspace-level Genie One instruction *"answer only through agents"* | **Not enforced.** One run answered from the table directly; a repeat run refused. Not deterministic. |
| Genie One admin settings | No setting limits Genie One chat to spaces only |

**Do** repeat S3 and S4 for every persona after grant changes when Copilot calls Genie One. **Otherwise** a new
grant can expose uncurated data in Copilot without anyone noticing. A table found by S4 should be added to a space,
revoked, or the agent moved to one tool per space
([07 D2](07-design-decisions.md#d2-entry-point-genie-one-vs-one-tool-per-genie-space)).

## 6.6 Platform checks

| Check | Where | Expected |
|---|---|---|
| Enterprise policy linked | Power Platform admin center → Security → Data and privacy → Azure Virtual Network policies | Environment → policy name |
| Link operation | Environment → **History** | *New Network Injection Policy · Succeeded* |
| Subnets in use | VNet → JSON view → subnet → `serviceAssociationLinks` | `Microsoft.PowerPlatform/enterprisePolicies` |
| Workspace public access | Azure portal → workspace → Networking | **Disabled** |
| App credentials | App registration → Certificates & secrets | Secrets **0**, federated credentials **1** |
| Data policy | Power Platform admin center → Data policies | Scoped to the environment; Business and Blocked groups as in [05-production-hardening.md](05-production-hardening.md) |
