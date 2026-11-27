# 8. Troubleshooting guide

Each entry gives the **symptom**, the **cause**, and what to **do**. Most problems show up in the agent's debug view
(Preview → *Debug mode*, or **Copy error info** on a failed tool call) or in `system.access.audit`.

## Network and platform

| # | Symptom | Cause | Do |
|---|---|---|---|
| 1 | Connection test fails with **BadGateway** when creating the connection | The first call after linking VNet support starts a container in the delegated subnet (about 1 minute) | Retry after a minute, or tick **Skip connection test**, then prove the path with a real call and the audit log |
| 2 | Subnet diagnostics return **HTTP 503** | Same cold start | Retry for about a minute |
| 3 | Windows PowerShell calls to Power Platform endpoints fail silently | TLS 1.2 isn't the default in PowerShell 5.1 | `[Net.ServicePointManager]::SecurityProtocol = 'Tls12'` |
| 4 | `Connect-AzAccount -Tenant <domain>` fails: *could not find tenant id* | The browser signed in with a different or personal account | Use the tenant **GUID** and an InPrivate window for the device code |
| 5 | `Microsoft.PowerPlatform.EnterprisePolicies` won't load (*exact version required*) | The module pins exact Az module versions and prompts interactively | Run interactively with those versions installed side by side, or call the ARM and Power Platform REST APIs directly ([03](03-private-connectivity-power-platform-vnet.md)) |
| 6 | Enterprise policy isn't visible in the resource group | It is a hidden resource type | Classic resource list with **Show hidden types**, or Resource Graph |
| 7 | Audit log doesn't show recent calls | Ingestion delay, often 15–60 minutes and sometimes several hours | Check `max(event_time)` first; wait |

## Connector and sign-in

| # | Symptom | Cause | Do |
|---|---|---|---|
| 8 | Copilot Studio: *"Can't save this tool because the custom connector isn't solution-aware. Add it to a solution, then try again."*, or **Add** on an MCP tool silently does nothing | The connector was created outside a solution (option B requires a Dataverse connector) | Create the connector **inside a solution** ([04 §4.4–4.5](04-genie-one-connector-and-copilot-agent.md#44-create-a-solution)) |
| 9 | *Solutions → Add existing → Custom connector → Outside Dataverse* keeps spinning | Converting an existing connector into Dataverse didn't complete | Delete the connector and recreate it inside the solution; then add its new redirect URI and federated credential ([04 §4.6](04-genie-one-connector-and-copilot-agent.md#46-trust-the-connector-in-the-entra-app)) |
| 10 | Users see *"Connector information unavailable"* and the connector as `shared_…` | The custom connector isn't shared with them | Share the connector (**Can view**) with the users' group through its Dataverse group team ([04 §4.8](04-genie-one-connector-and-copilot-agent.md#48-share-the-connector-with-the-users-group)) |
| 11 | Sharing fails: *"The AAD group … does not exist in Dataverse"* | Dataverse needs a group team for the Entra group | Create a **Microsoft Entra ID Security Group** team in the environment, then share again |
| 12 | Connector permissions API returns *"Solution custom connector permissions management is not yet enabled"* | Solution connectors are Dataverse records, not managed by that API | Share in Power Apps, or use the Dataverse `GrantAccess` action on the `connector` record |
| 13 | User gets *AADSTS50105* at sign-in | "Assignment required" is on and the user isn't in the assigned group | Add the user to the group |
| 14 | Sign-in fails with *AADSTS70021 / 700213* | The federated credential's issuer or subject doesn't match the connector | Copy them again from the connector's Security tab. A recreated or re-imported connector has a new subject. |
| 15 | Agent blocked by data policy after creating a DLP policy | The custom connector fell into Non-business while the Teams channel is Business | Add the custom connector URL rule for your workspace host as **Business** ([05](05-production-hardening.md)) |
| 16 | After you edit the connector definition, Copilot Studio's **Add a tool** still lists the old actions | Copilot Studio caches the connector's action list | Change the connector's **General → Description**, select **Update connector**, then reload Copilot Studio |

## Agent behaviour

| # | Symptom | Cause | Do |
|---|---|---|---|
| 17 | Copilot Studio says *"no Genie tools available in this session"* | The chat session started before the tools were saved | **New chat**. A page refresh isn't enough. |
| 18 | Tool fails: *"Error from token exchange: Bad authorization token. Token validation failed."* (400 from `…token.azure-apim.net/…/exchange`) | The maker's Copilot Studio session token is stale, for example after editing the connector or tools | Reload Copilot Studio (sign out and in if needed) and start a **New chat**. If it persists: tool → **Manage connections** → fix or reconnect. |
| 19 | Option A: agent stops after 3 polls: *"status check was blocked from running again"* | Copilot Studio blocks repeated **identical** tool calls in one reply (observed behaviour, not listed in the published runtime limits) | Keep the increasing `attempt` value in *Get Genie One result*; never remove it ([07 D3](07-design-decisions.md#d3-how-copilot-studio-calls-genie-one)) |
| 20 | Re-asking Genie One while it is busy fails: *stream closed before response.created event* (audit `mcpCall` 500) | A second `genie_ask` on a conversation that is still running | Don't re-ask. Keep polling, or let the answer card finish. |
| 21 | Option B: under a finished answer card the agent says *"Genie is working on your question…"* | The agent follows the acknowledgement wording in Genie One's tool description | Use the instructions in [ask-genie-agent-instructions-mcp.md](../connector/ask-genie-agent-instructions-mcp.md) ("When the Genie answer card is shown…") and **Publish** |
| 22 | Option B in **Teams**: no answer card, only text | Teams doesn't display MCP app cards; Microsoft 365 Copilot does | Expected. Keep **Genie ask** and **Genie poll response** enabled so the agent can answer as text. |
| 23 | The agent mentions earlier answers or "corrected results" from the same chat | The model refers back to the conversation | Keep the instruction "Answer only the user's latest question…" |
| 24 | A refusal names tables or columns the user can't access | Genie describes what it searched | Keep the fixed permission wording in the instructions, and add the Genie One workspace instruction from [01 §9](01-databricks-build-guide.md#9-best-practices) |
| 25 | A question is answered from the wrong domain or with invented numbers | The model ignored the instructions | Keep "Use only numbers returned by Genie"; keep knowledge and web search off; use a fixed model, not Auto |
| 26 | A user gets data they shouldn't | Not observed. If it happens, the tool may be using **maker** credentials. | Check the tool's **Authentication = End user account**; check the audit log for the identity |

## Users and distribution

| # | Symptom | Cause | Do |
|---|---|---|---|
| 27 | Teams keeps failing for one user while Microsoft 365 Copilot works for the same user | The user's Teams conversation was first opened **before** their connection existed, and stays bound to the missing connection | Prevent it: users create their connection before their first Teams chat. To recover, remove the user's duplicate connections; if Teams still fails, use Microsoft 365 Copilot or open a support case. |
| 28 | Connections page shows **Stale** | Tools were replaced, so the old connection bindings point to removed tools | **Review** → pick the existing connection → **Submit** |
| 29 | A user sees the agent **twice** | The user installed it from a sharing link and also received the org catalogue deployment | Use one distribution method ([04 §4.10](04-genie-one-connector-and-copilot-agent.md#410-share-and-publish-the-agent)). Remove the extra copy in **Teams → Apps → Manage your apps**. |
| 30 | The org catalogue copy shows an older name, greeting or starters | App package changes need a new admin approval | **Use and share → Submit to org catalog** again; the admin publishes the update in **Agents → Requests** |
| 31 | The agent is installed but not on the Teams left bar | Installation doesn't pin apps | Optional: Teams app setup policy with the agent under **Pinned apps** ([04 §4.10](04-genie-one-connector-and-copilot-agent.md#optional-pin-the-agent-in-teams)) |
