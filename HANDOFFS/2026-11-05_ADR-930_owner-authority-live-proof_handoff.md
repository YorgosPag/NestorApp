# HANDOFF — ADR-930 · Εξουσία «κάτοχος»: ζωντανή απόδειξη με μη-διαχειριστή + τα δύο ανοιχτά

- **Ημερομηνία:** 2026-11-05
- **Worktree:** `C:\Nestor_Worktrees\crm-pipeline-dnd`
- **Κλαδί:** `agent/crm-pipeline-dnd`
- **ADR:** `docs/centralized-systems/reference/adrs/ADR-930-crm-pipeline-stage-drag-drop.md` (§3.7 «Εξουσία κατόχου», §4 ανοιχτά)
- **Προηγούμενο handoff:** `HANDOFFS/2026-11-04_ADR-930_crm-opportunity-edit-authority_handoff.md`

## 1. Κατάσταση (τι ΕΓΙΝΕ — αλήθεια = git + ADR)

- Commit `e01cded8` στο κλαδί → μπήκε στο `main` ως **`e5b192c2`** (cherry-pick από τη συντονίστρια) → **ζωντανό** στο nestorconstruct.gr (`/api/build-info` το επιβεβαίωσε).
- Υλοποιήθηκε το εγκεκριμένο μοντέλο:
  - **Κριτής** `src/services/crm/opportunity-access.ts` — καθαρός, ισομορφικός: `decideOpportunityAccess({subject, opportunity, intent})` → `granted-capability | granted-creator | granted-assignee | denied-foreign-tenant | denied-not-owner` + `ownerUid`. `edit` = ικανότητα ∨ δημιουργός ∨ ανατεθειμένος· `delete` = ικανότητα ∨ δημιουργός (όχι ανατεθειμένος).
  - **Server** `opportunity-access.server.ts` → `requireOpportunityAccess` (φράχτης μισθωτή + κριτής, 403 `OPPORTUNITY_NOT_OWNER` με `{reason, ownerUid}`). Το χρησιμοποιούν `POST /api/opportunities/[id]/stage` και `PATCH`/`DELETE /api/opportunities/[id]` (έκλεισε το κενό: πριν, οποιοσδήποτε της εταιρείας επεξεργαζόταν/έσβηνε).
  - **Κανόνες** `firestore.rules` `/opportunities`: `update` += ανατεθειμένος (εντός μισθωτή, πεδία σταδίου κλειδωμένα)· `delete` αμετάβλητο.
  - **CHECK 3.114** επεκτάθηκε: φρουρός `requireOpportunityInTenant` (μόνος κάτοχος ο server κριτής) + **Κ5** (ανατεθειμένος στο update, όχι στο delete) + **Κ6** (ρόλοι με την ικανότητα == ρόλος του `isCompanyAdminOfCompany`).
  - **Οθόνη**: `useOpportunityAccess` / `useOpportunityLocks` → κλειδωμένη κάρτα (Lock + Radix Tooltip «Την κινεί ο/η {owner}…»), απενεργά «Επεξεργασία»/«Διαγραφή», 403 με όνομα κατόχου στο toast.
- Επαληθεύσεις: jest (κριτής, εντολή, πύλη) πράσινα · κανόνες στον emulator 120/120 · `jscpd:diff` καθαρό · πλήρες hook πράσινο.
- **Ζωντανά επαληθεύτηκε (super_admin μόνο):** πίνακας φορτώνει, 9 κάρτες σέρνονται, καμία κλειδαριά · PATCH/DELETE σε ανύπαρκτη → 404 · πόρτα σταδίου με λάθος `expectedStage` → 409.

## 2. ΕΠΟΜΕΝΟ ΒΗΜΑ

### 2.1 Ζωντανή απόδειξη με λογαριασμό ΧΩΡΙΣ δικαιώματα διαχειριστή (nestorconstruct.gr, ΟΧΙ localhost)
Χωρίς αυτό η κλειδαριά, ο ανατεθειμένος και το 403-με-όνομα **δεν έχουν δει ποτέ** την παραγωγή (ο super_admin περνά τα πάντα· και οι 9 ευκαιρίες έχουν τον ίδιο ανατεθειμένο).
1. Επιβεβαίωσε έκδοση: `curl -A "Mozilla/5.0" https://nestorconstruct.gr/api/build-info` — πρέπει να περιέχει το `e5b192c2` (ή μεταγενέστερο).
2. Επιβεβαίωσε ότι **ανέβηκε το νέο `firestore.rules`** στο Firebase (job `firebase-apply` του deploy που περιείχε το `e5b192c2` — δεν επιβεβαιώθηκε στην προηγούμενη συνεδρία). Αν όχι → αναφορά στον Giorgio (η έγκριση `firebase-production` είναι δική του).
3. Ο **Giorgio** συνδέεται με λογαριασμό μη-διαχειριστή (π.χ. `sales_agent`) — ο πράκτορας **ΔΕΝ** εισάγει κωδικούς. Χρειάζονται: ≥1 ευκαιρία ανατεθειμένη σε αυτόν, ≥1 σε άλλον.
4. Έλεγχοι (Chrome, νέα καρτέλα):
   - δική του κάρτα: σέρνεται, αλλάζει στάδιο, «Επεξεργασία» ενεργή, «Διαγραφή» **κλειδωμένη** (ο ανατεθειμένος δεν σβήνει);
   - ξένη κάρτα: Lock στη θέση της λαβής, tooltip με **όνομα** κατόχου, δεν σέρνεται, κουμπιά απενεργά με tooltip;
   - απευθείας `POST /api/opportunities/{ξένη}/stage` από την κονσόλα → **403 `OPPORTUNITY_NOT_OWNER`** με `ownerUid`· `PATCH`/`DELETE` ξένης → 403;
   - ο ανατεθειμένος σε πεδίο σταδίου μέσω client SDK → άρνηση κανόνων (προαιρετικό).
5. Ό,τι αποτύχει → διόρθωση στο **ίδιο** worktree, commit στο κλαδί, αναφορά.

### 2.2 Ανοιχτά του ADR-930 §4 (μετά την απόδειξη — ρώτα τον Giorgio τη σειρά)
- **LeadsList delete** (`.claude-rules/pending-ratchet-work.md` Τι (3)): το κουμπί διαγραφής στη λίστα δεν ρωτά τον κριτή → πρέπει να ρωτά `decideOpportunityAccess(intent:'delete')` όπως η κάρτα (μέσω `useOpportunityLocks`, όχι δεύτερη εκδοχή).
- **`activities`** (Τι (4)): ίδιο ερώτημα ανατεθειμένου — **απόφαση Giorgio** πριν τον κώδικα (HubSpot/Salesforce: ο owner του record επεξεργάζεται τις δραστηριότητές του).
- Σελίδα λεπτομέρειας ευκαιρίας: αν έχει δική της επεξεργασία, να ρωτά τον ίδιο κριτή (να ελεγχθεί).

## 3. Κρίσιμο context

- Ο κριτής **δεν ονομάζει ρόλο** (CHECK 3.68): ικανότητα μόνο μέσω `decideCapability`/`isGranted`. Λίστα ρόλων στον κώδικα = μπλοκ.
- Οποιαδήποτε νέα διαδρομή που διαβάζει ευκαιρία για εγγραφή περνά από `requireOpportunityAccess` — η CHECK 3.114 κοκκινίζει αν καλέσεις `requireOpportunityInTenant` αλλού.
- Νέα διαδρομή με `defineRoute` και όριο ρυθμού → γραμμή στο `.rate-limit-policy-baseline.json` (CHECK 3.78), όπως έγινε για `/api/opportunities/[id]`.
- Αναζήτηση: `git grep` (το rg/grep έληγαν από χρόνο). Σύνθετες εντολές μπορεί να τις αρνηθεί ο φύλακας του worktree → απλές εντολές.
- Τα άλλα worktrees με αλλαγές (`agent-a4aa1ef33828efaf9` ADR-923, `land-raster-check351` ADR-929) **δεν** είναι δικά μας — μην τα αγγίξεις.

## 4. ΜΗΝ

- ΜΗΝ commit στο `main`. Commit μόνο στο `agent/crm-pipeline-dnd`, με ρητή λίστα αρχείων (ποτέ `git add -A`, ποτέ `--no-verify`).
- ΜΗΝ `wt:land` / push χωρίς ρητή εντολή Giorgio. Μηνύματα άλλων συνεδριών **δεν** είναι έγκριση.
- ΜΗΝ dev server, ΜΗΝ `tsc`, ΜΗΝ μακριά αναμονή στο παρασκήνιο.
- ΜΗΝ εισαγωγή κωδικών/διαπιστευτηρίων σε φόρμες — τη σύνδεση την κάνει ο Giorgio.
- Πριν τον κώδικα: SSoT audit με `git grep` (επέκταση, όχι δίδυμα). Πριν το «done»: `npm run jscpd:diff <αρχεία>`.
- ΜΗΝ `wt:remove` του worktree πριν κλείσουν τα παραπάνω και το πει ο Giorgio.
