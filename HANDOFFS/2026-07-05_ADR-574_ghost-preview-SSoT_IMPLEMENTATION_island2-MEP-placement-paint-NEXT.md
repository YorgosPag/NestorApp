# HANDOFF — ADR-574 Ghost/Preview SSoT · ΥΛΟΠΟΙΗΣΗ Νησίδων

**Date:** 2026-07-05
**Subapp:** `src/subapps/dxf-viewer` (https://nestorconstruct.gr/dxf/viewer)
**ADR:** `docs/centralized-systems/reference/adrs/ADR-574-ghost-preview-ssot-audit.md` (γραμμένο, indexed)
**Πρότυπο ποιότητας:** Revit / Maxon (Cinema 4D) / Figma-level · FULL enterprise + FULL SSoT.
Κανόνας big-player: **αν οι μεγάλοι παίκτες ΔΕΝ το προτείνουν → ακολουθούμε τη δική τους πρακτική**, όχι θεωρητικό SSoT.

---

## 0. ΚΑΤΑΣΤΑΣΗ (πού είμαστε)

Ολοκληρώθηκε **audit-only** ADR (ADR-574): χαρτογράφηση όλων των «φαντασμάτων» (ghosts/previews) του DXF
Viewer σε κάθε κατάσταση (γέννηση/μετακίνηση/επεξεργασία/περιστροφή), 2D+3D.

**Ετυμηγορία audit:**
- **Άξονας Α — Γεωμετρία (σχήμα):** ✅ γνήσια ενοποιημένη SSoT. `applyEntityPreview` (edit) + `compute*Geometry`
  (όλα). preview ≡ commit «by identity» (ADR-560/561). **Καμία αλλαγή εδώ.**
- **Άξονας Β — Paint/Routing:** ⚠️ 4 οριοθετημένες νησίδες. **ΑΥΤΕΣ υλοποιούμε.**

Καμία γραμμή runtime κώδικα δεν άλλαξε ακόμη. Δεν έγινε commit (ο Giorgio κάνει commit).

---

## 1. ΤΙ ΥΛΟΠΟΙΟΥΜΕ — 4 νησίδες + προτεινόμενη σειρά

| # | Νησίδα | Severity | Big-player το προτείνει; | Προτ. σειρά |
|---|---|---|---|---|
| Σ2 | **MEP + openings PLACEMENT ghosts** ζωγραφίζονται από bespoke `*GhostRenderer` δίδυμα, όχι μέσω committed renderer | MEDIUM | ✅ **ΝΑΙ** — Revit placement preview = το πραγματικό family symbol (WYSIWYG) | **1η (ΕΠΟΜΕΝΟ ΒΗΜΑ)** |
| Σ4 | **Line rotation** preview vs commit = διαφορετική geometry engine (όχι identity όπως arc/polyline) | LOW | ✅ ΝΑΙ (καθαρό identity, ίδιο με ADR-561) | 2η |
| Σ3 | **Twin dispatch ladders** (`applyEntityPreview` ↔ `commitDxfGripDragModeAware`) — διπλό routing στους ίδιους `*GripKind` | MEDIUM (maintainability) | ⚠️ registry pattern (internal, να επιβεβαιωθεί ότι δεν υπάρχει ήδη) | 3η |
| Σ1 | **2D primitive creation rubber-band** δεν εφαρμόζει `resolveEntityRenderStyle` | LOW | ⚠️ **ΑΜΦΙΛΕΓΟΜΕΝΟ** — πολλά CAD δείχνουν rubber-band σε ουδέτερο highlight, ΟΧΙ full style. Χρειάζεται big-player απόφαση πριν αγγιχτεί | 4η (ίσως RESOLVED-no-change) |

**Phase-per-session (κανόνας):** **ΜΙΑ νησίδα ανά συνεδρία**, ≤70% context, handoff στο τέλος.

---

## 2. ΕΠΟΜΕΝΟ ΒΗΜΑ — Νησίδα Σ2 (MEP/opening placement paint)

**Στόχος:** το **placement** ghost των MEP + openings να ζωγραφίζεται μέσα από τον **committed render path**
(ή έναν κοινό symbol-draw helper), ώστε placement-ghost == commit-paint — όπως ήδη ισχύει στο **edit**
(grip/move περνά από `apply-parametric-box-preview` → `computeMep*Geometry` → real renderer).

**Τα bespoke δίδυμα (η νησίδα):**
- `bim/mep-manifolds/MepManifoldGhostRenderer.ts` (δίδυμο του `bim/renderers/MepManifoldRenderer.ts`)
- `bim/electrical-panels/ElectricalPanelGhostRenderer.ts`
- `bim/mep-boilers/MepBoilerGhostRenderer.ts`
- `bim/mep-water-heaters/MepWaterHeaterGhostRenderer.ts`
- `bim/mep-radiators/MepRadiatorGhostRenderer.ts`
- `bim/mep-segments/MepSegmentGhostRenderer.ts`
- `bim/renderers/OpeningRenderer.ts` (+ `useOpeningGhostPreview.ts`, `useSlabOpeningGhostPreview.ts`)
- Hooks: `hooks/tools/useMep*GhostPreview.ts` (footprint από tool `getGhostFootprint()`)

**Ήδη επιβεβαιωμένο (χειροκίνητο read):** τα ghosts επαναχρησιμοποιούν ΚΙΟΛΑΣ sub-SSoT helpers
(`resolveManifoldPalette`, `buildDrainageGratingStrokes`, `hexToRgba`/ADR-571). Δηλαδή η απόκλιση είναι
**μόνο στη διαδρομή paint**, όχι στο σύμβολο. Ιδανικό pattern-στόχος: το ίδιο που κάνει το edit —
`toWysiwygPreviewEntity` (`hooks/drawing/wysiwyg-preview-shared.ts`) → `BimPreviewRenderer`
(`canvas-v2/preview-canvas/bim-preview-render.ts`) → **πραγματικός** `EntityRendererComposite`.

---

## 3. 🚨 ΥΠΟΧΡΕΩΤΙΚΟ ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ — SSoT AUDIT (grep)

**Ο Giorgio το τόνισε ρητά.** Πριν οποιαδήποτε νέα γραμμή:
1. `grep` για υπάρχον pattern «ghost μέσω committed renderer»: ήδη υπάρχει το
   `BimPreviewRenderer` + `toWysiwygPreviewEntity` + `placement-ghost-assembly.ts`
   (`bim/placement/placement-ghost-assembly.ts`) — **αυτά είναι το SSoT· ΧΡΗΣΙΜΟΠΟΙΗΣΕ τα, μη φτιάξεις νέο.**
2. Έλεγξε πώς το `placement-ghost-assembly.ts` ήδη δρομολογεί τα **structural** placement ghosts (column/
   wall/beam/foundation) μέσω real renderer → **επέκτεινέ το** στα MEP/openings αντί για bespoke class.
3. Grep αν κάποιο MEP ghost ήδη μεταναστευμένο (μην κάνεις διπλή δουλειά).
4. Επιβεβαίωσε ότι το `computeMep*Geometry` / `computeElectricalPanelGeometry` / `computeOpeningGeometry`
   μπορούν να τρέξουν στο placement cursor χωρίς committed entity (δηλ. να φτιάξεις synthetic preview entity
   με `toWysiwygPreviewEntity`, όπως τα structural).
5. **ΜΗΝ** δημιουργήσεις νέο store/helper αν υπάρχει. Grep πρώτα (`docs/centralized-systems/README.md`).

**Αποτέλεσμα audit → μπες σε Plan Mode, γράψε plan, δείξε στον Giorgio πριν κώδικα.**

---

## 4. 🚨 ΚΡΙΣΙΜΟ CONTEXT — SHARED WORKING TREE

- **Το working tree ΜΟΙΡΑΖΕΤΑΙ με άλλον agent.** ΠΟΤΕ `git add -A`, ΠΟΤΕ `git restore .`, ΠΟΤΕ
  `git reset --hard`, ΠΟΤΕ checkout αρχείων άλλου. Μόνο `git add <specific-file>` + verify `git diff --cached`.
- **ΜΗΝ αγγίξεις** τα ήδη-modified αρχεία άλλου agent (ήταν `M` στην αρχή):
  `bim-3d/scene/ThreeJsSceneManager.ts`, `bim-3d/viewport/viewport-camera.ts`, `bim-3d/viewport/viewport-types.ts`.
- **COMMIT / PUSH: μόνο ο Giorgio.** Εσύ ετοιμάζεις, σταματάς, αναφέρεις. (N.(-1))
- **ΟΧΙ tsc / typecheck** (N.17). jest επιτρέπεται στοχευμένα.

---

## 5. ADR-DRIVEN WORKFLOW (N.0.1)

- Μετά την υλοποίηση κάθε νησίδας → **update ADR-574**: άλλαξε status της νησίδας σε §5/§7 από «σύσταση»
  σε «✅ IMPLEMENTED», πρόσθεσε §10 changelog entry. **Ίδιο commit** κώδικας + ADR (ο Giorgio committάρει).
- Αν CHECK 6B/6D του pre-commit ζητήσει ADR staged για αρχεία canvas/renderer → stage και το ADR-574.

---

## 6. VERIFY (big-player-grade)

Μετά την υλοποίηση Σ2: τρέξε το app (localhost:3000/dxf/viewer), ξεκίνα εργαλείο τοποθέτησης MEP manifold /
electrical panel / opening, και **οπτικά** επιβεβαίωσε ότι το placement ghost δείχνει **ακριβώς** ίδιο
(fill/outline/σύμβολο) με το τελικό committed αντικείμενο μετά το click (WYSIWYG). Έλεγξε και το 3D.

---

## 7. Non-fare (μην κάνεις)

- ΜΗΝ πειράξεις τον άξονα Α (γεωμετρία) — είναι ήδη καθαρή SSoT.
- ΜΗΝ ενοποιήσεις τη Σ1 (creation rubber-band style) χωρίς πρώτα big-player απόφαση — ίσως είναι σκόπιμα
  ουδέτερο highlight (RESOLVED-no-change, όπως το Γ3 στο ADR-572).
- ΜΗΝ ξεκινήσεις 2η νησίδα στην ίδια συνεδρία (phase-per-session).
- ΜΗΝ commitάρεις/pushάρεις.
