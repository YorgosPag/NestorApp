# Handoff — ADR-829 §7.1: δικαιώματα κτιρίου με φράχτες ξένου χώρου (2026-11-01)

> Αυθεντία: ο κώδικας και το ADR-829 §7.1. Οι αριθμοί εδώ είναι στιγμιότυπο, ξαναμέτρησέ τους. Αντικαθιστά το βήμα 2 του `2026-11-01_ADR-923_Phase4-closed_next-steps_handoff.md`· τα υπόλοιπα βήματα εκείνου ισχύουν.

## Κατάσταση

- Κλαδί `agent/adr-923-phase3-close`, commit `c92a0c0a`, πάνω στο `5d44d48a`. **Χωρίς land και push.** Το pre-commit πέρασε.
- ✅ Εγκεκριμένα από τον Giorgio και τα 4 σημεία της πρότασης.
- ⏳ Ζωντανή επαλήθευση: **καμία**. Ούτε browser ούτε `company_admin` στην παραγωγή.

## Τι έγινε

| Θέμα | Αλλαγή |
|---|---|
| Δικαίωμα | `buildings:buildings:create` · `update` · `delete` μόνο στον `company_admin` |
| Ξένος χώρος | `POST /api/buildings` · `POST /api/floors` · `link-project` · `PATCH /api/buildings` αρνούνται ξένο γονιό πριν γράψουν. `tenantCheck: true` σε `building` · `floor` |
| Λευκή λίστα | `_shared/building-write-fields.ts`, δεμένη με `Record<keyof BuildingUpdatePayload, true>`: άγνωστο πεδίο = 400, κάδος μόνο με `DELETE` |
| Όροφοι | Νέα `projects:floors:create` · `update` μόνο στον `company_admin`. Ο `internal_user` δεν γράφει πια ορόφους |
| Οθόνη | `useGrantedCapability` · `useBuildingCapabilities` πάνω στον ΕΝΑ PEP · `FORBIDDEN` στον μεταφραστή πολιτικής |
| Άγκυρες | Κ2 με πλήρη σάρωση · `building-foreign-project.route.test.ts` · `entity-registry-tenant-check.test.ts` · μεταλλάξεις 12/12 |

## Σειρά εργασιών

1. **Land: μόνο με εντολή Giorgio.** Πριν από αυτό ειδοποίησε τις συνεδρίες Φ6α (`nestor-pagonis-26`, κλαδί `agent/adr-923-phase6-sku-boq`), γιατί η αλλαγή επηρεάζει τις ίδιες δοκιμές, και Φ5, γιατί η ανάπτυξη επανεκκινεί τον διακομιστή. Έλεγξε `gh run list` και `npx jest scripts/__tests__/rules-liveness-gate.test.js`.
2. **Ζωντανή επανάληψη μετά την ανάπτυξη:** `company_admin` του `neo_grafeio` φτιάχνει, αλλάζει και στέλνει στον κάδο κτίριο. Έλεγξε ότι ο `internal_user` δεν βλέπει κουμπιά. Αυτό ξεμπλοκάρει το κριτήριο εξόδου της Φ6α.
3. **Ο ρόλος έργου: νέο ADR, μετά τη Φ6α.** Ο `project_manager` να διαχειρίζεται κτίρια του έργου του, όπως Procore και ACC. Αλλάζει τον πυρήνα του κριτή (`checkPermission`, Check 2) και την άγκυρα Α4.1 του `pdp-equivalence.test.ts`. Το έργο θα προκύπτει από το κτίριο στο σύνορο. Τότε αποφασίζεται και ποιος κρατά το `delete`.
4. **`search:global:execute`:** το τελευταίο ανοιχτό του ADR-829 §7, ξεχωριστή απόφαση.
5. Τα υπόλοιπα βήματα του προηγούμενου handoff (πύλη TypeScript, Φ5, κεφάλαιο Aries, Φ6–Φ8).

## Ανοιχτά προς έλεγχο

- **10 κόκκινα tests σε 6 σουίτες του `src/lib/auth`**, στο κλαδί: `personal-scope-consumers` (4) · `project-team-birth-anchor` (2) · `ownership-callsite-coverage-anchor` · `identity-provenance` · `acting-workspace` · `identity-remediation`. **Μετρημένο 2026-11-01: και τα 10 υπάρχουν ονομαστικά στο `main@5d44d48a`** (CI run `41316819454`). Το `main` έχει και έβδομη κόκκινη, `surface-authority-reachability`, που στο κλαδί είναι πράσινη. Κάτοχος: κανείς. Το ratchet του CHECK 3.54 είναι κι αυτό κόκκινο: 65 κόκκινες σουίτες απέναντι σε baseline 14 από τις 2026-08-25.
- **17 αρχεία αταξινόμητα** στην άγκυρα ιδιοκτησίας ADR-742 (`ownership-callsite-coverage-anchor`). Κανένα δεν είναι από αυτή τη δουλειά.
- **Δεν μετρήθηκαν** έργα ή κτίρια χωρίς `companyId` στην παραγωγή. Το ADR εξηγεί γιατί δεν αναμένεται επίπτωση, αλλά είναι συλλογισμός, όχι μέτρηση.
- **CHECK 3.51 Χ κόκκινο στο `main`, χωρίς κάτοχο.** Η διατύπωση «από το `b406ec18`» ήταν λάθος. Το oracle έχει 178 αποτυχίες και καμία επιτυχία από τις 2026-08-22· το `⛔ route-unreachable /area/ssr-probe HTTP 404` είναι ο μόνος λόγος που το μπλοκάρει σε όλα τα δείγματα από 2026-10-03 ως 2026-11-01. Αιτία: το `/area/[id]` του `152a6122` (ADR-890) απαντά σωστά 404 σε άγνωστη ταυτότητα, και ο χρησμός το χτυπά με το συνθετικό `ssr-probe`, χωρίς γραμμή στο `golden-catalog.js`. Στο CI είναι κόκκινες και δύο άγκυρες της ίδιας πύλης: το Γ1 (`i18n-ssr-golden`, λείπουν `cases/[engagementId]` και `files/[id]`) και το Β0 (`i18n-ssr-backend-contract`, λείπει το `area-market`).
- **Συντονίστρια:** σύμφωνα με τη Φ5, το handoff της Φ6α γράφει το `211e2d`, δηλαδή την προηγούμενη συνεδρία αυτού του worktree. Οι άλλες τρεις απάντησαν «όχι». Ο ρόλος περνά στη νέα συνεδρία εδώ. Δεν τον όρισε ρητά ο Giorgio: ζήτα του επιβεβαίωση.
- **Φ5 (`price-version-default-table-typography`, worktree `adr-923-phase5-publisher-b`):** ετοιμάζει έκδοση με τιμές στην παραγωγή, μόνο με ρητό ναι του Giorgio. Μην κάνεις land όσο τρέχει η απόδοση: ο διακομιστής θα επανεκκινήσει. Ειδοποίησέ την μαζί με τη Φ6α.
- **Για το ADR του ρόλου έργου (audit 2026-11-01):** ο κριτής έχει **έναν** καλούντα παραγωγής με `projectId`, το `landowner-unlink-check`, και **μηδέν** διαδρομές με `permissionOptions`. Από τον κώδικα, εκεί ένας `company_admin` που δεν είναι μέλος παίρνει `no_project_membership`· δεν επαληθεύτηκε ζωντανά. Ο αριθμός μελών στην παραγωγή είναι 0 σε 8 έργα **από μέτρηση 2026-09-16**, άρα πρέπει να ξαναμετρηθεί.

## Παγίδες

- Το `HANDOFFS/*.md` είναι στο τοπικό `exclude`: θέλει `git add -f`, με ρητή διαδρομή.
- Το `createEntity` κληρονομεί `companyId` από τον γονιό: νέα οντότητα με γονιό χωρίς `tenantCheck: true` κοκκινίζει την άγκυρα.
- Με `projectId` ο κριτής δεν ρωτά ποτέ καθολικό ρόλο. Μην προσθέσεις `permissionOptions` σε διαδρομή κτιρίου, γιατί κόβεις τον `company_admin`.
- Νέο πεδίο στο `BuildingUpdatePayload` θέλει γραμμή και στη λευκή λίστα, αλλιώς δεν μεταγλωττίζεται.
- Μετάλλαξη με script: επιβεβαίωσε ότι εφαρμόστηκε. Μία αρχική απέτυχε σιωπηλά, επειδή το μοτίβο έπιασε τον τύπο πιο πάνω στο αρχείο.
- Σύνθετες εντολές με `git` απορρίπτονται στο worktree. Σπάσε τες.

## ΜΗΝ

- ΜΗΝ τρέξεις `tsc` ή `next dev`.
- ΜΗΝ κάνεις commit στο `main`, `wt:land` ή push χωρίς εντολή Giorgio.
- ΜΗΝ αγγίξεις `useBOQItems` · `MeasurementsTabContent` · `useBOQEditorState` · `PublicationPricingFields.tsx`.
- ΜΗΝ κάνεις πληρωμένη κλήση AI χωρίς έγκριση κόστους, με συγκεκριμένο εύρος.
- ΜΗΝ εγκρίνεις τη σελ. 86, ούτε πρόταση των `cibat_ed46eace-…` · `cibat_1473aa04-…` · `cibat_bd061d40-…`.
- ΜΗΝ εγκρίνεις το `firebase-production` χωρίς ρητή εντολή του. ΜΗΝ σβήσεις αρχεία στο Storage χωρίς εντολή του.
- ΜΗΝ προσθέσεις γραμμή `buildings:*` στον `project_manager` πριν αλλάξει ο κριτής: θα ήταν νεκρή και παραπλανητική.
