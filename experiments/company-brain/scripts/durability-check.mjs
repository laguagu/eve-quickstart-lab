import { readFileSync } from "node:fs";
for (const l of readFileSync(".env.local", "utf8").split("\n")) { const m = l.match(/^(\w+)=(.*)$/); if (m) process.env[m[1]] = m[2]; }
const { sessionId, killedAt } = JSON.parse(readFileSync("results-durability.json", "utf8"));
const auth = `Basic ${Buffer.from(`company-brain:${process.env.COMPANY_BRAIN_HTTP_PASSWORD}`).toString("base64")}`;
const res = await fetch(`http://127.0.0.1:2000/eve/v1/session/${sessionId}/stream`, { headers: { authorization: auth }, signal: AbortSignal.timeout(30000) });
let text = ""; try { for await (const c of res.body) { text += Buffer.from(c).toString(); if (text.includes("stream.lease-ended") || text.includes("turn.settled")) break; } } catch {}
console.log("killedAt", killedAt);
for (const line of text.split("\n")) {
  if (!line.trim()) continue;
  const r = JSON.parse(line);
  if (r.facts) for (const f of r.facts) {
    const d = f.data ?? f;
    console.log(r.at, f.type ?? f.fact ?? Object.keys(f).join("|"), (f.type ?? "").startsWith("call") ? (d.toolName ?? d.name ?? d.callId ?? "") : "", f.type === "turn.settled" ? JSON.stringify(d).slice(0, 200) : "");
  } else if (r.$eve && r.$eve !== "heartbeat") console.log("transport", r.$eve);
}
