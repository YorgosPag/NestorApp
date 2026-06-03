# BIM PBR Textures (ADR-413)

CC0 PBR texture sets for the BIM material catalog, sourced from
[Poly Haven](https://polyhaven.com). **License: CC0** (public domain, no
attribution required — see ADR-409).

## Slugs and source assets (all CC0)

| Slug      | Poly Haven asset id   |
|-----------|-----------------------|
| concrete  | `concrete_floor_02`   |
| brick     | `red_brick_03`        |
| plaster   | `beige_wall_001`      |
| wood      | `wood_planks_grey`    |
| tile      | `floor_tiles_06`      |
| stone     | `cobblestone_floor_04`|
| metal     | `metal_plate`         |

Each set has 4 maps (1k jpg): `albedo` (Diffuse), `normal` (nor_gl),
`roughness` (Rough), `ao` (AO).

## 1. Download working copies

```bash
node tools/bim-textures/download-textures.mjs
```

Writes 1k jpg maps to `.tex-lib/<slug>/<map>.jpg`. Idempotent (skips existing
files). `.tex-lib/` is the full working copy and is NOT committed.

## 2. Demo textures (bundled, served immediately)

The 3 wall demo slugs (`concrete`, `brick`, `plaster`) have their
`albedo`/`normal`/`roughness` jpgs copied into
`public/textures/<slug>/<map>.jpg`, served at `/textures/<slug>/<map>.jpg`.

## 3. Upload high-res to Firebase Storage

Uploads `.tex-lib/<slug>/*.jpg` to
`gs://pagonis-87766.firebasestorage.app/bim-texture-library/<slug>/<map>.jpg`
(content-type `image/jpeg`). Uses `firebase-admin` (already a project dep).

```bash
# PowerShell — authenticate with a service-account JSON:
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\service-account.json"
node tools/bim-textures/upload-textures.mjs
```

Or set `SERVICE_ACCOUNT` to the JSON path. Re-running overwrites the same
objects (same storage path).
