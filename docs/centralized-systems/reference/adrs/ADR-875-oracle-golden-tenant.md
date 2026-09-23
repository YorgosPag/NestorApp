# ADR-875 — Golden tenant: ο χρησμός 3.51 κρίνει **με ταυτότητα**

| Πεδίο | Τιμή |
|---|---|
| **Category** | Quality gates / CI / Identity |
| **Status** | ACCEPTED — Φάση 1 committed `0d751982` · πρώτο run CI `35890283081`: **ταυτότητα ✅ αποδείχθηκε** · **σπορά ⛔ αρνήθηκε** (ταβάνι 67 > 60, §9) ⇒ η Φάση 2 §7.1 είναι πλέον **προαπαιτούμενο** της σποράς |
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
5. **ο ίδιος** σπορέας με το τοπικό `npm run emulator:seed-personas` (ADR-798) + `--oracle-manifest=…`
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
| `scripts/emulator-seed-personas.ts` | `--oracle-manifest=<path>`: `{schema, projectId, authEmulatorHost, personas[{class, email, workspaceSegment}]}`. **Χωρίς** διαπιστευτήριο |

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
