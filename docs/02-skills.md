# Skills in eve

An eve skill follows the same `SKILL.md` convention as
[agentskills.io](https://agentskills.io) and Claude Code. **A skill written against that
standard ports over as-is** — this is eve's documented promise, and it held up in testing.

## How loading works

eve scans `agent/skills/`, exposes each skill's **description** to the model, and
provides a framework-owned `load_skill` tool. The model pulls the full body into context
only when a turn calls for it. This is progressive disclosure, the same model Claude Code
uses.

From the test run:

```
→ load_skill {"skill":"csv-raportti"}
← # CSV-raportointi
  1. Lue `docs/tietomalli.md` ...
```

The description is a **routing hint, not a label**. Write it as the task that should
trigger the skill, not as a summary of what the skill contains.

## Two forms

**Flat markdown** (`agent/skills/forecast.md`) — the lightest. Without `description`
frontmatter, eve advertises the first non-empty line of the body, which is a weak routing
hint. Add a `description` when you want the model to route on intent.

**Packaged** (`agent/skills/<name>/SKILL.md` plus `references/`, `assets/`, `scripts/`) —
`description` frontmatter is **required**, since there is no filename slug to fall back on.

**`defineSkill`** (TypeScript) — when markdown cannot express what you need: generated
content, typed values, inline sibling files.

## Support files

Static skills do not need a sandbox — `load_skill` returns their instructions directly
from the compiled agent. **Sibling files do require a sandbox** and are materialized under
`$HOME/.agents/skills/<skill>/`, with `/workspace/skills/<skill>/` as the fallback.

From code: `ctx.getSkill("csv-raportti").file("references/laskentasaannot.md").text()`.

> On just-bash, `$HOME` is `/`, so the path becomes `//.agents/skills/...` and the model
> has to hunt for it. See [01-sandbox.md](01-sandbox.md).

## Skills are scoped per agent

A subagent's `skills/` are invisible to the root agent, and the reverse holds too. To
share one skill definition, package it as a workspace extension and mount it in each agent.

## Community skills

`eve registry search` includes skills.sh as the built-in `@skills` source:

```bash
eve registry search react --registry @skills
eve add @skills/vercel-labs/agent-skills/vercel-react-best-practices
```

These are community-authored project files — review the diff before running the agent.

## Porting an existing skill library

Skills in a `~/.agents/skills/` library use the same `SKILL.md` format. Copy the skill
directory into `agent/skills/` and it works. Two things to watch:

- eve reads `description`, `license`, and string `metadata`. Other frontmatter is accepted
  as a no-op — it will not break, but it will not do anything either.
- The tool surface differs from Claude Code's. A skill that references a `Grep` or `Edit`
  tool will not work as written: eve's defaults are `bash`, `read_file`, `write_file`,
  `load_skill`, `todo`, `web_fetch`, `web_search`, `ask_question`, `task_cancel`, and
  `agent`. `glob` and `grep` are opt-in (`eve/tools/glob`, `eve/tools/grep`).
- Loading a skill **adds instructions, never a new execution surface**. Typed behavior
  belongs in a tool.
