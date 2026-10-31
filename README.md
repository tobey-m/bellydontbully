# bellydontbully

A neighborhood cat map with a deadpan orange mascot. Same cats. Stranger humans.

This version adds a consistent mascot identity, responsive map panels, custom reaction graphics, Instagram image exports, and home-screen installation assets.

Read **IDENTITY_V2_TH.md** for Thai upload instructions, changes, verification and limitations. **CHANGED_FILES.txt** lists files changed from the original supplied archive.

## Run locally

```bash
npm ci
npm run dev
```

Configure the existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` locally or on your host. Keep existing server-only translation settings if already configured; never put a secret API key in a `NEXT_PUBLIC_` variable.

```bash
npm run build
```

No additional dependencies or database migration is required for the identity update. The included original SQL file does not recreate all existing application RPCs and columns; keep your existing database setup when updating.

## Sharing

Four featured styles plus four classic cards. Export Story (1080×1920), Post (1080×1350), or Square (1080×1080) as PNG/JPG. Clear Overlay is always transparent PNG. Direct native sharing depends on browser and installed apps; saved files can be uploaded to Instagram manually.

## Home screen

The manifest, maskable icon, Apple icon and favicon use the new mascot. The app offers native installation where supported and browser instructions otherwise. The service worker provides an offline notice only; the map still needs an internet connection.
