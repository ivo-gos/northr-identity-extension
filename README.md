# Northr Identity — Chrome Extension

Your AI identity, stored locally and shared on your terms.
Set it once — every AI tool finally knows who you are.

## Setup

```bash
npm install
npm run build
```

Load `dist/` folder in `chrome://extensions` (Developer Mode).

## Links

- Landing page: https://identity.northr.ai
- Dashboard: https://identity.northr.ai/dashboard

## Architecture

- Manifest V3 Chrome Extension
- TypeScript + esbuild
- Supabase for auth and data sync
- Local-first: identity facts stored in chrome.storage.local
- Profile menu with situation-based fact filtering

## License

MIT
