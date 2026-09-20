import { defineAgent } from "eve";
import { createAzure } from "@ai-sdk/azure";

// Azure OpenAI in an EU region. No Vercel AI Gateway, no US routing:
// the app runtime calls this endpoint directly, and it is the ONLY place
// prompt content leaves the process.
const azure = createAzure({
  resourceName: process.env.AZURE_RESOURCE_NAME,
  apiKey: process.env.AZURE_API_KEY,
  apiVersion: process.env.AZURE_API_VERSION ?? "2024-10-21",
});

export default defineAgent({
  model: azure(process.env.AZURE_CHAT_DEPLOYMENT ?? "gpt-5.4"),
  reasoning: "low",
});
