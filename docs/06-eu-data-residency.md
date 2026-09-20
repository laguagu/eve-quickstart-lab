# EU data residency: eve vs. HarnessAgent

The question: *for a client build where the data must stay in the EU, which is better?*

**Short answer: self-hosted eve.** It is the only one of the two that can be made to
touch no US infrastructure at all, and it does it without a custom adapter.

`eu-agent/` in this repo is a working proof, and `harness-test/harness-eu.ts` is the
HarnessAgent equivalent with the EU-critical settings marked.

## Where the data actually goes

An agent leaks data at three points, not one. Compare them separately.

| | Self-hosted eve | eve on Vercel | HarnessAgent + Claude Code |
| --- | --- | --- | --- |
| **1. Sandbox** (the customer's files) | Docker on your own host — never leaves | Vercel Sandbox, **default `iad1` = US Virginia** | Vercel Sandbox, same default |
| **2. Model call** (prompts, file excerpts) | any provider you configure | AI Gateway, or a direct provider | Anthropic, or Bedrock/Vertex/Foundry via the adapter |
| **3. Session state** (full history) | `.eve/.workflow-data` on your disk | Vercel Workflow | the harness owns it, inside the sandbox |

Point 1 is the one people forget. The sandbox holds the *raw* customer files, not just
what the model saw.

## Why self-hosted eve wins

eve's self-hosting path is first-class, not a workaround. `eve build` emits a plain Nitro
Node server under `.output/`; `eve start` runs it. Verified in this repo:

```
$ npm exec -- eve build
[BUILD] built output at C:\...\eu-agent\.output      # 11 MB, no Vercel anything

$ PORT=3100 npm exec -- eve start --host 127.0.0.1
[START] server listening at http://127.0.0.1:3100/
```

Each of the three leak points closes with one line of configuration.

### 1. Sandbox — pin it to Docker

Do not use `defaultBackend()`; it would pick `vercel()` if the process ever runs on Vercel.

```ts
// eu-agent/agent/sandbox/sandbox.ts
export default defineSandbox({
  backend: docker({ networkPolicy: "deny-all" }),
});
```

`deny-all` is safe here, and this is the part worth understanding: **the model call does
not happen in the sandbox.** Authored tools and the model client run in the app runtime.
The sandbox only ever executes the agent's own shell commands. So a sandbox with zero
egress still runs the full write-run-fix loop — the customer's files in `/workspace` have
no route out of the container at all.

### 2. Model — a direct provider, no gateway

```ts
// eu-agent/agent/agent.ts
const azure = createAzure({
  resourceName: process.env.AZURE_RESOURCE_NAME,
  apiKey: process.env.AZURE_API_KEY,
});
export default defineAgent({ model: azure(process.env.AZURE_CHAT_DEPLOYMENT) });
```

A string model ID such as `"openai/gpt-5.6"` routes through the Vercel AI Gateway and
needs `AI_GATEWAY_API_KEY`. A provider-authored `LanguageModel` does not — the request
goes straight from your server to the endpoint you named. Any AI SDK provider works, so
this is also where you put LiteLLM, Azure AI Foundry, Bedrock in `eu-central-1`, or a
sovereign endpoint.

### 3. Session state — already local

The default Workflow world writes to `.eve/.workflow-data`. Mount it on persistent
storage and it never leaves the host.

### 4. Auth — you must replace the scaffold

The default `placeholderAuth()` rejects browser traffic in production, which is correct
but means nothing works until you configure a real policy. Verified:

```
POST /eve/v1/session                    -> HTTP 401   (no credentials)
POST /eve/v1/session  -u agent:wrong    -> HTTP 401   (wrong password)
POST /eve/v1/session  -u agent:<ok>     -> 200, turn runs
```

`eu-agent/agent/channels/eve.ts` uses `httpBasic()`, which is enough for
service-to-service access behind a TLS-terminating proxy. For real end users use
`jwtHmac()`, `jwtEcdsa()` or `oidc()` — all ship in `eve/channels/auth` and none of them
requires Vercel.

### 5. Telemetry

eve's CLI collects telemetry by default. Turn it off with `eve telemetry disable`, or
`EVE_TELEMETRY_DISABLED=1` for one command. This is the CLI, not the runtime, but a
client's security review will ask.

## Why HarnessAgent is the harder sell

It is not impossible — it is **possible but conditional**, and the conditions are easy to
get wrong.

### The blocker: one sandbox provider exists

```
@ai-sdk/harness              1.0.117   available
@ai-sdk/harness-claude-code  1.0.121   available
@ai-sdk/sandbox-vercel       1.0.117   available
@ai-sdk/sandbox-docker                 does not exist
@ai-sdk/sandbox-local                  does not exist
```

`HarnessV1SandboxProvider` is a public, implementable interface, so you *could* write a
Docker provider — but you would be maintaining an adapter against an API the docs
themselves call experimental.

### The default region is the US

From `@vercel/sandbox/dist/constants.d.ts`:

```ts
declare const DEFAULT_SANDBOX_REGION = "iad1";   // US Virginia
```

EU regions are available — `fra1` (Frankfurt), `arn1` (Stockholm), `cdg1` (Paris),
`dub1` (Dublin) — and `createVercelSandbox` forwards the full `Sandbox.create` surface,
so this typechecks:

```ts
createVercelSandbox({
  runtime: "node24",
  region: "fra1",
  failoverRegions: ["arn1"],     // must also be EU, or failover exports your data
})
```

Note `lhr1` is London: UK, outside the EU. If you leave `region` unset, the customer's
files are copied to Virginia and nothing warns you.

### Three vendors instead of zero

The adapter supports enterprise model routes (Bedrock, Vertex, Azure AI Foundry), so the
*model* can be EU-hosted. But you are then depending on Vercel's sandbox region config,
plus Anthropic's enterprise routing, plus an experimental bridge — three parties in the
data path rather than none.

## When HarnessAgent is still the right call

If the client's requirement is *"Claude Code's exact behaviour, driven from our backend"*
— its permission model, its compaction, its tool set — then reimplementing that in eve is
worse than accepting the Vercel Sandbox dependency. Pin `region: "fra1"`, pin
`failoverRegions`, route the model through Foundry or Bedrock in an EU region, and get it
reviewed.

For everything else, eve gives you the same write-run-fix loop with fewer parties to the
data.

## Recommendation for a client build

1. **Self-hosted eve**, Docker sandbox with `deny-all`, model on Azure OpenAI or Azure AI
   Foundry in an EU region.
2. Verify the **Azure resource's actual region** — the endpoint hostname does not tell
   you, so check the portal. Also confirm the client's Azure OpenAI agreement covers EU
   data residency for the deployment type in use, and whether abuse-monitoring retention
   is disabled.
3. Persist `.eve/.workflow-data` on encrypted storage in the same jurisdiction.
4. Replace `placeholderAuth()` before anything ships.
5. `eve telemetry disable` in the build environment.
6. Write down which of the three leak points each control covers. A reviewer will ask
   about the sandbox, and "the model is in the EU" does not answer that.

## What this repo proves, and what it does not

**Proven by running it** (see [04-test-results.md](04-test-results.md)):

- `eve build` plus `eve start` self-hosted, no Vercel, real turn completed
- Azure OpenAI as a direct provider, no AI Gateway
- Docker sandbox with `deny-all`, full write-run-fix loop still worked
- `httpBasic()` enforced: 401 without credentials, 401 with wrong ones
- the skill's data-handling rules were followed — aggregates only, no customer IDs in
  the answer

**Not run:** `harness-test/harness-eu.ts` typechecks but was never executed — it needs a
Vercel login this lab did not have. The region facts above are read from the installed
packages' type definitions, not from a live sandbox. Verify `region` on a real run before
promising it to a client.
