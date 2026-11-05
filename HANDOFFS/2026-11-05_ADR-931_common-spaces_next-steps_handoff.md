# HANDOFF — ADR-931 Κοινόχρηστοι χώροι · μετά το Στάδιο Α (2026-11-05)

## Κατάσταση
- **Στάδιο Α ΟΛΟΚΛΗΡΩΘΗΚΕ και είναι στην παραγωγή**: commit `03a00dca` («feat(spaces): common spaces as a real entity … ADR-931 Stage A») στο `origin/main`, deploy στο nestorconstruct.gr.
- Οντότητα `common_spaces` (πρόθεμα `cspc`), API `/api/common-spaces` (+ `[id]`, `trash`), κανόνες Firestore (admin-write-only), καρτέλα κτιρίου «Κοινόχρηστοι», σελίδα `/o/[workspace]/spaces/common` χωρίς mock, hub `/spaces` με πραγματικό πλήθος.
- ADR: `docs/centralized-systems/reference/adrs/ADR-931-common-spaces-entity.md` (Στάδιο Β στο §6).
- Καμία αδέσμευτη δουλειά μου στο `main`.

## Ζωντανή επαλήθευση (nestorconstruct.gr, 2026-11-04)
- ✅ Καρτέλα κτιρίου «Κοινόχρηστοι»: φορτώνει, κενή κατάσταση + κουμπί «Νέος κοινόχρηστος χώρος».
- ✅ `/spaces/common`: τα mock νούμερα έφυγαν, οι 5 ομάδες δείχνουν 0.
- ❌ **BUG**: στο `/spaces/common` οι 4 κάρτες κεφαλίδας μένουν «…» (το `loading` δεν γίνεται ποτέ `false`) ⇒ η κενή κατάσταση δεν εμφανίζεται ποτέ.
- ❌ **Ίδιο bug στο `/spaces` hub**: όλες οι κάρτες «…», επειδή ο hook κοινοχρήστων μπαίνει στο OR του `isLoading`.
- Console: κανένα σφάλμα εφαρμογής.
- ⏸️ Create/edit/delete ΔΕΝ δοκιμάστηκαν (γράφουν σε παραγωγή — θέλει έγκριση Giorgio).

## ΕΠΟΜΕΝΟ ΒΗΜΑ #1 — διόρθωση του «κολλημένου loading»
Αρχεία:
- `src/hooks/useFirestoreCommonSpaces.ts` — `firestoreQueryService.subscribe('COMMON_SPACES', …)`, `loading` αρχικά `true`, προαιρετικό φίλτρο `buildingId`.
- `src/components/spaces/common/useCommonSpacesOverview.ts` — `loading = commonLoading || buildingsLoading`.
- `src/components/spaces/pages/SpacesCommonPageContent.tsx`, `src/components/spaces/pages/SpacesHubPageContent.tsx`.
Υποψίες (ΑΝΕΠΙΒΕΒΑΙΩΤΕΣ — μέτρα, μη μαντεύεις):
1. Το ερώτημα **χωρίς** `buildingId` (σε επίπεδο εταιρείας) — ίσως ο `subscribe` δεν καλεί ποτέ ούτε `onData` ούτε `onError` για νέα συλλογή (λείπει δείκτης; λείπει εγγραφή στο μητρώο tenant/collection config του `firestoreQueryService`;).
2. Πλαίσιο super-admin «Όλες οι δουλειές» (χωρίς companyId) — μπορεί το subscribe να μην ξεκινά καθόλου.
3. Να συγκριθεί γραμμή-γραμμή με `useFirestoreStorages` (που δουλεύει στην ίδια σελίδα hub).
Μέθοδος: localhost + Chrome, log στο callback, `read_network_requests` για το Listen channel. Μετά τη διόρθωση: test που κλειδώνει ότι το `loading` πέφτει και με κενό αποτέλεσμα και με σφάλμα.

## ΕΠΟΜΕΝΟ ΒΗΜΑ #2 — δείκτης για τον cron καθαρισμού κάδου
- Ο cron 05:00 UTC αποτυγχάνει με `FAILED_PRECONDITION` για `common_spaces (status, deletedAt)`.
- Η διόρθωση υπάρχει ήδη: commit `ce35e9b2` στο κλαδί `agent/common-spaces-purge-index` (άλλη συνεδρία): `firestore.indexes.json` + άγκυρα στο `purge-deleted-entities.job.test.ts` + γραμμή changelog ADR-931.
- ΔΕΝ είναι στο `main`. Θέλει εντολή Giorgio για `wt:land`/push (ή cherry-pick σε αυτό το worktree και land μαζί).

## ΕΠΟΜΕΝΟ ΒΗΜΑ #3 — (μόνο με έγκριση) ζωντανό CRUD
Δημιουργία δοκιμαστικού χώρου σε κτίριο → εμφάνιση στο `/spaces/common` σε πραγματικό χρόνο → edit (`_v`) → soft delete → επαναφορά από κάδο.

## Μετά — Στάδιο Β (ADR-931 §6)
1. Κάτοψη → χώρος (overlay role `common_space`, εμβαδόν από γεωμετρία).
2. Έξυπνες προτάσεις από στοίβα ορόφων (`pilotis`/`roof`/`stair-penthouse`, `hasElevator`) — ποτέ σιωπηλή μαντεψιά.
3. BOQ scope `common_areas` → πραγματικοί κοινόχρηστοι (`boq-target-properties.ts`).
4. Παροχές αγγελίας (RESO `AssociationAmenities`) παραγόμενες από χώρους `amenity`, με απόδειξη.
5. Συντελεστής κοινοχρήστων (IPMS/BOMA load factor) δίπλα στα χιλιοστά.

## Κρίσιμο πλαίσιο
- Route SSoT: `createSpaceEntityRoutes` (ADR-696) + `SPACE_ENTITY_CAPABILITIES` (`src/lib/spaces/space-entity-kinds.ts`, `transferable:false` για common_space, ΑΚ 1117).
- Λεξιλόγιο: `src/constants/common-space-categories.ts` (5 ομάδες, 22 κατηγορίες, IPMS/Revit/IFC).
- i18n namespace `common-spaces` (εκτός `common` λόγω προϋπολογισμού shell slice 53.500 bytes, CHECK 3.34).
- Πύλες που ΔΕΝ ξανατρέξαμε (σκοτώθηκαν από χαμηλή μνήμη): emulator rules suite, jscpd:diff.
- Κόκκινες σουίτες που ΔΕΝ είναι δικές μας: mandate-decision, tour-access-contact, workspace-segment, entity-deep-link-contract Α6.

## ΜΗΝ
- Μην κάνεις commit στο `main`· `wt:land` και push ΜΟΝΟ με εντολή Giorgio.
- Μην γράψεις δεδομένα στην παραγωγή χωρίς ρητή έγκριση.
- Μην τρέξεις tsc (N.17). Μην αγγίξεις worktrees άλλων πρακτόρων.
