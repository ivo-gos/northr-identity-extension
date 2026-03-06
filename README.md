<div align="center">

# Northr Identity

### Your AI doesn't know you. Fix that — once and for all.

Every AI conversation starts from zero. Northr Identity gives every AI tool the context it needs to understand who you are, what you're working on, and how you want to be helped.

[Get Started](https://identity.northr.ai) · [Install Extension](https://chrome.google.com/webstore/detail/northr-identity) · [View Demo](https://identity.northr.ai/#demo)

---

</div>

## The Problem

You open ChatGPT. You explain your role, your goals, your tech stack, your preferences — again. You switch to Claude. Same thing. Gemini. Same thing. Every conversation starts from zero.

**Northr fixes this.**

Build your identity once. Use it everywhere. Every AI tool finally knows who you are.

## How It Works

```
1. Build your identity    →    Write your narrative blocks at identity.northr.ai (2 min)
2. Install the extension  →    Add to Chrome from the Web Store
3. Press ⌘I in any chat   →    Choose a block (Business, Personal, My Voice, Full Me)
4. AI knows you           →    Your narrative is injected into the conversation
```

## Identity Blocks

Northr uses 4 narrative text blocks instead of fragmented facts. Each block is a natural-language description you control:

| Block | What it covers | Example use |
|-------|---------------|-------------|
| 💼 **Business** | Your work, role, company, tools, goals | Strategy calls, delegation, work tasks |
| ❤️ **Personal** | Family, relationships, personal context | Life advice, personal projects |
| ✍️ **My Voice** | How you communicate, your tone and style | Writing emails, content, messages |
| 🌐 **Full Me** | Everything combined | Deep work sessions, complex asks |

## Supported Platforms

| Platform | Status |
|----------|--------|
| ChatGPT | ✅ Live |
| Claude | ✅ Live |
| Google Gemini | ✅ Live |
| Cursor | 🔜 Coming soon |
| Perplexity | 🔜 Coming soon |
| DeepSeek | 🔜 Coming soon |

## Privacy & Security

Northr is **local-first by design**.

- 🔒 **Your data stays on your device** — identity facts are stored in Chrome's local storage
- 🚫 **No tracking, no ads** — we don't monetize your data
- 🔄 **Sync is optional** — the extension only talks to Northr servers when you explicitly sign in or refresh
- 📖 **Open source** — audit the code yourself

Read our full [Privacy Policy](https://identity.northr.ai/privacy).

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Chrome Extension (Manifest V3)                      │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ ChatGPT  │  │  Claude  │  │  Gemini  │          │
│  │ Content  │  │ Content  │  │ Content  │          │
│  │  Script  │  │  Script  │  │  Script  │          │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘          │
│       │              │              │                │
│       └──────────────┼──────────────┘                │
│                      │                               │
│              ┌───────┴───────┐                       │
│              │  Shared Core  │                       │
│              │  (shared.ts)  │                       │
│              │               │                       │
│              │ 4 Blocks:     │                       │
│              │ Business      │                       │
│              │ Personal      │                       │
│              │ My Voice      │                       │
│              │ Full Me       │                       │
│              └───────┬───────┘                       │
│                      │                               │
│         ┌────────────┼────────────┐                  │
│         │            │            │                  │
│  ┌──────┴──────┐ ┌───┴───┐ ┌─────┴─────┐          │
│  │ chrome.     │ │Popup  │ │ Background│          │
│  │ storage.    │ │  UI   │ │  Worker   │          │
│  │ local       │ │(edit) │ │ (sync)    │          │
│  └─────────────┘ └───────┘ └───────────┘          │
│                                                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│  Supabase: identity_blocks table (auth + sync)       │
└─────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension | Chrome Manifest V3 |
| Language | TypeScript |
| Bundler | esbuild |
| Storage | chrome.storage.local (local-first) |
| Auth & Sync | Supabase |
| UI | Vanilla DOM (zero dependencies in content scripts) |

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
git clone https://github.com/ivo-gos/northr-identity-extension.git
cd northr-identity-extension
npm install
npm run build
```

### Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer Mode** (top right)
3. Click **Load unpacked**
4. Select the `dist/` folder

### Development workflow

```bash
npm run build          # Build once
npm run watch          # Rebuild on file changes
```

After rebuilding, click the refresh icon on the extension card in `chrome://extensions`.

## Project Structure

```
src/
├── content/
│   ├── shared.ts       # Core logic: profiles, facts, menu UI, editor injection
│   ├── chatgpt.ts      # ChatGPT editor detection
│   ├── claude.ts       # Claude editor detection
│   └── gemini.ts       # Gemini editor detection
├── popup/
│   ├── popup.html      # Extension popup UI
│   ├── popup.css       # Popup styles
│   └── popup.ts        # Popup logic (auth, sync, stats)
├── background/
│   └── service-worker.ts  # Background sync, install handler
└── lib/
    ├── supabase.ts     # Supabase client config
    └── identity.ts     # Identity fetching utilities
```

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

## Links

| | |
|---|---|
| 🌐 **Website** | [identity.northr.ai](https://identity.northr.ai) |
| 📊 **Dashboard** | [identity.northr.ai/dashboard](https://identity.northr.ai/dashboard) |
| 🔒 **Privacy** | [identity.northr.ai/privacy](https://identity.northr.ai/privacy) |
| 🐛 **Issues** | [GitHub Issues](https://github.com/ivo-gos/northr-identity-extension/issues) |

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built by [Northr](https://northr.ai)**

*Your AI identity, everywhere.*

</div>
