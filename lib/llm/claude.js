import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function summarize(posts) {
  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are summarizing recent posts from a Facebook group. Create a concise, scannable summary that highlights:
- Key topics and themes being discussed
- Important announcements or events
- Notable questions or requests from members
- Any trending or highly-engaged discussions

Here are the posts:

${posts}

Provide a well-organized summary in markdown format. Use headers and bullet points for readability. Keep it concise but informative.`,
      },
    ],
  });

  return message.content[0].text;
}
