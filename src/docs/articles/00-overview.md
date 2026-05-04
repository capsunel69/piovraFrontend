# Capsuna control panel

Capsuna is the **workspace UI** for tasks, meetings, reminders, notes, contacts, and a built-in **AI chat** that talks to **Piovra** (your agent backend on Google Cloud / your server).

## Sign-in

- You authenticate with **Google**; the app sets a session cookie against Piovra (`piovra_sid`).
- Your **profile** (name, avatar) appears in the top bar; **Sign out** clears the session.

## Piovra connection

- The SPA calls Piovra using `VITE_PIOVRA_BASE_URL` (see `.env` / deployment env).
- Same origin in production often proxies `/v1` to Piovra; in dev you may set the full Piovra URL.
- If requests fail, check the browser **Network** tab and that Piovra is reachable and CORS/cookies allow your origin.

## Data storage

- **Tasks, meetings, reminders, journals (notes), and contacts** are stored in **Piovra’s PostgreSQL** via REST (`/v1/tasks`, `/v1/meetings`, etc.). The UI caches some data in **localStorage** for fast first paint, then reconciles with the API.

## AI assistant

- The **floating chat** sends messages to Piovra **`/v1/orchestrate`** with a **live workspace snapshot** (tasks, meetings, reminders, notes, contacts) so the model can resolve names and ids without extra round-trips.
- Gmail-related skills use your **connected Google account** (OAuth scopes granted at sign-in).
