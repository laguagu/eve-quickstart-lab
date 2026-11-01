// Asks each question in a new eve session and saves every stream event.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { Client } from "eve/client";

process.loadEnvFile(".env.local");
const basic = Buffer.from(`company-brain:${process.env.COMPANY_BRAIN_HTTP_PASSWORD}`).toString("base64");
const client = new Client({
  baseUrl: process.env.EVE_URL ?? "http://127.0.0.1:2000",
  headers: { authorization: `Basic ${basic}` },
});
const questions = JSON.parse(await readFile("scripts/questions.json", "utf8"));
const out = process.env.RESULTS ?? "results";
const only = process.env.ONLY?.split(",");
await mkdir(out, { recursive: true });

for (const { id, text } of questions.filter((q: { id: string }) => !only || only.includes(q.id))) {
  const started = Date.now();
  const { delivery } = await client.sessions.create({ message: text });
  const events: unknown[] = [];
  for await (const event of delivery.stream()) events.push(event);
  const result = await delivery.result();
  const ms = Date.now() - started;
  await writeFile(`${out}/eve-${id}.json`, JSON.stringify({ id, text, ms, result, events }, null, 1));
  console.log(`\n=== ${id} (${ms} ms, ${result.status}, ${events.length} events)\n${result.reply}`);
}
