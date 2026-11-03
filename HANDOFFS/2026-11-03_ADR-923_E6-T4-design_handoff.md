# HANDOFF — ADR-923 συντονιστής · Ε6 Τ4 σχέδιο έτοιμο · 2026-11-03 (συνεδρία 3)

**Worktree:** `C:\Nestor_Worktrees\adr-923-e6-quote` · **Κλαδί:** `agent/adr-923-e6-quote`.
**Βάση:** ο rebase πάνω στο `c04ce182` πέρασε χωρίς συγκρούσεις. Οι γεννήτορες i18n types και shell slice ξανάτρεξαν και δεν άλλαξε τίποτα.
⚠️ Το τοπικό `main` είναι πλέον `f41781e5`. Περιέχει κώδικα ADR-928 Φ1 (`firestore.rules`, `.subcontract-authority.json`), άρα πριν από το land χρειάζεται ξανά rebase.
**Διάβασε επίσης:** `HANDOFFS/2026-11-03_ADR-923_E6-T4_handoff.md`. Ό,τι γράφει εδώ υπερισχύει.

## Αποφάσεις (με κριτήριο την πρακτική των μεγάλων, εντολή Giorgio 2026-11-03)
1. **Τ4 = (β): ολόκληρο το `createRfq` σε ΜΙΑ `runTransaction`**, για όλες τις ροές (BOQ, ad-hoc, inline, κατάλογος). Ακολουθεί το πρότυπο Ariba/Coupa: το RFQ γεννιέται ατομικά, όλο ή τίποτα. Αν ξεπερνά το όριο εγγραφών, γίνεται άρνηση **πριν** από τη συναλλαγή.
2. **Α · Ε1:** σε κάθε εξαγωγή ο προμηθευτής διαλέγει **ρητά** το κοινό τιμών.
   - Προεπιλογή: η δημόσια τιμή καταλόγου, δηλαδή ο ανώνυμος θεατής (αντίστοιχο του `net_list` του BMEcat).
   - Εναλλακτικά: μία λίστα πελάτη, το `priceListId` (αντίστοιχο του `net_customer`).
   - Κάθε αρχείο έχει **ένα** κοινό. Η αναφορά γράφει λίστα, έκδοση και ημερομηνία.
3. **Α · Ε2:** τα κρυφά SKU **δεν** εξάγονται. Κρίνονται με την ίδια ετυμηγορία ορατότητας για το επιλεγμένο κοινό (`quoteWithin` → `visibility`) και μετρώνται στην αναφορά.
4. **Β:** η τελική έκδοση **αρνείται** QR με βάση URL που δεν είναι δημόσια `https` (localhost, http, ιδιωτικές IP). Η άρνηση φέρει σταθερό κωδικό σφάλματος.

## Αναθέσεις Α/Β: ΔΕΝ τρέχουν
Οι πράκτορες παρασκηνίου μπλόκαραν: ο φρουρός του worktree αρνήθηκε το Bash τους, επειδή ο φάκελος εργασίας τους ήταν το κύριο αντίγραφο. Δεν έγραψαν τίποτα. Ο Giorgio ανοίγει νέες συνεδρίες **μέσα** στα δύο worktrees. Μόλις φανούν στο `ListAgents`, ο συντονιστής τους στέλνει τις αποφάσεις 2–4 και τα ευρήματα:
- **Α:**
  - Η μηχανή τιμής είναι το `quoteWithin` (`server/catalog/price-quote.server.ts:134`). Το `priced` γίνεται `GrossListPrice`. Τα `noPriceList`, `noVersion`, `noLine`, `ambiguous*` γίνονται `PriceOnRequest`, με μέτρηση ανά αιτία.
  - Η διαδρομή χτίζεται με τα εργαλεία του `app/api/catalog/_shared/catalog-route.ts` και χρειάζεται εργαλείο αρχείου **χωρίς** `[id]`. Δικαίωμα: `authority: 'pricingView'`. Κεφαλίδες: όπως στο `publications/[id]/download`.
  - Το ODC-BY δεν θέλει αναφορά πηγής, γιατί εξάγονται μόνο κωδικοί.
- **Β:**
  - Γεννήτορας QR υπάρχει ήδη: `src/lib/qr/qr-code.ts`, `qrSvg(payload, preset)`. Το preset `print` έχει διόρθωση Q και ζώνη ησυχίας 4. Βασίζεται στο `qrcode@1.5.4` (MIT), άρα **κανένα νέο πακέτο**.
  - Η μία πηγή της απόλυτης βάσης URL **δεν βρέθηκε ακόμη**. Το `NEXT_PUBLIC_APP_URL` είναι `localhost` στο μηχάνημα του Giorgio, άρα ισχύει η απόφαση 4.
  - Το πρότυπο είναι στο `server/catalog/publishing/typst-template.ts`. Οι τιμές βγαίνουν από το `publication-prices.server.ts`.

## Τ4 — σχέδιο (μετρημένο στον κώδικα, δεν έχει γραφτεί ούτε γραμμή)
**Αρχεία:**
- Νέο `services/rfq-create-plan.ts`, για ό,τι γίνεται εκτός συναλλαγής.
- Νέο `services/rfq-create-transaction.ts`, για το σώμα της συναλλαγής.
- Το `createRfq` στο `rfq-service.ts` γίνεται λεπτό. Σήμερα έχει 90 γραμμές και το αρχείο 465.

**Πριν από τη συναλλαγή** (async, χωρίς κλειδώματα):
- `resolveQuoteSku` για κάθε `catalogLine`. Τιμή `null` ⇒ άρνηση `catalogSkuUnavailable`.
- `readPublicSupplier(supplier).legalName` για κάθε προμηθευτή.
- `prepareVendorInvite` για **κάθε** παραλήπτη. Το `contactId` της επαφής πλατφόρμας είναι **ντετερμινιστικό** (`generateDeterministicPlatformCompanyContactId(buyer, supplier)`), άρα η πρόσκληση προετοιμάζεται πριν από τη συναλλαγή.
- `resolvePerformer`.
- Μέτρηση εγγραφών: RFQ + γραμμές + 2 ανά πρόσκληση + επαφές + sourcing event. Ξεπέρασμα του ορίου ⇒ άρνηση `rfqTooLarge`.

**Μέσα στη συναλλαγή** (όλες οι αναγνώσεις πριν από κάθε εγγραφή):
- BOQ items με `tx.get(query in)`. Ο φράκτης tenant μένει όπως είναι.
- `quoteIntake` κάθε προμηθευτή με `tx.get`, ώστε το κλείσιμο του opt-in να κερδίζει τον αγώνα.
  - ⚠️ Το CHECK 3.106 απαγορεύει `catalogDocRef(` και `runForeignCatalogRead(` έξω από τα δηλωμένα αρχεία.
  - Πρόταση: νέα εξαγόμενη `readQuoteIntakeInTx(tx, db, supplierCompanyId)` μέσα στο **δηλωμένο** `server/catalog/public/public-model-snapshot.server.ts` (158 γραμμές). Χτίζει σκοπιά πάνω στη συναλλαγή του καλούντα και καλεί `readOwnedOrNull(scope, 'supplierProfile', generateDeterministicCatalogSupplierProfileId(id))` + `storedQuoteIntakeOf` + `quoteIntakeAccepts`. Όχι ⇒ `supplierNotAcceptingQuotes`.
  - Επιβεβαίωσε με τον γεννήτορα της πύλης ότι μένει πράσινη, χωρίς εξαίρεση.
- `resolvePlatformCompanyContact` ανά προμηθευτή. Τιμή `refused` ⇒ `supplierContactUnavailable`.
- Μετά οι εγγραφές: RFQ, γραμμές (`displayOrder` από 0, γιατί το RFQ είναι νέο και δεν χρειάζεται `count`), προσκλήσεις, νέες επαφές, `arrayUnion` στο sourcing event.

**Μετά το commit:**
- `recordAccountContactBirth` μόνο για `new`, με origin `platformCompanyId`.
- Το audit των ad-hoc γραμμών, όπως σήμερα στο `addRfqLinesBulk`.
- Αποστολή email (fire-and-forget, όπως σήμερα).

**Τύποι και σύνορο:**
- `RfqLineSource` += `'catalog'`.
- `CreateRfqDTO.catalogLines?: {supplierCompanyId, modelId, variantId, quantity, unit}[]` και το ίδιο στο `CreateRfqSchema`. Το `z.object` **κόβει** αδήλωτα κλειδιά.
- Νέο όριο `RFQ_CATALOG_LINES_MAX` (πρόταση 20).
- `defaultResponseLock`: `'catalog'` ⇒ **κλειδωμένο**, όπως το BOQ.
- `linesStorage`: `'catalog'` όταν υπάρχουν μόνο γραμμές καταλόγου. Για μικτές μορφές, απόφασε με βάση τη σειρά του `linesStorage` στο `rfq-service.ts`.
- `rfq-dashboard-stats.ts` `linesSourceText`: σήμερα μετρά `adHoc = lines.length - boq`, άρα οι γραμμές καταλόγου θα μετρηθούν ως ad-hoc. **Διόρθωσέ το** και πρόσθεσε κλειδί i18n σε el + en.
- `RfqBuilder.tsx:42,322,329,356,358`.
- Γραμμή καταλόγου: `catalogRef` = `ref`, `priceSnapshot: null` (Ε4), `boqItemId: null`. Η περιγραφή **ποτέ από τον πελάτη**:
  - Διαδρομή `public`: `foreignSkuRowText({code, label})` της δημόσιας παραλλαγής (`public-catalog-schema.ts`: `variants[].code/label`).
  - Διαδρομή `relationship`: νέα συνάρτηση στο `supply-foreign-quote.server.ts`, στην **ίδια** ξένη ανάγνωση με το `quoteInScope`, με `readOwnedOrNull(scope, 'product', variantId)`. ⚠️ Το είδος του καταλόγου είναι **`'product'`**, όχι `'variant'` όπως έγραφε το προηγούμενο handoff. Από το `derived.identifier` και το `derived.label`.
  - Το `resolveForeignSku` (καλείται και από το `material-service.ts:96`) να **αναθέτει** στη νέα συνάρτηση, όχι δίδυμο. Το `resolveQuoteSku` επιστρέφει επιπλέον `text`.
- Γενίκευση του `writePreparedVendorInvite(batch, …)` στο κοινό `{ set }` του `WriteBatch` και του `Transaction`. Όχι αντίγραφο.
- Το `buildRfqLine` και το `boqItemToLineDto` του `rfq-line-service.ts` γίνονται εξαγόμενα, ώστε να τα χρησιμοποιεί η συναλλαγή. Τα `snapshotFromBoq` και `addRfqLinesBulk` μένουν για τα δύο routes `lines/bulk` και `lines/snapshot`.

**Σφάλματα:**
- ⚠️ Το μοτίβο `errorCode` του `a2eec6fc` (`procurement-error-outcome.ts`) ζει **μόνο** στο κλαδί `agent/adr-923-phase3-close`, χωρίς land. Στο `main` υπάρχει το `ApiError(status, message, errorCode)` (`lib/api/api-error-types.ts`).
- Κλειστή ένωση `RFQ_CREATE_REFUSALS` με τιμές `catalogSkuUnavailable`, `supplierNotAcceptingQuotes`, `supplierContactUnavailable` και `rfqTooLarge`. Κλάση σφάλματος με `errorCode`.
- Το `app/api/rfqs/route.ts` (raw `withAuth`, όλα 400) χαρτογραφεί το `errorCode` στο σύρμα. Οι μεταφράσεις του κωδικού γίνονται στο Τ6, όπου υπάρχει UI.
- Έλεγξε τα CHECK 3.92 (ιδεμποτία στο POST), 3.78, 3.35 και 3.15/3.91 για το `in` query μέσα στη συναλλαγή.

**Boy Scout (N.0.2), μετρημένο διπλότυπο:**
- `BATCH_WRITE_LIMIT` υπάρχει **δύο** φορές με **διαφορετική** τιμή: `lib/admin-batch-utils.ts:42` = 450 και `config/firestore-collections.ts:1686` `FIRESTORE_LIMITS.BATCH_WRITE_LIMIT` = 500.
- Η μέτρηση εγγραφών του Τ4 θέλει **ένα** όριο. Βρες τους καταναλωτές και κράτα ένα SSoT, με το περιθώριο ασφαλείας ως ονομασμένη παράγωγη τιμή.
- Το επίσημο όριο συναλλαγής της Firestore **δεν επιβεβαιώθηκε**: οι πηγές διαφωνούν (500 εγγραφές έναντι 10 MiB). Άνοιξε το `https://firebase.google.com/docs/firestore/quotas` πριν γράψεις τον αριθμό.

**Τεστ:** jest στα δύο νέα αρχεία, μεταλλάξεις σε κάθε άρνηση και στη σειρά «αναγνώσεις πριν από εγγραφές». Το εργαλείο μεταλλάξεων είναι στο `C:\Users\user\AppData\Local\Temp\claude\1c02e97d58ef4167\0f9bf493-7cff-4d80-9e87-63c8ec34ab82\scratchpad\mutate.js`.
