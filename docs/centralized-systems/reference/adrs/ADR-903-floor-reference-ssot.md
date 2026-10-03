# ADR-903 — Αναφορά ορόφου: **ένα** λεξιλόγιο, **ένας** τύπος, **μία** ετικέτα, **ένας** parser

| | |
|---|---|
| **Status** | ✅ IMPLEMENTED — 2β.1α (SSoT + κατάργηση αντιγράφων) 2026-10-03 · ✅ 2β.1β (ακίνητα/parking/storage φιλοξενούνται σε όροφο: `floorId` + cascade + ένας επιλογέας + φίλτρο από δεδομένα) 2026-10-03 · ⏳ η μετανάστευση **δεδομένων** τρέχει μόνο με εντολή Giorgio |
| **Date** | 2026-10-03 |
| **Category** | Centralized Systems / Domain Vocabulary / i18n |
| **Προέλευση** | ADR-900 §8 #2 (Φάση 2β.1) — η μονάδα (κτίριο + όροφος + πόρτα) χρειάζεται **έναν** όροφο πριν από την 2β.2 |
| **Σχετικά** | ADR-369 §9 Q6/Q9 *(ο όροφος ως οντότητα, `FloorKind`, canonical `longName`)* · ADR-461 *(ειδικές στάθμες)* · ADR-701 §8.2 *(«3nd Basement» — κλείνει εδώ)* · ADR-887 *(`createBundleTranslate`)* · ADR-744 *(shell slice)* · ADR-236 *(μεζονέτες — `levels[]`)* · ADR-461 *(μοναδικότητα αριθμού)* · ~~ADR-145~~ *(ο κώδικας παρέπεμπε σε «ADR-145» για το `floor` του parking· **κανένα** από τα δύο ADR-145 δεν το περιέγραφε — ορφανή αναφορά, αντικαταστάθηκε από το §6)* |
| **Αυθεντία** | ο κώδικας. Όπου αυτό το ADR διαφωνεί με τον κώδικα, κερδίζει ο κώδικας |

---

## 1. Το πρόβλημα — μετρημένο στον κώδικα (2026-10-02/03)

- **Τέσσερις μορφές αποθήκευσης**: `Property.floor:number` + `floorId` · parking `floor?:string` (ελεύθερα tokens, **χωρίς** `floorId`) · storage `floor:string` + `floorId?` · `number|null` σε owner/listing/ζήτηση.
- **Οκτώ χειρόγραφοι μορφοποιητές** με ελληνικά γραμμένα στον κώδικα (N.11), που **απέκλιναν**: «Υπόγειο» για −3 (`SharedPropertiesProvider`) · «1ος» χωρίς «όροφος» (audit) · «0ος όροφος» για το ισόγειο (email επιβεβαίωσης, ειδοποιήσεις πωλήσεων) · «3nd Basement» (showcase) · «1 Floor» / «2 Basement» (`formatFloorLabel` στα αγγλικά) · «Floor N» / «Όροφος N» ως κλειδιά καταμέτρησης που έβγαιναν ωμά στην οθόνη.
- Το «κεντρικό» `formatFloorLabel` (`lib/intl-domain.ts`) **αγνοούσε το είδος**: μεσοπάτωμα, δώμα, απόληξη αποδίδονταν από τον αριθμό. Το `FloorKind` **δεν είχε κανένα κλειδί i18n**.
- Τρεις ακόμη οικογένειες locale έγραφαν το τακτικό με το χέρι: `{floor}th floor` (→ «1th floor»).
- `parseFloorLevel`: `parseInt(x) || 0` ⇒ «Πυλωτή» / «Δώμα» / άγνωστο ⇒ **0** ⇒ λάθος κωδικός οντότητας (ADR-233).

## 2. Έρευνα — τι κάνουν οι μεγάλοι

| Σύστημα | Αριθμός | Είδος / σημασιολογία |
|---|---|---|
| **Revit** Level | Elevation | σημαία «Building Story» (στάθμη που δεν μετρά = ορόφιο πατάρι, στηθαίο) |
| **ArchiCAD** Story | προσημασμένος δείκτης, **ισόγειο = 0** | ελεύθερο όνομα |
| **IFC** `IfcBuildingStorey` | `Elevation` | `CompositionType = PARTIAL` (ημιώροφος) · `Pset_BuildingStoreyCommon.AboveGround` / `EntranceLevel` |
| **RESO** (Zillow) | `EntryLevel` (αριθμός) | `Levels` (enum) |
| **idealista** | `floor` = αριθμός **ή** επώνυμη στάθμη | «bajo», «entreplanta», «semisótano», «ático» |
| **Ελλάδα** (ΝΟΚ · Spitogatos) | — | Υπόγειο · Ημιυπόγειο · Ισόγειο · Υπερυψωμένο · Ημιώροφος · Πυλωτή · Δώμα · Σοφίτα |

**Όλοι** χωρίζουν τον **αριθμό** από το **είδος**. Ο ημιώροφος **ποτέ** 0,5 — δένεται στη στάθμη από κάτω. Το «ρετιρέ»/«σοφίτα» ως **είδος ακινήτου** είναι άλλο πράγμα από τη στάθμη (υπάρχει ήδη στο `properties-enums`).

## 3. Η απόφαση

### 3.1 Λεξιλόγιο — `utils/floor-naming.ts` (υπήρχε, επεκτάθηκε)
- `FloorKind` + `semi-basement` · `raised-ground` · `pilotis` · `attic` (απόφαση Giorgio 2026-10-03). Το zod `floors.schemas.ts` παράγεται ήδη από το `FLOOR_KIND_VALUES`· οι κανόνες δεν ελέγχουν το `kind`.
- `SPECIAL_LEVEL_KINDS` + `pilotis` · `attic`: **δεν μετρούν** στο «Όροφοι: N» («Πυλωτή + 4 όροφοι»). Ημιυπόγειο/υπερυψωμένο μετρούν.
- Νέο `isAboveGround(kind)` = IFC `AboveGround` (θεμελίωση · υπόγειο · ημιυπόγειο ⇒ `false`). Πρώτος καταναλωτής: `isFoundationDisciplineInContext` (DXF).
- Short codes: `SB` · `RG` · `PL` · `AT`.
- **Καμία ανθρώπινη ετικέτα** πια στο λεξιλόγιο: το `generateAutoLongName` (ελληνικά στον κώδικα) **διαγράφηκε** → `canonicalFloorLongName` (§3.4).

### 3.2 Ο τύπος — `lib/floor/floor-ref.ts`
```ts
type FloorRef =
  | { readonly number: number; readonly kind: FloorKind | null }   // kind:null ⇒ συνάγεται από τον αριθμό
  | { readonly number: null;   readonly kind: NamedFloorKind };     // επώνυμη στάθμη χωρίς αριθμό (idealista «ático»)
```
Ο τύπος **απαγορεύει** `standard` χωρίς αριθμό. Βοηθοί: `resolveFloorKind` · `floorRefOf(number, kind)`.

### 3.3 Ο parser — `parseLegacyFloor(raw): FloorRef | null`
Ο **ένας** για παλιές τιμές: ακέραιος · «-1» · «Ισόγειο»/«Ground Floor» · «Υπόγειο -1»/«2ο Υπόγειο»/«Basement 3»/«B2» · «3ος Όροφος»/«Floor 4»/«21st Floor»/«L7» · «Πυλωτή» · «Ημιυπόγειο» · «Υπερυψωμένο» · «Ημιώροφος»/«2ο Μεσοπάτωμα» · «Δώμα»/`rooftop` · «Σοφίτα» · «Απόληξη Κλιμακοστασίου» · tokens parking `basement-N`/`first`. Κανονικοποίηση: NFD χωρίς τόνους, πεζά, ένα κενό (και ` `). 🔴 **Άγνωστο ⇒ `null`, ποτέ σιωπηλό 0.**

### 3.4 Η ετικέτα — `lib/floor/floor-label.ts` + i18n `floors`
- `formatFloorRef(ref, t)` — **μία** υλοποίηση. Ο μεταφραστής **περνιέται**: το `t` του i18next και το `createBundleTranslate` χωρούν στον **ίδιο** στενό τύπο `FloorLabelTranslate` ⇒ client και server λένε το ίδιο.
- Κλειδιά **κυριολεκτικά** σε `FLOOR_LABEL_KEY: Record<FloorKind, string>` (ο generator των route slices τα λύνει· δυναμικό `` `floors:label.${kind}` `` θα έσπαγε τον slice).
- Νέο namespace **`floors`** (el/en): `label.<kind>`. Ελληνικά: «{n}ος Όροφος» · `{depth, plural, one {Υπόγειο} other {#ο Υπόγειο}}` · `{index, plural, one {Μεσοπάτωμα} other {#ο Μεσοπάτωμα}}`. Αγγλικά: **`selectordinal`** ⇒ 1st/2nd/3rd/11th/21st/101st Floor.
- `useFloorLabel()` (UI): δέχεται `FloorRef`, αριθμό ή παλιό κείμενο (περνά από τον parser)· άγνωστο κείμενο εμφανίζεται αυτούσιο.
- `floorLabelIn(ref, language)` (server: email · ειδοποιήσεις · showcase/PDF · ai-pipeline) — **στη γλώσσα του παραλήπτη**, ADR-887.
- `canonicalFloorLongName(kind, number)` = η ελληνική ετικέτα από τα **ίδια** κλειδιά ⇒ η αποθηκευμένη `Floor.longName` (ADR-369 Q9) **αμετάβλητη** για τα παλιά είδη (άγκυρα).

### 3.5 Επέκταση `i18n/bundle-translate.ts`
Σκέλος `selectordinal` με κατηγορίες από `Intl.PluralRules(locale, { type: 'ordinal' })` — η ίδια πηγή CLDR που ρωτά το `i18next-icu` στον browser. Το `createBundleTranslate` / `formatBundleText` απέκτησαν προαιρετικό `locale` (προεπιλογή `'en'`).

### 3.6 Κέλυφος i18n (ADR-744)
Το `floors` μπήκε στο κέλυφος (key-sliced) από την καθολική αναζήτηση (extraShellRoot) και τον `SharedPropertiesProvider`. Δηλώθηκε στο `.i18n-shell-slice.json → shellNamespaces` με `dragger` + `reason`, και η σφράγιση έγινε **9** με γραμμένο `why`. Επίσης στα `CRITICAL_NAMESPACES` (~0,6 KB).

## 4. Τι καταργήθηκε / άλλαξε (2β.1α)

| Ήταν | Έγινε |
|---|---|
| `formatFloorLabel` · `formatFloorString` (`lib/intl-domain.ts`, 16 καταναλωτές) | **διαγράφηκαν** → `useFloorLabel` |
| `SharedPropertiesProvider.getFloorLabel` | ο provider κρατά **δεδομένα** (`RawFloor`)· η ετικέτα παράγεται σε `useMemo` πάνω στο `t` (σταθερή αναφορά — καμία ακύρωση context) |
| `activity-tab-helpers.formatFloorNumber` | `formatFieldAwareValue(…, floorLabel)` από τον καλούντα |
| `professional-assignment.formatFloor` · `confirmation-email-shared.floorSuffix` · `sales-accounting/notification-helpers` · `property-search-query` (N.10) | `floorLabelIn(…, 'el')` |
| `formatShowcaseFloorLabel` + «3nd Basement» | parser + `floorLabelIn(…, locale)` — κλείνει ADR-701 §8.2 |
| `propertiesByFloor` κλειδιά «Floor N» / «Όροφος N» (3 hooks) | κλειδί = ο αριθμός· ετικέτα στο `DetailsCard` |
| `search-index-config` `'floor'` | αποθηκεύεται ωμό (δεδομένο)· ετικέτα στο `SearchResultItem` |
| `parseFloorLevel` (`parseInt || 0`) | delegate στον parser· άγνωστο ⇒ `''` (μπλοκάρει την αυτόματη κωδικοποίηση) |
| `PATCH /api/properties/[id]` `floor: string` | κανονικοποίηση σε ακέραιο από τον parser· άλυτο ⇒ **400** |
| `OwnerPropertyCard` «Όροφος {floor}» · DXF wizard `floorOrdinal` | `useFloorLabel` |
| `seed-floors.config` ονόματα | `canonicalFloorLongName` |
| κλειδιά `storage.card.floor` · `properties-detail.card.floor` · `dxf-viewer-wizard.counts.floorOrdinal` | **διαγράφηκαν** (νεκρά) |
| DXF: ελάχιστο ύψος κάτω από δοκό · πειθαρχία θεμελίωσης · `buildingHasBasement` | ημιυπόγειο ≡ υπόγειο· πυλωτή/υπερυψωμένο ≡ ισόγειο. ⚠️ Το ύψος της πυλωτής **δεν** άλλαξε (1900; χωρίς επαληθευμένη πηγή ΝΟΚ/ΚΠΝ) |
| Boy Scout (jscpd): payload δημιουργίας ορόφου αντιγραμμένο σε 2 φόρμες | `toFloorCreatePayload` στο `floor.factory.ts` |

## 5. Άγκυρες

- `lib/floor/__tests__/floor-ref.test.ts` — πίνακας parser (29 μορφές + 8 «→ null») · ετικέτες el/en (21 περιπτώσεις, τακτικά 1–101) · **στρογγυλή διαδρομή** για κάθε είδος × αριθμούς × γλώσσες (ετικέτα → parser → ίδια ετικέτα, κανένα `{…}` ή ωμό κλειδί) · `canonicalFloorLongName` αμετάβλητη.
- `lib/floor/__tests__/no-hand-floor-labels.test.ts` — **φρουρός κλάσης**: σαρώνει το `src/` (χωρίς σχόλια) για χειρόγραφες ετικέτες ορόφου· κλειστό σύνολο εξαιρέσεων με λόγο (5 → **3** στην 2β.1β)· η εξαίρεση που δεν πιάνει πια τίποτα είναι κόκκινη (μπαγιάτικη).
- `bundle-translate.test.ts` — `selectordinal` (en 1…111, `=N`, ελλείπουσα κατηγορία ⇒ `other`).
- `floor-naming.test.ts` — νέα είδη, short codes, μέτρηση ορόφων, `isAboveGround`.
- **Μεταλλάξεις** (επαναφορά στο ίδιο tool call, sha256 ίδιο): χειρόγραφη ετικέτα ⇒ φρουρός κόκκινος (1) · parser που μαντεύει 0 ⇒ 2 κόκκινα · κατηγορία τακτικού πάντα `other` ⇒ 1 κόκκινο.
- **2β.1β** — `hosted-floor.test.ts` (33: αναγνώστης, απόκλιση, πρόθεση PATCH, planner μετανάστευσης: καθαρό/άλυτο/ξένο κτίριο/ξένη εταιρεία/διφορούμενο/noop) · `host-floor.server.test.ts` (9: ξένος όροφος ⇒ 404 ίδιο με ανύπαρκτο, άλλο κτίριο ⇒ 400, χωρίς αριθμό ⇒ 400) · `floor-ref-cascade.service.test.ts` (6: τρεις συλλογές, μόνο-είδος, ιδεμποτία, μεζονέτα σε μία γραφή, 1000 ⇒ 450+450+100, αποτυχία ⇒ κανένα ίχνος) · `floor-slot.test.ts` (4: επεξεργασία σε πιασμένο αριθμό ⇒ 409) · `floor-filter.test.ts` (5) · `space-entity-route-fields.test.ts` (ωμό `floor` ⇒ 400). **Μεταλλάξεις 2/2 κόκκινες**: χωρίς φίλτρο εταιρείας στο cascade · χωρίς έλεγχο απόκλισης (πάντα γράφει).

## 6. 2β.1β — ακίνητα · θέσεις · αποθήκες **φιλοξενούνται** σε όροφο (✅ 2026-10-03)

### 6.1 Τι κάνουν οι μεγάλοι — και η απόφαση
| | Τι κρατά το στοιχείο | Όταν αλλάξει ο όροφος |
|---|---|---|
| **Revit** | **μόνο** `LevelId`· όνομα/στάθμη παράγονται από το Level | τίποτα να ενημερωθεί — δεν υπάρχει αντίγραφο |
| **ArchiCAD** | Home Story | το στοιχείο **ακολουθεί** τον όροφο |
| **idealista / RESO (Zillow)** | ο όροφος **ως αριθμός ή επώνυμη στάθμη** («bajo», «ático») | — (χωρίς join· η αγγελία κρατά το δικό της) |

Firestore **δεν έχει join** ⇒ συνδυασμός: **αναφορά Revit** (`floorId` = αυθεντία) + **αντίγραφο idealista** που κρατά **και** αριθμό **και** είδος (`floor` + `floorKind` — χωρίς το είδος, θέση σε **πυλωτή**, αριθμός 0, έλεγε «Ισόγειο») + **συγχρονισμός ArchiCAD** (cascade). Το ίδιο σχήμα σε `Property` · `ParkingSpot` · `Storage` (`HostedOnFloor`).

### 6.2 Ο ΕΝΑΣ συγγραφέας του αντιγράφου (server)
- `lib/floor/hosted-floor.ts` (καθαρό): `HostedFloorCopy` · `hostedCopyOf` · **`readHostedFloor`** (ο ένας αναγνώστης των mappers — παλιό κείμενο ⇒ parser) · `hostedFloorRef` / `hostedFloorNumber` · **`hostedCopyDrift`** (η ΜΙΑ ερώτηση «συμφωνεί το αντίγραφο;» — cascade, μετανάστευση, `--verify`) · `planHostedFloorIntent` (σώμα PATCH ⇒ keep/clear/resolve· αλλαγή κτιρίου χωρίς όροφο ⇒ **καθαρισμός**).
- `lib/floor/host-floor.server.ts`: `loadHostFloor` περνά από τον **φύλακα του πόρου** `floorResource` (ξένος ≡ ανύπαρκτος ⇒ `404`, ADR-742) + **ίδιο κτίριο** (αλλιώς `400`)· `resolveHostedFloorForCreate` / `resolveHostedFloorPatch`.
- `space-entity-fields.ts`: `floor` **μη εγγράψιμο** (`z.undefined()` ⇒ ο παλιός πελάτης παίρνει 400, όπως το `status`)· `floorId` κοινό σε parking **και** storage. Ο κωδικός ADR-233 από τον αριθμό του ορόφου — φεύγουν τα δύο `parseInt(body.floor) || 0` («Ισόγειο»→0).
- Ακίνητα: δημιουργία + PATCH από τον ίδιο resolver (το `floor` του client κερδιζόταν από κανέναν — τώρα κερδίζεται από τον όροφο)· `floorKind` μη εγγράψιμο. Αυτόνομη μονάδα (χωρίς `floorId`) κρατά τον αριθμό της.

### 6.3 Ο όροφος αλλάζει ⇒ ό,τι φιλοξενεί ακολουθεί
- `floors PATCH`: γράφει πλέον το `kind` (το zod το δεχόταν και ο handler το **πετούσε σιωπηλά**)· ο **ίδιος** κανόνας μοναδικότητας με τη δημιουργία (`floor-slot.ts`, ADR-461 — η επεξεργασία δεν τον ρωτούσε ⇒ δύο «1ος όροφος»)· οι συνέπειες στο `floor-update-effects.ts` (ο handler έπεσε από ~100 σε ~40 γραμμές).
- `floor-ref-cascade.service.ts`: `where companyId + floorId` σε properties/parking/storage **+ οι μεζονέτες** του κτιρίου (`levels[].floorNumber/name`, ADR-236 — πίνακας αντικειμένων, δεν ερωτάται με `floorId`)· ιδεμποτικό (`hostedCopyDrift`)· παρτίδες `flushInBatches` (450)· ίχνος ανά έγγραφο **μόνο** για ό,τι σίγουρα γράφτηκε· αποτυχία ⇒ `cascadeWarning`, η απάντηση φέρει `hostedCascade: { properties, parking, storage, failed }`. Ισότητες μόνο ⇒ **κανένας** νέος σύνθετος δείκτης.
- Boy Scout: το height cascade έγραφε σε **ένα** `WriteBatch` (σπάει πάνω από 500) ⇒ `flushInBatches`.
- Διαγραφή ορόφου: ο φρουρός `deletion-registry` (BLOCK) **ήδη** δήλωνε parking/storage `floorId` — για το parking ήταν **νεκρή** εξάρτηση, πλέον ζωντανή.

### 6.4 UI — ένας επιλογέας, μία πηγή, μία ετικέτα
- **Τρεις** πηγές δεδομένων ορόφων (REST χωρίς cache · ιδιωτική συνδρομή · κοινόχρηστη) ⇒ **μία**: `useFloorsByBuilding` (+ ορατό σφάλμα αντί για σιωπηλό `[]`, + `useBuildingFloor(buildingId, floorId)`). `FloorSelect` (σκέτος, κελιά πίνακα) / `FloorSelectField` (με ετικέτα)· τιμή **πάντα** `floorId`· το `valueMode='floor'` **καταργήθηκε**. Ετικέτα επιλογής: `floor-option-label.ts` (όνομα, αλλιώς `useFloorLabel`) — και στο `FloorSelectByBuilding` (ήταν `{n} — {όνομα}` με κενό όνομα).
- Φόρμες: η φόρμα κρατά **μόνο** `floorId` (`space-payload-builder` το στέλνει, μόνο όταν **άλλαξε** — έγγραφο πριν τη μετανάστευση δεν χάνει σιωπηλά τον παλιό του όροφο)· ο αριθμός για τον κωδικό **παράγεται** (`useSpaceLocation` → `useBuildingFloor`). Οι inline φόρμες της καρτέλας κτιρίου (ελεύθερο `<Input>` με placeholder «-1») ⇒ `FloorSelect`.
- ~20 προβολές (κάρτες, πίνακες + XLSX, πωλήσεις, δομή έργου, πίνακας ιδιοκτησίας, αγγελίες/showcase στη γλώσσα του παραλήπτη) ⇒ `useFloorLabel(hostedFloorRef(x))` / `floorLabelIn`.
- 🐞 **Υπαρκτά σφάλματα που έκλεισαν**: φίλτρα ορόφου (slug `basement-1` απέναντι σε κείμενο ⇒ **ποτέ** ταίριασμα) · ταξινόμηση λεξικογραφική («-1» μετά το «10») · DXF σύνδεση θέσης σε κάτοψη ορόφου συνέκρινε `floor` με `floorId` ⇒ **καμία** θέση δεν εμφανιζόταν · ο κόμβος parking στη δομή έργου διάβαζε `level` (πεδίο που δεν γράφει κανείς) · η αποσύνδεση ορόφου ακινήτου στελνόταν ως `undefined` ⇒ **δεν αποθηκευόταν ποτέ**.

### 6.5 Φίλτρο ορόφου — από τα δεδομένα
`lib/floor/floor-filter.ts` + `useFloorFilterConfig`: επιλογές = οι όροφοι που **υπάρχουν** (idealista/Zillow — ποτέ επιλογή με 0 αποτελέσματα), τιμή `αριθμός:είδος` (πυλωτή ≠ ισόγειο), ετικέτα `useFloorLabel`, κατά στάθμη. Σελίδες parking/storage + πωλήσεις. Διαγράφηκαν: `PARKING_FLOOR_LABELS` · `STORAGE_LABELS` ορόφων · `standardFloors` (κλειδιά `storage.floors.*` που **δεν υπήρξαν ποτέ**) · `building.floors.*` (22 κλειδιά × 2 γλώσσες, μηδέν καταναλωτές) · τα νεκρά `parkingByFloor`/`storagesByFloor` (με χειρόγραφο «Άγνωστος», N.11) · `parseFloorLevel`.

### 6.6 Μετανάστευση + ελεγκτής απόκλισης
`scripts/migrations/migrate-hosted-floor-ref.ts` (`npm run migrate:hosted-floor-ref`) πάνω στον καθαρό `plan-hosted-floor-backfill.ts`: ξηρό από προεπιλογή · `--verify` = **ελεγκτής απόκλισης** (exit 1 αν κάποιο αντίγραφο διαφωνεί με τον όροφό του — το Revit δεν τον χρειάζεται γιατί δεν έχει αντίγραφο· εμείς έχουμε, άρα το **μετράμε**) · `--apply` **μόνο με εντολή Giorgio**. Παλιό κείμενο ⇒ parser ⇒ όροφος του **ίδιου** κτιρίου/εταιρείας με τον αριθμό (και το είδος για να ξεχωρίσει πυλωτή/ισόγειο). Ό,τι δεν λύνεται **μονοσήμαντα** (`unparseable` · `no-building` · `no-matching-floor` · `ambiguous` · `missing-floor` · `foreign-floor`) **αναφέρεται, δεν γράφεται**. Συναλλαγή ανά έγγραφο με ξανα-κρίση + επαλήθευση `noop`. Ο ίδιος planner χτίζει και το **seed** parking (αριθμοί + `floorId`).

### 6.7 Ίδια ευκαιρία (N.0.2)
`services/parking-showcase/labels.ts`: οι χειρόγραφοι πίνακες είδους/ζώνης («Πιλοτή»/«Ταράτσα» ενώ η οθόνη λέει «Πυλωτή»/«Δώμα») ⇒ `createBundleTranslate` πάνω στο `parking.json`. Ο φρουρός κλάσης έχασε **δύο** εξαιρέσεις (seed + showcase labels) — μένουν 3.

## 7. Αποδεκτός υπολειπόμενος κίνδυνος
- Το `Floor.name` που γράφουν οι φόρμες δημιουργίας ορόφου είναι στη **γλώσσα της οθόνης** (όπως πριν)· η `longName` μένει canonical ελληνική.
- **Ευρετήριο αναζήτησης** (`search-index-config` → Cloud Functions, CHECK 3.93): αποθηκεύει μόνο τον αριθμό ⇒ θέση σε **πυλωτή** εμφανίζεται «Ισόγειο» στα αποτελέσματα αναζήτησης. Η διόρθωση (κωδικός είδους στο στατιστικό) θέλει ανάπτυξη Functions — **όχι** με το push· καταγράφηκε στο pending-ratchet.
- **Φίλτρο ορόφου ακινήτων** (`usePropertyFiltersConfig`): ετικέτα ωμός αριθμός («2») και τιμή που συγκρίνεται αριθμητικά σε άλλους matchers — να περάσει στο `floor-filter` (κλειδί αριθμός:είδος). Καταγράφηκε.
- `spaceFloorOf` (αντικειμενική αξία) **επίτηδες** δεν ερμηνεύει κείμενο (η πυλωτή ⇒ ερώτηση) — απόφαση εκείνου του ADR· μετά τη μετανάστευση τα δεδομένα είναι αριθμοί, οπότε δεν υπάρχει απώλεια.
- Μέχρι να τρέξει η μετανάστευση, τα παλιά έγγραφα διαβάζονται σωστά (ο αναγνώστης περνά το κείμενο από τον parser), αλλά **δεν** ακολουθούν αναρίθμηση ορόφου (δεν έχουν `floorId`).
- `bim3d section.presets.floorN` («Floor {n}» για δείκτη προεπιλογής τομής) — όχι ετικέτα στάθμης, εκτός εύρους.

## Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-10-03 | **2β.1β** — φιλοξενία σε όροφο (§6): `HostedOnFloor` (`floorId` + `floor` + `floorKind`) σε ακίνητα/θέσεις/αποθήκες · ο server ο μόνος συγγραφέας του αντιγράφου (`host-floor.server`, φύλακας πόρου) · `floor` μη εγγράψιμο από client · cascade αναρίθμησης/είδους/ονόματος (+ μεζονέτες) · `floors PATCH` γράφει `kind` + μοναδικότητα στην επεξεργασία · ένας επιλογέας/μία πηγή ορόφων · ~20 προβολές στην ετικέτα · φίλτρο ορόφου από τα δεδομένα · μετανάστευση + `--verify` (ΔΕΝ έτρεξε σε δεδομένα) · seed σε αριθμούς + `floorId` · N.0.2 `parking-showcase/labels` στο `parking.json`. 5 υπαρκτά σφάλματα έκλεισαν (§6.4). jest: σχετικές σουίτες 5.600+ πράσινες (τα 3 κόκκινα προϋπήρχαν: `bundle-completeness` · `proximity-anchor-reach` · `project-place-wiring`) · πύλες 0 αποτυχίες σε 113 αρχεία · `jscpd:diff` 0 (μετά το `useSpaceLocation`). |
| 2026-10-03 | **2β.1α** — δημιουργία. Λεξιλόγιο (+4 είδη, `isAboveGround`) · `FloorRef` · `parseLegacyFloor` · `formatFloorRef` + namespace `floors` (`selectordinal`) · `useFloorLabel` / `floorLabelIn` / `canonicalFloorLongName` · κατάργηση `formatFloorLabel`/`formatFloorString`/`generateAutoLongName` + 8 χειρόγραφων · φρουρός κλάσης. jest: floor 85 · ai-pipeline 1242/1242 · πύλες 66/66 · `jscpd:diff` 0 (μετά το `toFloorCreatePayload`). |
