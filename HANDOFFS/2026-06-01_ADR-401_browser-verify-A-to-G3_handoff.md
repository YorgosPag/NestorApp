# HANDOFF — ADR-401 Attach-to-Structural · BROWSER VERIFY (A → G.3)

- **Ημερομηνία**: 2026-06-01
- **Συντάκτης**: Claude (Opus 4.8)
- **Για**: ΝΕΑ συνεδρία (καθαρό context) — **browser verification + bugfix**, ΟΧΙ νέα feature.
- **Σκοπός**: Ο ADR-401 (αυτόματο/χειροκίνητο «κόλλημα» κορυφής/βάσης τοίχου/κολώνας/σκάλας σε δοκάρι/πλάκα/στέγη) είναι **code-complete A→G.3**. Μένει μόνο **οπτική επαλήθευση στον browser** + διόρθωση όποιου bug βρεθεί.
- **⚠️ COMMIT/PUSH**: ΤΑ ΚΑΝΕΙ Ο GIORGIO. Ο agent ΔΕΝ κάνει commit/push. Stage **μόνο** τα αρχεία που θα διορθώσει (multi-agent tree).
- **🎯 Μοντέλο (N.14)**: Ξεκίνα **Haiku/Sonnet** (καθοδήγηση δοκιμών + μικρά fixes). Switch σε **Opus** ΜΟΝΟ αν βρεθεί σύνθετο bug (geometry/pipeline cross-cutting).

---

## 0. ΠΡΩΤΟ ΒΗΜΑ
1. `git log --oneline -8` — επιβεβαίωσε ότι υπάρχει το **G.3 commit `6e7fed9d`** («ADR-401 Phase G.3 stair attach-to-structural UX»). Αν ο Giorgio έκανε ήδη push/άλλα commits, ΜΗΝ υποθέσεις.
2. **🚨 Multi-agent**: στο working tree τρέχει **άλλος agent (ADR-404 tilt / ADR-402 rotation)** — αρχεία `bim-3d/gizmo/bim-gizmo-{overlay,controller,drag-bridge}.ts`, `bim3d-edit-interaction-handlers.ts`, `bim3d-preview-rebuild.ts`, `bim3d-tilt-bridge.ts`, ADR-404 docs. **ΜΗΝ τα αγγίξεις/σταδιάρεις.** Αν χρειαστεί να διορθώσεις κάτι σε κοινό αρχείο (π.χ. `bim-gizmo-overlay.ts`), stage **μόνο το δικό σου hunk** (backup→edit-mine-only→add→restore, όπως έγινε στο G.3).
3. Άνοιξε την εφαρμογή: `https://nestor-app.vercel.app` (ή local dev) → DXF Viewer → φόρτωσε/φτιάξε κάτοψη με BIM στοιχεία → πήγαινε **3Δ** για τα grip tests.

---

## 1. ΤΙ ΝΑ ΕΠΑΛΗΘΕΥΣΕΙΣ (ανά υποσύστημα)

> Σε ΟΛΑ: δοκίμασε **τοίχο, κολώνα, ΚΑΙ σκάλα** (τα 3 μοιράζονται το ίδιο SSoT).

### A. Auto-attach (όταν δημιουργείς host)
- **Σενάριο**: Έχε έναν τοίχο/κολώνα/σκάλα με κορυφή σε `storey-ceiling` (default τοίχου/κολώνας) ή βάση σε `storey-floor`. **Σχεδίασε ΕΝΑ δοκάρι ή πλάκα ΑΠΟ ΠΑΝΩ** (που να καλύπτει το στοιχείο σε κάτοψη).
- **Αναμενόμενο**: το στοιχείο **αυτόματα κολλάει** την κορυφή του στο δοκάρι/πλάκα (ψηλώνει/χαμηλώνει ώστε να φτάσει την κάτω-παρειά). Toast «auto-attached». **Undo** → ξεκολλάει (το στοιχείο μένει, το host μένει).
- **Σκάλα ειδικά**: η κορυφή φτάνει το host **αλλάζοντας ΠΛΗΘΟΣ σκαλοπατιών** (ίσα risers, Revit). ⚠️ Η σκάλα default top = `unconnected`, οπότε για top auto-attach πρέπει το `topBinding` να είναι `storey-ceiling` (βάση auto-attach δουλεύει με default).
- **Z-gate**: πλάκα-**πάτωμα από κάτω** ΔΕΝ πρέπει να κολλάει την κορυφή (μόνο ταβάνι/δοκάρι από πάνω).

### B. Ribbon manual attach/detach (pick-host)
- Επίλεξε στοιχείο → contextual ribbon tab → panel **«Σύνδεση δομικού»** → κουμπί **«Σύνδεση Κορυφής/Βάσης»** → ο κέρσορας μπαίνει σε pick mode (prompt hint) → **κλικ σε δοκάρι/πλάκα** → κολλάει. Toast «attached».
- Κουμπί **«Αποσύνδεση Κορυφής/Βάσης»** → επιστρέφει στο default (τοίχος/κολώνα→`storey-ceiling`/`storey-floor`, **σκάλα top→`unconnected`**). Toast «detached».
- **ESC** κατά το pick → ακυρώνει.

### C. Edit-break (Revit «edit breaks attach»)
- Με στοιχείο **attached**, άλλαξε χειροκίνητα από το ribbon: τοίχος/κολώνα → `height`/`baseOffset`· **σκάλα → `rise` ή `stepCount`**.
- **Αναμενόμενο**: το attach **σπάει** (binding → default) και η ρητή τιμή νικά. Ένα undo επαναφέρει και τα δύο.

### D. 3Δ top/base grip (κάθετα octahedra)
- Σε 3Δ, επίλεξε στοιχείο → εμφανίζονται **δύο κάθετα πράσινα octahedra** (πάνω=κορυφή, κάτω=βάση).
- Τοίχος/κολώνα: πάνω→`height`, κάτω→`baseOffset` (κορυφή σταθερή).
- **Σκάλα**: πάνω→μεγαλώνει το `totalRise` αλλάζοντας **πλήθος σκαλοπατιών** (ίσα risers)· κάτω→ανεβάζει τη βάση & μικραίνει το `totalRise` (re-step).
- **Detach-on-drag**: αν το στοιχείο ήταν attached, το σύρσιμο **το ξεκολλάει πρώτα**.

### E. Geometry/BOQ συνέπεια (από προηγούμενες φάσεις, εκκρεμούσαν verify)
- Attached στοιχείο **κάτω από ΚΕΚΛΙΜΕΝΗ στέγη/δοκάρι** → η κορυφή/βάση ακολουθεί **κεκλιμένη** παρειά (όχι επίπεδη).
- ETICS θερμοπρόσοψη + BOQ ποσότητες αντανακλούν το resolved ύψος.

---

## 2. DEBUGGING MAP (πού ζει κάθε συμπεριφορά — για γρήγορο fix)

| Συμπτωμα | Αρχείο-κλειδί |
|---|---|
| Auto-attach δεν πυροδοτείται | `hooks/useStructuralAutoAttach.ts` + `bim/{walls,columns,stairs}/*-structural-attach-coordinator.ts` |
| Ribbon κουμπί δεν κάνει τίποτα | `ui/ribbon/data/contextual-{wall,column,stair}-tab.ts` + bridge (`useRibbon*Bridge` / `use-ribbon-stair-bridge.ts`) + routing `ui/ribbon/hooks/useRibbonCommands.ts` |
| Pick-host δεν βρίσκει host | `hooks/tools/useWallAttachTool.ts` + `bim/walls/wall-attach-pick.ts` |
| Edit-break δεν σπάει | `bim/entities/entity-attach-detach.ts` (wall/col) · `bim/stairs/stair-attach-detach.ts` (stair) · dispatchParams στα bridges |
| 3Δ grip δεν εμφανίζεται/δουλεύει | `bim-3d/gizmo/bim-gizmo-overlay.ts` (`RESIZE_HANDLES_BY_TYPE`) ⚠️κοινό· `bim3d-resize-bridge.ts` (`compute*ResizeParams`)· `bim3d-edit-interaction-handlers.ts` ⚠️κοινό |
| Σκάλα: λάθος re-step ύψους | `bim/geometry/stair-vertical-profile.ts` (`snapTotalRiseToWholeSteps`) + `stairs/stair-effective-params.ts` |
| 3Δ geometry attached λάθος | `bim-3d/scene/BimSceneLayer.ts` (`syncWalls/syncColumns/syncStairs`) |
| BOQ λάθος ποσότητα | `hooks/data/wall-boq-feed.ts` · `column-boq-feed.ts` · `bim/.../stair-boq-sync.ts` |

**Units παγίδα** (συχνότερο bug): grip off-screen ή 1000× σε σχέδια **meter-scene** → έλεγξε `mmScaleFor`/`mmToSceneUnits`/`inferSceneUnitsFromWidth` (feedback `grip-positions-read-geometry`).

---

## 3. ΑΝ ΒΡΕΘΕΙ BUG
1. Εντόπισε με το map §2 → διάβασε το αρχείο → fix.
2. Γράψε/ενημέρωσε test αν αλλάζεις λογική.
3. `npx jest <σχετικά>` + `npx tsc --noEmit` (background).
4. **Stage ΜΟΝΟ τα δικά σου** (όχι tilt agent) → ενημέρωσε ADR-401 §8 changelog → **σταμάτα, ο Giorgio κάνει commit**.
5. Αν όλα δουλεύουν → ενημέρωσε `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (αφαίρεσε τα 🔴 browser verify markers του ADR-401) + ADR-401 status header.

## 4. Refs
- ADR: `docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md` (§5 phases A→G.3 + §8 changelog)
- Memory: `project_adr401_wall_top_constraints.md`
- G.3 plan: `~/.claude/plans/cheeky-chasing-hoare.md`
- G.3 commit: `6e7fed9d`
