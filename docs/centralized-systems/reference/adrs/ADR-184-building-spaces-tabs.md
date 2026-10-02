# ADR-184: Building Spaces Tabs (Storage, Parking, Units)

## Status
**IMPLEMENTED** (2026-02-16)

## Context
Η σελίδα κτιρίου χρειαζόταν 3 νέες καρτέλες για πλήρη διαχείριση χώρων:
- **Αποθήκες**: Υπήρχε ως stub (24 γρ.) — πλέον πλήρης CRUD
- **Θέσεις Στάθμευσης**: Νέα καρτέλα
- **Μονάδες**: Νέα καρτέλα

Κάθε καρτέλα: λίστα items φιλτραρισμένα κατά `buildingId` + inline CRUD.

## Decision
**Bidirectional Sync**: Τα ίδια Firestore collections (`storage_units`, `parking_spots`, `units`) χρησιμοποιούνται τόσο από τα building tabs όσο και από τις sidebar pages (/spaces/storage, /spaces/parking). Δεν χρειάζεται ειδικός sync mechanism.

**Pattern**: Ακολουθούμε το FloorsTabContent pattern — inline CRUD με `apiClient`, semantic HTML, i18n.

## Architecture

### API Layer
| Resource | Collection | API Endpoint | `buildingId` filter |
|----------|-----------|--------------|---------------------|
| Storage | `storage_units` | `GET /api/storages` | `?buildingId=xxx` (ADR-184) |
| Parking | `parking_spots` | `GET /api/parking` | `?buildingId=xxx` (existing) |
| Units | `units` | `GET /api/units` | `?buildingId=xxx` (existing) |

### Hooks
| Hook | File | `buildingId` support |
|------|------|---------------------|
| `useFirestoreStorages` | `src/hooks/useFirestoreStorages.ts` | Added (ADR-184) |
| `useFirestoreParkingSpots` | `src/hooks/useFirestoreParkingSpots.ts` | Existing |
| `useFirestoreUnits` | `src/hooks/useFirestoreUnits.ts` | New (ADR-184) |

### Tab Components
| Tab | Component | File |
|-----|-----------|------|
| Αποθήκες | `StorageTab` | `src/components/building-management/StorageTab.tsx` (+ `StorageTab/useStorageTabState.ts` · `StorageTab/StorageTabFilters.tsx`) |
| Θ. Στάθμευσης | `ParkingTabContent` | `src/components/building-management/tabs/ParkingTabContent.tsx` (+ `useParkingTabState.ts`) |
| Μονάδες | `PropertiesTabContent` | `src/components/building-management/tabs/PropertiesTabContent.tsx` (+ `property-tab-columns.tsx`) |

> 2026-10-02: οι γραμμές έγραφαν `StorageTab/index.tsx` και `UnitsTabContent.tsx` — **δεν υπάρχουν**· διορθώθηκαν από τον κώδικα.

### Εξαγωγή XLSX (ADR-898 Φ4β, 2026-10-02)
Revit «Export Schedule»: κάθε πίνακας εξάγει **ό,τι βλέπει ο άνθρωπος** — φιλτραρισμένες γραμμές, σειρά της οθόνης,
**ίδιος** ορισμός στηλών.

| Κομμάτι | Αρχείο |
|---|---|
| Στήλη → κελί αρχείου: `exportCell` · `exportFormat` · `exportOnly` (μόνο στο αρχείο) · `exportTotal: 'sum'` | `shared/types.ts` |
| Κοινές στήλες (όροφος · επιφάνεια · διάθεση) — μία φορά για τις τρεις καρτέλες | `shared/buildingSpaceColumns.tsx` |
| Τιμή = **ζευγάρι** (ποσό νόμισμα + «Μονάδα τιμής» `exportOnly`) — ποτέ πώληση/€ μήνα/€ νύχτα σε μία αριθμητική στήλη | `shared/buildingSpacePriceColumn.tsx` (`buildPriceColumns` · `SpacePriceCell`) |
| Πίνακας → φύλλο · γραμμή συνόλου (`SUM` **μόνο** πλήρες, αλλιώς «λείπουν Ν από Μ») · βιβλίο πίνακας + «Παραδοχές» | `shared/space-table-export.ts` |
| ΕΝΑ hook για τις τρεις καρτέλες: κρατά τη σειρά (επιστρέφει ως `initialSort` μετά τις κάρτες) · κάρτες ⇒ σειρά δεδομένων · Παραδοχές (κτίριο · ημερομηνία · προβολή · σειρά · «Ν από Μ» · φίλτρα) | `shared/useSpaceTableExport.ts` |
| Κατάσταση κουμπιού (busy · failed με λόγο · φρένο διπλού κλικ) + το ΕΝΑ κουμπί (και της Αντικειμενικής) | `shared/useExportAction.ts` · `shared/SpaceExportButton.tsx` |
| Μπάρα φίλτρων: `exportAction?` — χωρίς αυτό **κανένα** κουμπί | `shared/BuildingSpaceFilterBar.tsx` |
| Σκελετός βιβλίου (`exceljs` δυναμικά · ιδιότητες · κατέβασμα) · φύλλο «κλειδί → τιμή» | `lib/export/excel-workbook.ts` (`exportWorkbook` · `addKeyValueSheet`) |

### Χώροι σε άλλο κτίριο — «θέση ≠ ανάθεση» (ADR-898 §20, 2026-10-02)
Η λίστα και τα στατιστικά κάθε καρτέλας = χώροι με `buildingId` = κτίριο (**όπου βρίσκονται**). **Δίπλα** στη λίστα, από
τον **ΕΝΑ** κανόνα «ποιοι χώροι είναι του κτιρίου» (`lib/building-spaces/building-space-membership.ts`, κοινός με την
«Αντικειμενική» και τον πίνακα ποσοστών):

| Ενότητα | Τι | Ενέργεια |
|---|---|---|
| «Χωρίς κτίριο» | παρακολουθήματα μονάδων του κτιρίου **χωρίς** `buildingId` — μετρούν εδώ. **Από ADR-898 §21 δίχτυ ασφαλείας, κανονικά άδειο**: ο χώρος που δίνεται σε μονάδα παίρνει το κτίριό της στην ίδια συναλλαγή, τα παλιά τα τοποθετεί η μετάπτωση ⇒ η λίστα «βρίσκεται εδώ» **είναι** ο κανόνας | «Σύνδεση με αυτό το κτίριο» (η **ίδια** πόρτα με τον διάλογο σύνδεσης· δουλεύει και για πωλημένο χώρο — τοποθέτηση ≠ μετακίνηση) |
| «Σε άλλο κτίριο» | παρακολουθήματα μονάδων του κτιρίου που **βρίσκονται** αλλού — **δεν** μετρούν εδώ | σύνδεσμος στο κτίριο όπου βρίσκονται (`ENTITY_ROUTES.buildings.withId`) |

| Κομμάτι | Αρχείο |
|---|---|
| Endpoint (δηλωμένο όριο `STANDARD`) | `app/api/buildings/[buildingId]/space-relations/route.ts` |
| Αναγνώστης Admin SDK · σχήμα | `services/building-spaces/building-space-admin-reader.ts` · `lib/building-spaces/building-space-contract.ts` |
| Hook (ζωντανό σε αλλαγή χώρου **ή μονάδας**) · panel | `shared/useBuildingSpaceRelations.ts` · `shared/BuildingSpaceRelationsPanel.tsx` |

🔒 **Αποσύνδεση από κτίριο** χώρου που είναι παρακολούθημα μονάδας ⇒ **409** `POLICY_SPACE_LINKED_TO_UNIT` (κοινό PATCH,
`lib/api/space-attachment-guard.ts`): χωρίς κτίριο θα «επέστρεφε» σιωπηλά στο κτίριο της μονάδας. Η καρτέλα θέσεων
**κατάπινε** κάθε αποτυχία αποσύνδεσης/διαγραφής (μόνο `console.error`)· πλέον ειδοποίηση.

### Tab Factory Integration
- `unified-tabs-factory.ts`: 2 νέα tabs (parking order:7, units order:8)
- `buildingMappings.ts`: 2 νέα component registrations
- i18n labels: Ήδη υπήρχαν (`tabs.labels.parking`, `tabs.labels.units`)

## Files Changed
| File | Action |
|------|--------|
| `src/app/api/storages/route.ts` | MODIFIED — Added `buildingId` filter |
| `src/hooks/useFirestoreStorages.ts` | REWRITTEN — Added `buildingId` param, `useBuildingStorages()` |
| `src/hooks/useFirestoreUnits.ts` | NEW — Matching parking hook pattern |
| `src/components/building-management/StorageTab/index.tsx` | REWRITTEN — Full CRUD implementation |
| `src/components/building-management/tabs/ParkingTabContent.tsx` | NEW — Full CRUD |
| `src/components/building-management/tabs/UnitsTabContent.tsx` | NEW — Full CRUD |
| `src/config/unified-tabs-factory.ts` | MODIFIED — Added parking + units tabs |
| `src/components/generic/mappings/buildingMappings.ts` | MODIFIED — Registered new components |
| `src/subapps/dxf-viewer/config/modal-select/core/labels/tabs.ts` | MODIFIED — Added `parking` to BuildingTabLabelsConfig |

## Consequences
- Building detail pages now have 14 tabs (was 12)
- Storage/Parking/Units data created from building tabs appears automatically in sidebar pages
- No new npm packages required

## Changelog

- **2026-10-02** — **ADR-898 §21: χώροι «χωρίς κτίριο» — η άκυρη κατάσταση γίνεται αδύνατη** (§Χώροι σε άλλο κτίριο). Λίστα και στατιστικά των καρτελών **δεν άλλαξαν** και δεν απέκτησαν δεύτερο φορτωτή: αφού κανένα παρακολούθημα δεν μένει χωρίς κτίριο (PATCH μονάδας → τοποθέτηση στην ίδια συναλλαγή · μετάπτωση των παλιών), το «`buildingId` = κτίριο» ταυτίζεται με το `counted` του κανόνα. Το panel «Χωρίς κτίριο» μένει δίχτυ ασφαλείας.
- **2026-10-02** — **ADR-898 §20: χώροι σε άλλο κτίριο (θέση ≠ ανάθεση)** (§Χώροι σε άλλο κτίριο). Οι καρτέλες θέσεων/αποθηκών δείχνουν δίπλα στη λίστα «Χωρίς κτίριο» (επιδιόρθωση ενός κλικ) και «Σε άλλο κτίριο» (σύνδεσμος, κανένα ποσό), από τον ΕΝΑ κανόνα της αντικειμενικής — ως τώρα η καρτέλα (`?buildingId=`), η αντικειμενική και ο πίνακας ποσοστών είχαν **τρεις** διαφορετικούς. Αποσύνδεση παρακολουθήματος ⇒ 409 με μεταφρασμένο μήνυμα· η καρτέλα θέσεων δεν καταπίνει πια τις αποτυχίες.
- **2026-10-02** — **ADR-898 Φ4β βήμα 6: εξαγωγή XLSX στις Μονάδες / Αποθήκες / Στάθμευση** (§Εξαγωγή XLSX). Το κουμπί
  της `BuildingSpaceFilterBar` ήταν ετικέτα **χωρίς `onClick`** και στις τρεις καρτέλες· τώρα ζωγραφίζεται **μόνο** με
  `exportAction` (ο τύπος το εγγυάται). ΕΝΑ hook (`useSpaceTableExport`) για τις τρεις — φιλτραρισμένες γραμμές, σειρά
  της οθόνης, ίδιος ορισμός στηλών, φύλλο «Παραδοχές». Ο πίνακας Μονάδων απέκτησε στήλη **Τιμή** (όπως Στάθμευση/Αποθήκες·
  απόφαση Giorgio) και η γραμμή επεξεργασίας επί τόπου το κελί της (μόνο ανάγνωση), ώστε τα κελιά να μένουν κάτω από τις
  στήλες τους. Γραμμή συνόλου: πλήθος + `SUM` επιφάνειας **μόνο** όταν όλες έχουν· η τιμή **δεν** αθροίζεται ποτέ.
  **Boy Scout (N.0.2)**: όροφος/επιφάνεια ×3 και διάθεση ×2 → `buildingSpaceColumns.tsx` · `EXPORT_ONLY_KEYS`/`isScreenColumn`
  της Αντικειμενικής → σημαία `exportOnly` (τη φιλτράρει ο πίνακας) · `ExportButton` της Αντικειμενικής → κοινό ·
  σκελετός βιβλίου και φύλλο Παραδοχών → `lib/export/excel-workbook` · `propertyDisplayArea` (`lib/properties`) αντί για
  `gross || net || area` ×4 · `StorageTabFilters` έγινε hook (η ίδια περιγραφή φίλτρων τροφοδοτεί μπάρα **και** αρχείο) ·
  σκληρό `retryLabel="Retry"` στη Στάθμευση (N.11) · επικεφαλίδα σκέτο «m²» → «Επιφάνεια (m²)». Συμπεριφορά: ισόγειο `0`
  δεν ταξινομείται πια ως «χωρίς όροφο», και θέση/αποθήκη χωρίς επιφάνεια πάει τελευταία (ήταν `|| 0` = «η μικρότερη»).
  Κλειδιά i18n που έμειναν νεκρά (`unitStats`/`parkingStats`/`tabs.storageTab` `.exportReport` · `objective-value`
  `building.export.button/busy/failed`) αφαιρέθηκαν. Tests: `space-table-export` (+6) · `space-export-action` (+5) ·
  `use-space-table-export` (+3) · `building-space-price-column` (+2) · `BuildingSpaceTable.sort` (+1) · `excel-workbook` (+2)·
  μεταλλάξεις **7/7** (μερικό σύνολο · στήλη αρχείου στην οθόνη · νεκρό κουμπί · τιμή χωρίς μονάδα · σειρά πίνακα στις κάρτες
  · σιωπηλή αποτυχία · φρένο διπλού κλικ).
  **Ζωντανή επαλήθευση (ίδια μέρα)** βρήκε δύο πράγματα που κανένα test δεν έβλεπε (το `t` των tests είναι ψεύτικο):
  (α) η νέα στήλη τιμής **και** η υπάρχουσα κάρτα τιμής των Μονάδων έγραφαν ωμό `table.price` — το κλειδί ζει **μόνο** στο
  namespace `price-map`· τώρα `storageTable.columns.price` («Τιμή»), όπως οι Αποθήκες. (β) Οι επικεφαλίδες των Μονάδων
  δανείζονταν κλειδιά των Ορόφων («Όνομα Στάθμης» · «Ιδιότητες» · «Αρ. Στάθμης» · «Λεπτομέρειες») και θα γίνονταν οι
  επικεφαλίδες του Excel· τώρα `unitsTable.columns.{name,type,status}` (νέο: `name` «Μονάδα») + `storageTable.columns.floor`.
  (γ) Το **πραγματικό αρχείο** (διαβάστηκε πίσω με ExcelJS: στήλες = οθόνη · αριθμοί αριθμοί · `SUM` · Παραδοχές) έγραφε
  κτίριο « ΝΕΟ» — σκέτο `building.name` με κενό από τη φόρμα, χωρίς τον κωδικό. Τώρα `formatBuildingLabel(code, name)`
  (το SSoT της κεφαλίδας) και στις τρεις καρτέλες **και** στην Αντικειμενική (`buildingMappings`)· το SSoT κάνει πλέον
  `trim` (άγκυρα `lib/__tests__/entity-formatters.test.ts`).

- **2026-10-02** — **ADR-898 Φ4β**: νέα καρτέλα κτιρίου `objectiveValue` (`tabs/ObjectiveValueTab/*`) πάνω στο
  κοινό `BuildingSpaceTable`, που απέκτησε: `initialSort` (ο πίνακας ανοίγει ομαδοποιημένος, Revit `Sort By`) ·
  `onSortChange` · `renderFooter` (`<tfoot>` — ο καλών αποφασίζει **αν** υπάρχει αληθινό σύνολο) · επικεφαλίδες
  ταξινόμησης ως **κουμπιά** με `aria-sort` (πριν: κλικ σε `<th>`, απρόσιτο από πληκτρολόγιο). Η λογική σειράς εξήχθη σε
  καθαρό `shared/space-table-sort.ts` (`sortIntoGroups` · `nextSortState` · `ariaSortOf`) ώστε η εξαγωγή να έχει την
  **ίδια** σειρά με την οθόνη. Νέο `SpaceColumn.exportCell`/`exportFormat` + `shared/space-table-export.ts`
  (στήλες → φύλλο, πάνω στο `lib/export/excel-workbook` `addScheduleSheet`). ⏳ Οι Units/Parking/Storage δεν έχουν ακόμη
  `exportCell` — το κουμπί «Εξαγωγή» του `BuildingSpaceFilterBar` μένει χωρίς `onClick` ως το επόμενο βήμα.
  Tests: `shared/__tests__/BuildingSpaceTable.sort.test.tsx` (+3).

- **2026-09-18** — **ONE filter bar** for the three space tabs: `shared/BuildingSpaceFilterBar.tsx`
  (search + type/status selects + export). Units (`PropertiesTabContent`), Parking
  (`ParkingTabContent`) and Storage (`StorageTab/StorageTabFilters`, now a thin label wrapper)
  carried the same markup as parallel twins — CHECK 3.28 blocked the commit that staged two of
  them together. Labels stay with each caller (own i18n namespace); the select value is narrowed
  by **membership** (`narrowSpaceFilterValue`: `'all'` or a listed option, else ignored) instead
  of `as` casts / `normalizePropertyType` on the raw string. Test:
  `shared/__tests__/building-space-filter-bar.test.ts`.
