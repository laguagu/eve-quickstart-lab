// Runs a command with the Anthropic key under the name both SDKs read. Prints nothing about it.
import { spawn } from "node:child_process";

const [command, ...args] = process.argv.slice(2);
const env = { ...process.env, ANTHROPIC_API_KEY: process.env.ANTHROPIC_USER_API_KEY };
delete env.ANTHROPIC_USER_API_KEY;
const child = spawn(command, args, { stdio: "inherit", env, shell: process.platform === "win32" });
child.on("exit", (code) => process.exit(code ?? 1));
