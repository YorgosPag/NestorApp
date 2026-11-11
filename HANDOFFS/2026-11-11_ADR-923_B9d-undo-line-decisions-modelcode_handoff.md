# Handoff — ADR-923 §5.5.2 Β9δ · απόφαση γραμμής + κωδικός μοντέλου μέσα στη στοίβα αναίρεσης (2026-11-11)

## Πού
- Worktree `C:\Nestor_Worktrees\catalog-editions` · κλαδί `agent/catalog-editions` (η νέα συνεδρία συνεχίζει ΕΔΩ).
- Στο `main` ΔΕΝ γίνεται commit. **`wt:land` και push ΜΟΝΟ με εντολή Giorgio.** Κανένα test/πύλη/tsc/jscpd χωρίς έγκριση. Ποτέ `--no-verify`. Καμία εγγραφή δεδομένων παραγωγής χωρίς «ναι».
- Πρότυπο Giorgio: «όπως οι μεγάλοι παίκτες (Revit, ArchiCAD, Cinema 4D, Figma…), full enterprise + full SSoT, χωρίς εκπτώσεις· αν δεν είσαι σίγουρος → έρευνα στο διαδίκτυο· αν γίνεται, λύση πιο έξυπνη από τους μεγάλους». ΠΡΙΝ από κώδικα: πραγματικό SSoT audit (grep).

## Κατάσταση
- Β9α/β/γ + fix (`6196e698` · `9bd4b1dc` · `fef72396` · `6df092d7`) είναι στο `main` και **ζωντανά** στο nestorconstruct.gr.
- **Ζωντανή επαλήθευση 1–6 του προηγούμενου handoff: ΟΛΑ ✅** (παρτίδα `cibat_2ba98f62-…`, σελ. 87, MFP-34K1M-Q1AA1):
  1 «↺ Αναίρεση» Κωδικός ⇒ Εκκρεμεί · 2 Ctrl+Z/Shift+Z/Y με ελληνική διάταξη · 3 Ctrl+Z μέσα στο input = μόνο κείμενο · 4 toast «Αποδοχή γραμμής · 13 πεδία · Αναίρεση» (Ctrl+Z/κουμπί/νέα πράξη το αποσύρουν, πράξη πεδίου ⇒ κανένα toast) · 5 δύο καρτέλες ⇒ «1 πεδίο δεν αναιρέθηκε…» · 6 αλλαγή παρτίδας ⇒ καθαρή στοίβα.
- Δεδομένα παραγωγής **επανήλθαν** όπως πριν: «48 αποδεκτά αυτόματα · 4 πεδία θέλουν απόφαση», Κωδικός MFP-34K1M = **Εκκρεμεί** (αποφασίζει ο Giorgio: `MFP-34K1M-Q1AA1` vs `099-03-001`).
- Ευρήματα: (α) ετικέτα «Αναίρεση: Αναίρεση απόφασης «Κωδικός»» — άβολη, διορθώνεται μέσα στη Β9δ (`history.undoNamed` + `step.undoDecision` στο `el/catalog-import.json:192-207`). (β) Escape ΔΕΝ κλείνει τον επεξεργαστή διόρθωσης (`ProposalFieldRow.tsx` `IncomingCell` 79-106) — προϋπάρχον, εκτός Β9, **μόνο αναφορά**.
- Καμία αλλαγή κώδικα σε αυτή τη συνεδρία.

## ΕΠΟΜΕΝΟ — Β9δ (ΜΟΝΟ με έγκριση Giorgio)
### SSoT audit που έγινε (επαλήθευσε ξανά με grep — ο κώδικας κερδίζει)
- Στοίβα: `grid-history` (`recordHistory`/`undoHistory`/`redoHistory`, `{before,after}`, όριο 100) — **γενική, αμετάβλητη** ⇒ ξαναχρησιμοποιείται, ΟΧΙ νέα στοίβα.
- `src/components/catalog/imports/review-history.ts`: `FieldMark{rowKey,targetKey,decision?,edit?}` · `reviewStepOf` **επιστρέφει `null` για αλλαγή μόνο `modelCode`** · `planReviewStep` (holds ⇒ παράλειψη+μέτρηση, `review.history.skipped`) · `labelOf` · `afterMarks` · `isGroupStep`.
- `use-review-history.ts`: `record` τυλίγει `change` · `useRequestQueue` με `expected` · `useHistoryKeys`.
- `proposal-change-queue.ts`: `ProposalChange{decisions?,edits?,modelCode?}` · `modelCode: input.modelCode ?? null` (`null` = καμία αλλαγή, `''` = επιστροφή στην πηγή — `human-edits.ts:81 recordModelCodeEdit`) · τρέχουσα τιμή `proposal.modelCodeEdit` · `useQueuedLine` = ουρά αποφάσεων γραμμής.
- `use-line-decisions.ts`: `useLineDecisions(send)` / `decideLine` — **τίποτα στο ιστορικό**. Καλείται από `use-import-batch.ts:99-109`.
- Server `src/server/catalog/import-page-reinterpret.server.ts`: `decideLine` · `reinterpretTable` (ξαναχτίζει γραμμές πρότασης) · `bindToFamily` (`bind!=null` ⇒ γράφει **σχήμα οικογένειας** μέσω `updateCatalogFamily`) · `judgePriceLine`. Αρνήσεις: `proposalClosed`, `priceLineTaken`, `lineUnknown`, `priceTargetMissing`.
- Αποθήκευση: `batch.pages.lineOverrides` (`page-line-overrides.ts`: `lineKeyOf`, `lineDecisionOf`, `withLineOverride`) · `origin:{kind:'memory',memoryId,…}` (`ImportLineOverrideOrigin`, `catalog-import.ts:443`) · `label-memory.ts:137 learnableOverrides` ΔΕΝ φιλτράρει κατά origin.
- Τύπος αιτήματος: `SetImportLineRequest{page,table,line,decision,bind}`.
- Κουμπιά κωδικού: `ProposalReview.tsx:178-179` (`{modelCode: code.trim()}` / `{modelCode: ''}`).

### Σχέδιο (πρόταση — περιμένει απαντήσεις)
- Ετερογενή βήματα σε ΜΙΑ στοίβα: το βήμα αποθηκεύει **κατάσταση, όχι εντολή** (όπως σήμερα το `FieldMark`) — νέα είδη σήματος: γραμμή (`{page,table,line,decision}` before/after) και κωδικός μοντέλου (`{before,after}` του `modelCodeEdit`). Αναίρεση = **ίδια πόρτα** με την αρχική πράξη (`changes.line` / `changes.change`), `holds()` ⇒ αγγίζει μόνο ό,τι είναι ακόμη δικό σου.
- Αποφάσεις που χρειάζονται από τον Giorgio:
  - **Α.** Αναίρεση απόφασης γραμμής με `bind` ⇒ επιστρέφει **μόνο** η γραμμή (`bind:null`), το δέσιμο στο σχήμα οικογένειας **μένει** (προτείνεται — το σχήμα είναι κοινόχρηστο, δεν ανήκει στη στοίβα μιας επισκόπησης).
  - **Β.** Επαναφορά απόφασης που είχε δώσει η μνήμη προμηθευτή ⇒ προαιρετικό `origin` στο αίτημα γραμμής, **επαληθευμένο από τον server** απέναντι στη μνήμη (προτείνεται) — ή αποδοχή ότι γίνεται «από εσάς».
  - **Γ.** Βήμα πεδίου πριν από απόφαση γραμμής μπορεί, όταν αναιρεθεί, να παραλειφθεί και να μετρηθεί (ο πίνακας ξαναχτίστηκε). Αποδεκτό;
  - **Τρόπος**: Orchestrator ή Plan Mode (με Β ~9–11 αρχεία client+server· χωρίς Β ~7, μόνο client).
- Προαιρετική έρευνα web: πώς Figma/Revit/ArchiCAD μοντελοποιούν ετερογενή βήματα (κατάσταση vs εντολή, multiplayer undo) — να γίνει πριν κλειδώσει το σχέδιο, κατά την εντολή «αν δεν είσαι σίγουρος → έρευνα».

## ΜΗΝ
Commit στο `main` · land/push χωρίς εντολή · `--no-verify` · `SKIP_*` χωρίς εντολή · tsc · tests/πύλες/jscpd χωρίς έγκριση · εγγραφές παραγωγής χωρίς «ναι» · `wt:remove` χωρίς εντολή · κώδικας Β9δ πριν απαντήσει ο Giorgio στα Α/Β/Γ.
