# ADR-931: Κοινόχρηστοι χώροι κτιρίου — από mock σε πραγματική οντότητα

| Metadata | Value |
|----------|-------|
| **Status** | ✅ IMPLEMENTED — Στάδιο Α (2026-11-04) · 🔄 Στάδιο Β σε εξέλιξη — Β1 ✅ (2026-11-06), Β2–Β5 ⏳ (§6) |
| **Date** | 2026-11-04 |
| **Category** | Entity Systems / Data & State |
| **Canonical Location** | `src/constants/common-space-categories.ts` · `src/app/api/common-spaces/` · `src/lib/common-spaces/` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## 1. Context

Η σελίδα `/o/[workspace]/spaces/common` έδειχνε **μόνο σκληροκωδικοποιημένους αριθμούς** (`'42'`, `12`, `count: 8`…)
και η κάρτα «Κοινόχρηστοι» του hub χώρων έγραφε σταθερό `0`. Η διερεύνηση έδειξε ότι **δεν υπήρχε καμία οντότητα
«κοινόχρηστος χώρος» στη βάση**:

- ❌ Το `SPACE_COMMON_*` του route SSoT σημαίνει «κοινά πεδία θέσης/αποθήκης», όχι κοινόχρηστο.
- ❌ Το scope `common_areas` του BOQ καταλήγει στα **ζωντανά διαμερίσματα** (`boq-target-properties.ts`).
- ❌ Το `RoomType 'common_area'` (`src/types/boq/units.ts`) είναι δηλωμένο αλλά αχρησιμοποίητο.
- ❌ Ο `thermal-space` (IfcSpace) είναι θερμικός χώρος χωρίς διάκριση ιδιωτικού/κοινόχρηστου.

## 2. Έρευνα — τι κάνουν οι μεγάλοι

| Πηγή | Τι κρατά | Τι λείπει |
|---|---|---|
| **Revit** Rentable Area Scheme (BOMA) | `Area Type`: Building Common Area · Major Vertical Penetration · Exterior Area | νομική φύση |
| **ArchiCAD / IFC 4.3** | Zone → `IfcSpace` (`INTERNAL`/`EXTERNAL`), ομαδοποίηση `IfcZone` | κατηγορία μέτρησης |
| **IPMS Residential** (IPMSC 2016) | Components: A κατακόρυφες διεισδύσεις · C τεχνικές υπηρεσίες · E κυκλοφορία · F παροχές · H λοιπά | IFC/ΑΚ |
| **ΑΚ 1117 · ν. 3741/1929** | κοινά μέρη = κοινή χρήση· ορίζονται από τη **σύσταση οριζόντιας ιδιοκτησίας**· **δεν μεταβιβάζονται αυτοτελώς** · αποκλειστική χρήση | μέτρηση |
| **Zillow / RESO** `AssociationAmenities` | παροχές δηλωμένες **χειροκίνητα** στην αγγελία | απόδειξη |

**Πού ξεπερνάμε**: κάθε κατηγορία κουβαλά **ταυτόχρονα** ομάδα + IPMS component + Revit Area Type + IFC predefined type,
και η **νομική φύση** είναι πεδίο του χώρου (όχι της κατηγορίας) — όπως ορίζει ο νόμος: το ίδιο δώμα είναι κοινής χρήσης σε
μία πολυκατοικία και αποκλειστικής χρήσης του ρετιρέ σε άλλη.

## 3. Decision

### 3.1 Οντότητα `common_spaces`

| Πεδίο | Σημασία |
|---|---|
| `buildingId` | **υποχρεωτικό** — ο κοινόχρηστος ανήκει στο κτίριο, ποτέ σε μονάδα· PATCH δεν δέχεται `null` |
| `floorId` → `floor`/`floorKind` | ADR-903 §6· απόν = εκτείνεται σε όλο το κτίριο (κλιμακοστάσιο, ανελκυστήρας) |
| `category` | λεξιλόγιο `COMMON_SPACE_CATEGORIES` (22 τιμές, 5 ομάδες) |
| `legalNature` | `common_use` (προεπιλογή ΑΚ 1117) · `exclusive_use` |
| `exclusiveUsePropertyIds` | μόνο για `exclusive_use`· **ζωντανές ιδιοκτησίες του ΙΔΙΟΥ κτιρίου και του καλούντος** |
| `area` | καθαρό m²· απόν = αδήλωτο (ποτέ `0`) |
| ❌ `commercialStatus` · `commercial` · `type` | **400** — δεν μεταβιβάζεται αυτοτελώς |

ID: πρόθεμα `cspc` (`generateCommonSpaceId`). Χωρίς αυτόματο κωδικό ADR-233 (ο κωδικός είναι ελεύθερος, Revit Room Number).

### 3.2 Ο route SSoT επεκτάθηκε — δεν αντιγράφηκε

`createSpaceEntityRoutes` (ADR-696) εξυπηρετεί πλέον **τρία** είδη. Η διαφορά τους είναι **μία** νομική ιδιότητα,
δηλωμένη σε **ένα** πίνακα — `SPACE_ENTITY_CAPABILITIES` (`src/lib/spaces/space-entity-kinds.ts`):

| Βήμα του pipeline | θέση · αποθήκη | κοινόχρηστος |
|---|---|---|
| εμπορικά πεδία (`mapSpaceCommercialFields`) | ✅ | ⛔ (zod 400 + ζώνη-τιράντες στο `planSpaceWrite`) |
| allocation code στα `linkedSpaces` μονάδων | ✅ | ⛔ |
| φρουρός παρακολουθήματος | ✅ | ⛔ |
| ανανέωση κάτοψης ορόφου αγγελιών | ✅ | ⛔ |

Νέο γενικό hook στο config: `resolveAsyncFields` — πεδία που κρίνονται **απέναντι στη βάση** πριν τη γραφή (εδώ: οι
ιδιοκτησίες αποκλειστικής χρήσης). Αλλαγή κτιρίου με αποκλειστική χρήση **ξαναελέγχει** τις ιδιοκτησίες στο νέο κτίριο.

### 3.3 Ασφάλεια

- `firestore.rules` `match /common_spaces/{id}`: ανάγνωση μέσω `companyId` (κανένα crossdoc, κανένα legacy fallback —
  κάθε έγγραφο γεννιέται από `createEntity` με `companyId`), γραφή `false` (Admin SDK).
- Σουίτα `tests/firestore-rules/suites/common-spaces.rules.test.ts` + γραμμή `coverage-manifest.ts` (`admin_write_only`).
- Φύλακας `requireCommonSpaceInTenant` (404 για ξένο ≡ ανύπαρκτο, ADR-742).

### 3.4 Μητρώα

`audit-entity-registry` (`common_space`) · `audit-tracked-fields` (`COMMON_SPACE_TRACKED_FIELDS`, χωρίς εμπορικά) ·
`entity-creation` · `entity-linking` (`common_space:buildingId`, χωρίς κλειδωμένες καταστάσεις) · `soft-delete-config` +
`/api/common-spaces/trash` · `deletion-registry` (εξάρτηση κτιρίου **και** ορόφου) · `API_ROUTES.COMMON_SPACES`.

### 3.5 Οθόνες

- **`/spaces/common`**: `useFirestoreCommonSpaces` (onSnapshot) → `computeCommonSpaceStats` (καθαρό) → κάρτες ανά ομάδα
  **από το λεξιλόγιο** (κάθε ομάδα εμφανίζεται, και με 0) · ανά κτίριο με σύνδεσμο στην καρτέλα του · κενή κατάσταση.
  Εμβαδόν: αθροίζεται **μόνο** το δηλωμένο· οι χώροι χωρίς εμβαδόν **μετριούνται** χωριστά.
- **Hub χώρων**: η κάρτα «Κοινόχρηστοι» μετρά τη συλλογή και μπαίνει στο σύνολο.
- **Καρτέλα κτιρίου «Κοινόχρηστοι»** (`CommonSpacesTab`): ζωντανή λίστα, διάλογος δημιουργίας/επεξεργασίας με έλεγχο
  έκδοσης (`_v`), κάδος· τα κοινά κομμάτια των χώρων κτιρίου (ADR-184) επαναχρησιμοποιούνται.

### 3.6 i18n

Νέο namespace **`common-spaces`** (el/en). ⚠️ Τα κλειδιά μπήκαν πρώτα στο `common` και η πύλη του shell slice
(ADR-744) το έπιασε: `56.965 / 53.500 bytes`. Θεραπεία = **μετακόμιση**, όχι μεγαλύτερο όριο — μετά τη μετακόμιση το
`common` έπεσε στα **50.598** (κάτω από πριν, αφού διαγράφηκαν και τα mock κλειδιά). Το namespace είναι eager
(καρτέλα χωρίς αλλαγή διαδρομής — ADR-279 §9).

## 4. Boy-Scout (N.0.2)

- `src/lib/auth/tenant-isolation.ts` ήταν **543 γραμμές** (> 500 ⇒ το hook θα μπλόκαρε κάθε άγγιγμα). Ο πυρήνας
  `requireDocInTenant` πήγε στο `tenant-isolation-core.ts` και οι φύλακες χώρων στο `tenant-isolation-spaces.ts`
  (ξαναεξάγονται — **καμία** αλλαγή στους καταναλωτές). Χωρίς κύκλο: και τα δύο εισάγουν από τον πυρήνα.
- Η άγκυρα `soft-delete-trash-list.test.ts` έψαχνε `createTrashListRoute('[a-z]+')` ⇒ **τυφλή** σε τύπους με κάτω παύλα.

## 5. Επαλήθευση

Jest: λεξιλόγιο (διαμέριση ομάδων, ετικέτες el/en), σχήματα (άρνηση εμπορικών/`type`/αποσύνδεσης), νομική φύση,
pipeline (ο κοινόχρηστος δεν γράφει εμπορικά ακόμη κι αν ξεφύγουν από το zod), σύνολα, mapper, πρόχειρο φόρμας.

## 6. Στάδιο Β — πέρα από τους μεγάλους (Β1 υλοποιημένο · Β2–Β5 σχεδιασμένα)

1. ✅ **Κάτοψη → χώρος** (Revit Area Plan · ArchiCAD Zone) — **υλοποιήθηκε 2026-11-06**, βλ. §6.1.
2. **Έξυπνες προτάσεις, ποτέ σιωπηλή μαντεψιά**: από τη στοίβα ορόφων (`floorKind` `pilotis`/`roof`/`stair-penthouse`)
   και το `hasElevator` προτείνονται κοινόχρηστοι που λείπουν· ο άνθρωπος αποδέχεται.
3. **BOQ**: το `common_areas` να στοχεύει πραγματικούς κοινόχρηστους, όχι διαμερίσματα.
4. **Αγγελίες**: παροχές (`amenity`) **παράγονται** από τους χώρους του κτιρίου, με απόδειξη. ⚠️ Η αντιστοίχιση σε RESO
   `AssociationAmenities` να επαληθευτεί έναντι του επίσημου Data Dictionary πριν γραφτεί.
5. **Πίνακας ποσοστών**: συντελεστής κοινοχρήστων ανά μονάδα (IPMS/BOMA load factor) δίπλα στα χιλιοστά.

### 6.1 Β1 — Κάτοψη → χώρος (υλοποίηση)

**Ο μηχανισμός σύνδεσης επεκτάθηκε, δεν αντιγράφηκε.** `OverlayRole` += `common_space` (μόνο κλειστό πολύγωνο),
`OverlayLinked.commonSpaceId`, `ROLE_REQUIRES_LINK.common_space = 'commonSpaceId'`. Ο πίνακας `ROLE_REQUIRES_LINK` είναι
πλέον η **μία** αυθεντία «ρόλος → κλειδί»: από αυτόν παράγονται τα `OVERLAY_LINK_KEYS` · `linkedEntityIdOf` ·
`linkedPayloadFor` · `linkedEntityIdsOf` · `roleForLinkKey` και το zod (`OverlayRoleSchema`, `OverlayLinkedSchema`).
Τρία χειρόγραφα switch (`OverlayProperties` · `useOverlayLayers` · `useEntityStatusResolver`) και δύο χειρόγραφες λίστες
(`useFloorEntitiesForLinking` · `OverlayListCard`) αντικαταστάθηκαν. Μένουν χειρόγραφοι οι καθρέφτες που **δεν**
μπορούν να διαβάσουν TypeScript: `firestore.rules` (`_validRole` · `_polygonOnlyRole` · `_linkedConsistent`) + σουίτα.

| Σημείο | Τι κάνει ο κοινόχρηστος |
|---|---|
| Επιλογέας σύνδεσης (DXF viewer) | χώροι του ορόφου **και** όσοι δεν έχουν όροφο (`isCommonSpaceOnPlan`) |
| Καμβάς | **Color Fill Scheme ανά ομάδα** λεξιλογίου (`COMMON_SPACE_GROUP_COLORS`, γέμισμα 0,25), εκτός της παλέτας εμπορικών καταστάσεων |
| Επιλυτής κατάστασης | **καμία** συνδρομή — ο κοινόχρηστος δεν έχει εμπορική κατάσταση (`STATUS_COLLECTION`, ΑΚ 1117) |
| Θεατής μόνο-ανάγνωσης (`useFloorOverlays`) | δεν μπαίνει (όπως το ίχνος — δεν είναι μονάδα προς διάθεση) |
| Δημόσια πλάκα ορόφου | `ROLE_FOR_PUBLIC.common_space = 'never'`· ο reader δεν φέρνει καν στοιχεία (`isPublicUnitRole`) |

**Εμβαδόν από τη γεωμετρία, με πηγή** (`src/lib/common-spaces/common-space-area.ts`):

| Πεδίο | Ποιος το γράφει | Σημασία |
|---|---|---|
| `drawnArea` | **μόνο ο server** (zod `z.undefined()` για τον πελάτη) | Σ εμβαδών **όλων** των περιγραμμάτων που δένουν τον χώρο |
| `area` | άνθρωπος, ή ο server όταν `areaSource = 'drawn'` | η ενεργή τιμή |
| `areaSource` | άνθρωπος (`'drawn'` = «υιοθέτησε το σχεδιασμένο») | νέα τιμή `area` ⇒ `declared`· **ίδια** τιμή ⇒ η δέσμευση μένει |

- **Μονάδες:** τα περιγράμματα τα γράφει μόνο το DXF viewer σε canonical mm (ADR-462) ⇒ `areaMm2ToM2(polygonArea(…))`,
  από τον **ένα** πίνακα `mmToSceneUnits`. Δηλώθηκε στο `.dxf-viewer-public-api.json` (CHECK 3.62) με ονομαστικό καταναλωτή.
- **Άθροισμα, όχι «το τελευταίο»:** χώρος χωρίς όροφο σχεδιάζεται σε κάθε κάτοψη που διασχίζει (Revit: ένα Area ανά
  επίπεδο, το πινάκιο αθροίζει). Ο υπολογισμός γίνεται **από την πηγή** σε συναλλαγή σε κάθε POST/PUT/PATCH/DELETE
  περιγράμματος, για τον χώρο πριν **και** μετά (αποσύνδεση και μεταφορά μετράνε) ⇒ ιδεμποτικό, χωρίς δέλτα, συγκλίνει.
  Ερώτημα `companyId == · linked.commonSpaceId ==`: μόνο ισότητες ⇒ συγχώνευση αυτόματων δεικτών, κανένας νέος δείκτης.
- **`_v`:** ανεβαίνει **μόνο** όταν αλλάζει το `area` (δεμένο). Σκέτο `drawnArea` ⇒ καμία ψευδής σύγκρουση στη φόρμα.
- **Ιστορικό:** `drawnArea` + `areaSource` στο `COMMON_SPACE_TRACKED_FIELDS`, μέσω του ίδιου `spaceAuditEntry` με το PATCH.
- **Φρουρός σύνδεσης** (`assertCommonSpaceLinkable`): ίδιος πελάτης (ξένο ≡ ανύπαρκτο ⇒ 404), ζωντανός χώρος, **ίδιο
  κτίριο** με τον όροφο της κάτοψης, και ίδιος όροφος για χώρο ορόφου (422). Τρέχει μόνο όταν η σύνδεση είναι νέα/αλλάζει.
- **Πέρα από τη Revit** (που δείχνει μόνο το υπολογισμένο): στήλη «Από την κάτοψη» στην καρτέλα κτιρίου, με σήμα
  «Ακολουθεί την κάτοψη» ή «Απόκλιση Χ%» (> 2%, `DRAWN_AREA_DIVERGENCE_RATIO`) και ενέργεια «Υιοθέτηση σχεδίου». Ο
  πελάτης δεν στέλνει αριθμό: ο server διαβάζει το `drawnArea` από τη βάση. Ποτέ σιωπηλή διόρθωση.

⚠️ **Όρια (γνωστά, όχι λυμένα εδώ):** οι κανόνες επιτρέπουν ακόμη απευθείας γραφή περιγράμματος από `isBimWriter`
πελάτη. Μια τέτοια γραφή **δεν** ξαναμετρά το `drawnArea` μέχρι την επόμενη αλλαγή μέσω API. Σήμερα κανένας πελάτης δεν
γράφει απευθείας (μόνο ο `floorplan-overlay-mutation-gateway`). Ο υπάρχων handler **δεν** ελέγχει ότι τα `propertyId` /
`parkingId` / `storageId` ανήκουν στον ίδιο πελάτη· ο φρουρός μπήκε μόνο για το `commonSpaceId` (πρόταση για τα άλλα,
εκκρεμεί απόφαση).

## 7. Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-11-04 | Στάδιο Α: οντότητα, route SSoT με `SPACE_ENTITY_CAPABILITIES` + `resolveAsyncFields`, κανόνες + σουίτα, μητρώα, σελίδα/hub/καρτέλα με ζωντανά δεδομένα, namespace `common-spaces`, διάσπαση `tenant-isolation`. Αριθμός: ήταν 930 στο πρόχειρο — συγκρούστηκε με το CRM pipeline (CHECK 3.49) ⇒ 931. |
| 2026-11-05 | Πύλες commit: (α) CHECK 3.78 — οι `/api/common-spaces/[id]` και `/trash` δηλώνουν ρητά `category: 'STANDARD'` (νέο προαιρετικό πεδίο του `createSpaceEntityRoutes` και δεύτερο όρισμα του `createTrashListRoute`, με τύπο που δέχεται μόνο τη βαθμίδα που επιβάλλεται)· (β) CHECK 3.7 — το `parseArea` περνά από το `normalizeDecimalString` (ADR-576) αντί για inline `.replace(',', '.')`· τα `tenant-isolation-core.ts` / `-spaces.ts` (διάσπαση του `tenant-isolation.ts`) μπήκαν στις λίστες εξαιρέσεων `tenant-query-scope` / `space-entity-route` του `.ssot-registry.json`· (γ) CHECK 3.35 — το `GET /api/common-spaces?buildingId=` δηλώνει `tenant-scope-exempt`: ο άξονας απομόνωσης είναι το κτίριο, επαληθευμένο πριν το ερώτημα από το `requireBuildingInTenant` (ίδιο σχήμα με `ika/employment-records`). |
| 2026-11-05 | 🔴 **Περιστατικό παραγωγής, 05:00 UTC:** το cron `purge-deleted-entities` απάντησε `FAILED_PRECONDITION: The query requires an index` για το `common_space`. Το Στάδιο Α έβαλε το `common_spaces` στο `SOFT_DELETE_CONFIG`, αλλά δεν πρόσθεσε τον δείκτη `status + deletedAt` που έχουν οι άλλες 8 συλλογές του κάδου. Η συλλογή της σάρωσης είναι μεταβλητή (`config.collection`), άρα η πύλη δεικτών Admin SDK (CHECK 3.91) δεν μπορούσε να τη δει. **Θεραπεία:** ο δείκτης στο `firestore.indexes.json`, και άγκυρα κλάσης στο `purge-deleted-entities.job.test.ts`: κάθε εγγραφή του `SOFT_DELETE_CONFIG` πρέπει να έχει δείκτη `status,deletedAt` (μετάλλαξη «χωρίς δείκτη» ⇒ κόκκινο). Ζημιά: καμία, αφού η σάρωση των άλλων συλλογών συνεχίζει και ο κάδος του `common_spaces` απλώς δεν άδειασε. |
| 2026-11-05 | **«Κολλημένο loading» (handoff #1) — ΔΕΝ αναπαράχθηκε.** Μέτρηση στην παραγωγή (`/o/<εταιρεία>/spaces` και `/spaces/common`, Chrome, ανάγνωση μόνο): 2 πλήρεις φορτώσεις (3,2″ · 3,1″) + 6 πλοηγήσεις client από το μενού (0,1–3,7″) — καμία κάρτα δεν έμεινε «…», και η κενή κατάσταση εμφανίστηκε. Η διαδρομή χωρίς πρόθεμα ανακατευθύνεται στον χώρο εργασίας. Ανάγνωση του `subscribeToCollection`: κάθε δρόμος καταλήγει σε `onData` ή `onError`, εκτός του `waitForAuthReady() === false`, που συμβαίνει μόνο χωρίς χρήστη, οπότε ο hook έχει ήδη `enabled:false` ⇒ `loading:false`. Η πραγματική αιτία της παρατήρησης της 04/11 μένει **άγνωστη**: πιθανότατα κρύο πρώτο φόρτωμα (στα 8″ το hub έδειχνε ακόμη «…»), όχι όμως αποδεδειγμένα. **Κλείδωμα:** `src/hooks/__tests__/useFirestoreCommonSpaces.loading.test.ts` (4 περιπτώσεις: κενό · σφάλμα · αποσυνδεδεμένος · ταυτότητα σε εξέλιξη), μετάλλαξη 2/2 κόκκινη. Καμία αλλαγή κώδικα παραγωγής. |
| 2026-11-06 | **Ζωντανό CRUD παραγωγής ✅** (Chrome, κτίριο «Κτίριο Β — ΔΟΚΙΜΗ Κτίριο Β (προσωρινό)» `bldg_349b7d29-…`): δημιουργία `cspc_0e1e31b3-…` («12,5» ⇒ 12.5, το `projectId` κληρονομείται) → εμφανίζεται ζωντανά στο `/spaces/common` → επεξεργασία 12.5→14 (`_v:1`, ζωντανά χωρίς ανανέωση) → soft delete (`status:deleted`, `previousStatus`, `deletedAt`) → ζωντανή πτώση στο 0. Ιστορικό: `created` / `updated` / `soft_deleted`. Ο δοκιμαστικός χώρος μένει στον κάδο, και ο cron τον καθαρίζει σε 31 ημέρες. **Εύρημα + διόρθωση:** η φόρμα επεξεργασίας έδειχνε `12.5` αντί για `12,5`, επειδή το `draftFromCommonSpace` έκανε `String(space.area)`. Τώρα το εμβαδόν περνά από το SSoT `formatForEditing` (ADR-706/576: δεκαδικό της γλώσσας, χωρίς ομαδοποίηση) με διαχωριστικό από το `resolveDecimalSeparator(getCurrentLocale())`. Το διαχωριστικό είναι υποχρεωτική παράμετρος, ώστε η συνάρτηση να μένει καθαρή. Κλείδωμα: `common-space-draft.test.ts` (`,` ⇒ «12,5» · `.` ⇒ «12.5» · round-trip el ⇒ 12.5 · χωρίς εμβαδόν ⇒ κενό). |
| 2026-11-06 | **Β1 — κάτοψη → κοινόχρηστος χώρος** (§6.1): ρόλος `common_space` + `linked.commonSpaceId` πάνω στο **υπάρχον** μηχανισμό, με τον `ROLE_REQUIRES_LINK` ως μία αυθεντία (3 switch + 2 λίστες αντικαταστάθηκαν από helpers και zod που παράγονται από αυτόν) · κανόνες + σουίτα (4 νέες περιπτώσεις) · επιλογέας (όροφος + όλο το κτίριο) · Color Fill Scheme ανά ομάδα στον καμβά · ποτέ στη δημόσια πλάκα ή στον θεατή κατάστασης · `drawnArea` (μόνο server, Σ όλων των κατόψεων, συναλλαγή, ιστορικό) + `areaSource` («υιοθέτησε το σχεδιασμένο», 422 χωρίς σχέδιο) · φρουρός σύνδεσης (πελάτης · κτίριο · όροφος) · στήλη «Από την κάτοψη» με σήμα απόκλισης > 2% · `areaMm2ToM2` στο `.dxf-viewer-public-api.json`. Tests γραμμένα (`common-space-area.test.ts`, `floorplan-overlays-links.test.ts`, σουίτα κανόνων) — **εκτελούνται μόνο με έγκριση**. Κανένα deploy κανόνων. |
