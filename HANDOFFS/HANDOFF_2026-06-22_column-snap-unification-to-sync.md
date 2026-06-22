# HANDOFF — Ενοποίηση Column placement-snap σε **sync-in-preview** (όπως τοίχος/δοκάρι)

**Ημ/νία:** 2026-06-22
**Τύπος:** Architectural refactor (SSoT unification — μία snap pipeline για όλα τα εργαλεία τοποθέτησης)
**Μοντέλο:** Opus (cross-cutting· column snap subsystem + scheduler + stores + preview + commit)
**⚠️ Working tree SHARED με άλλον agent** — `git add` ΜΟΝΟ δικά σου αρχεία, **ΠΟΤΕ** `git add -A`. **COMMIT ο Giorgio, ΟΧΙ εσύ** (N.(-1)).

---

## 0. ΤΟ ΑΙΤΗΜΑ (Giorgio, ισχυρό)
> «ΘΕΛΩ ΝΑ ΤΟ ΚΑΝΕΙΣ ΟΠΩΣ ΟΙ ΜΕΓΑΛΟΙ ΠΑΙΧΤΕΣ ΟΠΩΣ Η REVIT. FULL ENTERPRISE + FULL SSOT.
> ΠΡΙΝ ΤΗΝ ΥΛΟΠΟΙΗΣΗ ΚΩΔΙΚΑ, ΚΑΝΕ ΠΡΑΓΜΑΤΙΚΟ SSOT AUDIT (GREP) ώστε να ΧΡΗΣΙΜΟΠΟΙΗΣΕΙΣ
> υπάρχοντα κώδικα και ΝΑ ΜΗΝ ΔΗΜΙΟΥΡΓΗΣΕΙΣ ΔΙΠΛΟΤΥΠΑ.»

---

## 1. ΤΟ ΠΡΟΒΛΗΜΑ (γιατί υπάρχει αυτό το task)

Δύο εργαλεία τοποθέτησης με **θεμελιωδώς διαφορετική αρχιτεκτονική face-snap** = anti-pattern (η Revit/Google ΔΕΝ θα το δεχόταν). Αυτή η διάσπαση είναι η αιτία που **κάθε νέος στόχος** (π.χ. ακμές πλάκας) δουλεύει αμέσως σε τοίχο/δοκάρι αλλά απαιτεί ξεχωριστό μπάλωμα στην κολώνα.

### Τοίχος / Δοκάρι = **SYNC μέσα στο preview** (μία πηγή αλήθειας)
- `hooks/drawing/wall-preview-helpers.ts` → `makeWallGhostBeforeClick` καλεί **σύγχρονα**
  `resolveMemberGhostSnapFromStore(cursor, …)` → `resolveLinearMemberFaceSnap(cursor, memberTargets, opts)`.
- Το αποτέλεσμα (`{start, end, faceFrame}`) οδηγεί ΚΑΤΕΥΘΕΙΑΝ το ghost + τα listening dims.
- Ίδιο: `hooks/drawing/beam-preview-helpers.ts` → `makeBeamGhostBeforeClick`.

### Κολώνα = **ASYNC scheduler + 3 stores** (διασπασμένη αλήθεια)
- `systems/cursor/snap-scheduler.ts:167` `runSnapDetection` → `resolveColumnFaceSnapWithGlyph` →
  `applyColumnFaceSnap` (γρ. 133-137) → γράφει σε **3 stores**:
  `setColumnGhostStatus` / `setColumnFaceAnchor` / `setColumnFaceFrame` + `setImmediateSnap(position)`.
- `hooks/drawing/column-preview-helpers.ts` → `generateColumnPreview` **ΔΙΑΒΑΖΕΙ** τα stores:
  `getImmediateSnap()` (θέση) + `getColumnFaceAnchor()` + `getColumnGhostStatus()` + `getColumnFaceFrame()`.
- Το **commit** (`systems/cursor/mouse-handler-up.ts:230`) ΞΑΝΑ-υπολογίζει `resolveColumnFaceSnapWithGlyph`
  και κάνει `setColumnFaceAnchor` (γρ. 239) → preview ≡ commit μέσω stores.

**Συνέπεια:** ο column snap υπολογίζεται σε **2 σημεία** (scheduler + mouse-up) και διαβάζεται σε **3ο**
(preview), αντί για **ΕΝΑ** σημείο όπως τοίχος/δοκάρι.

---

## 2. Ο ΣΤΟΧΟΣ
**ΜΙΑ** snap pipeline για ΟΛΑ τα placement tools. Η κολώνα να υπολογίζει το face-snap της
**σύγχρονα στο preview** (ίδιο pattern με τοίχο/δοκάρι), ώστε:
- Κάθε στόχος (τοίχος/δοκάρι/κολώνα/**ακμή πλάκας**/μελλοντικοί) να δουλεύει **αυτόματα παντού**.
- Να εξαφανιστεί **ολόκληρη η κατηγορία** bugs «δουλεύει στο Α, όχι στο Β».
- **preview ≡ commit** να ισχύει εξ ορισμού (ένας υπολογισμός).

---

## 3. ⚠️ ΜΗΝ ΧΑΣΕΙΣ — τι ΠΡΕΠΕΙ να διατηρηθεί (η κολώνα έχει ΠΕΡΙΣΣΟΤΕΡΑ snap features)
Η ενοποίηση **δεν** είναι «σβήσε το async» — η κολώνα έχει νόμιμα extra που ο τοίχος/δοκάρι δεν έχουν.
Πρέπει να επιβιώσουν, ιδανικά μέσω των ΙΔΙΩΝ SSoT:
1. **Glyph snapping** (ορατές έλξεις «Γωνία/Μέσο/Κέντρο τοίχου/δοκαριού») — `resolveColumnFaceSnapWithGlyph`
   (`bim/columns/column-placement-snap-context.ts`), `glyphSnap` → `publishSnapMarker`.
2. **Corner-projection** (γωνία would-be κολώνας κουμπώνει σε διακριτό στόχο) — `resolveColumnDrawSnap`
   + `findColumnDrawCornerSnap`.
3. **9-position anchor flush** (auto λαβή ανά παρειά×ζώνη) — `column-face-snap.ts` anchors.
4. **§3.9 wall-axis center snap** (κολώνα κέντρο ≡ άξονας τοίχου εσωτερικά).
5. **Place + rotate (2-click)** — `ColumnRotationStore` + `useColumnTool` awaitingRotation + η ΠΟΡΤΟΚΑΛΙ
   γραμμή στρέψης (`drawing-hover-handler` → `drawPolarTrackingLine`). **Δουλεύει ΗΔΗ — μην το χαλάσεις.**
6. **preview ≡ commit** — όπου κι αν μπει ο sync υπολογισμός, πρέπει το click (`mouse-handler-up`)
   να χρησιμοποιεί ΤΟ ΙΔΙΟ αποτέλεσμα.

---

## 4. SSoT ΠΡΟΣ REUSE (κάνε grep ΠΡΙΝ γράψεις — εντολή Giorgio)
- `bim/framing/linear-member-face-snap.ts` — `resolveLinearMemberFaceSnap` + `GhostFaceFrame`
  (axis-relative, δουλεύει σε ΚΑΘΕ προσανατολισμό).
- `bim/framing/member-ghost-snap.ts` — `resolveMemberGhostSnapFromStore` (dispatcher: column-priority + members).
- `bim/framing/member-snap-targets.ts` — `collectMemberSnapTargets` (+ `slabEdgeTargets`, διαβάζει
  **`geometry.polygon`** για πλάκες — βλ. §6).
- `bim/columns/column-face-snap.ts` — `resolveColumnFaceSnap` (bbox + το slab patch §6) + `ColumnFaceSnap.faceFrame`.
- `bim/columns/column-rotation.ts` — `resolveColumnRotationDeg` (place+rotate).
- `hooks/drawing/wysiwyg-preview-shared.ts` — `resolveGhostFaceDimensionsMeta` + `toWysiwygPreviewEntity`
  (το ΚΟΙΝΟ dims + ghost-flag SSoT που ήδη χρησιμοποιούν και τα 3).
- **Pattern προς αντιγραφή:** `makeWallGhostBeforeClick` / `makeBeamGhostBeforeClick` (sync snap στο preview).

### Υποχρεωτικά grep (Giorgio):
```
grep -rn "resolveColumnFaceSnapWithGlyph\|resolveColumnFaceSnap\b\|resolveColumnDrawSnap" src/subapps/dxf-viewer
grep -rn "getColumnFaceAnchor\|getColumnGhostStatus\|getColumnFaceFrame\|setColumn" src/subapps/dxf-viewer
grep -rn "generateColumnPreview\|commitColumnFromState\|commitColumnAt\|onCanvasClick" src/subapps/dxf-viewer/hooks/drawing/useColumnTool.ts
grep -rn "applyColumnFaceSnap\|runSnapDetection\|findColumnDrawCornerSnap" src/subapps/dxf-viewer/systems/cursor
```
Σκοπός: χαρτογράφησε ΟΛΟΥΣ τους readers/writers των 3 column stores ΠΡΙΝ αποφασίσεις τι μετακινείς.

---

## 5. ΠΡΟΤΕΙΝΟΜΕΝΗ ΚΑΤΕΥΘΥΝΣΗ (επιβεβαίωσε με Plan Mode πριν κωδικοποιήσεις)
**Μετακίνησε τον ΥΠΟΛΟΓΙΣΜΟ του column face-snap σε ΕΝΑ sync σημείο** (όπως ο τοίχος):
- Ο `generateColumnPreview` να καλεί **σύγχρονα** τον resolver (mirror `makeWallGhostBeforeClick`),
  παράγοντας position + anchor + faceFrame + status + glyph σε ΕΝΑ object — αντί να διαβάζει 3 stores.
- Το **commit** (`mouse-handler-up` / `useColumnTool`) να καλεί ΤΟΝ ΙΔΙΟ resolver με το ίδιο σημείο.
- Ο **scheduler** να κρατήσει ΜΟΝΟ ό,τι είναι genuinely async/display (π.χ. publish των ορατών glyphs/markers
  στο `SnapIndicatorOverlay`), ΟΧΙ τον πυρήνα της απόφασης.
- Τα 3 stores (`ColumnPlacementGhostStatusStore`) → ιδανικά καταργούνται ή συρρικνώνονται σε καθαρό
  «display-only» (αν χρειάζεται ο scheduler για glyphs).

**ΠΡΟΣΟΧΗ (ρίσκο regression):** ο τοίχος/δοκάρι στην κολώνα ΗΔΗ δουλεύει μέσω bbox· η ενοποίηση αλλάζει
τον column snap σε τοίχους/δοκάρια ΚΑΙ κολώνες. Χρειάζεται **column-face-snap tests ως δίχτυ** + browser-verify
σε ΟΛΑ: κολώνα→κολώνα, κολώνα→δοκάρι, κολώνα→τοίχο (παρειά + §3.9 άξονας), κολώνα→ακμή πλάκας, glyphs, place+rotate.

---

## 6. ΤΡΕΧΟΥΣΑ ΚΑΤΑΣΤΑΣΗ (UNCOMMITTED στο working tree — ο Giorgio θα κάνει commit)
Όλα tsc-clean + jest GREEN στην προηγούμενη συνεδρία:
- **Listening dimensions** σε wall/beam/column (κοινό `resolveGhostFaceDimensionsMeta` + `drawGhostFaceDimensions`).
- **Overlay SSoT**: `overlay-line-style.ts` (0.5px dashed [8,5] + 3 χρώματα: ίχνη=γκρι `#CCCCCC`,
  drawing-guide=πορτοκαλί `#FF9800`, dims=σιελ `#29B6F6`) + `overlay-text-style.ts` (Verdana 11px, χωρίς φόντο).
- **Body-overlap κόκκινο**: `isMemberCollinearOverlap` +`newHalfScene` + NEW `resolveStatusGhostOutline`
  (footprint polygon για κάθε ghost — wall outerEdge+innerEdge, column/beam outline.vertices).
- **Slab edges**: `slabEdgeTargets` (διαβάζει **`geometry.polygon.vertices`**, ΟΧΙ `params.outline` — αυτό ήταν
  το root bug «δεν δούλευε πλάκα πουθενά») + `'slab'` kind στο `collectMemberSnapTargets`.
  Wall/beam: `memberKinds` += `'slab'`. **Δουλεύει σε τοίχο/δοκάρι** ✅.
- **Column place+rotate (2-click)**: `ColumnRotationStore` + `useColumnTool` awaitingRotation + `column-rotation.ts`
  (`resolveColumnRotationDeg` zoom-adaptive βήμα) + πορτοκαλί γραμμή/γωνία στο `drawing-hover-handler`. **Δουλεύει** ✅.
- **Column slab patch** (ΜΠΑΛΩΜΑ — η ενοποίηση πρέπει να το ΑΝΤΙΚΑΤΑΣΤΗΣΕΙ): `column-face-snap.ts`
  `resolveColumnSlabEdgeSnap` (πέρασα τις ακμές πλάκας μέσα από `resolveLinearMemberFaceSnap` με `memberWidthScene=0`).
  **ΔΕΝ δουλεύει στον browser** — ακριβώς λόγω της async αρχιτεκτονικής. Αυτό το task το λύνει σωστά.

### 🔴 ΤΟ ΕΝΑΠΟΜΕΙΝΑΝ BUG που λύνει αυτό το handoff
Η **κολώνα στις ακμές πλάκας** ΔΕΝ συμπεριφέρεται όπως ο τοίχος/δοκάρι (που δουλεύουν). Ρίζα = η async
αρχιτεκτονική (όχι ο resolver). Fix = §2/§5 ενοποίηση.

---

## 7. ΚΑΝΟΝΕΣ ΕΚΤΕΛΕΣΗΣ
- **N.0.1 ADR-driven**: βρες/ενημέρωσε το σχετικό ADR (ADR-398 column placement / ADR-508 unified framing).
- **SSoT audit (grep) ΠΡΙΝ κώδικα** (§4) — εντολή Giorgio.
- **Plan Mode** πρώτα (cross-cutting· επιβεβαίωσε την κατεύθυνση §5 πριν κωδικοποιήσεις).
- **Shared tree**: `git add` ΜΟΝΟ δικά σου· **ΟΧΙ** commit (Giorgio).
- **N.17**: ΕΝΑ tsc τη φορά (έλεγξε για running tsc άλλου agent πριν ξεκινήσεις).
- **N.(-1.1)**: ΟΧΙ `--no-verify`.
- **100% ειλικρίνεια**: αν η ενοποίηση απειλεί regression που δεν μπορείς να επαληθεύσεις → ανέφερε, μη το κρύψεις.

## 8. DEFINITION OF DONE
- Η κολώνα υπολογίζει το face-snap **σύγχρονα** (μία πηγή), ίδιο pattern με τοίχο/δοκάρι.
- Ακμές πλάκας: κολώνα συμπεριφέρεται **ταυτόσημα** με τοίχο/δοκάρι (κάθετο T-framing + dims + place+rotate).
- Διατηρούνται: glyphs, corner-projection, 9-anchor, §3.9, place+rotate, preview ≡ commit.
- column-face-snap jest GREEN (καμία regression) + tsc clean + browser-verify ΟΛΩΝ των σεναρίων §5.
- ADR ενημερωμένο + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (N.15).
