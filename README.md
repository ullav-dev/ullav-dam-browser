# ullav-dam-browser

A Next.js 16 web frontend for the Ullav Digital Asset Management system.

## Features

- **Browse and search** digital assets (images, videos, documents, PDFs, etc.)
- **Hierarchical category tree** — expandable, with asset filtering by category
- **Thumbnail grid** with type badges, lock indicators, and availability status
- **Sorting** by name, type, date created, or file size (ascending/descending)
- **Pagination** — configurable page size (10/20/30/50), smart ellipsis page controls
- **Rich metadata editor** — caption, keywords, creator, copyright, availability window
- **Category management** — create top-level and sub-categories inline; drag to reparent categories in the tree hierarchy
- **Category assignment** — drag an asset onto a category node to assign; drag-to-remove or click × to unassign
- **Asset actions** — Download, Lock/Unlock, Delete (delete disabled when locked)
- **Drag-and-drop file upload** with metadata and category pre-selection
- **Authentication** via `ullav-user-management` (login, register, email confirmation, password reset)
- Terms of Service and Disclaimer modals at registration

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

Create `.env.local` (or adjust the existing one) if your services run on different ports:

```
API_URL=http://localhost:8080
AUTH_URL=http://localhost:8081
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

## Browse page layout

```
┌──────────┬───────────────────────────┬──────────────┐
│ Category │  Search · Sort · Upload   │ Asset        │
│ Tree     │  ─────────────────────── │ Details      │
│          │  Thumbnail grid          │ (metadata    │
│ + Create │  (paginated)             │  editor)     │
│ category │                          │              │
│          │  ─────────────────────── │ Download     │
│          │  Pagination bar          │ Lock/Delete  │
└──────────┴───────────────────────────┴──────────────┘
```

## Project structure

```
src/
├── proxy.ts                  # API proxy (Next.js 16)
├── app/
│   ├── layout.tsx            # Root layout with AuthProvider
│   ├── page.tsx              # Landing page
│   ├── login/                # Sign in / register / password reset
│   ├── browse/               # Main DAM browser (protected)
│   └── auth/                 # Email confirm / password reset callbacks
├── contexts/AuthContext.tsx  # JWT session (localStorage: dam_auth)
├── lib/
│   ├── auth-api.ts           # ullav-user-management client
│   └── dam-api.ts            # ullav-dam-server client (all endpoints)
└── components/
    ├── CategoryTree.tsx      # Hierarchical tree with drag-to-assign and drag-to-move
    ├── AssetGrid.tsx         # Thumbnail grid with filter / sort / paginate
    ├── AssetDetails.tsx      # Metadata editor, category tags, action bar
    └── UploadModal.tsx       # Drag-drop upload with metadata and category selection
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server on port 3002 |
| `npm run build` | Production build |
| `npm start` | Start production server on port 3002 |
| `npm run lint` | Run ESLint |

## Known server requirements

The `ullav-dam-server` must have:
- **Migration 003** (`is_locked` column) registered in `db.rs` — included from this project's initial setup
- **Body limit raised** on upload routes to 200 MB (`DefaultBodyLimit::max` in `main.rs`) — required for files larger than Axum's 2 MB default
- **Full MIME types** for asset_type (e.g. `image/jpeg`, not `image`) — required for thumbnail generation
