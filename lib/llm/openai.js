import OpenAI from "openai";

const client = new OpenAI();

export async function summarize(posts) {
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 2048,
    messages: [
      {
        role: "system",
        content: `Summarize each post from this Facebook group. For each post, provide exactly ONE line in this format:

**[Author](Link)** (Time) - One sentence summary of the post content.

If the link is "N/A", just use the author name without a link: **Author** (Time) - Summary.

Keep each summary to a single, concise sentence that captures the main point of the post.

Output the summaries as a markdown list, one post per line.`,
      },
      {
        role: "user",
        content: posts,
      },
    ],
  });

  return response.choices[0].message.content;
}
