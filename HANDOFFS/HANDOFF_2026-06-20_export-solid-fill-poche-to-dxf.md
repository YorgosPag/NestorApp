# HANDOFF — Συμπαγές γέμισμα (SOLID poché) επιφανειών σοβά/κολώνας/δοκαριού στο DXF

**Ημερομηνία:** 2026-06-20
**Προηγούμενο:** ADR-505 §C (finish/rebar export) + Phase D (3Δ οπλισμός) — **UNCOMMITTED**, Τέκτονας ✅ + AutoCAD ✅ (σοβάδες 3Δ, οπλισμός 3Δ κλωβός). Ο Giorgio θα κάνει commit.
**Στόχος νέας συνεδρίας:** εξαγωγή **γεμάτων (βαμμένων) επιφανειών** στο DXF — εκτός από το περίγραμμα, και **συμπαγές γέμισμα** ανά επιφάνεια, σε **ξεχωριστά layers**. Revit-grade, **FULL ENTERPRISE + FULL SSOT**.

---

## 0. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)
- **Το working tree ΜΟΙΡΑΖΕΤΑΙ με άλλον agent** (structural ADR-499/503/504/506). Stage/άγγιξε **ΜΟΝΟ δικά σου αρχεία**. ΠΟΤΕ `git add -A`.
- **Commit ΜΟΝΟ ο Giorgio** — εσύ ΠΟΤΕ (N.(-1)).
- **ΠΡΙΝ γράψεις κώδικα → πραγματικό SSoT audit (grep)**, χρησιμοποίησε υπάρχοντα, μηδέν διπλότυπα (ρητή απαίτηση Giorgio).
- GOL + SSOT. tsc: ΕΝΑ τη φορά (N.17 — έλεγξε για άλλον tsc πρώτα).

## 1. ΑΠΟΦΑΣΕΙΣ (κλειδωμένες από Giorgio)
1. **Γέμισμα με DXF `SOLID`** (ΟΧΙ HATCH). Λόγος: ο writer βγάζει **bare DXF χωρίς HEADER/TABLES** → το true HATCH (boundary loops/pattern/handles) «κολλάει» στον AutoCAD (ίδια αιτία που κόλλαγε πριν με ελληνικά layers). Το `SOLID` (R12, 3-4 σημεία, γεμάτο) δίνει **οπτικά πανομοιότυπο** «βαμμένη επιφάνεια» με μηδέν ρίσκο — όπως τα LINE/CIRCLE που ήδη βγάζουμε.
2. **Layers ανά ΚΑΤΗΓΟΡΙΑ οντότητας** (Giorgio 2026-06-20 ρητά: «κάθε οντότητα, π.χ. σοβάδες, κολώνες, δοκάρια, την θέλω σε δικό του layer»). ΟΧΙ ανά instance, ΟΧΙ ένα global. Δηλαδή: **σοβάδες → 1 layer**, **κολώνες → 1 layer**, **δοκάρια → 1 layer**, πλάκες → 1, πέδιλα → 1 (+ ο οπλισμός μένει `REBAR`).
3. **Γέμισμα σε ΞΕΧΩΡΙΣΤΟ layer** ανά κατηγορία (π.χ. `COLUMNS` περίγραμμα + `COLUMNS_FILL` γέμισμα) → ανάβει/σβήνει χωριστά.
4. Εφαρμογή σε: **σοβάς (περιμετρικές όψεις) + κολώνες + δοκάρια** (+ πλάκα/πέδιλο, ίδιος μηχανισμός).

### ⚠️ 1 σημείο να επιβεβαιώσεις με Giorgio στην αρχή (lead με συγκεκριμένο παράδειγμα):
**Plan poché (2Δ, στο z=0) vs κατακόρυφη όψη γεμάτη (3Δ).** Ο Giorgio διάλεξε `SOLID` (που είναι κατά βάση **planar/2Δ** → οδηγεί σε **plan poché**: γεμάτο footprint/λωρίδα στην κάτοψη, κλασικό «βαμμένο» σκυρόδεμα). Αν θέλει οι **κατακόρυφες** όψεις σοβά γεμάτες σε 3Δ shaded → αυτό θέλει **`3DFACE`** (αρβίτραρι 3Δ quad), όχι SOLID. Δείξε του ΑΣΧΗ παράδειγμα και κλείδωσέ το:
```
SOLID (plan poché, 2Δ):            3DFACE (κατακόρυφη όψη, 3Δ):
  κάτοψη: ████ footprint γεμάτο      κάθε περιμετρική όψη = γεμάτο
  (στο z=0)                          κατακόρυφο τετράγωνο (ύψος×μήκος)
```
Default αν δεν απαντήσει: **SOLID plan poché** (footprint κολώνας/δοκαριού + λωρίδα σοβά, γεμάτα στην κάτοψη).

## 2. SSoT AUDIT — υπάρχων κώδικας προς REUSE (μη ξαναγράψεις)
- **Triangulation SSoT:** `THREE.ShapeUtils.triangulateShape(contour, holes)` — ήδη σε χρήση: `bim-3d/converters/column-piece-geometry.ts:87`, `roof-to-three.ts`, `wall-piece-geometry.ts`. Reuse για **non-rectangular** σχήματα (Γ/Τ/U κολώνες, πολυγωνική πλάκα) → λίστα τριγώνων. **Ορθογώνια (τα περισσότερα + λωρίδα σοβά = quad)** → ΧΩΡΙΣ triangulation, ένα SOLID quad (fast-path).
- **Carrier τύπος — υπάρχει ήδη:** `HatchEntity` (`types/entities.ts:532`, `type:'hatch'`, `patternType:'solid'`, `boundaryPaths`, `fillColor`) ΕΙΝΑΙ ΣΤΟ `Entity` union αλλά ο writer δεν τον σειριοποιεί. **REUSE τον ως fill carrier** → ο collector βγάζει `HatchEntity{patternType:'solid'}`, ο writer τον μετατρέπει σε **SOLID τρίγωνα** (μηδέν νέος global τύπος, μηδέν cast). Έτσι μοντελοποιείται «επίσημα» το solid-fill και σειριοποιείται ασφαλώς.
- **Boundary γεωμετρίας (ίδιο με το outline → τέλειο match):**
  - Σοβάς: `collectFinishOutlinePlanPolylines` (`bim/finishes/structural-finish-plan-geometry.ts`) → ήδη επιστρέφει **κλειστό quad** `[aCore,aOuter,bOuter,bCore]` ανά όψη + `colorHex` (υλικό) + `heightMm`. Κάθε quad → ένα SOLID. ✅ έτοιμο.
  - Κολώνα/δοκάρι/πλάκα/πέδιλο footprint: `extractFootprintVertices`/`decomposeBimEntityToDxfPrimitives` (`export/core/bim-to-dxf-primitives.ts` — footprint??outline??polygon convention). Reuse → ίδιο boundary με το outline που ήδη εξάγεται.
- **Χρώμα fill (βαμμένη):** σοβάς = `getMaterialFlatColorHex(materialId)` (ήδη στο finish polyline)· κολώνα/δοκάρι = `resolveEntityColorHex` (SSoT, `systems/selection/select-similar-by-color`, ADR-445 category color) — όπως κάνει ο `stampRenderedColors` στον adapter.
- **Collector / wiring (ADR-505 §C, δικά σου):** `export/core/overlay-dxf-collector.ts` (finish + rebar σήμερα)· `export/formats/dxf-export-adapter.ts` (`buildDxfExportRequest` + `mergeFloorsToSingleDxfScene`, με `FLnn_` prefix)· `export/core/dxf-ascii-writer.ts` (writer, ήδη πρόσθεσες Z group 30/31 σε LINE).
- **ACI χρώμα:** ο writer ήδη κάνει `hexToAci` (code 62) — το SOLID θα το κληρονομήσει.

## 3. ΑΡΧΙΤΕΚΤΟΝΙΚΗ (full SSoT)
1. **Writer — NEW `emitSolid` + case 'hatch':** `dxf-ascii-writer.ts` → στο `writeEntity` πρόσθεσε `case 'hatch'`: triangulate τα `boundaryPaths` (quad→1, αλλιώς `THREE.ShapeUtils.triangulateShape`) → για κάθε τρίγωνο `emitSolid`. **DXF SOLID quirk:** groups `10/20, 11/21, 12/22, 13/23` με **bowtie order** (3η & 4η κορυφή ΑΝΤΕΣΤΡΑΜΜΕΝΕΣ vs polygon)· για τρίγωνο → 4η κορυφή = 3η. Χρώμα = code 62 (ίδιο cascade). Z: planar (z=0) για plan-poché (ή group 38 elevation αν χρειαστεί). **Tekton:** ο minimal parser αγνοεί SOLID (διαβάζει μόνο LINE/TEXT/CIRCLE) → το fill είναι AutoCAD-only, μηδέν βλάβη στον Τέκτονα.
2. **Collector — fill entities (per-CATEGORY layers + ξεχωριστό fill layer):** στον `overlay-dxf-collector.ts` πρόσθεσε fill pass: για κάθε ορατό στοιχείο → boundary (reuse §2) → `HatchEntity{type:'hatch', patternType:'solid', boundaryPaths:[ring], fillColor, layerId: '<CATEGORY>_FILL'}`. **Layer names (ASCII!, μην βάλεις ελληνικά → AutoCAD κολλάει):** σοβάς `FINISH`/`FINISH_FILL`, κολώνες `COLUMNS`/`COLUMNS_FILL`, δοκάρια `BEAMS`/`BEAMS_FILL`, πλάκες `SLABS`/`SLABS_FILL`, πέδιλα `FOOTINGS`/`FOOTINGS_FILL`. Register τα νέα layers στο `layers` map (το adapter τα κάνει merge + `FLnn_` prefix).
3. **Gating + mode:** ίδιο «export what's visible» (`isStructuralComponentVisible`). Το fill μπαίνει και στα δύο modes (Tekton το αγνοεί) ή μόνο polyline — απόφαση: emit always (απλούστερο, Tekton ignore).
4. **Per-CATEGORY outline layers — ΠΡΟΣΟΧΗ (scope):** σήμερα (α) ο σοβάς πάει σε ΕΝΑ `FINISH` layer (✅ ήδη per-category — ΟΚ), (β) ο **οπλισμός** σε `REBAR` (✅ μένει), αλλά (γ) το **body κολώνας/δοκαριού** εξάγεται από `decomposeBimEntityToDxfPrimitives` στο **source `entity.layerId`** (το αρχικό DXF layer), ΟΧΙ σε `COLUMNS`/`BEAMS`. Ο Giorgio θέλει **κάθε κατηγορία σε δικό της layer** → πρέπει να μεταφέρεις τα BIM δομικά body outlines σε per-category layers (`COLUMNS`/`BEAMS`/`SLABS`/`FOOTINGS`). Επιλογή: στο `stampRenderedColors`/flatten path του adapter, override `layerId` για BIM δομικά σε category layer (reuse `entity.type`→category map). **Επιβεβαίωσε με Giorgio**: να μεταφερθούν ΚΑΙ τα non-δομικά (τοίχοι/Η-Μ/άνοιγμα) σε category layers ή μόνο τα δομικά που γεμίζουμε; (concrete example).

## 4. Tests
- writer: `HatchEntity{patternType:'solid'}` quad → N×`SOLID` (group 0=SOLID, σωστό bowtie order)· non-rect ring → triangulated SOLIDs· χρώμα 62.
- collector: στοιχείο ορατό → fill `HatchEntity` σε `_FILL` layer + outline σε per-element layer· gating off → κανένα fill· layers registered.
- adapter: fill entities + layers επιβιώνουν, `FLnn_` prefix στο all-single.
- tsc background, ΕΝΑ τη φορά (N.17).

## 5. Verify + ADR/tracking
- Browser: ενεργοποίησε σοβά/οπλισμό → Εξαγωγή (AutoCAD/polyline) → άνοιξε σε AutoCAD: κάθε επιφάνεια **περίγραμμα + γεμάτο SOLID** σε δικά της layers (σβήσε το `_FILL` layer → μένει μόνο περίγραμμα). Έλεγξε κολώνες/δοκάρια poché.
- Επέκτεινε **ADR-505 §C** (νέο μέρος «SOLID fill / poché») + changelog· `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (N.15)· `adr-index.md`· memory `reference_unified_export_system.md` + `MEMORY.md`.

## 6. Reference (τι ήδη υπάρχει)
- ADR: `docs/centralized-systems/reference/adrs/ADR-505-unified-export-system.md` (§C + Phase D, changelog j/k).
- Memory: `~/.claude/projects/C--Nestor-Pagonis/memory/reference_unified_export_system.md` (πλήρες verify journey + SSoT map + §C/D + ΜΑΘΗΜΑ AutoCAD bare-DXF/ASCII-layers).
- §C/D αρχεία (όλα δικά μου, UNCOMMITTED): `bim/structural/reinforcement/{rebar-plan-geometry-types, column-/linear-member-/footing-/slab-rebar-plan-geometry, rebar-segments-3d-linear, rebar-segments-3d-grid}.ts`· `bim/finishes/structural-finish-plan-geometry.ts`· `export/core/overlay-dxf-collector.ts`· MOD: 5 rebar/finish 2D renderers + `export/core/dxf-ascii-writer.ts`(Z) + `export/formats/dxf-export-adapter.ts` + `export/export-service.ts`.

---
**ΠΡΩΤΟ ΒΗΜΑ νέας συνεδρίας:** SSoT audit §2 (επιβεβαίωσε `THREE.ShapeUtils.triangulateShape` + `HatchEntity` carrier + finish/footprint boundary extractors) → επιβεβαίωσε με Giorgio (concrete examples) ΜΟΝΟ τα 2 ανοιχτά: (1) §1.⚠️ plan-poché 2Δ (SOLID, default) vs κατακόρυφη όψη 3Δ (3DFACE)· (2) §3.4 scope του per-category re-layering (μόνο δομικά που γεμίζουμε ή ΚΑΙ τοίχοι/Η-Μ). Layers **ανά κατηγορία = ΚΛΕΙΔΩΜΕΝΟ**. → υλοποίηση writer `case 'hatch'`→SOLID → collector fill pass (per-category layers) → body re-layering → tests → ADR/tracking. **Commit: ΜΟΝΟ ο Giorgio.**
