# HANDOFF v2 — ADR-598 G11 · 21 components χωρίς a11y test

**Ημερομηνία:** 2026-11-18
**Worktree:** `C:\Nestor_Worktrees\a11y-g11-coverage` · κλαδί `agent/a11y-g11-coverage`
**Βάση:** `5fad30d0` · δέντρο καθαρό · **καμία δουλειά κώδικα δεν έχει γίνει ακόμη**
**Μοντέλο:** Opus (εγκρίθηκε)
**Προηγούμενο handoff:** `C:\Nestor_Pagonis\HANDOFFS\2026-11-18_ADR-598-G11_a11y-21-components_handoff.md` (αυτό το v2 το αντικαθιστά πλήρως)

## ⚠️ Γιατί υπάρχει το v2

Η προηγούμενη συνεδρία άνοιξε κατά λάθος στο `C:\Nestor_Worktrees\energy-under-construction`.
Το `EnterWorktree` **δεν** μπορεί να μεταφέρει συνεδρία σε worktree έξω από το `.claude\worktrees\`.
⇒ Η νέα συνεδρία **πρέπει να ξεκινήσει μέσα** στο `C:\Nestor_Worktrees\a11y-g11-coverage`
(`cd` εκεί και μετά `claude`). Πρώτη ενέργεια: `git branch --show-current` = `agent/a11y-g11-coverage`.

## Εγκρίσεις Giorgio (ήδη δοσμένες, «ΟΚ» 2026-11-18)

- ✅ Πραγματικά τεστ (ΟΧΙ reseed baseline). Επίπεδο: «μεγάλοι παίκτες» (Revit · ArchiCAD · Figma · Zillow · Idealista), **χωρίς καμία έκπτωση**. Αν κάτι δεν είναι βέβαιο ⇒ έρευνα στο διαδίκτυο (WAI-ARIA APG, axe-core rules) για την καλύτερη πρακτική.
- ✅ Τρέξιμο jest στα ΝΕΑ a11y τεστ + `npm run a11y-coverage:check` κατά την εργασία.
- ⏸️ ΔΕΝ εγκρίθηκε ακόμη (ρώτα): pre-commit wiring του G11 · μείωση baseline (`a11y-coverage:baseline`).
- ⏸️ **`wt:land` και push ΜΟΝΟ με ρητή εντολή Giorgio** (εντολή 2026-11-18 — υπερισχύει του αυτόματου land του CLAUDE.md για αυτή την εργασία). Commit **μόνο** στο `agent/a11y-g11-coverage`, **ποτέ** στο `main`, πάντα με ρητή λίστα αρχείων.

## Εύρημα

CI `T3 ♿ A11y Test-Coverage Ratchet` κόκκινο στα τελευταία **200** runs του main (π.χ. run 44350807754 στο `5fad30d0`).
Αιτία: το G11 τρέχει **μόνο στο CI**, όχι στο pre-commit ⇒ από το κλείδωμα 2026-09-21 (baseline 134) μπήκαν 21 νέα components χωρίς axe test.

Τα 21 (από το log του CI):
- `src/components/ui/ErrorBoundary/BackendUnavailableFallback.tsx`
- `src/components/ui/chart-card/ChartBandPending.tsx` (υπάρχει `chart-card/__tests__/chart-card.a11y.test.tsx`)
- `src/components/ui/choice-cards.tsx`
- `src/components/ui/collapsible-column.tsx`
- `src/components/ui/data-grid/DataGrid.tsx` · `DataGridCell.tsx`
- `src/components/ui/dialog-action-footer.tsx`
- `src/components/ui/floating/FloatingPanelFooter.tsx` (υπάρχει `floating/__tests__/floating.a11y.test.tsx`)
- `src/components/ui/form/FormDialog.tsx` (υπάρχει `form/__tests__/FormActions.a11y.test.tsx`)
- `src/components/ui/navigation/tabs-rail.tsx`
- `src/components/ui/numeric-field/ScaledNumericField.tsx` (υπάρχει `numeric-field/__tests__/numeric-field.a11y.test.tsx`)
- `src/components/ui/sandboxed-html-frame.tsx`
- `src/components/ui/scroll-rail.tsx` · `section-frame.tsx` · `segmented-control.tsx` · `step-rail.tsx` · `toggle-button.tsx`
- `src/components/ui/snap-bottom-sheet/SnapBottomSheet.tsx`
- `src/components/ui/sortable/KanbanBoard.tsx` · `kanban-column.tsx` · `kanban-dock.tsx` (υπάρχει `sortable/__tests__/sortable.a11y.test.tsx`)

## Σχέδιο (εγκεκριμένο)

0. **SSoT audit με grep ΠΡΙΝ από κάθε γραμμή κώδικα**: `@/test-utils/a11y`, υπάρχοντα `*.a11y.test.tsx`, κοινά fixtures/renderers/helpers πληκτρολογίου. Ό,τι υπάρχει ⇒ χρήση/επέκταση· τίποτα διπλότυπο.
1. Ομαδοποίηση ανά φάκελο (~10 αρχεία `__tests__/*.a11y.test.tsx`)· επέκταση των υπαρχόντων όπου υπάρχουν.
2. Ανά component: axe σε **κάθε ορατή κατάσταση** (ανοιχτό/κλειστό · disabled · σφάλμα · κενό · φόρτωση) + ρόλος/όνομα (`getByRole(…, { name })`)
   + **πληκτρολόγιο** στα διαδραστικά (segmented-control · toggle-button · tabs-rail · step-rail · Kanban · SnapBottomSheet · DataGrid), κατά WAI-ARIA APG.
   Πρότυπο σπιτιού: εκστρατεία ADR-598 2026-09-21 (βρήκε 4 πραγματικά ελαττώματα) — δες `src/components/ui/__tests__/surfaces.a11y.test.tsx`.
3. SSoT: μόνο `@/test-utils/a11y` (`expectNoA11yViolations`, `HEADING_OUTLINE_RULES`). Portals ⇒ σάρωσε `document.body`.
4. Πραγματικό ελάττωμα ⇒ διόρθωση στο component· μεγάλο ⇒ ρώτα πρώτα.
5. ADR-598 changelog (Phase 3) · commit με ρητή λίστα στο `agent/a11y-g11-coverage` · **land/push μόνο με εντολή**.

## Πρόταση εκκρεμής (θέλει «ναι»)

G11 στο pre-commit για **νέα** αρχεία component (zero-tol on touch), ώστε να μην ξανασυμβεί.

## ΜΗΝ

- ⛔ reseed baseline για να πρασινίσει (απορρίφθηκε ρητά).
- ⛔ tsc (N.17) · push/land χωρίς εντολή · `--no-verify` · commit στο `main` · 21 copy-paste αρχεία (jscpd).
