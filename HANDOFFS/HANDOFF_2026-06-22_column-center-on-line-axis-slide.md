# HANDOFF — Κολώνα: **center-on-axis** ολίσθηση ΠΑΝΩ στον άξονα γραμμής/ακμής (ΟΧΙ μόνο flush δεξιά/αριστερά)

**Ημ/νία:** 2026-06-22
**Τύπος:** Feature (column placement snap — προσθήκη center-on-axis δίπλα στο flush-to-side)
**Μοντέλο:** Opus (snap resolver + preview + commit· αλληλεπιδρά με §3.7/§3.9/§3.10b)
**⚠️ Working tree SHARED με άλλον agent** — `git add` ΜΟΝΟ δικά σου αρχεία, **ΠΟΤΕ** `git add -A`. **COMMIT ο Giorgio, ΟΧΙ εσύ** (N.(-1)).

---

## 0. ΤΟ ΑΙΤΗΜΑ (Giorgio, verbatim)
> «ΘΕΛΩ … Ο ΑΞΟΝΑΣ ΤΗΣ ΚΟΛΩΝΑΣ ΝΑ ΟΛΙΣΘΑΙΝΕΙ ΠΑΝΩ ΣΤΟΝ ΑΞΟΝΑ ΤΗΣ ΓΡΑΜΜΗΣ, ΟΧΙ ΜΟΝΟ ΔΕΞΙΑ
> ΤΗΣ ΚΑΙ ΑΡΙΣΤΕΡΑ ΤΗΣ, ΠΑΝΩ ΚΑΙ ΚΑΤΩ ΤΗΣ.»
>
> «ΘΕΛΩ ΝΑ ΤΟ ΚΑΝΕΙΣ ΟΠΩΣ ΟΙ ΜΕΓΑΛΟΙ ΠΑΙΧΤΕΣ ΟΠΩΣ Η REVIT. FULL ENTERPRISE + FULL SSOT.
> ΠΡΙΝ ΤΗΝ ΥΛΟΠΟΙΗΣΗ ΚΩΔΙΚΑ, ΚΑΝΕ ΠΡΑΓΜΑΤΙΚΟ SSOT AUDIT (GREP) ώστε να ΧΡΗΣΙΜΟΠΟΙΗΣΕΙΣ
> υπάρχοντα κώδικα και ΝΑ ΜΗΝ ΔΗΜΙΟΥΡΓΗΣΕΙΣ ΔΙΠΛΟΤΥΠΑ.»

---

## 1. ΤΟ ΖΗΤΟΥΜΕΝΟ (τι λείπει σήμερα)

Σήμερα, όταν το εργαλείο «Κολώνα» κουμπώνει σε **ακμή πλάκας** (ή παρειά μέλους), η κολώνα πάει
**flush σε μία πλευρά** της γραμμής: το σώμα της κάθεται **δεξιά/αριστερά (ή πάνω/κάτω)** της ακμής,
με μία παρειά της flush στη γραμμή. Δεν υπάρχει τρόπος να μπει η κολώνα **κεντραρισμένη ΠΑΝΩ στον
άξονα** της γραμμής (το κέντρο της κολώνας πάνω στη γραμμή), ολισθαίνοντας **κατά μήκος** της.

**Ζητούμενο (Revit-grade, nearest-reference-wins):** καθώς ο cursor κινείται **κάθετα** προς τη
γραμμή/ακμή:
- cursor **κοντά στον άξονα** (πάνω στη γραμμή) → **center-on-axis**: το **ΚΕΝΤΡΟ** της κολώνας
  πάνω στον άξονα, ολίσθηση **κατά μήκος** (slide along the line)·
- cursor **τραβηγμένος σε μία πλευρά** → **flush** σε εκείνη την πλευρά (η σημερινή συμπεριφορά).

Δηλαδή 3 ζώνες κάθετα: flush-μία-πλευρά → center-on-axis → flush-άλλη-πλευρά. **Διατήρησε** τη λοξή
περιστροφή (§3.10b): center-on-axis σε **λοξή** ακμή → κέντρο στον λοξό άξονα + κολώνα **στραμμένη**
ώστε να ευθυγραμμίζεται με τη γραμμή.

---

## 2. ✅ ΤΟ SSoT ΗΔΗ ΥΠΑΡΧΕΙ — ΜΗΝ ΦΤΙΑΞΕΙΣ ΝΕΟ (Giorgio: «μην δημιουργήσεις διπλότυπα»)

**Το «center-on-axis vs flush, nearest-reference-wins» ΥΛΟΠΟΙΕΙΤΑΙ ΗΔΗ** για **τοίχους** — §3.9
ADR-398, στο **`bim/columns/column-face-snap.ts`**:
- `resolveWallAxisCenter(cursor, FaceTarget)` — όταν ο cursor είναι πιο κοντά στον **άξονα** παρά
  σε παρειά (εσωτερική μισή ζώνη, `perp ≤ halfThickness/2`) → επιστρέφει `anchor:'center'`, foot =
  προβολή cursor στον άξονα (`projectPointOnAxis`), status `beam`, faceFrame άξονα. Αλλιώς `null`
  → ο caller πέφτει στο §3.7 **flush**.
- Χτίζεται μέσω `buildWallAxisFrame(axis, outline)` (χορδή `axis[0]→axis[last]` + perp ημι-πάχος,
  reuse `projectPolygonOnAxis`).
- Wiring: μέσα στο `resolveForTarget(cursor, t)` — `if (t.wallFrame) { const a = resolveWallAxisCenter(...); if (a) return a; }`.

**Η ΔΟΥΛΕΙΑ ΣΟΥ = ΓΕΝΙΚΕΥΣΗ αυτού στις ΑΚΜΕΣ ΠΛΑΚΑΣ** (και ιδανικά σε ΚΑΘΕ γραμμικό στόχο), μέσα
από τον **axis-relative** slab path (`resolveColumnSlabEdgeSnap`), ΟΧΙ νέο μηχανισμό.

### Γιατί δεν δουλεύει ήδη στις πλάκες
Οι ακμές πλάκας περνούν από **ξεχωριστό** path: `resolveColumnSlabEdgeSnap` (στο
`column-face-snap.ts`) → `resolveLinearMemberFaceSnap` (`bim/framing/linear-member-face-snap.ts`,
`memberWidthScene=0`). Αυτός ο resolver επιστρέφει **ΜΟΝΟ flush** (T-framing στην κοντινή όψη). Δεν
έχει center-on-axis κλάδο. (Η §3.9 `resolveWallAxisCenter` ζει στο **bbox** path — οι πλάκες ΔΕΝ
περνούν από εκεί.)

---

## 3. SSoT ΠΡΟΣ REUSE (κάνε grep ΠΡΙΝ γράψεις — εντολή Giorgio)

- `bim/columns/column-face-snap.ts` — **εδώ ζει ο column resolver**:
  - `resolveWallAxisCenter` (§3.9) — το **πρότυπο** center-on-axis (αντίγραψε τη λογική).
  - `resolveColumnSlabEdgeSnap` (§3.10/§3.10b) — ο axis-relative slab path (εδώ μπαίνει το center-on-axis).
  - `resolveColumnFaceSnapFromTargets` — ο dispatcher (slab vs bbox priority).
  - `ColumnFaceSnap` — έχει ΗΔΗ `rotation` (§3.10b) + `anchor` + `position` + `faceFrame`.
- `bim/geometry/shared/polygon-axis-projection.ts` — `projectPointOnAxis` (along+perp) + `projectPolygonOnAxis`. **ΕΝΑ SSoT projection — ΜΗΝ γράψεις νέο.**
- `bim/framing/linear-member-face-snap.ts` — `resolveLinearMemberFaceSnap` (+ `GhostFaceFrame`, `faceFrame.axisDir/perpDir/outwardSign/faceAlongMin/Max`). ⚠️ Shared με wall/beam T-framing — αν το αγγίξεις, **μην αλλάξεις** τη flush συμπεριφορά τους (κάνε column-specific κλάδο/option ή wrapper).
- `bim/framing/scene-snap-targets.ts` — `sceneSnapTargetsStore` (κοινό SSoT στόχων) + `selectGhostMembers`.

### Υποχρεωτικά grep (Giorgio):
```
grep -rn "resolveWallAxisCenter\|resolveColumnSlabEdgeSnap\|resolveColumnFaceSnapFromTargets" src/subapps/dxf-viewer
grep -rn "projectPointOnAxis\|projectPolygonOnAxis" src/subapps/dxf-viewer/bim
grep -rn "resolveLinearMemberFaceSnap\|GhostFaceFrame\|memberWidthScene" src/subapps/dxf-viewer/bim/framing
```
Σκοπός: επιβεβαίωσε ότι το center-on-axis + το projection υπάρχουν ήδη → **reuse**, μην διπλασιάσεις.

---

## 4. ΠΡΟΤΕΙΝΟΜΕΝΗ ΚΑΤΕΥΘΥΝΣΗ (επιβεβαίωσε με Plan Mode πριν κωδικοποιήσεις)

**Πρόσθεσε center-on-axis κλάδο στον axis-relative slab path** (mirror του §3.9, αλλά axis-relative):
- Στο `resolveColumnSlabEdgeSnap` (ή σε κοινό helper που reuse-άρει και η §3.9): υπολόγισε την
  **κάθετη απόσταση** του cursor από τον άξονα της ακμής (`projectPointOnAxis` → `perp`).
  - `|perp| ≤ threshold` → **center-on-axis**: `position = προβολή cursor στον άξονα`,
    `anchor:'center'`, `rotation = γωνία ακμής` (§3.10b — flush ευθυγράμμιση), slide κατά μήκος.
  - αλλιώς → υπάρχον **flush** (§3.10b: λοξή rotation + n/s-family anchor).
- **threshold (σχεδιαστική απόφαση — ρώτησε Giorgio με συγκεκριμένο αριθμητικό παράδειγμα):** η
  ακμή πλάκας έχει **μηδενικό πάχος** (band ±eps), άρα δεν υπάρχει «εσωτερική μισή ζώνη» όπως ο
  τοίχος. Λογικό threshold = **μισό πλάτος κολώνας** (cursor εντός μισής κολώνας από τη γραμμή →
  center· πέρα → flush) — Revit-like. Εναλλακτικά σταθερό capture. **Lead με αριθμητικό/οπτικό
  παράδειγμα** (ο Giorgio σκέφτεται σε γεωμετρία).
- **preview ≡ commit:** το `rotation`/`anchor:'center'`/`position` ρέουν ΗΔΗ μέσω του §3.10/§3.10b
  pipeline (`column-preview-helpers` ghost + `mouse-handler-up` → `ColumnPlacementGhostStatusStore`
  faceAnchor/faceRotation handoff + `useColumnTool` single-click). **Μηδέν νέο wiring** — μόνο ο
  resolver αλλάζει.
- **FULL SSoT στόχος:** ιδανικά ΕΝΑ «axis-center vs flush» resolver που τον μοιράζονται §3.9 (wall
  bbox) ΚΑΙ slab edge (axis-relative). Αν η ενοποίηση είναι καθαρή → κάν' την· αλλιώς reuse τη
  λογική με κοινό helper (μηδέν copy-paste της center-on-axis μαθηματικής).

---

## 5. ⚠️ ΜΗΝ ΧΑΣΕΙΣ — τι ΠΡΕΠΕΙ να διατηρηθεί
1. **§3.10b λοξή rotation** — center-on-axis σε λοξή ακμή → κέντρο στον λοξό άξονα + στραμμένη κολώνα.
2. **Flush-to-side** (η σημερινή συμπεριφορά) — μένει στις εξωτερικές ζώνες.
3. **§3.7 face-snap** σε δοκάρι/τοίχο/κολώνα + **§3.9 wall-axis** (μην το χαλάσεις — είναι το πρότυπο).
4. **§3.10 sync-in-preview** (κοινό `sceneSnapTargetsStore`· preview≡commit) + **single-click** face-snap commit.
5. **glyphs/corner-projection/place+rotate** (ελεύθερη τοποθέτηση).
6. **Wall/beam T-framing** (`resolveLinearMemberFaceSnap`) — αν το αγγίξεις, ΜΗΔΕΝ αλλαγή στη flush συμπεριφορά τους.

---

## 6. ΤΡΕΧΟΥΣΑ ΚΑΤΑΣΤΑΣΗ (baseline)
- **§3.10 (sync-in-preview unification) — COMMITTED** (Giorgio): κοινό `bim/framing/scene-snap-targets.ts`, column face-snap σύγχρονα στο preview/commit, ακμές πλάκας δουλεύουν.
- **§3.10b (λοξή ακμή rotation + single-click) — UNCOMMITTED, ✅ browser-verified από Giorgio** («ΛΕΙΤΟΥΡΓΕΙ ΤΩΡΑ»): 61 column jest GREEN, tsc clean. Ο Giorgio θα κάνει commit. **Ξεκίνα ΑΦΟΥ commit-αριστεί** (ή πάνω στο working tree).
- Λεπτομέρειες: **ADR-398 §3.7/§3.9/§3.10/§3.10b** + changelog.

---

## 7. ΚΑΝΟΝΕΣ ΕΚΤΕΛΕΣΗΣ
- **N.0.1 ADR-driven**: ενημέρωσε **ADR-398** (νέο §3.11 ή επέκταση §3.9/§3.10b) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (N.15).
- **SSoT audit (grep) ΠΡΙΝ κώδικα** (§3) — εντολή Giorgio.
- **Plan Mode** πρώτα· επιβεβαίωσε threshold (§4) με αριθμητικό παράδειγμα.
- **Shared tree**: `git add` ΜΟΝΟ δικά σου· **ΟΧΙ** commit (Giorgio).
- **N.17**: ΕΝΑ tsc τη φορά. **N.(-1.1)**: ΟΧΙ `--no-verify`. **100% ειλικρίνεια**.

## 8. DEFINITION OF DONE
- Κολώνα σε γραμμή/ακμή πλάκας: cursor πάνω στον άξονα → **κέντρο κολώνας στον άξονα**, ολίσθηση **κατά μήκος**· cursor σε πλευρά → flush (σημερινό). Ισχύει και σε **λοξές** ακμές (κέντρο + στραμμένη).
- Διατηρούνται §3.7/§3.9/§3.10/§3.10b + flush + place+rotate + glyphs (§5).
- column-face-snap jest GREEN (NEW center-on-axis-slab tests) + tsc clean + browser-verify.
- ADR-398 + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` ενημερωμένα.
