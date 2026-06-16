# HANDOFF — ADR-463 Slice 6: PDF Detail-Sheet Οπλισμού Θεμελίωσης

**Ημερομηνία:** 2026-06-16 · **Συντάκτης:** Opus 4.8 (συνεδρία ADR-463 Slices 0-5+7)
**Στόχος:** Ολοκλήρωσε το **τελευταίο slice** του ADR-463 — το PDF detail-sheet οπλισμού πεδίλου/πεδιλοδοκού (mirror του column detail-sheet ADR-457). Όλα τα υπόλοιπα (ribbon → Ιδιότητες → 2Δ/3Δ render → auto-reinforce → BOQ) ΕΓΙΝΑΝ ήδη.

---

## ✅ ΤΙ ΕΧΕΙ ΓΙΝΕΙ (Slices 0-5+7, UNCOMMITTED)
- ADR-463 + adr-index + tracker. **Compute/model/providers/auto-reinforce ΥΠΗΡΧΑΝ ΗΔΗ** (ADR-459 Φ4b).
- Properties panel (`ui/foundation-advanced-panel/`), structural bridge (`foundation-structural-*`), 2Δ (`footing-rebar-2d` + DxfRenderer pass), 3Δ (`footing-rebar-3d` + `rebar-3d-shared` + `foundation-to-three.attachFoundationRebar`), BOQ steel weight.
- **i18n keys για το PDF button ΗΔΗ ΜΠΗΚΑΝ:** `ribbon.commands.foundationStructural.reinforcementDetail` + `reinforcementDetailTooltip` (el+en).

## ⚠️ ΚΑΝΟΝΕΣ
- Ελληνικά. COMMIT/PUSH ο Giorgio. ΠΟΤΕ `git add -A`. Shared tree (ADR-459/460/461) → git add ΜΟΝΟ δικά σου. ΕΝΑ tsc τη φορά (N.17). Opus.

---

## 🎯 SLICE 6 — ΤΙ ΝΑ ΦΤΙΑΞΕΙΣ (mirror ADR-457 column detail-sheet)

### Reference αρχεία (διάβασέ τα ΠΡΩΤΑ — `src/subapps/dxf-viewer/bim/structural/detail-sheet/`)
- **100% GENERIC — REUSE ΑΤΟΦΙΑ (μην ξαναγράψεις):** `detail-sheet-types.ts` (`DetailSheetModel`, `SheetRegion`, primitives Line/Polyline/Circle/Text/Dim/Raster), `detail-sheet-layout.ts` (`computeDetailSheetLayout` → 5 regions A3), `detail-sheet-dim.ts` (`resolveDimGeometry`), `detail-sheet-fit.ts` (`pickScaleDenominator`), `render/detail-canvas-renderer.ts` (`renderDetailSheet` — preview), `render/detail-pdf-renderer.ts` (`buildColumnDetailPdf(model)` — παίρνει generic model, μόνο το όνομα είναι column· **κάλεσέ το ως έχει ή κάνε rename→`buildDetailSheetPdf`**), `render/detail-raster-fit.ts`, `render/detail-raster-decode.ts`.
- **COLUMN-SPECIFIC — γράψε footing variant:** `column-detail-sheet.ts` (orchestrator `buildColumnDetailSheet`), `column-detail-plan.ts`/`-elevation.ts`/`-schedule.ts`/`-titleblock.ts`/`-perspective.ts`, `column-rebar-bar-marks.ts`, `render/column-detail-3d-capture.ts`.
- **UI trigger chain:** `ColumnDetailHost.tsx` (listen `bim:column-detail-requested`), `ColumnDetailDialog.tsx` (**ήδη generic — παίρνει `DetailSheetModel`· reuse/rename→`DetailSheetDialog`**). Ribbon button → `useRibbonColumnBridge.onAction` emit `bim:column-detail-requested`.

### NEW αρχεία (footing)
1. `bim/structural/detail-sheet/footing-detail-sheet.ts` — `buildFootingDetailSheet(input)` → `DetailSheetModel` (kind-aware). REUSE `computeDetailSheetLayout`/fit/dim.
2. `footing-detail-plan.ts` — κάτοψη σχάρας/ράβδων ως primitives. **REUSE τη geometry λογική του `footing-rebar-2d.ts`** (frame από footprint corners· εδώ σε Line primitives αντί ctx).
3. `footing-detail-elevation.ts` — τομή: pad→κάτω/άνω σχάρα· strip/tie-beam→διαμήκεις + συνδετήρες.
4. `footing-detail-schedule.ts` — πίνακας ποσοτήτων· κάλεσε **`computeFootingReinforcementQuantities(buildFootingSectionContext(...), r)`** (ήδη υπάρχει). REUSE table layout pattern του `column-detail-schedule`.
5. `footing-detail-titleblock.ts` — πεδία (kind/διαστάσεις/cover/κύριος οπλισμός `formatFootingMainLabel`).
6. `render/footing-detail-3d-capture.ts` — offscreen WebGL (mirror `column-detail-3d-capture`). **🚨 dispose gotcha (ADR-457): dispose ΜΟΝΟ geometry του cage (το `REBAR_MATERIAL` είναι shared singleton — βλ. `rebar-3d-shared.ts`)· dispose prism πλήρως· `renderer.dispose()` στο finally.** REUSE `buildFootingRebarCage` + `foundationToMesh`.
7. `FoundationDetailHost.tsx` — listen `bim:foundation-detail-requested` → build + capture + dialog. Reuse `DetailSheetDialog`.

### Wiring
- `contextual-foundation-tab.ts` → πρόσθεσε button «Λεπτομέρεια Οπλισμού» στο `foundation-structural` panel (commandKey/action = π.χ. `FOUNDATION_RIBBON_KEYS_ACTIONS.reinforcementDetail` — πρόσθεσέ το στο `foundation-command-keys.ts`· labelKey ήδη: `ribbon.commands.foundationStructural.reinforcementDetail`).
- `useRibbonFoundationBridge.onAction` → στο νέο action: `EventBus.emit('bim:foundation-detail-requested', { foundationId, levelId })`. (Πρόσθεσε το event type στο EventBus types.)
- Mount το `FoundationDetailHost` εκεί που mount-άρεται το `ColumnDetailHost` (grep `ColumnDetailHost`).

### Coordinate notes (από τη δουλειά μου)
- footing footprint = **canvas units** (`computeFoundationGeometry(p).footprint.vertices`)· σε mm με `mmToSceneUnits(sceneUnits)`· σε meters (3Δ) με `sceneUnitsToMeters` + `scalePoints`.
- 3Δ AXIS_FLIP: plan (x,y) → three (x, yLevel, −y) via `toThree` (export από `rebar-3d-shared.ts`). bottomY = `(topElevationMm − thicknessMm)·0.001 + buildingBaseElevationM`.

### Verify
- jest: footing-detail builders (schedule numbers, model regions non-empty). tsc (ένα τη φορά). Browser: επίλεξε πέδιλο → ribbon «Λεπτομέρεια Οπλισμού» → preview===PDF (plan/elevation/schedule/titleblock/3D). Σύγκρινε με κολώνα.
- ΕΝΗΜΕΡΩΣΕ ADR-463 changelog (Slice 6 DONE) + tracker (αφαίρεσε το DEFER PDF) + memory.
