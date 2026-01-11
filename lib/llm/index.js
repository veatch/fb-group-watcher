import { summarize as claudeSummarize, extractPostsFromScreenshots as claudeExtract } from "./claude.js";
import { summarize as openaiSummarize } from "./openai.js";

export async function summarize(posts) {
  const provider = process.env.LLM_PROVIDER || "claude";

  if (provider === "openai") {
    return openaiSummarize(posts);
  }

  return claudeSummarize(posts);
}

export async function extractPostsFromScreenshots(screenshots) {
  // Vision extraction currently only supported with Claude
  return claudeExtract(screenshots);
}
