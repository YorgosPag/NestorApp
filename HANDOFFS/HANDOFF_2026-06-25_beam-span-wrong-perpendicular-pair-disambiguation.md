# HANDOFF — Auto-span διαλέγει ΛΑΘΟΣ κάθετο ζεύγος (κατακόρυφο Β↔Γ αντί οριζόντιο Β→Α)

**Ημ/νία:** 2026-06-25
**Τύπος:** Bugfix (DXF/BIM Viewer — beam auto-span disambiguation). Revit/ETABS-grade, **FULL ENTERPRISE + FULL SSoT**.
**ADR:** **ADR-529** (συνέχεια· ΗΔΗ filed — μην φτιάξεις νέο· πρόσθεσε **Φ4** + changelog). Χτίζει πάνω σε ADR-528 (auto-span) + ADR-529 Φ1/Φ2/Φ3 (ΟΛΑ **UNCOMMITTED**).
**Γλώσσα απαντήσεων στον Giorgio: ΕΛΛΗΝΙΚΑ πάντα.**

---

## 🚨 ΚΑΝΟΝΕΣ ΣΥΝΕΔΡΙΑΣ (απαράβατοι)
- **COMMIT/PUSH κάνει ΜΟΝΟ ο Giorgio.** ΠΟΤΕ εσύ. (N.(-1))
- **Shared working tree με ΑΛΛΟΝ agent** → **ΠΟΤΕ `git add -A`**, stage ΜΟΝΟ τα δικά σου specific αρχεία. **Re-grep/re-read στην αρχή** — γραμμές/exports μετακινούνται.
- **ΠΡΙΝ ΑΠΟ ΚΑΘΕ ΓΡΑΜΜΗ ΚΩΔΙΚΑ → ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep)** για REUSE· ΜΗΔΕΝ διπλότυπα. Αν βρεις προϋπάρχον διπλότυπο → κεντρικοποίησέ το.
- **FULL ENTERPRISE + FULL SSoT, όπως Revit/ETABS.** ΕΝΑ σημείο αλήθειας· preview ≡ commit by construction. Όχι `any`/`as any`/`@ts-ignore`· functions ≤40γρ· files ≤500γρ (N.7.1)· i18n (N.11).
- **Μοντέλο: Opus** (structural geometry + ranking logic). N.17: ΕΝΑ tsc τη φορά (full tsc OOM-άρει — προτίμησε ts-jest + targeted). Verify με **jest** + browser.
- **ADR-driven (N.0.1):** code = source of truth· διάβασε κώδικα ΠΡΙΝ τον ADR· ενημέρωσε ADR + changelog στο τέλος.
- **Λόγια Giorgio (memory):** ξεκίνα design ερωτήσεις με ΣΥΓΚΕΚΡΙΜΕΝΟ αριθμητικό/οπτικό παράδειγμα (ASCII/νούμερα).

---

## 1. ΤΟ ΠΡΟΒΛΗΜΑ (στιγμιότυπο `Στιγμιότυπο οθόνης 2026-06-25 194009.jpg`)

Κάτοψη: **Στήλη Β** (πάνω) και **Στήλη Γ** (κάτω) είναι **κατακόρυφα στοιχισμένες** (ίδιο X)· **Τείχιο Α**
αριστερά (οριζόντια σκέλη στην κορυφή). Ο χρήστης: εργαλείο **Δοκάρι** → cursor στο **φούξια X** (OSNAP point)
που είναι στη **ΒΔ γωνία της Στήλης Β** (λίγο βόρεια + λίγο δυτικά του κέντρου της Β).

- **Τι θέλει:** το δοκάρι να στηθεί **ΟΡΙΖΟΝΤΙΑ** από **Β → Α** (τείχιο αριστερά), με τη **βόρεια πλευρά** του
  δοκαριού **στην ίδια ευθεία** με τις βόρειες πλευρές του τείχιου Α και της στήλης Β (north-flush).
- **Τι συμβαίνει (bug):** το δοκάρι ευθυγραμμίζεται **ΚΑΤΑΚΟΡΥΦΑ** ανάμεσα σε **Β και Γ**. ❌ Δεν το θέλει.

---

## 2. 🔬 ΡΙΖΑ (επιβεβαιωμένη στον κώδικα `bim/framing/beam-span-snap.ts`)

Ο `resolveBeamSpanSnap` θεωρεί τον cursor «σε φάτνωμα» όταν `along ∈ [sA−capture, sB+capture]` **ΚΑΙ**
`perp ≤ capture` (γρ. ~326-327), και διαλέγει με ranking: **(1) faceAligned** προηγείται λοξού· **(2) ίδια
κλάση → nearest perp** (γρ. ~337-342). Στο σενάριο:

1. **Φ1 along-margin** (`captureScene` = `MEMBER_GHOST_CAPTURE_MM` = **600mm**) — προστέθηκε ώστε ο cursor
   **ΠΑΝΩ σε παρειά** να ενεργοποιεί span. ΟΜΩΣ είναι **πολύ γενναιόδωρο**: επιτρέπει τον cursor να είναι
   **ΕΞΩ από το κενό**, στην **αντίθετη** πλευρά ενός μέλους.
2. **Ζεύγος Β↔Γ (κατακόρυφο):** το κενό είναι **ΝΟΤΙΑ** της Β (ανάμεσα Β-Γ). Ο cursor είναι **ΒΟΡΕΙΑ** της Β
   (αντίθετη πλευρά) — αλλά μπαίνει στο 600mm along-margin → **περνά**. Και ο cursor είναι σχεδόν πάνω στον
   κατακόρυφο άξονα Β↔Γ → **perp ≈ 0** (πολύ μικρό).
3. **Ζεύγος Β↔Α (οριζόντιο):** ο cursor είναι στη **δυτική παρειά** της Β (στο/κοντά στο κενό προς Α) → περνά,
   αλλά είναι **βόρεια** της facing-γραμμής → **perp μεγαλύτερο**.
4. **Και τα δύο `faceAligned`** (κάθετα σε παρειά) → η Φ2-refine προτεραιότητα **ΔΕΝ τα ξεχωρίζει**.
5. Tiebreak = **nearest perp** → κερδίζει το **κατακόρυφο** Β↔Γ (μικρότερο perp). ❌

**Συμπέρασμα:** το along-margin admit-άρει span του οποίου το κενό είναι στην **αντίθετη πλευρά** του μέλους
από τον cursor· και ο perp-tiebreak διαλέγει το κατακόρυφο. Λείπει **directional disambiguation**: ποια παρειά
του μέλους που hover-άρει ο cursor δείχνει τη **φορά** του span.

---

## 3. 🎯 ΠΡΟΤΕΙΝΟΜΕΝΗ ΛΥΣΗ (Revit-grade· επιβεβαίωσε με grep ΠΡΩΤΑ· ρώτησε Giorgio αν δίλημμα)

**Στόχος:** όταν δύο **κάθετα** auto-span ζεύγη είναι και τα δύο faceAligned, να κερδίζει αυτό που δείχνει η
**θέση του cursor ως προς τις παρειές του μέλους που hover-άρει** (Revit: το πλαίσιο ακολουθεί την παρειά).

### Επιλογή A (προτεινόμενη) — Directional preference μέσω dominant face
- Βρες το μέλος **πλησιέστερο στον cursor** (το hovered) και **ποια παρειά του** είναι πλησιέστερη
  (**reuse `footprintBounds` + `pickDominantFace`** από `bim/geometry/shared/footprint-face-frame.ts` — ΗΔΗ
  το SSoT των column face-snap· **ΜΗΔΕΝ νέο**).
- **Πρόσθεσε ranking tier** (πάνω από το perp, ίσως ίσο/πάνω από faceAligned): προτίμησε το ζεύγος του οποίου
  η διεύθυνση `u` **ευθυγραμμίζεται με την outward normal της dominant παρειάς** (το δοκάρι «βγαίνει» από την
  παρειά που είναι ο cursor). cursor στη **δυτική** παρειά της Β → προτίμησε **δυτικό** span (→ Α).

### Επιλογή B (υποστηρικτική / συμπληρωματική) — bound το along-margin στο σώμα του μέλους
- Αντί flat `capture` (600mm) και στις δύο πλευρές, περιόρισε το margin ώστε ο cursor να επιτρέπεται **εντός
  του σώματος του μέλους ή του κενού**, ΟΧΙ **πέρα** από το μέλος στην αντίθετη πλευρά. (Η Φ1 ήθελε «cursor
  ΠΑΝΩ στην παρειά» — αρκεί margin ≈ βάθος μέλους κατά `u`, ΟΧΙ 600mm στο κενό.)
- Πρόσθετο tier: **in-gap** (`along ∈ [sA, sB]`) προηγείται **in-margin** (έξω από το κενό).

### Σύσταση
**A (directional) + B (in-gap tier)**. Το A είναι το πιο Revit-like και reuse- everything· το B κλείνει την
τρύπα του γενναιόδωρου margin. **Πρόσεξε μηδέν regression** στα Φ1/Φ3 (cursor-στην-παρειά, κοίλο Γ, justified
third-alignment) — όλα έχουν jest. Ρώτησε Giorgio με ASCII παράδειγμα αν η disambiguation rule έχει δίλημμα
(π.χ. cursor ακριβώς σε γωνία — βόρεια vs δυτικά).

---

## 4. 🔗 EXACT SSoT ANCHORS (re-grep — shared tree)
- **Span resolver/bug:** `bim/framing/beam-span-snap.ts`
  - `resolveBeamSpanSnap` (γρ. ~310-345): gates `along`/`perp` (~326-327) + ranking (faceAligned→perp, ~337-342).
  - `pairFrame` (~160-209): facing-points + `sA`/`sB` + `faceAligned` + `faceA`/`faceB` (facing edges).
  - `spanJustification` (~Φ3): justified perp + `GhostFaceFrame` (σιελ dims).
  - Σταθερές: `SPAN_CAPTURE_MM` (=600), `FACE_PERP_SIN` (=0.342).
- **Dominant-face SSoT (reuse):** `bim/geometry/shared/footprint-face-frame.ts` → `footprintBounds` (γρ.38),
  `pickDominantFace` (γρ.55), `distanceToFootprintBounds` (γρ.48). **Είσοδος = το outline του μέλους.**
- **Brain (περνά memberWidthMm/faceFrame):** `bim/placement/bim-cursor-snap.ts` (beam branch, gated `beamSpanGhost`).
- **Preview:** `hooks/drawing/beam-preview-helpers.ts` (`makeBeamGhostBeforeClick` — alignmentGuide + σιελ dims).
- **Tests:** `bim/framing/__tests__/beam-span-snap.test.ts` (16 — ADR-528/529 Φ1/Φ2/Φ3). **Πρόσθεσε** test:
  «cursor βόρεια της Β (κάθετα στοιχισμένη με Γ) ΑΛΛΑ στη δυτική παρειά → κερδίζει το ΟΡΙΖΟΝΤΙΟ Β→Α span».

---

## 5. ✅ ΕΠΑΛΗΘΕΥΣΗ
- **jest (NEW):** το παραπάνω disambiguation test + regression ΟΛΟΥ του `beam-span-snap.test.ts` (16 GREEN τώρα).
- **Regression:** `bim-cursor-snap.test.ts` (11), `column-beam-promote-junction.test.ts` (12), `column-beam-align.test.ts` (25).
- **Browser (Giorgio):** Δοκάρι → cursor στη ΒΔ γωνία της Β → φάντασμα **οριζόντιο Β→Α** (north-flush), ΟΧΙ κατακόρυφο Β↔Γ.
- ⚠️ CHECK 6B/6D (αν αγγίξεις snap/preview) → stage **ADR-040 + ADR-529** μαζί.

---

## 6. 📌 ΚΑΤΑΣΤΑΣΗ ADR-529 (ΟΛΑ UNCOMMITTED — μην μπερδευτείς)
Έγινε σε προηγούμενες συνεδρίες (UNCOMMITTED· commit ο Giorgio):
- **Φ1** — span bugfix κοίλα/Γ μέλη: facing-point άξονας + along-margin + **face-perpendicular προτεραιότητα**
  (το αρχείο `beam-span-snap.ts`). [⚠️ το along-margin είναι η ΡΙΖΑ του νέου bug.]
- **Φ2** — προαγωγή Ι→Γ boundary element: `bim/columns/column-beam-promote-junction.ts` (detector) +
  `promoteColumnToBoundaryL` (στο `bim/columns/column-beam-align.ts`) + `column-promote-confirm-store.ts` +
  `ui/dialogs/ColumnPromoteConfirmDialog.tsx` + `hooks/useColumnBeamPromote.ts` + wiring (`DxfViewerContent`,
  `dxf-viewer-lazy-components`, `DxfViewerDialogs`) + i18n `columnPromoteL` (el/en `dxf-viewer-shell.json`).
- **Φ3** — justified third-alignment (cursor βόρεια/κέντρο/νότια → north/center/south-flush) + **σιελ listening
  dimensions στο auto-span** (`BeamSpanSnap.faceFrame`).
- **ADR:** `docs/centralized-systems/reference/adrs/ADR-529-beam-promotes-corner-column-to-boundary-element.md`
  + 2 entries στο `adr-index.md`. **Πρόσθεσε εκεί τη Φ4 (αυτό το bug) + changelog.**
- **Tests GREEN:** 16 span + 12 promote + 25 align + 11 cursor-snap.

**ΠΡΟΣΟΧΗ:** μη σπάσεις τα Φ1/Φ3 (cursor-στην-παρειά, justified). Η Φ4 πρέπει να **συνυπάρξει** μαζί τους —
το directional/in-gap preference πρέπει να αφήνει το Φ1 (cursor στη facing παρειά → span στο σωστό μέλος) ανέπαφο.
