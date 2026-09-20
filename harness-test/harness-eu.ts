// HarnessAgent running Claude Code inside a Vercel Sandbox pinned to the EU.
//
// NOT EXECUTED in this lab: it needs a Vercel login (VERCEL_TOKEN or `vercel login`)
// and an Anthropic credential. It is typechecked only. See docs/06-eu-data-residency.md.
//
// The EU-critical lines are `region` and `failoverRegions`. @vercel/sandbox defaults
// to DEFAULT_SANDBOX_REGION = "iad1" (US Virginia). If you do not set these, the
// customer's files are copied to the United States.
import { HarnessAgent } from "@ai-sdk/harness/agent";
import { claudeCode } from "@ai-sdk/harness-claude-code";
import { createVercelSandbox } from "@ai-sdk/sandbox-vercel";

const agent = new HarnessAgent({
  harness: claudeCode,
  sandbox: createVercelSandbox({
    runtime: "node24",
    // EU regions offered by @vercel/sandbox: fra1 (Frankfurt), arn1 (Stockholm),
    // cdg1 (Paris), dub1 (Dublin). lhr1 is London — UK, outside the EU.
    region: "fra1",
    failoverRegions: ["arn1"],
  }),
  instructions:
    "You are a careful analysis assistant. Work only on files in the workspace.",
});

const session = await agent.createSession();
try {
  const result = await agent.stream({
    session,
    prompt: "Write a script that summarises the CSV in the workspace, run it, and fix it until it exits 0.",
  });
  for await (const part of result.stream) {
    if (part.type === "text-delta") process.stdout.write(part.text);
  }
} finally {
  await session.destroy();
}
