# eve vs. AI SDK 7

These get compared incorrectly, because they solve problems at different levels.

## The short version

| | eve | AI SDK 7 |
| --- | --- | --- |
| What it is | a **framework** — a runtime platform | a **library** — building blocks |
| Defining an agent | a directory structure on disk | TypeScript objects |
| Sessions | durable, server-owned, reconnectable | your problem |
| Sandbox | built in, four backends | a separate package (`@ai-sdk/sandbox-*`) |
| Skills | first-class directory plus `load_skill` | `uploadSkill` (provider-level) or a harness bundle |
| HTTP API | ready-made `/eve/v1/*` plus an NDJSON stream | you write it |
| Channels | Slack/Discord/iMessage as files | out of scope |
| Schedules | `agent/schedules/` | out of scope |
| Lock-in | eve's runtime model | none, use anything |
| Models | an AI Gateway ID or a direct `LanguageModel` | any provider |

**eve uses AI SDK internally** (`ai: ^7` is one of its dependencies). The question is not
"which one", it is "do I want a framework or the parts".

## `HarnessAgent` is a different thing again

`HarnessAgent` runs an **existing agent runtime** (Claude Code, Codex, Pi, Deep Agents,
OpenCode) behind a single AI SDK surface. A harness is not a model provider: it owns its
own tools, workspace state, permissions, compaction, and session history.

```ts
const agent = new HarnessAgent({
  harness: claudeCode,
  sandbox: createVercelSandbox({ runtime: 'node24' }),
  instructions: '...',
});
```

That is a different product from eve. Harness = "run Claude Code programmatically".
eve = "build your own agent, which is a directory". See
[05-agentic-loop.md](05-agentic-loop.md) for the comparison that matters in practice.

Harness packages are experimental, and bridge-backed ones (Claude Code, Codex) require a
real network sandbox provider.

## Choosing

**Choose eve when:**
- the agent is a standalone backend service, not a feature inside an existing Next.js app
- you need durable sessions that survive a deploy
- you want the sandbox, skills, channels, and schedules to already exist
- someone other than you will edit the agent (a directory reads better than code)

**Choose AI SDK 7 directly (`ToolLoopAgent`, `streamText`) when:**
- you are adding an AI feature to an existing application
- you need precise control over the model call, tool loop, or structured output
- you do not want another runtime dependency

**Choose `HarnessAgent` when:**
- you want to drive Claude Code or Codex from code for coding work
- preserving the existing harness's behavior matters more than control

**Choose `WorkflowAgent` when:** the steps are deterministic and the model only decides
what happens inside a step.

## Observations from this test

| Observation | Why it matters |
| --- | --- |
| `eve init` to a running agent in under a minute | the scaffolding is good |
| Compile-time diagnostics were precise | `revalidationKey` without `bootstrap` was caught immediately, and the error stated the fix |
| Typecheck caught a `readTextFile` null | the types are strict, not an `any` swamp |
| Prompt caching worked immediately (6820 of 6905 tokens) | no tuning needed |
| The HTTP API is documented and stable | `scripts/ask.mjs` is 40 lines |
| The write-run-fix loop works with zero orchestration code | see [05-agentic-loop.md](05-agentic-loop.md) |
| On Windows the sandbox silently degrades to just-bash | you have to know; see [01-sandbox.md](01-sandbox.md) |
| Version 0.63.0, "in preview" | the API may change before GA |

## Not a competitor to a personal skill library

A `~/.agents/skills/` library serves a coding agent (Claude Code, Codex) on your machine.
eve skills serve a **deployed backend agent**. Same format, different target. The same
`SKILL.md` can live in both.
