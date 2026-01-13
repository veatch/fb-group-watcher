import { API_SECRET } from "./config.js";

const API_URL = "https://fb-group-watcher.vercel.app/api/summarize";

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url?.includes("facebook.com/groups/")) {
    document.getElementById("not-group").classList.remove("hidden");
    document.getElementById("main-content").classList.add("hidden");
    return;
  }

  // Get group name from the page
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const groupNameEl =
          document.querySelector('h1 a[href*="/groups/"]') ||
          document.querySelector('a[aria-label][href*="/groups/"]');
        return groupNameEl?.textContent || "Facebook Group";
      },
    });

    document.getElementById("group-name").textContent = results[0].result;
    document.getElementById("post-count").textContent = "—";
  } catch (error) {
    setStatus("Failed to get group info: " + error.message, "error");
    document.getElementById("summarize-btn").disabled = true;
  }
}

function setStatus(message, type) {
  const statusEl = document.getElementById("status");
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.classList.remove("hidden");
}

async function captureScreenshots() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const screenshots = [];

  // Get post elements and scroll each into view for complete capture
  const [{ result: postCount }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      // Find all top-level posts (not comments)
      const feed = document.querySelector('[role="feed"]');
      if (!feed) return 0;

      const articles = feed.querySelectorAll('[role="article"]');
      const posts = [];
      articles.forEach((article) => {
        // Skip nested articles (comments)
        if (!article.parentElement?.closest('[role="article"]')) {
          posts.push(article);
        }
      });

      // Store posts globally so we can access them in subsequent calls
      window.__fbGroupWatcherPosts = posts;
      return posts.length;
    },
  });

  if (postCount === 0) {
    // Fallback to simple scrolling if no posts found
    setStatus("No posts found, using fallback...", "loading");
    const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "jpeg", quality: 70 });
    return [screenshot];
  }

  // Capture screenshots by scrolling each post into view
  const numCaptures = Math.min(postCount, 5); // Capture up to 5 posts
  const postsPerCapture = Math.max(1, Math.floor(postCount / numCaptures));

  for (let i = 0; i < numCaptures; i++) {
    const postIndex = i * postsPerCapture;
    setStatus(`Capturing post ${postIndex + 1} of ${postCount}...`, "loading");

    // Scroll the post into view (centered)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (index) => {
        const posts = window.__fbGroupWatcherPosts;
        if (posts && posts[index]) {
          posts[index].scrollIntoView({ behavior: "instant", block: "center" });
        }
      },
      args: [postIndex],
    });

    // Wait for scroll and lazy-loaded content to render
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Capture screenshot
    const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "jpeg", quality: 70 });
    screenshots.push(screenshot);
  }

  // Scroll back to top
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      delete window.__fbGroupWatcherPosts;
      window.scrollTo(0, 0);
    },
  });

  return screenshots;
}

async function handleSummarize() {
  const btn = document.getElementById("summarize-btn");
  btn.disabled = true;

  try {
    const screenshots = await captureScreenshots();

    // Get group name
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [{ result: groupName }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const groupNameEl =
          document.querySelector('h1 a[href*="/groups/"]') ||
          document.querySelector('a[aria-label][href*="/groups/"]');
        return groupNameEl?.textContent || "Facebook Group";
      },
    });

    setStatus("Sending to server for processing...", "loading");

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Secret": API_SECRET,
      },
      body: JSON.stringify({
        screenshots,
        groupName,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to summarize");
    }

    document.getElementById("post-count").textContent = data.totalExtracted || data.postCount || "—";

    if (data.postCount === 0) {
      setStatus(`No new posts since last check (${data.totalExtracted} total seen)`, "success");
    } else {
      setStatus(`Summary sent! (${data.postCount} new posts)`, "success");
    }
  } catch (error) {
    setStatus("Error: " + error.message, "error");
  } finally {
    btn.disabled = false;
  }
}

async function handleDebug() {
  const btn = document.getElementById("debug-btn");
  btn.disabled = true;

  try {
    const screenshots = await captureScreenshots();

    // Get group name
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [{ result: groupName }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const groupNameEl =
          document.querySelector('h1 a[href*="/groups/"]') ||
          document.querySelector('a[aria-label][href*="/groups/"]');
        return groupNameEl?.textContent || "Facebook Group";
      },
    });

    // Log debug info
    console.log("=== DEBUG: Screenshot Capture ===");
    console.log("Group Name:", groupName);
    console.log("Screenshots captured:", screenshots.length);
    console.log("Screenshot sizes:", screenshots.map((s) => Math.round(s.length / 1024) + " KB"));
    console.log("Total payload size:", Math.round(JSON.stringify({ screenshots, groupName }).length / 1024) + " KB");
    console.log("=== END DEBUG ===");

    // Open each screenshot in a new tab
    for (const screenshot of screenshots) {
      await chrome.tabs.create({ url: screenshot, active: false });
    }

    setStatus(`Captured ${screenshots.length} screenshots (opened in new tabs)`, "success");
  } catch (error) {
    setStatus("Error: " + error.message, "error");
    console.error("Debug error:", error);
  } finally {
    btn.disabled = false;
  }
}

document.getElementById("summarize-btn").addEventListener("click", handleSummarize);
document.getElementById("debug-btn").addEventListener("click", handleDebug);
init();
