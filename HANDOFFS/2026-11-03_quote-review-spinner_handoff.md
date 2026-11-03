# Handoff — Ατελείωτο spinner στην αναθεώρηση προσφοράς (2026-11-03)

- **Worktree:** `C:\Nestor_Worktrees\quote-review-state`
- **Κλαδί:** `agent/quote-review-state` (από `main` `fe7bc02a`)
- **Κατάσταση:** ✅ υλοποιήθηκε στο κλαδί (ADR-327 §6.10, changelog 2026-11-03). Η πηγή της QT-0002 μετρήθηκε: **πύλη**, όχι σάρωση. Μένει: ζωντανός έλεγχος οθόνης · απόφαση για το νεκρό polling του `useScanQueue`.
- **Συντονίστρια:** η συνεδρία `project-scope-authorization-adr-926` συμφώνησε να προχωρήσουμε.
  **ΜΗΝ αγγίξεις** τα `rfq-service.ts`, `rfq-line-service.ts`, `rfq-schemas.ts`, `vendor-invite-service.ts`, `RfqBuilder.tsx` (ροή Ε6 της).

## Σύμπτωμα (στιγμιότυπο του Giorgio)

`/o/<ws>/projects/<proj>/procurement/quote/<qt>/review` — προσφορά `QT-0002`: η κάρτα
«Επεξεργασία AI σε εξέλιξη… / Η εξαγωγή στοιχείων διαρκεί συνήθως 10-30 δευτερόλεπτα» γυρίζει **για πάντα**.

## Αιτία (από ανάγνωση κώδικα — ΔΕΝ επαληθεύτηκε η πηγή του QT-0002)

`src/app/(app)/o/[workspace]/procurement/quotes/[id]/review/QuoteReviewClient.tsx:175`:
το spinner δείχνεται για **κάθε** `quote.extractedData === null`. Το `null` σημαίνει τέσσερα διαφορετικά πράγματα:

| Περίπτωση | Πού γεννιέται | Polling | Οθόνη |
|---|---|---|---|
| Σάρωση σε εξέλιξη | `api/quotes/scan/route.ts` → `after()` → `process.ts` | ναι, ανά 2s | spinner ✅ σωστό |
| **Σάρωση απέτυχε** | `scan/process.ts:84-97` γράφει μόνο `notes` (**ωμό ελληνικό κείμενο στον server**) — το docstring λέει «marks `under_review`» αλλά **ο κώδικας δεν το κάνει** | **ναι, ανά 2s, για πάντα** (`stopWhen` περιμένει `extractedData`) | spinner για πάντα ❌ |
| **Χειροκίνητη** (`source:'manual'`) | `ManualQuoteDialog.tsx:36-42` δημιουργεί με `extractedData:null` (`quote-service.ts:129`) και πάει **κατευθείαν** στο `/review` | σταματά | spinner για πάντα ❌ |
| **Portal** (`source:'portal'`) | `vendor-portal-submit-service.ts:176` γράφει `extractedData:null` | σταματά | spinner για πάντα ❌ |
| Διακοπή διεργασίας (restart/deploy στη μέση του `after()`) | κανείς δεν γράφει τίποτα | για πάντα | spinner για πάντα ❌ |

Ρίζα: **η οθόνη συμπεραίνει κατάσταση από την απουσία δεδομένων.** Δεν υπάρχει πεδίο που να λέει «η εξαγωγή τρέχει / απέτυχε / δεν ζητήθηκε ποτέ».

## Κατεύθυνση (να επικυρωθεί με SSoT audit + έρευνα — Rossum, Nanonets, Procore, Ariba)

1. **Ρητή κατάσταση εξαγωγής στο έγγραφο**, ένας γραφέας (server): π.χ. `extraction: { status: 'pending'|'succeeded'|'failed'|'not_requested', startedAt, failedAt, errorCode }`.
   Ψάξε πρώτα αν υπάρχει ήδη ανάλογο μοτίβο (π.χ. στο import PDF του ADR-923, στο invoice-match, σε `processing`/`jobStatus`) — **χρησιμοποίησέ το, μη φτιάξεις δεύτερο**.
2. `scan/process.ts`: στην αποτυχία γράφει `failed` + κωδικό (όχι ωμό κείμενο στο `notes` — παραβιάζει N.11)· να κάνει πράγματι αυτό που λέει το docstring.
3. **Όριο χρόνου** (belt-and-suspenders για διακοπή του `after()`): `pending` με `startedAt` παλαιότερο από ~X λεπτά ⇒ η οθόνη το δείχνει ως «κόλλησε», με επανάληψη.
4. `QuoteReviewClient`: απόφαση από την κατάσταση — spinner **μόνο** σε `pending`· σφάλμα + «Επανάληψη» + «Χειροκίνητη καταχώριση» σε `failed`/timeout· για `manual`/`portal` χωρίς εξαγωγή → επεξεργασία γραμμών (υπάρχει `QuoteEditMode.tsx` / `QuoteLineEditorTable` — έλεγξε αν ταιριάζουν).
5. `useQuote` `stopWhen`: να σταματά και σε `failed`/`not_requested`.
6. Παλιά έγγραφα χωρίς το νέο πεδίο: ορισμός συμπεριφοράς (π.χ. `source` ≠ scan ⇒ `not_requested`· scan χωρίς πεδίο και `createdAt` παλιό ⇒ timeout).

## Πρώτα βήματα στη νέα συνεδρία

1. Ανάγνωση `.claude-rules/MEMORY.md`, ADR-327 (`docs/centralized-systems/reference/adrs/ADR-327-quote-management-comparison-system.md`) — σύγκριση ADR με κώδικα.
2. Μάθε την **πραγματική** πηγή του `QT-0002` (`source`, `notes`, `status`) — μην υποθέσεις ποια περίπτωση είναι.
3. SSoT audit με grep για υπάρχουσα «κατάσταση εργασίας AI».
4. Πρόταση μοντέλου (N.14) + σχέδιο → υλοποίηση → jest (όχι tsc, N.17) → ενημέρωση ADR-327 → commit στο κλαδί με ρητή λίστα αρχείων.

## Κανόνες

- Commit μόνο στο `agent/quote-review-state`. **Ποτέ στο `main`.** `wt:land` και push **μόνο με εντολή Giorgio**.
- Firestore κανόνες/δείκτες αν προστεθεί πεδίο που ερωτάται: CHECK 3.15/3.86.
