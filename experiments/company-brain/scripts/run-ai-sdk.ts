// The same agent as agent/ with AI SDK 7 alone: same model, instructions and data code.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { anthropic } from "@ai-sdk/anthropic";
import { isStepCount, tool, ToolLoopAgent } from "ai";
import { z } from "zod";
import { getModel, listModels } from "../agent/lib/models.ts";
import { querySql } from "../agent/lib/query.ts";

process.loadEnvFile(".env.local");

const agent = new ToolLoopAgent({
  model: anthropic("claude-haiku-5-5"),
  instructions: await readFile("agent/instructions.md", "utf8"),
  stopWhen: isStepCount(10),
  tools: {
    list_models: tool({
      description: "List the available dbt analytics models, their relations, and row grains.",
      inputSchema: z.object({}),
      execute: async () => listModels(),
    }),
    get_model: tool({
      description:
        "Read a dbt model's column types, descriptions, compiled SQL, lineage, metric definitions, joins, and caveats before answering or querying it.",
      inputSchema: z.object({ model: z.string().min(1).max(100) }),
      execute: async ({ model }) => getModel(model),
    }),
    query_sql: tool({
      description:
        "Execute one read-only DuckDB SELECT against documented models. Non-recursive CTEs and joins are supported; table functions and external access are not. Returns at most 200 rows and 64 KiB of result data. Read model definitions first.",
      inputSchema: z.object({ sql: z.string().min(1).max(16_384) }),
      execute: async ({ sql }) => querySql(sql),
    }),
  },
});

const questions = JSON.parse(await readFile("scripts/questions.json", "utf8"));
const out = process.env.RESULTS ?? "results";
const only = process.env.ONLY?.split(",");
await mkdir(out, { recursive: true });

for (const { id, text } of questions.filter((q: { id: string }) => !only || only.includes(q.id))) {
  const started = Date.now();
  const result = await agent.generate({ prompt: text });
  const ms = Date.now() - started;
  const calls = result.steps.flatMap((step) =>
    step.toolCalls.map((call) => ({ tool: call.toolName, input: call.input })),
  );
  await writeFile(
    `${out}/ai-sdk-${id}.json`,
    JSON.stringify({ id, text, ms, usage: result.usage, steps: result.steps.length, calls, reply: result.text }, null, 1),
  );
  console.log(`\n=== ${id} (${ms} ms, ${result.steps.length} steps, ${calls.length} calls)\n${result.text}`);
}
