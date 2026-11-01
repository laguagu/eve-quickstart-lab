import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Runs one slow step and returns when it has finished.",
  inputSchema: z.object({ label: z.string() }),
  async execute({ label }) {
    const log = resolve(process.env.TICK_LOG ?? "data/ticks.log");
    appendFileSync(log, `${new Date().toISOString()} start ${label} pid=${process.pid}\n`);
    await new Promise((done) => setTimeout(done, 6000));
    appendFileSync(log, `${new Date().toISOString()} end   ${label} pid=${process.pid}\n`);
    return { label, finished: true };
  },
});
