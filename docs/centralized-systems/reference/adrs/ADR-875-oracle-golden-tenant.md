# ADR-875 — Golden tenant: ο χρησμός 3.51 κρίνει **με ταυτότητα**

| Πεδίο | Τιμή |
|---|---|
| **Category** | Quality gates / CI / Identity |
| **Status** | ACCEPTED — Φάση 1 committed `0d751982` · πρώτο run CI `35890283081`: **ταυτότητα ✅ αποδείχθηκε** · **σπορά ⛔ αρνήθηκε** (ταβάνι 67 > 60, §9) · **Φάση 2.1 (golden δεδομένα) υλοποιημένη** (§10, χωρίς commit, αναμένει το πρώτο run) · 🔴 εύρημα παραγωγής: πύλη προμηθευτή απρόσιτη (§10.5) |
| **Date** | 2026-09-23 |
| **Πύλη** | **CHECK 3.51 Χ** — `docs/gates/3.51.md` · `node scripts/check-i18n-ssr-oracle.js` |
| **Προηγούμενα** | ADR-781 §13-§16 *(ο χρησμός· το ανοιχτό Γ)* · ADR-788 *(κρίνουμε την εικόνα που στάλθηκε· μηδέν μυστικά)* · ADR-798 *(κατάλογος persona)* · ADR-787 *(πρόθεμα χώρου `/o/[workspace]`)* · ADR-800 *(μία έκδοση ανά όνομα)* |
| **Αυθεντία** | ο κώδικας. Όπου αυτό το ADR διαφωνεί με τον κώδικα, κερδίζει ο κώδικας |

---

## 1. Το πρόβλημα

Οι **110** διαδρομές `/o/[workspace]/**` **δεν κρίθηκαν ποτέ**. Ο χρησμός χτυπά ανώνυμα και
το `src/app/(app)/o/[workspace]/layout.tsx:68-74` κάνει `redirect(AUTH_ROUTES.login)` **πριν** από
οποιοδήποτε render (`readPageIdentity()` → `no-session`). Μέχρι το ADR-781 §13 αυτό **εξατμιζόταν**
στο 🔶 `surface-synthetic-id`· μετά το §13/§14 τουλάχιστον **ονομάζεται** (`route-redirected`). Αυτό
όμως δεν είναι θεραπεία: τα δύο τρίτα του προϊόντος μένουν άκριτα.

Το `[workspace]` **δεν είναι οντότητα, είναι ταυτότητα**. Ένα συνθετικό τμήμα δεν μπορεί να το
γεμίσει. Το γεμίζει μόνο μια **συνεδρία**.

## 2. Τι μετρήθηκε πριν από τον κώδικα

| Ερώτημα | Απάντηση | Πηγή |
|---|---|---|
| Σηκώνεται η εικόνα υπό emulator **χωρίς** διαπιστευτήριο; | **Ναι, χωρίς αλλαγή κώδικα παραγωγής.** `AuthHttpClient.getToken()` επιστρέφει `'owner'` όταν υπάρχει `FIREBASE_AUTH_EMULATOR_HOST`· ο signer είναι `EmulatedSigner`· το Firestore Admin με `FIRESTORE_EMULATOR_HOST` δεν ζητά creds | `firebase-admin@12.7.0` · `lib/auth/auth-api-request.js:184-190` · `lib/auth/base-auth.js:35` |
| Ποιο project βλέπει η εικόνα; | `resolveProjectId()` = `FIREBASE_PROJECT_ID` **πριν** από το ψημένο `NEXT_PUBLIC_FIREBASE_PROJECT_ID` ⇒ override σε runtime | `src/lib/firebaseAdmin-credentials.ts:28` |
| Η αλυσίδα διαπιστευτηρίων; | Priority 3: `initializeApp({ projectId })`, lazy — δεν σκάει χωρίς ADC | `firebaseAdmin-credentials.ts:158-264` |
| Rate limit χωρίς Upstash; | `memory` — όχι σφάλμα | `rate-limit-config.ts:272-278` |
| Έλεγχος ανάκλησης; | Υπό emulator το `verifySessionCookie` ελέγχει **πάντα** (getUser στον emulator) — εντάξει | `base-auth.js:581-590` |
| Τι διαβάζει η σελίδα μετά το cookie; | Ταυτότητα **μόνο από claims**· `resolveAlias` → `workspace_aliases/{skeleton}`· `decideMembership` = `home` με **0 reads** όταν ο χώρος = claim `companyId` | `page-identity.ts:169-243` · `workspace-from-path.ts:115` · `workspace-membership.ts:157` |
| Ο ιδιωτικός χώρος `/o/me/**`; | Το `PERSONAL_WORKSPACE_SURFACE` είναι **κενό** ⇒ καμία σελίδα προσφέρεται σήμερα | `personal-workspace-surface.ts:88` |
| Dockerfile; | Κανένα `FIREBASE_*` ψημένο ⇒ τα `-e …_EMULATOR_HOST` τιμώνται | `Dockerfile` |

## 3. Η πρακτική των μεγάλων — και πού πάμε πιο πέρα

| Οι μεγάλοι | Εδώ |
|---|---|
| **Firebase**: emulators με project `demo-*` — «καμία πιθανότητα αλλαγής δεδομένων, χρήσης ή χρέωσης» | ίδιο **+ φρουρός στον καταναλωτή**: ο χρησμός **αρνείται** να κόψει συνεδρία αν το project δεν είναι `demo-*` ή ο emulator δεν είναι loopback (`assertHermetic`). Το workflow αλλάζει· ο φρουρός μένει |
| **Playwright**: API-login ανά ρόλο σε setup project, ένα `storageState` ανά ρόλο | ίδιο, αλλά η συνεδρία κόβεται **από τη σταλμένη εικόνα** (`POST /api/auth/session`). Ελέγχεται και η πόρτα σύνδεσης, όχι cookie φτιαγμένο δίπλα της |
| **Datadog / Checkly synthetics**: χειροδιαλεγμένοι λογαριασμοί test **στην παραγωγή** | **κάλυψη εκ κατασκευής**: οι κλάσεις προκύπτουν από την αυθεντία `classifyIdentityClaims`. Η άγκυρα Τ3 απαιτεί **ακριβώς έναν** εκπρόσωπο ανά κλάση οργανισμού του καταλόγου ADR-798. Και **μηδέν** αγγίγματα στην παραγωγή |
| Playwright: «τα state files είναι ευαίσθητα — μην τα βάζεις σε artifacts» | το cookie **δεν μπαίνει ποτέ** σε αντικείμενο διαδρομής. Ζει σε `Map` στις επιλογές της σάρωσης (άγκυρα Π3). Το διαπιστευτήριο είναι **εφήμερο ανά εκτέλεση** (`openssl rand` + `::add-mask::`) |
| αποτυχία login ⇒ συνήθως flaky skip | **fail-closed**: συνεδρία που δεν κόπηκε ή δεν τιμήθηκε ⇒ ⛔ `identity-unproven` |

## 4. Η απόφαση (Φάση 1 — ταυτότητα)

**Μηχανισμός: Firebase Auth + Firestore emulator μέσα στο job, project `demo-nestor-oracle`.**
Απορρίφθηκαν: tenant παραγωγής (παραβιάζει το ADR-788 και απαιτεί μυστικό στο CI) και χωριστό
staging project (νέα υποδομή και μυστικό, χωρίς κανένα κέρδος για την ερώτηση «ωμά κλειδιά στο HTML»).

### 4.1 Ροή στο CI (`.github/workflows/i18n-ssr-oracle.yml`)

1. εφήμερο `DEMO_SEED_PASSWORD` (μασκαρισμένο)
2. `pnpm install` **μόνο για τον σπορέα**
3. `firebase-tools@15.30.2` + `tsx@4.21.0`, **καρφωμένα** (το `tsx` στην έκδοση του lockfile — ADR-800)
4. `firebase emulators:start --only auth,firestore --project demo-nestor-oracle`
5. **ο ίδιος** σπορέας με το τοπικό `npm run emulator:seed-personas` (ADR-798). *(Φάση 2.1, §10.2: το manifest το γράφει πλέον το `emulator-seed-golden.ts`, **μετά** το βήμα 7, από το API της εικόνας)*
6. 🔴 `rm -rf node_modules` — ο χρησμός **αποδεικνύει** ότι τρέχει χωρίς εξαρτήσεις. Δεν αρκεί να το δηλώνει
7. `docker run --network host` με **μόνο** διευθύνσεις emulator + demo project. **Κανένα μυστικό**
8. ο χρησμός με `I18N_SSR_ORACLE_PERSONAS` → κόβει συνεδρία ανά κλάση → κρίνει

### 4.2 Κώδικας

| Αρχείο | Ρόλος |
|---|---|
| `scripts/lib/i18n-ssr/identity.js` (νέο, χωρίς εξαρτήσεις) | manifest (fail-closed) · `assertHermetic` · `mintSession` (emulator `signInWithPassword` → `POST /api/auth/session` της εικόνας → `__session`) · `expandForPersonas` · `routeIdOf` · `prepareIdentity` |
| `scripts/lib/i18n-ssr/probe.js` | `sessionFor` (persona χωρίς συνεδρία ⇒ ⛔, **ποτέ** ανώνυμο αίτημα στη θέση της) · `settle` (η μία μορφή εγγραφής· ανακατεύθυνση **στη σύνδεση** υπό συνεδρία ⇒ ⛔) |
| `scripts/lib/i18n-ssr/states.js` | νέα ⛔ `identity-unproven` |
| `scripts/check-i18n-ssr-oracle.js` | `prepareIdentity` πριν τη σάρωση· δήλωση/ταυτότητα = `routeIdOf`· η αναφορά τυπώνει την ταυτότητα **και** όταν είναι ανώνυμη |
| `scripts/lib/emulator/personas.ts` | `oracleClassOf` · `ORACLE_REPRESENTATIVES` (`int.architect` = `organization:internal_user`, `admin.civil` = `organization:company_admin`) |
| `scripts/lib/emulator/identity.ts` | project/hosts από τα **τυπικά** env του Firebase (`GCLOUD_PROJECT`, `*_EMULATOR_HOST`)· προεπιλογές αμετάβλητες |
| `scripts/emulator-seed-personas.ts` | ~~`--oracle-manifest=<path>`~~ → **μετακινήθηκε** στο `emulator-seed-golden.ts` (§10.2, manifest v2 με `golden`). **Χωρίς** διαπιστευτήριο |

### 4.3 Ταυτότητα ratchet

`/o/[workspace]/projects` → `/o/alpha-techniki/projects@organization:company_admin` **και**
`…@organization:internal_user`. Δύο persona στο ίδιο URL είναι **δύο γεγονότα**: αν ο ένας ρόλος
βάφει ωμό κλειδί και ο άλλος όχι, η ταυτότητα πρέπει να το ξεχωρίζει. Το `dynamic` ξαναϋπολογίζεται:
αν το `[workspace]` ήταν το μόνο δυναμικό τμήμα, η σελίδα πλέον κρίνεται **κανονικά** (όχι 🔶).

### 4.4 Γιατί ⛔ και όχι 🔴 / 🔶 για το `identity-unproven`

- **Όχι 🔴**: μια χαλασμένη πόρτα σύνδεσης θα έβαφε **όλες** τις ~220 και η ξανασπορά θα τις
  ενέκρινε. Είναι το «η σπορά ενέκρινε τον εαυτό της» του ADR-781 §15.
- **Όχι 🔶**: θα εξατμιζόταν (ADR-781 §13.2).
- Ανακατεύθυνση υπό συνεδρία **αλλού** (όχι στη σύνδεση) μένει 🔴 `route-redirected`: αυτό είναι
  απόφαση της σελίδας, όχι άρνηση της ταυτότητας (άγκυρα Π6).

## 5. Άγκυρες (`scripts/__tests__/i18n-ssr-identity.test.ts`)

- **Τ1**: τα αντίγραφα του χρησμού (`o`, `/login`, `__session`, `/api/auth/session`) = οι αυθεντίες του `src/`, **εκτελεσμένες**
- **Τ2**: `oracleClassOf` ≡ `classifyIdentityClaims` σε **όλο** τον κατάλογο
- **Τ3**: ένας εκπρόσωπος ανά κλάση οργανισμού. Ο ιδιωτικός χώρος χωρίς εκπρόσωπο **όσο** το `PERSONAL_WORKSPACE_SURFACE` είναι κενό
- **Ε1-Ε4**: manifest fail-closed · project παραγωγής ⇒ άρνηση **πριν από κάθε `fetch`** · emulator εκτός loopback ⇒ άρνηση
- **Σ1-Σ4**: η κοπή περνά από την πόρτα της εικόνας · το token **δεν** μπαίνει σε μήνυμα · χωρίς manifest στο CI ⇒ άρνηση · αποτυχία ⇒ ονομασμένη
- **Π1-Π8**: επέκταση ανά persona · το cookie στάλθηκε αλλά **δεν** υπάρχει στην εγγραφή · χωρίς συνεδρία ⇒ ⛔ και **κανένα** ανώνυμο αίτημα · `/login` υπό συνεδρία ⇒ ⛔ · ανώνυμη συμπεριφορά αμετάβλητη

## 6. Αναμενόμενη επίπτωση και σειρά

- `route-redirected` ~112 → ~2 · ~220 νέες κρίσεις `route@κλάση` ⇒ **θα φανούν νέα ωμά κλειδιά** (αυτός είναι ο σκοπός) ·
  το `surface-synthetic-id` πέφτει και άλλο.
- Η baseline αλλάζει λεξιλόγιο δηλώσεων ⇒ **απαιτείται ξανασπορά**. Σειρά: push → σπορά (6 κριτήρια του ADR-781 §14.5) →
  τα ωμά κλειδιά που θα φανούν γίνονται **δουλειά**, όχι baseline χωρίς ανάγνωση.

## 7. Φάση 2 (ανοιχτά — ίδιο ADR)

1. **Golden δεδομένα**: project/building/property στον tenant, ώστε τα `[projectId]` κλπ. να παίρνουν πραγματικά ids ⇒
   `surface-synthetic-id` → ~0 ⇒ σφίξιμο του ταβανιού 20% (ADR-781 §15). **Απόφαση Giorgio.**
2. «**Δηλωμένη** ανακατεύθυνση που **δεν** έγινε», ο δίδυμος του `withheld-but-answered` (ADR-781 §13.7).
3. `account/page.tsx` → `redirect('/account/profile')` **χωρίς** πρόθεμα χώρου (ADR-781 §14.3): υπό συνεδρία φαίνεται πλέον ως 🔴.
4. Οι άλλες 4 ροές emulator (`firestore-rules`, `storage-rules`, `functions-integration`, `service-integration`) εγκαθιστούν
   `firebase-tools` **χωρίς** καρφωμένη έκδοση. Εδώ καρφώθηκε. Εκεί είναι ανοιχτό.

## 8. Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-09-23 | Φάση 1: emulator + demo project · σπορέας ADR-798 με manifest · κοπή συνεδρίας από την εικόνα · `identity-unproven` ⛔ · άγκυρες Τ/Ε/Σ/Π |
| 2026-09-23 | §10 Φάση 2.1: golden δεδομένα — κατάλογος 26 προτύπων σε 3 βαθμίδες (`api` από το API της εικόνας · `witness` · `value`) · manifest **v2** · σταθερή ταυτότητα έναντι `fetchUrl` · μάσκα ids στα `detail` · εφήμερα `VENDOR_PORTAL_SECRET`/`ATTENDANCE_QR_SECRET` · άγκυρες **Γ1-Γ9** (μεταλλάξεις 9/9 μετά την αυστηροποίηση της Γ3β) · η Γ9 έπιασε διαρροή `fetchUrl` στην εγγραφή · 🔴 εύρημα παραγωγής §10.5 (πύλη προμηθευτή → `/login`) |
| 2026-09-23 | §9: πρώτο run CI (`35890283081`, εικόνα `main-0d75198`) — ταυτότητα ✅ · σπορά ⛔ ταβάνι 67 > 60 (δεν χαλαρώθηκε) · **διορθώθηκε η σιωπηλή άρνηση**: το artifact «υποψήφια» ήταν η ΠΑΛΙΑ baseline (`i18n-ssr-oracle.yml` κρατά κωδικό εξόδου + σβήνει το μπαγιάτικο) · η άρνηση τυπώνει την αναφορά της ίδιας μέτρησης (`ratchet-baseline.js`, άγκυρα **Β11**, μετάλλαξη 1/1) |

## 9. Πρώτο run στο CI — ευρήματα (2026-09-23)

Run `35890283081` · εικόνα `ghcr.io/yorgospag/nestor-app:main-0d75198` · **304** δηλώσεις (ήταν 154).

### 9.1 Τα 5 κριτήρια του handoff

| # | Κριτήριο | Αποτέλεσμα |
|---|---|---|
| 1 | emulators + manifest | ✅ `All emulators ready` · `🔮 manifest χρησμού … (organization:internal_user, organization:company_admin)` |
| 2 | ταυτότητα `demo-nestor-oracle` | ✅ **έμμεσα**: `Detected demo project ID "demo-nestor-oracle"` και **καμία** `/o/**` δεν πήγε στη σύνδεση. ⚠️ Η γραμμή `ταυτότητα: …` τυπώνεται **μόνο** στο `--report`, που το CI δεν έτρεχε. Μετά τη διόρθωση του §9.3 τυπώνεται και στην άρνηση |
| 3 | `identity-unproven` = 0 | ✅ **0** |
| 4 | `route-unreachable` από υπηρεσία χωρίς emulator | ✅ **0**. Καμία ⛔ κατάσταση ⇒ **δεν** χρειάστηκε `backend-unavailable`. Ο φόβος για το Storage δεν επιβεβαιώθηκε |
| 5 | `route-redirected` ~112 → ~2 | ✅ **5**: στο `/o` **2**, το `contacts/[id]` → `contacts?contactId=…` (απόφαση της σελίδας, σωστά 🔴 κατά §4.4 Π6). Εκτός `/o` **3**: `/n/[id]` και `[...unprefixed]` → `/login` (ανώνυμα, αναμενόμενο) · `/search` → `/` |

### 9.2 ⛔ ΕΥΡΗΜΑ Ε1 — η σπορά αρνήθηκε: `surface-synthetic-id` **67 > 60** (ταβάνι 20% των 304)

- Απογραφή: 166 `surface-shell-only` (131 στο `/o`) · **67** `surface-synthetic-id` (**46** στο `/o` = **23** δυναμικές × **2** persona · 21 εκτός, όσο είχε προβλέψει το ADR-781 §14.5) · 23 `clean` (12 στο `/o`) · 33 γραμμές `raw-key` (28 στο `/o`) · 6 `route-withheld` · 4 `withheld-but-answered` · 5 `route-redirected`.
- **Η πρόβλεψη του §6 («το `surface-synthetic-id` πέφτει») ήταν λάθος.** Η επέκταση ανά persona **διπλασιάζει** και τις δυναμικές διαδρομές του χώρου. Το `[workspace]` γεμίζει, το `[projectId]` όχι.
- **ΔΕΝ χαλαρώθηκε τίποτα.** Απορρίφθηκαν: μεγαλύτερο ταβάνι · μέτρηση ανά διαδρομή αντί ανά `διαδρομή@κλάση`. Και τα δύο είναι το «η σπορά ενέκρινε τον εαυτό της» (ADR-781 §15.1). Το ταβάνι έκανε **ακριβώς** τη δουλειά του.
- **Συνέπεια**: η Φάση 2 §7.1 (golden δεδομένα ⇒ πραγματικά `[projectId]` κλπ.) **δεν είναι πλέον προαιρετική**: είναι **προαπαιτούμενο** για οποιαδήποτε σπορά. Μέχρι τότε η πύλη Χ μένει κόκκινη, όπως ήταν από τις 2026-09-22.

### 9.3 ΕΥΡΗΜΑ Ε2 (διορθώθηκε) — η άρνηση της σποράς ήταν **σιωπηλή**

- Το βήμα έτρεχε `--write-baseline … | tee … || true`. Το checkout **περιέχει** την commit-αρισμένη baseline, άρα όταν η σπορά αρνιόταν έμενε το **παλιό** αρχείο. Ανέβαινε ως `i18n-ssr-oracle-baseline-candidate` και η σύνοψη έλεγε «βάλ' το στη ρίζα και κάνε commit». Μετρημένο: artifact **byte-προς-byte ίδιο** με το `HEAD` (`cmp`). Το σχόλιο του upload («όταν αρνείται, το αρχείο δεν γράφεται») περιέγραφε ακριβώς αυτό που **δεν** συνέβαινε.
- Το δεύτερο κενό: στην άρνηση **χανόταν η μέτρηση**. Το CI κρατούσε μόνο «67 > 60», χωρίς κλειδιά και χωρίς γραμμή ταυτότητας.
- **Θεραπεία, χωρίς νέα μηχανή**: (α) το `runSetRatchetCli` καλεί το `descriptor.printReport(measured)` **πριν** το `exit(1)` της άρνησης, με **μία** σάρωση (άγκυρα **Β11**: ο μετρητής εκτελείται **ακριβώς** μία φορά· μετάλλαξη 1/1 κόκκινη). (β) Η ροή κρατά τον κωδικό εξόδου. Στην άρνηση **σβήνει** το αρχείο του runner και γράφει «⛔ Η ΣΠΟΡΑ ΑΡΝΗΘΗΚΕ» ⇒ το upload βγάζει `warn` αντί για μπαγιάτικο artifact.
- Η κλάση **έξω** από το 3.51 ελέγχθηκε: οι άλλες **7** ροές σποράς (a11y · bundle · coverage · jest-suite · knip-deps · type-complexity · type-coverage) έχουν τη σπορά ως **τελευταία** εντολή, χωρίς `|| true` ⇒ **δεν** έχουν το ελάττωμα.

### 9.4 Δουλειά που φάνηκε — ωμά κλειδιά στο `/o` (ΔΕΝ μπαίνουν τυφλά σε baseline)

| διαδρομή (`/o/[workspace]/…`) | κλειδιά |
|---|---|
| `procurement/analytics` | **35** — ⚠️ **μόνο** `company_admin`· ο `internal_user` βλέπει `surface-shell-only` (η §4.3 έπιασε διαφορά ρόλου) |
| `procurement/rfqs/new` | 18 |
| `procurement/{agreements,materials,purchase-orders,vendors}` | 17 η καθεμία (κοινό κέλυφος procurement) |
| `procurement/quotes/scan` · `procurement/rfqs` | 15 · 13 |
| `spaces/parking` · `construction/portfolio` · `properties` · `spaces/properties` | 11 · 9 · 9 · 8 |
| `attendance/check-in/[id]` · `procurement/quotes/[id]/review` · `spaces/storage` | 2 η καθεμία |

Τα **ονόματα** των κλειδιών θα τα τυπώσει το **επόμενο** run (§9.3α). Το σταθερό 17 σε τέσσερις σελίδες procurement δείχνει **ένα** κοινό σημείο (layout/tabs), όχι δεκαεπτά ανά σελίδα.

**Επιβεβαιώθηκε στο run `35894034849` (εικόνα `main-804452a`)**: η §9.3 δουλεύει στο CI. Φάνηκαν το «⛔ Η ΣΠΟΡΑ ΑΡΝΗΘΗΚΕ», το `No files were found` (κανένα μπαγιάτικο artifact), η γραμμή `ταυτότητα: … project demo-nestor-oracle` και τα **ονόματα** των κλειδιών. Είναι **μία κλάση, όχι 17 σφάλματα ανά σελίδα**: σχεδόν όλα ανήκουν στο namespace **procurement** (`nav.rfqs` · `nav.purchaseOrders` · `nav.vendors` · `nav.quotes` · `nav.materials` · `nav.hub` · `nav.analytics` · `nav.agreements` · `filters.*` · `rfqs.*` · `quotes.*` · `hub.*` · `analytics.*`). Το `nav.*` σε **κάθε** σελίδα procurement δείχνει κοινό υπο-μενού που αποδίδεται στον server **χωρίς** το namespace στο SSR slice της διαδρομής. Άρα η θεραπεία ανήκει στο **ADR-744 (per-route slices)**, όχι ανά κλειδί. Για τα υπόλοιπα (`portfolio.refresh` · `validatingQr` · `unitsTitle` · `trash.viewTrash` · `spaceAvailability.ariaLabel`) τίθεται το ίδιο ερώτημα στις δικές τους σελίδες.

## 10. Φάση 2.1 — golden δεδομένα (2026-09-23)

### 10.1 Τι μετρήθηκε πριν από τον κώδικα — και άλλαξε το σχέδιο

| Ερώτημα | Απάντηση | Συνέπεια |
|---|---|---|
| Πόσα δυναμικά πρότυπα `/o`; | **26** (όχι 23: το 46 του §9.2 μετρούσε μόνο τα 🔶) | ο κατάλογος καλύπτει 26 — άγκυρα Γ1 |
| Ποια διαβάζουν την οντότητα **στον server**; | **3 αρχεία**: `projects/[id]/procurement/layout.tsx` (`requireProjectForPage` ⇒ `notFound()`, που αφορά **9** πρότυπα) · `procurement/purchase-orders/[id]` (`getPO`) · `vendor/quote/[token]` (HMAC + invite + RFQ) | μόνο αυτές οι οντότητες χρειάζονται **πραγματική** εγγραφή |
| Τα υπόλοιπα 23; | client components (`'use client'`, `ssr:false`) ή σκέτα redirects· το SSR είναι **ίδιο** για κάθε id | αρκεί **μάρτυρας ύπαρξης** |
| Μπορεί ένα `satisfies <Τύπος>` σε script να εγγυηθεί σχήμα; | **ΟΧΙ**: τα `scripts/` είναι **εκτός** tsconfig και το jest τρέχει `@swc/jest` (χωρίς τύπους) | το σχέδιο «typed εγγραφή» απορρίφθηκε ως **ψευδής εγγύηση** |
| Εκθέτει το route γέννησης έργου καθαρή συνάρτηση; | **ΟΧΙ**: πολιτική ADR-284 · `projectCode` · `linkedCompanyId` ζουν στον handler | σπορά **μέσω του API** της εικόνας (Playwright/Cypress: «seed via API, not the DB») |
| Τα ids των γραφέων; | **τυχαία** (`generateRfqId()`), και τα tokens λήγουν | δύο URL ανά διαδρομή (§10.2) |

### 10.2 Η αρχιτεκτονική

- **Κατάλογος** `scripts/lib/i18n-ssr/golden-catalog.js`: CommonJS χωρίς εξαρτήσεις, γιατί τον διαβάζουν ΚΑΙ ο χρησμός ΚΑΙ ο σπορέας. Περιέχει:
  - τις οντότητες, με **βαθμίδα** (`api` · `witness` · `value`) και πρόθεμα id·
  - το πρότυπο → οντότητες, **θεσιακά**·
  - τα εφήμερα μυστικά·
  - την τιμή του `[type]`.
- **Δέσιμο** `golden-bindings.js`:
  - `parseGolden`: κλειστό σύνολο, πρόθεμα από το SSoT, id ασφαλές για URL.
  - `bindWorkspaceRoute`: **`url` = σταθερή ταυτότητα** (`…/rfqs/golden-rfq`) και **`fetchUrl` = το αίτημα** (`…/rfqs/rfq_8f…`).
  - `maskGoldenIds`: κανένα `detail` δεν κρατά id. Έτσι π.χ. ο στόχος `?projectId=proj_…` δεν γίνεται «νέα» ταυτότητα σε κάθε run.
  - `assertCatalogMatchesRoutes`: μπαγιάτικος κατάλογος ⇒ άρνηση. Ελέγχεται πάνω στην **πλήρη** απογραφή, πριν από κάθε `--only`.
- **Manifest v2** (`i18n-ssr-personas/v2`): προστίθεται το `golden.entities`. Επειδή είναι υποχρεωτικό, κάνουμε **bump** σχήματος και όχι προαιρετικό πεδίο στο v1.
- **Σπορέας** `scripts/emulator-seed-golden.ts`. Το manifest **μετακινήθηκε** εδώ από το `emulator-seed-personas.ts`.
  - Βαθμίδα `api`: μέσω του **API της σταλμένης εικόνας**, ως `company_admin`:
    - `/api/projects/list` → γέννηση έργου με ομάδα (CHECK 3.88)·
    - `/api/rfqs`·
    - `/api/rfqs/[id]/invites` με `copy_link`, οπότε **δεν στέλνεται email**·
    - `/api/procurement`·
    - `/api/attendance/qr/generate`.
  - Βαθμίδα `witness`: ντετερμινιστικά ids `<πρόθεμα>_alpha_golden` (`lib/emulator/golden-witnesses.ts`).
  - Η επαφή εταιρείας είναι μάρτυρας **και** είσοδος του API έργου. Οι επαφές γράφονται μόνο από τον client SDK· δεν υπάρχει route εγγραφής.
- **Ροή**:
  - εφήμερα `VENDOR_PORTAL_SECRET` + `ATTENDANCE_QR_SECRET` ανά run (`openssl rand` + `::add-mask::`), που τα παίρνει μόνο η εικόνα (`-e ΟΝΟΜΑ`)·
  - σειρά: persona → εικόνα → **golden** → `rm -rf node_modules` → χρησμός.

### 10.3 🔴 Εύρημα που το έπιασε η δική του άγκυρα (Γ9): το `fetchUrl` διέρρεε στην εγγραφή

Η εγγραφή απλώνει τη διαδρομή (`...route`). Έτσι το `fetchUrl`, με τα **υπογεγραμμένα tokens**, θα ταξίδευε σε αναφορά και από εκεί σε artifact. Ισχύει η ίδια αρχή με το cookie (§3: «το cookie δεν γίνεται ποτέ δεδομένο»). Η θεραπεία μπήκε στο **ένα** σημείο που δίνει μορφή στην εγγραφή, το `settle()` του `probe.js`.

### 10.4 Άγκυρες (`scripts/__tests__/i18n-ssr-golden.test.ts`)

| Άγκυρα | Τι αποδεικνύει |
|---|---|
| **Γ1** | ο κατάλογος έχει ακριβώς τα 26 πρότυπα του `enumerateRoutes` |
| **Γ1β** | μία οντότητα ανά δυναμικό τμήμα |
| **Γ2** | τα προθέματα = `ENTERPRISE_ID_PREFIXES` |
| **Γ2β** | η τιμή του `[type]` ∈ `ReportType` |
| **Γ3 / Γ3β** | fail-closed, με μήνυμα που **ονομάζει** την αιτία |
| **Γ4-Γ4δ** | το δέσιμο · πρότυπο εκτός καταλόγου ⇒ 🔶 · μπαγιάτικος κατάλογος ⇒ άρνηση · η μάσκα των ids |
| **Γ5** | manifest v1 ⇒ άρνηση |
| **Γ6** | ό,τι αποδομεί server αρχείο με πρόσβαση σε δεδομένα ⇒ βαθμίδα `api`. Ελέγχονται page **και layouts**, και ένα επίπεδο server components |
| **Γ6β** | ο ανιχνευτής **βρίσκει** τα 3 γνωστά, άρα δεν είναι τυφλός |
| **Γ7** | τα μυστικά είναι ονόματα του `environment-contract` **και** έχουν `-e` στο workflow |
| **Γ8** | οι μάρτυρες = η βαθμίδα `witness` |
| **Γ9** | ο probe ζητά το `fetchUrl`, καταγράφει την ταυτότητα, και **κανένα** id δεν μένει στην εγγραφή |

Μεταλλάξεις: **8/9** κόκκινες με την πρώτη. Η 9η (Γ3β) ήταν **ισοδύναμη**, γιατί το επόμενο βήμα έπιανε το `undefined`. Γι' αυτό η άγκυρα έγινε αυστηρή ως προς το **μήνυμα**.

### 10.5 🔴 ΕΥΡΗΜΑ ΠΑΡΑΓΩΓΗΣ — η πύλη προμηθευτή είναι απρόσιτη στον προμηθευτή

- **Η αιτία**: το `vendorPortalUrl()` χτίζει `/vendor/quote/<token>`, χωρίς πρόθεμα χώρου. Η σελίδα όμως ζει **μόνο** στο `/o/[workspace]/vendor/quote/[token]`, πίσω από τον φρουρό χώρου. Μετακινήθηκε εκεί στο `5ff0baa2` (ADR-787 §5.3).
- **Μετρημένο στην παραγωγή, ανώνυμα**: `https://nestorconstruct.gr/vendor/quote/abc` ⇒ `200` + `NEXT_REDIRECT;replace;/login?next=%2Fvendor%2Fquote%2Fabc;307;`.
- **Συνέπεια**: ο προμηθευτής **δεν είναι χρήστης**, άρα **δεν μπορεί ποτέ να καταθέσει προσφορά**, και το γραφείο νομίζει ότι δεν απάντησε. Είναι ακριβώς η «συνέπεια» που γράφει το `environment-contract` για το `VENDOR_PORTAL_SECRET`.
- **Θεραπεία**: δημόσια ομάδα διαδρομών (όπως το `(light)`), με δηλώσεις στις πύλες 3.52/3.60/3.63. Είναι **απόφαση Giorgio** και μένει εκτός Φ2.1.
- Όταν η σελίδα μετακινηθεί, η Γ1 θα ζητήσει ενημέρωση του καταλόγου, σκόπιμα.
