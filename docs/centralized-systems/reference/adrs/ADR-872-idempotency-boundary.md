# ADR-872 — Το σύνορο ιδεμποτίας: **μία εκτέλεση ανά πράξη**, όσες φορές κι αν φτάσει

| Πεδίο | Τιμή |
|---|---|
| **Category** | Security & Auth |
| **Status** | ACCEPTED — **ΥΛΟΠΟΙΗΜΕΝΟ** (2026-09-22, όχι ακόμη committed) |
| **Date** | 2026-09-22 |
| **Προηγούμενα** | ADR-853 §13 *(το εύρημα: 3×503 ⇒ τρεις αποστολές)* · ADR-826 §8α *(Φάση 1: μόνο `GET` αυτόματα)* · ADR-868 *(CHECK 3.90, το ένα σύνορο)* · ADR-817 *(`withPersonalOrOrgAuth`)* |
| **Πύλη** | CHECK 3.92 — `docs/gates/3.92.md` |
| **Αυθεντία** | ο κώδικας. Όπου αυτό το ADR διαφωνεί με τον κώδικα, κερδίζει ο κώδικας |

---

## 1. Το πρόβλημα

Ο `apiClient` ξανάστελνε **κάθε** μέθοδο έως 3 φορές σε σφάλμα δικτύου/`5xx`. Όμως σφάλμα δικτύου ή `504` **δεν**
σημαίνει «δεν εκτελέστηκε»: ο handler μπορεί να έγραψε, και να χάθηκε μόνο η απάντηση. Μετρημένα:
- **193** κλήσεις `apiClient.post/put/patch/delete`.
- **Κανένα** `Idempotency-Key` στο καλώδιο.
- Ζωντανά (ADR-853 §13): 3×503 ⇒ **τρεις** αποστολές της ίδιας πράξης πρόσκλησης.
- Το ίδιο σφάλμα υπάρχει καταγεγραμμένο στο εργαλείο της ίδιας της Stripe ([stripe/link-cli #294](https://github.com/stripe/link-cli/issues/294)).

Η **Φάση 1** (ADR-826 §8α) σταμάτησε την αιμορραγία: αυτόματα ξαναστέλνεται μόνο το `GET`. Το τίμημα ήταν ότι ένα
παροδικό σφάλμα σε πράξη έφτανε στον άνθρωπο. Αυτό το ADR επαναφέρει την ανθεκτικότητα **με ασφάλεια**.

## 2. Τι κάνουν οι μεγάλοι

| Πηγή | Πρακτική |
|---|---|
| **Stripe** ([idempotent requests](https://docs.stripe.com/api/idempotent_requests)) | *«All POST requests accept idempotency keys»* · αποθηκεύει status + σώμα της πρώτης εκτέλεσης *«including 500 errors»* · 24 ώρες · σύγκριση παραμέτρων · δεν αποθηκεύει όταν η εκτέλεση δεν ξεκίνησε |
| **IETF** [draft-ietf-httpapi-idempotency-key-header-07](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07) | ίδιο κλειδί + αποτύπωμα ⇒ αποθηκευμένο αποτέλεσμα · όσο τρέχει ⇒ `409` · ίδιο κλειδί, άλλο περιεχόμενο ⇒ σφάλμα |
| **Brandur** ([Stripe-like idempotency keys](https://brandur.org/idempotency-keys)) | `locked_at` + lock timeout · μετά το timeout το κλείδωμα **ξαναδίνεται** |
| **Google** [AIP-194](https://google.aip.dev/194) | αυτόματη επανάληψη **μόνο** όπου δεν αλλάζει κατάσταση |

## 3. Οι αποφάσεις

1. **Εξ ορισμού, στο σύνορο, όχι ανά route** (Stripe). Το στρώμα `runIdempotently` καλείται από τα **δύο** ριζικά
   σύνορα: `withAuth`, και στους **δύο** κλάδους του (ανώνυμος + αυθεντικοποιημένος), και `withPersonalOrOrgAuth`.
   Όλα τα routes πίσω τους προστατεύονται χωρίς να το ζητήσουν. **Κανένα** από τα 338 αρχεία routes δεν μεταφέρθηκε.
2. **Ο πελάτης γεννά ΕΝΑ κλειδί ανά κλήση, ΠΡΙΝ τον βρόχο** (`keyedHeaders`), για κάθε μη-`GET` με σώμα JSON ή χωρίς
   σώμα. `FormData`/`Blob` **όχι**: δεν ορίζεται αποτύπωμα πάνω σε ροή. Κλειδί που έδωσε ήδη ο καλών μένει.
3. **Ο ένας κριτής** του «ξαναστέλνεται;» είναι ο `shouldRetry`: `GET` ή «έφυγε με κλειδί», και `409 IN_FLIGHT` με το
   **ίδιο** κλειδί, σεβόμενος το `Retry-After`.
4. **Αποθήκη: Firestore** `idempotency_records`, μόνο μέσω Admin SDK (κανόνας χωρίς καμία πρόσβαση πελάτη), TTL 24 ωρών
   στο `expiresAt`. Το Upstash απορρίφθηκε γιατί δεν είναι ρυθμισμένο τοπικά και δεν επαληθεύεται στο Netcup.
5. **ID εγγράφου ντετερμινιστικό** από (εντολέας, μέθοδος, διαδρομή, κλειδί): η σύγκρουση στο **ίδιο** έγγραφο
   **είναι** το κλείδωμα. Το κλειδί ενός ανθρώπου δεν «πιάνει» ποτέ απάντηση άλλου (`anon` για δημόσιες διαδρομές).
6. **Αποτύπωμα** = sha256 των μεθόδου, διαδρομής, query και σώματος (`sha256HexOfText`, το υπάρχον SSoT).
7. **Η έκβαση της πρώτης εκτέλεσης**:

| Ο handler… | Το κλειδί… | Γιατί |
|---|---|---|
| επέστρεψε οτιδήποτε εκτός `503` | αποθηκεύεται με την απάντηση | Stripe |
| **επέστρεψε** `503` | **απελευθερώνεται** | συμβόλαιο «τίποτα δεν άλλαξε, ξαναδοκίμασε» (π.χ. `mailbox-proof-unknown`) |
| **πέταξε** (500 από τον κεντρικό χειριστή, ακόμη και 503) | αποθηκεύεται | μπορεί να είχε ήδη γράψει |

8. 🏆 **Πέρα από τον Brandur — κλείδωμα που έμεινε ⇒ `409 IDEMPOTENCY_OUTCOME_UNKNOWN`**. Μετά το lease (120s, διπλάσιο
   της προθεσμίας του πελάτη) εκείνος **ξαναδίνει** το κλείδωμα, δηλαδή ξαναεκτελεί μια πράξη που μπορεί να είχε ήδη
   γράψει. Εμείς **ποτέ**: η έκβαση λέγεται άγνωστη και την κρίνει άνθρωπος.
9. **Η λήξη κρίνεται από έναν αριθμό** (`lockedAtMs + TTL`), όχι από το `expiresAt`. Εκείνο είναι Timestamp στην
   παραγωγή και άλλος τύπος σε κάθε αντίγραφο· **μετρημένο**: ο πλαστός επέστρεφε κείμενο μέσα στη συναλλαγή, και κάθε
   εγγραφή φαινόταν ληγμένη.
10. **Μία εξαίρεση ανά route**: `idempotency: { mode: 'natural', why }`, για ό,τι είναι ιδεμποτικό **εκ κατασκευής** και
    συχνό. Εφαρμόστηκε σε: `network/threads/[id]/read` (τρέχει σε κάθε άνοιγμα νήματος), `mute`, `follow` (`set` boolean).
11. **Μία κλήση handler για όλα τα σύνορα** (`lib/auth/handler-execution.ts`): εξήχθη από το `withAuth` όταν τη χρειάστηκε
    και το δεύτερο σύνορο. ⚠️ **Αλλαγή συμπεριφοράς, σκόπιμη**: ο ανώνυμος κλάδος του `withAuth` και το
    `withPersonalOrOrgAuth` περνούν πλέον από τον **κεντρικό** χειρισμό σφαλμάτων (JSON), αντί να αφήνουν την εξαίρεση
    στη Next.js.

### Οι απαντήσεις του ίδιου του συνόρου

| Κωδικός | HTTP | Ξαναστέλνεται; |
|---|---|---|
| `IDEMPOTENCY_IN_FLIGHT` | 409 + `Retry-After` | ✅ ίδιο κλειδί |
| `IDEMPOTENCY_STORE_UNAVAILABLE` | 503 | ✅ τίποτα δεν εκτελέστηκε |
| `IDEMPOTENCY_KEY_REUSED` | 422 | ❌ |
| `IDEMPOTENCY_KEY_INVALID` | 400 | ❌ |
| `IDEMPOTENCY_OUTCOME_UNKNOWN` | 409 | ❌ |
| `IDEMPOTENCY_REPLAY_UNAVAILABLE` | 409 | ❌ έγινε, η απάντηση δεν αναπαράγεται (μη-JSON ή > 256 KiB) |

Η αναπαραγωγή φέρει `Idempotent-Replayed: true` (όνομα της Stripe).

## 4. Κώδικας

| Αρχείο | Ρόλος |
|---|---|
| `src/lib/api/idempotency/idempotency-contract.ts` | **ΜΙΑ** πηγή πελάτη + server: κεφαλίδες, κωδικοί, lease, TTL, `NaturalIdempotency` |
| `src/lib/api/idempotency/idempotency-store.ts` | ο **μόνος** γραφέας της `idempotency_records` |
| `src/lib/api/idempotency/with-idempotency.ts` | το στρώμα `runIdempotently` |
| `src/lib/auth/handler-execution.ts` | η μία κλήση handler (κεντρικά σφάλματα + μέτρηση χρόνου + `thrown`) |
| `src/lib/auth/middleware.ts` · `personal-scope-middleware.ts` | οι δύο ρίζες |
| `src/lib/api/api-client-transport.ts` | `keyedHeaders` · `isKeyedRequest` · `isReplayableRequest` · `retryDelay` |
| `src/lib/http/retry-after.ts` | 🧹 N.0.2: η ανάγνωση `Retry-After`, εξαγμένη από τον `overpass-client` |
| `src/services/enterprise-id-*` | πρόθεμα `idk` / `idr` · `generateIdempotencyKey` · `generateDeterministicIdempotencyRecordId` |
| `firestore.rules` · `firestore.indexes.json` | άρνηση πελάτη · TTL `expiresAt` |

## 5. Όσα μένουν εκτός συνόρου (CHECK 3.92 Κ3, baseline 38)

Webhooks (Mailgun, Telegram), cron, OAuth `authorize`/`token`, MCP, δημόσιοι σύνδεσμοι με token, `auth/*`, και routes με
έλεγχο ταυτότητας **μέσα** στον handler (`showcase/email`, `*-impact-preview`). Τα server-to-server δεν τα καλεί ο
`apiClient`. Όσα κάνουν έλεγχο ταυτότητας μέσα στον handler είναι ιστορικό χρέος: το ratchet επιτρέπει μόνο να μειωθούν.

## 6. Δηλωμένα όρια

- **Κόστος**: +1 συναλλαγή +1 γραφή ανά πράξη με κλειδί (~50–100ms). Το `natural` το μηδενίζει στα συχνά.
- **Δεύτερος βρόχος επανάληψης** (hook, `setTimeout`, βιβλιοθήκη) **δεν** αποφασίζεται στατικά. Ο ένας κριτής του
  πελάτη είναι ο `shouldRetry`.
- **Τα μηνύματα** των απαντήσεων του συνόρου είναι αγγλικά, όπως κάθε άρνηση του `api-denial.ts`. Ο πελάτης δεν
  χαρτογραφεί ακόμη `errorCode` σε i18n, άρα το `OUTCOME_UNKNOWN` φτάνει στην οθόνη ως γενικό σφάλμα.
- **Απαιτείται** `firebase deploy --only firestore:rules,firestore:indexes` για τον κανόνα και την TTL (CHECK 3.86).
  Χωρίς αυτό η λειτουργία **δουλεύει** (Admin SDK), αλλά οι εγγραφές δεν λήγουν.
- 🔶 **Δύο εκθετικά backoff** (`api-client-transport.calculateBackoff` ±10% · `entity-linking/utils/retry.calculateBackoffDelay`
  ±25%). Υπήρχαν πριν από αυτό το ADR· η ενοποίηση θα άλλαζε συμπεριφορά ⇒ `pending-ratchet-work.md`.

## 7. Άγκυρες

- **Σύνορο** (`with-idempotency.test.ts`, Ι1–Ι11): αναπαραγωγή · μία εκτέλεση σε 3 αιτήματα · `IN_FLIGHT` · `KEY_REUSED` ·
  απελευθέρωση σε επιστρεφόμενο 503 · αποθήκευση σε έκρηξη (και 503 από έκρηξη) · `OUTCOME_UNKNOWN` · `REPLAY_UNAVAILABLE` ·
  διέλευση (χωρίς κεφαλίδα · GET · `natural` · multipart) · δύο άνθρωποι · άκυρο κλειδί · λήξη · αποθήκη εκτός.
- **Πελάτης** (`enterprise-api-client-auth-retry.test.ts`, Ρ1–Ρ10).
- **Πύλη** (`check-idempotency-boundary.test.js`, Π1–Π5 · Ν1–Ν2 · Ρ1–Ρ2 · Δ1–Δ2).
- **Κανόνες** (`idempotency-records.rules.test.ts`, deny-all).
- **Μεταλλάξεις**: σύνορο + πελάτης **21/21** · πύλη **6/6**.

## 8. Changelog

| Ημερομηνία | Τι |
|---|---|
| 2026-09-22 | **Γέννηση + υλοποίηση** (Φάση 2 της επιλογής Γ, ADR-853 Ε3). Σύνορο στις δύο ρίζες, πελάτης με κλειδί, αποθήκη Firestore + TTL, `natural` σε read/mute/follow, CHECK 3.92 (27 σύνορα υπολογισμένα, baseline 38). |
| 2026-09-22 | **Ζωντανή επαλήθευση (localhost, super_admin, νήμα `nthr_42f6cdda…`)**. Monkeypatch του `fetch`: η 1η απάντηση του `POST …/messages` φτάνει στον server και «χάνεται» (`TypeError('Failed to fetch')`). ✅ Επανάληψη με **ίδιο** `Idempotency-Key` · `201` + `Idempotent-Replayed: true` · **ένα** `network_messages` · **μία** εγγραφή `idempotency_records` (`completed`, κλειδί κατακερματισμένο στο id, TTL +24ω). 🔴 **Εύρημα στον ΠΕΛΑΤΗ, όχι στο σύνορο**: **δύο** φούσκες στην οθόνη για **ένα** έγγραφο. Το `useReconcileArrivals` (`hooks/network-messaging/useNetworkThreadActions.ts`, ADR-867 Β7) έσβηνε την εκκρεμή φούσκα σε effect που ξυπνούσε **μόνο** με το snapshot· όταν το snapshot προλάβαινε την απάντηση με το `messageId` (εδώ ντετερμινιστικά, λόγω επανάληψης· γενικά όποτε ο listener είναι γρηγορότερος από το δίκτυο) ο έλεγχος δεν ξανάτρεχε ποτέ. **Διόρθωση**: η ορατότητα **παράγεται** σε κάθε απόδοση από τις δύο εισόδους (νέο καθαρό `pendingNotArrived` στο `lib/network-messaging/thread-timeline.ts`, ίδια αναφορά όταν δεν φεύγει τίποτα)· το effect μόνο καθαρίζει τη μνήμη. Άγκυρες Χ-10/Χ-11 + νέα σουίτα `useNetworkThreadActions.test.ts` (Α-1, η ακριβής ζωντανή σειρά)· μετάλλαξη **3/3** · 12/12 · jscpd 0. Επανάληψη ζωντανά μετά τη διόρθωση: ίδιο κλειδί, replay, **μία** φούσκα, **ένα** έγγραφο. Αμφίδρομη εγγραφή: ADR-867 §9 (ιδιοκτήτης του Β7). |
