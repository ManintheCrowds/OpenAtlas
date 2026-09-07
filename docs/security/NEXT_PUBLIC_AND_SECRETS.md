# `NEXT_PUBLIC_*` variables and brain-map auth

## SQLite and admin session (server-only)

- **Database:** Alignment, survey, and moderation data use **`better-sqlite3`** on the server only (`OPENGRIMOIRE_DB_PATH`, default `data/opengrimoire.sqlite`). Clients never open the DB file.
- **Admin session:** **`OPENGRIMOIRE_SESSION_SECRET`** signs the `opengrimoire_session` cookie. **`OPENGRIMOIRE_ADMIN_PASSWORD`** / **`OPENGRIMOIRE_ADMIN_PASSWORD_HASH`** authenticate `/login`. Never prefix secrets with `NEXT_PUBLIC_`.

SQLite has no row-level security; **authorization is enforced in Route Handlers** (public alignment = optional header gate; admin = valid session cookie).

## Brain map graph (`/api/brain-map/graph`)

When **`BRAIN_MAP_SECRET`** is set, the route allows access if **either**:

1. **`x-brain-map-key`** matches `BRAIN_MAP_SECRET` (timing-safe compare), or  
2. The request carries a valid **OpenGrimoire operator session** cookie (`opengrimoire_session` after `POST /api/auth/login`).

Anonymous browsers without the header get **401**. The in-app brain map uses **`fetch(..., { credentials: 'include' })`** so logged-in operators receive the graph without putting the server secret in the bundle.

**Static bypass:** Files may still exist under `public/` for the server route to read, but **direct** requests to `/brain-map-graph.json`, `/brain-map-graph.local.json`, renamed backups of those files (e.g. `.bak`, `.pre_e2e_backup`), and **percent-encoded variants** of those paths are **blocked** (404) by [`src/middleware.ts`](../../src/middleware.ts) after pathname normalize. Clients must use `GET /api/brain-map/graph` with your chosen auth posture. Middleware is a compensating denylist while those files remain on the static root — relocation off `public/` is the durable control. With `src/app`, middleware **must** live under `src/` — a root-level `middleware.ts` is ignored by Next.js. Do not leave vault-inclusive graph copies under `public/` with alternate extensions.

**Legacy:** The UI may still set `x-brain-map-key` from **`NEXT_PUBLIC_BRAIN_MAP_SECRET`**. **Important:** any `NEXT_PUBLIC_*` value is readable from the client JavaScript bundle — treat it as **obfuscation**, not a real secret. Prefer operator login + cookie for gated deployments.

**Implications:**

- For public-internet deployments that must not expose graph JSON, set **`BRAIN_MAP_SECRET`**, **omit** `NEXT_PUBLIC_BRAIN_MAP_SECRET`, and rely on **operator session** (or server-side agents with the header).
- Additional hardening options: short-lived signed URLs, internal-only hosting, VPN.

Document the chosen posture in your deployment runbook.

## Debug flags

- **`NEXT_PUBLIC_DEBUG_VISUALIZATION`**: enables verbose visualization hook logging. **Do not set in production** when connected to real survey data.
