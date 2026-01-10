# FB Group Watcher

A Chrome extension that summarizes Facebook group posts and sends you an email digest.

## Architecture

```
┌─────────────────────┐         ┌─────────────────────┐
│  Chrome Extension   │  HTTP   │   Vercel Function   │
│  - Extract posts    │────────▶│   - Summarize (LLM) │
│  - Send to backend  │         │   - Send email      │
└─────────────────────┘         └─────────────────────┘
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Deploy to Vercel

```bash
npx vercel
```

### 3. Configure environment variables

Set these in the Vercel dashboard:

| Variable | Description |
|----------|-------------|
| `LLM_PROVIDER` | `claude` or `openai` |
| `ANTHROPIC_API_KEY` | Claude API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `RESEND_API_KEY` | Resend API key |
| `RECIPIENT_EMAIL` | Your email address |

### 4. Update extension config

Edit `extension/popup.js` and set `API_URL` to your Vercel deployment URL.

### 5. Add extension icons

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
2. Scroll to load posts you want summarized
3. Click the extension icon
4. Click "Summarize & Email"
5. Check your inbox

## Switching LLM providers

Change `LLM_PROVIDER` in Vercel to switch between `claude` and `openai`.
