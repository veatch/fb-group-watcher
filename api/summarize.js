import { summarize } from "../lib/llm/index.js";
import { sendSummaryEmail } from "../lib/email.js";

export default async function handler(req, res) {
  // CORS headers for extension
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { posts, groupName } = req.body;
    console.log("[1/4] Received request for group:", groupName);
    console.log("[1/4] Posts length:", posts?.length || 0, "characters");

    if (!posts || !groupName) {
      console.log("[ERROR] Missing posts or groupName");
      return res.status(400).json({ error: "Missing posts or groupName" });
    }

    console.log("[2/4] Starting LLM summarization with provider:", process.env.LLM_PROVIDER || "claude");
    const summary = await summarize(posts);
    console.log("[3/4] Summary generated, length:", summary?.length || 0, "characters");

    console.log("[4/4] Sending email to:", process.env.RECIPIENT_EMAIL);
    await sendSummaryEmail(summary, groupName);
    console.log("[DONE] Email sent successfully");

    return res.status(200).json({
      success: true,
      summary,
      provider: process.env.LLM_PROVIDER || "claude",
    });
  } catch (error) {
    console.error("[ERROR] Failed:", error.message);
    console.error("[ERROR] Stack:", error.stack);
    return res.status(500).json({ error: error.message });
  }
}
