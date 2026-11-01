# ADR-923 Φάση 6β: σχέδιο v2 (χωρίς κώδικα)

**Μετρήθηκε στο:** `main` @ `8513466c`, 2026-11-01. Η v2 ενσωματώνει τον έλεγχο του συντονιστή.
**Κατάσταση:** πρόταση προς έλεγχο από τον συντονιστή και έγκριση Giorgio. Καμία αλλαγή στο repo.
**Εύρος:** §9 γραμμή 6, §5.7, §12, §13. Το SKU στο BOQ είναι Φ6α, εκτός εύρους.

---

## 1. Συμπέρασμα

1. **Το Κοινό Λεξικό (§17) ΔΕΝ χρειάζεται να προηγηθεί.** Χρειάζεται πριν από τη Φ8. Δες §5.
2. **Προηγείται η επιβεβαίωση επιχείρησης (§16), αλλά δεν χτίζεται από την αρχή.** Η αυτόματη επαλήθευση ΓΕΜΗ, με ταίριασμα επωνυμίας, υπάρχει ήδη (ADR-841 Α23) και μένει να δεθεί στον προμηθευτή. Έλεγχος ΑΦΜ **δεν** υπάρχει: ούτε ΑΑΔΕ/VIES, ενώ το `afm` του ΓΕΜΗ αγνοείται επίτηδες.
3. **Η βιτρίνα σήμερα ΔΕΝ μπορεί να φανεί στις μηχανές αναζήτησης.** Το `public/robots.txt` κλείνει τα πάντα και το middleware απαντά 403 σε `googlebot`. Το §13 υπόσχεται «πλήρες SEO». Θέλει απόφαση Giorgio, γιατί αφορά ολόκληρο τον ιστότοπο και όχι μόνο τον κατάλογο.
4. **Πρόταση για το §12:** κανένα χρηματικό ποσό στο δημόσιο έγγραφο, ούτε η ανώνυμη τιμή. Το §12 θα επέτρεπε την ανώνυμη· προτείνω αυστηρότερο κανόνα, με λόγους στο §4.
5. **Ανώνυμη τιμή θέλει απόφαση ΦΠΑ.** Οι γραμμές είναι καθαρές χωρίς ΦΠΑ, ενώ η Οδηγία 98/6 ορίζει για καταναλωτή τελική τιμή με ΦΠΑ.
6. **Εκτίμηση: 8–11 ημέρες εργασίας με τον σημερινό ρυθμό**, όχι 4–6 που είχα πει στον Giorgio πριν από τον έλεγχο. Η διαφορά: §16, άνοιγμα SEO, επαναπροβολή, μέσα με δικαιώματα. Το σύνολο του ADR γίνεται περίπου 29–45 ημέρες.

---

## 2. Έλεγχος SSoT: τι υπάρχει

### Ξαναχρησιμοποιείται

| Τι | Πού | Χρήση στη Φ6β |
|---|---|---|
| Μία κρίση τιμής για γνωστό θεατή | `src/server/catalog/price-quote.server.ts` `quoteWithin` | Ίδια συνάρτηση, με `{ kind: 'anonymous' }` ή θεατή από σχέση. Κρίνει ορατότητα μέσα στη συναλλαγή |
| Κρίση ορατότητας | `src/subapps/catalog/pricing/visibility.ts` `judgeVisibility` · `showsProduct` · `showsPrice` | Ποιοι μπαίνουν στη δημόσια προβολή. Προεπιλογή `hidden` |
| Ανάγνωση ξένου καταλόγου | `src/server/catalog/catalog-store.server.ts` `runForeignCatalogRead` | Μόνο ανάγνωση. ⛔ Δεν κρίνει αν επιτρέπεται: ο καλών ρωτά πρώτος. Οι αναγνώστες είναι δηλωμένοι (CHECK 3.106) |
| Τιμή προς αγοραστή | `src/server/supply-relationships/supply-foreign-quote.server.ts` | Για συνδεδεμένο αγοραστή. Θέλει `relationshipId`· στη βιτρίνα χρειάζεται εύρεση σχέσης από τον προμηθευτή (`readActiveSupplyRelationshipInTx`) |
| Μαζική επίλυση τιμών | `src/server/catalog/publishing/publication-prices.server.ts` | Μοτίβο μόνο: λύνει στη στιγμή ισχύος της έκδοσης, όχι στο «τώρα» |
| Πρότυπο δημόσιας προβολής | `src/services/listings/publish-public-listing.ts` · `src/lib/listings/public-listing-schema.ts` · `public-listing-from-document.ts` | `set()` ολόκληρου ή `delete()`, `schemaVersion`, migrations, σύνορο ανάγνωσης |
| Σύνορο ανάγνωσης | `scripts/check-public-listing-read-boundary.js` `BOUNDARIES` (CHECK 3.74) | Μία γραμμή ανά συλλογή, όχι νέο script |
| Κανόνες δημόσιας συλλογής | `firestore.rules` `public_listings` · `agency_profiles` | `allow read: if true; allow write: if false;`. Το `agency_profiles` τεκμηριώνει ότι η άμυνα σε απαρίθμηση είναι ο opt-in πληθυσμός |
| Ψευδώνυμο και κανονική διεύθυνση | `src/app/(light)/pro/[alias]/page.tsx` · `src/lib/workspace/alias-registry` | Τρεις εκβάσεις, ίδια απάντηση για ανύπαρκτο και αδημοσίευτο, 308 στην κανονική, 5xx για «δεν μπόρεσα να ρωτήσω» |
| Δομημένα δεδομένα | `src/components/seo/JsonLdScript.tsx` · `src/lib/seo/json-ld.ts` | Ένας δρόμος JSON-LD από τον διακομιστή |
| QR | `src/lib/qr/qr-code.ts` `qrSvg` με προεπιλογή `print` | Διόρθωση Q, ήσυχη ζώνη 4. Κανένα δεύτερο QR |
| Δικαιώματα μέσων | `src/subapps/catalog/types/asset.ts` `rights: MediaRights` | Φίλτρο πριν από δημόσια έξοδο |
| Δημόσιο ράφι μέσων | `src/services/listings/publish-public-listing-shelf.ts` · `listing-media-sources.ts` | Μοτίβο αντιγραφής σε δημόσια διαδρομή. ⚠️ Δεν ελέγχθηκε αν γενικεύεται χωρίς αλλαγή |
| Κανάλι βιτρίνας | `src/subapps/catalog/vocabulary/channels.ts` `storefront` | Τιμές και πληρότητα ανά κανάλι |
| Δημόσια φόρμα χωρίς σύνδεση | `src/app/api/first-contacts/guest/route.ts` (`withHeavyRateLimit`) | Μοτίβο για ανώνυμο αίτημα |
| Πρόγραμμα cron | `src/config/cron-schedule.ts` (SSoT, ADR-740), `slug: 'publication-run-sweep'` | Δήλωση + `src/lib/cron/jobs/<slug>.job.ts` + route. Το `cron-route-contract.test.ts` επιβάλλει εξαντλητικότητα και guard |
| Επαλήθευση ΓΕΜΗ | `src/services/company-registry/company-registry-verification.service.ts` `verifyRegistryIdentity` · `POST /api/companies/registry-verification` | Πράξη ανθρώπου που ρωτά το μητρώο. ⛔ Κανένα cron ή trigger: κάθε κλήση αντιστοιχεί σε ανθρώπινη χειρονομία |
| Κρίση ταυτότητας και επωνυμίας | `src/lib/company/registry-identity-judgment.ts` `judgeRegistryIdentity` · `src/lib/company/legal-name-match.ts` `sameLegalName` | Καθαρή. Έξι ερωτήσεις, ανάμεσά τους ενεργή εταιρεία και `name-mismatch`. Το «επαληθευμένο» παράγεται, δεν αποθηκεύεται |
| Ανανέωση μετά από αλλαγή εισόδου | `src/services/company/company-rename.service.ts` `reconcileShowcaseLegalIdentity` · `src/services/mandate/showcase-legal-identity-custody.ts` | Ένα σημείο εισόδου που καλούν ήδη `accounting/setup`, `registry-verification`, `agency-profile/card` |
| Ακύρωση μνήμης από γραφέα | `src/services/landing-hero/landing-hero-publication.ts:223` · `landing-hero-cache-tag.ts` · `landing-hero-reader.ts` | `unstable_cache` με tag στον αναγνώστη, `revalidateTag` στον γραφέα, tag σε δικό του αρχείο |
| Σήμα μέσα σε συναλλαγή | `src/server/catalog/pricing-view-signal.server.ts` · `catalog-store.server.ts` `noteWrite` | Μοτίβο του outbox, δες §4.2 |

### Δεν υπάρχει

| Τι | Συνέπεια |
|---|---|
| Δημόσια συλλογή καταλόγου | Νέα, με κανόνες, δείκτες, σύνορο |
| `slug` στον κατάλογο | Φιλικές διευθύνσεις από την αρχή |
| Πεδίο πλατφόρμας GTIN / MPN / μάρκα στους τύπους | Μπορεί να είναι ιδιότητα χρήστη. Το JSON-LD θέλει ρητή αντιστοίχιση |
| Πεδίο ΦΠΑ στη γραμμή τιμής (`price-list.ts:150`: καθαρή χωρίς ΦΠΑ) | Απόφαση Ε3 |
| `sitemap` | Νέο |
| `cacheHandler` στο `next.config.js` | ISR στον δίσκο του container, κάτι που αρκεί για μία μονάδα |
| Δέσιμο της κρίσης ΓΕΜΗ με προμηθευτή: η ανανέωση γράφει μόνο `agency_profiles` | Νέα όψη στο Σ1 |
| Έλεγχος ΑΦΜ. Καμία ενσωμάτωση ΑΑΔΕ/VIES· το `accounting/setup/route.ts:66-67` ελέγχει μόνο 9 ψηφία. Το ΓΕΜΗ επιστρέφει `afm`, αλλά ο αναλυτής το αγνοεί **επίτηδες** (`gemi-opendata-parse.ts:17`, ελαχιστοποίηση δεδομένων) | Απόφαση Ε1β |
| `revalidateTag` σε cron ή job | Νέα χρήση, θέλει ζωντανό έλεγχο |
| QR στον εκδότη | Νέα σύνδεση |
| Δεσμός `Material` → SKU · `variantId` σε RFQ/quote | §5.8 ανεκπλήρωτο |

⚠️ **Διόρθωση του ADR:** το §5.1 λέει ότι η ικανότητα οργανισμού (ADR-824) επιτρέπεται μόνο για ρυθμιζόμενη δραστηριότητα. Άρα η έγκριση προμηθευτή **δεν** μπαίνει στο `ORGANIZATION_CAPABILITIES`.

---

## 3. Έρευνα

| Παίκτης | Τι βρέθηκε | Βάση | Τι κρατάμε |
|---|---|---|---|
| Google Merchant listings | Απαιτεί `name`, `image`, `offers`· τιμή **> 0**· μόνο σελίδες όπου αγοράζεις· robots/noindex/login αποκλείουν· `priceValidUntil` παρελθοντικό μπορεί να κρύψει το αποτέλεσμα | ✅ πρωτογενής | Ο Νέστωρ δεν πουλά online, άρα **όχι** merchant listing |
| Google Product snippet | `name` + ένα από `review` · `aggregateRating` · `offers`· δέχεται `AggregateOffer` | ✅ πρωτογενής | Σελίδα χωρίς τιμή και χωρίς κριτικές **δεν** παίρνει snippet. Ποτέ `price: 0` |
| Next.js | `generateSitemaps`, 50.000 URL ανά αρχείο· ISR στον δίσκο όταν είναι self-hosted | ✅ πρωτογενής | Sitemap ανά τμήμα |
| Grainger | Ανώνυμος βλέπει list price, η τιμή λογαριασμού μετά τη σύνδεση | ⚠️ δευτερογενής (οδηγοί συμβάσεων) | Σελίδα ίδια για όλους, τιμή λογαριασμού χωριστά |
| Shopify B2B | Κατάλογος ανατίθεται σε αγορά ή τοποθεσία εταιρείας και ορίζει προϊόντα και τιμές | ✅ πρωτογενής· το τι βλέπει ο επισκέπτης **δεν** επαληθεύτηκε | Επιβεβαιώνει το σχήμα κοινού |
| Salesforce B2B | `CanViewProduct` · `CanViewPrice`, `false` εξ ορισμού | Από το ADR §5.12, δεν ξαναμετρήθηκε | Ίδιο με `showsProduct` / `showsPrice` |
| Alibaba | Σήμα Verified Supplier σε αναζήτηση, προϊόν, προφίλ | ✅ πρωτογενής για το σήμα· ❌ ανεπαλήθευτο τι τιμές δείχνει | Σήμα επιβεβαίωσης, §16 |
| Skroutz | Απαιτούνται Unique ID · Name · Link · Image · Category · Price · VAT Rate · Availability · Manufacturer · MPN · EAN · Description · Quantity. Το Unique ID μένει ίδιο σε όλη τη ζωή του προϊόντος και δεν επαναχρησιμοποιείται | ✅ πρωτογενής: `developer.skroutz.gr/products/xml_feed`. Το `feedspec` επιστρέφει κενό και το `partnersupport` 403 | Αμετάβλητο id σε διεύθυνση και QR. Μελλοντική ροή θέλει EAN, MPN, κατασκευαστή, ΦΠΑ, ποσότητα, που σήμερα δεν είναι πεδία πλατφόρμας |
| Zillow | Ροή αγγελιών με `Status` · `Price` · `ListingUrl` · `MlsId` και αναγνωριστικό παρόχου. Η πολιτική ποιότητας ζητά ενημέρωση τουλάχιστον ημερήσια και απορρίπτει ροές χωρίς φωτογραφίες ή στοιχεία. Μέσω Bridge το MLS ορίζει ανά άδεια ποια πεδία εκτίθενται. Δωρεάν προφίλ με κατάλογο επαγγελματιών | ✅ τεχνική προδιαγραφή, κείμενο PDF, έκδοση χωρίς ημερομηνία που να επαληθεύτηκε, και τεκμηρίωση Bridge. ⚠️ Η πολιτική μόνο από απόσπασμα του zillow.com (άμεση ανάγνωση 403). ❌ Δεν βρέθηκε δημόσια πηγή για την εσωτερική αρχιτεκτονική | Αντικείμενο με σταθερό id και ελάχιστη πληρότητα πριν δημοσιευτεί. Έλεγχος πεδίων ανά κοινό, όπως η άδεια του Bridge |
| Idealista | Σελίδα ανά επαγγελματία στο `/pro/<slug>/venta-viviendas/`, με αγγελίες και δημόσιο ποσοστό ποιότητας δημοσίευσης. Χωριστή σελίδα υπηρεσιών για επαγγελματίες. API με αίτημα πρόσβασης | ⚠️ αποσπάσματα από το ίδιο το idealista.com· η άμεση ανάγνωση δίνει 403. ❌ Δεν βρέθηκε δημόσια τεκμηρίωση για ροές, όρους API ή αρχιτεκτονική | Πρόθεμα επαγγελματία και ορατό δείκτη ποιότητας, που συμφωνεί με το §5.7 #6 |
| BIMobject | Σελίδες μάρκας, φιλοξενία αρχείων, στατιστικά λήψεων | ⚠️ δευτερογενής | Στατιστικά, αργότερα |
| GS1 Digital Link | Σύνταξη URI, όχι φορέας. Κατά ορισμένες πηγές το ESPR δεν την επιβάλλει, ενώ πωλητές εργαλείων ισχυρίζονται το αντίθετο. Το QR δεν αποδεικνύει γνησιότητα | ⚠️ ανεπαλήθευτο στο κείμενο του κανονισμού | Προαιρετικό όταν υπάρξει GTIN |
| Οδηγία 98/6 | Τιμή πώλησης = τελική με ΦΠΑ, σε συμβάσεις με καταναλωτή. Άρθρο 6α: προηγούμενη τιμή = η χαμηλότερη 30 ημερών σε ανακοίνωση έκπτωσης | ✅ EUR-Lex για το πεδίο και τον ορισμό· ⚠️ το 6α από σχολιασμούς | Ε3 |
| DSA άρθρο 30 | Marketplace που συνάπτει εξ αποστάσεως συμβάσεις με καταναλωτές συλλέγει και ελέγχει στοιχεία εμπόρου | ⚠️ δευτερογενής· η εξαίρεση πολύ μικρών **δεν** επαληθεύτηκε | Νομική ερώτηση, Ε7 |

**Πηγές:**
[Merchant listing](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing) ·
[Product snippet](https://developers.google.com/search/docs/appearance/structured-data/product-snippet) ·
[generateSitemaps](https://nextjs.org/docs/app/api-reference/functions/generate-sitemaps) ·
[Next cache handler](https://nextjs.org/docs/app/api-reference/next-config-js/incrementalCacheHandlerPath) ·
[Shopify B2B catalogs](https://help.shopify.com/en/manual/b2b/catalogs/overview) ·
[Skroutz XML Feed](https://developer.skroutz.gr/products/xml_feed/) ·
[Zillow Listings Feed Guide](https://www.zillow.com/static/pdf/feeds/ZillowBrokerFeedsTechnicalSpecV1.0.20.pdf) ·
[Zillow Listings Quality Policy](https://www.zillow.com/corporate/quality/) ·
[Bridge docs](https://bridgedataoutput.com/docs/platform/API/bridge) ·
[idealista για επαγγελματίες](https://www.idealista.com/en/nuevo-profesional) ·
[idealista, σελίδα επαγγελματία](https://www.idealista.com/en/pro/living-inversiones/venta-viviendas/) ·
[Alibaba Verified Supplier](https://seller.alibaba.com/businessblogs/what-is-a-verified-supplier-on-alibabacom-px001z0dr) ·
[Οδηγία 98/6](https://eur-lex.europa.eu/eli/dir/1998/6/2022-05-28/eng) ·
[Freshfields για DSA](https://technologyquotient.freshfields.com/post/102lx12/dsa-decoded-9-the-dsa-and-online-marketplaces) ·
[GS1 για DPP](https://gs1.eu/wp-content/uploads/2025/07/Implementation-Considerations-for-Unique-DPP-Product-Identifiers_GS1.pdf) ·
[Arianee για GS1 Digital Link](https://www.arianee.com/en/blog/do-you-have-to-use-gs1-digital-link) ·
[Publitas για QR](https://www.publitas.com/blog/qr-codes-for-catalogs/) ·
[Zillow agent finder](https://www.zillow.com/agents/agent-finder-searchable-directory) ·
[BIMobject](https://business.bimobject.com/faq/)

---

## 4. Σχεδιαστικές προτάσεις

### 4.1 Δημόσιο έγγραφο χωρίς κανένα χρηματικό ποσό

| | Α: ανώνυμη τιμή στο έγγραφο | **Β: καμία τιμή στο έγγραφο (πρόταση)** |
|---|---|---|
| §12 | Τηρείται με πειθαρχία | Τηρείται δομικά: κλειστό σχήμα, δοκιμή απαγορευμένων κλειδιών |
| Όρια ισχύος εκδόσεων και εκπτώσεων | Χρειάζεται ρολόι επαναπροβολής, αλλιώς μπαγιάτικη τιμή | Λύνεται στο render |
| Νέα έκδοση τιμοκαταλόγου | Επαναπροβολή όλων των SKU | Τίποτα |
| Κόστος | Χαμηλό σε αναγνώσεις | Αναγνώσεις στο render, με όριο από το ISR |
| Μηχανές τιμής | Κίνδυνος δεύτερης αλήθειας | Μία |

Στο Β, η ανώνυμη τιμή μπαίνει στο ISR HTML, λύνεται από τον διακομιστή, και μπορεί να καθυστερήσει όσο το παράθυρο ISR. Η τιμή συνδεδεμένου έρχεται από route `no-store` σε νησίδα πελάτη.

🔴 **Κόκκινη γραμμή:** προσωποποιημένη τιμή δεν μπαίνει ποτέ σε ISR HTML.

⚠️ Το `quoteWithin` λύνει ένα SKU ανά κλήση. Σελίδα με πολλές παραλλαγές θέλει μαζική εκδοχή που καλεί την ίδια κρίση. Η ορατότητα ξανακρίνεται στη στιγμή της τιμής, επειδή η προβολή μπορεί να έχει καθυστερήσει.

### 4.2 Επαναπροβολή: ένα σημείο, όχι διάσπαρτες κλήσεις

**Μετρημένο:**

- **Το `scope.changes` ΔΕΝ είναι το σωστό σημείο.** Γεμίζει μόνο από `stageCreate` και `stageRevision` (γραμμές 300, 342). Τα `stageDerived` και `stageCopied` δεν γράφουν εκεί, ενώ το `derived` κρατά δεδομένα που δημοσιεύονται, όπως η ετικέτα.
- **Το σωστό σημείο είναι το `noteWrite`** (`catalog-store.server.ts:264`): το καλούν και τα τέσσερα `stage*` (γραμμές 301, 320, 343, 378), και εκεί μπαίνει ήδη το `pricingViewsOfWrite`.
- **Καλούντες με δημοσιεύσιμες αλλαγές:** 12 αρχεία, 33 κλήσεις `runCatalogTransaction`: `asset-writer` 4 · `attribute-group-writer` 3 · `attribute-writer` 3 · `catalog-settings-writer` 1 · `category-writer` 4 · `completeness-recompute` 1 · `family-writer` 3 · `import-apply` 1 · `measurement-family-writer` 3 · `product-model-writer` 3 · `product-writer` 4 · `visibility-rule-writer` 3. Με το άγκιστρο στο `noteWrite` κανείς τους δεν αλλάζει, και νέος καλών καλύπτεται αυτόματα.
- **Είδη που ενδιαφέρουν:** 10 από τα 21 του `CATALOG_KIND_SPECS`: `attribute` · `attributeGroup` · `measurementFamily` · `category` · `family` · `productModel` · `product` · `asset` · `settings` · `visibilityRule`.
- **Έξω από το `noteWrite`:** (α) `ensureCatalogAssetRenditions` (`catalog-asset-renditions.server.ts:189`, γράφει `catalogRenditions` στο έγγραφο αρχείου) · (β) επωνυμία και ταυτότητα, από τον χώρο της εταιρείας · (γ) διαγραφή αρχείου, **δεν** μετρήθηκε. Τα (α), (β) θέλουν ρητή κλήση, το (γ) το καλύπτει η σάρωση.

**Επαναχρήση:** το **μοτίβο**, όχι το έγγραφο.

| Τι ξαναχρησιμοποιείται | Τι όχι, και γιατί |
|---|---|
| Καθαρή συνάρτηση «ποια γραφή αγγίζει τι» δίπλα στο `pricingViewsOfWrite` | Το `PricingView` έχει μόνο `lists` · `list` · `discounts` · `supply`: κανένα μη τιμολογιακό είδος και κανένα id μοντέλου |
| Συλλογή στο `noteWrite`, μία εγγραφή `tx.set` μετά το σώμα, στο ίδιο σημείο με το `signalPricingViewsInTx` (γραμμή 101) | Το σήμα το ακούει οθόνη και αυξάνει απλώς αριθμό. Το outbox θέλει και `drainedRevision` για τον αδειαστή |
| Ένας γραφέας + πύλη AST με μητρώο JSON, στο πρότυπο 3.99 | Η 3.99 **δεν** φυλά το σήμα τιμών: το `.view-signal-authority.json` δεν αναφέρει κατάλογο. Το αναφέρει το `check-catalog-schema-authority.js` (CHECK 3.106) |

**Σχήμα:** `catalog_public_outbox`, με ντετερμινιστικό id, ένα έγγραφο ανά `{ companyId, scope }`, όπου `scope` = `model:<id>` ή `catalog`. Γραφή `{ revision: increment(1) }`. Το `product` οδηγεί στο μοντέλο του, ενώ `attribute`, `category`, `family`, `settings` και `visibilityRule` επιπέδου καταλόγου δίνουν `catalog`.

**Άδειασμα με CAS:** διάβασε `R` → πρόβαλε → σε συναλλαγή γράψε έγγραφο και `drainedRevision = R`. Αλλαγή στο ενδιάμεσο αφήνει το έγγραφο βρώμικο. Άμεση κλήση μετά το commit, cron ως δίχτυ.

- Ιδεμπότητα: `set()` ολόκληρου ή `delete()`.
- `catalog` σε μεγάλο χώρο: τμηματική εκτέλεση με δρομέα.
- ⚠️ Το `noteWrite` τρέχει και για `importBatch` κ.ά.· η καθαρή συνάρτηση επιστρέφει κενό για αυτά, ώστε να μη μεγαλώνει η συναλλαγή. Να μετρηθεί σε εισαγωγή μεγάλης παρτίδας.

### 4.3 Πληθυσμός

- Στο δημόσιο έγγραφο μπαίνει μόνο ό,τι βλέπει ο ανώνυμος, δηλαδή `showsProduct` για `anonymous`.
- SKU μόνο για `signedIn` ή συνεργάτη **δεν** μπαίνει. Το βλέπει ο αγοραστής μέσα στην εφαρμογή, από τη Φ6α.
- Κρυφό και ανύπαρκτο δίνουν ταυτόσημη απάντηση.
- Πυκνότητα εγγράφου: ένα έγγραφο ανά μοντέλο, με προσοχή στο όριο 1 MiB για οικογένειες με πολλές παραλλαγές και γλώσσες. Το σχήμα να επιτρέπει υποέγγραφα παραλλαγών, αν μετρηθεί ότι χρειάζονται.

### 4.4 Διευθύνσεις και QR

- `/suppliers/<ψευδώνυμο>` · `/suppliers/<ψευδώνυμο>/c/<κατηγορία>` · `/suppliers/<ψευδώνυμο>/p/<slug>-<αμετάβλητο id>`. Το όνομα είναι πρόταση.
- Το **id** είναι η ταυτότητα, το slug διακοσμητικό, με 308 στην κανονική.
- QR: σταθερή σύντομη διεύθυνση `/q/<αμετάβλητο id>` που κάνει ανακατεύθυνση. Το τυπωμένο χαρτί ζει χρόνια, ενώ κωδικός, ψευδώνυμο και slug αλλάζουν.
- 🔴 Το `/q/<id>` απαντά **307 με `no-store`, όχι 308**. Το 308 το θυμάται ο browser, και ένα αποσυρμένο προϊόν θα έμενε ανοιχτό από την κρυφή του μνήμη.
- Αποσυρμένο προϊόν από τυπωμένο QR: ενημερωτική σελίδα που δεν αποκαλύπτει αν υπάρχει. Κρυφό ≡ ανύπαρκτο.
- Το QR δεν είναι ο σύνδεσμος σχέσης του `SupplyLinkCard`: άλλος σκοπός, άλλο token. Η ενσωμάτωση στο κριτήριο `publication-input-hash` πρέπει να μένει ντετερμινιστική.

### 4.5 Ανάκληση: «αμέσως» σημαίνει και ISR

Το §16 ζητά εξαφάνιση αμέσως. Το σβήσιμο εγγράφου δεν αρκεί, γιατί η σελίδα ISR θα σερβίρεται ως το τέλος του παραθύρου.

- **Tags σε δικό τους αρχείο**, `public-catalog-cache-tag.ts`: `public-catalog:company:<id>` και `public-catalog:model:<id>`.
- **Ο αναγνώστης δηλώνει τα tags με `unstable_cache`**, όπως το `landing-hero-reader.ts`. Το Admin SDK δεν περνά από `fetch`, άρα σκέτο `export const revalidate` δεν φέρει tag και το `revalidateTag` δεν θα έπιανε τη σελίδα.
- **Ο γραφέας καλεί `revalidateTag` μετά το commit**, σε κάθε `delete` ή `set`, στο μοτίβο `landing-hero-publication.ts:223`. Η ανάκληση επιβεβαίωσης χτυπά το tag `company`.
- **Το `/q/<id>` διαβάζει από τον ίδιο αναγνώστη**, άρα ακολουθεί το ίδιο tag, και δεν κρατά δική του μνήμη.
- **Φραγή πριν από το περιεχόμενο:** ο αναγνώστης ελέγχει πρώτα την εγκεκριμένη κατάσταση του προμηθευτή. Έτσι η ανάκληση μετρά στη σελίδα πριν αδειάσουν τα έγγραφα.
- ⚠️ **Όριο:** ως να τελειώσει το τμηματικό σβήσιμο, τα έγγραφα μένουν αναγνώσιμα από `read: if true`. Δεν κρατούν χρήμα (§4.1), άρα ο κίνδυνος είναι περιορισμένος, αλλά «αμέσως» ισχύει για τις σελίδες, όχι για ωμή ανάγνωση Firestore.
- **Από την πλευρά browser δεν υπάρχει εμπόδιο:** το `next.config.js:86-100` τεκμηριώνει ότι δεν υπάρχει CDN μπροστά από το Netcup και ότι το SWR προς browser είναι κλειστό.
- ⚠️ **Ανεπαλήθευτα:** αν το `revalidateTag` δουλεύει μέσα στο `after()` και από τον cron dispatcher (σήμερα 0 χρήσεις στο `src/lib/cron` και `src/app/api/cron`) · αν τρέχει ένα μόνο container, αφού η ISR μνήμη είναι στον δίσκο του.
- **Άγκυρες:** jest ότι κάθε δρόμος απόσυρσης καλεί το σωστό tag και ότι ο αναγνώστης το δηλώνει, με μετάλλαξη. Το jest δεν αποδεικνύει καθαρισμό ISR, άρα θέλει και ζωντανή δοκιμή: άνοιγμα σελίδας και `/q/<id>`, ανάκληση, ξανά άνοιγμα.

---

## 5. Κοινό Λεξικό (§17): απάντηση

**Δεν προηγείται της Φ6β.**

- Το §13 το συνδέει με τα **φίλτρα και τη σύγκριση της πύλης** (Φ8). Αδέσμευτη ιδιότητα «εμφανίζεται μόνο στη βιτρίνα του». Άρα η βιτρίνα δουλεύει χωρίς αυτό.
- Το §17.1 το λέει ρητά: «ποτέ αναμονή».
- Το πεδίο **υπάρχει με άλλο όνομα**: `platformAttribute` = 0, αλλά `AttributeMappings.platformTerm: PlatformTermBinding` (`unbound` · `proposed` · `bound`). Το zod το κλειδώνει στο `unbound` και δεν υπάρχει συλλογή λημμάτων.
- ⚠️ Το ADR §13 γράφει ακόμη `mappings.platformAttribute` και ότι το Λεξικό «ξεκινά στη Φάση 1». Στον κώδικα υπάρχει μόνο ο τύπος της δέσμευσης. Θέλει διόρθωση στη Φάση 3 της N.0.1.
- Η Φ6β να μην προβάλλει δημόσια έννοιες λεξικού. Το `schemaVersion` καλύπτει την προσθήκη αργότερα.
- **Πρέπει** να προηγηθεί της Φ8, μαζί με τον έλεγχο άδειας ETIM.

---

## 6. Βήματα

Κάθε βήμα σε δικό του worktree. Δείκτης ημερών με τον σημερινό ρυθμό. Τα νέα ονόματα είναι προτάσεις.

### Σ0. Αποφάσεις και ADR (0,5)
Απαντήσεις Ε1–Ε7, νέο §5.13, διόρθωση §13, ADR-923 §9.
**Αρχεία:** `docs/centralized-systems/reference/adrs/ADR-923-supplier-product-catalog-pim.md`.

### Σ1. Δημόσια ταυτότητα και επιβεβαίωση προμηθευτή (1–1,5)
Το κουμπί «Δημοσίευση βιτρίνας» είναι η ανθρώπινη πράξη που καλεί το `verifyRegistryIdentity`, όπως ορίζει η κεφαλίδα του. Δημοσιεύεται μόνο με `judgeRegistryIdentity` = `verified`, δηλαδή σωστός αριθμός, ενεργή εταιρεία, ίδια επωνυμία με `sameLegalName` (ταίριασμα ονόματος §16). Τα κενά εμφανίζονται με τον λόγο τους, και το `name-mismatch` οδηγεί στην υπάρχουσα υιοθέτηση επωνυμίας.

Επειδή ο ανώνυμος δεν μπορεί να κρίνει, η ετυμηγορία αντιγράφεται σε δημόσιο έγγραφο `public_supplier_showcases/{companyId}`, που γράφει μόνο ο διακομιστής. Η αλλαγή επωνυμίας επανεκκινεί τον έλεγχο από μόνη της, επειδή το «επαληθευμένο» παράγεται.

**Ανανέωση:** νέα `refreshSupplierShowcaseStanding`, κλήση από το **ένα** σημείο `reconcileShowcaseLegalIdentity` και το `propagateCompanyRename`, ώστε κανένας από τους καλούντες να μη χρειαστεί αλλαγή. Απώλεια επιβεβαίωσης ⇒ απόσυρση (§4.5). ⚠️ Διαφορά από το γραφείο: εκεί η κλεισμένη εταιρεία μένει ορατή με `registryClosure`· εδώ το §16 ζητά εξαφάνιση.

**Δίχτυ:** το `reconcile…` τρέχει στο `after()` και μπορεί να αποτύχει. Η σάρωση του Σ3 ξανακρίνει το **αποθηκευμένο** ζεύγος με `readRegistryIdentityReport`, που δεν ρωτά ΓΕΜΗ, άρα τηρεί το «κανένα cron στο μητρώο».

**Αποτυχία αυτόματου ελέγχου (§16):** `registry unavailable` δεν εγκρίνει ποτέ. Χωρίς αριθμό ΓΕΜΗ ή με άρνηση μητρώου ⇒ αίτημα χειροκίνητου ελέγχου διαχειριστή, δες Ε1.

**Νέα:** `src/subapps/catalog/types/supplier-showcase.ts` · `src/server/catalog/supplier-showcase-writer.server.ts` · route στο `src/app/api/catalog/` · οθόνη στο `src/components/catalog/settings/`.
**Αλλαγές:** `src/services/company/company-rename.service.ts` · `firestore.rules` · `src/config/firestore-collections.ts` · `src/services/enterprise-id.service.ts` αν χρειαστεί · locales.
**Επαναχρήση:** `company-registry-verification.service.ts` · `registry-identity-judgment.ts` · `legal-name-match.ts` · `showcase-legal-identity-custody.ts` (`readLegalIdentityInputs`) · `company-legal-identity.ts` · `company-public-name.reader.ts`.
**Κίνδυνοι:** το `readLegalIdentityInputs` ζητά `locations` βιτρίνας, που ο προμηθευτής δεν έχει· θα κριθεί αν αρκεί κενή λίστα ή χρειάζεται εξαγωγή. Το `refreshShowcaseLegalIdentity` είναι δεμένο με `agency_profiles`, άρα μοιράζεται η κρίση, όχι ο γραφέας. Δεν δηλώνεται `ORGANIZATION_CAPABILITIES`. ⚠️ Δεν ελέγχθηκε αν το `GEMI_OPENDATA_API_KEY` είναι ρυθμισμένο στην παραγωγή.

### Σ2. Καθαρός πυρήνας προβολής (1)
Κλειστός τύπος, `schemaVersion`, σύνθεση χωρίς I/O, σύνορο ανάγνωσης.
**Νέα:** `src/subapps/catalog/public/public-catalog-schema.ts` · `public-catalog-from-document.ts` · `project-public-model.ts` + άγκυρες.
**Αλλαγές:** `scripts/check-public-listing-read-boundary.js` (γραμμή `BOUNDARIES`).
**Άγκυρες:** κανένα κλειδί τιμής, κόστους, κοινού, έκπτωσης, σχέσης. Αρνητικά σενάρια `hidden`. Ανά γλώσσα και κανάλι `storefront`. Μετάλλαξη σε κάθε μία.

### Σ3. Γραφέας, outbox, δίχτυ (1–1,5)
**Νέα:** `src/server/catalog/public/public-model-writer.server.ts` · `public-outbox.server.ts` · `public-catalog-cache-tag.ts` · `src/subapps/catalog/public/public-scopes-of-write.ts` (καθαρή) · `src/lib/cron/jobs/public-catalog-sweep.job.ts` · `src/app/api/cron/public-catalog-sweep/route.ts` · νέα πύλη ενός γραφέα, στο πρότυπο 3.99/3.104/3.105 με `docs/gates/`.
**Αλλαγές:** `src/config/cron-schedule.ts` (νέα εγγραφή, ως δίχτυ, στο πρότυπο `publication-run-sweep`) · `src/server/catalog/catalog-store.server.ts` (`noteWrite` και εγγραφή στο τέλος της συναλλαγής) · `catalog-asset-renditions.server.ts` · `firestore.rules` · `firestore.indexes.json` · σουίτα κανόνων emulator.
**Άγκυρες ανάκλησης:** §4.5.
**Μέσα:** μόνο assets με δικαιώματα που επιτρέπουν δημόσια χρήση, μόνο αποδόσεις web. CAD/IFC κατά Ε5.
**Κίνδυνος:** ιδιωτικό αρχείο σε δημόσια διαδρομή· ληγμένα δικαιώματα.

### Σ4. Δημόσιες σελίδες χωρίς τιμή (1,5–2)
Σελίδα προμηθευτή, κατηγορίας, μοντέλου, `metadata`, JSON-LD χωρίς `offers`, `visibleNoPrice` ως «Κατόπιν προσφοράς».
**Νέα:** `src/app/(light)/suppliers/[alias]/**` · `src/components/public-catalog/**` · `src/services/public-catalog/*.reader.ts` · `src/lib/catalog/public-structured-data.ts`.
**Αλλαγές:** locales el/en και `namespace-loaders.ts`.
**Πύλες που θα ενεργοποιηθούν:** 3.55 · 3.60 · 3.61 · 3.63 · 3.72 · 3.94, και 3.51 για ωμά κλειδιά.
**Κίνδυνος:** ο αναγνώστης πρέπει να περνά από `unstable_cache` με tags (§4.5), αλλιώς η ανάκληση χάνεται. Το αποτέλεσμα του oracle 3.51 για το `/area/ssr-probe` εκκρεμεί από τον συντονιστή.

### Σ5. Άνοιγμα στις μηχανές (0,5, μόνο με Ε2)
Επιλεκτικό άνοιγμα, `sitemap`.
**Αλλαγές:** `public/robots.txt` · `src/middleware.ts` · νέο sitemap στο `src/app/(light)/suppliers/`.
**Κίνδυνος:** αγγίζει ολόκληρο τον ιστότοπο. Το μπλοκάρισμα είναι σκόπιμο (`src/middleware.ts:46`, κρίνεται στις γραμμές 277–283). Το middleware **δεν** τρέχει σε jest, άρα θέλει ζωντανό έλεγχο με user-agent.

### Σ6. Τιμές (1–1,5, μετά το Ε3)
Μαζική εκδοχή που καλεί την ίδια κρίση, ανώνυμη στο ISR, route `no-store` με νησίδα για αγοραστή με σχέση, JSON-LD με `offers` μόνο όταν υπάρχει τιμή.
**Νέα:** `src/server/catalog/public/public-price.server.ts` · `src/app/api/public-catalog/price/route.ts` · νησίδα στο `src/components/public-catalog/`.
**Αλλαγές:** `src/server/catalog/price-quote.server.ts` · λίστα αναγνωστών CHECK 3.106 · `rate-limit` πίνακας (CHECK 3.78).
**Άγκυρες:** ίδιο αποτέλεσμα με το «δες σαν τον Χ» · καμία τιμή στο HTML για `visibleNoPrice` · έλεγχος του ακατέργαστου HTML ως ανώνυμος.
**Κίνδυνος:** διαρροή τιμής κοινού. Αυτό το βήμα θέλει ανεξάρτητη ανασκόπηση ασφαλείας.

### Σ7. QR και ζωντανός κατάλογος (0,5–1)
**Νέα:** `src/app/(light)/q/[id]/route.ts`.
**Αλλαγές:** `src/subapps/catalog/publishing/compose-publication.ts` · `publication-input-hash.ts` · `src/server/catalog/publishing/typst-adapter.ts` · `typst-template.ts`, υποσέλιδο «τιμές έκδοσης Χ, ισχύς από…».
**Κίνδυνος:** αλλαγή hash ακυρώνει ιδεμποτία παλαιών εκδόσεων· πύλη 3.110. Δοκιμή σάρωσης σε πραγματικό χαρτί, που θέλει τον Giorgio.

### Σ8. `materials/` και προσφορές (1–1,5)
`Material` με προαιρετικό `catalogRef { supplierCompanyId, variantId }` (§5.8). «Ζητήστε προσφορά» από βιτρίνα: συνδεδεμένος αγοραστής → πρόχειρο RFQ με `variantId` και στιγμιότυπο.
**Αλλαγές:** `src/subapps/procurement/types/material.ts` · `rfq-line.ts` · `quote.ts` · υπηρεσίες procurement · CHECK 3.92 (ιδεμποτία).
**Εκτός:** παραγγελία §15, ανώνυμο αίτημα αν δεν αποφασιστεί στο Ε6.

### Κριτήριο εξόδου

Ανώνυμος ανοίγει τυπωμένο QR της Aries και βλέπει ζωντανό το μοντέλο· συνδεδεμένος αγοραστής βλέπει τη δική του τιμή· στο ακατέργαστο HTML και στο δημόσιο έγγραφο δεν υπάρχει καμία τιμή άλλου κοινού· το κρυφό SKU απαντά όπως το ανύπαρκτο.

---

## 7. Αποφάσεις Giorgio

| # | Ερώτηση | Πρόταση |
|---|---|---|
| Ε1α | Όταν αποτύχει η αυτόματη κρίση ΓΕΜΗ (όχι αριθμός, ατομική επιχείρηση, `not-in-registry`, `inactive`), υλοποιούμε τώρα τον χειροκίνητο έλεγχο του §16 με έγγραφα, ή μένει η βιτρίνα κλειστή; | Κλειστή στην πρώτη κυκλοφορία, με σαφή λόγο στην οθόνη. Το §16 ζητά χειροκίνητο έλεγχο, άρα είναι δηλωμένη απόκλιση, όχι σιωπηλή. Προστίθεται όταν φανεί πραγματική ζήτηση |
| Ε1β | Το §16 ζητά και ΑΦΜ. ΑΑΔΕ/VIES δεν υπάρχουν στον κώδικα. Το ΓΕΜΗ δίνει `afm`, που το ADR-841 επέλεξε να μη διαβάζει. Αρκεί αριθμός ΓΕΜΗ + επωνυμία, ή ανοίγουμε αυτή την επιλογή για διασταύρωση χωρίς αποθήκευση; | Αρκεί για την πρώτη κυκλοφορία, με το ΑΦΜ δηλωμένο κενό ως τη Φ8. Η ελαχιστοποίηση είναι νομική επιλογή και δεν ανατρέπεται παρεμπιπτόντως |
| Ε2 | Ανοίγουμε τον ιστότοπο στις μηχανές; Μόνο `/suppliers`, ή και αγγελίες και `/pro`; | Μόνο `/suppliers` στην αρχή. Οι άλλες δημόσιες σελίδες είναι χωριστή απόφαση |
| Ε3 | Ανώνυμη τιμή με ποιον ΦΠΑ; | Πρώτη κυκλοφορία χωρίς ανώνυμη τιμή, «Κατόπιν προσφοράς». Μετά, ρυθμός ΦΠΑ ανά κατηγορία και τιμή με ΦΠΑ |
| Ε4 | Δέχεσαι κανένα ποσό στο δημόσιο έγγραφο (§4.1 Β), αυστηρότερο από το §12; | Ναι |
| Ε5 | Δημόσια λήψη CAD/IFC και PDF καταλόγου; | PDF μόνο έκδοσης ανώνυμου κοινού. CAD/IFC μετά από σύνδεση |
| Ε6 | Ανώνυμος μπορεί να ζητήσει προσφορά; | Όχι στην πρώτη κυκλοφορία |
| Ε7 | Νομική γνώμη για DSA, Οδηγία 98/6 και Omnibus πριν ανοίξει σε καταναλωτές; | Ναι. Με ένδειξη «μόνο για επαγγελματίες» ο κίνδυνος μειώνεται, αλλά το συμπέρασμα ανήκει σε δικηγόρο |

---

## 8. Κίνδυνοι και άγνωστα

- Το `public/robots.txt` μπήκε το 2026-03 σκόπιμα. Το άνοιγμα μεταβάλλει έκθεση σε scrapers και φόρτο. Ο πίνακας bots μπλοκάρει και `facebot`, άρα ίσως και προεπισκοπήσεις κοινοποίησης: **ανεπαλήθευτο**.
- Οι σελίδες `/pro` παράγουν JSON-LD ενώ κανένας ανιχνευτής δεν φτάνει εκεί. Ίδιο κενό, υπάρχει ήδη.
- ISR στον δίσκο: η συνεδρία Φ5 αναφέρει 4,8 GB ελεύθερα. Δεν ελέγχθηκε ποιος δίσκος είναι.
- Δεν υπάρχει μετρημένος φόρτος ανά render τιμών. Να μετρηθεί στο Σ6.
- Δεν έγινε ζωντανή δοκιμή. Δεν έτρεξαν tests. Όλα προκύπτουν από ανάγνωση κώδικα.
- Έκλεισαν στη v2: πρόγραμμα cron (`cron-schedule.ts`), επαλήθευση ΓΕΜΗ (υπάρχει), ΑΑΔΕ/VIES (δεν υπάρχουν), σημείο outbox (`noteWrite`).
- Ανοιχτά: `revalidateTag` σε `after()` και dispatcher · αριθμός containers · `GEMI_OPENDATA_API_KEY` στην παραγωγή · όροι χρήσης ΓΕΜΗ για βιτρίνα προμηθευτή (§16 ⚠️).
- Η Φ6α δεν έχει ζωντανή επαλήθευση. Το Σ6 στηρίζεται πάνω της, άρα να προηγηθεί η δοκιμή 15 βημάτων.
- Για το §14: το σημερινό σχέδιο κάνει έγγραφο ανά προμηθευτή. Στην πύλη το ίδιο προϊόν θα έχει πολλές σελίδες, οπότε τότε θα χρειαστεί απόφαση `canonical`.

---

## 8α. Διαλογή συντονιστή πάνω στις Ε1–Ε7 (2026-11-01, υπερισχύει του §7)

Κριτήριο Giorgio: πρακτική μεγάλων παικτών, καμία έκπτωση, έρευνα όπου υπάρχει αμφιβολία, εξυπνότερη λύση όπου γίνεται. Έγκριση αυτού του πίνακα **δεν** έχει δοθεί ρητά, άρα το Σ0 ζητά ένα «εγκρίνω». Κανένα βήμα δεν αλλάζει `firebase-production` χωρίς χωριστή εντολή.

| # | Θέση | Αλλαγή από το §7 | Βάση |
|---|---|---|---|
| Ε1α | Χειροκίνητος έλεγχος διαχειριστή από την πρώτη κυκλοφορία, με έγγραφα, αιτιολογία και ιστορικό | Ναι, ανατρέπει την κλειστή βιτρίνα | Το §16 το ορίζει. Η Amazon, κατά δευτερογενείς πηγές, κλιμακώνει σε άνθρωπο μόνο υποσύνολο περιπτώσεων· η Alibaba χρησιμοποιεί τρίτους ελεγκτές. ⚠️ Όχι επίσημη τεκμηρίωση Amazon |
| Ε1β | **Δέσιμο ΑΦΜ ↔ Αρ. ΓΕΜΗ με αναζήτηση στο ίδιο το ΓΕΜΗ**: ρωτάμε ποια εταιρεία έχει το ΑΦΜ που δήλωσε ο χώρος και συγκρίνουμε τον Αρ. ΓΕΜΗ που επιστρέφει. Ο αναλυτής εξακολουθεί να μη διαβάζει `afm` και τίποτα νέο δεν αποθηκεύεται, πέρα από την ετυμηγορία | Ναι, κλείνει το κενό χωρίς να ανατρέπει το ADR-841 | ✅ Η τεχνική τεκμηρίωση του ΓΕΜΗ δηλώνει ΑΦΜ ως κριτήριο. Άδεια ODC-BY 1.0. ❌ Ακριβές όνομα παραμέτρου ανεπαλήθευτο: το Swagger απάντησε 401, θέλει δοκιμή με κλειδί στην αρχή του Σ1 |
| Ε1β | **Όχι ΑΑΔΕ** ως λειτουργία πλατφόρμας πριν από νομική γνώμη | Νέο | ✅ Όροι RgWsPublic2 v4.0 (2018), όρος 5: απαγορεύεται η εμπορική χρήση και η μεταβίβαση σε τρίτους· όρος 6: κλήση μόνο με ταυτοποιημένο τελικό χρήστη· όρος 15: η ΑΑΔΕ ειδοποιεί τον ελεγχόμενο. ⚠️ Δεν ελέγχθηκε αν ισχύει νεότερη έκδοση |
| Ε1β | VIES μόνο για ενδοκοινοτικό ΑΦΜ, όταν υπάρξουν ξένοι προμηθευτές | Νέο | ⚠️ Μόνο δευτερογενείς πηγές· το επίσημο disclaimer δεν αναγνώστηκε |
| Ε2 | Μόνο `/suppliers` | Καμία | Περιορίζει την έκθεση. Οι άλλες σελίδες είναι χωριστή απόφαση, όχι έκπτωση |
| Ε3 | **Ανώνυμη τιμή υποστηρίζεται από την Φ6β, με επιλογή του προμηθευτή.** Προεπιλογή «Κατόπιν προσφοράς». Τιμή με ΦΠΑ, ρυθμός ανά κατηγορία | Ναι, αφαιρεί την αναβολή. Μεγαλώνει το Σ6 | Ο Grainger, κατά δευτερογενή πηγή, δείχνει list price σε ανώνυμο. Άλλοι κρατούν τιμή μετά τη σύνδεση. Άρα η απόφαση ανήκει στον προμηθευτή. JSON-LD μόνο ό,τι βλέπει ο ανώνυμος. ⚠️ Η άμεση ανάγνωση του grainger.com απέτυχε |
| Ε4 | Κανένα ποσό στο δημόσιο έγγραφο | Καμία | Η τιμή λύνεται στο render, §4.1 |
| Ε5 | PDF μόνο ανώνυμου κοινού, CAD/IFC μετά από δωρεάν σύνδεση | Καμία | Το BIMobject, κατά δευτερογενείς πηγές, ζητά δωρεάν λογαριασμό |
| Ε6 | **Το κουμπί «Ζητήστε προσφορά» φαίνεται σε όλους. Ο ανώνυμος περνά από σύνδεση ή εγγραφή και επιστρέφει στο ίδιο πρόχειρο** | Ναι, αντί για απλό «όχι» | Μοτίβο «quote-as-conversion» (πρακτική πρακτορείου, όχι πρωτογενής πηγή). Κανένα ανώνυμο έντυπο, άρα κανένα spam |
| Ε7 | Νομική γνώμη πριν ανοίξει σε καταναλωτές, με πρόσθετο ερώτημα για την ΑΑΔΕ | Διευρύνεται | Ανήκει σε δικηγόρο |

**Εκτέλεση (N.8):** διαδοχικά, ένα worktree ανά βήμα, χωρίς orchestrator. Η ζωντανή δοκιμή της Φ6α προηγείται του Σ6. Τα νέα Ε1α, Ε1β, Ε3, Ε6 ανεβάζουν την εκτίμηση του §1.6 κατά περίπου 2–3 ημέρες.

**Πηγές §8α:**
[Όροι ΑΑΔΕ RgWsPublic2](https://www.aade.gr/sites/default/files/2018-07/RgWsPublic2OroiXrisisV4.0.pdf) ·
[ΓΕΜΗ, τεχνική τεκμηρίωση](https://opendata.businessportal.gr/techdocs/) ·
[ΓΕΜΗ, ανοικτά δεδομένα](https://opendata.businessportal.gr/) ·
[Alibaba Verified Supplier](https://seller.alibaba.com/businessblogs/what-is-a-verified-supplier-on-alibabacom-px001z0dr) ·
[Οδηγός επαλήθευσης Amazon, τρίτου](https://www.sellersprite.com/en/blog/amazon-seller-account-verification) ·
[Grainger σε κρατικό κατάλογο](https://www.govsci.com/searching/supplier/Grainger/keyword/Grainger/category/148) ·
[Public catalog, Cimcloud](https://help.cimcloud.com/help-center/public-catalog-with-b2b-self-service-portal) ·
[Quote-only catalogs και SEO](https://www.1digitalagency.com/blog/bigcommerce-b2b-edition-seo-for-quote-only-catalogs/) ·
[Fonoa για VIES](https://www.fonoa.com/blog/what-is-vies) ·
[Οδηγός BIM objects](https://www.guideflow.com/blog/bim-objects)

---

## 9. Επαναληψιμότητα ισχυρισμών

Τρέξε από το `C:\Nestor_Pagonis`, στο `8513466c`. Όλες οι εναλλαγές γράφονται με `|` και `-E`, σε μπλοκ κώδικα ώστε να αντιγράφονται αυτούσιες. Στη δεξιά γραμμή `# ...` το αποτέλεσμα.

```bash
# Κοινό Λεξικό
git grep -n "platformAttribute" -- src firestore.rules                                # 0
git grep -n -E "platformTerm|PlatformTermBinding" -- src                              # τύπος + zod + draft, εκτός tests
git grep -n "platformTerm" -- src/subapps/catalog/schema/zod/attribute.schema.ts      # γραμμή 65, literal unbound
git grep -n -E "PLATFORM_TERM|platform_term|platformTerms" -- src firestore.rules     # 0

# Δεν υπάρχει
git grep -n "public_catalog" -- src firestore.rules                                   # 0 (όχι -i: πιάνει NEXT_PUBLIC_CATALOG_*, 26 ψευδή)
git grep -n -i "slug" -- src/subapps/catalog src/server/catalog                       # 0
git grep -n -iE "gtin|\bmpn\b|brand" -- src/subapps/catalog/types src/subapps/catalog/vocabulary   # 0
git grep -n "sitemap" -- "src/**/*.ts" "src/**/*.tsx"                                 # 0
git grep -n "cacheHandler" -- "next.config.*"                                         # 0
git grep -n -iE "variantId|catalogRef|supplierCompanyId" -- src/subapps/procurement/types/material.ts   # 0
git grep -n "variantId" -- src/subapps/procurement/types/rfq-line.ts src/subapps/procurement/types/rfq.ts src/subapps/procurement/types/quote.ts   # 0
git grep -n -iE "qrSvg|qrPng|lib/qr" -- src/subapps/catalog/publishing src/server/catalog/publishing   # 0

# SEO
git grep -n "Disallow: /" -- public/robots.txt                                        # γραμμές 5, 9, 12, 15 κ.ά. (όχι `$`: 0 ευρήματα, πιθανώς CRLF)
git grep -n -E "googlebot|status: 403" -- src/middleware.ts                           # γραμμές 47, 282

# Τιμή
git grep -n "ΦΠΑ" -- src/subapps/catalog/types/price-list.ts                          # γραμμές 15, 150
git grep -n "export async function quoteWithin" -- src/server/catalog/price-quote.server.ts   # 1
git grep -n "kind: 'anonymous'" -- src/server/catalog/pricing-viewer.server.ts src/subapps/catalog/types/price-list.ts   # 2
git grep -n "export function runForeignCatalogRead" -- src/server/catalog/catalog-store.server.ts   # 1

# Επιβεβαίωση
git grep -n "ORGANIZATION_CAPABILITIES =" -- src/types/organization-capability.ts     # ['brokerage_listings']
git grep -n "export async function verifyRegistryIdentity" -- src/services/company-registry/company-registry-verification.service.ts   # 1
git grep -n "sameLegalName" -- src/lib/company/registry-identity-judgment.ts          # εισαγωγή + χρήση
git grep -n "reconcileShowcaseLegalIdentity" -- src/app/api src/services/company      # accounting/setup · agency-profile/card · registry-verification
git grep -n "AGENCY_PROFILES" -- src/services/mandate/showcase-legal-identity-custody.ts   # η ανανέωση γράφει agency_profiles
git grep -n -E "wwwinfo|RgWsPublic|checkVatService|ec\.europa\.eu/taxation" -- src    # 0: καμία ενσωμάτωση ΑΑΔΕ/VIES
git grep -n -E "\bVIES\b" -- "src/**/*.ts" "src/**/*.tsx"                             # 0 εκτός tests (μόνο στο markdown του ADR-ACC-002)
git grep -n -iE "aade|vies" -- src/app/api/accounting/setup/route.ts                  # 0
git grep -n "isValidVatNumber" -- src/app/api/accounting/setup/route.ts               # μόνο μορφή 9 ψηφίων
git grep -n -iE "afm|vatNumber" -- src/types/company-registry.ts src/lib/company/registry-identity-judgment.ts   # 1, σχόλιο: το `afm` του ΓΕΜΗ δεν διαβάζεται, επίτηδες
git grep -n "afm" -- src/services/company-registry/gemi-opendata-parse.ts             # γραμμή 17, λίστα όσων δεν διαβάζονται

# Outbox
git grep -n -E "changes\.push|noteWrite\(" -- src/server/catalog/catalog-store.server.ts   # changes.push: 300, 342 · noteWrite: 264, 301, 320, 343, 378
git grep -n "signalPricingViewsInTx" -- src/server/catalog/catalog-store.server.ts    # γραμμή 101
git grep -n "runCatalogTransaction(" -- src/server                                    # λίστα καλούντων· φίλτραρε __tests__
git grep -n -iE "catalog|pricing" -- .view-signal-authority.json                      # 0
git grep -ln "signalPricingViewsInTx" -- scripts docs/gates                           # scripts/check-catalog-schema-authority.js
git grep -n "catalogRenditions: state" -- src/server/catalog/catalog-asset-renditions.server.ts   # γραμμή 189

# Cron και μνήμη
git grep -n "slug: 'publication-run-sweep'" -- src/config/cron-schedule.ts            # γραμμή 613
git grep -n "revalidateTag" -- src/lib/cron src/app/api/cron                          # 0
git grep -n "revalidateTag(" -- src/services/landing-hero/landing-hero-publication.ts # γραμμή 223
git grep -n "tags:" -- src/services/landing-hero/landing-hero-reader.ts               # γραμμή 62
git grep -n "export const revalidate" -- "src/app/(light)/listing/[id]/page.tsx"      # 300
git grep -n -A1 "match /public_listings/" -- firestore.rules                          # allow read: if true
git grep -n "Εμείς δεν έχουμε CDN" -- next.config.js                                  # καμία CDN
git grep -n "\"next\": \"" -- package.json                                            # 15.5.22
```
