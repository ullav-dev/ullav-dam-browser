# CLAUDE.md — ullav-dam-browser

## Project

Next.js 16 frontend for the Ullav Digital Asset Management system.

## Dev server

```bash
npm run dev   # http://localhost:3002
```

## Key conventions

- **Framework**: Next.js 16.1.6, React 19, TypeScript, Tailwind CSS v4
- **Theme**: Blue/slate colour scheme (`blue-700` primary, `slate-*` greys)
- **No i18n** — this app has a single locale (English only)
- **Proxy file**: `src/proxy.ts` (Next.js 16 uses `proxy.ts`, not `middleware.ts`)
- **Auth storage**: `dam_auth` key in `localStorage`

## API proxying

All API calls from the browser go through the proxy to avoid CORS:

| Browser path | Forwarded to | Notes |
|---|---|---|
| `/api/*` | `$API_URL/*` | Strips `/api` prefix |
| `/auth-api/*` | `$AUTH_URL/*` | Strips `/auth-api` prefix |

Environment variables (`.env.local`):
- `API_URL` — DAM server base URL (default `http://localhost:8080`)
- `AUTH_URL` — Auth service base URL (default `http://localhost:8081`)

## API clients

- `src/lib/dam-api.ts` — typed wrappers for all `ullav-dam-server` endpoints
- `src/lib/auth-api.ts` — typed wrappers for `ullav-user-management` endpoints

## Page routes

| Route | Description |
|---|---|
| `/` | Landing page |
| `/login` | Sign in / Register / Password reset |
| `/browse` | Main 3-column DAM browser (protected) |
| `/auth/confirm-email` | Email confirmation callback |
| `/auth/password-reset` | Password reset callback |

## Component overview

| Component | Purpose |
|---|---|
| `CategoryTree` | Hierarchical category browser; builds tree from flat list using `parent_id` |
| `AssetGrid` | Thumbnail grid; client-side filtering by search + category |
| `AssetDetails` | Right-panel metadata editor; handles save/delete/category assignment |
| `UploadModal` | Two-step upload: POST `/assets` then POST `/assets/:id/upload` |
| `TermsModal` | Terms of Service modal (shown at registration) |
| `DisclaimerModal` | Disclaimer modal (shown at registration) |

## Category filtering approach

`GET /assets` returns assets without category info. Categories are lazy-loaded
via `GET /assets/:id` in background batches of 5. Until an asset's categories are
loaded, it is shown optimistically (not hidden). The `assetCategories` map in
`browse/page.tsx` tracks `assetId → categoryId[]`.

## Adding new endpoints

1. Add the typed function to `src/lib/dam-api.ts`
2. Use `bearerHeaders(token)` for the `Authorization` header
3. Browser calls use the `/api/` prefix which the proxy strips before forwarding
