# HANDOFF — Τόξο «φοράς ανοίγματος»: κυανές ενδείξεις στη μετακίνηση/grip + rotation ghost (SSoT)

**Ημ/νία:** 2026-07-04 · **Subapp:** `src/subapps/dxf-viewer/` · **Screenshot:** `C:\Nestor_Pagonis\Στιγμιότυπο οθόνης 2026-07-04 225318.jpg`
**⚠️ SHARED TREE** (ενεργός άλλος agent — ADR-571/572). `git add <specific>` ΜΟΝΟ. **Commit → ΜΟΝΟ Giorgio.** jest μόνο (ΟΧΙ tsc, N.17). ΟΧΙ `any`.

---

## 🎯 ΘΕΜΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
Το **τόξο/τεταρτημόριο «φοράς ανοίγματος»** ενός κουφώματος (DXF `arc`, κυανό #00CCCC, layer COLOR_132). Όταν επιλέγεται
δείχνει: **2 λαβές άκρων** + **λαβή κέντρου** + **σταυρό μετακίνησης (MOVE)** + **σημάδι περιστροφής**. Δύο ελλείψεις σε
σχέση με ΟΛΕΣ τις άλλες οντότητες — ο Giorgio θέλει **ΙΔΙΑ συμπεριφορά, ΜΙΑ πηγή αλήθειας**:

- **ΠΡΟΒΛΗΜΑ Α** — Όταν μετακινώ **οποιοδήποτε grip** (κέντρο ή άκρα) **Ή** πιάνω το **σώμα** του τόξου (body-drag),
  **ΔΕΝ** εμφανίζονται οι κυανές «κεντρικοποιημένες» ενδείξεις (listening / neighbor-clearance dims) που εμφανίζονται
  τώρα στις άλλες οντότητες.
- **ΠΡΟΒΛΗΜΑ Β** — Όταν πατάω το **σημάδι περιστροφής**, **ΔΕΝ** εμφανίζεται σε προεπισκόπηση το **φάντασμα (ghost)**
  του τόξου, όπως σε όλες τις άλλες οντότητες.

---

## 🧭 CONTEXT — τι ΜΟΛΙΣ φτιάχτηκε (το SSoT που πρέπει να επαναχρησιμοποιηθεί)
Στην προηγούμενη συνεδρία υλοποιήθηκαν οι **κυανές neighbor-clearance listening dims ΚΑΤΑ ΤΗ ΜΕΤΑΚΙΝΗΣΗ** (ADR-508
§move-clearance). **Πλήρες SSoT chain** — το ΠΡΟΒΛΗΜΑ Α πρέπει να χτιστεί ΠΑΝΩ σε αυτό (ΜΗΝ φτιάξεις νέο):
- `bim/framing/entity-footprint-for-dims.ts` — `resolveEntityFootprintForDims(entity)` (κολόνα/δοκός→member,
  τοίχος→wallFootprint, **arc/λοιπά DXF→`getEntityBounds` bbox**). Το arc **ΗΔΗ** δίνει bbox footprint.
- `bim/framing/clearance-dims.ts` — `resolveClearanceDimsForGhost(footprint, targets, sceneUnits, wpp)` (metrics SSoT).
- `bim/framing/move-clearance-dims.ts` — **`resolveMoveClearanceForSelection(getEntity, ids, delta, sceneEntities,
  sceneUnits, wpp)`** = ΕΝΑΣ entry (footprint-shift + self-exclusion + drag-cached targets).
- Paint: `paintGhostFaceDimensions(ctx, meta, transform, viewport)` (`canvas-v2/preview-canvas/ghost-face-dim-paint.ts`),
  χρώμα `OVERLAY_LINE_COLORS.listeningDim` (#29B6F6).
- Καταναλωτές σήμερα: `useMovePreview` (2-click Move) + `useEntityBodyDragPreview` (body-drag). **Το grip-drag ΔΕΝ**
  τα καλεί ακόμα → γι' αυτό το ΠΡΟΒΛΗΜΑ Α για τα grips.

## 🔍 SSoT AUDIT — σημεία εκκίνησης (grep ΠΡΙΝ γράψεις κώδικα — ΥΠΟΧΡΕΩΤΙΚΟ)
- **ΠΡΟΒΛΗΜΑ Α (grip-drag clearance):** `hooks/tools/useGripGhostPreview.ts` + `grip-ghost-preview-draw-helpers.ts` +
  `grip-drag-preview-transform.ts`. Εκεί ζωγραφίζεται το grip ghost· πρέπει να καλέσει το **ίδιο** `resolveMoveClearanceForSelection`
  (ή αντίστοιχο single-entity variant) + `paintGhostFaceDimensions`. Το grip-drag έχει ήδη το moving entity + delta.
- **ΠΡΟΒΛΗΜΑ Α (body-drag arc):** επιβεβαίωσε ΓΙΑΤΙ το body-drag δεν δείχνει για arc — το `resolveEntityFootprintForDims(arc)`
  δίνει bbox (center±r), που για τεταρτημόριο είναι ΜΕΓΑΛΟ τετράγωνο → ίσως ο γείτονας πέφτει εκτός `maxClearance`, ή το
  arc δεν είναι body-draggable. Έλεγξε `EntityBodyDragStore` (ποια entity types αρματώνει) + το bbox μέγεθος.
- **ΠΡΟΒΛΗΜΑ Β (rotation ghost):** πώς οι άλλες οντότητες δείχνουν ghost στην περιστροφή → `useGripGhostPreview.ts` +
  `rendering/ghost/apply-entity-preview.ts` (transform preview) + `hooks/grips/grip-primitive-rotate-commits.ts` +
  `systems/arc/arc-grips.ts`. Πιθανή ρίζα: το `apply-entity-preview`/`grip-drag-preview-transform` δεν χειρίζεται
  **rotation** για `arc` (ή ο rotation handler δεν αρματώνει ghost για arc). ΕΝΑΣ SSoT ghost-preview path πρέπει να
  καλύπτει και το arc.

## ⚙️ ΟΔΗΓΙΕΣ (Giorgio)
1. **Big-player πρακτική** (Revit / Maxon Cinema 4D / Figma-level). Full **ENTERPRISE + full SSoT**· αν οι μεγάλοι παίκτες
   δεν προτείνουν κάτι, ακολούθησε την πρακτική τους.
2. **ΠΡΑΓΜΑΤΙΚΟ SSoT audit (grep) ΠΡΙΝ κώδικα** — βρες υπάρχοντα SSoT, χρησιμοποίησέ τα, **ΜΗΝ** δημιουργήσεις διπλότυπα.
   Αν βρεις προϋπάρχον διπλότυπο (που δεν το έφτιαξες εσύ) → **κεντρικοποίησέ το κι αυτό** (διαταγή).
3. **Plan Mode** πριν την υλοποίηση (3-5+ αρχεία, 2 domains — grips + framing).
4. **jest μόνο**, ΟΧΙ tsc. ΟΧΙ `any`/`as any`/`@ts-ignore`. **Commit ΜΟΝΟ Giorgio.** Shared tree → `git add <specific>`.
5. Screenshot-driven verify. Αν χρειαστεί diagnosis → on-screen HUD στο draw callback + ΜΙΑ κίνηση + 1 screenshot
   (δούλεψε άριστα· ΘΥΜΗΣΟΥ να το αφαιρέσεις πριν το τέλος).

## 📦 ΚΑΤΑΣΤΑΣΗ GIT (πριν ξεκινήσεις)
- **Committed** `d1db5189` (Giorgio, 22:36 — add race): όλο το clearance-dims feature + 8px alignment fix + ADR-571/572.
- **Uncommitted** (καθαρά δικά μου, περιμένουν commit Giorgio): `bim/placement/placement-ghost-assembly.ts` (footprint
  unification) · `hooks/tools/useMovePreview.ts` + `useEntityBodyDragPreview.ts` (αφαίρεση προσωρινού HUD) ·
  `docs/.../ADR-508-*.md` (§move-clearance changelog). **Επιβεβαίωσε ότι έγιναν commit** πριν ξεκινήσεις το arc work.
