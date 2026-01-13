# FB Group Watcher

A Chrome extension that summarizes Facebook group posts and sends you an email digest.

## How it works

The extension uses a visual approach to extract posts from Facebook groups. Instead of parsing Facebook's DOM, it captures screenshots of the page and uses Claude's vision capabilities to identify and extract post content.

## Architecture

```
┌─────────────────────┐         ┌─────────────────────┐
│  Chrome Extension   │  HTTP   │   Vercel Function   │
│  - Capture          │────────▶│   - Extract posts   │
│    screenshots      │         │     (Claude Vision) │
│  - Send to backend  │         │   - Summarize (LLM) │
└─────────────────────┘         │   - Send email      │
                                └─────────────────────┘
```

The extension captures 3 screenshots while scrolling through the group feed, then sends them to the backend where Claude Vision extracts the posts and summarizes them.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Deploy to Vercel

```bash
npx vercel --prod
```

### 3. Configure environment variables

Set these in the Vercel dashboard:

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key (required) |
| `RESEND_API_KEY` | Resend API key (required) |
| `RECIPIENT_EMAIL` | Your email address (required) |
| `API_SECRET` | Shared secret for API auth (required) |
| `LLM_PROVIDER` | `claude` (default) or `openai` for summarization |
| `OPENAI_API_KEY` | OpenAI API key (only if using `openai` provider) |

### 4. Configure extension

1. Edit `extension/popup.js` and set `API_URL` to your Vercel deployment URL
2. Copy `extension/config.example.js` to `extension/config.js`
3. Set `API_SECRET` in `config.js` to the same value you used in Vercel. You can generate a secret by running `openssl rand -hex 16` for example

```bash
cp extension/config.example.js extension/config.js
```

Note: `config.js` is gitignored and won't be committed.

### 5. Add extension icons (optional)

Add these files to `extension/`:
- `icon16.png` (16x16)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

### 6. Load the extension

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/` folder

## Usage

1. Navigate to a Facebook group
2. Click the extension icon
3. Click "Summarize & Email" (the extension will scroll and capture screenshots automatically)
4. Check your inbox (or your spam folder if you don't see the email)

## LLM providers

The default provider is Claude (`claude`), which is required for the vision-based post extraction.

Initially OpenAI (`openai`) support was planned, but was not built after Facebook DOM parsing proved problematic.
