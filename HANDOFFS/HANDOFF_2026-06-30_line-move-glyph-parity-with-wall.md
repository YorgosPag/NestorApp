# HANDOFF — Σημάδι ΜΕΤΑΚΙΝΗΣΗΣ (MOVE cross) στη ΓΡΑΜΜΗ (parity με τον τοίχο)

| | |
|---|---|
| **Ημερομηνία** | 2026-06-30 |
| **Status** | 🟡 ΝΕΟ ΘΕΜΑ — preliminary audit έγινε· ΚΑΜΙΑ υλοποίηση ακόμη |
| **Domain** | DXF Viewer 2D / grips / move glyph (ADR-397 Φ2) |
| **Working tree** | ⚠️ SHARED με άλλον agent — touch ΜΟΝΟ ό,τι χρειάζεται, μηδέν `git add -A` |
| **Commit** | ❌ ΠΟΤΕ από agent — ο **Giorgio** κάνει commit/push (N.-1). ❌ ΠΟΤΕ `--no-verify`. |
| **tsc** | ❌ ΠΟΤΕ (N.17) — μόνο jest |
| **Μοντέλο** | Opus (cross-cutting grip pipeline) |

---

## 🎯 ΤΟ ΖΗΤΟΥΜΕΝΟ (Giorgio)

Όταν **επιλέγω μια ΓΡΑΜΜΗ**, θέλω να εμφανίζεται το **σημάδι μετακίνησης** (MOVE — σταυρός 4
βελών) **ανάμεσα στο ΑΡΙΣΤΕΡΟ άκρο και στο ΚΕΝΤΡΟ** της γραμμής (δηλ. ¼ μήκους προς τα δυτικά).

**ΑΚΡΙΒΩΣ η ίδια συμπεριφορά** με το σημάδι μετακίνησης που εμφανίζει ο **ΤΟΙΧΟΣ** όταν τον
επιλέγω: κάθε **σκέλος του σταυρού** έχει **δική του συμπεριφορά**, και όταν πατάς ένα σκέλος
**ανοίγει πεδίο πληκτρολόγησης** (μετακίνηση κατά τυπωμένη απόσταση στον αντίστοιχο τοπικό άξονα).

> **FULL SSoT:** το σημάδι μετακίνησης + η λειτουργικότητα του ΤΟΙΧΟΥ και της ΓΡΑΜΜΗΣ πρέπει να
> έχουν **μία και μοναδική πηγή αλήθειας**. Big-player level (Revit / Maxon-Cinema4D / Figma).
> Αν οι μεγάλοι δεν προτείνουν enterprise pattern → ακολούθα την πρακτική των μεγάλων.

---

## 🔍 PRELIMINARY SSoT AUDIT (ΕΓΙΝΕ με grep — ΕΠΙΒΕΒΑΙΩΣΕ το, ΜΗΝ ξεκινήσεις από μηδέν)

**Η μηχανή του MOVE glyph + του directional click→prompt ΥΠΑΡΧΕΙ ΗΔΗ (ADR-397 Φ2)** και τη
χρησιμοποιεί ο τοίχος (`wall-midpoint`) + κολόνα/δοκός/πεδίλο/placeable. Το ζητούμενο = **reuse**,
ΟΧΙ νέα μηχανή. Κάθε οντότητα προσθέτει μόνο: 1 grip + 1 «δείκτη» (grip kind) + 1 entry σε 2 registries.

### Η μηχανή (SSoT — reuse ως έχει)
| Αρχείο | Ρόλος |
|---|---|
| `bim/grips/grip-glyph-registry.ts` | `'wall-midpoint': 'move'` → 4-arrow glyph. **ADD `'line-move': 'move'`.** |
| `hooks/grips/wall-hot-grip-fsm.ts` | `HOT_GRIP_OP_REGISTRY['wall-midpoint']='move'` (3-click move) + `hotGripKindOf`. **ADD `'line-move':'move'` + `?? grip.lineGripKind` ΗΔΗ υπάρχει.** |
| `bim/grips/move-glyph-frame.ts` | **🔴 ΤΟ ΒΑΣΙΚΟ ΚΕΝΟ:** `resolveMoveGlyphFrame(entity)` επιστρέφει `null` για **plain DXF line** (διαβάζει `entity.params`· η γραμμή ΔΕΝ έχει params — έχει top-level `start`/`end`). Πρέπει να επεκταθεί ώστε να διαβάζει top-level `start`/`end` της γραμμής → `fromAxis(end−start)` (η λογική ΥΠΑΡΧΕΙ ήδη, μόνο το input-read λείπει). Χωρίς αυτό: ΟΧΙ glyph rotation, ΟΧΙ directional axes. |
| `bim/grips/move-glyph-zones.ts` + `move-glyph-zone-store.ts` | `resolveMoveGlyphZoneForGrip` — ποιο σκέλος του σταυρού (±X/±Y/centre disc) είναι κάτω από τον κέρσορα → directional drag/prompt. **Entity-agnostic, reuse.** |
| `hooks/grips/grip-mouse-handlers.ts` (~γρ.200-248, ADR-397 Φ2) | «MOVE glyph: a click on a directional ARM (not the centre disc) opens a distance prompt and translates the entity along that local axis». **Entity-agnostic routing — reuse.** ΙΧΝΕΥΣΕ ΤΟ ΟΛΟΚΛΗΡΟ (κανόνας «trace full pipeline»). |
| `hooks/grips/grip-registry.ts` (~γρ.188-201) | Προσαρτά `moveGlyphFrame` + `moveGlyphMmScale` σε κάθε move grip **όταν** `resolveMoveGlyphFrame(entity)≠null` **ΚΑΙ** `hotGripOpForKind(hotGripKindOf(wrapped))==='move'`. Και τα δύο πρέπει να ισχύουν για τη γραμμή. `moveGlyphMmScale = mmScaleFor(params)` → η γραμμή δεν έχει params· **έλεγξε τι scale θέλει** (DXF native units· πιθανώς `mmScaleFor({})`=default). |
| `commitWholeEntityMove` (`grip-commit-adapters.ts`) | Το whole-entity move (mode 'move' / movesEntity) → `deps.moveEntities` → MoveEntityCommand. Η γραμμή **ΗΔΗ** μετακινείται ολόκληρη (το υπάρχον midpoint grip 2 είναι `movesEntity:true`). Το «μετακίνηση» ΛΕΙΤΟΥΡΓΕΙ· λείπει το GLYPH + η directional-by-value + η θέση ¼-west. |

### Ο ΤΟΙΧΟΣ (reference) — τι κάνει
- `bim/walls/wall-grips.ts` `getWallGrips`: εκπέμπει `wall-midpoint` grip **στο ΚΕΝΤΡΟ** (`axisMidpoint`),
  `type:'center'`, `movesEntity:true`, `wallGripKind:'wall-midpoint'` → glyph 'move' + hot-grip 'move' + directional.
- ⚠️ **ΔΙΑΦΟΡΑ ΘΕΣΗΣ:** ο τοίχος έχει το MOVE **στο κέντρο**· ο Giorgio θέλει τη γραμμή **¼-west**
  (ανάμεσα αριστερό άκρο↔κέντρο). Η **κοινή πηγή αλήθειας = GLYPH + ΛΕΙΤΟΥΡΓΙΚΟΤΗΤΑ** (directional
  click→prompt), **ΟΧΙ η θέση** (η θέση είναι entity-specific, όπως ακριβώς στο rotation: τοίχος &
  γραμμή = axis-quarter-EAST κοινό, αλλά move: τοίχος=κέντρο, γραμμή=¼-west). Μην μπερδέψεις «κοινή
  μηχανή» με «κοινή θέση».

### Η ΓΡΑΜΜΗ σήμερα (UNCOMMITTED — από την προηγούμενη συνεδρία, Slice G.4)
- **SSoT των line grips ΥΠΑΡΧΕΙ ΗΔΗ:** `systems/line/line-grips.ts` `getLineGrips(id,start,end)` →
  4 grips: 0 start, 1 end, 2 midpoint-MOVE (κέντρο, `movesEntity:true`, edge, **χωρίς kind/glyph**),
  3 rotation (¼-east, `lineGripKind:'line-rotation'`). **Το καλούν ΚΑΙ** `computeDxfEntityGrips` (case
  'line') **ΚΑΙ** `LineRenderer.getGrips` (map → render GripInfo + `shape: gripGlyphShape(lineGripKind)`).
  → **Εδώ προστίθεται το `line-move` grip.**
- `hooks/grip-kinds.ts`: `LineGripKind = 'line-rotation'` → **επέκτεινε σε `'line-rotation' | 'line-move'`.**
- Θέση ¼-east SSoT: `bim/grips/axis-box-grips.ts` `axisQuarterRotationHandleWorld(frame)`. Για το move
  στο **¼-west** → reuse `rotationHandleAxialEastSign` **negated** (ή sibling `axisQuarterMoveHandleWorld`
  = `rectLocalWorld(frame, −sign·halfWidth/2, 0)`). Μην ξαναγράψεις τον τύπο — μία πηγή.

---

## ❓ ΠΡΙΝ ΤΟΝ ΚΩΔΙΚΑ — concrete example στον Giorgio (lead-with-example, ΥΠΟΧΡΕΩΤΙΚΟ)

Δώσε ASCII/νούμερα ΚΑΙ ρώτα 2-3 ναι/όχι ΠΡΙΝ υλοποιήσεις. Π.χ. γραμμή start(0,0)→end(100,0), L=100:
```
 start(0,0)      ✛ move(25,0)      κέντρο(50,0)     ⟳ rot(75,0)        end(100,0)
   ●────────────────╋──────────────────·──────────────────◓──────────────────●
 endpoint     MOVE σταυρός        (κέντρο)         rotation handle        endpoint
 (grip 0)    (¼ δυτικά, ΝΕΟ)                       (¼ ανατολικά, υπάρχει)  (grip 1)
             κάθε σκέλος → πεδίο
             πληκτρολόγησης (όπως τοίχος)
```
Επιβεβαίωσε: (α) θέση move = **¼ δυτικά** (συμμετρικό του rotation ¼-east); (β) το υπάρχον
midpoint-MOVE grip στο **κέντρο** (grip 2) → **το αντικαθιστά** το move-cross του ¼-west, ή το κέντρο
**μένει** ως απλό σημείο/OSNAP; (γ) κάθε σκέλος → πεδίο πληκτρολόγησης **ίδιο ακριβώς** με τον τοίχο.

---

## ✅ ΑΠΑΙΤΗΣΕΙΣ (εντολή Giorgio)
1. **Big-player level** (Revit / Maxon-Cinema4D / Figma). FULL ENTERPRISE + FULL SSoT. Αν οι μεγάλοι
   δεν προτείνουν enterprise pattern → ακολούθα την πρακτική των μεγάλων.
2. **ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ τον κώδικα** — reuse τη μηχανή MOVE glyph + directional
   (ADR-397 Φ2): `move-glyph-frame` / `move-glyph-zones` / `grip-mouse-handlers` Φ2 / `grip-registry` /
   `grip-glyph-registry` / `hot-grip-fsm` / `commitWholeEntityMove`. **ΜΗΝ** φτιάξεις 2ο μηχανισμό
   move/glyph/directional. Το σημάδι move τοίχου & γραμμής = **μία πηγή αλήθειας**.
3. **Lead with concrete example** (ASCII/νούμερα + 2-3 ναι/όχι) ΠΡΙΝ υλοποιήσεις.
4. **Ίδια ΑΚΡΙΒΩΣ συμπεριφορά με τον τοίχο** (4-arrow glyph + per-arm directional click→distance prompt).
5. **Απαντάς ΠΑΝΤΑ στα Ελληνικά.**
6. **N.17:** ❌ ΠΟΤΕ tsc/typecheck. ✅ jest (στοχευμένα).
7. **N.-1:** ❌ commit/push μόνο ο Giorgio. ❌ `--no-verify`.
8. **Shared tree** με άλλον agent → touch ΜΟΝΟ τα απαραίτητα, μηδέν `git add -A`.
9. **ADR-driven (N.0.1):** code = source of truth. Ενημέρωσε **ADR-363 (Slice G.5 — line move glyph)**.
   **Stage ADR-040** αν αγγίξεις canvas/grip renderer leaf (CHECK 6B/6D — `LineRenderer`/`grip-computation`).
10. **SSoT ΠΡΟΣΟΧΗ (μάθημα Slice G.4):** Δύο grip paths — interaction (`computeDxfEntityGrips`) ΚΑΙ
    2D-paint (`LineRenderer.getGrips`). **ΚΑΙ ΤΑ ΔΥΟ** περνούν από `getLineGrips` → πρόσθεσε το move grip
    ΜΟΝΟ εκεί. Μην ξαναγράψεις rotation/move math — τα `applyAxisBoxGripDrag` / `commitWholeEntityMove`
    είναι ο engine.

## 📂 ΑΡΧΕΙΑ-ΚΛΕΙΔΙΑ (ξεκίνα από εδώ)
- `systems/line/line-grips.ts` (`getLineGrips` — εδώ μπαίνει το `line-move` grip ¼-west)
- `hooks/grip-kinds.ts` (`LineGripKind` → add `'line-move'`)
- `bim/grips/move-glyph-frame.ts` (🔴 `resolveMoveGlyphFrame` — επέκταση για plain DXF line top-level start/end)
- `bim/grips/grip-glyph-registry.ts` (add `'line-move':'move'`)
- `hooks/grips/wall-hot-grip-fsm.ts` (`HOT_GRIP_OP_REGISTRY` add `'line-move':'move'`)
- `bim/grips/axis-box-grips.ts` (`axisQuarterRotationHandleWorld` — sibling για ¼-west move θέση)
- `hooks/grips/grip-registry.ts` · `bim/grips/move-glyph-zones.ts` · `hooks/grips/grip-mouse-handlers.ts`
  (ADR-397 Φ2 directional pipeline — ΙΧΝΕΥΣΕ το ΟΛΟΚΛΗΡΟ)
- `rendering/entities/LineRenderer.ts` (`getGrips` — το glyph βγαίνει αυτόματα μέσω `getLineGrips`·
  ΕΛΕΓΞΕ αν χρειάζεται `withMoveGlyphRotation` ώστε ο σταυρός να γυρίζει με τη γραμμή)
- `bim/walls/wall-grips.ts` (~γρ.138-142 — το reference του `wall-midpoint`)

## ✅ DEFINITION OF DONE
1. Concrete example + 2-3 ναι/όχι στον Giorgio ΠΡΙΝ τον κώδικα.
2. Επιλογή γραμμής → εμφανίζεται MOVE σταυρός ¼-west, **ίδιο glyph** με τον τοίχο (γυρίζει με τη γραμμή).
3. Κλικ σε σκέλος → πεδίο πληκτρολόγησης → μετακινεί τη γραμμή κατά τον τοπικό άξονα, **ίδιο ακριβώς**
   με τον τοίχο (preview≡commit, reuse SSoT).
4. jest GREEN· ADR-363 Slice G.5 ενημερωμένο + changelog.
5. ❌ commit/push από Giorgio.

---

## 📌 UNCOMMITTED ΔΟΥΛΕΙΑ ΣΤΟ ΙΔΙΟ WORKING TREE (μην τη χαλάσεις)
- **Slice G.4 — Λαβή ΠΕΡΙΣΤΡΟΦΗΣ γραμμής (μόλις ολοκληρώθηκε, jest GREEN, εκκρεμεί browser-verify+commit):**
  `systems/line/line-grips.ts` (NEW SSoT) + `LineGripKind` + forwarding σε grip-types/unified-grip-types/
  grip-registry/DxfGripDragPreview/EntityPreviewTransform/hotGripKindOf + `apply-entity-preview` branch +
  `commitLineGripDrag` (grip-linear-commits) + `axisQuarterRotationHandleWorld` (axis-box) + `LineRenderer`
  κεντρικοποίηση (κάλεσε `getLineGrips`) + ADR-363 Slice G.4. **Το move χτίζει ΠΑΝΩ σ' αυτό** (ίδιο `getLineGrips`).
- **Slice G.3 — wall rotation axis-quarter** (committed) + stale wall-grips #27 (ενημερώθηκε).
- **Άλλος agent:** Radial Command Ring γραμμής + Dyn toggle fix + `wall-preview-helpers`/`bim-cursor-snap`/
  `line-preview-helpers` (ADR-508/513). **Μην τα αγγίξεις.**
