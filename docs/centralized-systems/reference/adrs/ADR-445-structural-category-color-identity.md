# ADR-445 — Per-Category Structural Colour Identity (Revit-grade)

**Status:** 🟢 v1 implemented — pending browser-verify + commit (2026-06-12)
**Discipline:** DXF Viewer · BIM rendering (2D plan + 3D)
**Related:** ADR-375 C.9 (Object Styles SSoT / `BIM_CATEGORY_LINE_COLORS`), ADR-363 (BIM drawing mode / per-entity render palettes), ADR-436 (foundation discipline)

---

## 1. Context / Problem

The structural BIM entities (τοίχος / άνοιγμα / πλάκα / κολώνα / δοκός / θεμελίωση / σκάλα /
κιγκλίδωμα) all read as **shades of grey** in the 2D plan. A distributed colour system
already existed (per-entity palette modules + `bim-object-styles.ts` + `material-catalog-defs.ts`),
but at the **category level** the distinction was weak — everything low-saturation grey:

- Foundation: all 3 kinds (pad/strip/tie-beam) were near-identical grey-blue.
- Stair: no fill palette at all (grey fallback).
- Beam / railing: colours hardcoded in the renderers, greyish.
- Column / wall / slab: muted greys with only within-kind variation.

Giorgio (2026-06-12) asked for distinct default colours per structural type.

## 2. What Revit does (honest answer)

Revit's **default plan** is monochrome **black lines + material poché** — it does NOT
rainbow-colour categories by default (optimised for plotting). BUT the Revit workflow
relies heavily on colour via **View Filters / View Templates** for working/analysis views,
where engineers DO colour-code by category/phase/rating, and via **Materials** in 3D
(concrete grey, steel blue, timber brown). Tools like Tekla/Allplan colour structural
elements by category by default.

**Decision:** this DXF viewer is a **model-authoring** tool (not final plot), so per-category
colour identity = exactly the Revit working-view convention. We adopt it, kept **muted /
construction-evocative** (not neon).

## 3. Decision — palette (by category)

Each CATEGORY gets one distinct hue; sub-types are **TINTS of the base** (a column always
reads blue; the kind is distinguished by SHAPE, not hue). Walls stay neutral (most numerous
= background).

| Category | Hue | Stroke | Rationale |
|----------|-----|--------|-----------|
| Τοίχος | slate (neutral) | `#2b2f36` ext / `#6b7280` int | background element, concrete |
| Κολώνα | steel blue | `#2f6690` (τοιχίο `#24506b`) | critical vertical |
| Δοκός | amber | `#b07d1f` | horizontal — contrasts blue columns |
| Πλάκα | taupe | `#6e6358` | large background area |
| Θεμελίωση | sienna | `#8a5a3c` (3 kind shades) | below grade = earth |
| Σκάλα | teal-green | `#2f8f6f` | circulation |
| Κιγκλίδωμα | cool steel-grey | `#607080` | thin metal |
| Άνοιγμα | (unchanged) | door `#c97c2f` / window `#2d72b8` | already distinct |

Key contrast: **blue columns ↔ amber beams** (complementary) — the two linear structural
elements separate cleanly where they overlap in plan.

## 4. SSoT touchpoints (the distributed colour system)

- **2D outline (central):** `config/bim-object-styles.ts` → `BIM_CATEGORY_LINE_COLORS`
  (added `beam`/`stair`/`railing`; re-hued `column`/`shearWall`/`foundation`) + the
  matching `DEFAULT_OBJECT_STYLES` entries now carry `projectionColor`/`cutColor` for
  beam/stair/railing. Drives 2D outline AND 3D edge overlays via `resolveSubcategoryStyle`.
- **2D fill (per palette module):** `bim/columns/column-render-palette.ts` (blue family),
  `bim/foundations/foundation-render-palette.ts` (sienna family), `bim/renderers/BeamRenderer.ts`
  (amber family, inline), `bim/renderers/RailingRenderer.ts` (steel-grey, inline). Wall + slab
  fills unchanged (already neutral/taupe). **Stair fill** is NEW — it now derives from the
  stair object-style colour via `resolveVgFillTint` (no separate constant needed).
- **3D faces (central):** `bim/materials/material-catalog-defs.ts` → `elem-column`/`elem-beam`/
  `elem-slab`/`elem-foundation`/`elem-railing` re-hued to **muted** 3D tones of the palette
  (large surfaces → desaturated to avoid cartoonish). Stair sub-elements keep realistic
  Revit-aligned materials (wood treads / concrete risers / metal stringers).

All colours remain **user-overridable** at the V/G category level (`objectStyles`); these are
only the defaults.

## 5. Google-level checklist (N.7.2)

✅ **Google-level: YES** — reuses the existing distributed colour SSoT (no new system),
category identity drives 2D + 3D consistently, zero render-pipeline change, colours stay
user-overridable. Tests updated where they asserted the old hues.

## 7. Persisted-state shadowing — version + migration (v1.1)

**Incident (Giorgio 2026-06-12):** after the palette change, foundations/columns still
rendered grey. Root cause: `bimRenderSettings.objectStyles` is **persisted per-level** in
Firestore, and the setters write the **FULL resolved map** (incl. default-valued colours).
`resolveBimSettings` does `{ ...DEFAULT_OBJECT_STYLES, ...persisted }`, so a level saved
before ADR-445 has the **old default colours frozen in** and they shadow the new code
defaults. `FoundationRenderer` reads fill from `resolveVgFillTint(objectStyles.foundation)`
→ old grey. The new code never reaches already-saved levels.

**Fix — one-time colour-refresh migration (`migrateBimRenderSettings`):**
- Added `BIM_SETTINGS_VERSION` + optional `settingsVersion` on `BimRenderSettings`.
- `loadForLevel` runs the migration on any doc below the current version: it re-derives
  ONLY `projectionColor`/`cutColor` (parent + subcategories) from current
  `DEFAULT_OBJECT_STYLES`, **preserving** user pen / visibility / line-pattern edits, stamps
  the version, and persists once (idempotent — never re-runs for that level).
- Manual escape hatch already exists: View → Object Styles → «Επαναφορά» (`resetToDefaults`).

This auto-heals every level/user on next open without wiping genuine V/G edits.

## 6. Out of scope / DEFER

- Colour-by-material mode (concrete/steel/masonry/timber) — rejected: most Greek structural
  elements are Ο.Σ. (concrete) → would collapse to all-grey, defeating the goal.
- Extracting beam/railing inline palettes into dedicated `*-render-palette.ts` modules
  (Boy-Scout centralisation) — noted, deferred (colours-only change here).
- Theme-conditional (light/dark) structural colours.

## Changelog

- **2026-06-14** — v1.3 (Opus 4.8). **«Επιλογή Όμοιων Ίδιο Χρώμα» επεκτάθηκε σε ΟΛΕΣ τις
  BIM οντότητες** (Giorgio request). Πριν: το `findEntitiesWithSimilarColor` (context-menu
  εντολή, ADR-030) έλυνε χρώμα ΜΟΝΟ από το DXF layer cascade → οι BIM οντότητες έπεφταν σε
  fallback λευκό → η εντολή δεν έκανε τίποτα (ή θα επέλεγε τα πάντα). Fix = νέος SSoT resolver
  `systems/selection/bim-entity-color.ts` (`resolveBimEntityColorHex`) που επαναχρησιμοποιεί
  τη ΔΙΑΝΕΜΗΜΕΝΗ colour-identity (αυτό το ADR): `resolveEntityBimCategory` → `resolveSubcategoryStyle`
  (projection colour, τιμά V/G category overrides + per-element `styleOverride`), με subcategory
  μόνο στις χρωματικά διακριτές περιπτώσεις (wall interior/exterior, column shear-wall, opening
  window/door) μέσω των ΥΠΑΡΧΟΝΤΩΝ helpers (`wallFootprintSubcategory`/`isWallColumnKind`/`isWindowKind`)
  — μηδέν διπλασιασμός ταξινόμησης. `resolveEntityColorHex` δοκιμάζει πρώτα το BIM resolver,
  αλλιώς DXF cascade· `findEntitiesWithSimilarColor` + handler (`CanvasSection`) περνούν live
  `objectStyles` (`useBimRenderSettingsStore.getState()` — ίδια πηγή με τους 2D renderers, event-time
  getter → ADR-040-safe). `resolveEntityBimCategory` διευρύνθηκε σε `DxfEntityUnion | Entity`
  (param-driven Dxf wrappers κατοπτρίζουν `XEntity['params']`). 17/17 jest (10 νέα). DEFER: οι 3
  per-kind αποχρώσεις θεμελίωσης (inline στον FoundationRenderer) → v1 ομαδοποιεί όλες τις
  θεμελιώσεις στο category sienna (το object-styles outline ΕΙΝΑΙ category-level). 🔴 browser-verify
  (κλικ σε κολώνα/δοκάρι/πόρτα → δεξί κλικ → «Επιλογή Όμοιων Ίδιο Χρώμα» επιλέγει όλα τα ίδιας
  ταυτότητας) + commit. ΕΚΤΟΣ ADR-040 (CanvasSection: μόνο getter add). Related: ADR-030.
- **2026-06-12** — v1 created (Opus 4.8). Per-category structural colour identity:
  column→steel-blue, beam→amber, foundation→sienna (3 shades), stair→teal-green (+ first
  fill), railing→steel-grey; wall/slab kept neutral; opening unchanged. 2D outline (object-styles
  SSoT) + 2D fills (palette modules) + 3D faces (material-catalog) updated. 3 resolver tests
  re-pointed from `beam` to `ceiling` (beam now has a colour); 6 column hex assertions updated.
  89/89 affected tests green. Pending browser-verify + commit.
- **2026-06-12** — v1.1 (Opus 4.8). Persisted-state fix: `bimRenderSettings` gained
  `settingsVersion` + `migrateBimRenderSettings` (re-derives structural colours from current
  defaults on load, preserving pen/visibility, persists once). Wired into store `loadForLevel`.
  5 migration tests. (Pre-existing unrelated red: `bim-render-settings-subcategory.test.ts` ×2
  — stale «wall has no default subcategories» premise vs committed `wall.interior`; not touched.)
- **2026-06-12** — v1.2 (Opus 4.8). **Foundation per-kind colour — ΔΙΑΚΡΙΤΕΣ ΧΡΟΙΕΣ
  (Giorgio: «συνδετήριες == πεδιλοδοκοί» — και μετά το 1ο fix «πάλι ίδια»).** Δύο root causes:
  (1) 2D outline+centerline + 3D material resolved at **category** level → όλα τα kinds ίδιο χρώμα·
  (2) ΚΡΙΣΙΜΟ: το 2D **fill** (κυρίαρχη επιφάνεια) έπαιρνε `resolveVgFillTint('foundation')` που
  επιστρέφει ΠΑΝΤΑ το category sienna (frozen στα persisted objectStyles) → το per-kind fill ΔΕΝ
  χρησιμοποιείτο ποτέ· (3) οι αρχικές 3 αποχρώσεις sienna ήταν πολύ κοντινές για να ξεχωρίσουν →
  Giorgio επέλεξε **διακριτές ΧΡΟΙΕΣ** (συνειδητή τοπική εξαίρεση στον κανόνα «1 χροιά/κατηγορία»
  — η ευκρίνεια προέχει). **Palette (`FOUNDATION_KIND_STROKE`/`FOUNDATION_KIND_FILL`):** πέδιλο
  sienna `#8a5a3c` · πεδιλοδοκός teal `#2f7d6a` · συνδετήρια κεραμυδί `#b5651d`· fill opacity
  0.18→0.28 ώστε η χροιά να διαβάζεται. **Fix (no migration — palette = code):** (2D)
  `FoundationRenderer`: outline+centerline via `kindStrokeColor` (`styleOverride.color ?? layer.color
  ?? FOUNDATION_KIND_STROKE[kind]`, βάρος από resolver)· **fill → `FOUNDATION_KIND_FILL[kind]`
  απευθείας** (αφαιρέθηκε η category `resolveVgFillTint` που έσβηνε τη διάκριση)· dropped unused
  import. (3D) `elem-foundation-pad/-strip/-tie-beam` με τις ΙΔΙΕΣ χροιές + `getElementMaterial3D`
  union + `foundation-to-three` picks `elem-foundation-${kind}`. **4 MOD** (FoundationRenderer,
  foundation-render-palette, material-catalog-defs, MaterialCatalog3D, foundation-to-three) + **2 test
  files**. 14/14 affected tests green. ⚠️ `FoundationRenderer` = ADR-040 micro-leaf → STAGE ADR-040.
  SKIP tsc (small· N.17). ΕΚΤΟΣ adr-index (shared tree). 🔴 browser-verify (πέδιλο καφέ / πεδιλοδοκός
  teal / συνδετήρια κεραμυδί, 2Δ + 3Δ) + commit (git add ΜΟΝΟ δικά μου). ΣΗΜ: το strip-teal `#2f7d6a`
  είναι κοντά στο stair-teal `#2f8f6f` — αν μπερδεύει, εύκολο tweak.
