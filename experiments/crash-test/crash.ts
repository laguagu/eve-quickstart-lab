// Starts a three-step turn and kills the server in the middle of step b.
import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { Client } from "eve/client";

process.loadEnvFile(".env.local");
const auth = Buffer.from(`test:${process.env.CRASH_TEST_PASSWORD}`).toString("base64");
const client = new Client({ baseUrl: "http://127.0.0.1:2100", headers: { authorization: `Basic ${auth}` } });
rmSync("data/ticks.log", { force: true });
const { delivery } = await client.sessions.create({ message: "Aloita." });
writeFileSync("session.txt", delivery.sessionId);
const until = Date.now() + 60_000;
while (Date.now() < until) {
  if (existsSync("data/ticks.log") && readFileSync("data/ticks.log", "utf8").includes("start b")) {
    const line = execSync("netstat -ano").toString().split("\n").find((l) => /:2100\s.*LISTENING/.test(l));
    const pid = line?.trim().split(/\s+/).at(-1);
    execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    console.log("killed", pid, "at", new Date().toISOString());
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 100));
}
console.log("step b never started");
