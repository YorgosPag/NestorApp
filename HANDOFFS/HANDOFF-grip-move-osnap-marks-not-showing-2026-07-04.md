# HANDOFF — Γιατί ΔΕΝ εμφανίζονται τα σημάδια έλξης (OSNAP) στο grip Alt-move — 2026-07-04

## 🎯 ΤΙ ΘΑ ΚΑΝΕΙΣ (μία δουλειά)
**ΜΠΕΣ ΣΕ PLAN MODE.** Βαθιά βουτιά: **γιατί, όταν μετακινώ μια οντότητα από ΛΑΒΗ με Alt+drag
(π.χ. ορθογωνική κολόνα), ΔΕΝ εμφανίζονται τα σημάδια έλξης (OSNAP: □ άκρο, △ μέσο, ○ κέντρο)
και ΔΕΝ έλκεται η λαβή/το φάντασμα κάτω από τον κέρσορα προς τα ΑΚΡΑ και ΜΕΣΑ άλλων οντοτήτων
(DXF ή BIM).**

Ζητούμενο τελικής συμπεριφοράς (εγκεκριμένο από Giorgio — «Option B»):
- Όταν ο κέρσορας/λαβή πλησιάζει **χαρακτηριστικό σημείο** άλλης οντότητας (άκρο/μέσο/κέντρο) →
  **κουμπώνει εκεί (OSNAP), με το marker**, το φάντασμα μένει στο σημείο. **OSNAP προτεραιότητα.**
- Όταν **ΔΕΝ** υπάρχει κοντινό σημείο → κυανές γραμμές AutoAlign ως οπτική βοήθεια (ήδη δουλεύει).

## 🔴 ΤΟ ΠΡΟΒΛΗΜΑ (ΕΠΙΒΕΒΑΙΩΜΕΝΟ ΣΥΜΠΤΩΜΑ)
Το **AutoAlign** (κυανές γραμμές ευθυγράμμισης) πλέον **εμφανίζεται** στο Alt-move. Το **OSNAP όμως
(έλξη σε άκρα/μέσα/κέντρα άλλων οντοτήτων) ΔΕΝ κουμπώνει και ΔΕΝ δείχνει marker.** Δηλαδή το μισό
του Option B λείπει: η OSNAP-priority «σκάλα» υλοποιήθηκε (βλ. παρακάτω) ΑΛΛΑ **το OSNAP δεν παράγει
snaps** σε αυτό το context, οπότε δεν έχει τι να «νικήσει».

## 🧠 ΡΙΖΑ — ΥΠΟΘΕΣΕΙΣ (κατά σειρά πιθανότητας) + ΑΚΡΙΒΕΣ GREP ΓΙΑ ΝΑ ΞΕΚΙΝΗΣΕΙΣ
Ο μηχανισμός OSNAP στο grip-drag ζει εδώ:
`systems/cursor/mouse-handler-move.ts` (~γρ. 185):
```ts
if (isGripDragging && snapEnabled && findSnapPoint) {
  const gripSnapResult = findSnapPoint(worldPos.x, worldPos.y);
  if (gripSnapResult?.found && gripSnapResult.snappedPoint) { moveWorldPos = ...; osnapFound = true; setImmediateSnap(...) }
  else { clearImmediateSnap() }
  ...wall-face + column-corner snaps...
}
```
Αν το OSNAP **έβρισκε** άκρο/μέσο, θα καλούσε `setImmediateSnap({found:true})` → θα φαινόταν marker.
Ο χρήστης ΔΕΝ βλέπει marker → **το `findSnapPoint` ΔΕΝ επιστρέφει `found:true` σε άκρα/μέσα άλλων
οντοτήτων εδώ.** Γιατί:

1. **[ΙΣΧΥΡΟΤΕΡΗ] `findSnapPoint` είναι `null`/ανενεργό ή `snapEnabled=false` στο grip-drag.**
   → Όλο το block παρακάμπτεται → ΜΗΔΕΝ OSNAP. Grep:
   - `rg "findSnapPoint" src/subapps/dxf-viewer` — πού δημιουργείται (`snap` prop), ποιος το τρέφει, αν είναι active σε select/grip mode.
   - `rg "snapEnabled" src/subapps/dxf-viewer` — default + ποιος το θέτει (status-bar toggle;).
   - Ίχνευσε το `snap = { snapEnabled, findSnapPoint }` prop από τον caller του mouse-handler-move προς τα πάνω (useCentralizedMouseHandlers → DxfCanvas → CanvasLayerStack).
2. **Το `findSnapPoint` ΔΕΝ στοχεύει άκρα/μέσα ΑΛΛΩΝ οντοτήτων** (μόνο grid/guides, ή εξαιρεί όλες τις
   οντότητες, ή εξαιρεί τη σερνόμενη + δεν βλέπει τις υπόλοιπες). Grep το ίδιο το snap engine:
   - `rg "ProSnapResult|findSnapPoint|SnapEngine|useSnap" src/subapps/dxf-viewer/snapping src/subapps/dxf-viewer/systems`
   - Δες ποια snap modes (endpoint/midpoint/center) είναι ενεργά και σε ποια entities.
3. **Ασυμμετρία με τη ΣΧΕΔΙΑΣΗ** (ο χρήστης ΕΠΙΒΕΒΑΙΩΝΕΙ ότι όταν σχεδιάζει, κουμπώνει σε άκρα/μέσα).
   → Το drawing-hover χρησιμοποιεί ΑΛΛΟ (πλήρες) snap path απ' ό,τι το grip-drag. **SSoT fix =
   επαναχρησιμοποίησε ΤΟ ΙΔΙΟ snap engine/config που τρέχει η σχεδίαση.** Grep:
   - `rg "processDrawingHover|drawing-hover|findSnapPoint" src/subapps/dxf-viewer/hooks/drawing`
   - Σύγκρινε: τι snap engine/targets περνά η σχεδίαση vs τι περνά το grip-drag.

**ΠΡΩΤΑ ΚΑΝΕ ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep) πριν γράψεις κώδικα** — βρες τον υπάρχοντα κεντρικό snap
engine και ΧΡΗΣΙΜΟΠΟΙΗΣΕ τον (ΜΗΝ φτιάξεις νέο, ΜΗΝ διπλότυπο). Πιθανότατα η λύση είναι «τρέξε στο
grip-drag το ΙΔΙΟ OSNAP που τρέχει η σχεδίαση», όχι νέος μηχανισμός.

## 📐 BIG-PLAYERS (η πυξίδα)
Revit / AutoCAD / Cinema 4D (Maxon) / Figma: κατά τη μετακίνηση αντικειμένου, το **base point / key points
κουμπώνουν σε endpoints/midpoints/centers/intersections άλλων αντικειμένων (object snap)** με ορατό marker.
Αυτό είναι το standard. Υλοποίηση: **FULL enterprise + FULL SSoT· αν οι μεγάλοι δεν προτείνουν κάτι,
ακολούθησε την πρακτική των μεγάλων.**

## ✅ ΤΙ ΕΓΙΝΕ ΗΔΗ ΑΥΤΗ ΤΗ ΣΥΝΕΔΡΙΑ (context — μην το ξανακάνεις)
3 layers, ΟΛΑ στο working tree (τα περισσότερα ΗΔΗ committed από άλλον agent, 3 αρχεία uncommitted):
1. **Αφαίρεση «πινακίδας» (drawDimPill) από ΟΛΕΣ τις ροές move** (grip + body + 2-click MOVE) + local
   in-draw AutoAlign resolve. Κεντρικοποίηση paint σε **`paintActionAlignmentTracking(…, sceneUnits)`**
   (dim-alignment-tracking.ts) — 4 consumers. Dead-code: `drawMoveReadoutLeader`, `moveLeader` token,
   `moveReadoutMid` αφαιρέθηκαν.
2. **Grip Alt-move AutoAlign parity** — κοινός `resolveBasePointTracking` (grip-drag-alignment-tracking.ts)
   για body-drag + grip Alt-move. Blur-proof: baked `dp.movesEntity` (paint) + `ActiveDragGripInfo.altMove`
   (resolve). Έτσι ΕΜΦΑΝΙΣΤΗΚΑΝ οι κυανές γραμμές στο Alt-move.
3. **OSNAP-priority (Option B)** — `mouse-handler-move.ts`: `osnapFound` → όταν κουμπώνει OSNAP,
   παρακάμπτεται το AutoAlign + `clearGripAlignmentTracking()`. `useGripGhostPreview.ts`: κυανές μόνο όταν
   `!getImmediateSnap()?.found`. **← Αυτό ΠΕΡΙΜΕΝΕΙ το OSNAP να κουμπώνει· ΔΕΝ κουμπώνει → το ΝΕΟ πρόβλημα.**

Λεπτομέρειες: `docs/centralized-systems/reference/adrs/ADR-560-entity-body-drag-move-copy.md`
(changelog 2026-07-04 β/γ/δ/ε/ε-fix/ζ).

## 📚 ΚΛΕΙΔΙΑ-ΑΡΧΕΙΑ
- `systems/cursor/mouse-handler-move.ts` — OSNAP block (γρ.~183) + AutoAlign gate (γρ.~303) + `osnapFound`.
- `systems/cursor/grip-drag-alignment-tracking.ts` — `resolveBasePointTracking` + `applyGripDragAlignmentTracking` (Alt-move κλάδος).
- `hooks/tools/useGripGhostPreview.ts` — ghost draw + paint gate (`getImmediateSnap`, `dp.movesEntity`).
- `systems/cursor/ImmediateSnapStore.ts` — `getImmediateSnap/setImmediateSnap` (OSNAP result SSoT).
- `hooks/grips/grip-mouse-handlers.ts` — `setActiveDragGrip({ altMove, dragAnchor, … })`.
- ΝΕΟ ΨΑΞΙΜΟ: `snapping/`, `hooks/drawing/drawing-hover-handler.ts`, ο δημιουργός του `findSnapPoint`.

## 🔑 ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)
1. **PLAN MODE πρώτα** — βαθιά βουτιά, βρες τη ρίζα, παρουσίασε plan ΠΡΙΝ κώδικα.
2. **ΠΡΑΓΜΑΤΙΚΟ SSoT audit (grep)** πριν κάθε κώδικα — reuse υπάρχοντος snap engine, ΜΗΔΕΝ διπλότυπα.
3. **FULL enterprise + FULL SSoT**· fallback στην πρακτική των big players (Revit/AutoCAD/C4D/Figma).
4. **ADR-040 hot-path**: mouse-handler-move + useGripGhostPreview = hot-path → **stage ADR** (CHECK 6B/6D).
5. **N.17**: ΟΧΙ tsc/typecheck. jest ναι (στοχευμένα).
6. **Ελληνικά πάντα.**

## ⚠️ ΚΑΤΑΣΤΑΣΗ WORKING TREE (multi-agent — ΔΙΑΒΑΣΕ)
- Το working tree **μοιράζεται με άλλον agent**. Οι περισσότερες αλλαγές αυτής της συνεδρίας έγιναν ΗΔΗ
  **commit** από εκείνον (`b5d114a3` / `cbd26f5f` κ.ά.). **Uncommitted τώρα (M):**
  `hooks/tools/useGripGhostPreview.ts`, `systems/cursor/mouse-handler-move.ts`, `ADR-560*.md`.
- **ΠΟΤΕ** `git add -A` / bulk `reset`/`checkout`/`restore`. Μόνο `git add <specific>` + `git diff --cached`.
- **ΠΟΤΕ** checkout αρχείων άλλου agent — μόνο `git reset HEAD` αν χρειαστεί unstage.
- **COMMIT/PUSH ΤΑ ΚΑΝΕΙ Ο GIORGIO** — εσύ ετοιμάζεις & σταματάς.

## ✅ VERIFICATION (πριν πεις «έτοιμο»)
- **jest**: `body-drag-alignment`, `grip-projections-alt-move`, `GripAltMoveStore`, `line-grips`,
  `dim-alignment-tracking`, `grip-commit-alt-bypass` → GREEN (baseline: 48/48 τώρα).
- **browser** (ο Giorgio): επίλεξε κολόνα → Alt+drag σε λαβή → πήγαινε κοντά σε άκρο/μέσο γραμμής:
  **εμφανίζεται marker □/△ ΚΑΙ κουμπώνει εκεί το φάντασμα** (χωρίς κυανό «πέταγμα»). Χωρίς κοντινό
  σημείο → κυανές γραμμές. Σύγκρινε με τη ΣΧΕΔΙΑΣΗ (που ήδη κουμπώνει σωστά).
