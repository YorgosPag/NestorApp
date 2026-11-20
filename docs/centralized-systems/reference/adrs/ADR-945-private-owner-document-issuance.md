# ADR-945 — Ο ιδιώτης ιδιοκτήτης αναθέτει μόνος του την έκδοση εγγράφου (ΠΕΑ κ.ά.) από τον προσωπικό χώρο

**Κατάσταση:** ✅ ΕΓΚΡΙΘΗΚΕ ο σχεδιασμός (2026-11-18, §6) · Φ1 σχέδιο ✅ (§7) · Φ1α κώδικας ✅ (tsc/jest ⏳) · Φ1β ⏳
**Σχετικά:** ADR-915 §27 · §37 · §39 · §40 · §42 · ADR-942 §7.2 · ADR-943 · ADR-862 §5.3.11 · ADR-916 Φ-Ε1 · ADR-787 Ε-3 §3 · ADR-817

## 1. Πρόβλημα (εύρημα E2E 2026-11-18, επαληθευμένο στον κώδικα)

Ο ιδιώτης στο `/me` (ακίνητο στο `owner_properties`, `authorCompanyId = null`) **δεν μπορεί** να βρει και να αναθέσει
επαγγελματία για έκδοση εγγράφου:

- Οι ενέργειες «Βρες επαγγελματία» / «Ανάθεση» (`RegistryNextStep`, `RegistryIssuanceStep`) ζουν **μόνο** στο
  `/o/[workspace]/document-expiry`. Η σελίδα ακινήτου του ιδιώτη έχει μόνο τις δηλώσεις (`PropertyUpkeepSection`).
- `PUT /api/document-registry/issuance-assignments` = `withAuth` + `ctx.companyId` + `properties:properties:update`.
- Η ανάθεση είναι δεμένη σε εταιρεία: `IssuanceRequester.companyId`, `readDocumentRegistry(companyId)`,
  id `hash(companyId:property:kind)`, επαφές από βιβλίο εταιρείας, γέφυρα χώρου μέσω `loadConveyanceSubject`
  (μόνο `properties`) ⇒ `no-project`. Το ADR-942 §7.2 το λέει ήδη: «ξεκλειδώθηκε, δεν υλοποιήθηκε».

## 2. Τι κάνουν οι μεγάλοι (έρευνα 2026-11-18)

| Μοτίβο | Ποιος | Απόφαση για εμάς |
|---|---|---|
| Ο πελάτης ξεκινά από **το δικό του αίτημα**, όχι από βιβλίο επαφών | Thumbtack · Angi · Checkatrade · Airtasker | ✅ Ο ιδιώτης διαλέγει από τον κατάλογο `/pro`, όχι από επαφές |
| Αίτημα σε **λίγους** (2–3), όχι broadcast | Thumbtack · MyBuilder (Bark = αρνητικό παράδειγμα) | ✅ Φ5 (πυρήνας): έως 3 προσφορές, σύγκριση δίπλα-δίπλα |
| Άμεση ανάθεση σε έναν | TaskRabbit | ✅ Φ1: η πρώτη διαδρομή (υπάρχουσα μηχανή σταδίων) |
| Escrow + «αίτημα αποδέσμευσης» + 48ω | Airtasker Pay [επαληθευμένο] | ✅ ήδη ADR-943 |
| Διαφορά τη λύνει **η πλατφόρμα** | Airtasker · Upwork | ✅ απόφαση 1 — στον ιδιώτη δεν υπάρχει γραφείο να κρίνει |
| Επικοινωνία κρυφή ως την ανάθεση | Bark · Thumbtack | ✅ ήδη Ε-9′ |
| Κριτικές μόνο από ολοκληρωμένες δουλειές | Checkatrade · MyBuilder | ⏭️ εκτός (χωριστό ADR) |
| Πύλες ακινήτων (Rightmove · Spitogatos) **δεν** παραγγέλνουν ΠΕΑ | — | 🟢 κενό αγοράς: εδώ τους ξεπερνάμε |

Ελλάδα: μητρώο επιθεωρητών ΥΠΕΝ (buildingcert.gr, TaxisNet) — **δεν βρέθηκε δημόσιο API** ⇒ ο αριθμός μητρώου μένει
«δηλωμένος» (όπως §39.7). Ενδεικτικά: διαμέρισμα ~2 €/τ.μ., ελάχιστο 150 € · παράδοση 1–2 εργάσιμες μετά την
αυτοψία (πηγές χωρίς ημερομηνία — προς επιβεβαίωση).

## 3. Αποφάσεις (προτεινόμενες)

**Δ1 — Μία ανάθεση, δύο βιβλία (όχι νέα συλλογή).** Ίδια `document_issuance_assignments`, ίδια μηχανή σταδίων
(`issuanceStageOf` · `reduceIssuance` · `ballInCourtOf`), ίδιος γραφέας. Το έγγραφο αποκτά `owner: CustodyScope`
(`{companyId} | {userId}`)· id seed γραφείου **αμετάβλητο**, ιδιώτη `user:<uid>:<property>:<kind>` — ακριβώς το
πρότυπο ADR-915 §37 Δ3/Δ4 ⇒ **καμία μετανάστευση**. Ο κριτής υποκειμένου = γενίκευση του `readUpkeepSubject`
(`custodyOf` → `mayAdminister` → βιβλίο από τον κριτή, ποτέ από τον καλούντα). Ξένο ακίνητο ≡ 404.

**Δ2 — Πύλη.** `withPersonalOrOrgAuth` + `mayDecide` (πρότυπο `upkeep-declarations/route.ts`): οργανισμός ⇒
`checkPermission` όπως σήμερα· ιδιώτης ⇒ μόνο για ακίνητο που διαχειρίζεται. Δήλωση με λόγο στο
`personal-scope-consumers.test.ts`.

**Δ3 — Ο ιδιώτης είναι ταυτόχρονα «γραφείο» και «ιδιοκτήτης».** Η πρόταση του ιδιώτη **είναι** η έγκριση του ιδιοκτήτη:
γεγονός `self-approved` στην ίδια πράξη ⇒ `proposed → sent` χωρίς βήμα έγκρισης· κανένας «υπεύθυνος»
(`obligorLead`) — ο υπεύθυνος είναι ο ίδιος. Η «μπάλα» του ιδιώτη είναι **δικός της** ολικός πίνακας (`OWNER_BALL`, §7.6 (β)): «Σειρά σου» μόνο
όπου υπάρχει πράξη — το `proposed` είναι της πλατφόρμας, όχι του ιδιώτη.

**Δ4 — Επαγγελματίας χωρίς βιβλίο επαφών.** `professional: {kind:'contact', contactId} | {kind:'account', uid}`
(διακριτή ένωση). Ο ιδιώτης διαλέγει από το `/pro` (λογαριασμός επαγγελματία, ADR-915 §40)· κάρτα επαγγελματία
⇒ «Ζήτησε προσφορά για: {ακίνητο} · {έγγραφο}» όταν ο κατάλογος ανοίχτηκε από το ακίνητο (`documentIssuerSearchHref`
+ πλαίσιο επιστροφής). Ο ιδιοκτήτης στον φάκελο της ανάθεσης = ο χρήστης (`resolveUserDisplayName`), όχι επαφή.

**Δ5 — Χώρος συνεργασίας χωρίς έργο.** Ο οικοδεσπότης `document_issuance` γίνεται custody-aware (`host: WorkspaceRef`,
`actingFor` ADR-862), με πρότυπο τον `DOSSIER_ENGAGEMENT_HOST` (ιδιώτης οικοδεσπότης, ήδη ζωντανός). Ο ιδιώτης δεν
χρειάζεται έργο ⇒ το `no-project` μένει **μόνο** για ακίνητο γραφείου εκτός έργου (απόφαση 13/11 αμετάβλητη).
⚠️ Η θέση αποθήκευσης των engagements για ιδιώτη θέλει ανάγνωση του `engagement-hosts.ts` στη Φ3 — ανοιχτό.

**Δ6 — Κείμενα.** Όπου σήμερα «το γραφείο {office}» (emails `issuance-invitation-email.ts`, `document-request.json`
~20 σημεία) ⇒ ICU `select` πάνω σε `hostKind` (`office` · `owner`) — ένα κλειδί, δύο μορφές, el+en.

**Δ7 — Πληρωμή.** Πληρωτής = ο ίδιος ο ιδιώτης (email λογαριασμού ⇒ Google Pay χωρίς ερώτηση, ADR-ACC-030 §5.11).
Δικαιούχος ανά μηχανικό (ADR-943 §4 #13) — δουλεύει ήδη. Η διαφορά ιδιώτη ⇒ η πλατφόρμα (§6.1).

## 4. Πέρα από τους μεγάλους (Nestor)

1. **Αίτημα που γράφεται μόνο του** — τ.μ., όροφος, έτος, διεύθυνση από το `OwnerProperty`· ενδεικτικό εύρος τιμής
   (Φ5, μόνο όταν υπάρχουν πραγματικές προσφορές της πλατφόρμας — ποτέ επινοημένος πίνακας).
2. **Έλεγχος πληρότητας πριν από την αυτοψία** — κάτοψη · άδεια · λογαριασμός ρεύματος από τα `files_personal` του
   ακινήτου, δοσμένα στον επιθεωρητή με τον υπάρχοντα διαμοιρασμό φακέλου (ADR-942).
3. **Το παραδομένο ΠΕΑ δουλεύει μόνο του** — γεγονότα εγγράφου ⇒ `energy` του ακινήτου (`resolvedDocumentExpiry`,
   ADR-915 Φ3β-2, υπάρχει) ⇒ ενεργειακή κλάση στην αγγελία ⇒ υπενθύμιση λήξης από το μητρώο (υπάρχει).
4. **Προτάσεις βελτίωσης ΠΕΑ ⇒ αίτημα προσφοράς ανακαίνισης** — ⏭️ μελλοντικό, μόνο ως ιδέα.

## 5. Φάσεις

| Φάση | Περιεχόμενο | Τομείς |
|---|---|---|
| Φ1 | Δ1 + Δ2 + Δ3 + Δ4 (διακομιστής): βιβλίο, id, κριτής, πύλη, `self-approved`, επαγγελματίας-λογαριασμός | document-registry · auth |
| Φ2 | UI `/me`: «Βρες επιθεωρητή» στη σελίδα ακινήτου → `/pro` με πλαίσιο → «Ζήτησε προσφορά» · χρονολόγιο σταδίων (επαναχρήση **ετικετών** και `quoteLines` — όχι των όψεων `EngagedIssuance*`, βλ. §7.6) | owner-property · pro directory |
| Φ3 | Δ5 + Δ6: χώρος συνεργασίας, πρόσκληση, όνομα οικοδεσπότη, emails/i18n | engagements · email |
| Φ4 | Δ7: προκαταβολή/escrow για ιδιώτη + ουρά διαφορών πλατφόρμας (§6.1) | payments (ADR-943) |
| Φ5 | Έως 3 προσφορές + σύγκριση (απόφαση 2 — πριν από την E2E) | document-registry · UI |
| E2E | «ιδιώτης `/me` → `+arch1`» μετά τη Φ5 (σενάριο 3 Google Pay ADR-ACC-030 §5.11) | — |

Εκτίμηση: ~30–45 αρχεία σε 5–6 τομείς ⇒ κατά N.8 απόφαση Giorgio για orchestrator ή Plan Mode ανά φάση.

## 6. Αποφάσεις Giorgio (2026-11-18) — «ό,τι κάνουν οι μεγάλοι, χωρίς εκπτώσεις»

1. **Τη διαφορά την κρίνει η πλατφόρμα** όταν ο ιδιοκτήτης είναι ιδιώτης (Airtasker · Upwork): ουρά διαφορών Nestor (super_admin) με τα ίδια τεκμήρια (χρονολόγιο, μηνύματα, αρχεία), ίδιο κράτημα χρημάτων, ίδια απόφαση «αποδέσμευση / επιστροφή / μερική». Στο γραφείο η διαφορά μένει όπως σήμερα (ADR-943).
2. **Οι πολλαπλές προσφορές (έως 3) είναι μέρος του πυρήνα**, όχι παρακολούθημα: στο Thumbtack και στο Airtasker το αίτημα σε λίγους **είναι** το προϊόν. Η Φ5 μπαίνει **πριν** από την E2E· η απευθείας ανάθεση σε έναν μένει ως δεύτερη διαδρομή (TaskRabbit). Το id της ανάθεσης δεν μπορεί πλέον να είναι ένα ανά (κάτοχος, ακίνητο, έγγραφο) ⇒ μοντέλο **αίτημα → έως 3 προσφορές → μία νικήτρια**, οι άλλες κλείνουν αυτόματα με ειδοποίηση (σχεδιασμός στη Φ1, ώστε η Φ5 να μη ξαναγράψει το σχήμα).
3. **Πρόσκληση επαγγελματία εκτός Nestor με email: ναι**, κάτω από τον κατάλογο. Οι αγορές leads (Thumbtack · Angi) δεν το δείχνουν δημόσια — η αναζήτηση 2026-11-18 δεν βρήκε πολιτική· το πρότυπο είναι το **Upwork Direct Contracts** (φέρνεις τον δικό σου συνεργάτη και παίρνεις την προστασία πληρωμής της πλατφόρμας — από γνώση, όχι επαληθευμένο στο web). Η αξία του Nestor είναι η ροή (στάδια, escrow, παράδοση), όχι το lead.

Επόμενο βήμα: απόφαση N.8 (orchestrator ή Plan Mode ανά φάση) και Φ1 σε νέα συνεδρία.

## 7. Φ1 — σχέδιο (εγκρίθηκε 2026-11-18) και διορθώσεις του §3 από τον κώδικα

### 7.1 Διορθώσεις (ο κώδικας κερδίζει, N.0.1)

- **Δ4 — ο επαγγελματίας του `/pro` ΔΕΝ είναι λογαριασμός (uid).** Ο κατάλογος δείχνει **βιτρίνες χώρων εταιρείας**
  (`agency_profiles/{companyId}`, `agency-profile.service.ts`), μαζί με τις άδειες που δήλωσε ο ίδιος (`ShowcaseLicence`).
  Πρότυπο **Upwork Agency Contracts** (επαληθευμένο 2026-11-18): το συμβόλαιο γίνεται με τον **οργανισμό**, και το **μέλος**
  που δουλεύει ορίζεται μετά. ⇒ `professional: {kind:'contact', contactId} | {kind:'workspace', companyId}`
  (`lib/document-validity/issuance-professional.ts`). Το μέλος που υπογράφει δένεται στη Φ3, ως προσθήκη `.default(null)`.
  **Πέρα από το Upwork**: το ΠΕΑ το υπογράφει **πρόσωπο με άδεια**, άρα το προσόν της προσφοράς βγαίνει από τη **δηλωμένη
  άδεια της βιτρίνας**, στον διακομιστή.
- **Δ3 — δεν υπάρχει έγκριση πριν από το `sent`** στη ροή §42. Ο ιδιοκτήτης εγκρίνει την **προσφορά** (`decide` στο `quoted`).
  Το «self-approved» = βάση απόφασης **`owner-self {uid}`** (Φ1β), χωρίς `ownerContactId` και χωρίς υπεύθυνο.

### 7.2 Μοντέλο «αίτημα → έως 3 προσφορές → μία νικήτρια» (RFQ → bids → award)

Πρότυπα: Fairmarkit · Oracle PeopleSoft Sourcing · Coupa (κατάσταση ανάθεσης σε **δύο επίπεδα**, γεγονός και προσφορά·
«Lost» ≠ «Declined»), Thumbtack (αίτημα σε λίγους).

- **Αίτημα**: νέα συλλογή `document_issuance_requests` (deny-all), ένα ανά (κάτοχος, ακίνητο, είδος), id με seed κατόχου
  (`<companyId>:…` / `user:<uid>:…`), `cycle`, `bids` ≤ 3, `award`, `closure`.
- **Προσφορά = ένα κανονικό `document_issuance_assignments`**, με την ίδια μηχανή σταδίων, τους ίδιους συνδέσμους και τα ίδια
  χρήματα ανά επαγγελματία. Id `hash(<requestId>:<cycle>:<professionalKey>)`. Η απευθείας ανάθεση γραφείου κρατά το
  **αμετάβλητο** id `hash(companyId:property:kind)`.
- **Ατομική ανάθεση**: `decide approved` στη νικήτρια + `award` + κλείσιμο των άλλων με λόγο «δεν επιλέχθηκε», σε **μία**
  συναλλαγή. Δεν υπάρχει ποτέ στιγμή με δύο «ανατέθηκε».

### 7.3 Φ1α — βιβλίο κατόχου + ένωση επαγγελματία (καμία αλλαγή συμπεριφοράς)

- `issuance-professional.ts` (νέο, leaf): `IssuanceProfessional`, `professionalContactIdOf`, `professionalKeyOf`,
  `professionalReferenceOf` (το σκέτο `contactId` για επαφή, αμετάβλητο από το §27, ώστε το γραμμένο ιστορικό και οι πίνακες
  ονομάτων να διαβάζονται ίδια) και `sameProfessional`.
- `IssuanceAssignmentRecord.professionalContactId` ⇒ **`professional`** (μία πηγή, ποτέ δύο πεδία). Το σύνορο του δίσκου
  διαβάζει το παλιό `professionalContactId` ως `{kind:'contact'}`. Αν υπάρχουν και τα δύο και διαφωνούν ⇒ `null` (fail-closed).
  Τα νέα έγγραφα γράφουν μόνο `professional`. Το σώμα του `propose` του γραφείου στο σύρμα **μένει** `professionalContactId`
  (`issuanceActionOf` ⇒ ένωση).
- Κάτοχος: `companyId` | `userId` στον δίσκο (`custodyOnly`). Δύο όψεις πάνω στο **ίδιο** σχήμα:
  `parseOwnedIssuanceAssignment` (`owner: CustodyScope`) και `parseIssuanceAssignment` (όψη γραφείου: ανάθεση ιδιώτη ⇒
  `null`, άρα οι ~59 αναγνώστες `assignment.companyId` μένουν δομικά τυφλοί στο προσωπικό βιβλίο, ADR-787 Ε-3 §3).
- Γραφέας: `IssuanceWrite.companyId` ⇒ **`ledger: IssuanceLedger`** (`issuance-ledger.ts`: `office` = seed §27 · `owned` = id
  ρητά από τον καλούντα). Η ανάγνωση στη συναλλαγή γίνεται με `isOwnedByCustody`. Το ιστορικό γράφεται στο ίδιο βιβλίο
  (`custodyOnly`, όπως οι δηλώσεις §37).
- Καλούντες: 6 γραφές με `officeLedger(companyId)`· 7 αναζητήσεις ονόματος με `professionalReferenceOf`· πρόχειρο μηνύματος
  και πρόσκληση χώρου: βιτρίνα ⇒ `no-email` (η πρόσκλησή της έρχεται στη Φ3)· υποψήφιοι / καταλληλότητα μόνο για επαφές.
- ⚠️ Οι στόχοι τηλεμετρίας μηνυμάτων (`IssuanceAssignmentTarget`) **μένουν** εταιρικοί: τους γενικεύει η Φ3, μαζί με τις
  προσκλήσεις. Αυτό είναι απόκλιση από το σχέδιο, δηλωμένη εδώ.
- Άγκυρα: `__tests__/issuance-assignment-schema.test.ts` (Σ1–Σ4 επαγγελματίας · Κ1–Κ3 κάτοχος · Τ1 id γραφείου byte προς
  byte). Fixtures 20 αρχείων tests στην ένωση· τα σπαρμένα παλιά έγγραφα μένουν όπως είναι, ως κάλυψη της ανάγνωσης παλιών.

### 7.4 Φ1β (μέρος 1) — ταυτότητες · πεδία προσφοράς · πυρήνας αιτήματος · βάση `owner-self`

- **Ταυτότητες (N.6)**: `disr` = αίτημα (`generateDeterministicDocumentIssuanceRequestId`, seed `<companyId>:…` / `user:<uid>:…`)·
  `dibd` = προσφορά (`generateDeterministicDocumentIssuanceBidId`, seed `<requestId>:<cycle>:<professionalKey>`). Η προσφορά
  ζει στο `document_issuance_assignments`, αλλά με **δικό της πρόθεμα** ⇒ δεν συμπίπτει ποτέ με το id απευθείας ανάθεσης
  (`dias`, αμετάβλητο). Συναρτήσεις: `issuanceRequestIdOf` · `bidIdOf` (`services/document-registry/issuance-request-schema.ts`).
- **Συλλογή** `COLLECTIONS.DOCUMENT_ISSUANCE_REQUESTS` (`document_issuance_requests`)· μπλοκ deny-all στο `firestore.rules`·
  γραμμή στο `coverage-manifest.ts`· σουίτα `document-issuance-requests.rules.test.ts` με σπαρμένο αίτημα **γραφείου και ιδιώτη**.
- **Διόρθωση του σχεδίου (ο κώδικας κερδίζει)**: το `tenant-config.ts` **δεν** παίρνει γραμμή. Περιγράφει τα ερωτήματα του
  πελάτη (`firestoreQueryService`)· οι deny-all συλλογές μόνο-διακομιστή (`property_upkeep_declarations` ·
  `document_issuance_assignments`) δεν είναι εκεί — το «πρότυπο `PROPERTY_UPKEEP_DECLARATIONS`» του σχεδίου δεν υπάρχει.
- **Πεδία προσφοράς** (όλα με προεπιλογή, καμία μετανάστευση): `requestId` · `cycle` στην ταυτότητα (και τα δύο ή κανένα —
  αλλιώς fail-closed)· `cancellation.reason: 'cancelled' | 'not-awarded'` (λεξιλόγιο `ISSUANCE_CANCELLATION_REASONS` στο
  `issuance-stage.ts`). Η πράξη `cancel` φέρει πλέον `reason`. Το βιβλίο `owned` φέρει `requestId` + `cycle`
  (`ledgerRequestOf`), και ο γραφέας τα αποθηκεύει.
- **Καθαρός πυρήνας** `lib/document-validity/issuance-bidding.ts`: `reduceIssuanceRequest` (invite · award · cancel) +
  `inviteCycleOf`. Όριο 3 · ίδιος επαγγελματίας ⇒ ιδεμποτές · η ανάθεση επιστρέφει **ποιες** προσφορές κλείνουν με
  «δεν επιλέχθηκε» (ο διακομιστής τις κλείνει στην ίδια συναλλαγή) · με ανοιχτή νικήτρια καμία νέα πρόσκληση και καμία ακύρωση
  αιτήματος (ακυρώνεται η ίδια η ανάθεση) · νέος κύκλος μόνο όταν ο προηγούμενος τελείωσε. Η ολοκλήρωση **δεν** γράφεται στο
  αίτημα: παράγεται από το μητρώο (`awardedBidOpen` από τον διακομιστή).
- **Βάση `owner-self` (Δ3)**: νέος actor `owner` (ο ιδιώτης στο δικό του βιβλίο) — μόνο πρόταση, απόφαση, ακύρωση. Το
  `ownerContactId` μετακόμισε **μέσα** στις δύο βάσεις γραφείου (ίδιο σχήμα δίσκου)· ρωτιέται με `decisionOwnerContactIdOf`.
  Οι 5 αναγνώστες στενεύτηκαν (`RegistryIssuanceStep.tsx` · `issuance-advance-link.ts` · `issuance-advance-payer.ts` ·
  `issuance-agreement-parties.server.ts` · `issuance-engagement-host-adapter.ts`)· σε διαδρομή γραφείου η απόφαση ιδιώτη δεν
  φτάνει ποτέ (`parseIssuanceAssignment` ⇒ `null`). Η πολιτική «ποιος κάνει ποια πράξη» (`actorMayAct`) μετακόμισε στο
  `issuance-actor.ts` (N.7.1: ο μειωτής 504 ⇒ 486 γραμμές).
- **Μένουν για τη Φ1β (μέρος 2)**: writer/actor `owner` στον γραφέα · κοινός κριτής υποκειμένου (γενίκευση `readUpkeepSubject`,
  `latestIssuedOn` ιδιώτη) · βιτρίνα επαγγελματία (`agency_profiles` + `qualifiesFor`) · `issuance-request.service.ts` + route +
  `personal-scope-consumers` + πύλες 3.78/3.92. ⚠️ Η άγκυρα πλήθους `allow` του `rules-liveness-gate.test.js` (+2 από το νέο
  μπλοκ) **δεν** ενημερώθηκε: θέλει μέτρηση με την πύλη (ήδη αποκλίνουσα, βλ. σχόλιο της άγκυρας).

### 7.5 Φ1β (μέρος 2) — διακομιστής του αιτήματος προσφορών

- **Writer `owner`** στον ΕΝΑ γραφέα (`IssuanceWriter` · `actorOf` · CAS με `expectedStage` όπως το γραφείο) · `performerOf` ⇒ `uid`.
- **Κριτής υποκειμένου**: το `readUpkeepSubject` (§36/§37) χρησιμοποιείται **όπως είναι**: δίνει ήδη ακίνητο + βιβλίο από
  `mayAdminister(custodyOf(…))` (ξένο ⇒ `absent`/404 · αποσυρμένο ⇒ `retired`/409). Η «γενίκευση» του σχεδίου δεν χρειάστηκε
  δεύτερη συνάρτηση (ο κώδικας κερδίζει). **Φ1: μόνο βιβλίο ιδιώτη** — θεματοφυλακή γραφείου ⇒ `office-ledger` (το γραφείο έχει
  την απευθείας ανάθεση §27· αίτημα γραφείου θέλει κριτή υπευθύνου §26, εκτός Φ1).
- **`latestIssuedOn` ιδιώτη — ΕΝΑΣ κανόνας, καμία δεύτερη μετάφραση.** Αναγνώστης `files_personal` ανά ακίνητο **δεν υπήρχε**.
  Επαληθεύτηκε ότι ο ΕΝΑΣ γραφέας γράφει `documentFacts` και σε `files_personal` (εισαγωγή ΠΕΑ ιδιώτη · μεταβίβαση), άρα ο
  φάκελος είναι πραγματική πηγή. Χτίστηκε από υπάρχοντα κομμάτια:
  - `readDossierReadyFileDocs` — το **ΕΝΑ** ερώτημα του φακέλου (ίδιος δείκτης)· το `readDossierReadyFiles` γίνεται προβολή του.
  - `dossierRegistryFileOf` — οι **ΙΔΙΟΙ** κριτές (α)/(γ) του μητρώου, με ρητή απόδοση στο ακίνητο του φακέλου.
  - `owner-property-documents.server.ts` — δήλωση `energy` + αρχεία φακέλου μέσω του **ίδιου** `registryDocumentsOf`· ο κάτοχος
    ρωτιέται δύο φορές (φάκελος του ιδιώτη **και** αρχεία του κατόχου του)· θεματοφυλακή γραφείου ⇒ κανένα `files_personal`
    (ίδιος κανόνας με το `ownerPeaFileScope`). Πετά σε βλάβη: «κανένα έγγραφο» από άγνοια θα άνοιγε ολοκληρωμένη ανάθεση.
  - `latestIssuedOnOfDocuments` — ο κανόνας «νεότερο `issuedOn`» πάνω σε **έγγραφα**· το `latestIssuedOnByKey` τον καλεί.
  - `subjectLatestIssuedOn` (`issuance-latest-issued.server.ts`) — ανά βιβλίο: γραφείο ⇒ το μητρώο του, ιδιώτης ⇒ τα παραπάνω.
- **Βιτρίνα ⇒ προσόν**: `lookupAgencyProfile` (μη δημόσια ⇒ `professional-unavailable` · βλάβη ⇒ `unavailable`, ποτέ ισοπέδωση) +
  `showcaseIssuanceCredential` (`lib/document-validity/issuance-showcase-credential.ts`) πάνω στον **ΙΔΙΟ** κριτή με το φίλτρο
  `document:<είδος>` του `/pro` (`showcaseHasQualification`): ό,τι ο κατάλογος δείχνει «μπορεί να εκδώσει» είναι ακριβώς ό,τι
  δέχεται η πρόσκληση. Αριθμός μητρώου = της απόδειξης που κάλυψε το προσόν· χωρίς άδεια ⇒ `unqualified`.
- **Service** `issuance-request.service.ts` + I/O `issuance-requests.server.ts`, **μία συναλλαγή ανά πράξη**:
  - `invite` — αίτημα + `propose` στην προσφορά (`owned` ledger, `bidIdOf` στον κύκλο του `inviteCycleOf`).
  - `award` — `decide approved` (`owner-self`, χωρίς κανάλι/επαφή) στη νικήτρια + `cancel{not-awarded}` στις `closing.bidIds` +
    αίτημα. Προσφορά που ο άνθρωπος είδε ήδη κλειστή (`null`) και είναι κλειστή παραλείπεται· κάθε άλλη άρνηση ακυρώνει **όλη**
    την πράξη (all-or-nothing).
  - `cancel` — αίτημα + `cancel{cancelled}` σε όλες τις προσφορές του κύκλου.
  - CAS σε δύο επίπεδα: `expectedCycle` **και** `expectedStages` για **κάθε** προσφορά του κύκλου (προσφορά που δεν είδε ⇒ `stale`).
  - `awardedBidOpen` διαβάζεται μέσα στη συναλλαγή (`readLedgerIssuanceInTx`). Ιστορικό ADR-195 **μετά** την επιτυχία.
  - Για την ανάγνωση εξάγεται ο ΕΝΑΣ κανόνας «ανάθεση αυτού του βιβλίου» (`ownedIssuanceRecordOf`), μέσα και έξω από συναλλαγή.
- **Σύρμα** `lib/document-validity/issuance-bidding-request.ts`: σώμα (`invite` · `award` · `cancel`) · ερώτημα · ο ΕΝΑΣ πίνακας
  αρνήσεων `ISSUANCE_REQUEST_ERROR_CODES` (HTTP + κωδικός, κανένα `default`).
- **Route** `app/api/document-registry/issuance-requests/route.ts`: `withPersonalOrOrgAuth` (ιδεμποτία ADR-872 μέσα στο σύνορο,
  CHECK 3.92) + `mayDecide` (πρότυπο `upkeep-declarations`) · GET `{request, bids, canAct}` · PUT · `withStandardRateLimit`
  (κανένα πρόθεμα του πίνακα δεν καλύπτει το `/api/document-registry` ⇒ `declared-over-default`, CHECK 3.78) · δήλωση με λόγο
  στο `personal-scope-consumers.test.ts`.
- **Tests** `services/document-registry/__tests__/issuance-request.service.test.ts`: ξένο / υπό γραφείο / ανύπαρκτο ⇒ `absent`
  χωρίς εγγραφή · `retired` · `office-ledger` · πρόσκληση σε προσωπικό βιβλίο με προσόν από τη βιτρίνα · ιδεμποτία · `stale` ·
  `bid-limit` · αρνήσεις βιτρίνας · **ατομική ανάθεση** (και all-or-nothing σε `stale`) · ακύρωση · GET. **Δεν έτρεξαν** (εντολή Giorgio).
- ⏭️ Μένουν: ειδοποίηση επαγγελματία και χώρος συνεργασίας για προσφορά βιτρίνας (Φ3 · Δ5/Δ6) · UI `/me` (Φ2) · άγκυρα
  πλήθους `allow` του `rules-liveness-gate.test.js` (από το μέρος 1).

### 7.6 Φ2 — σχέδιο (εγκρίθηκε 2026-11-18, Plan Mode)

- **Διόρθωση του §5 (ο κώδικας κερδίζει)**: οι όψεις `EngagedIssuance*` (`components/conveyance/my-cases/`) είναι
  δεμένες στην πλευρά του **επαγγελματία** (δεύτερο πρόσωπο, `hostCompanyId`, δεδομένα από `/api/engagements/…/case`)
  και δείχνουν μόνο το **τρέχον** στάδιο — όχι χρονολόγιο. Επαναχρησιμοποιούνται οι πίνακες ετικετών
  (`issuance-labels.ts`) και το `quoteLines(t, record)` (`registry-issuance-quote-lines.tsx`)· το χρονολόγιο ακολουθεί το
  `IssuanceAdvanceTimelineList.tsx`.
- **Κλειστό μέχρι τη Φ3** (απόφαση Giorgio): διακόπτης `OWNER_ISSUANCE_REQUESTS: false` στο `config/feature-flags.ts`.
  Χωρίς ειδοποίηση επαγγελματία (Φ3) ένα αίτημα δεν το βλέπει κανείς ⇒ καμία ενότητα στο `/me`, κανένα κουμπί στο `/pro`.
- **Δομή**: client (`document-registry.client.ts`) · καθαρό μοντέλο όψης (`issuance-request-view-model.ts`: CAS εισόδων,
  μπάλα ιδιώτη, όριο από τον **ίδιο** πυρήνα) · hooks **όχι αισιόδοξα** (CAS, ο server αποφασίζει — όπως το
  `useUpkeepDeclaration`) · ενότητα κάτω από το `PropertyUpkeepSection` · πλαίσιο `/pro` ως **υπόδειξη** (ο server
  ξανακρίνει κατοχή) με επέκταση του `documentIssuerSearchHref`, όχι δεύτερο δημιουργό URL.
- **Υλοποίηση Βημάτων 2–7 (2026-11-19, διακόπτης ΚΛΕΙΣΤΟΣ)**:
  - **Σύρμα**: οι τύποι όψης μετακόμισαν από το `issuance-requests.server.ts` στο `issuance-bidding-request.ts`
    (`IssuanceBidView` · `IssuanceBiddingView` · `IssuanceBiddingResponse` = όψη + `canAct`): ένας ορισμός για τον διακομιστή
    που γράφει και την οθόνη που διαβάζει. Μετονομασία `IssuanceRequestView` ⇒ `IssuanceBiddingView`, γιατί το όνομα το είχε
    ήδη άλλος τύπος (`types/issuance-document-request.ts`, αιτήματα εγγράφων ADR-942). `issuanceRequestRefusalOfCode` = ιδίωμα upkeep.
  - **Client**: `ISSUANCE_REQUESTS_URL` · `fetchIssuanceRequest` (`ready | unavailable | failed`) · `saveIssuanceRequestAction`
    μέσω του `putRegistryAction` (`Idempotency-Key` από το `apiClient.put`, CHECK 3.92).
  - **Μοντέλο όψης** `lib/document-validity/issuance-request-view-model.ts`: `requestPhaseOf` · `expectedCycleOf` ·
    `expectedStagesOf` · `ownerBallOf` · `canAwardBid` · `canCancelRequest` · `inviteVerdictOf` / `canInviteMore` (ρωτούν τον
    **ίδιο** `reduceIssuanceRequest`, κανένα δεύτερο όριο) · `bidTimelineOf` (χρονολόγιο από τα γεγονότα, «δεν επιλέχθηκε» ≠
    «ακυρώθηκε») · `ISSUANCE_REQUEST_KINDS` (**παράγεται** από τον κατάλογο: ό,τι εκδίδει επαγγελματίας).
  - **Hooks**: `useIssuanceRequest` (πρότυπο `usePropertyUpkeep`) · `useIssuanceRequestAction` (όχι αισιόδοξα, πρότυπο
    `useUpkeepDeclaration`· άρνηση με κωδικό ⇒ ξαναδιάβασμα, ώστε ο άνθρωπος να ξανακρίνει τον νέο κόσμο).
  - **`/me`** `OwnerIssuanceRequestSection` + `OwnerIssuanceBidList` + `owner-issuance-labels.ts`: **ένας** πίνακας για όλα τα
    είδη (Thumbtack «Projects» · Block: ένα σημείο για όλα τα αιτήματα), μία γραμμή ανά είδος. Επιβεβαίωση (`ConfirmDialog`)
    πριν από «Επιλογή» και «Ακύρωση αιτήματος», γιατί κλείνουν άλλες προσφορές. Η επωνυμία βγαίνει από το `usePublicAgency`
    (ένα έγγραφο κατά ταυτότητα). Το `IssuanceAdvanceTimelineList` έγινε **γενικό** (`{kind, at}`): το ίδιο συστατικό και για τα
    στάδια. Mount με `dynamic()` μετά το `PropertyUpkeepSection`, φραγμένο με `isAppFeatureEnabled('OWNER_ISSUANCE_REQUESTS')`.
  - **`/pro`**: `lib/agency/issuance-context-query.ts` (`forProperty` · `forDocument`, υπόδειξη, και τα δύο ή κανένα)·
    `documentIssuerSearchHref(kind, adminId, forProperty)` και `agencyProfileRoute(segment, issuance)` **επεκτάθηκαν**, δεν
    γράφτηκε δεύτερος δημιουργός· το `apply` του καταλόγου κρατά το πλαίσιο σε κάθε αλλαγή φίλτρου. Ο πάροχος
    `AgencyIssuanceQuoteProvider` (στο `pro/page.tsx` και στο `AgencyProfileQuoteSlot`) κάνει **μία** ανάγνωση για όλες τις
    κάρτες· κλειστός διακόπτης ή χωρίς πλαίσιο ⇒ σκέτα παιδιά, καμία κλήση. `AgencyRequestQuoteButton` (`dynamic`): εμφανίζεται
    μόνο αν το `showcaseIssuanceCredential` (ο **ίδιος** κριτής με την πρόσκληση) βρίσκει προσόν· λέει «Ζητήθηκε» / «έφτασες
    τις 3» **πριν** το πάτημα· ανώνυμος ⇒ `loginHrefForCurrentLocation`· επιτυχία ⇒ πίσω στο ακίνητο. Λωρίδα
    `AgencyIssuanceContextBar` («Ζητάς προσφορά για: …» + πόσες έχεις + επιστροφή).
  - **i18n**: `document-registry:ownerIssuance.*` · `property-market:mandate.directory.issuanceQuote.*` (el + en, ICU πληθυντικός
    στο `bidsCount`).
  - ✅ **Αποφάσεις (2026-11-19, πρακτική Thumbtack · Angi · Procore — ο Giorgio ανέθεσε την επιλογή)**:
    (α) **Φωνή ιδιώτη**: `OWNER_STAGE_KEYS` (`document-registry:ownerIssuance.stage.*`), ολικός χάρτης πάνω στο
    `IssuanceStage` — ίδια μηχανή καταστάσεων, άλλος ομιλητής (Procore: η ίδια κατάσταση γράφεται ανά ρόλο). Οι λέξεις του
    γραφείου έλεγαν στον ίδιο τον ιδιοκτήτη «αναμένει έγκριση του ιδιοκτήτη».
    (β) **Μπάλα ιδιώτη = δικός της ολικός πίνακας** (`OWNER_BALL`), όχι `office ⇒ owner`: «Σειρά σου» **μόνο** όπου υπάρχει
    πράξη (`quoted` ⇒ «Επιλογή» · `declined` ⇒ «ζήτησε από άλλον»). Το `proposed` (και το παλιό `ownerApproved`) ⇒
    `professional`: στον ιδιώτη η πρόταση **είναι** η έγκριση (Δ3) και την ειδοποίηση τη στέλνει η πλατφόρμα (Φ3) — κάλεσμα
    χωρίς κουμπί θα ήταν αδιέξοδο. **Διορθώνει** τη φράση του Δ3 «η μπάλα `office` λύνεται σε `owner`».
    (γ) **Περιοχή από το ακίνητο, στο `/pro`**: όταν ο κατάλογος ανοίγει «για» ακίνητο, το `MyPropertyFilter` προεπιλέγει
    **μία φορά** την περιοχή του με τον **ίδιο** κριτή (`ownerPropertyWhere`) και τον ίδιο δρόμο (`onPick`) — ρητή περιοχή
    στη διεύθυνση νικά, η αφαίρεση δεν ξαναγυρίζει, ακίνητο χωρίς αποδείξιμη περιοχή ⇒ χωρίς περιοχή. Καμία αλλαγή server,
    η θέση δεν μπαίνει στη διεύθυνση, η καρτέλα ακινήτου δεν κατεβάζει ευρετήριο ορίων.
    (δ) Ο πάροχος εισάγεται στατικά στο `/pro` ⇒ αναπαραγωγή route slices `pro` / `pro__alias` και `src/types/i18n.ts`
    (CHECK 3.33 / 3.34).
  - ✅ **Επιφάνειες αντί για τοπικό `next/dynamic` (2026-11-19, CHECK 3.34 · ADR-744 §27)**: ο γεννήτορας αρνήθηκε το αρχικό
    σχέδιο (χρέος εισδοχής 330 → 359: καρέ με ωμά κλειδιά). Τώρα: **μία** επιφάνεια `AgencyIssuanceQuote`
    (`mandate/issuance-quote-surfaces.tsx` → `AgencyIssuanceQuoteSurface`, `slot` = `context-bar` | `request-button`) και
    **μία** `OwnerIssuanceRequestSection` (`owner-property/owner-issuance-surfaces.tsx`), δηλωμένες στο `lazyRouteRegistries`.
    Ο πάροχος `AgencyIssuanceQuoteProvider` έγινε **χωρίς κανένα namespace** (εκθέτει `revalidate`· η πράξη
    `useIssuanceRequestAction` ζει στο κουμπί — ο διακομιστής κρίνει όριο/CAS, κανένα κοινό φρένο δεν χρειάζεται) και το hook
    πράξης ζητά μόνο `document-registry`. Το `AgencyProfileQuoteSlot` εισάγεται στατικά, με δικό του όριο `<Suspense>`
    (`useSearchParams`, CHECK 3.55). Κατάστιχο `lazyRouteMountNamespaces` +7, σφράγιση 110 → 117 με γραμμένο λόγο· χρέος
    εισδοχής 330 (αμετάβλητο).
  - Άγκυρες: `owner-issuance-request-section.test.tsx` (Ε1–Ε6: σύνδεσμος καταλόγου · μόνο ανάγνωση · επιβεβαίωση + CAS
    στην επιλογή/ακύρωση · `proposed` χωρίς «Σειρά σου» · άρνηση · βλάβη φόρτωσης) · `issuance-quote-directory.test.tsx`
    (Π1–Π3: διακόπτης κλειστός ⇒ καμία ανάγνωση · μισό πλαίσιο ⇒ τίποτα · Ζ1–Ζ3: προεπιλογή περιοχής μία φορά, η αφαίρεση δεν
    ξαναγυρίζει, ρητή περιοχή νικά). Μετάλλαξη 2/2 (μπάλα `proposed` · φρένο «μία φορά») ⇒ 4 κόκκινα.
  - Άγκυρες (**δεν έτρεξαν**, εντολή Giorgio): `issuance-request-view-model.test.ts` · `issuance-context-query.test.ts`.

### 7.7 Φ3 — σχέδιο (εγκρίθηκε 2026-11-19, Plan Mode) και Φ3α

**Πρακτική (επαληθευμένη 2026-11-19)**: Upwork Agency. Η πρόσκληση φτάνει στα **εισερχόμενα του γραφείου** με ειδοποίηση.
Οι υπεύθυνοι του γραφείου απαντούν για λογαριασμό του και ορίζουν **ποιο μέλος** κάνει τη δουλειά.
Στο Thumbtack η ταχύτητα απάντησης είναι ο ισχυρότερος παράγοντας ανάθεσης.
Η άδεια ζει **κάτω από τον πόρο** (Drive `files/{id}/permissions`), όπως ήδη ο φάκελος ιδιώτη (ADR-916 Φ-Ε1).

**Υποφάσεις**:
- Φ3α — actor μέλους γραφείου (αυτή η ενότητα).
- Φ3β — ειδοποίηση στους `activeWorkspaceAdministrators` + εισερχόμενα `(app)/o/[workspace]` + φάκελος προσφοράς με εμβέλεια
  προσφοράς + route.
- Φ3γ — engagement στο `document_issuance_assignments/{id}/engagements`: τρίτο σκέλος του `EngagementHome`, ολικοί
  διακόπτες, κανόνες.
- Φ3δ — κείμενα με `hostKind` (ICU `select` στα locale · διακριτή ένωση στα TS emails).

**Φ3α — υλοποίηση (καθαρός πυρήνας, καμία UI, διακόπτης κλειστός)**:
- **Η πρόσκληση του ιδιώτη ΕΙΝΑΙ η αποστολή** (Δ3, Thumbtack): η πρόταση του actor `owner` γράφει στην ίδια πράξη μήνυμα
  της πλατφόρμας. Το μήνυμα έχει `channel: PLATFORM_NOTICE_CHANNEL` (`nestor-inbox`), χωρίς σύνδεσμο και χωρίς κωδικό
  (`platformNoticeOf`, `issuance-actor.ts`) ⇒ στάδιο `sent`.
  - Η ίδια πρόσκληση ξανά είναι ιδεμποτής (`sameProposal`).
  - Ο ιδιώτης προσκαλεί **μόνο** βιτρίνα (επαφή ⇒ `actor-refused`).
  - Η πρόταση του γραφείου μένει `proposed`, χωρίς αλλαγή.
  - Το χρονολόγιο του ιδιώτη δείχνει **μία** γραμμή «ζητήθηκε», όχι δύο ταυτόχρονες.
- **Δύο σύνολα καναλιών**:
  - `NOTICE_CHANNELS` = ό,τι καταγράφει άνθρωπος (`RecordableNoticeChannel`, το μενού του γραφείου και το σύρμα).
  - `STORED_NOTICE_CHANNELS` = και το κανάλι της πλατφόρμας (δίσκος · `CHANNEL_KEYS` · `issuance.channel.nestor-inbox` el+en).
- **Actor `workspace-member {uid, companyId}`**: μόνο `respond` + `quote`.
  - Μόνο σε μήνυμα της πλατφόρμας **προς το δικό του** γραφείο (`isPlatformBidTo`).
  - Ξένο γραφείο · απευθείας ανάθεση γραφείου · σύνδεσμος σε αίτημα πλατφόρμας ⇒ `actor-refused`.
  - Βάσεις `{basis:'workspace-member'}` και `{by:'workspace-member', uid, companyId, signerUid}`. Το `responseBasisOf` /
    `quoteSubmissionOf` κρίνουν πλέον πάνω σε `{notice, professional}`.
  - Writer `workspace-member` με CAS · ίχνος = `uid`.
- **Διόρθωση του §7.1 (ο κώδικας κερδίζει)**: το μέλος που υπογράφει **δεν** μπαίνει στο `issuance-professional.ts`.
  - Μπαίνει στην **προσφορά** (`signerUid`): η πρόσκληση πάει στο γραφείο, και ποιος υπογράφει είναι όρος της προσφοράς
    (Upwork: ορίζεται από τον business manager, μια αναθεώρηση μπορεί να τον αλλάξει).
  - Υποχρεωτικό για μέλος, απαγορευμένο για σύνδεσμο/καταγραφή. Την ιδιότητα μέλους την κρίνει ο διακομιστής (Φ3β).
- **`IssuanceAssignmentTarget` ⇒ `{ledger, propertyId, documentKind}`** (το χρέος του §7.3): η τηλεμετρία μηνυμάτων /
  υπενθυμίσεων βρίσκει τη διεύθυνση με το `ledgerAssignmentIdOf` και ξαναγράφει με το σχήμα δίσκου του γραφέα.
  - Οι τρεις καλούντες περνούν `officeLedger(companyId)`.
  - ⚠️ Δηλωμένο όριο: το `recordIssuanceObservation` (webhook παράδοσης email) μένει εταιρικό. Αφορά μόνο email-συνδέσμους
    σε επαφή, που στο προσωπικό βιβλίο δεν υπάρχουν.
- Άγκυρες:
  - `issuance-workspace-member.test.ts`: πρόσκληση = αποστολή · ιδεμποτία · επαφή από ιδιώτη · ροή γραφείου αμετάβλητη ·
    προσφορά/άρνηση μέλους · χωρίς υπογράφοντα · ξένο γραφείο · σύνδεσμος · πράξεις εκτός ρόλου.
  - `issuance-assignment-schema.test.ts` Β1–Β2.
  - `issuance-owner-self.test.ts` και `issuance-request.service.test.ts` περνούν πλέον από τον **πραγματικό** δρόμο του μέλους
    αντί για καταγραφή γραφείου. **Δεν έτρεξαν** (εντολή Giorgio).
- Εκκρεμεί η αναπαραγωγή `src/types/i18n.ts` (νέο κλειδί `issuance.channel.nestor-inbox`) — γεννήτορας μόνο με έγκριση.

## Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-11-20 | **ADR-947 Δ4 (εγκρίθηκε):** η μονάδα της ανάθεσης γενικεύεται από `DocumentKind` σε `IssuanceDeliverable` (έγγραφο \| υπηρεσία). Οι 3 ραφές (προσόντα · παράδοση · ετικέτες) γίνονται ολικές· id seed εγγράφων αμετάβλητο. Η Φ3β/γ/δ + Φ4 αυτού του ADR είναι προαπαιτούμενο της βαθμίδας 2 του ADR-947. Κώδικας δεν άλλαξε. |
| 2026-11-18 | Πρόταση: εύρημα E2E + έρευνα αγοράς + χάρτης κώδικα (11 δεσμευτικές υποθέσεις εταιρείας). |
| 2026-11-18 | §6 αποφάσεις Giorgio: διαφορά ιδιώτη ⇒ πλατφόρμα · πολλαπλές προσφορές στον πυρήνα (Φ5 πριν από την E2E) · πρόσκληση εκτός Nestor με email. |
| 2026-11-18 | §7 σχέδιο Φ1 εγκρίθηκε· διορθώσεις Δ3/Δ4 από τον κώδικα· μοντέλο RFQ → bids → award. **Φ1α κώδικας**: `professional` (ένωση) στη θέση του `professionalContactId`, κάτοχος `CustodyScope` με δύο όψεις, `IssuanceLedger` στον γραφέα, άγκυρα σχήματος. tsc/jest **αναμένουν** τον Giorgio. |
| 2026-11-18 | §7.4 **Φ1β μέρος 1**: ταυτότητες `disr`/`dibd` + συλλογή `document_issuance_requests` (deny-all, σουίτα κανόνων) · `requestId`/`cycle`/`cancellation.reason` · καθαρός πυρήνας `issuance-bidding.ts` · actor `owner` + βάση `owner-self` (`ownerContactId` μόνο στις βάσεις γραφείου). Διόρθωση σχεδίου: καμία γραμμή tenant-config. tsc/jest **αναμένουν** τον Giorgio. |
| 2026-11-18 | §7.5 **Φ1β μέρος 2**: writer `owner` · κριτής υποκειμένου = `readUpkeepSubject` όπως είναι (Φ1 μόνο βιβλίο ιδιώτη, `office-ledger`) · `latestIssuedOn` ιδιώτη από δήλωση + φάκελο (`files_personal`) με τους ΙΔΙΟΥΣ κριτές του μητρώου · προσόν από τη βιτρίνα (ίδιος κριτής με το `/pro`) · `issuance-request.service.ts` (invite · award ατομικό · cancel) · route `issuance-requests` · tests. tsc/jest/πύλες **αναμένουν** τον Giorgio. |
| 2026-11-18 | **Φ1β ενταγμένη** (`main` `ec82ec17`, squash μαζί με Φ1α + acc-030 από το ίδιο κλαδί). **Άγκυρες που προϋπήρχαν κόκκινες, διορθωμένες με εντολή Giorgio** — καμία αλλαγή κώδικα παραγωγής: (α) `personal-scope-consumers.test.ts`: 28 αδήλωτες διαδρομές του `withPersonalOrOrgAuth` δηλώθηκαν, η καθεμία με λόγο από **ανάγνωση του κριτή της** (καμία δεν ανοίγει σε πολίτη ξένα/εταιρικά δεδομένα· η `places/declarable-areas` δεν έχει κριτή κατοχής **επίτηδες** — μόνο δημόσια όρια)· +3 καταναλωτές `withFileCustodyAuth` (`capture-facts` · `focal-point` · `publish-raster`) και +1 `withNetworkDoor` (`threads/[threadId]`)· παρονομαστής 28 ⇒ 77 (το +1 είναι η δική μας `issuance-requests`). (β) `enterprise-id.service.test.ts`: 4 ντετερμινιστικοί χωρίς δήλωση (`cdp` ADR-942 · `ipay`/`pevt` ADR-ACC-030 · `ppye` ADR-943) ⇒ `DETERMINISTIC_ONLY` + χρυσά δείγματα από τους ίδιους τους γεννήτορες. (γ) `rules-liveness-gate.test.js`: 883 ⇒ **899** (+2 δικά μας, +14 προϋπάρχοντα μη αποδοσμένα ανά commit). |
| 2026-11-19 | §7.6 **Φ2 Βήματα 2–7** (διακόπτης `OWNER_ISSUANCE_REQUESTS` κλειστός): τύποι όψης στο σύρμα · client · μοντέλο όψης (ίδιος μειωτής για «κι άλλον;») · hooks όχι αισιόδοξα · ενότητα «Εκδόσεις εγγράφων» στο `/me` · πλαίσιο `/pro` (`forProperty`/`forDocument`) με επέκταση των δύο δημιουργών URL · ένας πάροχος ανά σελίδα · «Ζήτησε προσφορά» στην κάρτα και στο προφίλ · i18n el+en · δύο άγκυρες. tsc/jest/πύλες/slices **αναμένουν** τον Giorgio. |
| 2026-11-19 | §7.6 **ανοιχτά (α)–(γ) κλειστά** (πρακτική Thumbtack · Angi · Procore): φωνή ιδιώτη για τα στάδια (`OWNER_STAGE_KEYS`) · μπάλα ιδιώτη = ολικός πίνακας `OWNER_BALL` («Σειρά σου» μόνο με πράξη· `proposed` ⇒ πλατφόρμα — διόρθωση της φράσης του Δ3) · `/pro` «για» ακίνητο ⇒ το `MyPropertyFilter` προεπιλέγει μία φορά την περιοχή του (ίδιος κριτής `ownerPropertyWhere`, καμία αλλαγή server). |
| 2026-11-19 | §7.6 **επιφάνειες** αντί για τοπικό `next/dynamic` (`AgencyIssuanceQuote` · `OwnerIssuanceRequestSection`), πάροχος `/pro` χωρίς namespaces, κατάστιχο +7 / σφράγιση 110 → 117 · tests Ε1–Ε6 / Π1–Π3 / Ζ1–Ζ3 · αναπαραγωγή slices + `src/types/i18n.ts`. Jest / jscpd / γεννήτορες πράσινα. |
| 2026-11-19 | §7.7 **Φ3 σχέδιο** (Upwork Agency · Thumbtack · Drive permissions) + **Φ3α**: η πρόσκληση του ιδιώτη = αποστολή (κανάλι πλατφόρμας `nestor-inbox`, `sent`) · actor/writer `workspace-member` (μόνο απάντηση + προσφορά, μόνο στο δικό του γραφείο) · υπογράφων μέλος στην προσφορά (`signerUid`, διόρθωση §7.1) · `IssuanceAssignmentTarget` ledger-aware · άγκυρες. tsc/jest/γεννήτορες **αναμένουν** τον Giorgio. |
