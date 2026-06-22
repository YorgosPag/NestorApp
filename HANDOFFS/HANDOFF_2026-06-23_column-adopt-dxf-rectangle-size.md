# HANDOFF — Η κολόνα «υιοθετεί» το μέγεθος ορθογωνίου DXF (Revit-grade, opt-in)

**Ημ/νία:** 2026-06-23 · **Μοντέλο προηγ. session:** Opus 4.8 · **Commit:** ΤΟΝ ΚΑΝΕΙ Ο GIORGIO (όχι ο agent)
**⚠️ Working tree μοιράζεται με άλλον agent** — stage ΜΟΝΟ τα δικά σου αρχεία (κράτα τις δικές σου γραμμές).
**📖 ΔΙΑΒΑΣΕ ΠΡΩΤΑ:** `docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md`
(ιδίως **§8.4 «ΠΟΤΕ σιωπηλά»** — οι proactive προτάσεις απαιτούν **ρητή συγκατάθεση** = ακριβώς αυτό το feature).

---

## 🎯 ΤΟ ΖΗΤΟΥΜΕΝΟ (Giorgio)

Έχω εισάγει κάτοψη DXF. Πολλές υπάρχουσες κολόνες είναι σχεδιασμένες ως **ορθογώνια** (4 καφέ γραμμές που
κλείνουν, ή κλειστή polyline/rectangle). Όταν διαλέγω το εργαλείο **«Κολόνα»** και κάνω το **1ο κλικ ΜΕΣΑ σε
τέτοιο ορθογώνιο DXF**, θέλω η εφαρμογή να **με ρωτάει**:

> «Να δημιουργήσω κολόνα **25×60** (όσο το ορθογώνιο του σχεδίου); ή να κρατήσω την προεπιλογή **40×40**;»

- Αν **Ναι** → η κολόνα μπαίνει με width/depth ίσα με το ορθογώνιο, **κεντραρισμένη μέσα του**, και μετά
  ορίζω γωνία όπως τώρα.
- Αν **Όχι** (ή δεν υπάρχει ορθογώνιο κοντά) → default 40×40, **αμετάβλητη** σημερινή συμπεριφορά.

**ΟΧΙ σιωπηλό auto-resize** — ο χρήστης μπορεί να θέλει να κρατήσει το 40×40 (ADR-487 §8.4). Revit-grade:
«ο αρχιτέκτονας σχεδιάζει, ο στατικός (εφαρμογή) προτείνει & ο χρήστης αποδέχεται».

---

## 🚨 ΥΠΟΧΡΕΩΤΙΚΟ ΠΡΩΤΟ ΒΗΜΑ: ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (GREP) ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ

Ο Giorgio απαιτεί **πραγματικό audit**, όχι δήλωση. **Η μισή υποδομή ΥΠΑΡΧΕΙ ΗΔΗ** — επιβεβαιώθηκε σε αυτό
το session. Επαλήθευσέ τα με grep/read και **επέκτεινε**, ΜΗΝ δημιουργήσεις διπλότυπα:

### Α) Ανίχνευση «cursor ΜΕΣΑ σε ορθογώνιο» — **ΥΠΑΡΧΕΙ** (Cartesian Magnet, ADR-398 §3.15)
- `bim/columns/rect-cartesian-snap.ts` → `findRectContaining(cursor, rects)`, `resolveRectCartesianSnap(...)`.
- `bim/framing/rect-frame.ts` → **`RectFrame`** = `{ center, u, v, halfW, halfV }` → **οι διαστάσεις του
  ορθογωνίου είναι ΕΤΟΙΜΕΣ** (W = 2·halfW, H = 2·halfV). Αυτό είναι το μέγεθος που θα υιοθετήσει η κολόνα.
- `bim/framing/member-snap-targets.ts` → **`collectRectTargets(entities)`** → `RectFrame[]`.
  **⚠️ ΚΕΝΟ Α:** σήμερα διαβάζει **ΜΟΝΟ `e.type === 'rectangle'`** (μέσω `rectangleCorners` + `rectFrameFromCorners`).
  ΔΕΝ πιάνει κλειστή `polyline` 4 κορυφών ΟΥΤΕ **4 ξεχωριστές `line`** που κλείνουν ορθογώνιο.
- `bim/framing/scene-snap-targets.ts:92` → εκθέτει `rectTargets: collectRectTargets(entities)`.
- `hooks/drawing/column-preview-helpers.ts:179` (& :83) → **ΗΔΗ καλεί** `findRectContaining(effectiveCursor, targets.rectTargets)`.
  Δηλαδή το φάντασμα κολόνας **ήδη** ξέρει πότε ο cursor είναι μέσα σε ορθογώνιο → εκεί κουμπώνει στο
  καρτεσιανό πλέγμα. **Εδώ συνδέεται** η νέα λογική «πρότεινε size».

### Β) Σημείο δημιουργίας κολόνας + override μεγέθους — **ΥΠΑΡΧΕΙ injection point**
- `hooks/drawing/useColumnTool.ts:251` → `buildDefaultColumnParams(position, s.kind, overridesWithKind, sceneUnits)`.
  Το `overridesWithKind: ColumnParamOverrides = { ...s.overrides, kind, anchor, rotation }`.
  **➡️ Επαλήθευσε ότι το `ColumnParamOverrides` δέχεται `width`/`depth`** (φέρει ήδη τα size overrides του χρήστη).
  Αν ναι → η υιοθέτηση μεγέθους = **πέρασε `width`/`depth` από το `RectFrame`** (2·halfW / 2·halfV, mm) +
  θέση = `rect.center`. Μηδέν νέος builder.

### Γ) Confirm dialog (opt-in) — **ΥΠΑΡΧΕΙ pattern, ΜΗΝ φτιάξεις νέο modal από το μηδέν**
- `ui/structural-warnings/IntermediateColumnsAction.tsx` → **το ακριβές precedent**: opt-in confirm modal με
  **ρητή συγκατάθεση** (ADR-487 §8.4 «ΠΟΤΕ σιωπηλά»), `dxf-modal-*` classes (μηδέν inline style, N.3),
  **ESC bus** (`useEscapeHandler` + `ESC_PRIORITY`), **i18n** (`useTranslation`), `createPortal`.
- `ui/dialogs/ColumnPerimeterConfirmDialog.tsx` → confirm precedent (αναφέρεται στο πάνω αρχείο). **Δες το.**
- Reuse αυτό το pattern για το «25×60 ή 40×40;».

### Δ) Ανίχνευση ορθογωνίου από **4 ξεχωριστές γραμμές / κλειστή polyline** (ΚΕΝΟ Α → λύση)
- `systems/recognition/space-detection.ts` + `space-binding.ts` → **closed-loop / region detection από segments**.
- `bim/geometry/footprint-region-classifier.ts`, `bim/walls/perimeter-from-faces.ts`,
  `bim/walls/perimeter-polygon-math.ts`, `bim/geometry/shared/polygon-utils.ts` (`closedRingFromEdges` κ.ά.),
  `bim/geometry/shared/polygon-interior-point.ts`.
- Στόχος: ομαδοποίησε διαδοχικές/κάθετες `line` που κλείνουν βρόχο 4 κορυφών → πολύγωνο → `rectFrameFromCorners`
  (υπάρχον, `bim/framing/rect-frame.ts`). **Πρώτα grep αυτά — αν κάποιο ήδη επιστρέφει κλειστούς βρόχους
  γραμμών, χρησιμοποίησέ το.** ΜΗΝ γράψεις νέο loop-detection αν υπάρχει.

### Grep checklist (τρέξε ΠΡΙΝ κωδικα):
`RectFrame`, `collectRectTargets`, `findRectContaining`, `rectFrameFromCorners`, `rectangleCorners`,
`buildDefaultColumnParams`, `ColumnParamOverrides`, `ColumnPerimeterConfirmDialog`, `useEscapeHandler`,
`space-detection`, `closedRingFromEdges`, `dxf-modal-`.

---

## 🧱 ΠΡΟΤΕΙΝΟΜΕΝΗ ΥΛΟΠΟΙΗΣΗ (σε φάσεις — full SSoT, Revit-grade)

> **Επικύρωσέ την με το audit.** Αν το audit δείξει καλύτερο SSoT μονοπάτι, ακολούθησέ το.

**Φάση 1 — closed `rectangle` / κλειστή `polyline` (το εύκολο, η περισσότερη υποδομή υπάρχει):**
1. `collectRectTargets`: επέκταση να εκπέμπει `RectFrame` ΚΑΙ από κλειστή `polyline`/`lwpolyline` 4 (≈ορθο)γωνιών
   (reuse `rectFrameFromCorners`). [Pure, unit-test.]
2. Στο 1ο κλικ του column tool, αν `findRectContaining(clickPoint, rectTargets)` ≠ null **και** το μέγεθος του
   ορθογωνίου διαφέρει «αισθητά» από το default → trigger confirm (opt-in).
3. Confirm modal (reuse pattern Γ): δείξε W×H σε **μέτρα/εκ.** (reuse `formatLengthForDisplay`). Yes → πέρασε
   `width/depth` override + `position = rect.center` στο `buildDefaultColumnParams` (Β). No → default ροή.
4. i18n keys (el + en) — N.11, ΟΧΙ hardcoded.

**Φάση 2 — 4 ξεχωριστές `line` (το ζητούμενο της εικόνας):**
5. Closed-loop grouping (reuse Δ) → πολύγωνο 4 κορυφών → `rectFrameFromCorners` → ίδιο μονοπάτι με Φάση 1.
   Κράτα το pure + unit-testable (μηδέν React/store στη γεωμετρία).

**Κλειδιά Revit-grade:**
- Λοξά ορθογώνια: το `RectFrame` έχει ήδη local `u/v` → η κολόνα παίρνει και τη **γωνία** του ορθογωνίου ως
  πρόταση rotation (επιβεβαίωσε με Giorgio αν θέλει auto-rotate ή μόνο size).
- «Αισθητή διαφορά»: όρισε threshold ώστε να ΜΗΝ ενοχλεί όταν το ορθογώνιο ≈ 40×40 (μικρό tolerance).
- Το confirm εμφανίζεται **μόνο** στο column tool, **μόνο** όταν ο cursor/κλικ είναι μέσα σε εντοπισμένο
  ορθογώνιο. Καμία άλλη ροή δεν αλλάζει.

---

## ⚠️ ΠΕΡΙΟΡΙΣΜΟΙ / ΚΑΝΟΝΕΣ

- **ΟΧΙ commit/push** — ο Giorgio κάνει commit (N.(-1)). Εσύ: audit + υλοποίηση + tests + tsc + ενημέρωση
  ADR + ΕΚΚΡΕΜΟΤΗΤΕΣ + adr-index.
- **Shared tree** — άγγιξε ΜΟΝΟ δικά σου αρχεία· stage ΜΟΝΟ δικές σου γραμμές. ⚠️ HOT (άλλοι agents):
  `useColumnTool.ts`, `column-preview-helpers.ts`, `member-snap-targets.ts`, `scene-snap-targets.ts`,
  `linear-member-face-snap.ts` → συντονισμός/προσοχή.
- **N.2** μηδέν `any`/`as any`. **N.7.1** αρχεία ≤500 γρ, συναρτήσεις ≤40. **N.3** μηδέν inline style.
- **N.11** i18n: keys σε `src/i18n/locales/el/*.json` + `en/*.json` ΠΡΙΝ τη χρήση (ΟΧΙ hardcoded ελληνικά).
- **N.8** αξιολόγησε αν είναι 5+ αρχεία/2+ domains → πρότεινε execution mode στον Giorgio πριν ξεκινήσεις.
- **N.14** δήλωσε μοντέλο πριν την υλοποίηση και περίμενε «ok».
- **ADR-040**: αν αγγίξεις canvas-drawing / preview αρχεία (CHECK 6B/6D) → stage το σχετικό ADR.
- **Νέο ADR** ή επέκταση ADR-398 §3.15 (Cartesian Magnet) — πιθανότατα **επέκταση ADR-398** (ίδιο feature
  family: κολόνα ↔ ορθογώνιο). Επιβεβαίωσε numbering (επόμενο ελεύθερο ADR αν νέο).

---

## ✅ VERIFICATION
1. **jest:** νέα pure tests — (α) `collectRectTargets` πιάνει κλειστή polyline/4-lines, (β) σωστό W×H/center/
   rotation από `RectFrame`, (γ) threshold «αισθητής διαφοράς», (δ) confirm logic. + regression στα υπάρχοντα
   `rect-cartesian-snap` / `column-preview-helpers` / `member-snap-targets` tests.
2. **tsc** clean (N.17 — έλεγξε ότι δεν τρέχει άλλος tsc πριν ξεκινήσεις· ΕΝΑ tsc τη φορά).
3. **Browser (Giorgio, μετά commit ΤΟΥ):** εργαλείο Κολόνα → 1ο κλικ μέσα σε ορθογώνιο DXF (rectangle, polyline,
   ΚΑΙ 4 γραμμές) → ρωτάει «W×H ή default;» → Yes = κολόνα στο μέγεθος+κέντρο του ορθογωνίου → μετά γωνία· No =
   40×40· καμία αλλαγή όταν δεν υπάρχει ορθογώνιο. Λοξό ορθογώνιο → σωστό size (+rotation αν αποφασιστεί).

## 📌 ΠΟΥ ΕΙΝΑΙ ΤΑ ΠΡΑΓΜΑΤΑ (verified σε αυτό το session)
- Cursor-σε-ορθογώνιο: `bim/columns/rect-cartesian-snap.ts` · RectFrame: `bim/framing/rect-frame.ts`
- Συλλογή ορθογωνίων: `bim/framing/member-snap-targets.ts` (`collectRectTargets`) → `scene-snap-targets.ts:92`
- Column ghost ήδη το χρησιμοποιεί: `hooks/drawing/column-preview-helpers.ts:179`
- Δημιουργία κολόνας + overrides: `hooks/drawing/useColumnTool.ts:251` (`buildDefaultColumnParams`)
- Confirm pattern: `ui/structural-warnings/IntermediateColumnsAction.tsx` + `ui/dialogs/ColumnPerimeterConfirmDialog.tsx`
- Loop-from-lines: `systems/recognition/space-detection.ts`, `bim/geometry/footprint-region-classifier.ts`,
  `bim/geometry/shared/polygon-utils.ts`
