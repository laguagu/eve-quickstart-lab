import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description:
    "Reads the processing log from the sandbox. Use it to report what the agent did with the data.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const sandbox = await ctx.getSandbox();
    const log = await sandbox.readTextFile({ path: "kasittelyloki.txt" });
    return { entries: log === null ? [] : log.trim().split(/\r?\n/).filter(Boolean) };
  },
});
