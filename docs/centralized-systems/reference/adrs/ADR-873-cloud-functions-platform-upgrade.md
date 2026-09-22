# ADR-873 — Αναβάθμιση πλατφόρμας Cloud Functions: **ίδια ονόματα, ίδια γενιά — πρώτα η βάση, μετά η μετακόμιση**

| Πεδίο | Τιμή |
|---|---|
| **Category** | Infrastructure |
| **Status** | ACCEPTED — **Φάση 0 ΥΛΟΠΟΙΗΜΕΝΗ** (2026-09-22, όχι ακόμη committed, **όχι ακόμη deployed**) · Φάσεις 1-2 **ΔΕΝ** εγκρίθηκαν |
| **Date** | 2026-09-22 |
| **Προηγούμενα** | ADR-029 *(search index — μοναδικός writer η Cloud Function)* · ADR-032 *(κάδος / `scheduledFilePurge`)* · ADR-694 *(mark-and-sweep Storage)* · ADR-800 *(CHECK 3.65, μία έκδοση)* · ADR-865 *(commit ≠ deploy)* |
| **Handoff** | `HANDOFFS/2026-09-19_firebase-functions-phase0_handoff.md` (έγκριση Giorgio 2026-09-19 για τη Φάση 0) |
| **Αυθεντία** | ο κώδικας. Όπου αυτό το ADR διαφωνεί με τον κώδικα, κερδίζει ο κώδικας |

---

## 1. Το πρόβλημα

Το `functions/` έμεινε δύο major εκδόσεις πίσω, πάνω σε έναν στόχο μεταγλώττισης που η τρέχουσα βιβλιοθήκη **δεν
υποστηρίζει πια**. Μετρημένα στις 2026-09-19 (CLI/gcloud μόνο ανάγνωση, GitHub releases, επίσημα docs):

| | Πριν | Τελευταία |
|---|---|---|
| `firebase-functions` | `^5.1.0` (εγκατ. **5.1.1**) | **7.4.0** (MIT, node ≥18, peer admin `^11‖^12‖^13‖^14`) |
| `firebase-admin` | `^12.7.0` | **14.4.0** (Apache-2.0, node ≥22) — 13.x τελευταία: **13.10.0** |
| `tsconfig.target` | **`es2017`** | η v7 ζητά **ES2022** |
| Runtime | nodejs22 | — |

**Ανεπτυγμένες** (`firebase functions:list`, `pagonis-87766`): **22 × 1st gen**, όλες `us-central1`, nodejs22 —
11 search triggers · `auditContactWrite` · `materialPriceSyncOnPODelivery` · `onDeleteFloorplanBackground` ·
`onPropertyWriteFloorUnits` · `onStorageFinalize` · `onDxfProcessedFinalize` · `scheduledFilePurge` ·
`orphanSweeper` · `orphanSpikeAlert` · `manualPurgeFile` · `getTrashStats`. Επιπλέον **`ssrpagonis87766`**
(2nd gen, https, **nodejs20**) — **δεν υπάρχει στον κώδικα** (λείψανο του παλιού Firebase Hosting SSR).

**Breaking changes που μας αφορούν** (πρωτογενής πηγή: GitHub releases):
- **v6.0.0** — *«Change default entrypoint of the firebase-functions package to v2 instead of v1»*: το
  `import * as functions from 'firebase-functions'` σημαίνει πλέον **v2**· το v1 API ζει στο **`firebase-functions/v1`**.
- **v7.0.0** — αφαίρεση `functions.config()` (grep: **0** χρήσεις) · Node ≥18 · **TypeScript 5 + target ES2022** ·
  rename v1 `Event` → `LegacyEvent` (grep: **0** χρήσεις του `Event`· το `EventContext` **μένει**).
- **v7.3.0** — έλεγχος `timeoutSeconds` μόνο v2 · *«fix(v1): Call onInit for schedule.onRun»*.
- **firebase-admin v13** — αφαίρεση deprecated FCM APIs (grep: **0**) · Node 18.
- **firebase-admin v14** (ΟΧΙ εδώ) — αφαίρεση του **legacy namespace** (`admin.firestore()` κ.λπ., σε **13** αρχεία).

## 2. Τι κάνουν οι μεγάλοι

Η αρχή: **«αναβάθμιση βάσης»** χωριστά από **«αλλαγή ταυτότητας/τοποθεσίας»** — πρώτα το ίδιο αντικείμενο σε νέα
βάση, με **μηδέν** αλλαγή συμπεριφοράς· μετά, χωριστά και αναστρέψιμα, η μετακόμιση. Για τις Cloud Functions η
πρωτογενής πηγή είναι η ίδια η Google, και το λέει ρητά:
- Το in-place update είναι δυνατό **μόνο** όταν μένουν **ίδιο όνομα + ίδια γενιά**. Η μετάβαση 1st → 2nd gen ή η
  αλλαγή region **απαιτεί νέο όνομα** (firebase.google.com/docs/functions/2nd-gen-upgrade) — δηλαδή για λίγο **δύο**
  συναρτήσεις ζωντανές στο ίδιο γεγονός ⇒ θέμα ιδεμποτίας (βλ. §6).
- Το v1 API **υποστηρίζεται** στην v7 μέσω του `firebase-functions/v1` — είναι ο επίσημος δρόμος αναβάθμισης SDK
  **χωρίς** αλλαγή γενιάς.

Άρα: **Φάση 0 = ίδια ονόματα, ίδια γενιά, νέα βάση**. Το deploy της είναι ενημέρωση επί τόπου — καμία διπλή
εκτέλεση, κανένα κενό.

## 3. Απόφαση — τρεις φάσεις

| Φάση | Τι | Κατάσταση |
|---|---|---|
| **0** | `firebase-functions` 7.x · `firebase-admin` **13.x** · imports → `firebase-functions/v1` · `target es2022` · αφαίρεση νεκρών callables | ✅ **ΥΛΟΠΟΙΗΜΕΝΗ** (§4) — deploy = απόφαση Giorgio (§5) |
| **1** | 2nd gen · Firestore/scheduled → `europe-west1` (Firestore = **eur3**) · Storage → `us-east1` (bucket `pagonis-87766.firebasestorage.app` = **US-EAST1**) · **με μετονομασία** | ⏸️ **ΔΕΝ εγκρίθηκε** |
| **2** | `firebase-admin` 14 · modular imports (`firebase-admin/firestore` κ.λπ.) σε 13 αρχεία | ⏸️ **ΔΕΝ εγκρίθηκε** |

**Γιατί admin 13 και όχι 14 στη Φάση 0**: η 14 αφαιρεί το legacy namespace ⇒ αγγίζει **13 αρχεία** κώδικα
συμπεριφοράς. Η Φάση 0 υπόσχεται μηδέν αλλαγή συμπεριφοράς· η 14 ανήκει στη Φάση 2.

**Σχέση με το CHECK 3.65 (μία έκδοση)**: το `functions/` **δεν** είναι μέλος του pnpm workspace
(`pnpm-workspace.yaml`: `.` · `packages/*` · `src/subapps/*`) — είναι **χωριστή μονάδα ανάπτυξης** με δικό της
`package-lock.json` (npm), όπως το προβλέπει το Firebase (`firebase.json` → `source: functions`). Η ρίζα μένει σε
`firebase-admin ^12.6.0` (Next.js server) — δύο διαφορετικά runtimes, δύο διαφορετικά deploys· η απόκλιση είναι
**δηλωμένη**, όχι τυχαία. Ευθυγράμμιση ρίζας = ξεχωριστή απόφαση.

## 4. Φάση 0 — τι άλλαξε

| Αρχείο | Αλλαγή |
|---|---|
| `functions/package.json` | `firebase-functions ^5.1.0 → ^7.4.0` · `firebase-admin ^12.7.0 → ^13.10.0` (N.5: MIT / Apache-2.0 ✅) |
| `functions/package-lock.json` | `npm install` + `npm audit fix` (**χωρίς** `--force` — μόνο μεταβατικές εξαρτήσεις εντός ήδη δηλωμένων ευρών) |
| `functions/tsconfig.json` | `target: es2017 → es2022`. Το ES2022 ενεργοποιεί `useDefineForClassFields` — grep: **0** κλάσεις στο `functions/src` ⇒ μηδέν σημασιολογική αλλαγή |
| 10 αρχεία `functions/src/**` | `from 'firebase-functions'` → `from 'firebase-functions/v1'` — **καμία** αλλαγή υπογραφής handler. Τύποι που χρησιμοποιούνται (`Change`, `EventContext`, `firestore.DocumentSnapshot`, `storage.ObjectMetadata`, `https.HttpsError`, `logger`, `runWith`, `pubsub.schedule`) **επαληθεύτηκαν** στο `lib/v1/*.d.ts` της 7.4.0 |
| 2 tests (`orphan-cleanup`, `orphan-sweeper`) | `jest.mock('firebase-functions')` → `jest.mock('firebase-functions/v1')` — αλλιώς το mock **δεν** θα έπιανε το νέο specifier |
| `functions/src/index.ts` | **Αφαίρεση** `manualPurgeFile` + `getTrashStats` (−166 γραμμές). Grep σε όλο το repo: **0** καταναλωτές. 🔴 Το `getTrashStats` έκανε `data.companyId \|\| context.auth.token.companyId` ⇒ **οποιοσδήποτε** συνδεδεμένος χρήστης έπαιρνε στατιστικά κάδου **άλλης εταιρείας**. Τα `HOLD_TYPES` / `purgeFile` μένουν (τα χρησιμοποιεί το `scheduledFilePurge`) |
| `functions/src/search/search-config.mirror.ts` | **Εύρημα Ε-873.1** (§7) — ευθυγράμμιση με το SSoT |

**Επαλήθευση**: `npx jest functions/src` → **7/7 σουίτες, 80/80 tests** · `node scripts/check-search-config-sync.js`
→ ✅ in sync · **όχι** `tsc` (N.17 — το χτίζει το `predeploy` του `firebase.json`: `npm --prefix functions run build`).
Firebase CLI τοπικά: **15.13.0**.

**Ευπάθειες** (`npm audit`, `functions/`): **19** πριν (2 critical · 3 high) → **8 moderate** μετά (0 critical · 0 high).
Και οι 8 έχουν **μία** ρίζα: `uuid` (*«Missing buffer bounds check in v3/v5/v6 when buf is provided»*) μέσα στην
αλυσίδα `@google-cloud/firestore` / `@google-cloud/storage` / `google-gax`. Ο κώδικάς μας **δεν** καλεί `uuid` με
`buf`. Η πρόταση του `npm audit` («`firebase-admin@12.1.0` MAJOR») είναι **υποβάθμιση** και απορρίφθηκε· η
πραγματική λύση περνά από τη Φάση 2.

## 5. Deploy — runbook (ΜΟΝΟ με εντολή Giorgio)

```
firebase deploy --only functions
```

- Το `predeploy` χτίζει (`tsc` → `functions/lib`). Αν αποτύχει, **τίποτα** δεν ανεβαίνει.
- Οι 20 συναρτήσεις που μένουν στον κώδικα ενημερώνονται **επί τόπου** (ίδιο όνομα, ίδια γενιά, ίδιο region).
- ⚠️ Το CLI θα **ρωτήσει** αν θα διαγράψει όσες υπάρχουν στο cloud αλλά όχι στον κώδικα: σίγουρα
  `manualPurgeFile` + `getTrashStats`, και **ενδεχομένως** το `ssrpagonis87766` (αν ανήκει στο codebase `default` —
  **δεν** επαληθεύτηκε). Η ερώτηση είναι **όλα ή τίποτα**. Το `--force` διαγράφει **χωρίς** ερώτηση ⇒ **μην** το
  χρησιμοποιήσεις όσο η απόφαση για το `ssrpagonis87766` είναι ανοιχτή.
  - Αν η λίστα περιέχει **μόνο** τα δύο → «Yes».
  - Αν περιέχει και το `ssrpagonis87766` → «No» (το deploy συνεχίζει), και μετά
    `firebase functions:delete manualPurgeFile getTrashStats --region us-central1`.
- Μετά το deploy: τα `search_documents` των **parking/storage** παίρνουν τα νέα `searchableFields` (Ε-873.1) **στην
  επόμενη εγγραφή** κάθε οντότητας. Backfill των υπαρχόντων = χωριστή απόφαση.
- **Επαναφορά**: `git revert` + ξανά `firebase deploy --only functions` (ίδια ονόματα ⇒ επίσης επί τόπου).

## 6. Ανοιχτές αποφάσεις Giorgio (ΔΕΝ υλοποιούνται χωρίς ρητό «ναι»)

1. **`ssrpagonis87766`** (2nd gen, Node 20 EOL, εκτός κώδικα) → διαγραφή από το cloud;
2. **`@resvg/resvg-js` 2.6.2 = MPL-2.0** — εκτός λίστας N.5 (MIT/Apache/BSD)· προϋπάρχον, για τις μικρογραφίες DXF.
3. **Φάση 1** — ⚠️ το `auditContactWrite` **δεν είναι ιδεμποτητικό** (`generateEntityAuditId()` ανά κλήση): στο
   παράθυρο που ζουν παλιό + νέο όνομα, κάθε αλλαγή επαφής θα γράφει **δύο** εγγραφές audit. Χρειάζεται ντετερμινιστικό
   ID από το `eventId` **πριν** τη μετονομασία.
4. **Φάση 2** — admin v14 + modular imports.
5. Ευρήματα παραγωγής Ε1-Ε3 (ADR-777 §8.60.20.11).

## 7. Ευρήματα αυτής της εργασίας

- **Ε-873.1 — το mirror του search index είχε αποκλίνει από το SSoT από 2026-05-02 (ΔΙΟΡΘΩΘΗΚΕ).**
  Το `4bd107bd` *«remove raw enum 'type' from storage/parking searchableFields»* άλλαξε **μόνο** το
  `src/config/search-index-config.ts` (`['number','type','notes']` → `['number','code']`, ομοίως storage με `name`).
  Όμως ο **μοναδικός writer** του `search_documents` (ADR-029) είναι η Cloud Function, που διαβάζει το
  **`functions/src/search/search-config.mirror.ts`** ⇒ η διόρθωση **δεν έφτασε ποτέ στην παραγωγή**: για ~5 μήνες
  η παραγωγή ευρετηρίαζε ωμές αγγλικές τιμές enum (`sto`/`stor`/`stora`…) και **όχι** τον κωδικό. Διόρθωση: 2 γραμμές
  στο mirror, `check-search-config-sync.js` → ✅.
- **Ε-873.2 — ο έλεγχος mirror δεν τρέχει σε καμία πύλη.** Το `scripts/check-search-config-sync.js` (`npm run
  search-config:sync`) **δεν** καλείται από hook, `.husky` ή `.github/workflows` (grep: 0). Φρουρός που κανείς δεν
  τρέχει είναι σχόλιο — γι' αυτό το Ε-873.1 έζησε 5 μήνες. Καταχωρήθηκε στο `.claude-rules/pending-ratchet-work.md`.

## 8. Google-level

✅ **Google-level: YES** — ίδια ονόματα + ίδια γενιά ⇒ ενημέρωση επί τόπου χωρίς διπλή εκτέλεση· μηδέν αλλαγή
υπογραφής· τύποι επαληθευμένοι στα `.d.ts` της ακριβούς έκδοσης· 80/80 tests· κλειστή διαρροή μεταξύ εταιρειών στον
κώδικα· 19 → 8 ευπάθειες. Το **ανοιχτό υπόλοιπο** (διαγραφή από το cloud, Φάσεις 1-2) είναι **δηλωμένο** στις §5-§6
και είναι απόφαση Giorgio, όχι κενό.

## Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-09-22 | Δημιουργία. Φάση 0 υλοποιημένη (§4)· runbook deploy (§5)· Ε-873.1 διορθώθηκε, Ε-873.2 → pending-ratchet. |
