import { existsSync, readFileSync } from "node:fs";
for (const l of readFileSync(".env.local", "utf8").split("\n")) { const m = l.match(/^(\w+)=(.*)$/); if (m) process.env[m[1]] = m[2]; }
const id = readFileSync("session.txt", "utf8").trim();
const auth = `Basic ${Buffer.from(`test:${process.env.CRASH_TEST_PASSWORD}`).toString("base64")}`;
const res = await fetch(`http://127.0.0.1:2100/eve/v1/session/${id}/stream?follow=false`, { headers: { authorization: auth }, signal: AbortSignal.timeout(20000) });
console.log("stream", res.status);
const text = await res.text();
const counts = {};
for (const line of text.split("\n")) { if (!line.trim()) continue; const r = JSON.parse(line); for (const f of r.facts ?? []) { counts[f.type] = (counts[f.type] ?? 0) + 1; if (f.type === "turn.settled" || f.type === "session.ended") console.log(r.at, f.type, JSON.stringify(f.data ?? f).slice(0, 220)); } }
console.log(JSON.stringify(counts));
console.log(existsSync("data/ticks.log") ? readFileSync("data/ticks.log", "utf8") : "no log");
