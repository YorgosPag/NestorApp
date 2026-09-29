# ADR-894 — Ενεργές συνεδρίες: η τοποθεσία επιλύεται στον server, με τοπική GeoIP, και ο server είναι ο μόνος γραφέας

| | |
|---|---|
| **Status** | **IMPLEMENTED** — Φάση 1 + **Φάση 2 (§10)** 2026-09-29 (uncommitted· ⏳ ζωντανός έλεγχος μετά το push, §9· ⏳ εκτέλεση του καθαρισμού §10.4 μόνο με εντολή Giorgio) |
| **Date** | 2026-09-29 |
| **Προέλευση** | ADR-891 §10.4 **Θ1**: αίτημα `ipapi.co` **από τον browser** σε κάθε φόρτωση της σελίδας έργων (ζωντανός έλεγχος ΙΚΑ, 2026-09-29) |
| **Απόφαση** | Giorgio, 2026-09-29: επιλογή **A** — «όπως οι μεγάλοι»: επίπεδο πόλης, επίλυση **στον server**, **τοπική** βάση, η IP δεν φεύγει ποτέ σε τρίτο. Τα υπόλοιπα (πού ζει η βάση, City/Country, διατήρηση) ανατέθηκαν στην πρακτική των μεγάλων, με έρευνα (§2) |
| **Σχετικά** | ADR-876 §5 *(`clientIpFingerprint`, μυστικό αλάτι)* · ADR-777 §8.72 *(`clientIpOf`)* · ADR-868 / ADR-817 *(σύνορα ταυτότητας)* · ADR-855 *(όριο ρυθμού)* · ADR-872 *(ιδεμποτία)* · ADR-891 Φ2 *(`cached-download`)* · ADR-889 §2.1 *(`open-data-sources`, απόδοση CC BY)* · ADR-860 §Ε1 *(carry-forward στο deploy)* · ADR-255 *(Φ10B.1: `sessions` χωρίς `companyId`)* · ADR-298 *(σουίτες κανόνων)* |
| **Αυθεντία** | ο κώδικας. Όπου αυτό το ADR διαφωνεί με τον κώδικα, κερδίζει ο κώδικας |

---

## 1. Το εύρημα (μετρημένο στον κώδικα, 2026-09-29)

Τέσσερα ελαττώματα στο ίδιο μονοπάτι, όχι ένα:

| # | Πού | Τι |
|---|---|---|
| Ε1 | `session-device-detection.ts` `getApproximateLocation()` | `fetch('https://ipapi.co/json/')` **από τον browser** ⇒ η IP του χρήστη σε τρίτο. Οι όροι του ipapi.co **απαγορεύουν** αποθήκευση πάνω από 24 ώρες· εμείς αποθηκεύαμε μόνιμα. Εφεδρεία με σκληρό `countryCode: 'GR'`, `countryName: 'Ελλάδα'`, `city: 'Unknown'` (N.11) |
| Ε2 | ίδιο αρχείο, `hashIP()` | SHA-256 **στον browser** με αλάτι γραμμένο στον κώδικα (`'enterprise-salt-2024'`) ⇒ δημόσιο αλάτι ⇒ αντιστρέψιμο με πίνακα των ~4 δισ. IPv4 |
| Ε3 | `EnterpriseSessionService.createSession` + κανόνας `allow read, write: if isOwner(userId)` | ο **client** έγραφε το έγγραφο ⇒ συσκευή και τοποθεσία στη «λίστα συσκευών» ήταν **πλαστογραφήσιμες** από οποιονδήποτε κρατούσε το token |
| Ε4 | `AuthContext.syncActiveSession` | το id ζούσε στο `sessionStorage` ⇒ **νέα συνεδρία (και νέο αίτημα ipapi) σε κάθε καρτέλα** — γι' αυτό φαινόταν σε κάθε φόρτωση. Και το `await` καθυστερούσε το `setLoading(false)` έως 3 s |

Επιπλέον, μετρημένα κατά την υλοποίηση: το `isCurrent` ήταν **αποθηκευμένη** αλήθεια «ανά θεατή» (με βρόχο `markOtherSessionsNotCurrent`)· η κατάσταση `expired` **δεν τη έγραφε κανείς**· και το manifest κάλυψης κανόνων έγραφε *«Nested sessions subcollection is covered by this parent block»* ενώ **κανένα** test δεν άγγιζε την υποσυλλογή (ίδιο σχήμα «0 = κανείς δεν κοίταξε»).

## 2. Έρευνα (2026-09-29)

| Ερώτημα | Πρακτική των μεγάλων | Πηγή |
|---|---|---|
| Επίπεδο | Πόλη + χώρα, «περίπου» (GitHub Sessions, Google «Your devices», Slack Access logs) | handoff §1 |
| Πού επιλύεται | Στον server, από την IP του αιτήματος | ό.π. |
| Βάση | Τοπική MMDB. MaxMind GeoLite2 (λογαριασμός + EULA + όροι αναδιανομής) · **DB-IP City Lite** (CC BY 4.0, μηνιαία, MMDB, αναδιανομή επιτρεπτή με απόδοση) · IPinfo Lite (μόνο χώρα) | db-ip.com/db/download/ip-to-city-lite |
| Ενημέρωση | MaxMind: `geoipupdate` σε χρονοπρογραμματισμό + επαναφόρτωση από την εφαρμογή (`watchForUpdates` του npm `maxmind`, `auto_reload` του nginx) | github.com/maxmind/geoipupdate · github.com/runk/node-maxmind |
| Λίστα | Google: συσκευές ενεργές τις τελευταίες **28 ημέρες** | support.google.com/accounts/answer/3067630 |
| Διατήρηση | Ορατότητα security log του GitHub ~**90 ημέρες** | ό.π. (έρευνα) |

Μετρημένο στη βάση (2026-09 edition): `.gz` **60,3 MB** → MMDB **127 MB**· `databaseType = DBIP-City-Lite`· γλώσσες `en de es fr ja pt-BR ru zh-CN fa ko` — **όχι ελληνικά**· `62.103.0.1 → GR/Marousi/Attica`, `2a02:587::1 → GR` (IPv6 ✓). Ο αναγνώστης φορτώνει όλο το αρχείο στη μνήμη: **~130 MB RSS** ανά διεργασία.

Άδειες (N.5, ελεγμένες πριν από το `pnpm add`): `maxmind` 5.0.7 **MIT** → `mmdb-lib` 3.0.3 **MIT**, `tiny-lru` **BSD-3-Clause**. Μόνο server ⇒ δεν φτάνει στον browser ⇒ **καμία** υποχρέωση CHECK 3.84 για τον κώδικα. Για τα **δεδομένα**: απόδοση CC BY + ο όρος του κυρίου *«link back to DB-IP.com on pages that display or use results»*.

## 3. Αποφάσεις

| Θέμα | Απόφαση |
|---|---|
| Βάση | **DB-IP City Lite** (όχι GeoLite2: λογαριασμός, EULA και όροι αναδιανομής που δεν ταιριάζουν σε βάση ψημένη σε δημόσια εικόνα) |
| Πού ζει | **Μέσα στην εικόνα**: το `docker-build.yml` τρέχει `pnpm run geoip:fetch` (cache ανά μήνα) και το `Dockerfile` την αντιγράφει στο `/app/data/geoip/`. Ίδια εικόνα ⇒ ίδια βάση ⇒ αναπαραγώγιμη απάντηση· κανένα δεύτερο σύστημα στο Netcup. **Όχι** cron που κάνει deploy (θα άλλαζε την παραγωγή χωρίς εντολή — N.(-1)) |
| Μετάβαση στο πρότυπο MaxMind | **Χωρίς αλλαγή κώδικα**: `GEOIP_DB_PATH` + `watchForUpdates` ⇒ τόμος + updater όποτε χρειαστεί |
| Βάση που λείπει | `database-unavailable` ⇒ «Άγνωστη τοποθεσία». **Ποτέ** σφάλμα σύνδεσης· στο CI `::warning::` και το deploy συνεχίζει |
| City ή Country | **City** (η απόφαση του Giorgio). Εφεδρεία μνήμης: `GEOIP_DB_PATH` σε Country Lite (~7 MB) ⇒ `precision: 'country'`, χωρίς αλλαγή κώδικα |
| Μονάδα | **Μία εγγραφή ανά browser** (Google «devices»): id στο `localStorage` (`STORAGE_KEYS.ACTIVE_SESSION_PREFIX` + uid)· **Web Locks** ώστε δύο καρτέλες που ανοίγουν μαζί να μη γεννούν δύο εγγραφές |
| Λήξη | **Κυλιόμενη**: κάθε άγγιγμα μεταθέτει `expiresAt` +24 h ⇒ browser σε καθημερινή χρήση = **μία** εγγραφή |
| Διατήρηση | Έγγραφο σβήνεται **90 ημέρες** μετά τη λήξη/ανάκληση — πολιτική TTL του Firestore στο `purgeAt` (`firestore.indexes.json` → `fieldOverrides`, collectionGroup `sessions`· το top-level `sessions` δεν έχει το πεδίο ⇒ ανεπηρέαστο) |

## 4. Αρχιτεκτονική — «εξυπνότερα από τους μεγάλους»

```
browser (AuthContext)                 server                                      Firestore
─────────────────────                 ──────                                      ─────────
syncActiveSession ─ Web Lock ─► POST /api/auth/active-sessions ─► session-server.service ─► users/{uid}/sessions/{id}
  { sessionId?, loginMethod,         withPersonalOrOrgAuth · SENSITIVE ·     (ΜΟΝΟΣ γραφέας, Admin SDK)   read: owner
    screen, language }               ιδεμποτία (σύνορο)                        │                            write: false
                                     UA  ← κεφαλίδα user-agent                 ├─ session-lifecycle (καθαρός πυρήνας)
                                     IP  ← clientIpOf (δεν αποθηκεύεται)        └─ ip-geolocation ─► data/geoip/*.mmdb
SessionsList ◄── getDocs (read) ─────────────────────────────────────────────────────────────── (κωδικοί → Intl.DisplayNames)
```

1. **Ο server είναι ο ΜΟΝΟΣ γραφέας ολόκληρου του εγγράφου** — κανόνας `allow read: if isOwner(userId); allow write: if false`. Δημιουργία, άγγιγμα, ανάκληση περνούν από διαδρομές. Η πλαστογράφηση είναι **δομικά αδύνατη**, όχι απλώς απαγορευμένη.
2. **Προέλευση σε κάθε απάντηση**: `location.source = { database, edition }` από τα **μεταδεδομένα του ίδιου του MMDB** (`databaseType`, `buildEpoch`) — καμία δεύτερη αλήθεια δίπλα στο αρχείο.
3. **Έντιμη ακρίβεια**: `precision: 'city' | 'country' | 'none'` + `basis` (`geoip` · `no-match` · `non-public-address` · `no-address` · `database-unavailable` · `legacy`). Ιδιωτικές/δεσμευμένες διευθύνσεις (localhost, 10/8, CGNAT, ULA, NAT64, IPv4-mapped) κρίνονται από το **υπάρχον** `isPublicAddress` (ADR-738) ⇒ `none`, ποτέ λάθος πόλη· και η βάση **δεν ανοίγει καν** γι' αυτές.
4. **Κωδικοί, όχι ονόματα**: `countryCode` ISO-3166· το όνομα αποδίδεται με `getDisplayNames().region` (`intl-formatting.ts`) ⇒ «Ελλάδα» / «Greece» από την **ίδια** εγγραφή.
5. **Τελευταία θέση** (`lastLocation`): όταν αλλάξει το αποτύπωμα IP μετά τη σύνδεση, ο server ξαναλύνει — **μόνο τότε** (όχι σε κάθε άγγιγμα). Η θέση σύνδεσης μένει. Ένας κλεμμένος υπολογιστής που συνεχίζει από άλλη χώρα **φαίνεται** (το GitHub δείχνει μόνο την πρώτη).
6. **Το «τρέχουσα συσκευή» δεν αποθηκεύεται**: υπολογίζεται στην απόδοση (`id === getCurrentSessionId(uid)`). Ο βρόχος `markOtherSessionsNotCurrent` διαγράφηκε.
7. **Functional core, imperative shell**: ό,τι **κρίνει** (ζει; άλλαξε δίκτυο; ποιες λήγουν/ανακαλούνται στο όριο;) ζει στο `session-lifecycle.ts`, καθαρό και κοινό με τον client (`isSessionLive` αναθέτει εκεί — **ένας** κριτής «ζει;»).
8. **Το `expired` έγινε πραγματική κατάσταση**: πριν από κάθε γέννηση, οι `active`-αλλά-ληγμένες σημαίνονται `expired` με `purgeAt`, στην ίδια συναλλαγή με το όριο `MAX_CONCURRENT_SESSIONS` (ανακαλούνται οι **παλαιότερες**).
9. **Αποσύνδεση = ανάκληση της εγγραφής** (`reason: 'logout'`) **πριν** χαθεί το token· δεν ρίχνει ποτέ, και **δεν** στέλνει `SESSION_DELETED` για τον εαυτό της (θα ξαναπυροδοτούσε το signOut).
10. Ο συγχρονισμός είναι **παράπλευρη ενέργεια** (N.7.2 #6): δεν καθυστερεί πια την οθόνη· το id δένεται σε state και από εκεί η συνδρομή ανάκλησης.

## 5. GDPR

- Η IP είναι προσωπικό δεδομένο (ΔΕΕ C-582/14, Breyer). **Ποτέ** ωμή IP σε Firestore ή logs — μόνο `clientIpFingerprint` (μυστικό αλάτι `RATE_LIMIT_IP_SALT`, ADR-876 §5). Άγκυρα Π1: `JSON.stringify(doc)` **δεν** περιέχει την IP.
- Η IP **δεν φεύγει σε τρίτο** — η αναζήτηση είναι τοπική.
- Ελαχιστοποίηση: πόλη το πολύ· κράτηση 90 ημέρες μετά το τέλος (TTL).
- Παλιές εγγραφές (τοποθεσία από ipapi, αποθηκευμένη παρά τους όρους του) διαβάζονται ως `basis: 'legacy'` και **δεν εμφανίζονται** ως γνώση.

## 6. Δηλωμένα όρια (ανοιχτά, όχι σιωπηλά)

| # | Όριο | Γιατί / επόμενο βήμα |
|---|---|---|
| Ο1 | ~~Η ανάκληση κλείνει την εγγραφή, όχι το token.~~ | ✅ **Έκλεισε — §10.1**: λίστα ανακλημένων `auth_time` στη σφραγίδα του συνόρου + άμεση αποσύνδεση της συσκευής· «όλων των άλλων» = `revokeRefreshTokens` + κλειδί για αυτή τη συσκευή. Υπόλοιπο: Φ2-Ο1 (§10.5) |
| Ο2 | Ονόματα πόλεων στα αγγλικά (η Lite δεν έχει ελληνικά) | Αποδεκτό (η εμπορική DB-IP/GeoIP2 έχει περισσότερες γλώσσες) |
| Ο3 | Παλιές εγγραφές **χωρίς** `purgeAt` δεν σβήνονται από το TTL | ✅ **Κώδικας έτοιμος — §10.4** (μετρημένες 9.095 σε έναν λογαριασμό): καθαρισμός τοποθεσίας + `purgeAt` ⇒ TTL. ⏳ Εκτέλεση μόνο με εντολή Giorgio μετά το dry-run |
| Ο4 | ~~Μόνο ζωντανές· καμία ειδοποίηση νέας σύνδεσης~~ | ✅ **Έκλεισε — §10.2** («Συνεδρίες που τελείωσαν», 28 ημέρες) **+ §10.3** (`security.newDeviceLogin`, υποχρεωτικό) |
| Ο5 | Εμπιστοσύνη στο `x-forwarded-for`: το `clientIpOf` παίρνει το **πρώτο** στοιχείο | ⏳ επαλήθευση ζωντανά ότι ο proxy του Coolify το **αντικαθιστά** (§9) |
| Ο6 | ~130 MB RAM ανά διεργασία | Εφεδρεία Country Lite μέσω `GEOIP_DB_PATH` |

## 7. Αρχεία

| Αρχείο | Ρόλος |
|---|---|
| `src/lib/geo/ip-place.types.ts` | **Νέο** — το σχήμα της απάντησης (κοινό server/client) |
| `src/lib/geo/ip-geolocation.ts` | **Νέο** — ο αναγνώστης (lazy singleton, `watchForUpdates`, backoff 10′ όταν λείπει η βάση) |
| `src/lib/geo/ip-geolocation-paths.ts` | **Νέο** — η διαδρομή, φύλλο χωρίς εισαγωγές (γραφέας + αναγνώστης) |
| `src/services/session/session-server.service.ts` | **Νέο** — ο ΜΟΝΟΣ γραφέας (Admin SDK) |
| `src/services/session/session-lifecycle.ts` | **Νέο** — ο καθαρός πυρήνας αποφάσεων |
| `src/app/api/auth/active-sessions/route.ts` · `[sessionId]/route.ts` | **Νέα** — `POST` συγχρονισμός · `DELETE ?keep=` · `DELETE ?reason=` |
| `scripts/fetch-geoip-db.ts` (`pnpm run geoip:fetch`) | **Νέο** — λήψη (μέσω `cached-download`), αποσυμπίεση, **απόδειξη** πριν τη μετονομασία |
| `src/components/account/session-location-label.ts` | **Νέο** — κωδικοί → κείμενο στη γλώσσα του αναγνώστη |
| `session-device-detection.ts` | −ipapi, −`hashIP`· ανίχνευση από UA στον server + `getClientDeviceHints` |
| `EnterpriseSessionService.ts` | Μόνο αναγνώσεις + κλήσεις διαδρομών· Web Lock + `localStorage` |
| `session.types.ts` · `session-helpers.ts` · `index.ts` | Νέο σχήμα· ανεκτική ανάγνωση (`legacy`)· `formatRelativeTime` αντί για σκληρά ελληνικά |
| `AuthContext.tsx` · `useAuthActions.ts` | Συγχρονισμός χωρίς μπλοκάρισμα · ανάκληση στην αποσύνδεση |
| `SessionsList.tsx` | `Intl.DisplayNames` · «Άγνωστη τοποθεσία» · σημείωση «κατά προσέγγιση» · απόδοση DB-IP · i18n των σκληρών εφεδρειών (Boy Scout) · σπάσιμο σε ≤40 γραμμές ανά συνάρτηση |
| `open-data-sources.ts` · `OpenDataAttribution.tsx` | Το **ένα** μητρώο πηγών δέχεται πηγή εκτός αγοράς (`textNamespace`)· νέα πηγή `ipGeolocation` |
| `firestore.rules` · `firestore.indexes.json` | `write: false` · TTL `purgeAt` |
| `domain-constants.ts` (`API_ROUTES.AUTH.ACTIVE_SESSIONS/ACTIVE_SESSION`) · `safe-storage.ts` (`ACTIVE_SESSION_PREFIX`) | Μητρώα |
| `docker-build.yml` · `Dockerfile` · `.gitignore` (`/data/geoip/`, αγκυρωμένο) · `package.json` | Βάση στην εικόνα |
| `common-account.json` el+en | 6 κλειδιά `account.security.*` + `source.ipGeolocation.*` |
| `docs/legal/data-licenses/README.md` | Η άδεια DB-IP |
| `personal-scope-consumers.test.ts` | Οι 2 νέες πόρτες στο κλειστό σύνολο, με λόγο |

## 8. Άγκυρες και μεταλλάξεις

| Σουίτα | Tests | Μεταλλάξεις (κόκκινες) |
|---|---|---|
| `lib/geo/__tests__/ip-geolocation.test.ts` | 16 | αφαίρεση του ελέγχου ιδιωτικής IP ⇒ **6** κόκκινα · αφαίρεση του backoff ⇒ **1** |
| `services/session/__tests__/session-lifecycle.test.ts` · `session-helpers.test.ts` · `components/account/__tests__/session-location-label.test.ts` | 23 | M5 «παλιά εγγραφή διαβάζεται ως γνώση» ⇒ **1** κόκκινο |
| `app/api/auth/active-sessions/__tests__/active-sessions-route.test.ts` — ο **πραγματικός** γραφέας πάνω σε `FakeFirestore` | 14 (Π1–Π6 · Δ1–Δ3 · Α1–Α2) | M1 ωμή IP αντί αποτυπώματος · M2 νέα επίλυση σε κάθε άγγιγμα · M3 το όριο ανακαλεί τις **νεότερες** · M4 χωρίς `.strict()` ⇒ **1** κόκκινο η καθεμία |
| `tests/firestore-rules/suites/users.rules.test.ts` Σ1–Σ5 (emulator) | 5 | επαναφορά `write: if isOwner` ⇒ **Σ3, Σ4, Σ5** κόκκινα |

## 9. Ζωντανός έλεγχος (μετά το push του Giorgio)

1. Σελίδα έργων: **0** αιτήματα σε `ipapi.co`.
2. `Λογαριασμός → Ασφάλεια`: σωστή πόλη· δεύτερη καρτέλα ⇒ **καμία** νέα εγγραφή.
3. `x-forwarded-for`: η τοποθεσία είναι του **πελάτη**, όχι του proxy/του Netcup (Ο5).
4. `firebase deploy` κανόνων + TTL (CHECK 3.86 — commit ≠ deploy).
5. Log εκκίνησης: `GeoIP database opened { database: 'DBIP-City-Lite', edition: … }`.
6. **Φάση 2 — Β1**: συσκευή Β ανακαλείται από την Α ⇒ η Β αποσυνδέεται **αμέσως** και κάθε αίτημα API της δίνει 401· «όλων των άλλων» ⇒ η Α **μένει** συνδεδεμένη (νέο κλειδί).
7. **Β2**: η ενότητα «Συνεδρίες που τελείωσαν» δείχνει τη Β με λόγο «Αποσυνδέθηκε από άλλη συσκευή».
8. **Β3**: σύνδεση από άλλη χώρα (VPN) ⇒ κουδούνι + email «Νέα σύνδεση στον λογαριασμό σας».
9. **Β4**: `GET /api/admin/migrations/scrub-legacy-session-locations` (dry-run) ⇒ αριθμοί στον Giorgio· `POST` **μόνο** με εντολή του.

## 10. Φάση 2 — ενεργές συνεδρίες (2026-09-29)

Απόφαση Giorgio: «όπως οι μεγάλοι (Google «Your devices» · GitHub Sessions · Slack), και εξυπνότερα όπου γίνεται»· Plan Mode + Opus. Τέσσερα βήματα, ασφάλεια πρώτα.

### 10.1 Β1 — η «Αποσύνδεση» κλείνει τη **συσκευή**, όχι μόνο την εγγραφή (κλείνει το Ο1)

**Το κενό, μετρημένο**: η Firebase ανακαλεί **ανά λογαριασμό** (`revokeRefreshTokens` ⇒ όλες οι συσκευές). Η ανάκληση μιας εγγραφής `sess_*` άφηνε ζωντανό το ID token (1 h), το cookie (24 h) και το refresh token (**επ' αόριστον**). Και η άλλη συσκευή **δεν μάθαινε τίποτα**: το `SESSION_DELETED` φτάνει μόνο σε καρτέλες του **ίδιου** browser.

**Η λύση — τρεις στρώσεις, πάνω σε ό,τι υπήρχε:**

| Στρώση | Τι | Πού |
|---|---|---|
| Ταυτότητα σύνδεσης | Το `auth_time` μένει **ίδιο σε κάθε ανανέωση** της ίδιας σύνδεσης (Firebase «Manage User Sessions»: διαφορετικό `iat`, ίδιο `auth_time`) ⇒ η ταυτότητα «αυτής της σύνδεσης αυτής της συσκευής». Ταξιδεύει στο `AuthContext.authTimeSec` και γράφεται στην εγγραφή ως `signIn.authTimeSec` (στη γέννηση· διορθώνεται στο άγγιγμα αν ο browser συνδέθηκε ξανά) | `lib/auth/types.ts` · `auth-context.ts` · `session-server.service.ts` |
| Άρνηση στο σύνορο (ασφάλεια) | Η ανάκληση (μία · λόγω ορίου · logout) γράφει το `auth_time` στο `users/{uid}/security/revoked_sign_ins` (κανόνας `read, write: if false` — αλλιώς η ανακλημένη συσκευή θα έσβηνε τον εαυτό της). Το **ήδη υπάρχον** `revocation-watermark` (ADR-892 §8.1) το διαβάζει **μαζί** με το `getUser`, στην **ίδια** μνήμη 30″ ⇒ **καμία** επιπλέον ανάγνωση ανά αίτημα· 1 ανά λογαριασμό ανά 30″, άμεσα στη διεργασία που ανακαλεί (`forgetRevocationState`). Ισχύει σε **κάθε** πόρτα: Bearer, cookie, σελίδες SSR | `lib/auth/revoked-sign-ins.ts` · `lib/auth/revocation-watermark.ts` · `services/session/session-sign-in-revocation.ts` |
| Άμεση αποσύνδεση (UX) | Ο browser ακούει τη **δική του** εγγραφή (`firestoreQueryService.subscribeSubcollection` + `documentId() ==`) και αποσυνδέεται μόλις γίνει `revoked`. Μόνο `revoked`: το `expired` (αδράνεια) δεν είναι ανάκληση, και απούσα εγγραφή (cache/TTL) δεν είναι απόδειξη | `EnterpriseSessionService.watchSessionRevocation` · `AuthContext.tsx` |

- **Φρουρός εαυτού**: το `auth_time` του **καλούντα** δεν μπαίνει ποτέ στη λίστα ως «άλλη συσκευή» — ένας browser που έχασε το `localStorage` έχει δύο εγγραφές με την **ίδια** σύνδεση, και η «αποσύνδεση» του φαντάσματος θα τον έβγαζε. Εξαίρεση ρητή: `logout` (η σύνδεση **είναι** του καλούντα — αντίγραφο του cookie δεν επιβιώνει της αποσύνδεσης).
- **Κλάδεμα + όριο**: ό,τι καλύπτει ήδη το `tokensValidAfterTime` σβήνει· πάνω από 100 καταχωρίσεις ⇒ **κλιμάκωση** σε ανάκληση όλων, ποτέ σιωπηλή απώλεια.
- **«Αποσύνδεση όλων των άλλων» = πλήρες κλείσιμο**: `revokeRefreshTokens` (κόβει **και** την απευθείας πρόσβαση του client στη Firestore μέσα σε ≤ 1 h) + κλειδί νέας συνεδρίας για **αυτή** τη συσκευή (**μόνο από Bearer**). Ο πυρήνας του `continueSessionAfterExit` (ADR-892 §13) εξήχθη σε `server/auth/session-reissue.ts` — δεύτερος καλών (N.0.2)· ο client υιοθετεί με το **ένα** `adoptIssuedSession`. Χωρίς κλειδί ⇒ `signInRequired` ⇒ η οθόνη αποσυνδέει με λόγο, η πράξη **έγινε**.
- **«Εξυπνότερα»**: το GitHub/Google κάνουν ανάκληση ανά συνεδρία επειδή κατέχουν τον server συνεδριών· η Firebase **δεν** δίνει ανά συσκευή. Εδώ κερδίζεται χωρίς δεύτερο μηχανισμό συνεδρίας και χωρίς ανάγνωση ανά αίτημα, πάνω στη σφραγίδα που ήδη υπήρχε.

### 10.2 Β2 — «Συνεδρίες που τελείωσαν» (κλείνει το Ο4α)

- **Ένα** ερώτημα `timestamps.lastActiveAt ≥ −28 ημέρες` + `orderBy` στο **ίδιο** πεδίο (αυτόματος μονοπεδικός δείκτης) ⇒ ζωντανές **και** τελειωμένες (`getSessionsOverview`). Ζωντανή εγγραφή με `lastActiveAt` πριν από 28 ημέρες δεν υπάρχει (λήξη κυλιόμενη 24 h) ⇒ τίποτα δεν χάνεται.
- Καθαρός διαχωρισμός `partitionSessionsOverview` + `endReasonOf` (`session-lifecycle.ts`): αποσυνδέθηκε · από άλλη συσκευή · όριο συσκευών · αδράνεια. Η τελειωμένη «`active`» τελείωσε τη στιγμή της λήξης, ποτέ στο μέλλον.
- Οθόνη: `EndedSessionsSection.tsx` (`<details>`, κλειστό από προεπιλογή, χωρίς κουμπί ενέργειας). Η γραμμή συσκευής εξήχθη σε `session-device-summary.tsx` — **ίδια** εμφάνιση στις δύο ενότητες.
- Οι διάλογοι ανάκλησης **λένε πλέον την αλήθεια**: «αποσυνδέεται αμέσως» (πριν: «ο χρήστης θα χρειαστεί να συνδεθεί ξανά», που δεν ίσχυε).

### 10.3 Β3 — «Νέα σύνδεση από νέα χώρα / νέα συσκευή» (κλείνει το Ο4β)

- **Κανένα νέο κανάλι**: το συμβάν `security.newDeviceLogin` ήταν **ήδη δηλωμένο** (`notification-events.ts`, `isMandatory: true`, γραμμή στις ρυθμίσεις) — αλλά **κανείς δεν το έστελνε** («activation > creation»). Υποχρεωτικό ⇒ κουδούνι πάντα + email **αμέσως** (`decideEmailDelivery`) — η πρακτική Google/GitHub για κρίσιμες ειδοποιήσεις ασφαλείας.
- Κριτής `sign-in-novelty.ts` (καθαρός): **γνωστή** χώρα (`precision ≠ none`) που δεν εμφανίστηκε στις εγγραφές 90 ημερών (θέση σύνδεσης **ή** τελευταία) · ή οικογένεια browser+OS που δεν εμφανίστηκε (όχι έκδοση). Πρώτη εγγραφή του λογαριασμού ⇒ τίποτα. Φυσικό debounce: η νέα εγγραφή γίνεται η ίδια ιστορικό.
- Αποστολέας `new-sign-in-notifier.ts`: προσωπικός χώρος, `eventId = new-sign-in:{uid}:{sessionId}` (ιδεμποτικό), κείμενο από το locale (`common-shared` → `newSignIn.*`), θέση γλωσσικά ουδέτερη («Thessaloniki, GR»), **ποτέ** IP. Καλείται μετά τη γέννηση στο `createSession`· δεν ρίχνει ποτέ.
- ⚠️ VPN ⇒ ψευδής «νέα χώρα»: αποδεκτό, όπως στους μεγάλους — το κείμενο λέει «αν ήσασταν εσείς, τίποτα».

### 10.4 Β4 — εφάπαξ καθαρισμός της εποχής ipapi (κλείνει το Ο3)

**Μετρημένο 2026-09-29** (Firestore MCP, μόνο ανάγνωση), λογαριασμός `WKBW…`: **9.095** εγγραφές — **9.023** `revoked` (σχεδόν όλες `auto_revoked_max_sessions`: το σφάλμα Ε4 «νέα εγγραφή ανά καρτέλα» + το όριο των 10), **10** «`active`», οι υπόλοιπες `expired`· **1** μόνο με `precision`. Όλες κρατούν `location.{ipHash, countryName, city, region, timezone}` του ipapi και **καμία** `purgeAt` ⇒ δεν θα σβήνονταν ποτέ. (Οι άλλοι 12 λογαριασμοί δεν μετρήθηκαν ένας-ένας· το dry-run τους μετρά όλους.)

- Σχεδιαστής `legacy-session-scrub.ts` (καθαρός): η τοποθεσία ipapi φεύγει (`LEGACY_LOCATION`, το ίδιο σχήμα που ήδη δείχνει η οθόνη) · `purgeAt` = τέλος + 90 ημέρες (η **ίδια** πολιτική με τις νέες — όσες είναι ήδη πέρα, `purgeAt` = τώρα) · ληγμένη «`active`» ⇒ `expired` · το `isCurrent` φεύγει. Εγγραφή με `precision` ⇒ `skip` (ιδεμποτία).
- Διαδρομή `api/admin/migrations/scrub-legacy-session-locations` (`createMigrationRoute`: GET = dry-run, POST = εκτέλεση + audit)· σάρωση **ανά χρήστη**, όχι `collectionGroup` (θα έπιανε και το top-level `sessions`, ADR-255).
- **Γιατί όχι μαζικό σβήσιμο με κώδικα**: ελαχιστοποίηση **τώρα** + σβήσιμο από τον **έναν** μηχανισμό διατήρησης (TTL). Προϋπόθεση: `firebase deploy` του `firestore.indexes.json` (CHECK 3.86).
- ⏳ **Εκτέλεση μόνο με εντολή Giorgio**, μετά το dry-run (GET) στην παραγωγή.

### 10.5 Δηλωμένα όρια της Φάσης 2

| # | Όριο | Γιατί |
|---|---|---|
| Φ2-Ο1 | Η απευθείας ανάγνωση Firestore/Storage από **κακόβουλο** client μιας **μεμονωμένα** ανακλημένης συσκευής δεν κόβεται μέχρι να λήξει το refresh token | Θα απαιτούσε `get()` της λίστας σε **κάθε** κανόνα. Ο τίμιος client αποσυνδέεται αμέσως (στρώση 3)· κάθε API/SSR αρνείται (στρώση 2)· το «όλων των άλλων» κλείνει και αυτό (≤ 1 h) |
| Φ2-Ο2 | Εγγραφές πριν τη Φάση 2 δεν έχουν `signIn` ⇒ η «αποσύνδεσή» τους κλείνει μόνο την εγγραφή | Μαθαίνουν τη σύνδεσή τους στο επόμενο άγγιγμα· για όσες δεν αγγιχτούν, το «όλων των άλλων» τις κλείνει πλήρως |
| Φ2-Ο3 | Δύο συσκευές που συνδέθηκαν στο **ίδιο δευτερόλεπτο** μοιράζονται `auth_time` | Η ανάκληση της μίας κλείνει και την άλλη — προς την ασφαλή πλευρά |
| Φ2-Ο4 | Η εφεδρεία κειμένου της ειδοποίησης (και το email) είναι ελληνική για κάθε παραλήπτη | Όριο του αγωγού (ίδιο με `announceMemberExit`), όχι αυτού του ADR |

### 10.6 Άγκυρες και μεταλλάξεις (Φάση 2)

| Σουίτα | Νέα tests | Μεταλλάξεις (κόκκινες) |
|---|---|---|
| `lib/auth/__tests__/revoked-sign-ins.test.ts` (Firestore ψεύτικη) | Λ1–Λ5 · Ε1–Ε2 | φρουρός εαυτού ⇒ **Λ2** · σιωπηλή εγγραφή πάνω από το όριο ⇒ **Λ4** |
| `lib/auth/__tests__/revocation-watermark.test.ts` | Α1–Α4 | η σφραγίδα αγνοεί τη λίστα ⇒ **Α1, Α2** |
| `app/api/auth/active-sessions/__tests__/active-sessions-route.test.ts` (ο **πραγματικός** γραφέας) | Π7–Π8 · Δ4–Δ6 · Α3–Α4 · Ν1–Ν3 | ανάκληση χωρίς λίστα ⇒ **Δ4** (+Π7) · «όλων» χωρίς `revokeRefreshTokens` ⇒ **Α3** · καμία αποστολή ⇒ **Ν2** · ειδοποίηση στην πρώτη ⇒ **Ν1** |
| `services/session/__tests__/session-phase2-core.test.ts` | Ο1–Ο3 · Ν1–Ν4 · Κ1–Κ4 | άγνωστη θέση ως νέα χώρα ⇒ **Ν3** · καθαρισμός του νέου σχήματος ⇒ **Κ2** · χωρίς ταξινόμηση ⇒ **Ο2** |
| `tests/firestore-rules/suites/users.rules.test.ts` (emulator) | Σ6 | — (Σ1–Σ6 πράσινα) |

**10/10 μεταλλάξεις κόκκινες**, επαναφορά στην ίδια εκτέλεση. Boy Scout: το `FakeFirestore` (`services/places/__tests__/fake-firestore.ts`) **δεν** σύγκρινε `Timestamp` σε ερωτήματα εύρους (γύριζε σιωπηλά κενό — το σχήμα «0 = κανείς δεν κοίταξε») ⇒ πλέον ως ms, όπως το πραγματικό Firestore.

## Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-09-29 | Δημιουργία + υλοποίηση (§1–§8). Σχέδιο εγκεκριμένο από τον Giorgio (Plan Mode). Κλείνει το ADR-891 §10.4 **Θ1**. **Μετρημένα**: `geoip:fetch` τοπικά — 60,3 MB → 127 MB, `DBIP-City-Lite 2026-09`, `8.8.8.8 → US`. Ζωντανό ερώτημα (μόνο ανάγνωση) `status == active` + `orderBy(lastActiveAt desc)` σε `users/{uid}/sessions` **απαντά** ⇒ ο υπάρχων δείκτης το εξυπηρετεί (η 3.91 το σημειώνει «μη αναλύσιμο στατικά», όχι ακάλυπτο). Η ίδια ανάγνωση έδειξε μια εγγραφή του **νέου** σχήματος γραμμένη από τοπικό dev server (`basis: non-public-address` για localhost, αποτύπωμα, `purgeAt`, άγγιγμα) δίπλα σε παλιά εγγραφή της εποχής ipapi (`ipHash`, `countryName`) ⇒ `legacy`. Πύλες: 3.34 · 3.35 · 3.49 · 3.53 · 3.70 · 3.71 · 3.90 · 3.91 · 3.92 exit 0 · **3.28 (jscpd)**: έπιασε κλώνο φόρτωσης/σφάλματος στο `SessionsList` ⇒ ενοποίηση σε **μία** `SessionsStatusCard`, μετά καθαρό. ⚠️ Κλειστό σύνολο (`personal-scope-consumers.test.ts`): οι 2 νέες πόρτες δηλώθηκαν, αλλά η σουίτα βλέπει μόνο αρχεία του index (**δηλωμένο όριο** της κεφαλίδας της) ⇒ η Κ3 τις δείχνει «ορφανές» μέχρι το `git add`. Οι Κ2/Κ4/Π είναι κόκκινες **ανεξάρτητα** από αυτό το ADR (αδήλωτες διαδρομές άλλων εργασιών· παρονομαστής 28 έναντι 43) |
| 2026-09-29 | **Φάση 2 (§10).** Plan Mode εγκεκριμένο από τον Giorgio («όπως οι μεγάλοι, και εξυπνότερα»). **Β1** (κλείνει Ο1): `auth_time` = ταυτότητα σύνδεσης (`AuthContext.authTimeSec` → `signIn.authTimeSec`)· λίστα `users/{uid}/security/revoked_sign_ins` (`lib/auth/revoked-sign-ins.ts`, κανόνας κλειστός, Σ6) που διαβάζει η **υπάρχουσα** σφραγίδα του ADR-892 στην ίδια μνήμη 30″ (καμία ανάγνωση ανά αίτημα)· φρουρός εαυτού· κλιμάκωση πάνω από 100· «όλων των άλλων» = `revokeRefreshTokens` + `reissueCallerSession` (εξαγωγή από `member-exit-session`)· ο browser ακούει τη δική του εγγραφή (`watchSessionRevocation`, μέσω `firestoreQueryService`). **Β2** (Ο4α): ένα ερώτημα 28 ημερών, `partitionSessionsOverview`/`endReasonOf`, `EndedSessionsSection` + `session-device-summary` (εξαγωγή), διάλογοι που λένε την αλήθεια. **Β3** (Ο4β): ενεργοποίηση του ήδη δηλωμένου `security.newDeviceLogin` (`sign-in-novelty.ts` + `new-sign-in-notifier.ts`). **Β4** (Ο3): μετρήθηκαν 9.095 παλιές εγγραφές σε έναν λογαριασμό, καμία με `purgeAt`· `legacy-session-scrub.ts` + διαδρομή μετάβασης (dry-run πρώτα). **Μετρημένα**: 10/10 μεταλλάξεις κόκκινες· Σ1–Σ6 πράσινα στον emulator· πύλες 3.28 (jscpd, 18 αρχεία) · 3.33 · 3.34 · 3.78 · 3.80 καθαρές. Boy Scout: `FakeFirestore` συγκρίνει `Timestamp` σε εύρος. ⚠️ Προϋπάρχουσες κόκκινες, **όχι** δικές μας: `personal-scope-consumers` (Κ3 μέχρι το `git add` + Κ2/Κ4/Π άλλων εργασιών) · `project-team-birth-anchor` (2 tests, ίδια αποτυχία χωρίς τις αλλαγές μας) |
