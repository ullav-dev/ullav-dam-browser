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
- **Panel widths**: `dam_left_panel_width` / `dam_right_panel_width` in `localStorage` (integers, pixels)

## API proxying

All API calls from the browser go through the proxy to avoid CORS:

| Browser path | Forwarded to | Notes |
|---|---|---|
| `/api/*` | `$API_URL/*` | Strips `/api` prefix |
| `/auth-api/*` | `$AUTH_URL/*` | Strips `/auth-api` prefix |

Environment variables (`.env.local`):
- `API_URL` — DAM server base URL (default `http://localhost:8080`)
- `AUTH_URL` — Auth service base URL (default `http://localhost:8081`)

## Proxy body size limit

`next.config.ts` sets `experimental.middlewareClientMaxBodySize` to 200 MB so that
large file uploads and ZIP imports are not truncated by the Next.js middleware layer
before reaching the DAM server.

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
| `UploadModal` | Multi-file upload with metadata; ZIP files have a 3-mode selector |
| `ResizeHandle` | Drag handle placed between panels; fires `onResize(delta)` on mousemove |
| `TermsModal` | Terms of Service modal (shown at registration) |
| `DisclaimerModal` | Disclaimer modal (shown at registration) |

## Browse page — resizable panels

The three-column layout uses `ResizeHandle` components between panels. Widths are
stored in `leftWidth` / `rightWidth` state (initialised from `localStorage`) and
applied as inline `style={{ width }}` on the `<aside>` elements.

- Left panel: min 160 px, max 480 px, default 224 px
- Right panel: min 200 px, max 560 px, default 288 px
- Middle panel: `flex-1`, takes all remaining space

The right handle uses `w - delta` so that dragging left widens the right panel.
Widths are persisted to `localStorage` on every resize event.

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
3. **Paginate** — page sizes 10/20/30/50 (default 20), smart ellipsis page buttons, resets on filter/sort/size change

## AssetGrid — thumbnail states

`ThumbnailImage` tracks `loading | ok | error` via `useState`:
- Loading: grey `bg-slate-100` background (parent provides this)
- Loaded: image transitions to `opacity-100`
- Error: shows the file-type badge (PDF, DOCX, XLS, PAGES, etc.) on a slate-50 background

`typeInfo()` maps MIME types to coloured labels including Apple iWork types
(`application/x-iwork-pages-sffpages` → PAGES, etc.).

## AssetDetails — lock and actions

- **Lock**: stored client-side in `localStorage`; locked assets cannot be deleted
- **Download**: direct link to `/api/assets/:id/download`
- **Category assignment**: drag thumbnail onto a category node, use the dropdown, or drag a category tag to the remove zone
- **Category removal**: click `×` on a tag, or drag the tag to the red drop zone
- **Thumbnail error**: shows "No preview available" text instead of a blank grey box

## UploadModal — ZIP import modes

When a ZIP file is detected (by MIME type or `.zip` extension), a per-file mode
selector appears below the file row with three options:

| Mode | Behaviour |
|---|---|
| **ZIP only** | Upload the ZIP as a regular asset; shared metadata applied; contents ignored |
| **ZIP + contents** | Process contents into a category tree AND upload the ZIP as an asset assigned to the root category |
| **Contents only** (default) | Expand contents into a category tree; ZIP file not stored |

The server endpoint `POST /zip/upload` handles content extraction and returns
`{ categories, assets, asset_category_ids, errors }`. The `onZipResult` prop
propagates new categories and asset→category mappings to `browse/page.tsx`
immediately (no extra fetches). Shared metadata is shown whenever at least one
file will be stored as an asset.

## ullav-dam-server notes

- Default Axum body limit is 2 MB — upload and ZIP routes raised to **200 MB** via `DefaultBodyLimit::max`
- Migration 003 (`is_locked` column) registered in `db.rs` via `run_migrations`
- Thumbnails: images (image crate), PDFs (pdfium-render), Office files (LibreOffice via `soffice`), Apple iWork (ZIP extraction of `QuickLook/Thumbnail.jpg`)
- `PDFIUM_LIB_PATH` env var points to the PDFium dynamic library
- `SOFFICE_PATH` env var points to the LibreOffice binary (macOS: `/Applications/LibreOffice.app/Contents/MacOS/soffice`)

## Adding new endpoints

1. Add the typed function to `src/lib/dam-api.ts`
2. Use `bearerHeaders(token)` for the `Authorization` header
3. Browser calls use the `/api/` prefix which the proxy strips before forwarding
