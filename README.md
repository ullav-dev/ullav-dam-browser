# ullav-dam-browser

A Next.js 16 web frontend for the Ullav Digital Asset Management system.

## Features

- Browse and search digital assets (images, videos, documents, etc.)
- Hierarchical category tree for filtering
- Thumbnail grid with asset type badges
- Rich metadata editor (caption, keywords, creator, copyright, availability)
- Category tag management per asset
- Drag-and-drop file upload with metadata
- Authentication via `ullav-user-management` (login, register, email confirmation, password reset)
- Terms of Service and Disclaimer modals

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

Copy `.env.local` and adjust if your services run on different ports:

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

## Project structure

```
src/
├── proxy.ts                  # API proxy (Next.js 16)
├── app/
│   ├── layout.tsx            # Root layout
│   ├── page.tsx              # Landing page
│   ├── login/                # Auth pages
│   ├── browse/               # Main DAM browser
│   └── auth/                 # Email confirm / password reset
├── contexts/AuthContext.tsx  # JWT session (localStorage)
├── lib/
│   ├── auth-api.ts           # ullav-user-management client
│   └── dam-api.ts            # ullav-dam-server client
└── components/
    ├── CategoryTree.tsx      # Hierarchical expandable tree
    ├── AssetGrid.tsx         # Thumbnail grid
    ├── AssetDetails.tsx      # Metadata editor panel
    └── UploadModal.tsx       # Upload with drag-drop
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server on port 3002 |
| `npm run build` | Production build |
| `npm start` | Start production server on port 3002 |
