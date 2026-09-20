# The agentic loop: write → run → fix → repeat

The question this document answers: *can an eve agent work like Claude Code — write a
script, run it, see it fail, fix it, and keep going?*

**Yes.** That loop is eve's default harness, and it needs no configuration. But it only
works on a backend with real binaries. This page shows both halves.

## What the loop actually is

eve's default harness does one unit of AI work per step and decides whether to continue,
wait, or finish. With `bash`, `read_file`, and `write_file` pointed at the sandbox, that
is already the write-run-fix loop — the model writes a file, runs it, reads the exit code
and stderr, and decides what to do next. There is no "agent loop" to author.

## Proof: a failing run that recovers

Prompt (Finnish, translated): *"Create `/workspace/report.py` that uses pandas and prints
monthly sales totals. Run it. If anything fails, fix it and retry until the script runs.
Report exactly what errors occurred and how you solved them."*

The sandbox was the **Docker backend with `networkPolicy: "deny-all"`**. pandas is not in
the image, and the agent could not reach PyPI. The transcript:

```
→ write_file {"path":"/workspace/report.py"}      # imports pandas
→ bash       python /workspace/report.py
←            ModuleNotFoundError: No module named 'pandas'

→ bash       pip install pandas
←            error: externally-managed-environment        (PEP 668)

→ bash       python -m venv .venv
←            ensurepip / python3-venv missing

→ bash       pip install --break-system-packages pandas
←            network unreachable                          ← deny-all held

→ bash       apt-get update && apt-get install -y python3-pandas
←            exit 100: Permission denied                  ← non-root user

→ read_file  /workspace/report.py
→ write_file /workspace/report.py                 # pandas with a csv fallback
→ bash       python /workspace/report.py
←            exit 0
             2026-01: 4593.00 EUR
             2026-02: 5294.20 EUR
             2026-03: 8170.90 EUR
             YHTEENSÄ: 18058.10 EUR
```

Five failed attempts, each diagnosed from a different error, then a working fallback. No
orchestration code — this is the default harness plus three built-in tools.

Two things this incidentally verified:

- **`deny-all` is really enforced.** It was set on the backend factory in
  `agent/sandbox/sandbox.ts`, and pip genuinely could not reach the index.
- **Commands run as a non-root user.** `apt-get` failed with a permission error.
  Package installation belongs in `bootstrap` with `sudo`, or in a custom image.

## The same loop on just-bash does not work

On the just-bash backend (the Windows default when Docker is not running) there is no
`python`, no `git`, no `pip`. The model can write a script but cannot execute it, so the
loop never closes.

A simpler task ran correctly on Docker first try:

```
→ write_file /workspace/analyze.py
→ bash       cd /workspace && python3 analyze.py; echo "EXIT_CODE=$?"
←            exit 0
             Paras kuukausi: 2026-03
             Liikevaihto: 8170.90 EUR
```

The Docker backend also fixed the `$HOME` problem from
[01-sandbox.md](01-sandbox.md): the skill's support files were at a clean
`/home/vercel-sandbox/.agents/skills/csv-raportti/references/laskentasaannot.md` instead
of just-bash's `//.agents/skills/...`.

**If you want the write-run-fix loop on Windows, Docker Desktop has to be running.**
Sandbox startup took roughly 20–25 seconds on first use while the template image was
built; later sessions reuse it.

## eve's loop vs. `HarnessAgent`

These are two different products, and they are easy to confuse.

| | eve's default harness | `HarnessAgent` (AI SDK 7) |
| --- | --- | --- |
| What runs | an agent **you** authored as files | an **existing** runtime: Claude Code, Codex, Pi, Deep Agents, OpenCode |
| Tools | eve's built-ins plus your `defineTool`s | the harness's own native tools |
| History, permissions, compaction | eve owns them | the harness owns them |
| Sandbox | built in, four backends | a separate package (`@ai-sdk/sandbox-vercel`) |
| Maturity | eve 0.63.0, in preview | harness packages marked experimental |

Pick eve's harness when you want your own agent with your own tools and skills. Pick
`HarnessAgent` when you specifically want *Claude Code's behavior*, driven from code:

```ts
const agent = new HarnessAgent({
  harness: claudeCode,
  sandbox: createVercelSandbox({ runtime: 'node24' }),
  instructions: 'You are a careful coding assistant.',
});
```

Bridge-backed harnesses such as Claude Code and Codex require a real network sandbox
provider — they will not run on a toy backend.

## Practical caveats for real work

- **Package installation.** Put it in `bootstrap` (with `sudo`) or bake a custom image.
  Installing mid-turn fights PEP 668, the non-root user, and your own network policy.
- **`deny-all` vs. a working loop.** A locked-down sandbox is the right default for
  sensitive data, but it means the agent cannot fetch dependencies. Decide which you want
  and pre-install accordingly.
- **Persistence.** The Docker backend keeps a container per durable session, so
  `/workspace` survives across turns. Files written in turn 1 are still there in turn 5.
- **Cost of a failed loop.** The pandas run burned five tool round-trips before
  succeeding. Prompt caching absorbed most of it (`cacheRead=11972` of `in=12172`), but an
  unbounded "keep trying until it works" instruction can run long. Bound it.
