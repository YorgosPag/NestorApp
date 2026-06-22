# HANDOFF — Κολώνα: ΧΑΘΗΚΕ το 2-click place+rotate (single-click παντού μέσα σε περιοχή) — REGRESSION

**Ημ/νία:** 2026-06-22
**Τύπος:** Bugfix regression (FSM 1ου/2ου κλικ κολώνας) — FULL ENTERPRISE + FULL SSoT, Revit-grade
**Μοντέλο:** Opus (1 domain snap/FSM· πιθανό 2-3 αρχεία)
**⚠️ Working tree SHARED με άλλον agent** — `git add` ΜΟΝΟ δικά σου αρχεία, **ΠΟΤΕ** `git add -A`. **COMMIT ο Giorgio, ΟΧΙ εσύ** (N.(-1)).
**Γλώσσα:** απαντάς ΠΑΝΤΑ στα Ελληνικά.

---

## 0. ΣΥΜΠΤΩΜΑ (Giorgio, verbatim)

> «Για ποιον λόγο, μετά από το πρώτο κλικ τοποθετείται αμέσως η κολώνα και χάθηκε το δεύτερο κλικ που
> όριζα την περιστροφή όπως συμβαίνει με τον τοίχο. Λειτουργούσε πριν. Αλλά δεν γνωρίζω πότε ακριβώς
> χάλασε αυτό το pipeline.»

- **Τοίχος:** 2 κλικ (1ο=θέση, 2ο=γωνία) → ΟΚ, λειτουργεί.
- **Κολώνα (ΕΛΕΥΘΕΡΗ τοποθέτηση):** ΕΠΡΕΠΕ 2 κλικ (mirror τοίχου, ADR-508 §column place+rotate)· ΤΩΡΑ commit-άρει στο 1ο κλικ → χάθηκε η γωνία.

---

## 1. 🎯 ΡΙΖΑ (εντοπισμένη — επιβεβαίωσέ την με τα grep του §2)

**`hooks/drawing/useColumnTool.ts` ~γρ. 322-342** (FSM `awaitingPosition`):
```ts
if (s.phase === 'awaitingPosition') {
  const faceAnchor = getColumnFaceAnchor();
  // ADR-398 §3.10b — face-snapped → single-click commit ΑΠΕΥΘΕΙΑΣ:
  if (faceAnchor !== null) {
    return commitColumnAt(s, point, faceAnchor, getColumnFaceRotation() ?? 0);  // ← ΕΔΩ χάνεται το 2ο κλικ
  }
  ...
  setColumnRotationLock(point, anchor);              // 2-click rotation (μόνο όταν faceAnchor===null)
  setState({ ...s, phase: 'awaitingRotation' });
}
```

**Μηχανισμός:** το `faceAnchor` τίθεται από το `systems/cursor/mouse-handler-up.ts` (~γρ. 232-236):
`setColumnFaceAnchor(faceSnap.anchor)` **όποτε** ο `resolveColumnFaceSnapFromTargets` επιστρέφει non-null.

**Γιατί χάλασε (hypothesis, υψηλή βεβαιότητα):** οι ΝΕΟΙ κλάδοι **§3.13 Polar Magnet** (`diskTargets`) +
**§3.15 Cartesian Magnet** (`rectTargets`) στο `bim/columns/column-face-snap.ts` επιστρέφουν snap (anchor
`center`, status `beam`) για **ΟΛΟ το εσωτερικό** δίσκου/ορθογωνίου — όχι μόνο για flush σε **ακμή**. Άρα
μόλις ο cursor είναι μέσα σε οποιαδήποτε πλάκα/κύκλο/ορθογώνιο → `faceAnchor !== null` → **single-click
commit παντού** → το 2-click place+rotate παρακάμπτεται.

Το §3.10b single-click ήταν **σκόπιμο ΜΟΝΟ για flush σε ακμή** (η κολώνα είναι ΗΔΗ ευθυγραμμισμένη, η γωνία
ορίζεται από την ακμή). Για **center/region** snap η γωνία είναι ΕΛΕΥΘΕΡΗ → πρέπει να μείνει 2-click.

⚠️ **100% ειλικρίνεια:** ΜΠΟΡΕΙ να συνεισέφερε και νωρίτερα το §3.9/§3.11 (wall-axis center / slab-edge
center → anchor `center` + single-click). Επιβεβαίωσε με git ιστορικό / browser σε ΠΟΙΕΣ περιπτώσεις
έσπασε (μόνο μέσα σε δίσκο/ορθογώνιο; ή και σε άξονα τοίχου/ακμή πλάκας;). Αυτό ορίζει το εύρος του fix.

---

## 2. SSoT AUDIT — ΥΠΟΧΡΕΩΤΙΚΟ grep ΠΡΙΝ ΚΩΔΙΚΑ (εντολή Giorgio — reuse, μην διπλασιάσεις)

```
# Το FSM 1ου/2ου κλικ + το single-click gate
grep -n "awaitingPosition\|awaitingRotation\|faceAnchor\|getColumnFaceAnchor\|commitColumnAt\|setColumnRotationLock" src/subapps/dxf-viewer/hooks/drawing/useColumnTool.ts
# Πού τίθεται το faceAnchor + το status/rotation handoff
grep -rn "setColumnFaceAnchor\|setColumnGhostStatus\|setColumnFaceRotation\|getColumnFaceRotation" src/subapps/dxf-viewer/systems/cursor/mouse-handler-up.ts src/subapps/dxf-viewer/systems/cursor/ColumnPlacementGhostStatusStore.ts
# Ο resolver + ΤΟ ColumnFaceSnap interface (εδώ ίσως μπει το «aligned» flag)
grep -n "interface ColumnFaceSnap\|resolveColumnFaceSnapFromTargets\|resolveRectHit\|resolvePolarDiskHit\|anchor: 'center'" src/subapps/dxf-viewer/bim/columns/column-face-snap.ts
# Σύγκριση με τον ΤΟΙΧΟ (2-click που ΛΕΙΤΟΥΡΓΕΙ) — μην το σπάσεις, ίσως δανειστείς pattern
grep -rn "awaitingRotation\|RotationLock\|2-click\|place+rotate" src/subapps/dxf-viewer/hooks/drawing/useWallTool.ts src/subapps/dxf-viewer/hooks/drawing/use-wall-commit.ts
# Rotation stores (μην φτιάξεις νέο)
grep -rn "ColumnRotationStore\|setColumnRotationLock\|resolveColumnRotationDeg" src/subapps/dxf-viewer/systems/cursor src/subapps/dxf-viewer/bim/columns
```

**Επιβεβαιωμένα SSoT (μην ξαναγράψεις):** `ColumnRotationStore` (place+rotate lock), `resolveColumnRotationDeg`
(γωνία από origin→cursor), `ColumnPlacementGhostStatusStore` (faceAnchor/status/faceRotation handoff),
`ColumnFaceSnap` interface (`bim/columns/column-face-snap.ts`), `commitColumnAt` (ENA commit path).

---

## 3. 🔧 ΚΑΤΕΥΘΥΝΣΗ FIX (Revit-grade, FULL SSoT — κλείδωσε με Giorgio αν αμφιβάλλεις)

**Αρχή (Revit):** single-click commit ΜΟΝΟ όταν η τοποθέτηση είναι **πλήρως καθορισμένη** (flush σε ακμή →
γωνία γνωστή). Όταν η **γωνία είναι ελεύθερη** (center/region/polar/cartesian snap) → **2-click** (1ο=θέση
κλειδώνει, 2ο=γωνία), ΑΚΡΙΒΩΣ όπως ο τοίχος.

**Προτεινόμενο (SSoT, μηδέν νέο store):** πρόσθεσε σημασιολογία **`aligned: boolean`** στο `ColumnFaceSnap`:
- `aligned = true` → flush σε **ακμή/παρειά** (§3.7 face-attach, §3.10b λοξή ακμή): η γωνία ορίζεται από την
  ακμή → **single-click** (σημερινή συμπεριφορά, μηδέν regression).
- `aligned = false` → **center-on-axis (§3.9/§3.11)** + **polar (§3.13)** + **cartesian (§3.15)**: η γωνία
  είναι ΕΛΕΥΘΕΡΗ → **2-click place+rotate** (`setColumnRotationLock`, ίδιο με τοίχο).

Στο `useColumnTool` το gate γίνεται: `if (faceAnchor !== null && faceSnap.aligned) single-click· else 2-click`.
Το `aligned` πρέπει να «ταξιδέψει» από τον resolver → `ColumnPlacementGhostStatusStore` (δίπλα στο faceAnchor)
→ `useColumnTool` (όπως ήδη ταξιδεύει το faceRotation). **Reuse το υπάρχον handoff store, μην φτιάξεις νέο.**

**Set `aligned` ανά κλάδο στο `column-face-snap.ts`:** face-attach (`resolveForTarget` flush) → `true`·
center-on-axis (`resolveMemberAxisCenter`, `buildEdgeCenterSnap`) + `resolvePolarDiskHit` + `resolveRectHit`
→ `false`. (Επιβεβαίωσε με Giorgio: θέλει 2-click ΚΑΙ στο center-on-axis τοίχου/πλάκας, ή ΜΟΝΟ σε polar/rect;
— πιθανό αριθμητικό/σεναριακό ερώτημα πριν τον κώδικα.)

⚠️ **Εναλλακτική (ρώτα Giorgio):** ίσως θέλει 2-click ΠΑΝΤΑ για κολώνα (όπως τοίχος), και το §3.10b
single-click να αφαιρεθεί τελείως. Κλείδωσε τη συμπεριφορά ΠΡΙΝ τον κώδικα.

---

## 4. ΑΡΧΕΙΑ ΠΟΥ ΘΑ ΑΓΓΙΞΕΙΣ (όλα UNCOMMITTED — shared tree)
- `bim/columns/column-face-snap.ts` ⚠️ **SHARED (§3.11 agent)** — `ColumnFaceSnap` + `aligned` ανά κλάδο.
- `systems/cursor/ColumnPlacementGhostStatusStore.ts` — carry `aligned` (δίπλα στο faceAnchor/faceRotation).
- `systems/cursor/mouse-handler-up.ts` — `setColumnFaceAligned(faceSnap.aligned)`.
- `hooks/drawing/column-preview-helpers.ts` — (αν χρειαστεί) ghost δεν αλλάζει, μόνο το commit gate.
- `hooks/drawing/useColumnTool.ts` — το gate `faceAnchor && aligned`.
- jest: `bim/columns/__tests__/column-face-snap.test.ts` (aligned ανά κλάδο) + FSM test αν υπάρχει.

---

## 5. ⚠️ ΜΗΝ ΣΠΑΣΕΙΣ
1. **Τοίχος 2-click** — ΑΜΕΤΑΒΛΗΤΟ (είναι το reference που ΛΕΙΤΟΥΡΓΕΙ).
2. **§3.7 face-attach single-click** σε flush ακμή — να ΜΕΙΝΕΙ single-click (aligned=true).
3. **§3.13 Polar + §3.15 Cartesian snap geometry** — ΑΜΕΤΑΒΛΗΤΑ (browser-verified από Giorgio το §3.13)·
   αλλάζεις ΜΟΝΟ το αν προκαλούν single vs 2-click, ΟΧΙ τη θέση/πλέγμα/dims.
4. preview ≡ commit (ΕΝΑΣ resolver). ADR-040: μηδέν νέο subscription.

---

## 6. ΚΑΝΟΝΕΣ ΕΚΤΕΛΕΣΗΣ
- **SSoT audit (grep) ΠΡΙΝ κώδικα** (§2) — εντολή Giorgio. Reuse `ColumnRotationStore`/`resolveColumnRotationDeg`/
  handoff store· **ΜΗΝ φτιάξεις νέο store/flag μηχανισμό** — επέκτεινε το υπάρχον `ColumnPlacementGhostStatusStore`.
- **ΜΗΝ δημιουργήσεις νέα διπλότυπα** (Giorgio zero-tolerance).
- **Plan Mode** αν αγγίξεις 3+ αρχεία· κλείδωσε με Giorgio τη συμπεριφορά (§3 ερωτήματα) πριν τον κώδικα.
- **N.17:** ΕΝΑΣ tsc τη φορά (έλεγξε process πριν). **N.(-1.1):** ΟΧΙ `--no-verify`.
- **Shared tree:** `git add` ΜΟΝΟ δικά σου· `column-face-snap.ts` = §3.11 agent → stage μόνο δικές σου γραμμές.
  **COMMIT ο Giorgio.** ⚠️ CHECK 6D (mouse-handler-up) → stage ADR-040 + ADR-398.
- jest δίχτυ + browser-verify [κολώνα ΕΛΕΥΘΕΡΗ μέσα σε πλάκα/κύκλο/ορθογώνιο → 2 κλικ (θέση→γωνία)· flush σε
  ακμή → single-click· τοίχος αμετάβλητος].

## 7. ΔΕΥΤΕΡΕΥΟΝΤΑ ΕΚΚΡΕΜΗ (ίδιο feature tree, ΜΕΤΑ το regression fix)
- 🔴 **browser-verify §3.15** Cartesian Magnet (impl+15 jest+tsc clean· ΔΕΝ το έχει δει ο Giorgio).
- 🔵 **§3.16 interaction** (auto-grid fill: wheel `gridOverride` + rename `ColumnPolarStore`→`ColumnSmartPlaceStore`
  + ghost-set + one-click ολο-το-πλέγμα via `appendEntitiesToScene`)· pure core (`rect-grid-fill.ts`) έτοιμο.
- 🔵 **§3.14 interaction** (disk symmetry: ghost-set + wheel + ring-commit)· detector έτοιμος.
- ⚠️ **`useColumnTool` 450/500 γρ.** — αν το fix το ξεπεράσει → split (N.7.1).
- ⚠️ commit `e2e4dbac` (παράλληλος agent) έδεσε §3.13 core με slab-slope — ενημέρωσε Giorgio αν επηρεάζει.
- Plan §3.15/§3.16: `~/.claude/plans/agile-splashing-kite.md`. ADR: `ADR-398-column-placement-snap.md` §3.7-§3.16.

## 8. DEFINITION OF DONE
- Κολώνα ΕΛΕΥΘΕΡΗ τοποθέτηση (μέσα σε πλάκα/κύκλο/ορθογώνιο/ή κενό) → **2 κλικ** (1ο θέση, 2ο γωνία), ίδια με τοίχο.
- Flush σε **ακμή** (§3.7/§3.10b) → **single-click** (αμετάβλητο).
- Τοίχος + §3.13/§3.15 geometry αμετάβλητα. jest GREEN + tsc clean + browser-verify. ADR-398 changelog + tracker. **Commit: Giorgio.**
