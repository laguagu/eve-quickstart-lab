import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description:
    "Laskee kuukausikohtaisen liikevaihdon CSV-tiedostosta sandboxissa. Palauttaa rivit ja kokonaissumman.",
  inputSchema: z.object({
    path: z.string().describe("CSV-tiedoston polku /workspace-juuresta, esim. data/myynti-2026.csv"),
  }),
  async execute({ path }, ctx) {
    const sandbox = await ctx.getSandbox();
    const file = await sandbox.readTextFile({ path });
    if (file === null) throw new Error(`Tiedostoa ei löytynyt sandboxista: ${path}`);
    const lines = file.trim().split(/\r?\n/).slice(1);

    const byMonth = new Map<string, number>();
    for (const line of lines) {
      const [kuukausi, , kpl, hinta] = line.split(",");
      const arvo = Number(kpl) * Number(hinta);
      if (!Number.isFinite(arvo)) continue;
      byMonth.set(kuukausi, (byMonth.get(kuukausi) ?? 0) + arvo);
    }

    const rows = [...byMonth.entries()].map(([kuukausi, liikevaihto]) => ({
      kuukausi,
      liikevaihto: Number(liikevaihto.toFixed(2)),
    }));

    return {
      source: path,
      rows,
      total: Number(rows.reduce((s, r) => s + r.liikevaihto, 0).toFixed(2)),
    };
  },
});
