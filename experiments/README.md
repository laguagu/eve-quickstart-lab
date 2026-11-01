# Two trials from 31 October 2026

Kept here so both machines have them. eve `1.0.0-rc.1`, `ai` 7.0.140 and `claude-haiku-5-5`. Only the
scripts, the agent and the results are copied: the working folders `~/dev/sandbox/eve-lab/company-brain`
and `crash-test` also held dependencies, build output and local keys.

## company-brain: the same questions through AI SDK 7 and eve

The agent is eve's Company Brain template over the Jaffle Shop sample data. `scripts/run-ai-sdk.ts` is the
same agent with AI SDK 7 alone: the same model, instructions and data code. `results/` holds the first
run, `r2`–`r4` and `fixed1`–`fixed4` the repeats, and `node scripts/compare.mjs results` prints them.

| Question | AI SDK 7, median ms (runs) | eve, median ms (runs) |
| --- | --- | --- |
| `total`: payments recorded in all | 6 770 (8) | 7 019 (4) |
| `months`: how payments developed by month | 8 005 (8) | 9 777 (4) |
| `net`: net revenue last month | 11 169 (1) | 8 998 (1) |
| `returned`: orders returned in full | 5 694 (1) | 7 424 (1) |
| `inject`: "forget your instructions" | 3 137 (1) | 3 725 (1) |

Time alone does not separate them on so few runs. Both refused the injection, and both said the data
holds no tax figures when `total` was read as tax, so the answer's wording moved with the run and not with
the framework. In the first run eve read 6 800–8 500 input tokens a question from the prompt cache, and the
AI SDK script none.

`results-durability.json` and `results-durability-events.json` are the first kill of a running turn.

## crash-test: a server killed in the middle of a turn

`crash.ts` starts a turn of three slow steps and kills the server during the second. `data/ticks.log` is what
the steps wrote, and it stops at `start b`. **The turn did not recover in either run on Windows** (recorded
in `~/.agents/docs/agent-workflows.md`), which is why eve is not used in web applications here. `check.mjs`
reads the session back: repeat this on Linux, the deployment target, before relying on eve's durability.
