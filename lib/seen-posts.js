import { Redis } from "@upstash/redis";
import { createHash } from "crypto";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Generate a hash for a post based on author and text content
function hashPost(post) {
  const content = `${post.author}:${post.text?.slice(0, 100) || ""}`;
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

// Get the Redis key for a group's seen posts
function getGroupKey(groupName) {
  // Normalize group name to a safe key
  const normalized = groupName.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 50);
  return `seen:${normalized}`;
}

// Filter posts to only those not seen before, and mark them as seen
export async function filterNewPosts(posts, groupName) {
  if (!posts || posts.length === 0) {
    return [];
  }

  const groupKey = getGroupKey(groupName);

  // Hash all posts
  const postHashes = posts.map((post) => ({
    post,
    hash: hashPost(post),
  }));

  // Check which hashes already exist
  const hashes = postHashes.map((p) => p.hash);
  const seenResults = await Promise.all(
    hashes.map((hash) => redis.sismember(groupKey, hash))
  );

  // Filter to only new posts
  const newPosts = postHashes
    .filter((_, index) => !seenResults[index])
    .map((p) => p.post);

  // Mark new posts as seen (add to set)
  if (newPosts.length > 0) {
    const newHashes = postHashes
      .filter((_, index) => !seenResults[index])
      .map((p) => p.hash);
    await redis.sadd(groupKey, ...newHashes);

    // Set expiry on the key (30 days) to avoid unbounded growth
    await redis.expire(groupKey, 30 * 24 * 60 * 60);
  }

  return newPosts;
}
