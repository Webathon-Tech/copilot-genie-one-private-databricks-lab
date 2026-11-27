# 0. Adoption guide: plan this solution for your organisation

This repository documents one complete, tested build. The **pattern** is industry-neutral: any organisation that keeps
governed data in Azure Databricks and wants Microsoft 365 Copilot to answer questions from it, **privately** and
**with each user's own permissions**, can follow it. This guide turns the reference build into a plan for yours.

---

## 0.1 Is this pattern right for you?

Use it when **all** of these are true:

| Requirement | Why |
|---|---|
| Business users should get answers inside **Microsoft 365 Copilot or Teams** | That's where the agent is published |
| Data is governed in **Unity Catalog** and curated into **Genie spaces** | Genie writes the SQL; Unity Catalog enforces access |
| Each person must see **only what they're entitled to** | Every call runs as the signed-in user, with no shared account |
| The Databricks workspace must stay **private** (no public network access) | Power Platform VNet support provides the private path |
| Microsoft 365, Power Platform and Azure Databricks share **one Entra tenant** | Required for per-user sign-in |
| Every table a user can read is acceptable to surface in Copilot, **or** you connect individual Genie spaces instead of Genie One | Genie One answers from **any** table the user can read, including tables in no Genie space (0.3, decision 2) |

If your workspace may stay public, you can skip [guide 03](03-private-connectivity-power-platform-vnet.md) and protect
it with an IP access list instead ([07-design-decisions.md, D1](07-design-decisions.md)). Everything else still applies.

## 0.2 Map the example to your organisation

The reference build uses three fictional data domains. Replace them with yours. The mechanics don't change.

| Reference build | Your organisation (examples) | What you create |
|---|---|---|
| Domains: drilling, completions, production | Finance, sales, supply chain; claims, policies, risk; patients, billing, operations | One Unity Catalog **schema** per domain |
| Genie spaces: Drilling Performance, Completions, Production | One curated **Genie space** per domain | Instructions, sample questions and trusted queries per space ([genie-agents/agents.md](../genie-agents/agents.md)) |
| Groups: drilling, completions, managers | One Entra group per domain, plus cross-domain roles (managers, analysts) | `USE SCHEMA` + `SELECT` per group; spaces shared per group |
| `grp-genie-copilot-users` | Everyone allowed to use the agent | Reused for the environment, the app assignment and agent and connector sharing |
| Agent *Ask Genie* | Your agent name and tone | Instructions adapted from [connector/ask-genie-agent-instructions.md](../connector/ask-genie-agent-instructions.md) |
| Region Canada Central / Canada East | Your Power Platform region and its Azure region pair (0.4) | Delegated subnets in **both** Azure regions |

> **Do** design each Genie space around one domain, and expose shared attributes through curated views
> ([diagram 6](diagrams.md#6-designing-domain-agents)). **Otherwise** a user without access to one table loses the
> whole space. For cross-domain questions, either let Genie One combine sources (only when your grants are
> least-privilege, decision 2) or build a purpose-made space that holds the tables those users can read.

## 0.3 Decisions to make first

| # | Decision | Recommended default | Who decides |
|---|---|---|---|
| 1 | Network path | Power Platform VNet support, workspace public access **disabled** | Security / network architecture |
| 2 | Entry point: Copilot → **Genie One** (one endpoint, reaches every table the user can read) or Copilot → **individual Genie spaces** (one tool per space, curated data only) | **Individual Genie spaces**, unless Unity Catalog grants are reviewed, least-privilege, and every readable table is acceptable to surface in Copilot. Then Genie One, as in this build. Check the per-space endpoint's preview status ([07 D2](07-design-decisions.md#d2-entry-point-genie-one-vs-one-tool-per-genie-space)) | Architecture board + data platform owner |
| 2b | Curated business workspace | Optional, stronger: a business-facing workspace bound only to curated catalogs, so Genie One there can't reach raw data ([07 D11](07-design-decisions.md#d11-limiting-what-genie-one-can-reach)) | Data platform owner |
| 2c | Who owns onboarding a new Genie space into Copilot | Needed only with individual spaces: a named data team and Copilot team, with a change request per space ([07 D2](07-design-decisions.md#d2-entry-point-genie-one-vs-one-tool-per-genie-space)) | Service owner |
| 3 | Connector authentication | Microsoft Entra ID with **managed identity + federated credential** (no secret) | Identity team |
| 3b | Connector option | **A** (two REST actions) if no preview features are allowed; **B** (MCP server with Genie's answer card) for lower cost and less maintenance ([04 §4.1](04-genie-one-connector-and-copilot-agent.md#41-choose-the-connector-option)) | Architecture board + platform owner |
| 4 | Who may use the agent | One security group | Business owner + identity team |
| 5 | Model | A specific GA model; Claude Sonnet if Anthropic is approved | Data protection + platform owner |
| 6 | Preview features | Avoid; document any exception ([guide 10](10-preview-features-and-production-readiness.md)) | Architecture board |
| 7 | Capacity and billing | Pay-as-you-go with a budget, or prepaid Copilot Credits; Microsoft 365 Copilot licences for heavy users | Finance + platform owner |
| 8 | Environments | Separate dev/test and production Power Platform environments, each Managed | Platform owner |

## 0.4 Region pairs for Power Platform VNet support

Each Power Platform region needs delegated subnets in **specific** Azure regions. If two are listed, you must create
subnets in **both**. Source: [Virtual Network support overview](https://learn.microsoft.com/en-us/power-platform/admin/vnet-support-overview).

| Power Platform region | Azure regions for the delegated subnets |
|---|---|
| United States | eastus, westus |
| Canada | canadacentral, canadaeast |
| Europe | westeurope, northeurope |
| UK | uksouth, ukwest |
| France | francecentral, francesouth |
| Germany | germanynorth, germanywestcentral |
| Switzerland | switzerlandnorth, switzerlandwest |
| Norway | norwaywest, norwayeast |
| Sweden | swedencentral |
| Italy | italynorth |
| Australia | australiasoutheast, australiaeast |
| Asia | eastasia, southeastasia |
| Singapore | southeastasia |
| Japan | japaneast, japanwest |
| Korea | koreasouth, koreacentral |
| India | centralindia, southindia |
| UAE | uaenorth, uaecentral |
| South Africa | southafricanorth, southafricawest |
| Brazil | brazilsouth, brazilsoutheast |
| US Government (GCC High, DoD) | see the official page (GCC isn't supported) |

> **Do** put the Databricks workspace in the same geography. **Otherwise** connector traffic crosses geographies,
> with latency, peering cost and data-residency questions.

## 0.5 Planning worksheet (collect before you start)

| Item | Example in this repository | Your value |
|---|---|---|
| Entra tenant ID and primary domain | `<tenant-id>` · `contoso.onmicrosoft.com` | |
| Azure subscription and resource group | `<subscription-id>` · `rg-genie-demo` | |
| Power Platform region → Azure regions | Canada → canadacentral + canadaeast | |
| Workspace URL and workspace ID | `adb-1234567890123456.7.azuredatabricks.net` · `1234567890123456` | |
| Workspace VNet and private endpoint IPs | `vnet-genie-demo` `10.10.0.0/20` · `10.10.2.4` (UI/API) · `10.10.2.5` (browser auth) | |
| Delegated subnet, primary region (/26 per production environment) | `snet-pp-cnc` `10.10.3.0/26` | |
| VNet + delegated subnet, paired region | `vnet-genie-demo-cne` `10.11.0.0/24` · `snet-pp-cne` `10.11.0.0/26` | |
| Private DNS zone | `privatelink.azuredatabricks.net` | |
| SQL warehouse ID | `0123456789abcdef` | |
| Catalog, schemas, Genie spaces | `dbw_genie_demo` · 3 schemas · 3 spaces | |
| Entra groups | users group + one per domain + cross-domain roles | |
| Power Platform environment(s) | `Genie Copilot` (Production, Managed) | |
| Billing | Pay-as-you-go plan + budget amount + alert recipients | |
| Entra app name | `copilot-genie-one-mcp` | |
| Solution | `Genie Copilot` (`GenieCopilot`) | |
| Custom connector name | `Genie One` (option A) or `Genie One MCP` (option B) | |
| Enterprise policy name | `ep-genie-copilot-vnet` | |
| Data policy name | `dp-genie-copilot-prod` | |
| Agent name | `Ask Genie` | |

Naming tip: use `<purpose>-<workload>-<env>-<region>`, for example `snet-pp-genie-prod-cnc`, so resources stay
recognisable across environments.

## 0.6 Implementation roadmap

| Phase | Outcome | Guide | Main roles | Exit criteria |
|---|---|---|---|---|
| 1. Databricks foundation | Domains, grants, Genie spaces, Genie One, private workspace | [01](01-databricks-build-guide.md) | Databricks admin, data owners | Each persona gets the right answers in the Databricks UI |
| 2. Prerequisites and billing | Licences, roles, environment, billing plan, budget | [02](02-prerequisites-licensing-and-billing.md) | Power Platform admin, finance | Managed environment ready; budget alerting |
| 3. Private network | Delegated subnets, peering, DNS, enterprise policy linked | [03](03-private-connectivity-power-platform-vnet.md) | Network admin, Power Platform admin | DNS, TCP and TLS succeed from inside the subnet |
| 4. Connector and agent | Entra app, solution, secretless connector (option A or B), sharing, agent published | [04](04-genie-one-connector-and-copilot-agent.md) | Identity admin, maker | Admin gets correct answers in one reply in Preview |
| 5. Hardening | Identity, data policy, locks, budgets, auditing | [05](05-production-hardening.md) | Security, platform owner | Checklist complete |
| 6. Verification | Persona tests + audit evidence | [06](06-testing-and-verification.md) | Test lead, data owners | T1–T14 (and T15–T18 for connector option B) pass; identities and private source IPs proven |
| 7. Go-live | Preview review, support model, onboarding | [10](10-preview-features-and-production-readiness.md) | Architecture board, service owner | Go-live checklist signed off |

## 0.7 Scaling beyond one environment

- **Dev/test and production:** link each Managed Environment to an enterprise policy. Size the delegated subnets for
  all environments that share them: Microsoft advises 25–30 IPs per production environment and 6–10 per
  non-production one.
- **Moving the connector between environments:** an imported custom connector gets a **new managed identity**. Add a
  federated credential for it on the Entra app, and share it again in the target environment.
- **More than one workspace:** add a custom connector URL rule per workspace host to the data policy, and use one
  connector per workspace (the host is part of the connector definition).
- **More data domains:** add a schema, grants, a Genie space and a group. Genie One picks up new spaces automatically
  for users who can access them, and the agent needs no change. It picks up **new grants** just as automatically, so
  any new table a user can read becomes reachable from Copilot, curated or not. With one tool per Genie space
  instead, add a tool for the new space and republish the agent.
- **More users:** add them to the groups and send the agent's sharing link. Track Copilot Credit consumption and
  consider Microsoft 365 Copilot licences for heavy users.

## 0.8 Non-negotiables

1. **One Entra tenant** for Microsoft 365, Power Platform and Azure Databricks.
2. Tools use **End user account** authentication, never maker credentials.
3. **No client secrets** where a federated credential is available.
4. **Unity Catalog** is the only data boundary, so test every persona. Genie spaces only narrow it, Genie One isn't
   limited by spaces, and instructions are never access control.
5. **No Beta endpoints** in production, and every preview dependency documented.
6. **Prove** identity and network path in the audit log; a correct answer alone isn't evidence.
