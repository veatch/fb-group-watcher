import OpenAI from "openai";

const client = new OpenAI();

export async function summarize(posts) {
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 1024,
    messages: [
      {
        role: "system",
        content: `You are summarizing recent posts from a Facebook group. Create a concise, scannable summary that highlights:
- Key topics and themes being discussed
- Important announcements or events
- Notable questions or requests from members
- Any trending or highly-engaged discussions

Provide a well-organized summary in markdown format. Use headers and bullet points for readability. Keep it concise but informative.`,
      },
      {
        role: "user",
        content: posts,
      },
    ],
  });

  return response.choices[0].message.content;
}
