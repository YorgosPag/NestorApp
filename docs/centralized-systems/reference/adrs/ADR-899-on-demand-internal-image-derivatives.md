# ADR-899 — Παράγωγα εσωτερικών εικόνων κατ' απαίτηση: **κλειστή κλίμακα**, ζωή **δεμένη με το πρωτότυπο**, και η γκαλερί της κεφαλίδας ακινήτου

| | |
|---|---|
| **Status** | ✅ IMPLEMENTED — Φ.Δ (παράγωγα, ✅ ζωντανά στον proxy) + Φ.Γ (γκαλερί + lightbox + πάνελ κάτοψης) 2026-10-01 · ✅ ζωντανός έλεγχος παραγωγής (nestorconstruct.gr) 2026-10-01 — §9 · Βήμα Δ: SSoT διαστάσεων εικόνας (§3.7) 2026-10-02 — ✅ Functions deployed (`onImageDimensionsFinalize` us-central1 · `onImageDimensionsFinalizeFilesEu` europe-west3) · ✅ συμπλήρωση 34/34 · ✅ Ε2/Ε3 ζωντανά 2026-10-03 (deploy `88f7c42b`, §9) — Ε2β ⇒ **Ε4** · ✅ Ε4 ζωντανά 2026-10-04 (deploy `7402112f`, §9): Ε4α/β/δ/ζ + Γ3 ✅ · Ε4γ/Ε4ε ⇒ **Ε5** (στροφή) + **Ε6** (content-box) · ✅ Ε5/Ε6 ζωντανά 2026-10-04 (deploy `beca4af6`) ⇒ αποκάλυψαν **Ε7** (descriptor `srcset`) · ✅ Ε7 ζωντανά 2026-10-04 (deploy `3ba6028b`) — ο κύκλος Ε4–Ε7 έκλεισε |
| **Date** | 2026-10-01 |
| **Category** | Backend Systems |
| **Προέλευση** | handoff `HANDOFFS/2026-10-01_property-header-gallery_PHASE-D-G_handoff.md` · αίτημα Giorgio: γκαλερί κεφαλίδας επιπέδου Zillow/Idealista |
| **Σχετικά** | ADR-841 Α2.2–Α2.4 / Α12 *(δημόσιο ράφι — ίδιος τύπος κωδικοποίησης)* · ADR-862 Φ0 Β8 *(ο ένας builder/αναγνώστης proxy URL)* · ADR-895 *(θέση bytes ανά `FileRecord`)* · ADR-897 *(σημεία λήψης / πάνελ κάτοψης)* · ADR-777 §8.30 / §8.57 *(καρτέλα ακινήτου · γκαλερί κάρτας)* · ADR-223 *(`useAsyncData`)* |
| **Αυθεντία** | ο κώδικας. Όπου αυτό το ADR διαφωνεί με τον κώδικα, κερδίζει ο κώδικας |

---

## 1. Το πρόβλημα

Η κεφαλίδα ακινήτου (`PropertyIdentityHeader`) έδειχνε **μία** φωτογραφία σε κουτί 192×128, κατεβάζοντας **ολόκληρο το
πρωτότυπο** από τον proxy `/api/storage/file/…` — μετρημένο: 2,0 MB και 3,3 MB για τις δύο φωτογραφίες του δοκιμαστικού
ακινήτου. Τα εσωτερικά αρχεία **δεν** είχαν καμία υποδομή παραγώγων: το `thumbnailUrl` είναι canvas 300px του client μόνο
τη στιγμή του ανεβάσματος, το δημόσιο ράφι (ADR-841 Α12) είναι δεμένο σε **δημοσιευμένη** αγγελία και **δημόσιο** κάδο.

## 2. Έρευνα — τι κάνουν οι μεγάλοι (2026-10-01)

| Ποιος | Παράγωγα | Cache | Τι γίνεται όταν σβηστεί το πρωτότυπο |
|---|---|---|---|
| **Dropbox** | κατ' απαίτηση, πολλές αναλύσεις | 30 ημέρες | λήγει με τον χρόνο |
| **Cloudinary** | κατ' απαίτηση (URL = μετασχηματισμός) | CDN, 30 ημέρες | σβήνουν τα παράγωγα, **αλλά** το CDN σερβίρει ως 30 ημέρες χωρίς ρητή ακύρωση |
| **Next.js Image** | κατ' απαίτηση, κλειστή λίστα `deviceSizes` | δίσκος, LRU **με όριο** (16.1.7 — μετά το CVE-2026-27980 για απεριόριστη cache) | λήγει με TTL |
| **Zillow** | διάσταση στο μονοπάτι | CDN | — |

**Σύγκλιση**: on-demand · κλειστό σύνολο μεγεθών · cache **με όριο** · η ζωή του παραγώγου δεμένη με το πρωτότυπο.

### 2.1 🔴 Γιατί ΟΧΙ cache στον ιδιωτικό κάδο (το handoff το πρότεινε — η μέτρηση το ανέτρεψε)

1. **Το purge σβήνει ΜΟΝΟ το πρωτότυπο** (`services/file-record/file-purge-helpers.ts` — `bucket.file(storagePath).delete()`), και το
   mark-and-sweep των ορφανών τρέχει **μόνο** στο `onFinalize` ⇒ ένα παράγωγο **επιβιώνει για πάντα** μετά τη διαγραφή = υπόλειμμα GDPR.
   Το ίδιο κενό υπήρχε για **κάθε** συνοδευτικό αντικείμενο (μικρογραφίες, σκηνές) — ✅ **έκλεισε 2026-10-01**, §2.2.
2. Ο **προεπιλεγμένος** κάδος **δεν** είναι στο `DECLARED_PRIVATE_BUCKETS` ⇒ δεν υπάρχει κανόνας λήξης ως κώδικας.
3. Δίπλα στο πρωτότυπο (`companies/…/files/`) τα `storage.rules` επιτρέπουν στον client **εγγραφή/διαγραφή** ⇒ «δηλητηριασμένη» cache.

### 2.2 ✅ Τα συνοδευτικά αντικείμενα στο purge / ΓΚΠΔ (2026-10-01)

**Μέτρηση** (κάδος παραγωγής, φάκελος δοκιμαστικού ακινήτου): δίπλα σε κάθε πρωτότυπο ζουν **πέντε** είδη συνοδευτικών, όχι
ένα — και το purge έσβηνε μόνο το `storagePath`:

| είδος (μητρώο) | όνομα | γραφέας | κάδος | δείκτης στην εγγραφή |
|---|---|---|---|---|
| `uploadThumbnail` | `{στέλεχος}_thumb.webp` | client (ανέβασμα · CRM) | κανονικός | μόνο `thumbnailUrl` |
| `floorplanThumbnail` | `{path}_thumb.png` | client (οδηγός κάτοψης) | κανονικός | μόνο `thumbnailUrl` |
| `dxfRasterThumbnail` | `{path}.thumbnail.png` | Functions / self-heal | της εγγραφής | `thumbnailStoragePath` |
| `dxfProcessedScene` | `{path}.processed.json` | `floorplan-process` | της εγγραφής | `processedDataPath` — **που το autosave του CAD γράφει από πάνω** |
| `cadScene` | `{στέλεχος}.scene.json` | DXF Viewer autosave | κανονικός | `processedDataPath` · `downloadUrl` |

⇒ Μία λύση «μόνο οι δείκτες της εγγραφής» θα άφηνε **μετρημένα** το `.dxf.processed.json` ορφανό· μία «σάρωση προθέματος»
(όπως το `floor-wipe-storage`) θα έχανε τα `{στέλεχος}…` (όχι πρόθεμα του `storagePath`) και θα κόστιζε μια λίστα ανά αρχείο.

**Η απόφαση** (πρότυπο GCS/S3/Drive: το παράγωγο έχει **ντετερμινιστικό** κλειδί από τον γονιό):
- **Μητρώο** `lib/files/file-companion-objects.ts` (leaf, **προβάλλεται** στα Functions — ADR-874): κάθε είδος δηλώνει όνομα **και
  κάδο του γραφέα του**· οι **πέντε** γραφείς χτίζουν πλέον το όνομα με `fileCompanionPath` (το ίδιο που διαβάζει ο κριτής).
- **Κριτής** `services/file-record/file-companion-purge.ts`: υποψήφιοι = ονόματα μητρώου **∪** δείκτες εγγραφής (URL ⇒ ο κάδος
  του URL· ξένος κάδος ⇒ ποτέ). 🔒 **Φρουρός** `isCompanionPathOf`: ίδιος φάκελος **και** όνομα που αρχίζει από ολόκληρο το όνομα
  του πρωτοτύπου ή από το **`fileId` + `.`/`_`** (μοναδικό) — στέλεχος που δεν είναι id (`scan.pdf`) δεν δίνει τίποτα.
- **Ένας γραφέας** `deleteStorageObjectForPurge` (cron · εργαλείο AI · ΓΚΠΔ): πρωτότυπο **πρώτα** — δέσμευση εκεί ⇒ δεν αγγίζεται
  κανένα συνοδευτικό· μετά τα συνοδευτικά, 404 = αθώο, οποιαδήποτε άλλη άρνηση ⇒ `refused` ⇒ η εγγραφή **δεν** γίνεται `purged`
  (ο επόμενος γύρος ξαναδοκιμάζει, ιδεμποτώς). Η ΓΚΠΔ μηδενίζει και τους δείκτες (`FILE_COMPANION_POINTER_FIELDS`).
- **Ορφανά που υπάρχουν ήδη**: μετρημένα **0** — καμία εγγραφή `purged` σε `files` ή `files_personal` (2026-10-01) ⇒ καμία μετάπτωση.
  Δίχτυ για το μέλλον: ο κριτής ξανατρέχει σε κάθε γύρο μέχρι να σβηστούν όλα.

## 3. 🏆 Η απόφαση — πιο έξυπνα από τους μεγάλους

**Τίποτα δεν αποθηκεύεται μόνιμα.** Σε **κάθε** αίτημα ο server ρωτά πρώτα τη **γενιά** (generation) του πρωτοτύπου — μία
κλήση μεταδεδομένων, όπως ήδη κάνει ο proxy — και το κλειδί **κάθε** στρώσης cache **περιέχει** τη γενιά:

| στρώση | κρατά | όριο |
|---|---|---|
| browser | ETag ⇒ `304` χωρίς κατέβασμα/κωδικοποίηση | `Cache-Control: private, no-cache` |
| μνήμη διεργασίας | bytes ανά (κάδος · μονοπάτι · γενιά · πλάτος · συνταγή) | 64 MB, LRU (`lib/cache/bounded-lru`) |
| ουρά | μία κωδικοποίηση ανά κλειδί, ≤ 2 ταυτόχρονα | 64 σε αναμονή ⇒ `503` + `Retry-After` |

⇒ Διαγραμμένο πρωτότυπο = `404` **στο επόμενο αίτημα**· αντικατεστημένο = νέο κλειδί. Η παλιά απάντηση **δεν μπορεί** να δοθεί —
δομικά, όχι με διαδικασία ακύρωσης. Μηδέν ορφανά, μηδέν υπόλειμμα GDPR, μηδέν αλλαγή σε κάδους/κανόνες/Functions.

### 3.1 Η κλίμακα — `lib/files/file-preview-ladder.ts` (client-safe)
- `FILE_PREVIEW_ENCODING: RasterShelfEncoding` = **ο ίδιος τύπος** με το δημόσιο ράφι · πλάτη **320 · 640 · 1280 · 2560** (640/1280/2560 =
  τα πλάτη του ραφιού ⇒ ίδια ποιότητα σε όλο το προϊόν· το 320 για την κεφαλίδα: 12rem × DPR 2 = 384).
- **Κλειστή**: `?w=` εκτός κλίμακας ⇒ `400` (κανονική μορφή: ψηφία χωρίς αρχικό μηδέν). Ελεύθερο πλάτος θα ήταν όπλο cache-busting.
- Τύποι: jpeg/png/webp/avif/tiff. ⛔ svg (επιφάνεια επίθεσης) · ⛔ gif (θα έχανε την κίνηση) · ⛔ heic (το prebuilt sharp δεν τον διαβάζει).
- Effort 4 (το ράφι 6): εδώ κωδικοποιεί **μέσα στο αίτημα**. Η συνταγή (`FILE_PREVIEW_RECIPE`, `:fitw:e4`) **παράγεται** από τις σταθερές
  ⇒ κάθε ρύθμιση ακυρώνει αυτόματα κάθε ETag. Ο `RasterShelfEncoding` **δεν** άλλαξε ⇒ καμία ακύρωση των content-addressed συνταγών του ραφιού.
- ⚠️ Το `public-shelf-encoding` κάνει `import 'server-only'` ⇒ η κλίμακα το εισάγει **μόνο ως τύπο**· η συνταγή ζει στον παραγωγό.

### 3.2 Ο κωδικοποιητής — `server/images/raster-encoder.ts` (εξαγωγή, N.0.2)
`decodeOriented` (στροφή EXIF **μία** φορά, `limitInputPixels` ρητό) + `encodeRasterDerivative(pipeline, box, encoding, effort)`. Κουτί
`max-edge` (το ράφι — αμετάβλητο) ή `width` (το `srcset` με περιγραφείς `w`: σε ψηλή εικόνα το ύψος **δεν** πρέπει να κόβει το πλάτος).
Ποτέ μεγέθυνση· κανένα EXIF/GPS στην έξοδο. Το `public-shelf-sanitise.ts` τον καλεί με effort 6 — **μηδενική αλλαγή συμπεριφοράς** (109/109).

### 3.3 Ο αναγνώστης storage — `lib/storage/storage-object-stream.ts`
`statStorageObject` (γενιά ως **string** — 19ψήφιες γενιές GCS > 2^53) + `readStorageObjectGeneration(path, generation)` που διαβάζει
**ακριβώς** εκείνη τη γενιά: overwrite ανάμεσα σε stat και ανάγνωση ⇒ `null`, ποτέ νέα bytes κάτω από παλιό ETag.

### 3.4 Η υπηρεσία — `server/files/image-preview.service.ts`
`createImagePreviewService(deps)` (εγχεόμενα stat/read/encode/cache/queue) · `serveImagePreview` = η μία ανά διεργασία. Ροή: stat → τύπος
(`415`) → μέγεθος (`413`) → ETag → `If-None-Match` (`304` **πριν** από κάθε κατέβασμα) → LRU → ουρά (`createPriorityTaskQueue`: ίδιο κλειδί
⇒ **ίδια** υπόσχεση· προτεραιότητα = πλάτος, οι μικρογραφίες πρώτες· η αποτυχία **δεν** μένει κρατημένη) → `422` αν δεν αποκωδικοποιείται.

### 3.5 Ο route — `app/api/storage/file/[...path]/route.ts`
🔒 Ο έλεγχος μισθωτή (`companies/{ctx.companyId}`) τρέχει **πρώτος** — πριν από θέση, πλάτος ή οποιαδήποτε cache: η υπηρεσία δεν βλέπει
ποτέ αίτημα ξένου χώρου, άρα η cache δεν γίνεται πλάγια πόρτα. Χωρίς `w` ο κλάδος του πρωτοτύπου μένει **αυτούσιος**
(`streamOriginal`). Headers παραγώγου: `ETag` · `private, no-cache` · `nosniff`. Rate limit: παραμένει `withStandardRateLimit`.
Πύλες 3.90/3.92 δεν αφορούν GET (μετρημένο).

### 3.6 Ο builder στον client — `lib/storage/storage-object-url.ts` + `lib/files/file-display-url.ts`
`buildProxyPreview(storagePath, placement)` → `{ src (w=1280), srcSet }` **πάνω** στο `buildProxyUrl` (καμία δεύτερη συναρμολόγηση). Ο
`storageObjectFromUrl` κόβει το query ⇒ κάθε URL παραγώγου διαβάζεται πίσω στο **ίδιο** αντικείμενο. Ο `fileDisplayUrlOf` δίνει πλέον
`preview` — από το **όνομα αντικειμένου**, ανεξάρτητα από το `downloadUrl`· το `url` μένει «το αρχείο» (λήψη/άνοιγμα).
Η προεπισκόπηση κουβαλά τις **διαστάσεις** του πρωτοτύπου (`dimensions: ImageDimensions | null` — §9 Ε4, 2026-10-03): το πλάτος κόβει
την κλίμακα, η αναλογία λέει στον μηχανισμό zoom τι **ζωγραφίζεται**.

### 3.7 Το SSoT διαστάσεων εικόνας — `lib/images/image-dimensions.ts` (Βήμα Δ, 2026-10-02)

**Το ερώτημα**: «πόσο πλάτος × ύψος βλέπει ο θεατής;» — **μετά** τον προσανατολισμό EXIF (5–8 ⇒ ανταλλαγή). Πριν: κανένα
αρχείο δεν το ήξερε (24/24 στην παραγωγή), και η λογική προσανατολισμού ζούσε σε 3 σημεία που διαφωνούσαν.

| Κομμάτι | Αρχείο | Ρόλος |
|---|---|---|
| SSoT (καθαρό, **προβάλλεται** στα Functions) | `lib/images/image-dimensions.ts` | `ImageDimensions` · `orientedDimensions` · `imageDimensionsOf` (φρουρός) · `isPortraitDimensions` · `containedWidth` · `RASTER_IMAGE_TYPES` (ο ΕΝΑΣ κατάλογος — `isPreviewableContentType` τον ρωτά) · κωδικοποίηση custom metadata (`imageWidth`/`imageHeight`) |
| Πυρήνας γραφέα (καθαρός, προβάλλεται) | `lib/images/stored-image-dimensions.ts` | `probeImageDimensions` (κεφαλίδα 128 KiB → ολόκληρο μόνο αν χρειαστεί, ≤ 50 MB) · `dimensionsRecordVerdict` (`write` · `already-recorded` · `no-record` · `not-this-object`) · `imageDimensionsIn` |
| **Ο ΕΝΑΣ γραφέας** (στο ανέβασμα) | `functions/storage/image-dimensions-onfinalize.ts` | gen1 `onImageDimensionsFinalize` (κανονικός κάδος) + gen2 `onImageDimensionsFinalizeFilesEu` (`europe-west3` — bytes ΕΕ μετριούνται στην ΕΕ). Γράφει (α) custom metadata **με `ifGenerationMatch`** (β) `imageDimensions` στην εγγραφή, σε transaction, **μόνο** αν η εγγραφή δείχνει **αυτό** το αντικείμενο στον **ίδιο** κάδο |
| Συμπλήρωση | `server/files/image-dimensions-backfill.ts` + `app/api/admin/backfill-image-dimensions` | `createMigrationRoute` (ADR-704): GET = dry-run, POST = εκτέλεση · `files` + `files_personal` · ιδεμπότητη · πρώτα το metadata της γενιάς (αν ο trigger πρόλαβε) |
| Αναγνώστης server | `server/images/image-metadata.ts` | `sharp().metadata()` δεμένο στον πυρήνα |
| Κανόνες | `firestore.rules` `measuredKeys()` · `measuredUnchanged()` · `measuredBornAbsent()` | ο πελάτης **δεν** γράφει διαστάσεις — σε **κάθε** σκέλος create/update των `files` και `files_personal` (η οριστικοποίηση pending → ready ήταν ανοιχτή πόρτα) |

**Γιατί γραφέας στον κάδο και όχι στο finalize της εγγραφής** (μετρημένο): η εγγραφή γίνεται `ready` **από τον browser**
(`FileRecordService.finalizeFileRecord` → client `updateDoc`) — τα server post-finalize hooks **δεν** τρέχουν εκεί
(`typeof window` guard)· υπάρχουν και Admin γραφείς (quote scan, CAD dual-write, συνημμένα AI). Όλοι όμως **ανεβάζουν bytes** ⇒ ο
storage-finalize trigger είναι ο μόνος παρατηρητής που τους βλέπει όλους. Πρακτική Firebase «Resize Images» / Cloudinary (μέτρηση
στην εισαγωγή). 🏆 **Πιο έξυπνα από το Cloudinary**, που επιστρέφει στο upload τις διαστάσεις **πριν** τη στροφή EXIF (γνωστή
παγίδα): εδώ αποθηκεύεται **μόνο** η εκδοχή του θεατή, και η μέτρηση ζει **με τη γενιά** (custom metadata) ⇒ αντικατάσταση
αρχείου = νέα γενιά **χωρίς** μέτρηση, ποτέ παλιές διαστάσεις για νέα bytes. Αλλαγή metadata = νέα *metageneration*, όχι γενιά ⇒
ETag παραγώγων άθικτο, κανένα νέο finalize.

**Οι καταναλωτές** (Π1 + Π2 της §7):
- **Π2 client** — `buildProxyPreview(path, placement, intrinsicWidth)`: η κλίμακα σταματά στην **πρώτη** βαθμίδα ≥ πλάτους
  (`previewWidthsFor`), η εφεδρεία `src` μέσα της (`effectivePreviewWidth`)· `ProxyImagePreview.intrinsicWidth` εκτίθεται.
  `fileDisplayUrlOf` δίνει και `dimensions` (μόνο μετρημένες). Μικρογραφίες/zoom το κληρονομούν· το zoom
  (`filePreviewWidthFor(needed, intrinsicWidth)`) ζητά το **πρωτότυπο** μόλις η ανάγκη ξεπεράσει τα pixel του — κανένα παράγωγο
  δεν έχει περισσότερα, και τα αληθινά έρχονται χωρίς ξανασυμπίεση (γραμμές κάτοψης png).
- **Π2 server** — `image-preview.service`: το πλάτος κανονικοποιείται **πριν** από ETag/304/μνήμη/ουρά. Πηγή: το metadata της γενιάς
  (`statStorageObject` το φέρνει με την **ίδια** κλήση) → μνήμη διαστάσεων ανά (κάδος·μονοπάτι·**γενιά**), που γεμίζει από το
  πρωτότυπο που κατεβαίνει **ούτως ή άλλως** — ποτέ ξεχωριστή ανάγνωση. Όταν το πλάτος μαθαίνεται μόλις τώρα, τα bytes μπαίνουν
  στο **κανονικό** κλειδί και αυτό το ETag παίρνει ο browser ⇒ το επόμενο `If-None-Match` ταιριάζει.
- **Π1** — `PhotoLightbox`: `sizes` = ό,τι **ζωγραφίζεται** (`containedWidth`: `object-contain`, χωρίς μεγέθυνση) στο μετρημένο κουτί
  (`useElementSize`, σκαλοπάτι 16 px, άνω φράγμα +½ ⇒ ποτέ θόλωμα από στρογγύλευση). Χωρίς διαστάσεις ⇒ `VIEWPORT_SIZES`
  (το σημερινό). Η κεφαλίδα ακινήτου (`property-photos` → `PropertyHeaderGallery`) και η κάτοψη (`property-floorplan-spots`,
  όχι πια `null`) περνούν τις μετρημένες· η δημόσια αγγελία (manifest) κερδίζει το ίδιο χωρίς αλλαγή.

**Διπλότυπα (N.0.2)**: `photo-capture-facts` (`ROTATED_ORIENTATIONS`) ⇒ `readImageDimensions` + `isPortraitDimensions`.
⚠️ **`panorama-facts` ΜΕΝΕΙ στα ωμά pixel, επίτηδες** (το σχέδιο έλεγε «διόρθωση» — η μέτρηση το ανέτρεψε): ο tiler
(`tour-tileset-render.ts:47`, `sharp(bytes)…raw()` χωρίς `.rotate()`) κόβει το **ωμό** πλέγμα· η κρίση «2:1;» πρέπει να ρωτά το
ίδιο πλέγμα, αλλιώς δέχεται σφαίρα που ο tiler βλέπει 1:2. Σχόλιο-φράχτης στο αρχείο. **Ratchet** (CHECK 3.7): module
`image-dimensions` απαγορεύει `[5, 6, 7, 8]` και `orientation >= 5` εκτός SSoT· baseline **χειρουργικά** 1 (το `ImageProvider`, §9).

## 4. Η γκαλερί της κεφαλίδας (Φ.Γ)

- **Κέλυφος** `components/shared/gallery/SnapGallery.tsx` (+ `use-gallery-scroller.ts`, μετακόμισε): ul/li scroll-snap, βελάκια, βαθμίδωση,
  τελείες — **εξήχθη** από το `ListingCardGallery` μαζί με κάθε σχόλιο-μέτρηση. Νέα: `keyboard` (←/→ όταν η εστίαση είναι μέσα — καμία νέα
  στάση πληκτρολογίου) και `renderOverlay`. Το `ListingCardGallery` = λεπτό περιτύλιγμα· τα tests του **χωρίς αλλαγή assertions**.
- **Ουδέτερο lightbox** `components/shared/media/PhotoLightbox.tsx` με στενό `LightboxPhoto { key, src, srcSet?, alt, width?, height? }` ·
  **ουδέτερο πάνελ** `PhotoFloorplanPanel` + `FloorplanSpotsFigure` + `FloorplanFigure` πάνω στο σχήμα `lib/media/photo-floorplan-spots.ts`
  (`FloorplanSpotsEntry`). Δύο προσαρμογείς: `listing-capture-spots.toFloorplanSpotsEntry` (αγγελία — διαστάσεις από το manifest) και
  `lib/properties/property-floorplan-spots.ts` (ακίνητο — `width/height = null`). ⛔ **Καμία επινοημένη διάσταση**: το `FloorplanFigure`
  τις **μετρά** στη φόρτωση (και σε εικόνα που ήρθε από cache πριν το hydration — `img.complete`) και μόνο τότε σχεδιάζει σημεία.
  Τα `ListingPhotoLightbox` / `ListingFloorplanFigure` / `ListingFloorplanSpotsFigure` έγιναν προσαρμογείς **με τα ίδια props** ⇒ η δημόσια
  σελίδα αμετάβλητη (`listing-photo-capture-spots.test.tsx` πράσινο χωρίς αλλαγή). Το `ListingFloorplanImage` απορροφήθηκε (τα σχόλιά του
  — «ποτέ `priority`», «`object-contain`» — μετακόμισαν στο `FloorplanFigure`).
- **Κεφαλίδα** `components/properties/detail/PropertyHeaderGallery.tsx`: σταθερό κουτί σε κάθε κατάσταση (CLS 0) · `loading` = skeleton ·
  `failed` = ορατό `role="status"` (πριν: σιωπηλό σπιτάκι) · κάθε slide **κουμπί** → lightbox στον ίδιο δείκτη · `alt` από
  `common-photos:photoPreview.alt.gallery` (δεν είναι πια διακοσμητική) · μία εικόνα `fetchpriority="high"` · σήμα «τοποθετημένη στην
  κάτοψη» · μετρητής `N / M`. Οι κατόψεις διαβάζονται **μόνο** όταν ανοίξει το lightbox **και** κάποια φωτογραφία έχει σημείο.
- Αναγνώστης αρχείων ακινήτου ανά κατηγορία: `features/property-grid/hooks/usePropertyFileRecords.ts` (κοινός για φωτογραφίες και κατόψεις).
- Η κάρτα πλέγματος (`usePropertyThumbnail`) δείχνει πλέον το **παράγωγο** (w=1280), όχι το πρωτότυπο.
- i18n: νέα κλειδιά μόνο `properties-detail:detailPage.photos.{loadFailed,captureSpot}` (el+en)· όλα τα άλλα υπήρχαν.

### 4.1 Οι αναγνώστες `downloadUrl` → ο ΕΝΑΣ αναγνώστης εμφάνισης (Βήμα Γ, 2026-10-02)

**Ταξινόμηση κάθε σημείου** (grep `downloadUrl` σε `src/components|features|hooks`, 34 αρχεία· τα 12 είχαν το όνομα μόνο σε σχόλιο):

| Κατ. | Σημεία | Θεραπεία |
|---|---|---|
| **α** εμφάνιση (μικρογραφία) | `FileThumbnail` (κόμβος) ← `FileManagerPageContent` · `EntityFilesContent` · `FilesList` · `ListingMaterialRow` ← `ListingFloorplansPanel` · `ListingMediaOrderPanel` | Prop `file` (όχι `downloadUrl`)· πηγές από `file-thumbnail-sources.ts`: **παράγωγο** (`srcSet` + `sizes` = px του κουτιού, **ίδιο κελί** με την κλάση) → client `_thumb` (εφεδρεία) → πρωτότυπο **μόνο** για svg/gif → εικονίδιο / σελίδα PDF. Κάθε `onError` = ένα βήμα. |
| **α** εμφάνιση (zoom) | `FilePreviewRenderer` → `ImagePreview` (από `FilePreviewPanel`) | Νέο προαιρετικό `preview`. `use-zoom-resolution.ts`: `sizes` = ό,τι **ζωγραφίζεται** στο **content-box** του κουτιού (`containedWidth` — §9 Ε4/Ε6· ως 2026-10-03 ολόκληρο το κουτί)· η **περιστροφή δεν μπαίνει** στην ερώτηση (`scale·rotate` = ισομετρία, §9 Ε5)· στο zoom `ζωγραφισμένο × zoom × DPR` → `filePreviewWidthFor` = η **μικρότερη** επαρκής βαθμίδα, πρωτότυπο μόνο πάνω από 2560· φόρτωση στο παρασκήνιο + `decode()` πριν την αλλαγή· **μόνο προς τα πάνω**. Χωρίς `preview` (δημόσια κοινή χρήση, προσφορές) = ως πριν. |
| **α** εμφάνιση (γκαλερί) — *προστέθηκε 2026-10-03, §9 Ε2* | `MediaCard` + `PhotoPreviewModal` ← `MediaGallery` ← `EntityFilesContent` · `ReadOnlyMediaViewer` | Κάρτα: `thumbnailCandidatesOf` στο μετρημένο κουτί (`sizes` για `object-cover`) + `use-thumbnail-candidate`. Modal: `galleryPreviews` → `PhotoPreviewImage` → `useZoomResolution`· το URL μένει για λήψη/κοινή χρήση. |
| **β** bytes / άνοιγμα / «υπάρχει;» | `file-manager-handlers` (διπλό κλικ → `openRemoteUrlInNewTab`) · `FilePreviewPanel` · `InboxView` · `FileInspector` · `FloorplanGallery` · `useFloorplanPdfLoader` · `VideoPlayer` · `useFileDownload` (εφεδρεία μετά το `id`) | `fileDisplayUrl(file)`. Εγγραφές χωρίς `downloadUrl` **δεν κρύβονται** πια. |
| **β** ⚠️ πρωτότυπο | `useFloorplanImageLoader` · `FloorplanGallery.calibrationImageSrc` | `.url`, **ποτέ** `preview`: η βαθμονόμηση/μέτρηση δουλεύει στα pixel του πρωτοτύπου (`naturalWidth`). |
| **β** server | `useFloorplanFiles` (φίλτρο αυτόματης επεξεργασίας) | Ρωτά `storagePath` — αυτό διαβάζει το `floorplan-process.service`. |
| **δ** CAD | `useFloorplanSceneLoader` (PATH C/D) · `floorplan-duplicate-core` | `fileDisplayUrl`: **αποθηκευμένο `downloadUrl` πρώτα** ⇒ ταυτόσημη συμπεριφορά όπου υπάρχει (άγκυρα). Ο `floorplan-save-orchestrator` γράφει `downloadUrl` και `storagePath` στο **ίδιο** αντικείμενο· το `.scene.json` (`cadScene`, §2.2) ζει στο autosave του DXF Viewer. Το `DxfPreview` (συνθετική εγγραφή) δεν άλλαξε. |
| μένει | `VersionHistory` | Εκεί το πεδίο = **ετοιμότητα** έκδοσης, όχι URL· η λήψη γίνεται ήδη με `id`. |
| **γ** εκτός | `contracts-qr` · `useCrmAttachmentUpload` · `useFloorplanUpload` · `useFileUpload` · `read-only-media-types` | Γραφείς/τύποι — δεν διαβάζουν για εμφάνιση. |

- **SSoT επεκτάσεις** (κανένας νέος builder): `filePreviewWidthFor` (κλίμακα) · `ProxyImagePreview.ladder` (το `srcSet` **παράγεται** από αυτό) ·
  `sameOriginFetchUrlOf` — απορρόφησε το τοπικό `resolveStorageUrl` του `floorplan-pdf-renderer` (ωμό `/api/storage/file`, δικό του regex — N.0.2)·
  το `internal-proxy` URL μένει αυτούσιο ώστε να μη χαθεί το `?placement=` (ADR-895).
- **Ratchet** (CHECK 3.7, υπάρχουσα μηχανή): module `file-display-url` στο `.ssot-registry.json` — απαγορεύει **ανάγνωση** `x.downloadUrl` /
  `x?.downloadUrl` (όχι ανάθεση, δήλωση τύπου, shorthand, κλειδί i18n). Allowlist: `app/api` · `services` · `server` (γραφείς) · `VersionHistory` ·
  `useFloorplanUpload`. Baseline **χειρουργικά** μόνο για το module: 10 σημεία / 6 αρχεία στο `subapps` (dxf-viewer, procurement) — οι επόμενοι στόχοι.
  Απόδειξη ζωής στο `pattern-proofs.js`.

## 5. N.7.2 — έλεγχος αρχιτεκτονικής

| # | Ερώτηση | Απάντηση |
|---|---|---|
| 1 | Proactive/reactive; | Κατ' απαίτηση **με** κλειστή κλίμακα — όπως Next.js/Cloudinary· προ-ψήσιμο θα πλήρωνε για αρχεία που δεν βλέπει κανείς |
| 2 | Race; | Όχι: γενιά καρφωμένη στην ανάγνωση · ίδιο κλειδί ⇒ ίδια υπόσχεση · μισθωτής πριν από την cache |
| 3 | Ιδεμπότητο; | Ναι — ίδια είσοδος (γενιά·πλάτος·συνταγή) ⇒ ίδια bytes, ίδιο ETag |
| 4 | Belt-and-suspenders; | browser 304 + LRU + ουρά με όριο + `limitInputPixels` + όριο 50 MB |
| 5 | SSoT; | κλίμακα (1) · κωδικοποιητής (1) · builder URL (1) · αναγνώστης εμφάνισης (1) · κέλυφος γκαλερί (1) · lightbox/πάνελ (1) |
| 6 | Await/fire-and-forget; | Await — η απάντηση **είναι** το παράγωγο |
| 7 | Κάτοχος κύκλου ζωής; | Το πρωτότυπο: το παράγωγο δεν έχει δική του ζωή |

✅ Google-level: **YES** — η ορθότητα (διαγραφή/αντικατάσταση) είναι δομική, όχι διαδικαστική· κάθε στρώση έχει όριο.

## 6. Απορριφθείσες εναλλακτικές

- **Cache στον ιδιωτικό κάδο** (`_derived/` ή δίπλα στο πρωτότυπο) — §2.1.
- **AVIF με διαπραγμάτευση `Accept`** — ~5–10× πιο αργή κωδικοποίηση μέσα στο αίτημα, και το `Vary: Accept` κόβει την cache. Το webp είναι baseline.
- **`next/image`** — ο optimizer δεν περνά τη συνεδρία του χρήστη στο upstream· και ADR-841 Α12 τον αποφεύγει σκόπιμα.
- **Ελεύθερο πλάτος** — cache-busting / DoS (§3.1).
- **`reconcilePublicShelf` για εσωτερικά** — λάθος όριο εμπιστοσύνης (δημόσιος κάδος).
- **Τρίτο carousel / embla** — το κέλυφος υπήρχε· εξήχθη.

## 7. Ανοιχτά — ⏳ να μετρηθούν

- **Rate limit**: STANDARD (60/λεπτό) αρκεί για την κεφαλίδα· σε γκαλερί με δεκάδες φωτογραφίες + revalidation (`no-cache`) ίσως χρειαστεί
  ASSET (600/λεπτό, ήδη στη μεταδεικτική περιγραφή «binary assets μέσω authenticated proxy»). Να μετρηθεί σε πραγματική χρήση.
- **Hit rate μνήμης / χρόνος κωδικοποίησης** στο Netcup (2 ταυτόχρονες κωδικοποιήσεις, 64 MB) — να μετρηθεί πριν αλλάξει οποιαδήποτε σταθερά.
- ✅ ~~Οι ~32 υπόλοιποι αναγνώστες `downloadUrl`~~ — **έκλεισε 2026-10-02 (§4.1)**· μένουν 10 σημεία στο `subapps`, φραγμένα από το ratchet `file-display-url`.
- ✅ **Π1 + Π2 έκλεισαν 2026-10-02 (§3.7, Βήμα Δ)** — τα δύο παρακάτω μένουν ως ιστορικό της μέτρησης. ⏳ Ζωντανά μετά το push
  **και** το deploy των Functions (`firebase deploy --only functions:onImageDimensionsFinalize,functions:onImageDimensionsFinalizeFilesEu`)
  και τη συμπλήρωση (`POST /api/admin/backfill-image-dimensions`, **μόνο** με εντολή Giorgio — γράφει στην παραγωγή).
- **`sizes` του lightbox σε κάθετη φωτογραφία** (Π1, μετρημένο στο §9): το `70vw` περιγράφει το **πλάτος** του κουτιού, αλλά μια κάθετη λήψη
  περιορίζεται από το **ύψος** — μετρημένο 803 px CSS ζωγραφισμένα έναντι 1.680 δηλωμένων ⇒ ο browser ζητά μία βαθμίδα πάνω απ' όσο
  χρειάζεται. Θεραπεία μόνο όταν το `LightboxPhoto` φέρει **μετρημένες** διαστάσεις (`width/height` — σήμερα `null` για το ακίνητο)·
  ⛔ καμία επινοημένη αναλογία.
- **Βαθμίδες πάνω από το πρωτότυπο** (Π2, μετρημένο στο §9): πρωτότυπο 1.183 px ⇒ `w=1280` και `w=2560` δίνουν **ίδια** bytes με **δύο** κλειδιά cache
  και δύο κωδικοποιήσεις (ποτέ μεγέθυνση). Θεραπεία: κανονικοποίηση του κλειδιού σε `min(w, πλάτος πρωτοτύπου)` — απαιτεί το πλάτος
  **πριν** από την κωδικοποίηση (μεταδεδομένα, όχι αποκωδικοποίηση). Να μετρηθεί η συχνότητα πριν γραφτεί.
- 📏 **Μέτρηση Π1/Π2 (2026-10-02, παραγωγή, ανάγνωση μόνο κεφαλίδας — Range 128 KB + `sharp().metadata()`, ~0,7 s/αρχείο)**:
  24 εικόνες στη `files`· **καμία** δεν κρατά διαστάσεις. Δείγμα 6: `1200×1600` · `1600×739` · `1013×1800` · `1803×2225` · `3000×4000` · `1200×800`
  (κάτοψη png). ⇒ **Π2: 5/6** κάτω από 2560 (το `w=2560` = ίδια bytes με τη μικρότερη επαρκή βαθμίδα), **3/6** κάτω από 1280· **Π1: 4/6 κάθετες**.
  Η κεφαλίδα αρκεί (128 KB, χωρίς αποκωδικοποίηση) ⇒ ένα SSoT διαστάσεων είναι φθηνό. Σχέδιο προς έγκριση: §7 «Βήμα Δ».

## 8. Επαλήθευση

- jest: `file-preview-ladder` · `storage-object-generation` · `raster-encoder` (πραγματικό sharp) · `image-preview.service` ·
  `storage-file-route` (**πρώτη** σουίτα του route) · `storage-proxy-url-roundtrip` (Ρ3–Ρ4) · `file-display-url` (Π1–Π3) ·
  `property-floorplan-spots` · `PropertyHeaderGallery` · αμετάβλητα πράσινα: `ListingCardGallery`, `listing-photo-capture-spots`,
  `public-shelf-sanitise/-service/-invariants`.
- Μεταλλάξεις (επαναφορά στο ίδιο tool call): Δ — γενιά εκτός ETag · αναλυτής πλάτους χαλαρός · μεγέθυνση · ανάγνωση χωρίς γενιά ·
  μισθωτής παρακαμφθείς · `srcset` για svg/pdf ⇒ **6/6 κόκκινα**. Γ — αποτυχία σιωπηλή · χωρίς `srcset` · λάθος δείκτης lightbox ·
  χωρίς ←/→ · δύο `high` · κατόψεις χωρίς lightbox · αρίθμηση κατόψεων · κάτοψη PDF ⇒ **8/8 κόκκινα**.
- `jscpd:diff` στα 27 αρχεία: καθαρό.
- ✅ **Ζωντανά στον proxy** (dev server, πραγματική φωτογραφία `file_c098b8d6…`, 2026-10-01): πρωτότυπο **3.424.071 B** ⇒
  `w=320` **19.380 B** (320×427) · `w=640` **79.030 B** (640×853) · `w=2560` 758.268 B — όλα webp, **χωρίς EXIF**, σωστά στραμμένα
  (κάθετη λήψη κινητού). Δεύτερο `w=640` από τη μνήμη (0,97s έναντι 3,07s) · `If-None-Match` ⇒ **304, 0 B** · `w=641` ⇒ 400 ·
  ανύπαρκτο ⇒ 404 `absent`. ⚠️ Στο **dev** το `Cache-Control` φτάνει `no-store, …` — καθολικός κανόνας dev του `next.config.js`
  `headers()`· στην παραγωγή ισχύει το `private, no-cache` του route.
- ✅ UI σε browser — §9.
- Ε1: `ListingCardGallery.test` **Δ1–Δ4** (διαδοχικά βήματα) · μεταλλάξεις: βήμα από το στιγμιότυπο `index` · αγνόηση προορισμού ·
  καμία ακύρωση στο «πιάσιμο» · θέση χωρίς ανάγνωση DOM ⇒ **4/4 κόκκινα**. Σουίτες γκαλερί/κεφαλίδας/θέσης **32/32**· `jscpd:diff` καθαρό.
- §3.7 (Βήμα Δ): `image-dimensions` Δ1–Δ4 · `stored-image-dimensions` Π1–Π4 · `file-preview-ladder` Λ5–Λ6 · `image-preview.service`
  Υ7–Υ9 · `storage-object-generation` (διαστάσεις από metadata · Γ4 εύρος + `ifGenerationMatch`) · `file-display-url` Π4 ·
  `property-photos` Φ5 · `property-floorplan-spots` Κ4 · `photo-lightbox-sizes` Λ1–Λ4 · `use-zoom-resolution` Ζ7 ·
  `image-dimensions-backfill` Σ1–Σ5 · Functions `image-dimensions-onfinalize` Η1–Η5 · `finalized-object` (γενιά string) ·
  `regional-storage-triggers` (πληρότητα bindings) · σουίτες κανόνων `files` («measured freeze», 4 σκέλη + αφαίρεση + γέννηση) και
  `files-personal`. Μεταλλάξεις (επαναφορά στο ίδιο tool call): Δ1 **8/8** · Δ2 **15/15** (μία επέζησε αρχικά — σύγκριση μόνο
  πλάτους — η άγκυρα ενισχύθηκε) · Δ3 **7/7** · Δ4 + συμπλήρωση + Δ5 **18/18** · κανόνες στον emulator **4/4** (σουίτες
  `files` + `files-personal` 116/116). Golden μητρώου 340/340 · `jscpd:diff` (18 αρχεία) καθαρό · CHECK 3.93 φρέσκο.
- 🔴 Στην πορεία βρέθηκε **ήδη κόκκινο** `property-floorplan-spots.test` Κ3/Κ4 από το Βήμα Γ (το `...buildProxyPreview()` περίμενε
  `ladder` που το σχήμα κάτοψης δεν έχει) — διορθώθηκε.

## 9. Ζωντανός έλεγχος παραγωγής (2026-10-01)

Deploy `7da3dad8` (περιέχει `8521b68d` + `60f1aea7`): GitHub Actions «Build & Deploy Docker Image» ✅ → Netcup → `nestorconstruct.gr`.
Οι κόκκινες πύλες CI του ίδιου push (3.30 · 3.34 · 3.47 · A11y G11 · Contrast · Secret Scan · Functions Integration) **δεν** αφορούν
αρχεία αυτού του ADR — όλες υπήρχαν ήδη στο push `369ef599` (η Functions Integration από 2026-09-22).

| # | Έλεγχος (δοκιμαστικό ακίνητο, 2 φωτογραφίες) | Αποτέλεσμα |
|---|---|---|
| Β1 | Κεφαλίδα: σταθερό κουτί 192×128 (πριν/μετά την πλοήγηση) · μετρητής · βελάκια · τελείες · σήμα σημείου λήψης | ✅ |
| Β1 | Κινητό 390×844 (iPhone 12 Pro, DevTools — στιγμιότυπο Giorgio): όλο το πλάτος, χωρίς οριζόντια υπερχείλιση | ✅ |
| Β2 | `?w=320` (όχι πρωτότυπα) · webp **19.380 B** · `private, no-cache` · ETag **ίδιο** με το dev (ντετερμινιστική κωδικοποίηση) | ✅ |
| Β2 | reload ⇒ **304 / 304** · `If-None-Match` ⇒ 304 · `w=641` ⇒ 400 · **0** × `429` (11 αιτήματα `/api/` ανά φόρτωση) | ✅ |
| Β3 | Κλικ στη 2η ⇒ ανοίγει **στη 2η** · ←/→ · άκρα ανενεργά · Esc κλείνει · εστίαση μέσα στο dialog **και επιστροφή** στο slide | ✅ |
| Β3 | Πάνελ κάτοψης: πλαίσιο = εικόνα = SVG (318,8×213, ίδια θέση) · viewBox = μετρημένες διαστάσεις · βορράς · κλικ σε σημείο ⇒ άλμα + `aria-current` | ✅ |
| Β3 | Κονσόλα: κανένα σφάλμα / προειδοποίηση Radix / ωμό κλειδί | ✅ |

### Ε1 — 🔴 το δεύτερο γρήγορο «Επόμενη» **χανόταν** (κέλυφος `SnapGallery` — άρα **και** οι κάρτες αναζήτησης)

**Μέτρηση**: δεύτερο κλικ **40 ms** μετά το πρώτο ⇒ έμενε στο ίδιο slide· 120/250 ms σωστά. **Ρίζα**: τα βελάκια/←/→ έγραφαν
`goTo(index ± 1)` — **στιγμιότυπο** της τελευταίας απόδοσης. Ο `index` τον γράφει μόνο ο παρατηρητής, όταν το νέο slide γίνει ορατό
κατά 60% — **στη μέση** της ομαλής κύλισης. Ο κανόνας 2 του ADR-040 εφαρμοζόταν στο **πλάτος** (Κ2) αλλά όχι στη **θέση**.
**Θεραπεία** (`use-gallery-scroller.ts` · `useStepOrigin`): το ζεύγος **προορισμός / θέση** των Embla/Swiper — όσο τρέχει κίνηση
που ζήτησε το UI, το βήμα ξεκινά από τον **προορισμό**· αλλιώς από τη θέση του DOM **τη στιγμή του συμβάντος**
(`round(scrollLeft / clientWidth)`). Η πρόθεση σβήνει στην **άφιξη** (ο παρατηρητής) ή όταν ο άνθρωπος **πιάσει** τον κύλινδρο
(`pointerdown`/`wheel`/`touchstart`). Το API έγινε `step(±1)` αντί για `goTo(index ± 1)` — ο καλών **δεν μπορεί** πια να δώσει στιγμιότυπο.
Ο `index` μένει αυτό που ήταν: αντίγραφο για την οθόνη (τελείες, μετρητής, ετικέτες βελών).

### Υποθέσεις που **διαψεύστηκαν** (για να μην ξαναψαχτούν)

- *«Ο παρατηρητής ελέγχει `isIntersecting` αντί για `intersectionRatio ≥ 0,6`»*: μετρημένο με δεύτερο παρατηρητή ίδιων ρυθμίσεων —
  ο Chrome δίνει `isIntersecting=false` στο r=0,004. Καθυστερήσεις του μετρητή στο dev οφείλονταν σε **μπλοκαρισμένο main thread**
  (μεταγλώττιση κατ' απαίτηση) και στραγγαλισμένη απόδοση καρτέλας — όχι στη λογική.
- *«Ωμά κλειδιά i18n στη σελίδα»* (`media.capture.counter`, `panel.*`): μόνο στο dev, ενώ τα locale chunks μεταγλωττίζονταν — **όλα** τα
  namespaces, και του `properties-detail`. Στην παραγωγή **0**.
- *«`w=2560` για κουτί 803 px»*: ο browser είχε zoom 80% (DPR 0,8, viewport 2.400 px CSS) ⇒ 70vw × 0,8 = 1.344 > 1.280 — **σωστή** επιλογή.
  Μένει η υπερεκτίμηση της κάθετης φωτογραφίας (Π1, §7).
- *«Ένα 200 αντί για 304 στο reload»*: το προκάλεσε δικό μου `fetch(…, { cache: 'no-store' })`· σε σταθερή κατάσταση 304/304.

### Παρατηρήσεις εκτός πεδίου (μετρημένες, όχι διορθωμένες)

- 🔴 **DXF Viewer — διπλή στροφή EXIF στο υπόβαθρο κάτοψης** (βρέθηκε 2026-10-02 στο audit του §3.7, **δεν** διορθώθηκε —
  domain ADR-340, αγγίζει αποθηκευμένες βαθμονομήσεις): `floorplan-background/providers/ImageProvider.ts` αποκωδικοποιεί με
  `createImageBitmap(blob)` — του οποίου η προεπιλογή `imageOrientation: "from-image"` **ήδη** εφαρμόζει τον EXIF (HTML Standard ·
  Chrome 52+, Firefox 93+, Safari 15+) — και **μετά** ξαναστρέφει με `_applyOrientation(orientation από exifr)`. Κάθετη λήψη κινητού
  (`Orientation = 6`) ⇒ στρέφεται **δύο** φορές (πλαγιαστή, ανταλλαγμένες διαστάσεις). Θεραπεία προς απόφαση: είτε
  `createImageBitmap(blob, { imageOrientation: 'none' })` (η «none» έχει αποσυρθεί από το πρότυπο — μέτρηση ανά browser) είτε κατάργηση
  της χειροκίνητης στροφής για τον κλάδο του browser· **πριν** από αυτό, έλεγχος αν υπάρχουν βαθμονομήσεις πάνω σε στραμμένα JPEG.
  Φραγμένο στο ratchet `image-dimensions` (baseline 1).
  ✅ **ΛΥΘΗΚΕ 2026-10-04** (ADR-340 changelog). **Αναπαραγωγή** (Chrome 154, πραγματικό `file_3dc3c55b`): κωδικοποιημένο 2400×1800,
  EXIF 6 · `createImageBitmap` προεπιλογή / `from-image` / **`none`** ⇒ **1800×2400 και στα τρία** · παλιός αγωγός ⇒ **2400×1800**.
  Άρα η εκδοχή «`none` + χειροκίνητη» **δεν** είναι διαθέσιμη (ο Chrome αγνοεί το `none`) ⇒ μία αρχή = ο decoder (`from-image`),
  η χειροκίνητη στροφή **διαγράφηκε**. **Βαθμονομήσεις**: `floorplan_backgrounds` = **0** έγγραφα στην παραγωγή ⇒ καμία μετάπτωση.
  Ratchet `image-dimensions`: baseline **0**. Άγκυρα `ImageProvider.orientation.test.ts` (Ο1–Ο4), μεταλλάξεις 2/2.
- Η σελίδα ακινήτου στην παραγωγή φορτώνει **243** chunks `/_next/static` (γεμίζει το buffer χρονισμού των 250 εγγραφών).
- 14 προειδοποιήσεις *«preloaded but not used»* από `<link preload>` του Next — η γκαλερί δεν κάνει preload.

### Βήματα Α/Γ/Δ ζωντανά (2026-10-03)

Deploy `89e3be47`: «T1 🚀 Build & Deploy Docker Image» ✅ (run 37109478085) → Netcup → `nestorconstruct.gr`. Chrome, DPR **0,8**
(zoom 80%), viewport 2.400 px CSS. Δοκιμαστικό ακίνητο `prop_48a7caf6…`: `file_c098b8d6` 3000×4000 · `file_244732c7` 1803×2225 ·
κάτοψη png `file_474b4d3c` 1200×800.

| # | Έλεγχος | Μέτρηση | Αποτέλεσμα |
|---|---|---|---|
| Α1 | Δύο γρήγορα «Επόμενη» (40 ms) | Μετά το Δ4 η κεφαλίδα έχει **3** slides: Ε+Ε σε 40 ms ⇒ **1** (αναμενόταν 2) · σε 250 ms ⇒ 2. ⚠️ Η πρώτη ανάγνωση («με 2 slides αδιάκριτο λόγω clamp») ήταν **λάθος**: το `step` κάνει **λούπα**, άρα και το 0→1 της αναζήτησης (Ε+Ε σε 2 slides) ήταν ήδη το ίδιο σύμπτωμα. Ρίζα: **όχι** το `useStepOrigin` αλλά ο **φρουρός 120 ms** με παγωμένα καρέ | 🔴 **Ε3** (κάτω) — διορθώθηκε στον κώδικα, ζωντανά μετά το push |
| Δ1 | `srcset` κεφαλίδας | 3000 px ⇒ 320/640/1280/**2560** · 1803 px ⇒ 320/640/1280/**2560** (η 2560 = πρώτη ≥ 1803) · κάτοψη 1200 px (πάνελ lightbox) ⇒ 320/640/**1280** — **καμία** βαθμίδα πάνω από την πρώτη επαρκή. `sizes` `(min-width: 640px) 12rem, 100vw` ⇒ φορτώθηκε `w=320` · μία εικόνα `fetchpriority="high"` | ✅ |
| Δ2 | Lightbox κάθετης `file_c098b8d6` | `sizes="762px"` (όχι `70vw`)· κουτί ύψους 991 px ⇒ 991 × ¾ = 743 → σκαλοπάτι 16 + ½ ⇒ 762 · φορτώθηκε **`w=640`** (762 × 0,8 = 610 ≤ 640). Πριν (§9, 2026-10-01): `70vw` ⇒ `w=2560` | ✅ |
| Δ3 | Κάτοψη 1200 px: `w=1280` · `w=2560` · `w=1280` | **ίδιο ETag** `"yw_y40b2…"` και ίδια bytes (16.322 B webp) και στα τρία· `If-None-Match`(ETag του 1280) στο `w=2560` ⇒ **304** · `private, no-cache` | ✅ |
| Δ4 | Νέο ανέβασμα κάθετης (εντολή Giorgio): συνθετικό JPEG αποθηκευμένο **2400×1800** με EXIF `Orientation=6` → καρτέλα «Φωτογραφίες» | `file_3dc3c55b…`: αντικείμενο 09:38:14.7Z → log `{"verdict":"write","width":1800,"height":2400}` 09:38:20.3Z (**~5,6 s**) · εγγραφή `imageDimensions` **1800×2400** (θεατής — ανταλλαγή EXIF σωστή) · `metageneration` 2 (custom metadata). Το `_thumb.webp` του client ⇒ `verdict: no-record` (σωστά — δεν είναι εγγραφή) | ✅ |
| Γ1 | File Manager (`/files`) | 15 μικρογραφίες φορτωμένες **`w=320`**, `sizes="40px"` (κουτί 38 px)· 9 ακόμη `loading="lazy"` εκτός οθόνης (δεν φορτώθηκαν — σωστό)· 2 = `*.dxf.thumbnail.png` (συνοδευτικό DXF, §2.2 — δεν είναι εικόνα-αρχείο) | ✅ |
| Γ1 | Ακίνητο → καρτέλα **«Φωτογραφίες»** (`MediaGallery` → `MediaCard`) | κάρτα 160×120 φορτώνει το **πρωτότυπο** (`fileDisplayUrl`, χωρίς `srcset`): 3,27 MB και 1,97 MB για 160 px. Και το `PhotoPreviewModal` που ανοίγει από εκεί δείχνει το **πρωτότυπο** 3000×4000 σε κουτί 696×928 | 🔴 **Ε2** (κάτω) |
| Γ2 | Πάνελ προεπισκόπησης + zoom, κάτοψη 1200 px | 100%: `w=1280`, βαθμίδες 320/640/**1280** · zoom **125%** ⇒ **πρωτότυπο** (`downloadUrl`, 55.790 B, αποκωδικοποιημένο 1200×800) — **ποτέ** `w=2560` | ✅ |
| Γ3 | Κονσόλα (ακίνητο · `/files` · αναζήτηση) | κανένα σφάλμα / ωμό κλειδί i18n· μόνο προειδοποίηση MapLibre `Image "townhall" could not be loaded` στην αναζήτηση (εκτός πεδίου) | ✅ |

#### Ε2 — 🔴 `MediaCard` + `PhotoPreviewModal`: εμφάνιση που ταξινομήθηκε ως «bytes»

Η καρτέλα «Φωτογραφίες» του ακινήτου (`EntityFilesContent` → `MediaGallery` → `MediaCard`· επίσης `ReadOnlyMediaViewer`) δεν
εμφανίζεται στον πίνακα του §4.1: πέρασε στο `fileDisplayUrl(file)` (= «το αρχείο») ενώ είναι **κατηγορία α** (εμφάνιση). Το ratchet
`file-display-url` απαγορεύει την **ανάγνωση `downloadUrl`**, όχι την κλήση `fileDisplayUrl` σε θέση εμφάνισης ⇒ το σημείο είναι
**αόρατο** στην πύλη.

✅ **Θεραπεία (2026-10-03, εντολή Giorgio)** — κανένας νέος μηχανισμός, μόνο οι υπάρχοντες:
- **Κάρτα** (`MediaCard`): `thumbnailCandidatesOf` στο **μετρημένο** κουτί (`useElementSize`, σκαλοπάτι 16 + ½ — ίδιος κανόνας με το
  `lightboxSizesOf`)· πριν τη μέτρηση το άνω φράγμα της στήλης (`minmax(160px, 1fr)` ⇒ < 320 px, σε 4:3). Η κλιμάκωση σφαλμάτων
  (παράγωγο → `_thumb` → ορατό σφάλμα) **εξήχθη** από το `FileThumbnail` στο `use-thumbnail-candidate.ts` και τη μοιράζονται (N.0.2).
- **`sizes` για `object-cover`**: νέο `coveredWidth` στο SSoT (`lib/images/image-dimensions.ts`, δίδυμο του `containedWidth`) +
  `thumbnailSizesOf` — πανοραμική σε τετράγωνο/4:3 κουτί χρειάζεται πλάτος **μεγαλύτερο** από του κουτιού (αλλιώς θολή), ποτέ πάνω
  από τα pixel της. Ωφελεί και το `FileThumbnail` (αριθμός = τετράγωνο κουτί).
- **Modal**: νέο προαιρετικό `galleryPreviews` (`PhotoGalleryPreviews`) από το `openModal` ως το `PhotoPreviewModal`· η εικόνα
  (`core/modals/PhotoPreviewImage.tsx`) ρωτά τον **ίδιο** `useZoomResolution` του πάνελ: μικρότερη επαρκής βαθμίδα, πρωτότυπο
  μόνο σε βαθύ zoom. Το `galleryPhotos` μένει **το αρχείο** (λήψη/κοινή χρήση). Χωρίς `galleryPreviews` (επαφές, λογότυπα) = ως πριν.
  ⚠️ Δικό της `<figure>` με δικό της ref: το `<main>` του modal δένει το ref του **μετά** τα παιδιά (σειρά commit) ⇒ ένα παιδί που
  ρωτούσε εκείνο θα έβλεπε `null` και δεν θα μετρούσε ποτέ.
- Boy Scout (CHECK 3.28): ο τύπος `modalProps` του `usePhotoPreviewModal` επαναλάμβανε πεδίο-πεδίο το `PhotoPreviewState` ⇒
  πλέον `Omit<PhotoPreviewState, 'isOpen'> & { open, onOpenChange }`.

#### Ε3 — 🔴 ο φρουρός 120 ms του **ξεπερασμένου** βήματος ακύρωνε το επόμενο

**Μέτρηση** (καρτέλα με στραγγαλισμένα καρέ — `sleep(40)` κράτησε 1.010 ms, `scrollLeft` ακίνητο 1 s μετά το κλικ): Ε+Ε σε 40 ms ⇒
**1**. Ο `useStepOrigin` δούλεψε (το 2ο βήμα ζήτησε σωστά το 2). **Ρίζα**: κάθε `goTo` οπλίζει φρουρό *«αν σε 120 ms δεν κουνήθηκε,
πήγαινε ακαριαία»*. Ο φρουρός του **1ου** βήματος πηδούσε στο **παλιό** του target (slide 1)· ο φρουρός του 2ου έβλεπε τότε
«κουνήθηκε» (|400 − 0| ≥ 1) και παραιτούνταν. Σε ορατή καρτέλα με ζωντανό smooth scroll δεν εμφανίζεται (ο φρουρός μένει αδρανής) —
γι' αυτό το §9 της 2026-10-01 μέτρησε σωστά 40/120/250 ms. **Θεραπεία** (`use-gallery-scroller.ts`): ο φρουρός ενεργεί **μόνο αν η
πρόθεσή του ισχύει ακόμη** (`intentRef.current === wrapped`) — ξεπερασμένο βήμα, άφιξη ή άνθρωπος που έπιασε τον κύλινδρο ⇒ σιωπά.
Ο φρουρός **δεν είχε καμία άγκυρα**· νέα `ListingCardGallery.test` **Δ5** (παγωμένη κύλιση + fake timers ⇒ 800, όχι 400).

#### Παρατηρήσεις (μετρημένες, όχι διορθωμένες)

- ~~Πάνελ προεπισκόπησης: `sizes="1227px"` = πλάτος **κουτιού**, ενώ η εικόνα ζωγραφίζεται 821×548 (`object-contain`, φραγμένη από
  ύψος) — η ίδια υπερεκτίμηση με το Π1 του lightbox. Εδώ αθώα (821 × 0,8 = 657 > 640 ⇒ `w=1280` ούτως ή άλλως), όχι γενικά.~~
  ⇒ **όχι γενικά αθώα**: στο modal της γκαλερί κόστισε `w=2560` αντί για `w=640` — διορθώθηκε ως **Ε4** (κάτω).
- Το κουμπί μεγέθυνσης του πάνελ δεν έχει προσβάσιμο όνομα (`button` χωρίς `aria-label`).
- Το log του trigger γράφει `message: "Image dimensions recorded"` **και** στο `verdict: no-record` (π.χ. `_thumb.webp`) — παραπλανητικό
  κείμενο· το `verdict` είναι η αλήθεια.
- ~~«Στο τελευταίο slide το «Επόμενη» δεν είναι `disabled`»~~ — **σχεδιασμός**, όχι σφάλμα: λούπα (άγκυρα Α1, `use-gallery-scroller`).

### Ε2/Ε3 ζωντανά (2026-10-03, deploy `88f7c42b`)

Deploy `88f7c42b` (περιέχει το `5bf14f0e` — `git merge-base --is-ancestor` ✅): «T1 🚀 Build & Deploy Docker Image» ✅ (run
37141174724, 14′53″) → Netcup → `nestorconstruct.gr`. Chrome, DPR **0,8**, viewport 2.400 px CSS. Χρόνοι με `performance.now()`.
⚠️ **Δύο καθεστώτα καρέ, μετρημένα**: στο ακίνητο η καρτέλα ήταν **ζωντανή** (rAF 61 fps, `sleep(40)` = 44 ms)· στην αναζήτηση
**στραγγαλισμένη** (`sleep(40)` = **561** ms — εκεί το διάστημα των 40 ms δόθηκε με busy-wait, όχι `setTimeout`). Ο φρουρός του Ε3
ενεργεί μόνο όταν η ομαλή κύλιση **δεν** κινείται· για να εκτελεστεί ο κλάδος του και σε ζωντανή καρτέλα, το `scrollTo` (χωρίς
`behavior: 'auto'`) **αυτού του `<ul>`** αντικαταστάθηκε προσωρινά με no-op — η ίδια συνθήκη με την άγκυρα Δ5 — και αποκαταστάθηκε στο
`finally` (επαληθευμένο).

| # | Έλεγχος | Μέτρηση | Αποτέλεσμα |
|---|---|---|---|
| Ε2α | Καρτέλα «Φωτογραφίες» → 3 κάρτες `article[role=button] figure img` | κουτί 160×120 · `srcset` 320/640/1280/2560 · `sizes="168px"` (160 + ½ σκαλοπατιού· κάθετες σε 4:3 cover ⇒ πλάτος = κουτί) · φορτώθηκε **`w=320`** και στις 3: webp **2.916 / 19.380 / 16.556 B** (πριν: πρωτότυπο **3,27 MB** / 1,97 MB) · `private, no-cache` · `loading="lazy"` | ✅ |
| Ε2β | Κλικ στην κάρτα `file_c098b8d6` (3000×4000) → `PhotoPreviewModal` (2/3) | `srcset` 320…2560 · κουτί `<figure>` **2352×928**, εικόνα ζωγραφισμένη **696×928** · `sizes="2352px"` ⇒ φορτώθηκε **`w=2560` (758.317 B)**· αρκούσε `w=640` (696 × 0,8 = 557). zoom 125% ⇒ ίδιο · **150% ⇒ πρωτότυπο** (2352 × 1,5 × 0,8 = 2822 > 2560) | ⚠️ καλύτερα από πριν (όχι πρωτότυπο στο άνοιγμα), **όχι** η μικρότερη επαρκής ⇒ 🔴 **Ε4** (κάτω) — διορθώθηκε στον κώδικα, ζωντανά μετά το push |
| Ε2β | Λήψη | `handleDownload` → `currentPhoto` = `galleryPhotos[i]` = **το αρχείο** (κώδικας — το κουμπί δεν πατήθηκε: θα κατέβαζε αρχείο) | ✅ |
| Ε2γ | ←/→ στο modal | 1/3 ⇒ `file_3dc3c55b` · 2/3 ⇒ `file_c098b8d6` · 3/3 ⇒ `file_244732c7` — κάθε φωτογραφία με **το δικό της** παράγωγο (`galleryPreviews` ↔ `galleryPhotos` ευθυγραμμισμένα). Επιστροφή στο 2/3 μετά από zoom ⇒ το ήδη αποκωδικοποιημένο πρωτότυπο (η αναβάθμιση κρατιέται ανά κλειδί — bytes ήδη στη μνήμη, κανένα νέο κατέβασμα· **σχεδιασμός**) | ✅ |
| Ε3 | Κεφαλίδα (3 slides), ζωντανή κύλιση | «Επόμενη» ×2 σε **42 ms** από 0 ⇒ **2** · 6 ms ⇒ **2** · «Προηγούμενη» ×2 σε 46 ms ⇒ **1** (λούπα 0→2→1) | ✅ |
| Ε3 | Κεφαλίδα, **παγωμένη** κύλιση (κλάδος φρουρού) | Ε×2 σε 41 ms ⇒ **2** (πριν: 1) · Π×2 σε 42 ms ⇒ **1** · 4 κλήσεις `scrollTo` καταπιέστηκαν ⇒ τις μεταβάσεις τις έκανε ο φρουρός | ✅ |
| Ε3β | `/search/results`, 6 κάρτες × 2 slides | Ε×2 σε **42 ms** ⇒ **0** (πριν: 1), ζωντανή **και** παγωμένη κύλιση, με στραγγαλισμένους timers | ✅ |
| Γ3 | Κονσόλα (ακίνητο + modal · αναζήτηση) | κανένα σφάλμα της εφαρμογής / ωμό κλειδί i18n. Μόνο 3 × «A listener indicated an asynchronous response…» = μηνύματα **extension** του Chrome (όχι της σελίδας) | ✅ |

#### Ε4 — 🔴 το `useZoomResolution` δήλωνε ολόκληρο το κουτί, όχι ό,τι ζωγραφίζεται

**Ρίζα**: το κουτί μετριόταν ως **max(πλάτος, ύψος)** — «άνω φράγμα για κάθε περιστροφή». Στο modal το `<figure>` είναι όλο το
πλάτος της οθόνης (2352) ενώ η κάθετη εικόνα, `object-contain`, περιορίζεται από το **ύψος** (928 × ¾ = 696). Η ίδια υπερεκτίμηση με
την παρατήρηση του πάνελ (1227 έναντι 821) και με το Π1 του lightbox — το lightbox την είχε λύσει (`lightboxSizesOf` → `containedWidth`),
ο **μηχανισμός zoom όχι**, και μετά το Ε2 τον μοιράζονται πάνελ **και** modal. Η τιμή ενός κουτιού δεν είναι απάντηση στο ερώτημα του
hook (*«πόσα pixel χρειάζεται η εικόνα»*) — ήταν η ερώτηση της κλάσης, όχι του δείγματος.

**Θεραπεία** — μόνο υπάρχοντα SSoT, κανένας νέος μηχανισμός:
- **Οι διαστάσεις ταξιδεύουν με την προεπισκόπηση**: `ProxyImagePreview.intrinsicWidth` → **`dimensions: ImageDimensions | null`**
  (`buildProxyPreview(path, placement, dimensions)`· ο `fileDisplayUrlOf` τις είχε ήδη μετρημένες). Ένα πεδίο, όχι πλάτος + ύψος:
  δύο παράλληλα nullable μπορούν να διαφωνήσουν.
- **`paintedWidthOf(box, dimensions, rotation)`** στο `use-zoom-resolution.ts`: `containedWidth` (SSoT `image-dimensions`) για την
  **τρέχουσα** περιστροφή — στροφή κατά περιττό αριθμό τετάρτων ⇒ ο άξονας πλάτους της εικόνας τρέχει κατά το **ύψος** του κουτιού.
  Η περιστροφή είναι πλέον είσοδος του hook (όπως το zoom): ανεβάζει βαθμίδα όταν χρειάζεται, μετά το `decode()`, ποτέ προς τα κάτω.
  ❌ **Διαψεύστηκε ζωντανά 2026-10-04 ⇒ Ε5** (κάτω): το `rotate` του transform δεν ξανακάνει layout — η στροφή **αφαιρέθηκε** από την ερώτηση.
  Χωρίς διαστάσεις: ο αντίστοιχος άξονας του κουτιού (ποτέ θόλωμα). Πρακτική Immich / Google Photos: η ανάλυση ακολουθεί ό,τι
  **βλέπει** ο άνθρωπος, όχι το δοχείο.
- **Μέτρηση από το SSoT `useElementSize`** (σκαλοπάτι 16) αντί για τοπικό `useBoxPx` με δικό του `ResizeObserver` (N.0.2).
- **`steppedUpperBound`** (`hooks/media/useElementSize.ts`): ο κανόνας «σκαλοπάτι + ½ = άνω φράγμα» ήταν γραμμένος **δύο** φορές
  (`lightboxSizesOf`, `MediaCard.imageBoxOf`) και θα γραφόταν τρίτη — έγινε ένα σημείο, τον καλούν και οι τρεις.
- Καλούντες: `PhotoPreviewImage` (`rotation` από το `usePhotoPreviewState`, που πλέον το εκθέτει) · `FilePreviewRenderer.ImagePreview`
  (`displayRotation` state δίπλα στο `rotRef`, όπως το `displayZoom` δίπλα στο `zoomRef`).
- **Αναμενόμενο μετά το push** (ίδιο modal, ίδια οθόνη): `sizes="702px"` (κουτί 2360×936 μετά το +½ σκαλοπατιού ⇒ 936 × ¾) ⇒ **`w=640`** στο άνοιγμα· `w=2560` στο
  ~250%· πρωτότυπο μόνο πάνω από 2560 / (702 × 0,8) ≈ **456%**. Πάνελ: `sizes` = ζωγραφισμένο (~821), όχι 1227.
- ⚠️ Το πάνελ μετρά το **border-box** του δοχείου (`p-4`) — υπερεκτίμηση ≤ 32 px, αθώα (ποτέ θόλωμα).
  ❌ **Διαψεύστηκε ζωντανά 2026-10-04 ⇒ Ε6** (κάτω): μετρήθηκαν **+55** px — τα 32 px του **ύψους** πολλαπλασιάζονται με τον λόγο πλευρών.

**Άγκυρες**: `use-zoom-resolution.test.tsx` **Ζ8** (η μετρημένη περίπτωση 2352×928 ⇒ 696 · `sizes` ζωγραφισμένο · zoom × ζωγραφισμένο) +
**Ζ9** (90°/270° ⇒ άλλος άξονας · 180° όρθια)· Ζ1–Ζ7 αμετάβλητα (κουτί 592×400 ⇒ άνω φράγμα 600). Μεταλλάξεις **3/3** κόκκινες:
ολόκληρο κουτί (5 κόκκινα) · αγνόηση περιστροφής (2) · χωρίς ½ σκαλοπατιού (5, και στο lightbox). 11 σχετικές σουίτες πράσινες ·
`jscpd:diff` καθαρό στα 10 αρχεία.

**Αρχεία για commit** (μόνο αυτά — το working tree μοιράζεται): `src/components/shared/files/preview/use-zoom-resolution.ts` ·
`src/components/shared/files/preview/FilePreviewRenderer.tsx` · `src/components/shared/files/preview/__tests__/use-zoom-resolution.test.tsx` ·
`src/hooks/media/useElementSize.ts` · `src/components/shared/media/PhotoLightbox.tsx` · `src/components/shared/files/media/MediaCard.tsx` ·
`src/lib/storage/storage-object-url.ts` · `src/lib/files/file-display-url.ts` · `src/lib/files/__tests__/file-display-url.test.ts` ·
`src/lib/properties/__tests__/property-floorplan-spots.test.ts` · `src/core/modals/PhotoPreviewImage.tsx` · `src/core/modals/PhotoPreviewModal.tsx` ·
`src/core/modals/usePhotoPreviewState.ts` · αυτό το ADR.

### Ε4 ζωντανά (2026-10-04, deploy `7402112f`)

Commit `184d3c3d` ⊂ deploy `7402112f` (`git merge-base --is-ancestor` ✅, T1 `completed success`). Ίδια οθόνη με το Ε2β: DPR **0,8**,
παράθυρο 2400×1121, `sleep(40)` = **408 ms** (στραγγαλισμένοι timers ⇒ χρόνοι από `performance` resource timing, όχι από timers).

| # | Τι | Μετρημένο | Αποτέλεσμα |
|---|---|---|---|
| Ε4α | Modal `file_c098b8d6` (2/3), zoom 100%, μετά από reload | κουτί `<figure>` 2352×928, ζωγραφισμένη **696×928** · `sizes="702px"` ⇒ **`w=640`, 79.046 B** (πριν `w=2560`, 758.317 B ⇒ **−89,6%**) · λήψη 1.647 ms | ✅ |
| Ε4β | «Μεγαλύτερο» βήμα-βήμα (+25%) ως 500% | 125% ⇒ `w=1280` (287.657 B) · 150–225% ίδιο · **250%** ⇒ `w=2560` (758.317 B) · 275–450% ίδιο · **475%** ⇒ πρωτότυπο (3.423.049 B) — θεωρία 114% / 228% / **456%** | ✅ |
| Ε4γ | «Περιστροφή» 90° στο 100%, μετά από reload | `sizes` 702 → **936px** ⇒ φορτώθηκε **`w=1280` (287.657 B)** · layout του `<img>` **696×928 αμετάβλητο**, ζωγραφισμένο 928×696 ⇒ ο άξονας πλάτους της εικόνας μένει **696** px ⇒ αρκούσε το ήδη φορτωμένο `w=640` (696 × 0,8 = 557) | 🔴 υπερ-λήψη (ποτέ θόλωμα) ⇒ **Ε5** |
| Ε4δ | Επόμενη/Προηγούμενη στις 3 | 1/3 `702px` · 2/3 `702px` · 3/3 (1803×2225) **`759px`** (ζωγραφισμένη 752×928) — όλες `w=640` (7.134 / 79.046 / 73.230 B) | ✅ |
| Ε4ε | Πάνελ `/files` → κάτοψη `file_474b4d3c` (1200×800) | δοχείο 1227×580 με `padding: 16px`, ζωγραφισμένη **821×548** · `sizes="876px"` (+55) · `w=1280` | ⚠️ ίδια βαθμίδα εδώ, αλλά το «≤ +32 αθώο» διαψεύστηκε ⇒ **Ε6** |
| Ε4ζ | Κάρτες «Φωτογραφίες» + lightbox κεφαλίδας | κάρτες `sizes="168px"`, `w=320` (×3) · lightbox `sizes="726px"`, **`w=640`** (7.134 B), κουτί 1710×940 | ✅ (βαθμίδα αμετάβλητη· το `726` έναντι `762` του handoff δεν συγκρίθηκε στο ίδιο παράθυρο) |
| Γ3 | Κονσόλα (καταγραφή από reload: καρτέλα → modal → zoom → στροφή → επόμενη) | **0** σφάλματα / προειδοποιήσεις · **0** ωμά κλειδιά στο DOM | ✅ |

#### Ε5 — 🔴 «στροφή = άλλο κουτί» ήταν υπόθεση, όχι μέτρηση

**Ρίζα**: το Ε4 έδωσε στο `paintedWidthOf` τη γωνία και αντέστρεφε τους άξονες του κουτιού στις 90°/270°, σαν η στροφή να **ξαναχωρά**
την εικόνα στο κουτί. Και οι δύο καταναλωτές όμως εφαρμόζουν `translate · scale(zoom) · rotate(r)` (`usePhotoPreviewState`,
`FilePreviewRenderer.applyTransform`) στο **ήδη τοποθετημένο** `<img>`: ο μετασχηματισμός **δεν κάνει layout**, άρα το `object-contain`
λύνεται στο αστρέφωτο κουτί και η στροφή είναι **ισομετρία** — ο άξονας πλάτους της εικόνας ζωγραφίζεται στο ίδιο μήκος σε κάθε γωνία.
Η ανάγκη σε pixel εξαρτάται μόνο από `ζωγραφισμένο × zoom × DPR`.

**Θεραπεία** — αφαίρεση, όχι προσθήκη: `paintedWidthOf(box, dimensions)` χωρίς γωνία · `useZoomResolution(url, preview, ref, zoom)` ·
αφαιρέθηκαν το `displayRotation` state του πάνελ (η στροφή ξανάγινε **χωρίς render**, όπως πριν το Ε4), το prop `rotation` του
`PhotoPreviewImage` και η έκθεσή του από το `usePhotoPreviewState`. Η κεφαλίδα του hook γράφει **πότε** η γωνία θα ξαναγίνει είσοδος:
μόνο αν η στροφή αρχίσει να **ξαναχωρά** την εικόνα (layout, σαν το Google Photos) — μαζί με εκείνη την αλλαγή, όχι πριν.

#### Ε6 — 🔴 το κουτί της εικόνας είναι το content-box

**Ρίζα**: το SSoT `useElementSize` μετρούσε **μόνο** border-box. Η εικόνα (`max-w-full max-h-full object-contain`) χωρά στο
**content-box** του δοχείου· το `p-4` του πάνελ μετρούσε ως χώρος της. Και το σφάλμα **δεν** φράσσεται από το padding: στο ύψος
πολλαπλασιάζεται με τον λόγο πλευρών (32 × 1,5 = 48, +7 από τα σκαλοπάτια = **+55**). Σε κάθετη εικόνα σε χαμηλό κουτί περνά βαθμίδα.

**Θεραπεία στο SSoT, με το λεξιλόγιο της πλατφόρμας**: `useSizeObserver` / `useElementSize` δέχονται προαιρετικό
`box: MeasuredBox = 'border-box' | 'content-box'` — ακριβώς το `ResizeObserver.observe(el, { box })`. Η πρώτη μέτρηση (`initialSizeOf`:
`getBoundingClientRect` − padding − border) και ο παρατηρητής (`observedSizeOf`: `contentBoxSize`, εφεδρεία `contentRect`) μετρούν το
**ίδιο** κουτί — η εγγύηση που είχε η border-box εκδοχή. Προεπιλογή border-box ⇒ κανένας άλλος καταναλωτής (`useContainerClass`,
περιήγηση, `MediaCard`, lightbox) δεν αλλάζει. Το `useZoomResolution` ζητά `content-box`· στο modal (`<figure>` χωρίς padding) ίδιο αποτέλεσμα.

**Αναμενόμενο μετά το push**: Ε4γ `sizes` μένει **702px** μετά τη στροφή, καμία νέα λήψη · Ε4ε `sizes` = **828px** (content 1195×548 ⇒
σκαλοπάτι 1200×544 ⇒ +8 ⇒ 552 × 1,5 = 828) — ακόμα `w=1280`.

**Άγκυρες**: `image-preview-rotation.test.tsx` (**νέο** — αποδίδει το πραγματικό `FilePreviewRenderer`, πατά τη στροφή 90°/180°:
`sizes` 702 σταθερό, 0 φορτώσεις) · `use-zoom-resolution.test.tsx` **Ζ9 αντιστράφηκε** (η γωνία δεν είναι πια είσοδος), **Ζ10** (padding 16
⇒ 282 αντί 306 · 568 χωρίς διαστάσεις) · `useElementSize.test.tsx` **Ε4ε** (content-box: πρώτη μέτρηση **και** παρατηρητής αφαιρούν το
padding). Μεταλλάξεις **4/4** κόκκινες, με επαναφορά στο ίδιο script: γωνία πίσω στην ερώτηση · hook σε border-box · πρώτη μέτρηση με
padding · παρατηρητής σε border-box. 6 σουίτες ADR-899 (40 tests) + όλες του `hooks/media` και `spatial-tour` (209) πράσινες ·
`jscpd:diff` καθαρό.

**Αρχεία για commit** (μόνο αυτά — το working tree μοιράζεται): `src/hooks/media/useElementSize.ts` ·
`src/hooks/media/__tests__/useElementSize.test.tsx` · `src/components/shared/files/preview/use-zoom-resolution.ts` ·
`src/components/shared/files/preview/__tests__/use-zoom-resolution.test.tsx` ·
`src/components/shared/files/preview/__tests__/image-preview-rotation.test.tsx` (νέο) ·
`src/components/shared/files/preview/FilePreviewRenderer.tsx` · `src/core/modals/PhotoPreviewImage.tsx` ·
`src/core/modals/PhotoPreviewModal.tsx` · `src/core/modals/usePhotoPreviewState.ts` · αυτό το ADR.

#### Παρατηρήσεις Ε4 ζωντανά (μετρημένες, όχι διορθωμένες)
- `naturalWidth` = πλάτος × **1,097** σε **όλες** τις βαθμίδες (2560 ⇒ 2808, πρωτότυπο 3000 ⇒ 3290): ο Chrome εφαρμόζει τη «density-corrected»
  διάσταση από την ανάλυση EXIF, και τα παράγωγα **την κρατούν**. Αθώο εδώ (το CSS ορίζει το κουτί)· θα μετρούσε μόνο σε `<img>` χωρίς
  CSS μέγεθος.
- Στο modal, το 4ο «Επόμενη» από το 3/3 **έμεινε** στο 3/3 (και το «Προηγούμενη» πήγε στο 2/3) μέσα σε 2,5 s με στραγγαλισμένους timers —
  το «λούπα, σχεδιασμός» του handoff αφορά τα βελάκια της **γκαλερί**· δεν ερευνήθηκε.
- Στροφή 90° **οριζόντιας** εικόνας σε φαρδύ κουτί θα ξεχείλιζε κάθετα (καμία προσαρμογή μετά τη στροφή)· δεν μετρήθηκε — όλες οι
  δοκιμαστικές είναι κάθετες. Η προσαρμογή (Google Photos) είναι απόφαση UX, και τότε ισχύει η σημείωση του Ε5.

### Ε5/Ε6 ζωντανά (2026-10-04, deploy `beca4af6`)

Commit `0b22c1d6` ⊂ deploy `beca4af6` (T1 `completed success`). Ίδια οθόνη (DPR 0,8, 2400×1121).

| # | Τι | Μετρημένο | Αποτέλεσμα |
|---|---|---|---|
| Ε5 | Modal `file_c098b8d6`, 4 × «Περιστροφή» (90/180/270/360) στο 100%, μετά από reload | `sizes` **702px** σε κάθε γωνία · ζωγραφισμένη 928×696 ⇄ 696×928 · **0** λήψεις (πριν: `w=1280`, 287.657 B) | ✅ |
| Ε5β | Στροφή 90° **και** zoom 125% | `w=1280` (287.657 B) — το zoom ανεβάζει βαθμίδα κανονικά και σε στραμμένη εικόνα | ✅ |
| Ε6 | Πάνελ `/files` → `file_474b4d3c` (1200×800), δοχείο 1227×580 με `padding: 16px` | `sizes` **828px** (πρόβλεψη 828· πριν 876) · `w=1280` · στροφή και zoom 125% ⇒ καμία νέα λήψη (828 × 1,25 × 0,8 = 828 < 1.200) | ✅ — αλλά ζωγραφισμένη **776×518** ⇒ 🔴 **Ε7** |

#### Ε7 — 🔴 ο descriptor του `srcset` δήλωνε το πλάτος που **ζητείται**, όχι αυτό που **παραδίδεται**

**Μέτρηση**: το `<img>` της κάτοψης έχει `naturalWidth` **776** (layout 776×518), ενώ το content-box χωρά **822** (548 × 1,5).
776 = 1.200 × 828 / 1.280. Η κλίμακα (`previewWidthsFor`, §3.7) σταματά σωστά στην πρώτη βαθμίδα που **καλύπτει** το πρωτότυπο
(1.280 για 1.200), και ο κωδικοποιητής (`withoutEnlargement`) φέρνει **1.200** px. Όμως ο builder έγραφε `… 1280w`. Ο browser
υπολογίζει το εγγενές css πλάτος ως `pixel × sizes / descriptor`. Το `max-w-full max-h-full` μόνο **συρρικνώνει**, άρα η εικόνα
ζωγραφιζόταν **−5,6%** μικρότερη από ό,τι χωρούσε.

**Γιατί φάνηκε τώρα**: χθες `sizes` = 876 (border-box) ⇒ 1.200 × 876 / 1.280 = **821** ≈ 822 που χωρούσαν. Η υπερεκτίμηση του Ε6
**αντιστάθμιζε από σύμπτωση** το ψέμα του descriptor. Μόλις το `sizes` έγινε αληθινό, φάνηκε. Αφορά **κάθε** αρχείο με πρωτότυπο
στενότερο από την καλύπτουσα βαθμίδα (π.χ. 1.800 px ⇒ `2560w`), όποτε ο browser διαλέγει εκείνη τη βαθμίδα από το `srcset`.

**Θεραπεία στο SSoT της κλίμακας**: `deliveredPreviewWidth(width, intrinsicWidth)` = `min(βαθμίδα, πλάτος πρωτοτύπου)`, δίπλα στα
`effectivePreviewWidth` / `filePreviewWidthFor`, που ήδη ήξεραν ότι ο κωδικοποιητής δεν μεγεθύνει. Ο `buildProxyPreview` τη
χρησιμοποιεί **μόνο** στον descriptor. Το **κλειδί** του αιτήματος (`&w=1280`), το `ladder` και η απόφαση zoom μένουν η βαθμίδα,
χωρίς δεύτερο κλειδί cache. Χωρίς γνωστές διαστάσεις ο descriptor είναι η βαθμίδα (καμία επινοημένη τιμή). Οι πηγές των αγγελιών
(`listingImageSrcSet`) **δεν** έχουν το σφάλμα: γράφουν το `info.width` που **επέστρεψε** ο κωδικοποιητής.

**Αναμενόμενο μετά το push**: πάνελ `file_474b4d3c` ⇒ `srcset … 1200w`, `naturalWidth` = `sizes` (828) ⇒ ζωγραφισμένη **≈ 822×548**
(φραγμένη από το content-box), ίδιο `w=1280` (16 KB).

**Άγκυρα**: `storage-proxy-url-roundtrip.test.ts` **Ρ7** (πρωτότυπο 1200 ⇒ ζητείται `w=1280`, δηλώνεται `1200w` · χωρίς διαστάσεις
`2560w`). Μετάλλαξη (με επαναφορά στο ίδιο script): descriptor = βαθμίδα ⇒ **κόκκινο** (1/1). 40 σουίτες / 325 tests
(`lib/storage` · `lib/files` · `shared/files` · `shared/media` · κεφαλίδα ακινήτου · mandate) πράσινες · `jscpd:diff` καθαρό.

**Αρχεία για commit**: `src/lib/files/file-preview-ladder.ts` · `src/lib/storage/storage-object-url.ts` ·
`src/lib/storage/__tests__/storage-proxy-url-roundtrip.test.ts` · αυτό το ADR.

### Ε7 ζωντανά (2026-10-04, deploy `3ba6028b`)

Commit `5ce566e3` ⊂ deploy `3ba6028b` (T1 `completed success`). ⚠️ Ο browser είχε πλέον **DPR 1** και παράθυρο 1920×897 (όχι 0,8 / 2400×1121):
το πάνελ μετρήθηκε 907×349 content ⇒ `sizes="540px"` ⇒ `w=640`, οπότε η καλύπτουσα βαθμίδα **δεν** επιλεγόταν φυσικά. Για να ελεγχθεί
**ακριβώς** η περίπτωση του Ε7, χρησιμοποιήθηκε στη σελίδα ένα προσωρινό `<img>` (offscreen, αφαιρέθηκε αμέσως) με το **πραγματικό**
`srcset` του πάνελ, το `sizes="828px"` και τα όρια `max` του χθεσινού content-box (1195×548). Τα bytes ήταν πραγματικά (`w=1280`) και ο browser ο ίδιος.

| # | Τι | Μετρημένο | Αποτέλεσμα |
|---|---|---|---|
| Ε7α | `srcset` του πάνελ `file_474b4d3c` | descriptors `320w 640w **1200w**` (πριν `1280w`) | ✅ |
| Ε7β | Προσωρινό `<img>`, νέος descriptor | `naturalWidth` **828** (= `sizes`) ⇒ ζωγραφισμένη **822×548**: γεμίζει το content-box | ✅ |
| Ε7γ | Ίδιο, με τον **παλιό** `1280w` (έλεγχος αντιπαραβολής) | `naturalWidth` 776 ⇒ **776×518**: ακριβώς το σφάλμα που μετρήθηκε | ✅ η ρίζα επιβεβαιώθηκε |
| Ε7δ | Πάνελ στο τρέχον παράθυρο | `sizes` 540 ⇒ `w=640` (6.822 B), layout 523×349: γεμίζει το ύψος του content-box (349) | ✅ |
| Γ3 | Κονσόλα | 0 σφάλματα | ✅ |

### Θέμα 5α — στροφή οριζόντιας εικόνας (μέτρηση, 2026-10-04 · απόφαση Giorgio: **επαναπροσαρμογή**)

Ανέβηκε δοκιμαστική οριζόντια `file_a0d3778e` (4000×3000, «adr899-landscape-4000x3000.jpg», τύπος «Εσωτερικό») στο ακίνητο δοκιμών.
DPR 1, παράθυρο 1920×897.

| # | Προβολέας | Κουτί | 0° | 90° | Αποτέλεσμα |
|---|---|---|---|---|---|
| Σ1 | Modal (`<main overflow-hidden>`) | 1872×704 | 939×704 | **704×939** | 🔴 κόβονται 117 px πάνω + 117 κάτω (25%) |
| Σ2 | Πάνελ `/files` (content-box, `p-4`) | 907×349 | 465×349 | **349×465** | 🔴 κόβεται 18% |
| Σ3 | Κάθετη 3:4 σε φαρδύ κουτί (υπολογισμός) | 1872×704 | 528×704 | 704×528 | ⚠️ δεν κόβεται, αλλά θα χωρούσε **939×704** (+33%) |

**Απόφαση (Google Photos / Windows Photos / Lightroom):** μετά τη στροφή η εικόνα **ξαναχωρά**. Υλοποίηση στο **5β**, πάνω στο SSoT pan/zoom
του θέματος 3: καθαρό `fitScaleForRotation(box, dims, angle)` στο `lib/images/image-dimensions.ts` · transform `scale(zoom × fit) · rotate` ·
το «100%» = «χωρά» σε κάθε γωνία · στην ανάλυση περνά `zoom × fit` ως zoom ⇒ το `useZoomResolution` **δεν** αλλάζει υπογραφή και η γωνία
**δεν** ξαναγίνεται είσοδος (Ε5 τηρείται): ό,τι ζωγραφίζεται μεγαλύτερο ζητά μεγαλύτερη βαθμίδα, ό,τι μικραίνει τίποτα.

### Θέμα 4 — πλοήγηση προβολέων: στάση στο άκρο, εστίαση που δεν χάνεται (2026-10-04)

**Μέτρηση** (4 φωτογραφίες, με συνθήκη αναμονής, όχι χρόνο):

| # | Τι | Μετρημένο |
|---|---|---|
| Μ1 | Modal, «Επόμενη» στο 4/4 | `disabled` (opacity 0,5), μένει 4/4 — σταματά |
| Μ2 | Modal, πλήκτρο → στο 4/4 | **1/4 — λούπα** ⇒ δύο κανάλια, δύο πολιτικές |
| Μ3 | Modal, Enter στο «Επόμενη» στο 3/4 | 4/4 και εστίαση στο **`<body>`, έξω από το dialog** (WCAG 2.4.3) |
| Μ4 | `PhotoLightbox` κεφαλίδας, Enter ×3 από 1/4 | **κόλλησε στο 2/4**: μετά το 1ο βήμα η εστίαση σε `DIV` |

**Ρίζες**: (α) `usePhotoPreviewState` — πληκτρολόγιο **και** handlers έκαναν λούπα, το `PhotoPreviewModal` απενεργοποιούσε τα κουμπιά στα άκρα.
(β) `disabled` σε εστιασμένο κουμπί ⇒ ο browser πετά την εστίαση (και στα όρια του zoom). (γ) `PhotoLightbox`: `key={photo.key}` σε **όλη** τη σκηνή
⇒ ξαναστήνονταν τα κουμπιά **και** το `<output aria-live>`. (δ) Ανακοίνωση με **hardcoded ελληνικά** (N.11) μέσα σε setState updater, καμία από
το πληκτρολόγιο. (ε) Το SSoT `announceToScreenReader` έφτιαχνε live region **γεμάτη ήδη** — συχνά δεν ανακοινώνεται· και το
`NotificationProvider` κρατούσε **αντίγραφό** του (N.0.2).

**Πρακτική**: Google Photos / Immich / το `PhotoLightbox` — **στάση στο άκρο σε κάθε κανάλι**· WAI-ARIA APG, μοτίβο Toolbar: τα ανενεργά
στοιχεία **μένουν εστιάσιμα** (`aria-disabled`). Αυτό λύνει ακριβώς το ελάττωμα που ο `use-gallery-scroller` θεωρούσε άλυτο για το κρύψιμο του
βέλους. Η καρουσέλ γκαλερί **μένει λούπα** (λίστα καρτών + τελείες θέσης, άγκυρα Α1).

**Θεραπεία**:
- **SSoT πολιτικής**: `indexWithin(target, total, 'clamp' | 'wrap')` στο `lib/array-utils.ts` — modal (`clamp`, **ένα** `stepPhoto` για κουμπιά
  και πληκτρολόγιο) · lightbox (`clamp`) · γκαλερί (`wrap`, ο τύπος με το `+ total` ζει πλέον εκεί).
- **Εστίαση**: `ToolbarButton` του modal και κουμπιά του lightbox με `aria-disabled` + φρουρό· βάση `buttonVariants` με `aria-disabled:` όψη
  (ίδιο λεξιλόγιο με `tabs` / `sidebar-menu`)· στο lightbox το `key` μόνο στο `<img>`.
- **Ανακοίνωση**: ένα effect στο `currentIndex` → `t('photoPreview.navigation.slide')` (υπάρχον κλειδί)· όχι στο άνοιγμα. Το SSoT
  `announceToScreenReader`: **μόνιμη** region ανά προτεραιότητα, άδειασμα και μήνυμα μετά από 100 ms (μοτίβο LiveAnnouncer του React Aria),
  ακύρωση εκκρεμούς ⇒ σε γρήγορη διαδοχή ακούγεται η τελευταία θέση. Το `NotificationProvider` το εισάγει.

**Άγκυρες**: `lib/__tests__/array-utils-index-within.test.ts` · `core/modals/__tests__/photo-preview-navigation.test.tsx` (Μ1–Μ3, αποδίδει το
πραγματικό modal) · `shared/media/__tests__/photo-lightbox-navigation.test.tsx` (Ν1–Ν3). Η Δ4 του `listing-photo-capture-spots.test.tsx`
(ADR-897) **κλείδωνε** το `toBeDisabled()` — δηλαδή το σφάλμα εστίασης· ενημερώθηκε σε `aria-disabled="true"` + `not.toBeDisabled()`.
Μεταλλάξεις **6/6 κόκκινες** με επαναφορά στο ίδιο script (πληκτρολόγιο σε wrap · `disabled` στο `ToolbarButton` · ανακοίνωση στο άνοιγμα ·
`key` στη σκηνή · `disabled` στο lightbox · wrap χωρίς `+ total`). 45 σουίτες / 561 tests που αγγίζουν τα αλλαγμένα modules πράσινες ·
`jscpd:diff` καθαρό (12 αρχεία).

### Θέμα 3 — ΕΝΑ pan/zoom, και γραμμή εργαλείων πάνελ με ονόματα (2026-10-05)

**Μέτρηση (grep, πριν από κώδικα)**: το SSoT **υπήρχε ήδη** — `hooks/useZoomPan.ts` + `lib/geometry/zoom-pan-math.ts` (ADR-187 · ADR-884,
ο ένας τύπος `scaleAbout`), με καταναλωτές `FloorplanGallery` ×2 και `DetailSheetDialog`. **Τρία** σημεία το ξανάγραφαν με το χέρι:

| | όρια | τροχός | κουμπιά | pan | εφαρμογή |
|---|---|---|---|---|---|
| πάνελ (`FilePreviewRenderer.ImagePreview`) | 0,1–10 | βήμα ×1,15 | ±0,25 | πάντα, `window` | imperative |
| modal (`usePhotoPreviewState`) | 0,25–8 (και ξανά καρφωμένα στα κουμπιά) | βήμα ×1,1, listener σε **όλο το `document`** | ±0,25 | μόνο zoom>1, περιορισμένο | state → effect |
| `DxfPreview` | 0,1–10 | βήμα ×1,15 | — | πάντα, `window` | καμβάς |

Πάνελ: τα 3 κουμπιά **χωρίς προσβάσιμο όνομα**, χωρίς tooltip, με `disabled` (πετά την εστίαση — θέμα 4), χωρίς «Προσαρμογή».
Το `contentStyle` του `useZoomPan` **δεν το εφάρμοζε κανείς** (νεκρό — και ως `style=` θα παραβίαζε το N.3).

**Ρίζα**: ο τύπος βγήκε στο `zoom-pan-math`, αλλά στο hook έλειπαν όσα χρειάζεται ένας θεατής εικόνας — σύρση που συνεχίζει έξω από το κουτί
(το hook σταματούσε στο `mouseleave`), περιορισμός pan, στροφή, διπλό κλικ, εφαρμογή σε `<img>` — άρα κάθε θεατής έφτιαξε το δικό του.
Και το κουμπί με `aria-disabled` του θέματος 4 ήταν **ιδιωτικό** στο modal.

**Πρακτική**: Google Photos / Apple Photos — ελάχιστο zoom = «χωρά», pan μόνο όσο η εικόνα ξεπερνά το κουτί και ως την άκρη της, διπλό κλικ =
μεγέθυνση στο σημείο, pinch γύρω από τα δάχτυλα· Figma — τροχός συνεχής γύρω από τον δείκτη, κουμπιά πολλαπλασιαστικά γύρω από το κέντρο.

**Θεραπεία** (καμία νέα μηχανή — επέκταση του υπάρχοντος SSoT, προαιρετικά πεδία ⇒ οι παλιοί καταναλωτές ίδιοι):
- `zoom-pan-math`: `midpoint` · `confinePan` (περιθώριο `max(0, (ζωγραφισμένο − κουτί)/2)`, ακριβώς 0 όσο χωρά) · `quarterTurnExtent` ·
  `viewTransformOf` (η **μία** συμβολοσειρά `translate · scale · rotate` — ζούσε σε 3 σημεία· το `scale` είναι εκεί όπου το 5β βάζει `zoom × fit`).
- `useZoomPan` → σύνθεση υπο-hooks στο `hooks/zoom-pan/` (`use-view-state` · `use-wheel-zoom` · `use-drag-pan` · `zoom-pan-view`): **ένας** `commit`
  περνά κάθε νέα όψη (τροχός · σύρση · pinch · κουμπιά) από τον περιορισμό, με αναγνώσεις τη στιγμή του γεγονότος (getter). Νέα: `confinePan` ·
  `doubleClickZoom` · `rotation`/`rotateBy90` · `contentRef` (μετασχηματισμός **imperative**, κανένα `style=`) · `containerBox` (RefObject για
  `useZoomResolution`) · `cursorClass` «χεράκι» μόνο όταν υπάρχει χώρος. Ο τροχός δένεται με callback ref ⇒ δουλεύει μέσα σε Portal χωρίς
  listener σε όλο το document. Τα κουμπιά μεγεθύνουν γύρω από το **κέντρο** (η μετατόπιση κλιμακώνεται — πριν έμενε ίδια).
- `shared/media/viewer/`: `ViewerToolbarButton` (**μετακίνηση** του `ToolbarButton` του modal) · `ImageViewControls` (σμίκρυνση · [ποσοστό] ·
  μεγέθυνση · περιστροφή · προσαρμογή, όρια από την ίδια ρύθμιση) · `PHOTO_VIEW_ZOOM` (1–8, ×1,5, περιορισμός, διπλό κλικ 2,5).
- Πάνελ: `ImagePreview.tsx` (βγήκε από το `FilePreviewRenderer`, 359 → 218 γρ.) μέσα σε `<nav role="toolbar" aria-label>`. Modal: `usePhotoPreviewState`
  **495 → 303 γρ.**· νέα φωτογραφία / νέο άνοιγμα ⇒ «χωρά» (πριν κληρονομούσε το zoom). `DxfPreview`: `useZoomPan` + ξανασχεδίαση στο effect.

**Άγκυρες**: `zoom-pan-math.test.ts` (+2) · `useZoomPan.test.tsx` (+6: σύρση έξω από το κουτί · περιορισμός & κέρσορας · περιορισμός με στροφή ·
`contentRef` · pinch γύρω από το μέσο · διπλό κλικ) · `image-preview-rotation.test.tsx` (στροφή **με όνομα** αντί `getAllByRole('button')[2]` + 2:
toolbar με ονόματα · ελάχιστο με `aria-disabled` που κρατά την εστίαση). Η υπόθεση «στροφή δεν αλλάζει `sizes`» **μένει** ως το 5β.
Μεταλλάξεις **5/5 κόκκινες** με επαναφορά σε `finally` (`confinePan` χωρίς `max(0,…)` · pinch χωρίς άγκυρα · `aria-disabled` → `disabled` ·
στροφή αγνοείται στον περιορισμό · σύρση χωρίς `window`). 8 σουίτες / 58 tests πράσινες · `jscpd:diff` καθαρό (15 αρχεία).

**Εκτός πεδίου** (`.claude-rules/pending-ratchet-work.md`): `FloorplanGalleryZoomControls` + `DetailSheetDialog` — `disabled`, `title=`, `style=`
⇒ `ViewerToolbarButton`. `PdfCanvasViewer` **σκόπιμα** εκτός: έγγραφο με κύλιση και re-render σελίδων, άλλο μοντέλο.

### Θέμα 5β — μετά τη στροφή η φωτογραφία ξαναχωρά (2026-10-05)

**Μέτρηση**: Σ1–Σ3 του θέματος 5α (modal: κόβεται 25% · πάνελ: 18% · κάθετη σε φαρδύ κουτί αφήνει 33% άδειο).
grep (`fitScale|containScale|fitWithin|scaleToFit`): μόνο το fit-to-width του `PdfCanvasViewer` (άλλο μοντέλο) — δεν υπήρχε αντίστοιχο.

**Ρίζα**: το `useZoomPan` εφάρμοζε `scale(zoom) rotate(r)` πάνω στο layout των **0°**. Το «χωρά» το αποφάσιζε μία φορά το CSS
(`object-contain`), και η στροφή δεν το ξαναρωτούσε.

**Πρακτική**: Google Photos / Windows Photos / Lightroom — «100%» = «χωρά» σε **κάθε** γωνία. Πιο έξυπνα από relayout ανά γωνία
(αλλαγή `max-w/max-h`): **μόνο μετασχηματισμός** ⇒ κανένα layout, κανένα νέο `sizes`, η υπάρχουσα `transition` κινεί στροφή **και**
επαναπροσαρμογή μαζί, και νέα λήψη γίνεται **μόνο** όταν η στραμμένη ζωγραφίζεται μεγαλύτερη.

**Θεραπεία** (επέκταση του SSoT του θέματος 3 — ο ένας `commit` αμετάβλητος):
- `fitScaleForRotation(box, image, deg)` στο `lib/images/image-dimensions.ts`: άρτιο τέταρτο ⇒ 1· περιττό ⇒
  `containedWidth(κουτί, στραμμένη) / ύψος στις 0°`. Κληρονομεί το φράγμα pixel του `containedWidth` ⇒ μικρή εικόνα δεν φουσκώνει.
- **Το `fit` είναι παράγωγο, όχι κατάσταση**: η όψη μένει `{zoom, pan, rotation}`. `viewScaleOf(view, frame)` (`zoom-pan-view.ts`) =
  `zoom × fit` — το **ένα** σημείο· το διαβάζουν ο περιορισμός (`paintedOf` → `settleView` / `canPanIn`), ο μετασχηματισμός
  (`useApplyViewTransform`) και η ανάλυση (επιστροφή `scale`). Απορρίφθηκε getter `fitScale` στο config: θα έβαζε τον υπολογισμό στους
  **δύο** καταναλωτές.
- `useZoomPan`: προαιρετικά `refitOnRotate` + `contentDimensions`· το κουτί μετριέται ως **content-box** (`useElementSize`, βήμα 1 px) με
  ref που ξαναφτιάχνεται όταν αλλάζει ο κόμβος (το κουτί του modal δένεται μετά το πρώτο render). Σβηστό ⇒ κανένας παρατηρητής.
- Διαστάσεις: δηλωμένες (`preview.dimensions`) ⇒ `naturalWidth/Height` **μόνο χωρίς `srcset`** (με `srcset` είναι διορθωμένο κατά
  πυκνότητα = `sizes`) ⇒ layout (τότε η στραμμένη μόνο μικραίνει — ποτέ επινοημένη μεγέθυνση).
- Το ζωγραφισμένο στρογγυλεύεται σε ακέραια px στον περιορισμό: `offsetWidth` 939 (για 938,67) × 0,75 = 704,25 σε κουτί 704 άνοιγε
  «χεράκι» και pan ¼ px.
- **Ανάλυση (Ε5 τηρείται)**: το `useZoomResolution` **δεν** άλλαξε· οι δύο καταναλωτές (`ImagePreview`, `PhotoPreviewImage`) περνούν
  `scale` αντί `zoom`. Η γωνία δεν είναι είσοδος. `PHOTO_VIEW_ZOOM.refitOnRotate = true` — μία ρύθμιση για πάνελ και modal.

**Άγκυρες**: `image-dimensions.test.ts` Δ5 (Σ1–Σ3 με τους μετρημένους αριθμούς · άρτια τέταρτα · μικρή εικόνα · άκυρο κουτί) ·
`useZoomPan.test.tsx` (+3: Σ1 ×0,75 χωρίς pan/«χεράκι» · Σ3 ×1,333 με περιορισμό στη νέα έκταση · χωρίς διαστάσεις μόνο σμίκρυνση) ·
`image-preview-rotation.test.tsx` (η υπόθεση «η στροφή δεν αλλάζει ανάλυση» **αντικαταστάθηκε**: κάθετη ⇒ μία λήψη `w=1280`, `sizes`
ίδιο· οριζόντια ⇒ καμία) · `photo-preview-navigation.test.tsx` Μ4 (το πραγματικό modal). Μεταλλάξεις **8/8 κόκκινες** με επαναφορά σε
`finally` (fit εκτός περιορισμού · fit εκτός μετασχηματισμού · χωρίς φράγμα pixel · πάνελ με `zoom` αντί `scale` · 180° ως τέταρτο ·
χωρίς στρογγύλευση · modal με `zoom` αντί `scale` · modal χωρίς διαστάσεις). `jscpd:diff` καθαρό.

**Εκτός πεδίου**: επανα-περιορισμός του pan όταν αλλάζει το μέγεθος του παραθύρου **ενώ** είναι μεγεθυσμένο (προϋπάρχον — διορθώνεται
στην επόμενη χειρονομία).

### Θέμα 6 — το Function διαστάσεων λέει την έκβαση, και δεν δουλεύει για συνοδευτικά (2026-10-05)

**Μέτρηση**: `image-dimensions-onfinalize` έγραφε `"Image dimensions recorded"` για **κάθε** έκβαση, και με `verdict: no-record`
(π.χ. `_thumb.webp`). Και βαθύτερα: το `fileRecordRefOf` έπαιρνε ως `fileId` «ό,τι ως την πρώτη τελεία» ⇒ `file_x_thumb.webp` γινόταν
εγγραφή-φάντασμα `file_x_thumb` ⇒ για **κάθε** ανέβασμα εικόνας μία λήψη κεφαλίδας + `sharp` + `setMetadata` + transaction Firestore
για αντικείμενο που δεν θα έχει ποτέ εγγραφή. Το σχόλιο της συνάρτησης υποσχόταν «κανένα κατέβασμα χωρίς εγγραφή» — το έλεγχε μόνο για
συνοδευτικά σε **άλλο** φάκελο.

**Ρίζες**: (α) ένα μήνυμα για τέσσερις εκβάσεις· (β) η ταυτότητα εγγραφής έβγαινε από το όνομα χωρίς να ρωτηθεί το μητρώο συνοδευτικών.

**Πρακτική**: Firebase / Google Cloud storage triggers — ο trigger τρέχει για κάθε αντικείμενο του κάδου (φίλτρο κατάληξης δεν υπάρχει)
⇒ **έξοδος πριν από κάθε I/O** για ό,τι παράγει το ίδιο το σύστημα· structured logging — το μήνυμα λέει την έκβαση, το πεδίο μένει
σταθερό για φίλτρα. Πιο έξυπνα από το κλασικό καρφωμένο `thumb_`: η ερώτηση απαντιέται από το **μητρώο**.

**Θεραπεία**:
- `isFileCompanionObjectName(name)` στο `lib/files/file-companion-objects.ts` (προβολή στα Functions): το όνομα τελειώνει σε κατάληξη του
  `FILE_COMPANION_KINDS`. Νέο είδος συνοδευτικού παραλείπεται χωρίς να το θυμηθεί κανείς.
- `fileRecordRefOf`: συνοδευτικό ⇒ `null`, πριν από `admin.storage()`.
- `RECORD_OUTCOME: Record<DimensionsRecordVerdict, string>` — «recorded» **μόνο** στο `write`· νέα έκβαση χωρίς μήνυμα δεν
  μεταγλωττίζεται. Όλα `info` (το `no-record` είναι αναμενόμενο όταν Admin γραφέας γράφει την εγγραφή μετά το ανέβασμα). Το πεδίο
  `verdict` μένει.
- N.0.2: `dxf-thumbnail-onfinalize` είχε καρφωμένο `'.dxf.processed.json'` — πλέον από το μητρώο· η Μ3 το κλειδώνει.

**Άγκυρες**: `file-companion-purge.test.ts` Μ4 (βρόχος πάνω στο μητρώο) + Μ3 (αυστηρότερο) · `image-dimensions-onfinalize.test.ts` Η6
(συνοδευτικό ⇒ `null`, καμία ανάγνωση· ανά έκβαση το δικό της μήνυμα, «recorded» μόνο με `tx.update`). Μεταλλάξεις **5/5 κόκκινες** με
επαναφορά σε `finally` (σταθερό μήνυμα · `no-record` ⇒ «recorded» · το Function δεν ρωτά το μητρώο · η ερώτηση απαντά πάντα όχι ·
καρφωμένη κατάληξη στο dxf trigger). `jscpd:diff` καθαρό.
⚠️ **Χρειάζεται deploy Functions** (χωριστό από το push, ρητή εντολή). Οι υπάρχουσες μικρογραφίες κρατούν το metadata που ήδη πήραν.

### Θέματα 5β + 6 ζωντανά (2026-10-05, deploy `96b81195`)

**5β ✅** — DPR 1, κουτί modal 1872×760:

| Σενάριο | Αποτέλεσμα |
|---|---|
| Σ1 modal, οριζόντια στα 90° | κλίμακα 0,75 · ζωγραφισμένη 570×760 · δεν κόβεται · καμία νέα λήψη (`w=1280`) |
| Σ2 πάνελ, οριζόντια στα 90° | κλίμακα 0,75 · 284×379 σε content-box ύψους 379 · μένει `w=640` |
| Σ3 modal, κάθετη στα 90° | κλίμακα 1,33333 · 1013×760 · αναβάθμιση `w=640` → `w=1280` |
| 180° | πίσω στο ×1· ένδειξη «100%» σε κάθε γωνία |

⚠️ **Επιφύλαξη, όχι εύρημα**: στο Σ3 η αναβάθμιση βαθμίδας δεν φάνηκε στην πρώτη μέτρηση (8 s) και εμφανίστηκε στη δεύτερη. Η καρτέλα ήταν
κρυφή (`visibilityState: hidden` ⇒ lazy εικόνες, decode και transitions παγώνουν) — πιθανή αιτία, **όχι αποδεδειγμένη**. Θέλει μία επανάληψη
με ορατό παράθυρο.

**6 — deploy ✅, logs ⏳**: `onImageDimensionsFinalize` (gen1 `us-central1`) + `onImageDimensionsFinalizeFilesEu` (gen2 `europe-west3`), έργο
`pagonis-87766`. Η ζωντανή επαλήθευση των logs (μία «recorded» για το πρωτότυπο, καμία γραμμή για το `_thumb.webp`) **δεν έγινε ακόμη**:
θέλει ανέβασμα εικόνας στην παραγωγή.

**Εύρημα του ελέγχου** → θέμα 7: στο πάνελ `/files`, μετά τη στροφή 90° ενός αρχείου, το επόμενο (`file_3dc3c55b`) άνοιξε ήδη με
`scale(1.33333) rotate(90deg)`.

### Θέμα 7 — η όψη ανήκει στο περιεχόμενο, όχι στο κουτί (2026-10-05)

**Μέτρηση** (grep, **όλοι** οι καταναλωτές του `useZoomPan` — 6 στιγμιότυπα σε 5 αρχεία):

| Καταναλωτής | Πώς μηδένιζε | Κατάσταση |
|---|---|---|
| `usePhotoPreviewState` (modal) | `useEffect(resetView, [open, currentIndex])` | δούλευε, **μετά** το paint· ίδιο index με άλλη φωτογραφία ⇒ κληρονομούσε |
| `ImagePreview` (πάνελ) | τίποτα | 🔴 το ζωντανό εύρημα |
| `DxfPreview` (πάνελ) | τίποτα | 🔴 ίδια κλάση (DXF → DXF) — από ανάγνωση κώδικα, **όχι** μετρημένο ζωντανά |
| `FloorplanGallery` inline | `useEffect(resetAll, [currentIndex])`, με σκόπιμα ελλιπείς deps | δούλευε |
| `FloorplanGallery` πλήρης οθόνη | `resetAll()` μόνο στο **άνοιγμα** | 🟡 τα ←/→ μέσα στην πλήρη οθόνη κληρονομούσαν |
| `DetailSheetDialog` | `zp.resetAll()` μέσα στο effect του decode | δούλευε |

**Ρίζα**: το `useZoomPan` δεν ήξερε **σε ποιο περιεχόμενο ανήκει η όψη**. Ο μηδενισμός ήταν ανάθεση σε κάθε καταναλωτή: τρία χειρόγραφα
effects, δύο που το ξέχασαν, ένα μισό. Και δύο παράπλευρα, και εκεί που «δούλευε»: (α) ένα render με την όψη του προηγούμενου ⇒ το
`useZoomResolution` ρωτούσε ανάλυση με **μπαγιάτικη** κλίμακα· (β) η `transition 0.15s` «ξέστριβε» μπροστά στον άνθρωπο μια φωτογραφία που
δεν στράφηκε ποτέ.

**Πρακτική**: Google Photos / Apple Photos / Figma / προβολείς Zillow-Idealista — η όψη είναι ανά στοιχείο και το νέο εμφανίζεται ουδέτερο,
ακαριαία. Revit / ArchiCAD: κάθε όψη κρατά τη δική της κάμερα (ίδια αρχή). Πιο έξυπνα από `key={url}` (remount: ξαναστήνει παρατηρητές και
listeners, πετά το `<img>`) και από effect: η όψη είναι **παράγωγο της ταυτότητας**, όχι ενέργεια — το ιδίωμα που ήδη ζούσε στο
`use-zoom-resolution.ts` (`stored?.key === key ? stored : null`, «χωρίς effect επαναφοράς») και το δόγμα του 5β («παράγωγο, όχι κατάσταση»).

**Θεραπεία** — ΕΝΑΣ μηχανισμός, μέσα στο SSoT:
- `ZoomPanConfig.contentKey: unknown` (`Object.is`), **υποχρεωτικό**: κάθε θεατής — και κάθε **μελλοντικός** — απαντά «ποιο είναι το περιεχόμενό
  μου;» στον μεταγλωττιστή· `null` = ένα περιεχόμενο που δεν αλλάζει, ή «κλειστό». Οι σταθερές ρυθμίσεων είναι `ZoomPanSettings`
  (= χωρίς ταυτότητα): `PHOTO_VIEW_ZOOM`, `ZOOM_CONFIG`.
- `useKeyedView` (`use-view-state.ts`): η όψη αποθηκεύεται **μαζί με το κλειδί της**. Άλλο κλειδί ⇒ το **ίδιο** render βλέπει την ουδέτερη
  (`neutralViewOf`, το ίδιο που δίνει το κουμπί «χωρά»)· εγγραφή στη φάση του render πετά την παλιά, ώστε Α → `null` → Α (κλείσιμο/άνοιγμα) να
  μην τη φέρει πίσω· το ref των getters ακολουθεί. Ο ένας `commit` αμετάβλητος.
- `useApplyViewTransform`: στην αλλαγή κλειδιού `transition: none` — το νέο περιεχόμενο δεν κινείται προς την ουδέτερη, **είναι** ουδέτερο.
- Καταναλωτές: `ImagePreview` / `DxfPreview` → `url` · modal → `open ? "index|url" : null` · `FloorplanGallery` → `file.id` (πλήρης οθόνη:
  `null` όσο είναι κλειστή) · `DetailSheetDialog` → `open ? model : null`. **Και τα τρία χειρόγραφα effects διαγράφηκαν**· το `resetAll` μένει
  μόνο ως πράξη του ανθρώπου (κουμπί «χωρά»).
- ⚠️ **Αλλαγή συμπεριφοράς**: στην πλήρη οθόνη του `FloorplanGallery` τα ←/→ πλέον μηδενίζουν το zoom, όπως ήδη έκανε το inline.

**Άγκυρες**: `useZoomPan.test.tsx` (+4: άλλο κλειδί ⇒ ουδέτερη + `transition: none` · οι χειρονομίες μετά ξεκινούν από την ουδέτερη και
κινούνται ομαλά · Α→`null`→Α · ίδιο κλειδί ⇒ η όψη μένει) · `image-preview-rotation.test.tsx` (το πραγματικό πάνελ: στροφή → άλλο αρχείο ⇒
ουδέτερη, και καμία δεύτερη λήψη) · `photo-preview-navigation.test.tsx` Μ5 (το πραγματικό modal: «Επόμενη» και κλείσιμο/άνοιγμα — ό,τι έκανε
το effect που διαγράφηκε). Μεταλλάξεις **7/7 κόκκινες** με επαναφορά σε `finally` (το κλειδί αγνοείται · χωρίς εγγραφή στο render · το ref δεν
ακολουθεί · πάνελ με σταθερό κλειδί · modal χωρίς `open` στο κλειδί · modal με σταθερό κλειδί · η μετάβαση δεν σβήνει). `jscpd:diff` καθαρό
(13 αρχεία).

**Τι ΔΕΝ αποδείχθηκε**: (α) `DxfPreview`, `FloorplanGallery` και `DetailSheetDialog` **δεν έχουν δική τους άγκυρα** — καλύπτονται από τον
μηχανισμό (σουίτα του hook) και από τον υποχρεωτικό τύπο, όχι από test του καταναλωτή· (β) ο ισχυρισμός «καμία λήψη με μπαγιάτικη κλίμακα»
ελέγχεται στο πάνελ αλλά **δεν απομονώθηκε** με δική του μετάλλαξη (η μετάλλαξη του κλειδιού κοκκινίζει πρώτα στον μετασχηματισμό)·
(γ) ζωντανός έλεγχος μετά το push — ⏳.

## Changelog

- **2026-10-01** — Δημιουργία. Φ.Δ (κλίμακα · κωδικοποιητής · stat/γενιά · υπηρεσία · route · builder) + Φ.Γ (κέλυφος γκαλερί · ουδέτερο
  lightbox/πάνελ/σχήμα κάτοψης · προσαρμογείς αγγελίας και ακινήτου · κεφαλίδα). Η cache στον ιδιωτικό κάδο του handoff **απορρίφθηκε**
  μετά από μέτρηση (§2.1) — απόφαση Giorgio: «όπως οι μεγάλοι, και πιο έξυπνα».
- **2026-10-01** — Ζωντανός έλεγχος παραγωγής (§9): Βήματα 0–3 ✅. **Ε1** διορθώθηκε: το βήμα της γκαλερί ξεκινά από τον
  **προορισμό** της κίνησης ή τη θέση του DOM τη στιγμή του συμβάντος, όχι από το στιγμιότυπο `index` (`useStepOrigin`, API `step(±1)`)
  — άγκυρες Δ1–Δ4, μεταλλάξεις 4/4. Οι δείκτες `ADR-899 §N` στα σχόλια του κώδικα (~30 αρχεία) ακολουθούσαν **παλιά αρίθμηση**
  (§2 κλίμακα · §5 route · §8 lightbox · §9 γκαλερί) και έδειχναν σε λάθος ή ανύπαρκτες ενότητες — αντιστοιχίστηκαν ανά αρχείο
  (§3.1–§3.6 · §4). Νέα ανοιχτά: Π1 (`sizes` κάθετης φωτογραφίας) · Π2 (βαθμίδες πάνω από το πρωτότυπο).
- **2026-10-01** — §2.2: το purge/ΓΚΠΔ σβήνει πλέον **και τα συνοδευτικά** κάθε αρχείου (5 είδη, μετρημένα στον κάδο της παραγωγής).
  Μητρώο ονομάτων `lib/files/file-companion-objects.ts` (προβολή στα Functions) · κριτής `services/file-record/file-companion-purge.ts` ·
  ο ένας γραφέας `deleteStorageObjectForPurge` (πρωτότυπο → συνοδευτικά). Οι γραφείς `generate-upload-thumbnail` ·
  `floorplan-save-orchestrator` · `floorplan-process.service` · `dxf-thumbnail-selfheal` · `functions/dxf-thumbnail-onfinalize`
  ονομάζουν από το μητρώο. Άγκυρες `file-companion-purge.test.ts` (Μ1–Μ3 · Φ · Σ1–Σ5 · Γ1–Γ2).
- **2026-10-02** — **Βήμα Γ (§4.1)**: οι αναγνώστες `downloadUrl` στο `components|features|hooks` πέρασαν στον ΕΝΑ αναγνώστη εμφάνισης.
  Μικρογραφίες = παράγωγο του server στο μέγεθος του κουτιού (`file-thumbnail-sources.ts`)· πάνελ προεπισκόπησης = ανάλυση που ακολουθεί
  το zoom (`use-zoom-resolution.ts`, μικρότερη επαρκής βαθμίδα, αλλαγή μετά το `decode`, μόνο προς τα πάνω)· βαθμονόμηση κάτοψης = πρωτότυπο.
  `sameOriginFetchUrlOf` απορρόφησε τοπικό διπλότυπο. Ratchet `file-display-url` (CHECK 3.7). Άγκυρες: `file-preview-ladder` Λ4 ·
  `storage-proxy-url-roundtrip` Ρ5–Ρ6 · `FileThumbnail` Μ1–Μ6 · `use-zoom-resolution` Ζ1–Ζ6 · `floorplan-duplicate-core` (προτεραιότητα αναγνώστη) ·
  golden proof του module — μεταλλάξεις **15/15** σκοτώθηκαν (μία ισοδύναμη, Z4, αφαιρέθηκε ως περιττός κλάδος). Βήμα Α (Ε1 ζωντανά) **εκκρεμεί**:
  το `a703b238` δεν έχει γίνει push.
- **2026-10-02** — **Βήμα Δ (§3.7) — ΕΝΑ SSoT διαστάσεων εικόνας**: διαστάσεις θεατή (μετά EXIF) μετρημένες **στο ανέβασμα** από
  τον storage-finalize trigger (gen1 + gen2 ΕΕ) — custom metadata δεμένο στη γενιά + `imageDimensions` στην εγγραφή (CAS: ίδιο
  αντικείμενο, ίδιος κάδος)· συμπλήρωση ως admin migration (ADR-704)· κανόνες: ο πελάτης δεν τις γράφει (`measuredKeys`). Π2: η
  κλίμακα `srcset` σταματά στην πρώτη επαρκή βαθμίδα (client) και το κλειδί/ETag κανονικοποιείται πριν από κάθε cache (server, μηδέν
  επιπλέον I/O). Π1: `sizes` του lightbox = πλάτος `object-contain` στο μετρημένο κουτί. `photo-capture-facts` απορροφήθηκε·
  `panorama-facts` **μένει** στα ωμά pixel επίτηδες (ο tiler δεν στρέφει — μετρημένο). Ratchet `image-dimensions` (CHECK 3.7).
  Εύρημα εκτός πεδίου: **διπλή στροφή EXIF** στο υπόβαθρο κάτοψης του DXF Viewer (§9). Νέα εξάρτηση Functions: `sharp` (Apache-2.0).
  ⏳ Χρειάζεται deploy Functions (χωριστό από το push) και ρητή εντολή για τη συμπλήρωση.
- **2026-10-02** — ✅ Deploy των δύο Functions (`pagonis-87766`). Η πρώτη απόπειρα απέτυχε στο predeploy `tsc`: το fixture του
  `dxf-thumbnail-onfinalize.test.ts` δεν είχε τα νέα `generation`/`metadata` του `FinalizedObject` (το jest δεν ελέγχει τύπους) — διορθώθηκε.
- **2026-10-02** — ✅ **Συμπλήρωση στην παραγωγή** (εντολή Giorgio): dry-run ⇒ εκτέλεση ⇒ dry-run ξανά. `files` 43 σαρωμένα / 24
  υποψήφια ⇒ **24 write** · `files_personal` 10 / 10 ⇒ **10 write** · 0 αποτυχίες · 0 `unknown-placement`· η επανάληψη δίνει **0**
  υποψήφια (ιδεμπότητο). Επιβεβαιωμένο στη βάση: κάθετη φωτογραφία κινητού `file_c098b8d6…` ⇒ **3000×4000** (θεατή, όχι 4000×3000) ·
  πανοράματα στον κάδο ΕΕ 8192×4096 / 4096×2048 · κάτοψη png 1200×800 (= μέτρηση §7). Εκτελέστηκε με Admin SDK και τον **ίδιο**
  κώδικα του route: ο βρόχος συλλογών μετακόμισε από το route στο `server/files/image-dimensions-backfill.ts`
  (`runImageDimensionsBackfill`) — το route έμεινε λεπτό περιτύλιγμα, κανένα αντίγραφο.
- **2026-10-02** — Boy Scout (CHECK 3.28): όταν η γκαλερί του διαχειριστή αρχείων και των αρχείων οντότητας πέρασαν στον ίδιο
  αναγνώστη, η περίληψη «μικρογραφία · όνομα · μέγεθος» έγινε κλώνος ⇒ `components/shared/files/FileTileSummary.tsx` (ένα
  περιεχόμενο, το κέλυφος μένει στον καλούντα). Η δίδυμη κεφαλίδα φόρτωσης/άδειας κατάστασης του `InboxView` ⇒ τοπικό `InboxStateHeader`.
- **2026-10-03** — Ζωντανός έλεγχος Βημάτων Α/Γ/Δ στην παραγωγή (§9 «Βήματα Α/Γ/Δ ζωντανά», deploy `89e3be47`): **Δ1 · Δ2 · Δ3 ·
  Γ2 · Γ3 ✅** (κλίμακα που σταματά στην πρώτη επαρκή βαθμίδα · `sizes="762px"` ⇒ `w=640` στην κάθετη αντί για `w=2560` · ίδιο ETag
  `w=1280`/`w=2560` για πρωτότυπο 1200 px + 304 · zoom ⇒ πρωτότυπο, ποτέ `w=2560`). **Γ1 ✅** στον File Manager, 🔴 **Ε2** στην καρτέλα
  «Φωτογραφίες» (`MediaCard` + `PhotoPreviewModal` φορτώνουν πρωτότυπα — εμφάνιση αόρατη στο ratchet `file-display-url`)·
  **Α1 ⏳** μη μετρήσιμο (καμία γκαλερί ≥ 3 slides στην παραγωγή) · **Δ4 ⏳** (ανέβασμα — θέλει άδεια).
- **2026-10-03** — **Ε2 διορθώθηκε** (§9, §4.1 νέα γραμμή): κάρτα `MediaCard` = μικρογραφία από την κλίμακα στο μετρημένο κουτί·
  `PhotoPreviewModal` = `useZoomResolution` μέσω `galleryPreviews` / `PhotoPreviewImage`. Νέο `coveredWidth` (SSoT διαστάσεων) +
  `thumbnailSizesOf`· κλιμάκωση σφαλμάτων εξήχθη σε `use-thumbnail-candidate.ts` (κοινή με το `FileThumbnail`). **Δ4 ✅** ζωντανά
  (συνθετικό JPEG EXIF 6 ⇒ `imageDimensions` 1800×2400 σε ~5,6 s, `verdict: write`). **Α1** με 3 slides ⇒ 🔴 **Ε3**: ο φρουρός 120 ms
  του ξεπερασμένου βήματος ακύρωνε το επόμενο με παγωμένα καρέ — ο φρουρός ενεργεί πλέον μόνο αν η πρόθεσή του ισχύει ακόμη
  (άγκυρα `ListingCardGallery` Δ5). Άγκυρες Ε2: `media-gallery-derivatives.test.tsx` (Ε1–Ε5)· μεταλλάξεις **6/6** κόκκινες·
  `jscpd:diff` καθαρό. ⏳ Ε2/Ε3 ζωντανά μετά το push.
- **2026-10-03** — **Ε2/Ε3 ζωντανά** (§9 «Ε2/Ε3 ζωντανά», deploy `88f7c42b`): **Ε2α ✅** (κάρτες `w=320`, 19 KB αντί για 3,27 MB) ·
  **Ε2γ ✅** · **Ε3 ✅** (2 / 1, ζωντανή **και** παγωμένη κύλιση) · **Ε3β ✅** (0, με στραγγαλισμένους timers) · **Γ3 ✅**. **Ε2β ⚠️** ⇒
  🔴 **Ε4**: το `useZoomResolution` δήλωνε ολόκληρο το κουτί (2352) αντί για τα ζωγραφισμένα 696 ⇒ `w=2560` αντί για `w=640`. Θεραπεία:
  `ProxyImagePreview.dimensions` (αντί για `intrinsicWidth`) · `paintedWidthOf` = `containedWidth` για την τρέχουσα περιστροφή
  (νέα είσοδος του hook) · μέτρηση από `useElementSize` · `steppedUpperBound` = ο ένας κανόνας «σκαλοπάτι + ½» (ήταν δύο αντίγραφα).
  Άγκυρες Ζ8 + Ζ9, μεταλλάξεις 3/3, `jscpd:diff` καθαρό. ⏳ Ε4 ζωντανά μετά το push.
- **2026-10-04** — **Ε4 ζωντανά** (§9 «Ε4 ζωντανά», deploy `7402112f` ⊃ `184d3c3d`): **Ε4α ✅** (`702px` ⇒ `w=640`, 79 KB αντί για
  758 KB) · **Ε4β ✅** (`w=1280` στο 125%, `w=2560` στο 250%, πρωτότυπο μόνο στο **475%**) · **Ε4δ ✅** (702 / 702 / 759) · **Ε4ζ ✅** · **Γ3 ✅**.
  **Ε4γ 🔴 ⇒ Ε5**: η στροφή ζητούσε 936 ⇒ `w=1280` (287 KB) ενώ το `rotate` δεν αλλάζει layout — η γωνία **αφαιρέθηκε** από την ερώτηση
  (και το νήμα `rotation`/`displayRotation`). **Ε4ε ⚠️ ⇒ Ε6**: border-box +55 px (όχι ≤ 32) — `useElementSize`/`useSizeObserver`
  δέχονται `box: 'content-box'` (λεξιλόγιο `ResizeObserver`), το `useZoomResolution` το ζητά. Άγκυρες: νέο
  `image-preview-rotation.test.tsx` · Ζ9 αντιστράφηκε · Ζ10 · `useElementSize` Ε4ε. Μεταλλάξεις 4/4, `jscpd:diff` καθαρό.
  ⏳ Ε5/Ε6 ζωντανά μετά το push.
- **2026-10-04** — **Ε5/Ε6 ζωντανά** (§9, deploy `beca4af6` ⊃ `0b22c1d6`): **Ε5 ✅** (4 στροφές, `sizes` 702 σταθερό, 0 λήψεις ·
  zoom σε στραμμένη ⇒ `w=1280` κανονικά) · **Ε6 ✅** (`sizes` 828, όπως η πρόβλεψη). 🔴 **Ε7**: ζωγραφισμένη 776 αντί για 822, επειδή το
  `srcset` δήλωνε `1280w` για 1.200 παραδοσμένα pixel. Ως τώρα το έκρυβε η υπερεκτίμηση του border-box. Θεραπεία: `deliveredPreviewWidth`
  στην κλίμακα (SSoT) ⇒ descriptor = ό,τι παραδίδεται, το κλειδί του αιτήματος αμετάβλητο. Άγκυρα Ρ7. ⏳ Ε7 ζωντανά μετά το push.
- **2026-10-04** — **Ε7 ζωντανά** (§9, deploy `3ba6028b` ⊃ `5ce566e3`): `srcset` `… 1200w` ✅. Ο έλεγχος έγινε με αντιπαραβολή στα ίδια
  bytes: νέος descriptor ⇒ 822×548, γεμίζει το content-box· παλιός `1280w` ⇒ 776×518, το σφάλμα. Γ3 ✅. Ο κύκλος **Ε4–Ε7 έκλεισε**.
- **2026-10-04** — **DXF υπόβαθρο: διπλή στροφή EXIF ✅** (§9 «Παρατηρήσεις εκτός πεδίου» · domain ADR-340). Αναπαράχθηκε ζωντανά
  (EXIF 6 ⇒ 2400×1800 αντί 1800×2400)· το `imageOrientation: 'none'` αγνοείται από τον Chrome 154 ⇒ μία αρχή = ο decoder `from-image`,
  η χειροκίνητη στροφή του `ImageProvider` διαγράφηκε. 0 αποθηκευμένα υπόβαθρα ⇒ καμία μετάπτωση. Ratchet `image-dimensions` → 0.
- **2026-10-04** — **Θέμα 5α** (§9): μετρήθηκε η στροφή οριζόντιας (`file_a0d3778e`, 4000×3000): modal κόβει 25%, πάνελ 18%. Απόφαση Giorgio:
  **επαναπροσαρμογή** (Google Photos) — υλοποίηση στο 5β μέσω `zoom × fit`, χωρίς τη γωνία στην ανάλυση.
- **2026-10-04** — **Θέμα 4 ✅** (§9): modal → στο 4/4 πήγαινε 1/4 (κουμπιά σταματούσαν) · `disabled` πετούσε την εστίαση έξω από το dialog ·
  lightbox κολλούσε στο 2/4 (`key` σε όλη τη σκηνή). Θεραπεία: SSoT `indexWithin` (clamp/wrap, 3 καταναλωτές) · `aria-disabled` (APG Toolbar)
  + όψη στο `buttonVariants` · `key` μόνο στην εικόνα · ανακοίνωση με i18n από ένα effect · `announceToScreenReader` με μόνιμη region,
  και το αντίγραφο του `NotificationProvider` καταργήθηκε.
- **2026-10-05** — **Θέμα 3 ✅** (§9): το SSoT `useZoomPan` υπήρχε, αλλά πάνελ, modal και `DxfPreview` το ξανάγραφαν (3 όρια, 3 τροχοί, 3 σύρσεις)·
  τα κουμπιά του πάνελ δεν είχαν όνομα. Το hook επεκτάθηκε (περιορισμός pan · στροφή · διπλό κλικ · `contentRef` · pinch γύρω από τα δάχτυλα ·
  σύρση έξω από το κουτί) και οι τρεις μετέβησαν· κοινά `ViewerToolbarButton` + `ImageViewControls` + `PHOTO_VIEW_ZOOM`. Μεταλλάξεις 5/5.
- **2026-10-05** — **Θέμα 5β ✅** (§9): μετά τη στροφή η φωτογραφία **ξαναχωρά** (Google Photos). Το `fit` είναι παράγωγο της όψης, όχι
  κατάσταση: `viewScaleOf` = `zoom × fit` στο ένα σημείο που το διαβάζουν περιορισμός pan, μετασχηματισμός και ανάλυση. Καθαρό
  `fitScaleForRotation` δίπλα στο `containedWidth`. Το `useZoomResolution` **δεν** άλλαξε υπογραφή — παίρνει `scale` ως zoom. Μεταλλάξεις 8/8.
  ⏳ Ζωντανός έλεγχος μετά το push.
- **2026-10-05** — **Θέμα 6 ✅** (§9): το log του Function διαστάσεων λέει την **έκβαση** (`RECORD_OUTCOME`, «recorded» μόνο στο `write`) και
  τα συνοδευτικά (`_thumb.webp` κ.λπ.) βγαίνουν **πριν από κάθε I/O** με ερώτηση στο μητρώο (`isFileCompanionObjectName`) — ήταν μία λήψη +
  `sharp` + transaction ανά μικρογραφία. Καρφωμένο `.processed.json` στο `dxf-thumbnail-onfinalize` ⇒ μητρώο. ⏳ Deploy Functions.
- **2026-10-05** — **Θέματα 5β + 6 ζωντανά** (§9, deploy `96b81195`): **5β ✅** Σ1 ×0,75 χωρίς λήψη · Σ2 πάνελ ×0,75 στο `w=640` · Σ3 ×1,333 με
  αναβάθμιση σε `w=1280` · 180° ⇒ ×1 (επιφύλαξη: η αναβάθμιση του Σ3 άργησε σε κρυφή καρτέλα — αιτία όχι αποδεδειγμένη). **6**: Functions
  deployed (gen1 `us-central1` + gen2 `europe-west3`)· ⏳ τα logs δεν ελέγχθηκαν (θέλει ανέβασμα εικόνας). Εύρημα: το πάνελ κληρονομεί την όψη.
- **2026-10-05** — **Θέμα 7 ✅** (§9): η όψη ανήκει στο **περιεχόμενο**. Υποχρεωτικό `contentKey` στο `useZoomPan`· η όψη αποθηκεύεται με το
  κλειδί της, άρα νέο περιεχόμενο είναι ουδέτερο στο ίδιο render και ακαριαία (`transition: none`). Έκλεισε το πάνελ (εύρημα), το `DxfPreview`
  και η πλήρης οθόνη του `FloorplanGallery` (ίδια κλάση)· **τρία** χειρόγραφα effects μηδενισμού διαγράφηκαν. Μεταλλάξεις 7/7. ⏳ Ζωντανά.
