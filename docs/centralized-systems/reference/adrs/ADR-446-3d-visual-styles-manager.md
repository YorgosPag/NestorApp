# ADR-446 — 3D Visual Styles Manager (Revit-grade)

**Status:** 🟢 v1 implemented — pending browser-verify + commit (2026-06-12)
**Discipline:** DXF Viewer · BIM 3D rendering · View tab ribbon
**Related:** ADR-413 (realistic PBR materials — subsumed), ADR-375 C.7 (3D edge overlays — extended with edge mode), ADR-366 (3D BIM viewer), ADR-345 (View tab Visual Styles stub — wired up), ADR-001 (Radix Select), ADR-040 (3D scene is outside the 2D micro-leaf critical path)

---

## 1. Context / Problem

The 3D BIM canvas had **scattered** appearance controls and no unified Revit-style
«Visual Style»:

- `realisticMaterials` (ADR-413) — a per-view persisted boolean on
  `bim-render-settings-store`: ON = textured PBR, OFF = flat-lit.
- Model edges (ADR-375 C.7) — **always** built per-category
  (`attachEdgesProjection`, `depthTest:true` = only-visible). No none/all/visible
  control.
- `VIEW_VISUAL_STYLES_PANEL` (ADR-345) — a **stub** of `comingSoon` buttons
  (Wireframe/Hidden/Realistic/Shaded/Conceptual), mounted in the View tab but
  inert.
- No «Consistent Colors» (unlit) and no «Wireframe» (hidden faces) mode at all.

Giorgio asked (2026-06-12) for a **single Revit-grade Visual Style manager**: the
combinations χρώμα-μόνο / χρώμα+ακμές / υφές±ακμές / γεμάτος-όγκος+ακμές / μόνο-ακμές.

## 2. What Revit does

Revit's «Visual Style» (View Control Bar / Graphic Display Options) is **two
independent axes**:

- **Model Display → Style:** Wireframe / Hidden Line / Shaded / Consistent Colors /
  Realistic.
- **Show Edges:** on/off, plus occlusion (hidden-line behaviour when faces are
  opaque).

Named presets are the everyday surface; power users tweak the axes in the dialog.

## 3. Decision

Model the appearance as **two axes** (`FaceMode` × `EdgeMode`) selected via a named
`VisualStylePreset`, and make the **existing per-view persisted
`bim-render-settings-store` the SSoT** — NOT a new store. `realisticMaterials`
becomes a **derived** convenience flag (`faceMode === 'realistic'`).

### 3.1 Axes (SSoT: `config/bim-visual-style.ts`, pure data)

```
FaceMode  = none | consistent | shaded | realistic | hidden-line
EdgeMode  = none | visible (occluded, depthTest on) | all (x-ray, depthTest off)
```

### 3.2 Presets → axes (the SSoT mapping)

| Preset | faceMode | edgeMode |
|--------|----------|----------|
| Wireframe (Συρμάτινο) | none | all |
| Hidden Line (Κρυφή Γραμμή) | hidden-line | visible |
| Shaded (Σκιασμένο) | shaded | none |
| Shaded with Edges (Σκιασμένο με Ακμές) | shaded | visible |
| Consistent Colors (Συνεπή Χρώματα) | consistent | none |
| Consistent + Edges | consistent | visible |
| Realistic (Ρεαλιστικό) | realistic | none |
| Realistic with Edges | realistic | visible |

**Default = `shaded-edges`** (Σκιασμένο με Ακμές) — Giorgio's chosen default
(2026-06-13): lit flat-colour faces + ADR-375 always-on edges. Every NEW view opens
shaded-with-edges; views that already persisted a `visualStyle` keep their explicit
pick, and pre-ADR-446 docs with an explicit `realisticMaterials:true` still derive
`realistic-edges` (legacy back-compat).

## 4. Implementation

### FACES — `bim-3d/materials/MaterialCatalog3D.ts` (the SOLE face-material factory)
The realistic↔shaded split already existed (textured vs flat, gated by the derived
`realisticMaterials`). A `withFaceMode` post-transform wraps **every** entry point
(`getMaterial3D` / `getElementMaterial3D` / `getSystemTintedMaterial3D` /
`getRoofTileMaterial3D` / `resolveUserMaterial`):
- `realistic` / `shaded` → pass-through (textured / flat-lit).
- `consistent` → unlit clone (emissive = base colour, base colour → black), cached
  per source-material uuid.
- `hidden-line` → uniform white emissive occluder singleton (writes depth, hides
  back edges).
- `none` → invisible material singleton (`visible:false`) — faces hidden while the
  edge overlays (mesh children) keep rendering.

### EDGES — `bim-3d/converters/bim-three-edges.ts` + `bim-3d/edges/bim-3d-edge-overlay-builder.ts`
`attachEdgesProjection` (the SOLE 3D edge-attach point) reads `edgeMode` event-time:
`none` → skip; `visible` → `occlude:true` (depthTest on, existing look); `all` →
`occlude:false` (depthTest off, x-ray). `EdgeOverlayOptions` gains `occlude?` (default
true = back-compat) → `LineMaterial.depthTest`.

### SSoT store / types
- `config/bim-render-settings-types.ts` — `BimRenderSettings.visualStyle?`;
  `ResolvedBimSettings` += `visualStyle/faceMode/edgeMode`; `resolveBimSettings`
  derives the axes + `realisticMaterials`. `BIM_SETTINGS_VERSION 1→2` + migration:
  derive `visualStyle` from the legacy `realisticMaterials` bit (idempotent, persist
  once).
- `state/bim-render-settings-store.ts` — `setVisualStyle(preset)` (idempotent,
  debounced persist); `setRealisticMaterials` kept as a legacy alias; `buildRaw`
  persists `visualStyle` + stamps `settingsVersion`.

### Re-sync — `bim-3d/viewport/use-bim3d-vg-resync.ts`
The ADR-413 `realisticMaterials` subscription is replaced by a `visualStyle`
subscription → `resyncBimScene` (rebuilds faces + re-attaches/drops edges).

### UI — View tab «Στυλ Προβολής» (Revit View Control Bar)
- NEW `ui/ribbon/components/VisualStyleSelect.tsx` — Radix `@/components/ui/select`
  (ADR-001), reads/writes `visualStyle`.
- `view-tab-visual-styles.ts` — the ADR-345 `comingSoon` stub replaced by one
  `widget` (`visual-style-select`).
- `RibbonPanel.tsx` — render branch.
- `view-tab-bim-settings.ts` — the standalone «Ρεαλιστικά Υλικά» toggle
  (`REALISTIC_MATERIALS_BUTTON`) removed (subsumed); `RealisticMaterialsToggle.tsx`
  deleted (dead code).
- i18n `dxf-viewer-shell` (el + en) — `ribbon.commands.visualStyle.label` + 8
  `presets.*`.

## 5. ADR-040 compliance
All touched files are `bim-3d/*` + config/state + ribbon — **outside** the 2D
micro-leaf critical path (CHECK 6B/6D cover CanvasSection/DxfRenderer/HoverStore
etc.). No high-frequency subscriber or bitmap-cache-key change.

## 6. Tests
- `config/__tests__/bim-visual-style.test.ts` — preset↔axes, default, guard,
  resolver derivation.
- `config/__tests__/bim-render-settings-migration.test.ts` — v2 visualStyle
  derivation.
- `state/__tests__/bim-render-settings-visual-style.test.ts` — setVisualStyle +
  legacy alias.
- `bim-3d/edges/__tests__/bim-3d-edge-overlay-builder.test.ts` — occlude→depthTest.
- `bim-3d/materials/__tests__/MaterialCatalog3D-visual-style.test.ts` —
  faceMode→variant.

## 7. Deferred (v1.1)
- Advanced standalone face/edge override toggles (the SSoT already models the axes —
  UI-only).
- 2D DXF visual styles (the ADR-345 wireframe2d/conceptual stub — a separate DXF
  concern, not BIM solids).
- Per-category visual-style overrides.

---

## Changelog
- **2026-06-13** — Default changed `realistic-edges` → `shaded-edges` (Σκιασμένο με
  Ακμές), Giorgio's request. `DEFAULT_VISUAL_STYLE` (SSoT) + `deriveVisualStyleFromLegacy`
  (absent/`false` legacy bit ⇒ default; explicit `true` still ⇒ `realistic-edges`).
  Tests updated; 39 jest pass.
- **2026-06-12** — v1: Visual Style SSoT (`bim-visual-style.ts`) + per-view
  persistence (subsumes ADR-413 `realisticMaterials`) + faceMode/edgeMode render
  pipelines + Radix «Στυλ Προβολής» dropdown (wires up the ADR-345 stub). 8 Revit
  presets incl. Hidden Line. Fulfils the ADR-375 C.7 «Visual-Style toggle on/off»
  defer. 106 jest pass. 🔴 browser-verify + commit.
