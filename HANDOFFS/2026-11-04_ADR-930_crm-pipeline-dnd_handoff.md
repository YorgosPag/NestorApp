# HANDOFF — ADR-930 Ροή πωλήσεων CRM: σύρσιμο καρτών / ΕΝΑΣ γραφέας σταδίου

- **Ημερομηνία**: 2026-11-04
- **Worktree**: `C:\Nestor_Worktrees\crm-pipeline-dnd`
- **Κλαδί**: `agent/crm-pipeline-dnd` (βάση: `main` @ `c16a02f6`)
- **Commit δουλειάς**: `9c9920ce` — όλη η υλοποίηση (Φ1–Φ5). Το hook πέρασε ολόκληρο, χωρίς παράκαμψη.
- **ADR**: `docs/centralized-systems/reference/adrs/ADR-930-crm-pipeline-stage-drag-drop.md` (η πλήρης περιγραφή — **διάβασέ το πρώτο**)
- **Σχέδιο (εγκεκριμένο)**: `C:\Users\user\.claude\plans\jolly-tumbling-phoenix.md`

> ⛔ **Στο `main` ΔΕΝ γίνεται commit. Το `npm run wt:land -- crm-pipeline-dnd` και το push γίνονται ΜΟΝΟ με ρητή εντολή του Giorgio.**
> Μέσα στο worktree, στο κλαδί `agent/*`, ο πράκτορας κάνει commit τη δική του δουλειά με **ρητή λίστα αρχείων** (ADR-925).

---

## 1. Κατάσταση — ΤΙ ΕΓΙΝΕ (στο κλαδί, όχι στο `main`)

| Φάση | Περιεχόμενο | Κατάσταση |
|---|---|---|
| Φ1 | Μία ρίζα σταδίων `src/config/crm/opportunity-stages.ts` (CHECK 3.73) · λόγοι απώλειας · καθαρός κανόνας `services/crm/opportunity-stage-transition.ts` · γραφέας `…transition.server.ts` (συναλλαγή, CAS στο `expectedStage`, `_v`, ίχνος) · `POST /api/opportunities/[id]/stage` · ιστορικό ADR-195 για `opportunity` | ✅ |
| Φ2 | `src/components/ui/sortable/KanbanBoard.tsx` + `kanban-model.ts` · `useSortableSensors(coordinateGetter)` · μεταφορά `VariantLevelBoard` | ✅ |
| Φ3 | `src/components/crm/stage-move/` (εντολή, διάλογοι, αισιόδοξη εικόνα, api) · `OpportunityColumns` πάνω στο `KanbanBoard` · σύνολα/σταθμισμένο · ταξινόμηση ανά χρήστη · «μέρες στο στάδιο» · ζωντανός πίνακας · φόρμα επεξεργασίας μέσω πόρτας | ✅ |
| Φ4 | `firestore.rules`: κλείδωμα `STAGE_OWNED_FIELDS` · MCP χωρίς `opportunities` στη λίστα εγγραφής · **CHECK 3.114** (`scripts/check-opportunity-stage-authority.js`, `.opportunity-stage-authority.json`, `docs/gates/3.114.md`) | ✅ |
| Φ5 | jest (πυρήνας 15 · εντολή 6 · kanban/pipeline/overlay 25 · πύλη 9) · κανόνες emulator 118/118 · ADR-930 + changelog ADR-195/923 · i18n types/slice | ✅ |

**Επαλήθευση που ΔΕΝ έγινε**: ζωντανή δοκιμή στον browser. Όλα είναι επαληθευμένα μόνο με tests και πύλες.

## 2. ΕΠΟΜΕΝΟ ΒΗΜΑ (με αυτή τη σειρά)

1. **Ζωντανή επαλήθευση στον browser** (dev server του worktree, `/o/<workspace>/crm/leads` και `/crm/pipeline`):
   - σύρσιμο ανοιχτό→ανοιχτό: άμεση μετακίνηση + μήνυμα «Αναίρεση» που δουλεύει·
   - →«Κλειστό (Επιτυχία)»: διάλογος ποσού/ημερομηνίας· «Άκυρο» ⇒ η κάρτα γυρίζει·
   - →«Κλειστό (Αποτυχία)»: λόγος υποχρεωτικός·
   - κλειστό→ανοιχτό: επιβεβαίωση επανανοίγματος·
   - πληκτρολόγιο: Space / ← → / Space / Esc· μενού «Μετακίνηση σε…»·
   - **δύο καρτέλες**: μετακίνηση της ίδιας κάρτας ⇒ η δεύτερη παίρνει μήνυμα σύγκρουσης με το πραγματικό στάδιο·
   - απλό κλικ (χωρίς σύρσιμο) ανοίγει τη σελίδα της ευκαιρίας· ρίψη ΔΕΝ ανοίγει σελίδα·
   - φόρμα επεξεργασίας με αλλαγή σταδίου σε «Κλειστό» ⇒ ανοίγει ο διάλογος κλεισίματος πάνω από τη φόρμα·
   - καρτέλα «Ιστορικό» της ευκαιρίας: γραμμή `status_changed` με παλιό/νέο στάδιο·
   - ο πίνακας του καταλόγου (`/catalog/families`, `VariantLevelBoard`) σέρνεται όπως πριν.
   Ό,τι βρεθεί ⇒ διόρθωση + commit στο ίδιο κλαδί (ρητή λίστα αρχείων) + changelog στο ADR-930.
2. **Αναφορά στον Giorgio** και αναμονή εντολής για `npm run wt:land -- crm-pipeline-dnd` → push → `npm run wt:remove -- crm-pipeline-dnd`.
3. **Σειρά ανάπτυξης μετά το push**: πρώτα να φτάσει ο κώδικας στην παραγωγή (Netcup), **ΜΕΤΑ** deploy κανόνων Firestore
   (αλλιώς η παλιά φόρμα στην παραγωγή αποτυγχάνει σιωπηλά). Το deploy κανόνων το αποφασίζει ο Giorgio (CHECK 3.86).
4. **MCP**: η αφαίρεση των `opportunities` από το `WRITE_ALLOWED_COLLECTIONS` ισχύει από την επόμενη επανεκκίνησή του.

## 3. Κρίσιμο context

- **Ένας γραφέας σταδίου**: `applyOpportunityStageTransition` (`src/services/crm/opportunity-stage-transition.server.ts`),
  καλείται ΜΟΝΟ από `src/app/api/opportunities/[id]/stage/route.ts`. Από τον browser, ΜΟΝΟ μέσω
  `useStageTransitionCommand` (`src/components/crm/stage-move/`).
- **`STAGE_OWNED_FIELDS`** (στο `opportunity-stage-transition.ts`) = η ΜΙΑ λίστα· ίδια λίστα στο `firestore.rules`
  (`match /opportunities`). Η CHECK 3.114 Κ2 τις συγκρίνει.
- Το `status` **παράγεται** από το στάδιο (`STATUS_OF_STAGE_KIND`) — ποτέ ανεξάρτητη εγγραφή.
- Τα κλειδιά i18n του πίνακα είναι στο **`common-shared`** (`kanban.*`), όχι στο `common`: το `common` ήταν στο όριο του
  προϋπολογισμού του shell slice (ADR-744). Οι ανακοινώσεις έχουν **στατικά** κλειδιά (όχι δυναμικό `t(key)`).
- Το κοινό συμβόλαιο κατόχου CRM των κανόνων (`tests/firestore-rules/_harness/crm-owner-contract.ts`) γράφει πλέον
  `NEUTRAL_EDIT` (`title`) αντί για `status`.
- Η νέα διαδρομή είναι δηλωμένη στο `declarations` του `.rate-limit-policy-baseline.json` (CHECK 3.78, προηγούμενο:
  `budget-lines`).
- Κανόνες: `npx firebase emulators:exec --only firestore --project demo-nestor "npx jest -c jest.config.firestore-rules.js tests/firestore-rules/suites/opportunities.rules.test.ts"`.

## 4. Εκκρεμότητες εκτός εμβέλειας (ήδη στο `.claude-rules/pending-ratchet-work.md`)

- Οι **μη σταδιακές** εγγραφές ευκαιρίας (σημειώσεις, αξία, διαγραφή) γίνονται ακόμη από τον browser χωρίς ιστορικό.
- Το `opportunities-server.service.ts` γράφει άλλο σχήμα (`name`/`value`/`leadId` αντί για `title`/`estimatedValue`/`contactId`).

## 5. ⚠️ ΜΗΝ

- ΜΗΝ κάνεις commit στο `main`· ΜΗΝ τρέξεις `wt:land` ή push χωρίς ρητή εντολή.
- ΜΗΝ γράψεις στάδιο έξω από την πόρτα· ΜΗΝ προσθέσεις κάτοχο στο `.opportunity-stage-authority.json` «για να περάσει».
- ΜΗΝ αλλάξεις το `STAGE_OWNED_FIELDS` χωρίς να αλλάξεις και τον κανόνα στο `firestore.rules`.
- ΜΗΝ τρέξεις `tsc` (N.17)· ΜΗΝ χρησιμοποιήσεις `--no-verify` ή `SKIP_*` για να περάσει το hook.
- ΜΗΝ γράψεις κώδικα πριν από **SSoT audit με grep**: υπάρχουν ήδη `KanbanBoard`, `useStageTransitionCommand`,
  `pipeline-board.ts`, `toCatalogKey`, `mcp-write-allowlist` — επέκτεινέ τα, μη φτιάξεις δίδυμα. Πριν το «done»:
  `npm run jscpd:diff <αρχεία>` (και τα routes που άγγιξες — εκεί σκόνταψε το hook την πρώτη φορά).
