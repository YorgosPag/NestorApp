# ADR-899 — Παράγωγα εσωτερικών εικόνων κατ' απαίτηση: **κλειστή κλίμακα**, ζωή **δεμένη με το πρωτότυπο**, και η γκαλερί της κεφαλίδας ακινήτου

| | |
|---|---|
| **Status** | ✅ IMPLEMENTED — Φ.Δ (παράγωγα, ✅ ζωντανά στον proxy) + Φ.Γ (γκαλερί + lightbox + πάνελ κάτοψης) 2026-10-01 · ⏳ έλεγχος UI σε browser |
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
   Το ίδιο κενό υπάρχει **ήδη** για το `thumbnailStoragePath` του DXF (καταγράφηκε στο `.claude-rules/pending-ratchet-work.md`).
2. Ο **προεπιλεγμένος** κάδος **δεν** είναι στο `DECLARED_PRIVATE_BUCKETS` ⇒ δεν υπάρχει κανόνας λήξης ως κώδικας.
3. Δίπλα στο πρωτότυπο (`companies/…/files/`) τα `storage.rules` επιτρέπουν στον client **εγγραφή/διαγραφή** ⇒ «δηλητηριασμένη» cache.

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
- Οι ~32 υπόλοιποι αναγνώστες `downloadUrl` (καρτέλα φωτογραφιών, media) να περάσουν στο `fileDisplayUrl`/`preview` — ratchet entry.

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
- ⏳ UI σε browser (βελάκια/←/→/swipe, lightbox με πάνελ κάτοψης): η επέκταση Chrome δεν ήταν συνδεδεμένη — εκκρεμεί.

## Changelog

- **2026-10-01** — Δημιουργία. Φ.Δ (κλίμακα · κωδικοποιητής · stat/γενιά · υπηρεσία · route · builder) + Φ.Γ (κέλυφος γκαλερί · ουδέτερο
  lightbox/πάνελ/σχήμα κάτοψης · προσαρμογείς αγγελίας και ακινήτου · κεφαλίδα). Η cache στον ιδιωτικό κάδο του handoff **απορρίφθηκε**
  μετά από μέτρηση (§2.1) — απόφαση Giorgio: «όπως οι μεγάλοι, και πιο έξυπνα».
