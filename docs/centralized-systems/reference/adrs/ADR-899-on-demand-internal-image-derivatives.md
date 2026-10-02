# ADR-899 — Παράγωγα εσωτερικών εικόνων κατ' απαίτηση: **κλειστή κλίμακα**, ζωή **δεμένη με το πρωτότυπο**, και η γκαλερί της κεφαλίδας ακινήτου

| | |
|---|---|
| **Status** | ✅ IMPLEMENTED — Φ.Δ (παράγωγα, ✅ ζωντανά στον proxy) + Φ.Γ (γκαλερί + lightbox + πάνελ κάτοψης) 2026-10-01 · ✅ ζωντανός έλεγχος παραγωγής (nestorconstruct.gr) 2026-10-01 — §9 · Βήμα Δ: SSoT διαστάσεων εικόνας (§3.7) 2026-10-02 — ✅ Functions deployed (`onImageDimensionsFinalize` us-central1 · `onImageDimensionsFinalizeFilesEu` europe-west3) · ⏳ συμπλήρωση |
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
| **α** εμφάνιση (zoom) | `FilePreviewRenderer` → `ImagePreview` (από `FilePreviewPanel`) | Νέο προαιρετικό `preview`. `use-zoom-resolution.ts`: `sizes` = **μετρημένο** κουτί· στο zoom `κουτί × zoom × DPR` → `filePreviewWidthFor` = η **μικρότερη** επαρκής βαθμίδα, πρωτότυπο μόνο πάνω από 2560· φόρτωση στο παρασκήνιο + `decode()` πριν την αλλαγή· **μόνο προς τα πάνω**. Χωρίς `preview` (δημόσια κοινή χρήση, προσφορές) = ως πριν. |
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
- Η σελίδα ακινήτου στην παραγωγή φορτώνει **243** chunks `/_next/static` (γεμίζει το buffer χρονισμού των 250 εγγραφών).
- 14 προειδοποιήσεις *«preloaded but not used»* από `<link preload>` του Next — η γκαλερί δεν κάνει preload.

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
- **2026-10-02** — Boy Scout (CHECK 3.28): όταν η γκαλερί του διαχειριστή αρχείων και των αρχείων οντότητας πέρασαν στον ίδιο
  αναγνώστη, η περίληψη «μικρογραφία · όνομα · μέγεθος» έγινε κλώνος ⇒ `components/shared/files/FileTileSummary.tsx` (ένα
  περιεχόμενο, το κέλυφος μένει στον καλούντα). Η δίδυμη κεφαλίδα φόρτωσης/άδειας κατάστασης του `InboxView` ⇒ τοπικό `InboxStateHeader`.
