import { summarize, extractPostsFromScreenshots } from "../lib/llm/index.js";
import { sendSummaryEmail } from "../lib/email.js";
import { filterNewPosts } from "../lib/seen-posts.js";

export default async function handler(req, res) {
  // CORS headers for extension
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Secret");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verify API secret
  const apiSecret = req.headers["x-api-secret"];
  if (!apiSecret || apiSecret !== process.env.API_SECRET) {
    console.log("[ERROR] Invalid or missing API secret");
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { screenshots, groupName } = req.body;
    console.log("[1/5] Received request for group:", groupName);
    console.log("[1/5] Screenshots count:", screenshots?.length || 0);

    if (!screenshots || !groupName) {
      console.log("[ERROR] Missing screenshots or groupName");
      return res.status(400).json({ error: "Missing screenshots or groupName" });
    }

    console.log("[2/6] Extracting posts from screenshots using Claude vision...");
    const allPosts = await extractPostsFromScreenshots(screenshots);
    console.log("[2/6] Extracted", allPosts.length, "posts from screenshots");

    if (allPosts.length === 0) {
      return res.status(400).json({ error: "No posts found in screenshots" });
    }

    console.log("[3/6] Filtering to new posts only...");
    const newPosts = await filterNewPosts(allPosts, groupName);
    console.log("[3/6] Found", newPosts.length, "new posts (", allPosts.length - newPosts.length, "already seen)");

    if (newPosts.length === 0) {
      console.log("[DONE] No new posts to summarize");
      return res.status(200).json({
        success: true,
        message: "No new posts since last check",
        postCount: 0,
        totalExtracted: allPosts.length,
      });
    }

    // Format posts for summarization
    const postsText = newPosts
      .map((p, i) => `[Post ${i + 1}]\nAuthor: ${p.author}\nTime: ${p.timestamp}\nText: ${p.text}`)
      .join("\n\n---\n\n");

    console.log("[4/6] Starting LLM summarization with provider:", process.env.LLM_PROVIDER || "claude");
    const summary = await summarize(postsText);
    console.log("[5/6] Summary generated, length:", summary?.length || 0, "characters");

    console.log("[6/6] Sending email to:", process.env.RECIPIENT_EMAIL);
    await sendSummaryEmail(summary, groupName);
    console.log("[DONE] Email sent successfully");

    return res.status(200).json({
      success: true,
      summary,
      postCount: newPosts.length,
      totalExtracted: allPosts.length,
      provider: process.env.LLM_PROVIDER || "claude",
    });
  } catch (error) {
    console.error("[ERROR] Failed:", error.message);
    console.error("[ERROR] Stack:", error.stack);
    return res.status(500).json({ error: error.message });
  }
}
