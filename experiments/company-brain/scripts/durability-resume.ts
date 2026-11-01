// Reconnects to the killed session and reads it to the end from position zero.
import { readFile, writeFile } from "node:fs/promises";

process.loadEnvFile(".env.local");
const { sessionId, killedAt } = JSON.parse(await readFile("results-durability.json", "utf8"));
const auth = `Basic ${Buffer.from(`company-brain:${process.env.COMPANY_BRAIN_HTTP_PASSWORD}`).toString("base64")}`;
const res = await fetch(`http://127.0.0.1:2000/eve/v1/session/${sessionId}/stream`, {
  headers: { authorization: auth }, signal: AbortSignal.timeout(150_000),
});
console.log("stream status", res.status);
const events: any[] = [];
let buffer = "";
const decoder = new TextDecoder();
try {
  outer: for await (const chunk of res.body as any) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line);
      events.push(event);
      if (event.type === "turn.settled" || event.type === "session.ended") break outer;
    }
  }
} catch (error) { console.log("read ended:", String(error).slice(0, 140)); }
const reply = events.filter((e) => e.type === "content.completed").map((e) => e.data?.text ?? e.data?.part?.text ?? "").join("\n");
const calls = events.filter((e) => e.type === "call.requested").map((e) => e.data);
const types: Record<string, number> = {};
for (const e of events) types[e.type] = (types[e.type] ?? 0) + 1;
await writeFile("results-durability-events.json", JSON.stringify(events, null, 1));
console.log(JSON.stringify(types));
console.log("killedAt", killedAt, "resumedAt", new Date().toISOString());
console.log("call ids", JSON.stringify(calls.map((c) => c.callId ?? c.id ?? c.toolCallId)));
console.log("last event", events.at(-1)?.type, JSON.stringify(events.at(-1)?.data ?? {}).slice(0, 300));
console.log("reply:", reply.slice(0, 500));
