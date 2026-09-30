# ADR-895 — Τοποθεσία δεδομένων αρχείων (data residency): **θέση ανά `FileRecord`**, **ΕΝΑΣ** επιλογέας κάδου

**Κατάσταση**: ✅ **ΕΓΚΡΙΘΗΚΕ** (Giorgio 2026-09-30) · Ε1–Ε5 αποφασισμένα (§6) · **Φ0 ✅ κώδικας + άγκυρες** (§7.1, καμία αλλαγή παραγωγής) · **Φ1 ✅ κάδος ως κώδικας + ΓΕΝΝΗΘΗΚΕ** (§7.2, `--apply` με «ναι» 2026-09-30) · **Φ2 ✅ κώδικας + άγκυρες** (§7.3, gen2 `europe-west3`· ⏳ deploy με «ναι») · Φ3–Φ6
**Ημερομηνία**: 2026-09-30 · **Μοντέλο**: Opus · **Τρόπος**: Orchestrator (3 πράκτορες ανάγνωσης: audit θέσης κάδου · audit backup/Functions/κανόνων · έρευνα) + σύνθεση
**Προέλευση**: ADR-884 §4.15 «Εκτός ζ5α» + §12 **Δ11.8** («θέση ανά `FileRecord`, χωριστό ADR»)
**Σχετικά**: ADR-884 (ζ5α πρότυπο `tourMediaBucket`) · ADR-694 (φύλαξη/ορφανά — «ΕΝΑΣ κάδος») · ADR-709 (αμετάβλητο storage path) · ADR-864 §21 (holds/purge) · ADR-851 (IaC + δίχτυ απόκλισης) · ADR-874 (προβολή SSoT στα Cloud Functions) · ADR-841/845 (δημόσιο ράφι, 2ος κάδος)

---

## 1. Το πρόβλημα

Κάθε πρωτότυπο αρχείο (`FileRecord`, πεδίο `storagePath`) ζει σε **έναν** κάδο: τον κανονικό
`pagonis-87766.firebasestorage.app`, **US-EAST1**. Σε αυτόν βρίσκονται πανοράματα εσωτερικών σπιτιών με πρόσωπα,
ταυτότητες, συμβόλαια, αποδείξεις εντολών: **προσωπικά δεδομένα Ελλήνων** σε **λάθος ήπειρο** (GDPR Κεφ. V) και με
~400 ms ανά ανάγνωση από τον server (Netcup, Νυρεμβέργη — ADR-884 §4.15: p50 405 ms).

Η ζ5α έλυσε το ίδιο πρόβλημα για τα **παράγωγα** (πλακίδια) με θέση **ανά περιήγηση**. Τα **πρωτότυπα** δεν
μπορούν να λυθούν έτσι, γιατί ο γενικός μηχανισμός αρχείων **υποθέτει σιωπηρά έναν κάδο**. Αυτό δεν είναι αρχή
γραμμένη κάπου: είναι **σαράντα διάσπαρτες κλήσεις** `getAdminBucket()` / `.bucket()`, καμία από τις οποίες δεν ρωτά την εγγραφή.

## 2. SSoT audit (grep, 2026-09-30 — επαληθευμένο στον κώδικα)

### 2.1 Μέτρηση
| Τι | Πλήθος |
|---|---|
| Αρχεία server με `getAdminBucket(` (χωρίς tests) | **29** σε 22 φακέλους |
| Αρχεία που ανοίγουν κάδο **παρακάμπτοντας** τον επιλογέα (`admin.storage().bucket()` / `getStorage().bucket()` / ωμό `FIREBASE_STORAGE_BUCKET`) | **13** (+3 που φτιάχνουν τον κάδο από env) |
| Cloud Functions δεμένα **σιωπηρά** στον κανονικό κάδο | **4** (`onStorageFinalize`, `onDxfProcessedFinalize`, `orphanSweeper`, `onDeleteFloorplanBackground`) |
| Αρχεία client με `firebase/storage` | 24 (**9** ανεβάζουν/διαβάζουν πρωτότυπα `FileRecord`) |
| Αναγνώστες `.storagePath` / `.downloadUrl` | 69 / 58 |
| Πεδίο κάδου στο `FileRecord` | **κανένα** |

### 2.2 Πού αποφασίζεται σήμερα «σε ποιον κάδο είναι το αρχείο»

**Με την εγγραφή στο χέρι** (η αλλαγή είναι τοπική):
`app/api/files/_shared/owned-file-bytes.ts:218` (ο **ένας** βοηθός για `download` · `batch-download` · `files/[id]/download`) ·
`files/[fileId]/excel-preview/route.ts:149` · `floorplans/process/route.ts:92` και `floorplans/scene/{route,scene-fetcher}.ts` (**παρακάμπτουν** το
`getAdminBucket()`, χτίζουν κάδο από env) · `services/floorplans/dxf-thumbnail-selfheal.ts:127,174` · `server/spatial-tour/tour-plan-prepare.ts:72` ·
`server/spatial-tour/tour-tileset-baker.ts:96` (`readOriginal` → `getAdminBucket()`) · `server/spatial-tour/tour-capture-finalize.ts:216` (αντιγραφή καραντίνας → κανονικός).

**Μόνο με συμβολοσειρά path** (χρειάζεται να περαστεί η θέση):
`lib/storage/signed-download-url.ts:133` (**δεν** δέχεται κάδο) · `lib/storage/storage-object-stream.ts` και
`lib/storage/resumable-upload-session.ts` (**δέχονται ήδη** προαιρετικό `bucket` — ζ5α) ·
`services/file-record/file-hold.service.ts:163,196` (**δέχεται ήδη** `bucket`) · `services/file-record/file-purge-helpers.ts:96`
(`getAdminStorage().bucket()` — **παρακάμπτει** και το `getAdminBucket()`) · `lib/firestore/deletion-storage-cleanup.ts:57` (σάρωση προθέματος) ·
`services/property-media/property-media.service.ts:215` · `services/listings/public-shelf{,-model}.service.ts` (ανάγνωση ιδιωτικής πηγής).

**Δεν είναι πρωτότυπα `FileRecord`** (εκτός εμβέλειας, μένουν όπως είναι): asset-packs · showcase PDF/παραγόμενα · δημόσιο ράφι (δικός του κάδος) ·
ingestion πριν γεννηθεί `FileRecord` (email/Telegram) · εφάπαξ admin migrations.

### 2.3 🔴 Τι **σπάει σιωπηλά** αν ένα πρωτότυπο βρεθεί σε 2ο κάδο (μετρημένο, ταξινομημένο κατά σοβαρότητα)

| # | Σημείο | Αποτυχία | Γιατί σιωπηλή |
|---|---|---|---|
| Ρ1 | `file-purge-helpers.ts` `deleteStorageObjectForPurge` | η εγγραφή γίνεται **`purged`**, τα bytes στην ΕΕ **μένουν** | 404 στον λάθος κάδο = «`absent`, λείπουν ήδη» (ADR-864 §21) ⇒ **αποτυχημένη διαγραφή GDPR** που η βάση δηλώνει επιτυχημένη |
| Ρ2 | `file-hold.service.ts` `setTemporaryHold` | η βάση λέει **«δεσμευμένο»**, τα bytes **ξεκλείδωτα** | το 404 αγνοείται ρητά ⇒ ψευδής νομική δέσμευση |
| Ρ3 | `functions/.../onDeleteFloorplanBackground.ts:90` | σβήνει το `files/{id}` ενώ τα bytes μένουν ⇒ **χάνεται ο μόνος δείκτης** | η αποτυχία διαγραφής καταγράφεται και η ροή συνεχίζει |
| Ρ4 | `services/backup/storage-{backup,restore}.service.ts` | ο 2ος κάδος **δεν μπαίνει στο backup** | απαριθμεί `getAdminStorage().bucket()` ολόκληρο· καμία αναφορά σε άλλον |
| Ρ5 | `onStorageFinalize` / `orphanSweeper` (ADR-694) | κανένα ορφανό στην ΕΕ δεν σημαδεύεται ποτέ | gen1 `.storage.object()` = **μόνο** κανονικός κάδος (ασφαλές, αλλά ορφανά συσσωρεύονται για πάντα) |
| Ρ6 | `onDxfProcessedFinalize` | καμία μικρογραφία DXF για αρχείο στην ΕΕ | ίδιος λόγος |
| Ρ7 | `app/api/download/route.ts:159` (SSRF) | νόμιμο URL του 2ου κάδου απορρίπτεται ως «ξένος κάδος» | ισότητα με **ένα** όνομα |
| Ρ8 | `storage.rules` / `.firebaserc` | ο 2ος κάδος **δεν έχει κανόνες** | ένας στόχος `main` → μόνο ο κανονικός (σωστό για κάδο μόνο-server) |
| Ρ9 | 9 αρχεία client (`upload-entity-file`, `floorplan-save-orchestrator`, `photo-upload.service`, `image-asset-upload`, `PDFProcessor`, `resumable-upload`, `useCrmAttachmentUpload`, `useOwnerPropertyMedia`, `upload-orchestrator-gateway`) | ανεβάζουν **πάντα** στον κάδο του client config | ο client SDK έχει έναν κάδο ανά instance |

**Ρίζα όλων**: το `FileRecord` **δεν ξέρει** πού ζουν τα bytes του. Κάθε αναγνώστης το **μαντεύει**, και όλοι μαντεύουν
το ίδιο μόνο επειδή σήμερα υπάρχει μία σωστή απάντηση. Είναι το σχήμα που η ζ5α απαγόρευσε («ποτέ σιωπηλό fallback»).

Άλλα ευρήματα: ο κάδος backup είναι **ήδη** `EUROPE-WEST1` (`config/gcs-buckets.ts:179`) ⇒ backup πρωτοτύπων ΕΕ εκεί **δεν**
εισάγει νέα μεταφορά εκτός ΕΕ ✅ · τα πρωτότυπα περιήγησης έχουν `downloadUrl = buildProxyUrl(storagePath)` (proxy, **όχι** token URL) ⇒ μετάβασή τους
χωρίς αλλαγή URL ✅ · το `@enterprise ADR-031 - Canonical File Storage` στο `types/file-record.ts:9` είναι **μπαγιάτικο** (το ADR-031 είναι Undo/Redo — Boy Scout στην Φ0).

## 3. Έρευνα (2026-09-30, με πηγές)

1. **Τοποθεσία**: ο **περιφερειακός** κάδος δεσμεύει τα δεδομένα σε ηρεμία σε μία περιοχή· τα **μεταδεδομένα** (ονόματα αντικειμένων, IAM) **εξαιρούνται** ρητά από την εγγύηση [GCS regional endpoints](https://docs.cloud.google.com/storage/docs/regional-endpoints) ·
   [Assured Workloads data residency](https://docs.cloud.google.com/assured-workloads/docs/data-residency). ⇒ **Κανένα προσωπικό δεδομένο σε `storagePath`** (ADR-709 ήδη: μόνο ids ✅).
2. **GDPR Κεφ. V**: αποθήκευση στις ΗΠΑ = διαβίβαση (Άρθ. 44). Η Google είναι πιστοποιημένη στο EU-US DPF [dataprivacyframework.gov](https://www.dataprivacyframework.gov/participant/5780)· το Γενικό Δικαστήριο απέρριψε
   την προσφυγή *Latombe* (3/9/2025) [IAPP](https://iapp.org/news/a/european-general-court-dismisses-latombe-challenge-upholds-eu-us-data-privacy-framework), αλλά **εκκρεμεί αναίρεση στο ΔΕΕ (C-703/25 P)** [WilmerHale](https://www.wilmerhale.com/en/insights/blogs/wilmerhale-privacy-and-cybersecurity-law/20251201-european-court-of-justice-to-review-challenge-to-eu-us-data-privacy-framework).
   ⇒ Σήμερα νόμιμο, αλλά με δικαστικό ρίσκο (Schrems II ακύρωσε τον προκάτοχο)· **η ΕΕ ως προεπιλογή εξαλείφει το ρίσκο**, δεν το διαχειρίζεται.
3. **Firebase**: πολλοί κάδοι ανά project, κανόνες **ανά κάδο** μέσω `firebase.json` targets, client `getStorage(app, 'gs://…')` [Firebase docs](https://firebase.google.com/docs/storage/web/start)· γνωστά bugs CLI/emulator στο multi-bucket
   ([#4752](https://github.com/firebase/firebase-tools/issues/4752), [#3554](https://github.com/firebase/firebase-tools/issues/3554)). Η τοποθεσία του κανονικού κάδου **δεν αλλάζει** ⇒ νέος κάδος.
4. **Μετάβαση**: `rewrite` μέσα στο Google για < 1 TB, Storage Transfer Service για > 1 TB ή συνεχή συγχρονισμό· κανένα «move» μεταξύ κάδων — copy → verify → delete
   [STS move guide](https://docs.cloud.google.com/storage-transfer/docs/move-your-cloud-storage-data-to-another-location) · crc32c επαληθεύεται στον server [Data validation](https://docs.cloud.google.com/storage/docs/data-validation) ·
   τα `firebaseStorageDownloadTokens` **δεν** πρέπει να αντιγράφονται — νέο token στο νέο αντικείμενο [firebase/extensions#323](https://github.com/firebase/extensions/issues/323).
5. **Triggers**: gen1 δένεται σε **έναν** κάδο· gen2/Eventarc: ο trigger **πρέπει να είναι στην ίδια περιοχή με τον κάδο** [Eventarc locations](https://docs.cloud.google.com/eventarc/docs/understand-locations).
   ⚠️ Και πιο λεπτό: function στο `us-central1` που **κατεβάζει** bytes ΕΕ (π.χ. μικρογραφία DXF) = **επεξεργασία στις ΗΠΑ** ⇒ ακυρώνει την τοποθεσία.
6. **Backup**: STS scheduled jobs + soft delete/versioning ανά κάδο· το Google Backup and DR **δεν επαληθεύτηκε** ότι δέχεται κάδο GCS ως πηγή. Backup δεδομένων ΕΕ σε κάδο ΗΠΑ = ίδια διαβίβαση.
7. **Οι μεγάλοι**: **Atlassian** — «pinning» ανά οργανισμό/προϊόν, μετάβαση σε **παράθυρο με διακοπή** [Atlassian](https://developer.atlassian.com/cloud/jira/platform/data-residency-migrations) ·
   **Box Zones** — ανά χρήστη/οργανισμό [Box](https://www.box.com/zones) · **Figma** — ανά οργανισμό [Figma](https://www.figma.com/blog/eu-hosting-for-figma-and-figjam-files/) ·
   **Dropbox** — ανά ομάδα [Dropbox](https://help.dropbox.com/security/dropbox-sign-data-residency) · **Autodesk ACC** — ανά hub, **κατά τη δημιουργία**, μετάβαση με χωριστό εργαλείο (Replication Tool)
   [Autodesk](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Where-are-the-ACC-BIM-360-data-centers-hosted.html) · **Matterport** — δημόσια δέσμευση τοποθεσίας ΕΕ **δεν βρέθηκε** (ανεπιβεβαίωτο).
   **Κοινό μοτίβο**: η πολιτική αποφασίζεται **χοντρικά** (οργανισμός/hub) **κατά τη δημιουργία**, και η μετάβαση είναι **έργο με παράθυρο**, όχι ζωντανή.
8. **Soft delete · holds · GDPR (έρευνα Φ1, 2026-09-30)**:
   - Το `temporaryHold` είναι μεταδεδομένο **αντικειμένου** — καμία ρύθμιση κάδου· «the object cannot be deleted or replaced»
     [object-holds](https://docs.cloud.google.com/storage/docs/object-holds). Το soft delete είναι **επιπλέον** στρώμα, **μετά** τη
     διαγραφή [soft-delete](https://docs.cloud.google.com/storage/docs/soft-delete) ⇒ τα holds (Ρ2) δουλεύουν στον νέο κάδο χωρίς αλλαγή.
   - 🔴 **«Object holds are not supported for buckets that use hierarchical namespace»** (ίδια πηγή) ⇒ κάδος HNS θα έσπαγε **σιωπηλά**
     κάθε νομική δέσμευση (ADR-864). Γι' αυτό το HNS είναι **αναλλοίωτο** του μηχανισμού (§7.2) και απόκλισή του **αναφέρεται**.
   - **Object Retention Lock** (`retention: Locked` των αποδεικτικών): ενεργοποιείται και σε υπάρχοντα κάδο (μόνο κονσόλα) αλλά
     **δεν απενεργοποιείται ποτέ** [object-lock](https://docs.cloud.google.com/storage/docs/object-lock). Τα αποδεικτικά μένουν ρητά
     στον κανονικό (`attestation-evidence.ts`) ⇒ **όχι** στο `files-eu` τώρα (§10).
   - **Soft delete ↔ διαγραφή GDPR**: soft-deleted αντικείμενο **δεν** σβήνεται πρόωρα — ούτε με απενεργοποίηση της πολιτικής, που
     αφήνει τα ήδη διαγραμμένα ως τη λήξη της προηγούμενης διάρκειας [disable-soft-delete](https://docs.cloud.google.com/storage/docs/disable-soft-delete)·
     εύρος 7–90 ημέρες. Άρθ. 12(3)/17: «χωρίς αδικαιολόγητη καθυστέρηση, **το αργότερο εντός ενός μηνός**»· ό,τι δεν σβήνεται αμέσως
     πρέπει να είναι **«beyond use»** [ICO](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/).
     ⇒ **Δήλωση πολιτικής**: η διαγραφή των bytes ολοκληρώνεται **το αργότερο T+7 ημέρες** (≪ 1 μήνας)· στο μεσοδιάστημα είναι εκτός
     χρήσης — καμία εγγραφή δεν τα αναφέρει, **κανένας** κώδικας δεν καλεί `restore`, η επαναφορά θέλει ρόλο IAM διαχειριστή. Το 7 είναι
     το **ελάχιστο** μη μηδενικό της GCS ⇒ το πιο σφιχτό δίχτυ που υπάρχει.
9. **Functions gen2 για μη-default κάδο (έρευνα Φ2, 2026-09-30 — πηγή + κώδικας βιβλιοθήκης, όχι μνήμη)**:
   - gen1 και gen2 **συνυπάρχουν** στο ίδιο αρχείο/codebase· αλλαγή γενιάς με **ίδιο** όνομα είναι **αδύνατη** στο deploy
     [2nd-gen-upgrade](https://firebase.google.com/docs/functions/2nd-gen-upgrade) ⇒ νέα ονόματα, ο gen1 κανονικός μένει ως έχει.
   - Όνομα κάδου **χωρίς χειρόγραφο string**: `firebase-functions@7.4.0` έχει `expr` + ενσωματωμένο `projectID` (`params/index.d.ts`)·
     το `onObjectFinalized` δέχεται `Expression<string>`· το wire manifest το γράφει ως CEL (`runtime/manifest.js` `stackToWire` → `toCEL`)
     και το CLI 15.13 το επιλύει στο deploy (`deploy/functions/build.js` → `eventFilters` → `params.resolveString`). ⚠️ Το
     `JSON.stringify` του endpoint δίνει `"[object Object]"` — **μετρήθηκε**· η αλήθεια είναι το `toCEL()`, αυτό ελέγχει η άγκυρα.
   - Περιοχή: «The Cloud Storage bucket must reside in the same Google Cloud project and region as the Eventarc trigger»
     [Eventarc](https://docs.cloud.google.com/eventarc/docs/run/create-trigger-storage-gcloud). 🏆 Δίχτυ δωρεάν: το CLI
     (`services/storage.js` `ensureStorageTriggerRegion`) **αρνείται το deploy** αν η περιοχή της function ≠ του κάδου.
   - Δικαιώματα: ο service agent του GCS χρειάζεται `roles/pubsub.publisher` και ο λογαριασμός του trigger `roles/eventarc.eventReceiver`
     (ίδια πηγή)· το CLI τα **χορηγεί μόνο του** στο deploy (`obtainStorageBindings` → `checkIam.ensureServiceAgentRoles`).
   - 🔴 **Concurrency**: gen2 = **80** γεγονότα ανά instance (cpu 1 για ≤2GB) [2nd-gen-upgrade]. Ραστεροποίηση DXF (resvg, όλη η
     σκηνή στη μνήμη) × 80 σε 512MiB = OOM ⇒ **`concurrency: 1`** (σημασιολογία gen1). Ο marker ορφανών (μικρό I/O) μένει στην προεπιλογή.
   - Σχήμα γεγονότος: v1 `size: string` · v2 `size: number` ⇒ **ένας** προσαρμογέας, ένα σχήμα στη βάση.
   - Ο `orphanSweeper` (`us-central1`) σβήνει στον κάδο ΕΕ με `delete` — πράξη **μεταδεδομένων**, όχι κατέβασμα bytes ⇒ συμβατό με την τοποθεσία.

## 4. 🏆 Πού πάμε πιο έξυπνα από τους μεγάλους

Οι μεγάλοι κρατούν την τοποθεσία **στον οργανισμό** και γι' αυτό η μετάβαση είναι «όλα μαζί με διακοπή»: ανάμεσα σε
«πριν» και «μετά» το σύστημα **δεν ξέρει** ποιο αρχείο είναι πού. Εμείς την κρατάμε **σε δύο επίπεδα**:

- **Πολιτική** (ποιος αποφασίζει για **νέα** αρχεία): ΕΝΑΣ καθαρός κριτής `placementForNewFile(context)`, που καλείται **μόνο**
  από τον ένα συγγραφέα της εγγραφής, **τη στιγμή της γέννησης** (N.7.2 #1: προληπτικά, όχι ως παρενέργεια).
- **Αλήθεια** (πού **είναι** τα bytes): πεδίο `storagePlacement` **σε κάθε `FileRecord`**. Γράφεται στη γέννηση και αλλάζει
  **μόνο** με CAS της μετάβασης. Όλοι οι αναγνώστες ρωτούν **αυτό** — ποτέ την πολιτική, ποτέ τον οργανισμό.

Αποτέλεσμα: **μικτή κατάσταση ακριβής και επαληθεύσιμη**, μετάβαση **ανά αρχείο, ζωντανά, χωρίς παράθυρο διακοπής**
(πρότυπο ζ5: αντιγραφή → crc32c → CAS → χάρη → καθαρισμός), και μια αλλαγή πολιτικής **δεν ερμηνεύει ποτέ ξανά** παλιά αρχεία.
Η Atlassian δεν μπορεί να το κάνει αυτό, γιατί ανάμεσα στο «πριν» και το «μετά» δεν ξέρει πού είναι το κάθε αρχείο.

## 5. ΑΠΟΦΑΣΕΙΣ (προτεινόμενες)

| # | Απόφαση | Γιατί |
|---|---|---|
| Α1 | **Πεδίο** `storagePlacement` στο `FileRecord` · λεξιλόγιο `FILE_STORAGE_PLACEMENTS` = `legacy-default` (**απόν ⇒ legacy**) · `eu-originals` | ίδιο σχήμα με `mediaPlacement` (ζ5α)· κανένα backfill: απουσία = ρητή σημασία, όχι μαντεψιά |
| Α2 | **ΕΝΑΣ επιλογέας** `fileRecordBucket(record)` (server-only, δίπλα στο `getAdminBucket()`) · **άγνωστη** τιμή ⇒ **throw** (fail closed), ποτέ «κανονικός» | ζ5α «ρητή θέση, ποτέ σιωπηλό fallback» |
| Α3 | **Τίμιο 404**: purge και hold ρωτούν **τον κάδο της εγγραφής**· το «λείπει» σημαίνει «λείπει **εκεί που λέει η εγγραφή**» | κλείνει Ρ1, Ρ2 δομικά (όχι με ειδική περίπτωση) |
| Α4 | **Νέος κάδος** `{project}-files-eu`, **EUROPE-WEST3**, STANDARD, UBLA, **PAP enforced**, **soft delete 7 ημέρες**, χωρίς versioning, **χωρίς HNS** (holds), **χωρίς object retention** (μη αναστρέψιμο), **κανένας** κύκλος ζωής — **ΟΧΙ** ο `tour-media` | ο `tour-media` έχει soft delete **0** επίτηδες (αποσυρμένα πλακίδια = ό,τι θολώθηκε)· τα πρωτότυπα είναι **αναντικατάστατα** ⇒ το αντίθετο. Δύο αντίθετες πολιτικές = δύο κάδοι |
| Α5 | **IaC**: δήλωση στο `config/gcs-buckets` + **ΕΝΑΣ** μηχανισμός «δηλωμένος ιδιωτικός κάδος» (`server/storage/declared-private-bucket` — ο `tour-media-provision.ts` **γενικεύτηκε και σβήστηκε**) + μητρώο δηλώσεων που διαβάζουν **και** το script **και** ο cron `storage-bucket-drift` | ζ5α αρχή· κανένας νέος cron, καμία δεύτερη λίστα |
| Α6 | **Κατάλογος κάδων πρωτοτύπων** `ORIGINAL_BUCKETS` (από το λεξιλόγιο) ⇒ backup/restore/σάρωση προθέματος/ορφανά **απαριθμούν τον κατάλογο**· το manifest κρατά `bucket` ανά εγγραφή· restore **στον κάδο του manifest** | κλείνει Ρ4 + `deletion-storage-cleanup`· backup παραμένει στο `EUROPE-WEST1` ✅ |
| Α7 | **Cloud Functions**: ο επιλογέας **προβάλλεται** στα Functions (ADR-874, CHECK 3.93 — όχι χειρόγραφο αντίγραφο)· `onDeleteFloorplanBackground`/`orphanSweeper` ρωτούν τον κάδο της εγγραφής· triggers ανά κάδο από **ένα** handler· για τον κάδο ΕΕ **gen2 στο `europe-west3`** | κλείνει Ρ3/Ρ5/Ρ6· Eventarc απαιτεί ίδια περιοχή· επεξεργασία bytes ΕΕ στις ΗΠΑ ακυρώνει την τοποθεσία |
| Α8 | **SSRF** (`download/route.ts`): ισότητα ⇒ **λίστα** από τον κατάλογο κάδων | κλείνει Ρ7 χωρίς να χαλαρώνει την άμυνα |
| Α9 | **Μετάβαση** = ο πυρήνας της ζ5 (`tour-media-migration.ts`) **γενικεύεται** (όχι αντίγραφο — N.18): manifest → rewrite → crc32c + μέγεθος → **CAS** (`storagePlacement` + ίδιο `hash` + κατάσταση `ready`) → νέο `downloadUrl` όπου ήταν token URL → χάρη → καθαρισμός με νέα επαλήθευση | μηδέν παράθυρο 404· υπάρχουσες μεταβάσεις με «ναι» του Giorgio |
| Α10 | **Πύλη** (νέος CHECK): `getAdminBucket()` / `.bucket()` σε αρχεία που χειρίζονται bytes `FileRecord` ⇒ **μόνο** μέσω `fileRecordBucket` (ratchet κατά ταυτότητα στα ~12 σημεία της §2.2) | χωρίς πύλη το 41ο σημείο θα ξαναμαντέψει |

## 6. ✅ ΑΠΟΦΑΣΕΙΣ Ε1–Ε5 (2026-09-30)

**Βάση**: εντολή Giorgio «όπως οι μεγάλοι παίκτες, full enterprise + full SSoT, χωρίς εκπτώσεις· αν δεν είσαι σίγουρος, έρευνα»
⇒ κάθε ερώτηση κλείνει με την πρακτική των μεγάλων (§3.7) και, όπου γίνεται, πιο έξυπνα (§4). Όλες = η **πρόταση** του πίνακα:

| Απόφαση | Πρακτική μεγάλων που τη στηρίζει |
|---|---|
| **Ε1 = ΟΛΑ** τα πρωτότυπα, σε κύματα (πανοράματα πρώτα) | Atlassian/Figma/Box/Dropbox/Autodesk: η τοποθεσία καλύπτει **όλο** το περιεχόμενο, ποτέ μία κατηγορία |
| **Ε2 = νέος κάδος** `files-eu` | διαφορετική πολιτική διατήρησης ⇒ διαφορετικό δοχείο αποθήκευσης |
| **Ε3 = soft delete 7 ημέρες** | Dropbox/Workspace κρατούν ανάκτηση διαγραμμένων (≥ 25–30 ημέρες)· εμείς 7, πιο σφιχτά για την ιδιωτικότητα |
| **Ε4 = (β)** ανέβασμα μόνο με υπογεγραμμένο εισιτήριο server | Dropbox/Box/Figma: ο client ανεβάζει στο **API** τους, ποτέ απευθείας σε κάδο που διαλέγει μόνος του |
| **Ε5 = gen2 `europe-west3`** | Eventarc: ίδια περιοχή με τον κάδο (§3.5)· καμία επεξεργασία bytes ΕΕ εκτός ΕΕ |

Ο αρχικός πίνακας ερωτήσεων κρατιέται ως ιστορικό:

| # | Ερώτηση | Πρόταση |
|---|---|---|
| Ε1 | **Εμβέλεια**: μόνο πανοράματα (Δ11.8), ή **όλα** τα νέα πρωτότυπα στην ΕΕ; | 🏆 **Όλα**, σε κύματα: πανοράματα πρώτα. Ταυτότητες, συμβόλαια και αποδείξεις εντολών είναι **εξίσου** προσωπικά δεδομένα, και ο μηχανισμός είναι ο ίδιος. Κατηγοριακή εξαίρεση = ακριβώς αυτό που απέρριψε το Δ11.8 |
| Ε2 | Νέος κάδος `files-eu` ή επαναχρησιμοποίηση του `tour-media`; | **Νέος** (Α4: αντίθετες πολιτικές soft delete) |
| Ε3 | Soft delete στα πρωτότυπα ΕΕ: 7 ημέρες ή 0; | **7 ημέρες** — δίχτυ κατά λάθους διαγραφής. Ο GDPR επιτρέπει εύλογη διατήρηση ανάκτησης· τεκμηριώνεται στην πολιτική |
| Ε4 | Ανέβασμα από client (9 αρχεία, Ρ9): (α) ο κάδος ΕΕ γίνεται Firebase κάδος με τους **ίδιους** κανόνες (2ος στόχος) και ο client επιλέγει instance από τη θέση που επιστρέφει ο server· (β) όλα τα ανεβάσματα πρωτοτύπων ΕΕ περνούν από το **υπογεγραμμένο εισιτήριο** του server (`resumable-upload-session`, ήδη bucket-aware από τη ζ5α) | 🏆 **(β)**: ο client **δεν ξέρει ποτέ** κάδους, η θέση ταξιδεύει υπογεγραμμένη (όπως στη ζ5α), δεν χρειάζεται PAP-εξαίρεση ή δεύτερο αντίγραφο κανόνων. Κόστος: 9 αρχεία μετακινούνται στη μία διαδρομή — **είναι και SSoT κέρδος** (σήμερα δύο δρόμοι ανεβάσματος) |
| Ε5 | Functions του κάδου ΕΕ σε gen2 `europe-west3`; | **Ναι** (Α7) |

## 7. ΦΑΣΕΙΣ

| Φάση | Περιεχόμενο | Συμπεριφορά παραγωγής | Ενέργεια Giorgio |
|---|---|---|---|
| **Φ0** Θωράκιση | λεξιλόγιο + πεδίο + `fileRecordBucket` · ~12 σημεία §2.2 μέσω επιλογέα (και οι 3 παρακάμψεις env + `file-purge-helpers`) · purge/hold τίμιο 404 · backup/restore/σάρωση ανά κατάλογο (manifest με `bucket`) · SSRF λίστα · προβολή στα Functions · πύλη Α10 · Boy Scout `ADR-031` tag | **καμία αλλαγή** (όλα `legacy-default`) | commit/push |
| **Φ1** Κάδος ✅ κώδικας (§7.2) | `files-eu` ως κώδικας μέσω του **ενός** μηχανισμού ιδιωτικών κάδων · επιτήρηση drift αυτόματα από το μητρώο | καμία (κάδος άδειος) | ✅ `--apply` («ναι» 2026-09-30) · «ακριβώς όπως η δήλωση» |
| **Φ2** Functions ΕΕ ✅ κώδικας (§7.3) | gen2 `europe-west3`: σήμανση ορφανών + μικρογραφία DXF για τον κάδο ΕΕ — **ίδια** σώματα, λεπτά bindings | καμία (κάδος άδειος) | ⏳ `firebase deploy --only functions:…` (4 ονόματα, §7.3) |
| **Φ3** Πανοράματα γεννιούνται στην ΕΕ ✅ κώδικας (§7.4) | κριτής `placementForNewFile` · `tour-capture-finalize` → `eu-originals` όταν η καραντίνα είναι ΕΕ · ψήστης `readOriginal` μέσω επιλογέα (ήδη Φ0) | νέες λήψεις **νέων** περιηγήσεων στην ΕΕ | ⏳ deploy Φ2 **πριν** το push · ζωντανή δοκιμή |
| **Φ4** Μετάβαση πανοραμάτων ✅ κώδικας (§7.5) | γενικευμένος πυρήνας Α9 (`server/storage/placement-copy`) · πρωτότυπα με CAS θέσης+URL+ιστορικού · ορχήστρωση ανά περιήγηση (πλακίδια → πρωτότυπα) · ξηρό → `--apply` → χάρη → `--cleanup` | υπάρχοντα στην ΕΕ | κάθε βήμα με «ναι» |
| **Φ5** Όλα τα νέα αρχεία (αν Ε1 = όλα) | Ε4 διαδρομή ανεβάσματος · πολιτική `placementForNewFile` → `eu-originals` | νέα αρχεία στην ΕΕ | ζωντανά |
| **Φ6** Άδειασμα κανονικού κάδου | μετάβαση ανά κύματα φύλαξης | ο US μένει μόνο για ό,τι δεν είναι πρωτότυπο | κάθε κύμα με «ναι» |

**Φ0 πρώτα, και μόνη**: διορθώνει τα Ρ1–Ρ7 **πριν** υπάρξει έστω ένα αρχείο στον 2ο κάδο. Αλλιώς η πρώτη διαγραφή GDPR
ενός πανοράματος ΕΕ θα «πετύχαινε» στη βάση και θα αποτύγχανε στα bytes.

### 7.1 Φ0 — ΥΛΟΠΟΙΗΘΗΚΕ (2026-09-30 · Orchestrator: πυρήνας Opus + 3 πράκτορες Sonnet σε ξένα σύνολα αρχείων + σύνθεση Opus)

**Καμία αλλαγή συμπεριφοράς στην παραγωγή**: καμία εγγραφή δεν έχει `storagePlacement` ⇒ όλα `legacy-default` ⇒ ίδιος κάδος.
Καμία εγγραφή δεν γράφει `eu-originals` στην Φ0.

| Αρχείο | Ρόλος |
|---|---|
| `lib/files/file-storage-placement.ts` | **leaf, μηδέν imports** (προβάλλεται στα Functions): λεξιλόγιο · `fileStoragePlacementOf` (απόν ⇒ legacy · άγνωστο ⇒ **πετά**) · `fileStorageBucketNameOf` · αντίστροφη απεικόνιση ονόματος · `FILES_EU_BUCKET_SUFFIX` · `FILE_STORAGE_PLACEMENT_QUERY_PARAM` |
| `server/files/file-record-bucket.ts` | ο **ΕΝΑΣ** επιλογέας: `fileRecordBucket(record)` · `fileStorageBucket(placement)` · `fileStorageBucketNames()` · `fileStoragePlacementOfBucket(name)` · κατάλογος `originalStorageBuckets()` + `provisionedOriginalStorageBuckets()` (αποτυχία του ελέγχου ύπαρξης ⇒ **πετά**, ποτέ «δεν υπάρχει») |
| `config/gcs-buckets.ts` · `lib/firebaseAdmin.ts` | `GCS_FILES_EU_BUCKET` (`{project}-files-eu`) · `getFilesEuBucket()` |
| `types/file-record.ts` | `storagePlacement?` · Boy Scout: μπαγιάτικο tag `ADR-031` ⇒ ADR-709 + ADR-895 |
| **Λήψεις/αναγνώσεις** (πράκτορας Α): `files/_shared/owned-file-bytes` · `excel-preview` · `floorplans/{process,scene,scene-fetcher}` (**κόπηκε** η παράκαμψη από env) · `dxf-thumbnail-selfheal` · `tour-tileset-baker` `readOriginal` · `tour-plan-prepare` · `tour-capture-finalize` · `property-media` · `public-shelf{,-model}` | μέσω επιλογέα με την εγγραφή στο χέρι |
| `lib/storage/signed-download-url.ts` | `bucket` **υποχρεωτικό** (3 καλούντες: `share-download` ⇒ επιλογέας · `mandate-evidence-access`/`migrate-dxf` ⇒ ρητά κανονικός, με λόγο) |
| `lib/storage/{storage-object-stream,resumable-upload-session}.ts` | `bucket` **υποχρεωτικό** — καμία σιωπηλή προεπιλογή (ζ5α είχε αφήσει προαιρετικό) |
| `app/api/download/route.ts` | SSRF: ισότητα ⇒ **κατάλογος** (Α8)· ξένος κάδος (και ο `tour-media`) ⇒ άρνηση |
| `app/api/storage/file/[...path]/route.ts` · `storage-admin/public-upload.service` `buildProxyUrl` | 🆕 **Ρ12**: ο proxy έβρισκε το αρχείο **μόνο από το μονοπάτι** ⇒ η θέση ταξιδεύει στο URL (`?placement=`, **μόνο** όταν δεν είναι legacy ⇒ κάθε αποθηκευμένο URL μένει έγκυρο αυτολεξεί)· άγνωστη ⇒ 400 |
| `agency-media-publication` · `listing-file-deliverability` · `agency-media-selection` · `dossier-media-publication` | η θέση ταξιδεύει **μαζί** με το `privateStoragePath` προς το δημόσιο ράφι |
| **Κύκλος ζωής** (πράκτορας Β): `file-purge-helpers` (+ `gdpr-delete/route`) · `file-hold.service` (εκδόσεις σε **διαφορετικούς** κάδους ⇒ κλείδωμα ανά κάδο) · `deletion-storage-cleanup` · `backup/{storage-backup,storage-restore,backup-manifest.types,backup-gcs}` | Ρ1/Ρ2/Ρ4 κλειστά: purge σε λάθος κάδο αδύνατο · άγνωστη θέση ⇒ `refused` · backup απαριθμεί τον κατάλογο, manifest με `placement`, νέα διάταξη `storage/{placement}/{path}` (παλιά manifests διαβάζονται: το `backupFile` είναι η αυθεντία)· restore στον κάδο του manifest |
| `mandate/attestation-evidence` · `lib/mandate/attestation-document-verdict` | 🆕 **Ρ11**: το πάγωμα αποδεικτικού διάβαζε την **πηγή** από τον κανονικό ⇒ η θέση ταξιδεύει από τον κριτή· το αποδεικτικό μένει στον κανονικό (Locked retention) |
| `floorplan-background/floor-wipe-storage.ts` (**νέο**, εξήχθη) · `floor-wipe-queries` · `floorplan-floor-wipe.service` | 🆕 **Ρ13**: σβήσιμο ορόφου με `getAdminStorage().bucket()` ⇒ ανά εγγραφή στον κάδο της + σάρωση προθέματος σε **κάθε** κάδο |
| **Cloud Functions** (πράκτορας Γ): προβολή leaf (ADR-874) · `functions/src/storage/file-record-bucket.ts` · `onDeleteFloorplanBackground` (Ρ3: ο δείκτης **μένει** αν η διαγραφή bytes αρνηθεί) · `orphan-cleanup`/`orphan-sweeper`/`storage-path-custody` (υποψήφιο με `bucket`· φύλαξη **ανά κάδο**) · `dxf-thumbnail-onfinalize` (μικρογραφία στον κάδο του αντικειμένου) | 🆕 **Ρ10**: το `scheduledFilePurge` στο `functions/src/index.ts` ήταν **δεύτερο, αδήλωτο** Ρ1 (404 στον κανονικό ⇒ `purged`) — διορθώθηκε |
| `ai-pipeline/.../messaging-handler.ts` | `getStorage().bucket()` (έμμεση προεπιλογή SDK) ⇒ ρητά κανονικός· Boy Scout: προϋπάρχων κλώνος αναζήτησης επαφής ⇒ **μία** μέθοδος |
| `.ssot-registry.json` `file-record-bucket` + `scripts/lib/ssot/pattern-proofs.js` | **Α10 χωρίς νέα πύλη**: ο υπάρχων μηχανισμός CHECK 3.7 απαγορεύει `getAdminBucket()` · `getAdminStorage().bucket(` · `getStorage().bucket(` · κάδο από env, με **λίστα εξαιρέσεων με λόγο** (22 αρχεία, όλα μη-πρωτότυπα ή ⏳ Φ5). Μετρημένο: **0** παραβιάσεις σε όλο το `src/`, 22/22 αρχεία της λίστας υπάρχουν· golden 332/332 |

**Άγκυρες** (ενδεικτικά, όλες με **δύο** πλαστούς κάδους): κριτής 12 (🔴 άγνωστη ⇒ πετά ×5) · owned-file-bytes Ρ1–Ρ3 · baker Ρ1–Ρ2 · purge 🔴 ΕΕ ποτέ στον κανονικό / άγνωστη ⇒ refused · hold 🔴 εκδόσεις σε δύο κάδους · backup/restore (νέα) · deletion-cleanup (νέο, πάνω στον **πραγματικό** κατάλογο) · floor-wipe-storage (νέο) Δ1–Δ3 Σ1–Σ2 · attestation (νέο) Π1–Π3 · proxy URL Υ1–Υ2 · Functions 127 (νέα: `onDeleteFloorplanBackground` 6 · `dxf-thumbnail` 2).
**Εκτός δικής μας αλλαγής**: 3 σουίτες του `ai-pipeline` (`attachment-handler` · `contact-lookup` · `ownership-empty-pair-handlers`) κόκκινες με `instanceof Timestamp` μέσα στο `test-utils/fake-firestore` — αρχεία που αλλάζει **άλλος** πράκτορας στο κοινό δέντρο.

**⏳ Προϋποθέσεις της Φ5 (γεννήτορες νέων αντικειμένων — η θέση στη γέννηση)**: ingestion Telegram/email · `vendor/quote/upload` · `public-upload.service` · `messaging-handler` (να δέχεται **fileId**, όχι μονοπάτι) · `owner-media-publication` (τα `media[]` του ιδιοκτήτη είναι στιγμιότυπα, όχι `FileRecord` ⇒ η θέση πρέπει να αντιγράφεται στο στιγμιότυπο).

### 7.2 Φ1 — ΥΛΟΠΟΙΗΘΗΚΕ (2026-09-30 · Plan Mode · Opus)

**Προμήθεια ✅ (2026-09-30, «ναι» Giorgio)**: `npm run provision:files-eu -- --apply` ⇒ **ένα** `create` ⇒ `pagonis-87766-files-eu` «ακριβώς όπως η δήλωση»· δεύτερο ξηρό (ανεξάρτητη ανάγνωση) ίδιο — ιδεμπότητο. Ο κάδος είναι **άδειος**: καμία εγγραφή δεν γράφει `eu-originals` πριν τη Φ3. Πριν την προμήθεια: Ξηρό σε παραγωγή (μόνο ανάγνωση):
`files-eu` ⇒ «υπάρχει: όχι» (και τα 10 πεδία σε απόκλιση, όπως πρέπει) · 🏆 `tour-media` ⇒ **«ακριβώς όπως η δήλωση»** κάτω από τον
**γενικευμένο** κριτή (και στα νέα πεδία HNS/retention/versioning) ⇒ η γενίκευση **δεν** άλλαξε την κρίση για τον ζωντανό κάδο.

**SSoT audit πριν από τον κώδικα**: υπήρχαν **δύο** provisioners (`tour-media-provision` · `public-shelf-provision`) και ο τρίτος
ήταν έτοιμος να αντιγραφεί. Ο `tour-media-provision` ήταν ήδη ο γενικός μηχανισμός, **καρφωμένος** σε μία δήλωση.

| Αρχείο | Ρόλος |
|---|---|
| `server/storage/declared-private-bucket.ts` (**νέο**) | ο **ΕΝΑΣ** μηχανισμός: `privateBucketDrift` (καθαρός κριτής 10 πεδίων) · `inspectPrivateBucket` · `ensurePrivateBucket` (ιδεμπότητο). 🔒 **Αναλλοίωτα** (`PRIVATE_BUCKET_INVARIANTS`: UBLA · PAP enforced · χωρίς HNS/versioning/object retention) **δεν είναι πεδία της δήλωσης** — ένας ιδιωτικός κάδος δεν *μπορεί* να δηλωθεί αλλιώς. Ποτέ δεν γράφονται: περιοχή · κλάση · HNS (μόνο στη γέννηση) · object retention (μη αναστρέψιμο) |
| `server/storage/private-bucket-registry.ts` (**νέο**) | οι δηλώσεις `tour-media` (καραντίνα 1 ημέρας, soft delete 0) + `files-eu` (soft delete 604800, **κανένας** κύκλος ζωής) — νέος ιδιωτικός κάδος = **μία γραμμή** ⇒ προμήθεια + επιτήρηση αυτόματα |
| `config/gcs-buckets.ts` | `GCS_FILES_EU_BUCKET_CONFIG` · 🏆 `APP_UPLOAD_CORS` = **μία** λίστα origins για το PUT του εισιτηρίου (Ε4), κοινή και στους δύο κάδους |
| `scripts/provision-private-bucket.ts <id> [--apply]` (αντικατέστησε το `provision-tour-media-bucket.ts`) | `npm run provision:tour-media` · `npm run provision:files-eu` — ξηρό εξ ορισμού |
| `lib/cron/jobs/storage-bucket-drift.job.ts` | `DECLARED_BUCKETS` = το μητρώο + το δημόσιο ράφι ⇒ ο `files-eu` επιτηρείται **χωρίς** νέα γραμμή |
| `.ssot-registry.json` `declared-private-bucket` + proof | CHECK 3.7: κλειδιά πολιτικής κάδου (`softDeletePolicy:` · `publicAccessPrevention:` · `hierarchicalNamespace:` · `enableObjectRetention:`) **μόνο** στον μηχανισμό. Μετρημένο: **0** παραβιάσεις στο `src/` · golden 334/334 |

**Γιατί το δημόσιο ράφι μένει χωριστό**: αντίθετη πολιτική (`allUsers`, CORS `*`, PAP **όχι** enforced) και άλλο μοντέλο (παρατηρεί
IAM). Μέσα στον ιδιωτικό μηχανισμό θα έκανε το «enforced» **προαιρετικό** = χαλάρωση άμυνας για χάρη ενός αρχείου λιγότερου.

**Άγκυρες**: `declared-private-bucket.test.ts` (23 — κριτής Κ1–Κ5 και προμήθεια Π1–Π4 **για κάθε δηλωμένο κάδο** του πραγματικού
μητρώου · δηλώσεις Δ1–Δ4 · αίτημα γέννησης Γ1) · `tour-media-store.test.ts` (ο επιλογέας, μεταφέρθηκε αυτούσιος) ·
`storage-bucket-drift.job.test.ts` (+Κ5: ο `files-eu` έρχεται από το μητρώο). **Μεταλλάξεις 6/6 πιάστηκαν** (σε αντίγραφο με
moduleNameMapper, ποτέ επί τόπου· έλεγχος ότι φορτώνεται το αντίγραφο): HNS/versioning/retention χωρίς κρίση · HNS συμφιλιώσιμο ·
απόν κύκλος ζωής ≠ `[]` · χωρίς `enableObjectRetention: false` στη γέννηση. jscpd 0. Όχι tsc.

### 7.3 Φ2 — ΥΛΟΠΟΙΗΘΗΚΕ (2026-09-30 · Plan Mode · Opus) · ⏳ deploy με «ναι»

**Πριν**: οι δύο storage triggers ήταν gen1 `.storage.object()` **χωρίς κάδο** ⇒ μόνο ο κανονικός (us)· κανένα `firebase-functions/v2`
σε όλο το `functions/src`. Ο `files-eu` δεν είχε **κανέναν** trigger. **Μετά**: **ΕΝΑ** σώμα ανά ερώτηση, **λεπτά** bindings ανά κάδο.

| Αρχείο | Ρόλος |
|---|---|
| `lib/files/file-storage-placement.ts` (leaf, **προβάλλεται**) | `FILES_EU_BUCKET_LOCATION = 'EUROPE-WEST3'` — το **ένα** σημείο· το διαβάζουν η δήλωση (`config/gcs-buckets` `GCS_FILES_EU_BUCKET_CONFIG.location`, πριν literal) **και** οι gen2 triggers |
| `functions/src/storage/finalize-runtime.ts` (**νέο**, leaf μηδέν imports — κανένας κύκλος, CHECK 3.80) | επιλογές runtime ανά handler (`orphanMarker` 60s/256 · `dxfThumbnail` 120s/512/**concurrency 1**) — **μία** πηγή για gen1 `runWith` **και** gen2 |
| `functions/src/storage/finalized-object.ts` (**νέο**) | ο **ένας** προσαρμογέας v1/v2 ⇒ `{ bucket, placement, name, contentType, size: number }`· ⛔ αδήλωτος κάδος ⇒ `null` + σφάλμα, **καμία** δουλειά |
| `orphan-cleanup.ts` · `dxf-thumbnail-onfinalize.ts` | σώματα εξήχθησαν (`markOrphanCandidateOnFinalize` · `generateDxfThumbnailOnFinalize`)· τα gen1 bindings **ίδιο όνομα, ίδια γενιά**, λεπτά |
| `functions/src/storage/regional-storage-triggers.ts` (**νέο**) | κατάλογος `REGIONAL_TRIGGER_BUCKETS` (`files-eu`: `expr\`${projectID}${FILES_EU_BUCKET_SUFFIX}\`` · `europe-west3`) + `REGIONAL_FINALIZE_TRIGGERS: Record<κάδος, Record<handler, …>>` ⇒ νέος handler ή κάδος χωρίς binding **δεν μεταγλωττίζεται**· exports `onStorageFinalizeFilesEu` · `onDxfProcessedFinalizeFilesEu` |
| `functions/src/index.ts` | +2 exports |

🔴 **Ρ14 (νέο εύρημα audit)**: `candidateDocId(filePath)` κλείδωνε τον υποψήφιο **μόνο στο μονοπάτι**. Στη μετάβαση (Φ4: copy → verify →
delete) το ίδιο path ζει σε **δύο** κάδους ⇒ τα δύο σημάδια γίνονταν **ένα** έγγραφο και το `bucket` του δεύτερου έσβηνε του πρώτου
⇒ ο sweeper θα έκρινε **λάθος αντικείμενο**. Τώρα κλειδί = (θέση, path)· **legacy αυτολεξεί το παλιό** (κάθε υπάρχον σημάδι έγκυρο, ίδιο
πρότυπο με το `?placement=`). Ο sweeper δεν αλλάζει (δουλεύει με `doc.ref` + `doc.get('bucket')`).
🔴 **Ρ15 (παλινδρόμηση της Φ0, πιάστηκε από το CHECK 3.70)**: το Boy Scout του `messaging-handler` αφαίρεσε το `const db` αλλά το
`executeSendSocialMessage` το διάβαζε ακόμη ⇒ `ReferenceError` σε **κάθε** αποστολή Messenger/Instagram. Διορθώθηκε (`getAdminFirestore()`).
Τα tests το άφησαν να περάσει γιατί καλύπτουν **μόνο** την άρνηση μη-διαχειριστή — κενό κάλυψης στο test αρχείο του ai-pipeline
(το αλλάζει άλλος πράκτορας στο κοινό δέντρο· δεν αγγίχθηκε).
**Αλλαγή σχήματος**: το `size` των υποψηφίων γράφεται πλέον **αριθμός** (το gen1 έγραφε συμβολοσειρά)· κανένας αναγνώστης το διαβάζει (grep).

**Άγκυρες**: `regional-storage-triggers.test.ts` (14, πάνω στο **πραγματικό** `firebase-functions/v2` — `__endpoint`: `gcfv2` · `['europe-west3']` ·
`…object.v1.finalized` · χωρίς retry · μνήμη/timeout/concurrency = `FINALIZE_RUNTIME` · κάδος = CEL `{{ params.PROJECT_ID }}-files-eu`
επιλυμένο **ίσο** με το `fileStorageBucketNames()` · πληρότητα · το binding καλεί το **κοινό** σώμα, αδήλωτος κάδος ⇒ κανένα) ·
`finalized-object.test.ts` (4) · `orphan-cleanup.test.ts` (+Ρ14 golden legacy/δύο κάδοι · αδήλωτος · size · ο φρουρός «μηδέν διαγραφή»
επεκτάθηκε σε **4** αρχεία του real-time μονοπατιού) · `dxf-thumbnail-onfinalize.test.ts` (+3 σώμα) · `declared-private-bucket.test.ts` (+Δ5).
**Μεταλλάξεις 6/6 πιάστηκαν** σε αντίγραφο (moduleNameMapper + `modulePaths`)· **έλεγχος ελέγχου**: το αμετάλλακτο αντίγραφο κάθε module
**πράσινο** (5/5) — χωρίς αυτόν η πρώτη εκτέλεση έδειχνε «πιάστηκε» για αντίγραφα που **απλώς δεν φορτώνονταν**. Functions 165/165 ·
ai-pipeline 1240/1240 · jscpd 0 · 3.80/3.93/3.70 πράσινα. Όχι tsc.

**⏳ Giorgio (μόνο με «ναι»)**: `firebase deploy --only functions:onStorageFinalizeFilesEu,functions:onDxfProcessedFinalizeFilesEu,functions:onStorageFinalize,functions:onDxfProcessedFinalize`
— τα gen1 = ενημέρωση **επί τόπου** (ίδιο όνομα/γενιά, **όχι** delete+create). Πρώτο gen2 ⇒ το CLI ενεργοποιεί Cloud Run/Eventarc/Artifact
Registry APIs και χορηγεί τα IAM. Ζωντανή δοκιμή: ανέβασμα `companies/_probe/…` στον `files-eu` ⇒ υποψήφιος με `bucket = files-eu` και
κλειδί με πρόθεμα θέσης · logs στο `europe-west3` · διαγραφή του δείγματος.

### 7.4 Φ3 — ΥΛΟΠΟΙΗΘΗΚΕ (2026-09-30 · Plan Mode · Opus) · ⏳ ζωντανά μετά το deploy Φ2

**SSoT audit (grep) πριν από τον κώδικα**:

| Ερώτηση | Εύρημα |
|---|---|
| Ποιος γράφει την εγγραφή | **μόνο** `persistOriginal` (`server/spatial-tour/tour-capture-finalize`) μέσω του **ενός** builder `buildPendingFileRecordData` |
| Ποιος ανεβάζει τα bytes | ο client με **υπογεγραμμένο εισιτήριο** (Ε4 **ήδη**) στην καραντίνα `tourMediaBucket(ingestPlacement)`· το finalize κάνει `copy` → `fileRecordBucket(εγγραφή)` ⇒ **η ροή ανεβάσματος δεν άλλαξε** |
| Πολιτική θέσης νέου αρχείου | **δεν υπήρχε** (0 ευρήματα `placementForNewFile`) ⇒ δημιουργήθηκε **μία** φορά (§4)· πρότυπο `TOUR_MEDIA_PLACEMENT_FOR_NEW_TOURS` |
| Καλούντες `buildProxyUrl` | 3 — μόνο ένας για πανόραμα, **χωρίς** θέση ⇒ διορθώθηκε |
| Ψήστης `readOriginal` · proxy `?placement=` | ✅ ήδη από τη Φ0 |

🔴 **Απόφαση: μονάδα τοποθεσίας = η περιήγηση** (μέτρηση παραγωγής, μόνο ανάγνωση: `spatial_tours` 1 · `spatial_tours_personal` 1 —
**και οι δύο `legacy-default`**, η μετάβαση ζ5 του ADR-884 δεν έχει τρέξει). Η καραντίνα **και** τα πλακίδια μιας παλιάς περιήγησης ζουν
στον κανονικό (ΗΠΑ). «Κάθε νέο πανόραμα ⇒ ΕΕ» θα έβαζε τα bytes στις ΗΠΑ **πριν** φτάσουν στην ΕΕ και θα άφηνε τα **παράγωγά** τους
(πλακίδια) εκεί ⇒ **ψεύτικη** τοποθεσία. Άρα η θέση του πρωτοτύπου **ακολουθεί την καραντίνα του εισιτηρίου** (εκεί ΕΙΝΑΙ ήδη τα bytes):
`tour-eu` ⇒ `eu-originals` · `legacy-default` ⇒ `legacy-default` **ρητά γραμμένο**. Κάθε νέα περιήγηση γεννιέται `tour-eu` ⇒ τα
πανοράματά της στην ΕΕ. Πρακτική των μεγάλων (§3.7): ο **περιέκτης** είναι η μονάδα (Autodesk ACC ανά hub, Atlassian pinning), ποτέ μικτό
εσωτερικό. Οι 2 υπάρχουσες περιηγήσεις περνούν **ολόκληρες** (πλακίδια: ζ5 `--apply` · πρωτότυπα: Φ4).

| Αρχείο | Ρόλος |
|---|---|
| `lib/files/new-file-placement.ts` (**νέο**, καθαρό) | ο **ΕΝΑΣ** κριτής `placementForNewFile(context)` — union `NewFileContext` (σήμερα `tour-capture`· η Φ5 προσθέτει μέλη **εδώ**) · πίνακας `Record<TourMediaPlacement, FileStoragePlacement>` ⇒ νέα θέση περιήγησης χωρίς απάντηση **δεν μεταγλωττίζεται** |
| `services/file-record/file-record-core{,-types}.ts` | είσοδος `storagePlacement?` — γράφεται **μόνο όταν δόθηκε** ⇒ οι άλλοι 7 καλούντες αμετάβλητοι byte προς byte (απουσία = legacy, Α1) |
| `server/spatial-tour/tour-capture-finalize.ts` | θέση στη γέννηση από `ticket.ingestPlacement` (υπογεγραμμένη) · `copy` στον κάδο της εγγραφής (επιλογέας) · `buildProxyUrl(path, θέση)` |
| `server/spatial-tour/tour-media-store.ts` | μόνο σχόλιο (το πρωτότυπο δεν «μένει στον κανονικό» πια) |

**Έρευνα**: `copy` μεταξύ κάδων = `rewriteTo`, και το `@google-cloud/storage@7.18.0` (`file.js` 891/901) **συνεχίζει μόνο του** με
`rewriteToken` [objects/rewrite](https://cloud.google.com/storage/docs/json_api/v1/objects/rewrite)· `tour-media` και `files-eu` είναι
**και οι δύο** EUROPE-WEST3 ⇒ αντιγραφή εντός περιοχής, τα bytes δεν περνούν από τον server. Download tokens: **δεν** χρησιμοποιούνται
(`downloadUrl` = proxy, Ρ12). Signed URLs: `bucket` ήδη υποχρεωτικό (Φ0).

**Ιδεμπότητα**: ίδιο εισιτήριο ⇒ ίδια θέση ⇒ ίδιο `fileId` (ντετερμινιστικό) ⇒ ίδιος κάδος.

**Άγκυρες**: `new-file-placement.test.ts` (**νέο**, 5) · `file-record-core-custody.test.ts` (+3: χωρίς θέση ⇒ **κανένα** κλειδί · ρητή ⇒
αυτολεξεί) · `tour-capture-upload.test.ts` με **τρεις** πλαστούς κάδους (+`files-eu`): **Ο1** νέα περιήγηση ⇒ εγγραφή `eu-originals` **και**
bytes στον `files-eu` (όχι κανονικό, όχι κάδο μέσων) **και** URL `?placement=eu-originals` · **Θ2** η περιήγηση έγινε legacy ανάμεσα ⇒ η θέση
ακολουθεί το **εισιτήριο** · **Θ3** (νέα) παλιά περιήγηση ⇒ `legacy-default` ρητά, κανονικός κάδος, URL χωρίς παράμετρο.
Μεταλλάξεις σε αντίγραφο (moduleNameMapper + `modulePaths` + σήμα φόρτωσης): **5/5 πιάστηκαν** — (α) πίνακας `tour-eu`→legacy ·
(β) ο builder αγνοεί την είσοδο · (γ) proxy URL χωρίς θέση · (δ) αντιγραφή στον κανονικό κάδο · (ε) πάντα ΕΕ (bytes που πέρασαν από ΗΠΑ).
**Έλεγχος ελέγχου**: τα αμετάλλακτα αντίγραφα και των 3 modules **πράσινα** (32/32) και **φορτώθηκαν** (σήμα). Targeted jest 68/68
(+ baker Ρ1: ο ψήστης διαβάζει από ΕΕ) · jscpd 0 · 3.80 πράσινο. Όχι tsc.

**⏳ Giorgio (μόνο με «ναι»)**: 🔴 **το push της Φ3 στο Netcup = ζωντανή ενεργοποίηση** ⇒ **πρώτα** το deploy Φ2 (§7.3 — αλλιώς ο `files-eu`
δεν έχει marker ορφανών), **μετά** το push. Ζωντανή δοκιμή: νέα περιήγηση → λήψη ⇒ εγγραφή `eu-originals`, αντικείμενο στον `files-eu`,
προβολή + ψήσιμο δουλεύουν. Για τις 2 υπάρχουσες: ζ5 `--apply` (ADR-884) ⇒ οι **επόμενες** λήψεις τους πάνε ΕΕ· τα παλιά πρωτότυπα = Φ4.

### 7.5 Φ4 — ΥΛΟΠΟΙΗΘΗΚΕ (2026-09-30 · Plan Mode · Opus) · ⏳ μετάβαση με «ναι» ανά βήμα

**SSoT audit (grep, 3 πράκτορες ανάγνωσης + επαλήθευση)**:

| Ερώτηση | Εύρημα |
|---|---|
| Ποιος αλλάζει `storagePlacement` μετά τη γέννηση | **κανείς** — το «μόνο με CAS» ήταν **δηλωμένο**, όχι υλοποιημένο ⇒ ο builder `buildPlacementTransitionUpdate` (ο ΜΟΝΟΣ) |
| Μηχανισμός αντιγραφής/απόδειξης | ζούσε **μέσα** στο `tour-media-migration` (ζ5) ⇒ **μετακινήθηκε** στο `server/storage/placement-copy` (Α9 — γενίκευση, όχι αντίγραφο)· οι Μ1–Μ8/Κ1–Κ4 της ζ5 μένουν ως έχουν |
| 🔴 Ο proxy `api/storage/file` | **δεν** διαβάζει την εγγραφή — μόνο το `?placement=` του URL ⇒ θέση **και** URL γράφονται στο **ίδιο** CAS· και η χάρη πριν τον καθαρισμό μετρά **ανοιχτές καρτέλες**, όχι κουπόνια |
| Αντίγραφα θέσης αλλού | **κανένα**: ψήστης, `owned-file-bytes`, agency/dossier/public-shelf, property-media, purge/GDPR, backup/restore διαβάζουν **ζωντανά** `(θέση, μονοπάτι)`· το `TourCapture` κρατά μόνο `originalFileId` |
| Ορφανά (Ρ14) | το αντίγραφο ΕΕ **πριν** το CAS μαρκάρεται υποψήφιο (αυτοθεραπεύεται στο sweep με ζωντανό επανέλεγχο)· αν το CAS **αρνηθεί**, είναι **πράγματι** ορφανό ⇒ το σβήνει σωστά ο sweeper. Το παλιό US αντικείμενο **δεν** το ξαναβλέπει κανείς ⇒ ο καθαρισμός ανήκει στο εργαλείο |
| 🔴 **Ρ16 — νέο εύρημα** | το `gdpr-delete` μηδενίζει `storagePath` και σβήνει **μόνο** την τρέχουσα θέση ⇒ μετά από CAS και πριν τον καθαρισμό, η πηγή στις ΗΠΑ θα έμενε **για πάντα χωρίς δείκτη**. Κλειστό: `placementTransition` (**δικό του** πεδίο, επιβιώνει του purge) + ο καθαρισμός σβήνει την πηγή **και** εκκαθαρισμένων (χωρίς ισοτιμία) |
| Holds | το rewrite **δεν** αντιγράφει holds/retention ⇒ αρχείο σε δέσμευση = `refused`, ποτέ αντίγραφο χωρίς κλείδωμα |

**Έρευνα (πηγές)**: [objects/rewrite](https://docs.cloud.google.com/storage/docs/json_api/v1/objects/rewrite) — διασυνοριακό rewrite = πολλές
κλήσεις με `rewriteToken`, που το SDK συνεχίζει μόνο του (επαληθευμένο στον κώδικα `file.js`: `if (resp.rewriteToken) this.copy(…)`)·
με **κενό σώμα** αντιγράφονται τα editable metadata — **μαζί** το custom `firebaseStorageDownloadTokens` (§3.4) — **όχι** ACL/holds/retention ⇒
ο πυρήνας στέλνει ρητό σώμα χωρίς token μόνο όταν υπάρχει token (αλλιώς αυτολεξεί)· `sourceGeneration` καρφωμένο ⇒ αντιγράφεται **ακριβώς** ό,τι
μετρήθηκε. crc32c: το υπολογίζει το GCS στον προορισμό — σύγκριση crc32c + μέγεθος· το sha256 (`hash`) μένει ο φρουρός του ψήστη.
[soft delete](https://docs.cloud.google.com/storage/docs/soft-delete): το σβήσιμο στον US αφήνει τα bytes soft-deleted για τη διάρκεια
της πολιτικής **του US κάδου** (§10 — αδιάβαστη) ⇒ το ξηρό τη **διαβάζει** και την αναφέρει: η κατοικία ολοκληρώνεται **τότε**, όχι στο `--cleanup`.

| Αρχείο | Ρόλος |
|---|---|
| `server/storage/placement-copy.ts` (**νέο**) | ο ΕΝΑΣ μηχανισμός: `listObjects` · `statObjects` · `sameObject` · `missingIn` · `copyObjects` (δέσμες 8, γενιά καρφωμένη, χωρίς token) |
| `server/spatial-tour/tour-media-migration.ts` | πλακίδια — πλέον **πάνω** στον μηχανισμό (−20 γραμμές, ίδια συμπεριφορά) |
| `server/spatial-tour/tour-original-migration.ts` (**νέο**) | πρωτότυπα: κριτής `originalMigrationBlocker` (ίδιος πριν την αντιγραφή **και** μέσα στο CAS) · CAS εγγραφής **+ περιήγησης** · ίχνος `storage_relocate` · καθαρισμός μετά από 24 ώρες |
| `server/spatial-tour/tour-residency-migration.ts` (**νέο**) | η σειρά ανά περιήγηση (πλακίδια → πρωτότυπα) · `sourceSoftDeleteSeconds` |
| `types/file-record.ts` · `file-record-core{,-types}.ts` | `FilePlacementTransition` · `buildPlacementTransitionUpdate` / `buildSourceCleanedUpdate` (καθαροί) |
| `types/file-audit.ts` · `AuditLogPanel` | πράξη `storage_relocate` — ποτέ `move` (εκείνο = φάκελος) |
| `scripts/migrations/migrate-tour-media-to-eu.ts` | ένα CLI για ολόκληρη την περιήγηση · `--only=tiles\|originals` για χωριστό «ναι» ανά σκέλος |

**Αποφάσεις**:
- **Σειρά**: πλακίδια **πρώτα**. Ο ψήστης γράφει στον κάδο της **περιήγησης** ⇒ πρωτότυπο ΕΕ σε περιήγηση ΗΠΑ = παράγωγα ΕΕ στις ΗΠΑ· τα πρωτότυπα
  αρνούνται μόνα τους (`tiles-first`). Το αντίστροφο ενδιάμεσο (πλακίδια ΕΕ, πρωτότυπο ΗΠΑ) είναι ακίνδυνο. Ένα εργαλείο, δύο ιδεμπότητα σκέλη.
- **Όλα τα πρωτότυπα**, και αποσυρμένων λήψεων (αντίθετα με τα πλακίδια): είναι αναντικατάστατα και δεν δείχνουν τίποτα κρυμμένο.
- **Προορισμός από τον ΕΝΑ κριτή** `placementForNewFile({ tour-capture, tour-eu })` — καμία δεύτερη πολιτική.
- **Χάρη 24 ωρών** (όχι 15′): URL proxy χωρίς λήξη σε ανοιχτή καρτέλα/cache.
- **Χωρίς `revision + 1`** και χωρίς αγγίγματα άλλων πεδίων — υποδομή, όχι περιεχόμενο.

**Σύνορο ανάγνωσης (CHECK 3.74 — το έπιασε στο commit)**: η μετάβαση **γράφει** ⇒ διαβάζει με τη φρουρημένη πόρτα `readFileRecord`
(`unreadable` ⇒ `refused`, Μ12). Ο καθαρισμός όμως **δεν** μπορεί: το purge μηδενίζει `storagePath` και ο φρουρός σχήματος απορρίπτει ακριβώς την
εγγραφή της οποίας η πηγή πρέπει να φύγει (Ρ16) ⇒ νέος στενός αναγνώστης **στο ίδιο σύνορο** `readPlacementCleanupFacts` (`lib/files/file-record-read`):
μόνο μετάβαση · εκκαθαρισμένη; · τρέχουσα θέση/μονοπάτι.

**Άγκυρες**: `tour-original-migration.test.ts` (**νέο**, 18 — verified `FakeFirestore` + δύο πλαστοί κάδοι με crc32c/γενιά): 🔴 Μ1 ξηρό = μηδέν
εγγραφές/αντιγραφές · 🔴 Μ2 θέση + URL `?placement=eu-originals` + ιστορικό μαζί, πηγή ανέπαφη, ίχνος · 🔴 Μ3 πρωτότυπο αποσυρμένης λήψης περνά ·
🔴 Μ4 `tiles-first` · 🔴 Μ5 δέσμευση ⇒ καμία αντιγραφή · Μ6 busy · 🔴 Μ7 hash άλλαξε ανάμεσα ⇒ κανένα flip · 🔴 Μ7β περιήγηση όχι πια ΕΕ ⇒ κανένα
flip · 🔴 Μ8 parity · 🔴 Μ9 κανένα token, γενιά καρφωμένη · Μ10 ξανατρέξιμο · Μ11 πηγή λείπει · 🔴 Μ12 δεν διαβάζεται ⇒ άρνηση · Κ1 · 🔴 Κ2 χάρη · 🔴 Κ3 σβήσιμο + `sourceCleanedAt` ·
🔴 Κ4 parity · 🔴 **Κ5 εκκαθαρισμένο ⇒ η πηγή στις ΗΠΑ σβήνεται (Ρ16)**. Της ζ5 14/14 αμετάβλητες· γειτονικές (upload · baker · core-custody ·
κριτής) 56/56. **Μεταλλάξεις σε αντίγραφο** (moduleNameMapper + `modulePaths` + σήμα φόρτωσης): **11/11 πιάστηκαν** — η πρώτη σειρά άφησε
**μία** ζωντανή (CAS που αγνοεί την περιήγηση) ⇒ προστέθηκε η Μ7β. **Έλεγχος ελέγχου**: αμετάλλακτα αντίγραφα 18/18 πράσινα και φορτώθηκαν.
jscpd 0 · 3.80 0 θανάσιμες · 3.53 καθαρό · 3.70 `--all` exit 0. Όχι tsc.
🧹 **Boy Scout (πιάστηκε από το N.11 στο commit)**: το `messaging-handler` (μπήκε στο commit για το Ρ15) έγραφε ωμό HTML
«Αγαπητέ/ή … Με εκτίμηση, **Pagonis Energo**» — **σε κάθε μισθωτή το όνομα άλλης εταιρείας**. Τώρα: κοινά `buildGreeting`/`buildClosing`
(`email-templates/confirmation-email-shared`) και υπογραφή = επωνυμία της εταιρείας-αποστολέα (`readCompanyPublicName`), αλλιώς ο αποστολέας
(`resolveSenderIdentity`, ADR-857). ai-pipeline 78/78 σουίτες · 1.240 tests. ⏳ Χρέος: τα ίδια τα `buildGreeting`/`buildClosing` είναι μόνο ελληνικά
(όλα τα email εταιρειών) — θέλουν γλώσσα παραλήπτη όπως το `base-email-texts`.
ℹ️ Γνωστό χρέος (όχι από εδώ): το `AuditLogPanel` καλεί `t('audit.action.<πράξη>', πράξη)` αλλά **κανένα** `audit.action.*` δεν υπάρχει στα locales
⇒ όλες οι πράξεις (και η νέα) εμφανίζονται με το ωμό όνομα.

**⏳ Giorgio (μόνο με «ναι», ανά βήμα)**: προϋπόθεση deploy Φ2 + push Φ0–Φ3 (§7.4). Μετά: ξηρό (`npm run migrate:tour-media`) →
`--apply --id=` (πλακίδια → πρωτότυπα, ή `--only=` βήμα-βήμα) → ≥15′ `--cleanup --only=tiles` · ≥24 ώρες `--cleanup` → soft delete του US.

## 8. N.7.2 — έλεγχος αρχιτεκτονικής

| # | Απάντηση |
|---|---|
| 1 Προληπτικό | η θέση γράφεται **στη γέννηση** από τον έναν συγγραφέα |
| 2 Race | η μετάβαση κάνει CAS σε θέση + hash + `ready`· ανέβασμα σε εξέλιξη ⇒ `busy`, κανένα flip (πρότυπο Μ5/Μ7 της ζ5) |
| 3 Ιδεμπότητο | ίδια bytes (crc32c), ξανατρέξιμο |
| 4 Belt-and-suspenders | επιλογέας (κύριο) + πύλη Α10 (κώδικας) + cron απόκλισης (υποδομή) + δίχτυ μετάβασης |
| 5 SSoT | **ένα** πεδίο (αλήθεια), **ένας** κριτής (πολιτική), **ένας** επιλογέας (κάδος), **ένας** κατάλογος (απαρίθμηση) |
| 6 Await | όλα await· κανένα fire-and-forget σε bytes |
| 7 Κάτοχος | συγγραφέας `FileRecord` = θέση στη γέννηση · πυρήνας μετάβασης = αλλαγή θέσης · κανείς άλλος |

## 9. Απορριφθείσες εναλλακτικές

- **Dual-read** («δοκίμασε ΕΕ, αλλιώς US»): κρύβει ό,τι δεν μεταφέρθηκε, διπλασιάζει την καθυστέρηση στα λάθη, κάνει τα Ρ1/Ρ2 **χειρότερα** (ζ5α Δ11.6).
- **Κάδος ανά κατηγορία** (π.χ. «πανοράματα στην ΕΕ»): η θέση θα εξαγόταν από κανόνα που μπορεί να αλλάξει ⇒ παλιά αρχεία ερμηνεύονται ξανά σιωπηλά (Δ11.8).
- **Κάδος ανά εταιρεία**: δεκάδες κάδοι, IaC ανά tenant, όριο 1 bucket op/2s ανά project για δημιουργία· καμία πρακτική ανάγκη (όλοι οι πελάτες είναι στην ΕΕ).
- **Dual/multi-region `EU`/`EUR4`**: διαθεσιμότητα που δεν χρειαζόμαστε, διπλό κόστος, απόσταση από τη Νυρεμβέργη· η Φρανκφούρτη ήδη αποφασίστηκε (Δ7.3).
- **Storage Transfer Service** για τη μετάβαση: για < 1 TB η Google προτείνει rewrite· το STS δεν κάνει CAS στη βάση μας ⇒ χρειαζόμαστε τον δικό μας πυρήνα ούτως ή άλλως.
- **Επανα-ψήση/επανα-ανέβασμα**: χάνει την ταυτότητα των bytes (hash) — αντιγραφή μέσα στο Google = ίδια bytes.

## 10. Ανοιχτά — ⏳ να μετρηθούν (όχι να υποτεθούν)

- **Object Retention Lock στο `files-eu`**: σήμερα **όχι** (τα αποδεικτικά μένουν στον κανονικό). Αν μια φάση μεταφέρει αποδεικτικά
  στην ΕΕ, η ενεργοποίηση είναι **μη αναστρέψιμη** (§3, σημείο 8) ⇒ ρητή απόφαση Giorgio + αλλαγή του αναλλοίωτου με λόγο.

- Soft delete / versioning / retention του **κανονικού** κάδου σήμερα (ανάγνωση `gcloud storage buckets describe` — Giorgio ή πράκτορας με ανάγνωση).
- Όγκος πρωτοτύπων ανά φύλαξη (για Φ4/Φ6 — επιλογή rewrite vs STS στο 1 TB).
- ✅ ~~Πλήρης λίστα exports~~ — μετρήθηκε (Φ2): `onStorageFinalize` · `orphanSweeper` · `onDxfProcessedFinalize` · `orphanSpikeAlert` εξάγονται
  από το `functions/src/index.ts` (+ τα δύο gen2 της Φ2). Αν είναι **αναπτυγμένα** στο cloud δεν ελέγχθηκε (`firebase functions:list`).
- Ποιος καλεί το `BackupService` σε παραγωγή (cron ή χειροκίνητα).
- Το ADR που **πράγματι** τεκμηριώνει την κανονική αποθήκευση αρχείων (υποψήφια: ADR-191 / ADR-293 / ADR-709) — για τον σύνδεσμο.

## Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-09-30 | **Πρόταση.** Orchestrator ανάγνωσης (3 πράκτορες) + επαλήθευση στον κώδικα: 29 `getAdminBucket()` + 13 παρακάμψεις + 4 Functions, **κανένα** πεδίο κάδου στο `FileRecord`. 🔴 9 σιωπηλές αποτυχίες (Ρ1 purge «πέτυχε» σε λάθος κάδο · Ρ2 hold χωρίς κλείδωμα · Ρ3 χαμένος δείκτης · Ρ4 εκτός backup …). Έρευνα 25 πηγών. Προτάσεις Α1–Α10, ερωτήσεις Ε1–Ε5, φάσεις Φ0–Φ6. **Κανένας κώδικας.** |
| 2026-09-30 | **Ε1–Ε5 αποφασίστηκαν** (§6) με την εντολή Giorgio «όπως οι μεγάλοι, χωρίς εκπτώσεις»: όλα τα πρωτότυπα σε κύματα · νέος κάδος `files-eu` · soft delete 7 ημέρες · ανέβασμα μόνο με υπογεγραμμένο εισιτήριο · Functions gen2 στο `europe-west3`. |
| 2026-09-30 | **Φ0 ΥΛΟΠΟΙΗΘΗΚΕ (§7.1 · Orchestrator με έγκριση Giorgio · Opus + 3 Sonnet).** Λεξιλόγιο/κριτής (leaf, προβολή στα Functions) + **ένας** επιλογέας + πεδίο. ~35 αρχεία παραγωγής σε 8 τομείς μέσω επιλογέα· Ρ1–Ρ9 κλειστά + **4 νέα ευρήματα** κατά την υλοποίηση: 🔴 **Ρ10** `scheduledFilePurge` (Functions) δεύτερο Ρ1 · **Ρ11** πάγωμα αποδεικτικού διάβαζε την πηγή από τον κανονικό · **Ρ12** ο proxy `storage/file` ήξερε μόνο μονοπάτι ⇒ θέση στο URL · **Ρ13** σβήσιμο ορόφου με έμμεσο κάδο. `bucket` **υποχρεωτικό** σε signed URL / ροή / resumable. Α10 μέσω CHECK 3.7 (module `file-record-bucket`, 0 παραβιάσεις, λίστα εξαιρέσεων με λόγο) — **καμία νέα πύλη**. jscpd 0 (+ Boy Scout κλώνος `messaging-handler`). Όχι tsc. ⏳ Φ1. |
| 2026-09-30 | **Φ1 ΥΛΟΠΟΙΗΘΗΚΕ (§7.2 · Plan Mode · Opus).** SSoT audit: 2 provisioners + ο 3ος έτοιμος να αντιγραφεί ⇒ ο `tour-media-provision` **γενικεύτηκε** σε **ΕΝΑΝ** μηχανισμό «δηλωμένος ιδιωτικός κάδος» (`server/storage/declared-private-bucket` + μητρώο) και σβήστηκε· `files-eu` = μία δήλωση (EUROPE-WEST3 · soft delete 7 ημέρες · κανένας κύκλος ζωής · κοινό CORS εισιτηρίου). Έρευνα (§3, σημείο 8): 🔴 HNS **απενεργοποιεί** τα holds ⇒ αναλλοίωτο · object retention μη αναστρέψιμο ⇒ όχι τώρα · GDPR: διαγραφή ≤ T+7 ημέρες, «beyond use». cron drift διαβάζει το μητρώο (κανένας νέος cron). CHECK 3.7 module `declared-private-bucket` (0 παραβιάσεις). 23+1+1 άγκυρες, μεταλλάξεις 6/6. Ξηρό παραγωγής: `tour-media` «ακριβώς όπως η δήλωση» · `files-eu` «δεν υπάρχει». ⏳ `--apply` με «ναι». |
| 2026-09-30 | **Φ1 προμήθεια ✅ (με «ναι» Giorgio).** `provision:files-eu --apply` ⇒ `pagonis-87766-files-eu` (EUROPE-WEST3) δημιουργήθηκε «ακριβώς όπως η δήλωση»· δεύτερο ξηρό ίδιο (ιδεμπότητο)· `tour-media` αμετάβλητο. Ο cron drift τον επιτηρεί από το μητρώο. Κάδος άδειος ως τη Φ3. ⏳ Φ2 (Functions gen2 `europe-west3`). |
| 2026-09-30 | **Φ2 ΥΛΟΠΟΙΗΘΗΚΕ (§7.3 · Plan Mode · Opus).** Τα **πρώτα** gen2 του έργου: `onStorageFinalizeFilesEu` · `onDxfProcessedFinalizeFilesEu` στο `europe-west3`, **λεπτά** bindings πάνω στα **ίδια** σώματα με τα gen1 (που μένουν ίδιο όνομα/γενιά). Κάδος = `expr` με `projectID` (όχι χειρόγραφο)· περιοχή = `FILES_EU_BUCKET_LOCATION` του leaf (ένα σημείο για δήλωση + triggers)· επιλογές runtime **μία** πηγή· ένας προσαρμογέας v1/v2 (αδήλωτος κάδος ⇒ καμία δουλειά)· πληρότητα handler×κάδος **από τον τύπο**. DXF `concurrency: 1` (gen2 = 80 ⇒ OOM). Έρευνα §3 σημείο 9 (πηγές + κώδικας CLI/βιβλιοθήκης). 🔴 **Ρ14** κλειδί υποψηφίου μόνο με path ⇒ συγχώνευση δύο κάδων — κλειστό, legacy αυτολεξεί. 🔴 **Ρ15** παλινδρόμηση Φ0 στο `messaging-handler` (`db` αδέσμευτο) — πιάστηκε από CHECK 3.70, διορθώθηκε. Μεταλλάξεις 6/6 + έλεγχος ελέγχου 5/5. ⏳ deploy με «ναι». |
| 2026-09-30 | **Φ3 ΥΛΟΠΟΙΗΘΗΚΕ (§7.4 · Plan Mode · Opus).** Ο **ΕΝΑΣ** κριτής πολιτικής `lib/files/new-file-placement` (`placementForNewFile`, union ανά περίσταση γέννησης) · ο builder δέχεται `storagePlacement` (γράφεται μόνο όταν δόθηκε) · `tour-capture-finalize`: θέση **στη γέννηση** από την καραντίνα του υπογεγραμμένου εισιτηρίου, αντιγραφή μέσω επιλογέα, proxy URL με θέση. 🔴 Απόφαση **μονάδα τοποθεσίας = περιήγηση** (μετρημένο: 2/2 περιηγήσεις παραγωγής `legacy-default`) — ποτέ bytes ΕΕ μέσω ΗΠΑ, ποτέ παράγωγα ΕΕ στις ΗΠΑ. Η ροή ανεβάσματος (Ε4) δεν άλλαξε. Έρευνα: `rewriteToken` αυτόματο στο SDK. Μεταλλάξεις 5/5 + έλεγχος ελέγχου. ⏳ deploy Φ2 **πριν** το push (το push = ζωντανή ενεργοποίηση). |
| 2026-09-30 | **Φ4 ΥΛΟΠΟΙΗΘΗΚΕ (§7.5 · Plan Mode · Opus).** Ο μηχανισμός αντιγραφής/απόδειξης της ζ5 **γενικεύτηκε** στο `server/storage/placement-copy` (Α9 — μετακίνηση, όχι αντίγραφο) με δύο νέες εγγυήσεις: καρφωμένη γενιά πηγής · ποτέ download token στον νέο κάδο (το rewrite αντιγράφει τα custom metadata). Πρωτότυπα: `tour-original-migration` — κριτής ίδιος πριν την αντιγραφή και μέσα στο CAS (θέση + `hash` + `ready` + όχι δέσμευση + περιήγηση ΕΕ), που γράφει **μαζί** θέση, νέο proxy URL και `placementTransition` (ο ΜΟΝΟΣ builder `buildPlacementTransitionUpdate`)· χάρη 24 ωρών (ο proxy δεν ρωτά τη βάση). Ορχήστρωση ανά περιήγηση (πλακίδια → πρωτότυπα). Ίχνος `storage_relocate`. 🔴 **Ρ16** το GDPR purge θα άφηνε την πηγή στις ΗΠΑ χωρίς δείκτη — κλειστό. Soft delete του κάδου-πηγής διαβάζεται και αναφέρεται. 18 άγκυρες, μεταλλάξεις 11/11 + έλεγχος ελέγχου · ανάγνωση μόνο μέσω του συνόρου (CHECK 3.74). ⏳ ξηρό → `--apply` → χάρη → `--cleanup`, κάθε βήμα με «ναι». |
