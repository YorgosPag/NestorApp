# ADR-860: Ο κώδικας μιας ανοιχτής καρτέλας **επιβιώνει του deploy** — ανθεκτικότητα σε αλλαγή έκδοσης

| Metadata | Value |
|----------|-------|
| **Status** | ΥΛΟΠΟΙΗΜΕΝΟ — ζωντανή επιβεβαίωση **εκκρεμεί** (χρειάζονται **δύο** διαδοχικά deploys) |
| **Date** | 2026-09-14 |
| **Category** | Infrastructure & Deployment |
| **Canonical Location** | `src/lib/app-version/` · `instrumentation-client.ts` · `scripts/lib/static-retention/` · `scripts/deploy/carry-forward-static-assets.js` · `src/app/api/static-asset-miss/route.ts` · `src/app/api/build-info/route.ts` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Σχετικά** | ADR-858 §5.5 (το πρώτο καταγεγραμμένο περιστατικό) · ADR-788 (ένα build — η εικόνα **είναι** ο server) · ADR-740 (Netcup/Coolify) · SPEC-259D (ErrorTracker) |

---

## 1. Το σύμπτωμα

2026-09-14 05:29 UTC, δημόσια σελίδα αγγελίας `/listing/prop_ff19…`, επισκέπτης χωρίς σύνδεση:

```
ChunkLoadError: Loading chunk 84130 failed.
(error: https://nestorconstruct.gr/_next/static/chunks/2be8cbde.3f5f389ca493d51e.js)
  at loadableGenerated.webpack [as loader]  (app/(light)/listing/[id]/page-…js)
```

Η σελίδα έπεσε σε `global-error`. Λίγα λεπτά μετά το ίδιο chunk απαντούσε **200**. Είναι το
**δεύτερο** τεκμηριωμένο περιστατικό της κλάσης: το ADR-858 §5.5 κατέγραψε το `chunk 27900` ως
«δίκτυο, από deploy εν πτήσει» (curl 200 δευτερόλεπτα μετά, hash `webpack-*.js` άλλαξε δύο φορές).

## 2. Οι μετρήσεις

| Μέτρηση (παραγωγή) | Αποτέλεσμα | Σημασία |
|---|---|---|
| `GET /_next/static/chunks/doesnotexist.js` | **`200`**, `text/html`, `Cache-Control: public, max-age=31536000, immutable` | ένα chunk που **λείπει** σφραγιζόταν στην cache του browser **για ένα χρόνο** |
| `GET /_next/static/css/doesnotexist.css` | ίδιο | και για CSS |
| `du .next-oracle/static` (production build) | **50 MB** | κόστος διατήρησης ανά deploy (με κοινά αρχεία) |
| `Dockerfile:13` | `COPY .next/static` **του τρέχοντος** build μόνο | κάθε deploy έσβηνε τον κώδικα της προηγούμενης έκδοσης |

## 3. Οι ρίζες — τέσσερα ελαττώματα που συνεργάζονταν

1. **Κάθε deploy σβήνει τα assets της προηγούμενης έκδοσης.** Το Coolify αλλάζει container· η
   νέα εικόνα έχει μόνο το νέο `.next/static`. Ανοιχτή καρτέλα που ζητά chunk μετά το deploy
   ζητά αρχείο που **δεν υπάρχει πια**.
2. **«Δεν υπάρχει» = `200` + `immutable`.** Τρεις αιτίες μαζί (πηγαίος Next 15.5.22):
   - το catch-all `(app)/[...unprefixed]` ταιριάζει κάθε διαδρομή στο στάδιο dynamic routes
     (`resolve-routes.js:187`) ⇒ το 404 του ίδιου του Next για `/_next/static/`
     (`router-server.js:461`) **δεν εκτελούνταν ποτέ**·
   - το `(app)/loading.tsx` στέλνει κέλυφος με streaming ⇒ status **κλειδωμένο σε 200**·
   - οι κανόνες `headers()` (`/_next/static/(.*)`, `/(.*).js`, `/(.*).css`) ταιριάζουν με
     διαδρομή, **πριν** και **ανεξάρτητα** από το status (`resolve-routes.js:508`).
3. **Καμία ανάκαμψη στον πελάτη.** Η πλοήγηση RSC καλυπτόταν ήδη (`fetch-server-response.js:119`:
   άλλο `buildId` ⇒ MPA). Οι φορτώσεις **μέσα** στη σελίδα όχι: το `next/dynamic` είναι
   `React.lazy` (`lazy-dynamic/loadable.js:30`), που **κρατά μόνιμα** την απόρριψη ⇒ κανένα
   `reset()` του error boundary δεν μπορεί να ξαναφορτώσει.
   ⚠️ **Η πρώτη πρόταση ΔΙΑΨΕΥΣΤΗΚΕ 2026-09-25 (Ε5/Ε6)**: ο έλεγχος `buildId` (`:140`) τρέχει
   **αφού** ο Flight client έχει ήδη **εκτελέσει** τα modules του payload· ένα RSC άλλου build
   σκάει μέσα στον `__webpack_require__` **πριν** φτάσει η MPA.
4. **Τυφλή τηλεμετρία.** Το `config/error-reporting.ts` αγνοούσε το `'Loading chunk'`. Και οι
   `NEXT_PUBLIC_BUILD_VERSION` / `NEXT_PUBLIC_APP_VERSION` που διάβαζαν `ErrorTracker` και
   `EnterpriseSessionService` **δεν οριζόταν πουθενά** ⇒ καμία αναφορά δεν ήξερε την έκδοσή της.

## 4. Η απόφαση — άμυνα σε τέσσερα επίπεδα, μία ταυτότητα έκδοσης

Πρακτική μεγάλων: Vercel Skew Protection, Cloudflare version affinity, S3/CDN «ποτέ διαγραφή»,
Platformatic «draining» έκδοση, Next.js self-hosting guide. Κοινό σχήμα: **(α)** τα παλιά assets
μένουν για περίοδο χάριτος· **(β)** ο πελάτης ξεχωρίζει δίκτυο από αλλαγή έκδοσης· **(γ)**
ανανέωση μόνο ως έσχατη λύση.

### Ε0 — Ταυτότητα έκδοσης: ΜΙΑ πηγή

- CI: `NEXT_PUBLIC_DEPLOYMENT_ID: ${{ github.sha }}` στο `docker-build.yml` **και** στο
  `bundle-ratchet.yml` (CHECK 3.57: ισοτιμία `env:` των δύο `build:ci`).
- `src/lib/app-version/deployment-identity.ts` → `getDeploymentId()`: ίδια συνάρτηση σε server
  και browser (το Next ψήνει την τιμή και στα δύο bundles). `null` = «άγνωστο», **ποτέ**
  «διαφορετικό».
- `GET /api/build-info` → `{ deploymentId }`, `no-store`, `withStandardRateLimit`. Συμβόλαιο:
  `src/lib/app-version/build-info-contract.ts` (ο browser δεν εισάγει από `app/api/**`).
- Boy Scout: `ErrorTracker.buildVersion` και `EnterpriseSessionService.APP_VERSION` διαβάζουν πλέον
  την ταυτότητα.

⛔ **Απορρίφθηκε: το `deploymentId` του ίδιου του Next.** Βάζει `?dpl=<id>` σε **κάθε** URL asset ⇒
σε κάθε deploy άλλαζε το URL και των chunks που **δεν** άλλαξαν ⇒ κάθε χρήστης ξανακατέβαζε όλο
τον κώδικα. Στη Vercel το query **δρομολογεί** στην παλιά έκδοση· εδώ τα παλιά assets μένουν στον
ίδιο server (Ε1), άρα η δρομολόγηση δεν χρειάζεται και το κόστος θα ήταν καθαρή απώλεια cache.
(Στο 15.5.22 ο server επιπλέον **δεν** συγκρίνει το `x-deployment-id`· η σύγκριση που περιγράφουν
τα docs 16.x δεν υπάρχει.)

### Ε1 — Διατήρηση assets μεταξύ deploys (7 ημέρες, οροφή 20)

- Βήμα «Carry forward previous static assets» στο `docker-build.yml`, μετά το build και πριν το
  `docker build`: `docker pull :latest` → `docker cp /app/.next/static` → CLI.
- Καθαρή λογική στο `scripts/lib/static-retention/` (`retention-policy` · `retention-manifest` ·
  `carry-forward-plan`)· I/O μόνο στο `scripts/deploy/carry-forward-static-assets.js`.
- Μανιφέστο `.next/static/.retention.json` — ταξιδεύει **μέσα** στην εικόνα, καμία εξωτερική αποθήκη.
- Ο server σαρώνει το `.next/static` από δίσκο στην εκκίνηση (`filesystem.js:187`) ⇒ τα
  μεταφερμένα αρχεία σερβίρονται χωρίς καμία ρύθμιση.

Κανόνες:
- ⛔ **Ένα αρχείο σβήνεται μόνο αν κανένα κρατημένο deployment δεν το αναφέρει** — τα hashed αρχεία
  που δεν άλλαξαν μοιράζονται ανάμεσα σε builds.
- ⛔ **Ποτέ αντικατάσταση.** Ίδιο όνομα με άλλα bytes ⇒ κρατιέται το νέο + `::warning::`.
  *Απόκλιση από το αρχικό πλάνο (έλεγε «σφάλμα»)*: το δίχτυ ασφαλείας δεν επιτρέπεται να σταματήσει
  deploy παραγωγής — και χωρίς μεταφορά η καρτέλα θα έπαιρνε ούτως ή άλλως το νέο αρχείο.
- ⛔ **Ποτέ μπλοκάρισμα deploy**: αποτυχία pull / cp / script ⇒ `::warning::`, το build συνεχίζει.
- Πρώτη φορά (εικόνα χωρίς μανιφέστο) ⇒ τα παλιά αρχεία παίρνουν εγγραφή `pre-retention` με
  ημερομηνία **τώρα**, δηλαδή την ίδια περίοδο χάριτος.
- **Δεν ξαναχτίζει** (CHECK 3.57 / ADR-788).

### Ε2 — Αληθινό 404, ποτέ σε cache

- **Αφαιρέθηκαν** οι κανόνες `immutable` για `/_next/static/(.*)`, `/(.*).js`, `/(.*).css`. Για τα
  υπαρκτά αρχεία δεν χάνεται τίποτα: το Next βάζει ήδη `immutable` **μόνο** σε πραγματικό
  `nextStaticFolder` (`router-server.js:366`). Παράπλευρο όφελος: το μη-hashed
  `public/react-bugfix-guards.js` δεν «κλειδώνεται» πια για ένα χρόνο.
- `rewrites()` σε σχήμα `{ beforeFiles, afterFiles, fallback }`· στο **`afterFiles`**:
  `/_next/static/:path*` → `/api/static-asset-miss?asset=:path*`. Το `afterFiles` τρέχει **μετά** τον
  έλεγχο αρχείων και **πριν** τα dynamic routes — το μόνο σημείο όπου «δεν βρέθηκε» είναι γνωστό και
  καμία σελίδα δεν έχει αρχίσει να αποδίδεται.
- `/api/static-asset-miss` → `404`, `no-store`, `nosniff`, `withAssetRateLimit` (fail-open: βλάβη
  μετρητή δεν γίνεται 5xx). Κάθε κλήση γράφει `warn` στο log = **μετρικό skew**.

⛔ **Απορρίφθηκε: `_next` στο `OUTSIDE_WORKSPACE`.** Κλειστό σύνολο με άγκυρες ισότητας με το δέντρο
διαδρομών — και θα έδινε `notFound()` που το `loading.tsx` θα κλείδωνε **ξανά** σε 200.

### Ε3 — Ανάκαμψη στον πελάτη, ΚΑΤΩ από το React

`installChunkRecovery` τυλίγει το `__webpack_require__.e` — από όπου περνά **κάθε** δυναμική φόρτωση
JS και CSS, χωρίς να αγγιχτεί κανένα από τα 111 σημεία `dynamic()`. Ιδίωμα του ίδιου του Next
(`app-webpack.js` τυλίγει το `.u`). Εγκατάσταση στο `instrumentation-client.ts`, που φορτώνεται
**πριν** το hydration (`app-next.js:10`) ⇒ καλύπτει και τα chunks της πρώτης απόδοσης.

```
αποτυχία φόρτωσης
  └─ επανάληψη ×3, backoff 300→900→2700ms με jitter ─── πέτυχε ──▶ recovered-by-retry
       └─ probe /api/build-info
            ├─ skewed ─┬─ μη αποθηκευμένη δουλειά ────────────────▶ deferred-unsaved (banner)
            │          ├─ δικαίωμα ανανέωσης ──────────────────────▶ reloaded-for-skew
            │          └─ ήδη ανανεώθηκε για αυτή την έκδοση ─────▶ failed-already-reloaded
            ├─ same ──────────────────────────────────────────────▶ failed-same-version
            └─ unknown ───────────────────────────────────────────▶ failed-network
```

- **Ταξινόμηση με δομικά πεδία, όχι μήνυμα** (`chunk-load-error.ts`): JS = `name: ChunkLoadError`
  + `type`/`request`· CSS = `code: CSS_CHUNK_LOAD_FAILED` + `request` (το όνομά του είναι `Error`).
- ⛔ **ADR-858**: ό,τι δεν είναι φόρτωση (π.χ. `ReferenceError` TDZ) περνά **ακέραιο** — ποτέ
  «θεραπεία» με ανανέωση. Πετιέται πάντα το **τελευταίο** σφάλμα του φορτωτή αυτούσιο.
- **Βρόχος δομικά αδύνατος**: η σημαία στο `sessionStorage` έχει κλειδί **το deploymentId του
  server**, όχι χρόνο. Χωρίς διαθέσιμο `sessionStorage` ⇒ **καμία** ανανέωση (χωρίς μνήμη δεν
  τηρείται το «μία φορά»).
- **Ταυτόχρονες αποτυχίες** (πολλά chunks μετά από deploy): ένα κοινό probe σε πτήση· ο πρώτος παίρνει
  την ανανέωση, οι υπόλοιποι **περιμένουν σιωπηλά** την εκφόρτωση — καμία οθόνη σφάλματος στο μεταξύ.
- `unknown` **ποτέ** δεν οδηγεί σε ανανέωση: χωρίς δίκτυο θα άφηνε λευκή σελίδα του browser.

⛔ **Απορρίφθηκε: επανάληψη στο error boundary** — αδύνατη λόγω `React.lazy`.
⛔ **Απορρίφθηκε: `webpack-retry-chunk-load-plugin`** (MIT) — τυλίγει `ensureChunk` **και** `.u`,
αλλά το Next **αντικαθιστά ολόκληρο** το `.u` στο `app-webpack.js`: η σύγκρουση θα ήταν σιωπηλή.

### Ε3β — Ποτέ αυτόματη ανανέωση πάνω σε μη αποθηκευμένη δουλειά

- `src/lib/app-version/unsaved-work-registry.ts` — μητρώο **ιδιοκτητών** (όχι μετρητής) χωρίς React.
  Αυτό και το `app-update-state.ts` στηρίζονται στο **`createExternalStore`** (`@/lib/state`) — το
  ΕΝΑ pub/sub της εφαρμογής. *Πρώτη εκδοχή τους ήταν χειροποίητα `Set` ακροατών· το jscpd δεν τα
  έπιασε (κάτω από 50 tokens), τα έπιασε το grep του N.0.2 πριν το «done».*
- `DirtyFormProvider` καθρεφτίζει εκεί (ιδιοκτήτης = `useId()`).
- `AppUpdateBanner` στο root layout — `<aside role="status">`, μηδέν DOM όσο δεν υπάρχει νέα έκδοση·
  i18n `common:appUpdate.*` — ⚠️ **όχι** `errors`: το banner ζει στο root layout, και η γεννήτρια
  του shell slice (CHECK 3.34) αρνήθηκε νέο namespace στο κέλυφος («9 έναντι σφραγισμένων 8»).
  Το `common` είναι ήδη εγγυημένο εκεί. ⛔ Όχι `next/dynamic` για να γλιτώσει το namespace: το
  banner εμφανίζεται **ακριβώς** όταν η φόρτωση chunks είναι σπασμένη.

### Ε3γ — ΕΝΑΣ `beforeunload`, οδηγούμενος από το μητρώο (2026-09-22)

- `src/lib/app-version/unsaved-work-guard.ts` — ο **μόνος** native listener προειδοποίησης.
  Εγκαθίσταται στο `instrumentation-client.ts` (κάθε σελίδα, πριν το hydration, **χωρίς** firebase).
  Listener **μόνο όσο** το μητρώο δεν είναι άδειο (οδηγία Chrome Page Lifecycle API — στο Firefox
  μόνιμος `beforeunload` βγάζει τη σελίδα από το bfcache).
- Ο `DirtyFormProvider` **έχασε** τον δικό του `beforeunload` (N.0.2): ήταν ήδη ιδιοκτήτης στο
  μητρώο, άρα η απάντηση υπήρχε σε δύο σημεία.
- **Δεύτερος ιδιοκτήτης**: `firestore:pending-writes` (ADR-367 §2.6) — ανεπιβεβαίωτες εγγραφές του
  Firestore SDK. Κάθε editor που γράφει μέσω του client SDK (DXF/BIM, ~100 αρχεία) καλύπτεται
  **χωρίς** να αγγιχτεί.
- **Ορατή πλευρά** (ADR-367 §2.7): η κεφαλίδα διαβάζει τον ιδιοκτήτη `firestore:pending-writes`
  μέσω του νέου `hasUnsavedWorkFrom(ownerId)` — «Αποθήκευση…» / «Εκτός σύνδεσης — αλλαγές σε αναμονή».
- ⚠️ Οι `beforeunload` των `user-settings-repository` / `WebSocketContext` / `AnalyticsBridge`
  **δεν** είναι προειδοποιήσεις (flush / κλείσιμο socket) — σωστά μένουν όπου είναι.

### Ε4 — Παρατηρησιμότητα

- Αφαιρέθηκαν τα `'Loading chunk'` / `'Loading CSS chunk'` από τα αγνοούμενα.
- `chunk-recovery-telemetry.ts`: **ένα** γεγονός ανά περιστατικό με την **έκβαση**, `warning` (όχι
  email στον admin), category `network`, metadata `chunkOutcome` · `chunkUrl` · `skewVerdict` ·
  `clientDeploymentId` · `serverDeploymentId`. Το ErrorTracker τα κρατά και στο `localStorage` ⇒ το
  `reloaded-for-skew` επιβιώνει της ανανέωσης.
- Server: κάθε `/api/static-asset-miss` = γραμμή `warn` στο log.

### Ε5 — Κανένα `stale-while-revalidate` προς τον browser (2026-09-25)

**Περιστατικό** (παραγωγή, 06:58 UTC, ~20′ μετά το deploy του `cfa83ac0`): αρχική → «Πού
ψάχνεις;» → κοινότητα → `/search/results` ⇒ οθόνη σφάλματος `TypeError: Cannot read properties of
undefined (reading 'call')`, άδειος χάρτης. **Αναπαράχθηκε** σε καθαρή καρτέλα, **ίδιο** build.

**Αλυσίδα (μετρημένη, όχι υποθετική):**
1. Κάθε ISR/στατική σελίδα — HTML **και** RSC — έφευγε με
   `Cache-Control: s-maxage=3600, stale-while-revalidate=31532400`: προεπιλογή του Next
   (`expireTime` = 1 έτος, `config-shared.js:88`), που η τεκμηρίωση ορίζει «for CDNs to consume».
2. Δεν έχουμε CDN μπροστά από το Netcup ⇒ την «καταναλώνει» ο **browser**: αγνοεί το `s-maxage`
   (RFC 9111), **τηρεί** όμως το SWR ⇒ σερβίρει την αποθηκευμένη απάντηση αμέσως, για έως ένα χρόνο.
3. Το κλειδί `_rsc` είναι hash **μόνο** των headers πλοήγησης (`cache-busting-search-param.js`),
   **όχι** της έκδοσης ⇒ ίδιο URL από build σε build.
4. Το prefetch του `/pro` (σύνδεσμος στην κεφαλίδα) πήρε από την cache δίσκου του browser (`transferSize: 0`)
   RSC του **προηγούμενου** build, που ζητούσε `pro/page-301c…js` (ο server σερβίρει
   `page-8a8f…js`). Το Ε1 το κράτησε διαθέσιμο ⇒ φορτώθηκε μέσα στον **νέο** runtime ⇒ το module
   `100777` δεν υπήρχε ⇒ `undefined.call`. Επιβεβαιωμένο στον browser: **μόνο** αυτό λείπει.

**Απόφαση:** `expireTime: 0` στο `next.config.js`. Το Next γράφει SWR μόνο όταν
`revalidate < expire` (`server/lib/cache-control.js`) ⇒ πλέον `s-maxage=N` σκέτο, που ο browser
δεν μπορεί να σερβίρει χωρίς ερώτηση. **Η ISR cache του server δεν αλλάζει**: κρίνει παλαιότητα
μόνο με το `revalidate` (`incremental-cache/index.js:355`)· το `expire` διαβάζεται αλλού μόνο για
τον header και για προφίλ `use cache` (δεν χρησιμοποιούμε).

⛔ **Απορρίφθηκαν:**
- *Override του `Cache-Control` από `headers()`/middleware* — το Next τον ξαναγράφει για ISR σελίδες.
- *`deploymentId` του Next* — ήδη απορριφθέν στο Ε0, **και** δεν μπαίνει στο `_rsc` ⇒ δεν θα έλυνε.
- *Κανόνας στο Traefik του Coolify* — ζει έξω από το repo, άρα χωρίς άγκυρα· η ρίζα είναι το config.

### Ε6 — Module που λείπει από τον runtime ⇒ ερώτηση έκδοσης (2026-09-25)

Το Ε5 κλείνει τη **δική μας** αιτία. Μένει το κλασικό skew: καρτέλα ανοιχτή **πριν** το deploy
παίρνει RSC του **νέου** server ⇒ ίδιο σφάλμα, ίδιο σημείο (§3 σημείο 3). Κανένας φορτωτής δεν αποτυγχάνει
⇒ το Ε3 δεν το έβλεπε.

- `missing-module-error.ts` — ταξινόμηση με **τόπο**: `TypeError`, μήνυμα με `call`, **και** πρώτο
  frame μέσα στο `/_next/static/chunks/webpack-*.js` (εκεί η μόνη `.call` σε κάτι που λείπει είναι
  το εργοστάσιο module). Ίδιο μήνυμα από δικό μας κώδικα ⇒ **όχι**.
- `recovery-coordinator.ts` — η κρίση «probe ⇒ skewed ⇒ μία ανανέωση» έγινε το εξαγόμενο
  `resolveBySkew(error, SkewDeps)`· το `recoverChunkLoad` την καλεί μετά τις επαναλήψεις. **Μία** κρίση
  για δύο σήματα, **ένα** σύνολο εξαρτήσεων παραγωγής (`production-skew-deps.ts`) ⇒ το φρένο «μία
  ανανέωση ανά έκδοση» δεν παρακάμπτεται από δεύτερο δρόμο.
- `install-module-skew-recovery.ts` — δύο είσοδοι: `error`/`unhandledrejection` (prefetch, έξω από
  το React) και το `useErrorActions` (κοινό hook **και των δύο** fallback· ο React 19 δεν στέλνει
  στο `window` ό,τι πιάνει boundary).
- ⛔ **ADR-858**: **ποτέ** ανανέωση χωρίς `skewed` από τον server. `same` ⇒ η οθόνη μένει όπως πριν,
  καταγράφεται ως `failed-same-version` — που είναι **ακριβώς** η υπογραφή του Ε5 αν ποτέ ξαναγίνει.

## 5. Επαλήθευση

| Τι | Πώς | Αποτέλεσμα |
|---|---|---|
| Ε2 άγκυρα | `scripts/__tests__/static-asset-caching-contract.test.js` — **εκτελεί** το `next.config.js` σε ξεχωριστή διεργασία (`NODE_ENV=production`, μέσα από `withSentryConfig`) και ταιριάζει με τον `getPathMatch` **του ίδιου του Next** | 5/5 · **μετάλλαξη**: επαναφορά κανόνα `/(.*).js` immutable ⇒ Κ3 κόκκινο |
| Ε3 μηχανή | `src/lib/app-version/chunk-recovery/__tests__/` (coordinator + primitives) | 28/28 |
| Ε5 άγκυρα | ίδιο αρχείο με το Ε2, Λ2 + Κ5: εκτελεί το config και ρωτά τον `getCacheControlHeader` **του ίδιου του Next** για revalidate 1s / 1h / 1 έτος | 7/7 · **μετάλλαξη**: `expireTime: 31536000` ⇒ Κ5 κόκκινο |
| Ε6 σήμα | `__tests__/missing-module-skew.test.ts` — η **αυτούσια** στοίβα του περιστατικού ως δεδομένο· αρνητικά: ίδιο μήνυμα έξω από τον runtime, ReferenceError ADR-858 | 11/11 (σύνολο φακέλου 39/39) · **μετάλλαξη**: αφαίρεση ελέγχου τόπου ⇒ κόκκινο |
| Ε1 διατήρηση | `scripts/__tests__/static-retention.test.js` (καθαρή λογική + CLI σε πραγματικό δίσκο) | 13/13 |

## 6. Δηλωμένα όρια

- 🔶 **Ε5 — υπόλοιπο μίας φοράς.** Όσοι browsers έχουν **ήδη** αποθηκευμένες απαντήσεις με το παλιό
  SWR του ενός έτους θα σερβίρουν την καθεμία **άλλη μία** φορά (το SWR σερβίρει και ανανεώνει στο
  παρασκήνιο· η νέα εγγραφή δεν έχει SWR). Δεν υπάρχει καθαρός τρόπος να αδειάσει ο server cache
  συγκεκριμένων URL του browser (το `Clear-Site-Data` σβήνει **όλα** τα δεδομένα του origin). Αν
  συμβεί σε καρτέλα **ίδιου** build, το Ε6 δεν ανανεώνει (σωστά) — φαίνεται ως `failed-same-version`.
- 🔶 **Ε5 — ζωντανή επιβεβαίωση μετά το push**:
  `curl -s -o /dev/null -D - -A "<UA browser>" https://nestorconstruct.gr/pro | grep -i cache-control`
  ⇒ `s-maxage=…` **χωρίς** `stale-while-revalidate`.

- 🔶 **Η ζωντανή επιβεβαίωση απαιτεί δύο deploys** και γίνεται μόνο στην παραγωγή: το τοπικό
  `next build` είναι αδύνατο σε αυτό το μηχάνημα (ADR-858 §6). Έλεγχοι μετά το push:
  1. `curl -I /_next/static/chunks/doesnotexist.js` ⇒ **404**, `no-store`.
  2. `curl /api/build-info` ⇒ το SHA του commit.
  3. Μετά το **δεύτερο** deploy: ένα chunk του **πρώτου** ⇒ **200**, JavaScript.
  4. Log του βήματος «Carry forward previous static assets» στο Actions ⇒ `κρατούνται N deployments`.
     ⚠️ **ΟΧΙ** μέσω `/_next/static/.retention.json`: επιστρέφει `400` (ο static server του Next
     αρνείται αρχεία με τελεία) — μετρημένο, και σωστό.
  ⚠️ Για κάθε `curl` σε `/api/*`: το middleware μπλοκάρει user-agent `curl/` με `403`
  (`middleware.ts:258`, `BLOCKED_BOT_PATTERNS`). Χρησιμοποίησε `-A` με UA browser — αλλιώς το
  `403` μοιάζει με βλάβη του route ενώ ο κώδικας δεν έτρεξε καν.
  5. Καρτέλα ανοιχτή από το deploy N, deploy N+1, άνοιγμα 3D αγγελίας ⇒ φορτώνει χωρίς σφάλμα.
- 🔶 ~~**Μόνο ο `DirtyFormProvider` δηλώνει μη αποθηκευμένη δουλειά**~~ — **2026-09-22: και οι ανεπιβεβαίωτες εγγραφές Firestore (§Ε3γ)**. Το υπόλοιπο ισχύει για editors με δική τους έννοια «μη αποθηκευμένο» **πριν** φτάσει στο SDK:, και είναι mounted σε **ένα**
  σημείο (`RfqDetailClient.tsx`). Κάθε editor με δική του έννοια «μη αποθηκευμένο» (DXF, φόρμες
  αγγελιών) προσχωρεί στο `unsaved-work-registry` **όταν αγγιχτεί**. Ως τότε ισχύουν τα native
  `beforeunload`.
- 🔶 **Η διατήρηση στηρίζεται στο tag `:latest`** της GHCR. Αν ένα deploy αποτύχει **μετά** το push
  της εικόνας, το επόμενο θα βρει ως «προηγούμενη» μια εικόνα που ίσως δεν σερβιρίστηκε ποτέ — ακίνδυνο
  (απλώς περισσότερα αρχεία), αλλά σημαίνει ότι η αλυσίδα διατήρησης ακολουθεί τα **pushes**, όχι τα
  **deploys** του Coolify.
- 🔶 **Καρτέλα παλαιότερη από 7 ημέρες** (ή μετά από 20 deploys) δεν βρίσκει τα chunks της· εκεί
  αναλαμβάνει το Ε3 (μία ανανέωση). Κάθε τέτοια περίπτωση φαίνεται ως `warn` του `static-asset-miss`.

## 7. Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-09-14 | Δημιουργία. Ε0–Ε4 υλοποιημένα· tests 5 + 28 + 13 πράσινα, μετάλλαξη Ε2 επιβεβαιωμένη. Ζωντανή επιβεβαίωση εκκρεμεί (§6). |
| 2026-09-14 | **Πρώτο deploy (`4dfbbce1`) — ζωντανά, 3 από 5 έλεγχοι του §6 ✅.** (1) `/_next/static/chunks/doesnotexist.js` → **404** · `no-store` · `nosniff` (πριν: `200` + `immutable`). (2) `/api/build-info` → **200** · `no-store` · `{"deploymentId":"4dfbbce1…"}` = HEAD. (4) Carry-forward στο T1: **973 αρχεία (22 MB)** μεταφέρθηκαν, **2** deployments (`4dfbbce1` + `pre-retention`). 🔶 Εκκρεμούν (3) και (5): απαιτούν **δεύτερο** deploy. ⚠️ Δύο διορθώσεις κειμένου από τη μέτρηση: το μανιφέστο **δεν** σερβίρεται (`400`, dotfile) και το `403` σε `curl` ήταν ο φραγμός bots του middleware, όχι το route. Επίσης το namespace του banner διορθώθηκε στο κείμενο σε `common` (ο κώδικας ήταν ήδη σωστός). |
| 2026-09-14 | **Το `instrumentation-client.ts` αναλαμβάνει και το Sentry του browser.** Αφορμή: `ACTION REQUIRED: onRouterTransitionStart` σε κάθε `npm run dev`. Μετρημένο στο `@sentry/nextjs` 10.45: το `sentry.client.config.ts` εισάγεται **μόνο** μέσω του webpack entry (`config/webpack.js`) ⇒ στο `next dev --turbopack` ο client **δεν είχε ποτέ Sentry**, και στο `next build` έβγαινε `DEPRECATION WARNING`. Το `Sentry.init` μεταφέρθηκε **αυτούσιο** (τιμές από το SSoT `config/sentry-config.ts`, ίδιο φίλτρο `selectNode`) μέσα στο αρχείο — όχι σε εισαγόμενο module, γιατί η έγχυση τιμών του SDK στοχεύει `**/instrumentation-client.*`. Προστέθηκε `export const onRouterTransitionStart = Sentry.captureRouterTransitionStart` (επίσημη οδηγία Sentry). Σειρά: Sentry **πριν** το `installChunkRecovery`. Διαγράφηκε το `sentry.client.config.ts`· ενημερώθηκαν `knip.json` (entry) και η άγκυρα `Σ17` του CHECK 3.50, που πλέον **απαιτεί** να υπάρχει το αρχείο αντί να το προσπερνά (αλλιώς η μετακίνηση θα την άφηνε να περνά κενή). Στο dev το SDK μένει `enabled: false` (`SENTRY_ENABLED` = μόνο production) ⇒ κανένας θόρυβος τοπικά. |
| 2026-09-22 | **Ε3γ — ΕΝΑΣ `beforeunload` από το μητρώο.** Νέο `unsaved-work-guard.ts` (εγκατάσταση στο `instrumentation-client.ts`, listener μόνο όσο υπάρχει δουλειά). Ο `DirtyFormProvider` έχασε τον δικό του listener. Δεύτερος ιδιοκτήτης: `firestore:pending-writes` (ADR-367 §2.6). Tests: `unsaved-work-guard.test.ts` 4 + `firestore-pending-writes.test.ts` 7. |
| 2026-09-22 | Νέο `hasUnsavedWorkFrom(ownerId)` στο μητρώο — το διαβάζει η ορατή ένδειξη αποθήκευσης της κεφαλίδας (ADR-367 §2.7). |
| 2026-09-25 | **Ε5 + Ε6 — το RSC άλλου build.** Περιστατικό `TypeError … reading 'call'` στο `/search/results` (αναπαραγμένο, ίδιο build): ο browser σέρβιρε από τη δική του cache RSC του **προηγούμενου** build, λόγω της προεπιλογής του Next `stale-while-revalidate` ενός έτους σε **κάθε** σελίδα. Διαψεύστηκε η υπόθεση του §3 σημείο 3. Ε5: `expireTime: 0` (+ άγκυρα Κ5, μετάλλαξη ✅). Ε6: `missing-module-error` + `resolveBySkew` (μία κρίση για δύο σήματα) + `production-skew-deps` + `install-module-skew-recovery` (window + `useErrorActions`). Tests 7/7 + 39/39, `jscpd:diff` καθαρό. |
