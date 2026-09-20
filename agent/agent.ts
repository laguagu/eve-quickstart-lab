import { defineAgent } from "eve";
import { openai } from "eve/models/openai";

export default defineAgent({
  // Direct OpenAI call using OPENAI_API_KEY (no AI Gateway).
  // Swap for the string "openai/gpt-5.6-luna-fast" to route through the Gateway instead.
  model: openai("gpt-5.6-luna"),
  reasoning: "low",
});
