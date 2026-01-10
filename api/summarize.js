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

    if (!posts || !groupName) {
      return res.status(400).json({ error: "Missing posts or groupName" });
    }

    const summary = await summarize(posts);
    await sendSummaryEmail(summary, groupName);

    return res.status(200).json({
      success: true,
      summary,
      provider: process.env.LLM_PROVIDER || "claude",
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
