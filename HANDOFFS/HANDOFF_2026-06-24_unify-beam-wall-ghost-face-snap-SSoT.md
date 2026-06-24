# HANDOFF — Ενοποίηση φαντάσματος δοκαριού ↔ τοίχου (↔ κολώνας) πάνω σε υφιστάμενη οντότητα

**Ημ/νία:** 2026-06-24
**Τύπος:** Feature / SSoT unification (DXF/BIM Viewer — drawing ghost face-snap). Revit-grade, **FULL ENTERPRISE + FULL SSoT**.
**Γλώσσα:** Απαντάς στον Giorgio **ΣΤΑ ΕΛΛΗΝΙΚΑ.**

---

## 🚨 ΚΑΝΟΝΕΣ ΣΥΝΕΔΡΙΑΣ (απαράβατοι)
- **COMMIT/PUSH κάνει ΜΟΝΟ ο Giorgio.** ΠΟΤΕ εσύ. **Το working tree μοιράζεται με ΑΛΛΟΝ agent** → ΠΟΤΕ `git add -A`, stage ΜΟΝΟ τα δικά σου specific αρχεία.
- **ΠΡΙΝ ΑΠΟ ΚΑΘΕ ΓΡΑΜΜΗ ΚΩΔΙΚΑ → ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep)** για REUSE· μηδέν διπλότυπα. Ο Giorgio κάνει σκληρό audit («κεντρικοποιημένο; υπάρχει ήδη; διπλότυπο; θα το έκανε έτσι η Revit;»).
- **FULL ENTERPRISE + FULL SSoT**, όπως οι μεγάλοι παίκτες (Revit). Όχι `any`/`as any`· functions ≤40 γρ., files ≤500 γρ. (N.7.1)· i18n (N.11).
- **N.14:** δήλωσε μοντέλο (**Opus** — cross-subsystem drawing/snap) & περίμενε «ok» πριν την υλοποίηση.
- **N.8:** 5+ αρχεία / 2+ domains → πρότεινε Plan Mode/Orchestrator.
- **N.17:** ΕΝΑ tsc τη φορά (έλεγξε με `Get-CimInstance` πριν)· verify με **jest**.
- **ADR-driven (N.0.1):** code = source of truth· ενημέρωσε ADR + changelog στο τέλος.
- **100% ειλικρίνεια.**

---

## 1. ΤΟ ΖΗΤΟΥΜΕΝΟ (λόγια Giorgio)

> «Μελέτησε πάρα πολύ καλά τη **συμπεριφορά του φαντάσματος του τοίχου πάνω σε μια υφιστάμενη οντότητα** και την **ίδια ακριβώς** συμπεριφορά εφάρμοσέ την και στο **δοκάρι**. Βαθιά έρευνα/βουτιά. Θέλω οι συμπεριφορές **δοκαριού + κολώνας + τοίχου** να είναι **πανομοιότυπες**, να **μοιράζονται τον ίδιο ακριβώς κώδικα**. Revit-grade, FULL ENTERPRISE + FULL SSoT.»

**Στόχος:** ΕΝΑΣ κοινός κώδικας ghost-on-existing-entity για τοίχο/δοκάρι/κολώνα — μηδέν παράλληλες υλοποιήσεις.

---

## 2. 🔬 ΒΑΘΥ AUDIT — ΤΙ ΒΡΕΘΗΚΕ ΗΔΗ (από τη συνεδρία 2026-06-24· **re-grep για επιβεβαίωση**, ο κώδικας αλλάζει — βλ. §6)

### Ο κοινός μηχανισμός ΥΠΑΡΧΕΙ ήδη (bim/framing/ = canonical SSoT)
- **`bim/framing/member-ghost-snap.ts` → `resolveMemberGhostSnapFromStore(cursor, columnFootprints, memberTargets, widthMm, units)`** = **ο ΕΝΑΣ dispatcher** (column-priority 12-θέσεων face → μετά member-to-member T-framing). Επιστρέφει `{ start, end, status, faceFrame? }`.
- **`bim/framing/linear-member-face-snap.ts`** → `resolveLinearMemberFaceSnap`, `isMemberCollinearOverlap`, type `LinearMemberSnapTarget`, `MemberGhostSnapResult`, `GhostFaceFrame`.
- **`bim/framing/member-column-face-snap.ts`** → `resolveMemberColumnFaceSnap` (12-θέσεων), `MEMBER_GHOST_LEN_MM`, `MEMBER_GHOST_CAPTURE_MM`, `DOMINANT_DIVISION_MM` (proportional fine slide step = παρειά÷1cm).

### Το δοκάρι ΕΙΝΑΙ ΗΔΗ thin adapter (μηδέν πραγματικό διπλότυπο)
- **`bim/beams/beam-beam-face-snap.ts`**: `export type BeamSnapTarget = LinearMemberSnapTarget` (alias!)· `resolveBeamBeamFaceSnap` → delegate `resolveLinearMemberFaceSnap`· `export { isMemberCollinearOverlap as isBeamCollinearOverlap }`.
- **`bim/beams/beam-column-face-snap.ts`**: `resolveBeamGhostSnapFromStore` → **alias** του `resolveMemberGhostSnapFromStore`· `resolveBeamColumnFaceSnap` → delegate· `BEAM_GHOST_LEN_MM = MEMBER_GHOST_LEN_MM`.

➡️ **Συμπέρασμα:** το **before-click smart ghost** ΚΑΙ το **start (1ο κλικ) face-snap** είναι **ΗΔΗ ταυτόσημα** τοίχου/δοκαριού/κολώνας — ίδιος dispatcher. **Δεν χρειάζονται αλλαγή.**

### ⛳ ΤΟ ΜΟΝΟ ΚΕΝΟ: το **endpoint (2ο κλικ)** — ο τοίχος το έχει, το δοκάρι ΟΧΙ
Ο **τοίχος** (ADR-508 + Shift-step 2026-06-24) απέκτησε πλούσια συμπεριφορά στο **ΑΚΡΟ** που το **δοκάρι ΔΕΝ έχει**:

| Συμπεριφορά endpoint (awaitingEnd) | Τοίχος | Δοκάρι |
|---|---|---|
| Endpoint face-snap (το ΑΚΡΟ γλιστρά flush σε παρειά μέλους/κολώνας) | ✅ `resolveWallEndpointSnap` | ❌ |
| Listening dimensions στο ΑΚΡΟ (`faceFrame` → 3 νούμερα) | ✅ | ❌ |
| **Shift 1cm βήμα** στο ΑΚΡΟ (free space· face-snap νικά) | ✅ `resolveWallEndpointWithFineStep` | ❌ |
| Lock (Δαχτυλίδι) precedence στο commit | ✅ | (curved-only) |

**Ο τοίχος (preview):** `hooks/drawing/wall-preview-helpers.ts` → `generateWallPreview` awaitingEnd branch (~γρ. 233-254):
```
if (kind==='straight' && !isLengthAngleLockActive()) {
  const snap = resolveWallEndpointSnap(cursor, footprints, snapMembers, thickness, units);
  rawEnd = resolveWallEndpointWithFineStep(snap, startPt);   // ← Shift 1cm + face-snap νικά
  endFaceFrame = snap.faceFrame ?? null;                     // ← listening dims στο άκρο
}
```
**Ο τοίχος (commit):** `hooks/drawing/useWallTool.ts` (~γρ. 331-350): `isLengthAngleLockActive()` ? `applyLengthAngleLock` : `resolveWallEndpointWithFineStep(resolveWallEndpointSnap(...), s.startPoint)`.

**Το δοκάρι (preview) — ΧΩΡΙΣ endpoint snap:** `hooks/drawing/beam-preview-helpers.ts` → `makeBeamWysiwygGhost` (awaitingEnd, ~γρ. 141-203): μόνο `buildAnchoredBeamParams` (column side-flush)· **καμία** κλήση endpoint face-snap, **κανένα** listening dim στο άκρο, **κανένα** Shift-step.
**Το δοκάρι (commit) — ΧΩΡΙΣ endpoint snap:** `hooks/drawing/useBeamTool.ts` → `commitTwoClickFromState` (~γρ. 223-265): το `endPoint` περνά **raw**· μόνο `buildAnchoredBeamParams`.

### Κρίσιμο: το `wall-endpoint-snap.ts` είναι **ΗΔΗ generic** (όχι wall-specific!)
`bim/walls/wall-endpoint-snap.ts`:
- `resolveWallEndpointSnap(rawEnd, columnFootprints, memberTargets, widthMm, units)` → **απλό wrapper του `resolveMemberGhostSnapFromStore`** (η λογική είναι 100% member-generic· το «wall» είναι μόνο όνομα).
- `resolveWallEndpointWithFineStep(snap, start)` → `snap.faceFrame ? snap.point : applyMoveFineStepAboutAnchor(snap.point, start)` (face-snap νικά· αλλιώς Shift 1cm). Επίσης 100% generic.

➡️ **Η ενοποίηση είναι ΕΥΚΟΛΗ & καθαρή:** απλώς **μετακόμισε** το ήδη-generic endpoint-snap στο `bim/framing/` και σύνδεσέ το στο δοκάρι (mirror του τοίχου).

---

## 3. 🎯 ΠΡΟΤΕΙΝΟΜΕΝΟ ΣΧΕΔΙΟ (FULL SSoT — επιβεβαίωσε με grep ΠΡΩΤΑ)

1. **Γενίκευσε** `bim/walls/wall-endpoint-snap.ts` → νέο canonical **`bim/framing/member-endpoint-snap.ts`**:
   - `MemberEndpointSnap` (= `WallEndpointSnap`), `resolveMemberEndpointSnap(...)` (= `resolveWallEndpointSnap`), `resolveMemberEndpointWithFineStep(snap, start)` (= ίδιο).
   - Κράτα `bim/walls/wall-endpoint-snap.ts` ως **thin re-export** (byte-for-byte για wall consumers + tests· **mirror του beam-adapter pattern**). Πρόσθεσε προαιρετικά `bim/beams/beam-endpoint-snap.ts` alias για συμμετρία.
2. **Σύνδεσε το δοκάρι PREVIEW** (`beam-preview-helpers.ts` → `makeBeamWysiwygGhost`, straight/cantilever, ΟΧΙ curved): υπολόγισε `snap = resolveMemberEndpointSnap(endPt, footprints, beamTargets, widthMm, units)`, `endPt = resolveMemberEndpointWithFineStep(snap, startPt)`, και endpoint listening dims μέσω `resolveGhostFaceDimensionsMeta(snap.faceFrame, isOverlap, units, wpp)` — **ακριβές mirror** του `makeWallWysiwygGhost`. Σεβάσου lock precedence (skip όταν `isLengthAngleLockActive()`).
3. **Σύνδεσε το δοκάρι COMMIT** (`useBeamTool.ts` → πριν το `commitTwoClickFromState`): ίδια ανάλυση endpoint (lock ? `applyLengthAngleLock` : `resolveMemberEndpointWithFineStep(resolveMemberEndpointSnap(...), s.startPoint)`) → **preview ≡ commit**.
4. **Shift 1cm step** επεκτείνεται **αυτόματα** στο δοκάρι (ίδιος shared helper· `grip-move-constraints.ts` `applyMoveFineStepAboutAnchor`).
5. **Κολώνα:** είναι ο **στόχος** του face-snap (single-click placement, ΟΧΙ 2-click linear) → «endpoint» δεν εφαρμόζεται. Επιβεβαίωσε ότι το column before-click ghost (`column-preview-helpers.ts` / `useColumnTool.ts`) χρησιμοποιεί τον ΙΔΙΟ dispatcher/face-snap (member-column-face-snap) — αν διαφέρει, ευθυγράμμισε. **Ρώτα τον Giorgio** τι ακριβώς εννοεί «ίδια συμπεριφορά» για την κολώνα.

---

## 4. 🧭 EXACT ANCHORS (re-grep — μπορεί να μετακινήθηκαν, βλ. §6)
- Dispatcher: `bim/framing/member-ghost-snap.ts:resolveMemberGhostSnapFromStore`
- Generic endpoint (προς relocate): `bim/walls/wall-endpoint-snap.ts:resolveWallEndpointSnap` + `resolveWallEndpointWithFineStep`
- Shift step SSoT: `bim/grips/grip-move-constraints.ts:applyMoveFineStep` + `applyMoveFineStepAboutAnchor`
- Wall preview reference: `hooks/drawing/wall-preview-helpers.ts:generateWallPreview` (awaitingEnd) + `makeWallWysiwygGhost`
- Wall commit reference: `hooks/drawing/useWallTool.ts` (awaitingEnd ~331-350)
- Beam preview GAP: `hooks/drawing/beam-preview-helpers.ts:makeBeamWysiwygGhost` (~141-203)
- Beam commit GAP: `hooks/drawing/useBeamTool.ts:commitTwoClickFromState` (~223-265)
- Beam adapters: `bim/beams/beam-column-face-snap.ts`, `bim/beams/beam-beam-face-snap.ts`
- Listening dims helper: `resolveGhostFaceDimensionsMeta` (από `hooks/drawing/wysiwyg-preview-shared.ts`)

---

## 5. ❓ ΑΝΟΙΧΤΑ ΣΗΜΕΙΑ (ρώτα τον Giorgio, με συγκεκριμένο παράδειγμα/νούμερα)
- **Target set του beam endpoint:** ο τοίχος snap-άρει σε `['wall','beam','slab','line']`, το δοκάρι σε `['beam','slab']`. Να αποκτήσει το δοκάρι ΤΟ ΙΔΙΟ target set (δηλ. να κουμπώνει και σε τοίχους/γραμμές) ή να κρατήσει τα δικά του (σημασιολογική διαφορά); «Πανομοιότυπο» = ίδιος **μηχανισμός**, αλλά το target list είναι σχεδιαστική επιλογή.
- **Κολώνα:** τι σημαίνει «ίδια συμπεριφορά» για ένα single-click member; (πιθανόν: ίδιος dispatcher + ίδιο visual feedback — ήδη υπάρχει).

---

## 6. ⚠️⚠️ ΠΡΟΣΟΧΗ — ΑΛΛΟΣ AGENT ΔΟΥΛΕΥΕΙ ΕΝΕΡΓΑ ΣΤΑ ΙΔΙΑ ΑΡΧΕΙΑ
- Commit **`ea3ba36d feat(dxf): unified bim-cursor-snap SSoT (ADR-514) + relocate`** (μόλις έγινε) **άγγιξε `wall-endpoint-snap.ts` + relocate** snap modules. Υπάρχει και untracked `HANDOFFS/...ADR-514-phase2-column-wiring.md` + (νωρίτερα) untracked `bim/placement/`.
- **➡️ ΚΑΝΕ RE-GREP/RE-READ στην αρχή.** Τα paths/ονόματα του §4 μπορεί να έχουν ΗΔΗ μετακινηθεί από την ADR-514. Μην εμπιστευτείς τυφλά αυτό το handoff — **ο κώδικας είναι η αλήθεια**. Πιθανόν η ADR-514 να έχει ήδη ξεκινήσει μέρος της ενοποίησης (cursor-snap) → ευθυγραμμίσου, μη δημιουργήσεις παράλληλο.
- **Μην πειράξεις** αρχεία/φακέλους άλλου agent· stage ΜΟΝΟ τα δικά σου.

## 7. ΚΑΤΑΣΤΑΣΗ (committed)
- Το Shift 1cm-step (move **και** wall-draw) είναι **COMMITTED** (`931c52b1` + επόμενα). Τα `applyMoveFineStep`/`applyMoveFineStepAboutAnchor`/`resolveWallEndpointWithFineStep` υπάρχουν στον κώδικα.
- ADR: **ADR-508** (unified linear-member framing) = το σπίτι αυτής της δουλειάς. ADR-049 = το Shift-step. Ενημέρωσε changelog στο τέλος.

## 8. ΕΠΑΛΗΘΕΥΣΗ
- **jest:** επέκτεινε `beam-preview` / νέο `member-endpoint-snap` suite (mirror `wall-endpoint-snap.test.ts`). Pure step/snap = deterministic.
- **Browser (Giorgio, zoomed-in):** σχεδίασε δοκάρι· το ΑΚΡΟ γλιστρά flush σε παρειά υπάρχοντος μέλους/κολώνας (ίδιο με τοίχο)· listening dims στο άκρο· με **Shift** στο κενό → βήμα 1cm· κοντά σε παρειά → flush νικά. Ίδια αίσθηση με τον τοίχο.
- ⚠️ CHECK 6B/6D (drawing path: beam-preview-helpers / useBeamTool) → stage **ADR-508 (+ADR-040)** μαζί.
- ⚠️ Προϋπάρχον fail στο `useWallTool.test.tsx` (8 tests, legacy `awaitingAlignment`) — **ΟΧΙ** δικό σου· ίσως υπάρχει αντίστοιχο legacy fail σε beam tests. Επιβεβαίωσε με stash πριν χρεωθείς regression.

---

## 9. ΓΡΗΓΟΡΟ ΞΕΚΙΝΗΜΑ
Βλ. το μήνυμα που σου δίνει ο Giorgio στο prompt της νέας συνεδρίας.
