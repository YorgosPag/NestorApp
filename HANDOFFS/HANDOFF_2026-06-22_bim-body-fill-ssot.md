# HANDOFF — FULL SSoT BIM body fill (ADR-509) + column ghost fixes

**Ημερομηνία:** 2026-06-22 · **Μοντέλο:** Opus 4.8 · **STATUS: UNCOMMITTED**

## Κατάσταση (τι ΕΓΙΝΕ — όλα uncommitted)

### 1. Column ghost dashed → solid (ADR-398 §3.8)
- `ColumnRenderer.ts` outline stroke: προστέθηκε ρητό `this.ctx.setLineDash([])` πριν το stroke (render-state leak — το preview canvas κληρονομούσε dash από tracking/polar paint). Mirror WallRenderer.

### 2. FULL SSoT body fill (ADR-509) — Giorgio order «όλα τα BIM ίδια διαφάνεια, ίδιος κώδικας»
- **ΡΙΖΑ:** μόνο ο WallRenderer εφάρμοζε `adaptFillTintForCanvas` (ADR-509)· οι υπόλοιποι ~24 BIM renderers ζωγράφιζαν body fill raw → ασύμβατη διαφάνεια σε μαύρο φόντο.
- **NEW** `bim/utils/bim-body-fill.ts` → `resolveBimBodyFill(category, cut, styles, fallback)` = σύνθεση `resolveVgFillTint(...) ?? fallback → adaptFillTintForCanvas`. Χρήση: Wall/Column/Beam/Slab/SlabOpening.
- **Οι υπόλοιποι** (Stair per-tread, Foundation, Roof, ThermalSpace, FloorFinish, WallCovering, ElectricalPanel, Mep{Boiler,Manifold,Radiator,Underfloor,WaterHeater,Fitting,Fixture,Segment}, Furniture, mesh-silhouette-draw, beam-section-profile-draw, column-renderer-overlays) καλούν **ΑΠΕΥΘΕΙΑΣ** το υπάρχον `adaptFillTintForCanvas`.
- `WALL_CATEGORY_FILL` base alpha → 0.22 σε όλες τις κατηγορίες (= KIND_FILL κολώνας).
- **ΜΑΘΗΜΑ (4 γύροι Giorgio SSoT audit):** (α) αρχικό audit επιφανειακό — βρήκα 6→11→21→25 sites σταδιακά· (β) είχα φτιάξει περιττό 1:1 wrapper `adaptBimBodyFill` → **αφαιρέθηκε** (Giorgio το έπιασε)· το χειροκίνητο κυνήγι call-site ΔΕΝ κλιμακώνεται.
- `stair-render-structure-style.test.ts`: 2 asserts ενημερώθηκαν να ελέγχουν `adaptFillTintForCanvas(...)` (self-consistent, bg-agnostic) αντί boosted literal.

## Verify
- ✅ 138/138 BIM renderer jest GREEN
- ✅ τα ~26 touched αρχεία tsc-clean (project exit 2 = γνωστά προϋπάρχοντα errors άλλων, CLAUDE.md)
- ✅ audit καθαρό: κανένα raw translucent body fill, μηδέν `adaptBimBodyFill`

## 🔴 ΕΚΚΡΕΜΟΥΝ
1. **browser-verify** στο `/dxf/viewer`: (α) column ghost = συνεχές περίγραμμα ίδιο με τοποθετημένη· (β) όλα τα BIM body fills ίδια διαφάνεια σε μαύρο φόντο.
2. **commit** (Giorgio order) — ⚠️ CHECK 6D: stage **ADR-040 + ADR-375 + ADR-509** (entity renderers). ~26 source αρχεία + ADR-398 + ADR-509 + pending-ratchet.
3. **RATCHET (επόμενο pass)** — `.ssot-registry.json` module «bim-body-fill»: forbid raw translucent `fillStyle = rgba(...0.NN)` / `?? *_FILL` σε `bim/renderers/**` (πρέπει adaptFillTintForCanvas/resolveBimBodyFill) + `npm run ssot:baseline`. **ΓΙΑΤΙ κρίσιμο:** χωρίς αυτό, νέος renderer ξεχνά τον helper → το FULL SSoT είναι εύθραυστο. Flagged στο `.claude-rules/pending-ratchet-work.md`.
4. **DEFER (lines, χαμηλή αξία):** strokeStyle → `adaptEntityColorForCanvas` στους ίδιους renderers — no-op σήμερα (contrast≥3).

## Αρχεία (uncommitted)
NEW: `bim/utils/bim-body-fill.ts`
MOD renderers: ColumnRenderer, WallRenderer, BeamRenderer, SlabRenderer, SlabOpeningRenderer, stair-render-structure-style, FoundationRenderer, RoofRenderer, ThermalSpaceRenderer, FloorFinishRenderer, WallCoveringRenderer, ElectricalPanelRenderer, MepBoilerRenderer, MepManifoldRenderer, MepRadiatorRenderer, MepUnderfloorRenderer, MepWaterHeaterRenderer, MepFittingRenderer, MepFixtureRenderer, MepSegmentRenderer, FurnitureRenderer, RailingRenderer, mesh-silhouette-draw, beam-section-profile-draw, column-renderer-overlays
MOD config: `bim/walls/wall-render-palette.ts` (alpha 0.22)
MOD test: `__tests__/stair-render-structure-style.test.ts`
DOCS: ADR-398, ADR-509, `.claude-rules/pending-ratchet-work.md`
