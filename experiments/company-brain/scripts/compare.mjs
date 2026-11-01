import { readFileSync, readdirSync } from "node:fs";
const find = (v, key, out = []) => { if (v && typeof v === "object") for (const [k, c] of Object.entries(v)) { if (k === key) out.push(c); find(c, key, out); } return out; };
const dir = process.argv[2] ?? "results";
for (const f of readdirSync(dir).filter((n) => /\.json$/.test(n)).sort()) {
  const d = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
  if (d.events) {
    const types = {}; for (const e of d.events) types[e.type] = (types[e.type] ?? 0) + 1;
    const calls = d.events.filter((e) => e.type === "call.requested");
    const usages = find(d.events, "usage");
    console.log(f, d.ms, "ms", "calls", calls.length, JSON.stringify(calls.map((c) => c.data?.toolName ?? c.data?.name ?? c.data?.call?.toolName)));
    if (f.includes("total")) { console.log(" types", JSON.stringify(types)); console.log(" usage sample", JSON.stringify(usages.at(-1))?.slice(0, 400)); }
    else console.log(" usage last", JSON.stringify(usages.at(-1))?.slice(0, 260));
  } else console.log(f, d.ms, "ms", "steps", d.steps, "calls", d.calls.length, JSON.stringify(d.calls.map((c) => c.tool)), JSON.stringify(d.usage)?.slice(0, 260));
}
