# ADR-739: Χρονοπρογραμματισμός εργασιών στο Netcup — «Coolify = ρολόι, git = πρόγραμμα»

**Κατάσταση:** ACCEPTED — υλοποιημένο (2026-07-31)
**Σχετικά:** ADR-313 (backup), ADR-281 (soft-delete), ADR-191 (file purge), ADR-738 (oauth-cleanup), ADR-294 (SSoT ratchet), ADR-259D (Sentry)

---

## 1. Το εύρημα

**Από 2026-05-09 έως 2026-07-31 — περίπου τρεις μήνες — δεν έτρεξε καμία
προγραμματισμένη εργασία σε παραγωγή.**

Οι 8 εγγραφές `crons` ζούσαν αποκλειστικά στο `vercel.json`. Το αρχείο αυτό το
διαβάζει **μόνο** το Vercel, που είναι παγωμένο από 2026-05-09· η παραγωγή τρέχει
σε **Netcup μέσω Coolify**. Δεν υπήρχε εναλλακτικός μηχανισμός: μηδέν αναφορές σε
`Dockerfile`/`nixpacks.toml`, κανένα GitHub workflow που να καλεί `/api/cron/*`,
κανένας εξωτερικός scheduler.

Πρακτικά δεν γινόταν: **αντίγραφο ασφαλείας**, εκκαθάριση κάδου αρχείων, οριστική
διαγραφή soft-deleted, εισαγωγή email, ειδοποιήσεις ληξιπρόθεσμων, υπενθυμίσεις
onboarding, εξαγωγή μοτίβων AI.

Επιπλέον το `CRON_SECRET` έλειπε από την παραγωγή — άρα ακόμη κι αν κάποιος
καλούσε τα endpoints, θα έπαιρνε `401` (secure default, `cron-auth.ts:31`).

### Γιατί κράτησε τρεις μήνες

**Τίποτα δεν παραπονέθηκε.** Το `vercel.json` έμοιαζε έγκυρο και κανένας έλεγχος
δεν το διάβαζε. Δεν υπήρχε συναγερμός για κάτι που *δεν* συνέβη. Αυτό ορίζει και
τη λύση: δεν αρκεί «να ξανατρέξουν» — πρέπει **να μην μπορεί να ξανασυμβεί
σιωπηλά**.

---

## 2. Τι αποδείχθηκε, τι διορθώθηκε στο handoff

| Ισχυρισμός handoff | Μέτρηση 2026-07-31 |
|---|---|
| «Τρέχει Coolify; αναπόδεικτο» | **Αποδείχθηκε**: `.github/workflows/docker-build.yml:97-105` καλεί το Coolify API με `COOLIFY_TOKEN` |
| «9 cron routes» | **10** — υπάρχει και το `/api/cron/ai-pipeline`, που **ποτέ** δεν μπήκε στο `vercel.json` |
| «ένα route χωρίς guard» | **Δύο**: `purge-deleted-entities` **και** `purge-deleted-contacts`, και τα δύο `GET()` **χωρίς παράμετρο `request`** |

### Δύο ευρήματα που δεν ήταν στο handoff

**α) Η τηλεμετρία του server ήταν διπλά νεκρή.** Το `instrumentation.ts` δεν έκανε
import το `sentry.server.config.ts` — ο μόνος μηχανισμός runtime init στο
`@sentry/nextjs` v8+ (το `withSentryConfig()` ρυθμίζει build-time πράγματα).
Παράλληλα το config διάβαζε `SENTRY_DSN`, ενώ το build περνά μόνο
`NEXT_PUBLIC_SENTRY_DSN`. Ο πίνακας του Sentry έδειχνε γεγονότα **από τον
browser**, οπότε η σιωπή του server ήταν αόρατη. **Ένας ζωντανός πίνακας δεν
αποδεικνύει ότι ο server μιλάει.**

**β) Διαρροή δεδομένων στο `/api/cron/ai-pipeline`.** Το **μη ταυτοποιημένο**
σκέλος επέστρεφε `intakeSubject` και `intakeSender.email` — θέματα και διευθύνσεις
αποστολέων πραγματικών μηνυμάτων, σε οποιονδήποτε καλούσε. Το κάλυπτε μόνο το
bot-block του `middleware.ts`, που φιλτράρει **user-agent** και αλλάζει σε ένα
δευτερόλεπτο. Το liveness probe χρειάζεται να ξέρει **αν** η ουρά είναι υγιής, όχι
**τι** περιέχει.

---

## 3. Η απόφαση

**Μία Coolify Scheduled Task ανά λεπτό· το πρόγραμμα στο git.**

```
Coolify Scheduled Task ("* * * * *", δεν αλλάζει ποτέ ξανά)
  └─ docker exec: node -e "fetch('http://127.0.0.1:3000/api/cron/dispatch', …)"
       └─ /api/cron/dispatch  ── rejectUnauthorizedCron (SSoT ταυτοποίησης)
            ├─ διαβάζει  src/config/cron-schedule.ts        ← ΤΟ SSoT
            ├─ cron-due: ποια οφείλονται (Europe/Athens + catch-up)
            ├─ cron-lease: κλείδωμα ανά εργασία σε Firestore
            ├─ cron-monitor: Sentry.withMonitor ανά εργασία
            └─ Promise.allSettled — οι συνωστισμένες ώρες τρέχουν παράλληλα
```

Είναι το μοτίβο της **Laravel** (`* * * * * php artisan schedule:run`), που
ακολουθούν Django-celery-beat, Sidekiq-cron και Quartz — και που χρησιμοποιεί
εσωτερικά **το ίδιο το Coolify** (είναι Laravel). Το τεκμηριωμένο σκεπτικό είναι
ακριβώς το ζητούμενο: *«your schedule is version-controlled alongside your
application code… deploying schedule changes is just a code deployment»*.

### Οι δρόμοι που απορρίφθηκαν

| Δρόμος | Γιατί όχι |
|---|---|
| **GitHub Actions `schedule`** | Το GitHub **απενεργοποιεί** schedules μετά από 60 ημέρες χωρίς commit — και «έτρεξε επιτυχώς» **δεν** μετράει ως δραστηριότητα. Καθυστερήσεις 30′+ σε peak, σιωπηλή απόρριψη εκτελέσεων σε υψηλό φόρτο. **Το ίδιο σφάλμα με άλλο πρόσωπο.** |
| **Sidecar** (`supercronic`/`ofelia`) | Απαιτεί `docker-compose`· το Coolify τρέχει image. Αλλαγή ολόκληρης της γραμμής deploy για μηδενικό κέρδος. |
| **Εξωτερική υπηρεσία** (`cron-job.org`) | Το `CRON_SECRET` ταξιδεύει σε τρίτο· εξωτερική εξάρτηση σε κρίσιμο μονοπάτι. |
| **Σκέτο Coolify Scheduled Tasks** (10 εγγραφές UI) | Η αλήθεια θα ζούσε στη **βάση του Coolify**, εκτός git. Νέο job = χειροκίνητο βήμα = ξαναγεννιέται το σφάλμα. |
| **In-process** (`node-cron`) | Χάνεται σε restart, πολλαπλασιάζεται με >1 instance. |

### Γιατί ο dispatcher καλεί **συναρτήσεις** και όχι HTTP στον εαυτό του

Laravel και Sidekiq καλούν **κώδικα**· το self-call αναφέρεται ρητά ως
anti-pattern. Κυρίως όμως το επέβαλε **η δοκτρίνα του ίδιου του repo**: το
`oauth-cleanup` γράφει *«Η πολιτική ζει ολόκληρη στο lib/oauth/oauth-cleanup.ts.
Εδώ μένει μόνο ο πυροκροτητής»*. **6 από τα 10 routes ήδη το έκαναν.**

Παράπλευρο όφελος που αποδείχθηκε καθοριστικό: όσο η λογική ήταν κολλημένη σε
`export async function GET`, ήταν αδοκίμαστη χωρίς πλήρες Next request — γι' αυτό
υπήρχαν **μηδέν tests** σε **όλα** τα cron routes.

---

## 4. Το SSoT

`src/config/cron-schedule.ts` — **μία δήλωση, τρεις καταναλωτές**:

1. **Ο dispatcher** αποφασίζει τι οφείλεται.
2. **Το Sentry monitor** ρυθμίζεται από τα *ίδια* πεδία. Άρα πρόγραμμα και
   συναγερμός **δεν μπορούν** να αποκλίνουν.
3. **Τα tests** επιβάλλουν ότι κάθε route είναι δηλωμένο και φυλασσόμενο.

### Πρόγραμμα (όλα ρητά σε `Europe/Athens`)

| Εργασία | Πριν (UTC, νεκρό) | Τώρα (Αθήνα) |
|---|---|---|
| `email-ingestion`, `ai-learning`, `overdue-alerts` | `0 0 * * *` | `0 3 * * *` |
| `backup` | `0 1 * * *` | `0 4 * * *` |
| `file-purge` | `0 2 * * *` | `0 5 * * *` |
| `oauth-cleanup` | *ποτέ δηλωμένο* | `0 6 * * *` |
| `purge-deleted-entities` | `0 4 * * *` | `0 7 * * *` |
| `onboarding-reminder` | `0 5 * * *` | `0 8 * * *` |
| `purge-deleted-contacts` | `0 3 * * *` | — *ανενεργό, superseded* |
| `ai-pipeline` | *ποτέ δηλωμένο* | — *ανενεργό, never-scheduled* |

Απόφαση Γιώργου: **σταθερή ελληνική ώρα**. Οι παλιές UTC ώρες μετακινούνταν
03:00↔04:00 τοπικά δύο φορές τον χρόνο· οι νέες είναι η θερινή τους αντιστοιχία,
παγωμένη.

### Οι δύο ανενεργές — γιατί δηλώνονται αντί να διαγραφούν

Ένα job **εκτός** λίστας είναι αόρατο· ένα job **στη** λίστα με `enabled: false`
και ρητή αιτία είναι **απόφαση**. Αυτή η διάκριση είναι ολόκληρο το μάθημα του ADR.

- **`purge-deleted-contacts`** — διπλότυπο: το `SOFT_DELETE_CONFIG.contact` δείχνει
  στην ίδια `COLLECTIONS.CONTACTS` που σαρώνει το `purge-deleted-entities`, και το
  header του δεύτερου γράφει ρητά *«Replaces purge-deleted-contacts»*.
  **Δεν διαγράφηκε**: ο αντικαταστάτης **δεν έχει τρέξει ποτέ σε παραγωγή**.
  Αφαίρεση εφεδρικού πριν αποδειχθεί ο αντικαταστάτης θα ήταν έκπτωση.
- **`ai-pipeline`** — υπάρχει, έχει guard, αλλά ποτέ δεν προγραμματίστηκε. Η
  συμπεριφορά του υπό πραγματικό φόρτο είναι **άγνωστη**· δεν ενεργοποιείται στα
  τυφλά. Ενεργοποίηση με ένα flag όποτε αποφασιστεί.

---

## 5. Idempotency — τι εγγυάται τι

Η βιβλιογραφία είναι κατηγορηματική: *«only a lease combined with a fencing token
is safe for correctness»*. Άρα **δεν** ισχυριζόμαστε exactly-once.

- **Το lease είναι κλείδωμα αποδοτικότητας.** Αποτρέπει διπλή δουλειά σε
  επικαλυπτόμενα ticks. Λήγει, ώστε container που πέθανε στη μέση να μην κλειδώνει
  την εργασία για πάντα — που θα ήταν *το ίδιο σφάλμα με άλλο πρόσωπο*.
- **Η ορθότητα είναι ιδιότητα των jobs.** Ισχύει ήδη: το `backup` ελέγχει μόνο του
  τον χρόνο από το τελευταίο, τα purge δουλεύουν σε παρτίδες με `limit()`, το
  `oauth-cleanup` έχει `hasMore`. **Νέο job όπου η διπλή εκτέλεση βλάπτει πρέπει να
  γίνει ιδempotent — να μη στηριχτεί στο lease.**
- **Χρόνος από τον server** (`FieldValue.serverTimestamp()`), όχι από το ρολόι του
  container: μια διόρθωση NTP προς τα πίσω θα έκανε ενεργό lease να φαίνεται
  μελλοντικό για πάντα.

### Catch-up (misfire handling)

Μια εργασία οφείλεται και όταν **η προηγούμενη στιγμή πέρασε χωρίς επιτυχία** —
π.χ. ο container έκανε επανεκκίνηση στις 04:00. Χωρίς αυτό, μια επανεκκίνηση ενός
λεπτού κοστίζει ένα ολόκληρο ημερήσιο αντίγραφο ασφαλείας. Παράθυρο χάριτος
**25 ώρες**: καλύπτει έναν πλήρη ημερήσιο κύκλο χωρίς να ξυπνά εργασίες σκόπιμα
σταματημένες. **Καμία από τις πέντε επιλογές του handoff δεν το είχε.**

---

## 6. Παρατηρησιμότητα — dead-man's switch

`Sentry.withMonitor(slug, run, config)` όπου το `config` παράγεται **αποκλειστικά**
από την εγγραφή του προγράμματος. Το monitor δημιουργείται/ενημερώνεται από το
check-in (upsert) — **κανένα χειροκίνητο βήμα στο UI του Sentry**, καμία δυνατότητα
απόκλισης.

Επιπλέον **ωριαίος heartbeat** για το ίδιο το ρολόι: όλες οι εργασίες είναι
ημερήσιες, οπότε αν πεθάνει η Coolify task θα περνούσαν έως 24 ώρες μέχρι το πρώτο
χαμένο check-in. Ο heartbeat κόβει τον χρόνο ανίχνευσης σε ~1 ώρα. Ωριαίος και όχι
λεπτού: το Sentry περιορίζει σε 6 check-ins/λεπτό ανά monitor και 1.440 check-ins
την ημέρα είναι θόρυβος χωρίς αντίκρισμα.

---

## 7. Τα δύο tests που κάνουν το σφάλμα αδύνατο να επαναληφθεί

Οι «μεγάλοι παίχτες» λύνουν το *«τρέχει;»*. Κανείς δεν λύνει το *«ξέχασα να το
δηλώσω»* — που ήταν **η πραγματική αιτία** εδώ.

`src/lib/cron/__tests__/cron-route-contract.test.ts` **σαρώνει τον δίσκο** (δεν
κάνει import — ένα import βλέπει μόνο ό,τι κάποιος θυμήθηκε να δηλώσει, δηλαδή
ρωτά τον ύποπτο):

1. **Εξαντλητικότητα** — κάθε `src/app/api/cron/*` πρέπει να έχει εγγραφή στο SSoT,
   και καμία εγγραφή δεν δείχνει σε ανύπαρκτο route. *Αυτό θα είχε πιάσει το
   `ai-pipeline` πριν τρεις μήνες.*
2. **Κάλυψη guard** — κάθε cron route ταυτοποιεί τον καλούντα, από το SSoT και όχι
   με τοπικό αντίγραφο. *Αυτό θα είχε πιάσει τα δύο αφύλακτα routes.*
3. **Πυροκροτητές** — κανένα route δεν αγγίζει απευθείας Firestore.

**Το SSoT δεν είναι λίστα· είναι συμβόλαιο που επιβάλλεται.**

---

## 8. Επαλήθευση

**133 tests / 6 suites, όλα πράσινα** (`npx jest src/lib/cron`).

**Σκόπιμη μετάλλαξη: 33 μεταλλάξεις, 32 σκοτωμένες, 1 αποδείξιμα ισοδύναμη.**
(Πήχης προηγούμενης φάσης: 21.) Ο έλεγχος έγινε με `@swc/jest`, που αφαιρεί τύπους
χωρίς έλεγχο — άρα **κάθε θάνατος είναι σημασιολογικός**, κανένας δεν οφείλεται σε
σφάλμα τύπου.

Η πρώτη εκτέλεση έδωσε **26/33**· οι 7 επιζώντες ήταν 7 πραγματικά τυφλά σημεία
και έκλεισαν με 5 νέα tests + 1 αναδιατύπωση κώδικα (το άνω άκρο του λεπτού έγινε
ρητά ημιάνοιχτο — ήταν σωστό **κατά σύμπτωση**, επειδή οι στιγμές cron πέφτουν σε
ακέραιο λεπτό).

Ο ένας ισοδύναμος (`missed < startOfMinute` → `<=`) είναι **απροσπέλαστος**: για να
ισχύσει `missed === startOfMinute` θα έπρεπε να υπάρχει στιγμή στην αρχή του
λεπτού, οπότε το σκέλος `scheduled` θα είχε ήδη επιστρέψει. Καταγράφεται στον
κώδικα ώστε ο επόμενος να μη ψάχνει test που δεν λείπει.

### 🔴 Τι έπιασε η μετάλλαξη πριν φτάσει σε παραγωγή

Η πρώτη υλοποίηση του `isJobDue` χρησιμοποιούσε `Cron.previousRun()`. Το
`previousRun()` του croner επιστρέφει την τελευταία στιγμή που **εκτέλεσε το ίδιο
το αντικείμενο** — για ένα `Cron` φτιαγμένο μόνο για υπολογισμό επιστρέφει πάντα
`null`. **Καμία εξαίρεση, καμία προειδοποίηση: απλώς καμία εργασία δεν θα κρινόταν
ποτέ οφειλόμενη.** Ο χρονοπρογραμματιστής θα ήταν σιωπηλά νεκρός — δηλαδή θα
αναπαρήγαγε ακριβώς το σφάλμα που ήρθε να διορθώσει. Το έπιασαν τα tests
ημερομηνιών, όχι ο μεταγλωττιστής.

---

## 9. Runbook — τα χειροκίνητα βήματα

Ο πράκτορας δεν έχει πρόσβαση στο Coolify ούτε στα μυστικά παραγωγής.

1. **`CRON_SECRET`** στο Coolify → Environment Variables. Χωρίς αυτό **όλα**
   επιστρέφουν `401` by design. **Ποτέ σε git-tracked αρχείο** (τα `.env.coolify*`
   είναι untracked — επιβεβαιωμένο με `git ls-files`).
2. **`SENTRY_DSN`** (ή απλώς άφησε το `NEXT_PUBLIC_SENTRY_DSN` — υπάρχει πλέον
   fallback στο `sentry-config.ts`).
3. **Μία Scheduled Task**, `* * * * *`, container = η εφαρμογή:
   ```
   node -e "fetch('http://127.0.0.1:3000/api/cron/dispatch',{headers:{'x-cron-secret':process.env.CRON_SECRET,'user-agent':'nestor-scheduler/1'}}).then(r=>process.exit(r.ok?0:1))"
   ```
   ⚠️ **`node -e`, όχι `curl`/`wget`.** Το `node:22-alpine` δεν έχει curl, και το
   `wget` είναι στη `BLOCKED_BOT_PATTERNS` του `middleware.ts` μαζί με το `curl/` —
   θα έτρωγε **403 από το Edge** πριν τρέξει γραμμή, σφάλμα που μοιάζει με «λάθος
   διαπιστευτήρια» και δεν είναι. Ο ρητός user-agent λύνει το θέμα **χωρίς** να
   ανοίξει το `/api/cron` στο `isMachineEndpoint` — το οποίο **παραμένει κλειστό
   σκόπιμα**: άνοιγμά του θα εξέθετε δημόσια endpoints οριστικής διαγραφής.
4. Μετά το πρώτο 24ωρο: επιβεβαίωση των 8 monitors + heartbeat στο Sentry.

### 9.1 Ενεργοποίηση παραγωγής — ολοκληρώθηκε 2026-07-31

Τα βήματα 1-3 του runbook **εκτελέστηκαν και επαληθεύτηκαν** την ίδια ημέρα, μέσω
του **REST API του Coolify** (βλ. παγίδα α παρακάτω) και όχι από το UI.

| Ενέργεια | Αποτέλεσμα |
|---|---|
| Push `0091cd2f` (45 commits) | αναπτύχθηκε· container online 10:02 UTC |
| `CRON_SECRET` | γράφτηκε μέσω API — `is_runtime=true`, `is_buildtime=false` |
| `NEXT_PUBLIC_APP_URL` | **ΕΛΕΙΠΕ ΤΕΛΕΙΩΣ** από την παραγωγή· γράφτηκε `is_buildtime=true` + `is_runtime=true` |
| Scheduled Task | `nestor-cron-dispatch` · `* * * * *` · enabled · uuid `re62oh7oi2q1bks5n417fcy4` |
| Restart | **απαραίτητο** — οι μεταβλητές γράφτηκαν *μετά* το deploy, ο container δεν τις είχε |
| **Απόδειξη λειτουργίας** | εκτελέσεις: **10:06 failed (exit 1) → 10:07 success → 10:08 success** |
| Φύλακας | `GET /api/cron/dispatch` χωρίς μυστικό → **401** |

Η αποτυχία στις 10:06 είναι **η απόδειξη ότι το restart χρειαζόταν**: μέχρι εκείνη
τη στιγμή η διεργασία έτρεχε με το παλιό περιβάλλον, χωρίς `CRON_SECRET`, οπότε το
`fetch` έπαιρνε 401 και το `process.exit(r.ok?0:1)` γύριζε 1. Δεν ήταν σφάλμα
ρύθμισης — ήταν το αναμενόμενο secure default του `cron-auth.ts:31` να μιλάει.

#### Δύο παγίδες που κόστισαν χρόνο — μην τις ξαναπληρώσεις

**α) Ο πίνακας του Coolify είναι απρόσιτος σε αυτοματισμό browser.** Είναι Livewire
με μόνιμο websocket, οπότε η σελίδα **δεν φτάνει ποτέ σε `document_idle`** ⇒ κάθε
script injection λήγει (`Script injection timed out`). **Δεν** είναι θέμα
δικαιωμάτων ούτε του `http://`· καμία αναμονή δεν το λύνει, γιατί η συνθήκη που
περιμένεις δεν πρόκειται να ισχύσει ποτέ. **Χρησιμοποίησε το REST API.**

**β) Ονόματα πεδίων του API**: `is_buildtime` / `is_runtime` — **όχι**
`is_build_time` (επιστρέφει `422 This field is not allowed`).

**Στοιχεία API:** base `http://159.195.44.221:8000/api/v1` · app uuid
`f661kuiq901llma0o8unhvpi` · `Authorization: Bearer <token>` (Keys & Tokens → API
Tokens, δικαίωμα `root`). Endpoints: `/applications`,
`/applications/{uuid}/envs` (GET/POST), `/applications/{uuid}/scheduled-tasks`
(GET/POST), `/scheduled-tasks/{uuid}/executions` (GET),
`/applications/{uuid}/restart` (POST).

⚠️ **Το token δεν γράφεται ποτέ σε αρχείο του repo.** Το token της ενεργοποίησης
(`claude-cron-setup`, root, 7 ημέρες) πρέπει να γίνει **revoke** — πέρασε από
συνομιλία.

---

## 10. Γνωστά όρια — δηλώνονται, δεν κρύβονται

- **Ένα ρολόι = ένα σημείο αστοχίας.** Το καλύπτει ο heartbeat (ανίχνευση εντός
  ώρας), όχι η αρχιτεκτονική.
- Το `maxDuration = 60` στα routes είναι σημασιολογία **Vercel serverless**· σε
  Docker/Netcup ο πραγματικός περιοριστής είναι ο reverse proxy. Τα
  `PER_TYPE_LIMIT`/`BATCH_LIMIT` επιλέχθηκαν για *εκείνο* το όριο και **δεν
  αλλάχθηκαν**: η αλλαγή τους είναι απόφαση με δικά της δεδομένα, όχι παρενέργεια
  της μετακόμισης.
- Το `adr-index.md` **δεν** ενημερώθηκε (ούτε για το ADR-738): είναι
  auto-generated και ο generator απαγορεύεται να τρέξει.
- **Προϋπάρχον κόκκινο, άσχετο με αυτό το ADR:** `npm run test:registry-golden` →
  1/102 αποτυχία στο module `date-local` (`pattern[1]` δεν ταιριάζει το
  should-match fixture). Δεν αγγίχθηκε από αυτή τη δουλειά.

---

## 11. Αρχεία

**Νέα:** `src/types/cron-schedule.ts` · `src/config/cron-schedule.ts` ·
`src/lib/cron/{cron-due,cron-lease,cron-monitor,cron-dispatcher,ai-pipeline-diagnostic}.ts` ·
`src/lib/cron/{queue-batch-response,queue-cron-route}.ts` ·
`src/lib/cron/jobs/*.job.ts` (10) · `src/app/api/cron/dispatch/route.ts` ·
`src/lib/cron/__tests__/*` (6 suites) ·
`tests/firestore-rules/suites/cron-job-state.rules.test.ts`

**Τροποποιημένα:** `instrumentation.ts` · `sentry.{client,server,edge}.config.ts` ·
`src/config/sentry-config.ts` · `src/config/firestore-collections.ts`
(`CRON_JOB_STATE`) · `firestore.rules` (deny-all) · `src/lib/cron-auth.ts` ·
`src/middleware.ts` (σχόλιο) · `vercel.json` (αφαίρεση `crons`) ·
`.ssot-registry.json` (module `cron-schedule`) · `package.json` (croner) ·
`docs/deployment/git-workflow.md` · τα 10 cron routes

**Εξάρτηση:** `croner@10.0.1` — **MIT, μηδέν εξαρτήσεις**, ενσωματωμένη υποστήριξη
ζωνών ώρας (N.5 ✅).

---

## 12. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-07-31 | Αρχική έκδοση. Εντοπισμός τρίμηνου κενού· guards στα δύο αφύλακτα routes· ενεργοποίηση server Sentry· SSoT προγράμματος + dispatcher + lease + monitors· διόρθωση διαρροής `ai-pipeline`· αφαίρεση `crons` από `vercel.json`· 133 tests, 32/33 μεταλλάξεις. |
| 2026-07-31 | **`queue-cron-route.ts`** — το CHECK 3.28 εντόπισε ότι το GET/POST wiring των `ai-pipeline` και `email-ingestion` ήταν διπλότυπο 12 γραμμών. Το διπλότυπο ήταν **έλεγχος πρόσβασης**, δηλαδή ακριβώς το σχήμα της διαρροής του §2β: το μη ταυτοποιημένο μονοπάτι γραμμένο δύο φορές. Ένα factory παράγει πλέον και τους δύο handlers· τα routes κρατούν μόνο τη δήλωση. Ο έλεγχος «κάθε route ταυτοποιεί τον καλούντα» **ακολουθεί** πλέον ένα επίπεδο έμμεσης αναφοράς μέσα στο `lib/cron/` αντί να το δεχτεί — επαληθευμένο με μετάλλαξη: αφαίρεση του guard από το factory κοκκινίζει 4 tests. |
| 2026-07-31 | `cron_job_state` — πλήρης κάλυψη κανόνων Firestore (CHECK 3.16) αντί για `PENDING`. Το `trash-list-route` allowlist μεταφέρθηκε από τα δύο `purge-deleted-*/route.ts` στα αντίστοιχα `.job.ts` — ακολουθεί τη μετακίνηση της λογικής, δεν χαλαρώνει τον κανόνα. |
| 2026-07-31 | **Ενεργοποίηση παραγωγής — ΟΛΟΚΛΗΡΩΘΗΚΕ** (νέο §9.1). `CRON_SECRET` + `NEXT_PUBLIC_APP_URL` (**έλειπε τελείως**) γραμμένα μέσω Coolify REST API· Scheduled Task `nestor-cron-dispatch` (`* * * * *`, uuid `re62oh7oi2q1bks5n417fcy4`)· restart απαραίτητο γιατί οι μεταβλητές γράφτηκαν *μετά* το deploy· απόδειξη 10:06 failed → 10:07/10:08 success· `401` χωρίς μυστικό. **Δύο παγίδες τεκμηριωμένες**: (α) ο πίνακας Coolify είναι Livewire με μόνιμο websocket ⇒ ποτέ `document_idle` ⇒ **απρόσιτος σε browser automation**, χρησιμοποίησε το REST API· (β) πεδία API `is_buildtime`/`is_runtime`, **όχι** `is_build_time` (`422`). Ο runbook παύει να είναι σχέδιο — είναι πλέον καταγραφή. |
