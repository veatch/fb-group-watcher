import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function extractPostsFromScreenshots(screenshots) {
  // Process each screenshot and extract posts
  const allPosts = [];

  for (let i = 0; i < screenshots.length; i++) {
    const screenshot = screenshots[i];

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: screenshot.replace(/^data:image\/\w+;base64,/, ""),
              },
            },
            {
              type: "text",
              text: `Extract all Facebook group posts visible in this screenshot. For each post, extract:
- author: The name of the person who posted
- text: The post content. This could be:
  - Regular text written by the author
  - A shared link's title/headline (for link-share posts with a preview card)
  - A description of what was shared (e.g., "Shared a photo", "Shared an event")
- timestamp: When it was posted (e.g., "2h", "Yesterday at 3:45 PM")

IMPORTANT: Include ALL posts, even if they have no regular text. Link-share posts (showing a preview card with an image and headline) should use the link's title as the text.

Return ONLY a JSON array of posts, no other text. Example format:
[{"author": "John Smith", "text": "Post content or shared link title here...", "timestamp": "2h"}]

If no posts are visible, return an empty array: []`,
            },
          ],
        },
      ],
    });

    try {
      const responseText = message.content[0].text;
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const posts = JSON.parse(jsonMatch[0]);
        allPosts.push(...posts);
      }
    } catch (e) {
      console.error(`Failed to parse posts from screenshot ${i + 1}:`, e.message);
    }
  }

  // Deduplicate posts by text content
  const seen = new Set();
  const uniquePosts = allPosts.filter((post) => {
    const key = post.text?.slice(0, 100);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return uniquePosts;
}

export async function summarize(posts) {
  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Summarize each post from this Facebook group. For each post, provide exactly ONE line in this format:

**[Author](Link)** (Time) - One sentence summary of the post content.

If the link is "N/A", just use the author name without a link: **Author** (Time) - Summary.

Keep each summary to a single, concise sentence that captures the main point of the post.

Here are the posts:

${posts}

Output the summaries as a markdown list, one post per line.`,
      },
    ],
  });

  return message.content[0].text;
}
