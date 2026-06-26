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

## 8. §2 — Dark «σαν 2Δ» background mode (2026-06-20)

**Problem.** Giorgio works mostly in the 2D canvas: he likes the entity line work on
the dark AutoCAD background. In 3D the look diverged on two counts — (a) the visible
background was always the lighting environment (gradient sky colour or HDRI texture,
never dark), and (b) the model edges were forced to a uniform near-black silhouette
(`#1a1a1a`, §4 v2.22) which is invisible on a dark background anyway. He asked for the
3D model lines + dark background to match the 2D view, **with FULL SSoT — exactly the
2D colours, no recolouring**.

**Root cause.**
- Background: `EnvmapGenerator` wrote `scene.background` from the env (`skyColor` /
  HDRI) on every light-preset change, overriding `renderer.setClearColor`. `background`
  (what you SEE) and `environment` (how PBR faces are LIT) were coupled.
- Edges: `bim-three-edges.ts` overrode the resolver colour with the uniform
  `BIM_3D_EDGE_COLOR`. The resolver already returns the SAME per-category colour the
  2D renderers read (`resolveSubcategoryStyle`); the override was discarding it.

**Decision — a `backgroundMode` field on the per-view appearance SSoT
(`bim-render-settings-store`), ORTHOGONAL to the `visualStyle` preset.**

```
backgroundMode = 'environment' (default — photoreal sky/HDRI) | 'dark' (σαν 2Δ)
```

It lives on `BimRenderSettings` next to `visualStyle` (the SAME ADR-446 per-view,
Firestore-persisted SSoT for «how this view looks») — NOT on the lighting
`EnvironmentStore` (HDRI/sun, non-persisted). Reasons: (1) it is a view appearance
preference, identical in nature to `visualStyle`; (2) it persists per-view, so a user's
dark-view choice is remembered per level; (3) the rebuild subscriber
(`use-bim3d-vg-resync`) already watches this store, so visualStyle + backgroundMode
share ONE subscription. The type itself lives in `config/bim-visual-style.ts` (the
pure-data appearance SSoT). It is its own field rather than a `VisualStylePreset`
variant because it is orthogonal — any preset pairs with either background.

- **Background (what you see).** `EnvmapGenerator.applyBackground()` is the sole
  resolver of `scene.background`: in `dark` it paints the FULL-SSoT 2D canvas colour
  via `resolveDxfCanvasBackgroundHex()` (the live `--canvas-background-dxf` token —
  a theme switch moves both 2D and 3D together), in `environment` it restores the
  env-derived sky/HDRI. **`scene.environment` is never touched**, so PBR faces keep
  their IBL lighting/reflections in either mode. The manager flips it imperatively on
  the `bim-render-settings-store` subscription (+ repaint).
- **Edges (the line work).** In `dark`, `bim-three-edges.ts` DROPS the uniform-
  silhouette override entirely → each entity keeps EXACTLY its 2D `style.color`
  (blue columns, amber beams, …). FULL SSoT, zero recolouring. In `environment` the
  v2.22 uniform near-black silhouette (Revit "Shaded with Edges") is unchanged.
  width/pattern/visibility stay resolver-driven in both. The colour is baked at
  edge-build time, so a mode flip rebuilds via `use-bim3d-vg-resync` (f), folded into
  the existing visualStyle subscription (one store, one sub).
- **UI.** A «Σκούρο φόντο (σαν 2Δ)» switch in the Lighting 3D panel tab (reads the
  `bim-render-settings-store` primitive).

**Files.** `config/bim-visual-style.ts` (`BackgroundMode` type + `DEFAULT_BACKGROUND_MODE`)
· `config/bim-render-settings-types.ts` (persisted `backgroundMode` field + resolved +
`resolveBimSettings`) · `state/bim-render-settings-store(-types).ts` (`setBackgroundMode`
+ buildRaw/loadForLevel) · `lighting/envmap-generator.ts` (`setBackgroundMode` +
`applyBackground` SSoT) · `scene/ThreeJsSceneManager.ts` (+ `scene-dispose.ts`)
subscription/teardown · `converters/bim-three-edges.ts` (drop override in dark) ·
`viewport/use-bim3d-vg-resync.ts` (f) rebuild trigger · `config/color-config.ts`
(`resolveDxfCanvasBackgroundHex` SSoT helper) · `panels/Lighting3DPanelTab.tsx` (UI)
· i18n `bim3d.lighting.darkBackground` (el+en). 8 jest (bim-three-edges).

**ADR-040.** Background flip is imperative (manager subscription, zero React render).
Edge rebuild reuses the existing `use-bim3d-vg-resync` path. No new high-freq subscriber.

### 8.1 — §2.1 Studio gradient default background (2026-06-26)

**Problem.** Giorgio: the `environment` mode (the DEFAULT) painted a flat saturated sky-blue
(`0x87ceeb`) backdrop — unpleasant to draw on. He asked for the look the "big players" use
(Revit / Maxon Cinema 4D), **FULL ENTERPRISE + FULL SSoT**, and confirmed the right base is
the SAME colour as the 2D canvas (just with gradient depth, not flat).

**Decision — the `environment` (non-HDRI) backdrop is a neutral vertical STUDIO GRADIENT
built AROUND the 2D-canvas base colour.** It keeps the `--canvas-background-dxf` token as the
ONE colour SSoT shared by 2D + 3D (a theme switch moves both), but gives 3D the Cinema 4D
depth: darker at the top, the base in the middle, lighter at the bottom. The gradient is a
plain non-equirect `DataTexture` set as `scene.background`, so it renders **screen-fixed**
(does not swim with the camera). The visible backdrop was decoupled from the IBL `skyColor`:
`scene.environment` (the gradient sky/ground IBL that LIGHTS the PBR faces) is **unchanged** —
only the backdrop you SEE changed (Giorgio: «το IBL φωτισμό/reflections μένει ίδιος»).

- **Colour SSoT.** `studio-background-texture.ts` (NEW, pure `studioGradientStops` + the
  `DataTexture` builder) reads the base via `resolveDxfCanvasBackgroundHex()` (the same helper
  the `dark` mode uses) and spreads ±`STUDIO_BG_DELTA` (0.12) lightness around it. A pure-black
  base clamps the top to black (upper half stays black, lower half eases to grey = dark studio).
- **Sole writer unchanged.** `EnvmapGenerator.applyBackground()` stays the SOLE resolver of
  `scene.background`: `dark` → flat 2D colour (unchanged); `environment` → loaded HDRI if any,
  else the cached studio gradient (`ensureStudioBackground`, rebuilt only when the 2D base hex
  changes — theme-aware, disposed in `dispose()`). The now-unused `currentSkyColor` field was
  removed (boy-scout, N.0.2 — it was the old solid-background source).

**Files.** `lighting/studio-background-texture.ts` (NEW, pure colour math + `DataTexture`) ·
`lighting/envmap-generator.ts` (`applyBackground` → studio gradient, `ensureStudioBackground`
cache, drop dead `currentSkyColor`, dispose). 6 jest (gradient stops + texture shape).

**ADR-040.** No change to the render pipeline — the backdrop is a `scene.background` swap on
the existing `EnvmapGenerator` (imperative, zero React). Section-stencil save/restore of
`scene.background` already handles a `Texture` value (was a `Color`). 🔴 browser-verify
(gradient orientation: darker top → lighter bottom; swap the two stops if inverted).

---

## Changelog
- **2026-06-26** — §2.1 Studio gradient default background: the `environment` (default) backdrop
  is now a neutral vertical studio gradient (Cinema 4D / Blender look) built AROUND the SAME
  2D-canvas base colour (`resolveDxfCanvasBackgroundHex` — ONE token SSoT for 2D + 3D), replacing
  the flat sky-blue `0x87ceeb`. Screen-fixed `DataTexture`; `scene.environment`/IBL untouched
  (faces lit identically). NEW pure `studio-background-texture.ts` (±0.12 lightness, jest 6);
  `EnvmapGenerator` caches it theme-aware + drops the dead `currentSkyColor`. 🔴 browser-verify
  (orientation) + commit.
- **2026-06-20** — §2 Dark «σαν 2Δ» background mode: `backgroundMode` field on the
  per-view appearance SSoT (`bim-render-settings-store`, Firestore-persisted, beside
  `visualStyle`) — NOT a separate store. FULL-SSoT 2D colours (edges drop the uniform
  override → per-category `style.color`; background = live `--canvas-background-dxf`
  token via `resolveDxfCanvasBackgroundHex`). `scene.environment` untouched (PBR lit in
  both); orthogonal to visualStyle (own field, shared rebuild subscription). 8 jest pass.
  🔴 browser-verify + commit. **(Next phase: ADR-TBD plan-locked 3D mode — 2D grips
  inside the 3D view.)**
- **2026-06-13** — Default changed `realistic-edges` → `shaded-edges` (Σκιασμένο με
  Ακμές), Giorgio's request. `DEFAULT_VISUAL_STYLE` (SSoT) + `deriveVisualStyleFromLegacy`
  (absent/`false` legacy bit ⇒ default; explicit `true` still ⇒ `realistic-edges`).
  Tests updated; 39 jest pass.
- **2026-06-12** — v1: Visual Style SSoT (`bim-visual-style.ts`) + per-view
  persistence (subsumes ADR-413 `realisticMaterials`) + faceMode/edgeMode render
  pipelines + Radix «Στυλ Προβολής» dropdown (wires up the ADR-345 stub). 8 Revit
  presets incl. Hidden Line. Fulfils the ADR-375 C.7 «Visual-Style toggle on/off»
  defer. 106 jest pass. 🔴 browser-verify + commit.
