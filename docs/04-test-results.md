# Test results

Environment: Windows 11 Pro 26200, Node 24.18.0, eve 0.63.0, model `gpt-5.6-luna`
(direct OpenAI call via the `eve/models/openai` helper, no AI Gateway).

Two sandbox backends were exercised: **just-bash** (Docker Desktop not running) and
**docker** (Docker Desktop running).

## 1. Scaffold and compile

```
$ npx eve@latest init file-agent
$ npm exec -- eve info

Compile       ready
Diagnostics   0 errors, 0 warnings
Instructions  instructions.md (system)
Skills        1 skill
Tools         11 tools

Create    POST /eve/v1/session
Messages  POST /eve/v1/session/:sessionId
Stream    GET  /eve/v1/session/:sessionId/stream
```

11 tools = 10 built-in plus 1 authored. Read from the compiled manifest:
`bash`, `read_file`, `write_file`, `todo`, `web_fetch`, `load_skill`, `ask_question`,
`task_cancel`, `web_search`, `agent` (self-delegation), plus `laske_liikevaihto`.

`glob` and `grep` are **not** on by default — they are added explicitly
(`eve/tools/glob`, `eve/tools/grep`).

### Two compile errors, both mine

```
Expected the sandbox export "default" from "sandbox/sandbox.ts" to match the public
eve shape. The "revalidationKey" field can only be set when "bootstrap" is set.
```

```
agent/tools/laske_liikevaihto.ts(13,19): error TS18047: 'file' is possibly 'null'.
```

Both stated exactly what to fix. No guesswork.

## 2. Reading files from the sandbox — just-bash

Prompt: *"Mitä tiedostoja on /workspace/data kansiossa?"*

```
→ bash  {"command":"find /workspace/data -maxdepth 2 -type f -printf '%P\n' | sort"}
← bash  {"exitCode":0,"stdout":"myynti-2026.csv\n"}

ANSWER: `/workspace/data`-kansiossa on yksi tiedosto: `myynti-2026.csv`
tokens: in=6905 out=38 cacheRead=6820
```

The seeded files (`agent/sandbox/workspace/**`) were in place. Prompt caching hit on the
very first turn.

## 3. Isolation — just-bash

Prompt: *"Run in bash: `ls /c; ls /mnt; cat /etc/hostname; whoami; ls -a $HOME`"*

```
ls: /c: No such file or directory
ls: /mnt: No such file or directory
cat: /etc/hostname: No such file or directory
user
.  ..  .agents  workspace
```

Host drives are not visible. just-bash's virtual filesystem lives under
`.eve/sandbox-cache/just-bash/sessions/<session-id>/`.

**Limit:** this isolates the model's bash, not your tool code. `defineTool` functions run
in the app runtime with the full `process.env`.

## 4. Skill plus authored tool — just-bash

Prompt: *"Tee kuukausiraportti myynnistä. Käytä laske_liikevaihto-työkalua tiedostoon
data/myynti-2026.csv ja noudata csv-raportti-skillin sääntöjä."*

```
→ load_skill        {"skill":"csv-raportti"}
→ bash              {"command":"pwd && ls -la /workspace && find /workspace -maxdepth 3 -type f"}
→ read_file         {"filePath":"/workspace/docs/tietomalli.md"}
→ read_file         {"filePath":"/workspace/skills/csv-raportti/references/laskentasaannot.md"}
← read_file         File not found                        ← documented fallback path unused
→ bash              {"command":"find \"$HOME/.agents/skills\" -path '*laskentasaannot.md'"}
← bash              //.agents/skills/csv-raportti/references/laskentasaannot.md
→ read_file         {"filePath":"$HOME/.agents/skills/csv-raportti/references/laskentasaannot.md"}
← read_file         "# Laskentasäännöt\n- Liikevaihto pyöristetään kahteen desimaaliin..."
→ laske_liikevaihto {"path":"data/myynti-2026.csv"}
← {"source":"data/myynti-2026.csv",
   "rows":[{"kuukausi":"2026-01","liikevaihto":4593},
           {"kuukausi":"2026-02","liikevaihto":5294.2},
           {"kuukausi":"2026-03","liikevaihto":8170.9}],
   "total":18058.1}
```

The output followed the skill's rules (two decimals, a `YHTEENSÄ` row, source file named):

| Month | Revenue (€) |
| --- | ---: |
| 2026-01 | 4 593,00 |
| 2026-02 | 5 294,20 |
| 2026-03 | 8 170,90 |
| **YHTEENSÄ** | **18 058,10** |

Checked by hand: `120 × 19.90 + 45 × 49.00 = 4593.00` ✓

`tokens: in=8312 out=189 cacheRead=7900`

### Issue found

The model first looked for `references/laskentasaannot.md` under
`/workspace/skills/csv-raportti/...` (the documented fallback) and got *File not found*.
The real path was `$HOME/.agents/skills/...`, but on just-bash `$HOME` is `/`, so `find`
printed `//.agents/skills/...`. The model recovered with one extra `find`, but that is a
wasted round-trip.

**Confirmed fixed on Docker** (section 5): the path was a clean
`/home/vercel-sandbox/.agents/skills/csv-raportti/references/laskentasaannot.md`.

## 5. The write → run → fix loop — docker

Full transcripts in [05-agentic-loop.md](05-agentic-loop.md). Summary:

| Run | Task | Result |
| --- | --- | --- |
| A | write `analyze.py`, run it with python | exit 0 on the first attempt |
| B | write `report.py` using pandas (not installed, network `deny-all`) | 5 failed attempts, then a working csv fallback |

Run B incidentally verified two things: the `deny-all` network policy was genuinely
enforced (pip could not reach PyPI), and sandbox commands run as a non-root user
(`apt-get` failed with a permission error).

Sandbox startup on the Docker backend took roughly 20–25 seconds on first use while the
template image was built.

## What was NOT tested

These rest on documentation only (`node_modules/eve/docs/`), not on a run:

- **Vercel Sandbox** and hosted deployment (`eve deploy`, Agent Runs observability).
- **microsandbox** — not supported on Windows.
- **Channels** (Slack/Discord), **subagents**, **schedules**, **connections** (MCP),
  **evals** (`eve eval`), **compaction**.
- **The `bootstrap` hook.** `sandbox.ts` does not define one.
- **`HarnessAgent`.** The comparison in [03](03-eve-vs-ai-sdk-7.md) and
  [05](05-agentic-loop.md) is read from the AI SDK 7 docs, not executed.

## Reproducing

```bash
npm install
cp .env.example .env.local     # OPENAI_API_KEY
npm exec -- eve dev --no-ui &

npm run ask "Mitä tiedostoja on /workspace/data kansiossa?"
npm run ask "Aja bashilla: ls /c 2>&1; whoami; ls -a \$HOME"
npm run ask "Tee kuukausiraportti myynnistä tiedostosta data/myynti-2026.csv"

# needs Docker Desktop running:
npm run ask "Tee /workspace/report.py joka käyttää pandas-kirjastoa. Aja se. Jos jokin ei onnistu, korjaa ja yritä uudelleen."
```
