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
- **Lock state**: `dam_locked_assets` key in `localStorage` (JSON array of asset IDs)

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
| `AssetGrid` | Thumbnail grid; client-side filtering, sorting, and pagination |
| `AssetDetails` | Right-panel metadata editor; handles save/delete/category assignment |
| `UploadModal` | Two-step upload: POST `/assets` then POST `/assets/:id/upload` |
| `TermsModal` | Terms of Service modal (shown at registration) |
| `DisclaimerModal` | Disclaimer modal (shown at registration) |

## CategoryTree — drag-and-drop

The tree supports two independent drag operations:

| Drag source | Drop target | Effect |
|---|---|---|
| Asset card / thumbnail | Category node | Assigns the asset to that category |
| Category node | Another category node | Reparents (moves) the category |
| Category node | "All Assets" row | Promotes the category to top-level |

Visual feedback: green ring = valid drop, amber = already assigned / already here, red = invalid (self or descendant).

## Category filtering approach

`GET /assets` returns assets without category info. Categories are lazy-loaded
via `GET /assets/:id` in background batches of 5. Until an asset's categories are
loaded, they are shown optimistically (not hidden). The `assetCategories` map in
`browse/page.tsx` tracks `assetId → categoryId[]`.

## AssetGrid — filtering, sorting, and pagination

All three operations happen client-side inside `AssetGrid.tsx` using `useMemo`:

1. **Filter** by search query (name, caption, keywords, creator, description) and selected category
2. **Sort** by name, asset_type, created_at (default, descending), or size; direction toggles on re-click
3. **Paginate** — same strategy as clann-webapp: page sizes 10/20/30/50 (default 20), smart ellipsis page buttons, page resets on filter/sort/size change

## AssetDetails — lock and actions

- **Lock**: stored client-side in `localStorage`; locked assets cannot be deleted
- **Download**: direct link to `/api/assets/:id/download`
- **Category assignment**: drag thumbnail onto a category node, use the dropdown, or drag a category tag to the remove zone
- **Category removal**: click `×` on a tag, or drag the tag to the red drop zone

## ullav-dam-server notes

- Default Axum body limit is 2 MB — the upload routes have this raised to **200 MB** via `DefaultBodyLimit::max` in `main.rs`
- Migration 003 (`is_locked` column) must be registered in `db.rs`; it is now included in `run_migrations`
- Thumbnail generation requires `asset_type` to start with `"image/"` (full MIME type, not a short string like `"image"`)

## Adding new endpoints

1. Add the typed function to `src/lib/dam-api.ts`
2. Use `bearerHeaders(token)` for the `Authorization` header
3. Browser calls use the `/api/` prefix which the proxy strips before forwarding
