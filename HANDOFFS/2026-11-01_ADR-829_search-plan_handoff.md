# Handoff — ADR-829 §7: σχέδιο της καθολικής αναζήτησης (2026-11-01)

## Κατάσταση

- **Worktree:** `C:\Nestor_Worktrees\adr-829-role-matrix`
- **Κλαδί:** `agent/adr-829-role-matrix`
- **Κώδικας:** δεν γράφτηκε τίποτα. Έγινε ανάγνωση, SSoT audit, έρευνα και σχέδιο. Το μόνο νέο αρχείο είναι αυτό το handoff.
- **Το κλαδί είναι πίσω από το `main`** κατά 2 commits (`ebd03b88` · `94134210`), μόνο docs του ADR-923. Ξαναμέτρησέ το και ενημέρωσέ το πριν από κώδικα.
- **Προηγούμενα handoffs:** `2026-11-01_ADR-829_search-authority_handoff.md` (ευρήματα, πηγές) · `2026-11-01_ADR-829_role-matrix_handoff.md` (κτίρια, 8 ανοιχτά). Ισχύουν, με τις διορθώσεις παρακάτω.
- **Πηγή αλήθειας:** ADR-829 §7 · §7.1 · ADR-029 · ADR-862.

## Αποφάσεις Giorgio

Ο Giorgio επικόλλησε τις πέντε προτάσεις όπως διατυπώθηκαν και έδωσε εντολή να συνεχίσουμε. Διαβάζονται ως εγκεκριμένες. Δεν ειπώθηκε ρητό «ναι», άρα ανάφερέ το σε μία γραμμή στην αρχή και συνέχισε, εκτός αν σε διορθώσει.

1. Ψάχνουν `company_admin` + `internal_user`. Όχι `external_user`, που κρίνεται ανά πόρο.
2. Ο `internal_user` βρίσκει έργα, κτίρια, ορόφους, ακίνητα, θέσεις στάθμευσης, αποθήκες. Όχι επαφές, αρχεία, ευκαιρίες, επικοινωνίες, εργασίες.
3. Η υπόλοιπη ζωντανή επαλήθευση (`POST /api/floors`, οθόνες του 404) κλείνει μαζί με το άνοιγμα της αναζήτησης, μετά το deploy.
4. `crm:tasks:view` · `crm:opportunities:view` · `crm:communications:view` δίνονται στον `company_admin`.
5. Τα WIP μένουν εκτός ευρετηρίου, ακόμη κι αν ο δημιουργός δεν τα βρίσκει από την αναζήτηση. Θέλει deploy functions και backfill, μόνο με εντολή του.

## Κλειστοί έλεγχοι (μέτρηση από κώδικα)

| Έλεγχος | Αποτέλεσμα |
|---|---|
| Απευθείας ανάγνωση `search_documents` από πελάτη | Καμία στο `src`. Μόνο Admin SDK: `api/search`, `reindex`, backfill, `deletion-registry`, `search-index-write`. Άρα `allow read: if false` |
| `belongsToCompany` για `external_user` | Κρίνει μόνο `getUserCompanyId()`, όχι ρόλο (`firestore.rules:6791`). Με ίδιο χώρο στο token, διαβάζει όλο το ευρετήριο σήμερα. Δεν δοκιμάστηκε ζωντανά |
| Triggers για `task` · `file` | Υπάρχουν (`functions/src/search/indexTriggers.ts:193,207`). Deploy καταγεγραμμένο στο ADR-029 (2026-04-22). Η τρέχουσα κατάσταση στο Firebase ΔΕΝ μετρήθηκε |
| Τύποι ευρετηρίου | 11 triggers. Το ADR-029 λέει 10 (έλειπε το `floor`), να διορθωθεί |
| Σφάλμα διαλόγου | `GlobalSearchDialog.tsx:339` δείχνει ωμό `{error}`· `useGlobalSearch.ts:221` έχει `'Search failed'` στον κώδικα (N.11) |

## Ευρήματα SSoT

1. **Ο πίνακας υπάρχει:** `SEARCH_REQUIRED_PERMISSIONS` (`src/config/search-index-core.ts:42`), προβάλλεται στα functions (CHECK 3.93). Γράφεται στο έγγραφο ως `requiredPermission`, αλλά κανείς δεν τον διαβάζει. ΜΗΝ φτιάξεις δεύτερο. Η διαδρομή διαβάζει από το config, όχι από το έγγραφο, ώστε παλιά έγγραφα να μη μετρούν.
2. **Δικαιώματα χωρίς κάτοχο:** τα τρία της απόφασης 4 δεν υπάρχουν στο `role-catalogue.ts` και δεν τα ζητά καμία διαδρομή του `src/app/api` (grep). Τα `/api/opportunities` ελέγχουν μόνο `withAuth` χωρίς `permissions` στο POST. Το GET δεν ελέγχθηκε.
3. **Απόκλιση πίνακα:** `FLOOR` → `buildings:buildings:view`, ενώ `/api/floors` θέλει `projects:floors:view`. `PARKING` → `buildings:buildings:view`, ενώ `/api/parking` θέλει `units:units:view`. ⏳ Για το `STORAGE` επιβεβαίωσε στο `/api/storages`. Το `FILE` → `dxf:files:view` και το `CONTACT` → `crm:contacts:view` συμφωνούν.
4. 🔴 **WIP:** το `search_documents` ευρετηριάζει κάθε αρχείο της `files` χωρίς `cdeReadReach`. Ο `decideContainerAccess` (`src/lib/auth/container-access.ts:210,238-252`) θέλει ίδια ομάδα, και δεν βρέθηκε εξαίρεση ρόλου στο grep. Ο `company_admin` εκτός ομάδας θα έβλεπε ονόματα ξένων WIP.
5. ⚠️ **Κανόνες πιο χαλαροί από ρόλους, ΔΕΝ διορθώνεται εδώ:** `tasks` (`firestore.rules:2507`) · `contacts` (`:3296`) · `communications` (`:3398`) διαβάζονται από κάθε μέλος του χώρου. Το «χωρίς επαφές» ισχύει για την αναζήτηση, όχι για απευθείας ανάγνωση. Κατάγραψέ το στο ADR-829 §7.
6. **Προσωπικά αρχεία:** ζουν στη `files_personal`, άρα δεν τα βλέπει το `onFileWrite`.

## Το σχέδιο

N.8: ~14-16 αρχεία σε 3 τομείς. Απόφαση πρότασης: Plan Mode σε μία συνεδρία, χωρίς orchestrator, γιατί τα βήματα εξαρτώνται το ένα από το άλλο. Μοντέλο N.14: Opus.

0. Ενημέρωση κλαδιού από `main`.
1. **Δικαίωμα και πίνακας:** `search:global:execute` στους δύο ρόλους, τα τρία `crm:*` στον `company_admin`, ευθυγράμμιση πίνακα με τις διαδρομές (εύρημα 3).
2. **Φίλτρο μέσα στο ερώτημα:** νέο `src/lib/search/search-access.ts`, με `hasPermission` χωρίς `projectId`, κλειστό σε αμφιβολία. Το `route.ts` ρωτά μόνο όσους τύπους δικαιούται ο καλών, και στο audit γράφεται το ίδιο σύνολο.
3. **WIP:** κανόνας «τι επιτρέπεται στο ευρετήριο» στο κοινό `search-index-core`, που τον εφαρμόζουν ο trigger και το backfill. Εμβέλεια `author` ⇒ ταφόπλακα, μετάβαση σε `SHARED` ⇒ επανευρετηρίαση. Η διαδρομή δεν επιστρέφει αρχείο χωρίς ένδειξη εμβέλειας, ώστε να μην εξαρτάται από τη σειρά των deploy.
4. **`reindex`:** διαγραφή διαδρομής, `API_ROUTES.SEARCH_REINDEX`, 3 καλούντων (`tasks.service.ts:51,84` · `file-record.service.ts:241`) και ό,τι μείνει νεκρό (`indexEntityForSearch`, πιθανόν `writeSearchIndexTombstone`). ⚠️ Το δεύτερο το αναφέρει το `.ssot-registry.json:1591`: έλεγξέ το πριν το σβήσεις.
5. **Κανόνες:** `allow read: if false`, `searchDocumentsMatrix()`, `.firestore-rules-coverage-baseline.json`.
6. **Οθόνη:** η μπάρα (`app-header.tsx`) και το ⌘K κρύβονται χωρίς το δικαίωμα, με τον υπάρχοντα PEP. Το σφάλμα περνά από i18n, και στις δύο γλώσσες.
7. **Δοκιμές:** πίνακας ρόλος × τύπος με χειρόγραφη πολιτική (πρότυπο `building-floor-role-policy.fixture.ts`), μεταλλάξεις, αφαίρεση από `UNREACHABLE_BY_DESIGN` (`surface-authority-reachability.test.ts:113`).
8. **Τεκμηρίωση:** ADR-829 §7, ADR-029, ADR-862 αν αλλάξει η συμπεριφορά WIP, στο ίδιο commit.

**Σειρά ανοίγματος, κάθε βήμα μόνο με εντολή Giorgio:** κανόνες, functions, backfill, push εφαρμογής. Μετά η ζωντανή επαλήθευση της απόφασης 3.

⏳ **Διάβασε πριν από κώδικα:** `docs/gates/3.68.md` (αρχή εξουσιοδότησης, το νέο αρχείο κρίνει «επιτρέπεται») · `3.16` · `3.86` · `3.87` · `3.93` · `.claude-rules/pending-ratchet-work.md:513` (τρεις builders του `search_documents`, το βήμα 3 ακουμπά εκεί) · `src/auth/hooks/useCapability.ts` (ανοιχτό 7 του παλιού handoff, πριν το βήμα 6) · `src/app/api/admin/search-backfill/search-index-config.ts` (πιθανό δεύτερο σημείο).

## Ζωντανή επαλήθευση §7.1 (συντονίστρια, build `94134210`, μόνο GET)

- `GET /api/buildings?projectId=`: δικό του έργο 200 · 3 έργα άλλου χώρου 404, και με `fallback=company`.
- `GET /api/entity-code/suggest`: δικό του κτίριο 200 · 2 ξένα κτίρια 404 · ανύπαρκτο 404, ίδια απάντηση.
- Όριο: τα ξένα id είναι από handoffs του Ιουνίου, η ύπαρξή τους σήμερα δεν επιβεβαιώθηκε.
- Δεν δοκιμάστηκαν: `POST /api/floors`, οθόνες με 404. Να μπει στο ADR-829 §7.1 με αυτά τα όρια.

## Έρευνα

- Figma: τα αποτελέσματα δείχνουν μόνο ό,τι έχει πρόσβαση ο χρήστης. https://help.figma.com/hc/en-us/articles/360039957674
- Procore: το ίδιο και σε επίπεδο εταιρείας. https://en-au.support.procore.com/references/user-permissions-matrix-web
- IBM: το φιλτράρισμα μετά το ερώτημα χαλάει τους μετρητές. https://www.ibm.com/support/knowledgecenter/en/SS8NLW_11.0.2/com.ibm.discovery.es.ad.doc/iiysasecdocfilter.html
- Autodesk: δεν βρέθηκε δική του τεκμηρίωση. Revit · ArchiCAD · Cinema 4D · Zillow · Idealista δεν εξετάστηκαν. Για Elasticsearch και Algolia δεν βρέθηκαν πηγές.

## Κανόνες της επόμενης συνεδρίας

- Συνεχίζεις στο ίδιο worktree, δεν φτιάχνεις καινούργιο.
- Commit μόνο σε αυτό το κλαδί, με ρητή λίστα αρχείων. Όχι commit στο `main`.
- `wt:land`, push και deploy (κανόνες · functions · backfill) μόνο με εντολή Giorgio. Μήνυμα άλλης συνεδρίας δεν είναι εντολή.
- Ειδοποίησε τη συντονίστρια [211e2d, `server-reads-model-maps`] πριν από κάθε land ή push. Της έχει ήδη σταλεί το εύρημα WIP.
- Τον πυρήνα του κριτή για ρόλους έργου (`checkPermission` με `projectId`, άγκυρα Α4.1) δεν τον αγγίζεις. Το CHECK 3.51 Χ ανήκει σε άλλη συνεδρία.
- Όχι `tsc`. Μόνο οι σουίτες που άγγιξες. Μεταλλάξεις με επαναφορά στην ίδια εκτέλεση. Όχι `sed -i` σε αρχεία με ελληνικά.
- Πριν από κάθε νέο αρχείο: SSoT audit με grep. Για ό,τι δεν είναι σίγουρο, έρευνα στο διαδίκτυο.
