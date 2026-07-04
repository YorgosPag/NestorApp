# HANDOFF — Περιστροφή γραμμής (line): ένδειξη γωνίας/μήκους + POLAR ίχνη ΟΠΩΣ ο τοίχος

**Ημερομηνία:** 2026-07-04
**Working tree:** ΚΟΙΝΟ με άλλον agent → `git add <specific files>` μόνο, ΠΟΤΕ `-A`. **Commit/push μόνο ο Giorgio.**
**Κανόνες:** big-player (Revit/Maxon-C4D/Figma) · FULL ENTERPRISE + FULL SSOT · **SSoT audit (grep) ΠΡΙΝ κώδικα** · ΜΗΝ δημιουργήσεις διπλότυπα (αν βρεις προϋπάρχοντα → κεντρικοποίησέ τα) · ΜΗΝ τρέξεις `tsc`/typecheck (N.17· jest OK) · ADR-driven (update ADR ίδιο commit).

---

## 🎯 TASK (ζητούμενο Giorgio)

Όταν **περιστρέφω μια επιλεγμένη ΕΥΘΕΙΑ** (λαβή rotation) με ενεργό **POLAR**, θέλω να εμφανίζονται:
1. Η **ένδειξη γωνίας + μήκους** (∠θ + διάσταση), **ΑΚΡΙΒΩΣ όπως όταν περιστρέφω έναν ΤΟΙΧΟ**.
2. Οι **γραμμές/ενδείξεις POLAR** (πορτοκαλί ακτίνα + tooltip «15.0° / …»), όπως στον τοίχο.

**Σύμπτωμα (επιβεβαιωμένο με 2 screenshots του Giorgio, 2026-07-04):**
- **ΤΟΙΧΟΣ περιστροφή:** δείχνει ✅ πράσινο/κόκκινο arc + **∠γωνία + διάσταση μήκους + πάχος·ύψος** (member-HUD) + 🟠 **πορτοκαλί POLAR ακτίνα** «15.0° / 280.31 cm».
- **ΓΡΑΜΜΗ περιστροφή:** δείχνει ΜΟΝΟ 🔴 κόκκινο arc + **μπλε** AutoAlign tooltip «330.0° / 780.75 cm». **ΚΑΜΙΑ** ένδειξη γωνίας/μήκους HUD, **ΚΑΜΙΑ** πορτοκαλί POLAR ακτίνα.

**Κρίση (big-player):** ΛΑΘΟΣ/κενό parity — AutoCAD/Revit δείχνουν γωνία+polar στην περιστροφή, και ο τοίχος τα δείχνει. Η γραμμή πρέπει να έχει **parity με τον τοίχο**.

---

## 🧭 SSoT AUDIT ΠΟΥ ΗΔΗ ΕΓΙΝΕ ΑΥΤΗ ΤΗ ΣΥΝΕΔΡΙΑ (ξεκίνα από εδώ — grep για επιβεβαίωση)

### ✅ ΕΠΙΒΕΒΑΙΩΜΕΝΗ ΡΙΖΑ #1 — member-HUD κλειδωμένο σε wall/column
- **`hooks/tools/grip-ghost-preview-draw-helpers.ts` → `drawMemberGripHud` (~γρ. 358-382):**
  ```ts
  if (dp.wallGripKind && !MEMBER_HUD_SKIP.has(...) && type === 'wall') { paintWallHud(...); return; }
  if (dp.columnGripKind && ... && type === 'column') { paintColumnHud(...); }
  // ← Η ΓΡΑΜΜΗ ΔΕΝ ΠΙΑΝΕΤΑΙ ΠΟΥΘΕΝΑ → κανένα HUD γωνίας/μήκους.
  ```
  Καλείται από `useGripGhostPreview.ts` (~γρ. 405-408) για ΟΛΕΣ τις οντότητες, αλλά το εσωτερικό gate αποκλείει τη γραμμή.
- **`canvas-v2/preview-canvas/wall-hud-paint.ts` → `buildSegmentHudMeta(start, end, sceneUnits, thicknessMm=0, heightMm=0)` + `paintWallHud`:**
  Ο builder είναι **ΗΔΗ φτιαγμένος να δέχεται ΓΡΑΜΜΗ** — το σχόλιό του (γρ. 52-56) λέει ρητά «τοίχο ΚΑΙ γραμμή (0 = χωρίς BIM ταυτότητα)». Με `specLabel=''` → ζωγραφίζει **μόνο μήκος + ∠γωνία** (χωρίς πάχος/ύψος). **Άρα ΥΠΑΡΧΕΙ SSoT· απλά δεν συνδέθηκε ποτέ η γραμμή** → ΜΗΝ φτιάξεις νέο HUD, ΣΥΝΔΕΣΕ τη γραμμή.

### 🔴 DISCOVERY ITEM #2 — POLAR ακτίνα (χρειάζεται runtime probe)
- Η 🟠 πορτοκαλί POLAR ακτίνα είναι **κοινό overlay**: `hooks/tools/rotation-tracking-overlay.ts` → `paintRotationTracking` → `paintPolarTrackingLine` (`canvas-v2/preview-canvas/polar-tracking-line-paint.ts`, χρώμα `OVERLAY_LINE_COLORS.drawingGuide` = ORANGE).
- Καλείται στο **`useGripGhostPreview.ts` (~γρ. 205-215)** ΜΟΝΟ όταν `dragPreview.rotateCursorDriven && rotatePivot && effectiveCursor` → `resolveRotationTracking(pivot, effectiveCursor, scale, sceneEntities)` → ζωγραφίζει την πορτοκαλί ακτίνα ΑΝ `result.polar.isSnapped`.
- **Αυτό το μονοπάτι είναι ΚΟΙΝΟ wall/line** (μέσω `grip-dxf-drag-preview-resolver.ts` → `buildRotateReferencePreview`, ίδιο για wall & line). Το unit test `rotation-tracking-overlay.test.ts` επιβεβαιώνει: POLAR on → `isSnapped=true`.
- **Στο screenshot της γραμμής** εμφανίστηκε ΜΠΛΕ AutoAlign tooltip (άρα `resolveRotationTracking` ΕΤΡΕΞΕ, `tracking` κούμπωσε) αλλά **ΟΧΙ** πορτοκαλί (άρα `polar.isSnapped=false` στη συγκεκριμένη γωνία 330°).
- **⚠️ ΠΡΟΣ ΕΠΑΛΗΘΕΥΣΗ RUNTIME:** γιατί το `polar.isSnapped` ήταν false στη γραμμή στις 330° (πολλαπλάσιο 15°) ενώ στον τοίχο true στις 15°. Πιθανές αιτίες: (α) grip-snap OSNAP «τράβηξε» τον cursor off-increment (`mouse-handler-move.ts:184-208`), (β) `effectiveCursor` timing, (γ) polar increment ≠ 15. **ΜΗΝ μαντέψεις — βάλε προσωρινό `logger.debug` στο `resolveRotationTracking`/`resolveOrthoPolarStep` ή διάβασε το OSNAP grip-snap path, επιβεβαίωσε το πραγματικό `polarResult`.** Πιθανώς λύνεται μαζί με το #1 ή είναι ξεχωριστό μικρο-fix.

### Πλήρες pipeline περιστροφής γραμμής (για context)
- Λαβή rotation γραμμής = `line-rotation` (grip 3), SSoT `systems/line/line-grips.ts`. Είναι hot-grip `'rotate'` (`HOT_GRIP_OP_REGISTRY` στο `wall-hot-grip-fsm.ts:119`), **κοινό με τον τοίχο**.
- Preview: `grip-dxf-drag-preview-resolver.ts` (rotate branch) → `freeBaseline = resolveRotateReferenceAnchor(entity, pivot)` (το `bim/grips/rotate-reference-axis.ts` → `resolveMoveGlyphFrame`, που **ΥΠΟΣΤΗΡΙΖΕΙ line**, `move-glyph-frame.ts:96-104`) → `buildRotateReferencePreview(... 'rotate-free' ...)` θέτει `rotateCursorDriven:true`, `rotateSweepDeg`, `rotatePivot`, `anchorPos`.
- Ghost + overlays: `useGripGhostPreview.ts`:
  - 🔴 direction arc → `paintDirectionArc` (γρ. ~201, από React `dp.rotateSweepDeg` — γι' αυτό ΠΑΝΤΑ φαίνεται).
  - 🟠 polar + tracking → `resolveRotationTracking` + `paintRotationTracking` (γρ. ~159, ~208, χρειάζεται `effectiveCursor`).
  - member-HUD → `drawMemberGripHud` (γρ. ~407, gate σε wall/column — ΕΔΩ το κενό #1).

---

## 🏗️ ΠΡΟΤΕΙΝΟΜΕΝΗ ΥΛΟΠΟΙΗΣΗ (parity, μηδέν νέα μηχανή — ΕΠΙΒΕΒΑΙΩΣΕ ΜΕ PLAN MODE ΠΡΩΤΑ)

1. **Fix #1 (βέβαιο):** Στο `drawMemberGripHud` (grip-ghost-preview-draw-helpers.ts) πρόσθεσε branch για `isLineEntity(transformed)` → `buildSegmentHudMeta(line.start, line.end, sceneUnits)` (specLabel `''`) → `paintWallHud(...)`. Reuse του υπάρχοντος SSoT. Η γραμμή αποκτά ΙΔΙΑ ένδειξη γωνίας/μήκους με τον τοίχο. Πρόσεξε: για γραμμή τα `start/end` είναι top-level (όχι `params`), και το `dp` δεν έχει `wallGripKind` — άρα βγάλε το gate έξω από το wallGripKind για line (χρησιμοποίησε το `transformed` type + `lineGripKind`/index). Ισχύει και για **endpoint reshape** (grip 0/1) όχι μόνο rotation, ώστε πλήρη parity.
2. **Fix #2 (μετά από runtime probe):** Επιβεβαίωσε γιατί το `polar.isSnapped` δεν πιάνει στην περιστροφή γραμμής· διόρθωσε ώστε η πορτοκαλί POLAR ακτίνα να εμφανίζεται όπως στον τοίχο. Πιθανό αίτιο: OSNAP grip-snap off-increment — έλεγξε αν πρέπει να παρακαμφθεί το grip-snap για rotation ή να τροφοδοτηθεί ο raw cursor στο `resolveRotationTracking`.
3. **ADR:** update ADR-508 (§wall-hud → §line-hud) + ADR-397 (rotation overlays) στο ίδιο commit.

**Big-player check:** Revit/AutoCAD δείχνουν angle+distance readout + polar/angle tracking στην περιστροφή. Η parity είναι σωστή. Αν κάτι δεν προτείνεται από αυτούς → ακολούθησε την πρακτική τους.

---

## ⚠️ ΠΡΟΣΟΧΗ — uncommitted από ΠΡΟΗΓΟΥΜΕΝΟ task (ΜΗΝ τα πειράξεις· θα τα commit-άρει ο Giorgio)

Στην ίδια συνεδρία ολοκληρώθηκε ΑΛΛΟ task (line grip-drag → κεντρικοποιημένα ίχνη ευθυγράμμισης). **Uncommitted αρχεία (μη τα αγγίξεις εκτός αν χρειαστεί για ΤΟ ΝΕΟ task):**
- `systems/cursor/GripAlignmentTrackingStore.ts` (νέο), `DimAlignmentTrackingStore.ts` (διαγραφή)
- `systems/cursor/GripDragStore.ts`, `hooks/grips/grip-mouse-handlers.ts`
- `systems/cursor/mouse-handler-move.ts`, `mouse-handler-up.ts`
- `hooks/tools/useGripGhostPreview.ts`, `grip-ghost-preview-draw-helpers.ts`
- `hooks/dimensions/dim-alignment-tracking.ts`, `useDimGripGhostPreview.ts`, `hooks/tools/useMovePreview.ts`
- `systems/line/line-grips.ts` (+`__tests__/line-grips.test.ts`), ADR-363
Επίσης προϋπάρχοντα 9 αρχεία από παλαιότερη συνεδρία (crosshair/snap). **ΟΛΑ commit ο Giorgio.**

Το **Fix #1** αγγίζει `grip-ghost-preview-draw-helpers.ts` + `useGripGhostPreview.ts` — αρχεία που ΗΔΗ έχουν uncommitted αλλαγές. Κάνε **surgical edits** μόνο στα δικά σου σημεία.

---

## 🚫 ΜΗΝ ΚΑΝΕΙΣ
- ΜΗΝ commit/push. ΜΗΝ `git add -A`. ΜΗΝ `git restore`/`reset --hard`. ΜΗΝ αγγίξεις αρχεία άλλου agent.
- ΜΗΝ φτιάξεις νέο HUD/polar μηχανισμό — reuse `buildSegmentHudMeta`/`paintWallHud` + `paintRotationTracking`.
- ΜΗΝ τρέξεις `tsc`/typecheck (jest OK).
- ΜΗΝ μαντέψεις το Fix #2 — runtime probe πρώτα.
