import { defineAgent } from "eve";
import { anthropic } from "eve/models/anthropic";

export default defineAgent({ model: anthropic("claude-haiku-5-5") });
