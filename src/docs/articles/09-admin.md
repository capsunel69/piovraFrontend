# Admin

**Route:** `/admin` — visible only when your Piovra user has **`role: admin`**.

## Typical capabilities

- Inspect **users** connected to Piovra (ids, emails, Google link state, disabled flags where applicable).
- **Usage / operations** helpers exposed by your deployment (exact panels follow the current `Admin.tsx` implementation).
- Calls Piovra **`/v1/admin`** with the same session cookie as the rest of the app.

## Security

- Do not share admin sessions; admin routes are **not** for non-operator accounts.
