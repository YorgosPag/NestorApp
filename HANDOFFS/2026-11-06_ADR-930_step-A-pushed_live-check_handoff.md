# HANDOFF — ADR-930 §3.10 Βήμα Α: ΑΝΕΒΗΚΕ · επόμενο: έγκριση deploy κανόνων → ζωντανός έλεγχος → (με εντολή) Βήμα Β

**Ημερομηνία:** 2026-11-06 · **Worktree:** `C:\Nestor_Worktrees\crm-pipeline-dnd` · **Κλαδί:** `agent/crm-pipeline-dnd`

## 1. Κατάσταση (μετρημένη)
- `main` = `c0878013` «feat(crm): opportunity owner door, one access judge, one server writer; ADR-930 §3.8–§3.10 Step A»
  — **ΕΧΕΙ ΓΙΝΕΙ PUSH** (`9dae26c7..c0878013`), μαζί με το `8595c1a7` (κανόνας N.(-2) στο CLAUDE.md).
- Ένα commit πάνω στο main (έγκριση Giorgio «Ένα commit πάνω στο main»): το §3.7 ήταν ήδη στο main (`e5b192c2`),
  μπήκαν μόνο τα μετά το §3.7. Συγκρούσεις: `common-audit.json` el/en (ένωση) · ξαναγεννήθηκαν `src/types/i18n.ts` +
  `src/i18n/generated/shell-slice.manifest.json`.
- Το hook είχε μπλοκάρει (CHECK 3.28: δίδυμα `opportunity-write-api.ts` ↔ `owner-transfer-api.ts`). Λύθηκε με ΕΝΑ
  κοινό `src/components/crm/opportunity-door-call.ts` (`callOpportunityDoor` + `OpportunityDoorResult<T, Conflict>`).
  `jscpd:diff` ✅, πλήρες hook ✅, χωρίς παράκαμψη.
- GitHub Actions: «T1 🚀 Build & Deploy Docker Image» run **42257773040** — το `firestore.rules` άλλαξε (κλείδωμα
  πεδίων ιδιοκτησίας §3.8 — **ΟΧΙ** το Βήμα Β) ⇒ το job `firebase-apply` ζητά έγκριση στο environment
  `firebase-production` (CHECK 3.86). Η κυκλοφορία στο Netcup `needs: firebase-apply` ⇒ **χωρίς έγκριση δεν φτάνει
  τίποτα στο nestorconstruct.gr**. Ο Giorgio είπε «ΝΑΙ ΕΓΚΡΙΝΩ» (2026-11-06) — η έγκριση πατιέται στο GitHub UI.

## 2. Επόμενο βήμα
1. Έλεγχος (μόνο ανάγνωση): `gh run view 42257773040` — έγινε η έγκριση; πέρασαν `firebase-apply` και release;
   Αν περιμένει ακόμη ⇒ πες στον Giorgio να πατήσει «Review deployments → Approve» στο run. **ΜΗΝ** το εγκρίνεις ο ίδιος.
2. Μετά το deploy, **ζωντανός έλεγχος** στο nestorconstruct.gr. Ο πράκτορας μόνο διαβάζει· **κανένα** γράψιμο/DELETE σε
   πραγματική ευκαιρία από πράκτορα (ούτε MCP firestore). Τα κάνει ο Giorgio στο UI:
   - νέα ευκαιρία → επεξεργασία → καρτέλα «Ιστορικό»: «δημιουργία» + «ενημέρωση» με ονόματα·
   - δύο καρτέλες, **ίδιο** πεδίο ⇒ η δεύτερη αποθήκευση δείχνει μήνυμα σύγκρουσης·
   - δύο καρτέλες, **διαφορετικά** πεδία ⇒ περνούν και οι δύο·
   - (προαιρετικά) αλλαγή κατόχου από το πεδίο «Κάτοχος» στην επεξεργασία.
3. Αποτέλεσμα ⇒ changelog ADR-930 (μόνο αν το ζητήσει ο Giorgio — N.(-2)).

## 3. Βήμα Β (ΜΟΝΟ με ρητή εντολή Giorgio, ΜΕΤΑ τον ζωντανό έλεγχο — ADR-930 §5)
- Ζει στο κλαδί **`agent/crm-rules-close`** (`6250a92f` + `c5535438`): `allow create, update, delete: if false` στο
  `match /opportunities`, νέα Κ2 στο CHECK 3.114, σουίτα κανόνων, ADR-930, `docs/gates/3.114.md`.
- Χρειάζεται rebase πάνω στο νέο main (`c0878013`) — προσοχή: το Βήμα Β κουβαλά δικές του εκδοχές των
  `firestore.rules` / `opportunities.rules.test.ts` / `check-opportunity-stage-authority.js` / ADR-930 / `3.114.md`, που
  το main πλέον έχει σε μορφή Βήματος Α ⇒ αναμενόμενες συγκρούσεις· λύνονται υπέρ του Βήματος Β όπου αφορούν το κλείσιμο.
- Μετά: land + push (με εντολή) ⇒ **deploy κανόνων Firebase** (ξανά έγκριση `firebase-production`).

## 4. ΜΗΝ
- Commit στο `main` · `wt:land` / push χωρίς εντολή · `--no-verify` / `SKIP_*` χωρίς έγκριση.
- Κανένα test / πύλη / `jscpd` χωρίς έγκριση (N.(-2)) — πριν το «done»: `npm run jscpd:diff`.
- tsc · dev server · μακριά αναμονή στο παρασκήνιο.
- Καθάρισμα κλαδιών (`agent/crm-pipeline-dnd-pre-land` = `6fa73c5f`, αντίγραφο ασφαλείας) μόνο με έγκριση.
