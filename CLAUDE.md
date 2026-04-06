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
- **i18n**: next-intl v4, URL-based locale routing — locales: `en` (default), `de`, `ga`
- **Proxy file**: `src/proxy.ts` (Next.js 16 uses `proxy.ts`, not `middleware.ts`)
- **Auth storage**: `dam_auth` key in `localStorage`
- **Lock state**: `dam_locked_assets` key in `localStorage` (JSON array of asset IDs)
- **Panel widths**: `dam_left_panel_width` / `dam_right_panel_width` in `localStorage` (integers, pixels)

## Internationalisation (i18n)

- **Library**: next-intl v4, URL-based locale routing (`/en/`, `/de/`, `/ga/`)
- **Routing config**: `src/i18n/routing.ts` — defines locales and default locale (`en`)
- **Messages**: `messages/{locale}.json` — one file per locale
- **Middleware integration**: `src/proxy.ts` runs `createMiddleware(routing)` from next-intl for all non-API requests. This is critical — without it, locale detection and locale-switching navigation break.
- **Root layout** (`src/app/layout.tsx`): returns `children` only — no `<html><body>`. The locale layout (`src/app/[locale]/layout.tsx`) provides `<html lang={locale}><body>`.
- **Root redirect** (`src/app/page.tsx`): server-side `redirect("/en")` as fallback.
- **`LocaleSwitcher`** component in Nav (far right) — links to current path in each locale.

## API proxying

All API calls from the browser go through the proxy to avoid CORS:

| Browser path | Forwarded to | Notes |
|---|---|---|
| `/api/*` | `$API_URL/*` | Strips `/api` prefix |
| `/auth-api/*` | `$AUTH_URL/*` | Strips `/auth-api` prefix |

Environment variables (`.env.local`):
- `API_URL` — DAM server base URL (default `http://localhost:8080`)
- `AUTH_URL` — Auth service base URL (default `http://localhost:8081`)
- `NEXT_PUBLIC_IDLE_TIMEOUT_MS` — idle session timeout in ms (default `3600000` = 1 hour; set e.g. `70000` to test)

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
| `/` | Redirects to `/en` |
| `/[locale]` | Landing page (localised) |
| `/[locale]/login` | Sign in / Register / Password reset |
| `/[locale]/browse` | Main 3-column DAM browser (protected) |
| `/[locale]/help` | Help pages (7 sections) |
| `/[locale]/auth/confirm-email` | Email confirmation callback |
| `/[locale]/auth/password-reset` | Password reset callback |
| `/[locale]/auth/sso` | SSO handoff from ullav-portal (`?t=<encoded-session>`); writes session to `dam_auth` in localStorage and redirects to `/browse` |

## Component overview

| Component | Purpose |
|---|---|
| `CategoryTree` | Hierarchical category browser; builds tree from flat list using `parent_id` |
| `AssetGrid` | Thumbnail grid; client-side filtering, sorting, and pagination |
| `AssetDetails` | Right-panel metadata editor; handles save/delete/replace/category assignment |
| `UploadModal` | Multi-file upload with metadata; ZIP files have a 3-mode selector |
| `ImageEditorModal` | Full-screen image editor (crop, rotate); Save As New Asset or Replace Current |
| `ResizeHandle` | Drag handle placed between panels; fires `onResize(delta)` on mousemove |
| `LocaleSwitcher` | Locale switcher in Nav (far right); links to current path in each locale |
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

## CategoryTree — initial state and selection

- All category nodes start **collapsed** (`useState(false)`) — only top-level categories are visible on load
- `selectedId` is typed `string | null | undefined`:
  - `undefined` = nothing selected (initial state, shows empty asset grid)
  - `null` = "All Assets" selected
  - `string` = specific category UUID
- The "All Assets" row is only highlighted when `selectedId === null` (not undefined)

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

## Browse page — initial state

`selectedCategoryId` is `useState<string | null | undefined>(undefined)` — starts as `undefined` so no category is selected and the asset grid shows an empty prompt on load.

## AssetGrid — filtering, sorting, and pagination

All three operations happen client-side inside `AssetGrid.tsx` using `useMemo`:

1. **Filter** by search query (name, caption, keywords, creator, description), selected category, and optionally by ownership (My Assets)
2. **Sort** by name, asset_type, created_at (default, descending), or size; direction toggles on re-click
3. **Paginate** — page sizes 10/20/30/50 (default 20), smart ellipsis page buttons, resets on filter/sort/size change

Props: `username?: string` — when provided, enables the "My Assets" toggle pill in the sort bar.

State: `myAssetsOnly: boolean` — when true, filters to assets where `asset.creator === username`. Missing from `useMemo` deps causes stale filter; deps must be `[assets, assetCategories, searchQuery, selectedCategoryId, myAssetsOnly, username]`.

`selectedCategoryId: string | null | undefined` — when `undefined` and no search query, shows the "Select a category or search" empty prompt instead of the grid.

## AssetGrid — asset visibility filtering

Assets are filtered client-side in `AssetGrid.tsx` so that users only see:
- Their own assets (any visibility setting)
- Other users' assets where `is_private === false`

```typescript
if (asset.is_private && asset.creator !== username) return false;
```

This runs as the first filter step inside the `filtered` `useMemo`, before search and category filters.

## AssetGrid — thumbnail states

`ThumbnailImage` tracks `loading | ok | error` via `useState`:
- Loading: grey `bg-slate-100` background (parent provides this)
- Loaded: image transitions to `opacity-100`
- Error: shows the file-type badge (PDF, DOCX, XLS, PAGES, etc.) on a slate-50 background

`typeInfo()` maps MIME types to coloured labels including Apple iWork types
(`application/x-iwork-pages-sffpages` → PAGES, etc.).

## AssetGrid — thumbnail cache-busting

`ThumbnailImage` uses `asset.updated_at` as a cache-buster query parameter:

```typescript
const src = `${thumbnailUrl(id)}?v=${encodeURIComponent(updatedAt)}`;
```

When `updatedAt` changes (e.g. after file replacement), a `useEffect` resets the `imgState` to `"loading"`, forcing a re-fetch. This is necessary because the server sends `Cache-Control: public, max-age=86400` — without the param change, the browser serves the stale cached thumbnail.

## AssetDetails — lock and actions

- **Lock**: stored client-side in `localStorage`; locked assets cannot be deleted
- **Asset URL**: displayed as a non-editable read-only field — `window.location.origin + /api/assets/${id}` (base URL, no `/download` suffix)
- **Download**: direct link to `/api/assets/:id/download`
- **Replace file**: Replace button opens a hidden `<input type="file">`. On file selection, calls `uploadFile(asset.id, file, token)` (same `POST /assets/:id/upload` endpoint as initial upload). On success, calls `onUpdated(updatedAsset)` to propagate the new `updated_at` timestamp back to the parent, which triggers thumbnail cache-busting in the grid. Action bar order: Download | Replace | Lock/Unlock | Delete.
- **Creator**: read-only field (`readOnly`, greyed background); set at upload time from the logged-in username
- **Category assignment**: drag thumbnail onto a category node, use the dropdown, or drag a category tag to the remove zone
- **Category removal**: click `×` on a tag, or drag the tag to the red drop zone
- **Thumbnail error**: shows "No preview available" text instead of a blank grey box
- **Thumbnail cache-bust**: thumbnail `src` uses `asset.updated_at` as `?v=` param; `useEffect([asset.updated_at])` resets `thumbFailed` so the image retries after replacement

## UploadModal — creator and ZIP import modes

Props: `username: string` — the logged-in user's username. The `creator` field is pre-filled from `username` and is read-only (no setter); users cannot change it.

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

The `creator` value is appended as a multipart field when calling `uploadZip(file, token, creator)` so the server sets it on every asset extracted from the ZIP. The server (`handlers/zip.rs`) reads the `creator` multipart field alongside `file` and stores it in the asset INSERT.

## Nav bar order

From left to right:
- Logo + "DAM Browser" wordmark (links to `/`)
- **Assets** link (authenticated only)
- Username / **Sign Out** (authenticated) or **Sign In** link (unauthenticated)
- **Help** link
- **LocaleSwitcher** (far right)

## Help pages

`src/app/[locale]/help/page.tsx` — server component, 7 sections:
1. Getting Started
2. Browsing & Searching Assets
3. Uploading Assets
4. Managing Assets (editing metadata, replacing files)
5. Organising with Categories
6. Privacy & Permissions
7. Tips & Shortcuts

All sections are translated in `messages/{en,de,ga}.json` under the `help` namespace. Links to `/browse` use `Link` from `@/i18n/navigation`.

## ullav-dam-server notes

- Default Axum body limit is 2 MB — upload and ZIP routes raised to **200 MB** via `DefaultBodyLimit::max`
- Migration 003 (`is_locked` column) registered in `db.rs` via `run_migrations`
- Thumbnails: images (image crate), PDFs (pdfium-render), Office files (LibreOffice via `soffice`), Apple iWork (ZIP extraction of `QuickLook/Thumbnail.jpg`)
- `PDFIUM_LIB_PATH` env var points to the PDFium dynamic library
- `SOFFICE_PATH` env var points to the LibreOffice binary (macOS: `/Applications/LibreOffice.app/Contents/MacOS/soffice`)
- **Thumbnail cache invalidation**: The server holds an in-memory thumbnail cache (`Arc<RwLock<HashMap<Uuid, Bytes>>>`). The `upload_asset` handler (`handlers/assets.rs`) calls `state.thumbnail_cache.write().await.remove(&id)` after a successful file replacement so the next thumbnail request regenerates from the new file.

## @ullav/dam-picker — embeddable picker package

Lives at `packages/dam-picker/` inside this repo. Published as an npm workspace package — host apps reference it via `"@ullav/dam-picker": "file:../ullav-dam-browser/packages/dam-picker"`.

### Key files

| File | Purpose |
|---|---|
| `src/api.ts` | `createDamClient(base, token)` — typed API wrappers |
| `src/DamPicker.tsx` | Root component; loads assets + lazy category mappings |
| `src/PickerTree.tsx` | Category tree (starts collapsed, `selectedId: string\|null\|undefined`) |
| `src/PickerGrid.tsx` | Asset thumbnail grid (read-only, hover preview, drag support) |
| `src/index.ts` | Exports: `DamPicker`, `DamPickerProps`, `PickedAsset`, `Asset` |

### DamPicker props

| Prop | Type | Notes |
|---|---|---|
| `apiBase` | `string` | Prefix for all API calls (e.g. `/api/dam`) |
| `token` | `string` | Bearer token |
| `onSelect` | `(asset: PickedAsset) => void` | Fired on click |
| `onDragStart?` | `(asset: PickedAsset, e: DragEvent) => void` | Fired after dataTransfer is set |
| `filter?` | `(asset: Asset) => boolean` | Client-side predicate; applied via `useMemo` after loading |

### Initial state

Same pattern as the browse page: `selectedCategoryId` starts as `undefined` (nothing selected, grid shows empty prompt). Category nodes start collapsed.

### Hover preview and drag ghost

`PickerGrid` shows a fixed-position 200 px thumbnail when hovering a card (escapes `overflow:hidden` containers). Uses viewport edge detection to flip left/right. For drag, `setDragImage` uses the already-loaded `<img>` element inside the card.

### Buttons inside host forms

All buttons in PickerTree and PickerGrid have `type="button"` to prevent them from triggering form submission when the picker is embedded inside a `<form>` in the host app.

### Host app integration (summary)

1. `"@ullav/dam-picker": "file:../ullav-dam-browser/packages/dam-picker"` in host `package.json`
2. `transpilePackages: ["@ullav/dam-picker"]` in host `next.config.ts`
3. `@source "../../node_modules/@ullav/dam-picker/src";` in host global CSS
4. Proxy `/api/dam/*` → DAM server (strip `/api/dam` prefix)

## ImageEditorModal

Full-screen editor for image assets (`image/jpeg`, `image/png`, `image/webp`). Opened from the edit pencil button that appears on hover over an image card in `AssetGrid`.

- **Crop**: click and drag on the canvas to draw a crop rectangle; rule-of-thirds grid and corner handles shown. Tiny drags (< 5 px) are discarded.
- **Rotate**: 90° increments (CW and CCW); rotation and crop can be combined.
- **Reset**: clears rotation and crop box.
- **Save As New Asset**: prompts for an asset name (pre-populated with `asset.name + "_edited"`), then creates a new asset record, uploads the edited file, mirrors visibility settings from the original, and assigns the same categories. Calls `onAssetCreated`.
- **Replace Current**: overwrites the existing asset's file in place. Calls `onAssetUpdated`, which propagates the new `updated_at` so `ThumbnailImage` cache-busts.
- Authenticated image download uses a `fetch` + object URL so the `Authorization` header is sent.
- Canvas is drawn via `drawCanvas` (stable `useCallback`, reads from refs) and re-triggered via `useEffect` syncing state → refs.

## Idle session timeout

Implemented in `AuthContext.tsx`. Tracks activity via `mousemove`, `keydown`, `pointerdown`, `scroll`, and `touchstart` on `window`.

- Timeout controlled by `NEXT_PUBLIC_IDLE_TIMEOUT_MS` (default 3 600 000 ms = 1 hour).
- A warning modal with a live countdown appears **60 s before** logout.
- Warning modal offers **Stay Logged In** (resets timers) and **Log Out Now**.
- Activity events are **ignored while the warning is visible** (via `idleWarningRef`) so the modal cannot be accidentally dismissed by mouse movement.
- Timers and event listeners are registered only when `user !== null` and cleaned up on logout or unmount.
- i18n keys under `idleWarning` namespace in `messages/{en,de,ga}.json`.

## Unit tests

```bash
npm test
```

Jest with `next/jest` (SWC transformer), `jsdom` environment, React Testing Library.

| File | Coverage |
|---|---|
| `src/__tests__/dam-api.test.ts` | URL helpers, `apiRequest` error handling, all endpoint methods |
| `src/__tests__/auth-api.test.ts` | `authRequest` error handling, all auth/user endpoints |
| `src/__tests__/asset-grid.test.tsx` | Visibility filtering, search, category filtering, My Assets toggle, sorting, pagination, `typeInfo` badge labels, `formatSize` display |

Mocks: `next-intl` (`useTranslations` → key passthrough), `@/components/ImageEditorModal` → `null`.

## Adding new endpoints

1. Add the typed function to `src/lib/dam-api.ts`
2. Use `bearerHeaders(token)` for the `Authorization` header
3. Browser calls use the `/api/` prefix which the proxy strips before forwarding
