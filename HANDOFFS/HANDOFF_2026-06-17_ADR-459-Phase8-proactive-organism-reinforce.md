# HANDOFF — ADR-459 Φ8: Proactive Αυτόματος Οπλισμός Οργανισμού

**Ημ/νία:** 2026-06-17 · **Από:** Opus session · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά στις απαντήσεις.

---

## 0. ΤΟ TASK

**Επιβεβαιωμένο από Giorgio (διάλεξε «Proactive — νέα δουλειά»):**

Σήμερα ο αυτόματος οπλισμός του στατικού οργανισμού (κολώνες + δοκάρια + πέδιλα +
συνέχεια στους κόμβους) τρέχει **ΜΟΝΟ με κουμπί** («Αυτόματος Οπλισμός», καρτέλα Ανάλυση →
event `bim:auto-reinforce-requested`). Ο Giorgio θέλει να γίνεται **proactive** — να
υπολογίζεται **αυτόματα** μόλις δημιουργείται/μεγαλώνει ο οργανισμός (π.χ. ενώνεις 2 κολώνες
με δοκάρι → ο οργανισμός οπλίζεται μόνος του), **όπως το Φ7 auto-foundation design**.

**Σενάριο χρήστη (verification target):** σβήνω όλα → φτιάχνω κολώνα (→ auto πέδιλο Φ7) →
2η κολώνα (→ 2ο πέδιλο) → **ενώνω τις 2 κολώνες με δοκάρι → ο ενιαίος οργανισμός οπλίζεται
αυτόματα** (χωρίς να πατήσω κουμπί).

**Όραμα:** Revit-grade, **Full Enterprise + Full SSoT**. **ΠΡΙΝ κώδικα → πραγματικό SSOT
AUDIT (grep)** για reuse, **ΜΗΔΕΝ διπλότυπα**. **PLAN MODE** → plan → έγκριση → υλοποίηση →
jest → docs. **Commit = Giorgio** (ΟΧΙ ο agent).

---

## 1. 🚨 SSOT AUDIT — ΤΙ ΥΠΑΡΧΕΙ ΗΔΗ (grep done αυτή τη session· **ξανα-επιβεβαίωσέ το**)

Ο πυρήνας **υπάρχει ολόκληρος** — λείπει ΜΟΝΟ ο proactive trigger. ΜΗΝ ξαναγράψεις command/scope.

| Στοιχείο | Path | Τι κάνει |
|---|---|---|
| **Command (REUSE)** | `core/commands/entity-commands/AutoReinforceOrganismCommand.ts` | Undoable, **idempotent**, **geometry-neutral** batch οπλισμός. `buildReinforcePatch` → μέλος **χωρίς** `params.reinforcement` παίρνει code-suggested min οπλισμό· ήδη οπλισμένο/μη-δομικό → **skip** (null). `getReinforcedEntityIds()` = ποια θα οπλιστούν. |
| **Ribbon listener (REFACTOR→core)** | `hooks/useStructuralAutoReinforce.ts` | Ακούει ΜΟΝΟ `bim:auto-reinforce-requested`. Resolve scope (selection → επιλεγμένα· κενό → όλος ο οργανισμός ορόφου μέσω `isReinforceable`) → `execute(AutoReinforceOrganismCommand)` → emit `bim:structural-auto-reinforced`. **Εδώ είναι ο core που θα εξάγεις.** |
| **Proactive ΠΡΟΤΥΠΟ (mirror)** | `hooks/useAutoFoundationDesign.tsx` | Φ7: listener σε `AUTO_DESIGN_EVENTS` → coalesced microtask → `executeGrouped` (atomic undo με τον trigger) vs `execute` standalone· `GEOMETRY_EDIT_TRIGGERS` set. **Αντίγραψε αυτό το pattern.** |
| **Organism diagnostics (proactive ήδη)** | `hooks/useStructuralOrganism.ts` | `ORGANISM_EVENTS` → coalesced microtask → re-derive **diagnostics** (συνέχεια οπλισμού/dowels/anchorage/lap = DERIVED). ΔΕΝ εφαρμόζει οπλισμό. Καλή λίστα events για reuse. |
| **Reinforce SSoT dispatcher** | `bim/structural/section-context.ts` | `buildReinforcePatch(entity, provider)` + `isFoundationSlabEntity`. |
| **Events** | `systems/events/drawing-event-map-bim.ts` | `bim:auto-reinforce-requested {entityIds}` · `bim:structural-auto-reinforced {entityIds,count}`. |
| **Mount point** | `app/DxfViewerContent.tsx` | Εκεί mount-άρονται `useStructuralOrganism` / `useStructuralAutoReinforce` / `useAutoFoundationDesign`. |
| **Undo grouping (REUSE)** | `core/commands/useCommandHistory.ts` (`executeGrouped`) + `CommandHistory.appendToLast` | Φ7/v8.3 atomic-undo μηχανισμός — χρησιμοποίησέ τον. |

**Grep keywords:** `bim:auto-reinforce-requested|AutoReinforceOrganismCommand|useStructuralAutoReinforce|
buildReinforcePatch|isReinforceable|ORGANISM_EVENTS|AUTO_DESIGN_EVENTS|executeGrouped|GEOMETRY_EDIT_TRIGGERS|
bim:structural-auto-reinforced`.

---

## 2. ΚΑΤΕΥΘΥΝΣΗ FIX (Revit-grade + Full SSoT) — προς επικύρωση σε PLAN MODE

**Αρχή (Revit):** ο οπλισμός του οργανισμού είναι **παράγωγο** της γεωμετρίας/τοπολογίας → ανανεώνεται
**proactively, μία φορά, από ΕΝΑ SSoT**, ανεξαρτήτως αν ο χρήστης πάτησε κουμπί.

1. **SSoT extraction:** βγάλε τον πυρήνα του `useStructuralAutoReinforce` σε ΕΝΑ helper
   `runOrganismAutoReinforce(levelManager, entityIds, exec)` (resolve scope + build command +
   execute/grouped + emit). Το ribbon listener τον καλεί με selection-scope → **μηδέν διπλότυπο**.
2. **NEW `hooks/useProactiveOrganismReinforce.ts`** (mirror `useAutoFoundationDesign`):
   - ακούει geometry/organism events (subset των ORGANISM_EVENTS: `drawing:entity-created`,
     `bim:beam-params-updated`, `bim:column-params-updated`, `bim:foundation-params-updated`,
     `bim:entities-moved`, `bim:column-footing-attached`, `bim:beams/columns/foundations-from-grid`…)
   - coalesced microtask → καλεί τον core με scope **«όλος ο οργανισμός ορόφου»**
   - `executeGrouped` για geometry-edit triggers (atomic με τον trigger), αλλιώς `execute`.
3. **Loop guard (κρίσιμο):** ο proactive **ΔΕΝ** ακούει `bim:structural-auto-reinforced` (αλλιώς κύκλος).
   Είναι idempotent (skip ήδη οπλισμένα) → re-run = no-op, αλλά μην το βασίσεις στο loop· απόκλεισέ το.
4. **Mount** στο `DxfViewerContent` δίπλα στα άλλα structural hooks.
5. Το ribbon κουμπί «Αυτόματος Οπλισμός» **παραμένει** (manual re-run / override).

---

## 3. ⚠️ ΟΡΙΑ (100% ΕΙΛΙΚΡΙΝΕΙΑ — πες τα στον Giorgio, ΜΗΝ τα κρύψεις)

- Επειδή το command είναι **idempotent ως προς ήδη-οπλισμένα**, ο proactive οπλίζει **νέα/μη-οπλισμένα**
  μέλη (ακριβώς το σενάριο: νέο δοκάρι → οπλίζεται). **ΔΕΝ** ξανα-διαστασιολογεί τον οπλισμό μιας **ήδη
  οπλισμένης** κολώνας όταν αλλάξεις τη διατομή της (resize). Το «re-design on resize» (reinforcement
  intent = stale → recompute) είναι **ξεχωριστό θέμα → DEFER**.
- Η **συνέχεια οπλισμού στους κόμβους** (dowels/anchorage/lap — αυτό που κάνει τον οργανισμό «ενιαίο»)
  είναι ήδη **DERIVED diagnostic** (Φ4c) και υπολογίζεται proactively. Ο per-member οπλισμός είναι το
  **persisted** κομμάτι που τώρα γίνεται κι αυτό αυτόματο.
- **Race με Φ7 auto-foundation** (ίδιο event batch): το πέδιλο δημιουργείται ΚΑΙ οπλίζεται μέσα στο
  `ApplyFoundationLayoutCommand`. Αν ο proactive reinforce τρέξει μετά → το πέδιλο είναι ήδη οπλισμένο →
  skip (idempotent). Αβλαβές, αλλά **verify** τη σειρά microtask (μην διπλο-οπλιστεί πέδιλο).

---

## 4. ΑΠΟΦΑΣΕΙΣ (Revit-grade — ο Giorgio τις ενέκρινε στο plan· επανα-επιβεβαίωσε)

- **Scope:** όλα τα reinforceable μέλη του ενεργού ορόφου (idempotent → ασφαλές), ΟΧΙ μόνο «connected».
- **Undo:** atomic με τον trigger (`executeGrouped`, mirror Φ7) → ΕΝΑ Ctrl+Z αναιρεί δοκάρι+οπλισμό μαζί.
- **Toast:** μην σπαμάρεις σε κάθε proactive run (το ribbon path κάνει feedback· ο proactive → σιωπηλός ή
  μόνο όταν count>0). Απόφασέ το Revit-grade.

---

## 5. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)

- **COMMIT/PUSH = Giorgio**, ΟΧΙ ο agent. **Shared working tree** (άλλος agent δουλεύει ταυτόχρονα) →
  `git add` **ΜΟΝΟ τα δικά σου** αρχεία, ΠΟΤΕ `git add -A`.
- ⚠️ **ΜΗΝ** αγγίξεις: `useSmartDelete.ts` / `smart-delete-bim-events.ts` / `foundation-cross-level-writer.ts`
  (άλλος agent / v8.2).
- ⚠️ **UNCOMMITTED v8.4** (αυτή η γραμμή δουλειάς, 3Δ rotate→footing follow) ζει στο ίδιο tree: NEW
  `systems/events/emit-bim-entity-params-updated.ts` + `bim-3d/animation/bim3d-edit-structural-emit.ts` +
  test + MOD `bim3d-edit-interaction-handlers.ts` + 5 grip-commit files + ADR-459. **ΜΗΝ τα σταδιοποιήσεις
  εσύ** (ο Giorgio τα κάνει commit ξεχωριστά)· stage ΜΟΝΟ τα δικά του Φ8 αρχεία.
- **tsc = Giorgio** (PowerShell denied για agent). **jest** τρέχει κανονικά (`npx jest <path> --silent`).
  ⚠️ Πολλά suites αποτυγχάνουν με `fetch is not defined` (firebase chain) αν το test εισάγει
  `structural-settings-store` → **κράτα τα νέα tests καθαρά** (μην εισάγεις heavy command chains· δες πώς το
  έλυσα στο v8.4 με ξεχωριστό light module).
- **N.8 execution mode:** ~3-5 αρχεία, 1 domain → **Plan Mode** (όχι orchestrator).
- **PLAN MODE πρώτα** → SSOT audit (grep §1) → plan → έγκριση → υλοποίηση → jest → docs (ADR-459 §Φ8
  changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + memory). Απαντάς **Ελληνικά**.

---

## 6. VERIFICATION (end-to-end)

1. jest για τον εξαγμένο core + τον proactive hook (idempotency, loop-guard, scope).
2. tsc = Giorgio.
3. Browser (καθαρό test project, κτίριο Ισόγειο + όροφος Θεμελίωσης):
   - σβήσε όλα → κολώνα (auto πέδιλο) → 2η κολώνα (2ο πέδιλο) → **δοκάρι ένωσης → ο οργανισμός
     οπλίζεται ΑΥΤΟΜΑΤΑ** (2Δ/3Δ rebar εμφανίζεται χωρίς κουμπί).
   - **ΕΝΑ Ctrl+Z** αναιρεί δοκάρι+οπλισμό μαζί (atomic).
   - regression: δημιουργία μεμονωμένης κολώνας → οπλίζεται· πέδιλο ΔΕΝ διπλο-οπλίζεται.

## 7. ΠΡΩΤΟ ΒΗΜΑ

1. SSOT audit (grep §1) — επιβεβαίωσε command idempotency + το ribbon-listener core που θα εξάγεις + το
   Φ7 proactive pattern.
2. PLAN MODE → plan (core extraction + `useProactiveOrganismReinforce` + loop/undo guards) → έγκριση Giorgio.
3. Υλοποίηση → jest → docs. **ΟΧΙ commit.**
