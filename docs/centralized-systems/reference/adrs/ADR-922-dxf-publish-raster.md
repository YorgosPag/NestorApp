# ADR-922 — Η εικόνα δημοσίευσης ενός DXF (DXF → PNG για την αγγελία)

| | |
|---|---|
| **Status** | 🟡 **ΥΛΟΠΟΙΗΜΕΝΟ σε κώδικα — uncommitted (2026-10-24)** · jest: δες §8 · **όχι** σε browser · **χρειάζεται deploy κανόνων Firestore** |
| **Date** | 2026-10-24 |
| **Category** | Files / Listings / Owner property dossier / DXF |
| **Canonical Location** | `src/services/floorplans/dxf-publish-raster.ts` (κριτής) · `src/services/floorplans/dxf-publish-raster.service.ts` (γραφέας) · `src/services/dxf-raster/dxf-publish-rasterizer.ts` (απόδοση) |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Σχετικά** | ADR-866 (φάκελος ιδιώτη, Φ1.3 δημοσίευση) · ADR-841 Α17.7.1 («τα DXF δεν μπαίνουν σε `<img>`») · ADR-033 (αγωγός κάτοψης, ο ΕΝΑΣ parser) · ADR-312 Φ3 (μικρογραφία DXF) · ADR-899 §2.2 (μητρώο συνοδευτικών) · ADR-899 §3.7 (μετρημένα πεδία) · ADR-895 Α2 (κάδος από την εγγραφή) · ADR-920 (τοπογραφικό ως έδαφος) |

---

## 1. Πρόβλημα

Στιγμιότυπο 2026-10-24 (`/offers/new`): ο ιδιώτης ανέβασε **τοπογραφικό σε DXF** στη φόρμα αγγελίας. Η γραμμή
έγραφε *«Δεν δημοσιεύεται σε αυτή τη μορφή — μένει στον φάκελό σου»* και ο μετρητής έμενε *«Δημοσιεύονται 0 από 24»*.

Η μετατροπή DXF → PNG **υπήρχε ήδη**, αλλά δεν έφτανε ποτέ στον ιδιώτη. Μετρημένο στον κώδικα:

| Κρίκος | Κατάσταση |
|---|---|
| `onDxfProcessedFinalize` (Cloud Function) | ❌ μόνο `companies/…` — ο φάκελος ζει σε `people/…` |
| ο trigger ξεκινά από `.processed.json` | ❌ το παράγει μόνο το `/api/floorplans/process`, που θέλει ικανότητα **εταιρείας** |
| `dxf-thumbnail-selfheal` | ❌ γράφει μόνο στη `FILES`, ποτέ στη `FILES_PERSONAL` |
| κριτής καταλληλότητας (`isDeliverableListingImage`) | ❌ δέχεται μόνο αποκωδικοποιήσιμες εικόνες |
| η υπάρχουσα μικρογραφία (1200×800, `#f8f9fa`, χρώματα επιπέδων) | ⚠️ ακόμη κι αν υπήρχε: σταθερό πλαίσιο, λευκό ACI 7 αόρατο σε λευκό χαρτί |

## 2. Έρευνα — πώς το κάνουν οι μεγάλοι

| Πηγή | Πρότυπο |
|---|---|
| **Autodesk Platform Services** (Model Derivative) | Ασύγχρονη «μετάφραση» μετά το ανέβασμα· **manifest** με κατάσταση `inprogress`/`success`/`failed` και σημαία `hasThumbnail` ανά παράγωγο |
| **Box** (Representations) | Ο πελάτης **ζητά** αναπαράσταση· `202 Accepted` αν δεν είναι έτοιμη — φτιάχνεται κατ' απαίτηση |
| **Google Drive** | Μικρογραφίες ασύγχρονα μετά το ανέβασμα· απουσιάζουν από την απάντηση της δημιουργίας |
| **Zillow · Idealista · Rightmove** | Η κάτοψη αγγελίας είναι **εικόνα**: μονόχρωμη γραμμή σε λευκό χαρτί, ποτέ το αρχείο CAD |
| **CAD plotting** (`monochrome.ctb`) | Στην εκτύπωση όλα τα χρώματα γίνονται μελάνι — το ACI 7 (λευκό στην οθόνη) τυπώνεται μαύρο |

⇒ **Παράγωγο με καταγεγραμμένη κατάσταση, φτιαγμένο από τον διακομιστή μόλις υπάρξει το πρωτότυπο, με δίχτυ ασφαλείας
κατ' απαίτηση** — και **μονόχρωμη απόδοση** για τον κόσμο.

## 3. Απόφαση

### 3.1 Ένα παράγωγο, ένα συνοδευτικό, μία κατάσταση

- **Συνοδευτικό** `dxfPublishRaster` (`{storagePath}.publish.png`, `beside-original`) στο μητρώο
  `lib/files/file-companion-objects` ⇒ το purge/ΓΚΠΔ το σβήνει μαζί με το DXF **χωρίς καμία επιπλέον γραμμή**.
  ⚠️ Χωριστό από τη `dxfRasterThumbnail`: εκείνη εξυπηρετεί κάρτες/PDF (1200×800)· αυτή το δημόσιο ράφι (ως 2560px).
- **Κατάσταση** `FileRecord.publishRaster` (manifest του παραγώγου):
  `{ status: 'ready', width, height, renderedAt }` | `{ status: 'failed', failure, failedAt }` · απόν ⇒ «δεν ζητήθηκε».
- 🔑 **Η διαδρομή του PNG ΔΕΝ αποθηκεύεται** — βγαίνει από το μητρώο (`dxfPublishRasterPathOf`), όπως το εξώφυλλο
  βίντεο (ADR-907 §10.8). Δείκτης στην εγγραφή θα ήταν δεύτερη αλήθεια για το ίδιο όνομα.
- 🔒 **Μόνο ο διακομιστής γράφει την κατάσταση**: `publishRaster` προστέθηκε στο `measuredKeys()` του `firestore.rules`
  (ίδια λίστα με το `imageDimensions`, ADR-899 §3.7) — για `files` **και** `files_personal`.

### 3.2 Ένας γραφέας, δύο είσοδοι (Box: «ζήτα ⇒ φτιάχνεται»)

`ensureDxfPublishRaster` (`dxf-publish-raster.service.ts`):
bytes (αποσυμπίεση gzip από την υπογραφή) → **`parseDxfScene`** (ο ΕΝΑΣ parser — εξήχθη από το `processDxf`, που
τον καλεί πλέον κι αυτό) → **`rasterizeDxfForPublication`** → PNG δίπλα στο DXF (ίδιος κάδος, ADR-895 Α2, **χωρίς**
download token) → `publishRaster` στη συλλογή `COLLECTIONS[FILE_COLLECTION[custody]]`.

| Είσοδος | Πότε |
|---|---|
| `POST /api/files/{fileId}/publish-raster` | ο πελάτης βλέπει DXF χωρίς έκβαση (`useDxfPublishRasterRequests`) — **αμέσως μετά το ανέβασμα**, χωρίς κλικ |
| `withDossierPublishRasters` (δημοσίευση) | δηλωμένο DXF χωρίς έκβαση — δίχτυ ασφαλείας (N.7.2 #4) |

- Η διαδρομή περνά από την **ίδια** αλυσίδα με τη λήψη (`withHeavyRateLimit(withFileCustodyAuth(…))` →
  `loadOwnedFileBytes`): κάτοχος → ορατότητα δοχείου / ρίζα Storage → bytes. Κάθε άρνηση = το ίδιο 404.
  Το `loadOwnedFileBytes` επιστρέφει πλέον και το κριμένο έγγραφο (`record`) — καμία δεύτερη ανάγνωση.
- **Ιδεμποτία**: καταγεγραμμένη έκβαση ⇒ καμία απόδοση. Ντετερμινιστικό όνομα + καθαρή απόδοση ⇒ ταυτόχρονες κλήσεις
  γράφουν τα ίδια bytes.
- ⚠️ **`failed` ΜΟΝΟ για τα bytes** (`unreadable` · `empty-drawing` · `render-failed`). Βλάβη αποθήκευσης/δικτύου
  **πετά** χωρίς καταγραφή — αλλιώς ένα σωστό σχέδιο θα «καταδικαζόταν» για πάντα.
- ⚠️ Το δίχτυ ασφαλείας **δεν** ρίχνει τη δημοσίευση: σε βλάβη υποδομής το αρχείο απλώς δεν φεύγει αυτή τη φορά.

### 3.3 Απόδοση για αγγελία (`dxf-publish-rasterizer.ts`)

Το **ίδιο** χωνί (`rasterizeDxfScene` → `serializeDxfSceneToSvg` → resvg), άλλες παράμετροι εκτύπωσης:

| | μικρογραφία | δημοσίευση |
|---|---|---|
| πλαίσιο | 1200×800 | αναλογίες σχεδίου, μακριά πλευρά **3000px**, όριο 4:1 |
| χρώμα | επιπέδων | **μονόχρωμο μελάνι** `#1f2328` |
| φόντο | `#f8f9fa` | **λευκό** |
| γραμμή | 1px | 2px |

🔒 **Τα κρυφά επίπεδα μένουν κρυφά**: η μονοχρωμία αφαιρεί μόνο το χρώμα, ποτέ την ορατότητα.

### 3.4 Ένας κριτής για φόρμα και βιτρίνα

`dossierMediaPublication` (`dossier-media-publication.ts`) απαντά **μαζί** «φεύγει;» · «ως τι;» · **«ποια bytes;»**:
- φωτογραφία/εικόνα κάτοψης ⇒ το ίδιο το αρχείο·
- **DXF ⇒ μόνο στην καρτέλα κάτοψης/τοπογραφικού, μόνο με `ready`, και το ράφι παραλαμβάνει το PNG** (`imagePath`)·
- ίδιοι φρουροί καταλληλότητας (κάτοχος · `ready` · ζωντανό) για κάθε αρχείο.

Η φόρμα δείχνει για DXF που δεν φεύγει ακόμη *«Ετοιμάζεται εικόνα…»* ή *«Δεν βγήκε εικόνα…»* — ποτέ το γενικό
«δεν δημοσιεύεται», που για DXF σε εξέλιξη θα ήταν ψέμα.

## 4. Τι ΔΕΝ άλλαξε

- Ο εταιρικός αγωγός (`/api/floorplans/process`, `onDxfProcessedFinalize`, μικρογραφία 1200×800) — ανέγγιχτος.
- Το `isDeliverableListingImage` — το DXF δεν έγινε «εικόνα»· έγινε αρχείο **με** εικόνα.
- Τα αντίγραφα `functions/src/shared/*` του rasterizer — καμία αλλαγή, άρα κανένα deploy Functions.

## 5. Ανοιχτά

1. **Κείμενα DXF**: ο rasterizer τρέχει χωρίς γραμματοσειρές (`loadSystemFonts: false`) ⇒ τα `TEXT` δεν αποδίδονται
   (ίδιο όριο με τη μικρογραφία). Λύση: ενσωματωμένη γραμματοσειρά με ελληνικά. ⚠️ Οι ελεύθερες γραμματοσειρές
   (Noto, DejaVu) είναι συνήθως **OFL**, που **δεν** είναι στη λίστα N.5 (MIT/Apache/BSD) ⇒ **απόφαση Giorgio**.
2. **2η φάση — SVG**: εκτός από PNG, καθαρισμένο SVG για απεριόριστο zoom στη σελίδα κάτοψης της αγγελίας.
3. **Νέα έκδοση DXF** (`versions/promote`) με ίδιο `storagePath`: η καταγεγραμμένη έκβαση δεν ακυρώνεται αυτόματα.
4. **Διπλότυπο** `extractScene` σε `functions/src/storage/dxf-thumbnail-onfinalize.ts` και
   `src/services/floorplans/dxf-thumbnail-selfheal.ts` → `.claude-rules/pending-ratchet-work.md`.

## 6. Deploy

- **Κανόνες Firestore** (`firestore.rules` — `measuredKeys()`): χωρίς deploy ο πελάτης **μπορεί** να γράψει
  `publishRaster` (η εφαρμογή δουλεύει, απλώς λείπει ο φρουρός).
- Next server (νέα διαδρομή + αλλαγές κριτή). **Κανένα** deploy Cloud Functions.

## 7. Αρχεία

| Αρχείο | Ρόλος |
|---|---|
| `src/services/floorplans/dxf-publish-raster.ts` | τύποι + κριτής (leaf, πελάτης & διακομιστής) |
| `src/services/floorplans/dxf-publish-raster.service.ts` | ο ΕΝΑΣ γραφέας |
| `src/services/dxf-raster/dxf-publish-rasterizer.ts` | απόδοση αγγελίας |
| `src/app/api/files/[fileId]/publish-raster/route.ts` | «ζήτα ⇒ φτιάχνεται» |
| `src/services/filesystem/dxf-publish-raster.client.ts` · `src/hooks/owner-property/useDxfPublishRasterRequests.ts` | πελάτης |
| `src/services/property-dossier/dossier-publish-rasters.server.ts` | δίχτυ ασφαλείας δημοσίευσης |
| `src/app/api/floorplans/process/floorplan-process.service.ts` | `parseDxfScene` εξήχθη |
| `src/app/api/files/_shared/owned-file-bytes.ts` | `record` στην έκβαση `bytes` |
| `src/services/property-dossier/dossier-media-publication.ts` | κριτής + `imagePath` |
| `src/components/owner-property/form/OwnerPropertyDossier{Panel,Item}.tsx` · `property-market.json` (el/en) | οθόνη |
| `src/lib/files/file-companion-objects.ts` (+ προβολή Functions) · `src/types/file-record.ts` · `firestore.rules` | μητρώο · τύπος · φρουρός |

## 8. Επαλήθευση

- jest: `dxf-publish-raster.test.ts` · `dxf-publish-raster.service.test.ts` · `dxf-publish-rasterizer.test.ts` ·
  `dossier-media-publication.test.ts` (Α41.4). Αποτελέσματα: δες changelog.
- Κανόνες: `tests/firestore-rules/suites/files-personal.rules.test.ts` (χρειάζεται emulator — **δεν** έτρεξε τοπικά).

## Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-10-24 | Δημιουργία· υλοποίηση §3 σε κώδικα (uncommitted). |
