# ADR-530 — Revit-grade glyph-path text rendering on the main DXF canvas

**Status:** ✅ APPROVED (implemented, browser-verify pending)
**Date:** 2026-06-25
**Domains:** text-engine/fonts, rendering/entities, canvas-v2 (bitmap cache)
**Related:** ADR-040 (preview canvas performance), ADR-344 (text engine / glyph pipeline), ADR-091/107 (text rendering config)

---

## 1. Context / Problem

The main 2D canvas rendered **all** text through CSS (`ctx.font` + `ctx.fillText`), so it
could only ever paint **system fonts**. The real CAD fonts of imported drawings were
never reproduced.

Trigger (Giorgio): a Tekton (`.tek`) floor-plan import whose texts are authored in the
internal vector font **«PC απλό»** shows up as **Arial** in Nestor. Revit/AutoCAD instead
draw the *actual* font — embedded TrueType or vector SHX — through a glyph/vector renderer,
falling back to a **metric-compatible** substitute only when the original is missing.

A complete glyph pipeline already existed under `text-engine/fonts/` (opentype.js →
`Path2D`, SHX → `Path2D`, font loader, font cache, SHX→open substitution table) but was
**entirely disconnected from the canvas** — verified by grep: `glyph-renderer` /
`shxStringToPath2D` appeared only inside `text-engine/`, never in `rendering/` or
`canvas-v2/`; `loadFont` / `fontCache` were called only by the text-toolbar UI, so **no
font was ever preloaded for the canvas**.

## 2. Decision

Wire the **existing** glyph pipeline into the canvas text path (glyph-path rendering,
not CSS `@font-face`), **per-entity for ALL text/mtext**, with a clean CSS `fillText`
fallback. No renderer/parser/loader was re-implemented — only a thin resolver, a glyph
cache, a ready-signal, and a preloader were added.

### Font model — "what Revit/AutoCAD actually does"
1. **Real font if present** — a company-uploaded font (existing `font-manager`) resolves
   by exact family and renders faithfully.
2. **Else metric-compatible open substitute** — routed through the **existing**
   `FONT_SUBSTITUTION_TABLE` SSoT (catch-all `*` → **Liberation Sans**, SIL OFL 1.1).
   The substitution table already *named* Liberation Sans / Mono / Sans Bold but the
   files were missing; bundling them closes a pre-existing dangling reference.

> POC note: the proof-of-concept stands the already-bundled **Roboto-Regular.ttf**
> (Apache 2.0) in for "Liberation Sans" via `CAD_SUBSTITUTE_FONTS` — only the file `url`
> changes when the OFL Liberation TTFs are dropped into `public/fonts/`; the
> resolver/substitution wiring is identical.

## 3. Architecture

```
scene/canvas mount
   └─ preloadCadSubstituteFonts()  ── loadFont(url, cacheName) ─▶ fontCache
            └─ bumpFontReady() ──▶ FontReadyStore
                       └─ subscribeFontReady (dxf-canvas-renderer)
                              └─ bitmapCache.invalidate() + isDirty=true   ◀── ADR-040 contract

per entity (inside the cached bitmap rebuild only — NOT 60Hz):
   TextRenderer.renderTextContent
      └─ resolveEntityFont(family,{bold,italic})  (fontCache + lookupSubstitute SSoT)
            ├─ ResolvedFont → getGlyphRun(font,cacheName,text)  (zoom-stable Path2D cache)
            │                    └─ ctx.translate→scale→fill(path)
            └─ null → ctx.fillText(...)   (legacy CSS fallback, zero regression)
```

### New modules (`text-engine/fonts/`)
- **`font-resolver.ts`** — `resolveEntityFont(family, {bold,italic})`: direct cache hit →
  `lookupSubstitute` catch-all. Italic and un-bundled bold faces resolve to `null` so CSS
  keeps drawing those styles. Returns `{ font, cacheName }`.
- **`glyph-path-cache.ts`** — `getGlyphRun(font, fontName, text)`: builds `Path2D` ONCE per
  `(fontName, text)` at `GLYPH_REFERENCE_SIZE` (100). The renderer applies the zoom scale
  via `ctx.scale`, so paths are **never rebuilt on zoom**.
- **`font-ready-store.ts`** — `bumpFontReady` / `subscribeFontReady` (mirrors
  `missing-font-store`); low-frequency one-time signal.
- **`cad-font-preload.ts`** — `preloadCadSubstituteFonts()` (idempotent) + `CAD_SUBSTITUTE_FONTS`.

### Modified
- **`rendering/entities/TextRenderer.ts`** — glyph branch in `renderTextContent`, split into
  `paintText` / `fillGlyphRun` / `paintDecorations` helpers (≤40 lines each). The
  **rotation (`degToRad(-normalizedRotation)`) and `screenHeight = height·scale` math is
  unchanged** — the glyph paint reuses the same transform.
- **`canvas-v2/dxf-canvas/dxf-canvas-renderer.ts`** — mount-once `preloadCadSubstituteFonts()`
  + `subscribeFontReady → bitmapCache.invalidate() + dirty`.
- **`text-engine/fonts/index.ts`** — barrel exports.

## 4. ADR-040 compliance (performance-critical)

- Text is painted **only inside the cached bitmap rebuild** (scene/zoom/viewport/dpr/settings
  change), **never** on the 60Hz hover/overlay path → glyph-path build cost is amortised.
- Font availability is **NOT** in the bitmap cache key. Loading is a **one-time event**, so a
  single `invalidate()` on `bumpFontReady()` is the same contract as the existing
  `subscribeLayerStore → bitmapCache.invalidate()` wiring. No `hoveredEntityId` /
  `selectedEntityIds` enter the key → no 60Hz rebuild.
- No new `useSyncExternalStore` in orchestrators; the ready signal is a plain subscription
  in the renderer hook (mirrors LayerStore / isolate effects).
- The glyph-path cache makes zoom redraws path-build-free.

## 5. License (N.5)

- Roboto-Regular.ttf — **Apache 2.0** (POC, already bundled). ✅
- Liberation Sans / Mono — **SIL OFL 1.1** (target substitutes). ✅
- Rejected: LibreCAD `.lff` (GPL ❌), Autodesk ISOCP/RomanS (proprietary ❌).

## 6. Tests

- `font-resolver.test.ts` (8) — direct hit, catch-all substitute, SHX→Mono, italic→null,
  bold→Bold face, bold-missing→null, empty→arial.
- `glyph-path-cache.test.ts` (5) — build-once, per-text/per-font separation, reference size,
  clear-rebuild.
- `font-ready-store.test.ts` (1) — version bump + subscribe/unsubscribe.
- `TextRenderer.glyph.test.ts` (2) — fills glyph path when resolved; CSS `fillText` fallback
  when null.
- 16 tests GREEN. `tsc --noEmit` background (N.17).

## 7. Scope / Follow-up

- **Bold/italic faces** not yet bundled → those styles use the CSS fallback until the faces
  are added to `CAD_SUBSTITUTE_FONTS`.
- **SHX vector fonts** (`shxStringToPath2D`) not yet routed through the resolver — the open
  substitute path covers the current need; SHX wiring is additive later.
- **Browser verify (Giorgio):** import `.tek` → texts render as glyph paths (not raw Arial),
  correct position/size/colour/rotation; FPS unaffected on a 100+ text drawing.

## Changelog
- **2026-06-25** — Initial implementation (POC with Roboto). Resolver + glyph-path cache +
  font-ready store + preloader + TextRenderer glyph branch + canvas-renderer wiring. 16 jest.
