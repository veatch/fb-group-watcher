const API_URL = "https://fb-group-watcher.vercel.app/api/summarize";

let extractedData = null;

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url?.includes("facebook.com/groups/")) {
    document.getElementById("not-group").classList.remove("hidden");
    document.getElementById("main-content").classList.add("hidden");
    return;
  }

  // Inject content script and extract posts
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPosts,
    });

    extractedData = results[0].result;

    document.getElementById("group-name").textContent = extractedData.groupName;
    document.getElementById("post-count").textContent =
      extractedData.posts.length;

    if (extractedData.posts.length === 0) {
      setStatus("No posts found. Try scrolling down to load more.", "error");
      document.getElementById("summarize-btn").disabled = true;
    }
  } catch (error) {
    setStatus("Failed to extract posts: " + error.message, "error");
    document.getElementById("summarize-btn").disabled = true;
  }
}

async function scrollAndExtractPosts() {
  // Scroll three times to load more posts
  for (let i = 0; i < 3; i++) {
    // Scroll to bottom of page
    window.scrollTo(0, document.body.scrollHeight);
    
    // Wait for content to load (Facebook uses lazy loading)
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Wait a bit more after final scroll to ensure all content is loaded
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Now extract posts
  return extractPosts();
}

function extractPosts() {
  // Get group name from the page
  const groupNameEl =
    document.querySelector('h1 a[href*="/groups/"]') ||
    document.querySelector('a[aria-label][href*="/groups/"]');
  const groupName = groupNameEl?.textContent || "Facebook Group";

  // Find post containers - Facebook uses various class patterns
  const postContainers = document.querySelectorAll('[role="article"]');

  const posts = [];

  postContainers.forEach((container, index) => {
    // Skip if this doesn't look like a group post
    if (!container.closest('[data-pagelet*="GroupFeed"]') &&
        !container.closest('[role="feed"]')) {
      return;
    }

    // Extract author
    const authorEl = container.querySelector(
      'a[role="link"] strong, h4 a, [data-ad-preview="message"] a'
    );
    const author = authorEl?.textContent || "Unknown";

    // Extract post text
    const textEl = container.querySelector(
      '[data-ad-preview="message"], [data-ad-comet-preview="message"], div[dir="auto"]'
    );
    const text = textEl?.textContent || "";

    // Extract timestamp
    const timeEl = container.querySelector("abbr, a[href*='permalink'] span");
    const timestamp = timeEl?.textContent || "";

    // Extract engagement metrics if visible
    const likesEl = container.querySelector('[aria-label*="reaction"]');
    const commentsEl = container.querySelector('[aria-label*="comment"]');

    if (text.trim()) {
      posts.push({
        index: index + 1,
        author,
        text: text.slice(0, 1000), // Limit text length
        timestamp,
        likes: likesEl?.textContent || "0",
        comments: commentsEl?.textContent || "0",
      });
    }
  });

  return { groupName, posts };
}

function setStatus(message, type) {
  const statusEl = document.getElementById("status");
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.classList.remove("hidden");
}

async function handleSummarize() {
  const btn = document.getElementById("summarize-btn");
  btn.disabled = true;

  // Check if we have initial data, if not try to get it first
  if (!extractedData) {
    setStatus("Extracting initial posts...", "loading");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractPosts,
      });
      extractedData = results[0].result;
    } catch (error) {
      setStatus("Error: " + error.message, "error");
      btn.disabled = false;
      return;
    }
  }

  setStatus("Scrolling to load more posts...", "loading");

  try {
    // Get the current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Scroll three times and extract posts
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrollAndExtractPosts,
    });

    extractedData = results[0].result;

    // Check if extraction was successful
    if (!extractedData || !extractedData.posts) {
      throw new Error("Failed to extract posts. Please try again.");
    }

    // Update post count display
    document.getElementById("post-count").textContent =
      extractedData.posts.length;

    if (extractedData.posts.length === 0) {
      throw new Error("No posts found after scrolling. Please try again.");
    }

    setStatus("Extracting and summarizing posts...", "loading");

    // Format posts for the API
    const postsText = extractedData.posts
      .map(
        (p) =>
          `[Post ${p.index}] ${p.author} (${p.timestamp}):\n${p.text}\nReactions: ${p.likes}, Comments: ${p.comments}`
      )
      .join("\n\n---\n\n");

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        posts: postsText,
        groupName: extractedData.groupName,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to summarize");
    }

    setStatus(`Summary sent to your email! (via ${data.provider})`, "success");
  } catch (error) {
    setStatus("Error: " + error.message, "error");
  } finally {
    btn.disabled = false;
  }
}

document.getElementById("summarize-btn").addEventListener("click", handleSummarize);
init();
