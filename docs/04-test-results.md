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

---

## 6. Self-hosted EU agent (`eu-agent/`)

A second agent in this repo, configured for a client build where data must stay in the
EU. Model: **Azure OpenAI** (`gpt-5.4`) as a direct AI SDK provider, no AI Gateway.
Sandbox: **Docker, `networkPolicy: "deny-all"`**.

### 6a. Full loop in a network-isolated sandbox — dev server

Prompt: *"Analysoi asiakastapahtumat: laske liikevaihto kategorioittain ja kuukausittain.
Kirjoita analyysi Python-skriptiksi /workspace/analyysi.py, aja se, ja korjaa kunnes se
toimii. Noudata eu-tarkistus-skillin sääntöjä, myös käsittelylokia."*

Result — the agent wrote the script, ran it, wrote the processing log, and read the log
back through the authored `kasittelyloki` tool:

| Category | Revenue |
| --- | ---: |
| konsultointi | 19 120,50 € |
| ohjelmisto | 996,00 € |
| tuki | 179,80 € |
| **Total** | **20 296,30 €** (8 transactions) |

Processing log entry: `2026-09-20T16:27:25 analyysi.py 8`

Checked by hand: 249 + 1180.50 + 249 + 89.90 + 2340 + 89.90 + 498 + 15600 = 20296.30 ✓

The skill's rule *"never repeat customer identifiers"* was followed — no `A-17` style IDs
appeared in the answer, only aggregates.

`tokens: in=11043 out=560 cacheRead=10752`

### 6b. Production build and self-hosted server

```
$ npm exec -- eve build
[BUILD] built output at C:\dev-tests\eve-lab\eu-agent\.output      # 11 MB Nitro server

$ PORT=3100 npm exec -- eve start --host 127.0.0.1
eve: initialized 1 sandbox template (0 reused, 1 built).
[START] server listening at http://127.0.0.1:3100/
```

### 6c. Route auth is enforced in production

The first attempt against the production server failed, which is the correct behaviour —
`localDev()` does not authenticate outside `eve dev`, and the scaffold's
`placeholderAuth()` rejects production traffic:

```
{"code":"unauthorized","error":"Authorization is required for this route.","ok":false}
```

After replacing the channel auth with `httpBasic()`:

```
POST /eve/v1/session                   -> HTTP 401
POST /eve/v1/session -u agent:wrong    -> HTTP 401
POST /eve/v1/session -u agent:<correct> -> 200
```

The authenticated turn then ran end to end against the **production** server:

```
→ todo       3 items planned
→ bash       cd /workspace && find . -maxdepth 3 -type f
→ read_file  /workspace/data/asiakastapahtumat.csv
→ write_file /workspace/tarkistus.py
→ bash       python3 /workspace/tarkistus.py
←            exit 0
             uniikit_asiakkaat=4
             suurin_yksittainen_tapahtuma_eur=15600.00
```

Verified by hand: the CSV contains A-17, A-04, A-31, A-52 — four distinct customers ✓

### 6d. One typed API mismatch

```
agent/channels/eve.ts(11,7): error TS2739: Type '{ username: string; password: string; }[]'
is missing the following properties from type 'HttpBasicCredentials': username, password
```

`httpBasic()` takes a single credentials object, not an array. The docs write it as
`httpBasic(credentials, { realm })` — "credentials" plural reads like a list. Typecheck
caught it before it shipped.

## 7. HarnessAgent — typechecked, not executed

`harness-test/harness-eu.ts` compiles against `@ai-sdk/harness` 1.0.117,
`@ai-sdk/harness-claude-code` 1.0.121 and `@ai-sdk/sandbox-vercel` 1.0.117, including
`region: "fra1"` and `failoverRegions: ["arn1"]`.

It was **not run**: it requires a Vercel login (`vercel whoami` reported
`"loggedIn": false`) and an Anthropic credential. Everything in
[06-eu-data-residency.md](06-eu-data-residency.md) about Vercel Sandbox regions comes
from the installed packages' type definitions, not from a live run.
