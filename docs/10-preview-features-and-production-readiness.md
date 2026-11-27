# 10. Preview features and production readiness

Before you put this solution in front of real users, know exactly which parts rely on features that aren't yet
generally available (GA). Preview and Beta features can change behaviour, names or limits, can have reduced
support commitments, and are usually excluded from service-level agreements.

> Statuses below were taken from the official documentation pages linked in each row. **Re-check them at the start
> of every project.** Features move from Preview to GA, and Beta endpoints get retired, often within months.

---

## 10.1 Status of every feature this solution uses

| Area | Feature | Status | Used how | Production impact |
|---|---|---|---|---|
| Databricks | **Genie One MCP server** (`/ai-gateway/mcp-services/system.ai.genie_one_mcp`) | **Generally available** | The only Genie endpoint the agent calls | ✅ Safe to depend on |
| Databricks | **Managed MCP Servers** (workspace *Previews* toggle) | **Public Preview**. Covers the per-space Genie, AI Search, SQL and Unity Catalog function endpoints. | **Not required: turned off**, and the agent verified end to end with it off. Needed only by the per-space endpoints, including the Azure Databricks connector's per-space Genie tool, which this design doesn't use. | ✅ No dependency (10.2) |
| Databricks | **Per-space Genie MCP server** `/api/2.0/mcp/genie/{space_id}` (needed for one tool per Genie space, [07 D2](07-design-decisions.md#d2-entry-point-genie-one-vs-one-tool-per-genie-space)) | **Public Preview**, behind the Managed MCP Servers toggle | Not used: this build calls Genie One | ⚠️ If you choose one tool per space, record a preview exception, or use the Genie Conversation API after checking its status |
| Databricks | Workspace-level Genie MCP **Beta** endpoint `/api/2.0/mcp/genie` (no space ID) | **Deprecated, end of life 30 November 2026** | Not used | ⛔ Don't build on it |
| Databricks | Genie One **account-only experience**; account-level front-end Private Link | **Beta** | Not used | ⛔ Avoid for production |
| Databricks | **Audit log system table** `system.access.audit` | **Public Preview** | Verification and monitoring of identity and source IP | ⚠️ Keep a second audit source (10.2) |
| Databricks | Genie One and Genie Agents **pricing** | Free for users through **31 January 2027** (service principals billed) | All questions | 💲 Budget for billing after the promotion |
| Power Platform | **VNet support**, including the **Databricks** connector and **custom connectors** | **Generally available** | The private network path | ✅ Safe to depend on |
| Power Platform | **Managed Environments**, data policies, custom connector URL rules | Generally available | Governance | ✅ |
| Power Platform | Custom connector **managed identity** (Entra user-delegated auth with a federated credential) | No preview label on the official page; a recent capability | Secretless sign-in | ✅ Usable. Keep the documented fallback (10.3). |
| Copilot Studio | **MCP tools in the "Microsoft Copilot" agent experience** | **Preview** (the documentation is marked *prerelease*) | Connector **option B** (MCP server). Option A uses connector actions instead. | ⚠️ Option B: accepted preview exception (10.2) · Option A: no dependency |
| Copilot Studio | **MCP apps** (interactive answer cards from MCP tools, such as Genie One's *View ask*) | No preview label on the official page. Supported in **Microsoft 365 Copilot** and the Copilot Studio test chat; **not supported in Teams or web chat** | Option B shows Genie's answer card in Microsoft 365 Copilot; Teams receives the answer as text | ✅ Usable; test each channel you publish to |
| Copilot Studio | **Microsoft Copilot harness** (the agent experience used to build *Ask Genie*) | No preview label on the official page | Hosts the agent | ✅ Watch release notes |
| Copilot Studio | **Claude Sonnet 5.5** model | **Generally available** in the model availability list. Requires an admin to allow Anthropic as a subprocessor, and the provider to be allowed per environment. | Agent model | ⚠️ Data-boundary decision (10.2) |
| Copilot Studio | *Memory*, *Preview and experimental models* | Preview / experimental | **Turned off / not used** | ✅ Keep them off in production |
| Entra ID | Federated identity credentials (explicit subject) | Generally available. *Claims matching expressions* are Preview. | Explicit subject only | ✅ |

## 10.2 What to do about each preview dependency

### Managed MCP Servers (Databricks, Public Preview)
- **Why it matters:** it's a workspace-wide preview toggle. Some organisations don't allow preview features in
  production workspaces.
- **What this design needs:** the agent calls only the **Genie One MCP server, which is GA**. The preview toggle is
  required by the **per-space** endpoints and by the Azure Databricks connector's per-space Genie tool, and neither is
  part of the final design.
- **Verified:** with the toggle **off** (the audit log records `workspace · setSetting`,
  `managed_mcp_servers` `{"enabled":false}`):
  - Genie One `tools/list` and the agent's ask and poll calls still return **200**, from the delegated subnet, as
    the user (test T14 in [06-testing-and-verification.md](06-testing-and-verification.md)).
  - The per-space endpoints, for example `/api/2.0/mcp/genie/{space_id}`, return *"Databricks managed MCP servers
    are not enabled"*. Any tool built on them, such as the Azure Databricks connector's per-space Genie tool, stops
    working.
- **Do:** run production with the preview **off**. Turn it on only if you deliberately add a per-space MCP tool, and
  then record it as a documented preview exception with an owner and a review date.

### Audit log system table (Databricks, Public Preview)
- **Why it matters:** it is the main evidence that each call runs as the user and arrives privately.
- **Do:** keep using it for verification and monitoring. For compliance-grade retention, also configure **diagnostic
  log delivery** for the workspace (for example to Log Analytics or a storage account), and enable Microsoft Purview
  auditing for Copilot Studio activity. **Otherwise** a change to the preview table could leave you without an audit
  trail.

### Copilot Studio MCP tools (Preview): option B only
- **Option A** (two REST actions) calls Genie One through generally available connector actions and has no preview
  dependency.
- **Option B** (MCP server) depends on MCP tools in Copilot Studio's agent experience, which are **Preview**
  ([07 D3](07-design-decisions.md#d3-how-copilot-studio-calls-genie-one)). **Do:** record it as an accepted preview
  exception with an owner and a review date, keep *Allow all* off, and re-run the test set after Copilot Studio or
  Databricks releases. **Otherwise** a change in preview behaviour reaches users unnoticed.
- If option B's behaviour changes unacceptably, switch the agent's tools to option A. Both connectors can exist in
  the same solution and use the same Entra app.

### Anthropic models (GA, with governance decisions)
- A **Microsoft 365 admin** must allow *AI providers operating as Microsoft subprocessors* (Anthropic). It's on by
  default in most commercial regions but **off by default in the EU, EFTA and the UK**. A **Power Platform admin** must
  then allow the provider's models in the environment.
- Claude models are **processed outside the EU Data Boundary**, and models with data retention need a separate opt-in.
- **Do:** get explicit sign-off from your data-protection officer. **Otherwise** choose a generally available OpenAI
  model explicitly (not *Auto*), and re-run the tests: polling behaviour can differ between models.

### Genie pricing after 31 January 2027
- **Do:** estimate warehouse and Genie costs from your pilot's question volume, and set Databricks budgets before the
  promotion ends. **Otherwise** costs can change without anyone noticing.

## 10.3 Fallbacks if a capability changes

| If this changes… | Fallback |
|---|---|
| Custom connector managed identity becomes unavailable | Switch the connector's Security tab to **client secret**: create a secret on the same app, store it in the connector, and add a rotation reminder. Users keep their connections. |
| Genie One MCP response format changes | Option A: update `connector/genie-one-connector.swagger.yaml` (the response schema) and the instructions. Option B: no connector change; review the tool list and re-test. Re-run tests T4–T10. |
| MCP tools or MCP apps in Copilot Studio change behaviour (option B) | Switch the agent to option A (two REST actions); the connector, Entra app and network stay the same |
| VNet support for an environment is unlinked | Calls fall back to public egress and **fail**, because public access is disabled. Re-link the enterprise policy. Delete locks protect the subnets and policy. |

## 10.4 Production go-live checklist

- [ ] Every feature in 10.1 re-checked against current documentation; no Beta endpoints in use.
- [ ] Entry point decided: Genie One (this build) or one tool per Genie space ([07 D2](07-design-decisions.md#d2-entry-point-genie-one-vs-one-tool-per-genie-space)). For Genie One, Unity Catalog grants reviewed so that every table each user can read is acceptable to surface in Copilot, and tests S3–S4 ([06 §6.5](06-testing-and-verification.md#65-genie-one-vs-space-scope)) run per persona.
- [ ] Connector option chosen (A or B); for option B, the MCP preview exception approved and *Allow all* off.
- [ ] Managed MCP Servers preview **off** in the production workspace, and test T14 passed (or a documented exception if you add a per-space MCP tool).
- [ ] Model choice approved by data protection (Anthropic subprocessor setting, data boundary).
- [ ] Diagnostic log delivery configured in addition to the audit system table.
- [ ] Tests T1–T14 (and T15–T18 for connector option B) from [06-testing-and-verification.md](06-testing-and-verification.md) pass in the production environment.
- [ ] Hardening items in [05-production-hardening.md](05-production-hardening.md) applied, including the *recommended* ones you accepted.
- [ ] Budgets set for Copilot Studio (Azure) and for Databricks; the owner knows the post-promotion Genie pricing.
- [ ] Support model agreed: who owns the Entra app, the connector, the environment, the network and the Genie spaces.
- [ ] Users create their connection (the **Connect** card on their first question in Microsoft 365 Copilot, or the setup link) **before** their first chat in Teams.

## References
- [Databricks-provided (managed) MCP servers](https://learn.microsoft.com/en-us/azure/databricks/generative-ai/mcp/managed-mcp)
- [Genie One MCP server](https://learn.microsoft.com/en-us/azure/databricks/agents/mcp-tools/genie-mcp)
- [Enable Genie One for users](https://learn.microsoft.com/en-us/azure/databricks/genie-one/enable-genie-one)
- [Azure Databricks preview release types](https://learn.microsoft.com/en-us/azure/databricks/release-notes/release-types)
- [Audit log system table](https://learn.microsoft.com/en-us/azure/databricks/admin/system-tables/audit-logs)
- [Power Platform VNet support: supported services](https://learn.microsoft.com/en-us/power-platform/admin/vnet-support-overview)
- [Add an MCP server to your agent (Microsoft Copilot) — preview](https://learn.microsoft.com/en-us/microsoft-copilot-studio/agents-experience/tools-add-mcp-server)
- [Use MCP apps in Copilot Studio](https://learn.microsoft.com/en-us/microsoft-copilot-studio/agents-experience/mcp-apps)
- [Add tools and resources from an MCP server to your agent](https://learn.microsoft.com/en-us/microsoft-copilot-studio/mcp-add-components-to-agent)
- [Harnesses in Copilot Studio](https://learn.microsoft.com/en-us/microsoft-copilot-studio/harnesses-overview)
- [Model availability in Copilot Studio](https://learn.microsoft.com/en-us/microsoft-copilot-studio/agents-experience/authoring-agent-model-availability)
- [Claude models from Anthropic in Microsoft Online Services](https://learn.microsoft.com/en-us/microsoft-365/copilot/connect-to-ai-subprocessor)
- [Manage preview AI models](https://learn.microsoft.com/en-us/microsoft-365/copilot/manage-preview-ai-models)
- [Custom connectors: managed identity authentication](https://learn.microsoft.com/en-us/connectors/custom-connectors/azure-active-directory-authentication)
