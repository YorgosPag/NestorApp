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
  i18n `errors:appUpdate.*`.

### Ε4 — Παρατηρησιμότητα

- Αφαιρέθηκαν τα `'Loading chunk'` / `'Loading CSS chunk'` από τα αγνοούμενα.
- `chunk-recovery-telemetry.ts`: **ένα** γεγονός ανά περιστατικό με την **έκβαση**, `warning` (όχι
  email στον admin), category `network`, metadata `chunkOutcome` · `chunkUrl` · `skewVerdict` ·
  `clientDeploymentId` · `serverDeploymentId`. Το ErrorTracker τα κρατά και στο `localStorage` ⇒ το
  `reloaded-for-skew` επιβιώνει της ανανέωσης.
- Server: κάθε `/api/static-asset-miss` = γραμμή `warn` στο log.

## 5. Επαλήθευση

| Τι | Πώς | Αποτέλεσμα |
|---|---|---|
| Ε2 άγκυρα | `scripts/__tests__/static-asset-caching-contract.test.js` — **εκτελεί** το `next.config.js` σε ξεχωριστή διεργασία (`NODE_ENV=production`, μέσα από `withSentryConfig`) και ταιριάζει με τον `getPathMatch` **του ίδιου του Next** | 5/5 · **μετάλλαξη**: επαναφορά κανόνα `/(.*).js` immutable ⇒ Κ3 κόκκινο |
| Ε3 μηχανή | `src/lib/app-version/chunk-recovery/__tests__/` (coordinator + primitives) | 28/28 |
| Ε1 διατήρηση | `scripts/__tests__/static-retention.test.js` (καθαρή λογική + CLI σε πραγματικό δίσκο) | 13/13 |

## 6. Δηλωμένα όρια

- 🔶 **Η ζωντανή επιβεβαίωση απαιτεί δύο deploys** και γίνεται μόνο στην παραγωγή: το τοπικό
  `next build` είναι αδύνατο σε αυτό το μηχάνημα (ADR-858 §6). Έλεγχοι μετά το push:
  1. `curl -I /_next/static/chunks/doesnotexist.js` ⇒ **404**, `no-store`.
  2. `curl /api/build-info` ⇒ το SHA του commit.
  3. Μετά το **δεύτερο** deploy: ένα chunk του **πρώτου** ⇒ **200**, JavaScript.
  4. `/_next/static/.retention.json` ⇒ δύο deployments.
  5. Καρτέλα ανοιχτή από το deploy N, deploy N+1, άνοιγμα 3D αγγελίας ⇒ φορτώνει χωρίς σφάλμα.
- 🔶 **Μόνο ο `DirtyFormProvider` δηλώνει μη αποθηκευμένη δουλειά**, και είναι mounted σε **ένα**
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
