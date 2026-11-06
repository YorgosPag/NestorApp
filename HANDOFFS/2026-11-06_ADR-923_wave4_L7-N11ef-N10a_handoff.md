# ADR-923 · Κύμα 4 · Handoff #5 (2026-11-06) — Λ7: Ν11(ε) · Ν11(στ) · Ν10(α)

Αντικαθιστά το `HANDOFFS/2026-11-06_ADR-923_wave4_L7_handoff.md` (τα «Μαθήματα» εκείνου και των προηγούμενων ισχύουν).

- **Worktree:** `C:\Nestor_Worktrees\adr-923-wave4` · **Κλαδί:** `agent/adr-923-wave4`. Συνέχεια **στο ίδιο worktree** (`EnterWorktree` με `path`).
- Στο `main` **δεν** γίνεται commit. Commit στο κλαδί με ρητή λίστα αρχείων, πλήρες hook.
- `wt:land`, push, Firebase: **μόνο** με ρητή εντολή Giorgio. **Κανένα test χωρίς έγκρισή του** (N.(-2)): γράφεις τα tests και ζητάς έγκριση με την **ακριβή** εντολή.
- **Οδηγία Giorgio:** ποιότητα Revit / ArchiCAD / Cinema 4D / Figma / Zillow / Idealista, χωρίς εκπτώσεις. Όπου δεν είσαι σίγουρος, κάνε **έρευνα** στο διαδίκτυο και ακολούθησε την πρακτική των μεγάλων ή κάτι καλύτερο. Μην δίνεις επιλογές «απλό ή σωστό»: πρότεινε το σωστό. Πριν από κάθε κώδικα, πραγματικό SSoT audit (grep), χωρίς διπλότυπα.

## Έγινε σε αυτή τη συνεδρία (στο κλαδί, κανένα στο main)

**Ν10 (γ): μέτρηση τυπωμένων QR**
- Νέο πεδίο `PublicationReport.printedQrCount`. Το γεμίζει η `countLayoutQrCodes` (`layout-model.ts`) μετρώντας τη διάταξη που πάει στη μηχανή, μέσα στο `publication-snapshot.server.ts`.
- Νέα γραμμή στο `PublicationRunList` με κλειδί `publishing.report.printedQr` (el + en).

**Ν10 (δ): το QR στο IDML ως διάνυσμα**
- Η `qrGroupXml` (`idml-story.ts`) γράφει μια ομάδα δύο σχημάτων: ορθογώνιο χαρτιού με τη ζώνη ησυχίας, και ένα `Polygon` με μία διαδρομή ανά σειρά μονάδων.
- Νέο δείγμα `Color/QrInk` (`idml-document.ts`), από το `PUBLICATION_QR_INK`.
- Η διεύθυνση μένει και ως κείμενο κάτω από το σύμβολο.

**Ν11 (δ): ειδοποίηση πριν από τη λήξη μάρκας**
- **Κρίση σταδίων:**
  - Το `expiry-alert-stage.ts` εξάγει πλέον τις `expiryStageOfDate` και `isMoreUrgentExpiryStage`, ώστε να υπάρχει μία κρίση σταδίων λήξης.
  - Νέα καθαρή κρίση `supplier-brand-expiry.ts`: d30 · d7 · d0 · `expired` (για 7 ημέρες μετά τη λήξη).
  - Ό,τι έχει ήδη ειπωθεί ζει στο `grant.expiryNotice`. Η ανανέωση γράφει νέο `grant`, άρα ξαναρχίζει μόνη της.
- **Ο γραφέας** (`supplier-brand-claim.server.ts`): `recordBrandExpiryNotice` (CAS) και `readBrandGrantsExpiringPage` (ένα πεδίο εύρους, δρομέας εγγράφου).
- **Η σάρωση:** `supplier-brand-expiry-notices.server.ts`, με το job, τη route και την εγγραφή cron `28 8 * * *` στο `cron-schedule.ts`.
- **Η ειδοποίηση:**
  - Τύπος `procurement.brandGrantExpiring`, διακόπτης `brandGrantExpiring`, οντότητα `supplier_brand_claim`.
  - Κανόνας στο `notification-destination-rules.ts`.
  - Κείμενα σε el + en: `common-shared:brandExpiry.*` και `common-account:…procurement.brandGrantExpiring`.
- ADR-923: changelog 2026-11-06 «Ν10 (γ)+(δ)» και «Ν11 §16». ADR-740: changelog 2026-11-06.

⚠️ **Δεν εκτελέστηκε ΚΑΝΕΝΑ jest** (περιμένει έγκριση Giorgio). Οι σουίτες που αφορούν τη δουλειά:
`npx jest src/subapps/catalog/publishing/__tests__/publication-qr.test.ts src/subapps/catalog/publishing/__tests__/idml-document.test.ts src/components/catalog/publishing/__tests__/publications.render.test.tsx src/subapps/catalog/public/__tests__/supplier-brand-expiry.test.ts src/lib/document-validity/__tests__/expiry-alert-stage.test.ts src/lib/cron/__tests__/cron-schedule.test.ts src/server/notifications/__tests__/notification-preference-policy.test.ts src/server/notifications/__tests__/notification-destination-rules.test.ts src/server/notifications/__tests__/notification-title.test.ts`

⚠️ **Κενά που δηλώθηκαν:**
- Η σάρωση `sweepSupplierBrandExpiryNotices` δεν έχει jest. Τεστάρεται μόνο η καθαρή κρίση.
- Ο απλός επιλυτής ICU του διακομιστή (`bundle-translate.ts`, `PLURAL`) δεν δέχεται `{…}` μέσα σε σκέλος plural. Γι' αυτό το `{brand}` έμεινε έξω από το plural στο `brandExpiry.soonTitle`.
- Μένει ανοιχτό το εύρημα της πύλης 3.91 (δείκτες Admin SDK) για το νέο ερώτημα: εύρος και ταξινόμηση στο ίδιο πεδίο. Ο αυτόματος δείκτης θα έπρεπε να αρκεί.

## Επόμενο (σειρά)

1. **Ν11 (ε): `areaServed` για ακτίνα και πολύγωνο.**
   - **SSoT:**
     - `src/lib/catalog/public-structured-data.ts`: το `areaServedOf` γράφει σήμερα μόνο `nationwide`/`areas`.
     - `src/subapps/catalog/public/public-provider-facts.ts`: τα `PublicServiceArea` / `declaredAreaOf` πετούν το κέντρο και τον δακτύλιο.
     - `src/types/agency-coverage.ts`: ο τύπος `DeclaredCoverage`.
     - Βοηθοί: `src/lib/agency/coverage-match.ts` · `coverage-geometry.ts` · `coverage-outline.ts`.
   - **Πρόταση:** βγάζουμε τις **ονομασμένες διοικητικές περιοχές** που τέμνει ο κύκλος ή το πολύγωνο, ως `AdministrativeArea`.
     - Το κέντρο δεν δημοσιεύεται ποτέ, γιατί μπορεί να είναι κατοικία (απόφαση Ε2 του §5.13 Υ8).
     - Το Google Business Profile δέχεται έως 20 ονομασμένες περιοχές και όχι ακτίνα.
   - **Πριν από τον κώδικα:** έρευνα schema.org (`GeoCircle`/`GeoShape`) και Google. Δες αν ο υπολογισμός «περιοχές που τέμνει» υπάρχει ήδη στο `coverage-match.ts`.
   - Ο υπολογισμός γίνεται στον αναγνώστη ή στον γραφέα, **όχι** στη σελίδα, γιατί ο builder JSON-LD μένει καθαρός.
2. **Ν11 (στ): σελίδα για κάθε έργο portfolio.**
   - **Πρότυπο:** η σελίδα μοντέλου `src/app/(light)/suppliers/[alias]/p/[model]/page.tsx`. Παίρνουμε από εκεί:
     - `revalidate 300` · `requirePublicSupplier` · `orSupplierCatalogUnavailable`
     - `publicIdOfSegment`/`publicSegmentOf` με `permanentRedirect` όταν το slug είναι λάθος
     - `generateMetadata` με canonical · `JsonLdScript`
   - **Δεδομένα:** το `readPublicSupplierProfile` (`public-catalog.reader.ts`) ήδη κρατά τα έργα (`publicProjectSchema`: `projectId`, `title`, `description`, `year`, `images`). Δεν χρειάζεται νέος αναγνώστης.
   - **Να προστεθούν:**
     - Builder διαδρομής στο `public-catalog-routes.ts` (πρόταση: `/suppliers/<alias>/w/<slug>-<projectId>`, να ερευνηθεί).
     - Σύνδεσμος από το `ProjectCard` (`SupplierPortfolio.tsx`).
     - `projectStructuredData` (`CreativeWork`, με `creator` → `@id` του οργανισμού) στο `public-structured-data.ts`.
     - Διαδρομές στο sitemap (`pathsOfSupplier`).
     - i18n `public-catalog` (el + en).
     - Άγκυρες στο `public-catalog-routes.test.ts`.
   - Πιθανώς 5+ αρχεία: κάνε την αξιολόγηση N.8.
3. **Ν10 (α): QR στο πλέγμα απλών προϊόντων. Περιμένει απόφαση Giorgio.**
   - Τα απλά προϊόντα **δεν** έχουν δημόσια σελίδα. Υπάρχουν μόνο `/suppliers/<alias>`, `/c/<κατηγορία>` και `/p/<μοντέλο>`, και το `/q/<id>` δέχεται μόνο μοντέλο.
   - Η κάρτα (34–45 mm) δεν χωρά σύμβολο 24,5 mm.
   - **Πρόταση:** ένα QR ανά ενότητα πλέγματος, στην επικεφαλίδα (υπάρχων μηχανισμός `heading.qr` · `entryHeading`), προς τη δημόσια σελίδα της κατηγορίας. Χρειάζεται κριτής «η κατηγορία είναι δημόσια» πίσω από την ίδια πύλη με το `readPublicModelTarget`.
   - Πού αγγίζει:
     - `compose-publication.ts`: `gridSection`, `qrCodes`.
     - `publication-qr.ts`: `linkableModelIds`.
     - `publication-links.server.ts`.
     - Ανέβασμα του `PUBLICATION_RENDER_VERSION`.

## Ανοιχτή πρόταση (από το #4, περιμένει «ναι» του Giorgio)

Ένα `refine` στο `schema/zod/catalog-import.schema.ts` που διαβάζει το `IMPORT_SOURCE_PURPOSES`, ώστε ο διακομιστής να αρνείται τον συνδυασμό «PDF» + `priceLines`.

## ΟΧΙ χωρίς απόφαση Giorgio
Α1, Ν6, Ν8, Ν9β, Ν12 (§23.7).

## Μαθήματα αυτής της συνεδρίας
- **Ο φύλακας απομόνωσης** αρνείται σύνθετες εντολές bash: heredoc με `>>`, `sed -i`, αλυσίδες με `;`/`&&` γύρω από git.
  - Για αλλαγές χρησιμοποίησε **Edit**.
  - Για scripts: **Write** στο scratchpad, και μετά `node <script> <worktree>`.
- **Το `supplier-brand-claim-rules.ts` φορτώνεται και στον browser** (panel, ουρά διαχειριστή). Οι server-only κρίσεις μπαίνουν σε χωριστό αρχείο.
- **Νέος τύπος ειδοποίησης με σύνδεσμο** = 7 σημεία:
  1. `notification-events.ts` (τύπος, meta, οντότητα)
  2. ο διακόπτης στο `user-notification-settings.types.ts` (πεδίο και προεπιλογή)
  3. `notification-preference-rows.ts`
  4. η ετικέτα στο `common-account`
  5. τα κείμενα στο `common-shared`
  6. ο κανόνας στο `notification-destination-rules.ts`
  7. ο προορισμός ως εξαγόμενη συνάρτηση του παραγωγού
