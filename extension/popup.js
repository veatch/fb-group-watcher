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

  // Get viewport height for scrolling
  const [{ result: viewportHeight }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.innerHeight,
  });

  // Capture initial screenshot (JPEG at 70% quality to reduce size)
  setStatus("Capturing screenshots (1/3)...", "loading");
  let screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "jpeg", quality: 70 });
  screenshots.push(screenshot);

  // Scroll and capture more screenshots (reduced to 3 total)
  for (let i = 1; i < 3; i++) {
    setStatus(`Capturing screenshots (${i + 1}/3)...`, "loading");

    // Scroll down
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (scrollAmount) => {
        window.scrollBy(0, scrollAmount);
      },
      args: [viewportHeight * 0.8], // Scroll 80% of viewport to ensure overlap
    });

    // Wait for content to load
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Capture screenshot
    screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "jpeg", quality: 70 });
    screenshots.push(screenshot);
  }

  // Scroll back to top
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.scrollTo(0, 0),
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

    document.getElementById("post-count").textContent = data.postCount || "—";
    setStatus(`Summary sent to your email! (${data.postCount} posts found)`, "success");
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
