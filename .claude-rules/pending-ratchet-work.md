# Pending Ratchet Work — Live Checklist

**STATUS: ACTIVE**

> 🚨 **ΜΟΝΟ ό,τι ΕΚΚΡΕΜΕΙ** (εντολή Giorgio 2026-10-31, N.13). Εργασία που ολοκληρώθηκε → **σβήνεται ολόκληρη**. Καμία αναφορά ολοκλήρωσης εδώ: ούτε ✅, ούτε `[x]`, ούτε «ΕΚΛΕΙΣΕ», ούτε γραμμή changelog. Η ολοκλήρωση γράφεται στο ADR και στο git. Μερικώς ολοκληρωμένη → ξαναγράψε την εγγραφή ώστε να λέει μόνο τι μένει.

- 🟡 **30/10 — ADR-924 Ε: ΟΙ ΠΥΛΕΣ ΠΟΥ ΔΕΝ ΚΡΙΝΟΥΝ ΑΚΟΜΗ ΤΟ COMMIT (ratchet 3.107: 29)** *(ADR-924 §8.8–§8.9 · CHECK 3.107)*

  **Τι:** μεταφέρθηκαν **όλες** οι πύλες που τρέχουν σε κάθε commit (εκτός 3.84 · 3.90 δηλωμένη διαφυγή) και το πρώτο κύμα της
  Φ3. Μένουν **με σκανδάλη**: 3.8 · 3.11–3.15 · 3.17 · 3.18 (bash) · 3.19–3.21 · 3.23–3.27 · 3.35–3.37 · 3.41 · 3.47 · 3.57 ·
  3.79 · 3.91 · 3.9/3.10 (.sh) · 3.38 (ξένη δουλειά)· **3.84**: η μέτρηση ζει στον γεννήτορα `generate-third-party-notices` (Φ5)
  και είναι δηλωμένη διαφυγή (`pnpm licenses`) ⇒ Φ4. `npm run gate-commit-view:report` τις ονομάζει.
  ⚠️ Πέντε από αυτές (3.15 · 3.17 · 3.35 · 3.43 · 3.91) έχουν δικό τους `git diff --cached --name-only` **χωρίς `-z`** ⇒ δεν βλέπουν
  ελληνικά ονόματα αρχείων (μετρημένο, Ε11) — στη μεταφορά: `input.staged(accept)`.
  **Θεραπεία:** ανά πύλη το πρότυπο της §8.8 (είσοδος στη `measure` · άγκυρα `MIGRATED`/`MIGRATED_FULL` · `compare` δίσκος/`--index`
  · `jscpd:diff`) και `npm run gate-commit-view:baseline`. **Μέγεθος:** > 1h, 30+ αρχεία.

- 🟡 **30/10 — ΑΠΟΤΥΠΩΜΑΤΑ ΠΑΝΩ ΣΕ ΩΜΟ EOL (3.66 · 3.64 · 3.84)** *(ADR-924 §8.8)*

  **Τι:** sha256 του ωμού κειμένου, ενώ ο δίσκος είναι **μικτός** (`git ls-files --eol` ⇒ `w/mixed`: CRLF από checkout, LF από
  εργαλεία). Ένα αποκλίνον αρχείο διαβάζεται ως blob (LF) ⇒ «μπαγιάτικο» χωρίς αλλαγή περιεχομένου· και τοπικά (Windows) ≠ CI (LF).
  **Θεραπεία:** κανονικοποίηση EOL πριν το hash (κοινή συνάρτηση) + αναπαραγωγή των αποτυπωμάτων (`gate-index:generate` ·
  `text-measure:census` · γεννήτορας ειδοποιήσεων). ⚠️ **ΜΟΝΟ ΜΕΤΑ** το commit των 26 + Φ1: αλλάζει την τιμή, άρα το σταδιοποιημένο
  `CLAUDE.md` θα έκρινε μπαγιάτικο. **Μέγεθος:** < 1h κώδικα, αλλά 3 γεννήτορες ⇒ απόφαση Giorgio για τη σειρά.

- 🟡 **30/10 — ΤΕΣΣΕΡΑ ΑΝΤΙΓΡΑΦΑ ΤΟΥ `toPosix` ΑΠΟΜΕΝΟΥΝ** *(ADR-924 §8.9–§8.10 · N.0.2)*

  **Τι:** το SSoT είναι το φύλλο `scripts/lib/posix-path.js`. ✅ 30/10 (§8.10): επτά της διαλέκτου `split(path.sep)` ενώθηκαν
  (`golden-triage/scan` · `prerender/route-tree` · `shell-boundary/tree` · `text-measure-tier/census` · `workspace-scope/scope` ·
  `zindex/foreign-census` · `zindex/sites`). **Μένουν:** `shell-utilities/reach` (ίδια διάλεκτος, αλλά το `file` το βλέπει ως «data»
  — μη-έγκυρο UTF-8; ⇒ έλεγχος bytes ΠΡΙΝ το ξαναγράψει κανείς) · `check-a11y-test-coverage-ratchet` (`toPosixRel`) ·
  `adr-sections/scan` · `jest-partition/jest-configs` (διάλεκτος `replace(/\\/g, '/')` — μετατρέπει και backslash: θέλει έλεγχο ανά
  καταναλωτή ότι δεν δέχεται ποτέ backslash ως χαρακτήρα ονόματος). **Μέγεθος:** < 30′.

- 🟡 **30/10 — ΤΟ `tallyOf` ΤΟΥ `gate-commit-view/judge.js` ΔΕΝ ΜΕΤΑΦΕΡΘΗΚΕ ΣΤΟ `gate-ledger`** *(ADR-924 §8.8 · N.0.2)*

  **Τι:** το ίδιο `tallyOf` με τους 7 που ενώθηκαν στο `scripts/lib/gate-ledger.js` (`closedTally`). Δεν αγγίχθηκε επειδή το αρχείο
  είναι στα **26 σταδιοποιημένα** της Β. **Θεραπεία:** μετά το commit των 26, `const tallyOf = (rows) => closedTally(rows, STATES,
  '3.107')`. **Μέγεθος:** 5′.

- 🟡 **28/10 — ΤΟ ΚΕΛΥΦΟΣ «id από το segment + `withAuth`» ΕΙΝΑΙ ΧΕΙΡΟΓΡΑΦΟ ΣΕ ΚΑΘΕ ROUTE `[id]`** *(εύρημα ADR-327 §8.5 · CHECK 3.28 · N.0.2)*

  **Τι:** `async function handleX(request, segmentData?: { params: Promise<{ id: string }> }) { const { id } = await
  segmentData!.params; const handler = withAuth(async (req, ctx, _cache) => …); return handler(request); }` — επαναλαμβάνεται
  ανά ρήμα και ανά αρχείο. Το CHECK 3.28 το έπιασε ως κλώνο **μέσα** στο `api/quotes/[id]/route.ts` (GET ≡ DELETE) και λύθηκε
  **τοπικά** (`quoteIdRoute`). Ίδιο ακριβώς σχήμα σε τουλάχιστον 8 αρχεία (`grep -rln "segmentData?: { params: Promise<{ id: string }> }"
  src/app/api`: `rfqs/[id]/{comparison,award,invites,vendor-contacts}` · `accounting/apy-certificates/[id]/send-email` …).
  **Θεραπεία:** ΕΝΑ `withAuthSegment<P>(run: (req, ctx, params: P) => …)` δίπλα στο `withAuth` (`src/lib/auth/`) → το `quoteIdRoute`
  γίνεται κλήση του → ratchet ανά άγγιγμα. **Μέγεθος:** > 1h, 8+ αρχεία, αγγίζει το σύνορο auth ⇒ απόφαση Giorgio.

- 🟡 **27/10 — ΤΟ VERIFIED FAKE ΔΕΝ ΞΕΡΕΙ ΔΡΟΜΕΑ-ΤΙΜΗ: `startAfter('τιμή')` με `orderBy(πεδίο)` ⇒ ΣΙΩΠΗΛΑ ΚΕΝΟ** *(εύρημα ADR-923 §5.11 «3β» · N.0.2)*

  **Τι:** στο Admin SDK, `query.orderBy('k').startAfter(v)` = «μετά από την **τιμή** `v` του `k`» (και `startAfter(v, id)` με δεύτερο
  `orderBy(documentId())`). Το fake (`src/test-utils/fake-firestore/refs.ts:141` · `query-engine.ts afterCursor`) δέχεται **ένα** όρισμα
  και ερμηνεύει **κάθε** συμβολοσειρά ως **id εγγράφου** ⇒ με ταξινόμηση κατά πεδίο δεν βρίσκει id ⇒ `return []`. Μετρήθηκε: η σπορά
  εκδόσεων της 3β αντέγραψε 400/401 γραμμές και δήλωσε «τέλος». Η 3β πέρασε σε δρομέα **κατά id** (ιδίωμα `completeness-recompute`),
  άρα **δεν** επηρεάζεται πια. **Εκτεθειμένοι** όσοι περνούν δρομέα-τιμή: `lib/admin-keyset-page.ts:110` (`startAfter(value, id)`) ·
  `network-messaging/thread-directory.ts:149` — όποιο test τους τρέχει πάνω στο fake βλέπει λάθος σελίδα.
  **Θεραπεία:** (1) περίπτωση στο συμβόλαιο `contract/firestore-contract-queries.ts` («`startAfter(value[, id])` με `orderBy(πεδίο[,
  __name__])` θέτει τη θέση κατά **τιμή**») — τρέχει **και** στον emulator· (2) `startAfter(...values)` στο fake, αντιστοίχιση ανά
  `orderBy`. **Μέγεθος:** < 1h κώδικα αλλά αγγίζει το κοινό fake ⇒ αβέβαιο ⇒ απόφαση Giorgio.

- 🟡 **26/10 — ~20 ΧΕΙΡΟΓΡΑΦΑ FIXTURES `PublicListing` ΠΑΛΙΩΝΟΥΝ ΣΕ ΚΑΘΕ ΝΕΟ ΠΕΔΙΟ ΤΟΥ ΣΧΗΜΑΤΟΣ** *(ADR-919 §7 · ADR-839 · N.0.2)*

  **Τι:** το `availability` του ADR-919 έριξε 2 σουίτες στο `main` (`TypeError … reading 'kind'`) επειδή το χειρόγραφο fixture το
  ξέχασε — 4η φορά μετά τα `models`/`videos`/`floorPlates`. Τα fixtures **δεν τυποελέγχονται ποτέ** (`tsconfig` αποκλείει τα
  `__tests__`, jest = `@swc/jest`). ✅ Το SSoT **υπάρχει** πλέον: `src/test-utils/public-listing-fixture.ts` — έγγραφο v1 μέσα από το
  `publicListingFromDocument` (η ίδια πόρτα με την παραγωγή) ⇒ νέο πεδίο με κρίκο = μηδέν αλλαγές. Το χρησιμοποιούν ήδη
  `landing-listing-fixture.ts` (3 σουίτες) + `agency-showcase-listings.test.tsx`.
  **Θεραπεία:** μετάπτωση των υπολοίπων: `grep -rlE "\): PublicListing \{|: PublicListing = \{|as unknown as PublicListing" src` (~25
  αρχεία, π.χ. `ListingDetailContent.test` · `LandingShowcase.test` · `listing-map-popup-gallery.test` · `media/__tests__/*`). Ανά
  αρχείο: κράτα **μόνο** τα πεδία που κρίνει η σουίτα. **Μέγεθος:** > 1h, 4+ αρχεία.

- 🟡 **26/10 — 261 ΣΟΥΙΤΕΣ ΜΟΚΑΡΟΥΝ ΧΕΙΡΟΓΡΑΦΑ ΤΟ `@/lib/firebaseAdmin` (≥8 ΣΧΗΜΑΤΑ) ΕΝΩ Ο VERIFIED FAKE ΥΠΑΡΧΕΙ** *(ADR-845 §10 · ADR-742 §7sexdecies · N.0.2)*

  **Τι:** `getAdminFirestore: () => ({})` (23×) · `({ collection: mockCollection })` (11×) · `() => mockDb` κ.ά. — και μια ομάδα που
  **δεν** το μοκάρει καθόλου και φτάνει στο αληθινό `getAdminFirestore()` (αποτυγχάνει πλέον αμέσως χάρη στο δίχτυ του
  `jest.setup.js`, άρα δοκιμάζει μόνο τη διαδρομή «Admin λείπει»): network-messaging (thread-writer · act-team-writer · network-inbox ·
  act-team-human-change · act-team-departure · thread-fanout) · notification settings store · `listMemberWorkspaces` ·
  `account-identities` (tour-access-request) · `entity-audit` `resolveUserDisplayName`. Ο **verified fake**
  `src/test-utils/fake-firestore/` (σουίτα συμβολαίου και στον emulator) υπάρχει ήδη.
  **Θεραπεία:** **ΕΝΑ** `src/test-utils/admin-firestore-double.ts` (πρότυπο `public-shelf-double.ts`: μία γραμμή import, δένει τον
  verified fake στο `getAdminFirestore`) → πρώτα η ομάδα «χωρίς mock» (ώστε να ελέγχει τη διαδρομή «Admin υπάρχει»), μετά ratchet
  στα 261 ανά άγγιγμα. **Μέγεθος:** > 1h, 10+ αρχεία ⇒ απόφαση Giorgio για προτεραιότητα.

- 🔴 **26/10 — Η ΚΑΝΟΝΙΚΟΠΟΙΗΣΗ ΑΝΑΖΗΤΗΣΗΣ ΣΠΑΕΙ ΤΟ ΤΕΛΙΚΟ ΣΙΓΜΑ ΣΤΑ ΚΕΦΑΛΑΙΑ** *(εύρημα ADR-923 §5.10.4 Β2 · N.0.2)*

  **Τι:** το `normalizeSearchText` (`src/lib/search/search.ts`) κάνει `stripDiacritics` (που περιέχει `ς→σ`) **πριν** από το
  `toLowerCase()`. Η JS γράφει το κεφαλαίο τελικό «Σ» ως «ς» στο τέλος λέξης ⇒ «ΣΩΛΗΝΑΣ» → `σωληνας`, ενώ «σωλήνας» → `σωληνασ`.
  Άρα **κάθε** αναζήτηση που περνά από εδώ (24 αρχεία· + τα προθέματα του ευρετηρίου, `generateSearchPrefixes`) δεν ταιριάζει
  κεφαλαία ελληνικά με πεζά σε λέξεις με τελικό σίγμα. Μετρημένο με test (`subapps/catalog/derived/__tests__/sort-key.test.ts`).
  **Θεραπεία:** `stripDiacritics(raw.toLowerCase())` + test. ⚠️ **ΟΧΙ επί τόπου**: τα αποθηκευμένα προθέματα του ευρετηρίου τα
  γράφουν οι **Cloud Functions** με προβολή του ίδιου αρχείου (CHECK 3.93) — αλλαγή χωρίς ανάπτυξη των Functions + επανευρετηρίαση
  κάνει τα ερωτήματα του `/api/search` να αποκλίνουν από τα αποθηκευμένα. Απόφαση Giorgio (ανάπτυξη). Ο κατάλογος ήδη παρακάμπτει
  σωστά (`catalogSortKey`: πεζά **πριν** το SSoT). **Μέγεθος:** κώδικας < 1h· ανάπτυξη + reindex = απόφαση.

- 🟡 **26/10 — Η ΦΟΡΜΑ ΛΗΨΗΣ ΠΑΝΟΡΑΜΑΤΟΣ ΔΕΝ ΧΡΗΣΙΜΟΠΟΙΕΙ ΤΟ ΚΟΙΝΟ `MediaRightsFields`** *(ADR-923 §5.10.4 · N.0.2)*

  **Τι:** το `src/components/spatial-tour/TourCaptureUploadForm.tsx` χτίζει τα δικαιώματα μόνο του (`declarationOf` · δικά του πεδία
  δημιουργού/σκοπού/διάρκειας). Το γενικό SSoT υπάρχει πλέον: `lib/media-rights/media-rights-draft.ts` (πρόχειρο ⇄ `MediaRights`,
  κρατά αδειοδότες/όρους web) + `components/shared/media-rights/MediaRightsFields<C>` (πλαίσιο `listing`/`catalog`). Ο κατάλογος το
  χρησιμοποιεί· η λήψη πανοράματος όχι ⇒ δύο `declarationOf` για την ίδια δήλωση IPTC.
  **Θεραπεία:** `DeclarationFields` ⇒ `MediaRightsFields<'listing'>` + `mediaRightsOf`· οι λέξεις από το `spatial-tour-labels.ts`
  (`LICENSE_PURPOSE_KEY` είναι ήδη `Record<MediaLicensePurposeIn<'listing'>,…>`). Άγκυρα: η φόρμα παράγει **το ίδιο** `MediaRights`
  με σήμερα (byte προς byte στο `declarationOf` test). ⚠️ Το `«έως ημερομηνία» χωρίς ημερομηνία` γίνεται πλέον εύρημα (σήμερα
  γίνεται σιωπηλά «χωρίς λήξη»). **Μέγεθος:** ~1-2h, 2-3 αρχεία.

- 🟡 **26/10 — Ο DXF ΝΑ ΠΕΡΑΣΕΙ ΣΤΟ ΓΕΝΙΚΟ ΜΟΝΤΕΛΟ ΠΛΕΓΜΑΤΟΣ** *(ADR-923 §5.10.4 Στάδιο Β · N.0.2)* — ✅ το γενικό **υπάρχει** πλέον:
  `lib/spreadsheet/{grid-navigation,grid-selection,grid-key-intent,paste-plan,grid-history}.ts` (ίδιο λεξιλόγιο κινήσεων με το
  `TableCursorMove`· 95 tests, 14/14 μεταλλάξεις). Μένει **μόνο** η μετάπτωση του DXF (παρακάτω).

  **Τι:** το `dxf-viewer/ui/table-cell-editor/table-cell-key-intent.ts` (403 γραμμές) είναι η μόνη καθαρή «πλήκτρο ⇒ πρόθεση» τύπου
  Excel στο repo, δεμένη σε τύπους DXF (`TableCursorMove` · `TableCellCursorMode`). Το γενικό πλέγμα δεδομένων της 2δ (Στάδιο Β,
  `components/ui/data-grid/`) θα χρειαστεί το ίδιο ⇒ **γενικό** `lib/spreadsheet/grid-key-intent.ts` στο ίδιο ιδίωμα, και μετά ο DXF
  να γίνει καταναλωτής του. **Θεραπεία:** μετάπτωση του DXF μετά το Στάδιο Β· CHECK 3.62 (δημόσια επιφάνεια) + οι άγκυρες του
  table-cell-editor. **Μέγεθος:** > 1h, 4+ αρχεία.

- 🟡 **25/10 — Ο «ΑΥΣΤΗΡΟΣ» ΑΝΑΛΥΤΗΣ ΑΡΙΘΜΩΝ ΖΕΙ ΣΕ ΞΕΝΟ ΤΟΜΕΑ ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΑΥΣΤΗΡΟΣ** *(εύρημα ADR-923 Φ2α §5.10.1)*

  **Τι:** το `parseStrictDecimal` ζει στο `src/lib/survey-record/survey-number.ts` αλλά το καταναλώνουν **5 τομείς**
  (`SourcedFieldRow` · `survey-bindable-fields` · `document-body-values` · `energy-certificate/pea-text` · `survey-reconciliation`) ⇒
  είναι γενικό SSoT σε λάθος σπίτι. **Και** δέχεται `Number("0x10") = 16` και `"1e3" = 1000` (καμία γραμματική πριν το `Number`).
  **Θεραπεία:** μετακίνηση στο `src/lib/number/locale-number.ts` (re-export από το παλιό σημείο ή ενημέρωση 5 εισαγωγών) + γραμματική
  όπως το `ENTERED_AMOUNT` του `src/subapps/catalog/values/decimal-amount.ts` (που τότε γίνεται καταναλωτής του, όχι δίδυμο).
  ⚠️ Προσοχή στο `SourcedFieldRow` (αναλύει **ανά πληκτρολόγηση**: το «12,» δεν πρέπει να γίνει ξαφνικά `null` χωρίς απόφαση).

- 🟡 **25/10 — Η ΠΥΛΗ ΔΕΙΚΤΩΝ ΤΟΥ ADMIN SDK ΕΙΝΑΙ ΤΥΦΛΗ ΣΕ ΕΡΩΤΗΜΑΤΑ ΜΕΣΑ ΣΕ ΣΥΝΑΛΛΑΓΗ (3.91)** *(ADR-923 §5.9.1, εύρημα της Φ1β)*

  **Τι:** το `scripts/_shared/firestore-query-chain.js` αγκυρώνει σε αλυσίδα που **τελειώνει** σε `.get()/.stream()/.onSnapshot()`
  (`TERMINALS`). Το `transaction.get(db.collection(X).where(…))` περνά το ερώτημα ως **όρισμα** ⇒ ο σαρωτής δεν το βλέπει ποτέ.
  **Μετρημένο:** τα 5 ερωτήματα συναλλαγής του `src/server/catalog/catalog-library-reads.server.ts` άφησαν αμετάβλητα τα «551
  σημεία». Ισχύει για **κάθε** συναλλαγή του repo με ερώτημα — ένα ερώτημα χωρίς δείκτη θα έσκαγε `FAILED_PRECONDITION` μόνο στην
  παραγωγή. **Θεραπεία:** αναγνώριση `tx.get(<αλυσίδα>)` / `transaction.get(<αλυσίδα>)` ως αγκύρωσης στο `scanFileChains`, με άγκυρα
  στο `firestore-admin-index-gate.test.js` και μέτρηση του νέου πληθυσμού πριν γίνει μπλοκάρουσα (μπορεί να φέρει παλιά ευρήματα ⇒
  baseline). **Μέγεθος:** ~2-3h, 2-3 αρχεία. Οι δείκτες του καταλόγου δηλώθηκαν ήδη ρητά.

- 🟡 **25/10 — Η ΕΙΣΑΓΩΓΗ DXF ΠΕΤΑ ΤΑ ΤΟΞΑ ΠΟΛΥΓΡΑΜΜΩΝ (42)** *(ADR-636 Φ2.4 D.8, εύρημα του βήματος εξαγωγής του Z)*

  **Τι:** το `parseVerticesFromPairs` (`dxf-viewer/utils/dxf-converter-helpers.ts`) διαβάζει το `bulge` κάθε κορυφής, αλλά το
  `buildPolylineSceneEntity` (`utils/dxf-entity-converters.ts`) δεν γράφει `bulges` στη σκηνή. Άρα κάθε τόξο LWPOLYLINE/POLYLINE
  από εισαγόμενο DXF γίνεται χορδή, σε οθόνη, μέτρηση και εξαγωγή. Η D.8 ήδη γράφει 42 στην εξαγωγή, αλλά μόνο για τόξα
  σχεδιασμένα στην εφαρμογή. **Θεραπεία:** `bulges` παράλληλος πίνακας στο `buildPolylineSceneEntity` (μόνο αν `hasAnyBulge`),
  κλιμάκωση/τοποθέτηση block (κατοπτρισμός ⇒ αλλαγή προσήμου) και άγκυρα στο `dxf-roundtrip-elevation.test.ts`. Ο renderer, το
  hit-test και το bbox είναι ήδη bulge-aware (ADR-510). **Μέγεθος:** ~1-2h, 3-4 αρχεία. Αλλάζει την όψη **κάθε** εισαγόμενου
  σχεδίου με τόξα, άρα αποφασίζει ο Giorgio.

- 🟡 **24/10 — ΤΡΙΑ ΑΝΤΙΓΡΑΦΑ ΤΟΥ «ΚΑΘΑΡΟΥ `useId` ΓΙΑ `url(#…)`»** *(ADR-920 Β4.8 υπο-βήμα 4, εύρημα SSoT audit)*

  **Τι:** δημιουργήθηκε το SSoT `src/hooks/media/useSvgFragmentId.ts` και το χρησιμοποιούν ο χάρτης εδάφους + το
  `FloorPlateUnitLayer`. Μένουν **τρία** χειρόγραφα `useId().replace(/:/g, '')` (καθαρίζουν **μόνο** `:` — η μορφή του `useId` αλλάζει
  ανά έκδοση: 18 `:r0:` · 19.1 `«r0»` · 19.2, η τωρινή, `_r_0_`· σήμερα δεν σπάει τίποτα, αλλά η επόμενη αλλαγή μορφής θα σπάσει
  σιωπηλά το `url(#…)` σε τρία σημεία αντί για ένα): `owner-property/OwnerPropertyStatsChart.tsx:139` ·
  `sales/payments/financial-intelligence/InterestReserveChart.tsx:51` · `dxf-viewer/ui/ribbon/components/buttons/MepToolIcon.tsx:35`.
  **Θεραπεία:** `useSvgFragmentId('<πρόθεμα>')`. **Μέγεθος:** ~15′, 3 αρχεία, 3 τομείς (γι' αυτό εδώ και όχι επί τόπου, N.0.2).

- 🟡 **24/10 — ΤΡΕΙΣ ΣΥΝΑΡΤΗΣΕΙΣ ΤΟΥ `lib/demand` ΠΑΝΩ ΑΠΟ 40 ΓΡΑΜΜΕΣ (N.7.1)** *(ADR-919 «επαλήθευση §12», εύρημα εκτός βήματος 9)*

  **Τι:** μετρημένο 2026-10-24 με AST (σώμα συνάρτησης): `demand-form-load.ts` `demandFormFrom` **57** · `demand-form-values.ts`
  `placeFrom` **48** · `demand-match-axes.ts` `spatialOutcome` **44**. Προϋπήρχαν. Δεν τα άγγιξε το βήμα 9, που διόρθωσε μόνο τα δικά
  του (`buildConcessionReport` · `DemandConcessionList` · `DemandAnswerPanel`). **Θεραπεία:** εξαγωγή βοηθών (EXTRACT, ποτέ trim),
  με τις υπάρχουσες σουίτες του `src/lib/demand` ως δίχτυ. **Μέγεθος:** ~1h, 3 αρχεία, ένας τομέας.
  **+ 24/10 (άξονας «παράδοση», ADR-919 §12):** `components/search-results/filters/CriterionField.tsx` `CriterionField`, ο
  διανομέας `switch` ανά σχήμα: ήταν ήδη >40 και μεγάλωσε κατά 9 με το `'date-bound'`. Θεραπεία: πίνακας `Record<CriterionShape,
  …>` αποδοτών αντί για `switch`, ώστε η εξαντλητικότητα να μείνει του μεταγλωττιστή.

- 🟡 **23/10 — ΔΥΟ ΛΕΞΙΛΟΓΙΑ ΚΥΚΛΟΥ ΖΩΗΣ ΚΤΙΡΙΟΥ: `Building.status` ΚΑΙ `Building.phase`** *(ADR-919 §7, εύρημα του βήματος 3)*

  **Τι:** το `status` (`constants/building-statuses.ts`, ADR-287: planning · construction · completed · active) και το `phase`
  (`types/building/elevation.schemas.ts`, ADR-369: planned · permitted · under_construction · completed) απαντούν το **ίδιο**
  ερώτημα («σε ποιο στάδιο είναι το κτίριο;») με δύο λεξιλόγια. **Μετρημένο 2026-10-23:** `status` σε 10/10 κτίρια, `phase` σε **0**·
  το `phase` το δέχεται μόνο το elevation patch schema, κανένας αναγνώστης. Ο επιλυτής διαθεσιμότητας ρωτά **μόνο** το `status`
  (`isDeliveredBuildingStatus`). **Κίνδυνος:** όποιος γράψει `phase: 'completed'` χωρίς `status` θα δει την αγγελία `unknown`.
  **Θεραπεία:** ένα λεξιλόγιο (το `status`, που έχει δεδομένα και SSoT). Το `permitted` του `phase` ή γίνεται τιμή του `status`
  ή αποσύρεται. **Μέγεθος:** ~1h + απόφαση Giorgio για το `permitted`.

- 🔴 **21/10 — ΤΟ ACCOUNTING REPOSITORY ΔΙΑΒΑΖΕΙ/ΓΡΑΦΕΙ ΚΑΤΑ ID ΧΩΡΙΣ ΦΡΑΧΤΗ ΕΝΟΙΚΙΟΥ** *(ADR-917 §2.4 Λ11, εύρημα Φ4)*

  **Τι:** οι `get*/update*/delete*` κατά id δέχονται `tenant` αλλά **δεν** τον διαβάζουν — το Admin SDK παρακάμπτει τους κανόνες,
  άρα ένα id αρκεί για ξένο έγγραφο. Στη Φ4 διορθώθηκε **μόνο** το `accounting-repo-documents.ts` (παραστατικά εξόδου · ΑΠΥ ·
  κατηγορίες). **Πού μένει** (μετρημένο 2026-10-21, `grep "\.doc([a-zA-Z]*Id)"` χωρίς έλεγχο ιδιοκτησίας):
  `accounting-repo-financial.ts` (εγγραφές Ε-Ε, **τιμολόγια**, δόσεις φόρου) · `accounting-repo-operations.ts` (τραπεζικές κινήσεις,
  πάγια) · `matching-rules-repo.ts` · `accounting-repo-entities.ts` (πληρωμές ΕΦΚΑ). **Θεραπεία:** ο ΗΔΗ υπάρχων φράχτης
  `services/repository/tenant-owned-doc.ts` (`readOwnedDoc` · `updateOwnedDoc` · `deleteOwnedDoc`), όπως στο
  `accounting-repo-documents.ts`, + σουίτα στο πρότυπο `__tests__/expense-documents-tenant-confirm.test.ts`. Προσοχή: κάθε
  `update` που **περιμένει** να ρίξει σε ανύπαρκτο έγγραφο πλέον ρίχνει `OwnedDocumentNotFoundError` — ελέγξτε τους καλούντες.
  **Μέγεθος:** > 1h, 5 αρχεία ⇒ εντολή Giorgio. **Προτεραιότητα:** υψηλή (ασφάλεια, ίδια κλάση με το ADR-917 Ε5).

- 🟡 **16/10 — ΤΑ POST-FINALIZE HOOKS ΜΑΛΛΟΝ ΔΕΝ ΤΡΕΧΟΥΝ ΠΟΤΕ ΓΙΑ ΑΝΕΒΑΣΜΑΤΑ ΑΠΟ BROWSER** *(ADR-915 §20.8, εύρημα audit — ΔΕΝ επαληθεύτηκε)*

  **Τι:** `FileRecordService.finalizeFileRecord` (`services/file-record.service.ts`) τρέχει **στον browser** και καλεί
  `triggerPostFinalizeHooks` (`services/file-record-post-finalize-hooks.ts`), που επιστρέφει αμέσως όταν
  `typeof window !== 'undefined'`. Άρα ο εμπλουτισμός ISO 19650 (ADR-373) και το DXF auto-process (ADR-312 Φ7.1)
  **μάλλον** δεν τρέχουν για κανένα ανέβασμα από browser — το ADR-899 §3.7 γράφει ήδη ότι «τα server hooks δεν τρέχουν».
  **Πρώτα:** επαλήθευση (ένα ανεβασμένο DXF κάτοψης: γεννήθηκε επεξεργασία; ένα αρχείο: γράφτηκε `iso19650Source`;).
  **Αν ισχύει, θεραπεία:** το πρότυπο του ADR-915 §20 — καταναλωτής του CDC των αρχείων (ADR-905 §6) ή Storage
  `onFinalize` (ADR-899), όχι hook στον client. **Μέγεθος:** άγνωστο ως την επαλήθευση ⇒ απόφαση Giorgio.

- 🟡 **13/10 — ΔΥΟ ΑΓΩΓΟΙ ΑΝΕΒΑΣΜΑΤΟΣ ΑΝΤΙΓΡΑΦΟΥΝ ΤΑ ΙΔΙΑ ΠΕΔΙΑ ΜΕ ΤΟ ΧΕΡΙ** *(ADR-914 §8.24, εύρημα κατά τη διόρθωση της §2.20)*

  **Τι:** `uploadFileWithPolicy` (`services/filesystem/upload-orchestrator-gateway.ts`, ADR-292) και `uploadEntityFile`
  (`services/filesystem/upload-entity-file.ts`, ADR-054) χτίζουν το ίδιο όρισμα του `createPendingFileRecordWithPolicy`
  πεδίο προς πεδίο. **Γιατί:** ο πρώτος δεν είχε `levelFloorId` ⇒ η ίδια κάτοψη έχανε τον όροφό της ανάλογα με την οθόνη
  που την ανέβασε (παραγωγή, 13/10). Κάθε νέο πεδίο του FileRecord θα αποκλίνει ξανά. **Διόρθωση:** ένας κατασκευαστής του
  εκκρεμούς FileRecord, και οι δύο αγωγοί τον καλούν· τα βήματα Storage / μικρογραφίας / finalize είναι επίσης δίδυμα.
  **Μέγεθος:** > 1h, 4+ καταναλωτές ⇒ δική του εργασία, με εντολή Giorgio.

- 🟡 **12/10 — Η ΓΡΑΜΜΗ «ΛΙΣΤΑ + ΛΕΠΤΟΜΕΡΕΙΕΣ» ΕΙΝΑΙ ΓΡΑΜΜΕΝΗ ΜΕ ΤΟ ΧΕΡΙ ΣΕ 5 ΑΡΧΕΙΑ** *(ADR-777 §8.87.9ε, εύρημα ε1)*

  **Τι**: `hidden md:flex flex-1 gap-2 min-h-0 min-w-0 overflow-hidden` — η σταθερά `DESKTOP_SPLIT` του
  `core/layouts/ListDetailsSplit.tsx`, αντιγραμμένη. **Πού**: `grep -rn "hidden md:flex flex-1" src` ⇒
  `crm/tasks/TasksPageContent` · `contacts/ContactsPageContent` · `building-management/BuildingsPageContent` ·
  `procurement/hub/ProcurementHubPage` · `features/properties-sidebar/PropertiesSidebar` (μετρημένο 2026-10-12).
  **Γιατί μετρά**: το έκτο αντίγραφο (`projects/ProjectViewSwitch`) είχε **αποκλίνει** — χωρίς `min-w-0
  overflow-hidden` — και η στήλη λεπτομερειών ταλαντευόταν 517 ↔ 1976px στην παραγωγή (1280px). Διορθώθηκε 12/10:
  εισάγει πλέον το `DESKTOP_SPLIT`. **Θεραπεία**: οι πέντε να εισαγάγουν τη σταθερά, ή —καλύτερα— να γίνουν
  καταναλωτές του στοιχείου `ListDetailsSplit` (εκστρατεία ADR-912, που κατέχει και το φύλλο κινητού). **Γιατί όχι
  τώρα**: 5 αρχεία σε 5 περιοχές, και η μετάβαση στο στοιχείο αλλάζει το πόσα αντίτυπα των λεπτομερειών υπάρχουν στο
  DOM (N.0.2: 4+ αρχεία).

- 🟡 **08/10 — ΤΟ «ΠΛΑΙΣΙΟ ΕΝΟΤΗΤΑΣ» ΕΙΝΑΙ ΓΡΑΜΜΕΝΟ ΜΕ ΤΟ ΧΕΡΙ ΣΕ 63 ΑΡΧΕΙΑ** *(ADR-777 §8.87.4, εύρημα κατά το audit)*

  **Τι**: η συνταγή `rounded-(md|lg) border border-border bg-card p-4` πάνω σε `<section>` — δηλαδή «`Card` που είναι
  ορόσημο». **Πού**: `grep -rlE "rounded-(md|lg) border border-border bg-card p-4" src` ⇒ **63** αρχεία (μετρημένο
  2026-10-08· μεταξύ τους `properties/tabs/PropertyListingTab.tsx`). **Γιατί υπάρχει**: το `Card` αποδίδει μόνο
  `<div>`, άρα όποιος θέλει `<section aria-labelledby>` με πλαίσιο το ξαναγράφει. **Θεραπεία**: θυρίδα στοιχείου στο
  `Card` (`as`) ή ένα primitive «πλαισιωμένη ενότητα» με επικεφαλίδα — το `spatial-tour/TourPanelSection.tsx` είναι
  η τοπική του μορφή (τυλίγει `Card`, δεν επαναλαμβάνει τη συνταγή). Αλλάζει εμφάνιση σε 63 οθόνες ⇒ δικό του σχέδιο.
  **Πρόοδος (ADR-777 §8.87.10)**: παρτίδα 0 ✅ 08/10 — `Card asChild` + `ui/section-frame.tsx` (`SectionFrame`) +
  `TourPanelSection` ως καταναλωτής· παρτίδα 1 ✅ 08/10 — `listing-detail` (8 αρχεία)· παρτίδα 2 ✅ 08/10 — `demand`
  (9 αρχεία)· παρτίδα 3 ✅ 08/10 — `owner-property` (9) + `properties` (2)· παρτίδα 4 ✅ 08/10 — `mandate` (11)· παρτίδα 5 ✅ 09/10 — `stay-calendar` · `contact` · `area-market` · `shared/forms` ·
  `property-dossier` · `admin` (15 αρχεία / 16 εμφανίσεις· `FormFieldset` με κλειστό `gap`, το `ShowcaseLocationEditor`
  καταναλωτής του)· παρτίδα 6 ✅ 12/10 — τα 10 τελευταία (το δέκατο, `floorplan-import/StepCreateConfirm`, γεννήθηκε
  12/10 με τη συνταγή γραμμένη με το χέρι). **Υπόλοιπο: 0 αρχεία** (grep 12/10 μετά την παρτίδα 6) — **ο κώδικας
  έκλεισε, η εγγραφή ΟΧΙ**: μένουν (i) ζωντανή ματιά παρτίδας 6 μετά την ανάπτυξη, (ii) απόφαση Giorgio για τις κενές
  καταστάσεις, (iii) η πύλη που θα κρατήσει το 0 (πρόταση, §8.87.10 «Ανοιχτό» δ) — χωρίς αυτήν το 0 κράτησε **τρεις
  μέρες**. ⚠️ Οι κενές καταστάσεις (8 ως τώρα) φορούν προσωρινά σκέτο `Card`: η σύγκλιση στο `shared/EmptyState`
  αλλάζει διάταξη (κεντραρισμένο ↔ αριστερά) και θέλει απόφαση Giorgio. Ταξινόμησε ανά εμφάνιση (πίνακας στη §8.87.10): ενότητα με τίτλο ⇒ `SectionFrame`· γραμμή
  λίστας / κάρτα / σκελετός ⇒ `<Card asChild>`. Εκτός grep: 32 συγγενείς εμφανίσεις με `p-3`/`p-5`/`p-6`.

- 🟡 **08/10 — ΧΕΙΡΟΓΡΑΦΟ «ΚΟΥΜΠΙ ΠΕΡΙΓΡΑΜΜΑΤΟΣ» ΣΕ 27 ΑΡΧΕΙΑ** *(ADR-777 §8.87.10, εύρημα κατά την παρτίδα 2)*

  **Τι**: `rounded-md border border-border bg-card px-(3|4) py-(1.5|2) font-medium text-foreground` πάνω σε `<Link>` ή
  `<button>` — δηλαδή το `Button variant="outline"` γραμμένο με το χέρι. **Πού**:
  `grep -rlE "rounded-md border border-border bg-card px-[34] py-(1\.5|2)" src` ⇒ **27** αρχεία / **29** εμφανίσεις
  (μετρημένο 2026-10-08· π.χ. `demand/DemandAnswerPanel`, `demand/DemandTitleEditor`, `listing-detail/ListingDetailContent`).
  **Γιατί μετρά**: τουλάχιστον μία εμφάνιση (`interest-check/InterestCheckResult`) δεν έχει ούτε `focus-visible`
  δακτύλιο ούτε `hover` — **δεν ελέγχθηκαν και οι 29**· αν ισχύει γενικά, είναι και κενό προσβασιμότητας, όχι μόνο διπλότυπο. **Θεραπεία**: `<Button variant="outline" asChild><Link …/></Button>` (το `Button` έχει ήδη `asChild`).
  Αλλάζει όψη (ύψος, δακτύλιος) σε 27 οθόνες ⇒ δικό του σχέδιο, μετά το πλαίσιο ενότητας.

- 🟡 **07/10 — ΤΡΕΙΣ ΣΥΜΒΑΣΕΙΣ «ΑΠΟΣΥΡΜΕΝΗ ΕΓΓΡΑΦΗ ⇒ ΜΟΝΟ ΑΝΑΓΝΩΣΗ», ΕΝΑΣ ΠΑΡΟΧΟΣ** *(ADR-329 §3.9 υπο-στάδιο 3γ · ADR-281)*

  Το ακίνητο ρωτά πλέον `useRetiredKind()` (`src/lib/firestore/retired-record-context.tsx`, το θέτει **μόνο** το
  `PropertyDetailSurface`). Την ίδια ερώτηση απαντούν ακόμη με δικό τους prop: **(α)** `isTrashMode` σε κτίρια/έργα
  (κλειδώνει μόνο την κεφαλίδα) · **(β)** `readOnly → isContactTrashed` στις επαφές (`ContactDetails` →
  `UnifiedContactTabbedSection` → `contactRenderersCore`: μόνο `defaultActiveTab='trash'` + χειρόγραφη ταινία με emoji,
  ενώ το ανέβασμα αρχείων **μένει ανοιχτό**). Η σύγκλιση στον ίδιο πάροχο **αλλάζει συμπεριφορά** σε άλλες οντότητες
  (ο `EntityFilesManager` θα κλειδώσει ολόκληρος σε επαφή του κάδου) ⇒ θέλει δικό της σχέδιο και ζωντανό έλεγχο ανά
  οντότητα· δεν έγινε μαζί με το 3γ. Όταν γίνει: η χειρόγραφη ταινία των επαφών γίνεται `RetiredRecordBanner` /
  `TrashNotice`, και ο πίνακας `REINSTATE_PROMISES` αποκτά γραμμή ανά οντότητα (η άγκυρα θα το απαιτήσει).

- 🟡 **06/10 — ΠΑΛΙΟ ΛΕΞΙΛΟΓΙΟ ΕΜΠΟΡΙΚΗΣ ΚΑΤΑΣΤΑΣΗΣ ΣΤΟ `status` ΑΚΙΝΗΤΟΥ** *(ADR-777 Α20 · ADR-281 changelog 06/10)*

  Αναγνώστες που ρωτούν `status === 'sold' | 'available' | 'reserved'`, ενώ η εμπορική αλήθεια ζει στο
  `commercialStatus` (`deriveCommercialStatus` · `offerStateOf`) και το `status` είναι πλέον κύκλος ζωής. Μετρημένο 06/10
  με `status\s*(===|!==)\s*'(sold|available|reserved)'`: **6 σημεία σε 5 αρχεία** — `api/buildings/[buildingId]/customers`
  · `api/projects/[projectId]/customers` · `telegram/stats/repo` (3) · `financial-intelligence/portfolio-aggregator` ·
  `buildings.service`. ⚠️ Το μοτίβο **δεν** πιάνει τα `telegram/search/repo` · `telegram/smart-query` ·
  `uc-011/project-status-data-fetcher` που ανέφερε το handoff (άλλη γραφή — θέλουν δεύτερο πέρασμα). Άλλη κλάση από τον
  κύκλο ζωής: θέλει **δικό της σχέδιο** (ένας κριτής εμπορικής κατάστασης, όχι σύγκριση συμβολοσειράς) πριν από κώδικα.

- 🟡 **06/10 — ΠΥΛΗ ΤΗΣ ΚΛΑΣΗΣ «ΑΝΑΓΝΩΣΤΗΣ ΛΙΣΤΑΣ ΑΚΙΝΗΤΩΝ ΡΩΤΑ `isRetired`»: ΔΕΝ ΓΡΑΦΤΗΚΕ** *(ADR-281 changelog 06/10)*

  Σχεδιάστηκε ως module του CHECK 3.7. Μετρήθηκε ότι regex ανά γραμμή βλέπει **38** αρχεία, ενώ τη συλλογή την αγγίζουν
  **~97** — και χάνει ακριβώς τους αναγνώστες με αλυσίδα πολλών γραμμών (`usePropertiesByBuilding` ·
  `SharedPropertiesProvider` · `buildings.service` · `owner-property-stats`). Θα ήταν πράσινο που σημαίνει «δεν κοίταξα».
  Θέλει απόφαση Giorgio: έλεγχος σε επίπεδο AST (νέα πύλη) ή τίποτα.

- 🟡 **05/10 — ΚΟΥΜΠΙΑ-ΕΙΚΟΝΙΔΙΑ ΧΩΡΙΣ ΠΡΟΣΒΑΣΙΜΟ ΟΝΟΜΑ** *(WCAG 4.1.2 · ADR-898 §21.6 Ε10)*

  `<Button size="icon">` με μόνο εικονίδιο (+ ίσως tooltip) = ανώνυμο κουμπί: το tooltip **δεν** είναι όνομα. Μετρημένο
  05/10: 46 σε 22 αρχεία. Έκλεισε η οικογένεια `src/components/building-management` (άγκυρα Κ1 στο
  `shared/__tests__/building-space-actions.a11y.test.tsx`). **Μένουν 21 σε 13 αρχεία**: `crm/calendar/CalendarSidebar` (2)
  · `procurement/PurchaseOrderItemsTable` (2) · `reports/sections/cash-flow/CashFlowSettings` (2) ·
  `sales/legal/ProfessionalsCard` (2) · `sales/payments/InstallmentSchedule` (1) · `settings/company/BOQCategoriesTab` (2)
  · `shared/files/VersionHistory` (1) · `subapps/accounting/**` (9 σε 6 αρχεία) — και **8 στο `dxf-viewer`** (3 αρχεία).
  Θεραπεία: `@/components/ui/icon-button` (`IconButton`, υποχρεωτικό `label` = όνομα + tooltip)· κλειδιά σε el + en.
  Όταν μηδενίσουν: η άγκυρα Κ1 απλώνεται σε όλο το `src/` (αλλαγή του `SCOPE`) και το όνομα μπορεί να γίνει απαίτηση
  **τύπου** στο `Button` για `size="icon" | "icon-sm"`. ⚠️ Ο ανιχνευτής είναι του test (opening tag, χωρίς `aria-label`
  / `aria-labelledby`)· δεν βλέπει κουμπιά με `{...spread}` ούτε εγγενή `<button>`.
  ➕ **28/10 — η ΑΔΕΛΦΗ κλάση (ADR-327)**: κουμπί-εικονίδιο **με** `aria-label` αλλά **χωρίς** tooltip (ο άνθρωπος με ποντίκι
  βλέπει σκέτο εικονίδιο). Νέα άγκυρα **Κ2** στο ίδιο test: κανένα ωμό `<Button size="icon">` στο `building-management`
  (μηδενίστηκε: `BOQFloorGroup` 3 · `ScheduleAlertBanner` 3). Μετρημένο 28/10 στο υπόλοιπο `src/`: **81 αρχεία** με
  `size="icon"` + `aria-label` χωρίς `Tooltip`/`IconButton` (χοντρικό grep, ανά αρχείο). Ίδια θεραπεία, ίδια επέκταση `SCOPE`.

- 🟡 **05/10 — CHECK 3.17: ΤΥΦΛΟ ΣΕ ΓΡΑΦΗ ΜΕ ΜΕΤΑΒΛΗΤΗ ΣΥΛΛΟΓΗ** *(CHECK 3.17 · ADR-195 — δηλωμένο όριο, ΟΧΙ σφάλμα)*

  Η πύλη αποδίδει γραφή σε συλλογή μόνο από κυριολεκτικό `COLLECTIONS.X` κοντά της ⇒ `db.collection(name).doc(id).update()`
  είναι αόρατο. **Μετρήθηκε πριν από οποιαδήποτε διόρθωση**: ~45 αρχεία με `.collection(<μεταβλητή>)` + γραφή· σε δείγμα 10,
  7 καλούν ήδη `recordChange` ⇒ ~12–16 νέα ευρήματα, από τα οποία εκτιμώνται 1–3 αληθή (πιθανότερο το
  `buildings/[buildingId]/construction-phases/_helpers.ts`) και τα υπόλοιπα admin migrations · backups · sharing ·
  σφραγίδες συστήματος · δάνεια/επιταγές ⇒ **~80–90% ψευδώς θετικά** (χαμηλή-μέτρια βεβαιότητα: δείγμα, όχι απογραφή) —
  πολύ πάνω από τον πήχη ≤10%. **ΜΗΝ «διορθώσεις» την πύλη να τα σημαίνει όλα.** Σωστή θεραπεία: ο καλών **δηλώνει** τη
  συλλογή σε σημείο που λύνεται στατικά (π.χ. τυποποιημένο όρισμα `collection: COLLECTIONS.X` όπως στο `withVersionCheck`),
  ή απογραφή ανά αρχείο. Το όριο το καρφώνει το `scripts/__tests__/check-entity-audit-coverage.test.js` (Β7).
  ✅ **06/10 — το δείγμα των 4 αλυσίδων ορόφου ΕΚΛΕΙΣΕ** με τη θεραπεία που περιγράφεται παραπάνω: «δηλωμένο πεδίο
  γραφής» στο `src/lib/admin-batch-utils.ts` (`flushInBatches(db, updates, { collections: [COLLECTIONS.X] })` ·
  `openDeclaredBatch(db, [COLLECTIONS.X])`). Ο τύπος αναγκάζει τη δήλωση, ο κώδικας την επαληθεύει σε χρόνο εκτέλεσης,
  η πύλη τη διαβάζει στατικά ⇒ οι 4 αλυσίδες **φαίνονται** ως γραφείς και είναι καλυμμένες (tests Π5 · Π6 · Σ1–Σ6).
  **Το γενικό όριο (Β7) ισχύει ακόμη** για κάθε άλλον γραφέα με συλλογή σε μεταβλητή ή σκέτο `db.batch()` πάνω σε
  αναφορά από αλλού (π.χ. `deleteInBatches` στο `deletion-guard.ts`). ⚠️ **Δηλωμένο κενό προς απόφαση**: η μετανάστευση
  `migrate-postal-codes` γράφει σε έργα και κτίρια χωρίς γραμμή ιστορικού ανά οντότητα και μπήκε στις εξαιρέσεις της
  πύλης με λόγο· τα έργα/κτίρια δεν έχουν CDC.
  Μέτρα: `rg -l "\.collection\((?!COLLECTIONS)[a-zA-Z_.]+\)" src --pcre2 -g '!**/__tests__/**'`.

- 🟡 **03/10 — ΨΕΥΔΟ-ΤΑΥΤΟΤΗΤΑ «ΝΕΟΥ» `'__new__'`: ~18 ΣΚΕΤΑ LITERALS** *(N.0.2 · ADR-777 §8.31.12)*

  Το ADR-777 §8.31.12 δημιούργησε το SSoT **`src/lib/draft-entity-id.ts` → `DRAFT_ENTITY_ID` / `isDraftEntityId(id)`** και
  μετέφερε τους 2 καταναλωτές του `useEntityPageState` (`BuildingsPageContent` · `projects-page-content`). Μένουν: τα
  `*QuickCreateSheet` (building/project/unit) · `UnitsPageContent` · `useProjectCustomers` · `useProjectStructure` ·
  `PropertyDetailsContent` · `usePropertyMediaCounts` · `usePropertyMutationImpactGuard` · `property-mutation-gateway` (×5) ·
  `app/api/properties/[id]/route.ts`. ⚠️ `MemberEditor` · `AddressMap` χρησιμοποιούν `'__new__'` με **άλλη** σημασία (κλειδί
  test/σημείου, όχι εγγραφή) — να κριθούν, όχι να μεταναστεύσουν τυφλά. Μέτρα: `grep -rn "'__new__'" src`.

- 🟡 **02/10 — ΑΝΑΓΝΩΣΗ ΚΛΕΙΔΙΟΥ `a.b.c` ΣΕ LOCALE BUNDLE: ~26 ΤΟΠΙΚΑ ΑΝΤΙΓΡΑΦΑ** *(N.0.2 · ADR-901 Φ1)*

  Το ίδιο `key.split('.').reduce((node, part) => …, bundle)` είναι γραμμένο σε ~28 αρχεία (κυρίως άγκυρες i18n σε
  tests, αλλά και `services/data-exchange/DataExportService.ts` · `components/reports/core/ReportTable.tsx` ·
  `server/firebase-auth-config/auth-config-state.ts`). Το ADR-901 Φ1 δημιούργησε το SSoT
  **`src/i18n/locale-key-lookup.ts` → `lookupLocaleString(bundle, key)`** και το χρησιμοποιεί σε 2 σημεία. Θεραπεία:
  οι υπόλοιποι καταναλωτές γίνονται `import`. ⚠️ Τα `test-utils/fake-firestore/values.ts` ·
  `DataExportService` διαβάζουν **έγγραφα**, όχι locales — αυτά ΔΕΝ μεταναστεύουν (άλλη ερώτηση, ίδιο σχήμα).
  Μέτρα: `grep -rln "split('.').reduce" src`.

- 🟡 **02/10 — Ο ΤΥΠΟΣ ΤΟΥ `t` ΠΟΥ ΠΕΡΝΑ ΣΕ ΒΟΗΘΟΥΣ: ΔΕΚΑ+ ΤΟΠΙΚΑ ΑΝΤΙΓΡΑΦΑ** *(N.0.2 · ADR-898 §17)*

  `(key: string, options?: Record<string, unknown>) => string` γράφεται ξανά και ξανά: `PriceLabelT`
  (`lib/listings/listing-price-label.ts`) · `ShowcaseClientT` (`components/showcase-core/ShowcaseClient.tsx`) · inline σε
  `property-tab-columns` · `BuildingShowcaseSpecs` · `ProjectShowcaseSpecs` · `contact-banking-descriptions` ·
  `thread-view-helpers` · `unified-inbox-helpers` · `BudgetVarianceChart` · `DebtMaturityWall` · `useBatchFileOperations` ·
  `ContactActivityTimeline` · (και ο τοπικός `Translate` του `useBuildingObjectiveValueLabels`, Φ4β · και του `shared/BuildingSpaceRelationsPanel.tsx`, ADR-898 §20 — **ένα ακόμη**, γραμμένο εν γνώσει μέχρι να υπάρξει ο κοινός τύπος). Θεραπεία: **ένας**
  εξαγόμενος τύπος δίπλα στο `useTranslation` (`@/i18n`), τα αντίγραφα γίνονται `import type`. Μέτρα πρώτα:
  `grep -rln "(key: string, options?: Record<string, unknown>) => string" src`.

- 🟡 **01/10 — ΧΑΜΕΝΗ ΕΝΗΜΕΡΩΣΗ ΣΤΟΥΣ ΓΡΑΦΕΙΣ ΤΟΥ `persist` ΤΗΣ ΑΓΓΕΛΙΑΣ ΙΔΙΩΤΗ** *(ADR-898 §12.5 · N.7 «zero race conditions»)*

  Τα `updateOwnerProperty` · `setOwnerPropertyLifecycle` · `setOwnerPropertyAudience`
  (`services/owner-property/owner-property-write.service.ts`) διαβάζουν (`loadAdministrable`) και μετά γράφουν **όλο**
  το έγγραφο με `set` **χωρίς συναλλαγή**: δύο πράξεις που τρέχουν μαζί (π.χ. αλλαγή κοινού + επεξεργασία, ή δεύτερη
  καρτέλα) ⇒ η δεύτερη σβήνει σιωπηλά την πρώτη. Οι γραφείς που ήδη το λύνουν: `setOwnerPropertyMandate` και
  `owner-property-declarations.service.ts` (`runTransaction` πάνω στο φρέσκο έγγραφο). Θεραπεία: το `persist('overwrite')`
  να δέχεται συνάρτηση `(fresh) => next` και να τρέχει μέσα σε `runTransaction`· άγκυρα με τον ανταγωνιστή του
  `FakeFirestore` (`interfere`), όπως η Δ2 του `owner-property-declarations.test.ts`. 3 γραφείς, 1 αρχείο, < 1h.

- 🟡 **30/09 — 76 INLINE STUBS FIRESTORE (`collection: jest.fn`) ΑΝΤΙ ΓΙΑ ΤΟ ΕΝΑ FAKE** *(ADR-742 §7sexdecies.1)*

  Δεν είναι fakes: επαληθεύουν **κλήσεις**, δεν προσομοιώνουν βάση. Γι' αυτό ο φρουρός δεν τα απαγορεύει. Είναι όμως
  τυφλά σε κάθε παγίδα του Firestore (`orderBy`, `merge`, `NOT_FOUND`) που το verified fake πλέον αποδεικνύει. Θεραπεία,
  όταν αγγίζεται ένα τέτοιο αρχείο (Boy Scout): μετάβαση στο `FakeFirestore` + ισχυρισμοί πάνω στην **κατάσταση** / στο
  `writeLog()` αντί για `toHaveBeenCalledWith`. Μέτρα: `grep -rlE "collection: jest\.fn|collection = jest\.fn" src --include=*.test.ts`.

- 🟡 **29/09 — ΣΥΝΔΕΣΜΟΣ ΜΕΣΑ ΣΕ ΚΕΙΜΕΝΟ: ΕΝΑ SSoT, ΔΕΚΑΔΕΣ LITERALS** *(N.0.2 · ADR-890 §15.6 · WCAG 1.4.1)*

  Νέο `lib/ui/link-style.ts` → `VISIBLE_LINK_CLASS` (υπογράμμιση **πάντα**, πιο παχιά στο hover). Το χρησιμοποιούν μόνο η
  διαδρομή και ο πίνακας Δ.Ε. της `/area`. Έξω μένουν δύο οικογένειες literals (μετρημένο 29/09, `.tsx` στο `src/`):
  `hover:underline` (**αόρατο στην αφή**: ο σύνδεσμος φαίνεται απλό κείμενο στο κινητό) και `underline underline-offset-4`
  (σωστό, αλλά αντίγραφο). Θεραπεία: μετάβαση στο `VISIBLE_LINK_CLASS` όπου ο σύνδεσμος ζει μέσα σε κείμενο· όπου το
  `hover:underline` είναι σκόπιμο (κάρτα/κουμπί που ήδη **μοιάζει** πατήσιμο), γραπτός λόγος. Μέτρα πρώτα:
  `grep -rl "hover:underline" src --include=*.tsx`.
  ➕ **22/10 (ADR-242 Βήμα 4)**: το SSoT έχει πλέον και `ENTITY_LINK_CLASS` (όνομα οντότητας) και `BACK_LINK_CLASS` (επιστροφή,
  και οι 4 επιστροφές μετακινήθηκαν, με άγκυρα που μπλοκάρει το literal). Τρίτη οικογένεια literal:
  `text-sm font-medium text-foreground underline` σε **μη** επιστροφές, 7 σημεία: `demand/DemandCard.tsx` ×2 ·
  `DemandDetailContent` · `DemandTitleEditor` (**`<button>`** — θέλει απόφαση: σύνδεσμος ή κουμπί-κείμενο;) ·
  `conveyance/my-cases/MyCaseCardView` · `owner-property/OwnerPropertyDetailContent` · `stay-calendar/StayCalendarContent`.
  Όλα χωρίς `TOUCH_TARGET_MIN` (ύψος ~20 px < 24 px του WCAG 2.5.8).

- 🟠 **26/09 — `findContactByEmail`: ΣΩΣΤΟ ΤΩΡΑ, ΑΛΛΑ O(n) ΑΝΑΓΝΩΣΕΙΣ ΑΝΑ ΕΛΕΓΧΟ** *(ADR-884 §4.6 · ADR-827)*

  Ήταν `.limit(50)` χωρίς σελιδοποίηση ⇒ σε γραφείο με >50 επαφές δεύτερη καρτέλα για τον ίδιο άνθρωπο (διορθώθηκε:
  πλήρης σελιδοποίηση, σελίδα 500). Μένει το **κόστος**: κάθε αποδοχή εντολής / έγκριση θέασης σαρώνει **όλες** τις
  επαφές του γραφείου. Θεραπεία: πεδίο `emailKeys: string[]` (πεζά, trim) σε **κάθε** γραφέα επαφής (`contact-document-builder`
  + πελατικός γραφέας + αλλαγές email) + backfill + `where('emailKeys','array-contains',email)` + δείκτης. Μέτρα πρώτα
  πόσοι γραφείς γράφουν `emails` (`grep -rn "emails:" src/services src/server`).

- 🟡 **26/09 — ΤΡΙΑ ΜΟΤΙΒΑ ΑΙΣΙΟΔΟΞΗΣ ΑΛΛΑΓΗΣ, ΕΝΑ ΚΟΙΝΟ HOOK** *(N.0.2 · ADR-884 §4.6)*

  Το `hooks/useReconciledResource.ts` (εξαγμένο από το `useShareLinks`, 3 καταναλωτές) είναι πλέον ο **ένας** τρόπος.
  Εκτός μένουν: `lib/stay/stay-calendar-optimistic.ts` (+`useStayCalendar`) · `services/entity-linking/utils/optimistic.ts`
  (`OptimisticUpdateManager`) · `components/demand/DemandTitleEditor.tsx` (`useOptimisticRename`). Θεραπεία: μετάβαση όπου το
  σχήμα ταιριάζει (στιγμιότυπο → εφαρμογή → διακομιστής → συμφιλίωση)· όπου όχι, γραπτός λόγος.

- 🟡 **26/09 — `displayName` ΑΡΧΕΙΟΥ ΑΠΟ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ = ΩΜΑ ΚΛΕΙΔΙΑ** *(ADR-884 §4.6 · file-display-name SSoT)*

  Το `getFileTranslation` (`services/upload/utils/file-display-name-i18n.ts`) επιστρέφει **σκέτο fallback** σε server context ⇒
  κάθε `buildPendingFileRecordData` από διακομιστή με `purpose` εκτός `STUDY_ENTRIES` αποθηκεύει «κατηγορία purpose» ωμά
  (το πανόραμα έγραφε «panoramas panorama» — διορθώθηκε αφαιρώντας το `purpose`). Δεύτερος γνωστός καλών:
  `app/api/floorplan-backgrounds/floorplan-backgrounds.handlers.ts` (`FLOORPLAN_PURPOSES.FLOOR`). Θεραπεία: αποδότης i18n
  διακομιστή για το `files` (ίδιο κενό με ADR-777 §8.22 #2) **ή** κανόνας «ο διακομιστής δεν γράφει `purpose` εκτός σπουδών» + πύλη.

- 🟠 **26/09 — ΚΑΝΕΝΑΣ ΜΗΧΑΝΙΣΜΟΣ ΔΙΑΓΡΑΦΗΣ ΛΟΓΑΡΙΑΣΜΟΥ / ΠΡΟΣΩΠΙΚΩΝ ΔΕΔΟΜΕΝΩΝ ΑΝΑ uid** *(ΓΚΠΔ άρθ. 17 · ADR-882 §3.6)*

  Το μόνο «GDPR» είναι του τομέα αρχείων (`app/api/files/gdpr-delete`). Κανείς δεν σβήνει τα προσωπικά έγγραφα
  ενός ανθρώπου: `user_place_searches` (ADR-882) · `saved_listings` · `property_demands` · `user_preferences` ·
  `bim_3d_preferences` · `user_notification_settings` · `notifications` κ.ά. (`tenant-config.ts` `mode:'userId'` είναι
  καλή αφετηρία απογραφής). Θεραπεία: **μητρώο** «προσωπικά δεδομένα ανά uid» (συλλογή → πεδίο/κλειδί ιδιοκτήτη →
  πολιτική: σβήσε / ανωνυμοποίησε / κράτα με νόμιμη βάση) + ένας σαρωτής + πύλη ότι κάθε νέα συλλογή `mode:'userId'`
  δηλώνεται εκεί. Δικό του ADR.

- 🟡 **26/09 — `user_preferences`: ΔΥΟ ΓΡΑΦΕΙΣ, ΔΥΟ ΚΑΝΟΝΕΣ ΚΛΕΙΔΙΟΥ** *(N.0.2 · ADR-341)*

  `services/user-settings/user-settings-repository.ts` γράφει `{uid}_{companyId}` (και ρίχνει χωρίς εταιρεία), ενώ
  `services/user/EnterpriseUserPreferencesService.ts` γράφει `{uid}_{tenantId || 'default'}` με `merge:true` στην
  **ίδια** συλλογή. Θεραπεία: grep καταναλωτών του δεύτερου· μετάβαση στο repository ή σαφής διαχωρισμός συλλογής.

- 🟠 **26/09 — CHECK 3.91 ΤΥΦΛΟ ΣΤΑ collectionGroup ΜΟΝΟΥ ΠΕΔΙΟΥ** *(ADR-884 §4.5 · ADR-870)*

  Ο Firestore φτιάχνει **αυτόματα** δείκτη μονού πεδίου **μόνο** σε εμβέλεια `COLLECTION`. Ένα
  `db.collectionGroup(X).where('f','==',v)` χρειάζεται **εξαίρεση πεδίου** με `queryScope: COLLECTION_GROUP` στο
  `firestore.indexes.json` — αλλιώς `FAILED_PRECONDITION` στην παραγωγή. Η 3.91 έμεινε **πράσινη** πάνω στο
  `listMyTourCaptureGrants` (`tour-capture-list.ts`) χωρίς την εξαίρεση (μπήκε χειροκίνητα). Θεραπεία: ο αναλυτής να
  αναγνωρίζει `collectionGroup(...)` ως ξεχωριστό είδος ερωτήματος και να απαιτεί `fieldOverrides` ανά πεδίο ισότητας·
  άγκυρα με μετάλλαξη (σβήσε την εξαίρεση ⇒ ΚΟΚΚΙΝΟ). Ίδια οικογένεια με το «0 = κανείς δεν κοίταξε».

- 🟠 **25/09 — CHECK 3.16 ΤΥΦΛΟ ΣΤΑ ΜΠΛΟΚ ΥΠΟΣΥΛΛΟΓΩΝ** *(ADR-884 §4.3 · ADR-298)*

  Ο `parseFirestoreRules()` (`scripts/_shared/firestore-rules-parser.js`) κρατά μόνο το **πρώτο** τμήμα της διαδρομής
  (`^ {4}match \/([a-zA-Z_]+)\/\{`) ⇒ `match /spatial_tours/{id}/tour_access_requests/{r}` μετρά ως `spatial_tours`.
  Κάθε μπλοκ υποσυλλογής είναι «καλυμμένο» από τη μήτρα του γονέα, που **δεν** το εκτελεί: ένα `allow read: if true` σε
  υποσυλλογή περνά **πράσινο** (ίδια οικογένεια με το «0 = κανείς δεν κοίταξε»). Σήμερα το καλύπτουν μόνο ρητές άγκυρες
  όπου κάποιος θυμήθηκε (`_harness/spatial-tour-subcollections.ts`· `rfqs/{id}/lines` είναι στο PENDING). Θεραπεία:
  ταυτότητα μπλοκ = **πλήρες** `matchPath` (το Validation F ήδη το κρατά), γραμμή manifest ανά υποσυλλογή· ratchet στα
  υπάρχοντα. ⚠️ Μέτρα πρώτα πόσα μπλοκ υποσυλλογών υπάρχουν (`grep -c "^    match /[a-z_]*/{[a-zA-Z]*}/"`).

- 🟡 **25/09 — ΤΡΕΙΣ ΜΗΧΑΝΙΣΜΟΙ ΠΡΟΣΚΛΗΣΗΣ ΑΚΟΜΗ ΕΚΤΟΣ ΤΟΥ ΚΟΙΝΟΥ ΠΥΡΗΝΑ** *(N.0.2 · N.18 · ADR-853 §20 · ADR-884 §4.4)*

  ✅ Ο πυρήνας **υπάρχει** (Κ2β, 25/09): `types/invitation-core.ts` + `server/invitations/*` — δύο είδη πάνω του (χώρου ·
  φωτογράφου). Μένουν: ADR-844 πρώτης επαφής (`services/contact/first-contact-invitation*.ts` — 🔴 κρατά **ωμό** nonce στη
  βάση, άρα η μεταφορά είναι και **διόρθωση ασφαλείας**· έχει και δικό του `readStoredInvitationState`) · ADR-327 vendor
  (`subapps/procurement/services/vendor-invite-*.ts`) · εντολής (`services/mandate/mandate-invitation.service.ts`).
  Μέθοδος: ένα `InvitationKind` ανά μηχανισμό (`locate`/`belongs` · `prepareAcceptance?` · `recordOf` · `onAccept(tx)`),
  **ένας ανά commit**, με τις υπάρχουσες σουίτες του **αμετάβλητες και πράσινες** (το πρότυπο: ADR-853 §20.4-§20.5).

- 🟡 **24/09 — ΤΟ FAVORITE API ΤΟΥ `BaseCard` ΔΕΝ ΤΟ ΚΑΛΕΙ ΚΑΝΕΙΣ** *(N.0.2 · ADR-777 §8.74.6 #2)*

  `components/core/BaseCard/BaseCard.tsx` έχει **δύο** σχήματα props (`isFavorite`/`onFavoriteToggle` και
  `onFavoriteChange`/`showFavorite`) και **τρία** σημεία απόδοσης καρδιάς (επικάλυψη εικόνας · εκτεταμένη κεφαλίδα ·
  legacy κεφαλίδα)· **κανένας** καταναλωτής (contacts/tasks/users/buildings/projects/parking/storages) δεν περνά
  `showFavorite`. Η αποθήκευση αγγελίας ζει πλέον στο `SaveListingToggle` (δημόσια αγγελία). Θεραπεία: grep όλων των
  καταναλωτών, αφαίρεση των props + των τριών κλάδων + των κλειδιών τους. Η νεκρή καρδιά του `PropertyCard` σβήστηκε ήδη (§8.74).

- 🟡 **23/09 — ΤΟ URL `tile.openstreetmap.org` ΓΡΑΜΜΕΝΟ ΣΕ ΤΕΣΣΕΡΑ ΣΗΜΕΙΑ** *(N.0.2 · ADR-777 §8.70.7)*

  `components/projects/ika/map-shared/map-styles.ts` (`OSM_MAP_STYLE`, 5 καταναλωτές) · `geo-canvas/config/index.ts`
  (`MAP_STYLES.DEVELOPMENT` — πιθανότατα νεκρό, 0 εισαγωγείς) · `geo-canvas/services/map/MapStyleManager.ts`
  (`createGreeceCustomStyle` = **το υπόβαθρο που ανοίγει ο δημόσιος χάρτης**) · `dxf-viewer/systems/basemap/basemap-source.ts`
  (`BASEMAP_SOURCES` — το μόνο με πολιτική OSMF + απόδοση ως πεδία). Διόρθωση: το `BASEMAP_SOURCES` σε `src/lib/maps/`
  και ένα `rasterStyleOf(source)` που γεννά το MapLibre style για τους άλλους τρεις. ⚠️ Αγγίζει την πύλη 3.62.

- 🟡 **23/09 — ΤΡΙΑ ΧΕΙΡΟΓΡΑΦΑ `IntersectionObserver` hooks** *(N.0.2 · ADR-777 §8.70.7)*

  Νέο κοινό `src/hooks/useNearViewport.ts` (μανδαλωμένο, ref callback). Μένουν: `dxf-viewer/utils/performance.ts#useInView`
  (`RefObject` + `useEffect([ref, options])` ⇒ κόμβος που εμφανίζεται αργότερα **δεν παρατηρείται ποτέ**, και νέο
  `options` αντικείμενο σε κάθε απόδοση ξαναστήνει τον παρατηρητή) · `geo-canvas/ui/design-system/performance/PerformanceComponents.tsx`
  (×2). Πρώτα grep καταναλωτών — μπορεί να είναι νεκρά.

- 🟡 **22/09 — ΠΕΝΤΕ ΧΕΙΡΟΓΡΑΦΑ ΑΝΤΙΓΡΑΦΑ ΤΟΥ ΚΑΤΟΠΤΡΟΥ CLAIMS, ΠΛΕΟΝ ΠΛΕΟΝΑΣΜΟΣ** *(N.0.2 · ADR-853 §16)*

  Από 22/09 ο ΕΝΑΣ γραφέας (`setClaimsWithMirror`) γράφει `companyId`/`globalRole` στο `users/{uid}`. Ο
  `claims-handler.ts` καθαρίστηκε· **μένουν πέντε** που τα ξαναγράφουν μετά την κλήση:
  `lib/workspace/workspace-provisioning.ts` · `server/auth/citizen-identity.ts` ·
  `api/admin/migrate-company-id/migration-operations.ts` · `api/admin/bootstrap-admin/route.ts` ·
  `api/admin/role-management/users/[uid]/role/route.ts` (+ ops `scripts/claims.setCompanyId.js`).
  Σήμερα γράφουν **την ίδια τιμή** ⇒ ακίνδυνα, αλλά κάθε ένα είναι δεύτερη απάντηση που μπορεί να αποκλίνει.
  ⚠️ Το `citizen-identity` θέλει προσοχή: γράφει **μαζί** ταυτότητα + κατάσταση σε μία πράξη, με δηλωμένη σειρά.

- 🟠 **22/09 — ΠΡΟΣΚΛΗΣΕΙΣ ΠΡΟΜΗΘΕΥΤΩΝ: ΤΟ ΘΕΜΑ/ΚΕΙΜΕΝΟ ΠΟΥ ΕΠΕΞΕΡΓΑΖΕΤΑΙ Ο ΧΡΗΣΤΗΣ ΔΕΝ ΣΤΕΛΝΕΤΑΙ ΠΟΤΕ** *(ADR-598 «(θ)» · ADR-328 §5.Y)*

  Στο `VendorInviteDialog` ο άνθρωπος γράφει θέμα + μήνυμα, αλλά το `CreateInviteInput` (`hooks/useVendorInvites.ts`)
  **δεν έχει** πεδία γι' αυτά ⇒ ο server στέλνει το δικό του πρότυπο και η επεξεργασία χάνεται σιωπηλά. Επιπλέον τα
  προεπιλεγμένα κείμενα (`DEFAULT_SUBJECT`/`DEFAULT_BODY`) είναι **ωμά ελληνικά** (N.11, αόρατα στον scanner) με
  `{{vendorName}}`/`{{deadline}}` που δεν αντικαθίστανται ποτέ στον client· και το `delivery.success === false` της
  απάντησης αγνοείται (η πρόσκληση υπάρχει, το email δεν έφυγε). Διόρθωση = συμβόλαιο με τον server (ή αφαίρεση των
  πεδίων από τον διάλογο) — **απόφαση Giorgio**.

- 🟡 **22/09 — `ConfirmDialog`: ΤΟ RADIX ΚΛΕΙΝΕΙ ΤΟΝ ΔΙΑΛΟΓΟ ΠΡΙΝ ΤΕΛΕΙΩΣΕΙ Η ΕΝΕΡΓΕΙΑ** *(ADR-003 · ADR-598 «(θ)» · 40 καταναλωτές)*

  Το `AlertDialogAction` κλείνει με το κλικ ⇒ ένα async `onConfirm` που αποτυγχάνει δεν έχει πού να δείξει σφάλμα, και το
  `loading` δεν φαίνεται ποτέ. Πρακτική Radix: `preventDefault` στο κλικ, κλείσιμο μετά την επιτυχία. Πρόταση: το
  `ConfirmDialog` αναλαμβάνει τον κύκλο ζωής πάνω στο `useSingleFlight` (μένει ανοιχτό, κλείδωμα, σφάλμα `role="alert"`).
  Αλλάζει ορατή συμπεριφορά σε 40 σημεία ⇒ ξεχωριστό κύμα. Σήμερα το `EditInstallmentDialog` δείχνει το σφάλμα διαγραφής σε toast.

- 🟡 **22/09 — ΤΡΕΙΣ BUILDERS ΤΟΥ `search_documents`** *(N.0.2 · ADR-874 §4 Ε-874.4 · ADR-029)*

  `functions/src/search/indexBuilder.ts` (writer παραγωγής) · `src/lib/search/search-indexer.ts` ·
  `src/app/api/admin/search-backfill/backfill-engine.ts`. Από το ADR-874 μοιράζονται **κανόνες + normalizer** (φορητό
  core, προβολή CHECK 3.93), αλλά **συνθέτουν** το έγγραφο ο καθένας: το backfill λύνει μόνο `{id}` στο href (η FLOOR
  **χάνει** το `buildingId`), μόνο αυτό γράφει `metadata`, λύνει tenant αλλιώς· ο indexer παραλείπει κενό κείμενο.
  Fix: **ένα** `buildSearchDocumentCore` στο `src/config/search-index-core.ts`, οι τρεις το καλούν. Θέλει αποφάσεις
  συμπεριφοράς (metadata σε όλους; κενό κείμενο;) ⇒ Giorgio.

- 🟡 **22/09 — ΕΠΑΦΕΣ + ΑΚΙΝΗΤΑ ΕΞΩ ΑΠΟ ΤΗ ΜΗΧΑΝΗ ΚΑΔΟΥ `useEntityTrashState`** *(N.0.2 · ADR-281 · βρέθηκε από CHECK 3.28
  στη διόρθωση πληθυντικών ICU του ADR-867, 2026-09-22)*

  Κτίρια, parking, έργα, αποθήκες τρέχουν στη **μία** μηχανή (`src/hooks/trash/useEntityTrashState.ts`). Επαφές
  (`contacts/page/useContactsTrashState.ts`) και ακίνητα (`hooks/usePropertiesTrashState.ts`) έχουν **δική** τους μηχανή
  κατάστασης. Στις 22/09 ενοποιήθηκε μόνο η **μπάρα** τους (`shared/trash/EntityTrashActionsBar.tsx` + `useTrashBarRestore.ts`)
  — ήταν δίδυμοι 20+ γραμμών. Διαφορές που πρέπει να σεβαστεί η μεταφορά: οι επαφές επανέρχονται μέσω **πολιτικής**
  (`restoreMultipleDeletedContactsWithPolicy`, όχι `TrashService`)· η μπάρα δρα και στο **ενεργό** στοιχείο του πάνελ
  (`effectiveTrashIds`)· η αποτυχία επαναφοράς **ανανεώνει** τη λίστα (409), ενώ η μηχανή σήμερα **δεν** ειδοποιεί αποτυχία.
  Διόρθωση: `EntityTrashSpec` με `restore` υπέρβαση + ειδοποίηση αποτυχίας στη μηχανή ⇒ το `useTrashBarRestore` απορροφάται.

- 🟡 **21/09 — ~240 ΧΕΙΡΟΓΡΑΦΑ MOCK ΤΟΥ `useTranslation` ΣΤΑ TESTS· ~25 ΧΩΡΙΣ `i18n`** *(N.0.2 · ADR-598)*

  SSoT πλέον: `src/test-utils/i18n-mock.ts` → `keyEchoTranslation()` (`t` ηχεί το κλειδί + `i18n.language` + `ready`
  + `currentLanguage`). Πρώτος καταναλωτής: `mandate/__tests__/client-picker-vocabulary.test.tsx` — ήταν κόκκινο 6/6
  από το `e704cacd` (το `SearchableCombobox` απέκτησε `useTranslation('common')`, ο hook διάβασε `i18n.language` σε
  `undefined`). Μέτρηση: `grep -rhoE "useTranslation: \(\) => \(\{" src --include=*.test.tsx | wc -l` ≈ **240**·
  τα 25 που κάνουν mock το `react-i18next` χωρίς `i18n` είναι **ωρολογιακές βόμβες**: σπάνε μόλις ένα component του
  δέντρου τους περάσει από τον hook του έργου (σήμερα πράσινα 23/25· το `email-type-preferences` κόκκινο για άλλο
  λόγο). Διόρθωση: μετανάστευση στο `keyEchoTranslation()` ανά τομέα, πρώτα τα 25. ⚠️ Όσα test **μεταφράζουν** από
  JSON (π.χ. `area-combobox-cold-load`) μένουν ως έχουν ή παίρνουν δεύτερο helper — όχι μαζικό `sed`.
  Επιπλέον εύρημα: `mandate/BrokeredMandateFields.tsx` + `BrokeredListingPageContent.tsx` (και άλλα) εισάγουν το
  `react-i18next` **απευθείας**, παρακάμπτοντας τον hook του έργου (`grep -rln "from 'react-i18next'" src | grep -v __tests__`).

- 🟡 **21/09 — ΣΕΛΙΔΕΣ ΤΟΥ `(app)` ΜΕ ΔΙΚΟ ΤΟΥΣ `<main>` ΜΕΣΑ ΣΤΟ `<main>` ΤΟΥ ΚΕΛΥΦΟΥΣ** *(ADR-871 §10.5 Β2/Υ9)*

  Το κέλυφος έχει πλέον **έναν** `main` (`MainContentBridge`· το `SidebarInset` έγινε `div`). Δεκάδες σελίδες όμως
  αποδίδουν **δεύτερο** μέσα του: π.χ. `NavigationPageContent`, `DashboardHome`, `ReportPage`, τα admin `*PageContent`,
  `(app)/admin/layout.tsx`, `o/[workspace]/dxf/viewer/page.tsx`, procurement (`AnalyticsPageContent`, `RfqDetailClient`, …).
  Μέτρηση: `grep -rlE "<main[ >]|as=\"main\"" src --include=*.tsx` = **121** αρχεία (όλοι οι χώροι μαζί). ⚠️ Κάποια
  components αποδίδονται **και** στο `(me)`/`(light)`, όπου το δικό τους `main` είναι **σωστό** (π.χ. `mandate/*Content`,
  `listing-detail`) ⇒ **όχι** μαζικό `sed`. Διόρθωση: σελίδα του `(app)` → `section` με `aria-labelledby`· κοινό component →
  prop ορόσημου. Πύλη: ratchet «ένα `main` ανά αποδοσμένη σελίδα» (axe `landmark-no-duplicate-main` σε smoke ανά διαδρομή).

- 🟠 **21/09 — ΤΟ «ΔΙΑΒΑΣΤΗΚΕ» ΤΗΣ ΕΙΔΟΠΟΙΗΣΗΣ ΕΧΕΙ ΔΥΟ ΠΕΔΙΑ ΚΑΙ ΤΡΕΙΣ ΤΥΠΟΥΣ** (εύρημα ADR-867 Ε10 · ανήκει στο ADR-848)

  Ο `seenFields()` (`server/notifications/notification-read.ts` — σύνδεσμος email `/n/{id}` + `POST /ack`) γράφει
  `seen: true, seenAt`· η καμπάνα (`stores/notificationCenter.ts`, συρτάρι, `useNotifications`) διαβάζει **μόνο** το
  `delivery.state` ⇒ ειδοποίηση ανοιγμένη από το email μένει **αδιάβαστη** στην καμπάνα. Και το `DeliveryState` ορίζεται
  **τρεις** φορές (`types/notification.ts` · `schemas/notification.ts` · `config/notification-events.ts` με
  `pending/delivered/failed/read` — το `read` εκεί δεν υπάρχει στους άλλους). Διόρθωση: ο `seenFields` γράφει **και**
  `'delivery.state': 'seen'`, και το `config` παράγεται από τον έναν τύπο. Ο κριτής ανάγνωσης είναι ήδη ένας
  (`lib/notifications/notification-state.ts`). ⚠️ Ο άλλος agent δουλεύει στον τομέα ειδοποιήσεων — συντονισμός πριν.

- 🟡 **22/09 — `errorFallback` ΤΟΥ `useFormSubmission` ΣΧΕΔΟΝ ΠΟΤΕ ΔΕΝ ΦΑΙΝΕΤΑΙ** *(ADR-598 «(η)» · N.11 · απόφαση Giorgio)*

  Το `getErrorMessage` επιστρέφει το `error.message` **κάθε** `Error` ⇒ ό,τι πετά ο καλούμενος φτάνει στην οθόνη αυτούσιο:
  `fetchJson` σε μη-JSON απάντηση ⇒ **«Unknown error»** (ωμό αγγλικό, `lib/api/fetch-json.ts:33`) ή `HTTP 502`· Firestore
  ⇒ τεχνικό αγγλικό. Το `errorFallback` μπαίνει μόνο για μη-`Error`. Πρόταση (πρότυπο Stripe/Google APIs): το `fetchJson` πετά
  τυποποιημένο `ApiResponseError { status, serverMessage | null }`, και το SSoT δείχνει `serverMessage` όταν υπάρχει, αλλιώς
  **πάντα** το `errorFallback` — ποτέ τεχνικό μήνυμα. Αγγίζει 9 καταναλωτές του `fetchJson` + το SSoT ⇒ απόφαση πολιτικής.

- 🟡 **22/09 — ΧΕΙΡΟΓΡΑΦΟ «mounted ref» ΣΕ 17 ΑΡΧΕΙΑ → `useMountedRef`** *(N.0.2)*

  Νέο SSoT `src/hooks/useMountedRef.ts` (22/09, test `hooks/__tests__/useMountedRef.test.tsx`)· το χρησιμοποιούν πλέον ο
  πυρήνας `useSingleFlight` και οι όψεις του (το κύμα 2α έβγαλε τα δικά τους αντίγραφα από `useInFlightAction` + `useEntrySubmit`).
  Μένουν **16** (μετρημένο 22/09 μετά το 2α, χωρίς το ίδιο το SSoT): `grep -rlE "(is)?[mM]ounted(Ref)?.current = (true|false)" src | grep -v __tests__`. Μηχανική αντικατάσταση,
  ⚠️ προσοχή σε όσα ΔΕΝ ξαναγράφουν `true` στο mount (StrictMode ⇒ ψευδές `false` στο dev).

- 🟡 **22/09 — ΤΟ ALIAS `ReturnType<typeof useTranslation>['t']` ΣΕ 17 ΑΡΧΕΙΑ** *(N.0.2)*

  Πλέον εξάγεται **μία** φορά: `type Translate` από `@/i18n/hooks/useTranslation` (22/09). Μεταφέρθηκαν τα 2 του procurement·
  μένουν 15 (`grep -rln "ReturnType<typeof useTranslation>['t']" src`) — μηχανική αντικατάσταση, ξένες περιοχές.

- 🟡 **21/09 — ΧΕΙΡΟΓΡΑΦΕΣ ΥΠΟΒΟΛΕΣ ΦΟΡΜΑΣ → `useFormSubmission` — ΚΥΜΑΤΑ** *(ADR-598 «(ζ)»/«(η)» · N.0.2)*

  🔴 **Ο πληθυσμός ΔΕΝ είναι ~29 (μετρημένο 22/09):** το grep `setSubmitting(true)` είναι τυφλό στα `setSending`/
  `setSaving`/`setIsSubmitting`/`setPending`: `grep -rlE "set(Submitting|Sending|Saving|IsSubmitting|IsSaving|Pending)(true)" src`
  = **109** αρχεία (π.χ. το `VendorInviteDialog`, που το commit `ca8e6152` δήλωνε μεταφερμένο, τρέχει ακόμα `setSending`).
  **Κύματα** (σειρά χαμηλού → υψηλού κινδύνου): ✅ **1 procurement** (22/09: Award · RfqCancel · ManualQuote · QuoteComments ·
  PO form · scan) → **2** crm + sales + shared + components → **3** accounting → **4** dxf-viewer (ADR-040). Μετά: τα υπόλοιπα.
  🔴 **Η περιοχή του κύματος 2 ήταν 28 αρχεία, όχι ~12** ⇒ ο Giorgio ενέκρινε 3 υποκύματα:
  ✅ **2α** (22/09, ADR-598 «(θ)»): sales/payments (RecordPayment · EditInstallment · Wizard · AddLoan · AddCheque ·
  LoanDetail) + υπόλοιπα procurement (QuoteRenewalRequest · RfqLinesPanel · VendorInvite). Πληθυσμός **103 → 93**.
  Νέα SSoT: `useSingleFlight` (ΕΝΑΣ πυρήνας κάτω από `useFormSubmission`/`useInFlightAction`/`useEntrySubmit`) ·
  `useFormSubmission({ validate })` · `FormDialog` (+ `secondaryAction`) · `unwrapActionResult` · `form-keyboard`
  (Ctrl/⌘+Enter, Enter-στο-θέμα) · `bankSelection` · `NumericField` με `label` χωρίς `id` ⇒ πλέον ονομάζει το πεδίο.
  → **2β** crm + shared: `crm/calendar/CalendarCreateDialog` · `crm/dashboard/dialogs/TaskEditDialog` (και οι δύο μέσω
  `crm/shared/TaskDialogShell` + `TaskDialogFormFooter` ⇒ να γίνουν περίβλημα του `FormDialog`/`FormActions`) ·
  `crm/tasks/TaskDetailPanel` (κρυφό submit + ορατό κουμπί εκτός φόρμας = δύο δρόμοι· `renderFormFields` ~115 γρ.·
  `handleComplete`/`handleDelete` χωρίς κλείδωμα) · `shared/files/{ApprovalPanel,CommentsPanel,LinkToBuildingModal}` ·
  `shared/files/media/CalibrateScaleDialog` (ωμό τεχνικό μήνυμα στην οθόνη).
  → **2γ** (θέλουν απόφαση πριν τον κώδικα): `sales/dialogs/{ChangePriceDialog,RevertDialog}` + `use-sales-action-mutation` +
  `use-sales-dialog-base` (**δύο** ανταγωνιστικά κοινά hooks για τους ίδιους διαλόγους — ενοποίηση πρώτα· `RevertDialog.handleRevert`
  83 γρ.) · `sales/legal/ProfessionalsCard` · `shared/EntityLinkCard` (autosave widget — άλλο σχήμα) · procurement
  `QuoteEditMode` (headless φόρμα με `useImperativeHandle`) · `quotes/[id]/review/QuoteReviewClient` (χωρίς `finally` στην
  επιτυχία· ωμό `fetch`) · `signatory/SignatoryProposalCard` · `oauth/OAuthConsentCard` (⚠️ ροή OAuth — ΜΟΝΟ το κλείδωμα
  των 2 κουμπιών, όχι η ανακατεύθυνση) · `auth/components/useAuthActionCode` (ήδη σωστό φύλακα — ίσως μόνο υιοθέτηση) ·
  `hooks/company/useBrokerageDeclaration` (ωμό `fetch`).

  SSoT πλέον: `src/hooks/useFormSubmission.ts` (κλείδωμα `ref` σύγχρονο + `canSubmit` **μέσα** στην υποβολή + `getErrorMessage`)
  και `src/components/ui/form/FormActions.tsx` (`<Button type="submit" form={formId}>`). Μετρημένο: **37** αρχεία με
  `setSubmitting(true)`, 8 στο procurement (4 μεταφέρθηκαν). Μέτρηση: `grep -rl "setSubmitting(true)" src | grep -v __tests__`.
  Κάθε αντίγραφο έχει τα ίδια δύο κενά: φύλακας **μόνο** στο `disabled` και «υποβάλλεται» ως **state** (δύο υποβολές
  στο ίδιο tick = δύο εγγραφές). ⚠️ Όχι μαζικό `sed`: όπου το κουμπί ζει έξω από το `<form>` με `onClick`, η φόρμα **δεν
  έχει** κουμπί υποβολής και το Enter **δεν** υποβάλλει σήμερα — η μετάβαση στο `form=` **αλλάζει** συμπεριφορά (σωστά,
  αλλά ορατά). Και: `crm/shared/TaskDialogFormFooter` → να γίνει λεπτό περίβλημα του `FormActions`.

- 🟡 **21/09 — N.7.1: ΜΕΓΑΛΕΣ JSX ΣΥΝΑΡΤΗΣΕΙΣ ΣΤΙΣ ΦΟΡΜΕΣ PROCUREMENT** *(ADR-598 «(ζ)»)*

  ➕ 22/09 (κύμα 2α, προϋπάρχοντα σε αρχεία που αγγίχτηκαν): `RfqDetailDialogs` **71** · `QuoteCommentsDrawer` **145** /
  `CommentItem` **76** · `banking/BankSelector` **119**. Όλες οι συναρτήσεις που γράφτηκαν στο 2α είναι ≤40.

  Μετά το §3 (AST, `>40` γρ.): `FrameworkAgreementFormDialog` **268** · `MaterialFormDialog` **298** · `QuoteForm` 52 ·
  `RfqBuilder` 51 · `LineRow` 93 · `RfqLineRow` 62 · `BreakpointsEditor` 63. Διόρθωση: τμήματα πεδίων ανά ενότητα με
  `FormField` render-prop (όπως έγινε σε Quote/Rfq: 238→52, 285→51). 2 dialogs κυρίως ⇒ <1h το καθένα.

- 🟡 **21/09 — `rfq-service.ts:417` `id: \`rfql_boq_${idx}_${Date.now()}\`` (N.6)** — ο client πέρασε σε
  `generateTempId`/`generateOptimisticId`· ο server φτιάχνει ακόμα id γραμμής από `Date.now()`, ενώ υπάρχει `generateRfqLineId`.

- 🟡 **21/09 — ΦΟΡΜΕΣ ΕΠΑΦΩΝ: `EscoOccupationPicker` / `EmployerPicker` / `EscoSkillPicker` ΔΕΝ ΠΑΙΡΝΟΥΝ `field.id`**

  Το `pickerRenderer` (`contactRenderersCore.tsx`) δίνει πλέον το `fieldId` που ο renderer βάζει στο `<Label htmlFor>`·
  το περνούν ΔΟΥ/Υπουργείο/Υπηρεσία. Οι τρεις ESCO/εργοδότη **δεν ελέγχθηκαν** αν δέχονται `id` — πιθανώς ίδιο κενό.
  ✔️ **Επιβεβαιώθηκε 21/09 για το `EscoOccupationPicker`**: η αλυσίδα `LinkedSinglePickerView` → `PickerSearchInput` →
  `Input` **δεν** δέχεται `id` / `aria-label` / `aria-labelledby` ⇒ η ετικέτα στο `SignatoryProposalCard`
  (`ProfessionEscoField`) μένει ασύνδετη — δηλωμένη εξαίρεση στη φρουρά του procurement, που **ζητά σβήσιμο** μόλις κλείσει.

- 🟡 **22/09 — ΔΥΟ ΕΚΘΕΤΙΚΑ BACKOFF (βρέθηκε στο ADR-872)**

  `lib/api/api-client-transport.ts` `calculateBackoff` (βάση 1s, οροφή 10s, jitter **±10%**) και
  `services/entity-linking/utils/retry.ts` `calculateBackoffDelay` (παραμετρικό, jitter **±25%**). Ίδια ερώτηση, δύο φόρμουλες.
  **Δεν** ενοποιήθηκαν: η αλλαγή jitter αλλάζει συμπεριφορά του `apiClient` (ADR-826 §4.3 δοκιμάζει την οροφή 10s).
  Θεραπεία: ο transport καλεί το `calculateBackoffDelay` με δική του σταθερά ρύθμισης· απόφαση Giorgio για το jitter.

- 🟡 **22/09 — CHECK 3.92 Κ3: 38 routes που αλλάζουν δεδομένα ΕΚΤΟΣ συνόρου (ADR-872 §5)**

  Τα server-to-server (webhooks, cron, OAuth, MCP) είναι σωστά εκτός. Χρέος: όσα κάνουν έλεγχο ταυτότητας **μέσα** στον
  handler (`*/showcase/email`, `*/showcase/pdf`, `contacts/*/identity-impact-preview`, `contacts/*/address-positions`,
  `telemetry/bim-performance*`) — δεν παίρνουν ούτε ιδεμποτία ούτε το ενιαίο σύνορο. `npm run idempotency-boundary:report`.

- 🟡 **30/10 — ACCOUNTING: 20 ΠΡΟΫΠΑΡΧΟΝΤΕΣ ΚΛΩΝΟΙ (boy-scout, ΟΧΙ φραγμός πια)** *(ADR-584 §9)*

  Το CHECK 3.28 `--diff` τους **αναφέρει** (δεν μπλοκάρει) όποτε αγγίζονται τα αρχεία τους. Μετρημένο 30/10, HEAD
  vs δέντρο: **ταυτόσημοι στο HEAD**. Ομάδες: `MemberRow`↔`ShareholderRow`/`PartnerRow` (6) ·
  `SendReminderEmailDialog`↔`SendInvoiceEmailDialog`/`CancelInvoiceDialog` (6) · `Documents`/`EFKA`/`VAT`/`Journal`
  `PageContent` (4) · `TaxDashboard`/`TaxEstimateCard`/`VATReportCard` (3) · `CustomCategoriesSection` εσωτερικός (1).
  Ίδιο είδος: `src/services/ai-pipeline/pipeline-queue-service.ts` (2 κλώνοι, `claimNextPipelineItems` ↔
  `claimRetryablePipelineItems` — εξαγωγή `claimEachAtomically` + `npm run test:ai-pipeline:all`, N.10).
  **Μέγεθος:** > 1h, 15+ αρχεία UI ⇒ δική του δουλειά. Λίστα πάντα φρέσκια: `npm run jscpd:diff <αρχεία>`.

- 🟡 **30/10 — ΕΞΑΓΩΓΕΙΣ ΑΝΑΦΟΡΩΝ: ΚΑΘΕ ΤΟΜΕΑΣ ΜΕ ΔΙΚΗ ΤΟΥ ΣΩΛΗΝΩΣΗ** *(ADR-584 §9 · ADR-ACC-010 changelog 30/10)*

  Το accounting απέκτησε **μία** σωλήνωση (`services/export/report-export.ts`: ισοπέδωση μία φορά · σειριοποιητής
  ανά μορφή φορτωμένος κατ' απαίτηση · ένας κανόνας ονόματος · μία λήψη). Οι **άλλοι** τομείς ξαναγράφουν το ίδιο
  σχήμα: `services/report-engine/*-exporter` · `payment-export` · `milestone-export` · `gantt-export` ·
  `dxf-viewer/bim/schedule/exporters`. Ακόμη και το `triggerBlobDownload` ζει στο `gantt-export-utils` (λάθος σπίτι).
  **Πρόταση:** `src/lib/export/` — συμβόλαιο `Serializer<Doc>` + `exportDocument(format, doc)` + `triggerBlobDownload`,
  και το accounting γίνεται ο πρώτος καταναλωτής. **Μέγεθος:** > 1h, 10+ αρχεία, 5 τομείς ⇒ απόφαση Giorgio.

- 🔴 **21/09 — 3 ΣΗΜΕΙΑ ΙΔΙΟΚΤΗΣΙΑΣ ΧΩΡΙΣ ΑΠΟΔΕΙΞΗ ΚΑΛΥΨΗΣ** (ADR-742 §7terdecies)

  Το `ownership-callsite-coverage-anchor.test.ts` είναι **κόκκινο στο main** — **προϋπάρχον**,
  όχι από τη δουλειά της 21/09 (τα τρία αρχεία είναι committed και **άθικτα**· ρίζα `ea65fee8`).
  Καλούν `isPayloadOwnedByCompany` **χωρίς ταξινόμηση** στον πίνακα κάλυψης:
  `lib/agency/showcase-canonical-segment.ts` · `lib/mandate/attestation-document-verdict.ts` ·
  `server/auth/workspace-invitation.ts`.

  ⚠️ **Τι σημαίνει**: τρία σημεία ελέγχου ιδιοκτησίας **χωρίς σουίτα που να αποδεικνύει ότι
  κοκκινίζουν σε μετάλλαξη** — δηλαδή ακριβώς το «κατώφλι δεν πιάνει αφαίρεση» που γέννησε
  εκείνη την άγκυρα. Το τρίτο (`workspace-invitation`) αφορά **προσκλήσεις χώρου**.

- ⬛ *(κλειστό, κρατείται για το ιστορικό)* **ΔΥΟ ΕΥΡΗΜΑΤΑ ΑΠΟΜΟΝΩΣΗΣ ΠΟΥ ΑΠΟΚΑΛΥΨΕ Η ΜΕΤΑΒΑΣΗ ΤΟΥ 3.35** (ADR-747 §13)

  Και τα δύο είναι **υπόλοιπο μετά από διαλογή**: τα υπόλοιπα 15 σημεία των 9 αρχείων που
  εμφάνισε η μετάβαση αποδείχθηκαν νόμιμα και έχουν πλέον **αιτιολογημένη εξαίρεση στον
  κώδικα**. Αυτά τα δύο **δεν** αιτιολογήθηκαν επίτηδες — δεν είναι νόμιμα.

  1. **`src/app/api/ika/employment-records/route.ts:72` — ΑΝΑΓΝΩΣΗ ΞΕΝΟΥ ΜΙΣΘΩΤΗ.**
     Μέσα σε `withAuth`, με το `ctx.companyId` **διαθέσιμο**, το ερώτημα φιλτράρει σε
     `projectId/year/month` όπου το `body.projectId` έρχεται από το **σώμα του αιτήματος**
     και **κανείς δεν επαληθεύει ότι ανήκει στην εταιρεία του καλούντα** (επαληθεύτηκε με
     grep: οι μόνες αναφορές `companyId` στο αρχείο είναι στη **γραφή**, γρ. 110). Χρήστης
     της Α στέλνει `projectId` της Β και διαβάζει τα `apdStatus / apdSubmissionDate /
     apdReferenceNumber` της Β — και μετά **γράφει** με βάση αυτά. Είναι ακριβώς το σχήμα
     του ADR-745 §9.5.
     ⚠️ **ΜΗΝ ΤΟ «ΔΙΟΡΘΩΣΕΙΣ» ΜΕ ΣΚΕΤΟ `where(companyId)`**: παλιά έγγραφα μπορεί να μην
     έχουν το πεδίο ⇒ θα γίνονταν αόρατα ⇒ ο handler θα δημιουργούσε **διπλότυπα**. Η σωστή
     πράξη είναι **έλεγχος ιδιοκτησίας του `projectId` πριν το ερώτημα** (όπως κάνει ήδη το
     `api/storages/route.ts` στον κλάδο `projectId`). Απόφαση + πράξη: δική σου.

  2. **`src/services/contact/first-contact-invitation.service.ts:214` — ΔΙΑΜΙΣΘΩΤΙΚΗ ΑΚΥΡΩΣΗ.**
     Το `supersedePreviousInvitations` ρωτά **όλες** τις προσκλήσεις προς ένα `channelEmail`
     και ακυρώνει όσες έχουν τον ίδιο στόχο. Το `sameInvitationTarget` συγκρίνει **μόνο τον
     στόχο**, ποτέ τον εκδότη ⇒ αν η εταιρεία Β προσκαλέσει την ίδια επαφή, **σβήνει τον
     ζωντανό σύνδεσμο της Α** — και διαβάζει τις δηλώσεις της Α στη διαδρομή.
     ❓ **ΕΙΝΑΙ ΕΡΩΤΗΜΑ ΤΟΜΕΑ, ΟΧΙ ΚΑΘΑΡΟ BUG**: το σχόλιο της συνάρτησης λέει ρητά ότι
     στόχος είναι «ο ίδιος άνθρωπος να μη δει δύο ζωντανούς συνδέσμους» — που από τη σκοπιά
     του **προσκεκλημένου** είναι σωστό. Από τη σκοπιά της **Α** είναι σιωπηλή απώλεια.
     Χρειάζεται απόφαση σου: ή ο εκδότης μπαίνει στη σύγκριση, ή γράφεται εξαίρεση που το
     δηλώνει ως επιλογή.

- 🟡 **21/09 — 8 ΑΔΡΑΝΕΙΣ ΕΞΑΙΡΕΣΕΙΣ ΣΤΟ ΔΕΝΤΡΟ** (ADR-747 §13.4)

  Ο νέος φρουρός (`stale-exempt`) τις μετρά: **8** αιτιολογημένες εξαιρέσεις που **δεν
  καλύπτουν κανένα σημείο** — δηλαδή προ-εγκεκριμένο veto σε ό,τι γραφτεί εκεί αύριο. Δεν
  είναι παραβιάσεις και **δεν μολύνουν το ratchet**. Η πύλη είναι **ZERO-TOL στο άγγιγμα**
  (σχήμα CHECK 3.15): καθολικό μπλοκ θα τη γεννούσε κόκκινη (ADR-742).
  `api/audit-trail/[entityType]/[entityId]:63` · `lib/auth/project-member-ref:55` ·
  `realtime/hooks/public-listings-query:82` · `useOrganizationCapability:182` ·
  `useOwnedDocuments:228` · `usePublicAgencies:125,223` · `usePublicListings:281`
  📘 Γιατί υπάρχει ο φρουρός: **FSE 2025** — **50,8%** των suppressions δεν καταστέλλουν τίποτα.

- 🟡 **21/09 — CHECK 3.91 / Κ2: 18 ΣΗΜΕΙΑ ΧΩΡΙΣ ΕΥΡΟΣ, ΑΝΕΠΑΛΗΘΕΥΤΑ** (ADR-870 §3.1)

  Baseline: `.firestore-admin-index-baseline.json`. **Κανένα δεν έχει επιβεβαιωθεί ζωντανά.**
  ⚠️ **ΜΗΝ τα επικαλεστείς ως «18 σφάλματα»**: στο `audit_logs` η **συγχώνευση δεικτών**
  αθώωσε **12 κλάδους** που η στατική ανάλυση κατήγγειλε. Η σωστή σειρά είναι
  **μέτρησε ζωντανά → διόρθωσε → κατέβασε τη baseline**, ποτέ το αντίστροφο.

- ⏳ **21/09 — Η ΣΥΓΧΩΝΕΥΣΗ >3 ΔΕΙΚΤΩΝ ΕΙΝΑΙ ΠΡΟΕΚΤΑΣΗ, ΟΧΙ ΜΕΤΡΗΣΗ** (ADR-870 §6)

  Επαληθεύτηκε ζωντανά με **2** και **3** δείκτες. Τα **10** σχήματα του
  `accounting_audit_log` που στηρίζονται σε **5** τα δηλώνει η ίδια η πύλη
  (`⏳ N σχήματα … ΠΕΡΑ από το μετρημένο`). **Μετά την ανάπτυξη** των νέων δεικτών:
  ένα ζωντανό ερώτημα με `companyId== entityType== entityId== eventType== userId==`
  + `orderBy(timestamp desc)` απαντά οριστικά.

- 🔴 **21/09 — 11 ΔΕΙΚΤΕΣ FIRESTORE ΠΕΡΙΜΕΝΟΥΝ ΤΗΝ ΕΓΚΡΙΣΗ ΣΟΥ ΣΤΟ PUSH** (ADR-869 §12.6 · ADR-870 §7)

  `firestore:verify --tree worktree` ⇒ **`exit=2 OutOfSync`** · `ζωντανά 478 · αρχείο 489` ·
  `extra: []` · λείπουν ζωντανά **11**:
  `appointments(companyId↑, appointment.effectiveDate↑)` — ο παλιός, ADR-869 §12.6 ·
  `iso19650_cost_log(companyId↑, createdAt↓)` · `ai_agent_feedback(rating↑, createdAt↑)` ·
  `tasks(reminderDate↑, reminderSent↑)` · `storage_units(status↑, deletedAt↑)` ·
  `sourcing_events` ×3 · `accounting_audit_log` ×3 — **οι 10 νέοι, ADR-870**.
  🔴 **Και οι 10 αντιστοιχούν σε ερώτημα που ΣΚΑΕΙ ΤΩΡΑ ζωντανά** (επιβεβαιωμένο ένα προς ένα).
  ✅ **ΔΕΝ μπλοκάρει το commit**: η CHECK 3.86 το χαρακτηρίζει `⏳ deploy-pending` και η
  γραμμή παραγωγής κάνει **push → πλάνο → ΕΓΚΡΙΣΗ σου → ανάπτυξη → κώδικας** (ADR-865 §11).
  ⚠️ **Μέχρι να αναπτυχθεί, το `getByDateRange` πετά `FAILED_PRECONDITION`** — δεν είναι
  σιωπηλή αστοχία, αλλά **είναι** αστοχία. Μην αφήσεις κώδικα να φύγει χωρίς τον δείκτη.

- 🟡 **20/09 — Ο ΑΧΡΗΣΙΜΟΠΟΙΗΤΟΣ ΔΕΙΚΤΗΣ `(companyId, appointment.requestedDate)`** (ADR-869 §12.7)

  Κανένα ερώτημα δεν τον χρησιμοποιεί πλέον. ⚠️ **ΜΗΝ τον σβήσεις από το αρχείο σκέτα**:
  χωρίς `firebase deploy --force` ο ζωντανός μένει ⇒ `extra` ⇒ **OutOfSync**. Χωριστή
  απόφαση, χωριστή πράξη.

- 🟡 **20/09 — Η ΤΥΦΛΗ ΖΩΝΗ ΤΗΣ CHECK 3.15 ΔΕΝ ΦΥΛΑΓΕΤΑΙ ΑΠΟ ΤΙΠΟΤΑ** (ADR-869 §7)

  Τα «53 unanalyzable» μπορούν να γίνουν 60 χωρίς να το δει κανείς. ⚠️ **ΜΗΝ φυλάξεις τον
  αριθμό 53** — τα 48 από αυτά είναι σχήματα μόνο με ισότητες (ακίνδυνα κατά κατασκευή) και
  ο αριθμός **μεγαλώνει όταν ο κώδικας γίνεται καλύτερος** (κάθε κεντρικοποίηση κρύβει ένα
  literal `where()` πίσω από κλήση). Ratchet πάνω του **τιμωρεί την κεντρικοποίηση** — το
  μάθημα του 3.18 (N.12). **Το σωστό μέγεθος**: «σημεία με εύρος/ταξινόμηση που η πύλη ΔΕΝ
  επαλήθευσε» — σήμερα **0**, άρα **ZERO-TOL χωρίς baseline**, όχι ratchet. Χρειάζεται
  δρομολογητή + γραμμή CLAUDE.md (3.66) + `docs/gates/` + άγκυρα ⇒ δική του εργασία, δικό του ADR.

- 🟡 **19/09 — «ΜΟΝΟ ΤΟ ΤΕΛΕΥΤΑΙΟ ΑΙΤΗΜΑ ΕΦΑΡΜΟΖΕΤΑΙ» ΧΕΙΡΟΓΡΑΦΟ ΣΕ 2 HOOKS** (εύρημα ADR-866 §2.10.8.3, N.0.2)

  `hooks/useGlobalSearch.ts` (`latestRequestRef` · 3 έλεγχοι + ακύρωση) και `hooks/useProjectDetail.ts` (`requestIdRef`)
  γράφουν ο καθένας τον δικό του φύλακα σειράς απαντήσεων. 🔴 Το πρώτο ταυτοποιεί με **`Date.now()`** ⇒ δύο αιτήματα στο
  **ίδιο** ms είναι **και τα δύο** «τελευταία» (η παλιότερη απάντηση περνά). **Θεραπεία**: `hooks/useLatestRequest.ts`
  (`begin()` → αύξων αριθμός · `isLatest(token)` · `invalidate()`) + μεταφορά των δύο. Δεν έγινε στο ADR-866: η διόρθωση Β5
  **δεν** χρειάστηκε τρίτο αντίγραφο (ο ακροατής κατέχει τη λίστα) — και οι δύο καταναλωτές είναι άλλων περιοχών (αναζήτηση ·
  έργα) με δικές τους σουίτες.

- 🟡 **19/09 — ΤΟ `crm/inbox/ThreadView` ΕΧΕΙ ΣΥΝΑΡΤΗΣΗ 188 ΓΡΑΜΜΩΝ** (εύρημα ADR-867 Β7, N.7.1 — προϋπάρχον)

  Στο Β7 εξήχθησαν τα **παρουσιαστικά** του (`components/shared/messaging/MessageBubble.tsx`: φούσκα · κεφαλίδα ·
  «παλαιότερα» · κενό νήμα) και διορθώθηκαν 3 ωμά αγγλικά `aria-label` (N.11). Μένει το σώμα του `ThreadView`
  (**188** γραμμές) + ένα εσωτερικό map (**59**) — πάνω από το όριο των 40. **Θεραπεία**: `ThreadHeader` ·
  `SelectionBar` · `ThreadStates` (loading/error/empty) · `InboxMessageRow`. >1h μόνο λόγω των σουιτών του inbox
  (`crm/inbox/__tests__`) ⇒ ξεχωριστή εργασία. Μέτρηση: `scratchpad/fn-length.js` (AST, > 40 γραμμές).

- 🟡 **18/09 — ΤΟ ΚΕΛΥΦΟΣ ΚΑΡΤΕΛΩΝ ΑΡΧΕΙΩΝ ADR-588 ΕΦΑΡΜΟΖΕΤΑΙ ΣΤΑ ΜΙΣΑ** (εύρημα ADR-866 §2.7.7, N.0.2)

  Το `space-management/shared/tabs/EntityMediaFilesTab` + `media-tab-configs` ενοποίησε Parking/Storage, αλλά **7** αρχεία
  καλούν ακόμη το `EntityFilesManager` με το χέρι για τις ίδιες καρτέλες: `features/properties-sidebar/components/{PhotosTab,
  VideosTab,FloorPlanTab}` · `building-management/tabs/{building-files-tab,BuildingFloorplanTab}` · `projects/{project-files-tab,
  tabs/ProjectFloorplanTab}`. **Θεραπεία**: `EntityMediaBinding` για property/building/project + τα `*_MEDIA_CONFIG`. Προϋπόθεση:
  το κέλυφος μαθαίνει `custody` (ADR-866 Φ1.2). >1h, 3 domains ⇒ ξεχωριστή εργασία.
  ✅ **Η προϋπόθεση εκπληρώθηκε (ADR-866 Φ1.2, 18/09)**: `EntityMediaBinding.custodySource` (`session-company` | `personal`),
  3ος καταναλωτής ο φάκελος ακινήτου. **Μετρημένο γιατί μένει >1h**: τα 3 σημεία με δικό τους hook (`property-files-tab.tsx:106` ·
  `building-files-tab.tsx:62` · `project-files-tab.tsx:58`) καρφώνουν `{ companyId }` με το χέρι, και τα `PhotosTab`/`FloorPlanTab`
  του ακινήτου κουβαλούν συστατικά που **δεν** είναι του κελύφους (σειρά φωτογραφιών αγγελίας · πολυεπίπεδη κάτοψη · IFC) ⇒ το
  κέλυφος χρειάζεται πρώτα **υποδοχή παιδιών**.
  🔴 **19/09 — ΝΕΑ ΜΕΤΡΗΜΕΝΑ ΒΑΡΗ (ADR-866 §2.10 Ξ2 · Ξ3, ζωντανή επαλήθευση)**: το κέλυφος απέκτησε `entryPointScope` (ό,τι
  προσφέρει η καρτέλα = ό,τι διαβάζει, `media-tab-scope.ts`). (α) **Ξ2**: θέσεις/αποθήκες — καρτέλες **Έγγραφα** και **Βίντεο** με
  **μηδέν** τύπους στον κατάλογο (`entries-parking`/`entries-storage` έχουν μόνο κατόψεις+φωτογραφίες) ⇒ δεν ανεβάζουν. Κλειστό
  σύνολο `KNOWN_DEAD` στην άγκυρα Α38.1 (`media-tab-scope.test.ts`) — **μόνο μικραίνει**. Θεραπεία: τύποι εγγράφων/βίντεο θέσης &
  αποθήκης στον κατάλογο (ή όψη κοινών τύπων) + αφαίρεση από το `KNOWN_DEAD`. (β) **Ξ3 (στατικό)**: `PhotosTab`/`VideosTab` του
  ακινήτου διαβάζουν `sales` αλλά προσφέρουν `unit-progress-photo`/`unit-progress-video` (`construction`) ⇒ **αόρατο ανέβασμα**.
  Θεραπεία: τα 7 σημεία δηλώνουν `entryPointScope` (η ανάγνωση παράγεται από την προσφορά).

- 🟡 **18/09 — ΤΟ ΜΟΝΟΠΑΤΙ ΜΕΛΟΥΣ ΧΩΡΟΥ ΧΤΙΖΟΤΑΝ ΧΕΙΡΟΓΡΑΦΑ ΣΕ 7 ΣΗΜΕΙΑ** (εύρημα ADR-867 Β5, N.0.2)

  SSoT **γεννήθηκε**: `lib/workspace/workspace-member-ref.ts` (`workspaceMemberRef(db, companyId, uid)`).
  Μεταφέρθηκαν **2/7** (`lib/workspace/grant-membership.ts` · `lib/api/role-management-helpers.ts`) + ο νέος
  καταναλωτής `act-team-writer.ts`. **Μένουν 5**: `app/api/admin/role-management/bootstrap/route.ts:99` ·
  `…/users/route.ts:109` (συλλογή — θέλει και `workspaceMembersCollection`) · `lib/auth/workspace-membership.ts:194`
  (κριτής ADR-787 — άγγιξέ τον **μόνο** με τις σουίτες του) · `lib/auth/workspace-membership.ts:307`
  (collection group — θέλει `workspaceMembersGroup`) · `lib/workspace/workspace-provisioning.ts:342` ·
  `services/mandate/holiday-hours-question-notifier.ts:51`. **Θεραπεία**: import από το SSoT, και πύλη που
  απαγορεύει `SUBCOLLECTIONS.WORKSPACE_MEMBERS` έξω από αυτό (σχήμα Κ1 της CHECK 3.89). <1h, αλλά αγγίζει
  τον κριτή μέλους ⇒ ξεχωριστό commit.
  ✅ **19/09 (Β7)**: γεννήθηκε `listActiveWorkspaceMembers` στο `lib/auth/workspace-membership.ts` **πάνω** στο
  `workspaceMembersCollection` (το ερώτημα ζούσε inline στη μεταβίβαση — δύο καταναλωτές: αποχώρηση · επιλογέας ομάδας).
  ✅ **21/09 (ADR-867 Ε1)**: έφυγαν **3 από τα 5** — `role-management/bootstrap/route.ts` (**διαγράφηκε**) ·
  `workspace-provisioning.ts` (ιδρυτής μέσω `grantWorkspaceMembershipInBatch`) · ο κριτής `workspace-membership.ts:194`
  (`workspaceMemberRef`). **Μένουν 3**: `…/users/route.ts:109` · `workspace-membership.ts` collection group ·
  `holiday-hours-question-notifier.ts:51`.

- 🟡 **18/09 — Η ΛΙΣΤΑ ΤΗΣ CHECK 3.17 ΕΙΝΑΙ ΔΕΥΤΕΡΟ ΑΝΤΙΓΡΑΦΟ ΤΟΥ `AUDIT_ENTITIES`** (εύρημα ADR-867 Β5)

  `scripts/check-entity-audit-coverage.js` `TRACKED_COLLECTION_KEYS` απαριθμεί **με το χέρι** τις συλλογές με
  ίχνος, ενώ η αυθεντία είναι το `src/config/audit-entity-registry.ts` (`writer: 'server-direct' | 'client-post'`).
  Νέα οντότητα ⇒ **δύο** γραμμές σε **δύο** αρχεία, και αν ξεχαστεί η δεύτερη η πύλη είναι πράσινη χωρίς να
  κοιτάξει (σχήμα «0 = κανείς δεν κοίταξε»). **Θεραπεία**: η πύλη να **παράγει** τη λίστα από το μητρώο (ή
  άγκυρα ισοτιμίας). **Μετρημένη απόκλιση**: `MATERIALS` · `QUOTES` · `FRAMEWORK_AGREEMENTS` ·
  `TEXT_CUSTOM_DICTIONARY` είναι `server-direct` στο μητρώο και **απουσιάζουν** από τη λίστα της πύλης —
  δηλαδή γραφέας τους χωρίς `recordChange` περνά **πράσινος** σήμερα.
  🔴 **ΞΑΝΑΜΕΤΡΗΘΗΚΕ 18/09 (ADR-866 Φ1.1 §2.8 Κ3): η απόκλιση είναι 23 κλειδιά, όχι 4** — στα 4 `server-direct`
  προστίθενται **19 `client-post`**: `FLOORPLAN_STAIRS/ROOFS/FOUNDATIONS/RAILINGS` · `FLOORPLAN_MEP_*` (12) ·
  `FLOORPLAN_SYMBOLS/FURNITURE/IMPORTED_MESHES/GENERIC_SOLIDS` · `BIM_FAMILY_TYPES`. Αντίστροφη απόκλιση: 0.
  ⇒ Η παραγωγή της λίστας από το μητρώο θα ανοίξει 23 συλλογές στην πύλη ⇒ πιθανές νέες παραβιάσεις ⇒ αλλαγή
  **baseline** (Giorgio). Ο φάκελος (`PROPERTY_DOSSIERS`) μπήκε και στις δύο λίστες.

- ✅ **17/09 — ΕΣΩΤΕΡΙΚΕΣ ΚΑΡΤΕΣ ΑΚΙΝΗΤΩΝ: ΕΚΛΕΙΣΕ** (ADR-777 **§8.60.13**) — αφαίρεσε αυτή τη γραμμή μετά το commit.

  Οι κάρτες καλούν πλέον το **υπάρχον** `resolvedPriceLabel` (`common:priceAmount.*`)· `Record<PriceRole, …>` για
  ετικέτα ρόλου **και** για €/τ.μ. (`nightly: null`, δηλωμένο). 🔴 **Βρέθηκε και διορθώθηκε σφάλμα ΧΡΟΝΟΥ
  ΕΚΤΕΛΕΣΗΣ**: `PRICE_PER_SQM_PRESENTATION[nightly]` ⇒ `undefined` ⇒ destructuring **έριχνε την κάρτα**.
  Διαγράφηκαν ο **νεκρός** `compositions/StorageCard` + `formatPriceWithUnit`· καθαρίστηκαν `rentValue` ·
  `properties-viewer:hover.perMonth` · `storage:card.perMonth`. **73/73 · μεταλλάξεις 3/3** ·
  **ζωντανή επαλήθευση σε 5 επιφάνειες** (δοκιμαστικό `prop_b0000007-…` «ΔΟΚΙΜΗ Ζ» — **ρώτα τον Giorgio αν μένει**).
  ⚠️ **Μένει ανοιχτό (ίδια οικογένεια, όχι κάρτες)**: `priceSortKey` (ταξινόμηση λίστας), φίλτρο «Τιμή Από/Έως»
  (`lib/criteria/listing-criterion-reading.ts`) και **αθροίσματα** (`usePropertiesStats` · `priceTotals`)
  συγκρίνουν/**αθροίζουν** ποσά **χωρίς ρόλο** — 50 €/νύχτα με 170.000 € πώλησης. **Απόφαση προϊόντος (Giorgio).**

- 🟡 **17/09 — ΟΙ ΑΠΟΘΗΚΕΥΜΕΝΕΣ ΤΙΜΕΣ ΕΙΝΑΙ ΕΥΡΩ ΔΕΚΑΔΙΚΑ, ΟΧΙ ΑΚΕΡΑΙΑ ΛΕΠΤΑ (εύρημα ADR-835 §21.2)**

  Το ADR-835 §4.8 δεσμεύει «χρήμα σε ακέραια λεπτά». **Μετρημένο**: `askingPrice · finalPrice · rentPrice ·
  nightlyRate` (`PropertyCommercialData`, `ShortLeaseOffer`, `PublicListing.commercial`) αποθηκεύονται ως **ευρώ
  δεκαδικά** και το `price-resolver` (41+ καταναλωτές) τα διαβάζει έτσι. Το Στάδιο Β έφτιαξε το SSoT
  `lib/money/money.ts` και κρατά **κάθε υπολογισμό διαμονής** σε λεπτά, με **μία** μετατροπή στο σύνορο
  (`minorFromMajor`). **Θεραπεία**: μετάπτωση αποθήκευσης σε `*Minor` πεδία + εκδοχή σχήματος στην προβολή
  (ADR-839 σύνορο ανάγνωσης: παλιό έγγραφο ⇒ μετατροπή κατά την ανάγνωση), `price-resolver` σε λεπτά, φόρμες
  με `majorFromMinor` μόνο για εμφάνιση. **Μέγεθος**: >1h, 4+ domains (τύποι · προβολή · επιλυτής · φόρμες ·
  οικονομικές μηχανές) — απόφαση Giorgio για προτεραιότητα.

- 🔴 **16/09 — Η ΑΓΚΥΡΑ `ownership-callsite-coverage` ΕΙΝΑΙ ΚΟΚΚΙΝΗ ΣΤΟ HEAD **ΚΑΙ ΑΦΥΛΑΚΤΗ** (εύρημα ADR-862 Φ0 Β7, καταγραφή Β8)**

  ⚠️ **17/09 (ADR-862 Φ0 Β14) — ΞΑΝΑ 3**: μετρημένα **5** πριν το Β14 (+`services/iso19650/version-stack.ts` του Β10).
  Το Β14 ταξινόμησε τα **δύο της Φ0** (`container-transition-policy.ts` → Α17.12 · `version-stack.ts` → «ξένος μισθωτής»
  στο `version-promotion-anchor`) **και** το νέο `lib/files/container-project.ts` (Α30.5). Μένουν **μόνο ξένα**:
  `lib/agency/showcase-canonical-segment.ts` · `lib/mandate/attestation-document-verdict.ts` · `server/auth/workspace-invitation.ts`.

  `src/lib/auth/__tests__/ownership-callsite-coverage-anchor.test.ts` → **19/20**, με **3 αταξινόμητα**:
  `lib/agency/showcase-canonical-segment.ts` · `server/auth/workspace-invitation.ts` ·
  `services/iso19650/container-transition-policy.ts`.

  ⚠️ **17/09 (ADR-862 Φ0 Β10) — έγιναν 4**: +`lib/mandate/attestation-document-verdict.ts` (commit `a38767fe`,
  ADR-864 Φ3-Γ). Το Β10 πρόσθεσε **ένα** σημείο (`services/iso19650/container-succession-policy.ts`) και το
  **ταξινόμησε** στο ίδιο commit (σουίτα `container-supersession-anchor` Α20.4) — μετρημένο: αταξινόμητα 5 → 4.

  🔴 **Δεν είναι δικό μας**: τα δύο πρώτα είχαν την κλήση **μέσα στο HEAD** και ήταν αμετάβλητα· το τρίτο
  μπήκε από **ξένη** επεξεργασία (αντικατέστησε ωμό `!==` με τον SSoT — **σωστή** αλλαγή: το `!==`
  **περνούσε** όταν έλειπαν και τα δύο). Το Β7 πρόσθεσε **μηδέν** σημεία κλήσης, μετρημένο.

  🔴 **ΚΑΙ ΕΙΝΑΙ ΑΦΥΛΑΚΤΗ — ΓΙ' ΑΥΤΟ ΗΤΑΝ ΚΟΚΚΙΝΗ ΑΟΡΑΤΑ**: η λέξη `ownership` **δεν υπάρχει** στον
  pre-commit hook και τα workflows έχουν **μηδέν** αναφορά ⇒ δεν μπλοκάρει commit. *Άγκυρα χωρίς πύλη
  δεν είναι άγκυρα — είναι σχόλιο* (ίδιο σχήμα με ADR-587 §6.1).

  **Θεραπεία**: ταξινόμηση των 3 σε `PHASE_C_PERIMETER`/`OUTSIDE_PHASE_C_PERIMETER` **με** σουίτα που
  ονομάζει τη διαδρομή. ⛔ **ΠΟΤΕ** «δήλωσε εξαίρεση για να περάσει».

- 🟡 **16/09 — RATCHET: ΟΙ ΚΑΛΟΥΝΤΕΣ ΤΟΥ `/api/download?url=` ΠΡΕΠΕΙ ΝΑ ΦΤΑΣΟΥΝ ΣΤΟ ΜΗΔΕΝ (ADR-862 Φ0 Β8)**

  Το Β8 έβαλε **δεύτερη, προτιμώμενη** είσοδο `?fileId=` (opaque identifier — η σύσταση του OWASP έναντι
  του φιλτραρίσματος URL) και πέρασε **πέντε** καλούντες σε αυτήν. Η παλιά είσοδος `?url=` **μένει**, με
  τρεις νέους φρουρούς (`validateFetchUrl` → `storageObjectFromUrl` → `judgeStorageCustody`) και λήψη με
  **Admin SDK** αντί `fetch(url)`.

  ⚠️ **ΔΗΛΩΜΕΝΟ ΟΡΙΟ**: το `?url=` φυλάει **μισθωτή**, όχι **δοχείο** — δεν υπάρχει `FileRecord` για να
  ρωτηθεί ο κριτής του Β5. Μένουν **δύο** καλούντες, και οι δύο **δικαιολογημένοι**:
  · `usePhotoPreviewState` — φωτογραφίες **επαφών**, δεν είναι `FileRecord` καθόλου·
  · `VersionHistory` — οι **εκδόσεις** ζουν σε υποσυλλογή `files/{id}/versions/{v}` **χωρίς** δικό τους
    έγγραφο στη `files`· φυλάσσονται από το `storagePath` τους, που είναι στο ίδιο `companies/{c}/` δέντρο.

  **Θεραπεία** *(όχι στη Φ0)*: `?versionId=` που διαβάζει την υποσυλλογή μέσω του **γονικού** `fileId`, και
  σύνορο ανάγνωσης για τις φωτογραφίες επαφών. ⛔ **ΜΗΝ** διαγράψεις το `?url=` πριν μηδενίσουν — fail-closed
  εκεί σπάει ζωντανή λειτουργία.

- 🟡 **16/09 — `storage.rules`: ΤΟ AVATAR ΚΑΘΕ ΑΝΘΡΩΠΟΥ ΔΙΑΒΑΖΕΤΑΙ ΑΠΟ ΚΑΘΕ ΤΑΥΤΟΤΗΤΑ (εύρημα ADR-862 Φ0 Β8)**

  `storage.rules:299` — `match /users/{userId}/{fileName} { allow read: if isAuthenticated(); }`. Είναι
  **δηλωμένο** (ADR-798 §16: τα avatar εμφανίζονται σε λίστες όπου ο θεατής δεν είναι ο ιδιοκτήτης, και οι
  Storage rules **δεν μπορούν** να διαβάσουν Firestore ⇒ «ίδια εταιρεία;» είναι **αδύνατο να ερωτηθεί** εκεί).

  ✅ **Ο proxy είναι ήδη αυστηρότερος**: ο `judgeStorageCustody` κρίνει το `users/` ως `user` ⇒ ξένο avatar
  μέσω `/api/download` παίρνει `foreign-user`. Καταγράφεται ως **γνωστή απόκλιση κανόνων ⇄ proxy**, όχι κενό.
  ⛔ **ΜΗΝ** «εναρμονίσεις» χαλαρώνοντας τον proxy.

- 🟡 **16/09 — 427 ΩΜΕΣ ΑΝΑΓΝΩΣΕΙΣ ΕΓΓΡΑΦΩΝ ΧΩΡΙΣ ΣΥΝΟΡΟ, ΕΚΤΟΣ ΤΩΝ ΤΕΣΣΑΡΩΝ ΦΥΛΑΣΣΟΜΕΝΩΝ (εύρημα ADR-864 Α15)**

  **Μετρημένο** (απογραφή `.data() as X` σε `src/`, εξαιρώντας δοκιμές): **427** σημεία σε παραγωγή,
  ενώ **μόνο 36 αρχεία** εισάγουν κάποιο από τα τέσσερα σύνορα ανάγνωσης. Συγκεντρώσεις:
  `app/api/admin/**` (~20, migrations + debug) · `services/procurement/**` (~15, RFQ/PO/quote-versioning) ·
  `services/ai-pipeline/**` (~18, audit/chat/learning) · `subapps/dxf-viewer/**` (~25, bim/templates/dictionaries).
  Συχνότεροι τύποι: `Record<string, unknown>` (106) · `PurchaseOrder` (6) · `ChequeRecord` (6) ·
  `WorkspaceInvitationDocument` (5) · `FirstContactDocument` (4).

  🔴 **Η ίδια κλάση που έριξε την οθόνη 3 (31/08) και τύπωσε ωμό κλειδί σε κάθε κάρτα του `/offers` (16/09)**:
  ο τύπος υπόσχεται πεδία που **το έγγραφο δεν χρωστά**, και το `as` είναι εντολή στον μεταγλωττιστή
  **να πάψει να ρωτά** — άρα ο `tsc` είναι **δομικά ανίκανος** να το δει.

  ⛔ **ΔΕΝ μπήκαν στη φέτα του Α15, με λόγο**: καθένα χρειάζεται **δικό του** λεξιλόγιο απουσίας
  (τι σημαίνει «λείπει το πεδίο» σε **παραγγελία** δεν το ξέρει η εργασία της ζήτησης). Μια «γενική»
  θεραπεία θα ήταν ένα `z.object` ανά τύπο — το **δέκατο** περιστατικό χειρόγραφης λίστας πεδίων (ADR-833).

  **Θεραπεία, ανά τομέα**: σύνορο `*-from-document.ts` κατά το πρότυπο των τεσσάρων (καθαρή συνάρτηση,
  **ποτέ** `withConverter` — οι καταναλωτές μοιράζονται Admin SDK ⇄ πελάτη) + **μία γραμμή** στον πίνακα
  `BOUNDARIES` του CHECK 3.74 + άγκυρες που **εκτελούν** την πύλη. Σημασιολογία: **καμία προεπιλογή**
  (AIP-216 · Protobuf · Avro · RESO — δες `docs/gates/3.74.md`).
  ⚠️ **ΜΗΝ** επιχειρήσεις pattern για το γενικό `as T`: μετρήθηκε ~97% ψευδώς θετικά· η θεραπεία του
  γενικού είναι **τύπος** (υποχρεωτικό `fromDocument`), όχι regex.
  ~15-25 αρχεία σε **4+ τομείς** ⇒ **μία φέτα ανά τομέα**, ποτέ ενιαία.

- 🔴 **16/09 — Ο ADMIN-SIDE ΓΡΑΦΕΑΣ ΤΟΥ `file_audit_log` ΓΡΑΜΜΕΝΟΣ ΧΕΙΡΟΓΡΑΦΑ ΣΕ 5 ΣΗΜΕΙΑ, ΜΕ ΔΥΟ ΑΠΟΚΛΙΣΕΙΣ (εύρημα ADR-862 Φ0 Β6)**

  **Μετρημένο** (grep `FILE_AUDIT_LOG` × `getAdminFirestore`): `api/files/archive/route.ts:108` ·
  `api/files/classify/classify-background.ts:150` · `api/files/gdpr-delete/route.ts:150` ·
  `api/files/purge/route.ts:115` · `services/file-record/file-purge-helpers.ts:109`. Όλα γράφουν
  `db.collection(FILE_AUDIT_LOG).doc(generateAuditId()).set({…})` — δίδυμα του `FileAuditService.log`,
  που **δεν μπορούσαν** να τον καλέσουν επειδή εισάγει **client SDK** (`firebase/firestore` + `db`).
  Ο τύπος `FileAuditEntry` ήταν **ακούσιο σύνορο**: δήλωνε `timestamp: ReturnType<typeof serverTimestamp>`,
  δηλαδή τον `FieldValue` **του πελάτη**, που ο Admin SDK δεν μπορεί να ικανοποιήσει.

  🔴 **ΔΥΟ ΜΕΤΡΗΜΕΝΕΣ ΑΠΟΚΛΙΣΕΙΣ — Η ΔΕΥΤΕΡΗ ΕΙΝΑΙ ΖΩΝΤΑΝΟ ΣΦΑΛΜΑ**:
  **(1) χρόνος** — τα πέντε γράφουν `timestamp: nowISO()` (**συμβολοσειρά**), ο πελάτης
  `serverTimestamp()` (**Timestamp**): δύο τύποι στο **ίδιο πεδίο** της ίδιας συλλογής.
  **(2) μισθωτής** — τα `archive` και `purge` **ΔΕΝ γράφουν `companyId`**, ενώ ο **μοναδικός**
  αναγνώστης (`FileAuditService.getFileHistory`) ρωτά `where('companyId','==',…)` ⇒ εκείνες οι
  γραμμές ίχνους είναι **δομικά αόρατες σε κάθε άνθρωπο, για πάντα**. Ίχνος που γράφεται,
  κοστίζει, και **κανείς δεν μπορεί ποτέ να το δει** — το σχήμα «`0` = κανείς δεν κοίταξε»,
  μέσα σε audit trail.

  ✅ **Ο ΠΡΟΟΡΙΣΜΟΣ ΥΠΑΡΧΕΙ ΗΔΗ** (γεννήθηκε στο Β6): `services/file-audit-admin.service.ts`
  (`recordFileAudit` — Admin SDK, `FieldValue.serverTimestamp()`, **αρνείται** χωρίς μισθωτή) +
  `types/file-audit.ts` (λεξιλόγιο **ανεξάρτητο SDK**, ώστε να το εισάγουν και οι δύο πλευρές).
  Άγκυρα που τον **εκτελεί**: `services/__tests__/file-audit-admin-anchor.test.ts`.

  **Θεραπεία**: μετανάστευση των 5 σε `recordFileAudit(...)`, με **ρητό** `companyId` σε κάθε κλήση
  (τα `archive`/`purge` το έχουν διαθέσιμο — απλώς δεν το γράφουν).
  ⚠️ **ΜΕΤΑ** τη μετανάστευση και **ΠΟΤΕ ΠΡΙΝ**: module `file-audit` στο `.ssot-registry.json` κατά
  το πρότυπο του `entity-audit-trail` (γρ. 718). Σήμερα θα σήμαινε **αμέσως** τους 5 ⇒ CHECK 3.7/3.18
  κόκκινο πάνω σε χρέος που η Φ0 **δεν δημιούργησε**. 5 αρχεία σε 2 τομείς ⇒ δική του φέτα.

  📒 **18/09 — ADR-866 §2.6.11 (βήμα 2β.4) — ΞΑΝΑΜΕΤΡΗΘΗΚΕ**:
  - ✅ **Ένα από τα πέντε ΕΚΛΕΙΣΕ**: το `file-purge-helpers.ts` (`recordPurgeAudit`) περνά πλέον από τον
    `recordFileAudit` (με κάτοχο — εταιρεία **ή** άνθρωπος). Μένουν **4**: archive · classify · gdpr-delete · purge route.
  - 🔴 **Σε δεδομένα παραγωγής**: 5 από τις 20 γραμμές του `file_audit_log` (`ai_classify`, `classify-background`)
    **χωρίς** `companyId` ⇒ **25% αόρατο** (Firestore MCP, 2026-09-18).
  - 🔴 **ΕΚΤΟ δίδυμο, που δεν μετρήθηκε στα πέντε**: το `gdpr-delete` γράφει `action: 'gdpr_erasure'` (**εκτός**
    `FileAuditAction`) · **χωρίς** `companyId` · `timestamp: new Date()` · πεδίο `details`. ⚠️ Απόφαση πριν τη
    μετανάστευση: **σε ποιο βιβλίο** ανήκει η απόδειξη διαγραφής υποκειμένου που **ίσως δεν έχει** εταιρεία.
  - 🔴 **Ο εταιρικός κανόνας `file_audit_log` δεν δένει τον δράστη** (`performedBy == request.auth.uid` λείπει) ⇒
    μέλος μπορεί να γράψει γραμμή που λέει ότι **άλλος** έκανε κάτι. ⚠️ **Μετρημένο εμπόδιο**:
    `BuildingFloorplanService.ts:413` στέλνει στον κάδο ως `'system'` **από τον πελάτη** ⇒ δέσιμο σήμερα = εκείνες
    οι γραμμές **χάνονται σιωπηλά** (fire-and-forget). Πρώτα: αυτοματισμοί του πελάτη → διακομιστή.
  - 🟡 **Εταιρικό ζευγάρωμα** (ό,τι έγινε για το προσωπικό, `personalActivityPaired`): ο κανόνας `files` επιτρέπει
    στον **δημιουργό** κάδο «χωρίς claims», ο `file_audit_log` ζητά `companyId == getUserCompanyId()` ⇒ πρώτα
    ευθυγράμμιση των δύο, **μετά** δέσμη. Ως τότε η εταιρική γραμμή μένει μη-μπλοκάρουσα προβολή (`commitFileActivity`).

- 🟡 **15/09 — «POST ΑΠΟ ΚΟΥΜΠΙ ΜΕ ΡΗΤΕΣ ΦΑΣΕΙΣ» ΓΡΑΜΜΕΝΟ ΧΕΙΡΟΓΡΑΦΑ ΣΕ 5 ΣΗΜΕΙΑ (εύρημα ADR-841 Α21.21 Φάση Β)**

  **Μετρημένο** (grep `setPhase({ kind: 'sending' })`): `MandateConsentContent` · `ShowcaseEmailConfirmationContent` · `EmailPreferencesPanel` ·
  `useEmailConfirmationSend` · `useHolidayQuestionDecision`. Ίδιο σχήμα: `sending` → `fetch POST JSON` → `json().catch(()=>null)` →
  επιτυχία ή λόγος → `catch ⇒ unavailable`. Στην Α21.21 εξήχθη **μόνο** το κομμάτι που είχε βλάβη (`lib/http/response-refusal.ts` →
  `refusalOf`: το `ShowcaseEmailConfirmationContent` έκανε `reason as FailureReason` ⇒ άγνωστος κωδικός = ωμό κλειδί i18n) και η
  κάρτα (`components/ui/auth-card-section.tsx`). **Μένει**: το `MandateConsentContent` κρατά **ανοιχτό** `reason: string` (όχι κλειστό
  σύνολο — δικό του ελάττωμα N.11) και ο βρόχος φάσεων είναι 5 αντίγραφα. **Θεραπεία**: ένα `postForDecision<TBody, TOk, TReason>(path, body,
  { readOk, known })` χωρίς React + λεπτά hooks· κλείσιμο του συνόλου λόγων της συγκατάθεσης εντολής. 5 αρχεία σε 3 τομείς ⇒ δική του φέτα.

- 🟡 **15/09 — ΤΟ ΜΠΛΟΚ ΑΝΑΓΝΩΣΕΩΝ + ΕΞΑΙΡΕΣΕΩΝ ΤΩΝ ΠΙΝΑΚΩΝ ΚΑΝΟΝΩΝ ΓΡΑΜΜΕΝΟ ΧΕΙΡΟΓΡΑΦΑ ΣΕ ~8 ΑΡΧΕΙΑ (εύρημα ADR-298 / ADR-841 Α23.6)**

  **Μετρημένο** (`npx jscpd --min-tokens 50 --format typescript tests/firestore-rules/_registry/`): **63 κλώνοι / 7.413 διπλά tokens (41,7%)**
  σε 13 αρχεία. Κυρίαρχο σχήμα: τα 10 κελιά ανάγνωσης «tenant isolation» + `crossTenantUserUnmeasured`/`externalUserOpenDecision`
  επαναλαμβάνονται σε `coverage-matrices{,-boq,-dxf,-specialized,-system,-users}.ts`. Στο `-accounting.ts` έκλεισαν οι 4 εσωτερικοί
  (Α23.6: `overrideDefinition(roleDualMatrix(), …)`, θετικός μάρτυρας κελί-κελί) — ο αριθμός του φακέλου **δεν** έπεσε ανάλογα γιατί
  τα ίδια μπλοκ των άλλων αρχείων ξαναζευγαρώνουν μεταξύ τους. **Θεραπεία**: ίδιο εργαλείο (`overrideDefinition` πάνω σε υπάρχοντα
  πρότυπο ή ένας εξαγόμενος `tenantReadCells()`), **με θετικό μάρτυρα κανονικής μορφής ανά πίνακα** (script: scratchpad
  `dump-matrices.ts` της συνεδρίας 15/09). ⚠️ Προσοχή στη σημείωση του `adminWriteOnlyMatrix` (ο βοηθός γεννούσε νέο κλώνο). 13 αρχεία ⇒ δική του φέτα.

- 🟡 **15/09 — ΤΟ FIXTURE `PublicListing` ΓΡΑΜΜΕΝΟ ΧΕΙΡΟΓΡΑΦΑ ΣΕ 20 ΑΡΧΕΙΑ TESTS (εύρημα ADR-777 §8.69)**

  **Μετρημένο** (grep `as unknown as PublicListing`): **20** αρχεία tests χτίζουν αγγελία με cast, **χωρίς** κοινό builder
  (για τις ζητήσεις υπάρχει `lib/demand/__tests__/demand-fixtures.ts`). Το cast κρύβει κάθε νέο υποχρεωτικό πεδίο: το v11
  `priceReduction` έλειπε από **12** ⇒ 3 σουίτες του `components/search/__tests__` έσκασαν με `reading 'since'` (διορθώθηκαν
  προσθέτοντας `priceReduction: null` στα 2 fixtures). **Θεραπεία**: ένας `publicListingFixture(overrides)` **πλήρως
  τυποποιημένος** (όχι cast, `satisfies PublicListing`) ⇒ νέο πεδίο σχήματος κοκκινίζει στον **μεταγλωττιστή**, όχι σε runtime.

- 🟡 **15/09 — ΟΡΦΑΝΑ ΚΛΕΙΔΙΑ `addresses.geocoding.attempts.*` (εύρημα ADR-332 D28)**

  **Μετρημένο** (grep): το `VARIANT_I18N_KEYS` (`app/api/geocoding/geocoding-nominatim-client.ts`) γράφει **9** κλειδιά
  στο `GeocodingAttempt.i18nKey` — **κανένα** δεν υπάρχει στα `locales/{el,en}/addresses.json` και **καμία** οθόνη δεν
  αποδίδει το `attemptsLog`. Δηλαδή ή νεκρό συμβόλαιο ή οθόνη που δεν γράφτηκε ποτέ (ADR-332 D4 «activity log»).
  **Θεραπεία**: απόφαση Giorgio — (α) αποδίδεται στο activity log του editor ⇒ κλειδιά el+en, ή (β) αφαιρείται το
  `i18nKey` από το συμβόλαιο. Όχι μόνο προσθήκη κλειδιών: κλειδί χωρίς αναγνώστη είναι το ίδιο «0 = κανείς δεν κοίταξε».

- 🔴 **14/09 — `/contact/[token]` ΕΞΑΡΓΥΡΩΝΕΙ ΣΕ `GET` ⇒ ΕΚΤΕΘΕΙΜΕΝΟ ΣΕ ΠΡΟΦΟΡΤΩΣΗ ΣΑΡΩΤΩΝ (ADR-844 · εύρημα audit ADR-841 Α21.18)**

  `app/(auth)/contact/[token]/page.tsx` καλεί `redeemGuestContactByLink` **κατά την απόδοση** — μία χρήση, μέσα σε `GET`.
  Οι σαρωτές ασφαλείας αλληλογραφίας (Microsoft Defender Safe Links, Outlook, εταιρικές πύλες) **ανοίγουν τον σύνδεσμο
  πριν τον άνθρωπο** ⇒ η πρόσκληση καίγεται από μηχανή· ο άνθρωπος βλέπει «ήδη χρησιμοποιήθηκε» (τεκμηριωμένο:
  keycloak#41834 · zitadel discussion 11669). Το `noindex` **δεν** το καλύπτει (δεν είναι crawler).
  **Θεραπεία**: πρότυπο του αδελφού `mandate/[token]` — `GET` **επαληθεύει και δείχνει**, `POST` από κουμπί **εξαργυρώνει**
  (ίδιο σχήμα με RFC 8058). Ο εξαψήφιος κωδικός μένει εναλλακτική πόρτα. Αγγίζει ροή ADR-844 ⇒ δική του φέτα.

- 🔶 **14/09 — ΑΦΑΙΡΕΣΗ ΤΟΝΩΝ ΓΡΑΜΜΕΝΗ ΤΡΕΙΣ ΦΟΡΕΣ (εύρημα audit ADR-841 Α21.19)**

  **Μετρημένο** (grep): το SSoT είναι `utils/greek-text.ts` (`stripAccents` · `normalizeGreekText`)· δίδυμα με το **ίδιο**
  `normalize('NFD').replace(/[̀-ͯ]/g, '')`: `services/ai-pipeline/shared/greek-nlp.ts` → `stripDiacritics`
  (καταναλωτές `utility-handler` · `search-text-handler` · `lib/search/search` · `api/contacts/search-for-share`) και
  `subapps/accounting/services/engines/matching-scoring.ts` → `normalizeGreek` (+ `rule-learning-engine`). **10 αρχεία,
  2 τομείς** ⇒ δική του φέτα. **Θεραπεία**: re-export/αντικατάσταση από το `utils/greek-text`· αγγίζει ai-pipeline ⇒
  `npm run test:ai-pipeline:all` (N.10). ⚠️ Το `normalizeGreek` του accounting κάνει ίσως **και** άλλα βήματα — έλεγχος πριν.

- 🟡 **14/09 — `mandate-consent.test.ts` Ν1 ΑΣΤΑΘΕΣ (εύρημα Α21.17)**

  Κόκκινο μία φορά, πράσινο στην επανάληψη, χωρίς αλλαγή κώδικα. Ύποπτα: ρολόι/σειρά/κοινή κατάσταση πλαστού Firestore.
  **Θεραπεία**: επαναλαμβανόμενη εκτέλεση (`--runInBand` ×20) → εντοπισμός αιτίας → σταθεροποίηση. Όχι `retry`.

- 🔶 **14/09 — `Content-Disposition` ΧΩΡΙΣ UTF-8 ΣΕ 11 ΣΗΜΕΙΑ ΤΟΥ `src/app/api` (ADR-841 §7 Α21.17)**

  **Μετρημένο** κατά το audit της Φέτας Α. Το SSoT `lib/http/content-disposition.ts` (`attachmentDisposition`,
  RFC 6266 + 5987) γεννήθηκε και το `api/download` μεταφέρθηκε. Μένουν χειρόγραφα
  ``attachment; filename="${…}"`` σε: `admin/role-management/audit-log/export` (×2) · `files/watermark` ·
  `files/generate-pdf` · `files/gdpr-export` · `files/batch-download` · `debug/property-showcase-photos` (inline) ·
  `procurement/[poId]/pdf` · `procurement/spend-analytics/export` (×2). **Κίνδυνος**: ελληνικό όνομα αρχείου φτάνει
  ακατάληπτο, και `"` μέσα στο όνομα κλείνει το πεδίο νωρίς. **Θεραπεία**: μηχανική αντικατάσταση — 8 αρχεία ⇒ δική του φέτα.

- 🔶 **14/09 — URL ΣΥΝΘΕΣΗΣ GMAIL ΑΝΤΙΓΡΑΜΜΕΝΟ ΣΕ 5 ΑΡΧΕΙΑ, ΜΕ ΠΑΡΑΛΛΑΓΕΣ (ADR-841 §7 Α21.16)**

  **Μετρημένο** κατά το audit της κάρτας. `https://mail.google.com/mail/?view=cm…` ζει σε
  `UniversalClickableField.tsx:142` · `ErrorBoundary/email-compose.ts:27` ·
  `property-showcase/EmailProviderPicker.tsx:20` · `compositions/ContactCard/ContactCard.tsx:111` ·
  `email-templates/base-email-template.ts:381` — **με και χωρίς `fs=1`, με και χωρίς
  `encodeURIComponent`** (το `ContactCard` παρεμβάλλει ωμό email).
  **Θεραπεία**: `EMAIL_COMPOSE_URLS` δίπλα στο νέο `lib/geo/map-links.ts` (το αδελφό του, για
  χάρτες, κεντρικοποιήθηκε στην Α21.16) — ή `lib/contact/compose-links.ts`. 5 αρχεία ⇒ δική του φέτα.

- 🔶 **14/09 — `config/business-hours.ts` ΔΕΝ ΜΙΛΑ ΤΟ ΝΕΟ `WeeklyHours` (ADR-841 §7 Α21.16)**

  Το booking του Telegram κρατά **ένα** διάστημα/ημέρα σε δικό του σχήμα· το `lib/calendar/weekly-hours.ts`
  (σπαστό ωράριο, ώρα Ελλάδας, αργίες) είναι πλέον ο κανονικός τύπος. Δεν είναι διπλότυπο **συμπεριφοράς**
  σήμερα (άλλη σημασία: slots κράτησης), αλλά δεύτερο λεξιλόγιο «ωραρίου». **Θεραπεία**: το config να
  δηλώνει `WeeklyHours` και το `generateTimeSlots` να το διαβάζει + `greekPublicHolidayOn` για τις αργίες.

- 🔴 **13/09 — Η ΣΙΩΠΗ ΤΟΥ AUDIT: `.catch(() => {})` ΑΝΤΙΓΡΑΜΜΕΝΟ ΣΕ 25 CLIENTS (ADR-852 §4.9)**

  **Μετρημένο** κατά τη Φ4. Κάθε `*-audit-client.ts` γράφει **το δικό του**
  `apiClient.post('/api/audit-trail/record', …).catch(() => { /* fire-and-forget */ })` —
  **25 αντίγραφα** της ίδιας γραμμής, και **καμία** δεν αφήνει ίχνος όταν ο διακομιστής
  απορρίψει την εγγραφή.

  🔴 **ΑΥΤΟ ΕΙΝΑΙ ΠΟΥ ΕΚΡΥΨΕ ΤΗΝ ΑΠΩΛΕΙΑ ΕΠΙ ΜΗΝΕΣ**: έξι οντότητες έπαιρναν **400** σε
  κάθε εγγραφή· κανείς δεν το έμαθε ποτέ, γιατί το `catch` δεν λέει τίποτα σε κανέναν.
  Η Φ4 έκλεισε **την αιτία** (το μητρώο· το 400 δεν ξανασυμβαίνει από αυτή τη ρίζα) —
  **δεν** έκλεισε τη **σιωπή**: άλλη αιτία (δίκτυο, 500, firestore rules) μένει αόρατη.

  ⚠️ **ΚΑΙ ΥΠΑΡΧΕΙ ΗΔΗ SSoT ΠΟΥ ΑΓΝΟΕΙΤΑΙ**: το `API_ROUTES.AUDIT_TRAIL.RECORD`
  (`config/domain-constants.ts:1003`) — οι 25 clients γράφουν το path **χειρόγραφα**.

  **Θεραπεία**: ένας `postAuditRecord()` δίπλα στο `bim-audit-helpers.ts` (ο υπάρχων κοινός
  τους SSoT): παραμένει fire-and-forget *(δεν μπλοκάρει ποτέ τον χρήστη — απόφαση ADR-195)*
  αλλά αφήνει `logger.warn` με `entityType` + `status`. ⛔ **ΜΗΝ** το κάνεις blocking:
  η πολιτική «αποτυγχάνει η ενέργεια αν αποτύχει το audit;» είναι **απόφαση Giorgio**
  (η βιομηχανία: blocking μόνο για ρυθμιζόμενες ροές).

  **Μέγεθος**: 1 νέο σώμα + **25** clients, >1h ⇒ δική του φέτα.

- 🔶 **13/09 — Φ6 ADR-852: 9 ΕΤΙΚΕΤΕΣ ΤΥΠΟΥ ΓΙΑ 45 ΜΕΛΗ**

  **Μετρημένο** κατά τη Φ4. Το `audit.entityTypes.*` (`locales/*/common.json:773`) έχει
  **9** τιμές· το μητρώο έχει **45**. Ο reader καλεί
  `t('audit.entityTypes.' + entry.entityType)` ⇒ κάθε BIM εγγραφή δείχνει **ωμό κλειδί**
  στην κεφαλίδα της, ενώ τα **πεδία** της πλέον μεταφράζονται (Φ4).
  Ίδιο και το φίλτρο του Audit Log (`ENTITY_TYPE_OPTIONS`: **8** από 45) και το
  `buildEntityHref` (**10**). Είναι το **επίπεδο 4** του ADR-852 §1.1, ρητά **Φ6**.

- 🔴 **12/09 — ΔΥΟ ΓΡΑΦΕΙΣ ΣΤΟ ΙΔΙΟ `window.dxfDebug` (ADR-858 §7)**

  **Ανακαλύφθηκε** κατά τη Φ.Γ του ADR-858 (εξάλειψη σκιασμένων barrels). Δύο αρχεία
  γράφουν το **ίδιο** global, με **ασύμβατα σχήματα**:

  | γραφέας | σχήμα |
  |---|---|
  | `dxf-viewer/debug/index.ts` | `enable · disable · manager · canvas · rendering · snap · performance · testSettings · help` |
  | `dxf-viewer/debug/utils/devlog.ts:135` | `enable · disable · **status** · **stats** · **reset**` |

  Και τα δύο είναι `NODE_ENV !== 'production'`-φραγμένα, οπότε **μηδέν επίπτωση στην
  παραγωγή**. Αλλά σε development **όποιο φορτώσει τελευταίο κερδίζει** ⇒ ποιο API βλέπει
  ο developer στην κονσόλα είναι **λαχείο**. Και υπάρχουν **τρεις** ανταγωνιστικές
  δηλώσεις `declare global` για το ίδιο property (`debug/index.ts`, `devlog.ts`,
  `src/types/window.d.ts:39` ως `Record<string, unknown>`).

  ⚠️ **Ήταν ήδη έτσι πριν το ADR-858** — δεν το εισήγαγε η αλλαγή. Δεν επιλέχθηκε νικητής
  εκεί **επίτηδες**: είναι απόφαση για dev εργαλείο, όχι για το σφάλμα παραγωγής που
  διόρθωνε η αλλαγή, και μια σιωπηλή επιλογή θα αφαιρούσε δυνατότητα από τον Giorgio
  χωρίς να τη ζητήσει κανείς.

  **Θεραπεία**: ένας γραφέας. Το `devlog.ts` έχει τα μετρητικά (`stats`/`reset`), το
  `index.ts` τους loggers — η ένωση χωράει σε **ένα** API. Μετά: μία `declare global`.

  **Μέγεθος**: 2-3 αρχεία, < 1h. Χρειάζεται **απόφαση Giorgio** για το τελικό σχήμα.

- 🔴 **12/09 — «ΠΩΣ ΛΕΓΕΤΑΙ Ο ΧΩΡΟΣ;» — ΔΥΟ ΟΝΤΟΤΗΤΕΣ, ΕΝΑ ΟΝΟΜΑ (ADR-749)**

  **Μετρημένο** κατά την ADR-853 Φ4. Ο **γραφέας** είναι το `provisionWorkspace` →
  `ensureCompanyDocument(id, { name: displayName, contactId: id })` ⇒ αυθεντία = πεδίο
  **`name`** στο `companies/{companyId}`. Συμφωνούν: `workspace-catalog.ts`
  *(τώρα `readWorkspaceName`, ο ΕΝΑΣ αναγνώστης του διακομιστή)* και
  `bootstrap-queries.ts:177`.

  🔴 **Η ΑΠΟΚΛΙΣΗ**: `src/hooks/useCompanyDisplayName.ts` → `getCompanyById`
  (`services/companies.service.ts`) διαβάζει **`COLLECTIONS.CONTACTS`** — **άλλη
  συλλογή** — με **άλλα πεδία** (`companyName || tradeName`) και fallback στο **ωμό id**.
  Δηλαδή **δεν** είναι ασυμφωνία σχήματος: είναι **δύο διαφορετικές οντότητες**
  *(χώρος εργασίας vs επαφή τύπου εταιρείας)* που απαντούν στην **ίδια** ερώτηση.
  Η σύγχυση είναι δομική: ο provisioner γράφει `contactId: companyId`, άρα το ίδιο
  αναγνωριστικό ζει και στους δύο κόσμους.

  **Πού φαίνεται**: `FloorPlanTab` · `PhotosTab` · `VideosTab` *(και το τελευταίο ακόμη με
  αντιγραμμένο `useEffect` αντί για τον hook)*. Ένα γραφείο που μετονομάστηκε στον χώρο
  του εμφανίζεται με το **παλιό** όνομα της επαφής — ή με `comp_a1b2c3`.

  **Θεραπεία**: ο hook να ρωτά τον χώρο *(νέα διαδρομή ανάγνωσης ή server component)*,
  ΟΧΙ τις επαφές. ⛔ **ΜΗΝ** «διορθωθεί» αλλάζοντας πεδία μέσα στο
  `companies.service.ts`: εκείνο εξυπηρετεί **σωστά** τον κόσμο των επαφών — το λάθος
  είναι **ποιον ρωτάμε**, όχι τι απαντά. Πελατικός κώδικας, 3+ αρχεία, >1h ⇒ απόφαση
  Giorgio.

- 🔴 **12/09 — CHECK 3.78 (ADR-855): 155 ΠΑΡΑΒΙΑΣΕΙΣ ΠΟΛΙΤΙΚΗΣ ΡΥΘΜΟΥ — ΕΚΣΤΡΑΤΕΙΑ ΠΡΟΣ ΤΟ ΜΗΔΕΝ**

  **Πού**: `npm run rate-limit-policy:report` · baseline `.rate-limit-policy-baseline.json`
  🔴 **ΑΝΟΙΞΕ ΤΟ `tally` ΤΟΥ JSON.** Αυτή η καταχώρηση έγραφε «**155** (77 σιωπηλές + 78
  νεκρές)» — **μπαγιάτικο μέσα στην ίδια μέρα**, και ήταν **η τρίτη** αντιγραφή του ίδιου
  αριθμού από τον ίδιο πράκτορα *(μαζί με το ADR-855 §7 και το `docs/gates/3.78.md`)*, όλες
  σε παράγραφο που έλεγε «μην αντιγράψεις τον αριθμό». Δύο ανεξάρτητα κριτήρια:

  · **Κ1 — ΣΙΩΠΗΛΕΣ διαδρομές** (`tally.undeclared`): κανένα όριο δηλωμένο, ούτε άμεσα ούτε
    μέσω εργοστασίου — παίρνουν την **προεπιλογή** (`STANDARD`). Θεραπεία = **ένας wrapper**
    στη διαδρομή. Boy Scout: όταν αγγίζεις `route.ts` χωρίς wrapper, δήλωσε βαθμίδα.

  · **Κ2 — ΝΕΚΡΕΣ ΓΡΑΜΜΕΣ ΠΙΝΑΚΑ** (`tally.prefix-shadowed-by-declaration`· κατανομή στο
    `mismatch_by_pair`): η διαδρομή δηλώνει Χ **και μια γραμμή του πίνακα** λέει Υ.
    ⚠️ **ΔΕΝ τρέχουν λάθος όριο** — μετά τη Φ1 η **δήλωση κερδίζει**, άρα τρέχουν σωστά·
    νεκρή είναι η **γραμμή**, που γι' αυτές δεν πυροδοτεί **ποτέ** (ADR-749).
    Θεραπεία = **ΑΠΟΦΑΣΗ ανά περίπτωση**: για τις **13 `/api/reports/*`** *(`STANDARD→HEAVY`)*
    μάλλον ο πίνακας *(είναι όντως βαριές)*· για τις **11 `/api/admin/backup/*`**
    *(`STANDARD→SENSITIVE`)* μάλλον επίσης ο πίνακας· για τα `oauth/metadata/*` σίγουρα η
    δήλωση *(έγινε)*. ⛔ **ΜΗΝ** «διορθωθεί» μαζικά: εικασία σε δεκάδες σημεία παραγωγής.

  🔑 **Ο ΑΡΙΘΜΟΣ ΕΠΕΣΕ ΚΑΤΑ ~2/3 ΣΤΙΣ 12/09 ΚΑΙ ΔΕΝ ΚΑΘΑΡΙΣΕ ΤΙΠΟΤΑ** — διορθώθηκε ο
  **ορισμός** (ADR-855 **Φ7**): διαδρομή που δηλώνει κάτι άλλο από την **προεπιλογή**, χωρίς
  να υπάρχει **καμία** γραμμή πίνακα για τη διεύθυνσή της, **δεν ήταν ποτέ παραβίαση** — δεν
  υπάρχει τίποτα να παλιώσει. Πλέον μετριέται χωριστά ως ✅ `declared-over-default`.
  ⛔ **ΜΗΝ το διαβάσεις ως πρόοδο της εκστρατείας**: οι ζωντανές παραβιάσεις δεν
  θεραπεύτηκαν, **σταμάτησαν να μετρώνται λάθος**.

  🔶 **Δηλωμένο ανοιχτό**: το `/api/auth/workspace-access-request` δηλώνει STANDARD ενώ είναι
  **επιφάνεια ταυτότητας** — σωστή θεραπεία είναι SENSITIVE, θέλει απόφαση Giorgio
  (ADR-660 §6 · ADR-853 Α4).

  **Ratchet κατά ταυτότητα**: το ζεύγος βαθμίδων μπαίνει στο id, άρα «155 → 155» με
  **ανταλλαγή** μπλοκάρει. Reseed **μόνο** μετά από νόμιμο καθάρισμα:
  `npm run rate-limit-policy:baseline`.

- 🔴 **12/09 — ΟΙΚΟΓΕΝΕΙΑ 4 ΡΗΧΩΝ ΚΑΘΑΡΙΣΤΩΝ `undefined` ΧΩΡΙΣ SSoT** *(βρέθηκε στο ADR-852 §4.7· ΜΗ ΑΝΟΙΓΜΕΝΟΙ: +6)*

  **Πού — ανοιγμένα και επαληθευμένα, όχι συμπερασμένα από ονόματα** (το σχήμα που το ίδιο το
  ADR-852 καταγγέλλει): **3 inline αντίγραφα** του ίδιου βρόχου, με το **ίδιο σχόλιο** από πάνω
  *(«Remove undefined values for Firestore»)* — `src/services/file-audit.service.ts:164` ·
  `src/services/file-share.service.ts:187` · `src/services/file-version.service.ts:148`
  *(ο τελευταίος με **σπόρο** `{ id: versionId }` — γνήσια παραλλαγή, όχι αντίγραφο)* — **συν**
  τον **ονομασμένο** `stripUndefinedShallow` (`src/services/entity-audit.service.ts`).
  ⚠️ **+6 ακόμη υποψήφιοι, ΔΗΛΩΜΕΝΑ ΜΗ ΑΝΟΙΓΜΕΝΟΙ** (grep, όχι μέτρηση): `property-patch-helpers.ts:165`,
  `boq-admin-read-service.ts:151`, `address-corrections-telemetry.service.ts:99`,
  `hatch-firestore-service.ts:200`, `scoped-library-service.ts:156`,
  `opening-frame-profile-library-service.ts:124`. **Άνοιξέ τα πριν τους πεις διπλότυπα.**

  **Γιατί μετράει**: τα 3 inline είναι **client SDK** (`setDoc`/`serverTimestamp` του
  `firebase/firestore`), ο 4ος **Admin SDK** (`server-only`) — **άλλα sentinels, ίδιο ερώτημα**.
  Και είναι ~7 γραμμές το καθένα, δηλαδή **πιθανώς κάτω από το όριο των 50 tokens** του jscpd
  ⇒ **αόρατα στην CHECK 3.28**. *(Αυτό **δεν** μετρήθηκε — είναι υπόθεση προς επαλήθευση, όχι
  ισχυρισμός. Αν επιβεβαιωθεί, είναι πέμπτη εμφάνιση του «πράσινο = κανείς δεν κοίταξε».)*

  **Υποψήφιο σπίτι**: `src/utils/firestore-sanitize.ts` (**223** χρήσεις σε **72** αρχεία — γνήσιο SSoT).
  ⛔ **ΑΛΛΑ ΟΧΙ ΩΣ ΕΧΕΙ**: ο γείτονας `stripUndefinedDeep` **καταστρέφει** instances κλάσεων
  (τον `FieldValue.serverTimestamp()` sentinel → `{}`· έχει ρητό φρουρό **μόνο** για `Date`/πίνακες
  — **εκτελεσμένη απόδειξη**: άγκυρα **Ε3β** στο `entity-audit-write-shallow.test.ts`). Ένας ρηχός
  **δίπλα** του κάνει το «βάλε το Deep, είναι πληρέστερο» αλλαγή **μιας λέξης** που αναστήνει το
  περιστατικό **ADR-438**. Άρα η φέτα πρέπει να λύσει **πρώτα** τη γειτνίαση (χωριστό module, ή
  φρουρός sentinel μέσα στο `stripUndefinedDeep` με δική του άγκυρα).
  **4 αρχεία σε 2+ τομείς + 6 ανεξέταστοι ⇒ >1h, δική της φέτα.**

  🔶 **Δηλωμένο ανοιχτό, ίδια οικογένεια**: το `stripUndefinedDeepAnyObject`
  (`api/admin/search-backfill/search-index-config.ts`) αναδρομεί σε **κάθε** object — κατά λέξη ο
  κώδικας **πριν** τη διόρθωση του ADR-438. **Σήμερα λανθάνον** (το `SearchDocumentInput` δεν έχει
  `Date`/`Timestamp`· τα 3 sentinels μπαίνουν **μετά** τον καθαριστή), γι' αυτό **δεν** διορθώθηκε:
  προσθήκη φρουρού θα το έκανε **ταυτόσημο** με το `stripUndefinedDeepPlainOnly` του `audit-core`
  ⇒ γνήσιο διπλότυπο ⇒ θα απαιτούσε την **ενοποίηση** που δεν αποφασίστηκε. Απόφαση Giorgio.

> ✅ **12/09 — ΕΚΛΕΙΣΕ**: «τριπλό ομώνυμο `removeUndefinedValues` — τρεις σημασίες, ένα όνομα»
> (**ADR-852 §4.7**). Έγιναν **τρία ονόματα κατά εγγύηση**: `stripUndefinedShallow` ·
> `stripUndefinedDeepPlainOnly` · `stripUndefinedDeepAnyObject` — **καμία ενοποίηση**.
> 🔴 Η διάκριση **δεν** ήταν «ρηχό vs αναδρομικό» αλλά **ο φρουρός**: το handoff έλεγε «audit-core
> = γενικό», **ψευδές**. Ονοματολογία κατά **βιομηχανική σύμβαση** (Vue `shallowRef` / React
> `shallowEqual` / lodash `cloneDeep`) — η πρώτη πρόταση `…TopLevel` **απορρίφθηκε από έρευνα**.
> Η εναλλακτική «ενεργοποίησε το `ignoreUndefinedProperties`» **εξετάστηκε και απορρίφθηκε**
> (σημασιολογία **ανά μέθοδο write**· **174-259** δικά μας Firestore `.update()` σε **156** αρχεία
> χωρίς άγκυρα) — και επαληθεύτηκε **εκτελώντας** ότι **δεν ορίζεται πουθενά**.
> **Μετάλλαξη 3/5 κόκκινα για τον σωστό λόγο, 0 ψευδώς θετικά**· το jest τύπωσε μόνο του
> *«serializes to the same string»*, δηλαδή ένα `toEqual` θα περνούσε **πράσινο** και η αναλλοίωτη
> θα έσπαγε **αόρατα**. Άγκυρα: `src/services/__tests__/entity-audit-write-shallow.test.ts`.

- 🔴 **12/09 — ΑΜΦΙΣΗΜΟ `audit.fields.<X>`: ΟΝΤΟΤΗΤΑ ή ΠΕΔΙΟ; — ΔΥΟ ΜΕΤΡΗΜΕΝΑ ΘΥΜΑΤΑ** *(ADR-810 §7 · ADR-852 §4.8.2)*

  **Πού**: `src/i18n/locales/{el,en}/common-audit.json` · ο καταναλωτής είναι το
  `resolveFieldLabel` (`components/shared/audit/audit-field-descriptor.ts:109-112`), που
  δοκιμάζει **`audit.fields.{οντότητα}.{πεδίο}`** και μετά **`audit.fields.{πεδίο}`** — **δύο
  σημασίες στον ΙΔΙΟ χώρο ονομάτων**.
  **Γιατί μετράει**: αν ένα όνομα είναι **και** οντότητα **και** πεδίο, η φωλιά της οντότητας
  κάνει το δεύτερο βήμα να επιστρέφει **αντικείμενο** ⇒ ο `translated()` το απορρίπτει ⇒ **η
  ετικέτα του πεδίου χάνεται σιωπηλά** από κάθε οντότητα που το έχει.
  🔴 **Δεν είναι θεωρητικό — χτύπησε ΔΥΟ ΦΟΡΕΣ**: `floor` (ADR-810, 26/08) και **`company`**
  (ADR-852 Εργασία Β, 12/09). Τη δεύτερη φορά το έπιασαν **δύο ανεξάρτητες πύλες μαζί**
  (**Κ2** διπλό κλειδί + **Π3** ορατή τιμή άλλαξε) — το όριο ήταν **ήδη γραμμένο** στο
  ADR-810 §7 και **δεν διαβάστηκε**.
  ✅ **ΜΕΤΡΗΘΗΚΕ 13/09 — Ο ΚΙΝΔΥΝΟΣ ΕΙΝΑΙ ΕΝΑΣ, ΟΧΙ ΠΟΛΛΟΙ.** Αυτή η γραμμή έλεγε
  «*υποψήφια: `material`, `quote`, `floor`, `parking`, `storage`*» — **εικασία, και ψευδής**.
  Πάνω στα **40** μέλη του `AuditEntityType` έναντι **166** γενικών πεδίων: **ΑΚΡΙΒΩΣ ΕΝΑ**
  συγκρούεται (`company`) και **λύθηκε**· **30** μέλη ασφαλή· **12** φωλιές υπάρχουν.
  ⇒ **Η Φ4 (23 οντότητες) ΔΕΝ κινδυνεύει.** Μένει ως **καθαρότητα**, όχι επείγον.
  🔒 **Φθηνός φρουρός στο μεταξύ**: πριν προσθέσεις φωλιά `audit.fields.<X>`, ρώτα αν το `<X>`
  υπάρχει ήδη ως **γενικό πεδίο** στο ίδιο αρχείο. Αν ναι ⇒ **καμία φωλιά**, μόνο γενικά κλειδιά.
  **Διόρθωση**: διαχωρισμός των δύο χώρων ονομάτων *(π.χ. `audit.entityFields.<τύπος>.<πεδίο>`
  έναντι `audit.fields.<πεδίο>`)* — **απόφαση αρχιτεκτονικής**, αγγίζει reader + 8 φωλιές +
  δύο locale αρχεία ⇒ **δική της φέτα**. Προσωρινό μπάλωμα, όπως έγινε στο `company`:
  **καμία φωλιά** για ομώνυμη οντότητα, μόνο γενικά κλειδιά.

> ✅ **12/09 — ΕΚΛΕΙΣΕ**: «γενέτειρες `AuditFieldChange` εκτός μητρώου» (**ADR-852 §4.8**,
> κώδικας `822255af`). Ήταν **ΤΕΣΣΕΡΙΣ, όχι πέντε**: το `core/commands/text/diff-helpers.ts`
> γράφει σε **`noopAuditRecorder`** και **δεν φτάνει ΠΟΤΕ** στο Firestore *(ίδιο noop έχουν
> και τα 5 `entity-commands` — «Phase 7»)*. Και το **`company_document` δεν υπάρχει**: η
> οντότητα είναι **`company`**. Έγιναν **3** μητρώα + **3** `case` + **9** κλειδιά i18n ανά
> γλώσσα, και **17** ωμά ελληνικά έφυγαν από δύο `.ts` (N.11) — ο κοινός `fieldChange()`
> **υπήρχε ήδη**. **Το CDC (ADR-195) ΔΕΝ χρειάστηκε θεραπεία**: γράφει `label: key`, άρα τα
> ίδια i18n blocks το θεραπεύουν **ζωντανά**. Άγκυρες **Ζ0-Ζ4**, 20/20, **2 μεταλλάξεις**.
> 🏆 **Παράπλευρο**: τα 9 νόμιμα κλειδιά αποκάλυψαν ότι το **Π4** της CHECK 3.71 ήταν
> **change-detector ΚΑΙ τυφλό στην ανταλλαγή** — ξαναγράφτηκε **κατά ταυτότητα** (3 μεταλλάξεις,
> 26/26).

- 🔴 **12/09 — ΠΕΝΤΕ ΓΕΝΕΤΕΙΡΕΣ `AuditFieldChange` ΕΚΤΟΣ ΜΗΤΡΩΟΥ** *(ADR-852 §4.6.4)*

  **Πού**: `functions/src/audit/deep-diff.ts:305` (CDC· γράφει `label: key`) ·
  `src/services/company-document.service.ts:379` (`label: String(field)`) ·
  `src/subapps/dxf-viewer/text-engine/templates/text-template.service.ts` (ωμά ελληνικά: `'Όνομα'`, `'Κατηγορία'`) ·
  `…/text-engine/spell/custom-dictionary.service.ts` · `…/core/commands/text/diff-helpers.ts:23`.
  **Γιατί μετράει**: το διπλό κανάλι της Φ3 ζει στο `descriptorChannels()`, που το ρωτούν **μόνο** οι δύο
  διαδρομές του μητρώου. Αυτές οι πέντε **δεν έχουν μητρώο**, άρα καμία εγγραφή τους δεν θα αποκτήσει ποτέ
  περιγραφέα — και οι δύο του text-engine γράφουν **ωμά ελληνικά σε `.ts`** (γειτονιά N.11).
  ⚠️ **Το CDC είναι registry-blind ΕΚ ΣΧΕΔΙΑΣΜΟΥ** — το δηλώνει το ADR-195 («δεν γνωρίζει το
  `TrackedFieldDef` registry — διαβάζει raw snapshots»). Να **μην** «διορθωθεί» χωρίς ADR.
  **Διόρθωση**: μητρώα για `company_document` / `text_template` / `custom_dictionary_entry` — δηλαδή
  **επέκταση της ADR-852 Φ4 σε νέες οντότητες**, όχι μπάλωμα. Το CDC χωριστά, με δική του απόφαση.

> ✅ **26/08 — ΕΚΛΕΙΣΕ**: «578 KB νεκρές γραμματοσειρές» (ADR-805 §9). Διαγράφηκαν το
> `helvetiker_regular.typeface.json` (MgOpen εκτός SPDX, μηδέν καταναλωτές) και το
> `Roboto-Regular.ttf` (νεκρό μετά το ADR-803). **CHECK 3.69: baseline 1/8 → 0/6.**

> ✅ **03/09 — ΕΚΛΕΙΣΕ**: «η εγγύτητα των προτάσεων διεύθυνσης τρεφόταν από το τίποτα»
> (ADR-332 **D23**). Αφετηρία = **το έργο** (απόφαση Giorgio)· μετονομασία
> `MapCenter`→`ProximityAnchor`· νέο SSoT `utils/address/address-list-center`· άγκυρα που
> **εκτελεί** τον παραγωγικό καλόντα. 3/3 μεταλλάξεις κόκκινες.
> ✅ **07/09 — ΕΚΛΕΙΣΕ**: «η αβεβαιότητα ζωγραφιζόταν σε pixel ενώ κρινόταν σε μέτρα»
> (**ADR-777 §8.64**). Νέο SSoT `lib/maps/metric-size.ts`: η ακτίνα **παράγεται** από το
> `LISTING_UNCERTAINTY_KM`, με διόρθωση Mercator **ανά αγγελία** — το πέρασμα που η ίδια η
> MapLibre έχει δηλώσει αδύνατο. `RADIUS` = `{pin:7, ring:7}` — **μόνο σημάδια**. 37 άγκυρες.
> ✅ **ΕΠΑΛΗΘΕΥΤΗΚΕ ΖΩΝΤΑΝΑ** (§8.64.11): η ακτίνα **διπλασιάζεται ανά βαθμό ζουμ**
> (42,5→84→167→664,9 px, θεωρητικό 41,5→83→166→663,9) και **τα δύο** ψαλίδια ενεργοποιούνται
> (13 px στο ζ6 · 3001 px στο ζ18 αντί 42 492). ⚠️ **Αλλά τα 6 πραγματικά features είναι όλα
> `pin` με `uncertaintyM: 0`** ⇒ τα επίπεδα αβεβαιότητας είναι **άδεια στην παραγωγή**·
> η μέτρηση χρειάστηκε **έγχυση**. Ξαναπερπάτησέ το στην πρώτη αγγελία `shaded-*`.
> ✅ **10/09 — ΕΚΛΕΙΣΕ**: «`contacts` ταυτόχρονα εντός και εκτός χώρου — 5 κόκκινα tests» (**ADR-843
> §10.19**). Η ιδιωτική διαδρομή έγινε **`/first-contacts`** (ίδια λέξη με API/συλλογή)· `+ contact`
> (ADR-844) στο κλειστό σύνολο· **νέος κανόνας Κ3 ⛔ `segment-collision` στην CHECK 3.60** — η σύγκρουση
> είναι πλέον **αδύνατη στο commit**. Οι 5 άγκυρες πράσινες.

- 🔴 **11/09 — `global-by-structure` (CHECK 3.50, ADR-780 §5quater): ΚΑΘΟΛΙΚΕΣ ΣΤΡΩΣΕΙΣ ΧΩΡΙΣ ΡΟΛΟ**

  **Πού**: `npm run zindex-scale:report` → «ΩΜΕΣ ΔΗΛΩΣΕΙΣ ανά αρχείο» (baseline `.zindex-scale-baseline.json` — **άνοιξε
  το JSON**). Κυρίως διάλογοι/πάνελ του DXF σε `fixed … z-40/50/60/61` (FontManagerPanel · Materials/FrameProfiles
  LibraryPanel · DimensionsTab · TextTemplate*/CustomDictionary* · FindReplace · SymbolPicker …) + `SmartActionFactory`,
  `SendEmailModal`, `MobileDetailsSlideIn`, `skeletons`, `ui/sidebar`.
  **Γιατί μετράει**: `fixed` + ωμό z < 1000 = καθολική στρώση που δεν ζήτησε ρόλο· οι διάλογοι του DXF σε `z-[60]`
  αποδίδονται **έξω** από την πλήρη οθόνη DXF ⇒ κρύβονται κάτω της (ίδια κλάση με το Ζ3).
  **Διόρθωση**: διάλογος/modal → `z-[var(--z-index-transient-stack)]` · πάνελ/επιφάνεια → ρόλος επιφάνειας · Boy
  Scout στο άγγιγμα, ratchet μόνο κατεβαίνει. **Και** (ίδια οικογένεια, αόρατα στην πύλη): η ιδιωτική κλίμακα
  `dxf-viewer/config/modal-config.ts` (50/60/70/75/80/90, inline `style`) · `LayerStateDropdown` (4 διάλογοι μέσα σε
  popover που μένει ανοιχτό ⇒ πίσω του).

> ✅ **11/09 — ΕΚΛΕΙΣΕ**: «δίδυμο της δημόσιας διεύθυνσης με άλλο fallback» (**ADR-851 Φ5**).
> Μετρήθηκε ότι το `NEXT_PUBLIC_BASE_URL` **δεν ορίζεται σε κανένα περιβάλλον** ⇒ η ενοποίηση
> **δεν** άλλαξε συμπεριφορά. `guest/route.ts` · `pending-registration.ts` · `PhotoSharePageContent.tsx`
> → `publicUrl()`· η διαδρομή πρώτης επαφής αρνείται (503) **πριν** γράψει πρόσκληση χωρίς σύνδεσμο.
> Ratchet: module `public-origin` στο `.ssot-registry.json` (μηδενική ανοχή).


- 🔴 **10/09 — ΩΜΑ NUL BYTES ΣΕ 9 ΑΡΧΕΙΑ ΚΩΔΙΚΑ — ΚΑΙ Ο ΕΛΕΓΧΟΣ ΜΕ `grep` ΕΙΝΑΙ ΤΥΦΛΟΣ** *(βρέθηκε στο ADR-843 §10.19, όταν ένα handoff απέκτησε NUL και το `grep -c -P '\x00'` μέτρησε **0**)*

  **Πού** (σάρωση node σε 20.053 αρχεία κειμένου): `scripts/lib/i18n-shell-slice/plan.js:62` ·
  `scripts/lib/module-graph/parse-module.js:208,216` · `scripts/lib/shell-utilities/reach.js:176` ·
  `src/subapps/dxf-viewer/bim-3d/converters/glyph-atlas.ts:149` · `…/bim-3d/viewport/snap/snap-3d-glyph-key.ts:25` ·
  `…/bim/table/binding/table-bound-marks.ts:159` · `…/bim/table/table-cell-content.ts:213,218` ·
  `…/systems/selection/candidate-named-identity.ts:108` · + παλιά `src/subapps/dxf-viewer/docs/analysis/duplicates/*.md`.
  **Γιατί μετράει**: το git βλέπει το αρχείο ως **δυαδικό** (κανένα diff στο review), και μια regex με
  ωμό NUL αλλάζει σημασία σιωπηλά. Πιθανότατα όλα γεννήθηκαν από `escape` που το εργαλείο `Write`/`Edit`
  μετέτρεψε σε ωμό byte (ίδια παγίδα με ADR-848 §7) — **να κριθεί ανά αρχείο** αν ο NUL είναι σκόπιμος
  διαχωριστής κλειδιού (τότε `String.fromCharCode(0)`) ή λάθος.
  **Ανίχνευση που ΔΟΥΛΕΥΕΙ**: `git ls-files -co --exclude-standard | node -e "…s.includes(String.fromCharCode(0))…"`.
  ⛔ Το `grep -c -P '\x00'` σε αυτό το μηχάνημα απαντά **0 πάνω σε αρχείο με NUL**.
  🔒 **Ratchet που λείπει**: πύλη pre-commit «κανένα ωμό NUL σε staged αρχείο κειμένου» (κοστίζει ms).

- 🔴 **10/09 — ΤΟ `jest-suite` ΤΟΥ CI ΑΠΟΤΥΓΧΑΝΕΙ ΣΕ ΚΑΘΕ ΕΚΤΕΛΕΣΗ ΤΟΥΛΑΧΙΣΤΟΝ ΑΠΟ 02/09** *(βρέθηκε στο **ADR-843 §10.19**, ψάχνοντας γιατί 5 κόκκινες άγκυρες δεν μπλόκαραν τίποτα έξι μέρες)*

  **Πού**: `gh run list --workflow jest-suite.yml` — **8/8** πρόσφατες εκτελέσεις `failure`
  (02/09 → 10/09). Το workflow είναι **ratchet** (`.jest-suite-baseline.json`: κάθε **νέο** κόκκινο
  μπλοκάρει) — αλλά μονίμως κόκκινο σημαίνει ότι **κανένα νέο κόκκινο δεν ξεχωρίζει**, και οι αποτυχίες
  CI δεν σταματούν το deploy στο Netcup. ⇒ **Κάθε άγκυρα που ζει μόνο στο CI είναι σήμερα σχόλιο**
  (ADR-587 §6.1). Απόδειξη: οι 5 του `workspace-scope` **δεν** ήταν στη baseline και κανείς δεν σταμάτησε.
  **Fix**: διάβασε τα αρτιφάκτ `jest-suite-results` της τελευταίας εκτέλεσης → κατάταξε τα κόκκινα
  (πραγματικές βλάβες / μπαγιάτικες άγκυρες / περιβάλλον) → πράσινο ή **δηλωμένο** στη baseline.
  **Εκτίμηση**: >1h, πολλοί τομείς ⇒ N.8.

- 🔴 **10/09 — ΝΕΚΡΟ `nestor-app.vercel.app` ΩΣ ΕΦΕΔΡΕΙΑ ΣΕ 17 ΑΡΧΕΙΑ — ΚΙΝΔΥΝΟΣ SUBDOMAIN TAKEOVER** *(βρέθηκε στο **ADR-848 Φ1**, διορθώνοντας το `base-email-template.ts`)*

  **Πού**: `grep -rl "nestor-app\.vercel\.app" src` — μεταξύ άλλων `mandate-invitation.service.ts` ·
  `onboarding-reminder.job.ts` · `lib/share-utils.ts` · `api/procurement/[poId]/share/route.ts` ·
  `rfq-service.ts` · `vendor-invite-service.ts` · `api/attendance/qr/generate/route.ts` ·
  `api/alerts/schedule-check/route.ts` · `sales-accounting/notification-helpers.ts` ·
  `ShowcasePublicDoor.tsx` · `PhotoSharePageContent.tsx` · `usePhotoPreviewState.ts` ·
  `social-platform-system/analytics-service.ts` · `core/configuration/index.ts` ·
  `title-block-fingerprint.ts` (να κριθεί χωριστά — ίσως δεν είναι σύνδεσμος).

  🔴 **Δεν είναι μόνο διπλότυπο (17 αναγνώστες του `NEXT_PUBLIC_APP_URL`) — είναι ΑΣΦΑΛΕΙΑ.** Το
  Vercel είναι παγωμένο από 2026-05-09· αν το υποdomain ελευθερωθεί, **όποιος το διεκδικήσει**
  παραλαμβάνει συνδέσμους από email, QR και κοινοποιήσεις μας — phishing με **δική μας** υπογραφή.

  **Fix**: κάθε ανάγνωση → `publicOrigin()` / `publicUrl()` (`lib/http/request-origin.ts`, ADR-848)
  ή `absoluteUrl(request, …)` όπου υπάρχει αίτημα· `null` ⇒ **ρητός** χειρισμός, ποτέ
  κατασκευασμένο domain. Ratchet: pattern `nestor-app\.vercel\.app` στο `.ssot-registry.json`.
  **Εκτίμηση**: >1h, 17 αρχεία, 5+ domains ⇒ N.8 (Plan Mode / Orchestrator — ερώτηση στον Giorgio).

  🔑 **10/09 — ΤΟ ΕΥΡΗΜΑ ΑΛΛΑΞΕ ΤΗΝ ΠΡΟΤΕΡΑΙΟΤΗΤΑ** (ADR-848 changelog 10/09 γ): ο **server** έπαιρνε
  σωστά τη διεύθυνση από το Coolify (runtime)· ο **browser όχι**, γιατί το `docker-build.yml` δεν όριζε
  `NEXT_PUBLIC_APP_URL` ⇒ το QR της πινακίδας τύπωνε Vercel. ✅ **Η ρίζα διορθώθηκε** (μία γραμμή στο
  build). Μένει **καθάρισμα**: σβήσιμο της νεκρής εφεδρείας + SSoT `public-origin.ts` + ratchet — **χωρίς
  βιασύνη**, μετά το ADR-848 Α (σίγαση ανά τύπο). Το project στο Vercel **ΜΗΝ διαγραφεί** (κρατά το όνομα).
  ✅ *11/09 (ADR-851 Φ5)*: `PhotoSharePageContent` · guest `publicBase()` · `pending-registration.ts:282`
  πέρασαν στο `publicUrl()`. Μένουν τα υπόλοιπα.
  Επιπλέον ευρήματα: `PhotoSharePageContent` διαβάζει `NEXT_PUBLIC_BASE_URL` (**δεν ορίζεται πουθενά**) ·
  `VendorInviteSection` → `?? ''` (μισός σύνδεσμος) · **τρεις** συναρτήσεις `getAppBaseUrl` + `publicBase()`
  (guest route) + `pending-registration.ts:282` = διπλότυπα του `publicOrigin()`.

- 🔴 **09/09 — ΤΡΙΤΟ ΑΝΤΙΓΡΑΦΟ ΤΗΣ ΤΕΜΠΕΛΙΚΗΣ ΦΟΡΤΩΣΗΣ, ΚΑΙ ΕΧΕΙ ΤΟ BUG ΠΟΥ ΤΟ ΠΡΩΤΟΤΥΠΟ ΘΕΡΑΠΕΥΣΕ** *(βρέθηκε στο **ADR-846 §9 #13**, ψάχνοντας SSoT για τη γενεαλογία)*

  **Πού**: `src/components/shared/addresses/editor/helpers/hierarchyLookup.ts:101-119`
  — `cachedLookup` + `loadingPromise` + `fetch('/data/administrative-hierarchy.json')`,
  γραμμένα με το χέρι, **χωρίς `try/catch` και χωρίς `finally`**.

  🔴 **ΔΕΝ είναι μόνο διπλότυπο — είναι ΖΩΝΤΑΝΟ ΕΛΑΤΤΩΜΑ.** Αν το `fetch` αποτύχει
  *(κρύο φόρτωμα, δίκτυο, σελίδα σφάλματος)*, το `loadingPromise` κρατά **απορριφθείσα
  υπόσχεση για πάντα**: κάθε επόμενος καλών παίρνει **την ίδια** αποτυχία και ο
  επεξεργαστής διευθύνσεων **δεν ξαναρωτά ποτέ** μέχρι reload. Είναι **ακριβώς** το
  περιστατικό που γέννησε το `lib/data/lazy-json-snapshot.ts` *(«άδειος επιλογέας σε
  κάθε κρύο φόρτωμα»)* — και η θεραπεία **δεν έφτασε ποτέ εδώ**.

  **Και τέταρτος περιπατητής γενεαλογίας**: `resolveAncestors` (γρ. 88-96) περπατά το
  **ίδιο** `parentId` με το `lineageIdsOf` *(περιηγητής)* και το `readAdministrativeLineage`
  *(διακομιστής)* — **χωρίς** τον φρουρό κύκλου βάθους 16 που έχουν και οι δύο.

  **Λύση ίδιου σχήματος**: `createLazyJsonSnapshot` για τη φόρτωση *(υπάρχει)*·
  `LineageResolver` με ένεση για τον περίπατο *(υπάρχει)*. Καμία νέα αφαίρεση.

  **Γιατί ΔΕΝ έγινε τώρα**: άλλο υποσύστημα *(επεξεργαστής διευθύνσεων)*, άλλος τύπος
  *(`AdminEntity[]` αντί για `string[]`)*, και καταναλωτές `validateGreekHierarchy` +
  `postalCodeAutoFill` που θέλουν δική τους επαλήθευση. N.0.2 «μεγάλο διπλότυπο» ⇒ εδώ.

  ⚠️ **Το `jscpd` ΔΕΝ θα το πιάσει**: ο μηχανισμός είναι ~12 γραμμές, κάτω από το
  `min-tokens: 50`. Το βρήκε **ανθρώπινο** ερώτημα *(«ποιος άλλος περπατά τη γενεαλογία;»)*,
  και αυτό είναι το μάθημα — **ίδιο σχήμα με το CHECK 3.18: το πράσινο σήμαινε «στενή σάρωση»**.

- 🟡 **08/09 — ΤΡΙΑ ΚΑΝΟΝΙΚΑ MATRICES ΓΡΑΦΟΥΝ ΤΑ ΙΔΙΑ ΚΕΛΙΑ ΑΝΑΓΝΩΣΗΣ** *(το έπιασε το CHECK 3.28 μέσα στη δουλειά του **ADR-298 Α21.15**)*

  **Πού**: `tests/firestore-rules/_registry/coverage-matrices.ts` — `immutableMatrix()` (159-173)
  vs `adminWriteOnlyMatrix()` (275-282) vs `roleDualMatrix()` (323-336) vs (384-400).
  **3 κλώνοι, 13-15 γραμμές / 99-116 tokens ο καθένας.**

  **Γιατί μετράει**: είναι **ακριβώς η ίδια κλάση** που το ίδιο αρχείο έχει ήδη λύσει μία φορά —
  ο βοηθός `serverOnlyWriteCells(personas)` εξήχθη (ADR-777 Β1) όταν το jscpd έπιασε τα ίδια
  **έξι** κελιά εγγραφής σε δύο πρότυπα. Η **ανάγνωση** έμεινε αντιγραμμένη. Λύση ίδιου σχήματος:
  `tenantReadCells(personas)`.

  **Γιατί ΔΕΝ έγινε τώρα**: αγγίζει **τρία κανονικά** matrices ⇒ δεκάδες συλλογές ⇒ απαιτεί
  **ολόκληρη** τη σουίτα (129 σουίτες / ~730s) για επικύρωση, όχι τις 8 της τρέχουσας δουλειάς.
  Πάνω από 1 ώρα με την επαλήθευση ⇒ N.0.2 «μεγάλο διπλότυπο» ⇒ εδώ.

  ⚠️ **Προϋπάρχει — ΔΕΝ το εισήγαγε το Α21.15** (το diff εκείνου είναι γραμμές 79-145).
  Άρα το `jscpd:diff` σε **αυτό** το αρχείο βγάζει κόκκινο ό,τι κι αν αγγίξεις:
  αν το CHECK 3.28 μπλοκάρει commit που το σταδιοποιεί, **αυτή** είναι η αιτία.

- 🟡 **08/09 — ΕΞΙ ΣΗΜΕΙΑ ΓΥΡΙΖΟΥΝ ΣΤΗ ΝΕΚΡΗ ΔΙΕΥΘΥΝΣΗ ΤΟΥ VERCEL** *(βρέθηκε στο **ADR-841 §7 Α21.11**, ψάχνοντας SSoT για την απόλυτη δημόσια διεύθυνση)*

  **Το μοτίβο**: `process.env.NEXT_PUBLIC_APP_URL ?? 'https://nestor-app.vercel.app'`

  **Πού** *(μετρημένα 2026-09-08)*: `app/api/alerts/schedule-check/route.ts` **×2** ·
  `app/api/attendance/qr/generate/route.ts` · `app/api/procurement/[poId]/share/route.ts` ·
  `app/api/first-contacts/guest/route.ts` *(παραλλαγή: `?? NEXT_PUBLIC_BASE_URL ?? ''`)* ·
  `api/notificationClient.ts` *(παραλλαγή: `NEXT_PUBLIC_DEV_URL || … || 'http://localhost:3000'`)*.

  **Γιατί μετράει**: το `CLAUDE.md` δηλώνει ρητά ότι το **Vercel είναι ΠΑΓΩΜΕΝΟ από 2026-05-09**
  και ότι το `nestor-app.vercel.app` είναι **νεκρό/legacy** — η παραγωγή είναι **Netcup /
  nestorconstruct.gr**. Άρα κάθε διαδρομή που πέφτει στο fallback *(δηλαδή όποτε λείπει η
  μεταβλητή)* στέλνει σε **ανθρώπους** — email ειδοποίησης, QR παρουσίας, σύνδεσμο
  παραγγελίας, πρόσκληση επισκέπτη — διεύθυνση που **δεν απαντά**. Σιωπηλά: κανένα σφάλμα
  πουθενά, απλώς σύνδεσμος που δεν ανοίγει.

  **Τι θα ήταν η λύση**: **ΕΝΑ** SSoT `lib/public-origin.ts` που απαντά *«ποια είναι η
  δημόσια διεύθυνσή μας;»* και **πετά** αντί να μαντέψει — το ιδίωμα του
  `buildPublicShelfKey`. Τρεις διαφορετικές αλυσίδες fallback σε 6 σημεία είναι **τρία
  δόγματα** για ένα ερώτημα.

  **Γιατί ΔΕΝ διορθώθηκε επιτόπου** *(N.0.2, «4+ αρχεία ⇒ καταγράφεται»)*: 6 αρχεία σε
  **τέσσερις** τομείς (ειδοποιήσεις · παρουσίες · προμήθειες · επισκέπτες), και η σωστή
  προεπιλογή είναι **απόφαση του Giorgio** — «πέτα» ή «nestorconstruct.gr».

  ⚠️ **Το Α21.11 ΔΕΝ πρόσθεσε έβδομο**: η πόρτα της βιτρίνας διαβάζει `window.location.origin`,
  που **δεν μπορεί να παλιώσει**. Η καταγραφή είναι το χρέος που **βρέθηκε**, όχι που έγινε.

- 🔴 **07/09 — Ο CLIENT ΣΥΜΠΙΕΣΤΗΣ ΠΑΡΑΓΕΙ ΠΑΝΤΑ JPEG, ΚΑΙ Η ΔΙΑΦΑΝΕΙΑ ΠΕΘΑΙΝΕΙ ΣΤΗ ΣΥΣΚΕΥΗ** *(βρέθηκε στο **ADR-841 §7 Α21.8.4** — το ελάττωμα **ΠΡΟΫΠΗΡΧΕ**, η Φάση 2 απλώς το έκανε ορατό)*

  **Πού**: `subapps/geo-canvas/floor-plan-system/parsers/raster/image-parser-compression.ts`
  → `canvas.toBlob(…, 'image/jpeg', quality)` — η **μόνη** έξοδος του συμπιεστή.

  🔴 **Το ελάττωμα**: το **JPEG δεν έχει κανάλι alpha**. Κάθε PNG με διαφάνεια που περνά
  από τον καμβά βγαίνει με **μαύρο** φόντο, **πριν καν φύγει από τη συσκευή**. Δεν είναι
  μορφοποίηση: το λογότυπο εταιρείας γίνεται **αγνώριστο** σε κάθε σκούρη επιφάνεια.

  🔴 **ΚΑΙ ΕΙΝΑΙ ΜΗ ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΟ** — χειρότερο από σταθερά λάθος: η συμπίεση ανάβει
  **μόνο** πάνω από το `maxSizeKB` του προφίλ (`photo-compression-config.ts`). Το **ίδιο**
  λογότυπο κρατά τη διαφάνειά του στα 700KB και τη χάνει στα 900KB — **χωρίς κανένα
  μήνυμα πουθενά**.

  **Ποιους αφορά** *(μετρημένο)*: `company-logo` · `business-card` · `avatar` ·
  `representative` — δηλαδή επαφές, λογότυπα εταιρειών και επαγγελματικές κάρτες. **Τρεις
  τομείς**, κανένας τους το ADR-841.

  ✅ **Το σήμα της Α21 ΔΕΝ επηρεάζεται**: η οθόνη περνά `enableCompression: false` και
  αφήνει τον **διακομιστή** να κάνει τη δουλειά (`sharp`, WebP lossless, preset icon, alpha
  διατηρημένο). Αυτό είναι **παράκαμψη για μία διαδρομή**, όχι θεραπεία.

  **Η θεραπεία**: `canvas.toBlob` με τύπο `image/webp` — υποστηρίζεται από κάθε σύγχρονο
  περιηγητή, κρατά alpha, και δίνει **μικρότερα** αρχεία στην ίδια ποιότητα.
  ⚠️ **Χρειάζεται άγκυρα που ΕΚΤΕΛΕΙ**: εικόνα με alpha μέσα, έλεγχος ότι το alpha
  **επιβιώνει** έξω. Ένα test που κοιτά μόνο τον τύπο MIME θα ήταν πράσινο για κώδικα που
  σβήνει τη διαφάνεια.
  ⚠️ Και **έλεγχος των καταναλωτών**: όποιος υποθέτει `.jpg` στο όνομα ή στο
  `FILE_TYPE_CONFIG` πρέπει να ρωτηθεί πρώτα.

  **Εκτίμηση**: ~1 αρχείο + άγκυρα, αλλά **4 τομείς να επαληθευτούν** ⇒ δικό του commit.

- 🔴 **06/09 — ΤΡΕΙΣ ΠΡΟΥΠΑΡΧΟΝΤΕΣ ΚΛΩΝΟΙ ΣΤΟ `customer-info` ΜΠΛΟΚΑΡΟΥΝ ΤΟ CHECK 3.28 ΣΕ ΚΑΘΕ ΑΓΓΙΓΜΑ** *(βρέθηκε στο **ADR-841 Α21.1** — **άσχετο με εκείνη τη δουλειά**)*

  🔑 **ΜΕΤΡΗΜΕΝΟ ΟΤΙ ΠΡΟΥΠΗΡΧΑΝ, ΟΧΙ ΥΠΟΘΕΣΗ**: οι ίδιοι 3 κλώνοι βγαίνουν τρέχοντας `jscpd`
  στα **ανάλλαχτα αρχεία του HEAD** (`git show HEAD:…`) — ίδια tokens, μετατοπισμένοι **2 γραμμές**.

  ⚠️ **Γι' αυτό είναι πρόβλημα**: το CHECK 3.28 εξετάζει τα **σταδιοποιημένα** αρχεία, οπότε
  **κάθε** μελλοντική αλλαγή σε αυτά τα δύο αρχεία — όσο μικρή κι αν είναι — **μπλοκάρει το
  commit**. Είναι **φόρος σε κάθε επόμενο**, όχι εφάπαξ εμπόδιο.

  | # | Πού | Τι είναι |
  |---|---|---|
  | Α | `CustomerInfoCompact.tsx` 275-286 ⇄ 322-333 | δύο **σκελετοί κατάστασης** (σφάλμα vs «κανένας πελάτης») — ίδιες παύλες, άλλο χρώμα |
  | Β | `CustomerInfoCompact.tsx` 374-383 ⇄ 388-397 | κελί **«τιμή ή παύλα»** — τηλέφωνο και email |
  | Γ | `UnifiedCustomerCard.tsx` 309-319 ⇄ 338-348 | 🔴 ο **κλικαριστός περιτυλιγμός** — `onClick`+`role`+`tabIndex`+**ολόκληρος ο `onKeyDown`** διπλασιασμένοι για δύο παραλλαγές |

  🔴 **Το Γ δεν είναι αισθητικό**: η **προσβασιμότητα με πληκτρολόγιο** ζει σε **δύο**
  αντίγραφα — διόρθωση στο ένα αφήνει το άλλο σπασμένο, σιωπηλά.

  **Γιατί ΔΕΝ διορθώθηκε τότε** *(N.0.2 — «μεγάλο διπλότυπο ⇒ καταγράφεται»)*: **τρεις
  διαφορετικές κλάσεις** εξαγωγής, σε οθόνες CRM **άσχετες** με τη βιτρίνα, που απαιτούν
  **οπτική επαλήθευση** — πράσινα tests δεν αποδεικνύουν απόδοση JSX.

  **Σειρά όταν πιαστεί**: πρώτα το **Γ** (σφάλμα προσβασιμότητας, μικρότερη εξαγωγή), μετά
  το **Β**, τελευταίο το **Α**. Μετά: `npm run jscpd:baseline`.

- 🟡 **07/09 — ΤΟ `ListingImage` ΕΞΥΠΗΡΕΤΕΙ ΔΥΟ ΤΟΜΕΙΣ ΜΕ ΟΝΟΜΑ ΕΝΟΣ** *(βρέθηκε **και δημιουργήθηκε** στο **ADR-841 Α21 Στάδιο 2** — κατά N.0.2 «4+ αρχεία ⇒ καταγράφεται»)*

  Το `ListingImage` *(`src/types/public-listing.ts`)* είναι `{url, width, height, altKey, sources}` —
  **καθαρό manifest δημοσιευμένης εικόνας**, χωρίς τίποτα ειδικό για αγγελία εκτός από **το όνομά του**.
  Από το Στάδιο 2 το εισάγει και το `DeclaredShowcaseMark` *(`types/agency-profile.ts`)*: **λογότυπο
  επαγγελματία με τύπο που λέει «Listing»**.

  🔑 **ΕΙΝΑΙ ΤΟ ΑΚΡΙΒΩΣ ΙΔΙΟ ΣΧΗΜΑ ΜΕ ΤΟ Ο-17**, που το ίδιο αυτό ADR έχει ήδη τιμωρήσει: το
  `PUBLISHED_MEDIA_LIMIT` κατοικούσε σε module με **όνομα ιδιώτη** ενώ εξυπηρετούσε **και** το γραφείο,
  και ο γραφέας του επαγγελματία εισήγαγε από `@/lib/owner-property/…` — *«πρόταση που δεν θα
  υπερασπιζόταν κανείς αν γραφόταν ρητά»*. Τώρα η ίδια πρόταση είναι
  *«το λογότυπο του υδραυλικού είναι `ListingImage`»*.

  ⛔ **ΑΠΟΡΡΙΦΘΗΚΕ: δεύτερος τύπος με ταυτόσημα πεδία** — θα ήταν δίδυμο *(N.18 / CHECK 3.28)* και θα
  γεννούσε **δεύτερο** `srcset` builder δίπλα στο `listingImageSrcSet`.
  ⛔ **ΑΠΟΡΡΙΦΘΗΚΕ ΚΑΙ: alias `export type { PublishedImage as ListingImage }`** — δύο ονόματα για το
  ίδιο πράγμα είναι ακριβώς το σχήμα του **ADR-749**.

  **Η δουλειά**: μετονομασία σε ουδέτερο `PublishedImage` / `PublishedImageSource`, σε ουδέτερο σπίτι.
  **Μετρημένο 07/09**: **14 αρχεία / 29 αναφορές** *(`ListingImage`)* **+ 6** *(`ListingImageSource`)*.

  **Γιατί ΔΕΝ έγινε τότε**: είναι **μηχανική μετονομασία μηδενικού ρίσκου**, αλλά μέσα στο diff του
  Σταδίου 2 θα ανακάτευε «μετονομασία» με «νέα λειτουργία» — δηλαδή θα ακύρωνε τον **λόγο** που ο
  Giorgio διάλεξε το χώρισμα σε δύο φάσεις *(«να μπορώ να το ελέγξω»)*. Θέλει **δικό της** commit.

- 🟡 **06/09 — ΤΕΣΣΕΡΙΣ ΙΔΙΩΤΙΚΕΣ ΜΗΧΑΝΕΣ HASH ΣΥΜΒΟΛΟΣΕΙΡΑΣ** *(βρέθηκε στο SSoT audit του **ADR-841 Α21.1** — **άσχετο με εκείνη τη δουλειά**, κατά N.0.2 «4+ αρχεία, άλλοι τομείς ⇒ καταγράφεται»)*

  **Τι έκλεισε ήδη** *(μην το ξαναπιάσεις)*: το FNV-1a του
  `src/lib/agency/agency-directory-order.ts` **εξήχθη** στο `src/lib/hash/fnv1a.ts` όταν
  απέκτησε δεύτερο καταναλωτή. Οι υπόλοιποι **δεν** αγγίχθηκαν.

  **Τι μένει** — τρεις ιδιωτικοί βρόχοι `charCodeAt`, ο καθένας με **δικές του**
  σταθερές, σε **τρεις διαφορετικούς τομείς**:

  | Πού | Τι ρωτά |
  |---|---|
  | `src/services/enterprise-id-deterministic.ts:23` | ντετερμινιστικό id από σπόρο |
  | `src/services/error-tracker-integrations.ts:128` | ομαδοποίηση (fingerprint) σφάλματος |
  | `src/services/contact-relationships/adapters/RelationshipCacheAdapter.ts:524` | κλειδί λανθάνουσας μνήμης |

  ⚠️ **ΜΗΝ τους ενώσεις βιαστικά.** Το `sha256.ts` έχει ήδη γραμμένο το μάθημα: *«ίδιο
  idiom, διαφορετική ερώτηση — η ενοποίησή τους θα ήταν **ψεύτικο SSoT**»*. Ένα
  ντετερμινιστικό **id** και ένα κλειδί **cache** έχουν διαφορετικές απαιτήσεις
  σταθερότητας: το πρώτο δεν επιτρέπεται να αλλάξει **ποτέ** (αλλιώς αλλάζουν
  αποθηκευμένα αναγνωριστικά), το δεύτερο επιτρέπεται ελεύθερα.

  **Το πραγματικό ερώτημα πριν από κάθε ενοποίηση**: *«ποιοι από τους τρεις έχουν
  αποτέλεσμα που ΕΧΕΙ ΑΠΟΘΗΚΕΥΤΕΙ κάπου;»* — αυτοί **δεν** μεταναστεύουν χωρίς
  μέτρηση. Οι υπόλοιποι γίνονται καταναλωτές του `lib/hash/fnv1a`.

- 🔴 **06/09 — Ο ΚΑΘΟΛΙΚΟΣ ΚΑΝΟΝΑΣ ΤΟΥ `globals.css` ΑΚΥΡΩΝΕΙ ΤΟ `truncate` ΣΕ ΚΑΘΕ ΕΠΙΚΕΦΑΛΙΔΑ ΚΑΡΤΑΣ** *(βρέθηκε στο ζωντανό περπάτημα του ADR-844 §11 — **άσχετο με αυτό**, απόφαση Giorgio: ξεχωριστή δουλειά με ADR + πύλη)*

  **Πού**: `src/app/globals.css:1694-1721` — τρία μπλοκ κάτω από το σχόλιο
  *«FIX TEXT WRAPPING ISSUE — NO MORE "ARROWS" FROM BROKEN WORDS»*.

  **Τι** *(μετρημένο στον φυλλομετρητή, 06/09)*:

  ```css
  [class*="card"] h1, h2, h3, [class*="CardTitle"], [class*="card-title"] {
    white-space: nowrap !important;  overflow: visible !important;
    text-overflow: clip !important;  word-break: keep-all !important;
  }
  .card .card-title, [data-radix-collection-item] *, *[role="heading"] { white-space: nowrap !important; }
  .card-header, .card .header, *[class*="CardHeader"] { min-width: max-content !important; }
  ```

  Επιλογέας **υποσυμβολοσειράς** στο `class` ⇒ το `bg-card` τον ενεργοποιεί. Το `!important`
  **ακυρώνει δύο από τα τρία** σκέλη του Tailwind `truncate` *(μένει το `nowrap`, φεύγουν το
  `overflow:hidden` και το `text-overflow:ellipsis`)* ⇒ ο τίτλος **ξεχειλίζει έξω από την κάρτα
  χωρίς «…»**, και ο αναγνώστης δεν έχει **καμία** ένδειξη ότι λείπει κείμενο.

  | Μέτρηση | Τιμή |
  |---|---|
  | Αρχική σελίδα: επικεφαλίδες σε αναγκαστικό `nowrap` | **7 από 9** |
  | Τίτλος αγγελίας `Διαμέρισμα 3 υπνοδωματίων στο κέντρο της Θεσσαλονίκης` | **381px σε κουτί 294px ⇒ +88px έξω, χωρίς αποσιωπητικό** |
  | Αρχεία με `CardTitle` / `CardHeader` | **188** / **198** |
  | Επικεφαλίδες που γράφουν ρητά `truncate` και το χάνουν | **13** |
  | `/contact/[token]` — ο τίτλος «Ο σύνδεσμος δεν λειτούργησε» | **375px: +16px** · 360px: +31px · 320px: +71px |

  🔴 **Γιατί επέζησε**: το `html`/`body` έχουν `overflow-x: hidden` ⇒ η υπερχείλιση κόβεται
  **σιωπηλά**, χωρίς οριζόντια μπάρα να το προδώσει. Και **καμία πύλη δεν το ελέγχει** — ούτε
  ratchet, ούτε test. Η οικογένεια 3.38/3.39/3.40 μετρά **αντίθεση**, όχι **διάταξη**.

  **Γιατί ΔΕΝ έγινε τώρα**: N.8 — καθολικό φύλλο με ακτίνα 386 αρχείων, 2+ τομείς.
  Ανακατεμένο μέσα στο ADR-844 θα έκρυβε ποιος το αποφάσισε. ⚙️ **Απόφαση Giorgio 06/09**:
  ξεχωριστό ADR + πύλη.

  **Τι να γίνει**:
  1. Διαγραφή των τριών μπλοκ. Το `truncate`/`whitespace-nowrap` είναι **εκούσια βοηθητική
     κλάση** — όποιος το θέλει το γράφει, όπως ήδη κάνουν 13 επικεφαλίδες.
  2. Η αρχική αιτία *(«relationship headers»)* παίρνει **τοπική** κλάση στα δικά της
     συστατικά — ο κανόνας γράφτηκε για **ένα** συμπτωμα και γενικεύτηκε σε όλη την
     εφαρμογή με επιλογέα υποσυμβολοσειράς.
  3. **Πύλη**: απαγόρευση `!important` σε `white-space`/`overflow`/`text-overflow`/`min-width`
     μέσα από **καθολικό** φύλλο με επιλογέα `[class*=...]`. ☠️ Το κρίσιμο στοίχημα: ο
     επιλογέας υποσυμβολοσειράς πιάνει και `scorecard`, `wildcard`, `discard`, `text-card-foreground`.
  4. ⚠️ **ΜΗΝ το «διορθώσεις» τοπικά στο `GuestContactContent`**: ένα `whitespace-normal` στο
     ένα `<h1>` αφήνει 187 κάρτες σπασμένες **και σβήνει το μοναδικό σύμπτωμα που
     το προδίδει**.

- 🔴 **06/09 — ΤΟ `text-muted-foreground` ΠΑΝΩ ΣΕ `bg-card` ΠΕΦΤΕΙ ΚΑΤΩ ΑΠΟ ΤΟ AA ΣΤΟ ΦΩΤΕΙΝΟ ΘΕΜΑ** *(βρέθηκε στη ΜΕΤΡΗΣΗ του ADR-844 §11.11 — **άσχετο με αυτό**· ίδια κλάση και ίδια απόφαση με το από πάνω: ξεχωριστό ADR + πύλη)*

  **Πού**: `src/app/globals.css:29` *(`--card: 213 92% 95%`)* × `:56` *(`--muted-foreground: 215.4 16.3% 46.9%`)*.
  Το σκοτεινό ζεύγος *(`:298` × `:320`)* είναι **μια χαρά** — το ελάττωμα έχει **ένα** θέμα.

  **Τι** *(μετρημένο δύο φορές, ανεξάρτητα, 06/09 — ζωντανά στον φυλλομετρητή **και**
  υπολογιστικά από τα ίδια τα tokens· οι δύο μέθοδοι συμφώνησαν στο **ίδιο δεκαδικό**)*:

  | Θέμα | `--muted-foreground` | `--card` | Αντίθεση | WCAG AA (14px) |
  |---|---|---|---|---|
  | **Φωτεινό** | `rgb(100,116,139)` | `rgb(231,241,254)` | **4,17 : 1** | ❌ **κόβεται στο 4,5** |
  | Σκοτεινό | `rgb(148,163,184)` | `rgb(29,40,58)` | **5,78 : 1** | ✅ |

  🔴 **Ποιο κείμενο πληρώνει**: στην οθόνη της απόδειξης είναι το
  `FirstContactAwaitingProof.tsx:107` — το `contact.guest.why` *(«Μέχρι τότε δεν έχει σταλεί
  τίποτα και δεν έμαθε κανείς για εσάς»)*. Το ίδιο το ADR-844 το ονομάζει **κείμενο οθόνης,
  όχι σχόλιο κώδικα**: χωρίς αυτό ο άνθρωπος κλείνει την καρτέλα νομίζοντας ότι το μήνυμα
  στάλθηκε. Είναι **η πιο κρίσιμη πρόταση της οθόνης** και είναι η **λιγότερο** ευανάγνωστη.
  Μαζί της πέφτουν τα `codeHint` και `resendHint`.

  🔴 **Γιατί επέζησε — και είναι το γνωστό σχήμα «το 0 σημαίνει ότι κανείς δεν κοίταξε»**:
  **καμία** από τις πέντε πύλες αντίθεσης δεν έχει αυτό το ζεύγος στη baseline της
  *(`grep muted-foreground` σε `.runtime-contrast-` · `.theme-pairing-` · `.text-primary-` ·
  `.theme-classes-` · `.css-token-authority-baseline.json` ⇒ **0 σε πέντε στα πέντε**)*.
  ⚠️ **Και δεν είναι ότι δεν το βλέπουν**: το `check-runtime-contrast-ratchet.test.js:275`
  απαιτεί ρητά `expect(Object.keys(propsOf('light'))).toContain('--muted-foreground')` —
  δηλαδή η τιμή είναι **στο χέρι της πύλης**. Απλώς η πύλη ρωτά **μόνο** για το
  `colors.text.primary × --card` *(ADR-770, Ρ3.1/Ρ3.2)*. Η τιμή υπάρχει· **η ερώτηση λείπει**.

  **Γιατί ΔΕΝ έγινε τώρα**: N.8 — **1.576 εμφανίσεις σε 585 αρχεία** *(`text-muted-foreground`)*,
  164 αρχεία με `bg-card`. Καθολικό token με ακτίνα ολόκληρης της εφαρμογής, 2+ τομείς.
  Ανακατεμένο μέσα στο ADR-844 θα έκρυβε ποιος το αποφάσισε.

  **Τι να γίνει**:
  1. **Η αριθμητική είναι μικρή, η ακτίνα δεν είναι**: `--muted-foreground` από
     `215.4 16.3% 46.9%` σε **`44.6%`** δίνει **4,55** *(οριακό AA)*· το **32,9%** δίνει
     **7,0** *(AAA)*. ⚠️ Το «οριακό» είναι παγίδα — ένα κλικ πιο σκούρο σβήνει την
     **ιεραρχία** που ο δευτερεύων τόνος υπάρχει για να δηλώνει. Η απόφαση είναι
     **σχεδιαστική**, όχι αριθμητική: ή σκουραίνει το κείμενο, ή **λευκαίνει η κάρτα**
     *(το `--card: 213 92% 95%` είναι γαλάζιο «ENTERPRISE», όχι λευκό — και εκεί χάνεται
     ένα μέρος της αντίθεσης)*.
  2. **Πύλη**: το ζεύγος `--muted-foreground × --card` να μπει ως **ερώτηση** στο
     CHECK 3.40, δίπλα στο υπάρχον `text.primary × --card`. Η τιμή είναι ήδη
     διαθέσιμη — προστίθεται κριτήριο, όχι μηχανή.
  3. ☠️ **Το κρίσιμο στοίχημα της πύλης**: το κατώφλι εξαρτάται από το **μέγεθος**
     *(4,5 για κανονικό, 3,0 για ≥24px ή ≥18,66px bold)*. Πύλη που ελέγχει μόνο ζεύγη
     χρωμάτων θα κοκκινίζει ψευδώς σε κάθε μεγάλη επικεφαλίδα. Η λεζάντα των πάνελ
     είναι **12px** — δηλαδή **κάτω** από το κανονικό, όχι πάνω.
  4. ⚠️ **ΜΗΝ το «διορθώσεις» τοπικά** βάζοντας `text-foreground` στο `why`: αφήνει
     τα άλλα 1.575 σημεία σπασμένα **και σβήνει το σύμπτωμα** — ακριβώς το λάθος που
     ο γείτονας από πάνω περιγράφει με 187 κάρτες.

- 🔶 **04/09 — ΤΟ Escape ΤΟΥ «ΠΡΟΣΘΕΣΕ ΝΕΟ» ΚΛΕΙΝΕΙ ΚΑΙ ΤΟ POPOVER** *(ADR-841 §7 Α19.4, δηλωμένο)*

  **Πού**: `src/components/ui/searchable-combobox-add-new.tsx:87`.

  **Τι**: ο χειριστής του `Escape` ακυρώνει το πρόχειρο κείμενο αλλά **δεν καλεί
  `stopPropagation()`** ⇒ το ίδιο πάτημα κλείνει **και** το popover. Το δηλωμένο precedent του
  μητρώου *(`use-numeric-field.ts`, ADR-706)* ορίζει ρητά το αντίθετο — **δισταδιακή** σημασιολογία
  *(Figma / VS Code / Revit)*: πρώτο ESC ακυρώνει το πρόχειρο, δεύτερο κλείνει το δοχείο.

  **Γιατί ΔΕΝ έγινε τώρα**: είναι **προϋπάρχουσα** συμπεριφορά — ο ίδιος χειριστής ζούσε
  αυτούσιος μέσα στο `searchable-combobox.tsx`. Η διάσπαση του Α19.4 τον **μετακόμισε**, και
  νέο αρχείο = μηδενική ανοχή ⇒ η πύλη **ξαναρώτησε ερώτηση που είχε ήδη απαντηθεί**.
  Αλλαγή συμπεριφοράς μέσα σε refactor θα έκρυβε το ποιος την αποφάσισε.

  **Τι να γίνει**: απόφαση προϊόντος — ή (α) `stopPropagation()` όσο υπάρχει πρόχειρο
  *(ακριβώς όπως το `use-numeric-field.ts`)*, ή (β) ρητή δήλωση ότι εδώ **θέλουμε** μονοσταδιακό.
  ⚠️ **Η σιωπή είναι το πρόβλημα**: το μητρώο γράφει τον κανόνα, και αυτό το σημείο
  τον παραβιάζει χωρίς να το λέει.

- 🔶 **04/09 — Η ΑΙΤΙΟΛΟΓΗΣΗ ΤΟΥ ADR-813 ΕΠΑΨΕ ΝΑ ΙΣΧΥΕΙ** *(ADR-843 §10.17, μετρημένο)*

  **Πού**: `scripts/_shared/firebaseAdminOps.js` — η κεφαλίδα του.

  **Τι**: το ADR-813 δικαιολογεί τη **δεύτερη** υλοποίηση του `loadServiceAccount` με το
  επιχείρημα *«ο κανονικός επιλυτής είναι TypeScript με `import 'server-only'` — ένα CJS
  ops script **δεν μπορεί** να τον εισαγάγει χωρίς μεταγλώττιση»*. Από τις 04/09 αυτό
  **δεν είναι αλήθεια**: με `NODE_OPTIONS=--conditions=react-server` *(ο δηλωμένος από τον
  κατασκευαστή μηχανισμός του πακέτου)* ένα `tsx` script εισάγει **οποιοδήποτε**
  `server-only` module — μετρημένο ζωντανά στο `backfill-first-contact-offerer.ts`.

  **Γιατί ΔΕΝ έγινε τώρα**: η δεύτερη υλοποίηση **παραμένει σωστή** ως ops SSoT και έχει
  δικές της άγκυρες (`ops-firebase-admin.test.js`)· το λάθος είναι **η αιτιολόγηση**, όχι
  ο κώδικας. Η ενοποίηση αγγίζει **κάθε** ops script και θέλει δική της απόφαση.

  **Τι να γίνει**: ή (α) διόρθωση της κεφαλίδας ώστε ο λόγος να είναι ο **αληθινός**
  *(«τα ops scripts μένουν CJS επίτηδες»)* — φθηνό, τίμιο· ή (β) μετανάστευση σε έναν
  εκκινητή. ⚠️ **Μια αιτιολόγηση που έπαψε να ισχύει είναι χειρότερη από καμία**: πείθει
  τον επόμενο να μην ψάξει.

  🔑 **Σχετικό, ήδη διορθωμένο**: το `server-only` ήταν **αδήλωτη εξάρτηση** — **556**
  αρχεία του `src/` το εισάγουν και το `package.json` δεν το ανέφερε πουθενά (δούλευε
  μόνο χάρη σε webpack alias του Next). Δηλώθηκε 04/09 (`server-only@0.0.1`, MIT, N.5 ✓).

  🔴 **ΚΑΙ ΚΑΠΟΙΟΣ ΤΟ ΕΙΧΕ ΔΕΙ — ΤΟ ΣΩΠΑΣΕ ΑΝΤΙ ΝΑ ΤΟ ΔΗΛΩΣΕΙ**: το `knip.json` το είχε
  ήδη στο `ignoreDependencies`. Δηλαδή η πύλη νεκρού κώδικα **το ανέφερε**, και η
  απάντηση ήταν *«μη μου το λες»* αντί για *«πρόσθεσέ το»*. Η καταχώρηση είναι πλέον
  **περιττή** *(η εξάρτηση δηλώνεται και χρησιμοποιείται)* — αδρανής, αβλαβής, αλλά
  αδρανής. ⚠️ **Αφέθηκε επίτηδες**: αφαίρεση από αρχείο που ελέγχει πύλη θέλει δικό της
  τρέξιμο της πύλης, όχι πέρασμα στο πλάι άλλης δουλειάς.

  ⚠️ **Και το μάθημα είναι γενικότερο από το πακέτο**: μια σιωπηλή λίστα εξαιρέσεων
  είναι ο τόπος όπου πάνε να πεθάνουν τα ευρήματα. Πριν προσθέσεις όνομα σε
  `ignore*`, ρώτα αν το εύρημα ήταν **σωστό** — εδώ ήταν, επί μήνες.

- 🔶 **05/09 — `find(isPrimary) ?? [0]`: ΤΟ SSoT ΕΓΙΝΕ· ΜΕΝΟΥΝ ~25 ΣΗΜΕΙΑ** *(ADR-332 **D24**)*

  ✅ **Έγινε**: `lib/primary-entry.ts` (`primaryOrFirst`) + **5** μεταναστεύσεις — τα 3
  ονομασμένα σημεία, **και 2 ΔΙΟΡΘΩΣΕΙΣ ΣΦΑΛΜΑΤΟΣ** στον `hierarchy-resolver`. Το
  `primaryEmailOf` είναι ο **πρώτος καταναλωτής** (δεν μπορεί να είναι νεκρό).
  **16/16** άγκυρα · **430/430** regression · **2/2** μεταλλάξεις κόκκινες.

  🔴 **ΔΥΟ ΔΙΟΡΘΩΣΕΙΣ ΣΤΟ ΠΕΡΑΣΜΑ, ΟΧΙ ΜΟΝΟ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ**: `extractPrimaryEmail` και
  `extractPrimaryPhone` έπεφταν σε `list[0]?.x ?? null` **χωρίς έλεγχο κενού** ⇒ επαφή με
  `{ email: '' }` επέστρεφε `''`, που **δεν είναι `null`** και περνούσε κάθε φρουρό
  «υπάρχει;» μέχρι τον πάροχο. **Διαδρομή ειδοποιήσεων.** Η παγίδα ήταν **ήδη γραμμένη**
  στην κεφαλίδα του `primaryEmailOf` — κανείς δεν είχε συνδέσει τα δύο σημεία.
  🔑 **Ένα SSoT που δεν το καλεί κανείς είναι τεκμηρίωση, όχι φρουρός.**

  🔴 **ΔΥΟ ΔΙΟΡΘΩΣΕΙΣ ΚΑΙ ΣΤΟ ΙΔΙΟ ΤΟ BACKLOG**, γιατί και οι δύο θα παραπλανούσαν:

  1. **Ο αριθμός ήταν «τρία»· είναι ~30.** Όσα είχε μπροστά της μία συνεδρία, όχι όσα
     υπάρχουν — το σχήμα που ο **N.12** ονομάζει. **Άνοιξε και μέτρα.**
  2. **Έγραφε «η σωστή αφαίρεση είναι ΓΕΝΙΚΗ». ΛΑΘΟΣ** — είναι **τρεις** ερωτήσεις:
     «κύριο **ή πρώτο**» ✅ · «κύριο **που είναι χρήσιμο**» ⚠️ *(συντίθεται: φιλτράρεις
     πρώτα)* · «κύριο **αυστηρά**, κενό = καμία» ⛔ *(**ΠΟΤΕ** fallback — σε μερικά σημεία
     το «δεν ξέρω» είναι η **σωστή** απάντηση)*. Μια αφαίρεση που τις κατάπινε θα άλλαζε
     συμπεριφορά **σιωπηλά**.

  🔶 **Μένουν ~25**, τα περισσότερα κάτω από `services/ai-pipeline/` όπου **κάθε** άγγιγμα
  ενεργοποιεί τον **N.10** (77 σουίτες) — ίδιος λόγος αναβολής με το ADR-777 §8.33.
  **Καλούν τον `primaryOrFirst` όταν τα αγγίξεις για άλλο λόγο** (N.0.2 Boy Scout).


- 🔴 **05/09 — Η ΑΦΕΤΗΡΙΑ ΤΟΥ D23 ΕΙΝΑΙ **ΑΔΡΑΝΗΣ**, ΟΧΙ ΑΠΛΩΣ ΑΦΥΛΑΚΤΗ** *(ADR-332 **D24**)*

  ✅ **Η άγκυρα γράφτηκε** (`building-addresses-card-project-anchor.test.tsx`) — αλλά
  γράφοντάς την βρέθηκε ότι το ζητούμενο *«ο editor λαμβάνει **μη-κενό**
  `projectAddresses`»* είναι **δομικά αδύνατο σήμερα**:

  | | ο συντάκτης ανοίγει; | `projectAddresses` |
  |---|---|---|
  | **με** έργο | ❌ **ποτέ** — και τα **τρία** χειριστήρια πίσω από `!hasProject` | γεμάτο, **αόρατο** |
  | **χωρίς** έργο | ✅ ναι | **πάντα `[]`** *(ο hook το αδειάζει)* |

  ⇒ Οι δύο συνθήκες είναι **αμοιβαία αποκλειόμενες**. Το `addressListCenter(projectAddresses)`
  του συντάκτη επιστρέφει **πάντα `null`**. **Δεν χρειάζεται να τη σβήσει κανείς — ήδη δεν
  κάνει τίποτα** (σχήμα ADR-749).

  ⛔ **ΔΕΝ διορθώθηκε από πράκτορα, επίτηδες**: η θεραπεία απαντά στο *«επιτρέπεται
  χειροκίνητη διεύθυνση σε κτίριο που ανήκει σε έργο;»* — **απόφαση προϊόντος, για τον
  Giorgio**. Η άγκυρα φυλάει **το πέρασμα** *(πίνακας, ποτέ `undefined`)* και **δηλώνει**
  το κενό: κοκκινίζει την ημέρα που κάποιος κάνει τον συντάκτη προσβάσιμο με έργο.

  **Τι θέλει απόφαση**: (α) χειριστήριο «προσθήκη χειροκίνητης» και στον κλάδο του έργου —
  τότε η αφετηρία ζωντανεύει· ή (β) ρητή δήλωση ότι κτίριο με έργο **δεν** δέχεται
  χειροκίνητη διεύθυνση — τότε η prop **αφαιρείται** ως νεκρή.


- 🔴 **03/09 — Ο ΤΥΠΟΣ ΛΕΕΙ ΨΕΜΑΤΑ: Η ΚΑΝΟΝΙΚΟΠΟΙΗΣΗ ΔΕΝ ΕΦΤΑΣΕ ΣΤΟ ΣΥΝΟΡΟ ΑΝΑΓΝΩΣΗΣ**
  *(ADR-842 §8 #11, άνοιξε στο §7.6.11)*

  **Τι**: τα `OwnerProperty.type` και `PublicListing.type` δηλώνονται `PropertyType` — την
  **ευρεία** ένωση, που περιλαμβάνει `DEPRECATED_PROPERTY_TYPES` και `LegacyGreekPropertyType`.
  Το §7.6.11 έκανε τον κριτή **έναν και δυνατό** (`constants/property-classification.ts`),
  αλλά όσο ο τύπος είναι ευρύς, **κάθε** καταναλωτής οφείλει να **θυμηθεί** τον σωστό κριτή
  και **τίποτε δεν ελέγχει ότι το έκανε**. Ένα σκέτο `type === 'plot'` αύριο είναι πάλι το
  ίδιο ελάττωμα, χωρίς ο μεταγλωττιστής να έχει λόγο να διαμαρτυρηθεί. Ίδια ρίζα με το
  `public-listing-projection.ts:328` — `(property.type ?? 'apartment') as PropertyType`.

  **Fix**: *canonicalization at the read boundary* — το `type` κανονικοποιείται **μία φορά**
  στην είσοδο του τομέα, οι τύποι οντοτήτων στενεύουν σε `PropertyTypeCanonical`, και ο
  μεταγλωττιστής (όχι άγκυρα) αποδεικνύει ότι καμία legacy τιμή δεν φτάνει πουθενά. Μετά:
  backfill και **αφαίρεση** του legacy λεξιλογίου από την ένωση.

  ✅ **Είναι εφικτό, μετρημένο**: **και οι δύο** πύλες γραφής είναι ήδη κλειστές
  (`owner-property-draft-schema.ts` → `z.enum(PROPERTY_TYPES)` · `property-mutation-gateway.ts:164`
  → `normalizePropertyType` + throw) ⇒ το legacy λεξιλόγιο είναι **ιστορικό και δεν
  μεγαλώνει**, άρα ο δρόμος **τελειώνει** αντί να ζει «επ' αόριστον».

  ⚠️ **Μέγεθος**: `types/owner-property.ts` · `types/public-listing.ts` *(διαβάζονται από ~46
  αρχεία)* · δημόσια προβολή · διαδρομές ανάγνωσης ⇒ **2+ τομείς, N.8, χωριστή εντολή**.
  ⛔ **Όχι σε μοιρασμένο δέντρο.**

- 🔴 **03/09 — Η ΓΗ ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΠΕΙ ΤΟ ΣΗΜΑΝΤΙΚΟΤΕΡΟ ΠΟΥ ΕΧΕΙ** *(ADR-842 §8 #8, μετρημένο)*

  **Τι**: το **δικαίωμα δόμησης** (Σ.Δ. · κάλυψη · άρτιο/οικοδομήσιμο · εντός/εκτός σχεδίου)
  και οι **παροχές/πρόσβαση** (ρεύμα · νερό · αποχέτευση · πρόσοψη σε δρόμο) **δεν υπάρχουν**
  ούτε στα 8 πεδία του `OwnerProperty` ούτε στα 27 του `PublicListing`.

  **Πόσο**: και στις **τρεις** πηγές της έρευνας (CRMLS Land form/Zillow · idealista ·
  Spitogatos) αυτά είναι τα **κορυφαία** πεδία μιας αγγελίας γης. Ζωντανά: **5** έγγραφα
  `plot`, όλα χωρίς πού να τα γράψουν.

  **Γιατί ΔΕΝ έγινε τώρα**: δεν είναι νέα βάρη — είναι **νέα πεδία** (μοντέλο + κρίκος σχήματος
  + φόρμα + i18n + προβολή + δημόσια οθόνη), και σηκώνει απόφαση προϊόντος: *«ποια είναι
  **δήλωση κατόχου** και ποια **έγγραφο μηχανικού»;* — δηλαδή `declared` ⇄ `measured` της Φ2
  στην πιο εμπορικά κρίσιμη μορφή της.

  **Fix**: πεδία γης στο `OwnerProperty` + κρίκος στο `PublicListing` + γραμμές στο
  `LAND_MATRIX` (σήμερα 4 πεδία / παρονομαστής 8,0 — το ταβάνι όσο λείπουν).

- 🔶 **03/09 — ΞΕΝΟ ΚΟΚΚΙΝΟ ΣΤΟ MAIN: σχήμα 7, test καρφωμένο στο 6**

  **Τι**: `src/lib/listings/__tests__/listing-levels-provenance.test.ts:110` απαιτεί
  `LISTING_MIGRATIONS.at(-1)?.to === 6`· το `2d7f481c` (*«A15 — krikos 7»*) το ανέβασε σε **7**
  χωρίς να ενημερώσει την άγκυρα.

  **Γιατί ΔΕΝ έγινε τώρα**: ξένη ενεργή περιοχή — το `public-listing-schema.test.ts` είναι
  **τροποποιημένο στο working tree** άλλης συνεδρίας τη στιγμή της μέτρησης.

- 🔴 **02/09 — 148 ΣΦΑΛΜΑΤΑ ΤΥΠΩΝ ΑΠΟ **ΜΙΑ** ΛΕΞΗ ΠΟΥ ΛΕΙΠΕΙ** *(ADR-801, μετρημένο)*

  **Τι**: το `lib/auth/roles.ts:125` πάγωσε την SSoT
  (`ADMINISTRATIVE_ROLES: readonly GlobalRole[] = Object.freeze(...)`, **2026-08-25**,
  `3c9e45067`) — **σωστά**. Το σύνορο όμως, `lib/auth/middleware.ts:68`, δηλώνει
  `requiredGlobalRoles?: GlobalRole | GlobalRole[]` — **mutable**. Ο καταναλωτής
  (γρ. 155-162) **μόνο διαβάζει** (`.includes`, `.join`).

  **Πόσο**: **148 από τα 443** σφάλματα του `npm run typecheck` (33%), σε **89** αρχεία
  διαδρομών API. Λύνονται με **μία** λέξη: `readonly GlobalRole[]` στη γραμμή 68.

  **Γιατί ΔΕΝ έγινε τώρα**: `lib/auth/**` είναι ξένη περιοχή γι' αυτό το handoff (§7),
  και μια αλλαγή υπογραφής στο **σύνορο εξουσιοδότησης** θέλει τις άγκυρες του
  **CHECK 3.68** (μητρώο εξουσιοδότησης, ADR-801) στο ίδιο commit.

- 🔴 **02/09 — ΤΟ `npm run typecheck` ΔΕΝ ΤΡΕΧΕΙ ΣΤΟ ΠΡΟΕΠΙΛΕΓΜΕΝΟ HEAP** *(υποδομή)*

  **Τι**: πεθαίνει σε `FATAL ERROR: JavaScript heap out of memory` μετά από **~290s**
  στα 4 GB. Χρειάζεται `NODE_OPTIONS=--max-old-space-size=8192`.

  **Γιατί έχει σημασία**: όποιος το έτρεξε τους τελευταίους μήνες **δεν πήρε λίστα
  σφαλμάτων** — πήρε κατάρρευση. Είναι η πιθανότερη εξήγηση για το ότι **443** σφάλματα
  έμειναν αόρατα, και το ίδιο ισχύει για το CI αν τρέχει με προεπιλογές.

  **Fix**: `"typecheck": "next typegen && node --max-old-space-size=8192 node_modules/typescript/bin/tsc --noEmit"`
  *(ή `NODE_OPTIONS` στο workflow)* — **και** άγκυρα που εκτελεί την εντολή, αλλιώς
  ξαναπαλιώνει σιωπηλά.

- 🔴 **02/09 — ΤΑ ΑΡΧΕΙΑ TEST ΔΕΝ ΤΥΠΟΕΛΕΓΧΟΝΤΑΙ **ΠΟΥΘΕΝΑ**** *(υποδομή, μετρημένο)*

  **Τι**: το `tsconfig.json` εξαιρεί `src/**/__tests__/**` · `*.test.ts(x)` · `*.spec.*`,
  και **κανένα** άλλο tsconfig του repo δεν τα συμπεριλαμβάνει. Το jest μεταγλωττίζει με
  **swc** (μηδέν έλεγχος τύπων).

  **Γιατί έχει σημασία**: κάθε fixture μπορεί να λέει ψέματα για το σχήμα **χωρίς
  κανέναν να το δει** — ακριβώς το εύρημα Β4 αυτού του handoff. Και σημαίνει ότι η
  συνταγή *«τυποποίησε το fixture ώστε ο μεταγλωττιστής να απαιτεί το σχήμα»* είναι
  **δομικά ανέφικτη** σήμερα: δεν υπάρχει μεταγλωττιστής που να κοιτά.

  **Fix**: `tsconfig.tests.json` που *τα* συμπεριλαμβάνει + πύλη CI **ratchet** (ποτέ
  zero-tol με τη μία — ο αριθμός των σημερινών σφαλμάτων είναι **άγνωστος**).

- 🔴 **02/09 — ~20 ΩΜΑ `as OwnerProperty` ΣΕ ΕΓΓΡΑΦΑ FIRESTORE** *(ADR-832 · ADR-841, N.0.2)*

  **Τι**: `snap.data() as OwnerProperty` σε **~20** θέσεις παραγωγής (`mandate/**` ×11,
  `listings/rebuild-public-listings` ×2, `demand/**` ×2, `owner-property-write` ×2, …).
  Ο τύπος δηλώνει **τρία** πεδία-συλλογές υποχρεωτικά (`mandates` · `offers` · `media`)·
  η βάση **δεν χρωστά** κανένα.

  **Τι έγινε ήδη**: `mandatesOf` (ADR-832) και τώρα `mediaOf` (εδώ). **Μένει το
  `offers`**: το `types/owner-property.ts:503` κάνει `for (const offer of property.offers)`
  **αφύλακτο**, και το `lib/owner-property/owner-property-form-values.ts:350-378` διαβάζει
  `property.offers` **και** `property.media` ωμά.

  **Γιατί ΔΕΝ έγινε τώρα**: προσπελαστής `offersOf` **χωρίς καταναλωτή που να τον
  χρειάζεται αποδεδειγμένα** θα ήταν *φρουρός χωρίς απόδειξη ζωής* (ADR-749 §5) — θέλει
  πρώτα μέτρηση στα ζωντανά έγγραφα, όπως έγινε για το `media`. Και τα `mandate/**`
  είναι ξένη περιοχή.

  **Fix**: μέτρηση «πόσα `owner_properties` δεν έχουν `offers`» → `offersOf` + πύλη που
  απαγορεύει **άμεση** ανάγνωση `.media` / `.offers` / `.mandates` έξω από τους
  προσπελαστές (μοτίβο CHECK 3.61, σύνορο).

- 🔶 **02/09 — ΤΟ ΤΡΙΤΟ ΔΙΠΛΟΤΥΠΟ ΑΝΑΛΥΣΗΣ ΔΙΕΥΘΥΝΣΗΣ ΜΕΝΕΙ** *(ADR-777 §8.47, N.0.2)*

  **Τι**: `services/ai-pipeline/invoice-auto-enrichment.ts:292` έχει inline
  `parseAddressField` — **τρίτη** ευρετική ανάλυσης ελληνικής διεύθυνσης, με δικό της
  σχήμα Τ.Κ. (`/^(\d{5})\s+(.+)/`, **μόνο** «Τ.Κ. μετά πόλη») και **καμία** γραμματική
  αριθμού. Οι άλλες δύο ενοποιήθηκαν στο **`utils/address/address-parse`**
  *(`parseGreekAddress` και το κατά λέξη αντίγραφό της `splitStreetNumber` στο
  `api/contacts/resolve`)*.

  **Γιατί έχει σημασία**: ό,τι μαθαίνει ο κεντρικός αναλυτής — εύρος «8-10», γράμμα
  «234Α», η παγίδα «25ης Μαρτίου 12», η **μέγιστη** συστάδα ψηφίων που εμποδίζει τον Τ.Κ.
  να κλέψει τον αριθμό της οδού — **δεν φτάνει εδώ**. Και είναι η μία από τις τρεις που
  τροφοδοτεί **εγγραφή σε επαφή** (αυτόματος εμπλουτισμός τιμολογίου), δηλαδή η αστοχία
  γράφεται, δεν εμφανίζεται.

  **Γιατί ΔΕΝ έγινε τώρα**: η είσοδός της **δεν είναι γραμμή διεύθυνσης** — είναι μπλοκ
  OCR με ετικέτα (`Οδός: …`). Η ενοποίηση απαιτεί να αποφασιστεί **πού κόβεται η ετικέτα
  από την τιμή**, που είναι ερώτηση **του αγωγού ΤΝ**, όχι της ανάλυσης· και το αρχείο
  ανήκει σε άλλο τομέα (ADR-171) με δικές του άγκυρες.

  **Fix**: `extractPostalCode` + `splitStreetAndNumber` από το `address-parse` **μετά** την
  αφαίρεση της ετικέτας, + άγκυρα στο `invoice-auto-enrichment` για «Οδός: 25ης Μαρτίου 12,
  546 25» *(που σήμερα δίνει λάθος Τ.Κ. και μηδέν αριθμό)*.

- 🔶 **02/09 — Η ΜΗΧΑΝΗ ΠΛΗΡΟΤΗΤΑΣ ΣΥΓΧΕΕΙ ΤΟ «ΑΠΑΝΤΗΣΕ: ΚΑΜΙΑ» ΜΕ ΤΟ «ΔΕΝ ΡΩΤΗΘΗΚΕ»** *(ADR-842 Φ5)*

  **Τι**: `constants/property-completion.ts` κρίνει με `isArrayComplete` (`length > 0`) και
  `isPositiveNumber` (`> 0`). Άρα `securityFeatures: []` (*ο κάτοχος **απάντησε** «καμία»*),
  `wc: 0`, `balconies: 0`, `bedrooms: 0` (*γκαρσονιέρα*) βαθμολογούνται **όλα ως έλλειψη** —
  ενώ η **λογιστική** της Φ3 τα μετρά, σωστά, ως **δηλωμένα**.

  **Γιατί έχει σημασία**: το coaching ζητά από τον άνθρωπο να **ξαναπεί κάτι που είπε** —
  ακριβώς ο κανόνας που το ADR-842 §7.4 ονομάζει για τη λογιστική. Αφορά **εξίσου** την
  εταιρική διαδρομή, από το ADR-287 και **πριν** από τη Φ5.

  **Γιατί ΔΕΝ έγινε τώρα** *(και γιατί ο μεταφραστής της Φ5 ΔΕΝ το «διόρθωσε» στην είσοδο)*:
  1. Ένα `isArrayComplete([]) === true` θα μετρούσε ως **πλήρες** κάθε **άθικτο** multi-select
     της εταιρικής φόρμας (αρχικοποιείται σε `[]`) ⇒ **φούσκωμα του ποσοστού κάθε ακινήτου
     της εταιρείας, αναδρομικά**.
  2. Για το `wc: 0` **δεν υπάρχει** τίμια κωδικοποίηση στην είσοδο: κάθε αριθμός θα ήταν ψέμα
     για την τιμή. Θεραπεία της μισής κλάσης αφήνει την άλλη μισή **αόρατη**.
  3. Παράκαμψη μέσω της εισόδου θα ήταν **δεύτερη σημασιολογία πληρότητας**, δηλαδή το
     ADR-842 **Α5** παραβιασμένο από την πίσω πόρτα.

  **Fix**: ξεχωριστό ADR — τρίτη κατάσταση **στη μηχανή** (`answered` vs `absent`) αντί για
  έλεγχο αληθοφάνειας, με μετρημένο τον αντίκτυπο στον παρονομαστή **κάθε** τύπου. Η απόκλιση
  είναι **δηλωμένη σε άγκυρα** σήμερα (`listing-completion-slice.test.ts`), ώστε η μέρα που θα
  αλλάξει να **κοκκινίσει** αντί να περάσει σιωπηλά.

- 🔶 **02/09 — ΔΕΚΑΤΡΕΙΣ ΧΕΙΡΟΓΡΑΦΟΙ TYPE GUARDS ΓΙΑ ΤΟ ΙΔΙΟ ΕΡΩΤΗΜΑ** *(ADR-842 Φ3, εντοπίστηκε στο SSoT audit της προβολής χαρακτηριστικών)*

  **Τι**: το repo απαντά *«ανήκει αυτή η τιμή στο λεξιλόγιο;»* με **χειρόγραφο type guard
  ανά λεξιλόγιο**, όλοι με **ταυτόσημο σώμα** `(X as readonly string[]).includes(value)`:
  `constants/commercial-statuses.ts:157` · `constants/operational-statuses.ts:99` ·
  `constants/project-statuses.ts:80` · `constants/professional-registries.ts:204` ·
  `lib/mandate/mandate-actions.ts:36,109` · `lib/oauth/oauth-config.ts:56` ·
  `lib/ownership/landowner-acquisition.ts:58` · `utils/floor-naming.ts:45` ·
  `lib/firestore-mappers.ts:50,54,172,176`. **Δεκατρείς** εμφανίσεις, καμία κοινή μηχανή.

  **Γιατί το βρήκα**: η Φ3 χρειάστηκε **δεκατρείς ακόμη** για τα λεξιλόγια χαρακτηριστικών.
  Γραμμένοι στο ίδιο ύφος θα ήταν **δίδυμοι κλώνοι μέσα στο ίδιο commit** (N.18). Αντ' αυτού
  γράφτηκε **ένας γενικός** (`vocabularyValue` στο `services/listings/public-listing-attributes.ts`)
  — άρα το νέο χρέος είναι **μηδέν**, αλλά το παλιό μένει.

  **Γιατί ΔΕΝ έγινε τώρα**: 13 αρχεία × 4 τομείς (constants · lib · utils · firestore mappers),
  με **43 σημεία κλήσης** που εξαρτώνται από τη στένωση τύπου (`value is XType`). Είναι N.0.2
  «μεγάλο διπλότυπο (>1h, 4+ αρχεία)» ⇒ pending, όχι πέρασμα άλλου παραδοτέου.

  **Fix**: SSoT `isMemberOf<T extends string>(vocabulary: readonly T[], value: unknown): value is T`
  σε `utils/` (ή `constants/vocabulary-membership.ts`), οι 13 γίνονται λεπτά περιτυλίγματα που
  **κρατούν το όνομά τους** (μηδέν αλλαγή στα σημεία κλήσης — ίδιο πρότυπο με το `X_OPTIONS` της
  ADR-842 Φ1). Μετά: `npm run jscpd:baseline`.

- 🔶 **02/09 — ΟΙ ΠΑΡΟΧΕΣ ΦΕΥΓΟΥΝ ΩΜΕΣ ΣΕ PDF · EMAIL · TELEGRAM** *(ADR-842 Φ3, μετρημένο στο ίδιο audit)*

  **Τι**: το `services/property-showcase/snapshot-field-builders.ts:250-256` (`buildFeatures`)
  μεταφράζει `interiorFeatures` και `securityFeatures` μέσω του
  `services/property-enum-labels/property-enum-labels.service.ts`, αλλά για τα **`propertyAmenities`
  δεν υπάρχει `translateAmenities`** — ο πίνακας φεύγει **αμετάφραστος**. Ο παραλήπτης της βιτρίνας
  διαβάζει `parking-garage` · `doorman` αντί για «Κλειστό πάρκινγκ» · «Θυρωρός».

  **Τι ΕΓΙΝΕ ήδη**: η Φ3 πρόσθεσε τα **κλειδιά** `features.amenities.*` (7 τιμές, el+en) στο
  `properties-enums.json` — δηλαδή η **μισή** θεραπεία υπάρχει και είναι δωρεάν για τον επόμενο.
  Άγκυρα που το φυλάει: `components/listing-detail/__tests__/listing-attribute-value.test.ts` (Τ1),
  με παρονομαστή την αυθεντία της Φ1 και όχι το locale.

  **Γιατί ΔΕΝ έγινε ολόκληρο**: το `ShowcaseFeaturesInfo` θα αποκτούσε `amenitiesLabels`, που αγγίζει
  **πέντε** καταναλωτές (`snapshot-builder.ts` · `ShowcaseDetailSections.tsx` ·
  `pdf/renderers/PropertyShowcaseSections.ts` · `email-templates/property-showcase-email-sections.ts` ·
  `property-showcase/telegram-text-digest.ts`) σε **δύο** τομείς ⇒ N.8 «orchestrator/plan», όχι
  πέρασμα της Φ3.

  **Fix**: `translateAmenities` δίπλα στους 11 αδελφούς του (path `['features','amenities']`),
  `amenitiesLabels` στο `ShowcaseFeaturesInfo`, και οι 5 καταναλωτές να διαβάζουν τις ετικέτες
  αντί για τους κωδικούς.

- 🔶 **01/09 — ΤΟ ΛΕΞΙΛΟΓΙΟ ΤΟΥ ΧΩΡΟΥ ΤΗΣ ΖΗΤΗΣΗΣ ΔΕΝ ΦΥΛΑΓΕΤΑΙ ΑΠΟ ΤΗΝ ΠΥΛΗ 3.73** *(ADR-777 §8.46, εντοπίστηκε υλοποιώντας το μέτωπο δρόμου)*

  **Τι**: το `.domain-vocabulary.json` (CHECK 3.73 / ADR-812) δηλώνει **ένα και μόνο**
  λεξιλόγιο: το `project-status`. Το `DemandPlace['kind']` — που μόλις μεγάλωσε από **4
  σε 5** μορφές και απαριθμείται σε `FORM_PLACE_KINDS`, `PLACE_KINDS_NOT_IN_FORM` και σε
  εξαντλητικούς `switch` σε τρία αρχεία — **δεν είναι εγγεγραμμένο**, άρα η πύλη
  **δεν το σαρώνει καθόλου**. Ίδιο σχήμα με τα «`0` = κανείς δεν κοίταξε» των N.11/N.12.

  **Γιατί ΔΕΝ έγινε τώρα**: το ίδιο το μητρώο το ορίζει ως **σημείο ανθρώπινης
  απόφασης** — *«Νέο λεξιλόγιο ή νέα εξαίρεση **ΜΠΛΟΚΑΡΕΙ, ακόμα κι αν είναι σωστή**,
  ώστε να τη δει άνθρωπος. Ο λόγος είναι ΥΠΟΧΡΕΩΤΙΚΟΣ.»* Εγγραφή περασμένη στο πέρασμα
  άλλου παραδοτέου θα μπλόκαρε commit για λόγο άσχετο με εκείνο.

  **Ένδειξη ότι θα είναι φθηνό**: το `FORM_PLACE_KINDS` χρησιμοποιεί ήδη
  `as const satisfies readonly DemandPlace['kind'][]` — **ακριβώς** το ιδίωμα που η
  πύλη αναγνωρίζει ως «δεμένο». Πιθανότατα πράσινο με τη μία.

  **Fix**: εγγραφή στο `.domain-vocabulary.json` με ρίζα `src/types/property-demand.ts`,
  `rootSymbol: DemandPlace`, γραπτό `reason`, και `npm run test:domain-vocabulary`.

- 🔶 **31/08 — Η ΚΑΤΑΣΚΕΥΗ ΔΙΑΤΑΞΗΣ ΠΙΝΑΚΑ ΕΙΝΑΙ ΠΥΚΝΗ, ΕΝΩ Ο ΖΩΓΡΑΦΟΣ ΕΙΝΑΙ ΗΔΗ ΕΙΚΟΝΙΚΟΠΟΙΗΜΕΝΟΣ** *(ADR-833 §5.8.1 + §5.8.8, μετρημένο γράφοντας τα όρια της Φάσης 5Β)*

  **Τι**: το `placeCells` (`bim/table/table-layout-place.ts`) κατασκευάζει πλήρες
  `TableCellLayout` για **κάθε** κελί του πλέγματος — γραμμένο ή **κενό** — και το
  `layoutTable` ξαναχτίζεται σε **κάθε δεσμευμένη αλλαγή**. Ο **ζωγράφος** έχει ήδη
  εικονικοποίηση (`visibleRowRange`, O(log n), ADR-735)· η **κατασκευή** δεν την έχει.

  **Μέτρηση (2026-08-31, σταθερή κατάσταση, jsdom+ts-jest)**: **~32 µs ανά πυκνό κελί,
  γραμμικά** από 5.000 έως 256.000 κελιά — δηλαδή 20×250 → 161 ms, 100×1000 → 3.183 ms,
  256×1000 → **8.033 ms**. Η **αραιότητα δεν βοηθά**: το ίδιο 256×1000 στο 5% κοστίζει
  4.080 ms (μόλις ×1,97 φθηνότερα), ενώ στην **αποθήκευση** το ίδιο 5% είναι ×19,6
  φθηνότερο. Δύο ιδιοκτήτες, δύο μονάδες.

  **Τι έγινε στη Φ5Β**: μπήκε **φραγμός** (`MAX_TABLE_GRID_CELLS = ⌊1.000 ms / 32 µs⌋ =
  31.250` πυκνά κελιά ανά φύλλο, `bim/table/table-capacity.ts`). Είναι όριο **γύρω από** το
  πρόβλημα, όχι λύση του.

  **Fix**: εικονικοποιημένη κατασκευή διάταξης **και στους δύο άξονες** (dual-axis /
  cell-level, το πρότυπο της βιομηχανίας): υπολογισμός μόνο του παραθύρου συν περιθώριο.
  Θα σήκωνε το όριο κατά **τάξεις μεγέθους**.

  **Μέγεθος**: η μηχανή διάταξης ανήκει στο **ADR-739**, όχι στο 833, και η αλλαγή αγγίζει
  και τα **τέσσερα** backends (καμβάς 2D, PDF, οντότητες σκηνής, DXF `ACAD_TABLE`) που
  διαβάζουν το ίδιο `TableLayout` ⇒ **δικό της παράθυρο**, με τη μέτρηση ήδη στο χέρι.

- 🔶 **31/08 — ΤΡΕΙΣ ΚΑΤΑΝΑΛΩΤΕΣ ΜΕΤΡΑΝΕ BYTES ΜΕ `String.length`** *(ADR-833 §5.6.2, εντοπίστηκε γράφοντας το όργανο της Φάσης 5Α)*

  **Τι**: το «πόσα bytes πιάνει αυτό όταν γραφτεί;» είχε **πέντε** απαντήσεις στο repo. Η
  μία αρχή γεννήθηκε (`src/lib/serialized-size.ts`) και ο **δικός μας** παραβάτης
  διορθώθηκε (`dxf-firestore-storage.impl.ts:96`). **Μένουν τρεις**, όλοι σε **ξένη**
  περιοχή — δεν αγγίχθηκαν επειδή το δέντρο μοιράζεται με ADR-832/834:

  ```
    src/subapps/dxf-viewer/systems/topography/persistence/topo-persistence-types.ts:152
        JSON.stringify(surfaces).length              ❌ μονάδες UTF-16
    src/subapps/dxf-viewer/settings/io/IndexedDbDriver.ts:295
        JSON.stringify(request.result).length * 2    ❌ ούτε UTF-8 ούτε UTF-16 σωστά
    src/lib/auth/claim-payload.ts:154
        Buffer.byteLength(json, 'utf8')              ✅ ΣΩΣΤΟ, αλλά δεύτερη υλοποίηση
  ```

  🔴 **Γιατί είναι χρέος**: το `String.length` μετρά **μονάδες UTF-16**. Στα ελληνικά η
  απόκλιση είναι **×1,45** και **πάντα προς τα κάτω** — δηλαδή ένα όριο μετρημένο έτσι
  **δεν μπλοκάρει ποτέ όταν πρέπει**· αφήνει την αποτυχία να συμβεί στο δίκτυο ή στον
  δίσκο, όπου το μήνυμα δεν λέει τι να κόψεις. Μετρημένο περιστατικό: CHECK 3.34 §8.43,
  163.749 αντί για 240.521.

  **Fix**: `import { serializedByteLength } from '@/lib/serialized-size'` και στα τρία.
  Το `claim-payload.ts` είναι **σωστό** — αλλάζει μόνο για να πάψει να είναι δεύτερη
  υλοποίηση (`TextEncoder` δίνει ταυτόσημο αποτέλεσμα με `Buffer.byteLength(s,'utf8')`
  και δουλεύει και στα δύο περιβάλλοντα). ⚠️ Το `claim-payload.ts` έχει **δικές του
  άγκυρες** — τρέξ' τες.

  **Μέγεθος**: 3 αρχεία, 3 τομείς (τοπογραφία / settings / auth) ⇒ **δεν** είναι
  «μικρό διπλότυπο» του N.0.2. Περιμένει να αδειάσει το δέντρο από τους άλλους agents.

  ⚠️ **Το `.ssot-registry.json` ΔΕΝ πειράχθηκε ΕΠΙΤΗΔΕΣ — και η σειρά έχει σημασία.** Ο
  N.12 λέει «νέο κεντρικοποιημένο module ⇒ γράψ' το στο μητρώο + `ssot:baseline`». Εδώ και
  τα δύο σκέλη είναι επικίνδυνα **τώρα**: (α) ένα module με `forbiddenPatterns` για το
  `JSON.stringify(...).length` θα μετρούσε αμέσως τους **τρεις** παραπάνω ως **νέες**
  παραβιάσεις πάνω από τη baseline ⇒ **CHECK 3.7 ΜΠΛΟΚ** σε κάθε commit, δικό μας και
  ξένο· (β) το `ssot:baseline` **ξαναγράφει ολόκληρη** τη baseline, δηλαδή θα κλείδωνε
  μέσα της τη μισοτελειωμένη δουλειά των άλλων agents.

  👉 **Η εγγραφή στο μητρώο είναι το ΤΕΛΕΥΤΑΙΟ βήμα αυτού του ratchet, όχι το πρώτο**:
  πρώτα οι τρεις διορθώσεις, μετά `ssot:registry` + `ssot:baseline` σε **καθαρό** δέντρο.
  Αλλιώς ο φρουρός γεννιέται κόκκινος και κάποιος θα τον σβήσει για να περάσει.

- 🔶 **31/08 — ΟΚΤΩ ΓΡΑΦΕΙΣ `.xlsx` ΞΑΝΑΓΡΑΦΟΥΝ ΤΗ ΜΗΧΑΝΙΚΗ ΤΟΥ ΒΙΒΛΙΟΥ** *(ADR-833 §5.7.1, εντοπίστηκε γράφοντας τη δεύτερη πόρτα εξαγωγής της Φάσης 6)*

  **Τι**: η μηχανική «άνοιξε βιβλίο → ονόμασε φύλλα → γράψε bytes → κατέβασε» εξήχθη στο
  `bim/schedule/exporters/xlsx-workbook.ts` και έχει **δύο** καταναλωτές (schedule + πίνακας).
  Οι υπόλοιποι **οκτώ** την ξαναγράφουν, ο καθένας με δικό του `new Blob([...], { type })`
  και δικό του χειρισμό ονομάτων:

  ```
    src/services/report-engine/report-excel-exporter.ts
    src/services/report-engine/builder-excel-exporter.ts
    src/services/report-engine/builder-excel-analysis.ts
    src/services/payment-export/payment-excel-exporter.ts
    src/services/gantt-export/gantt-excel-exporter.ts
    src/services/milestone-export/milestone-excel-exporter.ts
    src/subapps/accounting/services/export/excel-exporter.ts
    src/lib/export/analytics-xlsx.ts
  ```

  **Γιατί δεν είναι καλλωπισμός**: το πρώτο πράγμα που βρήκε η Φάση 6 γράφοντας τη δεύτερη
  πόρτα ήταν ότι **τα διπλά ονόματα φύλλων ρίχνουν τον `addWorksheet` με εξαίρεση** — και ότι
  η **περικοπή στους 31 χαρακτήρες μπορεί να ΓΕΝΝΗΣΕΙ** τη σύγκρουση από δύο διαφορετικούς
  τίτλους. Οι οκτώ έχουν **τον ίδιο** λανθάνοντα κίνδυνο, ο καθένας ανεξέλεγκτα.

  **Fix**: `createXlsxWorkbook` / `xlsxWorkbookToBlob` / `xlsxWorksheetNames` /
  `downloadXlsxBlob` από το ένα module. ⚠️ Πιθανή μετακόμιση της μηχανικής σε `src/lib/` όταν
  οι καταναλωτές πάψουν να είναι μόνο του subapp — **όχι πριν**: ένας φάκελος με καθολικό όνομα
  που οκτώ γραφείς δεν υπακούν είναι «`0` που σημαίνει *κανείς δεν κοίταξε*» (N.11/N.12).

  🆕 **02/10 (ADR-898 Φ4β)**: το `lib/export/excel-workbook.ts` (ήδη SSoT για gantt/payment/milestone) απέκτησε
  `addScheduleSheet` (παγωμένη κεφαλίδα · φίλτρο · `numFmt` · `SUM` με αποτέλεσμα) και `excelSheetName` + μοναδικό όνομα
  (ο κίνδυνος των 31 χαρακτήρων παραπάνω, καλυμμένος με άγκυρα). Δίδυμο: `bim/schedule/exporters/xlsx-workbook.ts`
  (`xlsxWorksheetNames`) — το `dxf-viewer` δεν εισάγεται απ' έξω (CHECK 3.62), άρα η σύγκλιση πάει **προς** το `lib/export`.

  **Μέγεθος**: 8 αρχεία, 5 τομείς (αναφορές / πληρωμές / gantt / λογιστική / analytics) ⇒
  **δεν** είναι «μικρό διπλότυπο» του N.0.2. Καμία λειτουργική αλλαγή δεν απαιτείται από τη
  Φάση 6 — ο εντοπισμός είναι Boy Scout, η εκτέλεση χρειάζεται δικό της παράθυρο.

- 🔶 **29/08 — ΤΑ ΔΕΚΑΕΞΙ ΚΛΕΙΔΙΑ ΤΟΥ `BrokeredMandateFields` ΧΤΙΖΟΝΤΑΙ ΜΕ ΠΑΡΕΜΒΟΛΗ** *(ADR-827 §9.19 ε #4, εντοπίστηκε γράφοντας το `listing-agreement-labels.ts` της Φάσης Β (ζ))*

  **Τι**: `components/mandate/BrokeredMandateFields.tsx` — **και οι 16** κλήσεις `t()`
  χτίζονται με παρεμβολή πάνω στη σταθερά module `K` (γρ. 60). Οι **τέσσερις** από αυτές
  παρεμβάλλουν και **τιμή χρόνου εκτέλεσης**: `agreementOptions.<είδος>` ·
  `agreementHints.<είδος>` (γρ. 128, 131) · `VIA_KEY[via].label` · `VIA_KEY[via].hint`
  (γρ. 263, 266).

  🔴 **ΓΙΑΤΙ ΕΙΝΑΙ ΧΡΕΟΣ — ΚΑΙ ΟΧΙ ΓΙΑ ΤΟΝ ΛΟΓΟ ΠΟΥ ΓΡΑΦΤΗΚΕ ΣΤΟ ADR.** Το ADR-827 §9.19 ε #4
  έλεγε *«αγγίζει το μητρώο `dynamicKeyPolicy` του §9.14»*. **Μετρήθηκε 2026-08-29 και δεν
  στέκει**: ο τεμαχιστής (ADR-744) **τα επιλύει** — το `K` και το `VIA_KEY` είναι σταθερές
  module και το `constant-resolution.js` τις διαβάζει από το AST. Το
  `src/i18n/generated/routes/o__workspace__listings__mandates__new.el.json` **περιέχει** και
  τους **21** κλάδους του `mandate.office`, και **καμία** από τις **10** εγγραφές
  `dynamicKeyPolicy` του `.i18n-shell-slice.json` δεν αφορά αυτό το αρχείο. **Δεν υπάρχει
  εγγραφή για να φύγει.**

  🔴 **Ο πραγματικός τυφλός είναι η CHECK 3.8**: ψάχνει `t('key')` και `t('ns:key')` —
  **κυριολεκτικά**. Παρεμβαλλόμενο κλειδί **δεν το βλέπει καμία πύλη i18n**: αν αύριο σβηστεί
  το `mandate.office.untilHint` από τα locales, **τίποτα δεν κοκκινίζει** και η οθόνη βάφει
  ωμό κλειδί στον άνθρωπο που υπογράφει εντολή. Μόνο όργανο που το πιάνει: το pseudo locale
  (ADR-666, N.11) — δηλαδή **άνθρωπος που περπατά την οθόνη**.

  **Ο προορισμός υπάρχει ήδη κατά το ένα τέταρτο**: το
  `components/mandate/listing-agreement-labels.ts` → `LISTING_AGREEMENT_I18N_KEYS`
  *(`Record<ListingAgreement, string>` με άγκυρα `everyAgreementNamed()`)* καλύπτει τα **4**
  είδη εντολής. Τα υπόλοιπα *(πελάτης · διάρκεια · αμοιβή · δρόμος απόδειξης · τίτλοι)*
  θέλουν δικό τους πίνακα, στο ύφος των `offer-form-labels.ts` / `demand-form-labels.ts` /
  `mandate-request-form-labels.ts` (ADR-827 §9.14 γ).

  **Fix**: σταθεροί πίνακες module `Record<…>` πάνω στα **κλειστά σύνολα** ⇒ `t(TABLE[x])`,
  ποτέ παρεμβολή. Άγκυρα: *«κάθε τιμή του συνόλου έχει κλειδί **και** το κλειδί υπάρχει και
  στα δύο locales»* — σχήμα `Κ6` του §9.14 ε, που **διαβάζει τους ίδιους πίνακες** με την
  οθόνη, ποτέ ανακατασκευασμένο μονοπάτι *(η προηγούμενη εκδοχή του Κ6 βγήκε ΠΡΑΣΙΝΗ σε
  πραγματικό λάθος ακριβώς γι' αυτόν τον λόγο)*. Μετά: ξανατρέξε τον γεννήτορα και
  επαλήθευσε το **CHECK 3.34** — η διαδρομή είναι στα **11.840 / 17.500** μετά το §9.14 δ,
  άρα υπάρχει περιθώριο, αλλά ο αριθμός **αλλάζει**: ο τεμαχιστής θα σταματήσει να τραβά
  ολόκληρα υποδέντρα και θα ζητά ονομαστικά κλειδιά.

  **Γιατί ΔΕΝ έγινε στη Φάση Β (ζ)**: το `listing-agreement-labels.ts` γεννήθηκε για τη
  **φόρμα του Σ1** (`/offers/mandate/new`)· η μετανάστευση του `BrokeredMandateFields` είναι
  **άλλη οθόνη, άλλη διαδρομή, άλλο slice** και θα ανακάτευε δύο θεματικά commits (N.0.2).

- 🔶 **29/08 — Η «ΜΑΚΡΑ ΗΜΕΡΟΜΗΝΙΑ ΒΙΤΡΙΝΑΣ» ΓΡΑΦΤΗΚΕ 5 ΦΟΡΕΣ** *(ADR-827 §9.16 ε, εντοπίστηκε φτιάχνοντας το `formatLongDate`)*

  **Τι**: το literal `{ day: 'numeric', month: 'long', year: 'numeric' }` επαναλαμβάνεται σε
  **5 κλήσεις / 3 αρχεία**:
  `components/building-showcase/BuildingShowcaseSpecs.tsx:57,63` ·
  `components/project-showcase/ProjectShowcaseSpecs.tsx:45,51` ·
  `subapps/procurement/components/RfqHistoryTab.tsx:48`.

  **Γιατί είναι χρέος**: δεν είναι επανάληψη κώδικα — είναι επανάληψη **ΑΠΟΦΑΣΗΣ**
  *(«δημόσια/αναφορική επιφάνεια ⇒ ο μήνας γράφεται ολογράφως»)*. Απόφαση γραμμένη σε 5
  σημεία είναι απόφαση που **μπορεί να αποκλίνει**: την ημέρα που η μία οθόνη περάσει σε
  σύντομο μήνα, οι άλλες τέσσερις δεν θα το μάθουν ποτέ (ADR-749).

  ⚠️ **Δεν το πιάνει καμία πύλη**: το `jscpd` (CHECK 3.28) μετρά **tokens** και ένα literal
  επιλογών είναι κάτω από το `min-tokens: 50`· το `ssot:discover` (3.18) σαρώνει
  `src/config|utils|lib` σε `maxdepth 1`, δηλαδή **δεν ανοίγει** το `src/components` ούτε
  το `src/subapps`.

  **Ο κανονικός τόπος υπάρχει πλέον**: `lib/intl-formatting.ts` → `formatLongDate()`,
  με άγκυρα `lib/__tests__/intl-long-date.test.ts` *(10 tests· μεταλλάξεις **5/5 κόκκινες**,
  και οι δύο που χρειάστηκαν **διπλή** μετάλλαξη τεκμηριώνονται στο ίδιο αρχείο)*.

  **Το fix**: αντικατάσταση των 5 κλήσεων με `formatLongDate(x)` + αφαίρεση του πλέον
  αχρείαστου `formatDate` import όπου μένει ορφανό. ⛔ **ΜΗΝ** αγγίξεις το
  `subapps/dxf-viewer/bim/table/table-cell-format.ts:381` — εκεί το ίδιο literal είναι
  **εγγραφή σε μητρώο μορφών που επιλέγει ο χρήστης**, όχι απόφαση οθόνης. Ίδια γραφή,
  **άλλο ερώτημα**.

  **Γιατί όχι τώρα**: 3 αρχεία σε **3 ξένους τομείς** *(κτίρια, έργα, προμήθειες)*, εκτός
  ADR-827 — θα μόλυνε θεματικό commit. N.0.2, σκέλος «4+ αρχεία ⇒ pending».

- 🔴 **29/08 — ΤΡΙΑ ΑΝΤΙΓΡΑΦΑ ΤΟΥ `addMonths`, ΚΑΙ ΤΑ ΤΡΙΑ ΜΕ ΤΟ ΙΔΙΟ ΣΦΑΛΜΑ** *(ADR-827 §8.9 α, εντοπίστηκε γράφοντας το πλαφόν διάρκειας)*

  **Τι**: `lib/counterproposal-engine.ts:35` · `lib/draw-schedule-engine.ts:29` ·
  `lib/auth/audit-policy.ts:170` *(inline)* — τρεις υλοποιήσεις πρόσθεσης μηνών, **όλες**
  γραμμένες ως `d.setMonth(d.getMonth() + n)`.

  **Γιατί είναι σφάλμα**: ο ωμός τελεστής **ξεχειλίζει σιωπηλά**. *31 Ιανουαρίου + 1 μήνας*
  δίνει **3 Μαρτίου**, όχι 28/29 Φεβρουαρίου. Δεν πετά, δεν προειδοποιεί — δίνει ημερομηνία
  δύο-τριών ημερών αργότερα, **μόνο** για αφετηρίες στο τέλος του μήνα.

  **Ο κανονικός τόπος υπάρχει πλέον**: `lib/date-local.ts` → `addMonthsUTC()`, με clamping
  και άγκυρα (`Σ5` στο `types/__tests__/owner-property-mandate.test.ts`, μετάλλαξη κόκκινη).

  **Γιατί ΔΕΝ μετανάστευσαν τώρα**: το σωστό κόψιμο **αλλάζει αριθμούς** σε δύο οικονομικές
  μηχανές (χρονοδιάγραμμα εκταμιεύσεων · αντιπροτάσεις · NPV). Είναι αλλαγή **συμπεριφοράς**
  που χρειάζεται δικές της άγκυρες — όχι μετακίνηση κώδικα. Το `audit-policy.ts` είναι το
  φθηνότερο από τα τρία (πολιτική διατήρησης, χωρίς οικονομικό αποτέλεσμα).

  **Fix**: αντικατάσταση με `addMonthsUTC`, ένα αρχείο τη φορά, με άγκυρα πριν και μετά.

- 🟡 **28/08 — ΕΞΙ ΑΝΤΙΓΡΑΦΑ ΤΟΥ ΙΔΙΟΥ `BrokeredListingMandate` FIXTURE** *(ADR-827 §6, εντοπίστηκε κατά τη Φάση Α)*

  **Τι**: έξι αρχεία test φτιάχνουν το **ίδιο** fixture εντολής με copy-paste — ίδια 10 πεδία,
  ίδιο `Partial<>` override pattern, μόνο οι τιμές διαφέρουν:
  `lib/mandate/__tests__/mandate-standing.test.ts` · `lib/owner-property/__tests__/owner-property-fixtures.ts`
  · `services/mandate/__tests__/mandate-actions.test.ts` · `…/mandate-catalog.test.ts`
  · `…/mandate-decision-notice.test.ts` · `types/__tests__/owner-property-mandate.test.ts`

  **Η απόδειξη ότι κοστίζει**: η προσθήκη **δύο** υποχρεωτικών πεδίων (`agreement` ·
  `compensation`) απαίτησε **έξι** πανομοιότυπες επεξεργασίες — συν **δώδεκα** ακόμη στο
  `brokered-listing.test.ts`. Το επόμενο πεδίο θα κοστίσει το ίδιο.

  **Fix**: ένας `brokeredMandateFixture(over?)` στο `owner-property-fixtures.ts` (**υπάρχει ήδη**
  ως αρχείο και ήδη το εισάγει το `brokered-listing.test.ts`) και τα άλλα πέντε να τον καλούν.

  ⚠️ **Γιατί δεν έγινε στη Φάση Α**: 6 αρχεία ⇒ κατά τον N.0.2 πάει σε pending, όχι επιτόπου
  διόρθωση. ⚠️ Και ο N.18 είναι **δομικά τυφλός** εδώ: το Layer 2 του jscpd σαρώνει **μόνο**
  `src` με ρίζα `check-jscpd-ratchet.js:71` — τα `__tests__` **μέσα** στο `src` μετρώνται, αλλά
  το `jscpd:diff` τρέχει **μόνο στα staged**, οπότε έξι αρχεία που δεν αγγίζονται μαζί δεν
  συγκρίνονται ποτέ.

- 🟡 **27/08 — Η ΛΙΣΤΑ `properties` ΗΤΑΝ ΔΟΜΙΚΑ ΚΛΕΙΣΤΗ** — *ο κανόνας διορθώθηκε· **μένει μέτρηση παραγωγής*** *(ADR-823)*

  ⚠️ **Η ΑΡΧΙΚΗ ΔΙΑΤΥΠΩΣΗ ΑΥΤΗΣ ΤΗΣ ΕΓΓΡΑΦΗΣ ΗΤΑΝ ΛΑΘΟΣ — και η διόρθωση είναι το εύρημα.**
  Έλεγε *«ένα ακίνητο με σπασμένο `projectId` αρνείται ΟΛΟΚΛΗΡΗ τη λίστα»*. Μετρήθηκε: το
  μήνυμα `Property projectId is undefined` βγαίνει **και με ΜΗΔΕΝ χαλασμένα έγγραφα**. Το
  Firestore κρίνει το `list` πάνω στο **δυνητικό σύνολο** του ερωτήματος, και ο πελάτης
  φιλτράρει `companyId` ενώ ο κανόνας διάβαζε `projectId`. **Η βιβλιοθήκη δεν κλειδώθηκε
  από ένα βιβλίο — δεν άνοιξε ποτέ**, για κάθε μη-super-admin.

  ✅ **ΕΓΙΝΕ**: άμεσο σκέλος `companyId` σε `properties` · `floors` · `storage_units` ·
  `parking_spots` *(οι 4 από τις 10 που ήταν ανικανοποίητες)*. Άγκυρα
  `tenant-list-satisfiability.rules.test.ts` — **112 tests**, **5/9 μεταλλάξεις κόκκινες**.
  Καμία παλινδρόμηση: **124 σουίτες / 3.102 tests**. Ελεγκτής:
  `npm run firestore:dangling-fk:audit`.

  🔵 **ΜΕΝΕΙ — ΧΡΕΙΑΖΕΤΑΙ ΤΟΝ GIORGIO**: ο πράκτορας **δεν έχει διαπιστευτήρια παραγωγής**,
  άρα δεν μετρήθηκε πόσα πραγματικά έγγραφα έχουν **λείπον/κρεμάμενο** ξένο κλειδί ή
  **λείπον `companyId`** *(τα τελευταία είναι **αόρατα** στο παραγωγικό ερώτημα)*. Το
  εργαλείο είναι έτοιμο και **read-only**. **Αν βγάλει 0, δεν υπάρχει μετανάστευση.**

  🔶 **Δύο μικρά που ΔΕΝ έγιναν, επίτηδες** *(ξένη λωρίδα / απόφαση εμβέλειας)*:
  **(α)** το `project_floorplans` δηλώνει `mode: 'none'` ⇒ αφιλτράριστο ερώτημα ⇒ δομικά
  ανικανοποίητο *(κλειδωμένο ως **γεγονός** στο Κ1)*· ✅ **(β) ΕΚΛΕΙΣΕ 08/09** *(ADR-841 §7
  **Α21.14**)* — τα `rulesRange` δεν είναι πια μπαγιάτικα επειδή **δεν υπάρχουν**:
  αφαιρέθηκαν και από τα δύο manifest *(−138 εγγραφές)* και ο δείκτης έγινε **παραγόμενος**
  (`--map`). Μετρημένο πριν την αφαίρεση: **124/127 λάθος (98%)**, χειρότερη απόκλιση
  **1853** γραμμές.

- 🔴 **27/08 — ΔΥΟ ΔΟΓΜΑΤΑ ΚΑΤΑΣΤΑΣΗΣ ΣΤΟΝ ΙΔΙΟ ΦΑΚΕΛΟ** *(ADR-798 §22.6 #3 — **ΔΕΝ είναι «μικρό»**)*

  Στο `src/services/realtime/hooks/` συνυπάρχουν **δύο** δόγματα για την ίδια ερώτηση
  *«τι ξέρω αυτή τη στιγμή;»*:

  | Οικογένεια | Σχήμα | Hooks |
  |---|---|---|
  | ιδιωτικού/δημόσιου εύρους | **διακριτική ένωση** `{state:'loading'} \| {state:'ready'}` *(νεότερο & καλύτερο, ADR-777)* | `useOwnedDocuments` · `useMyDemands` · `useMyOwnerProperties` · `usePublicListings` · `usePublicPlace` |
  | εταιρικού εύρους | επίπεδα `loading` / `error` / `status` | `useRealtimeBuildings` · `useRealtimeProperties` · `useRealtimeTasks` · `useRealtimeOpportunities` · `useRealtimePropertiesTrashCount` |

  🔴 **ΓΙΑΤΙ ΔΕΝ ΕΓΙΝΕ ΣΤΗ ΣΥΝΕΔΡΙΑ ΤΟΥ §22.6** *(όπου έκλεισαν το #1 και το #2)*: το handoff
  το ονόμαζε «μικρό». **Μετρήθηκε 2026-08-27 και δεν είναι**: η εταιρική οικογένεια έχει
  **27 αρχεία καταναλωτών** *(8 · 7 · 5 · 4 · 3)*, καθένα με δικό του `destructuring` του
  `loading`/`error`. Η μετατροπή αλλάζει τη **δημόσια όψη** των πιο πολυχρησιμοποιημένων hooks
  δεδομένων της εφαρμογής.

  ⚠️ **ΚΑΙ ΤΟ ΧΕΙΡΟΤΕΡΟ — ΛΕΙΠΕΙ ΤΟ ΔΙΧΤΥ**: ο φυσικός φρουρός μιας τέτοιας αλλαγής είναι ο
  **έλεγχος τύπων**, που ο **N.17 απαγορεύει ρητά** στον πράκτορα. Δηλαδή ένας ξεχασμένος
  κλάδος θα έβγαινε **πράσινος** σε κάθε jest και θα έσπαγε **στην οθόνη**. Το να γίνει
  «στα τυφλά» θα ήταν ακριβώς η έκπτωση που ο N.1 απαγορεύει.

  **Πρόταση**: δική της συνεδρία, με τον Giorgio να τρέχει `npm run typecheck` ανάμεσα στα
  βήματα. **N.8 — 5+ αρχεία, 2+ τομείς.**

- 🔶 **25/08 — Ο ΚΑΜΒΑΣ ΚΑΙ ΤΟ PDF ΖΩΓΡΑΦΙΖΟΥΝ ΠΛΕΟΝ ΑΛΛΗ ΓΡΑΜΜΑΤΟΣΕΙΡΑ** *(ADR-803 §6.6)*

  **Πριν** το ADR-803, οθόνη και εξαγόμενο PDF ζωγράφιζαν **το ίδιο** Roboto. **Τώρα** ο καμβάς
  ζωγραφίζει **Liberation** (metric-compatible με Arial, 6/6 ακριβή) και το PDF εξακολουθεί
  Roboto μέσω `services/pdf/greek-font-loader.ts` (`ROBOTO_REGULAR_BASE64`) ⇒ **πλάτη που
  διαφέρουν ως 6%** ανάμεσα σε οθόνη και εκτύπωση.

  ⚠️ **ΔΕΝ σπάει διάταξη** — επαληθεύτηκε: το `emitText` του `scene-vector-emitter` περνά το
  **σημείο αγκύρωσης** και αφήνει το jsPDF να στοιχίσει με τις **δικές του** μετρικές, δεν
  κληρονομεί πλάτος από τον καμβά. Είναι απόκλιση **πιστότητας**, όχι ορθότητας — και ο
  **καμβάς** έγινε πιο πιστός, όχι λιγότερο.

  🔴 **Γιατί δεν διορθώθηκε εκεί**: ο `greek-font-loader` είναι **app-wide SSoT** — τιμολόγια,
  gantt, milestones, λογιστική. Και το **ADR-739 Φ.Ε** ζύγισε **ρητά** το κόστος («+~700KB σε
  κάθε τυπωμένη σελίδα») επιλέγοντας **συνθετικό** έντονο (`Tr 2` fill-then-stroke) και
  **συνθετικό** πλάγιο (shear του text matrix) — τεκμηριωμένη απόφαση, όχι παράλειψη.

  **Το ερώτημα για τον Giorgio**: θέλουμε το PDF να δείχνει **ακριβώς** ό,τι η οθόνη (⇒ μπαίνει
  Liberation base64 και στον PDF loader, με το κόστος του ADR-739), ή δεχόμαστε ρητά ότι η
  εκτύπωση είναι «ίδιο σχέδιο, ελαφρώς άλλα πλάτη»; **N.8 — δική του συνεδρία.**

- 🔶 **25/08 — `stripComments` ΣΤΙΣ ΠΥΛΕΣ: 6 ΑΝΤΙΓΡΑΦΑ, ΚΑΙ ΤΩΡΑ ΔΥΟ SSoT** *(ADR-805 §6.4)*

  ⚠️ **ΣΥΓΓΕΝΙΚΟ ΑΛΛΑ ΔΙΑΦΟΡΕΤΙΚΟ** από την εγγραφή «23/08 — `stripComments` + χειρόγραφη
  `REPO_ROOT`» παρακάτω: εκείνη αφορά **αρχεία test μέσα στο `src/`** και το SSoT της είναι
  `src/test-utils/read-source.ts` (**TypeScript**). Αυτή αφορά τις **πύλες** στο `scripts/`, που
  είναι **CommonJS** και **δεν μπορεί** να καταναλώσει TS module χωρίς βήμα build.

  🔴 **Άρα υπάρχουν πλέον ΔΥΟ SSoT για το ίδιο ερώτημα, και το γράφω ΡΗΤΑ ώστε να μην
  «ανακαλυφθεί» αύριο ως αδήλωτο διπλότυπο** (ADR-749). Ο διαχωρισμός είναι **δομικός** (γλώσσα
  + module system), όχι αμέλεια — αλλά αν κάποτε το `scripts/` αποκτήσει βήμα build, **ενοποιούνται**.

  Αντίγραφα στις πύλες: `authority-registry/inventory.js` · `i18n-namespace-extract.js` ·
  `shell-surface/scan.js` · `check-notification-keys-locale.js` ·
  `css-vars/custom-property-index.js` (παραλλαγή: κρατά γραμμές) ·
  `check-entity-audit-coverage.js` (παραλλαγή: κόβει και συμβολοσειρές).

  🔴 **Δεν είναι αισθητικό — πύλη ΧΩΡΙΣ αυτό τρέφεται από τη ΔΙΚΗ ΤΗΣ τεκμηρίωση.** Συνέβη
  ζωντανά γράφοντας την **CHECK 3.69**: το `assets.js` γράφει το κριτήριό του ως παράδειγμα σε
  σχόλιο, η κανονική έκφρασή του το διάβασε, εξήγαγε «ταυτοποιητή» **`X`**, και το
  `git grep "export const X"` επέστρεψε **10 άσχετα αρχεία** ⇒ ανέφερε **11 αδήλωτες
  γραμματοσειρές αντί για 1**: **σπασμένη ενώ φαινόταν αυστηρότερη**.

  ✅ SSoT πυλών: `scripts/lib/source-text.js` (ένας καταναλωτής σήμερα). ⚠️ Οι δύο **παραλλαγές**
  δεν είναι ταυτόσημες ⇒ η μετανάστευση θέλει **μέτρηση ανά πύλη**. **N.8 — δική της συνεδρία.**

  🔴 **ΑΝΕΒΗΚΕ Η ΠΡΟΤΕΡΑΙΟΤΗΤΑ 16/09 — ΤΟ ΑΝΤΙΓΡΑΦΟ ΔΕΝ ΗΤΑΝ ΜΟΝΟ ΔΙΠΛΟΤΥΠΟ, ΗΤΑΝ ΣΠΑΣΜΕΝΟ**
  *(ADR-797 §Δ · ADR-861 §6.4)*. Το αντίγραφο του `shell-surface/scan.js` έσβηνε τα **μπλοκ πριν**
  τις **γραμμές** ⇒ σχόλιο `//` που περιέχει `/*` (το glob `src/app/**`) ζευγάρωνε με το **επόμενο**
  `*/`: **7.994 → 2.234** χαρακτήρες σε μία σελίδα, **μαζί με το `export default`** ⇒ η πύλη την
  μετρούσε «καθαρή» **χωρίς να την έχει δει κανείς**. ✅ **Διορθώθηκε ΜΟΝΟ εκεί** (ΕΝΑ πέρασμα,
  συμβολοσειρές πρώτες· άγκυρες Δ1-Δ5).
  ⚠️ **ΤΟ `source-text.js` ΚΡΑΤΑ ΤΙΣ ΙΔΙΕΣ ΔΥΟ ΓΡΑΜΜΕΣ**, και το καταναλώνουν τα **CHECK 3.56 ·
  3.58 · 3.59 · 3.69**. **Λανθάνων πυροδότης, μετρημένος 16/09**: **31** αρχεία `src/**` + **14**
  `scripts/**` με σχόλιο γραμμής που περιέχει `/*`. Δηλαδή **τέσσερις μπλοκάρουσες πύλες μπορούν
  να διαβάζουν μισό αρχείο και να το λένε καθαρό**. ⚠️ **ΜΗΝ το κάνεις σαν παράπλευρη εργασία**:
  η αλλαγή μετακινεί τις **εισόδους** τεσσάρων πυλών (δύο ratchet **κατά ταυτότητα**) ⇒ θέλει
  μέτρηση **πριν/μετά ανά πύλη**, με **θετικό μάρτυρα** (ADR-861 §6.5: μη μετράς πύλη με τον
  κώδικά της) — και προσοχή στο **μετρημένο εμπόδιο** του `inventory.js` παρακάτω.

  🔴 **ΜΕΤΡΗΜΕΝΟ ΕΜΠΟΔΙΟ ΓΙΑ ΤΟ `authority-registry/inventory.js` (25/08, ADR-801 §2.11)**:
  το αντίγραφό του κάνει `.split('
').map(…).join('
')` — δηλαδή **διατηρεί τον αριθμό
  γραμμών**. Το `source-text.js` αντικαθιστά ένα block comment με **ένα κενό**, οπότε
  **καταρρέουν οι νέες γραμμές** του. Το `windowsOf` όμως αναφέρει `line: i + 1` και ο
  αριθμός ταξιδεύει στην **αναφορά** και στα μηνύματα της πύλης. Τυφλή αντικατάσταση ⇒ **οι
  γραμμές δείχνουν αλλού, σιωπηλά**. Η μετανάστευση εκεί θέλει είτε παραλλαγή που κρατά
  γραμμές (όπως ήδη κάνει το `css-vars/custom-property-index.js`) είτε άγκυρα που κλειδώνει
  τον αριθμό γραμμής ενός γνωστού παραθύρου. **ΜΗΝ το κάνεις χωρίς αυτό.**

- 🔶 **25/08 — ΕΝΤΕΚΑ ΑΝΤΙΓΡΑΦΑ ΤΟΥ `gitShow` ΣΤΙΣ ΑΓΚΥΡΕΣ** *(N.0.2 / N.18)*

  Μετρημένο: **11** αρχεία στο `scripts/__tests__/` κρατούν το καθένα δική του τετράγραμμη
  `gitShow(rev, file)` — `authority-registry-gate` · `check-contrast-promise-reachability` ·
  `check-css-token-authority` · `check-e2e-executability` · `check-empty-select-item` ·
  `check-i18n-ssr-raw-keys` · `check-prerender-bailout` · `check-production-build-parity` ·
  `check-state-channel-distinctness` · κ.ά.

  🔴 **Το επικίνδυνο δεν είναι η επανάληψη — είναι ο φρουρός που μπορεί να λείψει από ΕΝΑ
  αντίγραφο.** Το `git show` σε μονοπάτι που δεν υπάρχει στην αναθεώρηση απαντά **κενό**, και
  μια άγκυρα που δέχεται κενό βγαίνει **ΠΡΑΣΙΝΗ χωρίς να έχει κοιτάξει τίποτα** — το σχήμα
  «0 = κανείς δεν κοίταξε», μέσα στα ίδια τα όργανα που το κυνηγούν. Έχει ήδη συμβεί ζωντανά
  μία φορά (CHECK 3.41: backslash από `path.join` σε Windows ⇒ «exists on disk, but not in
  HEAD» ⇒ ένα `if (x === null) return` το έβαψε πράσινο).

  ✅ **Το SSoT ΕΓΙΝΕ**: `scripts/__tests__/_git-show.js` — με φρουρό κενής απάντησης, **άρνηση
  σε `HEAD`** (κινούμενο ref ⇒ σιωπηλή αυτο-ακύρωση) και άρνηση σε backslash μονοπάτι.
  Καταναλωτής σήμερα: **ένας** (`font-promise.test.js`, ADR-803).

  **Μένει η μετανάστευση των υπόλοιπων 10.** Μηχανική, αλλά αγγίζει 10 αρχεία αγκυρών ⇒
  **N.8, δική της συνεδρία**· και κάθε μετανάστευση πρέπει να επαληθεύεται **εκτελώντας** τη
  σουίτα, γιατί μερικές περνούν `path.join` (backslash) και το νέο SSoT **σκάει** εκεί —
  σωστά, αλλά θα φανεί ως κόκκινο που θέλει διόρθωση **του καλούντος**.

- 🔶 **25/08 — Η ΑΠΟΓΡΑΦΗ ΤΟΥ 3.64 ΔΙΠΛΟΜΕΤΡΑ ΣΙΩΠΗΛΑ ΣΕ ΠΡΟΣΘΕΤΙΚΗ ΕΚΤΕΛΕΣΗ**

  Το `collectRuns` **αθροίζει** δύο γραμμές του ίδιου αρχείου — **σωστά**, γιατί ο jest τρέχει
  παράλληλα και ένα αρχείο test μπορεί να γράψει σε δύο NDJSON worker. Ο κανονικός εκτελεστής
  (`run-text-measure-census.js`) κάνει `rmSync(CENSUS_DIR)` πριν, οπότε εκεί είναι ασφαλές.

  🔴 **Αλλά η προσθετική εκτέλεση δεν είναι**: αν κάποιος καλέσει `npx jest <σουίτα>
  --setupFilesAfterEnv=census-setup` πάνω σε φάκελο που **ήδη έχει** NDJSON, κάθε
  προϋπάρχουσα παρατήρηση **διπλασιάζεται**. Συνέβη ζωντανά σε αυτή τη συνεδρία: `glyph` 296→592,
  `nominal` 41→82, **μηδέν** νέες εγγραφές αρχείου.

  ⚠️ **Η ΕΤΥΜΗΓΟΡΙΑ ΔΕΝ ΑΛΛΑΖΕΙ** *(`isBlind` = `nominal > 0 && dropped.length > 0`, και ο
  διπλασιασμός κρατά και τα δύο)*, γι᾽ αυτό **καμία πύλη δεν κοκκίνισε** — η βλάβη είναι ότι οι
  αριθμοί της απογραφής παύουν να είναι **μέτρηση**, ενώ το `$doc` της λέει «ΠΑΡΑΤΗΡΗΣΗ, όχι
  ευρετικό». Πιάστηκε **μόνο** επειδή κάποιος διάβασε το diff.

  **Θεραπεία** *(μία γραμμή, αλλά θέλει απόφαση ποιος την κρατά)*: το `prior.ndjson` της
  προσθετικής διαδρομής να γράφεται με **ξεχωριστή κατάληξη** που το `collectRuns` αντικαθιστά
  αντί να αθροίζει· ή το `census-setup` να γράφει **αντικαθιστώντας** ανά `(worker, αρχείο)`
  αντί για `appendFileSync`. Η δεύτερη είναι η σωστή: το άθροισμα ανά **εκτέλεση** δεν έχει
  νόημα — δύο εκτελέσεις της ίδιας σουίτας δεν είναι διπλάσια δουλειά, είναι **η ίδια** δουλείά.
  **N.8 — δική του συνεδρία.**

- 🔴 **25/08 — ΤΟ «ΕΠΙΤΡΕΠΕΤΑΙ;» ΤΟ ΑΠΑΝΤΟΥΝ ΑΚΟΜΗ 14 ΑΡΧΕΙΑ** *(ADR-801, μετά τη Φάση 3α)*

  Η Φάση 3α έκλεισε την **πλευρά του πελάτη** (ο PEP `useCapability`, ο νεκρός πίνακας 13
  ρόλων, οι 2 inline `Set` του viewer, η διαγραφή του δολώματος `security-policy`). Η μέτρηση
  όμως *(κριτήριο = **≥2 ρόλοι του λεξιλογίου των claims** — `GLOBAL_ROLES` + τα legacy
  `broker`/`builder` — σε literal · `switch` · αλυσίδα `===`, **με τα σχόλια κομμένα**. Το
  πλατύτερο κριτήριο **μετρήθηκε και απορρίφθηκε**: 42 ευρήματα, **>60% ψευδώς θετικά**, γιατί
  τα `vendor`/`client`/`engineer` είναι ΚΑΙ τύποι σχέσης επαφής ΚΑΙ persona)* λέει:

  | | πριν | μετά |
  |---|---|---|
  | αρχεία που **κρίνουν** με σύνολο ρόλων | 20 | **18** |
  | σταθερές `ADMIN_ROLES`/`ADMIN_GLOBAL_ROLES` | 7, με **5** περιεχόμενα | 4, με 2 |
  | αρχεία που δηλώνουν `requiredGlobalRoles` στο `withAuth` | **29** | 29 |

  **Τρία ξεχωριστά κομμάτια, ΟΧΙ ένα:**

  1. **Φάση 3β — οι server απαντητές** *(`admin-guards.ts hasAdminRole` email fallback · τα δύο
     `ADMIN_ROLES`/`AdminRole` · `EnterpriseSecurityService.checkUserRole`)*.
     ⛔ **ΜΠΛΟΚΑΡΙΣΜΕΝΟ από τη Φάση 2γ**: ο `pagonis.oe@gmail.com` παίρνει διαχειριστή **μόνο**
     μέσω `NEXT_PUBLIC_ADMIN_EMAILS` (ADR-801 §2.3) — αφαίρεση πρώτα τον **κλειδώνει έξω**,
     μετρημένα (5.927 συνδέσεις). **Πρώτα claims, μετά αφαίρεση.**

  2. ✅ **Φάση 3γ — ΕΚΛΕΙΣΕ (25/08)** *(ADR-801 §2.8 · §2.9)*. Ο **ΕΝΑΣ αναγνώστης** του claim
     (`lib/auth/claim-permissions.ts`, **ισομορφικός**)· το `AuthContext` το κουβαλά και **οι
     ΔΥΟ** παραγωγοί το γεμίζουν· ο `checkPermission` το τιμά σε **εμβέλεια ΕΤΑΙΡΕΙΑΣ**
     (`source: 'company_scoped_claim'`). **67 άγκυρες / 10 μεταλλάξεις κόκκινες.**
     🔴 **Η φάση ήταν μεγαλύτερη από όσο δηλωνόταν**: το claim διαβαζόταν **τρεις φορές με
     τρεις κανόνες** και οι **ΔΥΟ** παραγωγοί `AuthContext` δεν το ρωτούσαν — ο δεύτερος
     (`server/auth/page-identity.ts`, Server Components) **δεν τον ονόμαζε κανένα κείμενο**.
     🔴 **§2.9 — fail-open στον server που βρήκε η ισοδυναμία**: το κοινό `isValidPermission`
     έκανε `in` ⇒ το `'toString'` περνούσε και ο `super_admin` έπαιρνε **✅ από το bypass**.
     ⚠️ **ΜΗΝ κάνεις το claim να κληρονομεί σε ερώτημα με πόρο** — άγκυρα `Α4`, και ο λόγος
     είναι ότι το claim **περιέχει** τα permissions του ρόλου, άρα θα έκανε το **ίδιο**
     permission id να συμπεριφέρεται αλλιώς ανάλογα με τη διαδρομή παράδοσης.

  3. ✅ **Φάση 4 — CHECK 3.68 ΕΚΛΕΙΣΕ (25/08)**. Η πύλη τρέχει, μπλοκάρει, και είναι
     βαθμονομημένη στον **πραγματικό ιστορικό κώδικα** (`3188b211` ⇒ `foreman`/`client` 🔴).
     ⚠️ **Ο αριθμός είναι 3.68, ΟΧΙ 3.66**: άλλος πράκτορας πήρε τα 3.66 **και** 3.67 ενώ
     έτρεχε η δουλειά, στο **ίδιο** working tree.
     🔴 **ΜΕΝΕΙ ΕΚΣΤΡΑΤΕΙΑ**: **14** αρχεία κρίνουν ακόμη με δικό τους σύνολο ρόλων, σε
     **ratchet κατά ταυτότητα** — *ο αριθμός ΔΕΝ είναι δείκτης υγείας, είναι μέτρο εκστρατείας
     που τελειώνει στο μηδέν*. Θεραπεία = `decideCapability`, ανά αρχείο, με τις Φάσεις 3β/3γ.
     🔑 **Η ΑΠΟΦΑΣΗ ΤΩΝ 8 ΟΜΟΙΟΜΟΡΦΩΝ ROUTES ΠΑΡΘΗΚΕ, ΜΙΑ ΦΟΡΑ**: πάνε σε
     `withAuth(h, { permissions: ['admin_access'] })`, **όχι** σε
     `hasPermission(ctx, action, { projectId })`. Ο λόγος έγινε **μετρήσιμος** με τη
     Φάση 3γ: το ρητό claim μετράει πλέον **και στον server**, άρα το «ικανότητα αντί
     για ρόλο» δεν είναι πια μετονομασία — είναι **λειτουργική** αλλαγή που τιμά την
     παραχώρηση. ⚠️ **ΜΗΝ βάλεις `decideCapability` σε API route**: ο server έχει δικό
     του PDP με διάσταση πόρου· ο σύγχρονος κριτής εκεί θα ήταν **λιγότερο** αυστηρός.
     ⚠️ Οι **29** `requiredGlobalRoles` **δεν** μετριούνται ως παράβαση — είναι PEP που δηλώνει
     πολιτική σε **ένα** σημείο επιβολής (η πύλη τα ταξινομεί ρητά ως `policy-declaration`, 12
     αρχεία). Το ανοιχτό ερώτημα είναι *«γιατί δηλώνουν **ΡΟΛΟ** και όχι **ΙΚΑΝΟΤΗΤΑ**;»* —
     κατάλογος ρόλων σε 29 σύνορα είναι αντίγραφο του `PREDEFINED_ROLES` που θα αποκλίνει με
     τον ίδιο μηχανισμό που απέκλιναν οι 2 λίστες namespace του 3.34 (**63**).

  ⚠️ **ΜΗΝ ξαναγράψεις κριτή** — υπάρχει (`lib/auth/authority.ts`, 30 άγκυρες). **Grep πρώτα.**

- 🔴 **25/08 — Η ΕΦΑΡΜΟΓΗ ΥΠΟΣΧΕΤΑΙ ΟΨΕΙΣ ΠΟΥ ΔΕΝ ΦΟΡΤΩΝΕΙ ΠΟΤΕ** *(βρέθηκε στην εκστρατεία ADR-799 Φάση 3)*

  Το `CAD_SUBSTITUTE_FONTS` φορτώνει **μία** όψη — `Roboto-Regular.ttf` ως «Liberation Sans».
  Ο `FONT_SUBSTITUTION_TABLE` όμως υπόσχεται `romand.shx → **Liberation Sans Bold**`, όψη που
  **δεν φορτώνεται ΠΟΤΕ** ⇒ ο `resolveEntityFont` επιστρέφει `null` ⇒ **κάθε έντονο και κάθε
  πλάγιο κείμενο CAD** μετριέται και βάφεται από την **εφεδρική του browser**, όχι από την όψη
  που υποσχόμαστε.

  ⚠️ **Οι 15 τυφλές σουίτες του CHECK 3.64 ήταν το ΣΥΜΠΤΩΜΑ αυτού** — στο jest δεν υπάρχει
  browser, οπότε το ίδιο `null` καταλήγει στη **βαθμίδα 3**. Η Φάση 3 έκλεισε τη **δοκιμαστική**
  πλευρά (όψεις-υποκατάστατα ανά σουίτα)· η **παραγωγική** μένει.

  **Θεραπεία**: `Roboto-Bold` / `Roboto-Italic` / `Roboto-BoldItalic` στο `public/fonts/`
  *(**Apache-2.0**, ίδια οικογένεια με το ήδη ενσωματωμένο — N.5 καθαρό)* + τρεις γραμμές στο
  `CAD_SUBSTITUTE_FONTS` + οι αντίστοιχες `@font-face` στο `css-font-registry`. Ο resolver
  **είναι ήδη έτοιμος**: από τη Φάση 3 ψάχνει συμμετρικά `«… Bold» / «… Italic» / «… Bold Italic»`.

  ✅ **Ο ΦΡΟΥΡΟΣ ΕΓΙΝΕ — CHECK 3.67 / ADR-803**: το χρέος είναι πλέον **ονομασμένο, μετρημένο**
  *(4 στις 5 υποσχέσεις ανεκπλήρωτες)* **και φυλασσόμενο** — καμία **πέμπτη** σιωπηλή υπόσχεση
  δεν μπορεί να προσγειωθεί. Η πύλη ελέγχει **επιπλέον** ότι το αρχείο κάθε φορτωμένης όψης
  υπάρχει όντως — έλεγχος που ούτε το AutoCAD κάνει (εκείνο το ανακαλύπτει στο **άνοιγμα**).

  🔴 **ΜΕΝΕΙ Η ΑΠΟΦΑΣΗ GIORGIO — αλλάζει ΤΙ ΖΩΓΡΑΦΙΖΕΙ η εφαρμογή** (έντονο/πλάγιο θα περνούν
  από glyph paths αντί για CSS σύνθεση) και προσθέτει δυαδικά αρχεία. **N.8 — δική του συνεδρία.**

  ⚠️ **ΜΗΝ** «λύσεις» το κόκκινο αλλάζοντας το `substituteFamily` σε κάτι φορτωμένο: αυτό σβήνει
  την πρόθεση «έντονο» και κάνει τη σιωπηλή υποβάθμιση **μόνιμη και αόρατη**.

- 🔶 **25/08 — ΤΟ `table-cell-clipping` ΕΠΑΛΗΘΕΥΕΙ ΤΗΝ ΟΘΟΝΗ ΣΕ ΔΙΑΜΟΡΦΩΣΗ ΠΟΥ Η ΠΑΡΑΓΩΓΗ ΔΕΝ ΕΧΕΙ ΠΟΤΕ**

  Η σουίτα κρίνει ισοτιμία **τεσσάρων** backends («κόβει το ίδιο κείμενο η οθόνη, τα primitives,
  η εξαγωγή, το φύλλο;»). Το backend #1 διαβάζει με τον καταγραφέα ζωγραφικής, που καταγράφει
  `ctx.fillText`. Μετρημένο: μόλις **φορτωθεί όψη**, το `stamp-table-text.ts:157` ζωγραφίζει με
  `paintTextRun` ⇒ `ctx.fill(Path2D)` ⇒ ο καταγραφέας το βλέπει ως `fillPaths` **χωρίς κείμενο**
  ⇒ το `screenText()` γυρίζει **κενή συμβολοσειρά**.

  🔴 **Συνέπεια**: το backend #1 επαληθεύεται **μόνο όταν ΔΕΝ υπάρχει γραμματοσειρά** — δηλαδή
  ποτέ στην παραγωγή. Το πράσινό του είναι δήλωση για διαδρομή που ο χρήστης δεν βλέπει.

  **Γι᾽ αυτό ΔΕΝ δηλώθηκε στο `.text-measure-tier.json`**: μια δήλωση λέει «τυφλό αλλά αβλαβές»,
  και εδώ είναι **μπλοκαρισμένο**. Μένει στη baseline του CHECK 3.64 ως **ονομασμένο χρέος**
  *(1 σουίτα)*, που είναι η ειλικρινής θέση.

  **Θεραπεία**: το `GlyphRun` κρατά **μόνο** `path` + `metrics` — καμία συμβολοσειρά. Χρειάζεται
  ο καταγραφέας (`testing/paint-recorder.ts`, ADR-775 §13) να μπορεί να δει κείμενο γραμμένο ως
  glyph run. Είναι **άλλο ερώτημα** *(ADR-739 §19.8 / §23)*, αγγίζει κοινό test SSoT δέκα σουιτών.
  **N.8 — δική του συνεδρία.**

- 🔶 **25/08 — ΕΝΤΕΚΑ ΠΥΛΕΣ ΤΡΕΧΟΥΝ ΚΑΙ ΜΠΛΟΚΑΡΟΥΝ COMMITS ΧΩΡΙΣ ΚΑΜΙΑ ΓΡΑΜΜΗ ΣΤΟ CLAUDE.md**

  ✅ **Η ΠΥΛΗ ΕΓΙΝΕ** — **CHECK 3.66 / ADR-802** *(«είναι κάθε πύλη που τρέχει γραμμένη στον
  οδηγό, και αντίστροφα;»)*. Το χρέος είναι πλέον **ονομασμένο, μετρημένο και φυλασσόμενο**:
  ratchet **κατά ταυτότητα**, ώστε η ανταλλαγή «τεκμηρίωσα το Α, πρόσθεσα αδήλωτο το Β» να
  **μην** περνά αθόρυβα.

  **Μένει η ΕΚΣΤΡΑΤΕΙΑ**: **11** πύλες χρειάζονται γραμμή που να λέει την αλήθεια —
  `3.5`·`3.6`·`3.11`·`3.12`·`3.19`·`3.20`·`3.21`·`3.24`·`3.25`·`3.26`·`3.27`
  *(η ζωντανή λίστα είναι στο `.gate-inventory-baseline.json` — **άνοιξε το JSON**)*.

  ⚠️ **Η γραμμή γράφεται από όποιον ΞΕΡΕΙ την πύλη.** Δεν είναι μηχανική δουλειά: κάθε γραμμή
  αυτού του πίνακα κουβαλά **το περιστατικό, τη μέτρηση και τις παγίδες**. Μια γραμμή γραμμένη
  στα τυφλά είναι **χειρότερη** από καμία — γι' αυτό ο μηχανισμός είναι ratchet και όχι
  zero-tol. **N.13 · μία-μία, όποτε αγγίζει κανείς την αντίστοιχη πύλη.**

  🔴 **ΔΥΟ ΠΑΓΙΔΕΣ, ΜΕΤΡΗΜΕΝΕΣ ΤΗ ΣΤΙΓΜΗ ΤΗΣ ΓΕΝΝΗΣΗΣ ΤΗΣ ΠΥΛΗΣ**:
  *(α)* **ΜΗΝ απαριθμήσεις τις αδήλωτες μέσα σε γραμμή του πίνακα** — η πρώτη εκδοχή της
  γραμμής του 3.66 το έκανε και η μέτρηση **κατέρρευσε 9 → 0**: η πύλη γινόταν πράσινη επειδή
  **περιέγραψε** το χρέος. Οι αναφορές μετρώνται πλέον **έξω** από τις γραμμές του πίνακα
  *(άγκυρα `Κ4β`)*.
  *(β)* **Η αυθεντία είναι ΕΝΩΣΗ** δρομολογητή + hook + κλειστού συνόλου. Κριτήριο καρφωμένο
  σε **μία** μορφή δρομολόγησης (`addThread`) κατήγγειλε τα `3.9`/`3.10` ως φαντάσματα —
  **2 ψευδώς θετικά στα 3**.

- 🔴 **24/08 — ΔΥΟ ΕΞΑΓΩΓΕΙΣ IFC ΣΤΟ ΙΔΙΟ ΔΕΝΤΡΟ, ΚΑΙ Ο ΕΝΑΣ ΠΑΡΑΓΕΙ ΑΚΥΡΟ IFC ΜΕ ΕΛΛΗΝΙΚΑ** *(βρέθηκε στο SSoT audit της Φάσης 4 του ADR-798)*

  | | `src/services/ifc/` | `src/subapps/dxf-viewer/systems/guides/guide-ifc-exporter.ts` |
  |---|---|---|
  | Μέγεθος | **3.003** γρ., 17 αρχεία | **366** γρ., 1 αρχείο |
  | Μηχανισμός | `IfcGraph` + discriminated union | **συρραφή συμβολοσειρών** |
  | STEP21 escaping | ✅ `\X2\…\X0\` κατά ISO 10303-21 | 🔴 **ΜΗΔΕΝ** |
  | Εμβέλεια | ολόκληρο το έργο | μόνο ο κάνναβος |
  | Ζωντανός; | ✅ `IfcExportHost.tsx:73` | ✅ `ExportTab.tsx:36` |

  🔴 **Το μετρήσιμο ελάττωμα**: ο δεύτερος γράφει `#n=IFCGRIDAXIS('${guide.label}',…)` **ωμά**
  *(μηδέν εμφανίσεις escaping σε όλο το αρχείο)*. Το `guide.label` το γράφει **ο χρήστης** ⇒ μια
  ελληνική ετικέτα ή ένας **απόστροφος** παράγει **άκυρο κατά ISO 10303-21 αρχείο**, που ο
  αναφορικός parser μπορεί να αρνηθεί. Δεν είναι υποθετικό: ο πρώτος εξαγωγέας έχει άγκυρα
  *(`ifc-roundtrip.test.ts`, «emits long Greek storey names verbatim»)* ακριβώς γι' αυτό — δηλαδή
  **το πρόβλημα είναι γνωστό και λυμένο, σε ένα μόνο από τα δύο σπίτια**.

  **Είναι το σχήμα του ADR-749**: δύο μηχανές που απαντούν το ίδιο ερώτημα *(«πώς γράφεται IFC4
  STEP21;»)*, με **διαφορετική** ορθότητα. Η θεραπεία είναι να μεταναστεύσει ο εξαγωγέας καννάβου
  στο `IfcGraph` *(ο κάνναβος είναι `IfcGrid` + `IfcGridAxis` — τα εκφράζει ήδη το `graph.add()`)*,
  **όχι** να αντιγραφεί η `ifcString()` σε δεύτερη θέση.

  ⚠️ **Η Φάση 4 του ADR-798 μπήκε ΜΟΝΟ στον πρώτο**, και αυτός ήταν ο λόγος: το `escoLabel` είναι
  ελληνικό. **Ο δεύτερος δεν αγγίχτηκε.**

  **N.8** — 2 τομείς, ~5+ αρχεία, θέλει δική του συνεδρία. **Απόφαση Giorgio.**

- 🔴 **24/08 — `IfcOwnerHistory` ΜΟΝΟ ΣΤΟ `IfcProject`** *(δηλωμένο όριο ADR-798 §6.3/Φάση 4, όχι ελάττωμα)*

  Η Φάση 4 έδεσε την αλυσίδα ιδιοκτησίας στη **ρίζα** του αρχείου. Οι υπόλοιπες οντότητες
  *(`IfcSite` · `IfcBuilding` · `IfcBuildingStorey` · τοίχοι/πλάκες/… · `IfcRelAggregates`)*
  κρατούν κενό `OwnerHistory` — **έγκυρο**, γιατί το IFC4 έκανε το `IfcRoot.OwnerHistory`
  **OPTIONAL**.

  Το να δεθεί **παντού** είναι ~10 σημεία στο `ifc-spatial-hierarchy.ts` + **6** serializers, και
  **δεν** προσθέτει νόημα σήμερα: θα δήλωνε ότι ο ίδιος χρήστης «κατέχει» κάθε τοίχο, ενώ δεν
  υπάρχει **ιστορικό αλλαγών ανά οντότητα** για να το στηρίξει. Θα είχε νόημα **μαζί** με τέτοιο
  ιστορικό *(πρότυπο Geometry Gym: διαφορετικό owner history ανά αναθεώρηση)* — δηλαδή είναι
  **χαρακτηριστικό**, όχι εκκρεμότητα καθαριότητας.

  **Καταγράφεται για να μη διαβαστεί ως παράλειψη.** **Απόφαση Giorgio.**

- 🔶 **25/08 — Το `precommit-checks.md` έχει αποκλίνει από το μητρώο των πυλών**

  Το CLAUDE.md δηλώνει *«📘 Full details: `docs/centralized-systems/reference/precommit-checks.md`»*,
  αλλά το αρχείο **δεν έχει ενότητα** για τα CHECK **3.55 · 3.56 · 3.57 · 3.58 · 3.59 · 3.60 ·
  3.61 · 3.63** *(το 3.65 προστέθηκε στις 25/08)*. Ο δείκτης «πλήρεις λεπτομέρειες» δείχνει σε
  έγγραφο που **δεν** τις έχει — το ίδιο σχήμα «δύο λίστες που αποκλίνουν» που έχει πληρωθεί σε
  **3.34** (63) · **3.37** (18 vs 26) · **3.57** (19/20).

  ⚠️ Η θεραπεία **δεν** είναι να γραφτούν οκτώ ενότητες με το χέρι — είναι να αποφασιστεί **ποιο
  έγγραφο είναι η αυθεντία**: αν είναι το CLAUDE.md, ο δείκτης να αλλάξει· αν είναι το
  `precommit-checks.md`, χρειάζεται **πύλη** που να απαιτεί ενότητα ανά καταχωρημένο CHECK
  *(αλλιώς θα ξανα-αποκλίνει σε τρεις πύλες)*. **Απόφαση Giorgio.**

- 🔴 **24/08 — Ο `AuthContextType` ΔΗΛΩΝΕΤΑΙ ΔΥΟ ΦΟΡΕΣ, ΚΑΙ Ο ΕΝΑΣ ΕΧΕΙ ΗΔΗ ΑΠΟΚΛΙΝΕΙ**

  `AuthContext.tsx:35` *(interface — **ο ζωντανός**, αυτόν επιστρέφει το `useAuth()`)* έναντι
  `auth.types.ts:115` *(`AuthContextState & AuthContextActions`)*. Ο δεύτερος **δεν έχει**
  ούτε `declaredOccupation` *(Φάση 2)* ούτε `updateDeclaredOccupation` *(Φάση 3 Κ4)* —
  δηλαδή **έχει ήδη αποκλίνει κατά δύο μέλη**.

  🔴 **Το σύνορο τον κάνει παγίδα**: το `src/auth/index.ts:102` επανεξάγει τον **στάσιμο**,
  οπότε `import type { AuthContextType } from '@/auth'` δίνει **άλλο σχήμα** από ό,τι
  επιστρέφει το `useAuth()`. **Λανθάνον σήμερα** *(μηδέν καταναλωτές το επικαλούνται
  ρητά — ολοι παίρνουν τον τύπο με συμπερασμό από το `useAuth()`)*, αλλά ο πρώτος
  που θα γράψει ρητό annotation θα δει σφάλμα τύπου σε κώδικα που δουλεύει.

  ⚠️ **ΔΕΥΤΕΡΟ στιγμιότυπο του ίδιου σχήματος στον ίδιο φάκελο, μέσα σε μία μέρα**
  *(βλ. και το `useAuth` παρακάτω)*. Η θεραπεία είναι **μία δήλωση** — αλλά η διαγραφή
  του στάσιμου αγγίζει το δημόσιο barrel, άρα **θέλει δικό του βήμα** μαζί με το `useAuth`.

- 🔴 **24/08 — ΔΥΟ `useAuth` ΜΕ ΤΟ ΙΔΙΟ ΟΝΟΜΑ ΚΑΙ ΔΙΑΦΟΡΕΤΙΚΗ ΕΓΓΥΗΣΗ** *(βρέθηκε στο SSoT audit της ADR-798 Φάσης 3)*

  **Μετρημένο 24/08**: `src/hooks/useAuth.ts` *(ωμό `onAuthStateChanged`, επιστρέφει **μόνο**
  `{user, loading}`)* έχει **58** καταναλωτές· το `@/auth` → `src/auth/hooks/useAuth.ts`
  *(pass-through στο `AuthContext`, επιστρέφει **19 πεδία** — `declaredOccupation`, `signIn`,
  `mfaResolver`, …)* έχει **14**. **Ίδιο όνομα, ίδια υπογραφή κλήσης, άλλο συμβόλαιο.**

  🔴 **Γιατί είναι επικίνδυνο και όχι απλώς άσχημο**: ένας πράκτορας που γράφει
  `const { declaredOccupation } = useAuth()` και τυχαίνει να εισαγάγει από `@/hooks/useAuth`
  παίρνει **`undefined`** — **καμία πύλη δεν το πιάνει**, ο μεταγλωττιστής δεν παραπονιέται
  *(δεν υπάρχει το πεδίο, άρα σφάλμα τύπου — αλλά μόνο αν τρέξει `tsc`, που ο N.17 απαγορεύει
  στον πράκτορα)*, και στην οθόνη φαίνεται ως *«ο χρήστης δεν έχει επάγγελμα»* **για πάντα**.
  Στη Φάση 3 το απέφυγα **διαβάζοντας** και τα δύο αρχεία, όχι υποθέτοντας.

  Είναι **ακριβώς** το σχήμα του **CHECK 3.59 / ADR-792** *(`Point3D` που δεν εγγυόταν `z`:
  **216 vs 49** χρήσεις)* — *το όνομα δηλώνει τι **ΕΓΓΥΑΤΑΙ***. Εδώ το `useAuth` δηλώνει
  «αυθεντικοποίηση» και **δεν** λέει **ποια**.

  ⚠️ **ΜΗΝ το «λύσεις» ενοποιώντας τα 58 στο context**: ο ωμός hook είναι **φθηνότερος** *(μηδέν
  context, μηδέν re-render από 19 πεδία)* και σε 58 σημεία αυτό μετράει. Η θεραπεία είναι
  **ΟΝΟΜΑ**: το ένα να λέει τι εγγυάται *(π.χ. `useFirebaseUser`)* — μετονομασία, όχι συγχώνευση.
  ⚠️ **Η εμβέλεια του CHECK 3.59 είναι σήμερα ο DXF viewer** *(`scopes`)*, άρα **δεν το βλέπει**·
  επέκταση εμβέλειας είναι **δική της** απόφαση, όχι πάρεργο αυτής της δουλειάς.

  **Μέγεθος**: 58+14 αρχεία, 2 τομείς ⇒ **N.8: θέλει δική του συνεδρία και έγκριση Giorgio.**

- 🔶 **25/08 — ΤΟ ΥΠΟΛΕΙΜΜΑ ΤΟΥ `visual-regression-basic`: ΜΙΑ ΚΟΚΚΙΝΗ, ΙΔΙΑ ΡΙΖΑ ΜΕ ΤΟ CHECK 3.64**

  Οι **δύο από τις τρεις** έκλεισαν στο `14e02c5f` *(στάσιμοι ισχυρισμοί: ζητούσαν κάδο
  `devDependencies` για εξάρτηση που το `68b27b8a` μετακίνησε **σκόπιμα** στα runtime, και
  script `test:visual` που το CHECK 3.46 είχε **σωστά** σβήσει στο `cb29ed75`)*.

  🔴 **Μένει το `mock 2d context available`**: `canvas.getContext('2d')` → `null`, επειδή το
  `pnpm.overrides['jsdom>canvas'] = '-'` *(`19fbc2cc`, αλυσίδα CVE του `tar` — **σωστό**)*
  αφαίρεσε το canvas από το jsdom. **Ίδια ρίζα** με τις 15 τυφλές σουίτες του CHECK 3.64 και με τις
  όψεις CAD παραπάνω — τρία συμπτώματα, **ένα** αίτιο.

  ⚠️ **ΔΕΝ διορθώνεται εδώ επίτηδες**: η θεραπεία είναι απόφαση τομέα *(custom jest environment με
  `@napi-rs/canvas`, που αλλάζει πλάτη σε δεκάδες ισχυρισμούς — βλ. «εκστρατεία των 15»)*. Το
  **σπίτι** αυτής της κόκκινης είναι η `.jest-suite-baseline.json` *(CHECK 3.54)*, ως δηλωμένο
  χρέος **με όνομα** — και η baseline **δεν έχει σπαρθεί ακόμη**.

- 🔶 **25/08 — Η ΕΚΣΤΡΑΤΕΙΑ ΤΩΝ 15: σουίτες που κρίνουν κείμενο με τυφλό όργανο** *(CHECK 3.64 ✅ έκλεισε· η **θεραπεία** μένει)*

  Η πύλη **υπάρχει και μετρά** (ADR-799 Φάση 2, ratchet κατά ταυτότητα, μητρώο CI 34 → 35).
  Αυτό που μένει είναι η **δουλειά ανά σουίτα**, και είναι **ανά περίπτωση** επειδή πρέπει πρώτα
  να απαντηθεί: «**κρίνει πλάτος αυτή η σουίτα;**»

  🔴 **Η ΜΕΤΡΗΣΗ ΑΝΕΤΡΕΨΕ ΤΟΝ ΣΧΕΔΙΑΣΜΟ**: το ADR-799 §7 έλεγε **41** (μετρώντας «σουίτες χωρίς
  `installStubFont`»). Η **ζωντανή απογραφή** έδωσε **61** που αγγίζουν τον μετρητή και **ΜΟΛΙΣ
  15** τυφλές — **32** μετρούν `nominal` χωρίς να ζητούν κανέναν άξονα *(η βαθμίδα απαντά
  **ακριβώς** την ερώτηση, **δεν** είναι παράβαση)* και **14** φτάνουν tier 1/2. Το «41» ήταν
  μέτρηση **άλλου πράγματος**, με **>68%** ψευδώς θετικά.

  **Οι πυκνότερες** *(μετρήσεις × άξονες που χάνονται)*: `text-layout-run-parity` **278**
  (bold+family+italic) · `text-layout-justify-spacing` **269** (family) ·
  `table-typography-specimen` **160** (και τα τρία) · `footing-detail-sheet` **130** (bold) ·
  `table-cell-clipping` 100 · `beam-detail-sheet` 90 · `text-layout-rich-mtext` 87 (family).
  Πλήρης λίστα: `npm run text-measure:report`.

  **Θεραπεία**: `installStubFontPair(family)` στο `beforeEach`. ⚠️ Για **bold** χρειάζεται
  **ΖΕΥΓΟΣ**: ο `resolveEntityFont` για bold **παρακάμπτει** την άμεση εύρεση και ζητά
  «<οικογένεια> Bold», αλλιώς επιστρέφει **`null` ΕΠΙΤΗΔΕΣ** — σκέτο `installStubFont` αφήνει το
  απλό σε tier 1 και το έντονο σε tier 3 ⇒ πράσινο **συγκρίνοντας δύο διαφορετικά όργανα**.

  ⚠️ **ΜΗΝ** εγκαταστήσεις **καθολική** όψη στο jest setup — μετρήθηκε και απορρίφθηκε: δεκάδες
  σουίτες υπολογίζουν με το χέρι `len × height × 0,6`, που **είναι** ο τύπος του tier 3·
  καθολική όψη πολλαπλασιάζει κάθε πλάτος **επί ~1,25** ⇒ δεκάδες κόκκινες σε ένα βήμα, **και
  κρύβει ξανά το ερώτημα της βαθμίδας**.

  ⚠️ **Ο αριθμός 15 ΔΕΝ είναι δείκτης υγείας** — είναι «όσες σουίτες κρίνουν κείμενο με όργανο
  που δεν βλέπει το στυλ τους». Κάθε μία που θεραπεύεται: `npm run text-measure:census &&
  npm run text-measure:baseline`.

  🔶 **Ανοιχτό ερώτημα τομέα**: η **ρίζα** παραμένει ότι το jsdom δεν έχει canvas. Το
  `@napi-rs/canvas` είναι **ήδη** dependency της ρίζας (μετακινήθηκε εκεί στη δουλειά CVE) και
  θα μπορούσε να δώσει tier 2 πίσω σε **όλες** τις σουίτες με ένα custom jest environment —
  **αλλά** θα άλλαζε τα πλάτη σε δεκάδες ισχυρισμούς που σήμερα υπολογίζουν με τον τύπο του
  tier 3. **Δεν μετρήθηκε πόσους**· είναι απόφαση Giorgio αν αξίζει.

- 🔶 **[ιστορικό] 24/08 — allowlist CVE: 4 με μετρημένο λόγο, 8 υπό αίρεση**
  *(ADR-598 G2· πλήρης μέτρηση στο ADR-598, changelog 25/08)*
  ✅ `fast-xml-parser` ×3 + `serialize-javascript` ×1 **αιτιολογήθηκαν** (μη προσπελάσιμα,
  μετρημένα· override για το πρώτο **έτοιμο και ασφαλές**, για το δεύτερο **απαγορεύεται**
  γιατί σπάει καθαρό clone). ⏳ Οι **8** του `jspdf` μένουν `Seeded` **σκόπιμα**: αν γίνει η
  αναβάθμιση σε `^4.2.1` **εξαφανίζονται**, οπότε αιτιολόγηση τώρα = δουλειά για πέταμα.
  ⛔ **Εκκρεμεί ΜΟΝΟ απόφαση Giorgio** — και τα τρία ανοιχτά (jspdf bump · override
  `fast-xml-parser@4` · μετακίνηση `@napi-rs/canvas`) γράφουν το κοινό `pnpm-lock.yaml`.

- 🔶 **24/08 — [ιστορικό] allowlist CVE: 12 εγγραφές, ΚΑΜΙΑ με λόγο** *(ADR-598 G2)*
  Μετά την εξάλειψη του `tar` (21 → 12), **και οι 12** εγγραφές του `.pnpm-audit-baseline.json`
  λένε `reason: "Seeded — pre-existing transitive advisory"`. **Μια allowlist χωρίς αιτιολογία δεν
  είναι απόφαση, είναι αναβολή** — και το «12» δεν είναι δείκτης υγείας, είναι «όσα κανείς δεν
  ξανακοίταξε».

  Κατανομή: **`jspdf` 8** (**2 critical** — Path Traversal `CVE-2025-68428` και HTML Injection
  `CVE-2026-31938` — **+6 high**· ⚠️ αυτή η γραμμή έλεγε «4 critical»: **μετρημένο 25/08 από το
  ίδιο το `.pnpm-audit-baseline.json`, είναι 2**) ·
  `fast-xml-parser` 3 · `serialize-javascript` 1. Το `jspdf` είναι **άμεση** εξάρτηση ⇒ ο δρόμος
  «αφαίρεση» **δεν υπάρχει**· θέλει **αναβάθμιση**, με μέτρηση του breaking surface.

  ⚠️ **Ο μηχανισμός διόρθωσης υπάρχει πλέον**: από 24/08 το `--write-baseline` **διατηρεί** το
  `reason`/`owner` (`mergeAllowlistEntry`), άρα μια χειρόγραφη αιτιολόγηση **δεν σβήνεται πια** από
  το επόμενο rebaseline. Μέχρι 24/08 σβηνόταν, και γι᾽ αυτό κατέληξαν όλες «Seeded».

- 🔴 **25/08 — ΔΙΟΡΘΩΣΗ ΔΙΑΓΝΩΣΗΣ: το jest config ΔΕΝ είναι νεκρό· το εύρημα είναι μεγαλύτερο**
  *(ADR-598 G2, changelog 25/08)* Το `src/subapps/dxf-viewer/jest.config.ts` **δουλεύει** και
  είναι **τεκμηριωμένη χειροκίνητη εντολή** σε δύο handoffs (29-30/07)· εκτελέστηκε το ίδιο test
  και με τα δύο configs ⇒ **40/40 ταυτόσημα**. **ΜΗΝ το διαγράψεις.**
  🔴 Το πραγματικό: το `src/subapps/dxf-viewer/package.json` είναι **workspace package με δεύτερο
  manifest εφαρμογής**, αποκλίνον κατά **ολόκληρη major**: `next` 15.5 vs **14.2** · `react` 19 vs
  **18** · `jest` 30 vs **29** · `jsdom` 27 vs **24** (+46 scripts που δείχνουν σε ανύπαρκτα
  μονοπάτια). Το ερώτημα είναι «**πρέπει να είναι workspace package;**» — **απόφαση Giorgio**,
  γράφει το lockfile.
  📐 **ΜΕΤΡΗΘΗΚΕ ΠΛΗΡΩΣ 25/08**: το manifest είναι **διακοσμητικό** για react/next/firebase
  (λύνονται από τη ρίζα ούτως ή άλλως) αλλά **ΠΡΑΓΜΑΤΙΚΟ** για **`jest` (29 vs 30)** και
  **`jsdom` (24 vs 27)** — και το ίδιο manifest έχει script `"test": "jest"` ⇒ όποιος τρέξει
  tests από μέσα παίρνει **άλλη μηχανή από το CI** (σχήμα ADR-749). Ανωμαλία **1 στα 5**
  subapps· **μηδέν** αναφορές στο `nextn-dxf-viewer`. **Πρόταση: αφαίρεση του package.json**
  (οι προϋποθέσεις επαληθεύτηκαν). ⛔ Δεν εκτελέστηκε — γράφει lockfile, **απόφαση Giorgio**.
  ✅ **Έγινε**: αφαιρέθηκε το νεκρό `@mapbox/node-pre-gyp` από το `serverExternalPackages`
  (`next.config.js`) — επαληθευμένα ανύπαρκτο στο δέντρο, μηδέν επίδραση σε lockfile.

- 🔶 **24/08 — [ιστορικό] νεκρό jest config + λάθος ταξινόμηση εξάρτησης στο dxf-viewer** *(ADR-598 G2, παράπλευρα ευρήματα)*
  (α) Το `src/subapps/dxf-viewer/jest.config.ts` **δεν το εκτελεί κανείς**: δεν είναι ένα από τα 5
  configs του CHECK 3.47, δεν υπάρχει npm script, δεν υπάρχει workflow. Συνέπεια: το `jsdom@24.1.3`
  στις devDependencies του workspace είναι **νεκρό** — και ήταν η **δεύτερη** διαδρομή προς το
  ευάλωτο `tar`, που έμεινε αόρατη επειδή το `pnpm why` από τη ρίζα **δεν διασχίζει workspaces**.

  (β) Το `@napi-rs/canvas` είναι σε **devDependencies** ενώ το καλεί **server-only κώδικας
  παραγωγής** (`pdf-rasterize.service.ts`, μέσω `openai-quote-analyzer` και `logo-extractor`).
  Σήμερα σώζεται επειδή το standalone build το ιχνηλατεί, αλλά η ταξινόμηση είναι λάθος — και μετά
  την αφαίρεση του node-canvas είναι **φέρον στοιχείο ορθότητας** (δίνει `DOMMatrix`/`Path2D`).

  ⚠️ Και τα δύο είναι **καθαρισμός**, όχι βλάβη σήμερα. Απόφαση Giorgio για προτεραιότητα.

- 🔶 **23/08 — η οικογένεια MEP design: ΤΕΣΣΕΡΑ δίδυμα, 16 γραμμές το καθένα** *(ADR-794 Φ.11)*
  Μετρημένο με `jscpd`: `design-fire` · `design-gas` · `design-hvac` · `design-water-supply`
  μοιράζονται **το ίδιο μπλοκ 16 γρ. / 97 tokens** — τη συναρμολόγηση του αντικειμένου-αποτελέσματος
  δικτύου (`service` · `classification` · `sourceEntityId` · `sourceConnectorId` · `sourcePoint` ·
  `sourceElevationMm` · `segments` · `servedTerminalIds` · `servedConnectors`). **Κάθε ένα κλωνοποιεί
  κάθε άλλο** — δηλαδή **έξι** ζεύγη, όχι τρία.

  ⚠️ **ΠΡΟΫΠΑΡΧΕΙ — δεν το γέννησε το ADR-794**: η αλλαγή σε αυτά τα αρχεία ήταν μόνο
  αντικατάσταση τύπου (`SpatialBounds` → `Bbox`). Φάνηκε επειδή **πρώτη φορά** βρέθηκαν στο ίδιο
  staged σύνολο. Γι' αυτό κομμιτάρονται **χωριστά** (σπλιτ, όχι `SKIP_`).

  ⚠️ **Γιατί ΔΕΝ έγινε τώρα**: το κοινό μέρος είναι ταυτόσημο, αλλά **η μονάδα όχι** —
  `totalAirflowCmh` (αέρας, m³/h) · `cumulativeLU` (μονάδες φόρτισης) · και τα αντίστοιχα του νερού /
  αερίου / πυρόσβεσης. Ένας κοινός τύπος με **ένα** όνομα πεδίου θα ήταν μία μονάδα για **τέσσερα**
  φυσικά μεγέθη — το σχήμα του ADR-749, με τον μεταγλωττιστή πράσινο. Η σωστή πράξη είναι **γενικός**
  `buildMepNetworkResult<TService>` με τη μονάδα ως **παράμετρο τύπου** *(ίδιο πρότυπο με το
  `Rect<S>` του ADR-794: ο σκελετός κοινός, ο **χώρος/μονάδα** στον τύπο)*. **>1h, 4 τομείς,
  απόφαση ανά μονάδα** ⇒ N.0.2 ⇒ pending.

- 🔶 **23/08 — τα params των MEP/παραμετρικών οικογενειών: ΕΙΚΟΣΙ ΤΡΙΑ αρχεία, ένα σχήμα** *(ADR-793 Φ.6)*
  Μετρημένο με `jscpd`: `types/electrical-panel-types.ts:64-95` ↔ `types/mep-fixture-types.ts:118-149`
  = **32 γρ. / 50 tokens** ταυτόσημα (`position`·`rotation`·`width`·`length`·`bodyHeightMm`·
  `mountingElevationMm`·`sceneUnits`·`storeyId`·`material`·`hostId`). Το ίδιο συμπλέγμα ζει
  σε **23** αρχεία του `bim/types/` (κριτήριο: δηλώνουν `readonly sceneUnits?: SceneUnits;`)
  — beam · column · floor-finish · floorplan-symbol · foundation · furniture · mep-boiler ·
  mep-fitting · mep-manifold · mep-radiator · mep-segment · mep-underfloor · mep-water-heater ·
  railing · roof · slab · slab-opening · space-separator · thermal-space · wall · wall-covering.

  ⚠️ **ΠΡΟΫΠΑΡΧΕΙ — αυτός ο γύρος ΔΕΝ το γέννησε**: επαληθεύτηκε τρέχοντας `jscpd` στις
  εκδοχές `git show HEAD:` των δύο αρχείων ⇒ **ίδιος κλώνος, ίδια 50 tokens**. Το CHECK 3.28
  τον είδε τώρα μόνο επειδή η μετάβαση `BimBounds → PlanBounds` έφερε **και τα δύο** στο ίδιο
  staged σύνολο — γι' αυτό το `mep-fixture-types.ts` πήγε σε **ξεχωριστό commit** (σπλιτ, όχι `SKIP_`).

  ⚠️ **Γιατί ΔΕΝ έγινε τώρα — και δεν είναι μόνο μέγεθος**: το σχήμα είναι ταυτόσημο,
  **η σημασία όχι**. Το `mountingElevationMm` είναι το **κέντρο** του κιβωτίου στον πίνακα και η
  **άνω έδρα** στο φωτιστικό· το `width` είναι **διάμετρος** όταν `shape === 'circular'`· το
  `bodyHeightMm` είναι **ύψος κιβωτίου** εκεί, **πάχος σώματος** εδώ. Ένα κοινό `interface` με
  **ένα** docblock θα έβαζε **μία** περιγραφή πάνω σε πεδίο με **τέσσερις** σημασίες —
  δηλαδή το σχήμα του ADR-749 (μία αλήθεια που δεν είναι αλήθεια πουθενά), με μεταγλωττιστή
  πράσινο. Η σωστή πράξη είναι **βάση τοποθέτησης** (πρότυπο Revit `Transform` + χωριστά extents,
  όπως ήδη κάνει το νέο `geometry/shared/plan-frame.ts`) με **ρητό datum ανά οικογένεια**,
  όχι σκέτο `extends` πάνω στα ονόματα των πεδίων. Υπάρχον σημείο αγκύρωσης:
  `types/mep-component-types.ts` (το `MepConnectorHostParams` κάνει **ήδη** ακριβώς αυτή τη δουλειά
  για τους connectors). **>1h, 23 αρχεία, απόφαση τομέα ανά πεδίο** ⇒ N.0.2 ⇒ pending.

- 🔶 **23/08 — `stripComments` + χειρόγραφη `REPO_ROOT`: ΕΝΤΕΚΑ κλώνοι** *(ADR-660 §5.13)*
  Μετρημένο: **12** αρχεία test δηλώνουν δικό τους `stripComments` (και τα περισσότερα δική τους
  `REPO_ROOT` ως N διαδοχικά `..`). Το SSoT **υπάρχει πλέον**: `src/test-utils/read-source.ts`, και
  μετανάστευσε **ένα** (`lib/routes/__tests__/landing.test.ts`, αδελφός του ίδιου ADR). Μένουν **11**:
  `lib/forms/__tests__/draft-identity.test.tsx` · `lib/cron/__tests__/cron-route-contract.test.ts` ·
  `features/property-grid/__tests__/catalog-grid-ssot.test.ts` ·
  `lib/auth/__tests__/resource-concealment-anchor.test.ts` ·
  `lib/firestore/__tests__/dependency-tenant-scope.test.ts` + **6** στο `subapps/dxf-viewer/`.

  ⚠️ **Γιατί δεν έγινε τώρα**: >1h σε **τέσσερις** τομείς, σε **κοινό working tree** με άλλον
  πράκτορα (κανόνας N.0.2 ⇒ pending, όχι επιτόπου). ⚠️ **Ο αριθμός `..` είναι το επικίνδυνο μέρος**,
  όχι το regex: εξαρτάται από το **βάθος του αρχείου** ⇒ σιωπηλά λάθος μόλις μετακινηθεί ένα test.
  ⚠️ Και **μην αγγίξεις** τον δεύτερο περιπατητή αρχείων του `landing.test.ts` (`collectTsFiles`):
  έχει **δική του** σημασιολογία αποκλεισμού (`node_modules` · `__tests__`), δεν είναι ίδιο ερώτημα.

- 🔶 **20/08 — `useContactsState` (321 γρ.): ΝΕΚΡΟ, και με παραπλανητικό όνομα** *(ADR-777 §8.31)*
  Το `src/hooks/useContactsState.ts` διαβάζει σωστά `searchParams.get('contactId')` και έχει
  **μηδέν καλούντες**. Ο ζωντανός είναι ο **σχεδόν ομώνυμος** `useContactsPageState`
  (`src/components/contacts/page/`). Η ομοιότητα δεν είναι ακίνδυνη: **με παραπλάνησε ζωντανά**
  στη διάγνωση του §8.31 — είδα τον νεκρό αναγνώστη, συμπέρανα «κανείς δεν διαβάζει την
  παράμετρο», και ανέφερα στον Giorgio **τέσσερις σπασμένες διαδρομές** που δεν ήταν σπασμένες.

  ⚠️ **ΔΕΝ διαγράφηκε**: εξάγει `ViewMode = 'list' | 'grid'` που το **ζωντανό**
  `ContactsHeader.tsx` εισάγει ως τύπο. Το κοινό SSoT (`useEntityPageState`) ορίζει **τέσσερις**
  τιμές, όχι δύο — άρα δεν είναι σκέτη αντικατάσταση εισαγωγής, είναι **απόφαση** για το πού ζει
  το λεξιλόγιο προβολής των επαφών. **Απόφαση Giorgio.**

- 🔶 **11/08 — `configurationComponents` (441 γρ.): ΜΗΔΕΝ καταναλωτές** *(βρέθηκε στο ADR-784 §11)*
  Το `src/styles/design-tokens/modules/configuration-components.ts` **επανεξάγεται** από τα
  `design-tokens/index.ts` και `design-tokens.ts`, αλλά `grep "configurationComponents\."` δίνει
  **μηδέν** χρήσεις σε όλο το `src/`. Δηλαδή **ολόκληρο** το module είναι δηλωμένη αυθεντία που
  **δεν τη ρωτά κανείς** — το σχήμα των «606 αδρανών φρουρών» (ADR-749 §5), σε μορφή style tokens.

  ⚠️ **ΔΕΝ διαγράφηκε**: διαγραφή module που επανεξάγεται από δύο barrel αγγίζει το
  `.deadcode-baseline.json` (CHECK 3.22) και το `.barrel-deadcode-baseline.json` (3.30) —
  **απόφαση Giorgio**. Στο μεταξύ καθαρίστηκαν οι **3 κλώνοι** του (CHECK 3.28) και μπήκε ο
  φρουρός `min(100%,…)` στα 2 πλέγματά του, ώστε να μην είναι *λάθος* όποτε ζωντανέψει.

  🔑 Το ίδιο ισχύει για το `analyticsOverviewStyles.layout.container`: **δηλωμένο, χωρίς
  καταναλωτή** — το `AnalyticsOverview.tsx` χρησιμοποιεί **μόνο** το `progressBars.*`.

- 🔴 **11/08 — ADR-783: η baseline του εκτελεστή θέλει SEEDING (μία πράξη Giorgio)**
  Το `jest-suite.yml` (Tier 2) τρέχει πλέον **ολόκληρη** τη σουίτα σε κάθε PR και μπλοκάρει με
  ratchet αποτελέσματος. Η `.jest-suite-baseline.json` **δεν υπάρχει ακόμη** — και **δεν** μπορεί
  να παραχθεί τοπικά (ολόκληρη η σουίτα γονατίζει το PC· `test-execution-budget.md`).

  **Πώς**: GitHub Actions → «T2 🧪 Jest Suite Execution (ADR-783)» → *Run workflow* με
  `seed = true` → κατέβασε το artifact `jest-suite-baseline` (ή αντίγραψέ το από το summary) →
  **commit** το `.jest-suite-baseline.json`.

  ⚠️ **Μέχρι τότε το job `suite` είναι ΚΟΚΚΙΝΟ, επίτηδες** («λείπει baseline», fail-closed): μια
  πύλη που γεννιέται πράσινη χωρίς μέτρηση είναι το «0 = κανείς δεν κοίταξε». Το job
  `reachability` (CHECK 3.54) είναι **πράσινο** από σήμερα.

  🔑 Η ίδια εκτέλεση δίνει και τον **πρώτο πραγματικό αριθμό**: πόσα αρχεία test είναι σπασμένα
  σήμερα στο `main`. **Κανείς δεν τον ξέρει** — αυτό ακριβώς είναι το θέμα.


- 🔴 **10/08 — 12 ωμά κλειδιά σε παραγωγή: το σχήμα πληθυντικού `_one/_other` ΔΕΝ λύνεται με ICU**
  **Μετρημένο, όχι υποτεθειμένο.** Το repo τρέχει **`i18next-icu`** (`src/i18n/config.ts:8`,
  `lazy-config.ts:3`). Εκτελεσμένο πείραμα με i18next+ICU:
  `t('suffix', {count})` όπου το locale έχει `suffix_one`/`suffix_other` → επιστρέφει **`"suffix"`**
  (το ωμό κλειδί)· το ICU inline `{count, plural, one {#} other {#}}` → σωστό κείμενο.
  **Το βρήκε ΑΝΘΡΩΠΟΣ σε στιγμιότυπο** (`unmapped.heading` κάτω αριστερά στο `/search/results`),
  όχι πύλη — 12η εμφάνιση του σχήματος.

  **Γιατί καμία πύλη δεν το βλέπει** (η ουσία, όχι το σύμπτωμα): το CHECK **3.8** ρωτά «**υπάρχει**
  το κλειδί;» και είναι **plural-aware κατά i18next**, δηλαδή δέχεται το `heading_one` ως απάντηση
  για το `t('heading')`. Ο **χρόνος εκτέλεσης** όμως είναι **ICU**, που δεν έχει έννοια suffix.
  **Δύο απαντήσεις σε ένα ερώτημα** (σχήμα ADR-749): η πύλη λέει «καλυμμένο», η οθόνη βάφει το κλειδί.
  Το CHECK **3.51** (ωμά κλειδιά στο SSR HTML) δεν τα πιάνει γιατί οι σειρές αυτές ζωγραφίζονται
  **μετά την ενυδάτωση**.

  **Κατάσταση:** **14** σπασμένες βάσεις × 2 γλώσσες σε **9 αρχεία locale**. **2 διορθώθηκαν**
  (10/08, ADR-777: `search-results :: unmapped.heading` · `card.bedrooms`). **Μένουν 12**, με
  **ονομαστικά** σημεία κλήσης — όλα βάφουν ωμό κλειδί **σήμερα**:

  | Κλειδί | Σημείο κλήσης |
  |---|---|
  | `addresses :: mapStatus.stale` | `components/shared/addresses/AddressMapStatusChip.tsx:67` |
  | `common-shared :: search.resultsCount` | `components/search/GlobalSearchDialog.tsx:472` |
  | `trash :: trashCount` | `components/shared/trash/TrashActionsBar.tsx:72` |
  | `contacts-lifecycle :: trash.trashCount` | `components/contacts/trash/TrashActionsBar.tsx:102` |
  | `properties-viewer :: trash.trashCount` | `components/properties/trash/PropertyTrashActionsBar.tsx:100` |
  | `trash :: restoreSuccess` · `permanentDeleteSuccess` | `hooks/useStoragesTrashState.ts:43,46` · `hooks/useBuildingsTrashState.ts:39` · `hooks/usePropertiesTrashState.ts:127` · `components/contacts/page/useContactsTrashState.ts:62` |
  | `contacts-lifecycle :: trash.restoreSuccess` | `components/contacts/trash/TrashActionsBar.tsx:64-65` · `properties/trash/PropertyTrashActionsBar.tsx:63-64` |
  | `quotes :: rfqs.comments.count` · `textFindReplace :: results.count` · `textFonts :: missingBanner.{title,affectedCount}` | (χωρίς μετρημένο σημείο κλήσης — έλεγξε πριν διορθώσεις) |

  ⚠️ **Υπάρχει ήδη χειροκίνητη παράκαμψη, και είναι ΜΙΣΗ**: το σχήμα
  `count === 1 ? t('X_one') : t('X', { count })` (6 σημεία). Το **πρώτο** σκέλος λύνεται επειδή το
  `X_one` είναι **κυριολεκτικό** κλειδί· το **δεύτερο** βγάζει ωμό. Κάποιος συνάντησε τη βλάβη, την
  παρέκαμψε **για το ένα**, και η μισή διόρθωση κρύβει τη μισή βλάβη. **Η διόρθωση απλοποιεί**:
  σκέτο `t('X', { count })` μόλις το κλειδί γίνει ICU.

  **Θεραπεία (μηχανική):** κάθε `X_one`/`X_other` → **ένα** κλειδί `X` με
  `{count, plural, one {…} other {…}}` (χρησιμοποίησε `#`, όχι `{count}`, μέσα στα σκέλη), **και στις
  δύο** γλώσσες· μετά `npm run generate:i18n-types` **και** `npm run generate:i18n-shell-slice`
  (αλλάζουν **κλειδιά**, άρα και οι δύο παραγόμενες προβολές μπαγιατεύουν — CHECK 3.33 / 3.34).

  🔶 **ΥΠΟΨΗΦΙΑ ΠΥΛΗ (η πραγματική θεραπεία):** ένας έλεγχος «**κανένα κλειδί locale δεν τελειώνει σε
  `_zero|_one|_two|_few|_many|_other`**» είναι **ZERO-TOL, ~50ms, χωρίς baseline** — το σχήμα είναι
  **δομικά** ανίκανο να λυθεί όσο τρέχει ICU, άρα δεν υπάρχει «λιγότερα από χθες». **ΜΗΝ** το γράψεις
  ως ratchet. **ΜΗΝ** το λύσεις αφαιρώντας το ICU plugin (το ICU είναι η επιλογή του repo — CHECK 3.9
  φρουρεί ήδη τη σύνταξή του σε **όλα** τα locale JSON).

- 🔶 **10/08 — η απόδοση «© OpenStreetMap contributors» ζει σε ΤΡΙΑ υποσυστήματα (ADR-782 §14.2)**
  Μετρημένο με grep γράφοντας την απόδοση του υποβάθρου: το ίδιο **νομικό** αλφαριθμητικό υπάρχει
  σε **4 σημεία / 3 τομείς** — `subapps/dxf-viewer/systems/basemap/basemap-source.ts` (πλέον ως
  πίνακας κομματιών με σύνδεσμο) · `subapps/geo-canvas/config/index.ts` ·
  `subapps/geo-canvas/services/map/MapStyleManager.ts` (**3 φορές**, με έναν πάροχο να έχει
  **τρεις** δικαιούχους σε μία γραμμή) · `components/projects/ika/map-shared/map-styles.ts`
  (με οντότητα `&copy;` αντί για `©`).
  ⚠️ **Δεν κεντρικοποιήθηκε επίτηδες, και ο λόγος δεν είναι ο χρόνος**: οι τρεις καταναλωτές
  θέλουν **διαφορετική μορφή** (πίνακας κομματιών για δικό μας ζωγράφο· σκέτη συμβολοσειρά για το
  control του MapLibre· HTML οντότητα για το Leaflet-style), οπότε μια αφελής σταθερά θα ήταν
  **ψεύτικο SSoT** που κάθε καταναλωτής θα ξανα-μορφοποιούσε. Η σωστή μορφή είναι ένα κομμάτι
  τύπου `AttributionSegment` + **δύο adapter** (`toPlainText`, `toHtml`). 4 αρχεία / 3 τομείς ⇒
  κανόνας N.0.2 λέει «pending», όχι «τώρα» — ειδικά σε **κοινό working tree**.
  ⚠️ **ΜΗΝ** το κάνεις πύλη: 4 σημεία δεν είναι κλάση, και το `geo-canvas` έχει **δικό** του
  νόμιμο λόγο να κρατά τη συμβολοσειρά (την τρώει το MapLibre αυτούσια).

- 🔶 **10/08 — ΕΝΑΣ τύπος συντεταγμένων· σήμερα είναι 43 inline + ένα νησί (ADR-777 Β1)**
  Μετρημένο γράφοντας τη ρίζα του ADR-777: `lat: number;` δηλώνεται **inline σε 43 σημεία / ~20
  αρχεία**, και υπάρχει **ήδη** `GeoPoint` στο `src/core/geo-alert-unified/database/types.ts` —
  με **0 εισαγωγές από οπουδήποτε εκτός του φακέλου του** (νησί 3 αρχείων· επαληθεύτηκε με
  ακριβές grep, το πρώτο πρόχειρο grep ήταν λάθος και έδειχνε καταναλωτές που ήταν **άλλο**
  σύστημα, το `GeoAlertSystem` του `subapps/geo-canvas/`). Δηλαδή ο υπάρχων τύπος **δεν ήταν
  ποτέ SSoT**, και τα 43 inline **είναι** η απόδειξη.
  ✅ Ο κανονικός τύπος γεννήθηκε: `src/types/geo/coordinates.ts` (`GeoPoint`·`GeoOutline`·
  `GeoBoundingBox`). ⏳ Μένει: μετανάστευση των 43 + απόφαση για το νησί (ζωντανό ή διαγραφή).
  ⚠️ **ΜΗΝ** προσθέσεις 44ο inline. ⚠️ **ΜΗΝ** προτείνεις πύλη πριν μετρήσεις: με 43 σημεία
  είναι εκστρατεία, όχι κλάση — και ένα ratchet πάνω σε τύπο τόσο τετριμμένο κινδυνεύει να
  ξεπεράσει τον πήχη <10% ψευδώς θετικών (κάθε `{lat, lng}` σε δοκιμή ή σε σύνορο API).


- 🟢 **09/08 — z-index: ΦΑΣΕΙΣ Α+Β+Γ ΕΚΛΕΙΣΑΝ (ADR-780 / CHECK 3.50)· μένει μόνο ζωντανή ματιά**
  **Φάση Α (08/08)**: +5 ρόλοι, ο χειρόγραφος καθρέφτης του `layout.ts` έσβησε, −2 παράλληλα
  λεξιλόγια, πύλη **CHECK 3.50**. Ο αριθμός «9» της αρχικής εγγραφής ήταν **λάθος κατά πέντε
  φορές** — **47** ωμές δηλώσεις σε **38** αρχεία, **τρεις** διάλεκτοι, **πέντε** λεξιλόγια.
  **Φάση Β (09/08)**: **σύνορο τρίτων** (`.zindex-foreign.json` + `src/app/foreign-boundary.css`
  + **δεύτερο κατάστιχο**, 11 ρητές καταστάσεις, απογραφή του **ίδιου** του `node_modules`) **και**
  η **κορυφή**: ο ρόλος `critical` (2147483647) **διαγράφηκε**, +8 ρόλοι με **ίδια ΣΕΙΡΑ**.
  🔴 **Το handoff ήταν λάθος σε τρία σημεία**: 11 πακέτα (όχι 2)· άλλες **7 δηλώσεις >10000** που
  κανείς δεν ήξερε (δύο **ισοβαθμούσαν με τον φρουρό** — ο loupe του eyedropper μπορούσε να
  σκεπάσει το overlay σφαλμάτων του Next.js)· και το `nextjs-portal` **δεν έχει δικό του z-index**
  (το MAX_INT ζει **μέσα** στο shadow root του). `raw-literal` **45 → 32** · baseline **37 → 30**
  ταυτότητες · ρόλοι **17 → 23** · **61 tests** · ζωντανή απόδειξη 6/6.
  **Φάση Γ (09/08) — Η ΣΥΜΠΙΕΣΗ ΕΚΛΕΙΣΕ**: κορυφή **10400 → 1370** (εντός MUI/Salt 1500) ·
  ωμές δηλώσεις **32 → 0** · ρόλοι **23 → 40** (**ορατότητα**, όχι χειροτέρευση) · **68 tests**.
  🔴 **Οι δύο σκάλες ήταν ΤΡΕΙΣ**: το `portal-overlay.ts` παρήγαγε **17 σκαλιά με ΑΡΙΘΜΗΤΙΚΗ**
  (`modal + 50…90`, `popover + 10…50`) — αόρατα ως `scale-reference` ✅, και **η επαναρίθμηση θα
  είχε αντιστρέψει τέσσερα ζεύγη με την πύλη ΠΡΑΣΙΝΗ** (ένα `modal + 50` **δεν** μετακινείται
  μαζί με τον `modal`). **12 νεκρά** διαγράφηκαν · **5** έγιναν ρόλοι · **1** ήταν τυχαία
  ισοβαθμία στο **1600** με τον `skipLink`, μέσω **διπλής** αριθμητικής.
  🏆 **Η ΑΠΟΔΕΙΞΗ ΕΙΝΑΙ Η ΙΔΙΑ Η ΠΥΛΗ**: το `declarations` της baseline έπαψε να είναι
  `ρόλος=τιμή` και έγινε **ΔΙΑΤΑΞΗ** (`orderIdentities`) ⇒ **μονότονη επαναρίθμηση = πράσινη
  χωρίς reseed**. Η μέτρηση συν-παρουσίας που ζητούσε το handoff **δεν χρειάστηκε**: είναι
  **δείγμα**, ενώ η μονοτονία είναι **απόδειξη για κάθε ζεύγος**. (Η Atlassian μεταναστεύει
  tokens με codemod που «*requires manual review*» + visual regression = δείγμα + άνθρωπος.)
  **Τι ΜΕΝΕΙ:**
  1. **4 τεμπέλικες επιφάνειες** (`PropertiesPalette`·`QuickPropertiesHoverPopover`·
     `DxfContextMenu`·`QuickPropertiesMiniPanel`) **δεν ιδώθηκαν στην οθόνη** (θέλει σύνδεση
     στο `/dxf/viewer` — `AdminGuard`).
  ✅ **ΛΥΘΗΚΕ ΑΠΟ ΑΛΛΟΝ, ΤΗΝ ΩΡΑ ΠΟΥ ΓΡΑΦΟΤΑΝ ΑΥΤΟ**: οι **4 προϋπάρχοντες κλώνοι** του
  `OverlayToolbar.tsx` (γρ. 238-347) εξήχθησαν σε `ToolbarIconButton` + `ToolbarGroup`.
  Το `jscpd:diff` είναι πλέον **καθαρό**. ⚠️ Δεν τους δημιούργησε η Φάση Γ (επαληθευμένο με
  `jscpd` πάνω στο `HEAD:` — **4 clones / 9,32%** πριν)· φάνηκαν επειδή το αρχείο μπήκε σε
  diff για μια αλλαγή **σχολίου**. *Μια πύλη diff δεν είναι απογραφή: δείχνει ό,τι περνά
  μπροστά της.*
  ✅ **ΕΚΛΕΙΣΕ**: το δηλωμένο όριο των **έμμεσων πακέτων** μετρήθηκε (**125,0s / 206.235
  αρχεία**): **15** πακέτα ≥1000 έναντι **11** που βλέπει η απογραφή, αλλά **0/4 φτάνουν στην
  οθόνη** (`playwright-core`=dev · `dockview`×2=ορφανά · `@sentry-internal/feedback` @ **100000**
  = μη δηλωμένο integration). Κατά το ίδιο το κριτήριο, **μένει γραμμένο** — τώρα **με ονόματα**
  και με άγκυρα `Σ17`, γιατί το Sentry απέχει **μία γραμμή** από widget στο 100000.
  ⚠️ **ΜΗΝ γράψεις ΑΡΙΘΜΗΤΙΚΗ πάνω σε ρόλο** (`zIndex.modal + 50`) — είναι ωμός αριθμός με
  μεταμφίεση, τον βλέπει ✅, και **σπάει τη μονοτονία**. Χρειάζεσαι ενδιάμεσο; **Ζήτα ρόλο**.
  ⚠️ **ΜΗΝ γυρίσεις τα `declarations` σε `ρόλος=τιμή`** ούτε σε απόλυτο rank (άγκυρες `Δ1`-`Δ4`).
  ⚠️ **ΜΗΝ κάνεις τα tests να καρφώνουν ΤΙΜΕΣ**: στη Φάση Γ **τέσσερα** έσπασαν έτσι.
  ⚠️ **ΜΗΝ διαβάσεις τη baseline ως δείκτη υγείας**· ⚠️ **ΜΗΝ ξαναφέρεις σκαλί MAX_INT**.

- 🟡 **ΝΕΟ 08/08 — δεν υπάρχει πύλη για την κλάση «αναβαλλόμενη γραφή που ξαναμαντεύει τον στόχο»**
  (ADR-739 §63.6 #2). Διορθώθηκε το **δείγμα** (ο διάλογος «Μορφοποίηση κελιών»: ο `FormatTarget`
  απέκτησε `entityId`, το «ΟΚ» ρωτά `resolveTableById(target.entityId)` και περνά από CAS), **όχι η
  κλάση**. Ο έλεγχος που λείπει: κάθε γραφέας που κρατά στόχο **πέρα από το συμβάν που τον γέννησε**
  οφείλει να περνά από πλάνο (`bim/table/table-format-commit-plan.ts`) αντί να ρωτά ζωντανή
  κατάσταση (δρομέας / επιλογή).
  🔑 **Γιατί μετράει παρότι είναι ασφαλές σήμερα**: οι **τρεις** υποδοχές που κατασκευάζουν
  `FormatTarget` τον καταναλώνουν στο **ίδιο** συμβάν, οπότε οι δύο απαντήσεις για το «ποιος
  πίνακας» συμπίπτουν **πάντα** — γι' αυτό το κενό ήταν αόρατο επί μήνες. Η **επόμενη** αιωρούμενη
  επιφάνεια που κρατήσει στόχο ξαναγεννά την κλάση, και η βλάβη είναι **αλλοίωση δεδομένων**
  (μετρημένο: `UpdateEntityCommand(Β.id, { model: προσχέδιο ΤΟΥ Α })` ⇒ ο πίνακας Β **γίνεται** ο Α),
  όχι κοσμητική. Εκτίμηση: **μεσαία** — θέλει AST κριτήριο «ποιος κρατά `FormatTarget` σε state/store»,
  δηλαδή δική της φάση.

- 🔴 **ΝΕΟ 09/08 — CHECK 3.29: η πύλη ΜΙΛΑΕΙ πλέον· μένουν οι ΤΥΠΟΙ σε 191 αρχεία** (ADR-663 §5,
  ADR-757 ΦΑΣΗ Β #2· **UNCOMMITTED**). Το ΒΗΜΑ 1 έκλεισε: δύο νέα SSoT (`lib/tsc-diagnostics.js`
  ανάγνωση με **7 ονομασμένους κάδους** + κλειστή λογιστική· `lib/tsc-report.js` απογραφή ανά
  κωδικό TS + συγκέντρωση), `--report`/`--summary` που γράφονται **ΠΑΝΤΑ**, artifact + job summary
  `if: always()`. **Καμία αλλαγή κριτηρίου — η πύλη μένει κόκκινη, απλώς λέει γιατί.**
  🔑 **Η αιτία ΔΕΝ ήταν το `slice(0, 20)`**: το `parseErrors()` πετούσε τον **κωδικό TS** στο parse,
  άρα ούτε ολόκληρη η λίστα των 191 δεν θα απαντούσε τίποτα.
  🔴 **Το ερώτημα απαντήθηκε ΧΩΡΙΣ `tsc`** (N.17), από το ιστορικό εκτελέσεων:
  **17** (17/07) → 107 (26/07) → 113 → 139 → **191** (08/08) ⇒ **συσσώρευση**, **24 συνεχόμενες
  κόκκινες** ξεκινώντας **δύο μέρες μετά** το seed. Η υπόθεση «κάτι έσπασε την 08/08» **αποκλείεται
  αριθμητικά**· η ομαδοποίηση «δουλειά διευθύνσεων» ήταν αποτύπωμα των **20 ορατών**, όχι των 191.
  **Τι ΜΕΝΕΙ:**
  1. **ΒΗΜΑ 2** — τρέξε το workflow (ή `npm run dxf:tsc:report` **ο Giorgio**) και διάβασε την
     **απογραφή ανά κωδικό**. Πλήθος `TS2307`/`TS7016` ⇒ φταίει το `--ignore-scripts` (δες #3)·
     πλήθος `TS2339`/`TS2345` ⇒ χρέος κώδικα ⇒ ΒΗΜΑ 3 με ρίζες, όπως το §4 (88 σφάλματα / 8 edits).
  2. **ΒΗΜΑ 3** — διόρθωση τύπων. ⚠️ **ΠΟΤΕ reseed** (`dxf:tsc:baseline`): θα κλείδωνε 191 σπασμένα
     αρχεία ως «αποδεκτό χρέος» (ADR-757 §7, ADR-598 §7).
  3. **Δηλωμένη απόκλιση**: το `dxf-tsc-ratchet.yml` κάνει `pnpm install --ignore-scripts`, ενώ οι
     **δύο** αδελφές πύλες type-check το αποφεύγουν **με γραπτή αιτιολογία**. Δεν άλλαξε — αλλαγή
     περιβάλλοντος **μέσα στη διάγνωση** θα θόλωνε την ίδια την αναφορά.
  4. 🔶 **Η ΠΕΡΙΚΟΠΗ ΧΩΡΙΣ ΠΡΟΟΡΙΣΜΟ ΕΙΝΑΙ ΚΛΑΣΗ, ΟΧΙ ΔΕΙΓΜΑ** (μετρημένο 09/08): **8** πύλες κόβουν
     την έξοδό τους σε **6 διαφορετικά όρια** (3·5·15·20·25·30). Από τις 4 συγκρίσιμες
     (`check-a11y-test-coverage-ratchet` · `check-dependency-audit-ratchet` · `check-jscpd-ratchet` ·
     `check-license-ratchet` — 2026-09-16 αντικαταστάθηκε από `check-license-policy`, ADR-598 G13) **μία μόνο** έχει διαδρομή artifact. Καμία δεν διορθώθηκε εδώ: κάθε μία
     έχει άλλο κριτήριο, και 8 αλλαγές πάνω σε εικασία είναι το αντίθετο της μέτρησης. **Ο κανόνας
     που βγήκε**: *κάθε περικοπή οφείλει να ονομάζει τη συνέχειά της.*
  5. 🔶 **Δεύτερη διάλεκτος, ΜΗ μετακομισμένη**: το `enterprise-ts-gate.js` μετρά
     `line.includes('error TS')` — **υποσυμβολοσειρά**, μετρά **γραμμές** όχι διαγνωστικά (σχήμα
     ADR-749). Δεν μετακόμισε στο νέο SSoT γιατί η baseline του είναι **ωμό πλήθος** ⇒ αλλαγή
     διαλέκτου αλλάζει τον αριθμό του έναντι της ίδιας του της baseline ⇒ θέλει **μετρημένο reseed**,
     δηλαδή απόφαση Giorgio.
  🔴 Giorgio commit: `scripts/lib/tsc-diagnostics.js` **NEW** + `scripts/lib/tsc-report.js` **NEW** +
  `scripts/__tests__/tsc-diagnostics.test.js` **NEW** + `scripts/lib/tsc-runner.js` +
  `scripts/check-dxf-tsc-ratchet.js` + `scripts/__tests__/check-dxf-tsc-ratchet.test.js` +
  `.github/workflows/dxf-tsc-ratchet.yml` + `package.json` + `.gitignore` + `ADR-663` + `ADR-757` +
  αυτό το αρχείο.

- 🟡 **ΝΕΟ 08/08 — 3 ιδιωτικά αντίγραφα της αναζήτησης κελιού στον αραιό χάρτη** (ADR-769). Το SSoT
  γράφτηκε (`findPersistedCell` στο `bim/table/table-cell-content.ts`, «η ΜΙΑ μηχανική τοποθέτησης»)
  και το κατανάλωσαν τα δύο αρχεία που άγγιξε η Φ.Η (`getPersistedCellText` + `table-cell-edit-session`).
  Παραμένουν χειρόγραφα: `formula/table-formula-engine.ts:202` · `table-range-merge-ops.ts:139` ·
  `table-row-column-ops.ts:430` (το τελευταίο σε **τοπικό** `cells`, όχι σε `model` — θέλει προσοχή).
  🔑 **Γιατί μετράει παρότι είναι μία γραμμή**: είναι ο **ορισμός** του αραιού χάρτη («απών = κενός»).
  Το jscpd είναι δομικά τυφλό (min-tokens **50**), άρα καμία πύλη δεν τα βλέπει· την ημέρα που η
  αποθήκευση αποκτήσει ευρετήριο (O(n) → O(1)), τα τρία αντίγραφα θα το προσπεράσουν **σιωπηλά** και
  θα μείνουν γραμμικά μέσα σε βρόχους. Εκτίμηση: **<1h, μηχανικό**, μηδέν αλλαγή συμπεριφοράς.

- 🟡 **ΝΕΟ 06/08 — «ποιος από τους δύο άξονες;» έχει ΤΕΣΣΕΡΑ ονόματα στον πίνακα** (ADR-764,
  εντοπίστηκε ενώ καλωδιωνόταν η δομική πράξη). Το ίδιο ζεύγος `'row' | 'column'` δηλώνεται ως
  `TableAxis` (`table-cell-order.ts` — **νέο SSoT**, ήδη καταναλώνεται από `table-row-column-ops`
  + `formula/table-formula-structural-heal`), `TableEdgeAxis` (`table-edge-model.ts:396`, ADR-750),
  `TableStyleAxis` (`table-axis-style-ops.ts:54`), **και ενσωματωμένο** σε ~8 υπογραφές
  (`table-axis-action-target.ts:52,130,145` · `table-delete-control.ts:153,244` ·
  `table-indicator-geometry.ts:423` · `table-insert-control.ts:122` · `table-cell-range.ts:185`
  — το τελευταίο είναι **άλλη έννοια** (`TableSelectionKind`, τρεις τιμές) και **δεν** ενοποιείται).
  🔑 **Γιατί δεν λύθηκε τώρα**: 4+ αρχεία σε 2 τομείς (μοντέλο + UI), δηλαδή N.0.2 «μεγάλο
  διπλότυπο ⇒ καταγραφή». Το ADR-764 πρόσθεσε το **ένα** όνομα που έλειπε (η δομική πράξη το
  χρειαζόταν διασυνοριακά) και **αφαίρεσε** τον τοπικό ορισμό του `table-row-column-ops.ts` —
  καθαρό μηδέν, όχι ένατο.
  ⚠️ **Ο κίνδυνος είναι πραγματικός αλλά ήπιος**: τα ονόματα είναι σήμερα δομικά ταυτόσημα, άρα
  ο compiler δεν παραπονιέται και **καμία** πύλη δεν τα βλέπει· την ημέρα που ένα από αυτά
  αποκτήσει τρίτη τιμή (π.χ. `'diagonal'`), οι υπόλοιποι καταναλωτές θα δεχτούν σιωπηλά τιμή που
  δεν ξέρουν να χειριστούν. Θεραπεία: **ένα** `TableAxis` στο `table-cell-order.ts`, τα άλλα
  γίνονται ψευδώνυμα και μετά σβήνουν. Εκτίμηση: <2h, μηχανικό, μηδέν αλλαγή συμπεριφοράς.

- 🔴 **ΝΕΟ 05/08 — δεν υπάρχει πύλη για την κλάση «τα rules διαβάζουν πεδίο που κανείς δεν
  γράφει»** (ADR-758 §4). Διορθώθηκε το **δείγμα** (`properties.project` → `projectId`), όχι η
  κλάση. Ο έλεγχος που λείπει: εξαγωγή κάθε `resource.data.X` ανά `match` block του
  `firestore.rules` και αντιπαραβολή με το σχήμα που σπέρνει το αντίστοιχο seed helper.
  🔑 **Το `properties.rules.test.ts` ήταν 21/21 πράσινο ΠΡΙΝ και ΜΕΤΑ** — γιατί το fixture
  αντέγραφε το όνομα που περίμεναν τα rules. Ένα test που ρωτά τα rules αν συμφωνούν με τον
  εαυτό τους **δεν είναι άγκυρα** (ADR-587 §6.1). Μέχρι να γραφτεί η πύλη, το ADR-758 είναι
  σχόλιο.

- 🟡 **ΝΕΟ 05/08 — 4 ιδιωτικά αντίγραφα του «βάλε σχήμα στο URL»** (ADR-759 Φ1). Το SSoT γράφτηκε
  (`ensureHttpUrl` στο `lib/validation/email-validation.ts`, δίπλα στον `isValidUrl` που το
  απαιτεί), αλλά **μόνο ο νέος κώδικας το καταναλώνει**. Παραμένουν χειρόγραφα:
  `components/ui/form/UniversalClickableField.tsx:186` · `components/shared/email/EmailContentRenderer.tsx:127,268`
  · `services/ai-pipeline/tools/handlers/contact-handler.ts:302`.
  🔑 **Η αιτία δεν είναι αμέλεια — είναι ότι ο παραγωγός και ο επικυρωτής διαφωνούν εκ
  κατασκευής**: το `WEB_URL_EXTRACT_REGEX` δέχεται επίτηδες γυμνό `www.`, ο `isValidUrl`
  απαιτεί σχήμα. Όποιος τα ενώνει, γράφει τη γέφυρα μόνος του. Μέχρι να μεταναστεύσουν τα 4,
  το ίδιο ερώτημα έχει **5** απαντήσεις. Εκτίμηση: <1h, αλλά αγγίζει 3 τομείς ⇒ ξεχωριστό commit.

- 🟡 **`phone-validation.ts` επανεξάγει από `vat-validation.ts`, που εισάγει `@/lib/firebase`**
  ⇒ μία εισαγωγή για **μία γραμμή regex** σέρνει ολόκληρο το Firestore. Το βρήκε η άγκυρα
  καθαρότητας του Λ2. Απόφαση Giorgio 05/08: **μόνο καταγραφή** (άλλος τομέας).
  🔑 **Ίδιο σχήμα με το `pointToSegmentDistance`** που λύθηκε 05/08 (βλ. παρακάτω): πρωτόγονο
  που ζει σε λάθος επίπεδο και σέρνει το επίπεδο μαζί του. Θεραπεία = **προαγωγή στη βάση**.

- 🔴 **ADR-757 ΦΑΣΗ Β — οι κόκκινες πύλες CI· η ΚΑΤΗΓΟΡΙΑ Α ΕΚΛΕΙΣΕ 09/08, μένουν Β+Γ**
  (η ΦΑΣΗ Α έκλεισε 2026-08-05: ιεράρχηση Tier 1/2/3 + CHECK 3.37· **καμία πύλη δεν διορθώθηκε**,
  μόνο έγινε αναγνώσιμη).
  🔴 **Ο αριθμός «8» αυτής της εγγραφής ΗΤΑΝ ΛΑΘΟΣ**: μετρήθηκαν **13 κόκκινα + 1 cancelled**
  (run `31258075…`, push 08/08). Και το χειρότερο δεν ήταν το πλήθος — **πέντε δεν ήταν ευρήματα
  καθόλου**, ήταν πύλες που **δεν μπορούσαν να εκτελεστούν**. Βλ. **ADR-757 §7.3**.
  ✅ **ΚΑΤΗΓΟΡΙΑ Α — DONE 09/08** (Opus 5): 3.46+3.48+**3.51 προληπτικά** (`fetch-depth: 0` —
  9 tests τραβούν καρφωμένο ιστορικό σε 4 workflows, μόνο το `ui-contrast` το είχε) · 3.39+3.41+3.45
  (μετακίνηση **μετά** το install: ο «AST walk» **είναι** `require('typescript')`) · 3.40 (το
  «timeout 600s» ήταν **500** — `auth/invalid-api-key` μέσω `global-error.tsx`) · 3.47 (τελική
  κάθετος στο `.gitignore` = **δήλωση** φακέλου, δεν ζητά τον δίσκο· + άγκυρα `Κ2β`, γιατί το `Π3`
  ρωτούσε τον δίσκο **αυτού** του μηχανήματος και ήταν πράσινο ενώ το CI κόκκινο).
  **Τι ΜΕΝΕΙ — Β (γνήσια) + Γ (εξωτερικά)**, με τα ΠΡΑΓΜΑΤΙΚΑ νούμερα της 08/08:
  `🧊 DXF-TS 3.29` **191 αρχεία**, πολλά `[NEW FILE — zero tolerance]`, ομαδικά στη δουλειά
  **διευθύνσεων** — **ΟΧΙ «ανεξερεύνητο»**, είναι ο N.17 σε δράση · `🕸️ depcruise` `no-circular`
  **1299→1691 (+392)** (δεν ήταν καν στη λίστα) · `🪵 Barrel 3.30` 42 νέα dead exports ·
  `🧬 SSoT Discover` `antiPatterns 0→1`/`unprotected 0→12` · `🧮 Type-Complexity` **+320.981**
  (το όργανο **μίλησε** — γνήσια υπέρβαση) · `📦 Bundle` **44.84** vs budget 43.65 ·
  `📚 knip` `unlisted: **470**` · `♿ A11y` 15 (T3) · `🛡️ CVE` **4 νέα** (άλλαξαν: ΟΧΙ πια
  `fast-uri`/`brace-expansion`) · `🔐 Secret Scan` *(ΚΟΚΚΙΝΟ ΕΠΙΤΗΔΕΣ — απόφαση Giorgio)*.
  ⚠️ Το `🔒 Firestore Rules 298` είναι **cancelled**, όχι failure — μην το μετρήσεις.
  ⚠️ **Κοινός ύποπτος, ΑΜΕΤΡΗΤΟΣ**: `+ y-prosemirror 1.3.7` σε **κάθε** log (bundle/knip/G14).
  🔶 **Ανοιχτό**: πύλη για «μπορεί αυτό το workflow να τρέξει τα tests που δηλώνει;» — απόφαση Giorgio.
  🔴 **ΜΗΝ κάνεις reseed baseline για να πρασινίσει** — VERIFY πρώτα (ADR-598 §7, 16/07).
  🔴 **Το `unlisted: 470` δεν στέκει** — εξήγησέ το πριν αγγίξεις baseline.
  ✅ **`🧮 Type-Complexity` — ΟΡΓΑΝΟ ΑΠΟΚΑΤΕΣΤΑΘΗ 05/08** (ADR-598 §7 05/08 · ADR-757 §7.2).
  **Αναγνώσιμη, ΟΧΙ ακόμα πράσινη** — η επόμενη εκτέλεση θα ονομάσει την κατάσταση.
  🔴 **Η υποψία OOM ΚΑΤΑΡΡΙΦΘΗΚΕ ως εύκολη εξήγηση**: το `ts-error-gate` τρέχει το **ίδιο**
  `tsc --noEmit` στο ίδιο project **χωρίς `NODE_OPTIONS`** και τελειώνει σε **2m52s**.
  Το πρόβλημα ήταν ότι η πύλη **πετούσε την έξοδο του `tsc`** ⇒ 13 κόκκινες, μηδέν διάγνωση.
  Αν προκύψει τώρα **υπέρβαση budget** (ήταν στο **98,6%** στις 27/07): **γνήσιο εύρημα, ΟΧΙ reseed.**
  Μέθοδος ανά πύλη + οι 2 ιδέες (baseline **με λήξη**, culprit attribution σε ratchets):
  **ADR-757 §7**.

- 🔴 **CHECK 3.28 (jscpd) ΔΟΜΙΚΑ ΤΥΦΛΟ σε όλο το `scripts/` — «0 = κανείς δεν κοίταξε»**
  (βρέθηκε 2026-08-05 γράφοντας την πύλη #1 της ΦΑΣΗΣ Β· ADR-598 §7 05/08, εύρημα 5).
  Το `.jscpdrc.json` ορίζει `format: ["typescript","tsx"]` ⇒ **κανένα `.js` δεν σαρώθηκε ποτέ**.
  Ο κανόνας **N.18** («πριν πεις done, `npm run jscpd:diff`») επιστρέφει σε αρχεία `scripts/*.js`
  «0 clones **σε 0 αρχεία**» — δηλαδή **πράσινο που σημαίνει «δεν κοίταξα»**. Με ρητό
  `--format javascript` βρέθηκε αμέσως πραγματικός κλώνος 9 γραμμών (διορθώθηκε επιτόπου).
  **Τι λείπει:** `format: [... ,"javascript"]` + επανα-baseline. ⚠️ **>1h — ΟΧΙ επιπόλαια**:
  προσθέτει ολόκληρο το `scripts/` (~200 αρχεία εργαλείων/πυλών) στη σάρωση ⇒ το
  `.jscpd-baseline.json` (**2.641 clones / 30.018 γρ. / 1,866%**) θα μετακινηθεί, και τα
  ratchet-scripts είναι **εκ σχεδιασμού** παρόμοια μεταξύ τους (ίδιο σχήμα `--write-baseline`)
  ⇒ υψηλό ποσοστό ψευδώς θετικών. **Πρώτα μέτρησε πόσα βγαίνουν, μετά αποφάσισε** αν μπαίνει
  όλο το `scripts/` ή μόνο `scripts/lib/`. **ΜΗΝ** χαλαρώσεις το `minTokens` για να χωρέσει.

- 🔴 **ΤΕΚΤΩΝ: το σχόλιο λέει «καμία εκτίμηση πλάτους», ο κώδικας 12 γραμμές πιο κάτω ΕΚΤΙΜΑ**
  (μετρημένο 2026-08-04, Opus 5, ψάχνοντας διπλότυπα στοίχισης· **δεν** το εισήγαγε αυτή η δουλειά).
  `export/core/tek/dxf-to-tek-texts.ts`: η επικεφαλίδα (γρ. 73-75) δηλώνει ρητά «Θέση = anchor
  **ΑΚΡΙΒΩΣ** στο (x20,x21) … **καμία εκτίμηση πλάτους/ύψους**· η στοίχιση δηλώνεται με
  `hallign`/`vallign` και ο Τέκτων κεντράρει το glyph box **μόνος του**». Στη γρ. 96 όμως:
  `hShiftUnits = hAlignKey === 'center' ? 1 : 'right' ? 2 : 0` και
  `xShift = heightMeters × 0,35 × hShiftUnits`, που αφαιρείται από το anchor.
  ⚠️ **Αν όντως δηλώνεται `hallign` ΚΑΙ μετατοπίζεται το anchor, το κείμενο διορθώνεται ΔΥΟ φορές**
  ⇒ κεντραρισμένη ετικέτα βγαίνει μισό πλάτος παραπέρα στο αρχείο ΤΕΚ, δεξιά-στοιχισμένη ένα ολόκληρο.
  Είτε το σχόλιο είναι **μπαγιάτικο** (η μετατόπιση μπήκε μετά) είτε η μετατόπιση είναι
  **υπόλειμμα** — και οι δύο εκδοχές είναι κακές, γιατί κανείς δεν ξέρει ποια ισχύει.
  🔑 **Σημείωση**: αριθμητικά ο τύπος **είναι** ο κανόνας αγκύρωσης του ADR-753 §21 μεταμφιεσμένος
  (`0 · ½w · w` με `w = 0,7·ύψος` ως προσέγγιση πλάτους). **ΜΗΝ τον περάσεις στο `anchorOffset`
  πριν λυθεί η αντίφαση** — θα κλείδωνε μια πιθανή διπλή διόρθωση σε SSoT και θα την έκανε να
  φαίνεται σωστή. Πρώτα απαντιέται «δηλώνει ο εξαγωγέας `hallign`;», μετά η κεντρικοποίηση.
  **Γιατί δεν λύθηκε επί τόπου**: θέλει τις προδιαγραφές ΤΕΚ ή ζωντανή επαλήθευση σε αρχείο —
  δεν κρίνεται από ανάγνωση.

- 🟡 **`namespace-manifest.json`: 17 namespaces χωρίς εγγραφή governance** (μετρημένο 2026-08-04,
  ADR-752 §7, κατά N.0.2). Ο `scripts/validate-i18n-manifest.js` βγάζει **3 σφάλματα** —
  `Manifest/locales drift`, `Manifest/lazy-config drift`, `Manifest/generated-types drift` — και
  τα τρία δείχνουν τα **ίδια** 17 namespaces: `bim3d`, `bim-3d-aria`, `bim-materials`,
  `dxf-schedule`, `dxf-viewer-dimensions`, `floorplan-overlays`, `iso19650`, `onboarding`,
  `quotes`, `settings`, `textAi`, `textDraft`, `textFindReplace`, `textFonts`, `textSpell`,
  `textTemplates`, `vendor-portal`. ⚠️ **ΔΕΝ είναι το σφάλμα του ADR-752** (εκείνο ήταν οι
  loaders και **έκλεισε**) — είναι τα **μεταδεδομένα διακυβέρνησης** ανά namespace (owner,
  primarySurface, stringClasses, budget, status, splitRequired). **Γιατί δεν μπήκε σε πύλη
  σήμερα**: θα γεννιόταν **κόκκινη**, και ένα gate που γεννιέται κόκκινο διδάσκει να το
  αγνοείς (ADR-742). **Θεραπεία**: 17 εγγραφές στο `src/i18n/namespace-manifest.json` —
  απόφαση ανά namespace (ποιος το κατέχει, τι budget), όχι μηχανική συμπλήρωση ⇒ >1h κατά N.0.2.
  Μόλις μηδενίσει: πρόσθεσε `node scripts/validate-i18n-manifest.js` στο `i18n-governance.yml`
  δίπλα στο CHECK 3.36 και ξεκλείδωσε το `i18n:check` ως ενιαία εντολή.

- 🟡 **Πρόθεμα namespace χωρίς δήλωση στον καταναλωτή — δεν το βλέπει καμία πύλη** (ADR-752 §8.1).
  Το `t('ns:key')` επιλύεται **μόνο** αν το bundle έχει φορτωθεί, και το `useTranslation`
  φορτώνει **μόνο όσα του δηλώσεις**. Το `PrintComplianceHint.tsx` καλούσε
  `t('textTemplates:…')` δηλώνοντας μόνο `dxf-viewer-shell`: **δούλευε ή όχι ανάλογα με το αν ο
  χρήστης είχε ανοίξει νωρίτερα άλλη οθόνη** — τυχαία σωστό. Διορθώθηκε **αυτό** το σημείο και
  σαρώθηκε όλο το `src/` για τα 6 namespaces του ADR-752 (κανένα άλλο). **Θεραπεία**: έλεγχος
  AST «για κάθε `t('ns:key')`, ανήκει το `ns` στα ορίσματα του `useTranslation` του ίδιου
  component;» — πιάνει την **κλάση**, όχι το δείγμα. **Γιατί δεν έγινε επί τόπου**: νέος AST
  σαρωτής + άγνωστο πλήθος υπαρχουσών παραβιάσεων σε όλο το `src/` ⇒ >1h κατά N.0.2.

- 🟡 **Χειροποίητο `mailto:`/`tel:` σε 14 αρχεία — και το ένα από αυτά έχει υπαρκτό ελάττωμα**
  (μετρημένο 2026-08-04, ADR-751 Φ8.α, κατά N.0.2). Το νέο module `text-link-detection` του
  `.ssot-registry.json` μπήκε με **ratchet baseline** (14 αρχεία), όχι μηδενική ανοχή, ακριβώς
  γι' αυτό. ⚠️ **Δεν είναι θέμα ύφους**: το `UniversalClickableField` βάζει **ωμή** τιμή σε
  `tel:`, δηλαδή κενά, παύλες και παρενθέσεις («2310-788493 (γραφείο)») καταλήγουν στον
  τηλεφωνητή· ο SSoT κανονικοποιεί **ανάντη**, στον ανιχνευτή. **Θεραπεία**: οι καλούντες
  περνούν από το `openCellLink` (`bim/table/table-link-interaction-2d.ts`). **Γιατί δεν έγινε
  επί τόπου**: 14 αρχεία σε 3+ τομείς (`components/contacts`, `components/properties`,
  `components/crm`, `property-showcase`) ⇒ >1h κατά N.0.2, και ήταν **ήδη** εκεί πριν το ADR-751.

- 🟢 **80 patterns του μητρώου χωρίς απόδειξη ζωής, από 20/07** (μετρημένο 2026-08-04, ADR-751
  Φ8.α). Το `test:registry-golden` ήταν **ήδη κόκκινο στο HEAD** (634 vs ταβάνι 622)· ξαναέγινε
  πράσινο γράφοντας απόδειξη για το `table-selection-range` (14 ⇒ 620). Οι υπόλοιπες
  εκκρεμούν: ADR-706/698/710/711/718/720/731/739/748. **Θεραπεία**: golden fixtures στο
  `scripts/lib/ssot/pattern-proofs.js` ανά module. **Το ταβάνι ΔΕΝ ανεβαίνει** — το λέει το ίδιο
  το test· αν πρέπει, ο λόγος γράφεται στο changelog του ADR-749.

- 🟡 **Το `isOwnersValid` δέχεται ΜΟΝΟ ιδιοκτήτη με ΟΠΟΙΟΔΗΠΟΤΕ ποσοστό** (μετρημένο 2026-08-05,
  ADR-235 §4.2.1, κατά N.0.2). `lib/ownership/owner-utils.ts`: `if (owners.length === 1) return
  true;` — το ποσοστό **δεν ελέγχεται καθόλου**. Άρα ένας οικοπεδούχος με 33,33% αποθηκεύεται
  κανονικά, με 333‰, και το «σύνολο ποσοστών» της φόρμας δείχνει 33%. Ίσως είναι **σκόπιμο**
  (έργο σε οικόπεδο όπου ο εργολάβος συμβάλλεται μόνο με έναν από τους συνιδιοκτήτες), γι' αυτό
  **δεν** αλλάχθηκε περνώντας: είναι αλλαγή συμπεριφοράς φόρμας και θέλει απόφαση Giorgio.
  ⚠️ Αν κάποτε αποφασιστεί ότι πρέπει να αθροίζει 100%, ο έλεγχος μπαίνει **εκεί**, ΟΧΙ στην
  κατανομή χιλιοστών — η κατανομή οφείλει να λέει την αλήθεια για ό,τι δηλώθηκε.

- 🟢 **`calculateBartexSummary` δεν καλείται από πουθενά** (μετρημένο 2026-08-05, κατά N.0.2).
  Εξάγεται από το `services/ownership/index.ts`, μηδέν καταναλωτές σε όλο το `src`. Άρα το
  `BartexSummary.landowners` (και τα `allocatedShares` μέσα του) **δεν γεμίζει ποτέ** από εδώ.
  Ύλη για το CHECK 3.30 (νεκρά barrel exports) — να επαληθευτεί ότι δεν είναι μισοτελειωμένο
  χαρακτηριστικό **πριν** διαγραφεί.

- 🟡 **Το `cascade-contact-name.service.ts` αγνοεί το `project.landowners[].name`**
  (μετρημένο 2026-08-04, ADR-745 Φ3α). Ενημερώνει `properties.commercial.owners[].name` και
  `payment_plans.ownerName`, **όχι** τους οικοπεδούχους έργου. ⇒ Αλλαγή ονόματος επαφής αφήνει
  το denormalized `name` του οικοπεδούχου **μπαγιάτικο, σιωπηλά** — ήδη σήμερα.
  Σημασία πέρα από το κοσμητικό: κανείς δεν «παρακολουθεί» ενεργά το `landowners[]` για συνέπεια,
  οπότε παρόμοιο σφάλμα σιωπηλής απώλειας μπορεί να ζήσει καιρό απαρατήρητο.

- 🟡 **ΤΡΙΤΟΣ χειρόγραφος δακτύλιος διαγνωστικών + χειριστήριο `window` (μετρημένο 2026-08-03, ADR-739 §31.11, κατά N.0.2).**
  Τρία modules επαναλαμβάνουν το **ίδιο** σχήμα «δακτύλιος με ανώτατο όριο → κείμενο αναφοράς →
  `dump()`/`download()`/`reset()` → προσάρτηση σε `window.__x` με έλεγχο `typeof window`»:
  `bim-3d/scene/bim3d-perf-diag.ts` (`__bim3dPerf`), `bim-3d/systems/section/clip-scope-guard.ts`
  (`__bim3dClipGuard` — δηλώνει **ρητά στα σχόλιά του** «ίδιο μοτίβο με το `bim3d-perf-diag`»), και
  τώρα `systems/cursor/cursor-apply-audit.ts` (`__cursorAudit`). Το τρίτο αντίγραφο είναι το σημείο
  όπου το μοτίβο σταματά να είναι σύμπτωση.
  ⚠️ **Το jscpd (CHECK 3.28) ΔΕΝ το πιάνει** και δεν είναι σφάλμα του: τα τρία έχουν διαφορετικά
  πεδία εγγραφής και διαφορετικό κείμενο αναφοράς — είναι κοινό **σχήμα**, όχι κοινά tokens.
  Ίδια κατηγορία τυφλότητας με το `ssot:discover` του N.12.
  **Θεραπεία**: εξαγωγή `lib/diagnostics/diagnostic-ring.ts` (δακτύλιος + `attachConsoleHandle`),
  με τα τρία να κρατούν **μόνο** το δικό τους σχήμα εγγραφής και τη δική τους αναφορά.
  **Γιατί δεν έγινε επί τόπου**: 2 τομείς (`bim-3d` + `systems/cursor`), 3 αρχεία με ζωντανούς
  καταναλωτές + tests ⇒ >1h κατά N.0.2, άρα καταγραφή αντί για βιαστική κεντρικοποίηση μέσα σε
  συνεδρία διάγνωσης.

- ✅ **Η ΠΥΛΗ ΠΟΥ ΕΛΕΙΠΕ — ΕΓΙΝΕ (2026-08-01, Opus 5, ADR-747 · CHECK 3.35 · `08c7f2b5`).**
  Και τα **δύο** 🔴 items αυτής της οικογένειας (τυφλότητα 3.10 στο client spread idiom · καμία πύλη για
  αλυσίδες Admin SDK) λύθηκαν όπως προβλεπόταν: **ένας** AST σαρωτής, δύο κανόνες, καμία νέα εξάρτηση,
  κανένα νέο engine, καμία νέα λίστα συλλογών.
  · **Νέα αρχεία**: `scripts/_shared/firestore-ast-loaders.js` (SSoT των 4 καταλόγων) ·
    `scripts/_shared/firestore-tenant-scope-scan.js` (οι 2 κανόνες) ·
    `scripts/check-firestore-tenant-scope.js` (CLI+ratchet) · `.firestore-tenant-scope-baseline.json` ·
    `scripts/__tests__/check-firestore-tenant-scope.test.js` (45 tests) ·
    `.github/workflows/firestore-tenant-scope.yml` (Layer 2).
  · **Baseline: 145 παραβιάσεις / 90 αρχεία** — **ratchet, ΟΧΙ zero-tol**, γιατί μετρήθηκε ότι ~1/3 είναι
    νόμιμα εκ σχεδιασμού (public tokens, `__name__` batch, migrations, webhooks) ⇒ ποσοστό ψευδώς θετικών
    πάνω από τον πήχη ≤10% της Google. Η πύλη **γεννήθηκε πράσινη** (ADR-742 `b4ec47e2`).
  · 🔴 **Και η baseline λέει «145», όχι ψεύτικο «0»** — αυτό ήταν όλο το ζητούμενο.
  · **Απόδειξη**: διαφορικό στο πραγματικό ιστορικό σφάλμα (`3d1339ce^` κόκκινο / `3d1339ce` πράσινο,
    fixtures με τον αυτούσιο κώδικα) + αναπαραγωγή της τυφλότητας του 3.10 **εκτελεστικά** + **5/5
    μεταλλάξεις** με **Μ0 meta-test** (το `require.cache` δεν αγγίζει το registry του Jest — 4/5 μεταλλάξεις
    «περνούσαν» ενώ έτρεχε ο παλιός κώδικας).
  · **Boy Scout (N.0.2)**: οι 3 loaders βγήκαν από το `check-firestore-index-coverage.js` στο κοινό module
    (710 → 604 γρ.), με **επαληθευμένα ταυτόσημη** συμπεριφορά του 3.15 (93 shapes / 49 unanalyzable).
  · ⬜ **ΑΠΟΜΕΝΕΙ — απόφαση Γιώργου**: να **αφαιρεθεί** το CHECK 3.10 + η baseline του μόλις το 3.35 τρέξει
    έναν κύκλο στο CI. Ένα gate που λέει μονίμως «0» δεν είναι απλώς άχρηστο — **παράγει ενεργά ψεύτικη
    ασφάλεια**. Δεν το έκανα μόνος μου: αφαίρεση πύλης είναι δική του κρίση.
  · ⬜ **ΑΠΟΜΕΝΕΙ**: τα **19 ai-pipeline** ευρήματα δείχνουν συλλογές που μάλλον θέλουν `mode:'none'` στο
    `tenant-config.ts` (`ai_pipeline_audit`, `ai_pipeline_queue`, `ai_agent_feedback`, …). Αν είναι όντως
    system-level, η δήλωση τα βγάζει από τη baseline **σωστά** αντί να τα κρύβει.

<details><summary>Ιστορικό: η αρχική καταγραφή των δύο items (2026-08-01, πριν λυθούν)</summary>

- ⚠️ **ΔΥΟ line-based CSV splitters, structural clones μεταξύ τους — και οι δύο ΑΝΙΚΑΝΟΙ για ενσωματωμένη**
  **αλλαγή γραμμής** (μετρημένο 2026-08-02, ADR-739 Φ.Δ βήμα 8).
  · 📍 `src/services/data-exchange/DataImportService.ts` → `parseCSVLine(line, delimiter)` (γρ. 194)
  · 📍 `src/subapps/accounting/services/external/csv-import-service.ts` → `splitCSVLine(line, delimiter)` (γρ. 179)
  · Τα δύο σώματα είναι σχεδόν ταυτόσημα (σάρωση χαρακτήρων με `inQuotes`), αλλά **δουλεύουν ανά
    γραμμή** (`lines[i]`): ένα κελί σε εισαγωγικά που περιέχει `
` — που το Excel **γράφει** έτσι —
    σπάει σε δύο «γραμμές» και **μετατοπίζει κάθε επόμενη στήλη**. Σιωπηλά. Σε **εισαγωγή τραπεζικού
    αρχείου**, δηλαδή σε λογιστικά δεδομένα.
  · ✅ Η **σωστή** εκδοχή γράφτηκε στο βήμα 8: `src/lib/spreadsheet/tsv.ts` (SSoT registry:
    `spreadsheet-tsv`) — σαρώνει **ολόκληρο το έγγραφο** ως ρεύμα χαρακτήρων, άρα εκφράζει
    ενσωματωμένες αλλαγές γραμμής. **ΔΕΝ** ενοποιήθηκε μαζί τους εκείνη τη στιγμή: διαφέρει ο
    διαχωριστής (στηλοθέτης vs παραμετρικός) και, κυρίως, οι δύο παλιοί ζουν σε **διαδρομές
    εισαγωγής παραστατικών** που δεν επαληθεύονται από το δίχτυ του πίνακα. Αλλαγή εκεί χωρίς
    δικά τους tests θα ήταν ρίσκο σε λάθος τομέα (N.0.2: «Unsure → Add to pending»).
  · ⬜ **Η δουλειά**: γενίκευσε το `parseTsv` σε παραμετρικό διαχωριστή, δώσε του tests με
    ενσωματωμένη αλλαγή γραμμής **στα δεδομένα των δύο καλούντων**, και αντικατάστησε και τα δύο.
    Το `formatTsv` καλύπτει ήδη την αντίστροφη κατεύθυνση.
- 🔴 **Το CHECK 3.10 είναι ΤΥΦΛΟ στο κυρίαρχο query idiom του repo (μετρημένο 2026-08-01, ADR-745 §9.5.4).**
  Ο `check-firestore-companyid.sh` (γρ. 57-58) παίρνει block **12 γραμμών ΠΡΟΣ ΤΑ ΚΑΤΩ** από κάθε `query(`
  και μαρκάρει παραβίαση μόνο αν το block περιέχει `where(` **χωρίς** `companyId`. Στο idiom
  «χτίσε πίνακα `constraints`, πέρασέ τον με **spread** στο τέλος» το `query(...)` είναι η **τελευταία**
  γραμμή και τα `where(…)` βρίσκονται **πιο πάνω** ⇒ το block δεν περιέχει κανένα `where(` ⇒
  **μηδέν παραβιάσεις, πάντα**. Ο scanner βλέπει **μόνο** το inline `query(col, where(…))`.
  · 📏 **Μέγεθος**: **19 αρχεία** χρησιμοποιούν το idiom — το χρησιμοποιεί και το ίδιο το
    `firestoreQueryService`. Έτσι το `getAllContacts` έστελνε **ανφίλτραρο list** επί μήνες και η
    αναζήτηση επαφών ήταν σπασμένη για **κάθε μη-super-admin** χωρίς καμία πύλη να μιλήσει.
  · ⚠️ **Το `.firestore-companyid-baseline.json` λέει «0 violations / 0 files — fully cleaned».**
    Είναι **τέταρτη** εμφάνιση του «**`0` = κανείς δεν κοίταξε**» (μετά i18n N.11 / ssot-discover N.12 /
    CHECK 3.15). **ΜΗΝ το επικαλεστείς ως δείκτη υγείας.**
  · ⬜ **Η πύλη που λείπει**: AST σάρωση (όχι grep γραμμών) — για κάθε `query(collectionRef, ...args)`
    ακολούθησε τα spread ονόματα πίσω στη δήλωσή τους στο ίδιο scope και έλεγξε αν κάποιο
    `constraints.push(where('companyId', …))` τα τροφοδοτεί· εναλλακτικά, μάρκαρε ως ύποπτο κάθε
    αρχείο που κάνει direct `query(` σε tenant-scoped collection **χωρίς καμία** αναφορά
    `companyId` / `resolveEffectiveCompanyId` / `firestoreQueryService`.
  · 📌 **Μετρημένη αφετηρία**: από τα 19, **3** δεν αναφέρουν καθόλου `companyId` και **δεν εξετάστηκαν**
    (μπορεί να είναι νόμιμα public/server): `src/services/notificationService.ts`,
    `src/services/realtime/hooks/usePublicProperties.ts`,
    `src/app/api/communications/webhooks/telegram/firebase/helpers-lazy.ts`.
    **Μέτρησέ τα πρώτα, μετά διάλεξε ratchet ή zero-tol.**
  · 🔗 Ίδια οικογένεια με το επόμενο item (Admin SDK): και τα δύο είναι «η πύλη κοιτά **σχήμα κειμένου**,
    ο κώδικας γράφτηκε σε **άλλο σχήμα**». Λογικά λύνονται μαζί, με **έναν** AST scanner σε δύο κανόνες.

- ✅ **ΕΚΛΕΙΣΕ 2026-09-08 — ΤΡΕΙΣ συλλογές είχαν ΔΥΟ μπλοκ κανόνων· ενώθηκαν, και η ερώτηση
  έγινε ΦΡΑΓΜΟΣ** *(ADR-841 §7 **Α21.14.9**, ADR-298 changelog)*.

  Οι `leads` / `opportunities` / `activities` έχουν πλέον **ΕΝΑ** μπλοκ η καθεμία, με το
  `assignedTo` του PR-1B **και** τους φρουρούς του PR-1D — όχι διαγραφή του ενός. Τα κοινά
  κατηγορήματα έγιναν βοηθοί `crm*()` στο πρότυπο των `canReadAccounting()`.
  ⛔ **CHECK 3.16 Validation F** (`validateNoDuplicateMatchPaths`) μπλοκάρει πλέον κάθε νέα
  διπλή διαδρομή· η ratchet άγκυρα (ομάδα **Γ**) έγινε **ισότητα με το μηδέν**.

  🔴 **ΔΥΟ ΕΥΡΗΜΑΤΑ ΠΟΥ ΔΕΝ ΤΑ ΠΕΡΙΜΕΝΕ ΚΑΝΕΙΣ — ΚΑΙ ΤΑ ΔΥΟ ΑΠΟ ΤΗ ΜΕΤΡΗΣΗ:**
  1. **Το διαγνωστικό του handoff διαψεύστηκε.** Προέβλεπε ότι σβήνοντας το PR-1B η σουίτα
     θα κοκκίνιζε και «θα ονόμαζε τι χάνεται». **60/60 πράσινη.** Και προς τις δύο
     κατευθύνσεις. Ο πίνακας ήταν **τυφλός σε ολόκληρη τη διαφωνία**: το seed φέρει
     `createdBy = same_tenant_user.uid`, άρα κάθε κελί περνά από τον δημιουργό και **κανένα**
     δεν ακουμπά τον ανατεθειμένο. ⇒ Νέο κοινό συμβόλαιο `_harness/crm-owner-contract.ts`
     (24 δοκιμές, μετάλλαξη **3/3**, σύνολο **84**).
  2. **Κενό απομόνωσης tenant, σε ΚΑΙ ΤΙΣ ΤΡΕΙΣ.** Ο έλεγχος υπήρχε στο `read` και **έλειπε**
     από `update`/`delete` ⇒ χρήστης της company-A **έγραφε και έσβηνε** έγγραφα της
     company-B που είχε δημιουργήσει, ενώ **δεν μπορούσε να τα διαβάσει**. Ρεαλιστικό
     σενάριο: υπάλληλος που αλλάζει εταιρεία. Έκλεισε με `crmNotForeignTenant()`.

  📊 **Συνολική αλλαγή: 10 στις 756 μετρήσεις, ΟΛΕΣ `ALLOW → DENY`** — 7 το σύνορο tenant,
  3 ο φρουρός `resource != null` σε διαγραφή **ανύπαρκτου** εγγράφου. Καμία διεύρυνση.

  🔓 **ΜΕΝΕΙ ΩΣ ΑΠΟΦΑΣΗ ΤΟΥ GIORGIO (όχι ratchet — διεύρυνση πρόσβασης παραγωγής)**: μόνο το
  `leads` δίνει πρόσβαση στον ανατεθειμένο. Κατά Salesforce/HubSpot/Zoho το ίδιο θα έπρεπε να
  ισχύει και για `opportunities` / `activities` — και το `Opportunity.assignedTo` είναι
  **υποχρεωτικό** πεδίο (`src/types/crm.ts:37`), δηλαδή ο ανατεθειμένος πωλητής **δεν μπορεί**
  σήμερα να ενημερώσει τη δική του ευκαιρία. Η ασυμμετρία είναι **καρφωμένη και προς τις δύο
  κατευθύνσεις** (σημαία `assigneeIsOwner`), άρα δεν μπορεί να αλλάξει σιωπηλά.

  📘 **Ιστορικό**: η έρευνα Salesforce/HubSpot/Zoho και το αρχικό διαγνωστικό ζούσαν στο
  `HANDOFFS/2026-09-08_ADR-841_A21.14.8_diploi-kanones-CRM.md`. Πέρασαν στο **ADR-841 §7
  Α21.14.9** και στα σχόλια των βοηθών `crm*()` του `firestore.rules`.
  ⚠️ **Το handoff έμεινε ως έχει επίτηδες**, αν και η πρόβλεψή του για το διαγνωστικό
  *(«σβήσε το PR-1B ⇒ σουίτα ΚΟΚΚΙΝΗ, τα κελιά ονομάζουν τι χάνεται»)* **διαψεύστηκε
  μετρημένα**: έμεινε 60/60 πράσινη. Η διάψευση είναι το χρήσιμο κομμάτι — δείχνει ότι
  «οι σουίτες περνάνε, άρα ο πίνακας περιγράφει τη συμπεριφορά» είναι **συμπέρασμα που δεν
  στέκει**: ο πίνακας περιγράφει μόνο ό,τι ρωτά.

- 🔴 **Καμία πύλη δεν βλέπει tenant filter σε αλυσίδες Admin SDK (μετρημένο 2026-08-01, ADR-745 §9.2 Φάση Α).**
  Το ADR-702/742 έφτιαξε το SSoT (`lib/firestore/tenant-scoped-query`) — αλλά **τίποτα δεν επιβάλλει τη χρήση του**.
  Τρία σημεία στο `contact_links` έμειναν ασκόπιστα επί μήνες, εκ των οποίων **ένα ΕΓΓΡΑΦΗ**· διορθώθηκαν, με
  8 anchor tests + 5/5 μεταλλάξεις (`src/services/__tests__/contact-links-admin-tenant-scope.test.ts`).
  · 🔴 **Γιατί τα gates ήταν τυφλά — δύο ανεξάρτητοι λόγοι, και οι δύο μετρημένοι:**
    **CHECK 3.10** ψάχνει τη συμβολοσειρά `companyId` γύρω από `query(` — το Admin SDK γράφει
    `.collection(X).where(…)`, **άλλο σχήμα**, δεν το κοιτά καν.
    **CHECK 3.15** (`check-firestore-index-coverage.js`, γρ. 40-44) **δηλώνει ρητά** ότι αναλύει μόνο κλήσεις
    μέσω κεντρικού helper με literal `constraints: [...]`· direct `query()` + runtime-built πίνακες βγαίνουν
    «unanalyzable» και **δεν μπλοκάρουν**. Το ✔ των «93 shapes / 49 skipped» **δεν κάλυπτε ούτε ένα**
    query του `contact_links`. Άλλο ένα «`0` = κανείς δεν κοίταξε».
  · ⬜ **Η πύλη που λείπει**: AST σάρωση για `.collection(<tenant-scoped collection>)` αλυσίδες χωρίς
    `companyId` / `scopeQueryToCompany` / `tenantScopedCollection`, με ρητή λίστα εξαιρέσεων για συλλογές
    **χωρίς** πεδίο μισθωτή (η διάκριση που το `dependency-tenant-scope.ts` ήδη κάνει — μην την ξαναφτιάξεις).
    Ratchet με baseline, **όχι** zero-tol: το εύρος είναι άγνωστο μέχρι να τρέξει η πρώτη πλήρης σάρωση.
  · ⬜ **13 `countDirectCollection(...)` στο `lib/firestore/project-mutation-impact-preview.service.ts:186-199`**
    (buildings, properties, communications, obligations, legal_contracts, ownership_tables, purchase_orders,
    attendance_events, employment_records, accounting_invoices, files, boq_items, calendar_events) μετρούν
    **χωρίς μισθωτή**. Το `countContactLinks` δίπλα τους διορθώθηκε — τα υπόλοιπα **όχι**, γιατί καμία από
    τις 13 συλλογές δεν μετρήθηκε. Ο αριθμός τροφοδοτεί **απόφαση διαγραφής** που βλέπει ο χρήστης.
  · **Γιατί καταγραφή και όχι διόρθωση τώρα**: 13 συλλογές + νέα πύλη + baseline = >1h σε 2+ τομείς (N.8),
    και το εύρος πέρα από το `contact_links` είναι **αμέτρητο** — δεν ισχυρίζομαι κάλυψη που δεν μέτρησα.
  · Εντολή ανίχνευσης: `grep -rn "\.collection(COLLECTIONS\." src --include=*.ts -A3 | grep -B1 "\.where(" | grep -v companyId`.

</details>

- 🟠 **13 `countDirectCollection(...)` μετρούν ΧΩΡΙΣ μισθωτή — ΑΝΟΙΧΤΟ (μεταφέρθηκε από το item του Admin SDK).**
  `lib/firestore/project-mutation-impact-preview.service.ts:186-199` (buildings, properties, communications,
  obligations, legal_contracts, ownership_tables, purchase_orders, attendance_events, employment_records,
  accounting_invoices, files, boq_items, calendar_events). Το `countContactLinks` δίπλα τους διορθώθηκε στο
  ADR-745 Φάση Α· τα υπόλοιπα **όχι**. Ο αριθμός τροφοδοτεί **απόφαση διαγραφής που βλέπει ο χρήστης** —
  ίδια οικογένεια με τη διαρροή του ADR-742 §7octies (preview μετρούσε εγγραφές **όλων** των πελατών).
  · ✅ **Πλέον ΕΙΝΑΙ ορατά**: το CHECK 3.35 τα βλέπει (3 στη baseline για αυτό το αρχείο). Δεν είναι πια
    «αμέτρητα» — είναι **μετρημένα και καταγεγραμμένα**, απλώς όχι ακόμη διορθωμένα.
  · **Γιατί όχι τώρα**: 13 συλλογές, >1h, 2+ τομείς (N.8). Όταν διορθωθούν → `npm run firestore:tenant-scope:baseline`.

- 🟡 **Τρεις εναπομείναντες χειρόγραφοι union-find στο `dxf-viewer` (μετρημένο 2026-08-01, ADR-745 Φ1 κατά N.0.2).**
  Ο αλγόριθμος υπήρχε **τέσσερις** φορές· ο ένας κεντρικοποιήθηκε. Κανονικός SSoT:
  `src/subapps/dxf-viewer/utils/connected-components.ts` (`computeConnectedComponents` /
  `groupIndicesByComponent`, με συμπίεση διαδρομής + ένωση κατά μέγεθος, 6 tests).
  · ✅ `bim/thermal/sizing/pipe-network-graph.ts:computeComponents` → περιτύλιγμα (541 tests πράσινα).
  · ⬜ `bim/mep-systems/mep-pipe-junctions.ts:129` — «Union-find root with path compression (mirrors network-derive)» — **το ίδιο το σχόλιο δηλώνει το clone**.
  · ⬜ `bim/mep-systems/mep-pipe-network-derive.ts:115`.
  · ⬜ `bim/foundations/auto-foundation-layout.ts:187-206` (grouping κολωνών).
  · ⬜ `bim/walls/wall-trims-corner-resolve.ts:281` (ενσωματωμένο σε μεγαλύτερη ρουτίνα — θέλει προσοχή).
  · **Γιατί καταγραφή και όχι διόρθωση τώρα**: 4 αρχεία σε 3 τομείς (MEP / θεμελιώσεις / τοίχοι), το καθένα με δικές του δοκιμές· >1h και το `dxf-viewer` δουλεύεται **παράλληλα** από άλλον agent.
  · ⚠️ **ΜΗΝ προστεθεί εγγραφή στο `.ssot-registry.json` πριν μεταφερθούν και οι τρεις**: ένα `forbiddenPatterns` θα άναβε αμέσως στα εναπομείναντα αντίγραφα και θα απαιτούσε ανανέωση baseline σε κοινό working tree.
  · Εντολή ελέγχου: `grep -rn "path compression\|Union-find\|union-find" src/subapps/dxf-viewer --include=*.ts | grep -v __tests__`.

- 🟡 **ΔΥΟ παράλληλοι dispatchers πάνω στο ίδιο λεξιλόγιο εργαλείων, 367 + 305 γραμμές (μετρημένο 2026-07-31, κατά N.0.2 στον κύκλο ADR-739 Φ.Δ).**
  Όριο N.7.1 = **40 γραμμές**. `createEntityFromTool` (`hooks/drawing/drawing-entity-builders.ts:96-462`) = **367 γρ.** / `switch` με **27 `case`**· `generatePreviewEntity` (`hooks/drawing/drawing-preview-generator.ts:181-485`) = **305 γρ.** / αλυσίδα **42 `if (tool === …)`**. Και τα δύο **αρχεία** μένουν κάτω από το όριο των 500 (471 / 487) — γι' αυτό **κανένα gate δεν τα βλέπει**: το pre-commit ελέγχει μέγεθος **αρχείου**, όχι **συνάρτησης**.
  · 🔴 **Το πρόβλημα ΔΕΝ είναι το μήκος — είναι ότι είναι ΔΥΟ.** Κάθε νέο εργαλείο απαιτεί επεξεργασία **δύο** σημείων αποστολής (τι χτίζεται · τι φαίνεται ως ghost) που **δεν έχουν τίποτα να τα κρατά συγχρονισμένα**. Ο σωστός τύπος διόρθωσης είναι **μητρώο `tool → { build, preview }`** (ένα σημείο καταχώρησης, exhaustiveness από τον compiler), **όχι** «εξαγωγή helpers» — αυτή θα έφτιαχνε δύο *μικρότερους* dispatchers που εξακολουθούν να αποκλίνουν.
  · **Μετρημένη ασυμμετρία**: `sketch` υπάρχει **μόνο** στους builders· **16** εργαλεία υπάρχουν **μόνο** στο preview (`beam block-library column column-from-polygon floor-finish foundation-pad foundation-strip foundation-tie-beam mep-underfloor mtext roof slab stair text wall wall-covering`). ⚠️ **ΔΕΝ επαληθεύτηκε ότι είναι σφάλμα** — το `switch` δεν έχει `default` που να προωθεί (επιστρέφει `null`), άρα τα 16 πιθανότατα δημιουργούνται από **άλλα** μονοπάτια BIM. Χρειάζεται ανάγνωση ανά εργαλείο **πριν** πει κανείς «λείπουν».
  · **Ποιος τις μεγάλωσε**: η ADR-739 Φ.Δ πρόσθεσε **+8 / +11** γραμμές (το εργαλείο «Πίνακας»). Το χρέος είναι **προϋπάρχον**· η φάση απλώς το επιδείνωσε και **παρέλειψε αυτή την καταγραφή** — ο N.0.2 την επέβαλλε.
  · **Γιατί καταγραφή και όχι διόρθωση τώρα**: 2 αρχεία αλλά **~40 εργαλεία σε 3+ domains** (2D primitives, BIM, annotation) ⇒ >1h, και το `dxf-viewer` δουλεύεται **παράλληλα** από άλλον agent. Εντολή μέτρησης: `awk 'NR>=96 && /^}/ {print NR-96+1; exit}' src/subapps/dxf-viewer/hooks/drawing/drawing-entity-builders.ts`.

- 🟡 **ADR-742 — από τα τέσσερα εκκρεμή της Ομάδας 6 μένουν ΔΥΟ, εκτός εμβέλειας ADR (2026-08-01).**
  · ✅ **Η παγίδα του κενού στο στρώμα ΥΠΗΡΕΣΙΩΝ — ΕΓΙΝΕ· ήταν 13 αρχεία, όχι ~10** (§7duodecies.3).
  Ο κατάλογος έλεγε ~10 γιατί κανείς δεν είχε μετρήσει τη **θετική** μορφή (`===`): έκρυβε
  `org-structure-handler-utils`, `procurement-handler` και **δύο δημόσιες διαδρομές PDF με ανώνυμο
  καλούντα**. ⛔ **ΕΞΩ** (δηλωμένα): `execute-admin-operations:71` — **χαρτογράφηση επιδιόρθωσης**
  migration που **περιμένει** το κενό (`|| '<empty>'`), όχι φύλακας· και `user-settings-repository:90`
  (δέσιμο **στιγμιοτύπου** cache, όχι ιδιοκτησία εγγράφου).
  ⛔ Παραμένει ισχυρό: **ΜΗΝ το κάνεις `forbiddenPattern`** — ψευδώς θετικά (`!== undefined`).
  · ✅ **Η απόδειξη των 13 — ΕΓΙΝΕ** (§7terdecies). 🔴 **Ο αριθμός «8» ήταν λάθος: 12 αρχεία / 14
  σημεία.** Η προηγούμενη μέτρηση είχε τρέξει **6 σουίτες ονομαστικά**· η νέα έτρεξε **224**
  (`src/services` + `src/app/api`) ⇒ 9 κόκκινες σουίτες, **καμία** στα 12 αρχεία. Τα δύο
  **αμέτρητα** PDF routes μετρήθηκαν: το `src/app/api/showcase` έχει **μηδέν** αρχεία test.
  🔴🔴 **Το εύρημα: τρία σημεία ΔΕΝ ΜΠΟΡΟΥΝ να αποδειχθούν.** Η **μοναδική** διακρίνουσα είσοδος
  SSoT vs `===` είναι το ζεύγος **κενό/κενό**· σε `communications-triage-actions`,
  `create-unified-public-pdf-route` και `app/api/showcase/[token]/pdf/route` φύλακας **ανάντη**
  (`if (!companyId …) return`) την κάνει **απρόσιτη** ⇒ ο SSoT είναι εκεί **ισοδύναμος** με σκέτο
  `===`. Δεν είναι κενό κάλυψης· αλλά η ισοδυναμία **εξαρτάται από τον ΑΛΛΟΝ**, οπότε φυλάσσεται
  ο **ανάντη** (`ownership-upstream-guarded.test.ts`, 8 tests).
  🏆 **Θετικός μάρτυρας** ανά σημείο («ΔΕΝ αρνείται τον νόμιμο ιδιοκτήτη») — χωρίς αυτόν, σπασμένο
  στήσιμο περνά **και τα δύο** αρνητικά tests. **Έπιασε 2 πραγματικά σφάλματα** στην πρώτη εκτέλεση.
  ⚓ **+anchor πληρότητας** (20 tests): η σουίτα πρέπει να **περιέχει αυτούσια** τη διαδρομή, ώστε
  η **αφαίρεση** γραμμής από τον πίνακα να κοκκινίζει (μάθημα #7). **4/4 μεταλλάξεις.**
  🧹 SSoT: ο in-memory Firestore mock μετακινήθηκε `ai-pipeline/…/test-utils` → `src/test-utils/`
  (11 καλούντες, **όχι** shim) + `delete()` + **ημερολόγιο εγγραφών**.
  · ✅ **Το `resource-concealment-anchor` σαρώνει πλέον το `src/subapps/` — ΕΓΙΝΕ** (§7duodecies.2).
  Ο δηλωμένος λόγος αποκλεισμού ήταν **μετρήσιμα ψευδής** (6.418 αρχεία, **μηδέν** αποτυχίες, +1,4s).
  Μπήκαν μαζί 3 gates: `minFiles` ανά δέντρο · `DECLARED_UNREADABLE_PATHS` (ισότητα) · `TREE_WITNESSES`.
  · ✅ **`ssot:baseline` — ΑΠΑΝΤΗΘΗΚΕ («μην το γράψεις») ΚΑΙ οι 13 ΔΙΟΡΘΩΘΗΚΑΝ ΣΤΟΝ ΚΩΔΙΚΑ** (§7quaterdecies).
  🔴 **Καμία δεν ήταν νέα.** `git log -p .ssot-registry.json`: τα δύο modules καταχωρήθηκαν **25 & 26/07**,
  η baseline παρήχθη **20/07**, ο κώδικας ήταν **2-4 μηνών** ⇒ **κενό ΔΙΑΔΙΚΑΣΙΑΣ**, όχι παράβαση.
  *Το gate γεννήθηκε ήδη κόκκινο.* Επαναλήφθηκε **7 φορές**.
  · **11** = ψευδώς θετικά, αλλά έκρυβαν πεντάπτυχο χάρτη showcase γραμμένο **4 φορές** που **είχε ήδη
  αποκλίνει** (5 κλάδοι context vs 3 PDF) → `services/sharing/showcase-surfaces.ts` (43 tests, 3/3 μεταλλάξεις).
  · **12** = ό,τι απέμενε από το ADR-710 (το μητρώο έλεγε «26», μετρήθηκαν **12**) — μεταναστεύθηκαν όλες.
  **6 πραγματικά σφάλματα** στην πορεία, το ένα το γεννούσε **η ίδια η μετανάστευση** (SV/CV σιωπηλά `0−0`).
  ⛔ `ReportSparkline` = **allowlist με μετρημένο λόγο** (80×32px γλυφικό vs 224–288px shell), όχι αναβολή.
  · 🔴 **Η κεντρικοποίηση γέννησε τον κλώνο — 8η φορά**: 5 → **1** σε 4 γύρους. Ο ένας που μένει είναι
  **κατάλογος import** (59 tokens) — δεν κεντρικοποιείται. **Θέλει απόφαση Giorgio** (`SKIP_JSCPD_DIFF=1`
  με αιτιολόγηση) ή συγχώνευση 2 γραφημάτων που θα εισήγαγε `layout` boolean.
  · ⚓ **+gate συμφιλίωσης** `scripts/__tests__/registry-baseline-reconciliation.test.js` (15 tests) —
  **βρήκε εύρημα στην πρώτη εκτέλεση**: το `public-showcase-token-surface` δεν είχε `addedDate`,
  δηλαδή **η δίοδος διαφυγής ήταν ήδη σε χρήση**. Ratchet undated 319 → **318**.
  · **Baseline 126 → 103** (αρχεία 90 → 73), **χωρίς `--write`**.
  · ⏳ **JIT elevation — ΕΡΕΥΝΑ + ΑΠΟΓΡΑΦΗ + ΠΡΟΤΑΣΗ ΕΤΟΙΜΑ, αναμένεται απόφαση** (§7quindecies).
  🔴 **Ο αριθμός «47» ήταν λάθος**: 127 αναφορές, από τις οποίες **45 σκέτα import** ⇒ **63 κλήσεις**.
  Και οι 63 είναι **δύο αντίθετες ομάδες**: **38 ΠΥΛΗ** (`if (!isRoleBypass) → 403` — *περιορίζουν*
  ποιος μπαίνει, ΔΕΝ δίνουν ξένα δεδομένα) και **21 ΠΑΡΑΚΑΜΨΗ** (αλλάζουν εύρος δεδομένων).
  **Μόνο οι 21 είναι το anti-pattern** — και οι **8** ζουν σε στενωπούς του `lib/auth` + `lib/firestore`.
  · **Η απάντηση στο «ποιος εγκρίνει σε μονοχρηστη εγκατάσταση»**: break-glass. *Self-approval* προσποιείται
  ότι έγινε έλεγχος· *self-service activation* παραδέχεται ότι δεν έγινε και το πληρώνει με **αποδεικτικά**
  (time-box 60′ κατά Azure PIM + αιτιολόγηση + ίχνος + ειδοποίηση χωρίς δικαίωμα veto).
  · **Σύσταση Α → Β**: (Α) ονομάτισε+κατέγραψε το bypass, ~2-3h, μηδέν ρίσκο, δίνει **τον αριθμό που κανείς
  δεν έχει** (πόσο συχνά χρησιμοποιείται)· (Β) break-glass με παράθυρο, ~1-2 ημέρες **μετά** την Α·
  (Γ) πλήρες JIT με εγκριτή — **όχι σήμερα**, θέλει δεύτερο άνθρωπο. 🔴 **ADR-232**: έγγραφα υπεργραφείου
  έχουν `companyId: null` — χωρίς bypass **κανείς δεν τα βλέπει**· θέλει ρητή απόφαση στη Β.
  ⛔ **ΚΑΝΕΝΑΣ ΚΩΔΙΚΑΣ** χωρίς ρητό «ναι».

- 🟡 **ΔΕΥΤΕΡΗ, ΝΕΚΡΗ μηχανή διάταξης κειμένου: `text-engine/layout/` (762 γραμμές, 6 modules) — μηδέν καταναλωτές (μετρημένο 2026-07-29, ADR-635 Φ C.21).** Το `layoutTextNode` / `formatParagraph` / `breakLines` / `layoutColumns` (ADR-344 Φ3) **δεν καλούνται από πουθενά** εκτός των δικών τους tests — grep σε ολόκληρο το `src/subapps/dxf-viewer`: **0 σημεία**. Η **ζωντανή** διάταξη είναι το `bim/text/text-layout.ts` (ADR-635 Φ C.20/C.21), που γράφτηκε ξεχωριστά.
  · **Γιατί προέκυψε (η αιτία, όχι το σύμπτωμα)**: το `text-engine/layout` απαιτεί **υποχρεωτικά** ένα φορτωμένο `opentype.Font` στην υπογραφή του (`ParagraphOptions.font: Font`). Η διαδρομή απόδοσης **δεν μπορεί να το εγγυηθεί** (γραμματοσειρές φορτώνονται ασύγχρονα, SSR/jest δεν έχουν καμία) ⇒ ήταν ανεφάρμοστο εξ αρχής και παρακάμφθηκε αντί να διορθωθεί.
  · **Ο κίνδυνος δεν είναι τα bytes — είναι η σύγχυση**: δύο modules με ονόματα `text-layout-engine.ts` και `text-layout.ts`, το ένα ζωντανό και το άλλο όχι. Ο επόμενος που θα ψάξει «πού γίνεται η αναδίπλωση;» έχει **50% πιθανότητα** να επεκτείνει το νεκρό. Έχει ήδη συμβεί μία φορά με το `attachment-point.ts`, που είναι το **μόνο** ζωντανό κομμάτι του φακέλου (το χρησιμοποιεί το `text-box.ts`).
  · ⚠️ **ΜΗΝ το σβήσεις επιπόλαια**: το `offsetForJustification` (`attachment-point.ts`) **ΕΙΝΑΙ** ζωντανό SSoT. Η διαγραφή αφορά τα υπόλοιπα 5 (`text-layout-engine`, `paragraph-formatter`, `line-breaker`, `column-layout`, `stacking-renderer`) + τα tests τους + καθάρισμα του `layout/index.ts`.
  · **Γιατί δεν έγινε επιτόπου (N.0.2)**: 5 αρχεία + tests + barrel = **>1h, 4+ αρχεία** ⇒ ρητά «κατέγραψε, μην το κάνεις τώρα». Επιπλέον αγγίζει το `.deadcode-baseline.json` / CHECK 3.30, άρα θέλει δικό του commit με ενημέρωση baseline.
  · **Απόφαση που χρειάζεται ο Giorgio**: διαγραφή vs διάσωση του `stacking-renderer` (στοίβες `\S`) — σήμερα η ζωντανή διάταξη αποδίδει τις στοίβες **γραμμικά** (`πάνω/κάτω`), οπότε εκεί υπάρχει πραγματική λειτουργικότητα που δεν έχει αντίγραφο.

- 🔴 **`completeEntities` σπρώχνει ΜΙΑ εγγραφή ιστορικού ΑΝΑ ΟΝΤΟΤΗΤΑ ⇒ το ψήσιμο είναι μη αναστρέψιμο ΚΑΙ σαρώνει το ιστορικό (μετρημένο ζωντανά 2026-07-29, ADR-722 §5+§9).** Το `hooks/drawing/completeEntity.ts:325` κάνει βρόχο και καλεί `completeEntity` ανά οντότητα· καθεμιά γράφει **δική της** εγγραφή στο `CommandHistory`, του οποίου το `maxHistorySize` είναι **100** (`core/commands/interfaces.ts:395`) και το `trimUndoStack` πετάει τις **παλαιότερες**.
  · **Μετρημένο στο πραγματικό εργοτάξιο**: ψήσιμο ετικετών = **1 διαγραφή + 186 δημιουργίες = 187 εγγραφές**. Στην πράξη μπόρεσαν να γίνουν **ακριβώς 100** αναιρέσεις (3.096 → 2.996) και μετά το ιστορικό **εξαντλήθηκε** — **86 ετικέτες έμειναν ορφανές και ΔΕΝ αναστράφηκαν**.
  · **Δύο συνέπειες, και η δεύτερη είναι η σοβαρή**: (α) η εντολή δεν ξεκάνεται· (β) **κάθε ψήσιμο σβήνει ΟΛΟ το προηγούμενο ιστορικό αναίρεσης της συνεδρίας** — ο χρήστης χάνει τη δυνατότητα να ξεκάνει **άσχετη** δουλειά που έκανε πριν. Το κόστος δεν πληρώνεται εκεί που φαίνεται.
  · ⚠️ **Το ADR-722 §5 τεκμηρίωνε «δύο βήματα undo»** — διορθώθηκε 2026-07-29· η παλιά διατύπωση κρατήθηκε σημασμένη ως ανακριβής.
  · **Γιατί κανένα από τα 21 tests δεν το έπιασε**: επαληθεύουν το *αποτέλεσμα* των εντολών στη σκηνή, **ποτέ το πλήθος εγγραφών ιστορικού** ούτε το ταβάνι. Η κοκκομετρία της αναίρεσης δεν είναι ιδιότητα που κοίταξε κανείς.
  · ⚠️ **ΓΙΑΤΙ ΔΕΝ ΔΙΟΡΘΩΘΗΚΕ**: το `completeEntities` είναι **ADR-057 SSoT** με καταναλωτές σε 8+ αρχεία (`tool-definitions`, `north-arrow-entities`, `ensure-*-layers`, `dxf-ai-tool-executor`, `topo-bake-commit`) ⇒ **N.8, απόφαση Giorgio**. Η σωστή λύση είναι batch εγγραφή (**ένα** `CompoundCommand`/bulk command για όλη την παρτίδα) — αλλά το ADR-722 §5 σημειώνει ότι το capability anchor του §M10g **επιβάλλει** τη διαδρομή μέσω `completeEntities`, οπότε θέλει και ενημέρωση του anchor, όχι παράκαμψη.
  · **Δοκιμή που λείπει σε κάθε περίπτωση**: test που μετρά **πόσες εγγραφές ιστορικού** παράγει μια παρτιδική εντολή. Χωρίς αυτό η ίδια κλάση σφάλματος θα ξαναγεννηθεί στον επόμενο batch παραγωγό.

- 🟡 **Νεκρή δικλείδα `if (!db)` — η **503** εκδοχή έκλεισε (0 σημεία, 2026-07-29), απομένουν **19 αρχεία** με την ίδια νεκρή δικλείδα και **άλλη** απόκριση.** Ο έλεγχος **δεν εκτελείται ποτέ**: το `getAdminFirestore()` έχει τύπο επιστροφής `Firestore`, όχι `Firestore | null` — όταν αποτύχει η αρχικοποίηση **πετάει** `FirebaseAdminInitError`, οπότε η πραγματική αποτυχία περνά **από πάνω** από τη δικλείδα.
  · ✅ **ΟΛΑ τα 22 αρχεία / 29 σημεία της 503 εκδοχής μεταφέρθηκαν** στο `requireAdminFirestore()` (ADR-245 decision log). Τα 5 που είχαν μείνει ξεμπλόκαραν με **πραγματικό de-duplication** (απόφαση Giorgio) — βλ. changelog.
  · ❌ **Το υπόλοιπο**: 19 αρχεία γράφουν `if (!adminDb) { … }` και **επιστρέφουν** κάτι (JSON με `success:false`, κενή λίστα) αντί να πετάξουν. Ίδια νεκρή δικλείδα, **διαφορετικό** σύμπτωμα: αντί για λάθος status, ο πελάτης παίρνει «κανονική» άδεια απάντηση σε περίπτωση που δεν συμβαίνει ποτέ — δηλαδή **κώδικας που κανείς δεν εκτέλεσε ποτέ και κανείς δεν θα εκτελέσει**. Ενδεικτικά: `admin/search-backfill/*` (4), `contacts/*`, `buildings/route`, `milestones/route`.
  · ⚠️ **ΓΙΑΤΙ ΔΕΝ ΜΠΗΚΕ ΩΣ forbiddenPattern:** το σχήμα `if\s*\(\s*!\w*[Dd]b\s*\)` πιάνει **και τα 19** ⇒ θα επέβαλλε **αύξηση** baseline. Ο διαχωρισμός «503 ή όχι» ζει σε **άλλη γραμμή** από το `if`, και τα registry patterns είναι κατά γραμμή (`grep -E`) — δεν εκφράζεται. **Πρόσθεσέ το όταν φτάσουν κι αυτά στο μηδέν.**
  · ⚠️ **CRLF**: το repo έχει μεικτά line endings (`core.autocrlf=true` χωρίς `.gitattributes`). Κάθε codemod regex χρειάζεται `\r?\n`, αλλιώς βγάζει **ψευδές «δεν βρέθηκε»** στα CRLF αρχεία. Το `grep -c $'\r'` **δεν** το αποκαλύπτει — χρησιμοποίησε `node -e` + `JSON.stringify`.
  Εντολή μέτρησης: `grep -rEc "if\s*\(\s*!\w*[Dd]b\s*\)" src/app/api --include=*.ts | grep -v ':0'`

- 🟡 **Διπλή global augmentation του `interface Window` (ADR-719 §7, 2026-07-28).** `src/types/window.d.ts` και `src/subapps/dxf-viewer/types/dxf-window.d.ts` δηλώνουν **και τα δύο** ιδιότητες στο `Window`, με ~7 κοινές σε **αποκλίνουσες υπογραφές** (`runLayeringWorkflowTest`: `(...args: any[]) => any` vs `() => Promise<unknown>`· `__debugSnapResults`: inline object vs `DebugSnapResult[]`). ⚠️ **ΔΕΝ λύνεται με triple-slash reference** όπως τα `declare module` του ADR-719: αν τα δύο αρχεία βρεθούν στο ίδιο program, το interface merging σκάει **TS2717**. Απαιτεί πραγματική συγχώνευση σε ένα αρχείο με έλεγχο **κάθε** καταναλωτή των 7 κοινών ιδιοτήτων (όλοι σε `debug/` του subapp). Ο φύλακας `ambient-declaration-ssot.test.ts` **δεν** το πιάνει — ελέγχει `declare module`, όχι global augmentation· δηλωμένο όριο, όχι τυφλό σημείο. 📌 ADR-719 §7.

- 🟡 **`Point2D` δηλωμένο 5 φορές μέσα στο `dxf-viewer` (μετρημένο 2026-07-27, ίδιος κύκλος).** Canonical είναι το `rendering/types/Types.ts:22` — εκεί δείχνουν πλέον και οι 3 καταναλωτές των guides. Παράλληλες **ανεξάρτητες** δηλώσεις ίδιου σχήματος: `core/commands/overlay-commands/MoveOverlayCommand.ts:28`, `snapping/overrides/SnapOverrideOrchestrator.ts:26`, `text-engine/layout/attachment-point.ts:25`, `utils/precision-positioning.ts:7`. Επιπλέον, εκτός subapp, το `types/floorplan-overlays.ts:15` έχει δικό του (**διαφορετικό domain — μην το ενοποιήσεις χωρίς σκέψη**). ⚠️ 4+ αρχεία σε 3 domains ⇒ καταγραφή, όχι blanket αντικατάσταση: το `text-engine` και το `snapping` μπορεί να θέλουν σκόπιμη αποσύνδεση από το rendering layer. **Boy-scout όταν αγγίζεις το αρχείο.** Εντολή μέτρησης: `grep -rn "^\s*\(export \)\?interface Point2D\|^\s*\(export \)\?type Point2D" src/subapps/dxf-viewer/ --include=*.ts`.

- 🟡 **`SceneBounds` ίδιου σχήματος σε δύο υποσυστήματα (2026-07-27, ίδιος κύκλος).** `components/shared/files/media/overlay-renderer/types.ts:32` (overlay renderer) και `lib/dxf-scene/scene-fit-transform.ts:43` (dxf scene fit) — **πανομοιότυπο** `{ min: {x,y}; max: {x,y} }`, ανεξάρτητες δηλώσεις, και τα δύο με ζωντανούς καταναλωτές. Πιθανή ενοποίηση σε γεωμετρικό SSoT· απαιτεί απόφαση για το πού ανήκει (κανένα από τα δύο δεν είναι προφανώς ο ιδιοκτήτης). 2 domains ⇒ καταγραφή.

- 🟡 **`Overlay.createdAt: number` → `number | null` (υπόλοιπο της ADR-218 Phase 4, 2026-07-29).** Το legacy `Overlay` (`subapps/dxf-viewer/overlays/types.ts:49-50`) δηλώνει `createdAt`/`updatedAt` ως **μη προαιρετικό `number`** και το καταναλώνουν **33 αρχεία** του subapp. Άρα το «άγνωστη στιγμή» εξακολουθεί να εκφράζεται με `?? 0` — αλλά πλέον σε **ΕΝΑ τεκμηριωμένο σύνορο** (`toLegacyOverlayMillis` στο `overlays/overlay-store-mappers.ts`) αντί για ξαναγραμμένη ανίχνευση σχήματος· η ανάγνωση περνά από τον SSoT, οπότε ISO strings / `Date` / `{seconds}` **δεν χάνονται** πια (πριν επέστρεφαν `0`). Το υπόλοιπο είναι **μόνο** η διαπλάτυνση του τύπου + έλεγχος των 33 καταναλωτών. ⚠️ 33 αρχεία σε subapp που δουλεύεται παράλληλα ⇒ **καταγραφή, όχι blanket αλλαγή**. 📌 ADR-218 Phase 4.

- 🔴 **Καμία SSoT για τη σταθερά ημέρας: `86_400_000` και τα ισοδύναμά της σε ~120 σημεία (μετρημένο 2026-07-29, κατά N.0.2 στον κύκλο ADR-218 Phase 4).** Ο SSoT **υπάρχει πλέον**: `MS_PER_DAY` εξάγεται από το `@/lib/date-local` (Phase 4). Παρ' όλα αυτά η σταθερά είναι ξαναγραμμένη σε τρεις μορφές — `86_400_000`, `86400000`, `24 * 60 * 60 * 1000` / `1000 * 60 * 60 * 24` — με **8 τοπικές δηλώσεις** `const MS_PER_DAY` / `DAY_MS` / `ONE_DAY_MS` (`report-engine/aging-calculator`, `construction-scheduling/cpm-calculator`, `procurement/utils/quote-expiration`, `TimelineTabContent/dashboard/useResourceHistogram`, `…/useScheduleDashboard`, `…/gantt/hooks/useGanttDragObserver`, `shared/addresses/editor/helpers/computeFreshness`, `dxf-viewer/bim-3d/lighting/solar-position`). Πυκνότερη συγκέντρωση: **~35 σημεία** στο `src/config/report-builder/domain-defs-*.ts`. ⚠️ **ΜΗΝ blanket sed — ο αριθμός ~120 είναι ΑΝΩ ΟΡΙΟ, όχι πλήθος διπλοτύπων.** Πολλά είναι **πολλαπλάσια με δική τους σημασία** (`7 * 24*60*60*1000` = TTL εβδομάδας, `30 * …` = παρακράτηση κάδου, `365 * …`) και **δεν** είναι «η σταθερά ημέρας»· άλλα είναι **μήνας/έτος** (`* 30.44`, `* 30`) που δεν αναλύονται σε ημέρες χωρίς ημερολόγιο. Απαιτεί ανάγνωση ανά σημείο. **Boy-scout όταν αγγίζεις το αρχείο** (έγινε ήδη σε `BimDiagnosticsView`, `construction-alert-rules`, `quick-filter-predicates`). Εντολή μέτρησης: `grep -rn "86_400_000\|86400000\|1000 \* 60 \* 60 \* 24\|24 \* 60 \* 60 \* 1000" src/ --include=*.ts --include=*.tsx \| grep -v "__tests__\|\.test\." \| wc -l`. 📌 Υποψήφιο για registry pattern **μόνο** αφού καθαριστεί — σήμερα θα έβγαζε ~120 ευρήματα ⇒ μηδέν σήμα (παγίδα N.12).

- 🟡 **Χειρόγραφο bounding box σημείων σε 59 αρχεία, ενώ υπάρχει SSoT (μετρημένο 2026-07-27, κατά N.0.2 στον κύκλο ADR-650 §M10e v22).** Ο SSoT είναι το `boundsOfPoints` (`services/clip/clip-geometry.ts`) — καταναλώνεται ήδη εκτός crop (`bim/hatch/hatch-area-label`, τώρα και `systems/geo-referencing/geo-auto-match`), και η παράμετρός του έγινε `ReadonlyArray` ώστε να μη χρειάζεται cast. Παρ' όλα αυτά ο βρόχος `minX = Infinity … if (p.x < minX)` είναι ξαναγραμμένος με το χέρι σε **59 αρχεία** του `src/`. Κατανομή: **15** `bim/geometry`, **9** `bim/structural`, **4** `systems/topography`, **3** `bim-3d/converters`, από **2** σε `bim/slabs`/`bim/renderers`/`bim/finishes`, και ×1 σε ~20 ακόμη. Εντολή μέτρησης: `for f in $(grep -rl "minX = Infinity" src --include=*.ts); do grep -qE "\.x < minX" "$f" && echo "$f"; done | wc -l`.
  ⚠️ **ΜΗΝ blanket sed — ο αριθμός 59 είναι ΑΝΩ ΟΡΙΟ, όχι πλήθος διπλοτύπων.** Ο ίδιος βρόχος απαντά **διαφορετικά ερωτήματα** ανά σημείο: 2Δ bbox λίστας σημείων (= το `boundsOfPoints`, μεταπτώσιμο), **3Δ** bbox (`Box3`/`BoundingBox3D` — άλλο σχήμα, **όχι** μεταπτώσιμο), bbox **οντοτήτων** με tolerance (`rendering/hitTesting/bounds-primitives.ts` — άλλη οικογένεια, δικός της SSoT), και **hot loops** που σκόπιμα αποφεύγουν κλήση συνάρτησης ανά κορυφή. Απαιτεί ανάγνωση ανά σημείο. **Boy-scout όταν αγγίζεις το αρχείο**, όχι εκστρατεία.
  📌 Υποψήφιο για registry pattern **μόνο** αφού καθαριστεί — σήμερα ένα καθολικό `forbiddenPattern` θα έβγαζε 59 ευρήματα ⇒ μηδέν σήμα (παγίδα N.12). 📌 ADR-650 §M10e v22 §8.

- 🟡 **`--report-chart-*` → `--chart-*`: 34 αρχεία, boy-scout μετάπτωση (2026-07-27, ADR-710 §10· UNCOMMITTED).** Οι δύο παλέτες γραφημάτων του app ενοποιήθηκαν σε **μία** SSoT των 8 χρωμάτων· τα `--report-chart-1..8` είναι πλέον **deprecated aliases** (`var(--chart-N)`) στο `globals.css`. Λειτουργικά είναι κλειστό — **τα 86 αρχεία-καταναλωτές δεν άλλαξαν και βάφουν ήδη σωστά**· μένει μόνο η ονοματολογία. Μετάπτωση **όταν αγγίζεις το αρχείο**, όχι με blanket sed. Εντολή μέτρησης: `grep -rlE "report-chart-[0-9]" src/`. Όταν φτάσει 0 → σβήσε τα aliases από το `globals.css`. ⚠️ **ΜΗΝ** προσθέσεις νέες χρήσεις `--report-chart-*`. 📌 ADR-710 §10.4.

- 🔴 **`new Intl.NumberFormat('el-GR', …)` καρφωμένο σε 27 αρχεία (μετρημένο 2026-07-27, κατά N.0.2 στον κύκλο ADR-710).** Κάθε ένα αγνοεί τον language switcher: ο χρήστης γυρίζει σε αγγλικά, τα ποσά μένουν ελληνικά. Το SSoT υπάρχει και δουλεύει — `formatCurrency` / `formatCurrencyWhole` / `formatPercentage` / `formatNumber` στο `@/lib/intl-utils`, όλα διαβάζουν `getCurrentLocale()` τη στιγμή της κλήσης. Κατανομή: **8** `src/hooks/reports/*`, **4** showcase specs (building/parking/project/storage), **4** `src/components/reports/*`, **2** `services/payment-plan-installments`, **2** `report-engine/grouping-engine`, και ×1 σε `overdue-alert.service`, `KPIAlertCard`, `EditInstallmentDialog`, `KpiTotalCommittedSpend`, `subapps/procurement/QuoteList`, `rfq-dashboard-stats`, `lib/number/greek-decimal`, `showcase-email-shared`. Εντολή μέτρησης: `grep -rn "NumberFormat('el-GR'" src/`. **ΜΗΝ blanket sed:** το `greek-decimal.ts` είναι πιθανότατα **σκόπιμα** ελληνικό (ο parser δεκαδικών του ADR-576 — το κόμμα είναι μέρος του συμβολαίου, όχι προτίμηση χρήστη), και τα email templates παράγονται server-side όπου δεν υπάρχει `i18n.language` του χρήστη — χρειάζεται ανάγνωση ανά σημείο. 5+ τομείς ⇒ καταγραφή. 📌 ADR-710 §8 #7.

- 🔴 **`<Input type="number">` σε ΔΕΚΑΔΙΚΑ πεδία → `NumericField` (ADR-706) — ΥΠΟΛΟΙΠΟ: 138 σημεία / 69 αρχεία· εκ των οποίων **46 σημεία / 24 αρχεία** με `step="0.x"` = **βεβαιωμένα δεκαδικά** (μετρημένο 2026-07-26 μετά το `sales`).**
  ✅ **DONE — domain `sales` (2026-07-26, Opus 5· UNCOMMITTED):** **18 αρχεία / ~45 πεδία** μεταναστεύθηκαν (4 dialogs · 2 financial-intelligence · 7 payments · 5 payments/financial-intelligence). Πρόοδος: `type="number"` **193→138 σημεία (−55) / 85→69 αρχεία (−16)**· `step="0.x"` **68→46 (−22) / 36→24 (−12)**. *(Το «187/81» της αρχικής καταγραφής ήταν παλαιότερο μέτρημα· το 193/85 είναι η επαναμέτρηση της 2026-07-26 με τις ίδιες εντολές ώστε το Δ να είναι συγκρίσιμο.)*
  **SSoT +1 έννοια:** `blankValue` — η κενή κατάσταση ενός `number` μοντέλου (`emptyValue` default-άρει σε αυτήν, **εξαίρεση από τα bounds**, χωρίς `aria-valuenow`). Χρειάστηκε από **45 από τα ~50** σημεία: ήταν πεδία εισαγωγής που άνοιγαν κενά με placeholder (`value={amount || ''}` — **58 εμφανίσεις** σε όλο το `src/components`)· χωρίς αυτήν η μόνη εναλλακτική ήταν wrapper ανά domain (**παγίδα N.18**). **ΟΧΙ** `number | null`: θα ανάγκαζε κάθε caller state/validator/payload να γίνει nullable για καθαρά παρουσιαστικό ζήτημα.
  **Anchors:** `src/components/sales/__tests__/sales-numeric-fields.test.tsx` (**165 GREEN**) — behavioural (πλήκτρο-πλήκτρο σε πραγματικό call site) **+** structural (σάρωση όλου του domain· 18 αρχεία δεν προστατεύονται από test ενός). **Mutation-verified:** η επαναφορά του παλιού input αναπαρήγαγε **ζωντανά** `1250.5 → 0.5`. SSoT suite **69 GREEN**, **4 mutations** επαληθευμένα. `jscpd:diff` → **0 νέα clones** (τα 8 ευρήματα επαληθεύτηκαν ως προϋπάρχοντα με εξαγωγή του `HEAD` σε ξεχωριστό δέντρο — ίδιες ακριβώς περιοχές γραμμών).
  ⏭️ **Επόμενα domains κατά προτεραιότητα (`step="0.x"`):** `building-management` (5 αρχεία) · `projects/ika` (3) · `procurement` (3) · `accounting` (3) · `shared` (2) · λοιπά ×1.
  ⚠️ **browser-verify pending** για το `sales`: το paste **δεν** αναπαράγει το ελάττωμα — απαιτείται πληκτρολόγηση χαρακτήρα-προς-χαρακτήρα (`2.4` → πρέπει να δείχνει `2,4`, όχι `04`).
  📌 **Προϋπάρχον χρέος που εντοπίστηκε (N.0.2, >1h ⇒ καταγραφή):** `ReserveDialog`/`SellDialog` μοιράζονται **6 clones** (imports + dispatch λογική accounting/appurtenances) και `EditInstallmentDialog`/`RecordPaymentDialog` **1** (import block) — προϋπήρχαν, δεν προστέθηκαν εδώ.
  **Αρχική καταγραφή (2026-07-25):** Ένα `type="number"` δεμένο σε **number** state **καταστρέφει σιωπηλά** κάθε δεκαδικό: όσο ο χρήστης γράφει `2.`, ο browser επιστρέφει `e.target.value === ""` → parse → `0` → re-render `"0"` → το επόμενο πλήκτρο διαβάζεται `"04"`. Μετρημένο στα «Όροι Δόμησης»: **`2.4`→4, `21.5`→5, `70.5`→5, αναπαραγώγιμο 5/5**. Το κόμμα επιβίωνε μόνο επειδή ο Chrome σε el locale το δέχεται ως έγκυρο χαρακτήρα. **Το ADR-576 είχε διορθώσει το parse layer — ο χαρακτήρας δεν έφτανε ποτέ εκεί.** Διορθώθηκαν τα **3** πεδία του `BuildingCodeForm` (ΣΔ / Κάλυψη / Ύψος). Εντολή μέτρησης: `grep -rn 'type="number"' src/ --exclude-dir=dxf-viewer`. **ΜΗΝ blanket sed**: το ελάττωμα χτυπά **μόνο δεκαδικά** — τα ακέραια πεδία (αριθμός ορόφων, τεμάχια, έτος) είναι σωστά με `type="number"` και μια καθολική αντικατάσταση θα τους αφαιρούσε το native stepper χωρίς λόγο. Προτεραιότητα ανά domain: **financial** (`sales/payments/*`, `accounting/*` — ποσά, επιτόκια, συντελεστές) > **BOQ/επιμετρήσεις** > **κτίρια/χώροι** (εμβαδά, ύψη) > υπόλοιπα. Το registry module `numeric-field` φυλάει **μόνο** κατά re-implementation, **όχι** κατά `type="number"` — ένα καθολικό pattern θα σήμαινε 187 ευρήματα ⇒ μηδέν σήμα (παγίδα N.12).

- 🔴 **`globalRole === 'super_admin'` ως ωμό string αντί για `isRoleBypass()` — 59 αρχεία (μετρημένο 2026-07-25, κατά N.0.2 κατά τον κύκλο ADR-702).** Ο έλεγχος «είναι προνομιούχος;» είναι γραμμένος **δύο τρόπους**: `isRoleBypass(ctx.globalRole)` σε **29** αρχεία, ωμή σύγκριση `globalRole !== 'super_admin'` / `=== 'super_admin'` σε **59**. Το `isRoleBypass` διαβάζει το `PREDEFINED_ROLES[role].isBypass` — άρα **οποιοσδήποτε δεύτερος bypass ρόλος** θα απορριφθεί σιωπηλά από τα 59, από κώδικα που διαβάζεται σωστός. Βρέθηκαν και διορθώθηκαν **3** τέτοια στον κύκλο 701 (`floors.handlers` list + `loadFloorInTenant` ×2). Εντολή μέτρησης: `grep -rEl "globalRole [!=]== ['\"]super_admin['\"]" src/`. **ΜΗΝ** το κάνεις blanket sed: ορισμένα σημεία θέλουν όντως τον *συγκεκριμένο* ρόλο (π.χ. UI που λέει «Super Admin»), όχι «οποιονδήποτε bypass» — χρειάζεται ανάγνωση ανά σημείο. Υποψήφιο για registry pattern **μόνο** αφού καθαριστεί, αλλιώς 59 allowlist entries = μηδέν σήμα.

- ✅ **PSEUDO LOCALE → ADR-666: DONE (2026-07-17, Opus 4.8· UNCOMMITTED).** Το committed pseudo (**80 αρχεία / 22.620 γρ.**) καταργήθηκε — παράγεται πλέον **runtime** από το `el` (`src/i18n/pseudo-post-processor.ts`, 35 γρ., i18next postProcessor). **Το εγκεκριμένο σχέδιο 6 βημάτων ΑΠΟΡΡΙΦΘΗΚΕ τεκμηριωμένα** (εντολή Giorgio «όπως οι μεγάλοι παίκτες»): απαιτούσε σιωπηλά **+100 dynamic imports** (`getPseudoLoader`) — γιατί **δεν υπήρχε `getPseudoLoader`**, άρα **91/100 namespaces έδειχναν ΗΔΗ ωμά ελληνικά** (`namespace-loaders.ts:228-232` → null → `lazy-config.ts:139` fallback → `:181` `addResourceBundle('pseudo', ns, elData)`). **Ο μηχανισμός που ήταν το bug έγινε ο μηχανισμός τροφοδοσίας** → `lazy-config.ts`/`namespace-loaders.ts` **δεν άγγιξαν καθόλου**. ⚠️ **Τρία στοιχεία της αρχικής καταγραφής ήταν ΛΑΘΟΣ**: ο κανόνας δεν ήταν «≤10→2, 11+→3» αλλά `min(12, max(2, ceil(μήκος_χωρίς_κενά/5)))` (15.816/16.499)· τα missing keys δεν ήταν 5.457 αλλά **10.549**· το Microsoft δεν είναι build-task αλλά *«automated transformation of source text»* (Godot/Fluent/i18next → όλα runtime). **Byte-identical ανέφικτο ΚΑΙ ανεπιθύμητο**: **144 mismatches** (30 = όλο το `showcase`, **χωρίς wrapper καθόλου** — ωμά ελληνικά μέσα στο pseudo αρχείο) + **539 stale** που έδειχναν **λάθος νόημα** (`Πωλήσεις Ακινήτων` → εμφάνιζε `Κατασκευαστικά (Οικιστικά)`) ⇒ το 100% θα ήταν αναπαραγωγή της σαπίλας. **Verification: `validate:i18n` EXIT 1→0** (693 γρ. σφαλμάτων → καθαρό· `PSEUDO 55.9%` → n/a· EL/EN ήδη 100%)· `validate:i18n-config` **3→2** errors (τα 2 προϋπάρχοντα: textAi/dxf-viewer-dimensions — **κανένα νέο**· το check **αντιστράφηκε**: απαγορεύει πλέον `locales/pseudo/` + απαιτεί τον postProcessor)· `validate:i18n-manifest` 3→3 αμετάβλητο· **48/48 tests**, **mutation-verified ×3** (22/12/7 fails, revert πράσινο)· `jscpd:diff` 4 αρχεία → **0 clones**. **ΟΧΙ tsc (N.17).** ⚠️ **browser verify pending**: 🧪 Pseudo → κάθε οθόνη τυλιγμένη (ειδικά DXF panels/ribbon)· ό,τι μείνει ελληνικό = **πραγματικό hardcoded** — το σήμα ξαναδουλεύει. 🔴 **Το πραγματικό κέρδος εκκρεμεί ως ξεχωριστή απόφαση**: το `validate:i18n` μπορεί **πρώτη φορά** να γίνει CI gate — ήταν πάντα το ζητούμενο, το pseudo ήταν το εμπόδιο. 🔴 Giorgio commit: `pseudo-post-processor.ts` NEW + test NEW + fixture NEW + `config.ts` + `language-switcher.tsx` + `i18n-governance.js` + `validate-i18n-config.js` + `check-icu-interpolation.sh` + `namespace-manifest.json` + **80 διαγραφές** + `ADR-666` NEW + `adr-index.md` + αυτό το αρχείο.

<!-- ΙΣΤΟΡΙΚΟ ΑΡΧΙΚΗΣ ΚΑΤΑΓΡΑΦΗΣ (διατηρείται για ιχνηλασιμότητα της απόρριψης του σχεδίου):
- 🔴 **PSEUDO LOCALE = generated content χωρίς generator → ADR-666 (2026-07-17, Opus 4.8· ΚΑΤΑΓΡΑΦΗ κατά N.0.2· απόφαση Giorgio «όπως οι μεγάλοι παίκτες»).** Εντοπίστηκε όταν ο Giorgio αρνήθηκε το «προϋπάρχον, δεν είναι δικό μου» για το `validate:i18n` failure. **Μετρημένα δεδομένα (16.363 ζεύγη el↔pseudo):** (α) **96,5%** ακολουθούν ντετερμινιστικό πρότυπο `[[~~ {el} ~~]]` (≤10 χαρ.→2 tildes, 11+→3) ⇒ **είναι generated content**· (β) **δεν υπάρχει generator script** πουθενά (`ls scripts/ | grep pseudo` → κενό)· (γ) κάλυψη **`dxf-viewer-shell` 237/4907 = 4,8%**, `dxf-viewer-panels` 224/1011 = 22%, **λείπουν 20 ολόκληρα namespace αρχεία**· (δ) **569 STALE κλειδιά** — το `el` άλλαξε, το pseudo όχι (π.χ. `Αυτόματη Αποδοχή Όλων` → pseudo ακόμα `[[~~~ Αποδοχή Όλων Auto ~~~]]`, παλιά αγγλική έκδοση) ⇒ **δείχνει λάθος κείμενο**· (ε) **`validate:i18n` ΔΕΝ είναι gate** — `grep` σε `scripts/git-hooks/pre-commit` + `.github/workflows/*.yml` → **μηδέν** ⇒ μόνιμα κόκκινο ⇒ **δεν θα πιάσει ΠΟΤΕ πραγματικό EL/EN σφάλμα**, τον μόνο λόγο που υπάρχει (**ίδιο pattern με ADR-663**: «a rule everyone believed was enforced, enforced by nothing»). EL/EN parity είναι **100%** — το failure είναι αποκλειστικά pseudo.
  **Πρακτική μεγάλων παικτών (τεκμηριωμένη):** Google (Closure), Microsoft (`PseudoLocalizer` build task), Mozilla (Fluent `--pseudo=accented`), Figma/Autodesk → **pseudo = build artifact, ΠΟΤΕ committed source**. Committed pseudo = σαν commit του `dist/` ⇒ εξ ορισμού σαπίζει. Ακριβώς αυτό έγινε.
  **ΣΧΕΔΙΟ ADR-666** (~6 αρχεία, 2 domains: i18n + build ⇒ N.8 Plan Mode): **1)** `scripts/generate-pseudo-locale.js` — el→pseudo για ΟΛΑ τα namespaces με τον υπάρχοντα κανόνα (δες πάνω· επαλήθευσε σε ≥3 namespaces ότι αναπαράγει byte-identical τα 15.794 συνεπή, ΠΡΙΝ σβήσεις οτιδήποτε). **2)** `package.json`: `i18n:pseudo` + **`predev`/`prebuild` hooks** (δεν υπάρχουν σήμερα — μόνο `postinstall`). **3)** `.gitignore`: `src/i18n/locales/pseudo/`. **4)** `git rm -r --cached src/i18n/locales/pseudo`. **5)** ADR-666 + index (2 πίνακες, ΜΕ ΤΟ ΧΕΡΙ). **6)** Εξέτασε αν το `validate:i18n` πρέπει να γίνει CI gate μόλις πάψει να είναι μόνιμα κόκκινο — **αυτό είναι το πραγματικό κέρδος**.
  ⚠️ **ΣΕΙΡΑ ΚΡΙΣΙΜΗ — αλυσίδα «όλα ή τίποτα»:** το `src/i18n/config.ts` έχει **9 static imports** των pseudo JSON. `.gitignore` + `git rm --cached` **ΧΩΡΙΣ** τα hooks (1+2) ⇒ **κάθε fresh clone δεν κάνει build**. Ο generator πάει ΠΡΩΤΟΣ, το `git rm` ΤΕΛΕΥΤΑΙΟ. (Τα lazy namespaces περνούν από `loadNamespace`/`loadTranslations` στο `lazy-config.ts` — 0 static pseudo imports εκεί.)
  ⚠️ Τα **7 κλειδιά του ADR-665** (`ribbon.commands.topo.terrainAutoClip.*` ×6 + `topography.terrain3d.autoClip`) λείπουν από το pseudo — **σκόπιμα δεν προστέθηκαν με το χέρι**: σε locale 4,8% θα ήταν θέατρο, και ο generator τα καλύπτει αυτόματα. Είναι μέρος των 5.457 που λείπουν, όχι ξεχωριστό θέμα.
-->
  ✅ Τα 7 κλειδιά του ADR-665 καλύπτονται πλέον **αυτόματα** από το runtime transform — παύουν να είναι θέμα.

- ✅ **CHECK 3.28 — Header filter/trash κουμπιά, Ομάδα Α + Β: DONE** (2026-07-16, Opus 4.8, N.18 + ADR-584). **Ομάδα Α** (Buildings/Parkings/Storages) = commit `d42dabd7`. **Ομάδα Β** (`projects/ProjectsHeader` · `properties/page/PropertiesHeader` · `property-management/page/PropertiesHeader` · `sales/page/SalesAvailableHeader`) **UNCOMMITTED** — απόφαση Giorgio «όπως οι μεγάλοι (Revit/Figma)»: **ΜΙΑ οπτική γλώσσα** (`ACCENT_HOVER` παντού), **ΟΧΙ** `variant: 'accent'|'subtle'` (θα κωδικοποιούσε μόνιμα την ασυνέπεια). Και τα 7 headers παίρνουν πλέον τα κουμπιά από το `buildHeaderCustomActions` — `grep -rln 'key="trash-toggle"' src/` → μόνο το SSoT. ⚠️ **Ο πίνακας διαφορών που ήταν εδώ ήταν εν μέρει λάθος** (`spacing.padding.sm` **είναι** `p-2`· ο `ProjectsHeader` **δεν** ήταν διάλεκτος Β) — και **βρέθηκε προϋπάρχον bug**: `radius.md` = `'0.5rem'` (raw value, όχι `rounded-md`) → άκυρη κλάση → το filter button ήταν **τετράγωνο** σε Parkings/Storages· fix `radiusClass.md`. Πλήρη επαληθευμένα δεδομένα + a11y κέρδη: **ADR-584 changelog**. ⚠️ **browser-verify pending** (κανένα test δεν αποδίδει headers). ✅ `jscpd:baseline` **ΕΤΡΕΞΕ** (2026-07-16, μετά το commit του Giorgio, καθαρό δέντρο): full scan **2857** clones vs baseline 3059 → **−202** κλειδώθηκε. Νέο baseline: 2857 clones / 32.517 διπλότυπες γρ. / **2,08%** (από 2,31%). Το ενδιάμεσο **2906/−153** ήταν μέτρηση με ξένη uncommitted δουλειά στο δέντρο· η τελική είναι −202. `sources` 9660→9694 (+34 αρχεία **ενώ** τα clones έπεσαν = υπογραφή σωστής κεντρικοποίησης, όχι scaffolding).

**🔴 OpenAI raw-`fetch` call sites — 8 Responses + 4 Chat Completions ΑΠΟΜΕΝΟΥΝ (2026-07-16, Opus 4.8, ADR-294/373· ΚΑΤΑΓΡΑΦΗ κατά N.0.2, ΔΕΝ ΠΙΑΣΤΗΚΑΝ).**

Ο πυρήνας **ΕΓΙΝΕ** (3 clients → `src/services/ai/openai-responses/`· 114 characterization tests GREEN αμετάβλητα· το κενό του ratchet **έκλεισε** με νέο pattern `fetch\([^)]*(/responses|/chat/completions)` + golden fixture, 90/90).

⚠️ **Το εύρος ήταν 3× μεγαλύτερο απ' ό,τι έδειχνε το jscpd.** Ο χάρτης του handoff έλεγε «4+1 αρχεία»· το πραγματικό grep βρήκε **11 Responses + 4 Chat Completions** call sites. **Γιατί:** το jscpd έχει κατώφλι 50 tokens — κάθε site μόνο του πέφτει κάτω από το όριο, μαζί όμως είναι η μεγαλύτερη οικογένεια. **Δίδαγμα: το jscpd δείχνει συμπτώματα, όχι έκταση — για «όλα τα Χ» θέλει grep.**

**ΑΠΟΜΕΝΟΥΝ (όλα στο ratchet baseline → μόνο μειώνονται· νέο raw fetch ΜΠΛΟΚΑΡΕΤΑΙ):**
- **Responses API (8)** — τα περισσότερα byte-for-byte με τα 3 που έγιναν, άρα φθηνά: `services/ai-pipeline/shared/ai-reply-openai.ts` · `services/contact-relationships/relationship-type-ai-inference.ts` · `services/ai-pipeline/document-preview-service.ts` · `services/ai-pipeline/invoice-entity-extractor.ts` · `services/ai-pipeline/tools/handlers/contact-document-classifier.ts` · `…/document-reader-handler.ts` · `…/iso19650-enricher.ts` · `app/api/dxf/text/ai/command/route.ts` (ελαφρώς διαφορετικό error handling). **Συνταγή:** διάγραψε τους τοπικούς τύπους + `extractOutputText` + τον βρόχο fetch· `import { executeResponsesRequest, extractOutputText } from '@/services/ai/openai-responses'`. ⚠️ N.10: τα 5 είναι σε `ai-pipeline/` → `npm run test:ai-pipeline:all` υποχρεωτικό.
- **Chat Completions (4)** — `services/ai-pipeline/agentic-openai-client.ts` · `subapps/dxf-viewer/ai-assistant/dxf-openai-call.ts` · `app/api/financial-intelligence/query/route.ts` · `app/api/voice/polish/route.ts`. **ΔΕΝ μπαίνουν στον Responses SSoT** — άλλο wire protocol (`choices[].message`+`tool_calls`, όχι `output[].content[]`). Θέλουν **δικό τους** SSoT ή μετάβαση στο AI SDK (`vercel-ai-engine.ts`).

⚠️ **Ο `agentic-openai-client.ts` ΔΕΝ είναι νεκρός** παρότι ο header του λέει «LEGACY — DISABLED»: τον εισάγουν ζωντανά `agentic-loop.ts` (`callChatCompletions`) + `agentic-tool-runner.ts` (`extractTextContent`). **ΜΗΝ τον σβήσεις** (ο προηγούμενος χάρτης πρότεινε «πιθανώς delete» — θα έσπαγε production). Ο header θέλει διόρθωση.

✅ **timer leak — ΔΙΟΡΘΩΘΗΚΕ ΣΤΟ SSoT (2026-07-17, Opus 4.8, ADR-294· απόφαση Giorgio 2026-07-16).** Το `postResponsesOnce` χρησιμοποιεί πλέον `AbortSignal.timeout(config.timeoutMs)` — **όχι** `finally { clearTimeout }`: το native primitive δεν έχει timer να ξεχαστεί, και είναι **ήδη η ντε-φάκτο σύμβαση του repo** (watermark/geocoding/overpass/euribor). Καλύπτει **και τα 3 migrated sites**. 114/114 characterization tests GREEN αμετάβλητα.

🔴 **ΑΠΟΜΕΝΕΙ: το ίδιο μοτίβο στα υπόλοιπα 8 Responses sites — ΑΠΟΦΑΣΗ GIORGIO «όχι τώρα» (2026-07-16).** ⚠️ **ΜΗΝ κάνεις τυφλό sed/replace.** Το `AbortSignal.timeout()` πετάει **`TimeoutError`**, ενώ ο χειροκίνητος controller πετάει **`AbortError`**. Στο SSoT ήταν αβλαβές (το retry loop πιάνει κάθε error αδιακρίτως), **αλλά** grep βρήκε καταναλωτές που **διακλαδίζονται σε `error.name === 'AbortError'`**: `subapps/geo-canvas/services/map/ElevationService.ts:213` · `hooks/procurement/useSpendAnalytics.ts:134` · `hooks/useFirestoreProjects.ts:192`. Εκεί η αλλαγή **σπάει ΣΙΩΠΗΛΑ** (το branch απλά δεν μπαίνει ποτέ). Επιπλέον αυτά τα 3 είναι **abort-on-unmount**, όχι timeout — **άλλο πρόβλημα**, ίσως δεν θέλουν καθόλου την αλλαγή. **Συνταγή ανά site:** (1) grep τον καταναλωτή για `error.name`· (2) αν ελέγχει `AbortError` → είτε άφησέ το είτε άλλαξε **και** τον έλεγχο (`name === 'TimeoutError' || name === 'AbortError'`)· (3) αν συνδυάζεις εξωτερικό signal: `AbortSignal.any([external, AbortSignal.timeout(ms)])`. **jsdom υποστηρίζει και τα δύο** (επαληθεύτηκε εμπειρικά 2026-07-17, όχι υπόθεση).

**🆕 ΔΥΟ `useVoiceRecorder` (2026-07-16, Opus 4.8, ADR-584 media session pass) — ΚΑΤΑΓΡΑΦΗ, ΔΕΝ ΠΙΑΣΤΗΚΕ.** Υπάρχουν **δύο ανεξάρτητες** υλοποιήσεις voice recording: `src/hooks/useVoiceRecorder.ts` (ADR-161, Whisper gateway) και `src/subapps/dxf-viewer/text-engine/ai/useVoiceRecorder.ts` (ADR-344 Φ12, δικό του `DXF_TIMING.lifecycle.MAX_RECORDING` + `isSupported` feature-detect). **Και τα δύο** ποστάρουν στο ίδιο `transcribeVoiceWithPolicy`. jscpd-αόρατα μεταξύ τους (διαφορετικό status union/return shape), αλλά **εννοιολογικά δίδυμα**. **Γιατί ΔΕΝ το έκανα:** το dxf-viewer είναι subapp **άλλου πράκτορα** + 2 domains → N.8 θέλει έγκριση Giorgio. Το `lib/media/media-mime.ts` υπάρχει πλέον ως πιθανό κοινό έδαφος.

**🆕 `useVideoRecorder.stopCamera` — προϋπάρχον latent bug (2026-07-16, Opus 4.8) — ΚΑΤΑΓΡΑΦΗ.** Το `stopCamera()` σταματά τα tracks αλλά **ΟΧΙ** το `setInterval` tick ούτε τον `MediaRecorder`. `stopCamera()` την ώρα της εγγραφής → `durationMs` συνεχίζει να αυξάνεται με status `idle`, ο recorder μένει `recording`. **Δεν το διόρθωσα** γιατί απαιτεί **απόφαση συμπεριφοράς** (να ακυρώνεται η εγγραφή; να finalize-άρεται σε αρχείο;) — δεν είναι μηχανική κεντρικοποίηση. Το `useMediaStreamSession` δίνει `onStopped` hook όπου θα κουμπώσει η λύση όταν αποφασιστεί.

**🆕 Backlog από το full `jscpd:check` σάρωμα (2026-07-16, Opus 4.8) — τα επόμενα clusters, κατά σειρά αξίας.** Σύνολο repo: **3035 clones / 35.9k διπλές γραμμές (2.30%)**. Δεν είναι όλα κεντρικοποιήσιμα — αυτά είναι τα πραγματικά:

| Cluster | Μέγεθος | Σημείωση |
|---|---|---|
| ~~`hooks/` ↔ `hooks/`~~ → **`src/hooks/` ↔ `src/hooks/`** (η παλιά γραμμή έλεγε σκέτο `hooks/` — **ΔΕΝ** είναι του dxf-viewer· είναι τα hooks της **κύριας εφαρμογής**) | **1331 γρ. / 82 clones / 32 αρχεία** | Το μεγαλύτερο cluster του repo. 🟢 **Ο πυρήνας ΕΓΙΝΕ** (ADR-664, −24 clones/428 γρ.): η υπόθεση «μάλλον impact-guard hooks» **επιβεβαιώθηκε**. 🟢 **Και ο 2ος στόχος ΕΓΙΝΕ** (ADR-195 Phase 12 / ADR-584, **UNCOMMITTED**): `useEntityAudit` ↔ `useGlobalAuditTrail` (ήταν 107 γρ./6 clones/570 tokens). **ΔΕΝ έγιναν merge** — το registry module `entity-audit-trail` (ADR-195) δηλώνει **ρητά ΚΑΙ ΤΑ ΔΥΟ canonical** + allowlisted, και τα `forbiddenPatterns` απαγορεύουν re-implementation του **καθενός**. Το plumbing (live subscription + HTTP tail + dedupe/sort) ζει πλέον **μία φορά** στο νέο `src/hooks/audit/useAuditFeed.ts`· τα 2 public hooks έμειναν canonical wrappers με **αυτούσιες** υπογραφές/paths → **το registry δεν άλλαξε**. 37/37 tests GREEN, `jscpd:diff` καθαρό. 🟢 **Και ο 3ος ΕΓΙΝΕ** (ADR-584 changelog, **UNCOMMITTED**): `useBorderTokens` **self-clones** → **3 clones/112 γρ. → 0/0** (μετρημένο). Το `quick` ήταν γραμμένο **2 φορές** (hook + static `borderTokens`) και το `colorMap`/`directionMap` **3 φορές** → ένα `QUICK_BORDERS` + hoisted maps + pure `directionalBorder()`. Public API αμετάβλητο (50+ καταναλωτές δεν αγγίχτηκαν). **Ήταν ΑΤΕΣΤΩΤΟ** → νέα characterization suite 41 tests (γραμμένη ΠΡΙΝ το refactor, GREEN και στις 2 εκδοχές), mutation-verified. ⚠️ Το `getStatusBorder` **ΔΕΝ** ενοποιήθηκε με το `STATUS_BASE_BORDER`: αποκλίνουν πραγματικά (interpolated design tokens vs Tailwind CSS-var) — η ομοιότητα είναι επιφανειακή. 🟢 **Και ο 4ος ΕΓΙΝΕ** (ADR-584 changelog, **UNCOMMITTED**): `useCameraCapture` ↔ `useVideoRecorder` → **4 clones/64 γρ./369 tokens → 0/0/0** (μετρημένο· τα συνολικά tokens **έπεσαν** παρότι μπήκαν 2 νέα modules στο σάρωμα). Νέο SSoT `hooks/media/useMediaStreamSession.ts` (η κοινή getUserMedia συνεδρία· το `mapErrorToCode` ήταν **byte-identical** στα δύο) + `lib/media/media-mime.ts` (MIME probe/extension, κοινό και με το `useVoiceRecorder`). Registry module **`media-stream-session`** (pattern `OverconstrainedError`· 0 παραβιάσεις → κανένα baseline· 86/86 golden GREEN). **ΚΑΙ ΤΑ ΔΥΟ ήταν ΑΤΕΣΤΩΤΑ** → 3 νέες suites / 49 tests, mutation-verified σε 2 επίπεδα. ⚠️ Το `useVoiceRecorder` **ΔΕΝ** μπήκε στη session (δεν είναι δίδυμο: χωρίς preview/stopCamera, string-matching αντί mapErrorToCode, Whisper-coupled) — μοιράζεται μόνο τους MIME helpers. 🟢 **Και ο 5ος ΕΓΙΝΕ** (ADR-234/ADR-230/ADR-584, **UNCOMMITTED**): ο στόχος έλεγε «`usePaymentPlan` self-clones (69 γρ.)» = **1 αρχείο**· η μέτρηση είπε **τετράδα** — `usePaymentPlan` ↔ `useChequeRegistry` ↔ `useLoanTracking` (16 clones) **+ `useLegalContracts`** (άλλο gateway, ADR-230· +3) = **19 clones / 229 γρ. (28.17%) / 23 mutation callbacks → 0**. Άρα **κλείνει ΚΑΙ το `useChequeRegistry` ↔ `useLoanTracking` (48 γρ.)** — ήταν το ίδιο archetype, όχι ξεχωριστό item. Νέα SSoT: `lib/mutations/gateway-action.ts` (`runGatewayAction` — guard/gateway/refetch/`ActionResult`), `lib/api/fetch-json.ts` (ήταν **5 ταυτόσημα** αντίγραφα), `hooks/api/useApiList.ts` (cheque+loan μόνο). Registry module **`gateway-action`** (0 παραβιάσεις → κανένα baseline· golden 90/90). **ΟΛΑ ήταν ΑΤΕΣΤΩΤΑ** → 182 tests (γραμμένα ΠΡΙΝ το merge, GREEN πριν ΚΑΙ μετά), mutation-verified ×2. 🔴 **Μία σκόπιμη αλλαγή**: το `deletePlan` ήταν το μόνο από τα 9 χωρίς guard (έφτανε στο gateway με null propertyId) → έκλεισε. ⚠️ Το `useInterestCalculator` **μετρήθηκε +0 clones** και έμεινε έξω — μοιράζεται μόνο το *όνομα* `fetchJson`, η δική του είναι παραλλαγή. 🟢 **Και ο 6ος ΕΓΙΝΕ** (ADR-051/ADR-584, **UNCOMMITTED**): ο στόχος έλεγε «`usePropertyEditor` ↔ `usePropertyViewer` (61 γρ.)» = **ένα ζεύγος, ένα είδος διπλότυπου**· η μέτρηση είπε **τρία άσχετα διπλότυπα σε 4 αρχεία → 4 clones → 0** (και **κανένα** δεν ήταν αντιγραμμένη *μηχανή*): (α) η **λίστα πεδίων** του editor γραφόταν **3×** (return / destructure / re-export) → `const editor = usePropertyEditor()` + `...editor` (νέο πεδίο: 3 edits → 1)· (β) `DEFAULT_PUBLIC_FILTERS` = **byte-identical** αντίγραφο του `DEFAULT_FILTERS`· (γ) το inline `emptyStats` του `usePropertyFilters` = αντίγραφο του `DEFAULT_STATS`. **Το audit άλλαξε το σχήμα**: τα διπλότυπα ήταν **σύμπτωμα κυκλικού import** (`usePropertyViewer` → `usePropertyEditor` → `usePropertyViewer` για το `DEFAULT_FILTERS`) — οι zero values ζούσαν σε **hook**. Λύση κατά τη σύμβαση του repo (`EMPTY_STATS` δίπλα στο interface του): **η zero value ζει δίπλα στον τύπο** → `DEFAULT_FILTERS` σε `types/property-viewer.ts`, `DEFAULT_PROPERTY_STATS` σε `types/property.ts`. **Ο κύκλος έσπασε· κανένα back-compat re-export** (δύο σπίτια = η αιτία). ⚠️ Επαληθεύτηκε ότι το `AdvancedFilters/configs/` (όπου ζουν τα αδέλφια `defaultPropertyFilters`/`defaultUnitFilters`) θα **ξαναέφτιαχνε τον κύκλο** — το βέλος είναι `types/property-viewer → AdvancedFilters`. **ΚΑΝΕΝΑ registry module — σκόπιμα**: τα candidate patterns grep-verified και **απορρίφθηκαν** (το `priceRange: { min: undefined, max: undefined }` χτυπά νόμιμα 4 configs άλλων τύπων· καμία γραμμή δεν ζει *μόνο* στο SSoT). **ΟΛΑ ήταν ΑΤΕΣΤΩΤΑ** → 85 tests (ΠΡΙΝ το refactor, GREEN πριν ΚΑΙ μετά, τιμές γραμμένες **ανεξάρτητα** στο test), mutation-verified ×2, ESLint 0. −89 γρ. Boy Scout: dead `FALLBACK_FLOOR_ID`. ⚠️ Τα `usePropertiesViewerState`/`usePropertyState`/`usePropertyDescriptionGenerator` μετρήθηκαν **+0** και το grep το **επιβεβαίωσε** (computed stats / άλλο σχήμα) — τεκμηριωμένα έξω. 🟢 **Και ο 7ος —ΤΕΛΕΥΤΑΙΟΣ— ΕΓΙΝΕ** (ADR-226/ADR-584, **UNCOMMITTED**): `useDeletionGuard` ↔ `useLinkRemovalGuard` → **3 clones / ~46 γρ. → 0**. **Για πρώτη φορά το όνομα ταίριαξε με τη μέτρηση** — όλα τα αδέλφια ελέγχθηκαν ένα-ένα και μέτρησαν **+0** (`usePropertyDeletionGuard` = **καταναλωτής**, όχι δίδυμο· `useContactUpdateGuards`· `useLandownerUnlinkGuard`). Μία state machine γραμμένη 2×, διέφερε σε **3 μόνο** σημεία → νέο SSoT `src/hooks/guards/useDependencyGuard.tsx` + `DependencyGuardSpec` (route/μήνυμα/logName). **Public API αυτούσιο → κανένας από τους 10 καταναλωτές δεν άγγιξε.** Τα 2 μηνύματα («διαγραφή» vs «αποσύνδεση») = **spec**, έμειναν per-binding· η στενότερη επιφάνεια του link guard **διατηρήθηκε** (ευκολότερο να προσθέσεις API παρά να το πάρεις πίσω). **Spec σε ref, όχι dep** — ακριβώς το bug που έλυσε το ADR-664 στην ίδια οικογένεια. 🔴 **Το συμβόλαιο που πλέον προστατεύεται: FAIL-CLOSED** (αν σκάσει ο έλεγχος → μπλοκάρει· ο server 409 είναι το τελευταίο δίχτυ). ⛔ **`useLandownerUnlinkGuard` ΕΞΩ — και το `grep` το έκρινε, όχι το jscpd**: μέτρησε +0 (κάτω από το κατώφλι) αλλά το grep το έφερε· η ανάγνωση αντέστρεψε το συμπέρασμα — **ADR-244**, άλλος τύπος (`LandownerUnlinkResult`/`variant`), χωρίς dialog, και **fail-OPEN κατά ρητή τεκμηριωμένη απόφαση**. Merge θα **αντέστρεφε την πολιτική ασφαλείας του**. Registry module **`dependency-guard`** (pattern `apiClient\.get<DependencyCheckResult>` — διαλέχτηκε αφού grep-verify **απέρριψε** 3 υποψηφίους που χτυπούσαν νόμιμα αρχεία· **0 παραβιάσεις → κανένα baseline**· golden 90/90· flat 358). **ΚΑΙ ΤΑ ΔΥΟ ΑΤΕΣΤΩΤΑ** → 22 tests (ΠΡΙΝ, GREEN πριν ΚΑΙ μετά), mutation-verified ×2 (λάθος route → 1 κόκκινο· fail-open → **4 κόκκινα**), ESLint 0, `jscpd:diff` καθαρό ΧΩΡΙΣ SKIP. **ADR-226 διορθώθηκε κατά τον κώδικα** (N.0.1): έλειπε το `checkResult` από το documented return· `.ts`→`.tsx`. ✅ **Ο clone cluster `src/hooks/ ↔ src/hooks/` ΕΞΑΝΤΛΗΘΗΚΕ — δεν απομένει στόχος σε αυτή τη λίστα.** Η `use*TrashState` τετράδα (~115 γρ.) **ΕΓΙΝΕ** (ADR-281/584, UNCOMMITTED). |
| `useGuideActions` ↔ `useGuideState` | 157 γρ. (66+47+44) | ⚠️ **ADR-040 files** — ο διαχωρισμός mutations-only vs reactive είναι **σκόπιμος**. Πιθανό κοινό pure core, ΟΧΙ merge. Θέλει ADR-040 staging (CHECK 6B). |
| `WallDna` δεν χρησιμοποιεί `LayeredBuildup` | εννοιολογικό | 🟡 **ΜΕΡΙΚΩΣ ΕΓΙΝΕ** (2026-07-17, ADR-584/363, **UNCOMMITTED**) — **η αριθμητική ενοποιήθηκε, το σχήμα ΟΧΙ (σκόπιμα)**. Το `computeTotalThickness` του τοίχου ήταν **byte-identical** με το `computeBuildupTotalThickness` → τώρα thin wrapper που delegate-άρει (ίδιο μοτίβο με το `computeSlabTotalThickness`). Public API **αμετάβλητο** → οι 6 καταναλωτές δεν αγγίχτηκαν, **1 αρχείο πηγής**. jscpd-αόρατο ήταν (3 γρ. < min-tokens 50) — γι' αυτό επέζησε. 🔴 **Το `WallDna = LayeredBuildup<WallLayerSide>` ΔΕΝ έγινε και ΔΕΝ πρέπει να «διορθωθεί» αφελώς**: τα wall layers κουβαλάνε `side`, το SSoT λέει `zone`, και το `dna` είναι **persisted σε ΔΥΟ επίπεδα** — `WallParams.dna` (entity docs) + `WallTypeParams.dna` (`typeParams`→Firestore, ADR-412) → `side`→`zone` = **migration**, όχι rename (75 σημεία / 22 αρχεία, μετρημένα). **Απόφαση Giorgio 2026-07-17**: πρακτική μεγάλων παιχτών — Revit/IFC έχουν ενιαίο compound-structure concept ΑΛΛΑ **κανείς δεν κάνει schema migration για κοσμητικό rename**· versioned reader αντ' αυτού. Η απόκλιση είναι πλέον **τεκμηριωμένη** στα headers **και των δύο** modules (ήταν σιωπηλή· το `layered-buildup.ts` μάλιστα **ψευδώς** ισχυριζόταν ότι ο τοίχος το παραμετροποιεί — διορθώθηκε). Το `WallDna` ικανοποιεί ήδη δομικά το `BuildupThicknessSource` → **όλοι** οι generic helpers δουλεύουν πάνω του σήμερα. Αν ποτέ γίνει: ADR + reader-tolerant migration (δέχεται `side` ΚΑΙ `zone`, γράφει `zone`), ΟΧΙ big-bang backfill. ⚠️ **Εύρημα**: το `layered-buildup` **δεν έχει καθόλου module στο `.ssot-registry.json`** — το SSoT υπάρχει αλλά **δεν το προστατεύει ratchet** (γι' αυτό ξέφυγε ο τοίχος σιωπηλά). Δεν προστέθηκε — θέλει εντολή. 11/11 tests GREEN, mutation-verified ×2, `jscpd:diff` καθαρό. |
| `ExtendToolStore` ↔ `TrimToolStore` | 51 γρ. / 206 tokens | Δίδυμα tool stores. 🟡 **Υλοποιημένο, UNCOMMITTED** (`createEdgeToolStore.ts` + `edge-tool-shared.ts`) — σβήσε τη γραμμή όταν μπει στο commit. |
| ~~`contextual-mep-{data-outlet,socket}-tab`~~ | 58 γρ. / 366 tokens | 🟢 **ΕΓΙΝΕ ΗΔΗ — commit `28d1bec9`** («ADR-584 — MEP outlet contextual tab factory SSoT», 2026-07-16). Επαληθεύτηκε 2026-07-17: το `mep-outlet-contextual-tab-factory.ts` **υπάρχει** και **ΚΑΙ ΤΑ ΔΥΟ** αρχεία είναι ήδη thin configs του (40 γρ. έκαστο, μόνο labels+trigger διαφέρουν)· `jscpd:diff` καθαρό. ⚠️ **Η γραμμή ήταν STALE** — η δουλειά είχε γίνει, το backlog δεν ενημερώθηκε (2ο περιστατικό μετά το «railing hit-testing gap» της 2026-07-16). Η σημείωση «SSoT υπάρχει ήδη → αναδοχή» εννοούσε τον `ribbon-mep-auto-bridge` (τον οποίο όντως επαναχρησιμοποιούν) — αλλά ο πραγματικός de-dup έγινε με **νέο** factory. |
| ~~`canvas-mouse-types` ↔ `unified-grip-types`~~ | 65 γρ. | 🟢 **ΕΓΙΝΕ** (2026-07-17, ADR-183/584, **UNCOMMITTED**) — **μετρημένο: 1 clone / 65 γρ. / 118 tokens → 0**· το αρχείο 187 → 157 γρ. **Έξι** interfaces (`VertexHoverInfo`, `EdgeHoverInfo`, `SelectedGrip`, `Dragging{Vertex,EdgeMidpoint,OverlayBody}State`) ήταν δηλωμένα **δομικά ταυτόσημα** στα δύο. **Ο SSoT υπήρχε ήδη**: το `unified-grip-types.ts` **αυτο-ανακηρύσσεται** canonical στο header του — το `canvas-mouse-types.ts` απλώς δεν τον υιοθέτησε ποτέ → **αναδοχή με re-export, ΟΧΙ νέο module** (ίδιο μοτίβο με `grip-kinds.ts`). Public API αμετάβλητο → **1 αρχείο**· από 27 καταναλωτές (3 μέσω `canvas-mouse-types`) **κανένας δεν αγγίχτηκε**. `DraggingGuideState` + `GripHoverThrottle` έμειναν — δεν είναι δίδυμα. Κύκλος: κανένας (grep-verified· type-only ούτως ή άλλως). 465/466 GREEN, `jscpd:diff` καθαρό. **🔴 ΟΡΙΟ ΕΠΑΛΗΘΕΥΣΗΣ**: type-only αλλαγή σε subapp **excluded από το root tsconfig** (γρ. 39) + jest με **`@swc/jest`** (σβήνει τύπους, **δεν** κάνει typecheck) → **ούτε τα tests ούτε το hook αποδεικνύουν type-ορθότητα**· μόνο το **CHECK 3.29 στο CI** (ADR-663). Υποκατάστατο = grep κάθε τοπικού ονόματος → **έπιασε πραγματικό λάθος** (`export type {…}` δεν φέρνει ονόματα σε τοπικό scope). ⚠️ 1 pre-existing FAIL (`dxf-scene-entity-toDxf-coverage`, ADR-587 Φ5) **ΔΕΝ είναι δικό μου** — πέφτει ταυτόσημα στο HEAD (revert+rerun verified)· ρεύμα άλλου agent. |
| ~~`openai-document-analyzer` ↔ `openai-quote-analyzer`~~ | 46 γρ. / 217 tokens | 🟢 **ΕΓΙΝΕ** (2026-07-16, ADR-294/373, **UNCOMMITTED**) — μαζί με τον 3ο αδελφό `OpenAIAnalysisProvider`. Βλ. τη νέα εγγραφή «OpenAI Responses-API» παρακάτω για τα **8+4 που ΑΠΟΜΕΝΟΥΝ**. |
| `BuildingPhotosTab` ↔ `BuildingVideosTab` | 44 γρ. / 233 tokens | Media-tab δίδυμα. |
| `SpaceFloorplanInline` ↔ `FloorFloorplanInline` | 44 γρ. / 193 tokens | |
| `floorplan-dxf-renderer` ↔ `thumbnail-generator` | 53 γρ. / 323 tokens | ⚠️ 2 domains. |

**🆕 BIM renderer fill+outline body — ΤΟ ΤΕΛΕΥΤΑΙΟ κομμάτι του BIM cluster (2026-07-16, Opus 4.8, N.18 + ADR-584).** Ρεύματα που **ΕΓΙΝΑΝ**: hitTest+getGrips (51→40), hover-halo (40→26), drawPolygonPath+drawStroke/drawPolyline+getGrips-map (26→**13**). Απομένουν **13 clones**, μία οικογένεια — και **ΔΕΝ είναι μηχανικό de-dup**:

1. **fill+outline body sequence** — `fillStyle → trace → fill → strokeStyle → lineWidth → [setLineDash] → trace → stroke` σε MepBoiler/MepFitting/MepFixture/MepManifold/MepRadiator/MepSegment/MepUnderfloor/MepWaterHeater.

**⚠️ ΓΙΑΤΙ ΔΕΝ ΤΟ ΕΚΑΝΑ (δύο πραγματικοί λόγοι, τεκμηριωμένοι):**
- **Παραμετρικό soup**: αποκλίνουν σε lineWidth (`NORMAL` vs `THIN`), σε dash (MepSegment/MepFitting/MepUnderfloor έχουν, οι συσκευές όχι) και σε πηγή fill (`adaptFillTintForCanvas` vs `resolveBimBodyFill`) → ένας helper θα ήθελε ~5 params = ακριβώς το god-helper που απαγορεύει το ADR.
- **🔴 Σκόπιμη διαρροή ctx state**: ο `MepBoiler` βάζει `lineWidth = NORMAL` για το outline και **τα symbol strokes από κάτω βασίζονται στο ότι το κληρονομούν** μέχρι το ρητό `THIN`. Helper τύπου `strokePolygonOutline` (κάνει save/restore) θα το **επανέφερε σιωπηλά** → πραγματική αλλαγή σχεδίασης μέσα σε de-dup commit.

**Θέλει απόφαση σχεδίασης, όχι σάρωμα.** Πιθανή σωστή λύση: `fillAndStrokePolygonScreen` **ΧΩΡΙΣ** save/restore (ώστε η διαρροή να διατηρηθεί αυτούσια) + optional dash — αλλά αξίζει μόνο αν κρατηθεί κάτω από 4 params. Αλλιώς: άφησέ τα.

**ℹ️ Το «base class blocker» που έλεγαν οι προηγούμενες εκδόσεις αυτής της γραμμής ΔΕΝ ισχύει** — `paintPolygonHoverHalo`/`tracePolygonScreenPath`/`strokePolylinePaths`/`mapBimGrips` είναι **ελεύθερες συναρτήσεις**, καλούνται από οποιονδήποτε renderer· καμία αλλαγή κληρονομιάς. (Το `beginPhasedBodyRender` είναι method και **αυτό** θέλει base class — χωριστή δουλειά.)

**Ratchet**: commits που αγγίζουν πολλά sibling renderers χρειάζονται `SKIP_JSCPD_DIFF=1` (βλ. περιορισμό `--diff` παρακάτω).

**✅ ΛΥΘΗΚΕ 30/10 (ADR-584 §9):** το `--diff` μπλοκάρει πλέον **μόνο** κλώνους που τέμνουν γραμμές που έγραψε το commit· οι προϋπάρχοντες αναφέρονται, δεν μπλοκάρουν — **καμία** ανάγκη για `SKIP_JSCPD_DIFF=1` στα παρακάτω σενάρια. *Ιστορικό:* **ℹ️ Περιορισμός CHECK 3.28 `--diff`:** το `--diff` σάρωνε **ΟΛΟΚΛΗΡΑ** τα staged αρχεία και θεωρούσε κάθε clone μεταξύ τους «same-commit clone». Σε commit που αγγίζει 15+ sibling renderers (π.χ. cross-cutting SSoT swap), αναφέρει τα **προϋπάρχοντα** δομικά δίδυμα ως νέα → false-positive FAIL ακόμα κι όταν το diff **μειώνει** duplication. Το Layer 2 (`jscpd-ratchet.yml`, full scan vs baseline) δεν έχει αυτό το πρόβλημα.

- ✅ **CHECK 3.28 cross-file clone — CRM task/calendar dialogs (cluster 5): DONE (2026-07-16, Opus 4.8, N.18 + ADR-584· UNCOMMITTED).** Το ρεύμα είχε μείνει **μισοτελειωμένο** από προηγούμενο session (VS Code crash): τα atoms είχαν εξαχθεί (`ui/date-picker-field`, `ui/enum-select`, `crm/shared/TaskDialogFormFooter`, `constants/crm-task-enums`, `i18n/date-fns-locale`, `combineDateAndTime`/`splitDateAndTime` στο `date-local.ts`) αλλά τα **δύο dialogs έμεναν δίδυμα στο περίβλημα** → `jscpd:diff` **7 clone pairs** (ακριβώς το N.18 failure mode). Εξήχθησαν τα 2 υπόλοιπα SSoT: **`crm/shared/TaskDialogShell.tsx`** (Dialog→header icon+title→sr-only desc→form→children→footer· κατέχει το iconSizes/sp/layout τρίο + αποδίδει το ίδιο το footer, αφού το `onCancel` ήταν ταυτόσημο) + **`crm/shared/TaskFormField.tsx`** (fieldset+Label+control· optional `action` slot για το `VoiceMicButton` — το μόνο σημείο απόκλισης). **No-god-shell:** κάθε dialog κρατά τα δικά του πεδία ως children (create=επαφή/έργο/υπενθύμιση/endDate, edit=κατάσταση/προτεραιότητα)· `TaskDetailPanel` σκόπιμα εκτός (πληκτρολογήσιμο date field + PopoverAnchor = άλλο UX, τεκμηριωμένο). **Επίσης: `types/crm-extra.ts` ΔΙΑΓΡΑΦΗΚΕ** — ανταγωνιστικό re-declaration των 3 unions δίπλα στο νέο `crm-task-enums` SSoT· ο μοναδικός καταναλωτής (`task-activity.ts`) → `@/types/crm` (re-export του SSoT). **Verification: `jscpd:diff` 16 files = 7→0 clones (ΧΩΡΙΣ `SKIP_JSCPD_DIFF`)· 13 NEW date-local SSoT tests → 27/27 GREEN· grep-verified 0 orphan refs· 398→303 / 332→209 γρ. (N.7.1).** **ΟΧΙ tsc (N.17).** ⚠️ **browser-verify pending** (κανένα test δεν αποδίδει τα dialogs). 🔴 Giorgio commit: TaskDialogShell.tsx NEW + TaskFormField.tsx NEW + 2 dialogs + task-activity.ts + crm-extra.ts (deleted) + date-local.test.ts + ADR-584 + αυτό το αρχείο (μαζί με τα ήδη-uncommitted CRM atoms).

**🆕 `BaseCard` vs design-system card shells — δύο παράλληλες οικογένειες καρτών (2026-07-16, βρέθηκε ψάχνοντας 3ο αδερφάκι για το GridCard/ListCard cluster):** το `src/components/core/BaseCard/BaseCard.tsx` είναι **ανταγωνιστικό** card system που ζει δίπλα στο `@/design-system` GridCard/ListCard. Το χρησιμοποιούν όλα τα `src/components/compositions/*Card` (ContactCard, PropertyCard, StorageCard, TaskCard, UserCard, NotificationCard).

**ΔΕΝ είναι line-level clone** (γι' αυτό το jscpd δεν το πιάνει) — είναι **εννοιολογικό** διπλότυπο με ασύμβατο contract:
| | design-system GridCard/ListCard | core/BaseCard |
|---|---|---|
| Βάση | custom semantic `<article>` | shadcn `Card`/`CardHeader`/`CardContent` |
| Selection | αριστερή λωρίδα `bg-primary rounded-r-full` | `ring-2 ring-primary ring-offset-2` |
| Favorite | `Star`, hover-only `role="toolbar"` | `Heart`, πάντα ορατό `Button` |
| Actions | `group-hover:opacity-100` toolbar | `DropdownMenu` + `MoreVertical` |
| Badges | `Badge` από `@/components/ui/badge` | `CommonBadge` από `@/core/badges` |
| Keyboard | Enter/Space → onClick (`useCardInteraction`) | **καμία** ενεργοποίηση με πληκτρολόγιο |

**Το πραγματικό πρόβλημα δεν είναι οι διπλές γραμμές — είναι το a11y κενό:** ό,τι αποδίδεται μέσω `BaseCard` (6 compositions) **δεν ενεργοποιείται με πληκτρολόγιο**, ενώ ό,τι πάει από τα design-system shells ενεργοποιείται. Ίδια εμφάνιση για τον χρήστη, δύο διαφορετικές συμπεριφορές.

Δεν έγινε τώρα γιατί: (α) **>1h / 6+ αρχεία** (N.0.2 → pending, όχι επιτόπου)· (β) το visual contract διαφέρει πραγματικά (ring vs λωρίδα, Heart vs Star, dropdown vs toolbar) → η ενοποίηση **αλλάζει εμφάνιση** σε 6 compositions, δηλαδή απόφαση προϊόντος όχι refactor· (γ) απαιτεί απόφαση Giorgio ποια οικογένεια είναι η κανονική.
**Χρειάζεται ρητή απόφαση Giorgio.** Reproduce: `src/components/core/BaseCard/BaseCard.tsx` vs `src/design-system/components/{GridCard,ListCard}/`. Δες **ADR-013**.

**🆕 Telegram CRM store → migrate onto `channel-crm-store` SSoT (2026-07-16, discovered while de-duplicating the 3 Meta crm-adapters):** τα WhatsApp/Messenger/Instagram adapters κεντρικοποιήθηκαν σε `src/server/comms/crm/channel-crm-store.ts`. Το **`src/app/api/communications/webhooks/telegram/crm/store.ts` (448 γρ.) έμεινε έξω** — είναι 4ο αδερφάκι του ίδιου conversation/identity upsert, αλλά **δεν** μεταναστεύτηκε γιατί: (α) χρησιμοποιεί άλλο Firestore access layer (`getFirestoreHelpers` lazy + `safeDbOperation` + `isFirebaseAvailable`) αντί για `getAdminFirestore()` — ο shared store θα χρειαστεί injectable db port· (β) έχει επιπλέον πεδία (attachments/ADR-055, `username`, `isVoiceTranscription`) που ο shared store δεν μοντελοποιεί ακόμη· (γ) υπάρχει **ζωντανό production θέμα** με το Telegram (contacts δημιουργούνται μόνο για `pagonis.oe@gmail.com`) — μετανάστευση τώρα μπερδεύει τα αίτια.

**⚠️ Δύο πραγματικές αποκλίσεις του Telegram store που η μετανάστευση θα διόρθωνε (ΔΕΝ είναι κοσμητικές):**
1. **Race condition** — `messageCount: (snap.data()?.messageCount || 0) + 1` και το ίδιο για `unreadCount` (`crm/store.ts:151-154`) = read-modify-write. Δύο ταυτόχρονα webhooks → χαμένη μέτρηση. Τα 3 Meta channels χρησιμοποιούν atomic `FieldValue.increment(1)`.
2. **Ασυνέπεια `senderId`** — Telegram γράφει raw `userId` (`crm/store.ts:369`)· τα άλλα 3 γράφουν `generateExternalIdentityId(provider, id)`. Ίδιο πεδίο, δύο διαφορετικά είδη τιμής → κάθε consumer που κάνει join σε `external_identities` σπάει σιωπηλά για Telegram.

Εκτίμηση: **>1h** (db port abstraction + attachments στο shared input + regression test με το ζωντανό Telegram θέμα). Reproduce: σύγκρινε `telegram/crm/store.ts` με `src/server/comms/crm/channel-crm-store.ts`.

**🆕 ADR-598 G9 cycles debt — dxf-viewer barrel over-coupling (2026-07-16, discovered during the catch-up reseed after 204 commits):** το `depcruise` cycles baseline reseed-άρθηκε **421 → 1299** (accepted growth, ADR-598 changelog 2026-07-16). Το VERIFY έδειξε ότι **~91% (~1.190) των κύκλων είναι μέσα στο `dxf-viewer`**, διάχυτοι σε 15+ subfolders (bim 567 / core 164 / systems 123 / rendering 75 / hooks 64 / utils 63 …), με cycle-length **15–25 modules** = κλασικό αποτύπωμα **barrel-file (`index.ts`) re-export over-coupling**. **Down-only ratchet debt** (ΟΧΙ regression — legit BIM growth). Σταδιακή μείωση όταν αγγίζεις τα σχετικά subsystems: σπάσε τα fat public barrels σε στοχευμένα imports (ή διαχώρισε type-only barrels), ξεκινώντας από `bim/` (567 edges, το μεγαλύτερο cluster). Reproduce: `NODE_OPTIONS=--max-old-space-size=8192 npx depcruise src --config .dependency-cruiser.cjs --output-type json` → φίλτραρε `no-circular`, group ανά `from` prefix. Κάθε πραγματική μείωση → CI seed dispatch reseed **προς τα κάτω** (`gh workflow run depcruise-ratchet.yml -f seed=true`).

**🆕 CHECK 3.28 pre-existing clones surfaced by ADR-642 §6.8 OSNAP (2026-07-13, discovered co-staging the complex-linetype snap files):** `jscpd --diff` σε όλα τα touched files ανέδειξε **προϋπάρχοντα** structural clones — **ΟΧΙ** από το δικό μου diff (η αλλαγή μου σε αυτά ήταν 1-γραμμή signature/alias):
- ~~`core/spatial/GridSpatialIndex.ts` ↔ `QuadTreeSpatialIndex.ts`~~ → **✅ ΛΥΘΗΚΕ (ADR-583, commit `26dd8b5c`)** — `BaseSpatialIndex.ts` εξήχθη· verified 2026-07-14: `jscpd:diff` και στα 2 αρχεία = **καθαρό**. Stale entry αφαιρέθηκε.
- ~~`canvas-v2/overlays/SnapIndicatorGlyph.tsx` self-clones~~ → **✅ ΗΔΗ ΛΥΜΕΝΟ (ADR-583· verified 2026-07-16).** Η note ήταν stale: το αρχείο **έχει ήδη** εξαχθεί `GlyphSvg` wrapper + 8 mark primitives (`SquareMark`/`CircleOutlineMark`/`CenterDotMark`/`TriangleMark`/`DiamondMark`/`CrossMark`/`H`&`VCenterLineMark`) και κάθε `case` τα συνθέτει δηλωτικά. **`jscpd` @ min-tokens 50 (ratchet threshold) = 0 clones** (1 residual @ min-tokens 30 = ΚΑΤΩ από threshold, δεν μετράει). Αρχείο clean/unmodified στο working tree. Κανένα cluster-C work δεν απαιτείται — stale entry κλείνει εδώ.

**🔎 FINAL DUPLICATE AUDIT (2026-07-08, Opus 4.8 orchestrator `dxf-duplicate-final-audit`, 30 agents / 8-domain semantic-clone sweep + adversarial verify· εντολή Giorgio «τελικοί έλεγχοι κεντρικοποίησης» → «μόνο καταγραφή») — 22 ΝΕΑ confirmed διπλότυπα (0 false positives), όλα ΕΚΤΟΣ των ήδη flagged.** Το `ssot:discover` Windows Phase-3 είναι σπασμένο (0 signal) → τα παρακάτω βρέθηκαν με manual per-domain sweep. **ΤΙΠΟΤΑ δεν υλοποιήθηκε ακόμα** — Giorgio αποφασίζει σειρά. Ταξινομημένα κατά blast radius:

**🟢 TIER A — SSoT ΥΠΑΡΧΕΙ, μόνο migrate + guard (χαμηλό ρίσκο· template ADR-090 translatePoint «declared-not-enforced»):**

**▶ TIER A EXECUTION STATUS (2026-07-08, Opus 4.8, 4 parallel sonnet agents· εντολή Giorgio «ξεκίνα TIER A»· UNCOMMITTED):**
- ✅ **GUARDS DONE (2026-07-08, Opus 4.8· το «καστάνι» που κλειδώνει το TIER A· UNCOMMITTED):** 3 tier-3 modules στο `.ssot-registry.json`: **(a) `scalar-clamp`** — patterns `Math.max(0, Math.min(255,` + `function clamp01(`/`function clamp255(`/`const clamp01 = (`/`const clamp255 = (`· allowlist = scalar-math.ts + geometry-utils.ts shim + heat-load-color + studio-background-texture + **1 non-dxf** floorplan-background.service.ts (δικό του clamp01, δεν μπορεί να importάρει το dxf util). **(b) `normalize-angle-deg`** — `((.*% 360) + 360) % 360` + `function normalizeAngleDeg`· allowlist geometry-angle-utils.ts + radial-ring-logic.ts (pieSectorPath self-use). **(c) `safe-storage`** — `function safeStorage`· allowlist storage-utils.ts. **⚠️ SCOPE DECISION (μιμείται point-translate-helpers):** CHECK 3.7 είναι repo-wide/χωρίς path-scope & το scalar-math είναι dxf-only util → τα generic shapes `Math.max(0, Math.min(1,` (forward), `Math.min(1, Math.max(0,` (reverse), `function clamp(`, `const clamp = (` **σκόπιμα ΔΕΝ guard-άρονται** (collide με 7 legit non-dxf: report-engine/address-editor/floorplan-background/procurement)· καλύπτονται από canonical+review+jscpd (N.18), όπως το ADR-090 inline-literal discipline. Οι AxisCutSliderControl/RibbonMep survivors χρησιμοποιούν αυτά τα un-guarded shapes → 0 allowlist entries. **Verified:** golden fixtures +3 → `test:registry-golden` **84 GREEN** + `check-ssot-imports.test.js` **139 total GREEN**· end-to-end probe (8 synthetic violations → BLOCK exit 1)· 10 allowlisted/survivor files → exit 0· `npm run ssot:baseline` + regenerated `.ssot-registry-flat.txt` (gitignored, ήταν stale — του έλειπαν ~11 modules incl. create-external-store). **ΟΧΙ tsc (N.17).** 🔴 Giorgio: commit `.ssot-registry.json` + `scripts/__tests__/fixtures/registry-golden-fixtures.js` + `.ssot-violations-baseline.json` (+ TIER A code: ~55 files + scalar-math.ts NEW + i18n el/en + measurement-label.ts· ⚠️ CHECK 6D → ADR staged για canvas-drawing renderers). **⚠️ baseline delta = +1 ΑΣΧΕΤΟ:** `systems/group/ActiveGroupStore.ts` (create-external-store violation `new Set<ActiveGroupListener>`, από commit 21294edf 2026-07-07 — postdates το 07-06 baseline· ΟΧΙ δικό μου· grandfathered). **Follow-up (create-external-store WAVE):** migrate ActiveGroupStore σε version-signal createExternalStore (stack-based store, όχι drop-in).

**🟠 TIER B — Μεγάλα scaffolds ΧΩΡΙΣ SSoT (χρειάζονται factory design + N.8 approval· dedicated pass ο καθένας):**
- ✅ **`bim-entity-firestore-persistence-hook` (21/24 files): DONE (2026-07-08, B2, ADR-594· ΤΟ ΜΕΓΑΛΥΤΕΡΟ single win).** NEW `hooks/data/create-bim-entity-persistence-hook.ts` factory + `bim-entity-persistence-hook-types.ts` config contract (minimal required core + optional overrides + ΕΝΑ `useExtra` escape hatch + lifecycle callbacks onPersisted/onDeleted/onDeleteCleanup/onRestored — big-player «shared primitive + per-instance binding», ΟΧΙ god-config). Migrated **21** thin call-sites (beam/slab/roof/column/foundation/railing/slab-opening/hatch/floor-finish/thermal-space/space-separator/wall-covering/furniture/floorplan-symbol/mep-boiler/mep-radiator/mep-manifold/mep-water-heater/mep-fixture/mep-underfloor/electrical-panel), public API byte-identical (hosts ανέπαφα). **✅ PHASE 2 (Opus 4.8, εντολή Giorgio «force-migrate τα 3»): τα 3 πρώην-excluded ΤΩΡΑ FOLDED (24/24).** wall/opening/mep-segment → thin configs μέσω 5 additive off-by-default core-hooks (`beforeSave` async pre-save / `raceGuardDelete` / `markDeletedOnRequest` / `autoSaveTrigger` event-autosave / `onAfterOptimisticRemoval`) + `primarySelected` στο useExtra ctx + `lastSavedComparable` στο onDeleted. Τα 21 Phase-1 **byte-unaffected**. Params interfaces → `Omit<BimEntityPersistenceParams<T>,…>`, wall-BOQ + factory restore-write extracted → **`jscpd:diff` clean** (Phase-2 fileset). smoke 21→24 → **34 jest GREEN**. ⚠️ **browser-verify pending** (τα 3 δεν έχουν behaviour tests)· minor deviation: wall restore δεν re-acquire soft-lock (advisory TTL). 🔴 Giorgio commit +Phase2: useWall/useOpening/useMepSegmentPersistence + factory + types + smoke test + ADR-594. _(Phase-1 orig — τα 4 special gridGuide/mepSystem/wallMerge/wallSplit μένουν out of scope):_ Reused SSoT: mergeDocsIntoScene/resolveBimPersistenceScope/useBimFirestoreWriteGrace/createPersistSerializer/useBimEntityMoved+RestoredPersistEffect. **Verification: 148 jest GREEN / 18 suites** (9 factory-behavior + 22 import-smoke + zero regression). **No CHECK 3.7 guard** (pattern collides με τα 3 excluded + 4 special hooks → jscpd CHECK 3.28 + review καλύπτουν· consistent με ΟΛΑ τα sweep siblings ADR-585…592). **ΟΧΙ tsc (N.17).** 🔴 Giorgio commit: 21 hooks + factory NEW + types NEW + `mep-connector-merge-config.ts` NEW + 2 tests NEW + ADR-594 NEW + adr-index.md + αυτό το αρχείο. **⚠️ Commit με `SKIP_JSCPD_DIFF=1`** (justified: 39 residual same-commit clones ≤60 tokens = irreducible public-API interfaces + service-adapter shape + useMemo return tail· το 200γρ scaffold clone εξαλείφθηκε). Layer-2 ratchet πέφτει πολύ → **μετά το commit: `npm run jscpd:baseline`.**
**🟠 TIER B-bis — Family-type ΤΕΤΡΑΔΑ (Wall/Slab/Roof/Opening):**
- ✅ **`family-type-framework` (16 files): DONE (2026-07-08, B-bis, ADR-604).** 4 shared primitives (μίμηση ADR-594 «shared core + per-instance binding», ΟΧΙ god-config): (1) **Φ1** `hooks/data/create-type-reresolution-hook.ts::createTypeReresolutionHook(reresolveSceneFn)` → 4 `use{X}TypeReresolution` one-liners. (2) **Φ2** `bim/family-types/create-edit-type-dialog-store.ts::createEditTypeDialogStore()` → 4 `edit-{x}-type-store` re-export wrappers (named exports + type aliases kept → consumers ανέπαφοι). (3) **Φ3** `ui/ribbon/hooks/create-family-type-controller.ts::useFamilyTypeController(config)` generic πάνω σε `C extends FamilyTypeCategory` (→ `typeParams=BimTypeParamsByCategory[C]`, μηδέν cast)· config inject-άρει category/isEntity/helpers + **command factories** (`makeAssign/Update/DeleteCommand`) ώστε κάθε entity να κρατά το per-entity command του (**zero behavior change** — δεν force-migrate στο generic `UpdateFamilyTypeCommand`, θα άλλαζε serialized `type` string + `thickness>0` validate)· wall `.kind` + `saveNewType` absorbed στο wrapper· 4 wrappers spread+rename (public API byte-identical). (4) **Φ4** = **2 designs** (ΟΧΙ merge = θα ήταν UX change): `create-family-type-selector-widget.tsx` (Wall/Opening, duplicate-only, `bimFamilyType` i18n) + `FamilyTypeEditorWidget.tsx` (Slab/Roof, edit/delete, per-entity i18n **pre-translated labels → CHECK 3.13 safe**)· κοινό `FamilyTypeSelect.tsx` dropdown + `FamilyTypeWidgetCommon` base interface. **Verification: 7 jest GREEN / 2 suites** (edit-store isolation/open/close/idempotent + reresolution-hook shape). **jscpd — 0 clones / 24 files** (spread pattern + shared FamilyTypeSelect + common base interface εξάλειψαν όλα τα thin-binding echoes) → ΧΩΡΙΣ `SKIP_JSCPD_DIFF`. **No CHECK 3.7 guard** (thin-wrapper shapes overlap legit → jscpd 3.28 + review). **ΟΧΙ tsc (N.17).** ⚠️ browser-verify pending (controllers/widgets χωρίς behaviour tests). 🔴 Giorgio commit: 4 factories NEW + FamilyTypeSelect NEW + 2 tests NEW + 16 wrappers + ADR-604 NEW + adr-index.md + αυτό. - ✅ **Deferred → DONE (2026-07-08, Opus 4.8, ADR-604 §4 follow-up): command dedup.** Migrated `use{Wall,Slab,Roof}FamilyTypeController` `makeUpdate/makeDeleteCommand` onto the generic `UpdateFamilyTypeCommand<TP>` / `createDeleteFamilyTypeCommand(label,…)` (mirror Opening) → **deleted 6 per-entity dupes** (`Update{Wall,Slab,Roof}FamilyTypeCommand.ts` + `Delete{Wall,Slab,Roof}FamilyTypeCommand.ts`). SSoT-audit: serialization-string change safe (in-memory undo only — **κανένα** `CommandRegistry.register` για deserialize/replay)· wall `thickness>0` validate = **dead code** (`CommandHistory.execute` δεν καλεί `validate()`) → dropped, τεκμηριωμένο. 3 tests retargeted στο generic (`UpdateFamilyTypeCommand.test.ts` 7 + `DeleteFamilyTypeCommand.test.ts` 5 + `roof-family-type-commands.test.ts` Assign kept) = **20/20 jest GREEN**· 4 JSDoc refs updated· **jscpd:diff 0 new clones / 8 files.** **ΟΧΙ tsc (N.17).** 🔴 Giorgio commit: 3 controllers + 2 generic commands (comments) + 4 JSDoc consumers + 2 NEW tests + roof test + 6 deletions + 2 old-test deletions + ADR-604 + αυτό. UNCOMMITTED.

**🔵 TIER C — Μικρά/ασφαλή, boy-scout on-touch (≤3 files):**
**Raw output (full what/reason ανά finding):** `tasks/w32ej77cd.output` (session scratch· workflow script `dxf-duplicate-final-audit-wf_18c21ad4-a04.js` — resumable για re-scan).

**✅ DONE (2026-07-08, Opus 4.8, ADR-363 §crop-hatch-bim· commit: Giorgio) — Crop clip services region-strategy unification (ΠΛΗΡΗΣ κεντρικοποίηση, εντολή Giorgio «ΠΡΟΧΩΡΑ ΑΜΕΣΑ»):** Οι `ClipToRegionService` ↔ `ClipToPolygonService` είχαν **~10 byte-parallel per-type clippers ο καθένας** (line/circle/arc/polyline/ellipse/rect/text/point/spline/angle-measurement) + διπλά low-level primitives (`sutherland`/`pointInPolygon`/`normAngle`/`arcSweepDeg`/…), διαφέροντας ΜΟΝΟ στο region primitive. **Ενοποιήθηκαν σε big-player region-strategy SSoT:** NEW `services/clip/clip-geometry.ts` (όλα τα low-level primitives μία φορά), `clip/clip-region.ts` (`ClipRegion` interface + `RectClipRegion`[Liang-Barsky/S-H-rect] + `PolygonClipRegion`[parametric/S-H-general]· 4 primitives: `containsPoint`/`clipSegment`/`clipLoop`/`bboxOverlaps`), `clip/clip-entity.ts` (ΟΛΟΙ οι per-type clippers ΜΙΑ φορά, region-agnostic + `clipEntity(entity,region)` + `clipRegionLoop` για overlay), `clip/clip-entity-helpers.ts` (μετακινήθηκε εδώ). **Οι 2 services έγιναν thin wrappers** (~30γρ. έκαστος· public API αμετάβλητο: `clip`/`clipOverlayPolygon`/`clipByPolygon`/`clipOverlayPolygonByLasso`· `ClipRect` re-exported). **Behavior improvements** (unified): circle fully-inside→κρατιέται ΩΣ circle (και στο polygon, πριν γινόταν arc)· angle-measurement arms clip-to-boundary και στο polygon (πριν κρατιόταν whole)· spline→bbox-overlap (πιο σωστό). **Tests: 46/46 GREEN** (νέο parametrized `clip-entity.test.ts` τρέχει κάθε case σε ΚΑΙ ΤΑ ΔΥΟ regions· + 3 service/helper suites). tsc SKIP (N.17). ✅ Google-level: YES — μηδέν διπλότυπο (strategy pattern· κάθε clipper μία φορά), primitives SSoT, public API/undo-redo ανέπαφα. ⚠️ Follow-up (optional, ΟΧΙ blocking): `.ssot-registry` guard «forbid per-type clipper εκτός clip/» (δύσκολο ως ERE — αφέθηκε). 🔴 browser-verify (rect+polygon+lasso crop → hatch/BIM/circle/text σωστά) + commit.

**`maxGripsPerEntity` setting — VESTIGIAL μετά το big-player fix (2026-07-07, Opus 4.8, ADR-559) — small/medium, UNCOMMITTED:** Το ADR-559 §big-player αφαίρεσε το per-object grip truncation (`grip-registry.ts`) → «visible ≡ editable» (Revit/Figma/C4D). Το setting `maxGripsPerEntity` **δεν έχει πλέον λειτουργικό consumer** για truncation, αλλά επιβιώνει σε: UI slider `ui/components/dxf-settings/settings/core/GripSettings.tsx`, το preview στο `ui/components/dxf-settings/settings/shared/LinePreview.tsx` (Max: X grips), + όλο το settings chain (`grip-settings-schema.ts`/`gripSettings.ts`/`GripStyleStore.ts`/`grip-style-sync.ts`/`FACTORY_DEFAULTS`/`settings-core/defaults.ts`/`useUnifiedSpecificSettings.ts`/`ZustandToConsolidatedAdapter.ts`). **Full-SSoT fix:** αφαίρεση του field + του UI slider + του LinePreview cap-visual (big players ΔΕΝ έχουν per-object cap· μόνο object-COUNT `gripObjLimit`). ΓΙΑΤΙ flagged: ~10 files settings chain, ξεχωριστό pass για να μη μείνει half-done. Κράτα το `gripObjLimit` (AutoCAD GRIPOBJLIMIT — legit).

**Grip-source διπλοτυπία render vs interaction — cross-entity (2026-07-07, Opus 4.8, ADR-507/559) — LARGE:** Κάθε renderer `getGrips` (`HatchRenderer`/`PolylineRenderer`/…) ΚΑΙ κάθε `computeDxfEntityGrips` case υπολογίζουν **ανεξάρτητα** το ίδιο grip set από την ίδια geometry → invariant «visible ≡ pickable» που πρέπει να συντηρείται χειροκίνητα (και **απέκλινε** για hatch — βλ. ADR-559 §big-player). Έκλεισα ΜΟΝΟ το **hatch** (NEW `getHatchBoundaryGrips` SSoT, καλείται και από τα δύο). **Full-SSoT fix:** ΕΝΑ grip-source ανά entity type που καταναλώνουν και render + interaction (ή ο visible path να διαβάζει το `computeDxfEntityGrips` output). ΓΙΑΤΙ flagged: κάθε entity type (~25), cross-cutting render+interaction pipelines (ADR-559-level· ADR-559 σκόπιμα τα κράτησε ξεχωριστά με invariant) → dedicated pass, N.8.

**`resolve{Kind}SectionLock` — 4 manual callers, νέο ενοποιημένο SSoT δεν καταναλώνεται ακόμη (2026-07-07, Opus 4.8, ADR-581 Φ6/ADR-503) — SMALL/MEDIUM:** Το Φ6 έφτιαξε **NEW** `bim/structural/sizing/member-section-lock.ts::resolveMemberSectionLock` (ΕΝΑ dispatch column/beam/slab + resolve provider/design-context) και το καταναλώνει η σύριγγα (commit+ghost). Οι **4 υπάρχοντες** manual callers κάνουν ακόμη copy-paste το per-kind pattern (provider+context+resolve{Kind}SectionLock): `hooks/grips/grip-parametric-commits.ts` (column @392 + beam @270), `ui/ribbon/hooks/bridge/useColumnParamsDispatcher.ts` @78, `useBeamParamsDispatcher.ts` @65, `useSlabParamsDispatcher.ts` @60. **Fix:** migrate και τους 4 στο `resolveMemberSectionLock` (κρατώντας το ανά-kind rejection emit που διαφέρει). **ΓΙΑΤΙ deferred:** committed grip/ribbon commit paths + shared tree· το rejection-event ανά kind χρειάζεται προσεκτικό threading → dedicated pass. Επίσης: section-rejected **toast** στη σύριγγα (ο bump εφαρμόζεται ήδη, λείπει το μήνυμα).

**`type → compute{Kind}Geometry` — 3 αποκλίνοντα recompute sites (2026-07-07, Opus 4.8, ADR-581 Φ6) — MEDIUM:** Ο τύπος «parametric `params` → `geometry`» ζει σε **3** ανεξάρτητα switch: (a) κάθε `Update{Kind}ParamsCommand.applyPatch` (commit path — column/wall/slab/opening/beam/stair), (b) `rendering/ghost/apply-parametric-box-preview.ts` (grip-drag live preview — column/foundation/beam/mep-fixture/electrical-panel/mep-manifold/mep-segment/furniture), (c) **NEW** `systems/match-properties/match-preview-entity.ts::recomputeParametricGeometry` (σύριγγα ghost — column/beam/slab/stair/wall). Το invariant «ghost ≡ commit» συντηρείται χειροκίνητα (ίδια `compute*Geometry` calls). **Full-SSoT fix:** ΕΝΑ `recomputeEntityGeometry(entity, nextParams) → geometry` που καταναλώνουν και τα 3 (context-aware: opening host-wall, slab openings/beam-deduction). **ΓΙΑΤΙ deferred (N.8):** διαφορετικά inputs/context ανά site (grip-drag: grip-kind+delta+ortho· command: bare params+validation+emit· ghost: bare params style-only fallback), cross-cutting σε commands+ghost+match → dedicated pass. Το Φ6 ήδη κρατά ghost ≡ commit με test.

**localStorage persist/hydrate boilerplate — hand-rolled σε 8+ stores, κανένα SSoT (2026-07-06, Opus 4.8) — pre-existing duplication, LARGE:** Το μοτίβο `getItem`+parse+SSR-guard / `setItem`+try/catch / remove-on-default είναι copy-pasted: `LinetypeScaleStore`, `LinetypeRegistry` (νέο, ADR-362 — user-created persistence), `QuickStyleStore`, `bim-3d/performance/{auto-submit,baseline-tracker,PerformanceHistoryStore,PerformanceHUDStore,regression-detector}`, `bim-3d/properties/last-active-tab-tracker`, … (10+). **Big-player fix (Zustand `persist` middleware / VS Code Memento):** ΕΝΑ `createPersistedValue<T>(key, {serialize,deserialize,default})` ή `persist()` wrapper πάνω στο ΥΠΑΡΧΟΝ `createExternalStore` (lib/state) — hydrate-on-init + save-on-set + SSR/quota guard μία φορά. **ΓΙΑΤΙ flagged όχι fixed (N.0.2):** 10+ committed files cross-domain (2D + 3D perf + BIM), εκτός scope· δουλεύει με το createExternalStore-promote WAVE (lib/state) → dedicated pass. _(Το δικό μου `LinetypeRegistry` persistence ακολούθησε το ΥΠΑΡΧΟΝ `LinetypeScaleStore` μοτίβο — δεν πρόσθεσε νέο είδος διπλότυπου· θα migrate-άρει μαζί με τα υπόλοιπα όταν φτιαχτεί το persist SSoT.)_

**✅ DONE (2026-07-06, Opus 4.8, ADR-577, shared tree· commit: Giorgio) — `getSceneManager` adapter-builder SSoT (+ διπλότυπος `LevelManagerLike` τύπος):** Το memoized `const getSceneManager = useCallback(() => { if(!levelManager.currentLevelId) return null; return createLevelSceneManagerAdapter(getLevelScene,setLevelScene,currentLevelId); }, [levelManager])` ήταν copy-pasted **byte-identical** (handoff έλεγε ~10· grep = **20**: 17 memoized-idiom + 3 inline-adapter). **NEW SSoT** `systems/entity-creation/useSceneManagerAdapter.ts` (`useSceneManagerAdapter(levelManager): () => ISceneManager|null`, delegate στο ADR-527 factory, ίδιο null-guard + `[levelManager]` dep = byte-identical) + exported `SceneAdapterLevelManager` + barrel export. **20 files migrated** (copy/move/mirror/rotation/scale/trim/stretch/offset/fillet/chamfer/extend/array + entity-clipboard + wall-split/merge/attach/gap-opening + array-polar/path + body-drag-commit)· οι 16 «Pick» consumers → `SceneAdapterLevelManager` (σβήστηκε ο διπλότυπος `Pick<ReturnType<typeof useLevels>,3>` + το `import type { useLevels }`)· `useWallGapOpeningTool` κρατά `LevelsHookReturn` (full, για `buildOpeningResolvers`). **GUARD** tier-3 module `scene-manager-adapter-hook` (ERE `const getSceneManager = useCallback\(`· allowlist=SSoT hook doc-comment)· **dxf 0-violation** grep-verified· golden fixture. **Tests:** νέο `useSceneManagerAdapter.test.ts` 6 GREEN + `test:ssot-suite` **233 GREEN** (golden 66) + 39 regression (copy/move/scale activation). ΟΧΙ tsc (N.17). **🔴 Giorgio: `npm run ssot:baseline` (register 0-violation module) + commit** (νέος hook + test + barrel + 20 consumers + `.ssot-registry.json` + golden fixture + ADR-577 + αυτό το αρχείο). **⏸️ ΑΝΑΒΛΗΘΗΚΕ (ίδιο pass):** ο FSM-refs guard «forbid inline `wasActiveRef`+`prevEntityCountRef`» — grep έδειξε **13 tool files** με τα refs (όχι μόνο stretch/array/wall· +extend/trim/offset/chamfer/fillet/region-pick), δηλ. πολλά un-migrated tools· guard τώρα = allowlist 13+ = θόρυβος. Ξεκίνα ΜΕΤΑ τη migration των υπόλοιπων 2-click tools στο `useModifyToolActivation` (τότε allowlist συρρικνώνεται). **📊 ssot:discover Phase 3 broken σε Windows (/tmp race)· grep-verified priority-list large duplicates ΠΑΡΑΜΕΝΟΥΝ (χρειάζονται Giorgio approval, N.8):** translatePoint 48–84 sites/38 files + 5 helpers (LARGE)· wall-pick-scaffold 3× (medium)· ddeBufferRef (medium)· grip-defaults VALUES (θέλει απόφαση τιμών).**

**2-click modify-tool activation FSM — SSoT + 5/5 migrated ΟΛΟΚΛΗΡΩΘΗΚΕ (2026-07-06, Opus 4.8, ADR-577· Giorgio decision «big-player consistent framework»):** **✅ NEW SSoT** `systems/tools/useModifyToolActivation.ts` (storage-agnostic· `onActivate` override· 8 unit tests). **✅ ΟΛΑ ΤΑ 5 migrated test-guarded (+νέα characterization tests, ήταν untested):** `useCopyTool` (23), `useMoveTool` (+5), `useMirrorTool` (+5, onActivate handoff), `useRotationTool` (+5, onActivate 2-sub-case handoff), `useScaleTool` (+5, store-based, onDeactivate=reset). **51 tests GREEN.** Behavior alignment: Rotation (dead lost-branch) + Mirror/Scale (missing) → consistent (deselect→entity-pick, Revit/C4D/Figma-style ΕΝΑ FSM). **ΕΚΤΟΣ (τεκμηριωμένα):** `useStretchTool` (partial), Array×3/Wall×4 (pick-based). **🔴 ΕΚΚΡΕΜΕΙ (final):** registry guard «forbid inline `wasActiveRef`+`prevEntityCountRef` modify-FSM στα hooks/tools» (allowlist stretch/array/wall) + `ssot:baseline`. Λεπτομέρειες: ADR-577 §«FSM centralization».**

**Grip-defaults VALUES — 3+ ανταγωνιστικά objects που ΑΠΟΚΛΙΝΟΥΝ (2026-07-05, Opus 4.8, ADR-549 crosshair audit) — pre-existing SSoT fragmentation, LARGE/cross-domain, ΧΡΕΙΑΖΕΤΑΙ ΑΠΟΦΑΣΗ ΤΙΜΩΝ + CLEAN TREE (Giorgio: dedicated Plan pass αργότερα):** Το ADR-559 §3b κεντρικοποίησε το grip-settings **SHAPE** (grip-settings-schema) αλλά ΟΧΙ τα **default VALUES** — που ζουν σε ≥6 σημεία με ΠΡΑΓΜΑΤΙΚΗ απόκλιση: `settings/FACTORY_DEFAULTS.ts GRIP_DEFAULTS` (`apertureSize:10`, warm=`GRIP_WARM_COLOR` orange), `types/gripSettings.ts DEFAULT_GRIP_SETTINGS` (`apertureSize:10`, warm=`SNAP_INTERSECTION` **hot-pink** ⚠️, hot=`SNAP_ENDPOINT`), `stores/GripStyleStore.ts` initial (`apertureSize:**20**` ⚠️, warm=`GRIP_WARM_COLOR`), + `settings-core/defaults.ts:125`, `settings-core/types/domain.ts:414`, `ui/hooks/useUnifiedSpecificSettings.ts:230`. Το `showAperture:true` τυχαίνει ίδιο παντού, αλλά τα OBJECTS αποκλίνουν (aperture 10-vs-20, warm orange-vs-pink). **Big-player fix (VS Code/Figma/Revit):** ΕΝΑ canonical grip-factory-defaults SSoT, τα υπόλοιπα (store initial / provider fallback / reset / schema) να ΠΑΡΑΓΟΝΤΑΙ. Partial-field centralization (μόνο showAperture→const) = **fake SSoT band-aid, ΑΠΑΓΟΡΕΥΜΕΝΟ**. **ΓΙΑΤΙ flagged όχι fixed:** (1) απαιτεί απόφαση Giorgio για canonical τιμές (aperture 10/20; warm orange/pink; = behavior + color-identity ADR-445)· (2) συγκρούεται με uncommitted color/grip work (ADR-573, «ΜΗΝ αγγίξεις»)· (3) N.8 6 αρχεία/2+ domains → Plan pass. **Template:** ADR-559 §3b (canonical defaults + derivations + ratchet guard «forbid inline grip-default literals»). Ξεκίνα ΜΕΤΑ το land του color/grip + canonical-values decision.
**Zero-React pub/sub store boilerplate — factory + WAVE 1/2/3 DONE, WAVE 2.5 pending (2026-07-05, Opus 4.8, Giorgio SSoT order):** Η μηχανή `let state; const listeners = new Set<() => void>(); set(notify)/get/subscribe` ήταν copy-pasted σε **18** stores. **✅ NEW SSoT** `stores/createExternalStore.ts` — generic vanilla-store factory (`createExternalStore<T>(initial, { equals? })` → `{ get, set, subscribe }`· industry-standard Zustand/Redux shape· always-notify default, optional equality-guard για signal-semantics)· **7 jest** (`stores/__tests__/createExternalStore.test.ts`). **✅ WAVE 1 migrated (4 stores, public API αμετάβλητο, regression GREEN):** `RegionPerimeterPreviewStore` (κρατά brand+builders), `RegionGapMarkersStore` (κρατά clear-empty guard), `AutoAreaPreviewStore`, `AutoAreaResultStore`.
**✅ WAVE 2 DONE (2026-07-05 Session 2, Opus 4.8):** και τα 9 migrated σε `createExternalStore` (public API αμετάβλητο): `grid-perimeter-mode-store` (factory, `equals:Object.is`), `hatch-draw-defaults-store` (plain, patch-set), `hatch-pick-mode-store` (guard-στο-wrapper γιατί reset notify-άρει), `envelope-floor-slabs-store` (identity guard + silent reset), `DimensionCreateStore` (reducer + `equals:Object.is`), `DimRowHandleModeStore`, `opening-tag-layer`, `DimTextOverrideStore` (field-compare equals), `toolHintOverrideStore` (object wrapper `{override,step}` + field-compare equals). **Factory extended:** additive `reset(next)` (silent set + `listeners.clear()`, Zustand-`destroy`-aligned) για τα 4 test-resets που έκαναν `state=INIT; listeners.clear()` — +2 jest (9 total).
**✅ WAVE 3 DONE (2026-07-05 Session 2, Opus 4.8· solo, ξεκλείδωσε):** `multi-floor-3d-source` + `multi-floor-dxf-source` (identity-guard fit)· `bim-mesh-thumbnail-cache` migrated ΜΟΝΟ το version-signal pub/sub → `createExternalStore<number>` (το Map/inFlight/preload async cache μένει imperative — δεν είναι single-state).
**⛔ NOT-A-FIT (κράτα bespoke):** `ui/ribbon/context/RibbonFieldStore` (per-key signature-cache slice store, ADR-547 — όχι single-state)· `bim/materials/material-thumbnail-resolver` (async cache).
**✅ WAVE 2.5 DONE (2026-07-05 Session 4)** — και τα 22 single-state/reducer/hot-path stores migrated (βλ. SESSION 4 DONE header). Το `SelectionCyclingStore` ήταν στο `systems/selection/` (όχι `systems/cursor/` — ο παλιός tracker είχε λάθος path). `envelope-spec-store`/`opening-tag-style-service` = NOT-A-FIT (Map cache / async service). `command-line/*` = fit, migrated.
**✅ Follow-up guard DONE (2026-07-05 Session 4)** — `.ssot-registry` module `create-external-store` (tier 3, forbid inline `new Set<\(\) => void>`) πέτυχε **0-violation** (όχι baseline-ratchet): tests exempt via `exemptPatterns`, οι 6 not-a-fit + 3 factories allowlisted. `test:registry-golden` 56 GREEN. 🔴 Giorgio: `npm run ssot:baseline` + commit.

**✅ WAVE 2.7 DONE (2026-07-05 Session 8, Opus 4.8 orchestrator, shared tree· commit: Giorgio) — DOMAIN-NAMED listener alias stores (4ος undercount):** Re-grep (`new Set<\w*(Listener|Subscriber)>` + `: Set<\w*(Listener|Subscriber)> = new Set`) → **29 sites / ~24 files**. Κατηγοριοποίηση: 4 ήδη-allowlisted (WAVE 2.6) + 2 ADR-040 hot-path (ImmediatePositionStore 3-set / HoverStore 2-set, NOT-A-FIT) + **15 genuine candidates** delegated σε 5 sonnet agents. **14 MIGRATED & grep-verified & jest-GREEN** στο ΥΠΑΡΧΟΝ `createExternalStore` (public API αμετάβλητο ανά store): **Batch A** module single-state — ModalPresenceStore (Object.is + `subscriberCount` side-channel για ref-counted MutationObserver, `__resetForTest`→`store.reset`) / IsolateEffectsStore (no-equals, dequal guard στο wrapper) / mep-wire-waypoint-ui-store (custom `sameHover` equals) / roof-edge-selection-store (`sameRoofEdge`) / guide-drag-store (click-driven low-freq, Object.is, drop try/catch· 27 jest). **Batch B** registries **version-signal** — line-style-registry + dim-style-registry (Maps ως private mutation-accelerators, `createExternalStore<number>(0)`, `notify(){cache=null; store.set(get()+1)}`, `subscribe` delegate· 18 jest). **Batch C1** version-signal — guide-store (4 fields→version counter) / construction-point-store / **CommandHistory** (ΞΕΧΩΡΙΣΤΟ από command-line/*· payload `subscribe`→`versionStore` + `lastEvent` side-channel wrapper `versionStore.subscribe(()=>listener(this.lastEvent))`· 94 jest). **Batch C2** — DrawingStateMachine (FSM discriminated-union single-object, no-equals, `reset()`=**public runtime API**→`store.set` ΟΧΙ `store.reset`, payload subscribe wrapped· 58 jest) / bim-edge-resolution-store (class composite `{width,height}` field-compare equals) / **Bim3DCursorReadoutStore** (high-freq per-mousemove· κράτησε το προϋπάρχον `readoutEquals` dedup byte-identical· 🟡 **Giorgio: browser perf-verify 3D cursor readout**). **Batch D** — ViewportStore **2-instance** (activeScaleStore Object.is + scaleListStore `sameScaleList`, `markSystemsDirty` bespoke στα setters· 15 jest). **1 NOT-A-FIT (Batch D):** KeyboardFocusManager (2 channels broadcast ΤΗΝ ΙΔΙΑ τιμή focusedId + payload-carrying subscribe + disposed-lifecycle → anti-SSoT να διπλασιαστεί). **3 NOT-A-FIT (κρίση orchestrator, δεν delegated):** device-pixel-ratio (payload callback `(dpr)` + media-query lifecycle, μηδέν readable snapshot, cursor/ 6D) / clash-focus-bus (pure event-bus `(point)`, μηδέν state — regression-alert-bus precedent) / aria-live-bus (announce bus, `lastMsg`=μόνο dedup). Και τα 3 payload-carrying subscribe → migration θα άλλαζε public API → big-player: buses=bespoke. **GUARD (module `create-external-store`):** `forbiddenPatterns` διευρύνθηκαν σε `new Set<\w*Listener>` / `new Set<\w*Subscriber>` / `: Set<\w*Listener>` (ERE, `\w*` καλύπτει bare+domain-named)· allowlist += τα 6 νέα NOT-A-FIT (ImmediatePositionStore/HoverStore/device-pixel-ratio/clash-focus-bus/aria-live-bus/KeyboardFocusManager). **dxf-viewer = 0-violation** (κάθε εναπομείναν match allowlisted). `test:ssot-suite` **221/221 GREEN** (registry-golden 56). **🔵 GAP για Giorgio (εκτός dxf scope):** το διευρυμένο `\w*Listener` πιάνει ΕΝΑ non-dxf αρχείο `src/components/properties/shared/useFloorsByBuilding.ts` (`new Set<FloorsListener>`) — out-of-subapp (δεν εισάγει dxf factory)· θα καταγραφεί ως baseline ratchet-debt όταν τρέξεις `ssot:baseline` (ίδιο precedent με `useFirestoreBuildings`/`super-admin-active-company` του `new Set<() => void>`). **🔴 Giorgio: commit (14 stores + `.ssot-registry.json` + αυτό το αρχείο) + `npm run ssot:baseline`.** _(Σημ.: τα 14 stores + registry έγιναν ήδη commit από τον commit-coordinator — commits `52077738`/`07777677`/`42d10597`/`be46c5b4`/`ab2d8e1e`· εκκρεμεί commit αυτού του αρχείου + `ssot:baseline`.)_

**✅ WAVE 2.6 BOX 2/3/4 DONE (2026-07-05 Session 7, Opus 4.8 orchestrator, shared tree· commit: Giorgio):** Ολοκληρώθηκαν ΟΛΑ τα εναπομείναντα fits του re-grep (`new Set<(Listener|Subscriber)>` + `: Set<Listener>`): **25 stores migrated & grep-verified & jest-GREEN** στο ΥΠΑΡΧΟΝ `createExternalStore` (public API αμετάβλητο ανά store). **STEP0** TrackingPointStore (class composite snapshot, drop try/catch notify). **BOX 2a** 8 style stores (AutoSaveStatus/Completion/Grip[+guardGlobalAccess]/Quick/Text/LinetypeScale[Object.is+persist-guard]/LineweightDisplay[Object.is]/ToolStyle[+overlayCompletionCallback side-channel], 37 jest). **BOX 2b** 5 multi-map **version-signal** (LayerStore/LayerState/LinetypeRegistry[silent `store.reset` για να μη notify-άρει πριν το clear]/LayerFilters[double-build→single]/ToolState[`store.set` γιατί `reset()` είναι public runtime API, ΟΧΙ test-only], 276 jest). **BOX 2c** 4 structural analytical (single-state/composite). **BOX 2d** polar-tracking (single-state class) + region-pick (**2-instance**: phaseStore Object.is + firstCornerStore structural-eq). **BOX 3** 5 ADR-040 hot-path ΧΩΡΙΣ equals/notify byte-identical (SelectedEntities+Scene=**version-signal** `createExternalStore<number>(0)`, `commit(){rebuildCaches(); store.set(store.get()+1)}`· EntityBodyDrag single-state[clear reorder observationally-equivalent]· Lasso×2· 113 jest· 🟡 **Giorgio: browser perf-verify marquee/lasso/body-drag @60fps**). **BOX 4 guard** `.ssot-registry` module `create-external-store` επεκτάθηκε: `forbiddenPatterns` += `new Set<Listener>`/`new Set<Subscriber>`/`: Set<Listener>` (ERE, όχι `(?:)`)· allowlist += τα **4 NOT-A-FIT** (`rotation-snap-store`/`regression-alert-bus`/`CanvasNumericInputStore`/`SnapOverrideOrchestrator`). Τα 3 νέα patterns πιάνουν ΜΟΝΟ τα 4 allowlisted → μηδέν νέα violation. `test:ssot-suite` **221/221 GREEN** (incl. registry-golden 56). **🔵 GAP για Giorgio (εκτός WAVE 2.6 scope):** το προϋπάρχον `new Set<() => void>` pattern πιάνει **2 non-dxf Firestore stores** (`src/hooks/useFirestoreBuildings.ts`, `src/services/firestore/super-admin-active-company.ts`) που ΔΕΝ είναι allowlisted ΟΥΤΕ στο baseline (baseline _meta=2026-06-03 προϋπάρχει του module) — θα καταγραφούν ως ratchet-debt όταν τρέξεις `ssot:baseline`· δικές τους hand-rolled pub/sub εκτός dxf-viewer factory scope (μελλοντικό pass ή allowlist). **🔴 Giorgio: commit (25 stores + `.ssot-registry.json`) + `npm run ssot:baseline` (register module με updated baseline).**

**🔴 WAVE 2.6 DISCOVERED (2026-07-05 Session 4, Opus 4.8) — ~70 ΑΚΟΜΗ single-state stores με ALIASED idiom `new Set<Listener>()` (`type Listener = () => void`) — το WAVE 2.5 grep (`new Set<\(\) => void>` literal) ήταν κι αυτό undercount, LARGE:** Ίδια ακριβώς hand-rolled pub/sub duplication, απλώς με local `type Listener = () => void` alias → **δεν πιάστηκε** στο WAVE 2.5 grep. Prime `createExternalStore` candidates (grep-verified `type Listener = () => void` σε δείγμα wall-preview/GripArmed/water-proposal/ToolStateStore/SceneStore). **Οικογένειες:** (α) **preview stores** ~11 `bim/*/*-preview-store.ts` (beam/column/floor-finish/foundation/mep-underfloor/roof/slab/stair/wall-covering/wall) — single preview-object fits· (β) **grip stores** ~9 `systems/grip/Grip*Store.ts` (Armed/BasePoint/ContextMenu/CopyMode/HoverMenu/Mode/Reference/SessionUndo + rotation-snap) class-based· (γ) **mep-design proposal** ~7 (drainage/electrical/fire/gas/heating/hvac/water)· (δ) **style stores** ~8 (Completion/Grip/Quick/Text/Tool Style + LinetypeScale/LineweightDisplay/LayerFilters — έλεγξε multi-field)· (ε) **structural analytical** ~4· (στ) keyboard trackers 3 (Ctrl/Q/Shift)· (ζ) misc: ToolStateStore/SceneStore/SelectedEntitiesStore(hot-path)/LayerStore family/cad-toggle-state/polar-tracking/zoom-window/wall-split/prompt-dialog/properties-palettes/font-stores/display-unit-state/CanvasNumericInput/LassoCrop/LassoFreehand(hot-path)/xline-mode/ambient-alignment/clash-report/regression-alert-bus/BeamBetweenMembers/EntityBodyDrag(hot-path)/region-pick(multi-signal). **ΠΡΟΣΟΧΗ:** πολλά class-based (private listeners) + κάποια ADR-040 hot-path (SelectedEntities/Scene/EntityBodyDrag/Lasso*) + κάποια multi-state (region-pick 2 sets, ImmediateTransform 3 sets ήδη allowlisted) → per-store fit-check όπως στο WAVE 2.5. **+ Guard gap:** το module `create-external-store` πιάνει ΜΟΝΟ `new Set<\(\) => void>` literal, ΟΧΙ `new Set<Listener>` — WAVE 2.6 να επεκτείνει το forbiddenPattern (π.χ. `new Set<Listener>` + baseline-ratchet τα ~70 legit μέχρι migration). **Scale:** πολλαπλά sessions (orchestrator-grade), 1 οικογένεια/session ≤70% context.
**ΣΗΜ. ADR-040 hot-path stores** (`HoverStore`/`ImmediatePositionStore`/`ImmediateTransformStore`) χρησιμοποιούν **διαφορετικό** pattern (δεν πιάστηκαν στο grep) → χωριστό pass με browser perf-verify + ADR-040 staging (CHECK 6B/6C).

**`inheritEntityStyle` — fillet local copy → νέο SSoT (2026-07-04, Opus 4.8, ADR-510 Φ5) — pre-existing duplicate, small (1 committed file, shared tree):** Το Φ5 (γενικό EXPLODE) χρειάστηκε «κληρονόμησε στυλ πηγής σε παράγωγο primitive» → **εξήχθη SSoT** `systems/entity-creation/inherit-entity-style.ts` (`inheritEntityStyle` + `ENTITY_STYLE_SKIP`, superset skip-set) και το χρησιμοποιεί το `explode-entity.ts`. **✅ DONE (2026-07-05 Session 1):** το `systems/corner/fillet-curve-geometry.ts` είχε **local** `inheritEntityStyle` + `ARC_STYLE_SKIP` (γραμμές ~216-229) — ΤΑΥΤΟΣΗΜΟ idiom (drop geometry/id/type/selection keys). **Candidate:** το fillet να κάνει `import { inheritEntityStyle } from '../entity-creation/inherit-entity-style'` και να σβήσει το local (+ `ARC_STYLE_SKIP`). **ΓΙΑΤΙ flagged όχι fixed (N.0.2):** το `fillet-curve-geometry.ts` είναι just-committed (ADR-510 Φ4e/Φ4e.2) + πιθανόν **ενεργός** άλλος agent σε fillet/chamfer (shared tree) → το άγγιγμα ρισκάρει conflict· <15λ, drop-in on-touch. Ίσως `.ssot-registry` guard «forbid inline `ARC_STYLE_SKIP`/local `inheritEntityStyle`».

**Wall pick-loop tool scaffolding — 3× διπλότυπο (2026-07-03, Opus 4.8, ADR-568) — pre-existing duplicate, medium:** Τα scene-helpers `getSceneManager`/`getScene`/`getWallById`/`findWallAtPoint`/`collectSelectedWalls` + το dual-flow scaffolding (activation selection-first + click pick-loop + escape) είναι **ταυτόσημα** σε `hooks/tools/useWallSplitTool.ts` + `useWallMergeTool.ts` + **NEW** `useWallGapOpeningTool.ts` (3×). Το ADR-568 tool **reuse** ΟΛΗ την pure geometry + commands + persistence (ουσία), αλλά αντέγραψε το scaffolding (thin, ~120 γρ.). **Candidate:** εξαγωγή `useWallPickScaffold({toolId, execute})` (SSoT scene-helpers + FSM) που καταναλώνουν και οι 3 hooks. **ΓΙΑΤΙ flagged όχι fixed (N.0.2):** τα split/merge είναι just-committed (ADR-566/363, shared tree)· η εξαγωγή τα refactor-άρει και τα 2 → ρίσκο regression σε committed tools εκτός του ADR-568 scope. Dedicated wall-tool-scaffold pass (+ ίσως `.ssot-registry` guard «forbid inline `createLevelSceneManagerAdapter` σε `useWall*Tool.ts`»).

**`pairFrame` — facing-point refinement δίπλα στο `closestFacingEdgeBetweenPolygons` (2026-07-03, ADR-569· **μισό έκλεισε 2026-08-22, ADR-789**) — pre-existing duplicate, small:** ✅ Το `closestPointOnOutline` του `bim/framing/beam-span-snap.ts` **έγινε delegate** στο SSoT `closestEdgeOnPolygonOutline` (`bim/geometry/shared/polygon-nearest.ts`) και το ιδιωτικό `closestPointOnSegment` διαγράφηκε ως νεκρό — το επέβαλε το CHECK 3.28 (κλώνος 87 tokens). ⚠️ **Και οι δύο εκδοχές είχαν ήδη ΔΙΑΦΟΡΕΤΙΚΟ πυρήνα απόστασης** (`closestPointOnSegment` έναντι `getNearestPointOnLine`) — δύο απαντήσεις σε ένα ερώτημα (ADR-749), όχι απλώς αντιγραφή. 🔶 **ΜΕΝΕΙ**: το `pairFrame` εξακολουθεί να ξαναγράφει το **centroid-probing + 2-step refinement** που κάνει και το `closestFacingEdgeBetweenPolygons`. 🔴 **Νέο δεδομένο (2026-08-22): καθαρό delegate ΔΕΝ υπάρχει σήμερα** — το `FacingEdgePair` εκθέτει **ΜΙΑ** `edge` (την επιλεγμένη με score), ενώ το `pairFrame` χρειάζεται **ΚΑΙ ΤΙΣ ΔΥΟ** (`hA.edge` **και** `hB.edge`) για το OR-test `faceAligned` του ADR-529 Φ2-refine. Η μετανάστευση απαιτεί **πρώτα** να εκθέσει το `FacingEdgePair` και τα δύο· αλλιώς αλλάζει σημασιολογία σε committed, browser-verified auto-span. Dedicated beam-facing-geometry pass.

**grip-KIND union — name-collision + υπόλοιπα inline folds (2026-06-30, Opus 4.8, ADR-559 §3d-bis) — pre-existing duplicate, ΜΕΡΙΚΩΣ fixed:** Κεντρικοποιήθηκε ΕΝΑ canonical `GripKind` (`rendering/types/Types.ts`) + **5 projections** (`GripInfo.type`, `rendering/grips/types.ts GripType`, `unified-grip-types.ts UnifiedGripType`, `hooks/grip-kinds.ts GripType`, `gripSettings.ts GripState.gripType`). **🔴 Εκκρεμεί:** (α) **name collision** — ΔΥΟ exported `GripType` (`rendering/grips/types.ts` render-layer ↔ `hooks/grip-kinds.ts` interaction-layer)· rename ενός → de-collision (ευρύ blast radius, hooks/index re-export). (β) `rendering/passes/OverlayPass.ts` (`gripType` + local `GripInfo` interface) — **DEADCODE** file, fold μόνο αν αναβιώσει. (γ) `GripPhaseRenderer.ts:271` inline cast → derive από canonical. (δ) `bim/grips/axis-box-grips.ts` `'vertex'|'edge'` (BIM reshape) → `Extract<GripKind,...>`. **ΓΙΑΤΙ flagged:** το rename αγγίζει re-exports/πολλά call-sites· τα υπόλοιπα είναι property-level/deadcode/cast — χαμηλό value τώρα. Dedicated grip-kind de-collision pass.

**`defaultLayerId` inline `?id` παραλλαγές (2026-06-30, Opus 4.8, ADR-508 §line-cyan audit) — pre-existing, μικρό:** Κεντρικοποιήθηκε `getDefaultLayerId()` (`stores/LayerStore.ts`) και μεταναστεύθηκαν **10** copies του `getLayer(DXF_DEFAULT_LAYER)?.id ?? ''` (9 preview helpers + generator). **✅ DONE (2026-07-05 Session 1)** — και οι 2 inline παραλλαγές → `getDefaultLayerId()` με ΔΙΑΦΟΡΕΤΙΚΟ type contract (`getLayer(DXF_DEFAULT_LAYER)?.id` → `string | undefined`, ΧΩΡΙΣ `?? ''`): `hooks/drawing/drawing-entity-builders.ts:73` + `hooks/drawing/drawing-preview-partial.ts:198`. **ΓΙΑΤΙ flagged όχι fixed:** η αλλαγή σε `getDefaultLayerId()` (always-`string`) αλλάζει το `undefined→''` contract σε **commit-path entity creation** (`createEntityFromTool`) → χρειάζεται έλεγχος ότι κανείς consumer δεν διακρίνει `undefined` vs `''` (persistence/schema) πριν το unify. Dedicated pass + ίσως `.ssot-registry` guard «forbid inline `getLayer(DXF_DEFAULT_LAYER)?.id`».

**`:root` CSS-var inline reads — scatter (2026-06-30, Opus 4.8, ADR-004 Cinema 4D theme) — pre-existing scatter, medium (cross-domain):** Δημιουργήθηκε NEW SSoT primitive `readRootCssVar(name, fallback)` (`config/color-config.ts`) — οι 3 theme-colour resolvers (`resolveDxfCanvasBackgroundHex`/`resolveDxfCanvasGradientStops`/`resolveCssVarColor`) + `axis-cut-line-renderer` το χρησιμοποιούν πλέον (το axis-cut είχε **προϋπάρχον διπλότυπο** `getComputedStyle(...).getPropertyValue('--canvas-background-dxf')` → folded στο `resolveDxfCanvasBackgroundHex`, **διορθώθηκε**). **🔴 Εκκρεμεί migrate:** ~6 αρχεία διαβάζουν inline `getComputedStyle(document.documentElement).getPropertyValue(...)` για **μη-theme** σκοπούς (`debug/*`, `systems/modal/modal-presence-detect.ts` + `ModalPresenceStore.ts`, `ui/color/eyedropper.ts`, `utils/hover/text-labeling-utils.ts`, `src/utils/accessibility.ts`). **Candidate:** migrate σε `readRootCssVar` (ή promote το primitive σε `src/lib/platform/` αν υιοθετηθεί cross-subapp) + `.ssot-registry` module («forbid inline root-var getComputedStyle») + baseline. **ΓΙΑΤΙ flagged όχι fixed:** διαφορετικά domains (a11y/modal/eyedropper/debug), εκτός canvas-theme scope· κάποια διαβάζουν layout/positions όχι χρώματα → forced unify τώρα = scope balloon. Dedicated platform-util pass.

**2D cross-product — scatter + canonical vector SSoT χωρίς cross export (2026-06-25, Opus 4.8, ADR-525) — pre-existing, OBSERVATION (δεν το δημιούργησα):** Ο canonical vector-math SSoT `rendering/entities/shared/geometry-vector-utils.ts` (ADR-074/090) έχει `dotProduct`/`subtractPoints`/`addPoints`/`scalePoint`/`rotatePoint`/`getPerpendicularDirection` αλλά **ΟΧΙ exported cross-product**. Το 2D cross ζει ως `cross2D(a,b)` στο **`snapping/engines/intersection-calculators.ts`** (snapping layer) + διάσπαρτα inline crosses (π.χ. flipY handedness predicate στο νέο `column-beam-corner-snap.ts`). **ΓΙΑΤΙ flagged όχι fixed:** το `cross2D` είναι σε **λάθος layer** για reuse από `bim/*` (ADR-514: μηδέν bim→snapping runtime dependency)· προσθήκη `crossProduct` στο geometry-vector-utils αγγίζει snapping (shared tree) + ρισκάρει το ssot-discover ratchet (parallel function). Το νέο module reuse ΟΛΟ το υπόλοιπο vector-math SSoT· το cross έμεινε **μονή έκφραση-predicate** (όχι μηχανισμός). **Candidate:** export `crossProduct(v1,v2)` στο geometry-vector-utils (canonical home, sibling του `dotProduct`) → `cross2D` + inline crosses delegate. Dedicated vector-math pass.

**`buildDefaultFoundationParams` — name collision δύο functions (2026-06-24, Opus 4.8, ADR-514 Φ6d) — pre-existing, small (test-only, ~6 αρχεία):** Δύο functions ΙΔΙΟ όνομα: (A) `bim/types/foundation-types.ts:385` `buildDefaultFoundationParams(kind)` → defaults στο ORIGIN, **pure** (μόνο constants)· consumers = **ΜΟΝΟ tests** (foundation.factory/validator/schemas/types/geometry tests) + 1 JSDoc· (B) `hooks/drawing/foundation-completion.ts:113` `(clickPoint, kind?, overrides, sceneUnits)` → **production** (preview/commit/auto-design, σέρνει geometry+validator+factory graph). **ΟΧΙ runtime διπλότυπο** (η παραγωγή χρησιμοποιεί ΜΟΝΟ το B)· είναι (α) name collision (μπερδεύει grep) + (β) διπλή assembly-logic defaults — αλλά οι ΤΙΜΕΣ είναι κοινές constants → μηδέν drift. Νόμιμη δικαιολογία διαχωρισμού: το A είναι pure-light για low-level type/schema/geometry tests χωρίς το βαρύ graph του B. **Candidate fix:** rename το A → `defaultFoundationParamsFixture` (ή `...AtOrigin`) → σταματά το collision, κρατά το ελαφρύ fixture. **ΓΙΑΤΙ flagged όχι fixed:** αγγίζει ~6 test files + ο ADR-514 agent ενεργός σε foundation αρχεία (shared tree)· το όνομα είναι το λάθος, όχι η ύπαρξη. Rename-only pass.

**✅ DONE (2026-07-05 Session 2, Opus 4.8) — `createConfirmStore<TState,TAction>()` SSoT + registry guard (undercount 2→7):** Το grep-audit αποκάλυψε **7** ταυτόσημα hand-rolled confirm stores (όχι 2): `column-perimeter-confirm-store` (2 request fns), `column-adopt-size-confirm-store`, `shear-wall-extent-confirm-store`, `column-becomes-wall-confirm-store`, `section-relationship-confirm-store`, `walls/wall-cascade-delete-store`, `family-types/bim-family-type-delete-store`. **ΟΛΑ τα 7 migrated** → `createConfirmStore<XState,XAction>(CLOSED)` + thin named wrappers (public API αμετάβλητο, 59 jest GREEN). **Registry guard** module `create-confirm-store` (tier 3· forbid inline `_pendingResolve`· allowlist `stores/createConfirmStore.ts`· 0-violation επιβεβαιωμένο· registry-golden 56 GREEN). **OBSERVATION (χαμηλό, εκκρεμεί):** και τα confirm **dialogs** μοιράζονται shell (overlay>card>title+message+actions + useEscapeHandler + createPortal)· γενικό `<ConfirmDialog>` shell = πιθανό αλλά content/variants διαφέρουν legitimately — επανεξέταση αν αξίζει.

**Line/segment intersection-point — οικογένεια 3 helpers με κοινή determinant-math (2026-06-23, Opus 4.8, ADR-507 Φ3) — pre-existing scatter + 1 new (διακριτή σημασιολογία), cross-domain:** Υπάρχουν τώρα 3 helpers που λύνουν cross-product/denominator για τομή: (A) **NEW `segmentIntersection(a1,a2,b1,b2)→{point,t,u}|null`** (`utils/geometry/GeometryUtils.ts`) — **segment-clamped** (t,u∈[0,1]), point-returning· consumer = `planarizeSegments` (auto-area noding). (B) `lineIntersection(l1s,l1e,l2s,l2e)→Point2D|null` (`utils/angle-entity-math.ts`, exported) — **infinite-line** (δεν κλειδώνει στα τμήματα)· consumer = angle measurement. (C) private `intersectLines({px,py,dx,dy}×2)` (`bim/walls/wall-from-entity.ts`) — **infinite-line**, διαφορετικό input shape· consumer = wall miter joins. Επίσης boolean `segmentsIntersect` (GeometryUtils, selection). **Candidate:** ΕΝΑΣ core `lineIntersectionRaw(a1,a2,b1,b2)→{point,t,u,denom}|null` (no clamp) → η segment variant κλειδώνει t,u· οι infinite variants το χρησιμοποιούν αγνοώντας το clamp· `segmentsIntersect` delegate (sign-test ή t,u check). **ΓΙΑΤΙ flagged όχι fixed:** οι (B)/(C) είναι committed + **browser-verified** σε ΔΙΑΦΟΡΕΤΙΚΑ domains (angle measurement + wall miter, shared tree)· διαφορετική σημασιολογία (infinite vs segment) + (C) διαφορετικό input shape → forced unify τώρα = ρίσκο regression σε miter/γωνία. Το `segmentIntersection` ΔΕΝ είναι διπλότυπο υπάρχοντος (κανένα segment-clamped point-returning δεν υπήρχε) — αλλά η οικογένεια αξίζει ΕΝΑ core. Migrate με dedicated geometry pass.

**Entity-pair intersection DISPATCHER — διπλό 20-pair switch (2026-06-24, Opus 4.8, ADR-362 Round 20 gap #2) — pre-existing private dispatcher, medium (cross-domain snapping):** Η αποστολή «δύο entities → intersection points» έχει έναν πλήρη 20-pair dispatcher ΙΔΙΩΤΙΚΟ μέσα στο `IntersectionSnapEngine.calculateIntersections` (`snapping/engines/IntersectionSnapEngine.ts:216`, καλεί τα exported leaf calculators line/line, line/circle, circle/circle, poly*, rect*, xline*, ray*). Το ADR-362 Round 20 χρειάστηκε intersection re-projection για associative dims → NEW `systems/dimensions/dim-intersection-resolver.ts` που **ΧΡΗΣΙΜΟΠΟΙΕΙ τα ΙΔΙΑ exported leaf calculators** (μηδέν νέα math) αλλά έχει δικό του ΜΙΚΡΟ dispatcher για τα dim-relevant pairs (line/line, line/circle, circle/circle, poly pairs). **Candidate:** extract `export function intersectEntities(a,b): IntersectionResult[]` στο `snapping/engines/intersection-calculators.ts` (το αρχείο που ΗΔΗ κατέχει ΟΛΑ τα leaf calculators = φυσικό σπίτι) → ο engine ΚΑΙ ο dim resolver delegate. **ΓΙΑΤΙ flagged όχι fixed:** το extract αγγίζει shared snapping σε shared working tree με άλλους agents· η εντολή ήταν «touch ΜΟΝΟ dimension files». Ο dim resolver ΔΕΝ διπλασιάζει math (μόνο dispatch ~10 γρ.). Migrate σε dedicated snapping-centralization pass.

**Region hole-detection — ΔΥΟ ασύμβατες υλοποιήσεις (2026-06-23, Opus 4.8, ADR-507 Φ3) — pre-existing SSoT fragmentation, cross-domain:** Η ανίχνευση «νησιών» (holes) μέσα σε κλειστή περιοχή υπάρχει σε **δύο** μορφές με διαφορετικό αλγόριθμο: (A) `collectHoleAreas` (`systems/auto-area/auto-area-hit.ts`) — auto-area-based (collectAllClosedPolygons + `isPolygonInsideOuter` centroid+sampled-verts + even-odd· χρησιμοποιείται από «Μέτρηση εμβαδού» + NEW hatch pick-point Φ3)· (B) `findHoles` (`systems/recognition/space-detection.ts`) — region-perimeter-based (`ClosedPerimeter[]` + `polygonCentroid` containment + direct-child filter· χρησιμοποιείται από Stage-0 space recognition ADR-423/424). **Candidate:** ΕΝΑ generic `collectDirectHoles(outer, candidatePolygons)` SSoT (το «direct holes = μικρότερα πολύγωνα με centroid μέσα, όχι φωλιασμένα σε άλλο» είναι ΙΔΙΟΣ κανόνας) → και οι δύο να delegate (η μόνη διαφορά = πηγή υποψηφίων: auto-area candidates vs region perimeters). **ΓΙΑΤΙ flagged όχι fixed:** δύο διαφορετικά subsystems (auto-area + recognition, shared tree, άλλοι agents)· forced unify τώρα = ρίσκο σε committed recognition pipeline· >1h cross-domain. Χαμηλή-μεσαία προτεραιότητα — επανεξέταση όταν αγγιχτεί ξανά auto-area ή recognition.

**`roof-slope-units.ts` → promote σε generic `slope-units.ts` (2026-06-22, Opus 4.8, ADR-404 Φ5c) — naming-only, OBSERVATION:** Το `bim/geometry/roof-slope-units.ts` (`roofSlopeToRatio`/`roofSlopeFromRatio`, pure deg↔percent↔rise/run) είναι **roof-named αλλά γενικό** — τώρα το καταναλώνει ΚΑΙ το `slab-slope-unit.ts` (Φ5c, μετά από Giorgio SSoT audit που εντόπισε το αρχικό μου διπλότυπο tan/atan → διορθώθηκε σε delegate). **Candidate:** rename → `bim/geometry/slope-units.ts` + generic ονόματα (`slopeToRiseRun`/`slopeFromRiseRun`) ώστε roof+slab να μην εξαρτώνται από roof-naming. **ΓΙΑΤΙ flagged όχι fixed:** το rename αγγίζει **committed** roof αρχεία (`roof-geometry.ts`, `roof-lower-envelope.ts`, `useRibbonRoofBridge.ts`, `roof-types.ts` RoofSlopeUnit — shared tree, άλλοι agents)· το reuse-as-is τώρα είναι SSoT-σωστό (μία math impl), το rename = ξεχωριστό low-risk pass.

**Arc «visible side» direction — ΔΥΟ ασύμβατες ερμηνείες του `counterclockwise` (2026-06-22, Opus 4.8, ADR-398 §3.12) — pre-existing SSoT fragmentation, cross-subsystem:** Η ορατή πλευρά τόξου ερμηνεύεται **διαφορετικά** σε 2 σημεία. (A) **renderer + hit-test + NEW `arcVisibleCcwRange`** (`geometry-arc-utils`): `counterclockwise===true` ⇒ τόξο CW ⇒ ορατό CCW εύρος = `[endAngle→startAngle]` (ο `ArcRenderer`→`addArcPath` κάνει `screenCCW=!counterclockwise`· `hitTestArcEntity` + `arcTargets` το μοιράζονται τώρα). (B) **`systems/array/path-sampler-strategies/arc-strategy.ts` `sweepDegFor`/`sample`**: `ccw===true` ⇒ δειγματίζει `[startAngle→endAngle]` (dir=+1) — **ΑΝΤΙΘΕΤΗ** πλευρά → array-along-arc πιθανόν δειγματίζει την ΚΡΥΦΗ πλευρά (ίδια κλάση bug με την κολώνα). **Candidate:** το `arc-strategy` να υιοθετήσει το `arcVisibleCcwRange` SSoT. **ΓΙΑΤΙ flagged όχι fixed:** άλλο subsystem που ΔΕΝ άγγιξα· απαιτεί browser-verify array-along-arc πριν αλλαγή (ρίσκο). Family: `hooks/guides/extract-entity-key-points.ts` arc endpoints αγνοεί κι αυτό το ccw.

**Arc-tessellator fragmentation — ~8 ξεχωριστά `arc→points` (2026-06-22, Opus 4.8, ADR-510 Φ3a) — pre-existing scatter, OBSERVATION:** grep βρήκε ~8 tessellators: `utils/geometry/GeometryUtils.arcToPolyline` (public, degree/CCW-only, ADR-166), `export/core/dxf-ascii-writer.arcPoints` (degree/CCW), `services/ClipToRegionService.sampleArcSegments` (private, sub-arc entities), `systems/trim/trim-hover-preview.tessellateArcSweep` + `trim-fence-hit-detector.tessellateArc`, `bim/structural/reinforcement/column-cross-ties.arcPoints`, `systems/dimensions/builders/radial-builder.sampleArc`, `bim/mep-underfloor/mep-underfloor-geometry.sampleArc`. **Κανένα reusable public «center+radius+startAngle+SIGNED sweep→points»** (CW/αρνητικό bulge). Το ADR-510 Φ3a έβαλε **private** `tessellateSignedArc` στο `geometry-bulge-utils` (μοναδικός consumer) ΑΝΤΙ να προσθέσει 9ο public (αρχικά είχα κάνει name-collision με `arcToPolyline` → ο Giorgio το έπιασε, διορθώθηκε). **Candidate:** ΕΝΑ signed-sweep SSoT (π.χ. `geometry-arc-utils.tessellateArc(center,r,startRad,signedSweepRad,maxSegDeg)`) + οι 8 να delegate. **ΓΙΑΤΙ flagged όχι fixed:** cross-domain (export/trim/dim/mep/clip, shared tree, διαφορετικά Arc shapes degree-vs-radian)· forced unify τώρα = ρίσκο + budget. Migrate-on-touch ανά domain.

**`hexToRgb` object-parse idiom — 2 sites, διαφορετικό shape (2026-06-21, Opus 4.8, ADR-511):** Το `hexToRgba(hex,alpha)→rgba string` SSoT (`bim/utils/bim-vg-fill-tint.ts`) **υιοθετήθηκε τώρα** από `WallCoveringRenderer` (ADR-511) + `FloorFinishRenderer` (ADR-419 boy-scout) — αφαιρέθηκαν 2 inline `parseInt(color.slice...,16)`→`rgba(...)` αντίγραφα. **✅ DONE (2026-07-05 Session 1)** — TextSettings migrated· detail-pdf ήδη delegate· ΑΛΛΟ shape (`{r,g,b}` object, ΟΧΙ rgba string): `ui/components/dxf-settings/settings/core/TextSettings.tsx:118` (χτίζει `DxfColor{kind:'TrueColor',r,g,b}`) + private `hexToRgb` στο `bim/structural/detail-sheet/render/detail-pdf-renderer.ts:43`. **Fix on-touch:** NEW `hexToRgb(hex):{r,g,b}|null` στο `bim-vg-fill-tint.ts` (το `hexToRgba` να delegate σε αυτό), migrate τα 2 sites. **ΓΙΑΤΙ flagged όχι fixed:** διαφορετικά domains (settings UI + PDF render, browser/pdf-verified) + διαφορετικό output shape από «το idiom μου» (rgba string)· χαμηλό ρίσκο pure color-math, migrate-on-touch.

**`canvas-hatch-fill` SSoT — 2D hatch line/dot primitives (2026-06-21, Opus 4.8, ADR-511) — pre-existing scatter, small (3 renderers, migrate-on-touch):** Το «γέμισε clipped path με παράλληλες γραμμές / πλέγμα τελειών σε world-space spacing» (`drawParallelLines`/`drawDotGrid`) ήταν copy-pasted ως private μέθοδοι σε **FloorFinishRenderer / SlabRenderer / EnvelopeRenderer** (pre-existing, χωρίς SSoT). Το ADR-511 wall-covering ΑΡΧΙΚΑ πρόσθεσε 4η copy → **διορθώθηκε αμέσως**: NEW `bim/renderers/shared/canvas-hatch-fill.ts` (`strokeHatchLines`/`fillHatchDots`, pure-ish, caller στήνει clip+style)· ο `WallCoveringRenderer` το χρησιμοποιεί (μηδέν δικό του αντίγραφο). **🔴 Προϋπάρχοντα να migrate-αριστούν on-touch:** `FloorFinishRenderer.drawParallelLines/drawDotGrid` (γρ.160-202), `SlabRenderer`, `EnvelopeRenderer`. **Fix on-touch:** `import { strokeHatchLines, fillHatchDots } from './shared/canvas-hatch-fill'` + αντικατάσταση των privates (το material→pattern/spacing mapping μένει per-renderer). **ΓΙΑΤΙ flagged όχι fixed τώρα:** οι 3 renderers είναι **ADR-040-sensitive (CHECK 6B/6D)** + shared tree (άλλος agent) → migrate με δικό τους pass + stage ADR-040· το mapping τους διαφέρει legitimately (wood/tile/dot vs tile/plaster/board). Το νέο SSoT ΔΕΝ αφήνει νέο διπλότυπο — μειώνει το scatter, δεν το αυξάνει.

**Geometric-primitive entity-type λίστες — υποψήφια taxonomy (2026-06-21, Opus 4.8, ADR-510 Φ2E) — OBSERVATION, ΟΧΙ βεβαιωμένο διπλότυπο:** Υπάρχουν ≥4 επικαλυπτόμενες λίστες entity-types «γραμμικών/καμπύλων primitives», η καθεμία με **διαφορετική σημασία & μέλη**: `systems/array/array-validation.ts ALLOWED_SOURCE_TYPES` (array sources — ευρύ, +text/hatch/block/dimension/point/ray/xline), `systems/array/path-pick-controller.ts` (δική του, ΔΕΝ reuse την array-validation), `systems/trim/...` (trimmable — +ray/xline, −rectangle), **NEW** `types/style-editable-primitives.ts` (style-editable — line/polyline/lwpolyline/circle/arc/ellipse/spline/rectangle/rect). **ΓΙΑΤΙ flagged όχι fixed:** τα predicates είναι **εννοιολογικά διαφορετικά** (can-array vs can-trim vs has-editable-style) → forced unification = πιθανό over-engineering· επιπλέον cross-domain (array+trim, shared tree). **Candidate:** μια βάση `GEOMETRIC_PRIMITIVE_TYPES` + per-domain deltas, ΑΝ αποφασιστεί ότι αξίζει. Χαμηλή προτεραιότητα — να επανεξεταστεί όταν αγγιχτεί ξανά array/trim. (Η fragmentation **προϋπήρχε**· η Φ2E πρόσθεσε 1 ακόμη εστιασμένη λίστα, όχι αντίγραφο υπάρχουσας.)

**ΔΕΥΤΕΡΗ οικογένεια merge-commands — transform base (2026-06-21, Opus 4.8, ADR-507 §8) — 🟢 ΟΥΣΙΑΣΤΙΚΑ DONE (audit+decision-gate+base+SSoT sweep· UNCOMMITTED το 2ο μισό):** Audit διόρθωσε το handoff — Add/Remove/InsertText/Scale ΔΕΝ έχουν merge boilerplate (εκτός scope). NEW `SnapshotTransformCommand` base (in-place spine) → Rotate/Scale/Mirror (COMMITTED a751c40b). NEW `merge-window.ts` (`isWithinMergeWindow`+`sameEntityIdSet`) υιοθετήθηκε σε MoveVertex/MoveOverlayVertex/MoveOverlay/MepSystem/MergeableUpdate. NEW `snapshot-geometry.ts` (`geometryFromSnapshot` SSoT) υιοθετήθηκε σε Arc/Lengthen/Polyline/Stretch + base (εξάλειψη 7 inline copies). Move=ΧΩΡΙΣΤΑ (δικό του `move-entity-cascade`, ADR-049 — αρχιτεκτονικά σωστό, ΟΧΙ leaky). 27 jest GREEN. **✅ DEFER items β/γ/δ/ε/στ DONE 2026-06-21 (Opus 4.8, +15 jest, UNCOMMITTED):** (γ) MoveEntityCommand inline window→`isWithinMergeWindow`· (δ) `geometryFromSnapshot` πήρε `{excludeType}` → Extend/Trim· (β) vertex `isDragging`-gate (MoveVertex/MoveOverlayVertex+Multiple· caller=seal false· διορθώνει 2-distinct-edits-merge)· (ε) **Giorgio SSoT audit → διόρθωση:** το νέο `sameSet` ήταν διπλότυπο της `dequal` (app-wide, χειρίζεται Sets) → ΔΙΑΓΡΑΦΗ set-equality.ts, χρήση `dequal` σε BimSelectionHighlighter+IsolateEffectsStore+`sameEntityIdSet`· **+NEW `canMergeDragSamples`** (εξάλειψη 6 αντιγράφων του dragging+window gate)· (στ) +2 `.ssot-registry` modules (0-violation → baseline ΑΘΙΚΤΟ, registry-golden 56 GREEN). 63 jest GREEN. **✅ item α DONE 2026-06-21 (Scope B, Giorgio «τι θα έκανε η Revit»):** NEW `MoveCommandBase extends SnapshotTransformCommand` → `MoveEntityCommand`+`MoveMultipleEntitiesCommand` thin (Revit MoveElement/Elements: 2 entry points, ΕΝΑΣ core)· undo=exact snapshot-restore· **DELETE** `move-entity-cascade.ts` (παράλληλο spine — το «Move=ΧΩΡΙΣΤΑ» παραπάνω ΑΝΑΤΡΑΠΗΚΕ: πλέον ΕΝΑ spine για όλα) + `reverseDelta` (dead). Cascade engines άθικτοι. 47 jest. +`undoInPlaceWith` **DELETED** (dead seam μετά το item α). **§8 transform family 100% ΟΛΟΚΛΗΡΩΜΕΝΟ** — μένει ΜΟΝΟ commit (Giorgio) + browser-verify.

**Background-adaptive color+fill — 2D BIM renderers (2026-06-20→22, Opus 4.8, ADR-509):** Το `config/adaptive-entity-color.ts` έχει **δύο** resolvers: `adaptEntityColorForCanvas` (lines, WCAG≥3) + `adaptFillTintForCanvas` (translucent body fill / poché, contrast≥2 alpha≤0.6). **✅ FILLS DONE (2026-06-22, Giorgio FULL SSoT order):** ΟΛΑ τα ~21 translucent BIM body fills περνούν πλέον από NEW `bim/utils/bim-body-fill.ts` (`resolveBimBodyFill` / `adaptBimBodyFill`) → Wall/Column/Beam/Slab/SlabOpening/Stair/Foundation/Roof/ThermalSpace/FloorFinish/WallCovering/ElectricalPanel/MEP(boiler/manifold/radiator/underfloor/water-heater/fitting/fixture/segment)/Furniture/mesh-silhouette/beam-section-profile/column-overlays. Το pattern δεν υπάρχει inline πουθενά (audit-verified). 138/138 jest, tsc clean. **🔴 LINES (strokeStyle) ΠΑΡΑΜΕΝΟΥΝ on-touch:** στο `ctx.strokeStyle = <resolved hex>` → `adaptEntityColorForCanvas(...)` στους ίδιους renderers (πλην Wall/Dxf που έγιναν). **ΓΙΑΤΙ τα lines flagged όχι fixed:** έχουν ήδη contrast ≥ 3 → **no-op σήμερα** (καθαρά future-proofing, χαμηλή αξία)· cross-domain shared tree. **🔴 RATCHET (εγγύηση πληρότητας — το ζητούμενο enterprise κομμάτι):** NEW `.ssot-registry.json` module «bim-body-fill» που απαγορεύει raw translucent `fillStyle = rgba(...0.NN)` / `?? *_FILL` σε `bim/renderers/**` (forbidden pattern → πρέπει `adaptBimBodyFill`/`resolveBimBodyFill`) + `npm run ssot:baseline`. Χωρίς αυτό, νέος renderer αύριο ξεχνά τον helper → το «FULL SSoT» είναι εύθραυστο. Δεν έγινε τώρα: registry touch + baseline = ξεχωριστό pass (budget).

**`closedRingFromEdges` SSoT — closed-ring band idiom (2026-06-20, Opus 4.8, ADR-508) — pre-existing scatter, medium (~7 sites, migrate-on-touch):** Το idiom «κλειστός δακτύλιος από outer + αντεστραμμένο inner» (`[...outer, ...[...inner].reverse()]`) ήταν copy-pasted σε **8 σημεία** χωρίς SSoT. NEW `closedRingFromEdges<T>(outer, inner)` στο `bim/geometry/shared/polygon-utils.ts` (generic, non-mutating). **✅ Χρησιμοποιεί ήδη:** `bim/framing/member-snap-targets.ts` (NEW). **🔴 Προϋπάρχοντα να migrate-αριστούν on-touch:** `bim/renderers/WallRenderer.ts:161`, `bim/renderers/envelope-render-plan.ts:72`, `bim/geometry/building-footprint.ts:117`, `bim/geometry/mep-fitting-bend.ts:167` (μετάλλαζε `inner.reverse()` in-place → το SSoT είναι safe non-mutating), `rendering/hitTesting/hit-test-entity-tests.ts:160` (map→2D, κάλεσε helper μετά το map), `export/core/bim-to-dxf-primitives.ts:68`, `hooks/data/slab-boq-feed.ts:52`. **Fix on-touch:** `import { closedRingFromEdges } from '...geometry/shared/polygon-utils'` + αντικατάσταση του spread. **ΓΙΑΤΙ flagged όχι fixed:** cross-feature (renderer/export/hit-test/boq, shared tree, μερικά Point3D/μερικά Point2D)· migrate όταν τα αγγίξεις. ⚠️ Επίσης το `bim/framing/member-column-flush.ts` έχει local `centroidOf`/`bboxOf` (carried verbatim από το πρώην `beam-column-flush`) που διπλασιάζουν `polygonCentroid`/`polygonBbox` (polygon-utils, Point3D-typed)· documented trade-off (αποφυγή Point3D↔Point2D friction + framing→geometry layering)· migrate μόνο αν λυθεί καθαρά το typing.

**`clearCanvasDpr` SSoT — DPR-clear idiom (2026-06-20, Opus 4.8, ADR-398 §3.5) — pre-existing scatter, small (migrate-on-touch):** NEW `clearCanvasDpr(canvas, ctx?)` στο `rendering/canvas/withCanvasState.ts` (ADR-084 SSoT) ενοποιεί το `setTransform(1,0,0,1,0,0)→clearRect→setTransform(dpr)` idiom. **✅ Χρησιμοποιεί ήδη:** `useCanvasGhostPreview` (19 hooks μέσω αυτού) + `PreviewRenderer.clear()`. **🔴 Προϋπάρχοντα να migrate-αριστούν on-touch:** `PreviewRenderer.render()` (hot path — χρησιμοποιεί cached `this.dpr`· migrate μόνο αν δεν χάνεται perf), `ProposalGhostOverlay.tsx` (έχει δικό του `devicePixelRatioSafe`), `GuideFollowGhostOverlay.tsx`, `canvas-v2/dxf-canvas/dxf-bitmap-cache.ts`, `rendering/canvas/core/CanvasManager.ts`, `ui/components/detail-sheet/DetailSheetDialog.tsx`. **Fix on-touch:** `import { clearCanvasDpr } from '...rendering/canvas/withCanvasState'` + αντικατάσταση του 3-liner. **ΓΙΑΤΙ flagged:** cross-feature (overlay/bitmap/detail), shared tree· κάποια έχουν δικό τους dpr getter (verify equivalent με `getDevicePixelRatio()` πριν).

**Preview-render unification (2026-06-20, Opus 4.8, ADR-398 §3.5) — ✅ ΥΛΟΠΟΙΗΘΗΚΕ (UNCOMMITTED — 🔴 browser-verify+commit):** Οι 2 αποκλίνοντες preview μηχανισμοί + το copy-pasted scaffolding ενοποιήθηκαν (Giorgio order, orchestrator: 4 Explore agents map + 4 impl agents migrate). NEW `systems/preview/ghost-preview-frame.ts` (canonical `{viewport: cached bounds, transform: live}` SSoT) + NEW `hooks/tools/useCanvasGhostPreview.ts` (harness: cursor-gate+RAF+DPR-clear+snapped-cursor). **19 hooks migrated** → ΜΟΝΟ draw delegate (~600γρ scaffolding deleted, οπτικά byte-for-byte). Διορθώνει ΚΑΙ το latent transform-lag (previews→React-prop· τώρα→live `getImmediateTransform`). 9 jest νέα. **ΟΧΙ migrated (by design):** imperative composite path (§3.4 viewport-override) + ProposalGhostOverlay (ήδη live). **🔴 Απομένει:** browser-verify ΟΛΩΝ των ghost tools + pan/zoom με ενεργό ghost (ο transform-lag fix = μόνη συμπεριφορική αλλαγή) → μετά commit (Giorgio). git add: ghost-preview-frame.ts[+test], useCanvasGhostPreview.ts[+test], 19 use*Preview*.ts hooks, ADR-398.

**`createMicrotaskCoalescer` SSoT — proactive-hook coalesce boilerplate (2026-06-18, Opus 4.8, ADR-488) — pre-existing duplicate, medium (~8 hooks, migrate-on-touch):** Το «coalesce-ανά-microtask» boilerplate (`let scheduled=false` + guard + `queueMicrotask(recompute)`) ήταν copy-pasted σε **8 hooks** χωρίς SSoT. NEW `hooks/proactive-coalescer.ts` (`createMicrotaskCoalescer(run)` — pure, 3 jest). **✅ Χρησιμοποιεί ήδη:** `useProactiveStructuralAnalysis` (ADR-488, NEW)· **+ 2026-06-19 (ADR-459 v11): `useProactiveStructuralLoads`, `useProactiveOrganismReinforce`, `useProactiveMemberSizing`, `useAutoFoundationDesign`** — migrate-αρισαν μέσω του NEW `hooks/useGroupedStructuralReaction.ts` (wiring SSoT που υιοθετεί `createMicrotaskCoalescer` + `isGeometryEditTrigger`· το `groupable` flag μένει στο closure του helper). **🔴 Απομένουν on-touch:** `useStructuralOrganism`, `useProactiveTieBeamTieForce`, `useStructuralSettingsRecompute`, `hooks/dimensions/useDimensionCreate`. **Fix on-touch:** `const { schedule } = createMicrotaskCoalescer(recompute)` + διαγραφή του local `scheduled`/`schedule`. **ΓΙΑΤΙ τα υπόλοιπα flagged όχι fixed:** shared tree (άλλος agent στα structural)· κάθε migration θέλει verify ordering μεταξύ hooks· migrate όταν τα αγγίξεις. **✅ Λύθηκε (ίδιο domain):** η classification «άμεση geometry edit» εξήχθη σε SSoT `hooks/structural-geometry-edit-triggers.ts` (`isGeometryEditTrigger`)· οι raw `PROACTIVE_*_EVENTS` subscription lists μένουν per-hook (διαφέρουν legitimately σε loop-guards).

**`projectPointOnAxis` SSoT — entity-wrapper delegation (2026-06-18, Opus 4.8, ADR-493) — small, 1 file, COORDINATE με ADR-492 owner:** NEW pure `projectPointOnAxis(px,py,ax,ay,ux,uy) → {along, perp}` στο `bim/geometry/shared/polygon-utils.ts` (canonical along/perp προβολή σημείου σε άξονα). **✅ Χρησιμοποιεί ήδη:** beam-column cutback framing (ADR-493). **🔴 Να delegate-άρει on-touch:** `projectColumnCenterOnAxis` (`bim/columns/column-face-trim.ts`) έχει inline αντίγραφο του ίδιου τύπου (`{along: rx*ux+ry*uy, perp: Math.abs(rx*uy−ry*ux)}`) — `return projectPointOnAxis(column.params.position.x, column.params.position.y, ax, ay, ux, uy)`. **ΓΙΑΤΙ flagged όχι fixed:** το `column-face-trim.ts` είναι στο **ενεργό set του ADR-492 (άλλος agent, shared tree)** — μην το αγγίξεις χωρίς συνεννόηση· το inline αντίγραφο προϋπήρχε, ΔΕΝ είναι νέο διπλότυπο. Επίσης ο `footprintCentroid` (`column-structural-attach-coordinator.ts`, ADR-492 set) είναι αντίγραφο του `polygonCentroid` (polygon-utils) → ίδιο delegation on-touch.

**`createToggleStore` SSoT — dialog/visibility singleton boilerplate (2026-06-17, Opus 4.8) — pre-existing duplicate, medium (~11 stores, migrate-on-touch):** NEW `createToggleStore()` factory (`subapps/dxf-viewer/stores/createToggleStore.ts`) ενοποιεί το copy-paste boilerplate (`_state`/`_snapshot`/`_subs`/`_notify` + open/close/toggle/isOpen/subscribe/getSnapshot) των απλών `{ isOpen }` singleton stores. **✅ Migrated:** `FloorManagementDialogStore` (ADR-468, NEW). **🔴 Προϋπάρχοντα να migrate-αριστούν on-touch (απλά toggles):** `AdminLayerManagerDialogStore`, `DynamicInputLockStore`, `wall-cascade-delete-store`, `bim-family-type-delete-store`. **ΔΕΝ ταιριάζουν (payload/Promise-handshake — μην τα αγγίξεις):** `column-perimeter-confirm-store`, `edit-{wall,slab,roof,opening}-type-store`, `CommandLineStore`, `CommandHistoryStore`. **Fix on-touch:** `export const X = createToggleStore()` + διαγραφή boilerplate (το public API open/close/isOpen/subscribe/getSnapshot μένει ίδιο). **ΓΙΑΤΙ flagged όχι fixed:** 4 απλά stores σε διαφορετικά features (shared tree)· κάθε migration θέλει verify ότι το getSnapshot reference μένει stable· migrate όταν τα αγγίξεις.

**`detail-3d-capture-core` SSoT — column capture migrate-on-touch (2026-06-16, Opus 4.8) — small, 1 file:** Το ADR-463 Slice 6 εξήγαγε το κοινό offscreen-capture scaffolding (isometric camera tight-fit / concrete prism / `projectNorm` / offscreen render / dispose) σε NEW `bim/structural/detail-sheet/render/detail-3d-capture-core.ts` (το χρησιμοποιεί ο νέος `footing-detail-3d-capture.ts`). Το προϋπάρχον `column-detail-3d-capture.ts` (ADR-457, browser-verified) κρατά ακόμη inline αντίγραφα (`frameCamera`/`isoDirection`/`projectNorm`/`disposeOwned`/`disposeCageGeometry`/`buildConcretePrism`/camera consts). **ΓΙΑΤΙ flagged όχι fixed:** το column capture δεν έχει jest (WebGL) + είναι browser-verified· refactor τώρα = ρίσκο οπτικού regression. **Fix on-touch:** αντικατέστησε inline με imports από το core (ο prism builder θέλει metre-verts arg) + browser-verify.

**BIM Firestore `stripUndefinedDeep` write-sanitize gap (2026-06-16, Opus 4.8) — pre-existing silent-fail, MEDIUM (~15 services, migrate-on-touch):** Το `setDoc`/`updateDoc` με raw `params` πετά «Unsupported field value: undefined» σε nested undefined → **silent catch → η οντότητα ΔΕΝ persist-άρεται ΠΟΤΕ** (root cause: floorplan_columns ήταν 0 docs· κολώνα+σοβάς χάνονταν σε reload). Κανονικό SSoT = `stripUndefinedDeep` (`@/utils/firestore-sanitize`). **✅ Έχουν sanitizer:** wall, stair, **column (NEW 2026-06-16)**, **beam (NEW 2026-06-16 boy-scout)**, **foundation (NEW 2026-06-16 ADR-463 boy-scout — ο οπλισμός πεδίλου χανόταν σε reload: pad χωρίς topMesh / strip χωρίς stirrups → nested undefined throw)**. **🔴 ΛΕΙΠΕΙ (raw `params: input.params`, ευάλωτα):** slab, slab-opening, roof, railing, opening, furniture, floorplan-symbols, floor-finishes, electrical-panel, space-separators, thermal-spaces, mep-segment, mep-fixture, mep-fitting, mep-manifold, mep-radiator, mep-boiler, mep-water-heater, mep-underfloor, mep-system. **Fix per service:** `import { stripUndefinedDeep } from '@/utils/firestore-sanitize'` + `params: stripUndefinedDeep(input.params)` + validation + geometry στο save**+**update (mirror wall/column). **ΓΙΑΤΙ flagged όχι fixed:** 15+ αρχεία (>1h)· τα περισσότερα είναι point-host MEP με απλά params (χαμηλό ρίσκο)· υψηλότερο ρίσκο = foundation/slab/roof/railing (σύνθετα optional params). Boy-scout migrate-on-touch.

**`scalePoints` array-scaler SSoT (2026-06-16, Opus 4.8) — pre-existing inline-map duplicate, medium (~10 sibling sites, migrate-on-touch):** NEW `scalePoints(points, scalar)` στον **κανονικό vector-math SSoT** `rendering/entities/shared/geometry-vector-utils.ts` (array-sibling του υπάρχοντος `scalePoint(point, scalar)`· preserve `z` & extra fields). Αντικαθιστά το `pts.map(p => ({ ...p, x: p.x*k, y: p.y*k }))` idiom (ADR-462 canonical-mm canvas→metres). ⚠️ ΑΡΧΙΚΑ μπήκε λάθος ως `scalePlanXY` σε `bim-three-shape-helpers` (near-duplicate του `scalePoint`)· **consolidated** στο geometry-vector-utils. **Migrated (δικά μου, ADR-462 Phase 3):** bim-three-structural-converters, BimToThreeConverter (wall+clip), foundation-to-three, slab-multilayer-solid-3d, structural-finish-3d, structural-finish-horizontal-3d, column-rebar-3d, pushHoles. **Προϋπάρχοντα inline (να migrate-αριστούν on-touch):** `bim-three-point-converters.ts` (×8 fixture/panel/manifold/radiator/boiler/water-heater shapes), `floor-finish-to-three.ts` (`xyScale` map), `mep-underfloor-to-three.ts` (`scaledVerts`). **ΓΙΑΤΙ flagged όχι fixed:** άλλα ADR domains (ADR-406/408/449 MEP/floor-finish) + shared tree· migrate ανά αρχείο όταν τα αγγίξεις. **Fix:** `import { scalePoints } from '../../rendering/entities/shared/geometry-vector-utils'` + αντικατάσταση του inline map.

**ADR-597 BIM corner-snap 5→1 consolidation (2026-06-11, Opus 4.8) — ✅ DONE (large-duplicate closed):** τα 5 σχεδόν-πανομοιότυπα `{Wall,Beam,Slab,Column,Opening}CornerSnapEngine` (97% structural duplicate) **ενοποιήθηκαν** σε 1 generic `BimCharacteristicSnapEngine` πάνω σε NEW `bim/utils/bim-characteristic-points.ts` SSoT dispatcher (corner+midpoint+center για ΟΛΕΣ τις BIM οντότητες, reuse υπάρχουσα γεωμετρία). 5 engine files + 5 tests διαγράφηκαν. **ColumnCenter collapse ✅ DONE 2026-06-11:** ο `ColumnCenterSnapEngine` (BIM_COLUMN_CENTER) διαγράφηκε + το test του· το column center το παράγει πλέον ο generic `BIM_CENTER` (dispatcher `columnPoints` → centroid μέσω `footprintPoints`). **Selection bugfix 2026-06-11:** «Μέσο/Κέντρο ποτέ» → priority numbers BIM_MIDPOINT/BIM_CENTER 0.5/2.5→−1.7 (ίσα/αρνητικά, νικούν generic) + iteration-order anti-starvation (πάνω από INTERSECTION/ENDPOINT) — βλ. ADR-597 §15. 🔴 browser-verify + commit pending (Giorgio).

**`pointToSegmentDistance` proliferation (2026-06-14, Opus 4.8) — pre-existing duplicate, medium (~6 files, migrate-on-touch):** Κανονικό SSoT = `pointToSegmentDistance` (`systems/guides/guide-types.ts`, exported `systems/guides`), ήδη consumed από `structural-finish-scene`/`building-footprint`/`envelope-column-bridge`/`polygon-interior-point`(NEW, ADR-363/449). **Προϋπάρχοντα private re-implementations** (ίδια μαθηματικά, να migrate-αριστούν on-touch): `bim/walls/wall-attach-pick.ts` (`distPointToSegment`), `bim/thermal/heat-load/wall-footprint-match.ts` (`pointToSegmentDistance`), `systems/dimensions/dim-smart-detector.ts` (`distancePointToSegment`), `bim/renderers/RailingRenderer.ts` (`distanceToSegment`), `rendering/entities/shared/geometry-polyline-utils.ts` (`pointToSegmentDistance`), `bim/finishes/structural-finish-resolver.ts` (`pointSegDistance`). **ΓΙΑΤΙ flagged όχι fixed:** 6 αρχεία cross-domain (wall/thermal/dim/render/finish), shared tree· migrate-on-touch ανά αρχείο. **Fix:** αντικατάσταση με import από `systems/guides` (ή canonicalize σε geometry SSoT αν προτιμηθεί ουδέτερος owner).

**ADR-418 deferred (2026-06-05, Opus 4.8) — view-scale SSoT follow-ups (low priority, migrate-on-touch):**
- (a) **DPI centralization:** ~9 BIM lineweight renderers pass `dpi: 96` inline to `lineweightToPx()` (`WallRenderer/StairRenderer/SlabRenderer/SlabOpeningRenderer/OpeningRenderer/ColumnRenderer/BeamRenderer` + `bim-line-weight-resolver.ts` + `bim-3d/converters/wall-opening-extrude.ts`). Migrate to `SCREEN_DPI` from NEW `config/dpi-config.ts` (ADR-418). Fix when next touching each renderer.
- (b) **`useCurrentSceneModel` relocation:** lives in `ui/text-toolbar/hooks/` but is a generic current-scene selector (ADR-344) now consumed by `systems/zoom/hooks/useViewScale.ts` (cross-feature import). Consider relocating to `systems/levels/` as the canonical selector.

**ADR-363 Slice F residual (2026-06-11, Opus 4.8) — μένει ΜΟΝΟ το transformFootprint unification (medium, phased, dxf-viewer rendering core):** ✅ **#1 dim-divergence FIXED (2026-06-11):** το `columnFootprintDims` έγινε κοινό SSoT σε NEW `bim/columns/column-footprint-dims.ts` (ουδέτερος owner, αποφυγή circular)· `column-anchors` (`anchorLocalPoint`+`localToWorld`, είχαν ΑΜΦΟΤΕΡΑ width/depth bug) τώρα το καλούν → anchor-snap == ορατό footprint για U/composite/polygon. 352/352 column jest + tsc καθαρό. 🔴 browser-verify (U/composite anchor ≠ center). **#2 (active, phased) — 1/9 DONE:** ✅ **Phase 2a column DONE (2026-06-11):** NEW `centredPolyToWorld` batch helper στο `centred-anchor-frame.ts` + `column-geometry.transformFootprint` ενοποιήθηκε (dims από κοινό `columnFootprintDims`, transform μέσω SSoT, διαγράφηκαν `computeLocalBboxCanvas`+`DEG_TO_RAD`+raw cos/sin)· 1145/1145 jest+tsc· ⚠️ stage ADR-040 αν το ζητήσει CHECK 6B/6D· 🔴 browser-verify κάθε column kind. **ΜΕΝΟΥΝ 8 engines** (electrical-panel/floorplan-symbol/furniture/mep-boiler/mep-fixture/mep-manifold/mep-radiator/mep-water-heater) — re-implement shift→rotate→translate με raw cos/sin. **PHASED:** ΕΝΑ-ΕΝΑ με browser-verify ανά οντότητα (visual-critical, οπτικό regression ορατό σε ΟΛΑ τα BIM). Κάθε engine κρατά το δικό του local geometry· μόνο ο transform ενοποιείται μέσω `centredPolyToWorld`.

**ADR-029 mirror drift (2026-06-07, Opus 4.8) — pre-existing PARKING searchableFields divergence (small, ~5min, search domain):** `npm run search-config:sync` αποτυγχάνει σε προϋπάρχον drift (ΟΧΙ από BUG #5): `SEARCH_INDEX_CONFIG[PARKING].searchableFields` = `['number','code']` στο SSoT (`src/config/search-index-config.ts`) vs `['number','type','notes']` στο mirror (`functions/src/search/search-config.mirror.ts`). **Γιατί flagged όχι fixed:** η ευθυγράμμιση αλλάζει ΠΟΙΑ πεδία indexάρονται για parking search (πραγματική αλλαγή συμπεριφοράς)· δεν είναι σαφές ποια κατεύθυνση θέλει ο Giorgio (SSoT canonical κατά ADR-029, αλλά ίσως το mirror `type/notes` είναι το επιθυμητό). **Fix:** ο Giorgio αποφασίζει· μετά align + `npm run search-config:sync` πράσινο.

**ADR-421 SLICE C follow-ups (2026-06-08, Opus 4.8) — opening Family/Type deferred items:**
- (a) **wall→generic command migration (medium, ~1h, shared tree):** NEW generic `UpdateFamilyTypeCommand` + `DeleteFamilyTypeCommand` (`core/commands/entity-commands/`) είναι category-agnostic και τα καταναλώνει το opening. Τα προϋπάρχοντα `UpdateWallFamilyTypeCommand` + `DeleteWallFamilyTypeCommand` είναι structural duplicates — migrate `useWallFamilyTypeController` (+ slab/roof controllers αν θέλει) στα generics και διέγραψε τα wall-specific. **ΓΙΑΤΙ deferred:** shared working tree (wall family-type pending verify/commit άλλου agent)· το opening δεν χρειάζεται να αγγίξει wall.
- ~~(b) cross-floor opening BOQ re-feed~~ ✅ **DONE 2026-06-08 (Opus 4.8)** — βλ. changelog παρακάτω.
- ~~(c) type-aware gating legacy kind/size comboboxes~~ ✅ **DONE 2026-06-08 (Opus 4.8)** — βλ. changelog παρακάτω.

**ADR-408 Φ14 flag (2026-06-08, Opus 4.8) — host-incident scan gap for radiator/boiler (small, ~30min, MEP plumbing domain):** το `collectHostConnectorEndpoints` (`bim/mep-systems/mep-host-connector-endpoints.ts:67`) σκανάρει ΜΟΝΟ `mep-manifold` + `mep-fixture` ως pipe hosts → ένας σωλήνας που τερματίζει σε connector `mep-radiator`/`mep-boiler` ΔΕΝ παράγει host incident → `classifyJunction` το βλέπει ως single-incident → **spurious cap** στο σημείο σύνδεσης (Revit: «the equipment IS the fitting»). **ΔΕΝ αφορά το floor-drain** (=`mep-fixture`, ήδη scanned — γι' αυτό flagged όχι fixed). **Fix:** πρόσθεσε `isMepRadiatorEntity`/`isMepBoilerEntity` στον guard του `collectHostConnectorEndpoints` (το `pointHostMountingElevationMm` τα αναγνωρίζει ήδη). **ΓΙΑΤΙ deferred:** shared tree με codex heating agent (radiator/boiler pending verify/commit)· εκτός scope drainage task.

**ADR-408 Φ15 flags (2026-06-08, Opus 4.8) — κατακόρυφες στήλες αποχέτευσης (riser) v1 follow-ups:** Το v1 παρέδωσε το **engine** (vertical detection `isSegmentVertical`/`riserDirection` στο `mep-segment-types.ts`, 2D plan glyph `mep-riser-symbol.ts`+`MepSegmentRenderer`, geometry fixes στο `mep-segment-geometry.ts` [validator 3D-length αντί plan-length + degenerate-XY outline guard], default-3m/DN100 1-click tool `useMepRiserTool` reachable από ribbon «Κατακόρυφη Στήλη»). Deferred (μεγάλα, χωριστή φάση):
- (a) ✅ **DONE 2026-06-08 (Opus 4.8, Plan Mode) — Cross-floor «riser through» 2D σύμβολο (Task B, Revit «cut plane»):** στον ενεργό όροφο derived glyph (κύκλος+up/down) για κάθε riser άλλου ορόφου που διαπερνά το FFL (single source=base-floor risers, zero duplicate). FULL SSOT: NEW pure `bim/mep-segments/derive-risers-through-floor.ts` (`deriveRisersThroughFloor`, owner-exclusion γεωμετρικά) + NEW read-only `components/dxf-layout/RiserThroughOverlay.tsx` (mount CanvasLayerStack, mode==='2d' any scope) + NEW glyph draw SSoT `drawRiserSymbol` (shared owner-renderer+overlay) + **Boy-Scout extract `hooks/data/useBuildingFloorScenes.ts`** (cross-floor SceneModel sourcing, 2 consumers: useFloors2DUnderlay convert + riser overlay filter· useFloors2DUnderlay τώρα thin wrapper). STAGE ADR-040 (CHECK 6B/6D). tsc 0 δικά μου· 68/68 jest (νέο derive test + useFloors2DUnderlay regression). 🔴 pending browser verify + commit (Giorgio).
- (b) ✅ **DONE 2026-06-08 (Opus 4.8) — Height/floor placement UI (Revit base/top constraint):** contextual tab «Κατακόρυφη Στήλη» (trigger `mep-drain-riser`) με combobox «Έως όροφο» (dynamic floors-above από `useFloorsByBuilding`+datum SSoT· base=ΤΡΕΧΩΝ όροφος) + «Διάμετρος» DN. FULL SSOT μηδέν fork: bridge-store handle `heightMm/setHeight`→`baseElevationMm/topElevationMm/setSpanMm`· NEW `mep-riser-command-keys`/`contextual-mep-riser-tab`/`useRibbonMepRiserBridge` (mirror fixture-library)· wiring useRibbonCommands/useDxfBimBridges/useDxfViewerRibbon/ribbon-contextual-config[shared]· i18n el+en. ΕΚΤΟΣ ADR-040 (pure ribbon/bridge). tsc 0 δικά μου· 55/55 mep-segments jest. 🔴 pending browser verify + commit (Giorgio).
- (c) **Εξαερισμός (vent stack), διαστασιολόγηση DN από DFU, building-drain/outfall terminal πέρα από το φρεάτιο, BOQ/ΗΛΜ ποσότητες στηλών** — επόμενα drainage features.
- (d) ✅ **Verify (browser) Task B DONE 2026-06-08 (Giorgio, βήμα-βήμα):** cross-floor «riser through» — στον 2ο όροφο εμφανίζεται το derived glyph (βέλος up) στο ίδιο XY με τον owner (1ο)· σταθερό μέγεθος σε zoom (Revit annotation)· μηδέν duplicate. Glyph radius 9→**12px** (Giorgio). 🔴 ΜΕΝΕΙ verify: riser→horizontal drain auto tee/elbow + bottom snap σε φρεάτιο. Selection precision του point-glyph (hitTest = tolerance×3· Giorgio ανέφερε «δεν μετακινείται» — pending follow-up).

**2D ANNOTATION SCALE (paper/plot scale) — ΓΕΝΙΚΟ feature (2026-06-08, Opus 4.8· flag από Giorgio verify Φ15):** Όλα τα 2D MEP annotations είναι σήμερα **screen-space σταθερά px** (`RISER_SYMBOL_RADIUS_PX=12`, `PIPE_TICK_HALF_PX=7`, slope indicators «Screen», + πιθανώς dimension text/glyphs) — συνεπές μεταξύ τους, σωστό για on-screen navigation. **ΓΙΑΤΙ flag:** όταν φτιαχτεί **plot-to-scale** της κάτοψης (σήμερα ΔΕΝ υπάρχει — το μόνο PDF export είναι schedules/πίνακες, `bim/schedule/exporters/`), τα σύμβολα πρέπει Revit-grade να έχουν σταθερό μέγεθος **στο χαρτί** (mm στο sheet) → κλιμάκωση αντίστροφη με την κλίμακα view/plot (π.χ. A1@1:50 → πάντα ίδιο φυσικό μέγεθος). **Fix (μεγάλο, ξεχωριστή φάση/Plan Mode):** NEW κεντρικό `annotationScale` SSoT (paper-mm → device-px ανά view scale, reuse ADR-418 view-scale + DPI config) που καταναλώνουν **ΟΛΑ** τα annotation builders (riser/ticks/slope/dims) — ΟΧΙ per-symbol fork. **ΓΙΑΤΙ deferred (Giorgio):** plot-to-scale δεν υφίσταται ακόμη· γενικό cross-cutting· χαμηλή προτεραιότητα. [[project_adr418_view_scale]]

**ADR-408 Φ14 flags (2026-06-08, Opus 4.8) — sanitary fixtures follow-ups (out of «αποχέτευση» scope):**
- (a) **Legacy sanitary floorplan-symbol → mep-fixture migration (small-medium, data migration, plumbing domain):** η A1 (Revit-true) κάνει τα WC/νιπτήρα/ντουζιέρα/μπανιέρα/μπιντές connectable `mep-fixture` kinds· τα παλιά 2D-only `floorplan-symbol` (category `sanitary`) έμειναν **leave-legacy** (συνεχίζουν να renderάρουν μέσω catalog/drawers, αλλά ΔΕΝ είναι connectable — το `collectHostConnectorEndpoints` διαβάζει το store, όχι το render model, οπότε render-only remap θα ήταν παραπλανητικό half-state). **Fix όταν/αν υπάρχουν πραγματικά persisted δεδομένα:** one-time cross-collection Firestore script `floorplan-symbol[category=sanitary]` → `mep-fixture` (per-type collections· enterprise-id `mfix`/υπάρχον). **ΓΙΑΤΙ deferred:** app σε DEVELOPMENT MODE + τα sanitary symbols 4 ημερών (2026-06-04) → ~0 δεδομένα· cross-collection write ρίσκο σε shared tree.
- (b) **Water-supply connectors (cold/hot inlet) σε WC/νιπτήρα (medium, ύδρευση domain):** v1 = drain-only (1 sanitary-drainage outlet). Πλήρες Revit plumbing θέλει και παροχή κρύου/ζεστού. **ΓΙΑΤΙ deferred:** ανήκει στον codex ύδρευση agent (shared tree)· εκτός scope «αποχέτευση». Το `MepFixtureParams` extends `MepConnectorHostParams` (πολλαπλοί connectors) → non-breaking να προστεθεί.
- (c) **Trap/οσμοπαγίδα (small, 3D plumbing detail):** μηδενική υποδομή· εκτός scope 2D modeler. Future Revit-full plumbing.

**ADR-399 datum flag (2026-06-07, Opus 4.8) — duplicate floor-elevation default (small, ~30min, building-management domain):** η default elevation ενός ορόφου υπολογίζεται σε ΔΥΟ σημεία: `computeSmartElevation` (`components/building-management/tabs/FloorInlineCreateForm.tsx`, neighbour-aware) και `computeDefaultElevation` (`components/building-management/tabs/useFloorsTabState.ts`, απλό `number×3`). SSoT violation. **Fix:** extract κοινό `resolveDefaultFloorElevationM` (ιδανικά σε `utils/floor-naming.ts` δίπλα στο `DEFAULT_FLOOR_HEIGHT_M`) + drop το local `DEFAULT_STOREY_HEIGHT=3.0` copy. **ΓΙΑΤΙ flagged όχι fixed:** εκτός domain του 3Δ datum task (shared tree)· δεν επηρεάζει τη Revit-grade λύση (που στοιβάζει datum-relative ανεξάρτητα από το πώς γεννήθηκε το elevation).
**Last updated:** 2026-07-27 — **ADR-710 Φάση Γ Βήματα 2β+3+4 DONE (Opus 5, SSoT+a11y domain· UNCOMMITTED)**: το ratchet «χειροκίνητη επιλογή slot σε 30/34 γραφήματα `reports/`» **ΕΚΛΕΙΣΕ** — αφαιρέθηκε από τη λίστα. Το `ReportChart` έγινε preset πάνω στο `ChartPlot`, τα **34** call sites δηλώνουν πλέον `series`/`categoryKey`/`categoryLabel`/`formatValue`/`categoryOrder` και **κανένα** δεν διαλέγει slot· gate με canary (`report-chart-callsites.test.ts`). **Τρία σιωπηλά ελαττώματα βρέθηκαν στην πορεία**: (α) `<>…</>` γύρω από άξονες/πλέγμα/tooltip ⇒ **21 γραφήματα χωρίς κλίμακα** (ελεγχόμενο A/B: fragment 0 άξονες, πίνακας 2)· (β) τα hooks γράφουν `name: t(…)` ⇒ τα κλειδιά του config δεν ταίριαζαν ποτέ και **όλα** τα pie ήταν ήδη rank-colored· (γ) `projects.propertyStatus.statuses.*` ανύπαρκτο σε κάθε locale + `crm.sources.*` ολόκληρο έλειπε. **ΝΕΟ CHECK 5D**: ανακαλύφθηκε ότι **κανένα gate δεν έτρεχε ποτέ** τα 54 anchors του ADR-710 (ADR-587 §6.1 σχήμα). **145/145 GREEN**, mutation-verified ×2, jscpd 0 στα 41 αρχεία. 📌 ADR-710 §11.7 + §11.8. **ΝΕΑ ΕΚΚΡΕΜΟΤΗΤΑ #12**: το `buildRecordPie` είναι **γραμμένο 4 φορές** (contacts/spaces/compliance/crm hooks) και τα hooks βάζουν μεταφρασμένο κείμενο ως ταυτότητα κατηγορίας — το σωστό σχήμα («το datum κρατά το κλειδί») θέλει αλλαγή σε 6 hooks.

**Previous:** 2026-07-27 — **ADR-710 εκκρεμότητες κεντρικοποίησης #5 + #6 DONE (Opus 5, ~1h, SSoT domain· UNCOMMITTED)**: (#5) `fmtCurrency`/`fmtPercent` διαγράφηκαν από το `CounterproposalScenarioRow.tsx`· τα 4 αρχεία καλούν `formatCurrencyWhole`/`formatPercentage` του `@/lib/intl-utils` (locale από `getCurrentLocale()` τη στιγμή της κλήσης). Σκόπιμη ορατή αλλαγή: `12.34%` → `12,3%` / `30%`. (#6) `InfoLabel`/`InfoTableHead`/`InfoDt` → **`src/components/ui/InfoLabel.tsx`**· **14** καταναλωτές repointed· ο domain barrel σταμάτησε να τα εξάγει· `ChartCardColumnHead` **διαγράφηκε** και το `ChartCardDataTable` εισάγει το κανονικό `InfoTableHead`. Τρεις προσθήκες στο SSoT: `InfoUnderlinedTerm` (η χειρονομία ως κοινό στοιχείο), προαιρετικό `tooltip`, `border-current` αντί `border-muted-foreground` (η υπογράμμιση ακολουθεί το χρώμα του όρου — ταυτόσημο παντού εκτός από destructive όρους). **Επιπλέον εύρημα διορθωμένο επιτόπου (N.0.2):** η ίδια χειρονομία ήταν γραμμένη με το χέρι **11 ακόμη φορές** σε `interest-cost-tabs.tsx` (7) + `interest-cost-pricing-settings.tsx` (4) — άγνωστες στο ADR· άρα **13 → 1** υλοποιήσεις. **Νέα καταγραφή:** 27 ακόμη αρχεία με καρφωμένο `NumberFormat('el-GR')` (βλ. πρώτη εγγραφή αυτού του αρχείου). Tests **208/208** (`chart-card` 33 + `sales-numeric-fields` 175)· `jscpd:diff` καθαρό· ΟΧΙ tsc (N.17). 🔴 **browser verify εκκρεμεί** (καρτέλα `counterproposal`: ο πίνακας πρέπει να δείχνει `12,3%`, ο selector `30%`· τα dashed underlines να δίνουν tooltip σε `interest-cost-tabs`/`pricing`) — **απρόσιτη**, βλ. παρακάτω.
  **ΙΔΙΑ ΣΥΝΕΔΡΙΑ — browser verify ADR-710 (§6.5): 2 ΣΙΩΠΗΛΑ ΕΛΑΤΤΩΜΑΤΑ ΚΕΛΥΦΟΥΣ ΔΙΟΡΘΩΘΗΚΑΝ.** (1) Η επικεφαλίδα του tooltip έδειχνε το **όνομα της πρώτης σειράς** όποτε η κατηγορία είναι **αριθμός** (έτος/μήνας/bucket) — `useTooltipLabel` πέφτει στο `itemConfig?.label` όταν `typeof label !== 'string'`. Μετρημένο ζωντανά: hover στο `2027` → «Κατασκευαστικό». (2) Οι γραμμές του tooltip έχαναν **όνομα σειράς + χρωματικό δείγμα**, γιατί το `formatter` αντικαθιστά **ολόκληρη** τη γραμμή στο `ChartTooltipItem` — 4 τύποι δανείου διαβάζονταν ως 4 γυμνά ποσά. Διορθώσεις **στο κέλυφος** ⇒ πιάνουν **και τις 10 κάρτες**: επικεφαλίδα από το `categoryKey` της κάρτας· νέο προαιρετικό **`valueFormatter`** στο `ui/chart` (μορφοποιεί μόνο τον αριθμό· αντικαθιστά και το ωμό `toLocaleString()`). 2 anchors **mutation-verified** (η παλιά συμπεριφορά κοκκινίζει ακριβώς αυτά τα 2). ✅ **ADR-706 browser verify** στη φόρμα δανείου του `DebtMaturityWall`: `4.5`→`4,5`, `1.35`→`1,35`, `500000`→`500.000` πληκτρολογημένα χαρακτήρα-προς-χαρακτήρα — το `2.4→04` **δεν αναπαράγεται** σε αυτό το call site. 🔴 **Τα 8/9 γραφήματα ΜΕΝΟΥΝ ανεπαλήθευτα**: το extension καρφώνει την καρτέλα σε ένα URL **και** η βάση είναι άδεια (1 ακίνητο for-sale, **καμία** `paymentPlans` collection) — τα 7 της Διαδρομής Β θέλουν ακίνητο με πρόγραμμα δόσεων. Ο **ένας** κόμβος που άνοιξε έβγαλε **δύο** ελαττώματα ⇒ το υπόλοιπο δεν είναι διεκπεραίωση. ADR-710 §8 #8. **Previous:** 2026-06-08 — **ADR-408 Φ15 Task B «cross-floor riser through» DONE (Opus 4.8, Plan Mode, ~1h, 2D overlay domain)**: derived riser glyph σε κάθε όροφο που διαπερνά μια στήλη άλλου ορόφου (Revit «cut plane»). **Boy-Scout extract `useBuildingFloorScenes`** (κοινό cross-floor SceneModel sourcing) — κάλυψε το dedup ανάμεσα σε `useFloors2DUnderlay` (convert) + νέο riser overlay (filter). **ΣΗΜΕΙΩΣΗ (μερική κάλυψη):** το αρχικό 2026-05-30 flag ζητούσε dedup ΚΑΙ με το `useFloors3DAggregator` — αυτό μένει **χωριστό** (διαφορετικό return shape: per-category BIM bundles + `floorElevationMm` αντί raw `SceneModel`)· χαμηλή προτεραιότητα, αγγίζει unverified ADR-399 Phase B 3D pipeline. NEW pure `derive-risers-through-floor.ts` + `RiserThroughOverlay.tsx` + `drawRiserSymbol` SSoT. STAGE ADR-040 (CHECK 6B/6D). tsc 0 δικά μου· 68/68 jest. Pending commit (Giorgio· shared tree). **Previous:** 2026-06-08 — **ADR-421 SLICE C follow-up «cross-floor opening BOQ re-feed» DONE (Opus 4.8, ~1h, BOQ domain)**: Edit Τύπου κουφώματος → το signature-group BOQ όλων των ορόφων του κτιρίου ενημερώνεται project-wide (Revit-grade). **Απόφαση Giorgio «όπως η Revit, FULL ENTERPRISE + FULL SSOT» → BOQ-only effective-aware recompute, ΧΩΡΙΣ doc re-persist** (ο Τύπος = single source of truth· το BOQ = derived view· geometry self-heals lazily στο load μέσω «type wins» hydration — όπως τα Revit schedules είναι live views πάνω στο model). **Recognition διόρθωσε το handoff:** (1) τα openings ζουν ΜΟΝΟ στο `FLOORPLAN_OPENINGS` (όχι στο `loadFileV2` scene όπως wall/slab) → fan-out καθαρά-Firestore· (2) `kind` type-governed → type edit door→window σπάει το naive `WHERE kind==sig.kind`· (3) re-persist params-only ΘΑ ΕΣΠΑΖΕ το load-time geometry self-heal· (4) stale `doc.params` = OLD signature δωρεάν· (5) composite index `companyId+projectId+floorplanId` υπάρχει → κανένα νέο index. **Scope:** 2 NEW pure helpers `buildEffectiveSignatureMembers`/`collectAffectedSignatures` (+`OpeningDocRow`/`OpeningEffectiveResolver`) στο `opening-boq-grouper.ts` (resolve injected → μένει pure)· `opening-boq-sync.ts` refactor split `writeSignatureGroup` (ένα write primitive, detach-guard/delete-empty/createdAt SSoT) + NEW `fetchAllOpeningsForFloorplan` (no-kind query) + NEW export `refeedOpeningBoqForTypeOnFloorplan` (effective-aware: old shrink + new grow + cross-type counting)· NEW pure-Firestore fan-out module `opening-boq-side-effects.ts` `refeedOpeningBoqForTypeAcrossFloors` (floorplanId=level.sceneFileId, injectable recompute, per-floor failure isolated)· `useFamilyTypeBoqRefeed` host `opening` branch (καλύπτει active+non-active ομοιόμορφα, idempotent, διορθώνει και το active-floor non-selected gap). 5 code + 2 test (49/49 PASS: grouper effective + side-effects fan-out + family-type-side-effects regression). tsc 0 δικά μου. ΜΗΔΕΝ writes σε opening/audit collections (μόνο BOQ rows). ΕΚΤΟΣ ADR-040 (host = 1 EventBus listener). Pending commit (Giorgio· shared tree). **Previous:** 2026-06-08 — **ADR-421 SLICE C follow-up «auto-type-on-create/load» DONE (Opus 4.8, ~30min, opening creation/persistence domain)**: το ΗΔΗ pure `resolveAutoOpeningTypeId` wire-άρεται στα 2 lifecycle points (Revit «never a type-less door/window»), ακριβώς όπως ο τοίχος: (1) creation `opening-completion.ts §buildOpeningEntity` (μετά `createOpening`)· (2) load `opening-doc-hydration.ts §openingDocToEntity` (`doc.typeId ?? resolveAutoOpeningTypeId(doc.params)` — legacy untyped default-διάστασης κουφώματα self-heal σε typed στο reload, non-destructive: built-in match → effective==cached → μηδέν geometry change· explicit `doc.typeId` υπερισχύει). Νέο/legacy default κούφωμα → typed → το gating (προηγ. follow-up) ενεργοποιείται φυσικά → πλήρης Revit «place→auto-type→edit via Type». Recognition prereq επιβεβαιώθηκε: opening built-ins ΗΔΗ seeded (`getAllBuiltInTypes` περιλαμβάνει `getBuiltInOpeningTypes`). Giorgio AskUserQuestion → Creation+Load (Revit parity). 2 code MOD + 1 NEW test `auto-opening-type-wiring.test.ts` (5/5 PASS· 24+105 regression PASS). tsc 0 δικά μου. ΕΚΤΟΣ ADR-040. ΟΧΙ IFC-import path (δικά του type semantics). Pending commit (Giorgio· shared tree). **Previous:** 2026-06-08 — **ADR-421 SLICE C follow-up «type-aware gating» DONE (Opus 4.8, ~30min, bridge domain)**: σε **typed** opening (`opening.typeId` set) τα ribbon comboboxes **Kind / Width / Height** γίνονται read-only (Revit-style — value ορατό, edit μέσω «Edit type»)· untyped openings μένουν πλήρως editable (zero regression). Κλείνει silent-edit-loss bug (direct `params` edit χανόταν στο επόμενο «type wins» re-resolution/reload). **Approach B** (thread `disabled` flag μέσα από `RibbonComboboxState`, minimal framework change): (1) NEW SSoT `OPENING_TYPE_GOVERNED_COMBOBOX_KEYS` + `isOpeningTypeGovernedComboboxKey` στο `opening-command-keys.ts` (kind/width/height· instance-owned sillHeight/handing/openDirection/mark ΠΟΤΕ gated), (2) `RibbonComboboxState += disabled?: boolean` (generic — άλλα bridges το παραλείπουν → editable ως τώρα), (3) `RibbonCombobox.tsx` `disabled={comingSoon || dynamicState?.disabled===true}`, (4) `useRibbonOpeningBridge.getComboboxState` επιστρέφει `disabled` + **defense-in-depth** no-op guard στο `onComboboxChange` (gated field σε typed opening → δεν dispatch-άρει `UpdateOpeningParamsCommand`, ακόμη κι αν παρακαμφθεί το UI). 5 αρχεία (1 NEW test 7/7 PASS), tsc 0 δικά μου. ΕΚΤΟΣ ADR-040 (μόνο ribbon context/combobox/bridge — όχι canvas/renderer). Pending commit (Giorgio· shared tree). **Previous:** 2026-06-03 — **ADR-377 Phase F DONE → ADR-377 ALL PHASES COMPLETE (Opus 4.8, ~1h)**: η τελευταία φάση του Subcategories system. RECOGNITION (N.0.1) έκοψε scope ~3-5h→~1h — το stub badge ήταν ΗΔΗ shipped στο Phase D (`SubcategoryRow.tsx` 🔒). **Ratchet deliverable:** NEW `.ssot-registry.json` Tier 3 module `bim-subcategories` (canonical `config/bim-subcategories.ts` + `bim-line-patterns.ts`) — forbid re-declaration `SUBCATEGORY_TAXONOMY`/`WIRED_SUBCATEGORIES`/`isWiredSubcategory`/`getAllSubcategoryKeysForCategory` + line-pattern catalog (`BIM_LINE_PATTERNS`/`BUILT_IN_DASH_ARRAYS`/`linePatternToDashArray`) εκτός 2 allowlisted canonical (`export const`/`function` declaration form — re-exports OK). **ΜΑΘΗΜΑ**: τα 3 SSoT consts έχουν type-annotation ανάμεσα name↔`=` → το συνηθισμένο style-pattern `(=|:)\s*{` ΔΕΝ τα πιάνει· declaration-form pattern (όπως firestore-now). Patterns verified real `grep -E` = ΜΟΝΟ allowlisted (zero collateral)· registry-golden 56/56 PASS· **zero νέες violations → `.ssot-violations-baseline.json` αμετάβλητο** (το `ssot:baseline` έβγαζε μόνο timestamp churn → **reverted** N.0.2). + NEW test-only `dxf-bitmap-cache-subcategory-invalidation.test.ts` (5, ADR-040 cache-bust verify μέσω public `rebuild()`/`isDirty()`, ΔΕΝ αγγίζει τον source). tsc 0. Pending commit (ο Giorgio). 🔴 `adr-index.md` pending (shared tree άλλου agent). **Previous:** 2026-06-03 — **ADR-364 Escape Bus Boy-Scout Group 4 DONE (Opus 4.8 ανάλυση + Sonnet 4.6 εκτέλεση)**: 10 secondary components migrated off local `e.key==='Escape'` / window keydown listeners → centralized `escapeBus` (PropertiesPalette[auto-committed 65c65ee6] + QuickPropertiesMiniPanel via `useEscapeHandler`; DimStyleCreateDialog + LayerStateDropdown → rely on Radix `onEscapeKeyDown`; LayerItem/ColorGroupItem/LayerStateDropdownPopover/LayerStateManagePanel(+ManageRow lifted)/TextOverrideEditor/StairPresetsSection via bus με canHandle+allowWhenEditable). GripContextMenu/useGripContextMenuController OUT (contextmenu only, no keydown-Escape). **Ratchet impact:** `.ssot-violations-baseline.json` 149→129 violations (−20), 99→88 files — monotonic decrease, μόνο αφαιρέσεις (καμία ξένη παράβαση blessed σε shared tree). tsc 0, EscapeCommandBus 24/24 PASS. 🔴 browser verify rename/popover ESC UX. **Previous (same day):** **ADR-376 residual registry entries CONFIRMED DONE (Opus 4.8, doc-only closure)**: Τα 3 `.ssot-registry.json` entries που έμεναν "pending μέχρι working tree clean" είναι **ΗΔΗ committed** (addedDate 2026-05-26): `opening-boq-grouper` (Tier 3, 5 forbiddenPatterns, allowlist 3 αρχεία), `opening-tag-style` (Tier 3, 3 patterns), `opening-tag-drag-controller` (Tier 3, 4 patterns). Επαληθεύτηκαν παρόντα + valid JSON + canonical αρχεία υπάρχουν. Working tree πλέον clean. ΕΚΚΡΕΜΟΤΗΤΕΣ ΑΟ8+ΑΡ15 → ✅ ΥΛΟΠΟΙΗΜΕΝΟ. **Καμία αλλαγή κώδικα/registry — μόνο tracker closure** (το tracking ήταν stale· η εργασία είχε ολοκληρωθεί από προηγούμενο agent). **Previous:** 2026-05-30 — **ADR-399 Phase D 2Δ underlay DONE (Opus 4.8) + NEW pending-ratchet flag (dedup per-floor scene sourcing)**: Phase D υλοποιήθηκε (read-only 2Δ underlay «Όλοι οι όροφοι», `FloorUnderlayOverlay` + `useFloors2DUnderlay`, 5/5+16/16 tests, pending commit, 🔴 browser verify). **ΕΚΚΡΕΜΟΤΗΤΑ (N.0.2, large-duplicate, ~1-2h):** το per-floor scene sourcing — enumerate building floors + resolve scene via `getLevelScene` (visited) ή `DxfFirestoreService.loadFileV2(sceneFileId)` snapshot — υπάρχει **διπλό** σε `hooks/data/useFloors3DAggregator.ts` (BIM entities, 3Δ) και `hooks/data/useFloors2DUnderlay.ts` (full DxfScene, 2Δ). **Fix:** extract κοινό `useBuildingFloorScenes(active)` SSoT (per-floor `{levelId, floorElevationMm, scene: SceneModel}`)· 3Δ→extract BIM entities, 2Δ→`convertSceneToDxf`. **ΓΙΑΤΙ αναβάλλεται:** ADR-399 Phase B/C/D είναι pending + ΜΗ browser-verified → refactor τους τώρα ρισκάρει unverified κώδικα. **ΠΟΤΕ:** μετά το browser-verify B/C/D από Giorgio. — **Previous:** 2026-05-27 — **ADR-391 AdminLayerManager Ribbon Wiring DONE (Sonnet 4.6, ~1h, orphan-component bug closed)**: AdminLayerManager (~400 lines fully implemented) ήταν unreachable από production — zero ribbon button, zero mount, zero shortcut. ADR-382 verification αποκάλυψε ότι ο user δεν είχε UI να toggle `layer.visible/frozen/color/lineweight`. **Decisions Q1-Q4 (locked Γιώργος 2026-05-27)**: Q1 Modal Radix Dialog (Revit V/G parity, όχι floating/4th-tab), Q2 View tab (industry: Revit View > Layer Manager), Q3 Ctrl+L (consume dead `toggleLayers` shortcut — `LA` ήταν booked από `layering` paint-tool, ζητούμενο zero-breakage), Q4 ADR-391 (επόμενο free; ADR-381 §3 pre-allocation για "ribbon-auto-registry" → αναβάλλεται σε ADR-392). **Scope**: 5 NEW (AdminLayerManagerDialogStore singleton + AdminLayerManagerDialog Radix wrapper + AdminLayerManagerDialogHost mount + view-tab-layer-manager.ts ribbon panel + ADR-391 doc) + 7 MODIFIED (dxf-viewer-lazy-components.tsx lazy export + ribbon-default-tabs.ts View panels array + DxfViewerContent.tsx Suspense mount + useDxfViewerCallbacks.ts `action: 'open-layer-manager'` branch + useKeyboardShortcuts.ts Ctrl+L wiring + el/en dxf-viewer-shell.json i18n keys). **SSoT alignment 5/5**: Dialog `@/components/ui/dialog` (ADR-001), store pattern mirror CommandLineStore, action dispatcher `wrappedHandleAction` (ADR-345), keyboard shortcut SSoT `keyboard-shortcuts.ts` (zero new declaration — consumes dead one), LayerStore SSoT (zero touch). **ADR-382 chain**: όταν user toggle-άρει `layer.visible` στο dialog → LayerStore version bump → ADR-382 resolver chain → 2D+3D auto-refresh (zero extra wiring). Pending commit. Manual browser verify: Ctrl+L → Dialog opens → toggle 👁 BIM layer → 2D walls hide → switch 3D → 3D walls also hide. **Previous:** 2026-05-27 — **ADR-382 Visibility Resolver SSoT Phase C+D+E DONE (Opus 4.7, ~2h, production bug closed)**: ADR-381 §2.5 C1 critical finding fully implemented. Phase A (Haiku, 1519a4be) + Phase B (Opus, 4edbb62a) ήδη committed (resolver + 7/7 BIM 2D renderers). Phase C+D+E σε αυτή τη συνεδρία. **Root cause**: `BimSceneLayer.sync()` (3D) έκανε category-level guard (`if (wallVisible) { for wall of walls {...} }`), δεν consult-άρει LayerStore — hidden BIM layer στο Layer Manager έκρυβε 2D entities αλλά παρέμεναν ορατά στο 3D. Selection μηχανισμοί σέβονταν `layer.visible` → φαντασματική συμπεριφορά (ορατά αλλά μη-επιλέξιμα). **Phase C scope (3D pipeline)**: `BimSceneLayer.ts` rewrite — per-entity loop με `resolveEntity()` helper που καλεί `resolveIsEntityVisible()` (V/G + Layer + Floor + Building intersection, ANY-hides-wins Revit-style). Split σε 5 private syncCategory methods + 2 hosted-opening filters (function-size compliant ≤40 lines). Νέο 8ο argument `floorVisModes: ReadonlyMap<string, FloorVisMode>` propagated end-to-end: `ThreeJsSceneManager.syncBimEntities` + `scene-manager-actions.SyncBimEntitiesArgs` + 4 BimViewport3D call-sites + `use-bim3d-vg-resync`. `use-bim3d-store-sync.ts` (a) floorVisibilityModes subscriber αναβαθμίστηκε από `applyFloorVisibility-only` σε `syncBimEntities + applyFloorVisibility` (defense-in-depth: pre-mesh hide + post-hoc ghost styling), (b) νέος `subscribeLayerStore()` subscriber με version-based dedup → toggle layer.visible/frozen στο Layer Manager τώρα triggers 3D rebuild → resolver pre-mesh filter (closing 2D⟷3D parity bug). `applyFloorVisibility/applyBuildingVisibility` doc comments updated με role split. Per-entity hosted-opening filter (Wall→Opening, Slab→SlabOpening) σέβεται V/G+Layer+Floor+Building για κάθε opening separately. **Phase D scope (docs+registry)**: `.ssot-registry.json` νέο `visibility-resolver` Tier 2 module — forbids direct `objectStyles[cat]?.visible` reads outside resolver internals (1 ERE pattern για 7 BIM categories). ADR-382 status header 🟡 PLAN APPROVED → 🟢 PHASE A+B+C+D+E COMPLETE + 5 changelog entries. ADR-381 §3 C1 entry → ✅ COMPLETE με link σε ADR-382. ADR-040 changelog: ADR-382 micro-leaf compliance note (event-time resolver calls, pre-mesh filter, low-freq LayerStore subscriber). ΕΚΚΡΕΜΟΤΗΤΕΣ νέα ΟΜΑΔΑ ΑΥΘ + C1 → ✅ ΥΛΟΠΟΙΗΜΕΝΟ. adr-index ADR-382 entry. **Phase E scope (verify)**: `resolveIsCategoryVisible` παραμένει exported για backward compat. TSC --noEmit clean για ADR-382 paths (2 pre-existing errors σε route.ts + incremental-backup σχετίζονται με ADR-380 stair audit pending commit, ΟΧΙ Phase C). **Tests 54/54 PASS** (27 resolver unit + 10 V/G regression + 17 Phase C integration matrix: 4 Layer + 4 Floor + 2 Building + 4 Intersection + 3 Hosted-Openings). **Scope total Phase C+D+E**: 1 NEW test + 9 MODIFIED (BimSceneLayer/scene-manager-actions/ThreeJsSceneManager/BimViewport3D/use-bim3d-vg-resync/use-bim3d-store-sync/applyFloorVisibility/applyBuildingVisibility/.ssot-registry.json) + 4 DOCS. Manual browser verification PENDING — Giorgio να ανοίξει /dxf/viewer, να κρύψει BIM layer στο Layer Manager, να switch σε 3D, να verify entities εξαφανίζονται και στους δύο. **Previous:** 2026-05-27 — **ADR-390 Symmetric BIM Delete/Undo Persistence DONE (Opus 4.7, Phase 1+2+3 all complete)**: Sibling του ADR-381 master audit (separate concern — naming collision retroactively renamed). Δύο bugs live verified: (A) Zombie write στο undo — Ctrl+Z μετά BIM delete ξανάγραφε ίδιο UUID + audit 'created' (όχι 'restored'), root cause `DeleteEntityCommand.undo()` restore-d μόνο scene → auto-save effect έπαιρνε stale `lastSaved=undefined` → debounced persist zombie. (B) Ghost render μετά hard refresh — BIM entities visible στο canvas χωρίς Firestore docs, root cause dual persistence (per-entity + DXF JSON `autoSaveV2`) + subscribe-loop `neverSaved` guard που επέστρεφε true για fresh `lastSavedParamsRef` Map. Industry 7/7 (Revit/AutoCAD/ArchiCAD/Bentley): undo of delete restores scene+DB+audit('restored'). **5 architectural decisions**: D1 single generic event `'bim:entity-restore-requested'` (type-discriminated payload, 7 entityTypes), D2 audit action `'restored'` (route allowlist + UI ήδη υπήρχε με RefreshCw icon), D3 `pendingFirstSaveIdsRef` αντικαθιστά buggy `neverSaved` guard → Bug B fixed, D4 auto-save effect early-return `if (!known && !pending) return` → Bug A defense-in-depth, D5 SSoT shared hook `useBimEntityRestoredPersistEffect` mirror του `useBimEntityMovedPersistEffect` αποτρέπει 7-way drift. **Scope**: 2 NEW (`useBimEntityRestoredPersistEffect.ts` SSoT + `ADR-390-symmetric-bim-delete-undo.md` ~280 lines, 9 sections + §Historical Note) + 17 MODIFIED (EventBus + `DeleteEntityCommand` single+multi undo + audit route VALID_ACTIONS + 7 audit-clients με `'restored'` action + 7 persistence hooks με `pendingFirstSaveIdsRef`+`deletedIdsRef`+`persistRestore` callback) + 2 NEW test suites (DeleteEntityCommand.test.ts 9/9 PASS + useBimEntityRestoredPersistEffect.test.ts 7/7 PASS = 16/16 PASS Phase 3). Phase 4 (BIM filter από DXF JSON `autoSaveV2`) DEFERRED — orthogonal, Bug B fully fixed χωρίς αυτό. **Historical commit-tag note**: 5 commits (`f6d81500` → `4a927853` 2026-05-27) mistagged "ADR-381 Phase A" — pre-allocation labelling πριν διαπιστωθεί η σύγκρουση με ADR-381 master audit doc (ίδια date). Functionally identical, βλ. ADR-390 §Historical Note. ΕΚΚΡΕΜΟΤΗΤΕΣ ΟΜΑΔΑ ΑΥΗ + adr-index + memory updated. Pending commit Phase 3 bundle. **Previous:** 2026-05-27 — **ADR-040 Phase XXIII DONE (Opus 4.7, BIM 3D rAF unification SSoT)**: Firefox profile σε 2D wheel-zoom + BIM slab visible έδειξε `Window.requestAnimationFrame` self-time 17% (27 samples / 21s). Root cause: **ΔΥΟ ανεξάρτητα persistent rAF loops** — `UnifiedFrameScheduler` (master 2D) + `ThreeJsSceneManager.startLoop()` (BIM 3D), παράλληλα, χωρίς dirty-check. Παράβαση ADR-040 Cardinal Rule #1 + half-finished ADR-366 Phase 4.2 ("single RAF coordination" comment σε 3 modules αλλά ο master scene loop ποτέ δεν αφαιρέθηκε). Industry alignment 4/4 (Forge Viewer SDK / Three.js Editor / iModel.js / AutoCAD Web — single master rAF + per-subsystem dirty-check + on-demand render). **FIX**: 1 NEW pure-function helper (`scene-dirty-state.ts` + 7-test suite) + 8 MODIFIED. `ThreeJsSceneManager`: removed `startLoop()` / `rafHandle` / `lastFrameTime`, added public `tick(now, delta)` + `isSceneDirty()` + `markSceneDirty()`, cached `RenderFrameContext` once (was rebuilt per rAF call), 11 mutation sites self-mark dirty. `scene-dispose.ts`: dropped `rafHandle` dep + cancelAnimationFrame call. `scene-setup.ts`: exposed `onRenderNeeded` (was no-op) — wired to `markSceneDirty()` so OrbitControls `dampingFactor=0.25` inertia continues to drive renders for ~300ms post-pointer-up without keeping a continuous rAF alive. `BimViewport3D.tsx`: registers `'bim-3d-scene'` system με `UnifiedFrameScheduler.register(...)` στο mount useEffect, unregister BEFORE `manager.dispose()` (race-free teardown). `.ssot-registry.json` νέο entry `frame-scheduler-master-raf` (Tier 3, forbidden pattern `this\.rafHandle\s*=\s*requestAnimationFrame`, allowlist UnifiedFrameScheduler.ts). ADR-040 §"Phase XXIII — Single rAF SSoT Consolidation (BIM 3D)" + ADR-366 Phase 4.2 closure note (cross-ref to ADR-040 XXIII). tsc PASS zero new errors. Expected profile delta: rAF self time 17% → ~8-10% (halved). **Previous:** 2026-05-27 — **ADR-380 Stair + Slab-Opening Audit Coverage DONE (Sonnet 4.6, ~1h, ADR-379 ολοκλήρωμα)**: Δύο BIM entity types εκτός ADR-379 scope: (A) `stair` — ZERO audit coverage (no client, missing από `AuditEntityType` union, missing από route `VALID_ENTITY_TYPES`). (B) `slab-opening` — partial coverage με `[{ field: 'kind' }]` placeholder pattern (χωρίς diffTrackedFields SSoT helper, χωρίς prevParams, καμία test suite). **FIX**: 4 NEW (stair-audit-client.ts + 2 test suites + ADR-380) + 6 MODIFIED (audit-trail types + route.ts + audit-tracked-fields.ts STAIR_TRACKED_FIELDS ~28 fields + SLAB_OPENING_TRACKED_FIELDS 8 fields + slab-opening-audit-client.ts refactor + use-stair-persistence.ts wiring + useSlabOpeningPersistence.ts prevParams) + `.ssot-registry.json` bim-audit-helpers +2 forbidden patterns (buildStairChanges + buildSlabOpeningChanges) + addedByAdr "ADR-379, ADR-380". 7/7 BIM entities πλέον audit-covered. Pending commit bundled με ADR-379. **Previous:** 2026-05-27 — **ADR-379 BIM Entity Audit Coverage DONE (Opus 4.7, ~3h, two root-cause fix)**: (A) `/api/audit-trail/record` route.ts ownership check έτρεχε `entityDoc.exists` ΜΕΤΑ το client-side delete → 404 → silent swallow στον client → **κανένα BIM delete audit row δεν γραφόταν** για τα 5 entity types. (B) 5 BIM audit-clients (wall/column/slab/beam/opening) δέχονταν μόνο `Pick<Entity, 'id'|'kind'>` και έγραφαν `[{ field: 'kind', oldValue, newValue }]` placeholders — zero dimensional content. Property/Building/Contact entities χρησιμοποιούν `diffTrackedFields()` SSoT σωστά εδώ και καιρό — BIM ήταν το outlier. **FIX**: 2 NEW (bim-audit-helpers.ts SSoT για create/update/delete diff builders + ADR-379) + 12 MODIFIED. Route bypass: `if (!entityDoc.exists) { if (action !== 'deleted') throw 404 }` με defense-in-depth caller-companyId tagging. 5 νέα tracked-fields registries (WALL/COLUMN/SLAB/BEAM/OPENING) στο audit-tracked-fields.ts (~70 fields total, coordinate-heavy fields εξαιρούμενα). 5 audit-clients refactored σε νέα signature `recordXxxChange(action, snapshot, { prevParams })`. 5 persistence hooks captures `prevParams` πριν το save + full snapshot σε delete. Skip-on-no-diff για updates (debounced auto-save fires σε identical params συχνά). **27/27 tests PASS** (12 helper + 15 audit-client). Route integration test skipped (Next/server Request polyfill issue στο SWC test env) — manual verify documented σε ADR-379 §4. ΕΚΚΡΕΜΟΤΗΤΕΣ ΟΜΑΔΑ ΑΥΔ + adr-index ADR-379 entry + memory updated. Pending commit. **Previous:** 2026-05-27 — **ADR-040 Phase XXII.C DONE (Opus 4.7, ~1h, TransformContext duplicate SSoT removed)**: Production-profile-driven follow-up στο XXII.A. Profile inspection αποκάλυψε ότι (a) post-XXII.A παρέμενε ~70% React reconciliation στο wheel-zoom path με 14% concentrated σε component label `RibbonGroupRoot` (name unclear από JPG — pending Giorgio clarification αν χρειαστεί), (b) `dxf-bitmap-cache.ts` είναι dead code σήμερα (instantiated αλλά rebuild()/blit() never called — `DxfRenderer.render()` καλείται direct), (c) raster < 10% frame budget. Βρέθηκε root cause #2: vestigial `contexts/TransformContext.tsx` (React Context + useState<ViewTransform>) έπεφτε χωρίς διαγραφή στο Phase XIII migration. `wrappedHandleTransformChange` έγραφε ΚΑΙ στο legacy Provider → Provider re-render + duplicate `EventBus.emit('dxf-zoom-changed')` σε κάθε wheel notch. Μοναδικός production consumer: `CoordinateDebugOverlay.tsx` (debug-only). **FIX**: 4 MODIFIED + 1 DELETED. `contexts/TransformContext.tsx` deleted via `git rm`. `useDxfViewerCallbacks.ts` `wrappedHandleTransformChange` simplified σε single `setCanvasTransform` write (writes through `updateImmediateTransform`); `contextSetTransformRef` + `handleTransformReady` removed από params + return interface + useCallback. `DxfViewerContent.tsx` drops `TransformProvider` import + wrap, drops `contextSetTransformRef` useRef, drops `handleTransformReady` destructure + param, drops unused `ViewTransform` type import. `CoordinateDebugOverlay.tsx` migrated από `contexts/TransformContext` → `systems/cursor/ImmediateTransformStore` (same `useTransformValue()` signature, useSyncExternalStore-backed — zero behavior change). `debugTools.ts` live-coords debug tool renders `CoordinateDebugOverlay` direct χωρίς runtime Provider wrap (singleton subscription); drop unused `WindowWithDxfTransform` import. **Phase XXII.B archived as obviated by profile data** (was 7h Opus για ξύλινο raster fix — wrong target). ADR-040 §Changelog Phase XXII.C populated. TS check background. Pending commit. **Previous:** Phase XXII.A — orchestrator decoupling (`useCanvasRefs()` + `getImmediateTransform()` event-time reads, `CanvasLayerStackTransformBridge.tsx` thin subscriber wrapper).
**Previous:** 2026-05-27 — **ADR-378 Phase 6 DONE — ADR-378 ALL PHASES COMPLETE (Sonnet 4.6, ~30min, SSoT registry hardening + final closure)**: `.ssot-registry.json` `snap-engine` module updated για zero-reintroduction guard. `forbiddenPatterns` 2 → 4: added `new\s+SnapEngine\s*\(` (geo-canvas legacy class deleted ADR-378 Phase 4) + `class\s+AISnappingEngine` (conference demo dead code deleted ADR-378 Phase 1). Retained `new\s+ProSnapEngineV2\s*\(` + `new\s+SnapManager\s*\(`. `description` rewritten: references ADR-378 master + 7/7 industry convergence (Revit/AutoCAD/ArchiCAD/BricsCAD/SketchUp/Vectorworks/Bentley single-engine + N-modes-via-registry) + per-pattern rationale + geo-canvas `useSnapEngine` façade + `parserResultToEntities` adapter cross-ref. `addedByAdr` ADR-040 → ADR-378 (master now owns rule). `allowlist` gained `src/subapps/dxf-viewer/snapping/__tests__/**` glob. `npm run ssot:baseline` refreshed `.ssot-violations-baseline.json` — zero new violations from any Phase 1-5 work. Grep verification: `new SnapEngine(` in `src/` → zero matches; `class AISnappingEngine` → only 1 docs analysis MD (not scanned). `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` X6 ✅ + header 🟢 ALL PHASES COMPLETE. ADR-378 status header 🟡 DRAFT → ✅ COMPLETE. `adr-index.md` Phases 1+2+3+4+5 → ALL Phases 1-6 COMPLETE. ADR-378 §9 Phase 6 + §15 changelog populated. Memory entry + MEMORY.md index updated. `inferred-alignment-service` entry remains standalone in this file (ADR-3XX TBD), folded into ADR-378 §11 future work cross-reference. **ADR-378 fully shipped — 5 parallel snap subsystems → 1 production singleton (ProSnapEngineV2 via getGlobalSnapEngine), 26 sub-engines via SnapEngineRegistry, DXF Viewer + geo-canvas property floorplan tab unified.** Pending commit (1 modified: `.ssot-registry.json` + 1 baseline JSON refresh + tracking files).
**Previous:** 2026-05-27 — **ADR-378 Phase 4 DONE (Opus 4.7, ~2h, Geo-canvas unification)**: Geo-canvas property floorplan tab πλέον μοιράζεται το `ProSnapEngineV2` με το DXF Viewer μέσω `getGlobalSnapEngine()` — κερδίζει 26 modes (BIM corners + dimensions + guides + text + classic CAD) αντί του προηγούμενου 6-mode parallel engine. Industry alignment 7/7 (Revit/AutoCAD/ArchiCAD: 1 engine + N modes via registry). **NEW**: `src/subapps/geo-canvas/floor-plan-system/snapping/adapter/parser-result-to-entities.ts` (108 LOC, GeoJSON LineString→LineEntity/PolylineEntity, Polygon→closed PolylineEntity, MultiLineString→multiple PolylineEntity, mirror `regionsToSnapEntities` pattern). **REFACTORED**: `hooks/useSnapEngine.ts` πλήρης rewrite (~190 LOC) — getGlobalSnapEngine() + parserResultToEntities adapter + EXTENDED_TO_GEO_MODE mapper (6 classic ExtendedSnapType → SnapMode, all other 19+ ExtendedSnapType fallback to ENDPOINT για visual consistency με existing render layer). Public API surface (`UseSnapEngineReturn`) UNCHANGED — consumers `GeoCanvasContent.tsx:93` + `FloorPlanCanvasLayer.tsx` work as-is. **DELETED**: `engine/SnapEngine.ts` (275 LOC parallel class) + `engine/endpoint-detector.ts` (202 LOC GeoJSON extraction) + `engine/snap-distance.ts` (139 LOC) + `engine/index.ts` barrel + `hooks/useSnapPoints.ts` (zero callers verified). `hooks/index.ts` + `snapping/index.ts` updated. **KEPT**: `types/snap-types.ts` (SnapPoint/SnapResult/SnapMode/SnapSettings — render layer consumers) + `config/snap-defaults.ts` (DEFAULT_SNAP_SETTINGS/SNAP_VISUAL/MODE_LABELS/PRIORITY — SnapIndicator + render utils) + `rendering/SnapIndicator.tsx`. **VERIFICATION**: tsc zero new errors σε Phase 4 files (parser-result-to-entities + useSnapEngine + geo-canvas namespace clean). Jest 188 pass / 2 pre-existing fails (bim-corner-alignment.integration + DxfGeoTransform i18n drift "At least 3 control points are required" vs Greek expected — και τα δύο unrelated to Phase 4, υπήρχαν πριν). Grep verification: zero production references `new SnapEngine` / `extractEndpoints` / `deduplicateSnapPoints` / `findNearestSnapPoint` / `useSnapPoints` / `createSnapEngine` σε geo-canvas namespace. local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt X4 ✅ + ADR-378 §3.3→§3.1 move + §9 Phase 4 DONE + §15 + adr-index ενημερωμένα. Επόμενο: Phase 6 .ssot-registry.json forbidden patterns + baseline refresh (~30min Sonnet, trivial).
**Previous:** 2026-05-27 — **ADR-378 Phase 3 DONE (Sonnet 4.6, ~2h, TextSnapEngine completion)**: TEXT/MTEXT 8-point snap pipeline ολοκληρωμένο. NEW `src/subapps/dxf-viewer/snapping/engines/TextSnapEngine.ts` (151 LOC, mirror ColumnCenterSnapEngine pattern, linear scan over text-only filtered entities, 8 points per entity = insertion + 4 corners + center + 2 edge mids, approximate bbox από fontSize/text length για TEXT ή width/height για MTEXT, rotation around insertion). NEW `engines/__tests__/TextSnapEngine.test.ts` (14 cases — empty/non-text/8-candidate emission/insertion match/type+priority/all-kinds/mtext width/radius cut/exclude/invisible/rotation 90°/multi-entity/mixed/dispose). Registry wire σε `SnapEngineRegistry.ts:101`. SnapIndicatorOverlay.tsx νέο `case 'text'` → nested square ▣ (concentric rects, Revit/AutoCAD convention distinct from generic endpoint). i18n: `snapModes.labels.text.*` 8 sub-keys (insertion/cornerTl/cornerTr/cornerBl/cornerBr/center/edgeTopMid/edgeBottomMid) + tooltips.text σε el+en. **Type system already in HEAD**: commits 7f788d8d (`ExtendedSnapType.TEXT='text'` + enabledTypes + priority position 2 after INSERTION + perModePxTolerance 10px) + aabfb04f (`SNAP_ENGINE_PRIORITIES.TEXT=2`). **Phase 3.4 N/A**: zero manual `getTextSnapPoints()`/`toSnapCandidates()` feed in `text-layout-engine.ts` — only `interaction/index.ts` re-export + tests use it. Same pattern as Phase 2 surprise. 28/28 TextSnapEngine + TextSnapProvider tests PASS. Broader snap suite 168/169 PASS (1 pre-existing fail in bim-corner-alignment.integration.test.ts not caused by Phase 3). ΕΚΚΡΕΜΟΤΗΤΕΣ X3 ✅ + ADR-378 §3.1/§3.3/§9 Phase 3/§15/§2.1 updated. Pending commit (4 new files + 4 modified). Επόμενο: Phase 4 geo-canvas unification (~3h Opus, cross-cutting) ή Phase 6 SSoT registry refresh (~30min Sonnet, trivial).
**Previous:** 2026-05-27 — **ADR-378 Phase 5 DONE (Sonnet, EXPANDED doc cleanup)**: Original plan scope ήταν 2 αρχεία (ADR-597 phantom + adr-index polish). Πραγματικό scope κατόπιν Phase 1+2 verification = **12 edits σε 11 αρχεία**: (1) ADR-597 line 12 ADR-149→ADR-378, (2) ADR-597 line 23 ιεραρχία ADR-378 §5, (3) ADR-597 line 842 references list update, (4) ADR-153 ADR-149→ADR-378, (5) ADR-359 ADR-149→ADR-378, (6) ADR-034 row AISnappingEngine.ts strikethrough+Removed, (7) ADR-092 STORAGE_KEYS.AI_SNAPPING strikethrough, (8) ADR-092 AISnappingEngine.ts file ref strikethrough, (9) ADR-362 line 451 pro-snap-engine.ts → DimDefPoint/DimLineSnapEngine, (10) ADR-362 line 621 same, (11) ARCHITECTURE.md tree pro-snap-engine.ts removed → global-snap-engine.ts added, (12) DXF_SETTINGS_PROGRESS + DXF_VIEWER_CONFERENCE_REPORT AI-Snapping marked DELETED. Plus code: storage-utils.ts AI_SNAPPING orphan const deleted, snap-engine-utils.ts:36 stale comment removed. adr-index.md ADR-378 entry polished (DRAFT→ACTIVE, Phases 1+2+5 DONE noted). Final grep: zero stale production references. Only legit remaining: historical changelog entries (ADR-314 Phase C.5.32 2026-04-19), archived ADRs (067/079), research/analysis MDs, baseline JSON (Phase 6 scope), backup files. ΕΚΚΡΕΜΟΤΗΤΕΣ X5 + ADR-378 §9 Phase 5 mark DONE + §15 changelog + memory updated. Pending commit. Επόμενο: Phase 3 TextSnapEngine completion (~2h Sonnet, νέα συνεδρία) ή Phase 4 geo-canvas unification (~3h Opus). Phase 6 SSoT registry refresh trivial μετά.
**Previous:** 2026-05-27 — **ADR-378 Phase 2 DONE (Sonnet, ghost singleton delete)**: `snapping/index.ts` έχασε το re-export γραμμή `export { snapSystem } from './pro-snap-engine'`. `git rm src/subapps/dxf-viewer/snapping/pro-snap-engine.ts`. Surprise finding: ZERO production consumers του `snapSystem` global υπήρχαν. Καμία migration χρειάστηκε — απλό delete.
**Previous:** 2026-05-27 — **ADR-378 Phase 1 DONE (Sonnet, dead code delete)**: `git rm` σε 3 αρχεία — `AISnappingEngine.ts` + `AISnappingEngine.types.ts` + `useProSnapShortcuts.ts`. Zero production references επιβεβαιωμένα με grep (μόνο 1 stale comment σε `snap-engine-utils.ts:36` + 6 doc/analysis files info-only). ai-snapping folder κενό. ΕΚΚΡΕΜΟΤΗΤΕΣ Χ1 + ADR-378 §15 changelog updated. Pending commit (Phase 1 deletes + tracking updates) μαζί με Phase 0 bundle.
**Previous:** 2026-05-27 — **ADR-378 Snap System Master DRAFT (Opus 4.7)**: Master ADR γράφτηκε για consolidation 5 παράλληλων snap συστημάτων (ProSnapEngineV2 + geo-canvas + AISnappingEngine demo + TextSnapProvider half-done + pro-snap-engine.ts ghost). Documents Orchestrator→Registry→26 engines, resurrects phantom ADR-149 priority table στο §5, defines 6-phase cleanup roadmap. Industry alignment 7/7 (Revit/AutoCAD/ArchiCAD/BricsCAD/SketchUp/Vectorworks/Bentley → all single-engine + N-modes registry). Phase 0 (ADR write) DONE. Phases 1-6 ΕΚΚΡΕΜΟΥΝ (estimate ~9h Opus+Sonnet): P1 delete dead code (AISnappingEngine + useProSnapShortcuts), P2 migrate measure-snap-bridge ghost, P3 TextSnapEngine completion, P4 geo-canvas unification, P5 doc cleanup, P6 SSoT registry. adr-index.md + local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt ΟΜΑΔΑ Χ updated. Pending commit (Phase 0 doc-only bundle: ADR-378 + adr-index + ΕΚΚΡΕΜΟΤΗΤΕΣ + pending-ratchet).
**Previous:** 2026-05-26 — **ADR-375 Phase C.7 DONE — ADR-375 ALL PHASES COMPLETE**: 3D BIM edge overlay parity. Industry stack `Line2/LineMaterial + LineSegmentsGeometry` (Autodesk Forge/Three.js Editor/Sketchfab). `EdgesGeometry(geo, 30°)` Revit silhouette default. Screen-space `linewidth × devicePixelRatio` (Revit True Line Weight pattern). 4 NEW (resolver wrapper + overlay builder + resolution store + 2 test suites = 38/38 PASS) + 5 MODIFIED (BimToThreeConverter 4 entity types via `attachEdgesProjection` helper, wall-opening-extrude per-segment, StairToThreeConverter 4 components με ADR-377 keys treads/risers/outlines, ThreeJsSceneManager.resize one-liner). Jest infra fix: pnpm-aware transformIgnorePatterns enables Three.js ESM examples. 76/76 2D regression PASS — zero impact. local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt AΛ'7 ✅ + ADR-375 v2.5 + adr-index updated. Pending commit (bundle C.6 + C.7 + ADR-376 ribbon residual).
**Previous:** 2026-05-26 — **ADR-376 Phase C.3 DONE — ADR-376 COMPLETE ALL PHASES SHIPPED**: PDF Opening Schedule Export (Πίνακας Κουφωμάτων). 1 PDF with 2 sections (Θύρες + Παράθυρα), Revit-style combined sheet. 3 NEW files (opening-schedule-pdf-exporter.ts + OpeningSchedulePdfHost.tsx + 6 tests PASS) + 9 MODIFIED (EventBus + command-keys + annotate-tab + RibbonButtonIcon + useRibbonOpeningBridge + DxfViewerContent + schedule-presets mark column + i18n el/en). ADR-376 §7 C.3 + §11 v11 changelog + adr-index updated. local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt ΑΠ7 ✅ ΥΛΟΠΟΙΗΜΕΝΟ. Pending ratchet: legacy `boq_bim_<openingId>` rows από Phase A single-entry path (αν υπάρχουν production data) — cleanup TODO παρακάτω. .ssot-registry.json `opening-boq-grouper` + `opening-tag-drag-controller` + `opening-tag-style` entries pending μέχρι να καθαρίσει working tree.
**Source of truth:** `adrs/ADR-299-ratchet-backlog-master-roadmap.md`
**Purpose:** Agent-facing live checklist. Se STATUS = ALL_DONE → salta il resto. Se STATUS = ACTIVE → leggi e ricorda a Giorgio.

---

## 🚨🚨🚨 ΥΠΟΧΡΕΩΤΙΚΗ ΑΝΑΓΝΩΣΗ — ΚΑΘΕ AGENT / DEVELOPER ΣΕ ΚΑΘΕ SESSION 🚨🚨🚨

### ADR-365 — Tailwind raw palette ratchet: τι ΠΡΕΠΕΙ να ξέρεις πριν αγγίξεις κώδικα

**Πραγματική βάση (2026-05-19): 3.659 violations σε 440 αρχεία.**
Αρχική εκτίμηση ADR-365 ήταν 249/65 — λάθος, γιατί μέτρησε **μόνο** `hover:bg-*`. Το CHECK 3.26 μετράει όλη την επιφάνεια (bg/text/border/ring/fill/stroke × 22 παλέτες × 11 αποχρώσεις × 6 state prefixes × `dark:`).

### Τι ΑΠΑΓΟΡΕΥΕΤΑΙ πλέον (zero tolerance)

Σε ΟΠΟΙΟΔΗΠΟΤΕ νέο ή αγγιγμένο αρχείο **εκτός allowlist** (`src/design-system/`, `src/styles/design-tokens/`, `tailwind.config.ts`, κλπ. — βλ. `.ssot-registry.json` → `tailwind-hardcoded-palette.allowlist`):

❌ ΟΧΙ `hover:bg-amber-100`, `text-red-600`, `dark:bg-slate-800`, `border-blue-300`, `ring-emerald-500`, κλπ.
❌ ΟΧΙ `dark:` prefix σε consumer files — semantic tokens είναι ήδη theme-aware.

### Τι ΧΡΗΣΙΜΟΠΟΙΕΙΣ αντί γι' αυτά

✅ **shadcn tokens** (παντού όπου ταιριάζει): `bg-background`, `bg-card`, `bg-muted`, `bg-accent`, `bg-destructive`, `bg-primary`, `text-foreground`, `text-muted-foreground`, `text-destructive`, `border-border`, `border-ring`, `ring-ring`.
✅ **CSS vars για status states**: `bg-[hsl(var(--bg-success))]`, `bg-[hsl(var(--bg-error))]`, `bg-[hsl(var(--bg-warning))]`, `bg-[hsl(var(--bg-info))]` (και με `/40` opacity για subtle).
✅ **COLOR_BRIDGE** (`src/design-system/color-bridge.ts`) για ώριμα mappings.
✅ **Mapping table** πλήρης: ADR-365 §3.1.

### Boy Scout Rule (ADR-365 §7.2 + N.0.2)

**ΟΤΑΝ αγγίζεις αρχείο για άλλο λόγο**: αν περιέχει raw palette utilities από τη baseline, καθάρισέ τα μαζί στο ίδιο commit. **Δεν χρειάζεται να καθαρίσεις τα πάντα — όσα μπορείς εύκολα.** Το ratchet θα ξαναπροσαρμοστεί προς τα κάτω.

### Πώς δουλεύει το ratchet (CHECK 3.26)

- **Νέο αρχείο**: zero tolerance — οποιοδήποτε raw palette utility μπλοκάρει το commit.
- **Υπάρχον αρχείο**: μπορεί να έχει ίδιο ή λιγότερο count από το baseline. Πάει πάνω = block.
- **Allowlist αρχείο**: εξαιρείται (design-system, tokens, brand-map, κλπ).
- **Εντολές**: `npm run tailwind-palette:audit` (full scan), `npm run tailwind-palette:baseline` (refresh μετά cleanup).

### Πλάνο cleanup (Phases 1-8)

Αρχικά εκτιμήθηκαν ~5h × 8 φάσεις. **Πραγματικά θα πάρει 30-50h** λόγω του 14.7x μεγαλύτερου baseline. Η στρατηγική παραμένει: per-domain atomic commits + Boy Scout. **Δεν είναι production bug** — είναι θέμα συντήρησης / theme-consistency / dark-mode.

---

## How this file is read by the agent

1. **Session start (first reply to Giorgio):** Briefly mention (2-4 lines) what is pending here, unless:
   - Giorgio gives a clear order for independent work (then 1 line: "N pending ratchet tasks in ADR-299, see `.claude-rules/pending-ratchet-work.md` when needed")
   - Giorgio's work is explicitly a **non-ratchet** topic — don't load the reply with unrelated reminders
2. **Reminder format:** One sentence for scope + hours + Giorgio's scenario. Don't write the full ADR-299 — point to it.
3. **Don't mark items as completed without order.** Giorgio decides which ratchet proceeds. If you finish an item, delete the whole entry and write **nothing** about its completion in this file (no strikethrough, no changelog row): completion is recorded only in the ADR changelog and git.

---

## Pending tasks (priority order)

### 📨 «Διάβασε JSON ή 400» γραμμένο ξεχωριστά σε 17 routes (προτεραιότητα ΧΑΜΗΛΗ, 2026-10-30, ADR-225 Phase 2 Boy Scout · ADR-245 · N.0.2)
- **Τι**: `try { raw = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }` σε 17 αρχεία του `src/app/api` (`grep -rn "Invalid JSON body" src/app/api`)· δύο τοπικά προοίμια το έχουν ήδη κλείσει στη γειτονιά τους (`admin/bim-diagnostics/[id]/_request-preamble.ts` · `telemetry/bim-performance/_session-request.ts`).
- **Γιατί**: το `jscpd --diff` (CHECK 3.28) τα ονομάζει μόνο όταν δύο αδέλφια μπουν στο ίδιο commit — δηλαδή μπλοκάρει άσχετα commits.
- **Fix**: ΕΝΑ `readJsonBody(request)` → `{ ok, raw } | { ok: false, response }` στο SSoT των API routes (ADR-245) — πρώτα grep για υπάρχον helper· τα δύο τοπικά προοίμια το καλούν.
- Συγγενές: ο client `src/subapps/dxf-viewer/bim-3d/telemetry/telemetry-uploader.ts` δηλώνει δικό του `x-bim-session-id` — μία δήλωση συμβολαίου client/server.

### 🔔 Ειδοποιήσεις με ελληνικό `title` ΧΩΡΙΣ `titleKey` — θέμα email στη γλώσσα του κώδικα, όχι του παραλήπτη (προτεραιότητα ΜΕΣΑΙΑ, 2026-10-28, ADR-327 · N.11 · N.0.2)
- **Τι**: το `notification-orchestrator` αποδίδει πλέον τον τίτλο από το `titleKey` στη γλώσσα του παραλήπτη (`server/notifications/notification-title.ts`). Όποιος καλών **δεν** δίνει `titleKey` γράφει ακόμη ελεύθερο ελληνικό `title`/`body` ⇒ ελληνική κάρτα **και** θέμα email σε αγγλόφωνο. Γνωστό σημείο: `services/procurement/po-notification-service.ts` (`Παραγγελία … — Εγκρίθηκε`, περιοχή PO — **δεν** αγγίχθηκε). Το σύνολο **δεν μετρήθηκε** — πρώτα απογραφή όλων των `dispatch*Notification(`/`dispatchNotification({` χωρίς `titleKey`.
- **Fix**: κλειδιά στο `common-shared` (ή νέο namespace + προσθήκη στο `NOTIFICATION_TITLE_NAMESPACES`) + `notificationFallbackTitle(key)`· το `body` θέλει το ίδιο κανάλι (`bodyKey` υπάρχει ήδη στο orchestrator). Πύλη: η άγκυρα Ν4 του `notification-title.test.ts` σαρώνει **λίστα** καλούντων — να γίνει σάρωση όλου του server.
- **Δεύτερο, ίδια οικογένεια**: `app/api/quotes/scan/process.ts` γράφει **ελληνικό κείμενο στα δεδομένα** (`quote.notes = '[AI scan] Δεν αναγνωρίστηκε…' / 'Σφάλμα ανάλυσης…'`) ⇒ δομημένο πεδίο κατάστασης σάρωσης + απόδοση από i18n.

### ⬜ `bg-white` / `bg-black` = ΜΗ θεματική επιφάνεια κάτω από θεματικό κείμενο — τυφλό σημείο του CHECK 3.26 (προτεραιότητα ΥΨΗΛΗ, 2026-10-28, ADR-327 §8.5 · ADR-365 · ADR-770 · N.0.2)
- **Τι**: η πύλη προμηθευτή (`app/(auth)/vendor/quote/`) είχε `bg-white` σε κάθε `<section>`/header/dialog με κείμενο `text-foreground`. Στο σκοτεινό θέμα (προεπιλογή) το `--foreground` είναι σχεδόν λευκό ⇒ **λευκό σε λευκό**: τίτλοι, ετικέτες πεδίων, κουμπιά «Περιλαμβάνεται/Εξαιρείται» αόρατα. **Διορθώθηκε εκεί** (10 σημεία / 4 αρχεία → `bg-card`), επαληθευμένο ζωντανά και στα δύο θέματα.
- **Γιατί το πέρασε κάθε πύλη**: το CHECK 3.26 (ADR-365) μετρά **22 παλέτες × αποχρώσεις** — το `white`/`black` **δεν είναι παλέτα με απόχρωση**, άρα δεν μετριέται. Το 3.39 κοιτά το TS σύστημα χρωμάτων, όχι κλάσεις JSX· το 3.38 μόνο `text-primary`. Το κείμενο **κληρονομεί** χρώμα από άλλο στοιχείο από αυτό που βάζει το φόντο ⇒ κανένας έλεγχος «ανά στοιχείο» δεν το βλέπει.
- **Πού**: μετρημένο 2026-10-28 — **94** `bg-white` σε **47** `.tsx` του `src/` (κάποια νόμιμα: προεπισκόπηση εκτύπωσης/χαρτί, καμβάς). Συγκέντρωση: `dxf-viewer/bim-3d/*`, `property-showcase`, `status-bar`.
- **Fix**: (1) πρόσθεσε `white`/`black` (`bg-|text-|border-`) στο λεξιλόγιο του CHECK 3.26 ως ratchet κατά ταυτότητα — **όχι** reseed χωρίς Giorgio· (2) οι νόμιμες «χάρτινες» επιφάνειες δηλώνονται με λόγο (allowlist) ή περνούν σε token `--paper`· (3) τα υπόλοιπα → `bg-card` / `bg-background`.
- ✅ **2026-10-30 — Βήμα (3) ΕΓΙΝΕ (εκκρεμεί commit Giorgio, claude-6e)**. Μετρημένο ξανά: **194** γραμμές `bg-white|bg-black` (+πρόθεμα/`/opacity`) σε **92** `.ts/.tsx`
  (script με θετικό έλεγχο). Ταξινόμηση μία-μία: η συντριπτική πλειονότητα είναι **νόμιμη** — ημιδιάφανο λευκό/μαύρο πάνω σε σκοτεινό
  πέπλο με `text-white` (3D viewer, βίντεο, φωτογραφία) · πέπλα διαλόγων `bg-black/NN` · «χαρτί»/εικόνα (QR 2FA, PDF/HTML/DXF προεπισκόπηση,
  λογότυπα, κάτοψη, σφραγίδα) · δείκτες χάρτη/δείγματα με ρητό `text-black|white`. **Πραγματικά λάθη, διορθώθηκαν**:
  · 🔴 `dxf-viewer/config/modal-colors.ts`: **σκιώδες `COLOR_BRIDGE`** («mock for TypeScript compatibility», `bg.primary: 'bg-white'`,
    `text-gray-600/500`) ⇒ `input` = `bg-white … text-foreground` ⇒ **λευκό σε λευκό** στο σκοτεινό (καταναλωτές: `DxfImportModal`,
    `SimpleProjectDialog`, `WizardSteps*`, `wizard-step-chrome`, `ModalLoadingStates`). → το ΠΡΑΓΜΑΤΙΚΟ `@/design-system/color-bridge`
    (όπως το `modal-config.ts`)· σβήστηκε και νεκρό `colors`/`UI_COLORS`. Άγκυρα `config/__tests__/modal-colors-theme-surface.test.ts`
    (θεματικό κείμενο ∧ σταθερό συμπαγές φόντο ⇒ κόκκινο· μετάλλαξη με το παλιό `bg-white` ⇒ κόκκινο).
  · `settings/company/OrgStructureTab.tsx`: εικονίδια σε `bg-card` με `hover:text-white hover:bg-white/10` ⇒ στο **φωτεινό** θέμα λευκό
    σε σχεδόν λευκό (`--card` 95%). → `hover:bg-accent hover:text-accent-foreground` (= SSoT `BUTTON_ACCENT_HOVER`).
  · `admin/pages/EnterpriseMigrationPageContent.tsx`: τερματικό `bg-black` κάτω από **θεματικό** `--text-success` ⇒ φωτεινό θέμα
    `#0F6C31` σε μαύρο ≈ **3,2:1** (< AA). → `bg-background border` (ζεύγος μετρημένο στο ADR-770 §18).
  **Δεν άλλαξαν, σκόπιμα**: `DesktopMultiColumn` ×4 · `BuildingSpacesTabs` (`bg-white dark:bg-card` — `darkMode: class` ⇒ σωστό και στα
  δύο· το `bg-card` θα άλλαζε το φωτεινό σε γαλάζιο = σχεδιαστική απόφαση Giorgio) · `ShowcaseHeader.tsx` (το είχε άλλη συνεδρία).
  **Νεκρός κώδικας**: `styles/design-tokens/components/user-type.ts` (`bg-white` ×3) — **κανένας** καταναλωτής πέρα από το re-export
  (grep με θετικό έλεγχο) ⇒ υποψήφιο για διαγραφή.
  ⏳ **Μένουν**: βήμα (1) πύλη — `scripts/check-tailwind-palette-ratchet.js` + `scripts/lib/contrast/*` τα είχε **άλλη συνεδρία** (30/10)·
  πρόταση: η πύλη να κρίνει **μίξη** (θεματικό κείμενο ∧ σταθερό συμπαγές `bg-white|black` στο ίδιο ή στον πρόγονο), όχι κάθε `bg-white`
  — το 90% είναι νόμιμο· βήμα (2) token `--paper` για τις «χάρτινες» επιφάνειες.

### 📧 Τρεις αναγνώστες «κύριο email επαφής» — `getPrimaryEmail` ≡ `getContactEmail` ≡ inline `resolveCustomer` (προτεραιότητα ΧΑΜΗΛΗ, 2026-10-27, ADR-923 §5.11 «3γ» Βήμα 3 · N.0.2)
- **Τι**: η ίδια ερώτηση «ποιο είναι το κύριο email της επαφής;» απαντιέται τρεις φορές, με **διαφορετική σειρά**: `getPrimaryEmail` (`types/contacts/helpers.ts:100`, πίνακας `emails[]` πρώτα, μετά τα legacy πεδία υπηρεσίας) · `getContactEmail` (`services/contacts/contact-name-resolver-types.ts:105`, legacy `email` **πρώτα**, 4 καταναλωτές RFQ/invites) · inline στο `resolveCustomer` (`services/sales-accounting/sales-accounting-helpers.ts:~105`). Επαφή με και `email` και `emails[]` παίρνει **άλλο** παραλήπτη ανάλογα με τη διαδρομή. Το ίδιο σχήμα και για ΑΦΜ/διεύθυνση στο `resolveCustomer` (flat `contact.address`, ενώ το μοντέλο έχει `addresses[]`).
- **Fix**: μία σειρά προτεραιότητας (κύριο του `emails[]` → πρώτο → legacy), ΕΝΑΣ αναγνώστης· το `resolveCustomer` γίνεται καταναλωτής του `extractContactParty` (όπως το `po-document-parties`).
- **Γιατί όχι τώρα**: αλλάζει παραλήπτη σε ζωντανές ροές RFQ/τιμολόγησης (εκτός εμβέλειας 3γ, και τα αρχεία RFQ τα δουλεύει άλλος agent).

### 🔌 Hooks προμηθειών με ωμό `fetch` αντί για `apiClient` — χάνονται `errorCode`, ταυτότητα, ιδεμποτία (προτεραιότητα ΜΕΣΑΙΑ, 2026-10-27, ADR-923 §5.11 «3γ» Βήμα 2 · N.0.2)
- **Τι**: το `useFrameworkAgreements` (`agreementRequest`), το `useMaterials` και το `useSupplierMetrics` καλούν `fetch('/api/procurement/…')` με χειρόγραφα URL, ενώ το `procurement-mutation-gateway` χρησιμοποιεί `apiClient` + `API_ROUTES.PROCUREMENT`. Συνέπειες:
  - το σφάλμα φτάνει ως `new Error(json.error)` ⇒ **ωμό αγγλικό μήνυμα** στη φόρμα (π.χ. άρνηση ισοπαλίας συμβάσεων), κανένα `ApiClientError.errorCode`·
  - κανένα `Idempotency-Key` στα POST.

  Επιπλέον το `runProcurementMutation` χαρτογραφεί μόνο `conflictName`/`validationName` σε status, **χωρίς** κωδικό σφάλματος.
- **Fix**:
  1. `API_ROUTES.PROCUREMENT.AGREEMENTS` / `MATERIALS` και μετάβαση των hooks σε `apiClient`.
  2. Κωδικοί σφαλμάτων (`FRAMEWORK_AGREEMENT_AMBIGUOUS` κ.λπ.) από το `runProcurementMutation` μέσω `ApiError(status, msg, code, details)`, με χαρτογράφηση σε i18n στη φόρμα, όπως το `PO_PRICING_CHANGED` του Α9.

### 👻′ Κατάλοιπα «γέμισμα = μελάνι» κατάστασης — ό,τι έμεινε ΣΚΟΠΙΜΑ εκτός (προτεραιότητα ΜΕΣΑΙΑ, 2026-10-29, ADR-770 §22.5 · N.0.2)
- **Έκλεισε η κλάση «αόρατες»** (2026-10-29): ρόλοι `getStatusBadgeVariant` · `getStatusSolidClass` · `getStatusSurfaceClass` στο `src/lib/design-system.ts`· 13/14 αρχεία διορθωμένα· ZERO-TOL `scripts/lib/contrast/same-token-fill-ink.js` μέσα στο CHECK 3.38 + άγκυρα Ο6 (`theme-token-hygiene.test.js`). Μένουν, σκόπιμα:
- **(1) `components/projects/ika/components/QrCodePanel.tsx:200`** — `getStatusColor('active','bg')` + `'text'` (+ νεκρό `bg-opacity-10`). Δεν αγγίχθηκε: αλλαγμένο από άλλη συνεδρία (ΙΚΑ QR). **Fix**: `<Badge variant={getStatusBadgeVariant('active')}>` και σβήσε τη γραμμή του από `DECLARED_OPEN_SITES` (η Ο6 θα κοκκινίσει μόνη της με «μίκρυνε τη δήλωση»).
- **(2) `--status-*` ως ΜΕΛΑΝΙ πάνω σε απλή επιφάνεια** — `getStatusColor(x,'text')` μόνο του (~25 σημεία: `ReportAgingTable` γραμμή συνόλων · `FilesList` εικονίδια · `RelationshipForm*` · `EmployeeSelector` · `ToolbarButtons` · `LiveWorkerMap` …). Μετρημένο (globals.css): success **2,02** · warning **2,77** σε κάρτα, φωτεινό. **Fix**: ρόλος μελανιού `--text-X` (`COLOR_BRIDGE.text.*`, 5,27–11,5:1)· άγκυρα στο CHECK 3.38.
- **(3) Literal `bg-[hsl(var(--status-purple))]/12` + `text-[hsl(var(--status-purple))]`** (`dashboard/QuickActionsStrip.tsx` · `dashboard/NavigationCard.tsx`) — ορατό αλλά ~2,3:1 στο σκοτεινό. Δεν υπάρχει θεματικό μελάνι purple (`--text-purple`/`--hue-purple`). **Fix**: token όπως τα `--hue-*` του ADR-770 §21, μετρημένο στα δύο θέματα.
- **(4) Ζωντανή επαλήθευση στον browser** (computed `color` ≠ `background-color`) δεν έγινε — κοινό μηχάνημα με κλείδωμα βαριών εργασιών.
- **(5) Πολλά `bg-[hsl(var(--status-warning))] text-white`** σε διαλόγους επιπτώσεων (`*ImpactDialog.tsx`, `NameChangeCascadeDialog`) — λευκό σε warning = **3,16:1**. Θεραπεία: `getStatusSolidClass('warning')` (μαύρο μελάνι 6,65). Άλλη κλάση· καταγράφεται για να μη χαθεί.
### 📐 DXF OCS (210/220/230) για CIRCLE / ARC / TEXT / MTEXT / HATCH — καθρεφτισμένα στοιχεία βγαίνουν ανάποδα (προτεραιότητα ΜΕΣΑΙΑ, 2026-10-25, ADR-635 Φ C.29 · N.0.2)
- **Τι**: το SSoT `@/lib/dxf/dxf-ocs` (arbitrary axis) υπάρχει πλέον και το χρησιμοποιούν μόνο LWPOLYLINE / 2Δ POLYLINE. Οι υπόλοιπες επίπεδες οντότητες (CIRCLE, ARC, TEXT, MTEXT-εξώθηση, HATCH, ELLIPSE, INSERT) αγνοούν τα 210/220/230 ⇒ με εξώθηση (0,0,−1) (κοινό: MIRROR στο AutoCAD) το κέντρο/σημείο εισαγωγής βγαίνει με αντίθετο X και τα τόξα με ανάποδη φορά. `dxf-point-converter.ts` το αναφέρει ρητά ως «αγνοείται».
- **Fix**: κάθε converter περνά τα OCS σημεία του από `dxfOcsToWcs` (ARC: και αναστροφή γωνιών για Az.z < 0). 6+ αρχεία σε converters + tests ανά τύπο → όχι επί τόπου (N.0.2 «4+ αρχεία»).

### 🧱 DXF VERTEX 70 flags + Z των μελών επώνυμου μπλοκ κατά το EXPLODE (προτεραιότητα ΧΑΜΗΛΗ, 2026-10-25, ADR-635 Φ C.29)
- **Τι (α)**: `dxf-polyline-vertex-collector` παίρνει ΚΑΘΕ VERTEX ως κορυφή — οι εγγραφές προσώπου polyface mesh (POLYLINE 70 bit 64, VERTEX 70 = 128) και τα σημεία ελέγχου spline-fit (VERTEX 70 bit 16) θα έπρεπε να παραλείπονται. **(β)**: τα επώνυμα μπλοκ μένουν `BlockEntity`· η τοποθέτηση Z (`withPlacedElevation`, INSERT 30/43 − BLOCK 30) εφαρμόζεται μόνο στον δρόμο διάλυσης `*X`/`*D` — όταν ο χρήστης κάνει EXPLODE, τα μέλη κρατούν το τοπικό Z.
- **Fix**: (α) διάβασε το VERTEX 70 στον collector και φίλτραρε· (β) το EXPLODE του `systems/block` να καλεί το ίδιο `withPlacedElevation` (χρειάζεται `baseZ` + insert Z στο `BlockEntity`).

### 📅′ Κατάλοιπα του κριτή «ημερολογιακή ημέρα» — ό,τι έμεινε ΣΚΟΠΙΜΑ εκτός (προτεραιότητα ΧΑΜΗΛΗ, 2026-10-29, ADR-919 · N.0.2)
- **SSoT**: `lib/date/calendar-day.ts` (`isCalendarDay` · `parseCalendarDay` · `calendarDayExists` · `hasCalendarDayShape` · `isoCalendarDay`) + `lib/date/calendar-day-schema.ts` (`calendarDaySchema`). Νέος καλών ⇒ από εκεί, ποτέ regex.
- **Catalog (ADR-923, άλλη συνεδρία — ρώτα πρώτα)**: `subapps/catalog/schema/zod/attribute.schema.ts` (`isoDateSchema` = σκέτο regex ⇒ δέχεται `2027-02-30`) · `subapps/catalog/schema/validate-attribute-value.ts` · `subapps/catalog/values/value-text-codec.ts` (δικό τους `ISO_DATE`). Μετάβαση σε `calendarDaySchema` / `parseCalendarDay`.
- **Πρόθεμα χωρίς `$` — άλλη ερώτηση, ΟΧΙ ενοποίηση**: `audit-value-resolver.formatIsoDate` · `ContactIdentityImpactDialog` (μορφοποίηση εμφάνισης). *(Το `payment-plan` `dueDate` έκλεισε 2026-10-29 — βλ. Changelog.)*
- *(Έκλεισαν 2026-10-29 — βλ. Changelog: «τελευταία ημέρα μήνα» → `daysInMonth` · λήξη δόσης = ημέρα · QR παρουσιών σε ημέρα Αθήνας · «σήμερα» σε UTC (9 σημεία) · μία ζώνη Ελλάδας + συμβόλαιο `athensClockAt`/`calendarDayOf` · `report-date-utils` σε κλειδιά ημέρας.)*
- **Μένει από το «σήμερα»**: `construction-scheduling/cpm-calculator.ts` `emptyResult.projectEarlyFinish` (θέση κενού/άκυρου αποτελέσματος — αν ποτέ εμφανιστεί, `calendarDayOf`) · ονόματα αρχείων εξαγωγής `…-${nowISO().slice(0,10)}` (αβλαβή).
- **Backfill λήξεων δόσεων** (ADR-234, 2026-10-29): οι παλιές `Installment.dueDate` είναι ISO στιγμές· οι αναγνώστες τις διαβάζουν σωστά (`installmentDueDay`), αλλά η βάση έχει ανάμεικτες μορφές. ✅ **Το script είναι έτοιμο** (`npm run backfill:installment-due-day`, `scripts/migrations/backfill-installment-due-day.ts` — dry-run εξ ορισμού, ιδεμποτικό, `lastUpdateTime` ανά πλάνο). ⏳ **Μένει μόνο η εκτέλεση = εγγραφή στη βάση ⇒ απόφαση Giorgio**: πρώτα dry-run (μέτρηση + μη αναγνώσιμα), μετά `--execute`. Μετά: να φύγει η μεταβατική ανοχή στιγμής του `installment-due-date.ts` (+ το test «παλιά στιγμή UTC»).
- **Δύο ονόματα, ένας κανόνας**: το `isDateKey` (`lib/calendar/date-key.ts`, 28 καταναλωτές) καλεί πλέον το `isCalendarDay`. Αν συγκλίνουν σε ένα όνομα ⇒ μηχανική μετονομασία, όχι αλλαγή συμπεριφοράς.

### 🔗 Σκόρπιοι σύνδεσμοι/μητρώα διευθύνσεων οντοτήτων → SSoT (προτεραιότητα ΜΕΣΑΙΑ, 2026-10-22, ADR-242 · N.0.2)
- ✅ **Έκλεισαν (Βήμα 2)**: `ProjectHealthTable` (κλικ γραμμής → σύνδεσμος στο όνομα) · `RfqDetailClient` · `BackToProjectLink` · `audit-timeline-entry` `buildEntityHref` (όλοι οι τύποι → `ENTITY_ROUTES` + `getProjectUrl`). SSoT κλάσης: `TABLE_CELL_LINK_CLASS` (`lib/ui/link-style.ts`).
- **Μένουν**:
  - `config/search-index-core.ts` `routeTemplate: '/projects/{id}'` (+ `/buildings/{id}`, `/contacts/{id}`, `/parking/{id}`, `/storage/{id}`): η διεύθυνση **αποθηκεύεται** στα έγγραφα ευρετηρίου ⇒ αλλαγή = backfill = **εγγραφή στη βάση** (απόφαση Giorgio). Τα redirects δουλεύουν, άρα δεν είναι σπασμένο, μόνο ένα άλμα παραπάνω.
  - `config/report-builder/domain-definitions.ts` `entityLinkPath` + `components/reports/builder/ReportResults.tsx` (κλικ σε γραμμή με `router.push`).
  - `services/navigation/ContextualNavigationService.ts`: **τρίτο** μητρώο διαδρομών οντοτήτων (δικό του `ENTITY_ROUTES`, `basePath`+`parameterKeys`). Ενοποίηση με `lib/routes/entityRoutes.ts` + `project-urls.ts`.
  - Boy Scout: τα `ENTITY_ROUTES.contacts.withId` / `spaces.parking` / `spaces.storage` δεν κάνουν `encodeURIComponent` (τα `buildings`/`properties` κάνουν). 20+ καταναλωτές ⇒ χωριστό βήμα.
  - `subapps/procurement/hooks/useRfqUrlState.ts` (Βήμα 3, 2026-10-22): καρτέλα/προσφορά/συρτάρια με `router.push`/`replace` πάνω σε **στιγμιότυπο** `useSearchParams` — (α) κάθε αλλαγή καρτέλας **γεμίζει το ιστορικό** (push), (β) γύρος στον router ανά κλικ, (γ) το στιγμιότυπο μπορεί να σβήσει κλειδί που γράφτηκε με `replaceState`. SSoT: `useActiveUrlTab` (`hooks/useUrlTabParam.ts`) για την καρτέλα + `replaceUrlSearchParams`/`useUrlQuery` για τα υπόλοιπα. **Εξαίρεση προς διατήρηση**: η επιλογή προσφοράς στο **κινητό** κάνει σκόπιμα push (το «πίσω» γυρίζει στη λίστα, §5.E.4) ⇒ θέλει τεκμηριωμένο `pushUrlSearchParams` στο `url-query-state`, όχι `router.push`.
- **Ρητά ΟΧΙ αλλαγή**: `subapps/dxf-viewer/.../title-block-fingerprint.ts` (το QR της πινακίδας τυπώνεται ⇒ το `/projects/{id}` είναι σκόπιμο σταθερό permalink) · `lib/navigation/procurement-urls.ts` (άλλη διαδρομή). **ΜΗΝ** προσθέσεις `projects` στο `ENTITY_ROUTES` — δεύτερο SSoT.

### 🖱️ Εκστρατεία «row link» — 13 αρχεία με `onClick` σε `<tr>`/`TableRow` (προτεραιότητα ΜΕΣΑΙΑ, 2026-10-22, ADR-242 · N.0.2)
- **Περιστατικό**: γραμμές που πλοηγούν/επιλέγουν με `onClick` χωρίς `href`: `components/procurement/shared/procurement-table-parts.tsx` (`ProcurementRowLink`, 4 καταναλωτές) · `components/reports/core/ReportTable.tsx` (`onRowClick`: `ReportResults`, `ComparisonPanel`, `RfqDetailClient` drill-down) · `ReportAgingTable` · `GroupedTreeGrid` · `construction/portfolio/PortfolioTable.tsx` (→ κτίριο) · `sales/payments/ChequeTable.tsx` · accounting (`InvoiceRow`, `TransactionsPanel`, `MatchingPanel`, `APYCertificatesList`) · `admin/bim-diagnostics/DiagnosticsList.tsx`.
- **Έρευνα** (Roselli «Don't Turn a Table into an ARIA Grid…» 2023, ενημ. 2026 · GOV.UK table · Agriculture DS · GitHub): ποτέ click handler στο `<tr>`, ποτέ `role=grid` για αυτό. **Ένας** πραγματικός `<a>`/`<button>` στο κύριο κελί (`th scope=row`). Αν θέλεις όλη τη γραμμή: `::after { position:absolute; inset:0 }` στον σύνδεσμο + `position:relative` στο `<tr>` (WebKit το διόρθωσε 04/2026, Chrome/Firefox OK). **Όχι** stretch όταν η γραμμή έχει κι άλλα controls (ή `relative z-10` σε αυτά). Φύλακας επιλογής κειμένου (Heydon Pickering, Cards).
- **Fix**: ΕΝΑ SSoT εξάρτημα/κλάση (π.χ. `STRETCHED_LINK_CLASS` στο `lib/ui/link-style.ts`, που ήδη επαναλαμβάνεται ως literal στα `ListingCard`, `ListingMapPopup`, `PropertyCard`) + μετάβαση ανά αρχείο. Οι γραμμές **επιλογής** (accounting matching) θέλουν `<button>`/checkbox, όχι σύνδεσμο. 13 αρχεία, 5+ περιοχές ⇒ N.8.

### 🗂️ Ετικέτες πράξεων ιστορικού αρχείου — ΚΑΜΙΑ από τις ~45 `FileAuditAction` δεν έχει κλειδί i18n (προτεραιότητα ΜΕΣΑΙΑ, 2026-10-20, ADR-916 Φ-Γ1 · N.0.2)
- **Περιστατικό**: το `AuditLogPanel` αποδίδει `t(\`audit.action.${entry.action}\`, entry.action)` — **ωμή εφεδρεία** με το ίδιο το κλειδί. Μετρημένο: το `files.json` (el/en) έχει `audit.{title, noEntries, file*}` αλλά **κανένα** `audit.action.*` ⇒ ο άνθρωπος βλέπει `storage_relocate`, `cde_supersede`, `handover_receive` αυτολεξεί. Το CHECK 3.97 το κρύβει επειδή η εφεδρεία δεν είναι literal.
- **Fix**: κλειστός χάρτης `Record<FileAuditAction, string>` (όπως `ACTION_ICON_MAP`, ώστε νέα πράξη χωρίς ετικέτα **να μη μεταγλωττίζεται**) + ~45 κλειδιά el/en + αφαίρεση της εφεδρείας. 2 locale + 1 component, αλλά ~45 μεταφράσεις ⇒ >1h.

### 🧾 Αναγνώστες του deprecated `soldTo` — ~18 αρχεία δεν βλέπουν πωλήσεις γραμμένες μόνο σε `commercial.owners` (προτεραιότητα ΜΕΣΑΙΑ, 2026-10-19, ADR-244 · N.0.2)
- **Περιστατικό**: η ροή πώλησης γράφει `commercial.owners[]` + `ownerContactIds[]` (ADR-244), **όχι** `soldTo` ⇒ η καρτέλα «Πελάτες» έργου ήταν κενή για πουλημένη μονάδα. Διορθώθηκαν **μόνο** τα δύο endpoints «Πελάτες» (έργου + κτιρίου).
- **SSoT**: `lib/ownership/owner-utils.ts` → `isStoredPropertySold` · `readStoredBuyerContactIds` (owners χωρίς οικοπεδούχους, `soldTo` μόνο αν δεν υπάρχουν owners) · `countSoldPropertiesPerBuyer`.
- **Μένουν**: `api/contacts/[contactId]/properties/route.ts`, `lib/contacts/owner-property-stats.ts`, `api/notifications/professional-assigned/hierarchy-resolver.ts` (έχει δικό του fallback — να γίνει κλήση SSoT), `api/properties/property-link-sold.handler.ts`, `components/properties/tabs/PropertyCustomerTab.tsx`, `components/shared/customer-info/components/PropertyCustomerDisplay.tsx`, `components/projects/structure-tab/parts/PropertyNode.tsx`, `features/property-details/PropertyDetailsContent.tsx`, `hooks/property-viewer-selection.ts`, `hooks/reports/useExecutiveReport.ts`, `services/properties.service.ts`· mappers/normalizers (`firestore-mappers.ts`, `property-normalizer.ts`) αγγίζονται τελευταίοι.
- ⚠️ Οι client αναγνώστες κρατούν τυπωμένο `Property`, όχι ωμό record — χρειάζεται typed παραλλαγή του SSoT, όχι cast.
- **Νεκρός δίδυμος**: `api/v2/projects/[projectId]/customers/*` (PostgreSQL, `u.sold_to`) — κανείς δεν τον καλεί (`API_ROUTES.PROJECTS.CUSTOMERS` → v1). Υποψήφιος διαγραφής, απόφαση Giorgio.

### 👤 Χειροποίητα `Avatar` + `AvatarFallback` — 7 οθόνες εκτός του `EntityAvatar` (προτεραιότητα ΧΑΜΗΛΗ, 2026-10-18, ADR-190 §Display · N.0.2)
- **SSoT**: `EntityAvatar` (`design-system/primitives/Avatar/`) — σχήμα από `kind`, μονόγραμμα AA (`monogram-tone.ts`), `<img>` lazy μέσω `identityImageSource` (μικρογραφία από optimizer).
- **Μένουν** (κάθε μία με δικό της fallback): `components/admin/role-management/components/UserTable.tsx` (χρώμα = **άθροισμα χαρακτήρων** ⇒ αναγραμματισμοί συγκρούονται· παλέτα με επαναλήψεις + `bg-destructive`), `components/shared/customer-info/components/{CustomerInfoCompact,UnifiedCustomerCard}.tsx`, `components/crm/pages/CrmTeamsPageContent.tsx`, `components/header/user-menu.tsx`, `components/network-messaging/AudienceRosterPanel.tsx`, `app/(app)/o/[workspace]/account/layout.tsx`.
- **Δεύτερη υλοποίηση αρχικών**: `components/network-messaging/thread-labels.ts` `initialsOf` — κρατά τόνους («ΆΤ») και παίρνει πρώτη+**τελευταία** λέξη, ενώ το `getInitials` (ADR-209) πρώτη+δεύτερη. ⚠️ Ορατή αλλαγή — απόφαση Giorgio.
- **Στρώση**: το `getInitials` ζει στο `types/contacts/helpers.ts` αλλά είναι γενικό· το `EntityAvatar` το εισάγει από εκεί. Μετακίνηση σε `lib/text/initials.ts` (5+ καταναλωτές).
- ⚠️ Τα avatar χρηστών (`user.photoURL` της Google, `lh3.googleusercontent.com`) **δεν** είναι στον κάδο ⇒ το `identityImageSource` τα περνά αυτούσια. Για μικρογραφία εκεί: η Google δέχεται `=s96-c` — **δεύτερη** γραμμή στο `remote-image-sources.json`, όχι κώδικας ανά οθόνη.

### 🪟 Κάρτα μέσα στην κάρτα λεπτομερειών — οι υπόλοιπες καρτέλες εκτός αρχείων (προτεραιότητα ΧΑΜΗΛΗ, 2026-10-17, ADR-912 §12.14 · N.0.2)
- **SSoT**: `NESTED_IN_DETAILS_FLUSH` / `NESTED_IN_DETAILS_FLUSH_SECTION` (`core/containers/DetailsContainer.tsx`). Στο κινητό, μέσα σε `[data-details-flush]`, η κάρτα χάνει πλαίσιο, σκιά, φόντο και `px`.
- **Εφαρμόστηκε ΜΟΝΟ** στην κάρτα του `EntityFilesManager` (όλες οι καρτέλες αρχείων).
- **Μένουν**: όσες καρτέλες μέσα στο `DetailsContainer` ζωγραφίζουν δική τους `<Card>` (π.χ. Πληροφορίες / Αγγελία / Αντικειμενική ακινήτου, καρτέλες κτιρίου και έργου). Εύρεση: `grep -rln "<Card" src/features/properties-sidebar src/components/building-management/tabs src/components/projects/tabs`.
- **Πώς**: `className={cn(…, NESTED_IN_DETAILS_FLUSH)}` στην `Card` και `NESTED_IN_DETAILS_FLUSH_SECTION` στα `CardHeader` / `CardContent`. ⛔ Όχι αρνητικά περιθώρια (CHECK 3.63).

### 🏷️ `Property.project` / `.building` — ψευδοκάτοπτρα που ΔΕΝ γράφονται, ~20 αναγνώστες· + ~12 χειρόγραφα `projects.find(...)?.name` (προτεραιότητα ΜΕΣΑΙΑ, 2026-10-15, ADR-840 §7.6 · N.0.2)

- **Τι**: ο τύπος `src/types/property-viewer.ts` δηλώνει `project: string` / `building: string` ως **υποχρεωτικά**, αλλά το έγγραφο Firestore έχει **μόνο** `projectId` / `buildingId` (μετρημένο σε `properties/prop_a0000001-…`). Κάθε αναγνώστης τους δείχνει **κενό** σιωπηλά. Τα φίλτρα + οι κάρτες της «Διαθέσιμα Ακίνητα» διορθώθηκαν (ADR-840 §7.6)· μένουν οι υπόλοιποι.
- **Πού** (grep `\.(project|building)\b` σε `Property`): `property-identity-parts.tsx:73` · `UnitsPageContent.tsx:235` (αναζήτηση) · `useSalesPropertiesViewerState.ts:209` · `PropertySummaryContent.tsx:116` · `sales-dialog-utils.ts:28` · `SellDialog.tsx:105` · `LegalTabContent.tsx:75` · `PaymentTabContent.tsx:79` · `PropertyQuickView.tsx:90` · `useExecutiveReport.ts:214` · showcase (`ShowcaseClient.tsx:40`, `ShowcaseDetailSections.tsx:281`, `ShowcaseSpecs.tsx:30`, `property-showcase-email-sections.ts:55`, `PropertyShowcaseSections.ts:114`) · telegram (`search/format.ts:97`, `smart-query.ts:188`) · ai-pipeline uc-003 (`property-search-module.ts:168`, `property-search-query.ts:216`).
- **Και**: ~12 αρχεία λύνουν όνομα με χειρόγραφο `projects.find(p => p.id === x)?.name` (`PurchaseOrderDetail.tsx:63`, `NewUnitHierarchySection.tsx:89`, `useBreadcrumbSync.ts:139/201`, `TimelineTabContent.tsx:78`, `POEntitySelectors.tsx:64`, `PODeliveryAddressField.tsx:67`, `useNewObligationPage.ts:317/351` …).
- **Γιατί**: δύο πηγές για «πώς λέγεται;» — το κάτοπτρο είναι **πάντα** κενό, το χειρόγραφο `find` αντιγράφεται.
- **Fix**: client → `useHierarchyNames()` (`src/components/navigation/core/hooks/useHierarchyNames.ts`)· server (telegram/PDF/email/ai-pipeline) → επίλυση από `projectId`/`buildingId` με Admin SDK. Μετά: `project`/`building` → optional `@deprecated` ή αφαίρεση από τον τύπο.

### ↩️ Κανονικοποίηση EOL — μένει ΜΟΝΟ το `slice-build.toLf` → `scripts/lib/text-eol.js` (προτεραιότητα ΧΑΜΗΛΗ, 2026-10-14 · ενημ. 2026-10-29, ADR-744 §30 · N.0.2)
- ✅ 2026-10-29: το SSoT `scripts/lib/text-eol.js` το εισάγουν τα 4 εκτός οικογένειας + το `i18n-shell-slice/layer-one-checks.normalize` (εκτός κλειστότητας digest — μετρημένο). Άγκυρα `scripts/__tests__/text-eol.test.js`.
- **Μένει**: `scripts/lib/i18n-shell-slice/slice-build.js` (`toLf` — ήδη `\r\n?`, ίδια σημασία).
- **Γιατί όχι ακόμη**: το `slice-build` είναι είσοδος του toolchain digest (§30 — κλειστότητα `require` από το `route-slices.js`) ⇒ νέο `require` = αναγέννηση του `src/i18n/generated/shell-slice.manifest.json` **στο ίδιο commit**· στις 2026-10-29 το manifest ήταν ήδη αλλαγμένο (staged) από άλλη συνεδρία. Κάν' το όταν το `git status` δείχνει το manifest καθαρό.

### 🧾 Λογιστική: υπολογισμοί πάνω σε ΣΕΛΙΔΑ — τα υπόλοιπα μέλη της κατηγορίας (προτεραιότητα ΥΨΗΛΗ — οικονομικά νούμερα, 2026-10-14, ADR-ACC-010 §2.1.1 · N.0.2)
Έκλεισαν: εγγραφές ημερολογίου (Φάση 1)· τραπεζική συμφωνία, υποψήφια αντιστοίχισης, κλίμακα φόρου αναφορών (Φάση 2)· υπόλοιπο πελάτη / ηλικίωση / πιστωτικό όριο ως ανοιχτά στοιχεία όλων των χρήσεων (Φάση 3, 2026-10-15). Λίστες οθόνης με δρομέα keyset + κλειστό σύνολο φίλτρων + χωρίς fallback, `Χωρίς Πελάτη` (Φάση 3β, 2026-10-15). Η άγκυρα συνόρου (`journal/__tests__/journal-ledger-boundary.test.ts`) καλύπτει `listJournalEntries` · `listBankTransactions` · `listInvoices` · `listFixedAssets` (το δηλωμένο κενό των αποσβέσεων έκλεισε στη Φάση 4, 2026-10-15). **Μένουν**:
- ⏳ **Deploy δεικτών Φάσης 3** (+3: `accounting_invoices` `companyId+customer.contactId+issueDate` · `companyId+issueDate` · `accounting_customer_balances` `companyId+netBalance DESC`) — ο Giorgio **πριν** το push. Μετά, **μία** `POST /api/accounting/balances` για να ξαναχτιστούν τα αποθηκευμένα υπόλοιπα (τα παλιά γράφτηκαν «ανά χρήση» και πιθανότατα 0 €).
- ✅ **Deploy δεικτών Φάσης 3β — ΕΓΙΝΕ 2026-10-15** (`firebase deploy --only firestore:indexes`· η δημιουργία στο Firebase μπορεί να διαρκέσει λεπτά — «Enabled» στην κονσόλα πριν το push) (+6: `accounting_invoices` `companyId+fiscalYear+type+issueDate↓` · `companyId+fiscalYear+paymentStatus+issueDate↓` · `companyId+fiscalYear+paymentStatus+type+issueDate↓` · `companyId+propertyId+issueDate↓` · `accounting_bank_transactions` `companyId+direction+matchStatus+transactionDate↓` · `accounting_fixed_assets` `companyId+category+status+acquisitionDate↓`) — ο Giorgio **πριν** το push· χωρίς αυτούς οι αντίστοιχοι συνδυασμοί φίλτρων δείχνουν πλέον **σφάλμα** (όχι κενό).
- ✅ **Deploy δείκτη Φάσης 4 — ΕΓΙΝΕ 2026-10-15** (+1: `accounting_fixed_assets` `companyId+depreciationStartDate`· `firebase deploy --only firestore:indexes` πριν το push· η δημιουργία μπορεί να διαρκέσει λεπτά — «Enabled» στην κονσόλα). Χωρίς αυτόν η εκτέλεση αποσβέσεων δίνει **σφάλμα** (όχι κενό). Οι αποσβέσεις πάνω σε σελίδα **έκλεισαν** (ADR-ACC-010 §2.1.1 Φάση 4)· ο καλών της εκτέλεσης και η καταχώριση στο Βιβλίο Ε-Ε **έκλεισαν στη Φάση 5** (2026-10-15· κανένας νέος δείκτης).
- **Πρόβλεψη φόρου τρέχουσας χρήσης χωρίς προγραμματισμένες αποσβέσεις** (`tax-engine.estimateTax`): ως την εκτέλεση τέλους χρήσης η πρόβλεψη βγαίνει υψηλότερη από τον τελικό φόρο. **Απόφαση Giorgio** (αλλάζει νούμερο φόρου· SAP προβλέπει, QuickBooks όχι) — ADR-ACC-010 §2.1.1 Φάση 5 «Ανοιχτά».
- ✅ **ΚΛΕΙΣΤΟ 2026-10-30 (εκκρεμεί commit Giorgio — δες τις δύο υπο-καταχωρίσεις)** — **Κάρτες σύνοψης πάνω σε σελίδα**: `JournalPageContent` / `InvoicesPageContent` / `BankPageContent` / `AssetsPageContent` / `TransactionsPanel` (μετρητής ανοιχτών) και `AccountingDashboard` (έσοδα/έξοδα έτους + «εκκρεμή τιμολόγια» = μήκος σελίδας) αθροίζουν τις φορτωμένες γραμμές. Fix (Xero / QuickBooks): άθροισμα στον διακομιστή ανά φίλτρο (σάρωση `collect*` ή `count()`/`sum()` aggregation), ανεξάρτητο από τη σελίδα.
  - ✅ **2026-10-30 — Τιμολόγια ΥΛΟΠΟΙΗΘΗΚΑΝ (εκκρεμεί commit Giorgio)** — και το **πρότυπο για τις υπόλοιπες**: γενικό
    `scanAccountingList(tenant, spec, filters, map)` (`accounting-repo-list.ts`) = ίδιο spec/φίλτρα/ταξινόμηση/δείκτες με το
    `readAccountingListPage`, πάνω στο `scanLedger` ⇒ **κανένας νέος δείκτης**. Τιμολόγια: `collectInvoiceList` (repo · interface ·
    audited wrapper) → `summarizeInvoiceList` (`services/list-summaries/`: `isCollectibleInvoice` + `invoiceOpenAmount` — το παλιό
    μετρούσε πιστωτικά/ακυρωμένα/πιστωμένα ως ανεξόφλητα· μήνας με `accountingDayOf` = Αθήνα, όχι ώρα browser) →
    `GET /api/accounting/invoices/summary` (φίλτρα από το κοινό `_shared/invoice-list-filters.ts` — και η σελίδα το χρησιμοποιεί·
    σφάλματα φίλτρων μέσω `respondWithListRead`) → `useInvoiceListSummary` (`useAsyncData` + `buildUrl` του `useCursorPagedList`)·
    σφάλμα ⇒ «—», ποτέ «0». Άγκυρα: `list-summaries/__tests__/invoice-list-summary.test.ts` (επαληθευμένη με node στον πραγματικό
    κώδικα· jest **δεν** έτρεξε — UNC).
  - ✅ **2026-10-30 — ΚΑΙ ΟΙ ΥΠΟΛΟΙΠΕΣ ΠΕΝΤΕ ΥΛΟΠΟΙΗΘΗΚΑΝ (εκκρεμεί commit Giorgio)** — το θέμα **έκλεισε**. Γενικά, όχι ανά οθόνη
    (N.18): `_shared/list-filters.ts` (οι 4 αναγνώσεις φίλτρων, κοινές σελίδας/σύνοψης) · `_shared/list-summary-route.ts`
    (`listSummaryRoute` — κάθε `…/summary` 5 γραμμές) · `hooks/useListSummary.ts` · `components/shared/summary-stat-value.ts` («—»).
    Repo: `collectJournalEntryList` · `collectBankTransactionList` · `collectFixedAssetList` (ίδιο spec ⇒ κανένας νέος δείκτης).
    Ευρήματα που διορθώθηκαν μαζί: **Ημερολόγιο + Πίνακας Ελέγχου άθροιζαν ΜΙΚΤΑ** (ΦΠΑ ως έσοδο) ⇒ τώρα `partitionLedger` (καθαρά,
    ίδια με τις αναφορές· αντιλογισμοί = storno, μηδενίζονται)· **Πάγια**: εκποιημένα έξω από τις αξίες, αναπόσβεστη = το
    αποθηκευμένο `netBookValue`· **Πίνακας Ελέγχου**: «εκκρεμή τιμολόγια» έχαναν τα μερικώς εξοφλημένα (`unpaidCount`), σφάλμα ⇒ σιωπηλά
    μηδενικά (τώρα «—», μισή απάντηση δεν μπαίνει στο stale cache)· **Συμφωνία**: ο μετρητής «χωρίς αντιστοίχιση» = σύνοψη με
    `matchStatus=unmatched` (ήταν οι ανοιχτές της φορτωμένης σελίδας ΤΟΥ ΦΙΛΤΡΟΥ). Άγκυρες: `ledger-list-summaries.test.ts`.
    ⚠️ Οι τίτλοι καρτών «Σύνολο Εσόδων/Εξόδων» δείχνουν πλέον **καθαρά** ποσά — αν θέλεις τη λέξη «(καθαρά)» στο κείμενο, είναι αλλαγή i18n.
  - ✅ **2026-10-30 — μετά από read-only έλεγχο άλλης συνεδρίας**: (1) `useListSummary`: το `useAsyncData` σε σφάλμα ΚΡΑΤΑ
    την προηγούμενη απάντηση ⇒ αποτυχία μετά από αλλαγή φίλτρου έδειχνε τα ποσά του ΠΑΛΙΟΥ φίλτρου· τώρα σφάλμα ⇒ `data = null`
    («—»). Το κοινό `useAsyncData` ΔΕΝ άλλαξε (άλλοι καταναλωτές). (2) `AccountingDashboard`: `callIdRef` (μόνο η τελευταία
    κλήση γράφει) + seed από την cache του ΝΕΟΥ έτους ή κενά + spinner (όχι τα stats του προηγούμενου έτους). Άγκυρες:
    `_shared/__tests__/list-summary-route.test.ts` (σύνοψη ανεξάρτητη από `pageSize`/`cursor` · 400 με τον κωδικό της σελίδας ·
    500 ποτέ «0») · `accounting-list-index.test.ts` Σ-1..3 (ο ΠΡΑΓΜΑΤΙΚΟΣ `build` της `scanAccountingList` ⇒ δείκτης για κάθε
    συνδυασμό, σχήμα ≡ σελίδας, χωρίς `.limit`, άρνηση πριν από τη βάση).
    ✅ **jest ΕΤΡΕΞΕ στην τελική μορφή** (2026-10-30 ~14:00, άλλη συνεδρία, UNC): `accounting-list-index` ·
    `ledger-list-summaries` · `invoice-list-summary` · `list-summary-route` — 4/4 σουίτες, 68/68 tests.
    **Μένουν (ανοιχτά, ΧΑΜΗΛΗ)**: (α) πύλη AST κατά `reduce`/`.length` πάνω σε `items` λίστας μέσα σε stats οθόνης λογιστικής
    (`scripts/` — όταν ελευθερωθεί από την άλλη συνεδρία)· (β) κόστος: κάθε άνοιγμα/αλλαγή φίλτρου σαρώνει ΟΛΗ την εμβέλεια
    (τράπεζα χωρίς φίλτρο = όλο το ιστορικό) — ο μετρητής «χωρίς αντιστοίχιση» της Συμφωνίας μπορεί να γίνει `count()`
    aggregation (~1 read/1000)· για τα ΠΟΣΑ η σάρωση μένει (το `sum()` δεν εκφράζει `|amount|`, `isCollectibleInvoice`, καθαρά).
- ✅ **2026-10-30 — `CreateAPYCertificateDialog` ΥΛΟΠΟΙΗΘΗΚΕ (εκκρεμεί commit Giorgio)**: ο υπολογισμός ζει στο
  `services/apy/apy-certificate-draft.ts` (`collectInvoices` πελάτη ως `31/12` + `isWithholdingCertifiable`: όχι πιστωτικό ·
  όχι `void` · όχι πιστωμένο — ο παλιός φίλτρος έπιανε μόνο το πρώτο· συντελεστής που λείπει **παράγεται**, όχι `?? 20`).
  `GET /api/accounting/apy-certificates/draft` (προεπισκόπηση, `API_ROUTES…APY_CERTIFICATES.DRAFT`) + το `POST` τρέχει τον
  **ίδιο** υπολογισμό και αγνοεί ποσά/στιγμιότυπα από το σώμα (σχήμα: `fiscalYear` · `customerId` · `notes`). Διάλογος: επιλογή
  **επαφής** (`ContactSearchManager`), όχι ελεύθερο ΑΦΜ· `useAPYCertificateDraft` (`apiClient`, προστασία από παλιά απάντηση).
  Άγκυρες: `services/apy/__tests__/apy-certificate-draft.test.ts` + `apy-certificates.route.test.ts` (POST). ⚠️ jest **δεν**
  έτρεξε (DESKTOP-D4AT022 / UNC) — λογική επαληθευμένη με node type-stripping· ✅ **έτρεξαν στον giorgio-pc 2026-10-30: 2 σουίτες / 18 tests PASS**.
  **Ανοιχτά (απόφαση Giorgio)**: (α) η χρήση κρίνεται από το `fiscalYear` του **τιμολογίου** (ADR-ACC-020)· ο ΚΦΕ άρθρ. 64
  παρακρατεί κατά την **πληρωμή** — τιμολόγιο Δεκεμβρίου πληρωμένο Ιανουάριο ανήκει στη βεβαίωση του επόμενου έτους·
  (β) τιμολόγια με πελάτη χωρίς `customer.contactId` (χειρόγραφη καταχώριση) δεν φαίνονται — ο δείκτης είναι ανά επαφή.
- ✅ **2026-10-30 — Εξαγωγή αναφορών i18n ΥΛΟΠΟΙΗΘΗΚΕ (εκκρεμεί commit Giorgio)**: `flattenReportForExport(type, data, t)` με κλειδιά
  `reports.metrics.*` / `reports.table.*` / `reports.exportDocument.*` (el + en)· στήλες με **ρόλο** + γραμμές με **μορφή** (`cellFormatOf`)
  ⇒ διορθώθηκαν μαζί: Υπόλοιπο ισοζυγίου / Σύνολο ηλικίωσης που έβγαιναν «%», πλήθη σε €, και οι **μετατοπισμένοι κάδοι ηλικίωσης**
  (τώρα 6 κάδοι 1:1 με `AgingBuckets`). Άγκυρα `services/export/__tests__/report-table-adapter.test.ts` (17 PASS).
  ⚠️ Για το commit: `generate:i18n-types:index` + `generate:i18n-shell-slice:index` (νέα κλειδιά locale — δεν τρέχουν από UNC).
  **Μένει (εκτός εμβέλειας)**: οι ετικέτες κατηγοριών/κινήσεων (`cat.label`, `item.label`) έρχονται από τον διακομιστή ως κείμενο — όχι κλειδιά.
- ✅ **2026-10-30 — Δρομέας keyset: ΕΚΛΕΙΣΕ (εκκρεμεί commit Giorgio, claude-6e)**. Το SSoT `lib/admin-keyset-page.ts` δέχεται πλέον
  `kind: 'timestamp'` (Firestore `Timestamp` ↔ `δευτ.νανοδευτ.` χωρίς απώλεια· το `'string'` ρητό ≡ απόν ⇒ οι δρομείς της λογιστικής
  **δεν** άλλαξαν αποτύπωμα) · `map(data, id)` · `InvalidPageTokenError.code`.
  · `api/admin/role-management/audit-log` → `readKeysetPage` (το `audit_logs` **έχει TTL** — σβησμένη γραμμή-δρομέας γύριζε στην πρώτη
    σελίδα)· `limit=abc` ⇒ 400 (ήταν NaN ⇒ 500)· άκυρη ημερομηνία ⇒ 400 (αγνοούνταν)· `dateTo` `<` επόμενη ημέρα (ήταν `<=`).
  · **ΝΕΟ ΕΥΡΗΜΑ** `api/audit-trail/[entityType]/[entityId]` (δεν ήταν στη λίστα): ίδιο `doc(cursor).get()` ⇒ άγκυρα ανύπαρκτη / άλλης
    οντότητας / άλλης εταιρείας ⇒ 400 `INVALID_PAGE_TOKEN`. Η άγκυρα **μένει id** (τη δίνει η ζωντανή συνδρομή του `useAuditFeed`)·
    το `startAfter(snapshot)` χειρίζεται ήδη σωστά τις ισοπαλίες (σιωπηρό `__name__`).
  · 🔴 `api/audit-trail/global` — **ήταν σπασμένο**: `.limit(500)` χωρίς `orderBy` (500 τυχαίες, όχι οι νεότερες) + ο πελάτης έστελνε
    **id** ως `offset` ⇒ NaN ⇒ κενή σελίδα + `hasMore:false` ⇒ η ουρά πέρα από τις 30 ζωντανές **δεν φαινόταν ποτέ**. Τώρα άγκυρα id +
    `orderBy(timestamp↓)` (δείκτης `(companyId, timestamp↓)` υπάρχει — **κανένας νέος**) + σάρωση σε παρτίδες 100 ως `limit+1`
    ταιριαστές ή 1000 έγγραφα (`hasMore` μετριέται· ο δρομέας = τελευταία καταναλωμένη ⇒ κανένα κενό). Νέο SSoT φίλτρων
    `lib/audit/global-audit-filter.ts` για ζωντανό παράθυρο **και** ουρά (διέφεραν: `performedBy` ακριβές uid vs υποσυμβολοσειρά —
    το πεδίο είναι ελεύθερο κείμενο ⇒ με όνομα το ζωντανό ήταν άδειο· `toDate` απέκλειε όλη την ημέρα στον πελάτη).
    `useGlobalAuditTrail`: `offset` → `startAfter` (το χαρακτηριστικό test κατοχύρωνε το λάθος — ενημερώθηκε).
  · `thread-directory.ts`: **δεν μετακομίζει** — είναι ήδη σωστό keyset (τιμές, tie-breaker, `limit+1`)· collection-group με
    tie-breaker `DocumentReference` που το SSoT δεν εκφράζει, και το «δέσιμο στα φίλτρα» δεν προσθέτει τίποτα (`uid` από ταυτότητα).
  Άγκυρες: `admin-keyset-page.test.ts` (Κ-T1..T6) · `audit-log.route.test.ts` · `entity-audit-page.route.test.ts` (μετάλλαξη: χωρίς τον
  έλεγχο άγκυρας ⇒ 3 κόκκινα) · `global-audit-tail.route.test.ts` · `global-audit-filter.test.ts`.
  **Ανοιχτά**: (α) όρια ημέρας σε **UTC** (ιστορικό ρόλων + global) — η ημέρα Αθήνας θέλει SSoT· το `athensDateRangeToUtc`
  (`lib/date/quarter-helpers`) υπολογίζει την αλλαγή ώρας με `new Date(y, m, 0)` = ζώνη του **server** ⇒ όχι αξιόπιστο ως έχει·
  (β) `LIST_ERROR_CODES.INVALID_PAGE_TOKEN` (λογιστική) να διαβάζει το `InvalidPageTokenError.code` — το αρχείο το είχε άλλη συνεδρία·
  (γ) dedup service+cdc ανά παρτίδα: ζεύγος που πέφτει στο όριο δύο παρτίδων/σελίδων δεν συμπτύσσεται (ίδιο όριο με το ζωντανό
  παράθυρο)· (δ) `audit-log/export` (role-management) κόβει σιωπηλά στα `MAX_EXPORT_ROWS` — δεν ελέγχθηκε.
- Φόρος 2026: οι μειώσεις του ν.5246/2025 ανά πρόσωπο (ηλικία ≤ 30, τέκνα) δεν μοντελοποιούνται — χρειάζονται στοιχεία φορολογουμένου. Τέλος επιτηδεύματος ελευθέρων επαγγελματιών: καταργήθηκε από το 2025 κατά τον Τύπο — το `tax-config` κρατά 650 € (επαλήθευση με ΦΕΚ πριν από αλλαγή).

### 🔍 Γραμμές zoom κάτοψης/φύλλου λεπτομέρειας — `disabled`/`title=`/`style=` αντί του κοινού `ViewerToolbarButton` (προτεραιότητα ΧΑΜΗΛΗ, 2026-10-05, ADR-899 §9 θέμα 3 · ADR-187 · N.0.2)
- **Τι**: το θέμα 3 έκανε το `useZoomPan` τον ΕΝΑ pan/zoom και έβγαλε κοινό κουμπί θεατή (`shared/media/viewer/ViewerToolbarButton`: tooltip, `aria-disabled` που κρατά την εστίαση). Δύο γραμμές zoom μένουν χειρόγραφες:
  `FloorplanGalleryZoomControls.tsx` (`disabled` στα όρια ⇒ η εστίαση πετιέται στο `<body>`) · `DetailSheetDialog.tsx` (`disabled` + `title=` — CHECK 3.23 — + `style=` transform, N.3· ο `contentRef` του hook δεν ταιριάζει αυτούσιος γιατί κλιμακώνει `zoom / renderScale`).
- **Fix**: `ViewerToolbarButton` στα κουμπιά· για το transform του φύλλου, `viewTransformOf` (`zoom-pan-math`) εφαρμοσμένο imperative.
- **Σκόπιμα ΕΚΤΟΣ**: `PdfCanvasViewer` — έγγραφο με κύλιση και re-render σελίδων, άλλο μοντέλο από το `useZoomPan`.

### 🔐 AI: τα εργαλεία αρχείων δεν περνούν από το φίλτρο εμβέλειας CDE (προτεραιότητα ΥΨΗΛΗ — ασφάλεια, 2026-10-31, ADR-901 Φ2 · ADR-257 · ADR-862 — το πήρε ο claude-89)
- **Μετρημένο**: **κανένας** αναγνώστης CDE μέσα στο `services/ai-pipeline/` (0 για `readContainerState` / `isContainerVisible`). Το KB ήταν ο μικρότερος δρόμος: διέρρεε ύπαρξη· οι παρακάτω διαρρέουν **περιεχόμενο**.
- `file-delivery-handler.ts` (`resolveFile`): στέλνει το `downloadUrl` σε πελάτη μόνο με έλεγχο ακινήτου/έργου ⇒ **WIP αρχείο φεύγει στο chat**.
- `document-reader-handler.ts` (`read_document`): μόνο έλεγχος μισθωτή, καμία εμβέλεια πελάτη. Το `agentic-path-executor` δίνει **όλα** τα εργαλεία σε κάθε χρήστη ⇒ ⏳ να επαληθευτεί ζωντανά αν φτάνει σε πελάτη, και τότε διαβάζει οποιοδήποτε αρχείο της εταιρείας με γνωστό id.
- `firestore-handler.ts` (`query` / `get_document` / `count` σε `files`): μεταδεδομένα WIP (όνομα, κατάσταση) στον πελάτη. Το φίλτρο είναι μόνο κατά `propertyId`.
- **Fix**: ο **ΕΝΑΣ** κριτής (`decideEngagedEvidenceReach`), όχι τρίτο αντίγραφο του `reaches()`.

### 🧪 `conveyance-engagement-flow.test.ts` — ωρολογιακή βόμβα (προτεραιότητα ΧΑΜΗΛΗ, 2026-10-31)
- Το test «Procore Save & Send Invitation» έχει παγωμένο `NOW = 2026-10-03` στην έκδοση πρόσκλησης, ενώ η ανάγνωση κρίνει με το πραγματικό ρολόι ⇒ `expired` αντί `pending` από όταν πέρασε η λήξη. Κόκκινο **ανεξάρτητα** από κώδικα (μετρημένο: ίδιο αποτέλεσμα χωρίς την αλλαγή του 31/10). Fix: `nowMs` στο `listCaseProfessionalSlots` ή πάγωμα ρολογιού στο test.

### 🏢 Όροφος: ✅ ετικέτα/parser/λεξιλόγιο (2β.1α) + φιλοξενία σε όροφο (2β.1β) + δήλωση/αγγελία/μονάδα (2β.2) + εύρος στάθμης στη ζήτηση (2β.3) — ADR-903, 2026-10-03 — ⏳ μένουν: μετανάστευση δεδομένων (εντολή Giorgio) · τύποι `Floor*` · αναζήτηση/φίλτρο ακινήτων (προτεραιότητα ΜΕΣΑΙΑ · N.0.2)
- ✅ **Έγινε (2β.1α)**: `FloorRef` · `parseLegacyFloor` · `formatFloorRef` (`useFloorLabel` / `floorLabelIn`) · `FloorKind` +4 · καταργήθηκαν `formatFloorLabel`/`formatFloorString`/`generateAutoLongName` + 8 χειρόγραφα · φρουρός `lib/floor/__tests__/no-hand-floor-labels.test.ts`.
- ✅ **Έγινε (2β.1β, ADR-903 §6)**: `floorId` αυθεντία + αντίγραφο `floor`/`floorKind` (server) σε ακίνητα/θέσεις/αποθήκες · cascade αναρίθμησης · ένας επιλογέας/μία πηγή · φίλτρο από τα δεδομένα · διαγράφηκαν `PARKING_FLOOR_LABELS`/`standardFloors`/`building.floors.*`/`parseFloorLevel` · seed σε αριθμούς · `parking-showcase/labels` στο `parking.json`.
- ⏳ **Μετανάστευση δεδομένων**: `npm run migrate:hosted-floor-ref` (ξηρό) → αναφορά στον Giorgio → `--apply` **μόνο με εντολή του**· μετά `--verify` (exit 0 = κανένα αντίγραφο σε απόκλιση).
- ⏳ **Ευρετήριο αναζήτησης**: το στατιστικό `floor` κρατά μόνο αριθμό ⇒ πυλωτή φαίνεται «Ισόγειο» (`search-index-config` → Cloud Functions, θέλει ανάπτυξη Functions).
- ⏳ **Φίλτρο ορόφου ακινήτων** (`usePropertyFiltersConfig`: ετικέτα ωμός αριθμός «2» + matchers `Number(filters.floor)`) ⇒ `lib/floor/floor-filter` (κλειδί αριθμός:είδος).
- **Τύποι-αντίγραφα** (~15): `Floor`/`FloorOption`/`FloorRecord`/`FloorData` σε `types/building/contracts.ts:226` · `usePropertyState.ts:9` · `useFloorsByBuilding.ts:32` (✅ πλέον η ΜΙΑ πηγή των επιλογέων — 2β.1β· το αντίγραφο του `FloorSelectField` διαγράφηκε) · `multi-level.service.ts:22` · `property-tab-constants.ts:104` · `useFloorsTabState.types.ts:12` · `features/*/types.ts` κ.ά. — αυθεντία `FloorDocument`.
- ✅ **Έγινε (2β.2, ADR-903 §8)**: ζεύγος `floor`+`floorKind` σε δήλωση ιδιοκτήτη/προβολή/αγγελία · `floorPairOf` · `floorRefKey` · επιλογέας δηλωμένης στάθμης · `PublicListing.floorKind` (κρίκος 17) · `PlaceUnitRef`/`unitNumber`/κλειδί μονάδας · σβήστηκαν `offer.card.floor` + `search-results:listing.floor/groundFloor` + `comparables.basement` · φρουρός locale.
- ✅ **Έγινε (2β.3, ADR-903 §9)**: `lib/floor/floor-level-range` (μία διάταξη, σειρά Spitogatos) σε φόρμα ζήτησης · φίλτρα αναζήτησης (σχήμα `'level-range'`) · `/interest-check` · `floorMinKind/floorMaxKind` · υπόδειξη `unitIncomplete` · `isValueSetShape`. ⚠️ Το `placeUnitKey` **δεν** χρειάστηκε στην 2β.3 (ο κριτής ήταν ήδη ανά μονάδα) — πρώτος καταναλωτής η 2β.4.
- ✅ **Έγινε (2β.4–2β.5, ADR-900 §8 #2)**: `public_units` (αδιαφανές `punit_*` = HMAC του ΚΑΕΚ · κύκλος UPRN · πηγή `cadastre`) γεννιέται στο `writeClaimLocks` · πρώτος καταναλωτής `PlaceSummary` → μονάδες ανά στάθμη · `compareFloorRefs` · SPEC-777A §14.2.1 + §14.4 κανόνας 5.
- ⏳ **Deploy `public_units`**: κανόνες (`firestore.rules`) **και** μυστικό `PUBLIC_UNIT_ID_HMAC_SECRET` στο Netcup — **χωρίς** το μυστικό η επαλήθευση με δεσμό κτιρίου απαντά 503 (fail-closed). Μόνο με εντολή Giorgio. ⚠️ Το μυστικό **δεν** αλλάζει ποτέ χωρίς μετανάστευση (άλλο μυστικό ⇒ δεύτερη μονάδα για το ίδιο σπίτι).
- ⏳ **«Τελευταίος όροφος» / «ενδιάμεσοι»** (idealista «última planta / plantas intermedias»): θέλει πλήθος ορόφων του κτιρίου από το επίπεδο Α. Οι μονάδες της 2β.4 δίνουν μόνο **κάτω φράγμα** ύψους ⇒ χρειάζεται `PublicBuilding.floorsAboveGround` με πηγή. (προτεραιότητα ΧΑΜΗΛΗ)
- ⏳ **Ίχνος αλλαγών**: το `formatFieldAwareValue` αποδίδει μόνο το `floor` με την ετικέτα· το `floorKind` (ακίνητα/θέσεις/αποθήκες και πλέον αγγελίες ιδιώτη) εμφανίζεται ωμό (`pilotis`). Θεραπεία: κλάδος `floorKind` μέσω `FLOOR_LABEL_KEY` (το `standard` χωρίς αριθμό δεν έχει ετικέτα — χρειάζεται δική του λέξη).
- **Πυλωτή — ελάχιστο ύψος κάτω από δοκό** (`clear-height-under-beam.ts`): σχόλιο λέει 1900 (ΚΠΝ) χωρίς επαληθευμένη πηγή· μένει 2200 μέχρι πηγή ΝΟΚ/ΚΠΝ.

### 🎯 Κύρια ενέργεια = `bg-primary` ⇒ αόρατη στο σκοτεινό (προτεραιότητα ΜΕΣΑΙΑ, 2026-10-01, ADR-770 §18 · ADR-896 §7Α.8)
- **SSoT**: `COLOR_BRIDGE.action.primary` (`design-system/color-bridge.ts`, ανεστραμμένο μονόχρωμο, μετρημένο 16,66:1 σκοτ. / 14,76:1 φωτ.).
  Το `.dark --primary` ≡ `--card`, οπότε κουμπί `bg-primary` σβήνει μέσα σε κάρτα/φύλλο. Έτσι βρέθηκε ζωντανά το «Δείξε N» του `/search/results`.
- **Μένουν 45 αρχεία** με χειρόγραφο `bg-primary text-primary-foreground` (`grep -rln "bg-primary text-primary-foreground" src --include=*.tsx`).
  🔴 **Η ρίζα είναι το `Button variant="default"`** (`components/ui/button.tsx:18`, ~690 αρχεία με `<Button`). ⛔ ΟΧΙ αλλαγή του `--primary`
  (ADR-682 §5.5). Απόφαση Giorgio: (α) νέο variant `action` στο `Button` που διαβάζει το SSoT, με μετανάστευση ανά οθόνη μόνο για την
  **κύρια** ενέργεια (μία ανά οθόνη, ADR-770 §18) ή (β) `default` → `action.primary` συνολικά (οπτική αλλαγή σε όλη την εφαρμογή).
- **Πύλη**: καμία σήμερα δεν το πιάνει (το 3.38 κοιτά `text-primary`, όχι γέμισμα κουμπιού). Υποψήφιο ratchet: `bg-primary` σε στοιχείο-κουμπί.
- ⚠️ **ΔΥΟ γεμίσματα κύριας ενέργειας πλέον (2026-10-17, ADR-912 §12.13–§12.14)**: εκτός από το `COLOR_BRIDGE.action.primary` (μονόχρωμο),
  το `ENTITY_ACTION_PRIMARY_FILL` (`core/entity-headers/entity-action-presets.ts`, το μπλε της εφαρμογής) το φορούν οι κεφαλίδες οντοτήτων
  και το `AddCaptureMenu`. Η απόφαση (α)/(β) πρέπει να ενοποιήσει **και αυτά τα δύο** σε ΕΝΑ SSoT. Απόφαση Giorgio: ποιο χρώμα κρατάμε.

### 🖼️ `downloadUrl` → `fileDisplayUrl` / `preview` — οι υπόλοιποι αναγνώστες URL αρχείου (προτεραιότητα ΜΕΣΑΙΑ, 2026-10-01, ADR-899 · ADR-862 Φ0 Β8)
- **SSoT**: `lib/files/file-display-url.ts` (`fileDisplayUrlOf` → `url` + `preview` από την κλίμακα 320…2560). Πέρασαν ήδη:
  `PhotosTabBase` · `MediaGallery` · `MediaCard` · `property-photos` · κεφαλίδα/κάρτα ακινήτου.
- **Μένουν ~32 αρχεία / ~90 σημεία** (`grep -rn "downloadUrl" src/components src/features src/hooks`). Δύο είδη, χωριστή απόφαση ανά σημείο:
  (α) **εμφάνιση εικόνας** ⇒ `preview.src`/`srcSet` (σταματά το κατέβασμα πρωτοτύπων MB για μικρογραφίες)·
  (β) **λήψη/άνοιγμα αρχείου** ⇒ `fileDisplayUrl` (το `url`, όχι παράγωγο). ⚠️ Εγγραφές χωρίς `downloadUrl` (seed/παλιές ροές) σήμερα **κρύβονται**.

### 🧹 Floor wipe (ADR-340) σβήνει `FileRecord` + bytes ΧΩΡΙΣ κριτή δέσμευσης (προτεραιότητα ΜΕΣΑΙΑ — ΓΚΠΔ/legal hold, 2026-10-31, ADR-899 §2.2.1)
- `services/floorplan-background/floorplan-floor-wipe.service.ts` (+ `floor-wipe-storage.ts`): hard delete εγγραφών `files` + bytes του
  ορόφου πριν από νέο ανέβασμα. Συνοδευτικά ✅ (σάρωση φακέλου κατηγορίας), αλλά **κανένα** `isFileHeld` (μετρημένο: 0 εμφανίσεις στον
  φάκελο) ⇒ αρχείο σε δέσμευση/διατήρηση/record σβήνεται. Θεραπεία: ο ίδιος κριτής πριν από το wipe (κρατημένο ⇒ άρνηση με λόγο στο UI,
  όπως το deletion-guard), ή παράδοση στον κάδο όπως το CF υποβάθρου. Άλλη πύλη: ο γεννήτορας προβολής (`scripts/lib/functions-projection/plan.js`)
  γράφει ένα αρχείο ανά καταχώριση `constants` — δύο εξαγωγές του ίδιου module συγκρούονται σιωπηλά (τομέας πυλών, άλλη συνεδρία).
- Επίσης ανοιχτό: το cron της εφαρμογής κάνει `limit(100)` ανά διαμέρισμα/ημέρα — με την απόσυρση του `scheduledFilePurge` (που είχε 500)
  είναι η μόνη αγωγός· σήμερα 13 στον κάδο, αρκεί — να ξαναμετρηθεί αν ο κάδος μεγαλώσει. Μια εγγραφή **record** που παραδίδεται από
  το CF υποβάθρου μένει στον κάδο (το cron την κρατά) — αποδεκτό (ανακτήσιμη), αλλά αντίθετο με το «record ποτέ στον κάδο».

### 📐 Εμβαδόν ακινήτου `areas?.gross || areas?.net || area` — αντίγραφα έξω από το `propertyDisplayArea` (προτεραιότητα ΧΑΜΗΛΗ, 2026-10-02, ADR-898 Φ4β · ADR-184)
- **SSoT**: `src/lib/properties/property-display-area.ts` (`propertyDisplayArea` — `null` για «δεν μετρήθηκε», ποτέ `0`). Το χρησιμοποιούν ήδη η καρτέλα Μονάδων κτιρίου (στήλη · κάρτα · στατιστικά).
- **Πού μένουν** (grep `areas?.gross ||` 2026-10-02): `domain/cards/property/usePropertyCardModel.ts` (`displayAreaOf`) · `features/property-grid/components/PropertyCard.tsx` (×2) · `features/property-hover/components/PropertyQuickView.tsx` · `lib/social-platform-system/sharing-service.ts`.
- **Θεραπεία**: ανάθεση στο SSoT· προσοχή ότι το SSoT επιστρέφει `null` αντί για `undefined` (`?? undefined` όπου ο καταναλωτής περιμένει `undefined`).
- **Παρεμπιπτόντως** (ίδια συνεδρία): `tabs/FloorsTabContent.tsx:154` έχει σκληρό `retryLabel="Retry"` (N.11) — η Στάθμευση διορθώθηκε με το υπάρχον `unitStats.retry`.

### 📒 Ημερολόγιο αρχείου: ΚΑΜΙΑ ετικέτα πράξης — όλες εμφανίζονται ωμές (προτεραιότητα ΜΕΣΑΙΑ, 2026-10-14, ADR-915 Φ3α §10 · ADR-191 · N.0.2)
- **Τι**: το `components/shared/files/AuditLogPanel.tsx` καλεί `t(\`audit.action.${entry.action}\`, entry.action)`, αλλά **κανένα** κλειδί `audit.action.*` δεν υπάρχει στο `locales/{el,en}/files.json` (grep 2026-10-14). Ο άνθρωπος βλέπει `cde_seal` · `hold_place` · `document_facts_record` αντί για κείμενο.
- **Γιατί δεν το έπιασε πύλη**: η κλήση έχει **ωμή εφεδρεία** (`entry.action`), άρα το CHECK 3.8 δεν βλέπει κλειδί που λείπει. Είναι ακριβώς το σχήμα της πύλης 3.97.
- **Θεραπεία**: ~38 κλειδιά (ένα ανά `FileAuditAction`) σε el + en, και η κλήση **χωρίς** εφεδρεία. Άγκυρα: κάθε μέλος του τύπου έχει κλειδί και στις δύο γλώσσες (ο `ACTION_ICON_MAP` είναι ήδη `Record<FileAuditAction, …>`, άρα το κλειστό σύνολο υπάρχει).
- **Μέγεθος**: ~1h, ξένος τομέας (ADR-191) ⇒ όχι επί τόπου.

### ⭕ `useBorderTokens().radius.X` μέσα σε `className` — **τιμή CSS**, όχι κλάση (προτεραιότητα ΜΕΣΑΙΑ, 2026-10-14, ADR-777 §8.96.5 · N.0.2)
- **Ρίζα**: το `radius` του hook είναι το `coreBorderRadius` (`full: '9999px'`, `lg: '0.75rem'`)· οι κλάσεις είναι στο **`radiusClass`**. Μέσα σε template `className` το `${radius.full}` γίνεται ωμό «9999px» ⇒ **καμία** στρογγύλευση, σιωπηλά.
- **Διορθώθηκε**: `components/ui/radio-group.tsx` (τα radio ήταν τετράγωνα σαν checkbox σε ΟΛΗ την εφαρμογή) + άγκυρα `components/ui/__tests__/radio-group.test.tsx` (μετάλλαξη 1/1).
- **Πού μένουν** (grep 2026-10-14, 23 αρχεία): `ui/avatar.tsx` (×2) · `ui/dialog.tsx` (κουμπί κλεισίματος) · `core/FormFields/FormField.tsx` · `email/SendEmailModal.tsx` · `ui/email-sharing/components/TemplateSelector.tsx` · `design-system/primitives/Card/CardIcon.tsx` · `properties/detail/PropertyHeaderGallery.tsx` · `property-grid/components/PropertyCard.tsx` · `property-grid/PropertyGridView.tsx` · 13 στο `subapps/dxf-viewer/` (settings, color, toolbar). ⚠️ Επαλήθευσε ανά σημείο ότι είναι `className` (σε `style={{ borderRadius }}` η τιμή είναι **σωστή**).
- **Θεραπεία ΚΛΑΣΗΣ, όχι ανά αρχείο**: μετονομασία του `radius` σε `radiusValue` (ή αφαίρεση από το hook) ώστε η κακή χρήση να **μη γράφεται** — και αντικατάσταση με `radiusClass` όπου είναι κλάση. Η αλλαγή είναι οπτική σε κοινά primitives (avatar · dialog) ⇒ ζωντανό κοίταγμα πριν το commit.

### 🏷️ Κεφαλίδα σελίδας (τίτλος + εισαγωγή) — αντίγραφα έξω από το `PrivatePageHeader` (προτεραιότητα ΧΑΜΗΛΗ, 2026-10-02, ADR-900 · CHECK 3.28)
- **Τι**: το ίδιο `<header className="flex flex-col gap-2"><h1 className="text-2xl font-semibold text-foreground">…</h1><p className="text-sm text-muted-foreground">…</p></header>` είναι γραμμένο με το χέρι σε πολλές σελίδες.
- **SSoT**: `src/components/private-space/PrivatePageHeader.tsx` (το ζήτησε η CHECK 3.28 στο commit του ADR-900· το χρησιμοποιούν ήδη `InterestCheckContent` + `MyOwnerPropertiesContent`).
- **Πού μένουν**: `MyDemandsContent` · `MySavedListingsContent` · `MyContactsContent` (η κεφαλίδα έχει και τρίτη γραμμή) · `DraftFormShell` · `StayCalendarContent` · `ContactInboxContent` · `ListingDetailContent` · `construction/portfolio/page.tsx`. Μέτρα πρώτα: `grep -rln 'h1 className="text-2xl font-semibold text-foreground"' src`.
- **Θεραπεία**: όπου η κεφαλίδα είναι ακριβώς τίτλος + εισαγωγή → `PrivatePageHeader`· όπου έχει επιπλέον περιεχόμενο, `children` στο ίδιο component — όχι δεύτερο.


### 🌍 `security-defaults.ts` — ονόματα χωρών σκληρά στον κώδικα (προτεραιότητα ΧΑΜΗΛΗ, 2026-09-29, ADR-894)
- `src/services/security/security-defaults.ts:155+` γράφει `countryName: 'Ελλάδα' | 'Κύπρος' | 'ΗΠΑ'` και το
  `EnterpriseSecurityService.ts:290` το δείχνει ως `label` ⇒ ελληνικά και στο αγγλικό UI (N.11, αόρατο στον scanner).
- **Σωστή λύση** (ίδια με το ADR-894 §4.4): κράτα μόνο `countryCode`, απόδοση με `getDisplayNames().region.of(code)` στην οθόνη.
  **Μη** «διορθωθεί» τυφλά: να ελεγχθεί πρώτα αν το `countryName` αποθηκεύεται σε Firestore (τότε θέλει ανεκτική ανάγνωση).

### ♿ Κουμπιά-εικονίδια χωρίς προσβάσιμο όνομα — πύλη ΚΛΑΣΗΣ, όχι διόρθωση ανά αρχείο (προτεραιότητα ΜΕΣΑΙΑ, 2026-09-29, ADR-891 §10.4 Θ2)
- **Έγινε ήδη (ΙΚΑ)**: `WorkerCard` (όνομα με τον εργαζόμενο, πρότυπο GitHub/Gmail) · `DailyTimeline` (+ `aria-expanded`) ·
  `DateNavigator` · `MonthYearSelector` (ήταν ωμά αγγλικά `aria-label="Previous day"` — **αόρατα** στον scanner του N.11).
  Κλειδιά `ika.periodNavigation.*`, `ika.workersTab.removeWorkerNamed`, `ika.timesheetTab.{show,hide}Records`. Άγκυρα:
  `src/components/projects/ika/components/__tests__/ika-icon-button-names.test.tsx`.
- **Μένει**: μέτρηση 2026-09-29 (ευρετική, regex στο opening tag): **129** `<Button size="icon">` στο `src/`, **75** χωρίς
  `aria-label` σε **46** αρχεία (κάποια ίσως ονομάζονται από `sr-only` παιδί ⇒ η πύλη πρέπει να το ξέρει).
- **Σωστή λύση (κλάση)**: στο `@/components/ui/button` ο τύπος να **απαιτεί** `aria-label` | `aria-labelledby` όταν `size="icon"`
  (discriminated union — το Figma/Radix Themes `IconButton` κάνει το ίδιο) **ή** πύλη AST ratchet (πρότυπο CHECK 3.23). Όχι 46 χειρόγραφες διορθώσεις.

### 🧵 RPC κύριου νήματος ⇄ Web Worker — τέσσερα χειρόγραφα αντίγραφα στο dxf-viewer (προτεραιότητα ΧΑΜΗΛΗ, 2026-09-28, ADR-884 Φ2στ-γ Γ3γ-2α §4.14)
- **Έγινε ήδη (Γ3γ-2α)**: SSoT `src/lib/workers/{worker-rpc-protocol, worker-rpc-client, worker-rpc-host}.ts` — νωχελική γέννηση ·
  αριθμός αιτήματος → Map · κατάρρευση ⇒ ΟΛΑ τα εκκρεμή `failed` + δίχτυ στον κύριο νήμα, καμία επαναγέννηση · `dispose` ·
  `latestOnly` · host σειριακός, σφάλμα ⇒ απάντηση. Πρώτος καταναλωτής: `lib/spatial-tour/space-detect/space-detect-client.ts`.
- **Μένει** (άλλο domain, > 1 h, αλλάζει συμπεριφορά σε κατάρρευση ⇒ test ανά πελάτη): `subapps/dxf-viewer/bim-3d/library/bim-mesh-library/mesh-fill-union-client.ts`
  (`requestId` string + `drainPending`) · `text-engine/spell/spell-checker.ts` · `io/pointcloud-import.ts` · `io/dxf-import.ts`
  (+ `utils/performance.ts` που φτιάχνει Worker από URL). Το dxf-viewer **μπορεί** να εισάγει από `@/lib` (η αντίθετη φορά
  απαγορεύεται, CHECK 3.62). Ο Worker τους πρέπει να περάσει σε `serveWorkerRpc(self, handler)`.

### 🧷′ Κατηγορήματα σχήματος — ό,τι έμεινε ΣΚΟΠΙΜΑ εκτός (προτεραιότητα ΧΑΜΗΛΗ, 2026-10-29, ADR-225 Phase 2 · N.0.2)
- **SSoT**: `lib/type-guards.ts` → `isRecord` (δέχεται πίνακα) · `isPlainRecord` (όχι πίνακας) · `plainRecordOrNull` · `isFiniteNumber`. Νέος καλών εισάγει από εκεί — όχι ιδιωτικό αντίγραφο.
- **`lib/audit/audit-diff.ts:147`**: επί τόπου `typeof v === 'object' && v !== null && !Array.isArray(v)` → `isPlainRecord(v)`. Δεν έγινε: το αρχείο το άλλαζε άλλη συνεδρία (2026-10-29).
- **Ερώτηση σημασίας, ΟΧΙ μηχανική αλλαγή**: τρεις αναγνώστες αποθηκευμένων εγγράφων χρησιμοποιούν το `isRecord` που **δέχεται πίνακα** (`lib/listings/floor-plate/floor-plate-publication.ts` · `lib/network-messaging/network-thread-from-document.ts` · `components/generic/mappings/propertiesMappings.ts`). Για ανάγνωση JSON το σωστό είναι μάλλον `isPlainRecord` — αλλά αλλάζει τι γίνεται δεκτό ⇒ ανά αρχείο, με test.
- **Ratchet**: δεν υπάρχει πύλη που να εμποδίζει νέο ιδιωτικό `function isPlainObject|isRecord|isFiniteNumber`. Υποψήφιο CHECK (ταυτότητα δήλωσης, όχι κείμενο σώματος).
- ⛔ **ΟΧΙ**: `lib/auth/audit-core.isPlainObject` — ελέγχει και **prototype** (`Object.prototype`/`null`), όπως το `isPlainObject` της lodash: άλλη ερώτηση, σωστά τοπική.

### 📐 Επίπεδη γεωμετρία — τα υπόλοιπα αντίγραφα έξω από το `lib/geometry` (προτεραιότητα ΧΑΜΗΛΗ, 2026-09-28, ADR-884 Φ2στ-γ Γ3)
- **Έγινε ήδη (Γ3α)**: SSoT `src/lib/geometry/planar-polygon.ts` (εμβαδόν · σημείο-μέσα · αυτοτομή · `segmentsIntersect` ·
  `distanceToSegment` · ρίζα `PlanarPoint`) + `douglas-peucker.ts` (δακτύλιος + γραμμή). Επανεξάγουν / καλούν: dxf `polygon-utils`,
  `GeometryUtils` (`segmentsIntersect`, `isPointInPolygon`), `bim-base` (`PlanarPoint`), `lib/geo/geo-local-frame` + `geo-simplify`,
  `mesh-silhouette`, `packages/core/polygon-system` (DP · εμβαδόν · σημείο-μέσα).
- **Μένει**: (1) `packages/core/polygon-system/utils/polygon-utils.ts` → ιδιωτικά `checkSelfIntersection` + `doLinesIntersect`:
  **ΑΛΛΗ σημασιολογία** (δεν ελέγχει την ακμή κλεισίματος · κατώφλι παραλληλίας 0,001 **απόλυτο**) και ταΐζουν το `validatePolygon`
  ⇒ ενοποίηση = αλλαγή αποτελέσματος επικύρωσης· χρειάζεται απόφαση + test. (2) `lib/geo/geo-local-frame.ts` → `localSegmentCrossing`
  (γνήσια τομή, με σημείο) έναντι `segmentsIntersect` (με επαφή, boolean) — διαφορετικό ερώτημα, **όχι** διπλότυπο· αν μπει τρίτος
  καταναλωτής, ένας πυρήνας `segmentIntersectionRaw`. (3) Η οικογένεια «σημείο τομής ευθειών» του dxf (βλ. γραμμή για ADR-507 Φ3
  πιο πάνω) θα πρέπει να ζήσει κι αυτή στο `lib/geometry`.
  (4) **Γ3γ-1 (2026-09-28)**: νέο SSoT `lib/geometry/polygon-label-point.ts` (πραγματικός πόλος απροσπέλαστου, Garcia-Castellanos
  2007 / polylabel) + `planar-polygon.distanceToRing` (το `planar-polygon-overlap` το καλεί ήδη). Το
  `dxf-viewer/bim/geometry/shared/polygon-interior-point.ts` λύνει την **ίδια** ερώτηση με προσέγγιση O(n²) (κεντροειδές + μέσα ζευγών
  κορυφών) και έχει δικό του `clearanceToBoundary` (= `distanceToRing`). **Δεν** ανατέθηκε στη Γ3γ-1: αλλάζει τη θέση της λαβής
  περιστροφής/σταυρού μετακίνησης των ελεύθερων υποστυλωμάτων (ADR-363/449/520 — το `clearance` μεγαλώνει, άρα η εγγύηση «μέσα»
  μένει) ⇒ χρειάζεται τα jest των λαβών του dxf + ζωντανή ματιά. Προσοχή: σε < 3 κορυφές το dxf δίνει **κεντροειδές** (άγκυρα
  `{x:5,y:0}`), το SSoT την πρώτη κορυφή — ο προσαρμογέας κρατά τη συμπεριφορά του dxf.

### 🚦 Όριο ρυθμού ανά ΠΡΑΓΜΑΤΙΚΗ διαδρομή, όχι ανά πρότυπο (προτεραιότητα ΥΨΗΛΗ — ασφάλεια, 2026-09-27, ADR-855 · εντοπίστηκε στο ADR-884 §4.11)
- ✅ **2026-10-30 — ΥΛΟΠΟΙΗΘΗΚΕ (εκκρεμεί commit Giorgio)**: `src/lib/middleware/route-template.ts` (`routeTemplateOf` · `routeParamsOf`) — το
  πρότυπο από τα `params` του δρομολογητή (όχι μαντεία ids)· αποτυχία εντοπισμού ⇒ **χοντρότερος** κουβάς (`/api/<περιοχή>/[unresolved]`),
  ποτέ η ωμή διαδρομή. Ο `with-rate-limit.ts` κλειδώνει **και** κρίνει βαθμίδα στο πρότυπο (τα προθέματα του πίνακα είναι στατικά).
  Άγκυρες: `__tests__/route-template.test.ts` (Τ1–Τ7 · Π1–Π2) + `rate-limit-declared-category.test.ts` describe «Τ» (κλειδί στον store).
  ⚠️ **Το jest δεν τρέχει από τον DESKTOP-D4AT022** (UNC ⇒ «No tests found» ακόμη και για υπάρχουσες σουίτες) — η λογική επαληθεύτηκε
  με node type-stripping + `tsc --strict` στο module· **τρέξε τις δύο σουίτες στον giorgio-pc πριν το commit.**
  **Πλακίδια**: έμειναν `ASSET` (600) — πλέον ανά θεατή για όλα τα πλακίδια (15–30 νέα σημεία/λεπτό). Νέα βαθμίδα **δεν** μπήκε: το
  `scripts/lib/rate-limit-policy/inventory.js` διαβάζει `category:\s*'([A-Z]+)'` (χωρίς `_`) και ήταν ανοιχτό σε άλλη συνεδρία.
  **Μένει**: το ταξίδι Upstash ανά πλακίδιο (κόστος χρόνου) · μέτρηση 429 στην παραγωγή μετά το deploy.
- **Τι**: `buildRateLimitKey(identifier, endpoint)` (`src/lib/middleware/rate-limit-config.ts:385`) βάζει στο κλειδί την **πραγματική**
  διαδρομή του αιτήματος. Κάθε δυναμικό τμήμα (`[id]`, `[...path]`) γεννά **δικό του «κουβά»**: `/api/contacts/A` και `/api/contacts/B`
  μετρούν χωριστά ⇒ μαζική ανάγνωση/απαρίθμηση ids **δεν** περιορίζεται ποτέ (κάθε id έχει τα δικά του 60-600/λεπτό). Η δήλωση του
  `ASSET` (*«the cap stays bounded so a scripted scrape of a whole pack still throttles»*) **δεν ισχύει**: κάθε πλακίδιο έχει δικό του όριο.
- **Πού**: `with-rate-limit.ts` (`checkRateLimit(identifier, endpointPath, …)`) → `rate-limiter.ts:133` → `rate-limit-config.ts:385`.
  Στο dev κλειστό (`environment-security-config.ts:103`), γι' αυτό δεν φάνηκε ποτέ τοπικά.
- **Γιατί**: Envoy/Cloudflare/NGINX κλειδώνουν στο **πρότυπο διαδρομής** (route template), όχι στο URL.
- **Διόρθωση (πρόταση)**: κλειδί = πρότυπο διαδρομής (από τον δρομολογητή του Next ή κανονικοποίηση δυναμικών τμημάτων), με άγκυρα
  «δύο ids ⇒ ΕΝΑΣ κουβάς». ⚠️ **Πριν τη διόρθωση**: τα πλακίδια περιήγησης (`/api/spatial-tours/…/media/…`) χρειάζονται δικό τους
  προϋπολογισμό — με τη ροή ορατών (ADR-884 Φ2ε) ένα σημείο κοστίζει ~20–40 αιτήματα, αλλιώς ο επισκέπτης που περπατά γρήγορα θα πάρει 429.
  Και κάθε αίτημα πλακιδίου κάνει σήμερα ένα ταξίδι στο Upstash — κόστος χρόνου ανά πλακίδιο στην παραγωγή.

### 🔤 Τεμπέλικες σελίδες `ssr: false` ΕΚΤΟΣ route slice — ωμά κλειδιά στο πρώτο καρέ (προτεραιότητα ΜΕΣΑΙΑ, 2026-09-26, ADR-884 Κ3γ §4.7 Α4 · ADR-744)

- **Τι**: σελίδα `page.tsx` που επιστρέφει `<LazyRoutes.X />` (`createLazyRoute`, `ssr: false`) ⇒ η κλειστότητα του route slice κόβεται στο
  δυναμικό όριο (**μετρημένο: `/shared/[token]` = 0 ns**)· το chunk φτάνει συχνά **πριν** το namespace ⇒ ωμό κλειδί ένα καρέ. Το σχόλιο του
  `shell-closure.js` («το chunk δεν ζωγραφίζει πριν το δικό του round-trip») **δεν** ισχύει: chunk και namespace είναι δύο ανεξάρτητα αιτήματα.
- **Πού**: όλα τα `LazyRoutes.*` του `src/utils/lazyRoutes*.tsx` (ADR-294 — δεκάδες σελίδες). ✅ **Ο μηχανισμός υπάρχει** (2026-09-26): `createLazyRoute({ namespaces })` — το chunk περιμένει `loadNamespace` (άγκυρα `utils/__tests__/lazyRouteFactory-namespaces.test.tsx`, μετάλλαξη 2 κόκκινα)· δηλωμένο **μόνο** στο `SharedFile` (`spatial-tour`). Ο φραγμός `isNamespaceReady` της `SharedTourPageContent` αφαιρέθηκε (CHECK 3.7/3.25).
- **Fix (υπόλοιπο)**: δήλωση `namespaces` σε κάθε `LazyRoutes.*` — ιδανικά από τον γεννήτορα του slice ανά lazy module, ώστε να μη γράφεται με το χέρι.
  Άγκυρα κλάσης: κάθε `createLazyRoute(…, { ssr: false })` είτε δηλώνει `namespaces` είτε δηλωμένη εξαίρεση με λόγο.
- 📏 **ΜΕΤΡΗΘΗΚΕ 2026-10-05** (ADR-900 §8 #2 βήμα 2α — τρίτη εμφάνιση: ουρά επαληθεύσεων, ωμά κλειδιά 560 → 2.586ms· δηλώθηκε
  `property-market` στο `AdminOwnershipVerifications`, 4 διαδρομές δηλωμένες πλέον). Με `buildShellPlan(…, { shellRoots: [lazy module],
  guaranteedNamespaces: {} })` ανά εγγραφή και αφαίρεση των 10 namespaces που ταξιδεύουν ολόκληρα: **74 από τις 83** διαδρομές ζητούν
  namespaces που δεν περιμένουν· διάμεσος **6**, μέγιστο **58** (`Buildings` · `PropertiesManagement`· `Projects` 54 · `CompanySettings` 46 ·
  `Contacts` 45). Κόστος μέτρησης: γράφος 26″ + ~2″ ανά διαδρομή = **197″** (όχι σε hook — CI ή γεννήτορας).
  ⇒ **η χειρόγραφη δήλωση αποκλείεται** (58 ονόματα × 74 εγγραφές θα πάλιωναν την ίδια μέρα). Σχέδιο: γεννήτορας που γράφει
  `routeKey → namespaces[]` δίπλα στα route slices + πύλη φρεσκάδας· ο `createLazyRoute` το διαβάζει.
  ⚠️ **Δύο ανοιχτά πριν γραφτεί κώδικας** (απόφαση Giorgio): (1) η κλειστότητα **υπερεκτιμά** — περιλαμβάνει στατικά εισαγόμενους διαλόγους
  που δεν ανοίγουν ποτέ· «περίμενε και τα 58» καθυστερεί το πρώτο καρέ 74 σελίδων και θέλει μέτρηση στην παραγωγή πριν γίνει προεπιλογή·
  (2) το `AdminRoleManagement` ρίχνει τη μηχανή (`leavesUnder is not defined`) — σφάλμα της μηχανής, όχι της σελίδας.
  ⚠️ Η κλειστότητα κόβεται και στα **εσωτερικά** `dynamic()` μιας σελίδας (η ουρά έχει 3) — ίδια κλάση, ένα επίπεδο πιο μέσα.
- 🛠️ **ΓΡΑΦΤΗΚΕ 2026-10-05** (ADR-744 §27.5–27.10): γεννήτορας του χάρτη (`lazy-routes.js` · `namespace-declarations.js` ·
  `lazy-route-census.js`), `defineLazyRoutes` (84 εγγραφές), απογραφή + σφράγιση **45** ζευγών εκτός εκκίνησης στο
  `.i18n-shell-slice.json`, 22 άγκυρες / 14 μεταλλάξεις. ⏳ **Περιμένει εντολή Giorgio**: εκτέλεση γεννήτορα → σύνδεση στο Layer 1 →
  ανάγνωση του χάρτη από το εργοστάσιο → αφαίρεση των 4 χειρόγραφων `namespaces` → μέτρηση σε production build (πριν/μετά).
- 🎯 **ΤΟ ΥΠΟΛΟΙΠΟ ΤΟΥ RATCHET (45 → στόχος: μόνο ό,τι ζωγραφίζει στο πρώτο καρέ)**: 18 ζεύγη (`Buildings` 7 · `PropertiesManagement` 7 ·
  `Projects` 4) έρχονται από πίνακες που εισάγουν στατικά κάθε καρτέλα (`components/generic/mappings/buildingMappings.ts` ·
  `propertiesMappings.ts` · `projectMappings.ts`). Fix: τεμπέλικη καρτέλα μέσω του ίδιου εργοστασίου — ⚠️ περιοχή άλλου agent, μόνο με εντολή.

### 🔤 `useTranslation(ΣΤΑΘΕΡΑ)` — αόρατο στο CHECK 3.8 και στο shell slice (προτεραιότητα ΜΕΣΑΙΑ, 2026-10-05, ADR-744 §27.5)

- **Τι**: ο κοινός εξαγωγέας (`scripts/lib/i18n-namespace-extract.js` → `extractNamespaces`) διαβάζει κυριολεκτικά + bundles του
  `namespace-bundles.ts`· κάθε άλλο αναγνωριστικό το αγνοεί. Μετρημένο: **167** κλήσεις είναι σταθερές module
  (`SPATIAL_TOUR_NS` ×110 · `LANDING_HEROES_NS` ×17 · `NAMESPACES` ×12 · `CASE_INVITE_NS` ×6 …). Για αυτά τα αρχεία το CHECK 3.8
  βλέπει **μηδέν** namespaces και παραλείπει τον έλεγχο κλειδιών — «`0` = κανείς δεν κοίταξε».
- **Πού**: 3.8 (`check-i18n-missing-keys.js`), shell slice (`plan.js` → `analyseFile`), baseline generator.
- **Fix**: ο resolver υπάρχει πλέον (`scripts/lib/i18n-shell-slice/namespace-declarations.js`, AST + γράφος)· να γίνει ο αναγνώστης
  και των δύο. ⚠️ Αλλάζει τη baseline του 3.8 (νέα ορατότητα ⇒ πιθανά νέα «λείποντα») — θέλει μέτρηση πριν, όχι τυφλή αντικατάσταση.

### 🚨 `Alert variant="destructive"` χωρίς εικονίδιο — 17 από 31 (προτεραιότητα ΧΑΜΗΛΗ, 2026-10-05, ADR-900 §8 #2 βήμα 2γ · WCAG 1.4.1)

- **Τι**: το εικονίδιο ήταν ευθύνη κάθε καλούντα ⇒ οι μισοί το ξέχασαν και η αποτυχία λέγεται μόνο με χρώμα. Το `ui/alert.tsx` έχει
  πλέον **`withIcon`** (εικονίδιο ανά παραλλαγή από το SSoT, άγκυρα `ui/__tests__/alert-with-icon.test.tsx`)· το χρησιμοποιούν μόνο τα 6
  σημεία της επαλήθευσης ιδιοκτησίας.
- **Fix**: `withIcon` στα 17· οι 14 που περνούν δικό τους `<svg>` μεταναστεύουν και αυτοί, και τότε το `withIcon` γίνεται **προεπιλογή**
  για το `destructive` (σχήμα MUI/Carbon/Polaris: το εικονίδιο ανήκει στη σοβαρότητα, όχι στον καλούντα).
- **Συγγενές**: το χειρόγραφο `aside role="alert" … border-border bg-card p-3 text-sm text-foreground` (αποτυχία **χωρίς** καμία σήμανση)
  ζει ακόμη σε `mandate/MandateRequestOutcomeNotice.tsx` και `contact/FirstContactOutcomeNotice.tsx` (το τρίτο αντίγραφο, στην κάρτα
  κατόχου, έγινε `Alert`).

### 🔓 Δημόσια διαδρομή ⇔ ανώνυμη κλήση — πύλη ΚΛΑΣΗΣ (προτεραιότητα ΜΕΣΑΙΑ, 2026-09-26, ADR-884 Κ3β · ADR-777 §8.60.21.7)

- **Τι**: route με `withAuth(…, { allowUnauthenticated: true })` (ή χωρίς `withAuth`) που ο πελάτης καλεί **χωρίς** `PUBLIC_REQUEST` ⇒ ο
  μεταφορέας ζητά `getIdToken()` και πετά 401 **πριν** φύγει το αίτημα — ο ανώνυμος επισκέπτης δεν βλέπει ποτέ τίποτα, ο συνδεδεμένος
  developer δεν το βλέπει ποτέ. **Δεύτερη** εμφάνιση (διαμονή 2026-09-19 · κάρτα περιήγησης 2026-09-26)· και οι δύο αγκυρώθηκαν **ανά αρχείο**.
- **Πού**: ~5 διαδρομές `allowUnauthenticated` σε `src/app/api/**` · καλούντες μέσω `API_ROUTES.*` — **με ψευδώνυμα** (`const routes = API_ROUTES.X`),
  άρα grep ονόματος δεν αρκεί.
- **Fix**: πύλη που (α) απαριθμεί τις δημόσιες διαδρομές από το ίδιο το `withAuth` config, (β) αντιστοιχεί `API_ROUTES` κατασκευαστή → πρότυπο
  διαδρομής (εκτέλεση με placeholders, όπως κάνει ο browser), (γ) επιλύει ψευδώνυμα και απαιτεί `PUBLIC_REQUEST` σε κάθε κλήση τους.
  Δηλωμένες εξαιρέσεις με λόγο (π.χ. διαδρομή που δέχεται **και** ταυτότητα και θέλει να τη στέλνει).

### 🔤 Καθολικό 404 — ωμά κλειδιά `errors:notFound.*` (προτεραιότητα ΜΕΣΑΙΑ, 2026-09-25, ADR-744 · CHECK 3.34/3.51)

- **Τι**: το `src/app/not-found.tsx` καλεί `useTranslation('errors')`, αλλά το `errors` **δεν** είναι στο
  `shell-slice.el.json` και η σελίδα δεν έχει route slice ⇒ ο χρήστης βλέπει `notFound.title` / `notFound.message` /
  `notFound.backHome`. **Μετρημένο** στο log του dev server 2026-09-25 17:34Z: `i18n: raw key reached the UI →
  errors:notFound.title {"bundles":["errors=absent"]}` (σε `GET /demands 404`).
- **Διόρθωση**: το `not-found.tsx` είναι **καθολικό όριο** (όπως το `ProtectedRoute`), όχι route boundary ⇒ στο
  `extraShellRoots` του `.i18n-shell-slice.json` + εγγραφή `errors` στο `shellNamespaces` (dragger + λόγος) +
  `npm run generate:i18n-shell-slice` (κλειστότητα κομμένη στο κλειδί ⇒ μόνο τα 3 κλειδιά) + νέα σφράγιση με
  μετρημένο λόγο. Έλεγχος: CHECK 3.34 + 3.51.
- **Γιατί δεν έγινε επιτόπου**: ο άλλος agent ξαναπαρήγαγε το `shell-slice.el.json` την ίδια ώρα (3 full reloads
  στο log) — κοινό παραγόμενο αρχείο σε κοινό working tree.

### 🔶 Grants ακινήτου — δύο διαδρομές για το ίδιο έγγραφο (προτεραιότητα ΧΑΜΗΛΗ, 2026-09-25, ADR-884 §4.2)

- **Τι**: το `getPropertyGrant` (`src/lib/auth/permissions/resource-lookups.ts`) διαβάζει
  `companies/{cid}/properties/{pid}/grants/{uid}`, ενώ το `SUBCOLLECTION_PARENTS.PROPERTY_GRANTS = 'PROPERTIES'`
  (`src/config/firestore-collections.ts`) λέει στο backup `properties/*/grants`. Το σχόλιο του `PropertyGrant` λέει
  `/properties/{pid}/grants`. Τρεις δηλώσεις, δύο διαδρομές.
- **Γιατί δεν διορθώθηκε**: κανένας γραφέας `grants` σήμερα (0 έγγραφα)· η σωστή διαδρομή είναι **απόφαση** (Giorgio),
  όχι Boy Scout. Όποιος γράψει πρώτος grant ακινήτου αποφασίζει και ευθυγραμμίζει και τα τρία.
- **Σχετικό (κλειστό)**: η λήξη των grants κρίνεται πλέον από το `evaluateScopedGrant` (`lib/auth/scoped-grant.ts`) — πριν,
  grant με Firestore `Timestamp` δεν έληγε ποτέ.

### ⛔ Μηδενική ανοχή — ΕΝΑ άγκιστρο στη μηχανή, όχι ένα αντίγραφο ανά πύλη (προτεραιότητα ΜΕΣΑΙΑ, 2026-09-23)

**Τι**: το `scripts/lib/ratchet-baseline.js` απέκτησε `descriptor.refusals(measured)` (ADR-875 §14.4): οι ⛔
μπλοκάρουν **και στη σύγκριση**, όχι μόνο στη σπορά. Πριν, το CHECK 3.51 **δεν** μπλόκαρε ⛔ στη σύγκριση.
**Πού μένει διπλοτυπία**: `scripts/check-font-assets.js` (3.69) + `scripts/check-font-promise.js` (3.67) έχουν
**η καθεμία** δικό της `enforceZeroTolerance`, που τρέχει το `measure()` **δεύτερη φορά** πριν από τη μηχανή.
**Fix**: μεταφορά και των δύο στο `refusals` + ξαναγραφή των αγκυρών **Ζ1-Ζ5** (`font-assets.test.js`,
`font-promise.test.js`) ώστε να οδηγούν το πραγματικό `runSetRatchetCli`, όπως η Φ8 του
`i18n-ssr-guard-contract.test.js`. Μετά: grep για άλλες πύλες `runSetRatchetCli` με ⛔ εκτός συνόλων.

### 🔐 Σύνδεσμοι «Σύνδεση» χωρίς επιστροφή (προτεραιότητα ΧΑΜΗΛΗ, 2026-10-02)

**Τι**: οι **φρουροί** (αυτόματες ανακατευθύνσεις) έκλεισαν όλοι και τους κλειδώνει η άγκυρα **Ε** του
`return-path.test.ts`. Μένει η **άλλη** κλάση, ρητά εκτός εμβέλειας της άγκυρας: **σύνδεσμοι/κουμπιά**
`href={AUTH_ROUTES.login}` σε σελίδες που ζητούν σύνδεση — ο άνθρωπος πατά «Σύνδεση» και μετά προσγειώνεται
**αλλού**. Μετρημένα 2026-10-02: `unauthorized/page.tsx` · `admin/ai-inbox/AIInboxUnauthorized.tsx` ·
`contact/GuestContactContent.tsx` · `owner-property/form/OwnerPropertyDossierField.tsx` ·
`owner-property/form/OwnerPropertyMediaField.tsx` · `projects/projects-page-content.tsx` (**ωμό** `"/login"`) ·
`public-site/PublicSiteHeader.tsx` · `workspace-invite/workspace-invite-labels.ts` (`EXIT_HREF['sign-in']`, ωμό).
**Γιατί όχι επί τόπου**: σε απόδοση διακομιστή η τρέχουσα διεύθυνση **δεν** υπάρχει χωρίς `useSearchParams`
(όριο Suspense, CHECK 3.55)· το `loginHrefForCurrentLocation()` στην απόδοση θα έδινε hydration mismatch.
**Fix**: **ένα** `<SignInLink>` (σύνορο πλοήγησης) που αποδίδει `href={loginHref(pathname)}` και στο **κλικ**
συμπληρώνει το ερώτημα από `window.location` (σχήμα Google `continue=` · Zillow: η σύνδεση σε κρατά στη σελίδα)·
μετά επέκταση της άγκυρας **Ε** σε `href=` με κλειστό σύνολο εξαιρέσεων (π.χ. το «Σύνδεση» της αποσύνδεσης).
⚠️ Κρίνε ανά σημείο: το `EXIT_HREF['sign-in']` της πρόσκλησης μάλλον **θέλει** επιστροφή στην πρόσκληση.

### 🔤 CHECK 3.28 — η λέξη «new» είναι ψευδής (προτεραιότητα ΜΕΣΑΙΑ, 2026-09-22)

**Τι**: το `jscpd --diff` στα staged αναφέρει *«N **new** clone(s) inside this commit»*, αλλά
**δεν ρωτά «είναι νέος;»** — ρωτά «υπάρχει ανάμεσα στα αρχεία που άγγιξες;». Επαληθεύτηκε
2026-09-22 τρέχοντας jscpd πάνω σε `git show HEAD:<αρχείο>`: οι ίδιοι κλώνοι υπήρχαν
**αυτούσιοι** στο `HEAD`.

**Πού πονάει**: όποιος ακουμπήσει τέτοιο αρχείο για **οποιονδήποτε** λόγο — έστω μία γραμμή —
μπλοκάρεται από κλώνους που δεν έφτιαξε, και η πύλη τον σπρώχνει προς `SKIP_JSCPD_DIFF=1`.
Το skip **εθίζει**: πύλη που παρακάμπτεται ρουτινιέρικα είναι διακοσμητική (η παγίδα που το
CHECK 3.39 απέρριψε γραπτά).

**Το fix**: το CHECK 3.28 να συγκρίνει με το `HEAD` πριν πει «new», ή — μονόγραμμο και τίμιο —
να αλλάξει το μήνυμα σε «κλώνοι **μέσα στα αρχεία που άγγιξες** (μπορεί να προϋπήρχαν)».

**Πού μετριέται**: `npm run jscpd:diff <τα αρχεία>` · baseline Layer 2: `.jscpd-baseline.json`.

> ✅ **Το άλλο μισό αυτής της εγγραφής έκλεισε** (2026-09-22, `1afae107` + `cd715b4d`): οι
> **5** δίδυμοι του `accounting-office-notify` και το ζεύγος του `vendor-invite-service`
> εξήχθησαν αντί να παρακαμφθούν. Δες το changelog — **και** τη μέτρηση ισοδυναμίας που η
> προηγούμενη γραφή αυτής της εγγραφής απαιτούσε ρητά.

### 🗂️ ADR-862 Φ0 — ό,τι έμεινε ανοιχτό μετά το Β11-Β13 (προτεραιότητα ΜΕΣΑΙΑ, 2026-09-17)

- **Χειρόγραφοι δημιουργοί FileRecord εκτός builder** (>1h, 3 αρχεία): `app/api/cad-files/dual-write-to-files.ts`
  (merge + write-once λογική) και `app/api/quotes/scan/quote-file-record-writer.ts` χτίζουν το έγγραφο **με το χέρι**
  αντί για `buildPendingFileRecordData`. Κάθε νέο αμετάβλητο γέννησης (π.χ. `cdeReadReach` στο Β11) πρέπει να
  θυμηθεί **τρία** σημεία. Το CHECK 3.87 τα δηλώνει ως «γραφείς γέννησης» — θεραπεία: μετάβαση στον builder,
  μετά αφαίρεση από το `BIRTH_WRITERS`.
- **`generate-gate-index.js` θέλει ΔΥΟ περάσματα** για νέα πύλη (<1h): μετρά την απογραφή του CHECK 3.66
  **πριν** γράψει τη νέα γραμμή ⇒ το πρώτο πέρασμα γράφει «αδήλωτες: N+1». Θεραπεία: απογραφή πάνω στο
  **παραγόμενο** κείμενο, όχι στο αρχείο του δίσκου.
- **Ο βοηθός `text()` αντιγραμμένος — 4 αντίγραφα έμειναν** (<1h, αλλά **διαφορετική σημασία** ⇒ απόφαση ανά αρχείο):
  το Β14 (2026-09-17) γέννησε `trimmedStringOrNull` στο `lib/type-guards.ts` και μετέφερε **6** αντίγραφα ίδιας σημασίας
  (`project-member-read` · `file-record-read` · `succession-identity` · + τα 3 νέα). Μένουν **χωρίς trim**:
  `services/iso19650/container-succession-policy.ts` · `lib/stay/stay-calendar-from-document.ts` ·
  `services/mandate/showcase-email-return.service.ts`, και **με trim**: `services/company-registry/gemi-opendata-parse.ts`
  (άλλος agent). ⚠️ Το «χωρίς trim» σε αναγνωριστικό σημαίνει `' comp_x'` ≠ `'comp_x'` — έλεγξε αν είναι σκόπιμο πριν μεταφέρεις.
- **Αφαίρεση μέλους = διαγραφή** (Β14): ιστορικό ανάκλησης (`revokedAt`/`revokedBy`, ADR-787 Ε-2 §4) με τη Φ1.
- **Μαζική ένταξη «ομάδα γραφείου» από το UI** (Procore «Add from Company Directory»): ο γραφέας τη στηρίζει
  (`enrollProjectMembers` με πίνακα), η οθόνη λείπει.

### ⏳′ «Ημέρες μέχρι προθεσμία» — ό,τι έμεινε ΣΚΟΠΙΜΑ εκτός (προτεραιότητα ΧΑΜΗΛΗ, 2026-10-29, ADR-853 §13 ε.γ · N.0.2)

- **Κανόνες (μετά το κλείσιμο 2026-10-29)**: προθεσμία-**στιγμή** ⇒ `deadlineDaysLeft` (ceil, `null` αν πέρασε) ή
  `daysUntilOrNull` + `Math.ceil` όταν το παρελθόν δείχνεται · προθεσμία-**ημέρα** ⇒ `calendarDaysUntil`
  (`constants/platform-operator`, ημέρες ημερολογίου Αθήνας, προσημασμένο).
- **Όχι προθεσμίες — σκόπιμα εκτός**: `subapps/procurement/utils/quote-expiration.ts` `daysUntilExpiry` (`floor`,
  καταναλώνεται **μόνο** ως «έληξε πριν από Ν» = σημασία trunc)· το ιδιωτικό `resolveMs` του ίδιου αρχείου είναι
  όμως αντίγραφο του `normalizeToMillisOrNull` (μικρή μετάβαση, χωριστό βήμα) · `types/contacts/relationships/utils/helpers.ts`
  (διάρκεια σχέσης) · `useScheduleDashboard` `daysBetween` / `useResourceHistogram` / Gantt (διάρκειες).

### 🔔 AccountNotice — μετάβαση του χειρόγραφου κουτιού ειδοποίησης (προτεραιότητα ΧΑΜΗΛΗ, 2026-09-11)

- [ ] Το SSoT `src/components/account/AccountNotice.tsx` γεννήθηκε από κλώνο (CHECK 3.28, ADR-850) και
  καλύπτει ήδη `email-change/*`. Το **ίδιο** κουτί ζει χειρόγραφο σε `pages/SecurityPageContent.tsx`
  (×2, `message.type` success/error) · `pages/ProfilePageContent.tsx` (×1) · `TwoFactorEnrollment.tsx`
  (×2, **με εικονίδιο** + `flexCenterGap2` ⇒ θέλει προαιρετικό `icon` στο API, όχι δεύτερο component).
  ⚠️ Εκεί ο ρόλος ARIA γράφεται με το χέρι — στο SSoT **παράγεται** από τον τόνο.

### 🧭 ADR-849 Β1 — παράπλευρα του χώρου-στόχου των ειδοποιήσεων (προτεραιότητα ΧΑΜΗΛΗ, 2026-09-11)

- [ ] **Τέσσερα λεξιλόγια για «χώρος»** (μεγάλο, 4+ αρχεία, cross-cutting): `WorkspaceRef` (`'org'` ·
  `types/workspace-membership.ts`) · `WorkspaceOwner` (`'organization'` · `lib/workspace/workspace-segment.ts`)
  · `ListingCustody` (`'company'` · `lib/owner-property/listing-custody.ts`) · tenant scope (`'company'`).
  Σήμερα οι μεταφράσεις ζουν **μία φορά η καθεμιά** (`ownerOfWorkspace` · `custodyWorkspace`) — ενοποίηση
  του διακρίτη = απόφαση ADR-787, **όχι** σιωπηλό rename.
- [ ] **`components/shared/audit/audit-timeline-entry.tsx:55-70`**: 7 χειρόγραφες διαδρομές οντοτήτων
  χωρίς `encodeURIComponent` — και κάποιες ίσως **χωρίς σελίδα** (π.χ. `/contacts/${id}` ενώ οι επαφές
  ανοίγουν με `?contactId=`). Θέλει έλεγχο «υπάρχει σελίδα;» ανά διαδρομή → `ENTITY_ROUTES`.
- [ ] **`services/procurement/po-notification-service.ts`**: `eventId` με `Date.now()` ⇒ **όχι ιδεμποτές**
  (ίδια έγκριση δύο φορές = δύο ειδοποιήσεις) · τίτλος/σώμα ελληνικά στον διακομιστή (ίδιο δηλωμένο κενό
  με ADR-777 §8.22 #2).
- [ ] **Διαδρομές πλοήγησης γραμμένες με το χέρι σε ρυθμίσεις μενού**: το `APP_ROUTES.aiInbox`
  γεννήθηκε 2026-09-11, αλλά το `'/admin/ai-inbox'` μένει κυριολεξία σε `config/smart-navigation-factory.ts:551`
  · `components/admin/layout/AdminSidebar.tsx:108` · `config/jobs-registry.ts:319` — **μέσα σε λίστες
  όπου ΚΑΘΕ διαδρομή είναι κυριολεξία** (`'/crm'`, `'/admin/operator-inbox'`…). Μερική αλλαγή μίας
  γραμμής θα έφτιαχνε ασυνέπεια· η κλάση θέλει μητρώο διαδρομών πλοήγησης.
- [ ] **100 ειδοποιήσεις με εξωτερικό σύνδεσμο `http(s)` και χωρίς `meta.eventType`** (μετρημένο
  2026-09-11, `notifications:destination-drift`) — ποιος τις γράφει; (seed / error-report;) Εκτός χώρου,
  άρα ανεπηρέαστες από το Β1.

### 🔍 ADR-849 Β1 — ευρήματα της ζωντανής επαλήθευσης (2026-09-11 17:33–17:56Z, build `f6a915bb`)

- [x] ✅ **(ΥΨΗΛΗ) Ο ιδιωτικός χώρος στο API — ΦΑΣΗ Α ΕΚΛΕΙΣΕ 2026-09-12** *(ADR-787 §5.3 ζ + §9, γραμμή 2026-09-12)*.
  Ρητή δήλωση χώρου σε **κάθε** αίτημα (`Nestor-Workspace: org:<id> | personal | default`, μία γραμματική στα δύο
  άκρα)· ο κριτής του συνόρου αρνείται `personal` με **403 `MISSING_TENANT`** πριν τον handler· τα **δύο** δόγματα
  λίστας (ADR-356 · ADR-702) ρωτούν πλέον τη δήλωση· το `/o/me/<τομέας>` **307** στον χώρο του ανθρώπου. 77 tests,
  9/9 μεταλλάξεις. ⚠️ **Χωρίς commit** — τα κάνει ο Giorgio.
- [ ] 🔴 **(ΥΨΗΛΗ) ΦΑΣΗ Β του ίδιου ορίου — «η απουσία δήλωσης γίνεται άγραφτη»**: αρχεία πελάτη καλούν ωμό
  `fetch('/api/…')` και **δεν δηλώνουν χώρο ποτέ** — με βάρος στο `src/subapps/accounting/**` και
  `src/subapps/procurement/**`, και πολλά διάσπαρτα (`BuildingDetails` · `project-details` ·
  `useLevelSceneLoader` · hooks αναφορών κ.ά.). Μετανάστευση στον `apiClient` **κατά τομέα** (2+ domains ⇒ N.8,
  χωριστή εντολή) **+ πύλη** με ratchet προς το **μηδέν**. Ο μετρητής της Φάσης Α τους ονομάζει **ένα προς
  ένα** στα ίχνη: `[AUTH_CONTEXT] workspace-undeclared` + `path`.
  🔴 **ΔΙΟΡΘΩΣΗ 2026-09-14 — ΔΥΟ ΛΑΘΗ ΣΕ ΑΥΤΗ ΤΗ ΓΡΑΜΜΗ, ΚΑΙ ΤΟ ΕΝΑ ΤΑΞΙΔΕΨΕ**:
  **(α)** Ο αριθμός έλεγε **«66»** και ήταν **λάθος**· χειρότερα, ήταν αντιγραμμένος από **σχόλιο κώδικα**
  (`lib/workspace/personal-workspace-surface.ts:14`) που το grep της απογραφής **ξαναμέτρησε ως κλήση** —
  η τεκμηρίωση του προβλήματος μετρήθηκε ως στιγμιότυπο του προβλήματος. Ξαναμετρημένο με **AST** +
  προσβασιμότητα από τις ρίζες `'use client'`: **114 αρχεία / 188 σημεία** λυμένα, **+43 / 46** όπου η
  στατική ανάλυση δεν αποφαίνεται. ⛔ **Ο αριθμός ΔΕΝ ξαναγράφεται εδώ** — επίτηδες: αυτή ακριβώς η γραμμή
  απέδειξε ότι αριθμός σε πρόζα **παλιώνει και ταξιδεύει**. Ζει στο ADR-787 §9 (2026-09-14) με τη μέθοδο δίπλα.
  **(β)** Έλεγε *«ο κανόνας ESLint `no-restricted-syntax` υπάρχει ήδη στο repo»* — **ΨΕΥΔΕΣ**, μετρημένο:
  στοχεύει **`as any` και μόνο** (`eslint.config.mjs:80-83`)· το `eslint-rules/` έχει μόνο i18n/console/sonner.
  **Κανένας κανόνας για `fetch` δεν υπάρχει** ⇒ η πύλη δεν είναι το *ισχυρότερο* όργανο, είναι το **ΜΟΝΑΔΙΚΟ**.
  ✅ **Β1 + Β2 ΕΚΛΕΙΣΑΝ 2026-09-14** (τα δύο προϋπάρχοντα σφάλματα, **πριν** τη μετανάστευση ώστε να μην τα
  κρύψει): `useScanQueue` *(σάρωση που πετύχαινε και έλεγε «timeout» επί 60″ — 4 άγκυρες, 3/3 μεταλλάξεις)* ·
  `useInvoices` *(νεκρό λάθος δίδυμο — διαγράφηκε)*. Λεπτομέρειες: ADR-787 §9.
- [ ] 🔶 **ΦΑΣΗ Γ του ίδιου ορίου**: όταν ο μετρητής `workspace-undeclared` μείνει **μηδέν** για μετρημένο διάστημα
  (πρότυπο GKE: ενεργοποίηση μόνο μετά από μηδενική χρήση), η **απουσία** δήλωσης γίνεται **άρνηση** στις εταιρικές
  διαδρομές και η αποσυρόμενη κεφαλίδα `x-super-admin-company-id` **διαγράφεται** μαζί με το κανάλι `http-header`
  του `.workspace-authority.json` (RFC 8594 `Sunset`, δεύτερο στάδιο). ⛔ ΜΗΝ τη σβήσεις όσο ο μετρητής
  `workspace-header-legacy` δεν είναι μηδέν.
- [ ] 🔶 **Απόφαση προϊόντος (ADR-748): κρύβει η πλοήγηση τους γραφειακούς τομείς μέσα στο `/o/me`;** Σήμερα **δεν
  χρειάζεται**: το middleware ανακατευθύνει πριν αποδοθεί σελίδα, άρα κανείς δεν στέκεται εκεί. Κρύψιμο θα **άδειαζε
  το πλαϊνό μενού** — και το ερώτημα «τι προσφέρει ο ιδιωτικός χώρος ως **επιφάνεια**» είναι το ίδιο με το 🔶 *«ο
  ιδιωτικός χώρος έχει ΔΥΟ σπίτια»* (`(me)` + `/o/me`) του ADR-787 §5.3. Το κλειστό σύνολο υπάρχει και είναι **κενό
  με γραμμένο λόγο**: `lib/workspace/personal-workspace-surface.ts`.
- [ ] 🔶 **Τρεις ΚΟΚΚΙΝΕΣ άγκυρες που βρέθηκαν στο πέρασμα (ΔΕΝ είναι της Φάσης Α — μετρημένο)**: `workspace-segment`
  Κ10/Κ10β ζητούν από το δίχτυ (`(app)/[...unprefixed]/page.tsx`) το `workspaceSegmentFor`, που **μετακόμισε** στο
  `workspace-destination.ts` ⇒ άγκυρα καρφωμένη σε παλιά θέση (θεραπεία ~2 γραμμές)· `identity-provenance` Σ1 ζητά
  `isSyntheticIdentity` από το `admin/role-management/users/route.ts`, που **ξαναγράφτηκε** στο ADR-660
  (`61eece57`)· `identity-remediation` Θ1.2 διαφωνία αντικειμένου. **Δεν τις άγγιξα**: αφορούν αρχεία άλλης εργασίας
  (και το δέντρο είναι κοινό).
- [ ] 🔶 **503 στο αίτημα RSC κάθε πλοήγησης πελάτη προς `/n/{id}` που ανακατευθύνει** (2/2 μετρημένα· στη μία και
  στο επόμενο RSC του προορισμού)· ο προορισμός φτάνει **σωστά**. Έλεγχοι: απλή πλοήγηση ⇒ 200 · RSC στο
  `/n/<ανύπαρκτο>` ⇒ 200 · μετά από κάθε 503 στέλνεται envelope στο Sentry. Επόμενο: το event στο Sentry, ή δοκιμή RSC σε
  δική μας ειδοποίηση (⚠️ **γράφει** «ανοίχτηκε» ⇒ θέλει «ναι» του Giorgio).
- [ ] 🔶 **Ωμά κλειδιά i18n στο SSR stream του συνδεδεμένου χρήστη**: στο `/o/<εταιρεία>/properties` το
  `div#S:0[hidden]` περιέχει το άδειο `PropertyGridView` με `grid.emptyState.title/subtitle` ωμά — το κλειδί **υπάρχει**
  στο `el/properties.json`, λείπει το namespace από το SSR. Αόρατο (`checkVisibility: false`), αλλά **τυφλό σημείο του
  CHECK 3.51**: το oracle βλέπει τη διαδρομή ως `surface-shell-only`.
- [ ] 🔶 **Παροδικό «Δεν βρέθηκαν ακίνητα» αντί για «φόρτωση»** στο `/o/<ΠΑΓΩΝΗΣ>/properties` μετά από επαναφόρτωση
  με ξένη «τελευταία εταιρεία» στο `localStorage` — 1 παρατήρηση στα 8″, **δεν** αναπαράχθηκε σε 3 ελεγχόμενες.
- [ ] 🔶 Η δημόσια αγγελία `/listing/prop_ef2eaebd…` (τρισδιάστατα μοντέλα) κράτησε τον renderer απασχολημένο >45″ (το
  `Runtime.evaluate` του CDP έληξε) — μία παρατήρηση, όχι μέτρηση απόδοσης.

### 🔐 ADR-813 §8 — Η ΑΡΧΗ ΤΗΣ ΔΙΑΧΕΙΡΙΣΗΣ: έξι ανοιχτά (προτεραιότητα ΥΨΗΛΗ, 2026-08-26)

**1. 🔴🔴 Ο ΚΩΔΙΚΑΣ ΕΦΥΓΕ ΗΔΗ — ΠΡΑΞΗ ΠΑΡΑΓΩΓΗΣ ΠΡΙΝ ΤΟ PUSH.** Ο πελατικός αναγνώστης της λίστας email **έχει ήδη αφαιρεθεί από τον κώδικα** (ADR-813 §7.4, commit 2026-08-26) — άρα η σειρά «πρώτα claims» ΔΕΝ τηρήθηκε. ☠️ **Το deploy χωρίς την εντολή παρακάτω κλειδώνει τον διαχειριστή έξω.** Ο
`pagonis.oe@gmail.com` (5.927 συνδέσεις) είναι διαχειριστής **αποκλειστικά** μέσω
`NEXT_PUBLIC_ADMIN_EMAILS` — το claim του **δεν** έχει `permissions` (μετρημένο στο Firebase
Auth, όχι στο έγγραφο). **Απόφαση Giorgio 26/08: `company_admin`.** Εντολή έτοιμη:

```
TARGET_UID=ITjmw0syn7WiYuskqaGtzLPuN852 TARGET_EMAIL=pagonis.oe@gmail.com \
TARGET_COMPANY_ID=comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757 TARGET_GLOBAL_ROLE=company_admin \
node scripts/set-user-claims-direct.js
```

✅ **Η ΕΝΤΟΛΗ ΕΤΡΕΞΕ (26/08 09:13, επαληθευμένο στο Firebase Auth)**: `globalRole: company_admin` · `permissions: ["admin_access"]` · `mfaEnrolled: **true** (διατηρήθηκε)` · **168 bytes**. Το έγγραφο `users` και το claim **συμφωνούν** ⇒ η διαφωνία του ADR-813 §2 έκλεισε.

✅ **ΚΑΙ ΤΑ ΔΥΟ ΕΛΑΤΤΩΜΑΤΑ ΤΟΥ `/api/admin/set-user-claims` ΔΙΟΡΘΩΘΗΚΑΝ** (ADR-813 §7.3): η παλιά προειδοποίηση «μην το χρησιμοποιήσεις» **έπαψε να ισχύει** — το claim κρατά πλέον μόνο extras (**1.585 → 168 bytes**· ήταν **δύο** οι ρόλοι που δεν χωρούσαν, όχι ένας) και το `mfaEnrolled` **διατηρείται**. ⚠️ Απομένει **μόνο** το β᾽ σκέλος: η αφαίρεση της λίστας email.

**2. 🔴 Τα δύο ελαττώματα του `set-user-claims` (ADR-813 §7).** Η αντιγραφή των role
permissions είναι **καθαρός πλεονασμός**: **και οι δύο** κριτές τα παράγουν ήδη
(`authority.ts` βήμα 6 · `permissions.ts:237`). Θεραπεία: το claim κρατά **μόνο extras**.
⚠️ Αλλαγή **σημασιολογίας εξουσιοδότησης** — θέλει δικές της άγκυρες.

**3. 🔶 `initializeApp` σε 69 scripts, `admin.credential.cert` σε 44** *(μετρημένο 26/08)*.
Το ADR-813 §6.3 έφτιαξε το SSoT (`scripts/_shared/firebaseAdminOps.js`) και μετανάστευσε τα
**10** στην ακτίνα της δουλειάς (`loadServiceAccount` **7 αντίγραφα / 4 εκδοχές → 0**).
⚠️ Τα υπόλοιπα ~34 **δεν** αγγίχτηκαν: μηχανική αλλά μεγάλη σάρωση, και τα περισσότερα είναι
migration scripts που δεν μπορούν να δοκιμαστούν χωρίς παραγωγή. **Θεραπεία ανά αρχείο**:
`const { auth, db } = initAdminApp(admin);`. Άγκυρα `Σ1` του
`scripts/__tests__/ops-firebase-admin.test.js` κρατά το `loadServiceAccount` στο **μηδέν**.

**4. 🔶 Πέντε πανομοιότυπες δηλώσεις `TooltipProvider`** (μία ανά route group, ADR-813 §6.4).
Η σωστή θεραπεία είναι **μία στη ρίζα** (`src/app/layout.tsx`)· δεν έγινε γιατί το αρχείο το
κρατούσε άλλος πράκτορας και η βλάβη ήταν **ζωντανή**. Η άγκυρα
`src/app/__tests__/tooltip-provider-coverage.test.ts` διαβάζει **και τη ρίζα**, ώστε η
μετακόμιση να **μην** κοκκινίσει πάνω στη θεραπεία.

**5. 🔶 Το υποσύστημα `src/services/security/` έμεινε ΟΡΦΑΝΟ** (ADR-813 §7.4). Κόβοντας
τον `checkUserRole`, τα **τρία** αρχεία (`EnterpriseSecurityService.ts` ·
`security-defaults.ts` · `security-types.ts`) έχουν **μηδέν** καταναλωτές. Το CHECK 3.19
τα ανέφερε ονομαστικά· η baseline πήγε **10 → 13** ώστε το χρέος να έχει **όνομα** αντί να
αποσυρθεί σιωπηλά. ⛔ **ΜΗΝ του δώσεις καταναλωτή** — το §5 μέτρησε **μηδενική** τομή
λεξιλογίου με τον κριτή (permissions ∅ · ονόματα ρόλων ∅). Οι δύο νόμιμες κινήσεις:
**διαγραφή** (μαζί με τη συλλογή `security_roles`, που έχει **0 έγγραφα**) — **απόφαση
Giorgio** — ή μετάφραση στο λεξιλόγιο του `decideCapability`, που απαιτεί **δέκατο**
λεξιλόγιο και το §5 απορρίπτει.

> ⚠️ **ΤΟ COMMIT ΤΗΣ ΦΑΣΗΣ Β ΧΡΕΙΑΣΤΗΚΕ `SKIP_DEADCODE_CHECK=1`, ΚΑΙ Ο ΛΟΓΟΣ ΓΡΑΦΕΤΑΙ ΕΔΩ.**
> Το CHECK 3.22 μπλοκάρει **τροποποίηση** αρχείου που ξέρει νεκρό, και προσφέρει δύο
> εξόδους: *«κάν' το import κάπου»* ή *«διάγραψέ το»*. Το ίδιο το commit **αφαιρεί** από
> το αρχείο το υποσύστημα ρόλων (γι' αυτό και το τροποποιεί), και **καμία** από τις δύο
> εξόδους δεν είναι πράξη που επιτρέπεται να γίνει ως παρενέργεια: το import θα ήταν
> **ψεύτικος καταναλωτής**, η διαγραφή είναι **απόφαση τομέα**.
> **Εκκρεμεί απόφαση Giorgio: διαγραφή ή διατήρηση.** Όσο εκκρεμεί, το χρέος ζει με
> **όνομα** στη baseline του 3.19 (10 → 13) και εδώ.

**6. 🔶 `claim-payload.ts` κρατά χειρόγραφη τετράδα ονομάτων ρόλων** (ADR-813 §7.3,
CHECK 3.68 baseline **9 → 10**). Το `ROLES_WITH_EXPLICIT_ADMIN_ACCESS =
['super_admin','company_admin']` έχει συνθήκη **ταυτόσημη** με την παραγωγή του
`ADMINISTRATIVE_ROLES` (`isRoleBypass ∪ admin_access` = **2 από 13**) — άρα είναι
**κατάλογος ονομάτων** εκεί που υπάρχει **παραγωγή** (ADR-703).
⚠️ **ΜΗΝ εισαγάγεις το `ADMINISTRATIVE_ROLES`**: εκείνο δηλώνει ρητά ότι είναι
**ΤΑΒΑΝΙ** («ποιος βλέπει την επιφάνεια;»), εδώ το ερώτημα είναι «τι γράφω στο
token;» — ένωση = δύο ερωτήματα με μία απάντηση (ADR-775 · CHECK 3.41). Η σωστή
κίνηση είναι **παραγωγή από τα ίδια πρωταρχικά** με δικές της άγκυρες. **Αλλάζει
τι γράφεται σε token εξουσιοδότησης ⇒ απόφαση Giorgio.**

### 🔗 ADR-779 §8 #4 — Πύλη ιχνηλασιμότητας ADR ⇄ SPEC (προτεραιότητα ΜΕΣΑΙΑ, 2026-08-09)

**Τι λείπει:** το CHECK 3.49 ρωτά «*απαντά ο αριθμός `ADR-NNN` σε **ένα** έγγραφο;*» με κριτήριο
`/^ADR-(\d+)/` ⇒ **τα `SPEC-*` είναι δομικά αόρατα**. Κανείς δεν ρωτά «*δηλώνει το παιδί τον γονέα
του, και τον **αναγνωρίζει** ο γονέας;*».

**Μετρημένο 2026-08-09** (`git ls-files`): **102** αρχεία `SPEC-*` σε **ΤΡΙΑ σπίτια** — **59**
`adrs/specs/` · **23** `ADR-268-dynamic-report-builder/` · **20** χύμα στη ρίζα `adrs/`. Είναι
**το ίδιο σχήμα** με τα **8 σπίτια ADR** του CHECK 3.49 (⇒ **73%** `cross-home`), **ένα επίπεδο
πιο κάτω και χωρίς καμία πύλη**. Στο **ADR-268**: hub→SPEC **39** αναφορές ✅ · SPEC→hub **1 στα
23** · **`SPEC-009` υπάρχει δύο φορές**.

**Τι υπάρχει ήδη:** το **ADR-777** σπάστηκε (2026-08-09) σε **8** αρχεία με πλήρες συμβόλαιο
δεσμών σε YAML frontmatter — `id`/`kind`/`parent`/`sections`/`links`, τέσσερα **αντίστροφα ζεύγη**
(`specified-by`⇄`specifies` · `researched-in`⇄`researches` · `discussed-in`⇄`discusses` ·
`recorded-in`⇄`records`), πρότυπα **PEP 1 / MADR / ISO-IEC-IEEE 42010**. Είναι **η καλιμπραρισμένη
είσοδος** της πύλης: **7/102 συμμορφούμενα**.

**Πώς γίνεται:**
- **Επέκταση** του `scripts/lib/adr-identity/scan.js` — ⚠️ **ΟΧΙ δεύτερος σαρωτής ταυτότητας**
  (ADR-749). Αυθεντία: **το index του git**, όπως ήδη.
- Ανάγνωση **και** της παλαιάς μορφής δήλωσης (`| **ADR** | ADR-230 |`, σχήμα `SPEC-230A`) —
  αλλιώς η baseline φουσκώνει με αρχεία που **όντως** δηλώνουν γονέα.
- Καταστάσεις (κλειστή λογιστική, fail-closed): ⛔ `dangling-parent` · 🔴 `unparented-spec` ·
  🔴 `unacknowledged-child` · 🔴 `duplicate-spec-id` · ✅ `linked` / `linked-legacy`.
- ⚠️ **ΥΠΟΧΡΕΩΤΙΚΑ RATCHET** — zero-tolerance με 7/102 = μονίμως κόκκινο ⇒ `SKIP_` ⇒ διακοσμητικό
  (δοκιμάστηκε και απορρίφθηκε στο CHECK 3.39).
- ⚠️ **ΜΗΝ** μετονομάσεις το διπλό `SPEC-009` του ADR-268 χωρίς τις αναφορές του· είναι **άλλη**
  δουλειά και ανήκει στο ADR-268.

**Γιατί δεν έγινε τώρα:** το αίτημα ήταν το **σπάσιμο**. Η πύλη είναι δική της φάση (σαρωτής +
baseline + ~30 tests + job σε υπάρχον workflow). Δηλώνεται **ρητά** στο **ADR-777 §8.3** και στο
**ADR-779 §8 #4** ώστε να μη διαβαστεί ως «έγινε».

---

### 🔐 ADR-711 — keyboard scope: ο ratchet ΕΚΛΕΙΣΕ· μένει η μετανάστευση (priorità ΜΕΣΑΙΑ, 2026-07-26)

✅ **DONE — ο ratchet είναι ΕΝΕΡΓΟΣ, σε δύο όργανα (2026-07-26, Opus 5· UNCOMMITTED).** Το ζητούμενο
επιτεύχθηκε **χωρίς** `ssot:baseline` και **χωρίς** ήσυχο δέντρο, αλλάζοντας ποιο όργανο φυλάει τι:
**(Α)** registry module `modal-keyboard-scope` (tier 2, `ssotFile: src/lib/a11y/keyboard-scope.ts`)
που απαγορεύει **re-implementation** των predicates — **μηδέν ευρήματα εκτός allowlist**, άρα καμία
ανάγκη για κοινό baseline (ίδιο κόλπο με το `impact-guard-hook`/ADR-664· `test:registry-golden`
**96/96**)· **(Β)** structural jest anchor
`src/subapps/dxf-viewer/keyboard/__tests__/raw-keydown-listener-ratchet.test.ts` που ratchet-άρει τον
**πληθυσμό** των ωμών listeners (`BY_DESIGN` 10 με λόγο ανά εγγραφή + `PENDING_MIGRATION` **27**),
πιάνει **και τις δύο** κατευθύνσεις (νέο αρχείο ονομαστικά / μπαγιάτικη εγγραφή) και έχει φύλακα
κενής σάρωσης. **Mutation-verified ×2.** ⚠️ **Η αιτία των «22 λεπτών» βρέθηκε**: το
`scripts/ssot-audit.sh` κάνει ένα full-`src` `grep -rE` **ανά module** × **349 modules** — O(modules ×
files), όχι κρέμασμα. Πλήρη δεδομένα: **ADR-711 §5**.

- [ ] **Μετανάστευσε τους υπόλοιπους **27** global accelerators σε `addGlobalShortcutListener`**
  (Boy-Scout στο άγγιγμα, N.0.2). **Η λίστα ζει πλέον στον κώδικα** — `PENDING_MIGRATION` στο
  `raw-keydown-listener-ratchet.test.ts`· μεταναστεύεις ένα, σβήνεις τη γραμμή του, το test σε
  αναγκάζει. Μεταναστευμένοι: `use3DShortcuts`, `useKeyboardShortcuts`, `use2DKeyboardFocus`,
  `useBimMaterialCycler`, `use-column-anchor-tab-cycle`, `useFoundationTool`,
  `useDimensionKeyboardRouting`, **`useLayerCommandShortcuts` (2026-07-26)**.
  ⚠️ **ΜΗΝ** μεταναστεύσεις listeners που ανήκουν σε input/overlay (Dynamic Input, Command Line, Radial
  ring) ούτε το `escape-bus`: εκεί ο φύλακας θα ήταν **παλινδρόμηση** — βλ. ADR-711 §3.5.

- [ ] **Απομένουν 5 αντίγραφα του predicate «γράφω σε πεδίο;»** (επαληθευμένα ζωντανά 2026-07-26):
  `useDimToolRouting.ts:168`,
  `use-polygon-sketch-chain.ts:217`, `use-wall-tool-event-listeners.ts:152`, `useStairTool.ts:295`,
  `useGripSpacebarCycle.ts:65` (inline μορφές — το CHECK 3.7 πιάνει μόνο τις **ονομασμένες**
  `function foo(`). Αντικατάσταση με `isEditableTarget` από `@/lib/a11y/keyboard-scope`.
  ✅ `useLayerCommandShortcuts.ts:47` **έγινε** (2026-07-26): ο τοπικός `isInputFocused` σύγκρινε
  `contenteditable` με τη συμβολοσειρά `'true'` ⇒ έχανε `contenteditable=""` **και** το κληρονομημένο.

- [ ] **ΖΩΝΤΑΝΗ ΜΕΤΡΗΣΗ ΠΟΥ ΕΚΚΡΕΜΕΙ (ADR-364 §10.15.Δ)**: ότι το ESC της λίστας @-mention δεν τυπώνει
  πλέον `SHADOW-OWNER`. Απαιτεί επιλεγμένο έργο· το `ProjectHierarchyContext` μηδενίστηκε **2×** από HMR
  remount του παράλληλου agent. Επανάλαβε όταν δεν τρέχει άλλος agent.


### 💾 `@/lib/storage` vs `dxf-viewer/utils/storage-utils` — **ασύμβατα συμβόλαια** JSON vs raw (priorità media, cross-cutting, 2026-07-29 via CHECK 3.28 στο ADR-724 Φ2)

**✅ Το διπλότυπο ΔΙΟΡΘΩΘΗΚΕ επιτόπου (N.0.2, ίδιο commit).** Το `isStorageAvailable()` ήταν
byte-identical στα δύο αρχεία — δύο write-probes για μία αλήθεια. Πλέον εξάγεται από το
`src/lib/storage/safe-storage.ts` και το `storage-utils.ts` το **εισάγει**. Το `jscpd:diff` στα
δύο αρχεία **μαζί** είναι πράσινο. Ήταν 10 γραμμές / 2 αρχεία ⇒ ανήκε στο «διόρθωσέ το τώρα».

- [ ] **Ό,τι ΑΠΟΜΕΝΕΙ δεν είναι διπλότυπο — είναι δύο ασύμβατα συμβόλαια, και είναι παγίδα:**
  - `storageSet` (subapp) κάνει **πάντα** `JSON.stringify` ⇒ το `'mm'` γράφεται `"mm"`.
  - `safeSetItem` (κοινό) αποθηκεύει τα strings **ωμά** ⇒ το `'mm'` γράφεται `mm`.
  - Άρα «ας ενοποιήσουμε τα δύο modules» **αλλάζει τη μορφή στον δίσκο**: το `storageGet` κάνει
    `JSON.parse('mm')` → throw → σιωπηλή επιστροφή στην προεπιλογή. **Κάθε αποθηκευμένη
    προτίμηση-string κάθε χρήστη χάνεται**, χωρίς σφάλμα, σε 32 αρχεία που εισάγουν το module.
  ⛔ **ΜΗΝ το «κεντρικοποιήσεις» ως μηχανική εργασία.** Χρειάζεται απόφαση μετανάστευσης
  (dual-read: δοκίμασε JSON, πέσε πίσω σε raw) + έκδοση κλειδιών. Cross-cutting, >4 αρχεία,
  2 domains ⇒ **ΟΧΙ inline** (N.0.2). Το κοινό επίσης **δεν** έχει `storageHas`/`storageGetString`.

### 🔴 API CRUD routes — parking/storages/properties σε `defineRoute` + **ΚΕΝΟ ΑΣΦΑΛΕΙΑΣ storages** (priorità ΑΛΤΗ για το σκέλος ασφαλείας· 2026-07-16, N.18/ADR-584 jscpd)

**Βρέθηκε** τρέχοντας full `jscpd:check` κατ' εντολή Giorgio (11 clones / 643 tokens μεταξύ `api/parking/**` και `api/storages/**`). **Αποσύρθηκε ρητά** από τη φουρνιά de-duplication — δεν είναι ασφαλές refactor:

**1. 🔴 SECURITY — να αποφασίσει ο Giorgio ΠΡΩΤΑ (αυτό ΔΕΝ είναι refactor, είναι αλλαγή συμπεριφοράς):**
Το `storages` και το `parking` **έχουν αποκλίνει** στον έλεγχο tenant:
- `api/storages/route.ts` GET-list με `buildingId` → κάνει το Firestore query **ΠΡΩΤΑ** και φιλτράρει tenant **in-memory μετά** (`s.companyId===ctx.companyId`). Το `api/parking/route.ts` καλεί `requireBuildingInTenant` (κεντρικό, throws `TenantIsolationError`) **πριν** το query.
- `api/storages/route.ts` **POST** → **δεν ελέγχει καθόλου** tenant στο `projectId` όταν λείπει `buildingId`. Το parking κάνει ρητό fetch του `PROJECTS` doc + `companyId` check → 404/403.
- ⚠️ Ένα κοινό factory θα **«διόρθωνε» σιωπηλά** τη χαλαρότερη συμπεριφορά του storages. Αυτό είναι απόφαση ασφαλείας, **όχι** παρενέργεια de-duplication. **ΜΗΝ** το περάσεις κρυφά μέσα σε refactor.

**2. Το SSoT υπάρχει ΗΔΗ — μην φτιάξεις νέο factory:** `src/lib/api/define-route.ts` (**ADR-602**), υιοθετημένο σε **59 αρχεία** (όλα τα `accounting/*` + `procurement/*`). Συνθέτει rate-limit → `withAuth` → try/catch → `safeParseBody` → envelope. Η σωστή δουλειά = **migration**, όχι νέο abstraction.

**3. Είναι 3 οικογένειες, όχι 2:** το `api/properties/[id]/route.ts` (295 γρ.) έχει **τον ίδιο ακριβώς σκελετό** (`requirePropertyInTenantScope` + `withVersionCheck` + `linkEntity('property:buildingId')` + `softDelete` + `extractIdFromUrl`). Κεντρικοποίηση μόνο για parking+storages = **σίγουρη επανάληψη της δουλειάς**.

**4. Μηδενικά tests:** κανένα `*.test.ts` σε parking/storages/properties routes (σε αντίθεση με `accounting/__tests__/adr603-batch-*.route.test.ts` που καλύπτουν τους `defineRoute` adopters). Οποιοδήποτε shared-factory refactor είναι σήμερα **αφύλαχτο** → τα tests πάνε ΠΡΩΤΑ.

**5. Μέρος των clones ΔΕΝ αφαιρείται:** `parking|storages/[id]/showcase/email/route.ts:52-64` = το **υποχρεωτικό Next.js route-segment adapter** (`export async function POST` + `route.handle`). Ήδη πάνω στο `createShowcaseEmailRoute` factory. Ίδιες 8 γραμμές σε properties/buildings/projects. Δεν αξίζει άλλο abstraction.

**Παραμετροποίηση (αν/όταν γίνει):** collection (`PARKING_SPACES`/`STORAGE`), tenant fn (`requireParkingInTenant`/`requireStorageInTenant`), link key (`parking:buildingId`/`storage:buildingId`), softDelete/createEntity type, audit label (`parking_spot`/`storage`), display field (`number`/`name`), Zod-only πεδία (parking: `locationZone` enum+`projectId` · storage: `floorId`).

- ✅ **ADR-407 RAILING 2D hit-testing gap + ENTITY-BOUNDS 3 παράλληλα switch: ΗΤΑΝ ΗΔΗ ΔΙΟΡΘΩΜΕΝΑ — οι εγγραφές ήταν παρωχημένες (επαληθεύτηκε 2026-07-16, Opus 4.8).** Ο έλεγχος έγινε **πριν** ξεκινήσει δουλειά (memory: recalled note ≠ τρέχων κώδικας):
  - **(1) `HitTestingService.convertToEntityModel()` ΔΕΝ ΥΠΑΡΧΕΙ ΠΛΕΟΝ** — το **ADR-587 Φ10** έκλεισε το «σιωπηλό seam»: το `switch` με `default → baseModel` (που πετούσε αθόρυβα τα γεωμετρικά πεδία → μηδέν hover/κλικ) αντικαταστάθηκε από **πλήρες `Record<DxfEntityUnion['type'], HitTestModelHandler>`** (`hit-test-entity-model.ts`) → νέο variant χωρίς handler **σπάει στο tsc, όχι στο runtime**. Το ADR ονομάζει ρητά το `railing` ως έναν από τους τύπους που είχαν χαθεί έτσι.
  - **(2) `selection-duplicate-utils.calculateEntityBounds` δεν έχει switch** — είναι thin adapter πάνω στο `resolveEntityBounds` (**ADR-587 Φ9 Slice 1**). Το σχόλιο του αρχείου: «railing … which used to return null here … are finally window/crossing-marquee selectable».
  - **(3) Και οι 3 bounds calculators ΣΥΓΚΛΙΝΑΝ** στο `rendering/hitTesting/entity-bounds-ssot.ts` (zoom/`bounds.ts` + selection/`selection-duplicate-utils.ts` + hitTesting/`Bounds.ts`) → το «πρέπει να μένουν συγχρονισμένοι χειροκίνητα» **έπαψε να ισχύει**. Υπάρχει και `bounds-twins-coverage.test.ts` που τα δένει: **25/25 GREEN**.

- ✅ **`FitToViewService` — διπλότυπο scale/guard math σε 2 μεθόδους: DONE (2026-07-16, Opus 4.8, N.18 + ADR-584· UNCOMMITTED).** Το `calculateFitToViewTransform` κατέχει πλέον **μόνο** το bounds resolution και **delegate-άρει** στο `calculateFitToViewFromBounds` = το SSoT των μαθηματικών. **334 → 237 γρ.**· public API αμετάβλητο (5 καταναλωτές άθικτοι). **Το scene-based δίδυμο ήταν ΑΤΕΣΤΩΤΟ** — γι' αυτό το ADR-394 degenerate fix είχε μπει μόνο στο ένα → **ΝΕΟ `FitToViewService-twin-parity.test.ts`** (16 tests, `describe.each` σε 6 σχήματα bounds × 2 option sets: τα δύο μονοπάτια πρέπει να συμφωνούν) + **mutation-verified** (αφαίρεσα το `options` από το delegate → 6 tests έσπασαν → revert). **430/430 GREEN· `jscpd:diff` καθαρό ΧΩΡΙΣ `SKIP_JSCPD_DIFF`.** **ΟΧΙ tsc (N.17).** 🔴 Giorgio commit: `FitToViewService.ts` + test NEW + ADR-584 + αυτό το αρχείο.

### 🔥 CRITICAL PATH (Scenario A — ~21h expected)



### 🏗️ FEATURE PENDING — ADR-345 DXF Ribbon Interface

**ADR:** `docs/centralized-systems/reference/adrs/ADR-345-dxf-ribbon-interface.md`
**Bridge hook:** `src/subapps/dxf-viewer/ui/ribbon/hooks/useRibbonTextEditorBridge.ts`
**Data decl:** `src/subapps/dxf-viewer/ui/ribbon/data/contextual-text-editor-tab.ts`

#### Fase 5.5 — comingSoon stubs (priorità media)

#### Fasi future ADR-345 (in ordine)

---

---

### 🪜 ADR-358 STAIR DOMAIN — pre-existing TS residual (priorità bassa)


---

### 🔧 BIM GRIP GEOMETRY — shared module extraction (priorità media, ~2-3h, cross-cutting)

**Discovered 2026-05-28** (ADR-393 stair extended grips SSoT review). Τα 3 BIM grip families (`bim/walls/wall-grips.ts`, `bim/beams/beam-grips.ts`, `bim/stairs/stair-grip-{math,transforms}.ts`) αντιγράφουν τα ίδια primitives αντί να μοιράζονται SSoT:

1. **`project2D(p3): Point2D`** (`{x:p3.x, y:p3.y}`) — αντίγραφο σε wall-grips + beam-grips + stair-grip-math. 1-liner αλλά 3×.
2. **`unitAxis`/`perpUnit` family** — wall+beam έχουν δικά τους `unitAxis(params)` + `perpUnit(u)`. Το stair πλέον καταναλώνει `directionToUnitVector`/`perp` από `stair-geometry-shared.ts` (ADR-393 fix). wall/beam ΟΧΙ ακόμη.
3. **Asymmetric corner decompose+recenter math** — `wall-grips.ts:moveCorner` και `stair-grip-transforms.ts:moveCorner` είναι ο ΙΔΙΟΣ αλγόριθμος (axial/perp split + symmetric thickness/width grow + axis recenter), σε διαφορετικά param shapes. Extractable σε generic `decomposeCornerDrag(delta, u, p) → {axial, perp}` + `applySymmetricResize(...)`.
4. **scene-floor heuristic** — `minWidthFloorFor` (stair) vs `minThicknessFloorFor`/`maxThicknessCeilingFor` (wall). Width-heuristic family (βλ. την προειδοποίηση στο docblock του `mmScaleFor`, `utils/scene-units.ts`) — δεν είναι `mmScaleFor` αλλά μπορεί να γίνει ένα shared `physicalFloorFor(value, mm)`.

**Fix**: νέο `bim/grips/shared/bim-grip-geometry.ts` (project2D + decomposeCornerDrag + applySymmetricCornerResize + physicalFloorFor), consumed από wall/beam/stair. **Γιατί pending (όχι on-the-spot)**: >1h, 4+ files, ΚΑΙ το `wall-grips.ts` είναι σε parallel uncommitted flux (2026-05-28 positions-from-geometry fix) → extraction τώρα = merge conflict risk. Κάνε το αφού σταθεροποιηθεί το wall.

- [ ] Δημιούργησε `bim/grips/shared/bim-grip-geometry.ts` με τα 4 primitives
- [ ] Migrate wall-grips + beam-grips + stair-grip-{math,transforms} να καταναλώνουν
- [ ] `.ssot-registry.json` entry `bim-grip-geometry` (forbid re-impl `project2D`/corner-decompose εκτός module)
- [ ] Tests + metre-scene regression για κάθε family

### 📐 ADR-393 stair grip purity follow-up (priorità bassa, ~30min)

**Discovered 2026-05-28** (ίδιο review). Τα stair corner positions (G5-G8) στο `getStairGrips` derive από `params.width`/`totalRun`/`basePoint` — scene-units **by construction** (builder κλιμακώνει), άρα **όχι active bug**. Αλλά ο κανόνας [[feedback-grip-positions-read-geometry]] προτιμά read από `geometry.stringers`. Επίσης το `DIRECTION_GRIP_OFFSET_MM` στο G1 (direction) ήταν latent unit-unsafe — **fixed** μέσω `mmFactorFromWidth` (ADR-393 §8.1). Purity item:

- [ ] Corner positions G5-G8 → read από `geometry.stringers.outer/inner` endpoints (perp-sign left/right classify) αντί raw params, με raw fallback (mirror G2/G3 pattern). Verify με metre-scene test.

---

### 🎨 ADR-365 TAILWIND SEMANTIC PALETTE ENFORCEMENT (priorità alta, ~5h totali, 9 φάσεις)

Discovered 2026-05-19 (hover audit follow-up). ADR: `docs/centralized-systems/reference/adrs/ADR-365-tailwind-semantic-palette-enforcement.md`

**Status:** PHASE 8 SALES DONE 2026-05-22. Baseline: 620/167. Per-phase handoff απαιτείται πριν από κάθε νέα session.


**ADR-365 FULLY COMPLETE — all 9 phases done. Baseline = 0 violations / 0 files.**

---

### 🧭 ADR-3XX (TBD) — AUTO-INFER ALIGNMENT GUIDES (priorità bassa, ~3h, discovered 2026-05-19 via SPEC-3D-004C)

**Discovered**: 2026-05-19 κατά τη διερεύνηση SPEC-3D-004C (GenArc Utils/Snap/Picking). Το GenArc `resolveSnapV2.ts:61-104` έχει αυτόματη "smart guides" λογική (Revit/AutoCAD-style) που το Nestor **δεν έχει**.

**Gap επιβεβαιωμένο** (3 engines grep):
- `GuideSnapEngine.ts` → μόνο explicit guides από `GuideStore` singleton.
- `OrthoSnapEngine.ts` → χρειάζεται explicit `referencePoint` (lastPoint draw flow).
- `ParallelSnapEngine.ts` → reference **lines**, όχι arbitrary points.

**Συμπεριφορά που λείπει**: όταν ο κέρσορας είναι ≤35cm από κάποιο wall/beam endpoint ή midpoint ή column corner/center → αυτόματη γαλάζια διακεκομμένη γραμμή στοίχισης (vertical ή horizontal), **χωρίς** χρειαζόμενο explicit guide από τον χρήστη.

**Όροι Γιώργου (επιβεβαιωμένοι 2026-05-19)**:
1. ✅ Δεν υπάρχει στο Nestor (επιβεβαιωμένο grep)
2. ✅ Θα βοηθήσει (Revit/AutoCAD industry standard)
3. ✅ Add-only — δεν σπάει υπάρχοντα systems (opt-in flag στα `SnapPresets`, lower priority από Endpoint, cap ≤2 inferred guides)
4. ✅ Πλήρως SSoT-ενσωματωμένο

**Architecture sketch (όταν προχωρήσει)**:
- Νέο module `snapping/services/InferredAlignmentService.ts` (Tier 3 SSoT) που εκθέτει `getAlignmentAnchors(scene): Point2D[]`.
- Reads BIM scene SSoT (`bim/`) — **όχι re-implementation** anchors. Anchors source: wall.start/end/midpoint + beam.start/end/midpoint + column.position + column.4 corners.
- Νέα `private addAutoInferredAlignmentCandidates()` στον `GuideSnapEngine.ts`, opt-in μέσω `SnapPresets.setArchitecturalPreset({ inferAlignment: true })`.
- Lower `priority` από `EndpointSnapEngine` (να μην κλέβει snap από explicit endpoints).
- Cap ≤2 inferred guides per frame (1 vertical + 1 horizontal).
- Tolerance 35cm (parameter στο preset).
- Tests: 2-3 jest cases (cursor near wall endpoint → guide emitted, cursor far → no guide, multiple anchors → best two selected).

**SSoT registry entry (when implemented)**:
```json
"inferred-alignment-service": {
  "tier": 3,
  "canonical": "src/subapps/dxf-viewer/snapping/services/InferredAlignmentService.ts",
  "forbiddenPatterns": ["wall\\.start.*Math\\.abs.*cursor", "alignment.*infer.*inline"]
}
```

**Effort**: ADR proposal ~1h + implementation ~2h + tests ~30min. **Total: ~3-3.5h.** Δεν blocks το ADR-366.

- [ ] Γράψε ADR proposal (επόμενος ελεύθερος αριθμός — αν ADR-366 PROPOSED παραμένει 5-19, ίσως ADR-367 ή επόμενος διαθέσιμος).
- [ ] Implementation `InferredAlignmentService` + `GuideSnapEngine` enhancement.
- [ ] Tests + SSoT registry entry.
- [ ] Boy Scout: όλα τα Architectural presets ενεργοποιούν `inferAlignment: true` by default.

---

### 📅 ADR-034 GANTT — Phase 4 pending items (construction tracking)

**ADR:** `docs/centralized-systems/reference/adrs/ADR-034-gantt-chart-construction-tracking.md`
**ADR-266:** `docs/centralized-systems/reference/adrs/ADR-266-gantt-construction-reports.md`
**Gantt dir:** `src/components/building-management/tabs/TimelineTabContent/gantt/`
**Hooks dir:** `src/components/building-management/hooks/construction-gantt/`

**ADR-034 αλλαγμένο (χωρίς commit) — status line + Phase 4 table + ADR-266 cross-ref + changelog.**

- [x] **4.6 AI integration UC-017** ✅ DONE 2026-05-23 — UC-017 module 11 source files + 4 tests (41 pass). 6 features FAST/QUALITY/VISION. `src/services/ai-pipeline/modules/uc-017-gantt-ai/`. Intent `ADMIN_GANTT_AI` + registered.
  - Τελευταίο στη σειρά — δεν μπλοκάρει 4.8/4.5

**Προτεινόμενη σειρά:** 4.8 ✅ → 4.5 ✅ → 4.6

---

### 🧹 FULL ZERO BACKLOG (Scenario B extras — +~43h expected)




---

### 🧱 ADR-373 ISO 19650 — Phase 2 deferred items (priorità media, ~10-15h totali, discovered 2026-05-24 via Phase 1 implementation)

**ADR**: `docs/centralized-systems/reference/adrs/ADR-373-iso19650-metadata-enrichment.md`

Phase 1 ✅ IMPLEMENTED 2026-05-24 (schema + AI enricher + tests + post-finalize hook). Φύλαξη για Phase 2 — επόμενες υλοποιήσεις:


**Effort**: ~13.5h totale per Phase 2 (additional al Phase 3 ZIP export).

---

### 🧹 ADR-370/371 DUPLICATE NUMBERING — ✅ IMPLEMENTED 2026-07-08 (Opus 4.8, **pending Giorgio commit**) — housekeeping (discovered 2026-05-24 via ADR-373 OQ8)

> **✅ RESOLVED 2026-07-08:** corner-snap doc renumbered **ADR-371 → ADR-597** (unique gap number· big-player immutable-number rule). Filesystem rename `ADR-370-bim-corner-snap-system.md` → `ADR-597-bim-corner-snap-system.md` (git rename-detection preserves blame). Redirect stub `ADR-371-bim-corner-snap-system.md` **deleted**. Refs updated same logical unit: adr-index (row + mirror + redirect row dropped), ADR-378 back-link, **42 src files** (code referenced the doc by BOTH `ADR-370` filename-number AND `ADR-371` internal-number → both → `ADR-597`· real blast radius > handoff's «24»), 9 auto-memory files + MEMORY.md index. ADR-371 now sole-owner = 3D Read-Only Viewer· ADR-370 sole-owner = Read-Only Visualization. **The proposal below (ADR-374/375) is superseded — kept as history.** Remove this whole block after Giorgio commits (N.13).

**Discovered**: 2026-05-24 durante ADR-373 Phase 1 Recognition (Glob verification del prossimo ADR libero).

**Πρόβλημα**: 4 αρχεία ADR με 2 collisione numerazione:
- `docs/centralized-systems/reference/adrs/ADR-370-bim-readonly-visualization.md`
- `docs/centralized-systems/reference/adrs/ADR-370-bim-corner-snap-system.md` ← duplicate
- `docs/centralized-systems/reference/adrs/ADR-371-bim-3d-readonly-viewer.md`
- `docs/centralized-systems/reference/adrs/ADR-371-bim-corner-snap-system.md` ← duplicate

**Effetto**: confusione nello index, ambiguità riferimenti incrociati, blocca uso di `adr-index.md` come SSoT.

**Fix proposto** (Γιώργος approval pending):
1. I due `corner-snap-system` ADRs sembrano duplicati l'uno dell'altro (stesso suffix). Verifica se sono lo stesso contenuto o due fasi diverse.
2. Se duplicati: cancella uno, l'altro rinomina come ADR-374 (next free dopo ADR-373).
3. Se distinti: rinomina ADR-370-bim-corner-snap-system.md → ADR-374, ADR-371-bim-corner-snap-system.md → ADR-375.
4. Grep tutti i riferimenti (`grep -rn "ADR-370\|ADR-371"` in docs/ + src/) e aggiorna.
5. Re-run auto-script per `adr-index.md`.

**⚠️ SCOPE CORRECTION (2026-07-08, Sonnet — blast-radius μετρήθηκε, ΟΧΙ «15min/low-risk»):**
- **Πραγματική σύγκρουση:** ΔΥΟ docs officially numbered **ADR-371** — `ADR-371-bim-3d-readonly-viewer.md` ΚΑΙ `ADR-370-bim-corner-snap-system.md` (έχει Note «officially numbered ADR-371, filename kept for git-blame»). Το `ADR-371-bim-corner-snap-system.md` = redirect stub (8γρ). Content-equal check: **DIFFERENT** (stub vs 1129γρ real doc).
- **Canonical:** `ADR-370-bim-readonly-visualization.md` = σωστό ADR-370. Το corner-snap (1129γρ, IMPLEMENTED, το ADR-398 το επεκτείνει) πρέπει να πάρει **μοναδικό ελεύθερο number**.
- **Blast radius (grep 2026-07-08):** 4 doc refs + **6 src refs** + **25 auto-memory refs** + adr-index 2 sections (γρ.362-365 + 945-947). ⚠️ **Fix proposto στάδια 2-3 STALE:** ADR-374/375 είναι ΠΙΑΣΜΕΝΑ· 600-604 πιασμένα· 605+ mint-άρονται ταυτόχρονα από άλλους agents → επιλογή number απαιτεί coordination (collision risk).
- **Ετυμηγορία:** cross-cutting docs+src+memory renumber → **dedicated planned session** (ΟΧΙ boy-scout, ΟΧΙ πάνω σε uncommitted work). Priorità bassa — δεν μπλοκάρει τίποτα (τα docs self-document το ADR-371 mapping μέσω Note+redirect).

- [ ] Renumber corner-snap → μοναδικό ελεύθερο ADR number (dedicated session· διάλεξε number με coordination) + update note/stub
- [ ] Update 4 doc + 6 src + 25 memory refs + adr-index 2 sections
- [ ] Re-run `adr-index.md` auto-script

---

## Short sentence for session-start reminder

**Copy-paste template for the agent:**

> 📋 Pending ratchet tasks (ADR-299): **ADR-365 Tailwind Palette ✅ COMPLETE** — 0 violations / 0 files (2026-05-22). Zero-tolerance via CHECK 3.26 active. Remaining pending: Grip Types SSoT, ADR-3XX Auto-Infer Alignment. (ADR-370/371 duplicate numbering ✅ IMPLEMENTED 2026-07-08 → corner-snap = ADR-597, pending Giorgio commit.) (**ADR-375 ✅ ALL PHASES COMPLETE 2026-05-26** — A+B+C.1+C.2+C.3+C.4+C.5+C.6+C.7 DONE + v2.6 V/G visibility runtime wiring hotfix, 3D BIM edge overlay parity Line2/LineMaterial, 38/38 edge tests + 76/76 2D regression PASS. ADR-363 Opening scene-units thread ✅ CLOSED 2026-05-25 — 4 callers, 27/27 tests. ADR-366 §C.1 Animation Phase 9 ✅ FULLY CLOSED 2026-05-25; ADR-345 spellCheck ✅ DONE 2026-05-23, ADR-034 UC-017 ✅ DONE 2026-05-23; **ADR-363 Phase 2 canvas-wiring follow-up ✅ 2026-05-25**.)

---

## Changelog

> ⛔ **ΚΛΕΙΣΤΟ από 2026-10-31 — ΚΑΜΙΑ νέα γραμμή** (N.13). Οι παρακάτω γραμμές είναι παλιό ιστορικό.

| Date       | Change |
|------------|--------|
| 2026-10-31 | 🧹 **ΚΑΘΑΡΙΣΜΑ ΑΡΧΕΙΟΥ** (εντολή Giorgio, Opus 5.5). Αφαιρέθηκαν ολοκληρωμένες εγγραφές και οι γραμμές changelog πριν από τον Οκτώβριο· το ιστορικό ζει στο git + στα ADR. Τα ανοιχτά που κρύβονταν κάτω από το Changelog πήραν δική τους επικεφαλίδα. |
| 2026-10-31 | ✅ **PURGE ΣΥΝΟΔΕΥΤΙΚΩΝ (ΓΚΠΔ) — ΕΚΛΕΙΣΕ** (ADR-899 §2.2.1, Opus 5.5). Ο γραφέας ήταν ήδη σωστός (`2e807681`)· έμεναν **δύο πόρτες που τον παρέκαμπταν**: `scheduledFilePurge` (Functions, ζωντανό — δεύτερη αγωγός, μόνο `storagePath`, χωρίς `isPreserved`/σημάδι Πρωτοκόλλου) **αφαιρέθηκε** · `onDeleteFloorplanBackground` **παραδίδει στον κάδο** (`purgeAt = τώρα`, `lib/files/file-trash-fields` προβεβλημένο). Επιτύμβιο `purgedRecordFields` ⇒ `purgeAt: null` (γραφέας + ΓΚΠΔ — αλλιώς ≥100 επιτύμβια μπλόκαραν τον κάδο). `FILE_LIFECYCLE_STATES` → φύλλο `config/file-lifecycle-states.ts`. Μέτρηση παραγωγής (ανάγνωση): 0 `purged` ⇒ κανένα backfill· 2 `.scene.json` χωρίς εγγραφή (καταγραφή). Jest 320+34 πράσινα · μετάλλαξη 5/5 (Κ1 ενισχύθηκε μετά από πράσινη μετάλλαξη). Νέο ανοιχτό: 🧹 floor wipe χωρίς κριτή δέσμευσης. ⏳ Giorgio: `firebase deploy --only functions`. |
| 2026-10-31 | ✅ **AI KB: ΦΙΛΤΡΟ ΕΜΒΕΛΕΙΑΣ CDE ΓΙΑ ΤΟΝ ΑΓΟΡΑΣΤΗ — ΕΚΛΕΙΣΕ** (ADR-901 Φ2 §14.2, Opus 5.5). Ακροατήριο από την ταυτότητα (`isAdmin` ⇒ `host`, αλλιώς `client`), ο συλλέκτης χωρίς προεπιλογή. 18/18 · μεταλλάξεις 4/4 · ai-pipeline 83/83 σουίτες · conveyance 1 κόκκινο προϋπάρχον (ωρολογιακή βόμβα, μετρημένο χωρίς την αλλαγή). Νέα 🔐 ΥΨΗΛΗ: τα εργαλεία αρχείων του AI δεν περνούν από εμβέλεια CDE. |
| 2026-10-30 | ✅ **CHECK 3.28 `--diff` «new clone» ΧΩΡΙΣ ΝΑ ΕΛΕΓΧΕΙ ΑΝ ΕΙΝΑΙ ΝΕΟΣ — ΕΚΛΕΙΣΕ** (ADR-584 §9, Opus 5.5). Πρακτική SonarQube Clean as You Code / Tricorder: μπλοκάρει **μόνο** κλώνος που τέμνει γραμμή που έγραψε η αλλαγή (νέο αρχείο = όλες · καθαρή διαγραφή = η ραφή · fail-closed)· οι προϋπάρχοντες αναφέρονται. NEW `scripts/lib/git-changed-lines.js`. Accounting: **20/22 προϋπάρχοντες ⇒ πλέον ενημερωτικοί**, οι **2 νέοι** λύθηκαν στον κώδικα (σωλήνωση εξαγωγής `report-export.ts` + `tableColumns`). Άγκυρες: `git-changed-lines.test.js` + §9 στο `check-jscpd-ratchet.test.js` (64/64) · **6/6 μεταλλάξεις**. |
| 2026-10-30 | ✅ **🧭 D25 ΚΟΚΚΙΝΟ ΑΠΟ TEST HARNESS — ΕΚΛΕΙΣΕ** (ADR-332 changelog 2026-10-30 · απόφαση Giorgio (α), Opus 5.5). ΜΙΑ σταθερά `HARNESS_ROUTE_ROOT` (`src/app/(<ομάδα>)/test-harness/` — `(bare)` και `(app)`), όχι γραμμή ανά harness· εξαιρείται μόνο ό,τι σερβίρει σελίδα με SSoT φρουρό + `notFound()` (λόγος που μπορεί να πάψει να ισχύει) · καμία οθόνη παραγωγής στη ρίζα. `proximity-anchor-reach.test.ts` 8/8 · **6/6 μεταλλάξεις**. |
| 2026-10-30 | ✅ **🔗 ΜΙΑ ΑΝΙΧΝΕΥΣΗ ΠΛΑΤΦΟΡΜΑΣ ΑΠΟ URL + ΕΝΑ `SocialPlatform` — ΕΚΛΕΙΣΕ** (ADR-327 §8.5.4 (η), Opus 5.5). Τρία σώματα (όχι δύο — το τρίτο νεκρό σε catch) και τρία ομώνυμα τύπου (όχι δύο — το `ui/effects`), όλα με `hostname.includes` ⇒ `wix.com` = Twitter. `hosts` στο `social-platform-profiles` + ΜΙΑ `detectPlatformFromUrl` (ίσος ή υποτομέας)· `platform-utils` την επανεξάγει. Άγκυρα `social-platform-detection.test.ts` (Δ1–Δ5, 49) · **7/7 μεταλλάξεις**. Κριτήριο: ΕΝΑΣ ορισμός `detectPlatformFromUrl` + ΕΝΑ `export type SocialPlatform =` (της ρίζας) — φυλάγεται από το Δ5. |
| 2026-10-30 | ✅ **🗂️ ΜΙΑ ΔΗΛΩΣΗ ΟΙΚΟΓΕΝΕΙΑΣ NAMESPACES — ΕΠΙΠΕΔΟ (α) ΕΚΛΕΙΣΕ** (ADR-280 §11 · CHECK 3.108, Opus 5.5). Η κλάση ήταν **~650 λίστες σε 10 οικογένειες**, όχι 92 του κτιρίου. Η πηγή υπήρχε ήδη (`COMPAT_NAMESPACE_MAP` → `resolveAllNamespaces`) ⇒ κανένα νέο SSoT. Codemod `--fix` **με απόδειξη ισοδυναμίας ανά κλήση**: η σειρά είναι σειρά προτεραιότητας και μετρήθηκαν ~25 κοινά φύλλα· «τι ζητά το αρχείο» = ο ταξινομητής AST του 3.34 + διαφυγή του `t` (190/588). 658 αναδιατυπώσεις / 588 αρχεία· 654/654 ζεύγη ξαναποδείχθηκαν από το `git diff` (το πρώτο πέρασμα είχε 3 χωρίς πλήρη απόδειξη ⇒ επανήλθαν). Πύλη ⛔ Κ1-Κ3 + 🔴 ratchet `order-bearing` (5). 21 άγκυρες· 7/7 μεταλλάξεις· 3.8 Layer 2 χωρίς νέα παράβαση· 811/811 tests των αγγιγμένων modules. Το (β) → νέο μπλοκ 🗂️ (β). ⚠️ commit: `generate:i18n-shell-slice:index` (ήταν ήδη μπαγιάτικο από ξένες αλλαγές toolchain/catalog) · ζωντανός έλεγχος εκκρεμεί (dev server κλειστός). |
| 2026-10-30 | 🟡 **⬜ `bg-white`/`bg-black` — βήμα (3) ΕΓΙΝΕ** (claude-6e, Opus 5.5). 194 γραμμές / 92 αρχεία ταξινομημένα μία-μία· ~90% νόμιμα (πέπλα, χαρτί, εικόνες, ρητά ζεύγη). Διορθώθηκαν 3 πραγματικά: σκιώδες `COLOR_BRIDGE` στο `dxf-viewer/config/modal-colors.ts` (λευκό σε λευκό στα πεδία των modal του DXF, σκοτεινό θέμα) → πραγματικό SSoT + άγκυρα με μετάλλαξη · `OrgStructureTab` hover λευκό σε `bg-card` (φωτεινό) → `BUTTON_ACCENT_HOVER` · τερματικό μετανάστευσης 3,2:1 (φωτεινό) → θεματική επιφάνεια. Μένει: πύλη (βήμα 1 — τα `scripts/` τα είχε άλλη συνεδρία· πρόταση: κρίση **μίξης**, όχι κάθε `bg-white`) · `--paper` · νεκρό `user-type.ts`. |
| 2026-10-30 | ✅ **🧾 ΔΡΟΜΕΑΣ KEYSET — ΕΚΛΕΙΣΕ** (claude-6e, Opus 5.5). SSoT `lib/admin-keyset-page` + `kind: 'timestamp'` · `map(data, id)` · `InvalidPageTokenError.code` (αποτύπωμα λογιστικής αμετάβλητο — άγκυρα Κ-T6). Ιστορικό ρόλων → keyset (TTL ⇒ πρώτη σελίδα σιωπηλά) + 400 σε `limit`/ημερομηνίες. **Νέο εύρημα**: ιστορικό οντότητας — άγκυρα ανύπαρκτη/ξένη ⇒ 400. 🔴 Ιστορικό εταιρείας **ήταν σπασμένο** (χωρίς `orderBy` + `offset=id` ⇒ NaN ⇒ η ουρά δεν φαινόταν ποτέ): άγκυρα + σάρωση με όριο + ΕΝΑΣ κριτής φίλτρων πελάτη/διακομιστή (`lib/audit/global-audit-filter`). `thread-directory`: ήδη σωστό, δεν μετακομίζει. Κανένας νέος δείκτης. jest (UNC): 11 σουίτες — 204/204 ✓ (ένα λάθος του ίδιου του test, όριο βρόχου, διορθώθηκε· `global-audit-tail` 19/19). Ανοιχτά: ημέρα Αθήνας · `LIST_ERROR_CODES` · dedup στο όριο παρτίδας · export. |
| 2026-10-30 | ✅ **🧩 ΠΡΩΤΟΚΟΛΛΟ UC MODULE ΣΕ ΕΝΑ ΣΗΜΕΙΟ — ΕΚΛΕΙΣΕ** (ADR-195 (ν), Opus 5.5): και τα **13** modules στο `shared/admin-command-protocol.ts`· η πολιτική έγκρισης στο **όνομα** της κλήσης (`autoApprovedProposal` εντολή · `humanApprovedProposal` πελάτης, `SALES_MANAGER_APPROVAL` μία σταθερά αντί για 5). **Ένας** ορισμός «εγκεκριμένες ενέργειες» (`approvedActions`/`hasModifiedActions`) και στα `multi-intent-steps`/`approval-resume`: κενό `modifiedActions` ΔΕΝ είναι πια «καμία ενέργεια» (ήταν ασυνεπές με το inbox). Το άγγιγμα αποκάλυψε **32 προϋπάρχοντες κλώνους** (CHECK 3.28) ⇒ νέο `shared/customer-request-protocol.ts` (αποστολέας · αιτών · έγκριση · audit · επιβεβαίωση · health) + `sendCommandReply`/`failedExecution`/`replySideEffect` (ΕΝΑ λεξιλόγιο `reply_sent:`/`reply_failed:`)· **`return await`** μέσα σε `try` φυλαγμένο (Π5β). 17 αρχεία χωρίς κλώνους· 1311/1311 στο pipeline· 12/12 μεταλλάξεις. Το grep κλεισίματος δίνει πλέον **τίποτα** (ούτε το SSoT). Μένει μικρό: εγγραφή των 2 protocols στο `.ssot-registry.json` (θέλει `ssot:baseline` ⇒ απόφαση Giorgio, κανόνας «όχι reseed»). |
| 2026-10-30 | ✅ **🧪 Γ4 ΤΟΥ `record-entity-update.test.ts` ΦΥΛΑΕΙ ΠΛΕΟΝ ΤΟΝ ΚΛΑΔΟ «ΧΩΡΙΣ ΜΗΤΡΩΟ» — ΕΚΛΕΙΣΕ** (ADR-195 (μ), Opus 5.5): ο τύπος **παράγεται** από το μητρώο οντοτήτων (`getTrackedFieldsForEntityAuditType(t) === null`), με παρονομαστή Γ4α. **Μετρημένο**: γραφέας που δανείζεται ξένο μητρώο ⇒ η ΠΑΛΙΑ άγκυρα (`quote`) 8/8 πράσινη, η νέα **κόκκινη**. |
| 2026-10-30 | ✅ **🧑′ ΜΕΤΑΠΤΩΣΕΙΣ ΕΠΑΦΩΝ ΣΦΡΑΓΙΖΟΥΝ ΤΟΝ ΔΙΑΧΕΙΡΙΣΤΗ — ΕΚΛΕΙΣΕ** (ADR-195 (λ) · ADR-704 changelog 2026-10-30, Opus 5.5): `CDC_WATCHED_COLLECTIONS` παράγωγο· `flushInBatches`/`openDeclaredBatch` **πετούν** χωρίς φορέα σε συλλογή του CDC και σφραγίζουν μόνο εκεί· ο envelope δίνει φορέα σε κάθε `run`. **4** μεταπτώσεις, όχι 3 (η Ρ6 της άγκυρας βρήκε το `migrate-company-id`). Επισκευάστηκε προϋπάρχον κόκκινο fixture (`migrate-postal-codes`, 3/7). 7/7 μεταλλάξεις. ⏳ **Μένει μόνο** ο ζωντανός έλεγχος «μετάπτωση σε δοκιμαστική επαφή ⇒ γραμμή “από <διαχειριστή>”» — **αναμονή έγκρισης Giorgio** (καμία εκτέλεση χωρίς ρητό «ναι»). |
| 2026-10-30 | ✅ **💬 ΠΛΑΤΦΟΡΜΑ SOCIAL ΔΕΜΕΝΗ ΣΤΗ ΡΙΖΑ — ΕΚΛΕΙΣΕ** (ADR-327 §8.5.4 (ζ) · ADR-812 changelog 2026-10-30, Opus 5.5): λεξιλόγιο `social-platform` στο CHECK 3.73 (19 λεξιλόγια)· **12** αδέσμευτα σε 6 αρχεία (όχι 9/5: τα 2 κρύβονταν πίσω από ομώνυμο τοπικό τύπο ⇒ η πύλη απέκτησε **δεσμό κατά ταυτότητα**, Μ15α-γ). Νέο SSoT `lib/contact/social-platform-profiles.ts` (όνομα μάρκας + πρότυπο προφίλ, ήταν σε 3 σημεία με `x.com`≠`twitter.com`)· branding κρατά `tiktok/whatsapp/telegram`· ένα `ShowcaseContactSocial`· `SocialPlatformType` **δεμένο** (`NamedSocialPlatform \| 'email'`), όχι εξαίρεση. Δεδομένα 0/22 επαφές με social. 7/7 μεταλλάξεις. Μένει ανοιχτό (μικρό): το `socialUrlGenerator.detectPlatformFromUrl` είναι δίδυμο του `platform-utils.detectPlatformFromUrl`, και το `profile-service.ts` εξάγει ομώνυμο `SocialPlatform` (= `SocialPlatformType`, άλλο σύνολο) — καταγράφεται στο μπλοκ 🔗 παρακάτω. |
| 2026-10-30 | ✅ **🧾 ΕΞΑΓΩΓΗ ΑΝΑΦΟΡΩΝ i18n — ΕΚΛΕΙΣΕ** (ADR-ACC-010 §2.1.1 · N.11, Opus 5.5) + ✅ επαλήθευση **🧾 βεβαίωσης ΑΠΥ** (jest στον giorgio-pc: 2 σουίτες / 18 PASS). `report-table-adapter`: κάθε κείμενο από τον `t` του καλούντος (el/en, +41 κλειδιά `reports.*`), στήλες με ρόλο / γραμμές με μορφή ⇒ διορθώθηκαν ταυτόχρονα: Υπόλοιπο ισοζυγίου και Σύνολο ηλικίωσης που έβγαιναν ως «%», πλήθη ως €, **κάδοι ηλικίωσης μετατοπισμένοι κατά έναν**. Ένας μορφοποιητής κελιού (`report-cell-format.ts`) για οθόνη/PDF + `numFmt` Excel· διπλότυπο `formatMetricValue` (`FinancialReportCard`) σβήστηκε. Άγκυρα `report-table-adapter.test.ts` 17 PASS. Η 📊 **§κάρτες σύνοψης** τη δουλεύει παράλληλα άλλη συνεδρία — δεν αγγίχτηκε. ⚠️ commit: `generate:i18n-types:index` + `generate:i18n-shell-slice:index` · `jscpd:diff` από pre-commit. |
| 2026-10-29 | ✅ **🏷️′ #3 ΤΟ ΠΕΑ ΣΤΟ ΙΣΤΟΡΙΚΟ — ΕΚΛΕΙΣΕ, ΚΑΙ ΜΑΖΙ ΟΛΟ ΤΟ 🏷️′** (ADR-195 (κ) · ADR-852, Opus 5.5). Μετρημένο: 1 παλιά γραμμή ενιαίου `energy` **και** 10 νέες `energy.*` που έβγαιναν ωμό κλειδί ως «αποσυρμένο πεδίο». `labelKey` + κατάλογοι τιμών · Θ1 = ο ίδιος ο `resolveFieldLabel` (το προϋπάρχον κόκκινο Θ1 έκλεισε, μαζί με το `catalog_*`) · ΝΕΟ μητρώο μόνο ανάγνωσης `audit-retired-fields.ts`. Λ8 · μεταλλάξεις 8/8. ⏳ Ζωντανός έλεγχος οθόνης: όταν τρέχει dev server. |
| 2026-10-29 | ✅ **⏳ «ΗΜΕΡΕΣ ΜΕΧΡΙ ΠΡΟΘΕΣΜΙΑ» — ΕΚΛΕΙΣΕ** (ADR-853 §13 ε.γ · ADR-861 · N.0.2, Opus 5.5) + 🧹 **backfill λήξεων δόσεων: script έτοιμο** (ADR-234). Audit ανά σημασία: (α) προθεσμία-**στιγμή** ⇒ `mandate-standing.daysUntilExpiry` → `deadlineDaysLeft` (ίδια συμπεριφορά, `mandate-standing` ✓· `MILLISECONDS_PER_DAY` → `MS_PER_DAY`) · `TrashView.getDaysUntilPurge` → `daysUntilOrNull` + ceil (προσημασμένο: το `≤ 0` = «έληξε»· ποτέ `NaN`). (β) προθεσμία-**ημέρα** ⇒ ΝΕΟ `calendarDaysUntil` (`constants/platform-operator`, πάνω στα `operatorDayOf` + `daysBetweenDateKeys`): `getDaysUntilCompletion` · `useScheduleDashboard` `daysRem` · `OverallProgressCard`. 🔑 Το `ceil(ms / 24h)` έλεγε «1» στις 01:00 της ίδιας της ημέρας (η ημέρα = μεσάνυχτα UTC = 02:00 Αθήνα). (γ) **Όχι προθεσμίες** (σκόπιμα εκτός, μπλοκ ⏳′): `quote-expiration` («πριν από», trunc) · διάρκειες. Backfill: `npm run backfill:installment-due-day` (dry-run, ιδεμποτικό, `lastUpdateTime` ανά πλάνο) — **η εκτέλεση = απόφαση Giorgio**. Jest: 4+3 σουίτες, 98 + 34 ✓. ⚠️ `tsc` / `jscpd:diff` / browser **δεν** έτρεξαν. |
| 2026-10-29 | ✅ **🏷️′ #2 ΕΝΑ ΛΕΞΙΛΟΓΙΟ ΤΥΠΟΥ ΔΡΑΣΤΗΡΙΟΤΗΤΑΣ — ΕΚΛΕΙΣΕ** (ADR-195 (ι), Opus 5.5). Μετρημένο: το `customFields.activityType` είναι το ενικό κάτοπτρο της κύριας ΚΑΔ (η φόρμα γράφει πάντα `'main'`· βάση: 7 `main`, 0 `secondary`) ⇒ ίδια έννοια με το `KadActivity.type`. Η παλιά ορθογραφία έγινε **ψευδώνυμο** της ρίζας (`LEGACY_KAD_ACTIVITY_TYPE_ALIASES` + `AuditCatalogRef.valueAliases`), **χωρίς μετάπτωση**· σβήστηκαν `VOCAB_ACTIVITY_TYPES` + 4 αντίγραφα locale· τα τυφλά casts (mappers, εργαλείο AI) ⇒ κανονικοποιητές της ρίζας. Boy Scout: κόκκινο CHECK 3.13 στο `customFields.companyAddresses`. Λ7 · μεταλλάξεις 6/6. Νέο μπλοκ 🪦. |
| 2026-10-29 | ✅ **👻 ΕΤΙΚΕΤΕΣ ΚΑΤΑΣΤΑΣΗΣ ΑΟΡΑΤΕΣ — ΕΚΛΕΙΣΕ Η ΚΛΑΣΗ** (ADR-770 §22 · N.0.2, Opus 5.5). Audit **AST** (όχι παράθυρο χαρακτήρων): 38 ευρήματα / 14 αρχεία. **Μετρήθηκε** ότι η πρόταση «`/15` + κείμενο token» αποτυγχάνει (success 1,80:1 φωτεινό · purple 2,28 σκοτεινό) και ότι τα συνθετικά `${getStatusColor(x,'bg')}/NN` δεν παράγονται από το Tailwind. Θεραπεία = **ρόλοι** δίπλα στην ίδια αντιστοίχιση (`design-system.ts`): `getStatusBadgeVariant` (Badge + `SOLID_FILL_INK`) · `getStatusSolidClass` · `getStatusSurfaceClass` (`--bg-X`+`--text-X`, 5,78–7,84:1 στα δύο θέματα)· `getStatusBadgeClass` χωρίς `text-white`. Διορθώθηκαν: AgreementDetail (→ `AGREEMENT_STATUS_BADGE_VARIANTS`) · crm ειδοποιήσεις + στάδιο ευκαιρίας · υποχρεώσεις · KPI προμηθειών · LiveWorkerMap · files ×3 · AddressMap · ReportAgingTable · RelationshipList · CopyActionsSection. Άγκυρα: ZERO-TOL στο CHECK 3.38 + Ο6. Κατάλοιπα ⇒ νέο μπλοκ «👻′». |
| 2026-10-29 | ✅ **🏷️′ #1 ΛΕΞΕΙΣ ΤΥΠΟΥ ΔΙΕΥΘΥΝΣΗΣ / ΠΛΕΥΡΑΣ ΟΙΚΟΠΕΔΟΥ — ΕΚΛΕΙΣΕ** (ADR-195 (θ), Opus 5.5). Η κλάση ήταν 4 σημεία, όχι μόνο το `formatAddressType`: `addresses:types/blockSides` (SSoT) + αντίγραφα `building-address`/`projects-data` (το ένα χωρίς `frontage` ⇒ ωμό κλειδί στις οθόνες κτιρίου) + ελληνικοί πίνακες `formatAddressType`/`formatBlockSide` + ελληνικές προτάσεις `validateAddress`. Τύποι παράγωγοι των ριζών + 2 ρίζες CHECK 3.73 · `useAddressVocabularyWords` (ΕΝΑ σημείο απόδοσης) · `AddressValidationIssue` · σβήστηκαν 2 νεκρές συναρτήσεις + 4 αντίγραφα locale. Άγκυρα `address-vocabulary-words.test.ts` Ω1–Ω4 · μεταλλάξεις 7/7. Νέο μπλοκ 🗂️ (namespaces κτιρίου ×92). |
| 2026-10-29 | ✅ **📅′ «ΣΗΜΕΡΑ» ΣΕ UTC — 9 ΣΗΜΕΙΑ + ΜΙΑ ΖΩΝΗ ΕΛΛΑΔΑΣ + `report-date-utils` — ΕΚΛΕΙΣΑΝ** (ADR-919 · ADR-861 · ADR-ACC-010 · N.0.2, Opus 5.5). Audit ένα-ένα. 🔴 **Δύο πραγματικά σφάλματα πέρα από τη ζώνη**: (α) αναφορά CRM: `t.dueDate < today` συνέκρινε Firestore `Timestamp` με συμβολοσειρά ⇒ **ποτέ** ληξιπρόθεσμες εργασίες του `TasksRepository` (τώρα `operatorDayOf`, που δέχεται πλέον και `Timestamp`/`Date`)· (β) τιμολόγιο πώλησης: ημέρα έκδοσης **και `fiscalYear`** σε UTC ⇒ πώληση 1/1 00:00–02:00 στην ΠΡΟΗΓΟΥΜΕΝΗ χρήση (τώρα `accountingToday`). Server ⇒ `calendarDayOf`: `overdue-alert` (dedup) · `construction/portfolio` · `auto-scheduler`. Browser ⇒ `todayLocalDate`: `PermitsTab` (`max` απαγόρευε τη σημερινή) · `FrameworkAgreementFormDialog` (+ «ένα έτος» = `addMonthsToDateKey(·, 12)`) · `BaselineSection`. `report-date-utils`: όλα σε κλειδιά ημέρας, «τώρα» = Αθήνα, σύγκριση έτους 29/2 ⇒ 28/2, custom = υπαρκτές ημέρες (**400** αλλιώς), 5 έτη = 60 μήνες. `GREEK_TIME_ZONE` = `OPERATOR_TIME_ZONE` + συμβόλαιο `athensClockAt`/`calendarDayOf` (7 στιγμές αλλαγής ώρας). Μένουν (σημειωμένα στο 📅′): `cpm-calculator.emptyResult` · ονόματα αρχείων εξαγωγής. Jest 18/18 σουίτες, 295/295 (`--testTimeout=90000` λόγω share). ⚠️ `tsc` / `jscpd:diff` / browser **δεν** έτρεξαν. |
| 2026-10-29 | ✅ **☎️#3 ΠΙΝΑΚΑΣ ΚΩΔΙΚΩΝ ΧΩΡΑΣ — ΕΚΛΕΙΣΕ** (ADR-327 §8.5.4, Opus 5.5). `parsePhoneForStorage` ⇒ `splitCountryCallingCode` (`lib/contact/channel-phone.ts`, libphonenumber). Ήταν το τελευταίο σημείο ⇒ αφαιρέθηκε όλο το μπλοκ ☎️. Μεταλλάξεις 3/3 · ai-pipeline 81/81. |
| 2026-10-29 | ✅ **🏷️ DEPLOY `auditContactWrite` ΕΓΙΝΕ** (ADR-195 (η″), εντολή Giorgio). Ο γραφέας CDC με δηλωμένη ταυτότητα στοιχείου είναι ζωντανός· επαλήθευση με πραγματική γραμμή στην επόμενη αποθήκευση επαφής από τη φόρμα. |
| 2026-10-29 | ✅ **📅′ ΚΑΤΑΛΟΙΠΑ «ΗΜΕΡΟΛΟΓΙΑΚΗ ΗΜΕΡΑ» — ΕΚΛΕΙΣΑΝ ΤΑ ΤΡΙΑ** (ADR-919 · ADR-234 · ADR-170 · ADR-861 · N.0.2, Opus 5.5). **(1) QR παρουσιών**: audit ⇒ ο ελεγκτής κρίνει μόνο `expiresAt`, όχι «σήμερα». Η προεπιλογή ημέρας → `calendarDayOf` (το σφάλμα ήταν QR της **χθεσινής** 00:00–03:00, όχι αυριανής) · ο `QrCodePanel` δεν στέλνει πια ημέρα UTC · `expiresAt` → `endOfCalendarDay` (μεσάνυχτα Αθήνας, όχι 02:59 της επομένης). **(2) «Τελευταία ημέρα μήνα»** → `daysInMonth` + `isoCalendarDay` σε 7 σημεία (3 λογιστικά + `validity-bounds` · `energy-reference-prices` · `useCalendarCrossMonthDrag`)· το `addMonthsToDateKey` → `lib/calendar/date-key`. **(3) Λήξη δόσης = ΗΜΕΡΑ** (απόφαση Giorgio: πρακτική των μεγάλων — QuickBooks/Xero · ΑΚ 241). Ανατρέπει τον κριτή στιγμής της γραμμής «`payment-plan` `dueDate`» πιο κάτω. SSoT `lib/payment-plan/installment-due-day.ts`, `operatorDayOf` (`accountingDayOf` = λεπτή κλήση), σύνορα που κανονικοποιούν σε ημέρα (μεταβατικά δέχονται και την παλιά στιγμή `Z`), ~14 αναγνώστες. **Αλλαγή συμπεριφοράς**: ληξιπρόθεσμη μόνο αφού περάσει η ημέρα λήξης στην Αθήνα · wizard 31/1 ⇒ 28/2 (όχι 3/3). Νέα κατάλοιπα στο 📅′: «σήμερα» σε UTC (~10 σημεία, καταγραφή) · δύο SSoT «ημέρα Αθήνας» · `shiftYearBack` 29/2 · **backfill λήξεων (εγγραφή στη βάση — απόφαση Giorgio)**. Jest: 22 σουίτες, 407 tests — 406 ✓ στην πρώτη εκτέλεση· το `payment-form-submission` Π1 έπεσε σε timeout 10 s υπό φόρτο, ✓ 11/11 με `--testTimeout=90000` (το Π1 θέλει 14 s κρύας φόρτωσης στο share). ⚠️ `tsc` / `jscpd:diff` / browser **δεν** έτρεξαν. |
| 2026-10-29 | ✅ **🏷️ ΕΤΙΚΕΤΕΣ CDC ΕΠΑΦΗΣ — ΚΩΔΙΚΑΣ ΕΚΛΕΙΣΕ, ⏳ DEPLOY FUNCTIONS ΜΕ ΕΓΚΡΙΣΗ** (ADR-195 (η), Opus 5.5). Ο CDC παίρνει πλέον τη **δηλωμένη** ταυτότητα στοιχείου μέσω προβολής (CHECK 3.93): αλλαγή τύπου τηλεφώνου = ΜΙΑ αλλαγή ιδιότητας· η έδρα ΜΙΑ φορά (από την αυθεντία `customFields.companyAddresses` — **όχι** αγνόηση της, ήταν η αυθεντική λίστα)· ρόλος με κλειδί/λέξη· `lastModifiedBy` αγνοείται· λογότυπο `/api/storage/file/…` ⇒ «Φωτογραφία (0b2eb5a6.png)». Δύο λάθη `keyBy` στο SSoT (`personas`, `escoSkills`) διορθώθηκαν με άγκυρα. Μεταλλάξεις 9/9. Αφαιρέθηκε το μπλοκ 🏷️. Για το commit: άλλαξε το `common-audit.json` ⇒ `generate:i18n-types:index` + `generate:i18n-shell-slice:index`· τα `functions/src/generated/**` (3 νέα) μπαίνουν μαζί. |
| 2026-10-29 | ✅ **🧷 `isPlainRecord` / `isFiniteNumber` — ΤΟΠΙΚΑ ΑΝΤΙΓΡΑΦΑ — ΕΚΛΕΙΣΕ** (ADR-225 Phase 2 · ADR-889 §11 · N.0.2, Opus 5.5). **27 ιδιωτικά αντίγραφα** (η καταγραφή της 28/09 έλεγε 11) → `@/lib/type-guards`: 17× «αντικείμενο, όχι πίνακας» (`isPlainObject` ×6 · `isRecord` ×11) → `isPlainRecord` · 7× `isFiniteNumber` · 3× `isRecord` που **δέχεται** πίνακα → το ίδιο το `isRecord` (σημασία αμετάβλητη). ΝΕΟ `plainRecordOrNull` (αδελφό του `trimmedStringOrNull`): 4 αναγνώστες «αντικείμενο ή `null`» (`objectOf` · `record` · `asRecord` · `fieldsOf`) σβήστηκαν — όλοι τελείωναν σε `value as Record<…>` ⇒ **κανένα cast** πια· τα 2 `fieldsOf` «ή `{}`» των ειδοποιήσεων = `plainRecordOrNull(v) ?? {}`. `isNode` (capture-api) · `isLoose` (ΓΕΜΗ) κρατούν όνομα/τύπο τομέα πάνω στο `isPlainRecord`· `demand-area.ringOf` επίσης. Νεκροί τύποι που άφησε η αφαίρεση σβήστηκαν (`Raw` · `DeclarationRecord` · `DocumentData` · `Json`). Κατάλοιπα (σκόπιμα) → μπλοκ «🧷′». Jest στοχευμένα· 2 κόκκινα στο `tour-access-contact.test.ts` **όχι δικά μας** (mock του `entity-audit.service` χωρίς `resolveUserDisplayName` — από τη δουλειά ADR-195 `performer-stamp`). `jscpd:diff` δεν τρέχει από UNC. |
| 2026-10-29 | 🟡 **↩️ EOL — `layer-one-checks.normalize` → `text-eol`** (ADR-744 §30 · N.0.2, Opus 5.5): `toCanonicalText({ stripBom, trimEnd })` + ένα τελικό `\n` στον καλούντα. Εκτός κλειστότητας digest (μετρημένο) ⇒ καμία αλλαγή manifest. Μένει μόνο το `slice-build.toLf` — το manifest ήταν staged από άλλη συνεδρία ⇒ δεν αγγίχτηκε. Jest 145/145. |
| 2026-10-29 | ✅ **🛣️ ΔΙΑΔΡΟΜΕΣ `/api/owner-properties/…` ΜΕ ΧΕΙΡΟΓΡΑΦΟ ΚΕΙΜΕΝΟ — ΕΚΛΕΙΣΕ** (ADR-245 · ADR-920 Β4.7 · N.0.2, Opus 5.5). `API_ROUTES.OWNER_PROPERTIES` +`LIST` · `BROKERED` · `STATS` · `OWNERSHIP_VERIFICATION` · `MANDATE_EVIDENCE` · `STAY_CALENDAR` · `STAY_CHANNELS` · `ENERGY_CERTIFICATE_IMPORT` και `PROPERTIES.ENERGY_CERTIFICATE_IMPORT`. Οι 5 γνωστοί πελάτες (`useOwnershipVerification` · `mandate-evidence.client` · `stay-calendar.client` · `stay-channels.client` · `useEnergyCertificateImportPorts` `importUrlOf`) + **4 που βρήκε το audit** (`owner-property.service` / `private-marketing.client` `API_BASE` · `mandate-catalog.client` `CATALOG_URL` · `listing-stats` `OWNER_PORTFOLIO_STATS_PATH`) εισάγουν από εκεί. Καμία αλλαγή URL. Jest στοχευμένα 246/246 + `listing-stats`· `jscpd:diff` δεν τρέχει από UNC (το τρέχει το pre-commit). |
| 2026-10-29 | ✅ **📅′ `payment-plan` `dueDate` — ΕΚΛΕΙΣΕ** (ADR-234 · ADR-919, Opus 5.5). Απάντηση στο «ημέρα ή στιγμή;»: **στιγμή** — όλοι οι πελάτες στέλνουν `toISOString()` (wizard · επεξεργασία δόσης · split), άρα το `calendarDaySchema` θα έσπαγε τον wizard. Νέο `app/api/properties/_shared/installment-due-date.ts` (`z.string().datetime()`: υπαρκτή ημέρα + μόνο `Z`). Κλείνει **και δεύτερο σύνορο** εκτός λίστας: το `payment-plan/installments` POST/PATCH δεν έλεγχε καθόλου μορφή. ⚠️ Παρατήρηση (όχι διορθωμένη): ο wizard φτιάχνει τη λήξη από **τοπική** `Date` και το `edit-installment-model` την κόβει με `split('T')[0]` ⇒ κοντά στα μεσάνυχτα η οθόνη μπορεί να δείξει την **προηγούμενη** ημέρα. |
| 2026-10-29 | ✅ **🆕 ΧΕΙΡΟΓΡΑΦΟ `'__new__'` (ΑΚΙΝΗΤΟ ΠΟΥ ΔΕΝ ΣΩΘΗΚΕ) — ΕΚΛΕΙΣΕ** (ADR-920 Β4.7 · N.0.2, Opus 5.5). Οι 4 γνωστοί αναγνώστες (`api/properties/[id]` PATCH · `PropertyDetailsContent` auto-save · `usePropertyMediaCounts` 2× · `UnitQuickCreateSheet`) → `lib/properties/unsaved-property`. Το audit βρήκε **5 ακόμη** εκτός λίστας: `property-mutation-gateway` (4 φρουροί) · `usePropertyMutationImpactGuard` → `isPersistedPropertyId`. **Τρία αντίγραφα της τιμής** έγιναν ένα: `UNSAVED_PROPERTY_ID` = `DRAFT_ENTITY_ID` (`lib/draft-entity-id`, ADR-777 §8.31.12) · `NEW_PROPERTY_SELECTION_ID` = `UNSAVED_PROPERTY_ID`. ΟΧΙ τα `'__new__'` κτιρίου (`TEMP_BUILDING_ID`) / μέλους (`MemberEditor`) / διεύθυνσης (`AddressMap`) — άλλη οντότητα. Jest στοχευμένα· `jscpd:diff` δεν τρέχει από UNC (το τρέχει το pre-commit). |
| 2026-10-29 | ✅ **📅 ΕΛΕΓΧΟΣ «ΗΜΕΡΟΛΟΓΙΑΚΗ ΗΜΕΡΑ ISO» — ΕΚΛΕΙΣΕ** (ADR-919 · ADR-828 · N.0.2, Opus 5.5). Το audit βρήκε **περισσότερα** από τα ~14: **8 χειρόγραφους κριτές ύπαρξης** (`availability-window` · `date-local.isRealCalendarDay` · `operator-readiness` · `accounting-day` · `terrain-survey-declaration` · `calendar/date-key.isDateKey` · `survey-date` · `energy-certificate` τοπικό `calendarDaySchema`) + **12 που έλεγχαν μόνο σχήμα**. Νέο SSoT `lib/date/calendar-day.ts` (+ `calendar-day-schema.ts`, zod `refine` στον ίδιο κανόνα· άγκυρα ότι συμφωνεί με το `z.string().date()`). `daysInMonth`: ο Φεβρουάριος αριθμητικά (`Date.UTC(0,…)` = 1900 ⇒ το ISO `0000` έβγαινε μη δίσεκτο)· το `isLeapYear` του `tax-date-utils` → `calendar-arithmetic`. Το `date-local.isRealCalendarDay` **απέρριπτε λάθος** την `0099-01-01`. Σύνορα που αυστηροποιήθηκαν (400 / αγνοείται / απορρίπτεται / πετά): ADR-919 changelog. Το `quote-search.ts` της αρχικής λίστας **δεν υπάρχει πλέον**. Κατάλοιπα (catalog ADR-923 · `payment-plan` πρόθεμα · αντίγραφα «τελευταίας ημέρας» στα λογιστικά · QR σε UTC): 📅′. jest: 29+17 σουίτες, 610 + 314 ✓. ⚠️ `jscpd:diff` δεν τρέχει από UNC — το τρέχει το pre-commit. |
| 2026-10-29 | ✅ **🌐 ΩΜΑ ΕΛΛΗΝΙΚΑ ΣΤΟ ΙΣΤΟΡΙΚΟ — ΕΚΛΕΙΣΕ** (ADR-195 (ζ) · ADR-852, Opus 5.5): το Ιστορικό μιλά με τις λέξεις του **λεξιλογίου του πεδίου** (πρακτική SAP change documents: ωμή τιμή + κείμενο από το domain στην προβολή). ΝΕΑ `config/audit-value-vocabularies.ts` (δείκτες ns+διαδρομή· τύποι επικοινωνίας **παράγονται** από τους πίνακες ανά κάτοχο, `fallbackPaths`) · `TrackedFieldDef.itemCatalogs` / `nestedKeyCatalog` · `audit-vocabulary-namespaces.ts` (namespaces **παραγόμενα** από τις δηλώσεις, ανά οντότητα) · `useAuditVocabulary` · `audit-value-words.ts`. Ο helper χωρίς καμία λέξη και χωρίς `eslint-disable`. **Δύο ακόμη σφάλματα της κλάσης έκλεισαν**: (α) καταλόγοι από 5 namespaces που **κανείς** δεν φόρτωνε· (β) `phones[].type` μεταφραζόταν με τους **τύπους ακινήτου** (κατάλογος του ονόματος `type`) — τα υπο-πεδία ρωτούν πλέον ΜΟΝΟ δηλωμένο κατάλογο (`resolveDeclaredAuditValue`). Επίσης: ημερομηνία στη γλώσσα του θεατή (ήταν `el-GR`) χωρίς ολίσθηση UTC. Άγκυρα `audit-value-vocabularies.test.ts` Λ1-Λ5 (309) · μεταλλάξεις **8/8** · CHECK 3.13/3.8 · `jscpd:diff` καθαρό. Νέο μπλοκ 🏷️′ (3 κατάλοιπα). ⚠️ Ζωντανός έλεγχος σε Chrome **εκκρεμεί** (η καρτέλα γύριζε σε «Νέα καρτέλα»). |
| 2026-10-29 | ✅ **🧑 ΙΣΤΟΡΙΚΟ ΕΠΑΦΗΣ ΧΩΡΙΣ ΧΡΗΣΤΗ ΟΤΑΝ ΓΡΑΦΕΙ Ο SERVER — ΕΚΛΕΙΣΕ** (ADR-195 (στ), Opus 5.5): ΕΝΑΣ τύπος φορέα (`lib/audit/audit-performer.ts`: άνθρωπος | διεργασία εκ μέρους ανθρώπου) + ΕΝΑΣ βοηθός σφραγίδας (`server/lib/performer-stamp.ts`, απορρόφησε το δίδυμο του `soft-delete-engine`) + φορέας του AI (`ai-pipeline/shared/ai-performer.ts`, έσβησε 5 αντίγραφα του `channelSenderId || 'system'`). Όλοι οι runtime γραφείς επαφών (resolve · AI CRUD/εργαλεία · builder · περιήγηση · εντολές πώλησης · email · υπογράφων · ΙΚΑ · ενεργοποίηση πελάτη) σφραγίζουν `_lastModifiedBy`/`_lastModifiedByName` αντί του ωμού `lastModifiedBy`· η ρίζα `resolvePerformerDisplayName` δεν κρατά πια uid ως όνομα· οθόνη «Βοηθός AI · για {name}» (el+en). Άγκυρα κλάσης Σ0–Σ4 + Φ1–Φ6 + Δ7· μεταλλάξεις 9/9. Χωρίς deploy Functions. Boy Scout (CHECK 3.28 θα μπλόκαρε τα αγγιγμένα αρχεία): ΕΝΑΣ φορτωτής επαφής των εργαλείων AI (`agent-contact-doc.ts`, 6 αντίγραφα) + κοινά βήματα του `activity-handler` + `admin-command-protocol.ts` (uc-015/016). `jscpd:diff` καθαρό (39 αρχεία)· ai-pipeline 81/81. Νέα μπλοκ 🧑′ (μεταπτώσεις μέσω envelope) και 🧩 (11 UC modules). |
| 2026-10-29 | ✅ **ΤΡΙΑ ΑΚΟΜΗ — ΕΚΛΕΙΣΑΝ / ΜΕΡΙΚΩΣ (εντολή Giorgio «συνέχισε», Opus 5.5).** (1) **🕐 `getRelativeTime`**: τα 3 του inbox ήταν αυτολεξεί ίδια και **σκόπιμα** όχι `Intl` (μετά τις 48 ώρες δείχνουν ημερομηνία) ⇒ ΕΝΑΣ κανόνας `components/crm/inbox/inbox-relative-time.ts` (`getInboxRelativeTime`), με επανεξαγωγή του ιστορικού ονόματος από `thread-view-helpers` / `unified-inbox-helpers`· άγκυρα `inbox-relative-time.test.ts`. 🔴 Το 4ο (`communications/utils/formatters`) επέστρεφε **ωμά κλειδιά** (`common.time.minutesAgo`, χωρίς αριθμό) που το `CommunicationsHistory` αποδίδει **χωρίς `t()`** ⇒ ο χρήστης έβλεπε το κλειδί· πλέον αναθέτει στο `formatRelativeTime` (**δεν** ελέγχθηκε στον browser). (2) **🧪 τρίτο fake bucket**: το κοινό `fake-gcs-bucket` απέκτησε `exists` · `download` · `createResumableUpload` (+ `onResumableUpload`)· το `tour-capture-upload.test.ts` τρέχει πάνω σε τρία `fakeGcsBucket` (8 σουίτες του fake / 158 tests πράσινα). (3) **↩️ EOL**: `scripts/lib/text-eol.js` + 4 από 6 (η οικογένεια i18n-shell-slice μένει — βλ. γραμμή). Jest: `firestore-deploy-*` 5/5 · `third-party-notices` · `text-eol` πράσινα· `license-policy` Δ1-Δ3 + `capture-api-contract` Γ4 κόκκινα **μόνο λόγω UNC** (spawn `pnpm` / διαδρομή «μέσα στο repo») — όχι από την αλλαγή. |
| 2026-10-29 | ✅ **ΠΕΝΤΕ ΜΙΚΡΑ ΔΙΠΛΟΤΥΠΑ — ΕΚΛΕΙΣΑΝ (εντολή Giorgio «από τα μικρότερα», Opus 5.5).** (1) **`clamp`**: 4 τοπικά → `@/lib/geometry/scalar` (`rankSuggestions` · `floating-panel-geometry` · `photo-progress-analyzer` · `evm-calculator`). Τα άλλα δύο **δεν** είναι διπλότυπα: `formula-insert-text` (trunc + NaN⇒max) · `table-size-grid-keyboard` (αντίστροφη σειρά ⇒ κερδίζει το `max` όταν min>max). (2) **`SelectContent width="content"`** στα 4 DXF (`BimPropertyRow` · `EntouragePalette` · `MaterialEditorSections` + περιττό `contentClassName` στο `UomSelect` · `RibbonCombobox`)· αφαιρέθηκαν και τα νεκρά `whitespace-nowrap` (το `labelFit` τα υπερισχύει). ⚠️ Τα όρια 24rem/260px έγιναν το κοινό `min(28rem, διαθέσιμο)` — **δεν** ελέγχθηκε οπτικά. (3) **`addMonthsUTC` → αναθέτει στο `addMonthsClampedUtc`** + ξαναβάζει την ώρα της αφετηρίας (`positiveMod(ms, MS_PER_DAY)`)· σχετικά imports επίτηδες (το εισάγουν scripts χωρίς alias). Άγκυρα `date-local-add-months.test.ts` (31/1, 29/2, αρνητικοί, ώρα, πριν το 1970). (4) **`sortKeysDeep`** (`src/lib/sort-keys-deep.ts`, NEW): `canonical-json` + `audit-diff` (`export const sortKeys = sortKeysDeep`)· `legal-document-versions.test.ts` πράσινο (bytes). Μένει το αντίγραφο του `functions/src/audit/deep-diff.ts` (άλλο πακέτο). (5) **`toAdminTimestampOrNull` / `patchAdminTimestamp`** (μετονομασία του `toDeadlineTimestamp`) + `material-service` `lastPurchaseDate` (2 αντίγραφα)· το `quote-service` `toValidUntil` μένει χωριστό (μη αναγνώσιμη ⇒ `null`). Jest: 13 σουίτες / 365 tests πράσινα. ⚠️ `jscpd:diff` **δεν** έτρεξε (το `npx` αποτυγχάνει σε UNC cwd) — θα το τρέξει το pre-commit. |
| 2026-10-29 | ✅ **📧 + 🌐 + 💬 ΛΕΞΙΛΟΓΙΟ ΤΥΠΟΥ EMAIL / ΙΣΤΟΣΕΛΙΔΑΣ / SOCIAL ΑΝΑ ΚΑΤΟΧΟ — ΕΚΛΕΙΣΕ** (ADR-327 §8.5.4 (ε), Opus 5.5): ρίζες `email-type` · `website-type` · `social-media-type` (ίδιο πρότυπο με το ☎️, ένας άξονας κατόχου `contact-owner-kind.ts`) + ΕΝΑΣ κανόνας `inferEmailType`· 7 γραφείς εκτός υποσυνόλου διορθώθηκαν (AI builder/lookup-crud, resolve, φόρμα, λίστα, σάρωση προσφοράς, saver ιστοσελίδας, seed)· mappers χωρίς τυφλό `as`· Ιστορικό ένας πίνακας ανά λεξιλόγιο. CHECK 3.73 +3 λεξιλόγια + νέα κατάσταση `bound-elsewhere` (ADR-812). Δεδομένα: 0/22 εκτός υποσυνόλου. 10/10 μεταλλάξεις σκοτώθηκαν. Ζωντανός έλεγχος εκκρεμεί (dev server 403). Νέο μπλοκ 💬 για την πλατφόρμα. |
| 2026-10-29 | ✅ **🏢 ΘΟΡΥΒΟΣ 1ης ΑΠΟΘΗΚΕΥΣΗΣ — ΕΚΛΕΙΣΕ (ρίζα ≠ υπόθεση)** (ADR-327 §8.5.4 (δ), Opus 5.5): μετρημένο ότι η ρίζα ήταν ο setter της φόρμας (~120 κλειδιά ως «dirty diff»), όχι το σχήμα του server. `edit-session-diff.ts` + `useEditSessionState.ts` (dirty = διαφέρει από τη βάση) + κενή διαφορά ⇒ καμία εγγραφή. 6/6 μεταλλάξεις· ζωντανά `dirtyKeys: ["phones"]`. Το `performedByName: ctx.uid` μεταφέρθηκε στο 🧑. |
| 2026-10-29 | ✅ **ΕΠΑΦΗ MACON ATEE: ΑΦΜ + ΤΥΠΟΣ ΤΗΛΕΦΩΝΟΥ — ΕΚΛΕΙΣΕ** (ADR-327 §8.5.4, έγκριση Giorgio, Opus 5.5): από τη φόρμα Επαφών ⇒ `vatNumber: 094201577` (τιμολόγιο ΤΔΑ 13267· `isValidGreekVat` ✓, κανένα διπλότυπο) + `phones[0].type: main`· γραμμή Ιστορικού «από Georgios Pagonis». Αφαιρέθηκε όλο το μπλοκ «🔎 Ευρήματα…» (ήταν το τελευταίο σημείο). ➕ Νέο εκκρεμές 🏢 (μη κανονικό σχήμα εταιρείας από server ⇒ θόρυβος στην 1η αποθήκευση) + προσθήκη στο 🏷️ (πίνακες ως αφαίρεση+προσθήκη). |
| 2026-10-29 | ✅ **«null»-ΚΕΙΜΕΝΟ ΣΤΟ ΑΠΟΘΗΚΕΥΜΕΝΟ `extractedData` — ΕΚΛΕΙΣΕ** (ADR-327 §8.5.4, εντολή Giorgio): `migrate-quote-extracted-absent-text.ts --execute` ⇒ QT-0004 (8 πεδία) καθαρίστηκε + σφραγίδα `normalizationVersion: 2`· επαναληπτικό dry-run: 4/4 τρέχουσα, **0** με «null». |
| 2026-10-29 | ✅ **ΑΛΛΑΓΗ ΠΡΟΜΗΘΕΥΤΗ ΣΤΟ ΙΣΤΟΡΙΚΟ — ΕΚΛΕΙΣΕ ζωντανά** (ADR-327 §8.5.4, Opus 5.5): QT-0004 MACON → Δοκιμαστικός Β → MACON (έγκριση Α) ⇒ RFQ «Ιστορικό» με ονόματα· Firestore: ids στις τιμές, ονόματα στις ετικέτες. ✅ **☎️ #1 + #2 — ΕΚΛΕΙΣΑΝ**: ΕΝΑ λεξιλόγιο τύπου τηλεφώνου (`lib/contact/phone-type-vocabulary.ts`, CHECK 3.73 `phone-type`, 39 δεμένες δηλώσεις)· το SSoT της ίδιας μέρας έγραφε `work` σε εταιρεία = κενή λίστα ⇒ πλέον `main`. ➕ Νέα: 🧑 Ιστορικό επαφής χωρίς χρήστη · 🏷️ ωμές ετικέτες CDC · 📧 ίδια κλάση για email/web · 🌐 ωμά ελληνικά στο Ιστορικό. |
| 2026-10-26 | ✅ **ΚΑΘΟΛΙΚΟ ΔΙΧΤΥ ADC ΣΤΑ UNIT TESTS — ΕΚΛΕΙΣΕ (ADR-845 §10, Opus 5.5).** `jest.setup.js`: `GOOGLE_APPLICATION_CREDENTIALS` προς ανύπαρκτο αρχείο ⇒ `initializeApp` αποτυγχάνει σε ~0,1 s αντί για 9,8 s πραγματικού GCS. Απορρίφθηκαν μετρημένα: φράγμα socket (4,9 s / 44 s λόγω retries) · ψεύτικο κλειδί · emulator σε κλειστή θύρα. 255 σουίτες χωρίς mock του Admin: **0 ψευδώς θετικά** (A/B). Αποκαλύφθηκαν 3 σουίτες σε timeout από πραγματικό δίκτυο ⇒ double + `publishShowcaseMark(adminDb, …)` (έγραφε στο καθολικό Firestore). 309 σουίτες / 4.506 tests: κόκκινες μόνο οι 5 προϋπάρχουσες. |
| 2026-10-25 | ✅ **ΠΡΩΤΟ TEST ΠΟΥ ΑΠΟΘΗΚΕΥΕΙ ΕΝΤΟΛΗ ~4 s — ΕΚΛΕΙΣΕ (ADR-845 §10, Opus 5.5).** Αιτία μετρημένη (cpu-prof ~15 s αδράνεια + χρονομέτρηση ανά κεφάλι): τα **τέσσερα κεφάλια του δημόσιου ραφιού** χτυπούσαν **πραγματικό GCS** με τα ADC του μηχανήματος. ΕΝΑ test double `src/test-utils/public-shelf-double.ts` αντικατέστησε **18** αντίγραφα των ίδιων `jest.mock` (+ οι 2 αργές σουίτες που το είχαν ξεχάσει). Θ0 4–8 s → 15 ms· 22 σουίτες/307 tests πράσινα. Boy Scout: δίδυμο `shelfBucket()` στο `public-shelf-provision.ts`. Νέα γραμμή: καθολικό δίχτυ για ADC σε tests. |
| 2026-10-19 | ✅ **Ο ΚΑΝΟΝΑΣ ΑΝΑΓΝΩΣΗΣ ΤΗΣ ΔΙΑΘΕΣΗΣ ΕΓΙΝΕ ΕΝΑΣ — ΕΚΛΕΙΣΑΝ ΔΥΟ ΓΡΑΜΜΕΣ (ADR-777 §8.60.20.12, Opus 5.5).** (1) «02/09 — η διάθεση μπαίνει στο δημόσιο σχήμα με ωμό `as`» (ADR-842 Φ5): η προβολή γράφει πλέον `resolveCommercialStatus(property) ?? DEFAULT_COMMERCIAL_STATUS`. Οι τρεις προϋποθέσεις της γραμμής εκπληρώθηκαν: μέτρηση ζωντανά (19/19 ακίνητα, 19/19 αγγελίες ήδη κανονικά ⇒ καμία δημόσια τιμή δεν άλλαξε) · άγκυρα Δ1–Δ4 στο `public-listing-projection.test.ts` (μετάλλαξη: 8 κόκκινα) · καταναλωτής φίλτρου (`operationalStatusForListing`) πάνω στο υπερσύνολο, άρα καλύπτει τις επτά. (2) «19/10 — `commercialStatus ?? status` χειρόγραφο σε 8 σημεία»: και τα 7 σημεία κώδικα ζητούν το `resolveCommercialStatus` (`PropertyStatusLegend` · `PropertyQuickView` · `ListLayout` · `price-resolver` · `public-listing-projection` ×3) + το σχόλιο του `property-completion-stance`. ⚠️ Διόρθωση: η γραμμή έγραφε ότι αγγίζει «το mirror των Cloud Functions ⇒ deploy». **Ψευδές**: δεν υπάρχει καθρέφτης του `public-listing-projection` στο `functions/`. Jest σχετικών φακέλων 156 σουίτες / 3.012 tests πράσινα. |
| 2026-10-16 | ✅ **ΜΗΝΥΜΑΤΑ ΑΡΝΗΣΗΣ ΠΕΡΙΟΔΟΥ ΣΕ ΕΛΛΗΝΙΚΟ ΚΕΙΜΕΝΟ — ΕΚΛΕΙΣΕ (ADR-ACC-010 §2.1.1 Φάση 7, Opus 5.5).** ΕΝΑ λεξιλόγιο `POSTING_PERIOD_DENIALS` (τράπεζα με `satisfies`, αποσβέσεις χωρίς `PERIOD_NOT_OPEN`) · ΕΝΑΣ κανόνας `postingPeriodDenialOf` · `ApiError(409, …, denial, details)` · κείμενο + ετικέτα μήνα (CLDR) στον πελάτη, el+en · `FiscalPeriod.label` αφαιρέθηκε. Βρέθηκε και διορθώθηκε: ομαδικό ταίριασμα τράπεζας ⇒ `PERIOD_CLOSED` για ανύπαρκτη περίοδο. Μεταλλάξεις 8/8. |
| 2026-10-15 | ✅ **ΤΡΙΑ ΑΡΧΕΙΑ ΤΟΥ CHECK 3.34 > 500 γρ. — ΕΚΛΕΙΣΕ (ADR-744 · `52eaa9bb`)**: `plan.js` 749→444 · ελεγκτής 659→335 · `ledger.js` 632→191, με re-exports (νέα: `manifest-build` · `namespace-inheritance` · `layer-one-checks` · `route-ledger`). Ερμητική αναγέννηση: άλλαξαν ΜΟΝΟ `globalInputs.toolchain` + `inputsSha256`· Layer 1 + `--full` ✅. |
| 2026-10-05 | ✅ **ΙΣΤΟΡΙΚΟ ΟΡΟΦΩΝ — ΕΚΛΕΙΣΕ (CHECK 3.17 · ADR-195, Opus 5.5, απόφαση Giorgio «όπως οι μεγάλοι ή καλύτερα»).** Η εγγραφή έλεγε «το `PATCH /api/floors` δεν γράφει ιστορικό» — **ανακριβές**: έγραφε, μέσα στο `floor-update-effects.ts`, και η πύλη (που κρίνει ανά αρχείο) σήμαινε τον handler. Το πραγματικό ελάττωμα ήταν η **ποιότητα**: χειρόγραφη διαφορά εκτός μητρώου, βιβλίο του καλούντος, καμία γραμμή χωρίς `ctx.companyId`, και οι αλυσίδες έγραφαν με το uid του **ανθρώπου**. Τώρα: **ένας** γραφέας ανθρώπινης ενημέρωσης (`services/audit/record-entity-update.ts`, γενίκευση του `recordBuildingUpdate` — όχι δεύτερος) δίπλα στη γραφή· **ένας** γραφέας παράγωγων (`api/floors/_shared/floor-cascade-audit.ts`) με εκτελεστή τη μηχανή (`system:floor-stack` · `system:floor-ref`) και **αιτία** (`cause.auditId`) τη γραμμή του ανθρώπου. Baseline `.entity-audit-coverage-baseline.json` **2 → 1**. Μαζί: `placeRef` κτιρίου στο ιστορικό, `docs/gates/3.17.md` γραμμένο. |
| 2026-10-04 | ✅ **ΓΡΑΦΕΑΣ ΑΝΑΚΛΗΣΗΣ ΚΑΤΟΧΗΣ ⇒ ΜΟΝΑΔΑ `historical` — ΕΚΛΕΙΣΕ (ADR-900 §8 #2 Β3, Opus 5.5, απόφαση Giorgio «όπως οι μεγάλοι»).** Ένας γραφέας (`ownership-verification-revoke.service.ts`), δύο πόρτες (ουρά `super_admin` με κλειστό λόγο · αποδέσμευση του κατόχου, Zillow unclaim), μία συναλλαγή στις ίδιες κλειδαριές. 🔑 Η εγγραφή έλεγε «historical αν δεν μένει άλλη **ενεργή** απόδειξη» — η έρευνα (UPRN: `historical` = «δεν υπάρχει πια»· Zillow: η σελίδα μένει μετά το unclaim) το **στένεψε**: historical **μόνο** όταν ο λόγος ρίχνει την **απόδειξη ύπαρξης** **και** καμία άλλη `verified|superseded` δεν τη βεβαιώνει (ο Α έγκυρος → ο Β πλαστός ⇒ η μονάδα μένει). + ειδοποίηση κάθε απόφασης (σχήμα GBP: `security.ownershipLost` υποχρεωτικό, και προς τον προηγούμενο κάτοχο). |
| 2026-10-02 | ✅ **«ΠΟΙΟΙ ΧΩΡΟΙ ΕΙΝΑΙ ΤΟΥ ΚΤΙΡΙΟΥ;» — ΕΚΛΕΙΣΕ (ADR-898 §20 · ADR-184 · ADR-247, Opus 5.5, απόφαση Giorgio «θέση ≠ ανάθεση»).** Δεν ήταν δύο κανόνες αλλά **τρεις** (πίνακας ποσοστών · αντικειμενική · καρτέλες `?buildingId=`) — η εγγραφή έλεγε ότι η καρτέλα χώρων καλεί το `getBuildingSpaces`, **ψευδές**: το καλεί μόνο ο πίνακας ποσοστών. Πλέον **ΕΝΑΣ** καθαρός επιλυτής (`lib/building-spaces/building-space-membership.ts`) με έγχυση αναγνώστη για client και Admin SDK· αναφορά χωρίς ποσό (τύπος χωρίς `value`)· μοναδικότητα σύνδεσης ανά **έργο**· αποσύνδεση παρακολουθήματος ⇒ 409. Μεταλλάξεις 8/8. |
| 2026-10-02 | ✅ **ΦΡΟΥΡΟΙ ΠΕΛΑΤΗ ΣΕ ΣΚΕΤΟ `/login` — ΕΚΛΕΙΣΕ (ADR-848 §9 #3 · ADR-900 §3.7, Opus 5.5).** Οι τρεις (`o/[workspace]/dashboard` · `pending-approval` · `onboarding/organization`) ζητούν τον **ένα** `loginHrefForCurrentLocation()` — κρίθηκε ανά σελίδα: το onboarding το ανοίγει **email** του cron (`onboarding-reminder.job.ts`) ⇒ σκέτο `/login` ακύρωνε τον σύνδεσμο· το pending-approval αυτοδιορθώνεται ⇒ η επιστροφή δεν είναι ποτέ αδιέξοδο. Boy Scout: `oauth/authorize` είχε **δεύτερη υλοποίηση** του `?next=` (ωμά `'/login'`/`'next'`, χωρίς `safeReturnPath`) ⇒ `loginHref` · κουμπί του `AdminSetupPageContent` ⇒ με επιστροφή · ωμά «Σφάλμα» του onboarding ⇒ `onboarding.org.saveFailed`. 🔒 **Άγκυρα Ε** (`return-path.test.ts`): κλειστό σύνολο 4 δηλωμένων με λόγο (αποσύνδεση · αποχώρηση · σύνδεσμος μιας χρήσης · `/home`), αμφίδρομο, φράχτης σύμπαντος, μετάλλαξη 2 κόκκινα. Νέα εγγραφή για τους **συνδέσμους** «Σύνδεση». |
| 2026-10-01 | ✅ **`PrimaryFilterBar` → `ui/scroll-rail` — ΕΚΛΕΙΣΕ (ADR-896 §7Α.6, Opus 5.5, απόφαση Giorgio «μία γραμμή με βελάκια»).** Κριτήρια μέσα στη λωρίδα, «Καθαρισμός» και «Περισσότερα» καρφωμένα έξω (Airbnb), καμία `md:` αναδίπλωση. Το ζωντανό περπάτημα βρήκε τρία σφάλματα στο **ίδιο** το `ScrollRail`, που αφορούσαν και το `/pro`: το κλικ σε μισοκρυμμένο τσιπ χανόταν, το ανοιχτό αναδυόμενο έμενε ορφανό στην κύλιση, και η επιστροφή εστίασης ακύρωνε την κύλιση του ανθρώπου. Διορθώθηκαν όλα, με άγκυρες Λ10–Λ13. Το στενό περπατήθηκε σε πραγματικό παράθυρο 735px (ελάχιστο του Chrome): CLS 0,0023, φύλλο φίλτρων εντάξει, και το κουμπί-εικονίδιο ισιώθηκε από 30px σε 34px (`self-stretch`). |
| 2026-10-01 | ✅ **ΤΡΙΤΗ ΔΙΑΤΑΞΗ ΛΙΣΤΑ ‖ ΧΑΡΤΗΣ ΕΚΤΟΣ SSoT — ΕΚΛΕΙΣΕ (ADR-896 §4.5 · ADR-777 §8.84, Opus 5.5).** Όχι με «υποδοχή στενής εκδοχής» στο `ListMapSplit`: οι δύο διατάξεις είναι **διαφορετικής φύσης** (σελίδα: μέτρηση περιέκτη σε JS + καρτέλες · οθόνη: γεωμετρία μόνο CSS, CLS 0 + φύλλο 3 στάσεων). Μία αυθεντία γεωμετρίας (`list-map-layout.ts` → `LIST_MAP_SCREEN_*`) + δεύτερο λεπτό κέλυφος `ListMapScreen`. Άγκυρες `ListMapScreen.test.tsx` Σ1–Σ3, `results-layout-authority` Α2/Α2β. |
|------------|--------|

## Pending tasks (συνέχεια — ανοιχτά που βρίσκονταν κάτω από το Changelog)

- [ ] 🟡 **`IntersectionSnapEngine` — 6ο χειρόγραφο uniform grid, ΚΑΤΑΓΡΑΜΜΕΝΟ στο baseline (2026-07-27, ADR-650 §M10e).**
  Το νέο registry module `point-hash-grid` (`5af198b0`) έφερε στο φως **υπάρχον** χρέος: το
  `snapping/engines/IntersectionSnapEngine.ts` χτίζει δικό του tolerance-keyed `Map<number, Map<number, number[]>>`
  — 4 violations, το μοναδικό αρχείο που πρόσθεσε το νέο pattern (129→133, 89→90 αρχεία). **Η αύξηση
  του baseline ΔΕΝ είναι νέα παραβίαση**: είναι νέος κανόνας που μετρά παλιό κώδικα. Χωρίς την
  καταγραφή, κάθε commit που αγγίζει τον engine θα μπλόκαρε.
  **Fix:** αντικατάσταση με `PointHashGrid` (`core/spatial/PointHashGrid.ts`) — ίδια ερώτηση
  («υπάρχει σημείο μέσα σε τ;»), ήδη δοκιμασμένη. Εκτίμηση: μικρό, 1 αρχείο· θέλει τα snapping tests.
  ⚠️ Αγγίζει shared snapping — να μη γίνει ενώ τρέχουν άλλοι agents στο ίδιο δέντρο.

- [ ] **`primaryEmailOf` — πέντε αντίγραφα δείχνουν αλλού** (ADR-777 §8.33, N.0.2)
  - **Τι**: η ερώτηση «σε ποιο email μιλάμε σε αυτή την επαφή;» είναι γραμμένη
    τουλάχιστον **πέντε** φορές — και **δεν λένε όλα το ίδιο**: άλλα κάνουν
    `emails.find(isPrimary)?.email ?? emails[0]?.email`, άλλα σκέτο `emails[0].email`,
    δηλαδή **στέλνουν στο λάθος email** όταν το κύριο δεν είναι πρώτο στη λίστα.
  - **Πού**: `services/ai-pipeline/tools/handlers/messaging-handler.ts` ·
    `services/ai-pipeline/tools/handlers/org-structure-handler-utils.ts` (**δύο** σημεία) ·
    `services/ai-pipeline/shared/contact-lookup-search.ts` ·
    `services/contact-recognition/contact-linker.ts`
  - **Ο κανονικός τόπος υπάρχει ήδη**: `src/lib/contacts/primary-email.ts` (§8.33).
    Δεν είναι έκτο αντίγραφο — είναι το SSoT όπου θα δείξουν τα πέντε.
  - **Γιατί ΔΕΝ έγινε τότε**: τέσσερα από τα πέντε ζουν κάτω από
    `services/ai-pipeline/`, όπου **κάθε** άγγιγμα ενεργοποιεί τον **N.10**
    (`npm run test:ai-pipeline:all`, 77 σουίτες). Σχήμα «μεγάλο διπλότυπο» του N.0.2.

- [ ] **CHECK 3.29 — DXF Viewer TS Error Ratchet: +525 σφάλματα σε 237 αρχεία (N.17)**
  - **Τι**: το `dxf:tsc:check` πέρασε από baseline καθαρό σε **+525** σφάλματα (κορυφαίοι κωδικοί:
    TS2353×135, TS2345×116, TS2322×69, TS2739×26, TS2352×25, TS2741×24, TS2339×23, TS2305×13,
    TS2554×11, TS2304×8 — 33 διακριτοί κωδικοί συνολικά). Πλήρης αναφορά: `npm run dxf:tsc:report`.
  - **Γιατί ΔΕΝ έγινε**: **N.17 απαγορεύει σε πράκτορα να τρέξει `tsc`** — άρα δεν υπάρχει τρόπος
    να επαληθευτεί καμία διόρθωση εδώ χωρίς να παραβιαστεί ρητός κανόνας. Ο Giorgio τρέχει τον
    έλεγχο περιοδικά· αυτό είναι δικό του πέρασμα.

- [ ] **CHECK 3.30 — Barrel-aware Dead-export Ratchet: 58→14 dead exports · 5→3 dead files** (μερικώς ΕΓΙΝΕ 2026-08-24, ADR-700 §5)
  - ✅ **ΤΙ ΕΓΙΝΕ**: δεύτερο πέρασμα διαγραφής, **7 συστάδες, ατομικά commits**. Νέες παραβιάσεις
    **58→14 exports** και **5→3 files**· επιπλέον **−57 exports / −10 files από την ΙΔΙΑ τη baseline**
    (κάθε διαγραμμένο αρχείο πήρε μαζί του τις δικές του καταχωρήσεις). **jest 301 suites / 4.297 tests
    πράσινα**, `jscpd:diff` καθαρό, **+0 νέες** παραβιάσεις ⇒ καμία ζωντανή εξάρτηση δεν αποσυνδέθηκε.
    Πλήρης λογιστική ανά συστάδα + οι αντικαταστάτες: **ADR-700 §5, εγγραφή 2026-08-24**.
  - 🔶 **ΤΙ ΜΕΝΕΙ — 14 exports + 3 files, ΟΛΑ θέλουν ΑΠΟΦΑΣΗ GIORGIO** (⚠️ **ΜΗΝ** τα διαγράψει
    πράκτορας: και τα πέντε αρχεία είναι **πρόσφατα** —29/07 έως 22/08— δηλαδή 🔴/🟡 στο `--triage`,
    **ποτέ** 🟢· το handoff §6 το απαγορεύει ρητά):
    1. **`styles/DxfSurface.styles.ts`** (8 exports + το αρχείο) — μόνος importer το
       `collaboration/CollaborationOverlay.tsx`, που έχει **μηδέν** δικούς του. Είναι **ακριβώς** η
       συστάδα `collaboration/` που το **ADR-700 §4.Δ.1 ήδη πήγε σε άνθρωπο** (Speculative Generality,
       «δεν αντικαταστάθηκε — δεν συνδέθηκε ποτέ»). **Ίδια απόφαση, ίδιος τόπος: μένει ή φεύγει ΟΛΟ.**
    2. **`bim/types/{geometry,shared-params}.schemas.ts`** (3) — γεννήθηκαν **22/08**, commit ADR-792
       *«(12/15)»* = **ΕΝ ΕΞΕΛΙΞΕΙ**. Το `MEP_ELEMENT_TAIL_FIELDS` έχει **δύο** πραγματικούς importers
       (`mep-fitting`/`mep-segment.schemas.ts`) που είναι **και οι δύο** ασύνδετοι ⇒ υποδέντρο «σωστό
       αλλά μη καλωδιωμένο» = **η δηλωμένη κλάση ψευδώς θετικών** της πύλης (περίπτωση `generic-solid`,
       ADR-684). **Ερώτημα: ολοκληρώνεται το ADR-792 ή είναι νεκρό;**
    3. **`bim/table/table-row-link-resolver.ts`** (2) — ADR-739 Φ.B1/B2, **ενεργό WIP**.
    4. **`systems/topography/topo-elevation-assign.ts#ElevationAssignment`** — ο καταναλωτής του
       `AssignTopoElevationCommand.ts` είναι **ο ίδιος** ασύνδετος (ADR-731 ημιτελές).
  - 🔴 **ΔΟΜΙΚΟ ΕΛΑΤΤΩΜΑ ΤΗΣ ΙΔΙΑΣ ΤΗΣ ΠΥΛΗΣ — ΔΕΝ διορθώθηκε, θέλει εντολή**: τα
    `core/spatial/index.ts` (14 πραγματικοί importers) και
    `text-engine/title-block/reading/title-block-reading.types.ts` (7) αναφέρονται «dead files» ενώ
    είναι **ζωντανά**. Αιτία **μετρημένη**: `localExports === 0` (19 και 6 **re-exports**, μηδέν δικοί
    τους ορισμοί) ⇒ στο `classifyFile` το `verdicts.every(...)` πάνω σε **κενό** πίνακα είναι **κενά
    αληθές**, και το `liveModules` δεν τα περιέχει γιατί η ζωντάνια αποδίδεται —σωστά— στο module που
    **ορίζει**. *Ένα barrel που περνά τα πάντα και δεν ορίζει τίποτα κρίνεται νεκρό επειδή δεν έχει
    τίποτα δικό του να κριθεί.* ⚠️ Το `core/spatial/index.ts` **ήταν ήδη** στη λίστα πριν (είχε ένα
    τοπικό export, το νεκρό `SpatialTypeGuards`)· η αφαίρεσή του **δεν** το έλυσε — το **αποκάλυψε**.
    **Θεραπεία**: `classifyFile` → `false` όταν `localExports.length === 0 && reexports.length > 0`,
    **ΟΧΙ** rebaseline. Θέλει άγκυρα + μετάλλαξη, δηλαδή δικό του commit.
  - ⚠️ **Η baseline ΔΕΝ ξαναγράφτηκε επίτηδες**: rebaseline τώρα θα **κλείδωνε** και τα τέσσερα ανοιχτά
    ως «αποδεκτά» — και μαζί το ελάττωμα του barrel. Πρώτα η απόφαση, μετά `npm run barrel-deadcode:baseline`.
  - ⚠️ **Εκκρεμεί browser check** (N.17: ο πράκτορας δεν τρέχει tsc).

- [ ] **CHECK depcruise (ADR-598 G9+G10) — cycles +469, boundaries: ΕΝΤΑΓΜΕΝΟ σε ενεργό WIP άλλου agent**
  - **Τι**: το CI στο commit `3acdea1` έδειξε `cycles: 1299 → 1768 (+469)` και
    `not-to-dxf-internals: 335 → 396 (+61)` / `services-not-to-components: 20 → 21 (+1)`. Τοπικά όμως
    (στο πιο πρόσφατο local HEAD) το `depcruise:boundaries` βγαίνει **27/361** (πολύ κάτω από baseline) —
    η απόκλιση δείχνει ότι το `.dependency-cruiser.cjs` και/ή το γράφημα εξαρτήσεων άλλαξαν σημαντικά
    από **άλλον agent που δουλεύει στο ίδιο δέντρο ταυτόχρονα** (14+ commits μέσα στη διάρκεια αυτού
    του session, ADR-787 §5.3 refactor).
  - **Γιατί ΔΕΝ έγινε**: αγγίζει κοινό state (`.dependency-cruiser.cjs`, baseline JSON) ενώ άλλος
    πράκτορας κάνει ενεργό commit stream πάνω στο ίδιο repo — memory hub «Multi-agent shared tree»
    το απαγορεύει ρητά («τίποτα καθολικό: ούτε stash, ούτε reseed baseline πάνω σε ξένο WIP»). Θέλει
    να ξαναμετρηθεί **μετά** που θα σταθεροποιηθεί το δέντρο.

- [ ] **CHECK 3.18 — SSoT Discover: 13 unprotected registry gaps + 1 «anti-pattern» που είναι ψευδώς θετικό**
  - **Τι (unprotected, 13 αρχεία)**: `survey-card-config.ts`(36) · `title-block-binding-id.ts`(7) ·
    `survey-record-labels.ts`(5) · `survey-list-config.ts`(5) · `survey-bindable-fields.ts`(5) ·
    `greek-person-name.ts`(4) · `survey-card-order.ts`(4) · `project-role-labels.ts`(4) ·
    `survey-row-bindings.ts`(3) · `test-harness-access.ts`(2) · `greek-name-order.ts`(1) ·
    `environment-contract.ts`(1) · `document-body-vocabulary.ts`(1) — παλιά (ADR-759), όχι νέο χρέος.
  - **Γιατί ΔΕΝ έγινε**: εγγραφή στο `.ssot-registry.json` θέλει `forbiddenPatterns` regex ΑΝΑ module
    που να πιάνει «κάποιος αντέγραψε αυτό το catalog αλλού» — αυτό είναι κρίση περιεχομένου ανά αρχείο,
    όχι μηχανική προσθήκη· 13 modules × ουσιαστική ανάλυση = N.0.2 «μεγάλο, ασαφές» ⇒ pending.
  - **Τι (anti-pattern «manual sort by locale», 5 αρχεία)**: ΕΛΕΓΧΘΗΚΑΝ ΚΑΙ ΤΑ 5 — **όλα ψευδώς θετικά**.
    Ο σαρωτής (`scripts/ssot-discover.sh`) δεν ξεχωρίζει «ταξινόμηση εμφανιζόμενου κειμένου ανά locale»
    από «ντετερμινιστικό tie-break σε τεχνικό αναγνωριστικό»: `scene-title-block-cells.ts`/
    `DemandBlockerList.tsx` ταξινομούν ρητά ΓΙΑ σταθερότητα (σχόλιο το λέει), όχι για εμφάνιση·
    `survey-record.service.ts` ταξινομεί ISO ημερομηνίες (`localeCompare` ως γενικός συγκριτής
    strings — locale collation θα ΕΣΠΑΖΕ τη χρονολογική σειρά)· `formula-catalog.ts` έχει ήδη ρητό
    σχόλιο για το `'en'`· `token-color-leaves.ts` ταξινομεί dev-tool paths (η γειτονική γραμμή
    χρησιμοποιεί ήδη σκέτο `<`/`>`, επιβεβαιώνοντας ότι η πρόθεση είναι τεχνική, όχι locale).
  - **Γιατί ΔΕΝ έγινε καμία αλλαγή**: το ΝΑ τα μετατρέψω σε `compareByLocale()` θα ήταν **λάθος** —
    θα εισήγαγε locale-εξάρτηση σε 4 περιπτώσεις όπου χρειάζεται ντετερμινισμός/ISO ordering.
    Ο σαρωτής χρειάζεται καλύτερο κριτήριο (π.χ. εξαίρεση όταν λείπει `t()`/i18n γύρω από την τιμή),
    όχι το επόμενο αρχείο να πληρώσει για τον πήχη.

- [ ] **Το κενό σχήματος του `mapPropertyDoc` — ΤΡΙΑ πεδία** *(ADR-842 §7.6.13, 06/09)*
  - **Πού**: `src/lib/firestore-mappers.ts` → `mapPropertyDoc` απαριθμεί **42** από τα **45**
    πεδία που δηλώνει ο `Property` (+ `PropertySpecificationFields`).
  - **Τι λείπει**: `createdBy` · `offerKinds` · `offers`.
  - **Γιατί ΔΕΝ είναι επείγον**: ο δεύτερος αναγνώστης (`toProperty`) **διαγράφηκε** — ήταν
    νεκρός. Άρα το κενό σήμερα **δεν βλάπτει κανέναν**: κανείς δεν περιμένει αυτά τα πεδία από
    ανάγνωση. Είναι απόφαση **ανά πεδίο**, όχι μηχανική προσθήκη:
    `createdBy` = μεταδεδομένο διακομιστή (ADR-238) — το θέλει ο πελάτης;
    `offers`/`offerKinds` = το νέο λεξιλόγιο διαθέσεων (ADR-777 Α20) — παραλείφθηκαν επειδή
    **δεν υπήρχαν** ή επειδή **αποφασίστηκε**;
  - ⚠️ **ΜΗΝ προσθέσεις το `companyId`**: ο mapper το ρίχνει **επίτηδες** — είναι πεδίο
    **μισθωτή**, όχι οντότητας (ADR-214). Το `property-deletion-guard.ts` το διαβάζει
    **χωριστά** και σωστά· αυτό είναι το πρότυπο.

- [ ] **Γραμμή `Property` στον πίνακα `BOUNDARIES` του CHECK 3.74** *(ADR-842 §7.6.13, 06/09)*
  - **Τι**: η συλλογή `properties` έχει πλέον **ΕΝΑ** σύνορο (`mapPropertyDoc`), αλλά **καμία
    πύλη δεν το επιβάλλει** — σε αντίθεση με `PublicListing` και `OwnerProperty`.
  - 🔴 **Δύο μετρημένα εμπόδια, γι' αυτό δεν έγινε τώρα**:
    1. **Η μηχανή χρειάζεται αλλαγή**: το `assertionOf` είναι `as\s+${typeName}`, που θα
       έπιανε και τα **~20 νόμιμα** `as Property['field']` μέσα στον **ίδιο** τον mapper
       (δεικτοδότηση πεδίου, **άλλο πράγμα** από ισχυρισμό εγγράφου). Θέλει negative lookahead
       για `\s*\[` — αλλαγή **μηχανής**, άρα με **δική της** άγκυρα.
    2. **Τρεις ισχυρισμοί σε παραγωγή που ΔΕΝ έχουν ερευνηθεί**:
       `components/sales/shared/use-sales-properties-list-page.ts:52,53` ·
       `hooks/useSalesPropertiesViewerState.ts:99`. Είναι **επανα-τυποποίηση πινάκων στη
       μνήμη**, όχι αναγνώσεις εγγράφου — δηλαδή **άλλο** ελάττωμα (πλάτυνση μεταξύ δύο
       `Property`-οειδών τύπων).
  - ⛔ **ΜΗΝ τους δηλώσεις «εξαιρέσεις με λόγο» χωρίς να τους ερευνήσεις**: ένας λόγος που δεν
    μετρήθηκε είναι ακριβώς το αμάρτημα που καταγγέλλει όλο το §7.6.13.
  - **Πώς κλείνει**: (α) εντόπισε από πού έρχονται τα `filteredUnits`/`allUnits` και γιατί
    χρειάζονται ισχυρισμό· (β) lookahead + άγκυρα μηχανής· (γ) μία γραμμή στον πίνακα.

- [ ] **ΤΟ RATCHET ΝΕΚΡΟΥ ΚΩΔΙΚΑ ΔΕΝ ΒΛΕΠΕΙ ΕΞΑΓΩΓΕΣ — 1026 αζήτητες, ΜΗΔΕΝ πύλη** *(ADR-842 §7.6.13 Α, 06/09)*
  - **Τι**: το `.deadcode-baseline.json` (CHECK 3.22) έχει **μόνο** κλειδί `files` — **13**
    αρχεία. Το `npx knip --include exports,types --reporter compact` τυπώνει **1026** γραμμές
    και **κανένα** ratchet δεν τις μετρά.
  - 🔴 **Αυτό ακριβώς άφησε το `useContactsState` να ζήσει**: το αρχείο μετρούσε ζωντανό επειδή
    **ένα** `import type { ViewMode }` το κρατούσε, ενώ η **εξαγωγή** του ήταν αζήτητη. Και
    μαζί του έζησε **ζωντανό ελάττωμα** (ο πομπός AI που εξέπεμπε σε άδεια συχνότητα).
  - ⚠️ **ΜΗΝ βάλεις απλώς `exports` στη baseline και τρέξεις `deadcode:baseline`**: θα
    κλείδωνε **1026** ευρήματα ως «αποδεκτά» χωρίς να τα δει άνθρωπος — το ίδιο σχήμα με το
    «`0` = κανείς δεν κοίταξε» που αυτό το ADR μετρά **πέντε** φορές.
  - **Πώς κλείνει**: πρώτα **τριάζ** (πόσες από τις 1026 είναι δημόσιο API vs πραγματικά
    αζήτητες), μετά baseline. Δικός του παρονομαστής, δική του συνεδρία.

- 🟡 **07/09 — ΤΟ ΚΟΙΝΟ ΕΡΓΟΣΤΑΣΙΟ `PublicListing` ΖΕΙ ΣΕ ΛΑΘΟΣ ΔΙΕΥΘΥΝΣΗ** *(βρέθηκε στο **ADR-777 §8.62** — **άσχετο με εκείνη τη δουλειά**)*

  Το `listing()` — το **μοναδικό** εργοστάσιο που κατασκευάζει πλήρη `PublicListing`
  (~50 υποχρεωτικά πεδία) — ζει στο **`src/lib/demand/__tests__/demand-fixtures.ts`**,
  δηλαδή κάτω από τον τομέα **της ζήτησης**.

  🔑 **Δεν είναι αισθητικό.** Το ίδιο το αρχείο δηλώνει ότι *«εξήχθη όταν το χρειάστηκε η
  δεύτερη σουίτα»* — άρα είναι **αναγνωρισμένο κοινό αγαθό**. Η σουίτα του §8.62
  (`search-results/__tests__/ledger-covers-rendered.test.tsx`) το εισάγει **διασχίζοντας
  τομέα**, γιατί η εναλλακτική ήταν να ξαναγραφούν 50 πεδία — δηλαδή **δίδυμο** που το
  **N.18 (jscpd / CHECK 3.28)** πιάνει δικαίως.

  ⚠️ **Ο κίνδυνος είναι να μη γίνει η εισαγωγή**: ο επόμενος που θα χρειαστεί
  `PublicListing` σε τρίτο τομέα θα δει διαδρομή `lib/demand/__tests__/…`, θα σκεφτεί
  *«αυτό είναι της ζήτησης, δεν με αφορά»*, και θα **κλωνοποιήσει**. Η λάθος διεύθυνση
  **παράγει** τον κλώνο που το N.18 μετρά.

  **Τι**: μετακόμιση σε ουδέτερο σπίτι (π.χ. `src/lib/listings/__tests__/__fixtures__/`
  ή `src/test-utils/`), με το `demand-fixtures.ts` να **επανεξάγει** ό,τι αφορά τη ζήτηση.

  **Γιατί pending και όχι τώρα (N.0.2)**: αγγίζει **7 σουίτες** που το εισάγουν
  (`demand-answer` · `demand-concessions` · `demand-interest` · `demand-matching` ·
  `land-exchange-meeting` · `public-listings-corpus` · και η νέα του §8.62) ⇒ **4+ αρχεία,
  2 τομείς** ⇒ κατά τον κανόνα πάει στη λίστα, δεν γίνεται μέσα σε άλλη εργασία.

  **Πώς επαληθεύεται ότι έκλεισε**: `grep -rn "demand-fixtures" src/` δεν επιστρέφει
  εισαγωγή από φάκελο **εκτός** `lib/demand/`, και το `npm run jscpd:diff` στα αγγιγμένα
  μένει καθαρό.

---

### 🔁 Διπλότυπο `extractScene` (processed DXF JSON → σκηνή) — ADR-922 §5.4 · 2026-10-24

**Πού**: `functions/src/storage/dxf-thumbnail-onfinalize.ts` (`extractScene`) και
`src/services/floorplans/dxf-thumbnail-selfheal.ts` (`extractScene`) — ίδιο σώμα, δύο αντίγραφα.

**Γιατί pending και όχι τώρα (N.0.2)**: το ένα ζει στα Cloud Functions ⇒ η ένωση θέλει **προβολή** (ADR-874,
`generate:functions-projection`) σε νέο leaf module (π.χ. `src/lib/dxf/processed-scene.ts`) **και** deploy Functions.
Δεν το απαιτεί το ADR-922 (που δεν αγγίζει τον εταιρικό αγωγό).

**Τι**: leaf `processedSceneFromJson(raw: unknown): DxfSceneInput | null` στο `src/lib/dxf/`, προβολή στα Functions,
και οι δύο καλούντες το εισάγουν.

**Πώς επαληθεύεται ότι έκλεισε**: `grep -rn "function extractScene" src functions/src` δεν επιστρέφει τίποτα.

---

### 📥 `useRfqLines` / `listRfqLines` αγνοούν το `linesStorage: 'inline_legacy'` — ADR-327 §8.5.4 · 2026-10-28

**Πού**: `src/subapps/procurement/hooks/useRfqLines.ts` (συνδρομή **μόνο** στην υποσυλλογή `lines`) και
`services/rfq-line-service.ts` `listRfqLines` (ίδιο). Ο κανόνας αποθήκευσης ζει στο `rfqLinesLocation` /
`resolvePublicRfqLines` (`types/rfq-line.ts`) και τον τηρούν **μόνο** οι αναγνώστες του server (`readRfqLines*`).

**Συνέπεια**: σε παλιό RFQ με γραμμές inline, το `QuoteRfqBindingReview` (σάρωση + χειροκίνητη) και το «Γραμμές από
το αίτημα» δεν βλέπουν καμία γραμμή ⇒ κρύβονται σιωπηλά· ο server (`assertPmRfqBinding`) διαβάζει σωστά.

**Γιατί pending και όχι τώρα (N.0.2)**: το `useRfqLines` έχει **4+** καταναλωτές (σελίδα RFQ, builder, φόρμες) και
γράφει κιόλας (`addLine`/`bulkAdd`) — η διόρθωση αγγίζει τη δομή ανάγνωσης/γραφής, όχι ένα σημείο.

**Τι**: ο hook παίρνει το RFQ (`RfqLinesHolder`) και εφαρμόζει `resolvePublicRfqLines` — ή ξεχωριστός hook ανάγνωσης.

**Πώς επαληθεύεται ότι έκλεισε**: test με RFQ `linesStorage: 'inline_legacy'` ⇒ το `QuoteRfqBindingReview` αποδίδει γραμμές.

---

### 🧭 Δύο κανόνες για «την ειδικότητα του RFQ» — ADR-327 §8.5.4 · 2026-10-28

**Πού**: `RfqDetailClient.tsx` — ο σύνδεσμος σάρωσης βάζει `trade` μόνο όταν `!rfqIsMultiTrade` (1η γραμμή)· η
χειροκίνητη φόρμα και η πύλη χρησιμοποιούν `rfqLeadTrade` (1η γραμμή **πάντα**, `types/rfq.ts` — «ONE rule»).

**Γιατί pending**: απόφαση προϊόντος (σε πολυ-ειδικότητα RFQ, προεπιλογή ή κενό;) — όχι τεχνική.

**Τι**: ένας κανόνας για όλες τις επιφάνειες του PM (π.χ. `rfqDefaultQuoteTrade`), δίπλα στο `rfqLeadTrade`.

**Πώς επαληθεύεται ότι έκλεισε**: `grep -n "rfqIsMultiTrade" RfqDetailClient.tsx` δεν δίνει δεύτερο κανόνα ειδικότητας.

---

### 🪦 Νεκρή εξαγωγή `ACTIVITY_TYPE_OPTIONS` — θέλει `git rm` (Giorgio) · 2026-10-29

Το `src/config/company-gemi/options/activity-types.ts` (`ACTIVITY_TYPE_OPTIONS`, re-export σε `company-gemi/options/index.ts`
και `company-gemi/index.ts`) **δεν το αποδίδει καμία φόρμα** (μετρημένο με Grep, ADR-195 (ι)). Στο 🏷️′ #2 έγινε παράγωγο της
ρίζας `KAD_ACTIVITY_TYPES`, ώστε να μη μένει δεύτερο λεξιλόγιο. Η διαγραφή του αρχείου απαγορεύεται στον πράκτορα (κοινό
working tree). Θεραπεία: `git rm` του αρχείου + αφαίρεση των 2 re-exports.

---

### 🗂️ (β) Κάθε component ζητά ΜΟΝΟ τα namespaces των κλειδιών του — ADR-280 §11.5 · 2026-10-30

Το επίπεδο (α) έκλεισε (CHECK 3.108: μία δήλωση οικογένειας). Μένει το (β), που είναι το «σωστό στο τέλος».

**Μετρημένο:**
- **~85%** των αρχείων χρειάζονται **ένα** namespace της οικογένειας, αλλά φορτώνουν όλη την οικογένεια
  (κτίριο: ~164 KB αντί για 8–47 KB).
- ~25% έχουν δυναμικά κλειδιά.
- **Ξαναμετρημένο 2026-10-30 (#11, ADR-280 §11.6)**: 871 αρχεία με οικογένεια · **276 (32%) «τα πάντα»** · 580 στενεύουν. ⚠️ Το κέρδος
  δικτύου κρίνεται από την **ένωση ανά διαδρομή**, όχι ανά αρχείο — μέτρηση εκκρεμεί (Φάση 0).
- 🔴 **Φάση 0 ΜΕΤΡΗΘΗΚΕ 2026-10-30 (ADR-280 §11.7)**: με τη σημερινή εκκίνηση το (β) δίνει **0 KB σε 216/216 οθόνες**
  (πρώτη απόδοση **και** βαθιά). Και τα 47 namespaces των 13 οικογενειών είναι στο `CRITICAL_NAMESPACES`, που το
  `config.ts` κατεβάζει σε **κάθε** εκκίνηση (σύνολο εκκίνησης 1.906,8 KB raw / 532,4 KB gzip στο `el`· οι
  οικογένειες 1.495,7 KB). Αντιπαράδειγμα «εκκίνηση = μόνο κέλυφος»: κέρδος (β) common 1.580 · projects 319 ·
  contacts 258 · crm 188 · navigation 115 KB·οθόνες· building/payments/dxf-viewer/geo-canvas **0** (μπλοκάρουν τα
  γενικά renderers «τα πάντα»: `UniversalTabsRenderer`, `ServiceForm*`, `AdvancedFilters*`, `PlaceholderTab`,
  `listing-price-label.ts`). Ανά οθόνη χρειάζονται διάμεσος **122 KB** (p90 277) από τα 1.495,7 που προφορτώνονται·
  `dxf-viewer` = 594,5 KB (31% της εκκίνησης) για 8/216 οθόνες στην πρώτη απόδοση.
  ⇒ Ο μοχλός δικτύου είναι το **`CRITICAL_NAMESPACES`** (χειρόγραφο «τι μπορεί να μονταριστεί αργότερα» = η βαθιά
  κλειστότητα που η μέτρηση **παράγει**). Το (β) μόνο του = υγιεινή δηλώσεων. Επόμενη κίνηση: **απόφαση Giorgio**.
  Script μέτρησης: σύνθεση των `computeShellClosure` / `buildLazyRouteNamespaces` / `requestOf` / `nodePaths`
  (82/82 ίσο με τη μηχανή· μετάλλαξη «χωρίς compat» ⇒ 59/82 αποκλίνουν) — **εκτός repo**· αν γίνει μόνιμο, θα ζει
  ως λειτουργία αναφοράς του `scripts/check-i18n-namespace-family.js`, όχι ως νέο script.
- 🧭 **Απόφαση Giorgio 2026-10-30: επιλογή 1 — πιλότος «`dxf-viewer` εκτός `CRITICAL_NAMESPACES`»** (ADR-280 §11.8).
  ✅ Β1 ο χάρτης `lazy-route-namespaces.json` καταναλώνεται (ADR-744 §33). ✅ Β2 `/dxf/viewer` μέσω `LazyRoutes.DXFViewer`.
  ✅ Β3α `useDxfImportNotifications` → `translateOnDemand` (νέο `src/i18n/translate-on-demand.ts`).
  ✅ Β3β CHECK 3.13 με παραγόμενη εμβέλεια (`scripts/lib/i18n/resolver-config-scope.js`) ⇒ −`dxf-viewer` από το
  `SERVICE_FORM_NAMESPACES` (ADR-279 Decision Log 2026-10-30). 🔎 Επόμενο του ίδιου σχήματος (εκτός πιλότου): το
  `service-config` χρειάζεται 6 από τα 20 namespaces της λίστας — τα 14 θέλουν απόδειξη για τα ρητά `t(…)` των renderers.
  ✅ Β4.0 `require` ≠ `import()` στον κοινό parser (ADR-744 §33.1). ⏳ Β4.1 `defineLazySurfaces` · Β4.2 κανόνας
  εισδοχής στο CHECK 3.34 · Β4.3 (5 σελίδες μέσω μητρώου · `ReserveDialog` · `PropertyDossierTabs`· ⚠️ ΟΧΙ
  `TimelineTabContent.tsx`/`PropertiesScreen.tsx` — ξένη WIP) ·
  ⏳ Β4 κανόνας εισδοχής ως πύλη στο CHECK 3.34 (+ η χειρόγραφη
  `namespaces` εγγραφής μητρώου είναι αόρατη στο Κ1/Κ2) · Β5 αφαίρεση (ρητό «ναι» για τη σφράγιση Κ2) · Β6 el+en.
  ⚠️ Για το commit: τα αλλαγμένα `lazy-config.ts` / `lazyRouteFactory.tsx` ⇒ `npm run generate:i18n-shell-slice:index`.
  ✅ **Β4.1 ΕΚΛΕΙΣΕ 2026-10-30** (ADR-744 §33.2): `defineLazySurfaces` στην ΙΔΙΑ μηχανή (ένα πεδίο config, δύο είδη)
  + «καλών `defineLazy*` εκτός μητρώων ⇒ άρνηση» (γεννήτορας + Layer 1). Χάρτης 82/57 αμετάβλητος. Μεταλλάξεις 6/6.
  Επόμενο: Β4.2.
  ✅ **Β4.2 ΕΚΛΕΙΣΕ 2026-10-30** (ADR-744 §33.3): ο κανόνας εισδοχής ως πύλη (γεννήτορας + CI· έκλεισε και το κενό του
  `--full` που δεν έκρινε τον χάρτη). Αφετηρία `lazyAdmissionDebt` **400** τριάδες / 111 ρίζες (0 dxf) — 🔴 RATCHET κατά
  ταυτότητα, burn-down. Επόμενο: Β4.3 = 5 σελίδες προϊόντος + **5 harness** + `ReserveDialog` + `PropertyDossierTabs`.
  ⚠️ Commit: `generate:i18n-shell-slice:index`· τα Ν3/Χ1/Χ3/Χ4 του `i18n-route-slices.test.js` θέλουν αναγεννημένο manifest.
  ✅ **Β4.3 ΕΚΛΕΙΣΕ 2026-10-31** (ADR-744 §33.4): με εκκίνηση **χωρίς** τα 6 dxf, η `admissionDebt` δίνει **0** τριάδες dxf
  (ήταν 93). 5 σελίδες + harness από μητρώο· επιφάνειες `SalesReserveDialog` / `PropertyDossierTab`. Νέος **κανόνας Ρ**:
  `import()` στόχου εγγραφής εκτός μητρώου ⇒ άρνηση, που έπιασε τον 5ο harness `dxf-perf` και το `preloadRoutes`.
  Νέο `preload()` στο factory. Εισδοχή 400 → 321· Κ2 57 → 77 (ρητό «ΝΑΙ»). Μεταλλάξεις 7/7. **Επόμενο: Β5** (ρητό «ναι»).
  ⚠️ Ξένο, μπλοκάρει την **εγγραφή** του γεννήτορα: η WIP του ADR-923 (`catalog-ui-hooks.ts`) πρόσθεσε 3 ζεύγη `→ catalog`
  (Κ2 80 > 77), και υπάρχουν 3 ακόμη ευρήματα του catalog. Τα κρίνει ο κάτοχός της.
  🔎 **Νέο, μετρημένο (μοχλός μείωσης Κ2):** όρια κώδικα στις καρτέλες του `PropertyDetail` (BIM / κάτοψη / περιήγηση /
  τήρηση εγγράφων). Η εγγραφή περιμένει 8 namespaces εκτός εκκίνησης· κάθε όριο που τα κόβει κατεβάζει τη σφράγιση 77.
  🔎 **Νέο (N.0.2):** στο `SalesSidebar.tsx` μένουν 4 τοπικά `dynamic()` (`ChangePriceDialog` · `SellDialog` · `RevertDialog` ·
  `ConveyanceTab`, το τελευταίο με χρέος `conveyance` ×2). Θεραπεία: εγγραφές στο `sales-surfaces.tsx`, ώστε η εισδοχή να πέσει
  και το αρχείο να έχει ένα ιδίωμα. Θέλει ρητό «ναι», επειδή ανεβάζει το Κ2.

**Θεραπεία:**
- Γεννήτορας που παράγει τη δήλωση από τα κλειδιά, με τον ταξινομητή AST του CHECK 3.34 (`key-extract.js`) και το
  `requestOf` του 3.108 για τη διαφυγή του `t`.
- Πύλη «περιττό namespace» (ratchet), ώστε η δήλωση να **επαληθεύεται** και προς τις δύο κατευθύνσεις μαζί με το
  CHECK 3.8.

**Τα 5 `order-bearing` της baseline `.i18n-namespace-family-baseline.json`** λύνονται εδώ, με ρητό `ns` στο κλειδί
που συγκρούεται:

| Αρχείο | Κλειδί που συγκρούεται |
|---|---|
| `SalesAvailablePropertiesPageContent` | `status.pending` |
| `SalesSoldPageContent` | `status.pending` |
| `StoragePageContent` | `storages.*` |
| `PropertyDetailsContent` | `filters.allTypes` |
| `ReadOnlyMediaViewer` | `filters.title` |

**Ανοιχτά:**
- Typed keys (`CustomTypeOptions`): ξεχωριστή, μεγάλη απόφαση.
- **Εκτίμηση:** >1 ώρα, ~500 αρχεία ⇒ N.8: Plan Mode / Orchestrator με απόφαση Giorgio.

---


### 🧪 Τέσσερα τοπικά «είναι αρχείο test;» — N.0.2 · βρέθηκε 2026-10-30 (ADR-280 §11.8 Β4.1)

Το SSoT υπάρχει: `isTestSource` στο `scripts/lib/gate-input.js` («ό,τι δεν κρίνουν οι πύλες παραγωγής»). Τέσσερα
αρχεία γράφουν δικό τους ορισμό, **με διαφορετικά κριτήρια**, άρα η ίδια ερώτηση έχει τέσσερις απαντήσεις:
- `scripts/lib/contrast-promise/promise-sites.js:55` (`__tests__/` ή `.test|spec.tsx?`)
- `scripts/lib/basemap-sources/contract.js:105` (ίδιο, αλλά συνάρτηση)
- `scripts/lib/module-init/graph.js:35` (`.test|spec|e2e.spec|stories` — **χωρίς** `__tests__/`, **με** stories)
- `scripts/check-dxf-tsc-ratchet.js:159` (`TEST_FILE_RE`)

**Θεραπεία:** κάθε πύλη εισάγει το `isTestSource`. Όπου η απόκλιση είναι σκόπιμη (π.χ. το `stories` του 3.80), αυτό
δηλώνεται ως σύνθεση πάνω στο SSoT (`isTestSource(f) || isStory(f)`), όχι ως δεύτερο regex. Κάθε αλλαγή θέλει
μέτρηση πριν/μετά της πύλης που την αφορά (αλλαγή κριτηρίου = αλλαγή του τι κρίνεται).
**Εκτίμηση:** ~1 ώρα, 4 πύλες ⇒ απόφαση Giorgio για προτεραιότητα.

---
