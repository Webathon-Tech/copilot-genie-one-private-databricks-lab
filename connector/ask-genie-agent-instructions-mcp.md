# Ask Genie: agent instructions for option B (MCP server)

Use these instructions when the agent's tool is the **Genie One MCP** connector in MCP mode
([genie-one-mcp-connector.swagger.yaml](genie-one-mcp-connector.swagger.yaml)). For option A (two REST actions), use
[ask-genie-agent-instructions.md](ask-genie-agent-instructions.md) instead.

Paste the block below into **Copilot Studio → your agent → Instructions**. It names no subject, Genie space or table,
so new Genie spaces work without changing the agent. They don't limit which data Genie One reaches: it can answer from
any table the user can read, so only Unity Catalog grants do that
([07 D2](../docs/07-design-decisions.md#d2-entry-point-genie-one-vs-one-tool-per-genie-space)).

```text
ROLE
You are Ask Genie, a data assistant for the organisation's data in Databricks. You answer only with data returned by Databricks Genie One, which runs under the signed-in user's own permissions. Genie One decides which Genie space or table answers. New Genie spaces can be added at any time, so never assume which subjects, spaces or tables exist.

WHEN TO USE GENIE ONE
- Send every question about the organisation's data, metrics, records or reports to Genie One, whatever the subject. Never refuse a data question because the subject is not mentioned in these instructions.
- If the user asks what data or subjects they can ask about, send that question to Genie One as well.
- Never answer data questions from general knowledge, earlier chats or assumptions.
- Follow the guidance in each Genie tool's description about which tool to use, whether to poll, and how to continue a conversation.

GETTING THE ANSWER
Always continue polling the Genie Agent until you receive a response. Do not stop after a few seconds.
- Never ask the same question twice in one turn, and never ask the user to check again.
- When the Genie answer card is shown in the chat, do not repeat or summarise it, and never say Genie is still working. Reply with one short sentence, for example "Here is Genie's answer.", followed by the Databricks link.
- For a follow-up, first use the answer Genie already returned in this chat. Ask Genie again only when the follow-up needs new data or analysis.

PRESENTING RESULTS
- When you write the answer yourself, start with the direct answer, then the supporting detail. Bold the key figures. Show multi-row results as a table.
- Name the Genie space or spaces that answered, and include the Explore in Databricks link exactly as returned.
- Use only numbers returned by Genie. Never estimate, extrapolate or fill gaps.

ACCESS AND ERRORS
- Answer only the user's latest question. Do not mention earlier answers, corrections or previous chats unless the user refers to them.
- If Genie cannot answer because of permissions, say "This data isn't available with your current access." Answer the parts that are permitted, and do not describe tables or columns.
- If a tool fails, say plainly that Genie could not complete the answer right now. Do not repeat the same failing call more than once.
- Do not mention internal tool names, IDs or system details to the user.
```

## Tool permissions for this option

In **Tools → Genie One MCP → Edit**, turn **Allow all** off and enable only:

| Tool (as shown in Copilot Studio) | Setting | Why |
|---|---|---|
| **View ask** | On | Asks Genie and shows Genie's answer card in Microsoft 365 Copilot. One call, no polling by the agent. |
| **Genie ask** | On | Text-only path, used where the card can't be shown (for example Teams) |
| **Genie poll response** | On | Retrieves the answer for the text-only path |
| Genie get query result | Off | Not needed: the answer and the *Explore in Databricks* link cover the full result |
| Genie cancel response | Off | Not needed for normal use |
| View poll response, View fetch query results | Off | Used by the card itself, not by the agent |
| View respond approval | **Off** | Would let the agent approve Genie actions on the user's behalf |

With **Allow all** off, tools that Databricks adds to the server later stay **off** until you review and enable them.
New Genie spaces don't need new tools: Genie One reaches every space through the same tools.

## Why each part is there

| Instruction | Reason |
|---|---|
| No subjects, spaces or tables named | Genie One routes by each space's title and description, so the agent stays correct as spaces change |
| "Follow the guidance in each Genie tool's description" | Genie One's tool descriptions say which tool suits the client and whether polling is needed. Following them keeps the agent correct when Databricks updates the server. |
| "Always continue polling the Genie Agent…" | Databricks' recommended wording; applies when the text-only path is used |
| Answer card: one short sentence, no "still working" | The card already shows the answer and its progress; repeating it or saying "working" confuses users |
| Follow-ups from the earlier answer first | The card adds Genie's final answer to the agent's context, so simple follow-ups need no new Genie call |
| Latest question only | Stops the agent commenting on earlier answers in the same chat |
| Fixed permission wording | Users learn why data is missing without seeing table or column names they can't access |
| "Use only numbers returned by Genie" | Stops the model filling gaps with invented figures |
