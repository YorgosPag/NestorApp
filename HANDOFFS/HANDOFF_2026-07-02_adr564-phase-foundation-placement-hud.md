# HANDOFF — ADR-564 Φ-foundation (Placement HUD + Τόξο Φοράς στο πέδιλο)

**Ημερομηνία:** 2026-07-02
**ADR:** `docs/centralized-systems/reference/adrs/ADR-564-unified-bim-placement-hud-overlay.md`
**Status ADR:** 🟢 Φ-beam + Φ-column IMPLEMENTED (UNCOMMITTED) · **Φ-foundation = ΤΟ ΕΠΟΜΕΝΟ**
**⚠️ Working tree:** ΜΟΙΡΑΖΕΤΑΙ με άλλον agent. Άγγιξε ΜΟΝΟ τα foundation-σχετικά αρχεία· μην κάνεις `git add -A`.
**⚠️ COMMIT:** τον κάνει **ο Giorgio**, ΟΧΙ ο agent (N.(-1)). Εσύ ετοιμάζεις + σταματάς.
**⚠️ tsc:** ΑΠΑΓΟΡΕΥΕΤΑΙ (N.17). Μόνο jest (targeted) όπου έχει νόημα.

---

## 0. ΤΙ ΘΕΛΕΙ Ο GIORGIO (μία πρόταση)

Το φάντασμα του **τοίχου** μετά το 1ο κλικ δείχνει λευκές ενδείξεις (μήκος/γωνία/διατομή) + έγχρωμο
τόξο φοράς 🟢/🔴. Αυτό εφαρμόστηκε ήδη σε **δοκάρι** (Φ-beam) και **κολόνα** (Φ-column). **Μένει το
πέδιλο (foundation)** — ΙΔΙΑ εμφάνιση, ΜΙΑ πηγή αλήθειας, **reuse** των υπαρχόντων painters, **μηδέν
διπλότυπο**. Big-player alignment: Revit / Maxon C4D / Figma-grade dynamic feedback κατά τη σχεδίαση.

---

## 1. ΤΙ ΕΙΝΑΙ ΗΔΗ ΚΑΝΩΜΕΝΟ (μη το ξαναφτιάξεις — reuse)

### Canonical SSoT painters (ΜΗΝ δημιουργήσεις νέους)
- **Γραμμικά μέλη** → `canvas-v2/preview-canvas/wall-hud-paint.ts`
  - `buildSegmentHudMeta(start, end, sceneUnits, thicknessMm, heightMm) → WallHudMeta`
  - `paintWallHud(...)` (μήκος aligned dim + `∠θ` + spec label)
- **Footprint μέλη** → `canvas-v2/preview-canvas/column-hud-paint.ts`
  - `paintColumnHud(ctx, footprint, params: ColumnParams, heightSpecLabel, sceneUnits, transform, viewport)`
  - καλύπτει rect (πλάτος+βάθος ανά παρειά) / κυκλική (Ø) / πολύγωνο (Ø+N) / σύνθετο (κάθε ακμή) + `∠` + ύψος
- **Έγχρωμο τόξο** → `canvas-v2/preview-canvas/direction-arc-paint.ts`
  - `paintDirectionArc(ctx, pivotW, anchorW, cursorW, sweepDeg, transform, viewport)` (🟢 sweep≥0 / 🔴 <0)
- **Παλέτα 🟢/🔴** → `bim/ghosts/ghost-status-color.ts` (`resolveGhostStatusColor`)

### PreviewRenderer/PreviewCanvas methods (ΥΠΑΡΧΟΥΝ ΗΔΗ, χρησιμοποίησέ τα)
- `drawWallHud(meta, specLabel)` — γραμμικό HUD
- `drawColumnHud(footprint, params, heightSpecLabel)` — **ΝΕΟ (Φ-column)**, footprint HUD
- `drawDirectionArc(pivotW, anchorW, cursorW, sweepDeg)` — τόξο
- (το PreviewCanvas ενίει μόνο του transform/viewport· ο renderer κρατά `this.sceneUnits`)

### Wiring pattern στον `hooks/drawing/drawing-hover-handler.ts` (μετά το `drawPreview`)
- **Γραμμικό HUD (γενικό, ΧΩΡΙΣ gate):** διαβάζει `previewEntity.wallHud` → `drawWallHud(wallHud,
  previewEntity.hudSpecLabel ?? buildWallHudSpecLabel(wallHud))`. Άρα κάθε ghost που φέρει `wallHud`
  δείχνει αυτόματα τις λευκές ενδείξεις. `hudSpecLabel` = προ-μεταφρασμένη ετικέτα ανά μέλος.
- **Footprint HUD:** διαβάζει `previewEntity.columnHud = {footprint, params}` → `drawColumnHud(...)`.
- **Τόξο φοράς (γραμμικά):** gate `activeTool === 'wall' || activeTool === 'beam'`, pivot=`lastRefPt`,
  ref=world-X, sweep=bearing.
- **Τόξο στρέψης (footprint, awaitingRotation):** στο `getColumnRotationLock()` block → πορτοκαλί ευθεία
  (`drawPolarTrackingLine`) **+** `drawDirectionArc` (Giorgio «και τα δύο»).

### Πρότυπα-αναφορά (αντέγραψε τη λογική τους)
- **Δοκάρι (γραμμικό):** `hooks/drawing/beam-preview-helpers.ts` + `hooks/drawing/beam-hud-spec-label.ts`
  (`buildBeamHudSpecLabel`) + i18n `tools.beam.hudSpec = "b={width} · h={depth}"` (el+en).
- **Κολόνα (footprint):** `hooks/drawing/column-preview-helpers.ts` (`attachColumnHud` helper) + i18n
  `tools.column.hudSpec` (υπάρχον) + `column-hud-spec-label.ts`.
- **Κοινός wrapper:** `hooks/drawing/wysiwyg-preview-shared.ts` → `toWysiwygPreviewEntity(...)` δέχεται
  προαιρετικά `wallHud` + `hudSpecLabel` (τα προσθέτω στο ghost).

---

## 2. ΤΙ ΠΡΕΠΕΙ ΝΑ ΚΑΝΕΙ Η Φ-foundation

Το πέδιλο έχει **δύο αρχέτυπα** (Revit-style ξεχωριστά εργαλεία):

### 2A. `foundation-strip` / `foundation-tie-beam` = ΓΡΑΜΜΙΚΟ (καθρέφτης δοκαριού)
- Preview: `hooks/drawing/foundation-preview-helpers.ts` → `generateFoundationPreview(...)` (line ~47).
- Προσάρτησε `wallHud` (`buildSegmentHudMeta(startPt, endPt, sceneUnits, widthMm, heightMm/depthMm)`)
  + `hudSpecLabel` (ΝΕΟ `foundation-hud-spec-label.ts` → `buildFoundationHudSpecLabel`, i18n
  `tools.foundation.hudSpec` = `b={width} · h={height}` στυλ Giorgio, **keys ΠΡΩΤΑ σε el+en**, N.11).
- Χαλάρωσε το gate τόξου: `... || activeTool === 'foundation-strip' || activeTool === 'foundation-tie-beam'`.
- **⚠️ ΠΡΟΣΟΧΗ (bug που πρέπει να φτιάξεις):** `hooks/drawing/bim-ortho-reference.ts` →
  `getBimOrthoReference(tool)` **ΔΕΝ έχει case για foundation** → `lastRefPt` = null → **το τόξο δεν θα
  εμφανιστεί**. Πρόσθεσε case που διαβάζει την αρχή από το `foundationPreviewStore` (mirror του `beam`/
  `wall` case). Επιβεβαίωσε τα ακριβή tool strings + το πεδίο startPoint με grep.

### 2B. `foundation-pad` = FOOTPRINT (καθρέφτης κολόνας) + ROTATION-LOCK SSoT UNIFICATION
- Preview: `foundation-preview-helpers.ts` → `generateFoundationPadPreview(...)` (line ~85), χτίζει
  `FoundationEntity` μέσω κοινού `placement-ghost-assembly` (ίδιο με κολόνα).
- **ΚΡΙΣΙΜΟ SSoT audit — reuse `paintColumnHud`;** Ο painter δέχεται `ColumnParams`, όχι
  `FoundationParams`. Για ΟΡΘΟΓΩΝΙΟ pad, το `paintColumnHud` rect-branch χρειάζεται μόνο
  `footprint` + `params.rotation` (ΟΧΙ width/kind). **Δύο επιλογές — ΑΠΟΦΑΣΙΣΕ ΜΕΤΑ ΑΠΟ GREP:**
  1. **Extract generic** `paintFootprintHud(footprint, rotationDeg, heightSpecLabel, …)` από το
     `column-hud-paint.ts` (το rect/profile branch δεν εξαρτάται από ColumnParams) → το καλούν ΚΑΙ
     κολόνα ΚΑΙ pad (καθαρό SSoT, big-player pattern). ← **προτεινόμενο αν το grep δείξει ότι το
     rect/profile branch είναι ColumnParams-agnostic.**
  2. Αν το pad είναι πάντα ορθογώνιο και δεν αξίζει extraction: φτίαξε ελάχιστο adapter
     `{ rotation, kind:'rectangular', width, depth } ` από `FoundationParams` για να καλέσεις
     `paintColumnHud`. (Λιγότερο καθαρό — μόνο αν οι μεγάλοι δεν θα έκαναν extraction.)
- Πρόσθεσε `attachColumnHud`-style προσάρτηση (ή `attachFootprintHud`) στο pad ghost.
- **ROTATION-LOCK UNIFICATION (Giorgio):** το pad χρησιμοποιεί `getPlacementRotationLock()`
  (`systems/cursor/PlacementRotationStore.ts`), ΑΛΛΑ ο `drawing-hover-handler.ts` διαβάζει
  `getColumnRotationLock()` (`systems/cursor/ColumnRotationStore.ts`) — **δύο διαφορετικά stores** →
  σήμερα το pad πιθανότατα **ΔΕΝ δείχνει** ούτε την πορτοκαλί ευθεία ούτε (το νέο) τόξο στρέψης.
  **Task:** ΜΙΑ πηγή ανάγνωσης. Grep ΠΡΩΤΑ ποιος γράφει σε ποιο store (κολόνα vs pad) και ενοποίησε:
  είτε ο handler διαβάζει και τα δύο, είτε (καθαρότερο) ένα canonical rotation-lock SSoT. Επιβεβαίωσε
  ότι δεν σπας την κολόνα.

---

## 3. ΥΠΟΧΡΕΩΤΙΚΟ SSoT AUDIT ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ (grep, ΟΧΙ υποθέσεις)

1. `FoundationParams` πεδία (width/length/depth/thickness/height/rotation) → `bim/types/foundation-types.ts`
   + `buildDefaultFoundationParams` σε `foundation-completion.ts`. Ποιο είναι το «ύψος/βάθος» για το spec;
2. Ακριβή **tool strings** foundation (`foundation-pad` / `-strip` / `-tie-beam`) — grep
   `systems/tools/tool-definitions.ts` + `ui/toolbar/types.ts` + `useSpecialTools.ts`.
3. `foundationPreviewStore` — πεδίο αρχής (startPoint/start) για το `getBimOrthoReference` case.
4. `column-hud-paint.ts` — είναι το rect/profile branch **ColumnParams-agnostic**; (καθορίζει επιλογή 2A.1 vs 2A.2)
5. Ποιος **γράφει** στο `PlacementRotationStore` vs `ColumnRotationStore` (κολόνα, pad, tekton;) — για ασφαλή unification.
6. Υπάρχον test: `hooks/drawing/__tests__/foundation-preview-helpers.test.ts` — επέκτεινέ το.
7. Grep για τυχόν **ήδη υπάρχον** `foundation-hud`/`buildFoundationHudSpecLabel`/`paintFoundationHud`
   πριν δημιουργήσεις νέο (μην κάνεις διπλότυπο).

---

## 4. ΚΑΝΟΝΕΣ COMMIT / STAGING (ο Giorgio κάνει commit)

- Άγγιξε ΜΟΝΟ foundation-σχετικά αρχεία (+ `bim-ortho-reference.ts`, rotation store, ADR-564).
- Canvas drawing files (drawing-hover-handler, PreviewRenderer/Canvas, foundation-preview-helpers) →
  **co-stage ADR** στο commit (ADR-040 CHECK 6B/6D). Stage: κώδικας + ADR-564 (+ ADR-040/397/508).
- N.11: i18n keys ΠΡΩΤΑ σε el+en (single-brace `{var}`, CHECK 3.9).
- Στο τέλος: ενημέρωσε ADR-564 (φάση + changelog) + `adr-index.md` status.
- 🔴 browser-verify (strip/tie 1ο→2ο κλικ· pad τοποθέτηση+περιστροφή) ΠΡΙΝ ζητήσεις commit από Giorgio.

---

## 5. Ανοιχτό σχεδιαστικό ερώτημα (ρώτησε Giorgio όταν φτάσεις στο pad label)

Το `paintColumnHud`/footprint HUD δείχνει πλάτος/βάθος ως δ. **παρειών** + label μόνο «ύψος/βάθος».
Θέλει ο Giorgio ΕΠΙΠΛΕΟΝ σύνθετο label `b=..·h=..·βάθ=..` (διπλοεμφάνιση με τις δ. παρειών) ή μένει έτσι;
(Ίδιο εκκρεμές υπάρχει και για την κολόνα — §8 ADR-564.)
