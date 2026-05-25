# piovraFrontend

React SPA for **Piovra** — tasks, meetings, reminders, notes, agents, work chat, and Comment Sentinel.

All data and auth go through the [Piovra](https://github.com/your-org/piovra) backend API (`VITE_PIOVRA_BASE_URL`) with cookie-based Google sign-in.

## Stack

- React 19 + TypeScript + Vite
- styled-components
- Deployed on Netlify (static `dist/`)

## Local development

```bash
cp env.example .env
# Set VITE_PIOVRA_BASE_URL=http://localhost:3030 (or your Piovra dev server)

npm install
npm run dev
```

Sign in via the Piovra OAuth flow at `{VITE_PIOVRA_BASE_URL}/auth/google`.

## Production (Netlify)

Environment variable:

| Variable | Example |
|----------|---------|
| `VITE_PIOVRA_BASE_URL` | `https://backend.piovra-op.com` |

Build: `npm run build` → publish `dist/`.

Ensure Piovra has matching `PUBLIC_FRONTEND_URL`, `COOKIE_DOMAIN`, and Google OAuth redirect URI.

## Repo rename note

This repo was formerly `capsuna_work`. Rename the GitHub repo to `piovraFrontend` and reconnect Netlify if needed.
