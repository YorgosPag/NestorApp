# ADR-004: Canvas Theme System

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Design System |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Source**: `design-tokens.json` → `CANVAS_THEME`
- **Pattern**: CSS Variables for runtime theme switching
- **Level**: 9.5/10 (Figma/AutoCAD/Blender standards)

---

## Theme model (a theme = a full canvas «scheme», Cinema 4D-style)

A canvas theme is no longer just a solid colour — it is a scheme bundling **background +
gradient + grid**, applied atomically by the theme switch (`BackgroundCategory.tsx →
applyCanvasTheme`). All values live in `design-tokens.json` (`canvas.themes`,
`canvas.gradient`, `canvas.grid`) → generated CSS vars (SSoT).

Active runtime CSS variables (set on `:root` by the switch):

| Variable | Role | Consumer |
|----------|------|----------|
| `--canvas-background-dxf` | solid base colour | 2D `canvas-stack` bg-color; 3D dark mode (`resolveDxfCanvasBackgroundHex`) |
| `--canvas-background-dxf-image` | gradient image (`none` for solid themes) | 2D `canvas-stack` `bg-[image:…]` |
| `--canvas-gradient-top` / `-bottom` | explicit gradient stops | 3D studio backdrop (`resolveDxfCanvasGradientStops` → `buildStudioBackgroundTexture`) |

**Grid colours** are NOT a CSS var (Canvas2D `ctx.strokeStyle` can't read CSS vars). Instead the
theme switch resolves the per-theme palette token (`--canvas-grid-cinema4d-major/minor`) to a
concrete hex via `resolveCssVarColor` and writes it into the **RulersGrid context**
(`updateGridSettings`) — so the 2D grid repaints live. Only themes that define grid colours
write; others leave the user's grid untouched.

The **Cinema 4D** theme is a pixel-faithful copy of the C4D viewport scheme: solid
`#555555` (VIEWCOLOR_C4DBACKGROUND), vertical gradient `#5B5B5B`→`#868686` (GRAD1→GRAD2)
in **2D (CSS linear-gradient) + 3D (WebGL DataTexture)** off ONE token pair, grid
`#414141`/`#4B4B4B` (VIEWCOLOR_GRID_MAJOR/MINOR). Other viewport colours (axes, selection,
grips) are intentionally NOT overridden — the app keeps its own deliberate palette.

---

## Changelog

- **2026-06-30** — NEW **Cinema 4D canvas theme** (exact copy of the C4D viewport scheme:
  background gradient + grid). Tokens: `canvas.themes.cinema4d`, `canvas.gradient.cinema4d-*`,
  `canvas.grid.cinema4d-*`, `canvas.background.dxf-image`. 2D gradient = `canvas-stack`
  `bg-[image:var(--canvas-background-dxf-image)]` (DXF canvas is transparent → shows through).
  3D exact gradient via ADR-446 §2.1 explicit stops. Grid colours written into the RulersGrid
  context by the theme switch (`resolveCssVarColor` → `updateGridSettings`) — live repaint, only
  themes that define grid colours write. New theme is non-destructive (AutoCAD black stays
  default). Files: design-tokens.json (+regen variables.css/tokens.ts), color-config.ts
  (`resolveDxfCanvasGradientStops` + `resolveCssVarColor`), CanvasLayerStack.tsx,
  BackgroundCategory.tsx (+ el/en i18n), studio-background-texture.ts (`explicitToStops`),
  envmap-generator.ts. 9 jest. ⚠️ Live-refresh note: 2D background + grid update on theme
  switch (CSS / context); the 3D studio backdrop repaints on the next 3D lighting/preset
  re-apply (envmap cache keys on base+stops). 🔴 browser-verify + commit.
