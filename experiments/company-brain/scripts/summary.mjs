import { existsSync, readdirSync, readFileSync } from "node:fs";
const rows = [];
for (const dir of (process.env.DIRS ?? "results,results/r2,results/r3,results/r4").split(",")) {
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".json"))) {
    const d = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
    if (d.events) {
      const u = d.events.filter((e) => e.type === "usage.recorded").map((e) => e.data?.usage ?? e.data);
      const sum = (k) => u.reduce((a, x) => a + (x?.[k] ?? 0), 0);
      rows.push({ fw: "eve", id: d.id, ms: d.ms, input: sum("inputTokens"), cached: sum("cacheReadTokens"), output: sum("outputTokens"), calls: d.events.filter((e) => e.type === "call.requested").length, reply: d.result.reply });
    } else rows.push({ fw: "ai-sdk", id: d.id, ms: d.ms, input: d.usage.inputTokens, cached: d.usage.inputTokenDetails?.cacheReadTokens ?? 0, output: d.usage.outputTokens, calls: d.calls.length, reply: d.reply });
  }
}
for (const fw of ["eve", "ai-sdk"]) {
  const r = rows.filter((x) => x.fw === fw); const avg = (k) => Math.round(r.reduce((a, x) => a + x[k], 0) / r.length);
  console.log(fw, "runs", r.length, "avg ms", avg("ms"), "avg input", avg("input"), "avg cached", avg("cached"), "avg output", avg("output"), "avg calls", avg("calls"), "total tokens", r.reduce((a, x) => a + x.input + x.output, 0));
}
for (const id of ["total", "months"]) for (const x of rows.filter((r) => r.id === id).sort((a, b) => a.fw.localeCompare(b.fw))) {
  const t = x.reply;
  console.log(id, x.fw.padEnd(6), x.ms, "1672:" + /1[  .,]?672/.test(t), "622:" + /622/.test(t), "vero:" + /vero/i.test(t), "kasvu:" + (t.match(/[^.\n]*(kasvu|kasvoi|nous)[^.\n]*/i)?.[0] ?? "").trim().slice(0, 90));
}
