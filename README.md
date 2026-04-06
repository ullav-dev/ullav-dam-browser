# ullav-dam-browser

A Next.js 16 web frontend for the Ullav Digital Asset Management system.

## Features

- **Browse and search** digital assets (images, videos, documents, PDFs, Office files, etc.)
- **Resizable panels** — drag the vertical borders to adjust the width of each column; sizes persist across sessions
- **Hierarchical category tree** — expandable, with asset filtering by category
- **Thumbnail grid** with type badges, lock indicators, and availability status
- **Thumbnails for all formats** — images, PDFs, Office documents (via LibreOffice), Apple iWork files (Pages, Numbers, Keynote)
- **Sorting** by name, type, date created, or file size (ascending/descending)
- **Pagination** — configurable page size (10/20/30/50), smart ellipsis page controls
- **My Assets filter** — toggle to show only assets uploaded by the logged-in user
- **Rich metadata editor** — caption, keywords, copyright, availability window; asset base URL shown as a read-only field
- **Creator auto-set** — creator field is populated from the logged-in username at upload time and is read-only
- **Category management** — create top-level and sub-categories inline; drag to reparent categories in the hierarchy
- **Category assignment** — drag an asset onto a category node to assign; drag-to-remove or click × to unassign
- **Asset actions** — Download, Replace file, Lock/Unlock, Delete (delete disabled when locked)
- **File replacement** — replace the underlying file of an existing asset while keeping its metadata and category assignments; thumbnail updates automatically
- **Image editor** — crop and rotate JPEG/PNG/WebP assets in a full-screen editor; save as a new asset (with a prompted name, pre-filled as `originalName_edited`) or replace the current file in place
- **Privacy controls** — assets can be private (owner-only) or public; the grid only shows other users' assets when `is_private` is false
- **Idle session timeout** — automatic logout after configurable inactivity period (default 1 hour); 60 s warning modal with countdown and Stay Logged In / Log Out Now options
- **Multi-file upload** with shared metadata and category pre-selection
- **ZIP import** with three modes: upload ZIP only, upload ZIP and expand contents, or expand contents only; creator attributed to uploading user on all extracted assets
- **Authentication** via `ullav-user-management` (login, register, email confirmation, password reset)
- **SSO handoff** from ullav-portal — clicking DAM Browser in the portal sidebar lands the user already authenticated (no second login)
- Terms of Service and Disclaimer modals at registration
- **Localised UI** — English (`en`), German (`de`), Irish (`ga`); language switcher in the nav bar
- **Help pages** — in-app 7-section guide available in all three locales (`/[locale]/help`)
- **Empty initial state** — no category selected and no assets shown on first load

## Prerequisites

| Service | Repo | Default port |
|---|---|---|
| `ullav-dam-server` | DAM REST API (Rust/Axum) | 8080 |
| `ullav-user-management` | Auth service (Rust/Actix) | 8081 |

## Getting started

```bash
npm install
npm run dev        # http://localhost:3002
```

## Configuration

Create `.env.local` (or adjust the existing one):

```
API_URL=http://localhost:8080
AUTH_URL=http://localhost:8081

# Idle session timeout in milliseconds (default: 3600000 = 1 hour).
# Set low (e.g. 70000) to test the warning modal.
# NEXT_PUBLIC_IDLE_TIMEOUT_MS=3600000
```

## Architecture

```
┌──────────────────────────────────────────────────────┐
│             ullav-dam-browser (Next.js 16)           │
│  /browse  — category tree · asset grid · details     │
│  /login   — auth with terms & disclaimer             │
└───────────────┬──────────────────┬───────────────────┘
                │                  │
         /api/* proxy       /auth-api/* proxy
                │                  │
   ┌────────────▼────┐   ┌─────────▼────────────┐
   │ ullav-dam-server│   │ ullav-user-management│
   │  :8080          │   │  :8081               │
   └─────────────────┘   └──────────────────────┘
```

API calls in the browser are proxied through `src/proxy.ts` to avoid CORS:
- `/api/*` → DAM server (prefix stripped)
- `/auth-api/*` → auth service (prefix stripped)

`next.config.ts` raises `experimental.middlewareClientMaxBodySize` to 200 MB so
large uploads and ZIP imports are not truncated by the Next.js proxy layer.

## Browse page layout

The three columns are separated by draggable resize handles. Drag a border left
or right to adjust the panel width; sizes are saved to `localStorage`.

```
┌──────────╫───────────────────────────╫──────────────┐
│ Category ║  Search · Sort · Upload   ║ Asset        │
│ Tree     ║  ─────────────────────── ║ Details      │
│          ║  Thumbnail grid          ║ (metadata    │
│ + Create ║  (paginated)             ║  editor)     │
│ category ║                          ║              │
│          ║  ─────────────────────── ║ Download     │
│          ║  Pagination bar          ║ Lock/Delete  │
└──────────╫───────────────────────────╫──────────────┘
            ↑ drag                      ↑ drag
```

## ZIP import

Uploading a `.zip` file shows a mode selector in the upload list:

| Mode | Behaviour |
|---|---|
| **ZIP only** | Store the ZIP as a regular asset |
| **ZIP + contents** | Store the ZIP and expand its contents into a category tree |
| **Contents only** | Expand contents into a category tree; do not store the ZIP |

When contents are expanded the server creates a root category named
`<filename>-<YYYYMMDD-HHMMSS>`, then recursively mirrors the ZIP's directory
structure as sub-categories, uploading each file as an asset linked to its
directory's category. The logged-in user's username is sent as a `creator`
multipart field and stored on every extracted asset.

## Project structure

```
src/
├── proxy.ts                  # API proxy + next-intl middleware (Next.js 16)
├── i18n/routing.ts           # next-intl locale config (en, de, ga)
├── app/
│   ├── layout.tsx            # Root layout (returns children — no html/body)
│   ├── page.tsx              # Redirects / → /en
│   └── [locale]/
│       ├── layout.tsx        # Locale layout (<html lang={locale}><body>)
│       ├── page.tsx          # Landing page
│       ├── login/            # Sign in / register / password reset
│       ├── browse/           # Main DAM browser (protected)
│       ├── help/             # Help pages (7 sections, localised)
│       └── auth/             # Email confirm / password reset callbacks
├── contexts/AuthContext.tsx  # JWT session (localStorage: dam_auth)
├── lib/
│   ├── auth-api.ts           # ullav-user-management client
│   └── dam-api.ts            # ullav-dam-server client (all endpoints)
├── components/
│   ├── CategoryTree.tsx      # Hierarchical tree with drag-to-assign and drag-to-move
│   ├── AssetGrid.tsx         # Thumbnail grid with filter / sort / paginate
│   ├── AssetDetails.tsx      # Metadata editor, category tags, action bar (incl. Replace)
│   ├── ImageEditorModal.tsx  # Full-screen crop/rotate editor
│   ├── UploadModal.tsx       # Multi-file upload with ZIP mode selector
│   ├── LocaleSwitcher.tsx    # Language switcher (far right in Nav)
│   └── ResizeHandle.tsx      # Draggable vertical panel divider
├── __tests__/
│   ├── dam-api.test.ts       # Unit tests: API client
│   ├── auth-api.test.ts      # Unit tests: auth client
│   └── asset-grid.test.tsx   # Unit tests: AssetGrid filtering/sorting/pagination
└── messages/
    ├── en.json               # English translations
    ├── de.json               # German translations
    └── ga.json               # Irish translations
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server on port 3002 |
| `npm run build` | Production build |
| `npm start` | Start production server on port 3002 |
| `npm run lint` | Run ESLint |
| `npm test` | Run Jest unit tests |

## Embeddable asset picker (`@ullav/dam-picker`)

The `packages/dam-picker` directory contains a read-only asset picker component
that can be embedded in other Next.js apps (e.g. clann-webapp). It renders a
two-column layout (category tree + asset grid) and returns the selected asset to
the host via a callback. Supports both click-to-select and drag-and-drop.

### Integration steps

**1. Install**

Add to the host app's `package.json`:

```json
"dependencies": {
  "@ullav/dam-picker": "file:../ullav-dam-browser/packages/dam-picker"
}
```

Then run `npm install`.

**2. Transpile** — add to the host's `next.config.ts`:

```typescript
const nextConfig = {
  transpilePackages: ["@ullav/dam-picker"],
};
```

**3. Tailwind** — add a `@source` directive to the host's global CSS so Tailwind
scans the picker's source files:

```css
@import "tailwindcss";
@source "../../node_modules/@ullav/dam-picker/src";
```

Adjust the relative path to `node_modules` as needed.

**4. Proxy** — add a rewrite in the host's `proxy.ts` / `middleware.ts` to
forward `/api/dam/*` to the DAM server on the Docker network (strip the
`/api/dam` prefix before forwarding):

```
/api/dam/* → http://ullav-dam-server:8080/*
```

**5. Use**

```tsx
import { DamPicker } from "@ullav/dam-picker";
import type { PickedAsset } from "@ullav/dam-picker";

<DamPicker
  apiBase="/api/dam"
  token={session.token}
  onSelect={(asset: PickedAsset) => {
    console.log(asset.url, asset.thumbnailUrl);
  }}
/>
```

The component renders inline — wrap it in whatever container or modal you need.

### Props

| Prop | Type | Notes |
|---|---|---|
| `apiBase` | `string` | API prefix (e.g. `/api/dam`) |
| `token` | `string` | Bearer token |
| `onSelect` | `(asset: PickedAsset) => void` | Fired on click |
| `onDragStart?` | `(asset: PickedAsset, e: DragEvent) => void` | Fired after dataTransfer is set |
| `filter?` | `(asset: Asset) => boolean` | Client-side predicate — e.g. images only, or creator === username |

### `PickedAsset` type

```typescript
interface PickedAsset {
  id: string;
  name: string;
  assetType: string;   // MIME type
  size: number;        // bytes
  url: string;         // base asset URL: ${apiBase}/assets/${id}
  thumbnailUrl: string;
}
```

### Initial state

Category tree starts collapsed (only top-level nodes visible) and no category is selected — the asset grid shows an empty prompt until the user picks a category or searches.

### Hover preview

Hovering a thumbnail shows a 200 px preview using `position: fixed` so it escapes any `overflow: hidden` containers. The preview flips left or right based on available viewport space.

### Drag and drop

The drag ghost is the asset's already-loaded `<img>` element (no blank ghost). `dataTransfer` is pre-populated with three formats:

| Format | Value |
|---|---|
| `application/json` | Full `PickedAsset` object (JSON) |
| `text/plain` | Asset URL |
| `text/uri-list` | Asset URL |

The optional `onDragStart` prop fires after `dataTransfer` is set:

```tsx
<DamPicker
  apiBase="/api/dam"
  token={session.token}
  onSelect={handleSelect}
  onDragStart={(asset, e) => { /* additional drag setup */ }}
  filter={(asset) => asset.asset_type.startsWith("image/")}
/>
```

## Known server requirements

The `ullav-dam-server` must have:
- **Migration 003** (`is_locked` column) registered in `db.rs`
- **Body limit raised** to 200 MB on upload and ZIP routes (`DefaultBodyLimit::max` in `main.rs`)
- **Full MIME types** for `asset_type` (e.g. `image/jpeg`, not `image`) — required for thumbnail generation
- **PDFium library** at `PDFIUM_LIB_PATH` — required for PDF thumbnails
- **LibreOffice** at `SOFFICE_PATH` — required for Office document thumbnails (docx, xlsx, pptx, etc.)
- **Thumbnail cache invalidation** on file replacement — `upload_asset` handler must call `state.thumbnail_cache.write().await.remove(&id)` after a successful file upload so the next thumbnail request regenerates from the new file
