# eve quickstart lab

A tested example project for [eve](https://eve.dev) — Vercel's filesystem-first
framework for durable backend AI agents. This repo contains a **working agent that was
actually run**, with a seeded sandbox workspace, a progressive-disclosure skill, and a
typed tool.

Verified against eve `0.63.0`, Node 24, Windows 11, calling OpenAI directly (`gpt-5.6-luna`).

## What this demonstrates

The agent runs bash and reads files inside an **isolated sandbox**, not on the host disk:

```
→ bash  {"command":"ls /c 2>&1; ls /mnt 2>&1; whoami; ls -a $HOME"}
← bash  ls: /c: No such file or directory
        ls: /mnt: No such file or directory
        user
        .  ..  .agents  workspace
```

And the full chain skill → tool → report works in a single turn:

```
→ load_skill      {"skill":"csv-raportti"}
→ read_file       {"filePath":"$HOME/.agents/skills/csv-raportti/references/laskentasaannot.md"}
→ laske_liikevaihto {"path":"data/myynti-2026.csv"}
← {"rows":[{"2026-01":4593},{"2026-02":5294.2},{"2026-03":8170.9}],"total":18058.1}
```

> The agent's own content (instructions, skill, sample data) is in Finnish on purpose —
> it doubles as a check that non-English instructions route skills correctly. The
> documentation is in English.

## Quick start

```bash
npm install
cp .env.example .env.local        # add OPENAI_API_KEY
npm run dev                       # interactive TUI
```

Headless, for scripted runs:

```bash
npm exec -- eve dev --no-ui       # listens on http://127.0.0.1:2000
npm run ask "Tee kuukausiraportti myynnistä tiedostosta data/myynti-2026.csv"
```

`scripts/ask.mjs` creates a session, streams the NDJSON events, and prints tool calls
plus the final text. It is the smallest useful example of driving eve's HTTP API.

## Layout

```
agent/
  agent.ts                         model + reasoning effort
  instructions.md                  always-on system prompt
  sandbox/
    sandbox.ts                     backend selection + network policy
    workspace/                     mirrored into /workspace at session start
      data/myynti-2026.csv
      docs/tietomalli.md
  skills/
    csv-raportti/
      SKILL.md                     description = routing hint for load_skill
      references/laskentasaannot.md
  tools/
    laske_liikevaihto.ts           defineTool + Zod schema, runs in the app runtime
  channels/eve.ts                  auth policy for the HTTP API
scripts/ask.mjs                    HTTP client used for the test runs
docs/                              notes: sandbox, skills, comparison, raw results

eu-agent/                          second agent: self-hosted, EU data residency
  agent/agent.ts                   Azure OpenAI as a direct provider (no AI Gateway)
  agent/sandbox/sandbox.ts         Docker pinned, networkPolicy: deny-all
  agent/channels/eve.ts            httpBasic auth (no Vercel OIDC)
  agent/skills/eu-tarkistus/       data-handling rules the agent must follow
harness-test/harness-eu.ts         HarnessAgent + Vercel Sandbox pinned to fra1
                                   (typechecks; not executed — needs a Vercel login)
```

## Docs

| File | Contents |
| --- | --- |
| [docs/01-sandbox.md](docs/01-sandbox.md) | Backends, Windows pitfalls, limits of the isolation |
| [docs/02-skills.md](docs/02-skills.md) | eve skills vs. Claude Code / agentskills.io |
| [docs/03-eve-vs-ai-sdk-7.md](docs/03-eve-vs-ai-sdk-7.md) | When to use which |
| [docs/04-test-results.md](docs/04-test-results.md) | Every test run, with raw output |
| [docs/05-agentic-loop.md](docs/05-agentic-loop.md) | The write → run → fix loop, and what it needs |
| [docs/06-eu-data-residency.md](docs/06-eu-data-residency.md) | Keeping client data in the EU: eve vs. HarnessAgent |

## Source of truth

The official documentation ships inside the package: `node_modules/eve/docs/README.md`.
It matches the installed version exactly — read that rather than any remembered guidance.
