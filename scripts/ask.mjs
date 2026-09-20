// Runs one eve agent turn over the HTTP API and prints the tool calls plus the final text.
// Usage: node scripts/ask.mjs "your question"   (EVE_URL defaults to http://127.0.0.1:2000)
const base = process.env.EVE_URL ?? "http://127.0.0.1:2000";
const message = process.argv.slice(2).join(" ") || "Moi";

const created = await fetch(`${base}/eve/v1/session`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ message }),
}).then((r) => r.json());

if (!created.ok) { console.error("create failed", created); process.exit(1); }
console.log(`session ${created.sessionId}\nkysymys: ${message}\n${"-".repeat(64)}`);

const res = await fetch(`${base}/eve/v1/session/${created.sessionId}/stream`);
const reader = res.body.getReader();
const dec = new TextDecoder();
let buf = "", text = "", usage = null, done = false;
const timer = setTimeout(() => { console.error("\n[timeout 240s]"); process.exit(2); }, 240_000);

const clip = (v, n) => { const s = typeof v === "string" ? v : JSON.stringify(v); return s.length > n ? s.slice(0, n) + "…" : s; };

while (!done) {
  const { value, done: end } = await reader.read();
  if (end) break;
  buf += dec.decode(value, { stream: true });
  const lines = buf.split("\n"); buf = lines.pop() ?? "";
  for (const line of lines) {
    if (!line.trim()) continue;
    let ev; try { ev = JSON.parse(line); } catch { continue; }
    const d = ev.data ?? {};
    switch (ev.type) {
      case "actions.requested":
        for (const a of d.actions ?? []) console.log(`  → ${a.toolName}  ${clip(a.input, 220)}`);
        break;
      case "action.result":
        console.log(`  ← ${d.result?.toolName}  ${clip(d.result?.output, 260)}`);
        break;
      case "message.completed":
        text = d.message ?? text;
        break;
      case "step.completed":
        if (d.usage) usage = d.usage;
        break;
      case "turn.failed":
      case "session.failed":
        console.log(`  !! ${ev.type}: ${clip(d, 600)}`);
        done = true; break;
      case "session.waiting":
      case "turn.completed":
        done = true; break;
    }
  }
}
clearTimeout(timer);
console.log(`${"-".repeat(64)}\nVASTAUS:\n${text.trim() || "(tyhjä)"}`);
if (usage) console.log(`\ntokenit: in=${usage.inputTokens} out=${usage.outputTokens} cacheRead=${usage.cacheReadTokens ?? 0}`);
process.exit(0);
