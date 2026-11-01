import { defineAgent } from "eve";
import { anthropic } from "eve/models/anthropic";

export default defineAgent({
  model: anthropic("claude-haiku-5-5"),
  build: { externalDependencies: ["@duckdb/node-api", "@duckdb/node-bindings", "@duckdb/node-bindings-win32-x64"] },
});
