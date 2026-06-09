# 🧠 HANDOFF — 2Δ «Move-from-Characteristic-Point» (declutter κεντρικού σημαδιού μετακίνησης) — PLAN MODE

> **Σύνταξη:** Opus 4.8, 2026-06-09. **Στόχος νέας συνεδρίας: PLAN MODE → υλοποίηση.** Καθαρό context (το προηγούμενο γέμισε με διερεύνηση + ένα λάθος συμπέρασμα που διορθώθηκε).

---

## ⚠️ ΚΑΝΟΝΕΣ (πάγιοι)
- **Ελληνικά** όλες οι απαντήσεις.
- **FULL ENTERPRISE + FULL SSOT, «όπως AutoCAD/Revit»** — μηδέν `any`/`as any`/`@ts-ignore`, αρχεία ≤500 γρ., functions ≤40 γρ.
- **Πάρε ΕΣΥ τις Revit/AutoCAD-grade αποφάσεις** + ζήτα μόνο έγκριση plan ([[feedback_make_revit_grade_decisions_yourself]]).
- **SHARED working tree** με άλλον agent (codex). `git add` **ΜΟΝΟ δικά σου** αρχεία, **ΠΟΤΕ** `git add -A`. **Επιβεβαίωνε `git status`/`git log` συχνά** — το tree αλλάζει κάτω από τα πόδια σου (συνέβη ήδη).
- **COMMIT/PUSH τα κάνει ΜΟΝΟ ο Giorgio** (N.(-1)). **ΜΗΝ adr-index**.
- **Plan Mode πρώτα** → file-level σχέδιο + έγκριση ΠΡΙΝ κώδικα. **N.17:** ΕΝΑΣ tsc τη φορά.
- **«Confirm repro before re-implementing»** ([[feedback_confirm_repro_before_reimplementing]]) — ζήτα ακριβές gesture/repro πριν γράψεις κώδικα.

---

## 0) ΤΟ ΑΙΤΗΜΑ ΤΟΥ GIORGIO (το τι θέλουμε)
Στο **2Δ**, όταν επιλέγει οντότητα (τοίχος/DXF/BIM) εμφανίζονται **4 χερούλια στις άκρες + 2 σημάδια (1 μετακίνησης, 1 περιστροφής)**. Το **κεντρικό σημάδι μετακίνησης γεμίζει την οθόνη**.

**Πρόταση Giorgio:** αντί για μόνιμο σημάδι μετακίνησης, να μετακινεί την οντότητα **πιάνοντας ένα χαρακτηριστικό σημείο** (γωνία ή **μέσο πλευράς**) **+ modifier** → μετακίνηση **ολόκληρης** της οντότητας **με βάση αυτό το σημείο** (AutoCAD «move from base point»). Έτσι φεύγει το clutter του κεντρικού σημαδιού.

---

## 1) 🔴 ΤΟ ΚΡΙΣΙΜΟ ΕΥΡΗΜΑ (γιατί η ιδέα είναι ΑΠΑΡΑΙΤΗΤΗ, όχι πλεονάζουσα)

**Λάθος που διορθώθηκε μέσα στη συνεδρία:** Νόμιζα ότι το feature «υπάρχει ήδη» μέσω του Space grip-mode cycle (Stretch→Move→Rotate→Scale→Mirror, ADR-349). **ΛΑΘΟΣ για BIM.**

**Η αλήθεια (επιβεβαιωμένη στον κώδικα):** Στο `hooks/grips/grip-commit-adapters.ts` → `commitDxfGripDragModeAware()`:
```
if (grip.wallGripKind)   { commitWallGripDrag(...); return; }   // ~γρ.133 — ΠΡΩΤΑ (παραμετρικό)
... (opening/slab/beam/column/fixture/panel/manifold/radiator/boiler/xline/ray)
if (mode === 'move')     { moveEntities(...); }                 // ~γρ.288 — ΠΟΤΕ δεν φτάνει για BIM
```
Τα παραμετρικά `*GripKind` early-returns πιάνουν **ΠΡΩΤΑ** και κάνουν `return` **πριν** τον έλεγχο `mode === 'move'`.

**Συνέπεια:** Το **Space→Move αγνοείται για ΟΛΕΣ τις BIM οντότητες** (τοίχος/κολώνα/δοκός/πλάκα/άνοιγμα/fixture/panel/manifold/radiator/boiler). Δουλεύει **μόνο για απλή DXF γεωμετρία** (γραμμές/πολυγραμμές χωρίς `*GripKind`). Γι' αυτό ο Giorgio είδε τον **τοίχο να φαρδαίνει** (το thickness/midpoint grip τρέχει `commitWallGripDrag` = πάχος, ό,τι mode κι αν δείχνει).

➡️ **Για BIM, ΔΕΝ υπάρχει σήμερα «μετακίνηση με βάση χαρακτηριστικό σημείο». Μόνο το κεντρικό σημάδι μετακινεί ολόκληρη την οντότητα.** Το κενό είναι πραγματικό· η πρόταση Giorgio το καλύπτει.

---

## 2) MODIFIER ANALYSIS (η καρδιά της απόφασης) — επιβεβαιωμένο στον κώδικα

| Modifier | Στο **2Δ** | Στο **3Δ** |
|---|---|---|
| **Ctrl/⌘** | ❌ **COPY** (MOVE→COPY, AutoCAD· ADR-363 Φ1G.4 + ADR-397· `CtrlKeyTracker` + `grip-mouse-handlers.ts:377` + `grip-parametric-copy.ts`, ΟΛΟΙ οι τύποι) | ✅ ελεύθερο → το πήραμε για 3Δ base-point (committed 466d1907) |
| **Shift** | ❌ ortho/rectilinear (`ShiftKeyTracker`) + selection-cycling Shift+Space | ❌ multi-select (`use-bim3d-pointer-handlers.ts:54`) + free-tilt στο drag |
| **Alt** | ✅ **ΕΛΕΥΘΕΡΟ** στον καμβά (μόνο `Ctrl+Alt+I` keyboard για layer isolate· κανένα Alt+mouse-drag binding) | ❌ orbit κάμερας (Alt+click pivot, Alt+drag tumble) |
| **Space** | ❌ pan tool (`toolbars/config.ts:490`) + grip-mode cycle (`useGripSpacebarCycle`) + dim type cycle | — |

**ΣΥΜΠΕΡΑΣΜΑ:** Κανένα πλήκτρο **δεν** είναι ελεύθερο **και** στις δύο όψεις (Ctrl ελεύθερο μόνο 3Δ· Alt ελεύθερο μόνο 2Δ — σταυρωτά). Ενιαίο πλήκτρο = αδύνατο χωρίς να σπάσει copy(2Δ) ή orbit(3Δ). **Δεκτό:** per-context → **Alt στο 2Δ / Ctrl στο 3Δ**. Η ΕΝΝΟΙΑ ενιαία («modifier + χαρακτηριστικό σημείο = σημείο βάσης»)· αλλάζει μόνο το πλήκτρο ανά όψη (φυσιολογικό σε CAD).

---

## 3) ΤΟ ΣΧΕΔΙΟ (πρότεινε στο Plan Mode — FULL SSOT)

**Gesture:** **Alt + σύρσιμο από χαρακτηριστικό σημείο** (γωνία/endpoint/**μέσο πλευράς**) μιας BIM οντότητας → **μετακίνηση ΟΛΟΚΛΗΡΗΣ της οντότητας** με βάση εκείνο το σημείο.

**Μηχανισμός (reuse, μηδέν νέο σύστημα):**
- Όταν Alt κρατημένο σε grip-drag → **παράκαμψε** το παραμετρικό commit (`commitWallGripDrag` κ.λπ.) και αντί αυτού κάνε **whole-entity move**: `deps.moveEntities([entityId], delta)` / `MoveEntityCommand`, με **anchor = η θέση του grip** (το χαρακτηριστικό σημείο).
- **REUSE `GripBasePointStore.overrideAnchor`** (ADR-357 Φ12) — ήδη υλοποιημένο & wired στο `grip-mouse-handlers.ts:369,390` ως «μέτρα τη μετατόπιση από επιλεγμένο σημείο βάσης» (σήμερα: δεξί-κλικ μενού «Base Point»). Εμείς το τροφοδοτούμε από το Alt+grip.
- **Bonus συνθετικότητα:** Alt (move-from-base) **+** Ctrl (copy) = «αντιγραφή με αυτό το σημείο βάσης» (AutoCAD-consistent· το copy path υπάρχει ήδη στο `grip-commit-adapters.ts:288-302`).
- **Declutter:** κρύψε το κεντρικό σημάδι μετακίνησης για BIM (το move πλέον γίνεται με Alt+σημείο).
- **Default move path (ΠΡΟΣΟΧΗ):** αν κρύψουμε το σημάδι, χρειάζεται default για όποιον δεν ξέρει το Alt. Το `useEntityDrag` (body-drag) **υπάρχει αλλά φαίνεται ΑΣΥΝΔΕΤΟ** — επιβεβαίωσε στο Plan αν θα (α) το συνδέσουμε ως body-drag default ή (β) κρατήσουμε το σημάδι πιο διακριτικό. Revit/AutoCAD = drag σώματος.
- **Discoverability glyph:** μικρό contextual «move-from-here» glyph όταν Alt+hover σε χαρακτηριστικό σημείο (mirror του 3Δ ⊙ concept).

---

## 4) ΚΛΕΙΔΙΑ-ΑΡΧΕΙΑ (επιβεβαίωσε offsets — shared tree)
- `hooks/grips/grip-commit-adapters.ts` — **`commitDxfGripDragModeAware`** (~γρ.96)· εδώ μπαίνει η Alt-bypass→move λογική (ΠΡΙΝ τα παραμετρικά returns, ή gating με Alt-flag). `mode==='move'` branch @γρ.288, copy @288-302.
- `hooks/grips/grip-mouse-handlers.ts` — FSM (`runGripMouseUp`/move @γρ.360-394)· `GripBasePointStore.overrideAnchor` @369,390· `CtrlKeyTracker` @24,377.
- `systems/grip/GripBasePointStore.ts` — **REUSE** per-drag base point (anchor override + pick-phase FSM).
- `keyboard/CtrlKeyTracker.ts` — πρότυπο tracker· χρειάζεται **αδελφός `AltKeyTracker`** (ίδιο μοτίβο) για read στο commit-time (το mouseup χάνει το native event).
- `keyboard/ShiftKeyTracker.ts` — sibling tracker (πρότυπο).
- `systems/grip/grip-mode-cycle.ts` + `hooks/grips/useGripSpacebarCycle.ts` — ο Space cycle (Stretch→Move→…)· ΜΗΝ τον αλλάξεις, απλώς να ξέρεις ότι BYPASS-άρεται για BIM.
- `hooks/useEntityDrag.ts` / `useMovementOperations.ts` — body-drag (φαίνεται ασύνδετο· επιβεβαίωσε wiring).
- `hooks/grips/useUnifiedGripInteraction.ts` — η ζωντανή ενοποιημένη grip αλληλεπίδραση (mount point για το Alt gesture / hover glyph).
- `bim/grips/centred-box-grips.ts` — το 6-grip μοντέλο (move grip[0] + rotation grip[1] + 4 corners) για rectangular BIM· εδώ ζει το «σημάδι μετακίνησης» που θέλει declutter.
- `bim/walls/wall-grips.ts` — wall grips (endpoints/midpoint/thickness)· `commitWallGripDrag` = παραμετρικό (γιατί φαρδαίνει).

---

## 5) ΤΕΣΤ
- Pure/unit: Alt-bypass → whole-entity move με anchor=grip (αντί παραμετρικό)· Alt+Ctrl → copy-with-base· override anchor feed.
- Regression: σκέτο drag γωνίας/πάχους = stretch/πάχος ΑΜΕΤΑΒΛΗΤΟ (μηδέν regression στο `commitWallGripDrag`)· Space grip-cycle ανέπαφο.
- `AltKeyTracker` test (mirror `CtrlKeyTracker`/`ShiftKeyTracker` tests).
- tsc background (N.17 — έλεγξε ότι δεν τρέχει άλλος πρώτα).
- Browser-verify με Giorgio: επίλεξε τοίχο → Alt+drag από γωνία/μέσο → ΜΕΤΑΚΙΝΕΙΤΑΙ ολόκληρος (όχι φαρδαίνει)· χωρίς Alt = stretch/πάχος ως πριν.

## 6) ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ΜΗΝ χρησιμοποιήσεις **Ctrl** (=copy) / **Space** (=pan+grip-cycle) / **Shift** (=ortho) στο 2Δ → **Alt**.
- ΜΗΝ σπάσεις το παραμετρικό stretch/πάχος (σκέτο drag) ούτε τον Space grip-cycle.
- ΜΗΝ commit/push/adr-index. ΜΗΝ `git add -A`. ΜΗΝ 2ο tsc.
- ΜΗΝ φτιάξεις νέο base-point σύστημα — **reuse `GripBasePointStore`**.

---

## 7) ΑΣΧΕΤΟ ΑΛΛΑ ΕΚΚΡΕΜΕΣ (από προηγούμενη εργασία ίδιας συνεδρίας)
- **3Δ Relocatable Base Point** = 🟢 DONE + **COMMITTED `466d1907`** (concurrent agent). **🔴 Εκκρεμεί:** browser-verify + **commit του `docs/.../ADR-408-mep-connectors-and-systems.md`** (tracked/uncommitted, N.15 doc· ο κώδικας έγινε commit χωρίς το doc). Δες [[project_adr408_gizmo_relocatable_base_point]]. **ΑΥΤΟ ΕΙΝΑΙ ΞΕΧΩΡΙΣΤΟ — μην το μπλέξεις με το 2Δ task.**

## 8) ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. Διάβασε αυτό + επιβεβαίωσε τρέχον state (`git status`/`git log`· `commitDxfGripDragModeAware` σειρά returns· `GripBasePointStore` API· `useUnifiedGripInteraction` wiring· αν `useEntityDrag` είναι live).
2. **Plan Mode** → file-level σχέδιο (gesture Alt + bypass→move + reuse GripBasePointStore + declutter + glyph + default move) + ζήτα έγκριση.
3. Μετά έγκριση → υλοποίηση + tests + (ίσως νέο ADR ή update υπάρχοντος grip ADR· ΟΧΙ adr-index) + N.15.

## 9) ΜΝΗΜΕΣ
[[project_adr408_gizmo_relocatable_base_point]] (3Δ, μόλις έγινε)· [[feedback_make_revit_grade_decisions_yourself]]· [[feedback_confirm_repro_before_reimplementing]].
