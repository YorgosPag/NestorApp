# HANDOFF — Περιστροφή POLYLINE / ΤΕΤΡΑΓΩΝΟΥ: ίδιος κώδικας με τη ΓΡΑΜΜΗ (ghost + βέλη + ίχνη)

**Ημ/νία:** 2026-07-04 · **Subapp:** `src/subapps/dxf-viewer/`
**⚠️ SHARED TREE** (ενεργός άλλος agent — color-conversion ADR-573 κ.ά.). `git add <specific>` ΜΟΝΟ, ΠΟΤΕ bulk reset/restore.
**Commit → ΜΟΝΟ Giorgio.** jest μόνο (ΟΧΙ tsc, N.17). ΟΧΙ `any`/`as any`/`@ts-ignore`. Plan Mode πριν την υλοποίηση.

---

## 🎯 ΘΕΜΑ
Στη **ΓΡΑΜΜΗ** (plain DXF `line`), όταν επιλέγεται, εμφανίζονται λαβές + **σταυρός μετακίνησης** + **σημάδι
περιστροφής**. Η ροή περιστροφής της γραμμής (Revit/AutoCAD ROTATE) είναι:

1. Πατάω το **σημάδι περιστροφής** → γίνεται **κόκκινο** (hot).
2. Το σύστημα **αναμένει να ορίσω κέντρο περιστροφής**.
3. Μόλις **ορίζω κέντρο**, **αμέσως** εμφανίζεται το **φάντασμα (ghost)** της γραμμής που θα περιστραφεί
   (η γραμμή περιστρέφεται άκαμπτα γύρω από το κέντρο — «ομοαξονική με το κέντρο περιστροφής»).
4. Μόλις **μετακινώ τον κέρσορα** → εμφανίζονται:
   - τα **κόκκινα/πράσινα βέλη** με τις **μοίρες περιστροφής** (🟢 +CCW / 🔴 −CW),
   - τα **ίχνη ευθυγράμμισης (AutoAlign)**,
   - τα **ίχνη ευθυγράμμισης POLAR**.

**ΖΗΤΟΥΜΕΝΟ (Giorgio):** να συμβαίνει το **ΙΔΙΟ ΑΚΡΙΒΩΣ** στο **ΠΟΛΥΓΩΝΟ / ΤΕΤΡΑΓΩΝΟ** (`polyline` — το
scene `rectangle`/`rect` μετατρέπεται σε closed 4-vertex `polyline` στο DXF pipeline, οπότε καλύπτεται από
το ίδιο path). **«Θέλω τον ίδιο ακριβώς κώδικα που χρησιμοποιείται στη γραμμή κατά την περιστροφή να τον
ενσωματώσεις και στο τετράγωνο.»**

**Ειδική απαίτηση τετραγώνου (verify in browser):** «αν πατήσω στις ακριανές λαβές, πάντοτε η βοηθητική
γραμμή που δημιουργείται (ο βραχίονας αναφοράς 0°) να είναι **ομοαξονική με τις πλευρές του τετραγώνου**.»
→ δηλαδή ο reference άξονας της περιστροφής να ευθυγραμμίζεται με πλευρά του ορθογωνίου, όχι σε τυχαία φορά.

---

## 🧭 CONTEXT — ΤΟ TEMPLATE ΕΙΝΑΙ ΕΤΟΙΜΟ (μόλις έγινε για το ΤΟΞΟ, ίδια οικογένεια bug)
Στην προηγούμενη συνεδρία (2026-07-04) διορθώθηκε **ΑΚΡΙΒΩΣ το ίδιο κενό για το τόξο** (ADR-561 changelog
2026-07-04, «arc rotation LIVE GHOST fix»). Το **polyline/τετράγωνο έχει τα ΙΔΙΑ 3 κενά** (confirmed grep):

- Το **commit** της περιστροφής polyline **ΔΟΥΛΕΥΕΙ** ήδη (`commitPolylineRotationGripDrag` →
  `RotateEntityCommand`, rectangle → explode-to-polyline). **Μόνο το preview ghost λείπει.**
- Το hot-grip FSM αναγνωρίζει ήδη `polyline-rotation` → `'rotate'` op (`HOT_GRIP_OP_REGISTRY`,
  `wall-hot-grip-fsm.ts`) + `hotGripKindOf` περιλαμβάνει `polylineGripKind`. Άρα η ροή «πάτα handle →
  όρισε κέντρο → rotate-free» **ξεκινά ήδη**· απλώς το σχήμα δεν φαίνεται να περιστρέφεται.
- **Τα κόκκινα/πράσινα βέλη + POLAR/AutoAlign ίχνη είναι ΗΔΗ GENERIC** στο `useGripGhostPreview.draw`
  (`paintDirectionArc` gate: `dp.rotatePivot && dp.anchorPos && dp.rotateReadoutAnchor && rotateSweepDeg!==undefined`·
  `resolveRotationTracking`/`paintRotationTracking` gate: `rotateCursorDriven && rotatePivot`). Δεν είναι
  kind-specific → **θα εμφανιστούν ΜΟΝΑ ΤΟΥΣ** μόλις μπει η γεωμετρία του ghost (όπως ακριβώς έγινε στο τόξο).

**⇒ Η δουλειά = καθαρή αναπαραγωγή του arc fix, για polyline.** Τα βέλη/ίχνη δεν χρειάζονται νέο κώδικα.

---

## 🔍 SSoT AUDIT — τα 3+1 κενά (grep-confirmed) & τα σημεία fix
Mirror του line-rotation / arc-rotation path:

1. **`systems/polyline/polyline-grips.ts`** — υπάρχει `getPolylineMoveRotateGrips` + `POLYLINE_ROTATION_KIND`
   αλλά **ΛΕΙΠΕΙ** το `applyPolylineRotationDrag`. → Πρόσθεσε pure SSoT (mirror `applyLineRotationDrag` /
   `applyArcRotationDrag`): swept angle με το **ΙΔΙΟ** `sweptAngleDegAboutPivot` (`bim/grips/grip-math`) +
   `rotatePoint` (`utils/rotation-math`) σε **κάθε vertex** → preview ≡ commit (το commit κάνει το ίδιο μέσω
   `rotateEntity` polyline case, που γυρίζει όλα τα vertices). Επιστροφή `null` σε degenerate/zero sweep.
2. **`rendering/ghost/entity-preview-types.ts`** — `EntityPreviewTransform` **ΔΕΝ** έχει `polylineGripKind`.
   → Πρόσθεσε `readonly polylineGripKind?: PolylineGripKind;` (import από `hooks/grip-types`).
3. **`hooks/tools/grip-drag-preview-transform.ts`** (`toEntityPreviewTransform`) — **ΔΕΝ** προωθεί
   `polylineGripKind`. → Πρόσθεσε 1 γραμμή pass-through (όπως `arcGripKind`).
4. **`hooks/grips/grip-projections.ts`** (`buildRotateReferencePreview`) — **ΔΕΝ** προωθεί `polylineGripKind`.
   → Forward (όπως `lineGripKind` / `arcGripKind`). ⚠️ Χωρίς αυτό, το ghost δεν παίρνει το discriminator
   στη rotate ροή.
5. **`rendering/ghost/apply-entity-preview.ts`** — **ΔΕΝ** έχει polyline-rotation branch. → Πρόσθεσε branch
   `if (polylineGripKind === 'polyline-rotation' && anchorPos && entity.type === 'polyline')` →
   `applyPolylineRotationDrag({ vertices, anchor: anchorPos, currentPos: anchorPos+delta, pivot: rotatePivot })`
   → `{ ...entity, vertices: rotated }`. Destructure `polylineGripKind` στη γραμμή 107. (Το `rectangle`/`rect`
   δεν φτάνει εδώ ως τέτοιο — έχει ήδη γίνει polyline στο pipeline· επιβεβαίωσέ το.)

**Ειδική απαίτηση τετραγώνου (βήμα 6, μετά το ghost):** ο reference βραχίονας 0° να είναι ομοαξονικός με
πλευρά του ορθογωνίου. Δες πώς ορίζεται το `anchorPos`/`freeBaseline`/`rotateRefLine` στη rotate-free ροή
(`buildRotateReferencePreview` + hot-grip FSM `wall-hot-grip-fsm.ts`). Πιθανώς αρκεί να τεθεί ο αρχικός
reference άξονας κατά μήκος μιας πλευράς (rect-box oriented frame — βλ. `rectangle-detect.ts` +
`getPolylineMoveRotateGrips` oriented placement). **Verify με screenshot πριν κλειδώσεις σχεδίαση.**

### Reference — τι έκανε το arc fix (αντίγραψέ το μοτίβο 1:1)
- `systems/arc/arc-grips.ts` → `applyArcRotationDrag` (thin adapter, μηδέν νέα math).
- `rendering/ghost/entity-preview-types.ts` → `+arcGripKind`.
- `hooks/tools/grip-drag-preview-transform.ts` → pass-through `arcGripKind`.
- `hooks/grips/grip-projections.ts` (`buildRotateReferencePreview`) → forward `arcGripKind`.
- `rendering/ghost/apply-entity-preview.ts` → arc-rotation branch.
- tests: `systems/arc/__tests__/arc-grips.test.ts` (parity vs `rotateEntity`).

### Κρίσιμα SSoT (κοινά, ΜΗΝ φτιάξεις διπλότυπα)
- Swept angle: `sweptAngleDegAboutPivot(pivot, anchor, current)` — `bim/grips/grip-math.ts`.
- Rotate point: `rotatePoint(point, pivot, deg)` + `rotateEntity(entity, pivot, deg)` — `utils/rotation-math.ts`
  (polyline case γυρίζει όλα τα vertices — αυτό μιμείται το preview).
- Red/green arc: `paintDirectionArc` — `canvas-v2/preview-canvas/direction-arc-paint.ts` (ήδη generic).
- POLAR+AutoAlign traces: `resolveRotationTracking` + `paintRotationTracking` — `hooks/tools/rotation-tracking-overlay.ts` (ήδη generic).
- Hot-grip FSM: `hooks/grips/wall-hot-grip-fsm.ts` (`HOT_GRIP_OP_REGISTRY`, `hotGripKindOf`).

---

## ⚙️ ΟΔΗΓΙΕΣ (Giorgio)
1. **Big-player πρακτική** (Revit / Maxon Cinema 4D / Figma-level). Full **ENTERPRISE + full SSoT**· αν οι
   μεγάλοι παίκτες δεν προτείνουν κάτι, ακολούθησε τη δική τους πρακτική.
2. **ΠΡΑΓΜΑΤΙΚΟ SSoT audit (grep) ΠΡΙΝ κώδικα** — reuse υπάρχοντα SSoT, **ΜΗΝ** διπλότυπα. Προϋπάρχον
   διπλότυπο (που δεν το έφτιαξες εσύ) → κεντρικοποίησέ το κι αυτό.
3. **Plan Mode** πριν την υλοποίηση (≥5 αρχεία, 2 domains: grips + ghost).
4. **jest μόνο**, ΟΧΙ tsc. ΟΧΙ `any`. **Commit ΜΟΝΟ Giorgio.** Shared tree → `git add <specific>` +
   verify `git diff --cached` (external broad `git add` από τον άλλο agent παρατηρήθηκε).
5. **Screenshot-driven verify** (ο Giorgio οδηγεί το app· εσύ δεν μπορείς). Ζήτα 1 rotation στο τετράγωνο +
   1 screenshot για επιβεβαίωση (ghost + βέλη + ίχνη + coaxial reference).

## 📦 ΚΑΤΑΣΤΑΣΗ GIT (πριν ξεκινήσεις)
- HEAD τη στιγμή του handoff: `cbd26f5f` (color-conversion ADR-573).
- ⚠️ Το arc-rotation + move-clearance work της προηγούμενης συνεδρίας ήταν **UNCOMMITTED** (commit: Giorgio).
  Επιβεβαίωσε με `git log`/`git status` ότι έγιναν commit πριν ξεκινήσεις — τα αρχεία επικαλύπτονται
  (`entity-preview-types.ts`, `grip-drag-preview-transform.ts`, `grip-projections.ts`, `apply-entity-preview.ts`).
- Pre-existing test failure (ΟΧΙ δικό σου): `apply-entity-preview-text.test.ts` (mtext width 800 vs 860).

## 🧪 Tests
- NEW `applyPolylineRotationDrag` test (parity vs `rotateEntity` polyline case· degenerate → null·
  rectangle 4-vertex rotate 90°). Mirror `arc-grips.test.ts`.

## 📝 ADR
- Update **ADR-561** changelog (polyline/rectangle rotation LIVE ghost — mirror arc entry 2026-07-04).
