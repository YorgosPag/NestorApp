# HANDOFF — Σταδιακός έλεγχος δημιουργίας BIM «από κάναβο»: κολόνες → δοκάρια → πλάκες (με σεβασμό στις προεξοχές κολόνων)

**Ημερομηνία:** 2026-06-14
**Θέμα:** Verify (Firestore-first, σταδιακά) ότι κολόνες/δοκάρια/πλάκες δημιουργούνται σωστά «από κάναβο», με ΕΜΦΑΣΗ στο: **η πλάκα φατνώματος πρέπει να λαμβάνει υπόψη τις προεξοχές των κολόνων** (οι κολόνες έχουν μεγαλύτερη διατομή από τα δοκάρια → μπαίνουν στο εσωτερικό της πλάκας → η πλάκα πρέπει να «σπάει»/notch γύρω τους).
**Quality bar:** FULL ENTERPRISE + FULL SSOT, Revit/ArchiCAD-grade. Παίρνεις εσύ τις professional αποφάσεις, ζητάς έγκριση plan ΠΡΙΝ γράψεις κώδικα.

---

## ΚΑΤΑΣΤΑΣΗ ΣΚΗΝΗΣ (από Giorgio)
- **ΟΛΕΣ οι BIM collections διαγράφηκαν** → baseline κενό (`floorplan_columns` / `_beams` / `_walls` / `_slabs` / foundations = 0).
- **6 οδηγοί δημιουργήθηκαν: 3 κάθετοι + 3 οριζόντιοι** → κάναβος 3×3 → `enumerateGridBays` δίνει **(3−1)×(3−1) = 4 φατνώματα**.
- **Working tree ΜΟΙΡΑΖΕΤΑΙ με άλλον agent** — git add ΜΟΝΟ δικά σου, ΠΟΤΕ `-A`/`--no-verify`. **Commit ΜΟΝΟ ο Giorgio (N.(-1)).**

## ΜΕΘΟΔΟΣ ΠΟΥ ΔΟΥΛΕΨΕ ΑΡΙΣΤΑ (χρησιμοποίησέ την)
**Firestore-first + σταδιακή δημιουργία.** Ο Giorgio δημιουργεί οντότητες «από κάναβο» σταδιακά· **ΕΣΥ διαβάζεις τα πραγματικά records** με τα Firestore MCP tools (`mcp__firestore__firestore_query` / `_count` σε `floorplan_columns`/`_beams`/`_walls`/`_slabs`). **ΜΗΝ μαντεύεις γεωμετρία** — διάβασε params (position/width/depth/startPoint/endPoint/footprint/outline/guideBindings). Αυτή η μέθοδος έλυσε σε λίγους γύρους ό,τι η στατική ανάλυση δεν κλείδωνε (ADR-449 Slice 8b/9, ADR-452 v2.17/19).
**Scope (επιβεβαίωσε από τα νέα records):** company `comp_9c7c1a50-…`, project `proj_1d45b55b-…`, floorplan `file_f6b1782f-…`, floor `flr_4e7868ba-…` (μπορεί να αλλάξει).

### Σειρά ελέγχου (όπως ζήτησε ο Giorgio)
1. **Κολόνες** «από κάναβο» (στις τομές αξόνων) → διάβασε records, επιβεβαίωσε footprint/θέση/born-bound.
2. **Δοκάρια** «από κάναβο» (στους άξονες) → επιβεβαίωσε start/end/width, trim στις κολόνες.
3. **Πλάκες** «από κάναβο» (ανά φάτνωμα) → **ΤΟ ΚΡΙΣΙΜΟ**: η πλάκα να γεμίζει το φάτνωμα ΜΕΙΟΝ τα δοκάρια (clip) ΚΑΙ ΜΕΙΟΝ τις προεξοχές κολόνων (notch). Έλεγξε ότι όπου η κολόνα (φαρδύτερη) προεξέχει μέσα στο φάτνωμα, η πλάκα ΣΠΑΕΙ σωστά γύρω της.

---

## ⚠️ ΣΗΜΑΝΤΙΚΟ ΕΥΡΗΜΑ — Η ΛΟΓΙΚΗ ΥΠΑΡΧΕΙ ΗΔΗ (verify + refine, ΟΧΙ from-scratch)

Το **`bim/slabs/slab-from-grid.ts` → `buildSlabBaysFromGuides`** ήδη υλοποιεί το notch:
- `collectSubtrahends(beams, columns)` → footprints **δοκαριών (clip) + κολωνών (notch)** ως subtrahends (οι **κανονικοί τοίχοι ΟΧΙ** — κάθονται ΠΑΝΩ στην πλάκα, Revit-grade).
- `bayOutline(bay, subs)` = bay rect **ΜΕΙΟΝ** overlapping footprints μέσω `safeDifference` (polygon-clipping) → κρατά το **μεγαλύτερο outer ring**.
- **DEFER (γραμμένο στον κώδικα):** αν το notch **διασπά** το φάτνωμα ή δημιουργεί **τρύπα** (π.χ. κολόνα στη μέση) → κρατιέται μόνο το μεγαλύτερο ring· τα υπόλοιπα/holes = μελλοντικά `slab-opening` entities (ADR-363 Phase 3.5). **Πιθανό κενό προς έλεγχο.**

**Άρα η δουλειά = VERIFY ότι το υπάρχον notch δουλεύει στα πραγματικά records + REFINE τα edge cases** (π.χ. κολόνα-γωνία που προεξέχει ασύμμετρα· κολόνα φαρδύτερη του δοκαριού που αφήνει «δόντι»· split/hole topology). **ΜΗΝ ξαναγράψεις from scratch** — επέκτεινε το SSoT.

---

## PHASE 1 RECOGNITION — διάβασε ΠΡΩΤΑ (code = source of truth)
1. `bim/slabs/slab-from-grid.ts` — `buildSlabBaysFromGuides` / `bayOutline` / `collectSubtrahends` / `buildGroundBearingSlabs` (MAT vs FLOOR/ROOF) + `slab-grid-commit.ts`.
2. `bim/columns/column-from-grid.ts` + `column-grid-commit.ts` — πώς γεννιούνται κολόνες από τομές αξόνων.
3. `bim/beams/beam-from-grid.ts` + `beam-grid-commit.ts` — δοκάρια από segments + trim στις κολόνες (`trimSegmentEndpointsToColumns`, ADR-441).
4. `bim/foundations/foundation-from-grid.ts` — `enumerateGridBays` / `gridAxesFromReader` / `GridBaySpec` / `enumerateGridStrips` (κοινό grid SSoT).
5. `bim/geometry/building-footprint.ts` — `computeBuildingFootprint` (boolean union τοίχων+κολωνών+δοκαριών).
6. `bim/geometry/shared/safe-polygon-boolean.ts` — `safeDifference`/`safeUnion` (polygon-clipping wrappers· winding-sensitive — δες ΜΑΘΗΜΑ ADR-449 Slice 7: ΠΑΝΤΑ normalize CCW πριν clipping).
7. `bim/geometry/{beam,column}-geometry.ts` — `computeBeamGeometry().outline` / `computeColumnGeometry().footprint`.
8. `bim/hosting/slab-hosting-strategy.ts` — born-bound πλάκα ακολουθεί 4 άξονες (follow-move).
9. ADRs: **ADR-441** §GEN-SLAB/§GEN-COL/§GEN-WALL (`docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md`) + **ADR-436** (foundation/slab discipline) + **ADR-363** Phase 3.5 (slab-openings).
10. Tests: `bim/slabs/__tests__/slab-from-grid.test.ts`, `slab-grid-commit.test.ts`, `beam-from-grid.test.ts`, `column-from-grid.test.ts`, `foundation-from-grid.test.ts`.

## MEMORY (recall)
- `project_adr441_foundation_strip_grid` (GRID-FIRST· GEN-COL/GEN-WALL· enumerateGridStrips· reconciler)
- `reference_grid_hosting_strategy_ssot` (associative grid hosting· HostingStrategy registry)
- `reference_2d_dxf_pipeline_bim_entity` (6 render + 3 selection σημεία ανά νέο 2Δ BIM entity)
- `project_adr436_foundation` (region-based slab reuse)

## Tests
`npx jest src/subapps/dxf-viewer/bim/slabs src/subapps/dxf-viewer/bim/beams/__tests__/beam-from-grid src/subapps/dxf-viewer/bim/columns/__tests__/column-from-grid src/subapps/dxf-viewer/bim/foundations/__tests__/foundation-from-grid`
**ΕΝΑ tsc τη φορά (N.17)** — έλεγξε running tsc ΠΡΩΤΑ.
⚠️ Γνωστά pre-existing failures (ΟΧΙ δικά σου): `BimSceneLayer-visibility-resolver-3d.test.ts` + `BimSceneLayer-vg-visibility.test.ts` (params-less stubs, ADR-448 — δες `HANDOFF_2026-06-13_ADR-448_BimSceneLayer-test-failures.md`).

## ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)
Ελληνικά πάντα. **Commit/push ΜΟΝΟ ο Giorgio** (N.(-1)) — ΠΟΤΕ εσύ. **git add ΜΟΝΟ δικά σου** αρχεία (shared tree με άλλον agent)· ΠΟΤΕ `-A`, ΠΟΤΕ `--no-verify`. ΕΝΑ tsc τη φορά (N.17). N.7.1 (40γρ/func, 500γρ/file, no `any`/`as any`/`@ts-ignore`). Αν αγγίξεις 2Δ DxfRenderer/renderer/composite → STAGE ADR-040 (CHECK 6B/6D). **Firestore-first διάγνωση.** **Ζήτα έγκριση plan ΠΡΙΝ γράψεις κώδικα** (μάθημα `feedback_confirm_repro_before_reimplementing` + `feedback_make_revit_grade_decisions_yourself`). Νέο 2Δ BIM entity → 6 render cases + 3 spatial-index hit-test σημεία (δες `reference_2d_dxf_pipeline_bim_entity`). Μετά από κάθε υλοποίηση: ADR changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY (N.15).

**Μοντέλο:** Opus (αρχιτεκτονική/γεωμετρία, multi-file, cross-cutting).
