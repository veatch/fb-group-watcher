import { summarize, extractPostsFromScreenshots } from "../lib/llm/index.js";
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
    const { screenshots, groupName } = req.body;
    console.log("[1/5] Received request for group:", groupName);
    console.log("[1/5] Screenshots count:", screenshots?.length || 0);

    if (!screenshots || !groupName) {
      console.log("[ERROR] Missing screenshots or groupName");
      return res.status(400).json({ error: "Missing screenshots or groupName" });
    }

    console.log("[2/5] Extracting posts from screenshots using Claude vision...");
    const posts = await extractPostsFromScreenshots(screenshots);
    console.log("[2/5] Extracted", posts.length, "posts from screenshots");

    if (posts.length === 0) {
      return res.status(400).json({ error: "No posts found in screenshots" });
    }

    // Format posts for summarization
    const postsText = posts
      .map((p, i) => `[Post ${i + 1}]\nAuthor: ${p.author}\nTime: ${p.timestamp}\nText: ${p.text}`)
      .join("\n\n---\n\n");

    console.log("[3/5] Starting LLM summarization with provider:", process.env.LLM_PROVIDER || "claude");
    const summary = await summarize(postsText);
    console.log("[4/5] Summary generated, length:", summary?.length || 0, "characters");

    console.log("[5/5] Sending email to:", process.env.RECIPIENT_EMAIL);
    await sendSummaryEmail(summary, groupName);
    console.log("[DONE] Email sent successfully");

    return res.status(200).json({
      success: true,
      summary,
      postCount: posts.length,
      provider: process.env.LLM_PROVIDER || "claude",
    });
  } catch (error) {
    console.error("[ERROR] Failed:", error.message);
    console.error("[ERROR] Stack:", error.stack);
    return res.status(500).json({ error: error.message });
  }
}
