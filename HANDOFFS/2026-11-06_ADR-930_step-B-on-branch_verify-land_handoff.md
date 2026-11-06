# HANDOFF — ADR-930 §3.10: Βήμα Α ζωντανά ✅ · Βήμα Β στο κλαδί (όχι στο main) · επόμενο: επαλήθευση → land → push · + ξεχείλισμα πίνακα

**Ημερομηνία:** 2026-11-06 · **Worktree:** `C:\Nestor_Worktrees\crm-pipeline-dnd` · **Κλαδί:** `agent/crm-pipeline-dnd`

## 1. Κατάσταση (μετρημένη)
- `origin/main` ⊇ `c0878013` (Βήμα Α, ΖΩΝΤΑΝΟ: run `42257773040` — firebase-apply ✅, Netcup ✅). Από πάνω `3d19874c` (ADR-929, άλλου πράκτορα).
- Το κλαδί `agent/crm-pipeline-dnd` = main + 4 commits (ΚΑΝΕΝΑ στο main, κανένα push):
  - `90a0978b` handoff · `d76fd7b5` ADR-930 §6 ζωντανή απόδειξη Βήματος Α (5 σενάρια + 4 παρατηρήσεις)
  - `08f22fe5` **Βήμα Β**: `match /opportunities` → `allow create, update, delete: if false` · CHECK 3.114 νέα Κ2 · σουίτα κανόνων
  - `00d43d57` πύλη 3.114: ένα εύρημα ανά αιτία
- Το Βήμα Β μεταφέρθηκε με **cherry-pick** των `6250a92f` + `c5535438` από το `agent/crm-rules-close` (ΟΧΙ rebase — εκείνο πατά σε
  ιστορικό πριν το squash). Μόνη σύγκρουση: changelog ADR-930 (κρατήθηκαν και οι δύο γραμμές). Hook ✅ (με 3.114).
  Οι κανόνες μετά τη συγχώνευση: μόνο `allow read` + `allow create, update, delete: if false` (ελέγχθηκε).
- Ζωντανή απόδειξη Βήματος Α: δοκιμαστική ευκαιρία `opp_cb4e224f-d125-4426-9cb0-87b7ccb6f082` («ΤΕΣΤ ADR-930 ζωντανός
  έλεγχος», κάτοχος πλέον Pagonis TEK). Τη σβήνει ο Giorgio όποτε θέλει — ΟΧΙ ο πράκτορας.

## 2. Επόμενο βήμα Α — Βήμα Β προς παραγωγή (κάθε σημείο ΜΟΝΟ με έγκριση Giorgio)
1. ⚠️ Τα νούμερα του ADR για το Βήμα Β (κανόνες 109/109, 3.114 self-test 15/15) μετρήθηκαν στο **παλιό** κλαδί. Ζήτα έγκριση για:
   σουίτα κανόνων opportunities + leads + activities (emulator) · `npm run test:opportunity-stage-authority` (self-test) ·
   `npm run test:rules-coverage-completeness` · `npm run jscpd:diff` στα αρχεία του Βήματος Β.
2. Με εντολή: `npm run wt:land -- crm-pipeline-dnd` → push ⇒ το run θα ζητήσει έγκριση `firebase-production` (ΤΗΝ ΠΑΤΑ Ο GIORGIO).
3. Ζωντανά μετά: δημιουργία/επεξεργασία/στάδιο/κάτοχος από το UI δουλεύουν ακόμη (περνούν από server) · απευθείας εγγραφή browser ⇒ deny.
4. Μετά: το κλαδί `agent/crm-rules-close` είναι πλέον περιττό — διαγραφή ΜΟΝΟ με έγκριση (όπως και `agent/crm-pipeline-dnd-pre-land` = `6fa73c5f`).

## 3. Επόμενο βήμα Β — στήλες που ξεχειλίζουν δεξιά (ζήτημα Giorgio, στιγμιότυπο 2026-11-06)
- **Ρίζα (μετρημένη στη ζωντανή σελίδα):** ο πίνακας ΚΥΛΑ (`div.flex.gap-3.overflow-x-auto`, scrollWidth 2324 > clientWidth 2080),
  αλλά η μπάρα έχει ύψος 0: `src/app/globals.css` ~γρ. 1452 «FINAL NUCLEAR SOLUTION» — `* { scrollbar-width: none !important }` +
  `*::-webkit-scrollbar { display: none !important }` κρύβει ΚΑΘΕ μπάρα της εφαρμογής. 9 στήλες × `min-w-[280px]`
  (`OpportunityColumns.tsx` → `columnClassName`) ⇒ η «Κλειστό (Απώλεια)» βγαίνει εκτός, χωρίς ένδειξη.
- **Πρόταση (δεν εγκρίθηκε ακόμη — ρώτα ποια):** (α) ρητή κλάση «ορατή λεπτή μπάρα» μόνο για δοχεία οριζόντιας κύλισης, πάνω στο
  υπάρχον μοτίβο `scrollbar-width: thin` (~γρ. 1892 `globals.css`) — ΟΧΙ αφαίρεση του καθολικού κανόνα · (β) πίνακας στο ύψος της
  οθόνης, κάθετη κύλιση μέσα σε κάθε στήλη (Trello/Jira), ώστε η μπάρα να είναι πάντα ορατή · (γ) σκίαση στις άκρες όταν
  υπάρχουν κρυμμένες στήλες. Πριν από κώδικα: SSoT grep (`scrollbar`, `overflow-x-auto`, `KanbanBoard` — ο ίδιος `KanbanBoard`
  σερβίρει και το `VariantLevelBoard`, ADR-923) + έρευνα πρακτικής (Trello/Jira/Pipedrive/HubSpot).
- Ανοιχτές παρατηρήσεις του ζωντανού ελέγχου (ADR-930 §6, ΧΩΡΙΣ εντολή): ιστορικό ευκαιρίας χωρίς οθόνη · μήνυμα σύγκρουσης λέει
  «ξαναφορτώθηκε» αλλά η φόρμα κρατά το πρόχειρο · «πίσω» από σελίδα ευκαιρίας κολλά τη ροή στη «Φόρτωση ροής…».

## 4. ΜΗΝ
- Commit στο `main` · `wt:land` / push χωρίς εντολή · `--no-verify` / `SKIP_*`.
- Test / πύλη / `jscpd` χωρίς έγκριση (N.(-2)) · tsc · dev server · μακριά αναμονή στο παρασκήνιο.
- Εγγραφή/DELETE σε πραγματική ευκαιρία από πράκτορα (MCP firestore μόνο ανάγνωση).
- Grep σε όλο το `src/` (ξεπερνά τα 120″) — στόχευε φακέλους.
