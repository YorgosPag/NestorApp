# HANDOFF — Γενίκευση 3-mode justification «Εσχάρα από κάναβο» (center/inner/outer) σε ΚΟΛΟΝΕΣ + ΔΟΚΑΡΙΑ + ΤΟΙΧΟΥΣ (mirror πεδιλοδοκών, FULL SSoT)

**Ημερομηνία:** 2026-06-14
**ADR:** ADR-441 (foundation-strip-grid-auto-design) — νέο slice
**Quality bar:** FULL ENTERPRISE + FULL SSOT, Revit-grade. Plan Mode ΠΡΩΤΑ (εντολή Giorgio), έγκριση plan ΠΡΙΝ γραφτεί κώδικας.
**Μοντέλο:** Opus (αρχιτεκτονική/γεωμετρία, cross-cutting 14-20 αρχεία).

---

## 0. ΤΙ ΖΗΤΗΣΕ Ο GIORGIO (ακριβώς)

Οι **πεδιλοδοκοί** έχουν ήδη 3 modes στη «Εσχάρα από κάναβο»: **εσωτερικές παρειές / κεντρικά / εξωτερικές παρειές**. Θέλει **ΤΟ ΙΔΙΟ** για **κολόνες, δοκάρια ΚΑΙ τοίχους** — με τον **ίδιο ακριβώς κώδικα, ΜΙΑ πηγή αλήθειας** (όχι duplication). Επιβεβαιωμένο feasibility = **ΝΑΙ**.

### Αποφάσεις που έχουν ΗΔΗ παρθεί (μην τις ξανα-ρωτήσεις):
1. **Perimeter-only semantics** (όπως οι πεδιλοδοκοί): inner/outer επηρεάζει ΜΟΝΟ τις περιμετρικές· εσωτερικές πάντα `center`. Δομικά σωστό + μηδέν regression + true SSoT.
2. **Κολόνες = `gridStripJustification` ×2** (μία ανά διεύθυνση X/Y) → σύνθεση σε anchor. ΟΧΙ νέα justification λογική.
3. **Relocate** του justification SSoT από `foundations/` σε neutral module (`bim/grid/`) ώστε col/beam/wall να μην εξαρτώνται από foundations.

---

## 1. Η ΑΡΧΙΤΕΚΤΟΝΙΚΗ ΠΟΥ ΥΠΑΡΧΕΙ (verified αυτό το session)

### Ο πυρήνας SSoT (πεδιλοδοκοί — reference):
- **`bim/foundations/foundation-grid-justification.ts`**:
  - `type GridPerimeterMode = 'center' | 'inner' | 'outer'` ← τα 3 modes
  - `DEFAULT_GRID_PERIMETER_MODE = 'inner'`
  - `gridStripJustification(orientation: 'V'|'H', parallelIndex, parallelCount, mode) → StripJustification` ← **Η ΜΙΑ pure function**. Επιστρέφει 'left'|'right'|'center' (= ποια παρειά κάθεται στον άξονα). Perimeter-only ήδη ενσωματωμένο (εσωτερικές → center).
- **`bim/types/foundation-types.ts`**: `StripJustification` ('left'|'center'|'right'), `JUSTIFICATION_NORMAL_SIGN`, `DEFAULT_STRIP_JUSTIFICATION`.
- **`bim/geometry/foundation-geometry.ts` → `buildBandFootprint`**: εφαρμόζει το justification ως perpendicular offset (CCW normal × sign × width/2). **Εδώ είναι η offset-math που πρέπει να γίνει shared για beams/walls.**

### ΚΡΙΣΙΜΟ ΕΥΡΗΜΑ — ο enumerator ΗΔΗ παράγει justification:
`bim/foundations/foundation-from-grid.ts → enumerateGridStrips(axes, cb, mode)`:
- Είναι **ΗΔΗ ΚΟΙΝΟΣ** σε foundations + beams + walls.
- Καλεί internally `gridStripJustification` και εκπέμπει `GridStripSpec { start, end, bindings, justification }`.
- **ΤΑ beams & walls ΗΔΗ ΛΑΜΒΑΝΟΥΝ το `justification` στο callback — απλώς το ΑΓΝΟΟΥΝ** (destructure μόνο start/end/bindings). Δέχεται ήδη `mode` param (default inner).
  → **Άρα beams/walls = ελάχιστη αλλαγή**: πέρνα `mode`, destructure `justification`, εφάρμοσε offset.

### Τρέχουσα κατάσταση ανά οντότητα:
| Αρχείο | Τώρα | Τι λείπει |
|---|---|---|
| `bim/beams/beam-from-grid.ts` | center-only (αγνοεί justification) | thread `mode` + apply offset |
| `bim/walls/wall-from-grid.ts` | center-only (αγνοεί justification) | thread `mode` + apply offset |
| `bim/columns/column-from-grid.ts` | `anchor:'center'` στην τομή | 2D justification → anchor |
| `bim/foundations/*` | ✅ πλήρες 3-mode | (reference, μην το χαλάσεις) |

### Κολόνες — γιατί 2D & πώς (anchor system):
- `bim/geometry/column-geometry.ts`: η κολόνα έχει `params.anchor` + `ANCHOR_OFFSETS` (9 σημεία: center + 4 ακμές + 4 γωνίες) στο `bim/types/column-types.ts`. Το `transformFootprint` ήδη μετατοπίζει το footprint ώστε το anchor να κάθεται στο `position`.
- Μια κολόνα πατά σε **2 άξονες**. Λύση SSoT: κάλεσε `gridStripJustification('V', xIndex, xCount, mode)` → X-face· `gridStripJustification('H', yIndex, yCount, mode)` → Y-face· χαρτογράφησε (xFace,yFace) → ένα από τα 9 anchors. Π.χ. γωνιακή κολόνα σε `inner` → εξωτερική γωνία πάνω στην τομή, σώμα προς τα μέσα (Revit «column flush to corner»). Εσωτερική → center.

### UI που υπάρχει (mirror it):
- **`ui/ribbon/hooks/bridge/foundation-grid-settings-store.ts`**: module-level store (single writer ribbon variant → multi reader: handleFromGrid + settle listener + live ghost). `set/get/use(useSyncExternalStore)`. **Γενίκευσέ το** σε factory `createGridPerimeterModeStore()` → 4 instances (foundation/beam/wall/column).
- **`ui/ribbon/hooks/useRibbonFoundationBridge.ts`**: η ribbon σύνδεση (split-button 3 variants). Βρες πώς τα 3 variants καλούν `foundationGridSettingsStore.set('inner'|'center'|'outer')` + handleFromGrid, και αντίγραψέ το για beam/wall/column.

---

## 2. PLAN SKELETON (slices — επιβεβαίωσε/ραφινάρισε σε Plan Mode)

> **PHASE 1 RECOGNITION πρώτα:** διάβασε `buildBandFootprint` (foundation-geometry.ts) για την ακριβή offset-math + `enumerateGridStrips`/`emitVerticalStrips`/`emitHorizontalStrips` + `ANCHOR_OFFSETS` + `useRibbonFoundationBridge.ts`. Επιβεβαίωσε CODE = SoT.

- **Slice 0 — Relocate SSoT (Boy Scout, zero behavior change):** `GridPerimeterMode`/`gridStripJustification`/`DEFAULT_GRID_PERIMETER_MODE`/`GridStripOrientation` → νέο `bim/grid/grid-justification.ts`. `StripJustification`/`JUSTIFICATION_NORMAL_SIGN` → κράτα τιμές ('left'/'center'/'right' — **Firestore-persisted στις foundations, ΜΗΝ αλλάξεις strings**), re-export από foundations για back-compat. Ενημέρωσε imports + test.
- **Slice 1 — Shared linear offset helper:** νέο `bim/grid/grid-segment-justification.ts → applyJustificationToSegment(start, end, widthMm, justification, sceneUnits) → {start,end}` (perpendicular offset ±width/2, ΙΔΙΑ math με `buildBandFootprint`: CCW normal × `JUSTIFICATION_NORMAL_SIGN`). + unit tests.
- **Slice 2 — Beams:** `buildBeamGridFromGuides(+mode)` → πέρνα `mode` στο `enumerateGridStrips`, destructure `justification`, `applyJustificationToSegment` ΠΡΙΝ το `trimSegmentEndpointsToColumns` (offset=perpendicular, trim=longitudinal → ανεξάρτητα). + test.
- **Slice 3 — Walls:** mirror Slice 2 στο `wall-from-grid.ts` (Revit «Wall Location Line»: center/finish-interior/finish-exterior = center/inner/outer). + test.
- **Slice 4 — Columns (2D):** νέο `bim/grid/grid-column-justification.ts → gridColumnJustification(xIndex,xCount,yIndex,yCount,mode) → ColumnAnchor` (καλεί `gridStripJustification` ×2 + mapping (xFace,yFace)→anchor). `column-from-grid.ts`: `enumerateGridIntersections` να εκθέτει xIndex/yIndex/counts· set `overrides.anchor`. + test (mapping table 9 περιπτώσεων).
- **Slice 5 — UI:** γενίκευση settings-store σε factory (`bim/grid/` ή `ui/ribbon/.../bridge/`)· ribbon 3-εντολές ×3 οντότητες (mirror foundation split-button)· i18n keys el+en (ΟΧΙ hardcoded — N.11).
- **Slice 6 — ⚠️ FOLLOW-MOVE (η πιο λεπτή):** Επιβεβαίωσε ότι το lateral offset (justification) **επιβιώνει** όταν κουνηθεί άξονας. Foundations: justification = persisted param, **εκτός** `gridStripSignature`, re-applied από reconciler. Beams/walls: αν το offset μπει baked στα start/end, ο hosting reconciler (`beamHostingStrategy`/`wall`) μπορεί να το χάσει στο follow-move (recompute «centerline on axis»). **ΔΙΕΡΕΥΝΗΣΕ** το hosting-strategy follow-move πριν κλειδώσεις το offset model. Ίσως χρειαστεί persisted `gridJustification` param ανά entity (όπως foundations) αντί baked coords.
- **Slice 7 — ADR-441 changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + adr-index + MEMORY (N.15).**

---

## 3. ΚΑΤΑΣΤΑΣΗ ΣΚΗΝΗΣ (verify session που μόλις έκλεισε)

**Η αλυσίδα «από κάναβο» (κολόνες→δοκάρια→πλάκες) + notch κολόνων = VERIFIED ΤΕΛΕΙΑ στα πραγματικά Firestore records, ΜΗΔΕΝ code change.** Σκηνή που υπάρχει τώρα στη βάση:
- company `comp_9c7c1a50-…`, project `proj_1d45b55b-…`, floorplan `file_f6b1782f-…`, floor `flr_4e7868ba-…`
- 9 κολόνες (3×3, 400×400, sceneUnits 'm') + 12 δοκάρια (250×500, trimmed ±200mm στις παρειές κολόνων) + 4 πλάκες (kind 'roof', 12-κορυφο κλιμακωτό notch).
- **Όλα born-bound, validation clean.** Το notch (`slab-from-grid.ts → collectSubtrahends + bayOutline + safeDifference`) δουλεύει· DEFER hole/split ΔΕΝ ενεργοποιήθηκε (κολόνες στις γωνίες). Μπορείς να χρησιμοποιήσεις αυτή τη σκηνή για να δοκιμάσεις τα 3 modes live (Firestore-first verify).

---

## 4. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)
Ελληνικά πάντα. **Commit/push ΜΟΝΟ ο Giorgio** (N.(-1)) — ΠΟΤΕ εσύ. **git add ΜΟΝΟ δικά σου** (shared tree με άλλον agent)· ΠΟΤΕ `-A`/`--no-verify`. ΕΝΑ tsc τη φορά (N.17 — check running tsc πρώτα). N.7.1 (40γρ/func, 500γρ/file, no `any`/`as any`/`@ts-ignore`). N.11 (μηδέν hardcoded strings — i18n keys el+en ΠΡΙΝ τη χρήση). **Plan Mode → έγκριση ΠΡΙΝ κώδικα.** Firestore-first verify με τα MCP tools. Μετά υλοποίηση: ADR-441 changelog + ΕΚΚΡΕΜΟΤΗΤΕΣ + MEMORY (N.15).

## 5. Tests
`npx jest src/subapps/dxf-viewer/bim/foundations/__tests__/foundation-grid-justification src/subapps/dxf-viewer/bim/beams/__tests__/beam-from-grid src/subapps/dxf-viewer/bim/columns/__tests__/column-from-grid src/subapps/dxf-viewer/bim/walls`
⚠️ Γνωστά pre-existing failures (ΟΧΙ δικά σου): `BimSceneLayer-visibility-resolver-3d.test.ts` + `BimSceneLayer-vg-visibility.test.ts`.
