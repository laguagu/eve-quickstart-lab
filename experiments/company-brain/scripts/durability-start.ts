// Starts a turn and kills the eve server right after the first finished tool call.
import { execSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { Client } from "eve/client";

process.loadEnvFile(".env.local");
const basic = Buffer.from(`company-brain:${process.env.COMPANY_BRAIN_HTTP_PASSWORD}`).toString("base64");
const client = new Client({ baseUrl: "http://127.0.0.1:2000", headers: { authorization: `Basic ${basic}` } });
const message = "Miten kuukausittaiset maksut kehittyivät, ja mikä kuukausi oli paras kokonainen kuukausi?";
const { session, delivery } = await client.sessions.create({ message });
const seen: { type: string; position?: unknown }[] = [];
try {
  for await (const event of delivery.stream()) {
    seen.push({ type: event.type, position: event.meta?.position });
    if (event.type === "call.settled") {
      const line = execSync("netstat -ano").toString().split("\n").find((l) => /:2000\s.*LISTENING/.test(l));
      const pid = line?.trim().split(/\s+/).at(-1);
      await writeFile("results-durability.json", JSON.stringify({ sessionId: session.id ?? session.sessionId ?? delivery.sessionId, killedPid: pid, killedAt: new Date().toISOString(), seen }, null, 1));
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
      console.log("killed server", pid, "after", seen.length, "events");
      process.exit(0);
    }
  }
} catch (error) {
  console.log("stream ended:", String(error).slice(0, 140));
}
