# @ullav-dev/dam-picker

Embeddable read-only DAM asset picker for Next.js apps, backed by
`ullav-dam-server` (Comad). Canonical source lives here — this repo's own
`build_deploy.yaml` publishes it to the GitHub Packages registry
(`@ullav-dev/dam-picker`) automatically whenever `packages/dam-picker/package.json`'s
version changes on `main`. Every other app consumes it from the registry;
none should keep its own copy of the source.

## Usage

```tsx
import { DamPicker } from "@ullav-dev/dam-picker";

<DamPicker
  apiBase="/api/dam" // your app's own proxy prefix to ullav-dam-server
  token={authToken}
  onSelect={(asset) => insertAsset(asset)}
/>
```

## Design

- **API client**: `createDamClient(base, token)` — point it at your own
  proxy prefix, or `ullav-dam-server` directly.
- **Theming**: no hardcoded `blue-*` Tailwind classes for the picker's own
  accent/interactive chrome (selection ring, active sort/page state,
  search focus ring, resize-handle hover) — every one of those uses CSS
  custom properties with Comad's own blue as the fallback (e.g.
  `border-[var(--tdam-500,#3b82f6)]`). Override
  `--tdam-100/200/300/400/500/600/700/800` on a wrapping element (or
  globally) to match your app's own brand color, same contract as
  `@ullav-dev/tack-notes`'s `--tnotes-*` vars. File-*type* badge colors
  (image = blue, PDF = red, DOC = amber, ...) are deliberately left as
  plain Tailwind classes — those are categorical, not a brand accent, and
  are consistent across every first-party Ullav app already.
