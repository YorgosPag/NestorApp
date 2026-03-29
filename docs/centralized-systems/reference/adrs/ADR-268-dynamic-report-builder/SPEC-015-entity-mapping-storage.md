# SPEC-015: Πλήρης Χαρτογράφηση — Αποθήκες (Storage Rooms)

**ADR**: 268 — Dynamic Report Builder
**Version**: 1.0
**Last Updated**: 2026-03-29
**Source of Truth**: Κώδικας (`src/types/storage/contracts.ts`, `src/types/storage/constants.ts`, `src/types/sales-shared.ts`)

---

## 1. Ταυτότητα Οντότητας

| Στοιχείο | Τιμή |
|----------|------|
| **Collection** | `storage_units` (via `COLLECTIONS.STORAGE`) |
| **TypeScript** | `Storage` (primary) + `StorageUnit` (legacy) |
| **ID Pattern** | Enterprise ID: `enterprise-id.service.ts` |
| **Tenant Isolation** | `companyId` (ADR-029) |
| **Form Config** | `src/components/space-management/StoragesPage/StorageDetails/tabs/storage-general-tab-config.ts` |
| **Tabs Config** | `src/config/storage-tabs-config.ts` |
| **Filter Config** | `src/components/core/AdvancedFilters/configs/storageFiltersConfig.ts` |
| **Mapper** | `mapStorageDoc()` in `src/lib/firestore-mappers.ts` |
| **API Routes** | `GET/POST /api/storages`, `GET/PATCH/DELETE /api/storages/[id]` |
| **Deletion Strategy** | `BLOCK` (conditional: sold storage cannot be deleted) |

---

## 2. Πλήρης Κατάλογος Πεδίων

### 2.1 Βασικά Στοιχεία (Storage interface)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | Yes | Enterprise ID |
| 2 | `name` | string | Yes | Εμφανιζόμενο όνομα αποθήκης |
| 3 | `code` | string | No | ADR-233: Entity coding system (π.χ. "A-AP-Y1.01") |
| 4 | `type` | StorageType | Yes | `large` / `small` / `basement` / `ground` / `special` / `storage` / `parking` / `garage` / `warehouse` |
| 5 | `status` | StorageStatus | Yes | `available` / `occupied` / `maintenance` / `reserved` / `sold` / `unavailable` |
| 6 | `building` | string | Yes | @deprecated — Όνομα κτιρίου (legacy, χρησιμοποίησε buildingId) |
| 7 | `buildingId` | string | No | Building document ID (FK) — migration 006 |
| 8 | `companyId` | string | No | Tenant isolation (ADR-029) |
| 9 | `linkedCompanyId` | string / null | No | ADR-232: Business entity link (cascade από project) |
| 10 | `floor` | string | Yes | Όνομα ορόφου (i18n key) |
| 11 | `floorId` | string | No | Floor document ID (FK) |
| 12 | `area` | number | Yes | Εμβαδόν σε τ.μ. |
| 13 | `description` | string | No | Περιγραφή |
| 14 | `price` | number | No | Τιμή σε EUR |
| 15 | `lastUpdated` | Date / string | No | Τελευταία ενημέρωση |
| 16 | `projectId` | string | No | Project document ID (FK) |
| 17 | `owner` | string | No | Ιδιοκτήτης (legacy text) |
| 18 | `notes` | string | No | Σημειώσεις |

### 2.2 Πεδία Πωλήσεων / Παραρτήματα (ADR-199)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 19 | `millesimalShares` | number / null | No | Χιλιοστά — 0 = κοινόχρηστο, >0 = ανεξάρτητα πωλήσιμο |
| 20 | `commercialStatus` | SpaceCommercialStatus | No | `unavailable` / `for-sale` / `reserved` / `sold` |
| 21 | `commercial` | SpaceCommercialData | No | Nested object πωλήσεων (βλ. §3.1) |

### 2.3 Legacy πεδία (StorageUnit interface)

Τα παρακάτω πεδία υπάρχουν στο legacy `StorageUnit` interface (backward compatibility):

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 22 | `project` | string | No | Όνομα project (legacy text) |
| 23 | `company` | string | No | Εταιρεία (legacy text) |
| 24 | `linkedProperty` | string / null | No | Κωδικός συνδεδεμένης μονάδας |
| 25 | `coordinates` | `{ x, y }` | No | Θέση στο χάρτη κτιρίου |
| 26 | `features` | string[] | No | Χαρακτηριστικά (ρεύμα, φως, κλπ) |
| 27 | `level` | string | No | Επίπεδο/Όροφος (εναλλακτικό) |
| 28 | `propertyCode` | string | No | Κωδικός συνδεδεμένου ακινήτου |
| 29 | `constructedBy` | string | No | Κατασκευαστής |
| 30 | `createdAt` | string | No | Ημ/νία δημιουργίας |
| 31 | `updatedAt` | string | No | Ημ/νία ενημέρωσης |
| 32 | `soldAt` | string | No | Ημ/νία πώλησης |
| 33 | `soldTo` | string | No | Αγοραστής (legacy text) |
| 34 | `identifier` | string | No | Display identifier (alias code) |
| 35 | `section` | string | No | Section/zone εντός κτιρίου |
| 36 | `dimensions` | string | No | Διαστάσεις (π.χ. "3x4m") |
| 37 | `height` | number | No | Ύψος σε μέτρα |
| 38 | `hasElectricity` | boolean | No | Σύνδεση ρεύματος |
| 39 | `hasWater` | boolean | No | Σύνδεση νερού |
| 40 | `hasClimateControl` | boolean | No | Κλιματισμός |
| 41 | `hasSecurity` | boolean | No | Ασφάλεια |

---

## 3. Nested Objects

### 3.1 SpaceCommercialData (`commercial`)

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `askingPrice` | number / null | Ζητούμενη τιμή (EUR) |
| `finalPrice` | number / null | Τελική τιμή πώλησης (EUR) |
| `buyerContactId` | string / null | Contact ID αγοραστή (FK → contacts) |
| `buyerName` | string / null | Denormalized όνομα αγοραστή |
| `listedDate` | Timestamp / null | Ημ/νία εισαγωγής στην αγορά |
| `reservationDeposit` | number / null | Προκαταβολή κράτησης (EUR) |

### 3.2 Coordinates (`coordinates`)

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `x` | number | Θέση X στο χάρτη κτιρίου |
| `y` | number | Θέση Y στο χάρτη κτιρίου |

### 3.3 Features (`features[]`)

Flat string array — i18n keys:

| Feature Key | Περιγραφή |
|-------------|-----------|
| `storage.features.electricity` | Ηλεκτρικό ρεύμα |
| `storage.features.naturalLight` | Φυσικό φως |
| `storage.features.artificialLight` | Τεχνητός φωτισμός |
| `storage.features.airChamber` | Αεραγωγός |
| `storage.features.security` | Ασφάλεια |
| `storage.features.elevatorAccess` | Πρόσβαση ασανσέρ |
| `storage.features.plumbing` | Υδραυλικά |
| `storage.features.airConditioning` | Κλιματισμός |
| `storage.features.alarm` | Συναγερμός |

---

## 4. Subcollections

**Η αποθήκη ΔΕΝ έχει subcollections.**

Σε αντίθεση με τις μονάδες (`units/{id}/payment_plans`), οι αποθήκες δεν έχουν ξεχωριστά subcollections. Τα πλάνα πληρωμών και τα συμβόλαια αναφέρονται μέσω unit.linkedSpaces[] (βλ. §5).

---

## 5. Σχέσεις με ΟΛΕΣ τις Οντότητες (Relationship Map)

### 5.1 Διάγραμμα Σχέσεων

```
                          ┌────────────────┐
                          │   ΑΠΟΘΗΚΗ      │
                          │  (storage_     │
                          │   units)       │
                          └───────┬────────┘
                                  │
       ┌──────────────────────────┼──────────────────────────┐
       │                          │                          │
 ┌─────┴─────┐            ┌──────┴──────┐           ┌───────┴──────┐
 │ ΑΚΙΝΗΤΑ   │            │ ΠΩΛΗΣΕΙΣ    │           │ ΥΠΟΔΟΜΗ      │
 │           │            │             │           │              │
 ├───────────┤            ├─────────────┤           ├──────────────┤
 │ projects  │            │ commercial  │           │ contact_     │
 │ buildings │            │  (nested)   │           │  links       │
 │ floors    │            │ units.      │           │ search_      │
 │ units     │            │  linked-    │           │  documents   │
 │ ownership │            │  Spaces[]   │           │ deletion_    │
 │ _tables   │            │ legal_      │           │  registry    │
 └───────────┘            │  contracts  │           └──────────────┘
                          └─────────────┘
```

### 5.2 Αναλυτικός Πίνακας Σχέσεων

| # | Collection / Entity | Πεδίο(α) σύνδεσης | Σχέση | Ρόλος Storage | Περιγραφή |
|---|--------------------|--------------------|-------|---------------|-----------|
| 1 | **projects** | `storage.projectId` → `projects.id` | N:1 | Αποθήκη ανήκει σε Έργο | Κάθε αποθήκη μπορεί να ανήκει σε ένα project |
| 2 | **buildings** | `storage.buildingId` → `buildings.id` | N:1 | Αποθήκη ανήκει σε Κτίριο | FK via migration 006 (πρώην text field `building`) |
| 3 | **floors** | `storage.floorId` → `floors.id` | N:1 | Αποθήκη ανήκει σε Όροφο | Optional FK — floor document reference |
| 4 | **units** | `units.linkedSpaces[].spaceId` → `storage.id` | N:M | Αποθήκη ως παρακολούθημα (appurtenance) μονάδας | ADR-199: LinkedSpace — η αποθήκη μπορεί να "ανήκει" σε μία ή περισσότερες μονάδες |
| 5 | **contacts** | `storage.commercial.buyerContactId` → `contacts.id` | N:1 | Αγοραστής αποθήκης | SpaceCommercialData — ποιος αγόρασε την αποθήκη |
| 6 | **companies** | `storage.linkedCompanyId` → `contacts.id` (company) | N:1 | Συνδεδεμένη εταιρεία | ADR-232: Business entity link (cascade από project) |
| 7 | **ownership_tables** | `rows[].linkedSpacesSummary[].spaceId` → `storage.id` | N:M | Αποθήκη σε πίνακα χιλιοστών | LinkedSpaceDetail: entityCode, spaceType, millesimalShares |
| 8 | **contact_links** | `contact_links.targetEntityId` → `storage.id` | 1:N | Αποθήκη ως target | Junction collection — ρόλοι (μηχανικός, εργολάβος κλπ) |
| 9 | **search_documents** | `searchDocuments.entityId` → `storage.id` | 1:1 | Search index | Cascade deletion dependency |
| 10 | **companies** | `storage.companyId` → tenant | N:1 | Tenant isolation | ADR-029: Κάθε αποθήκη ανήκει σε ένα tenant |

### 5.3 Σχέσεις μέσω LinkedSpaces (Indirect)

Η αποθήκη συνδέεται **έμμεσα** με οικονομικές οντότητες μέσω του unit.linkedSpaces[]:

| # | Collection | Μονοπάτι Σύνδεσης | Περιγραφή |
|---|------------|-------------------|-----------|
| 11 | **payment_plans** | unit → linkedSpaces[storage] → unit.payment_plans | Πλάνο πληρωμών (via unit subcollection) |
| 12 | **legal_contracts** | unit → linkedSpaces[storage] → legal_contracts | Νομικά συμβόλαια (αν η αποθήκη περιλαμβάνεται στην πώληση) |
| 13 | **cheques** | unit → commercial.buyerContactId → cheques | Αξιόγραφα αγοραστή (indirect via contact) |

### 5.4 LinkedSpace Interface (from Unit side)

```typescript
interface LinkedSpace {
  spaceId: string;          // Storage doc ID (FK → storage_units)
  spaceType: 'parking' | 'storage';
  quantity: number;
  inclusion: 'included' | 'excluded' | 'rented' | 'sold';
  allocationCode?: string;  // π.χ. "S-42"
  notes?: string;
  metadata?: Record<string, string | number | boolean>;
  // ADR-199: Sale Appurtenances
  includedInSale?: boolean;
  salePrice?: number | null;
}
```

### 5.5 LinkedSpaceDetail (from Ownership Table side)

```typescript
interface LinkedSpaceDetail {
  spaceId: string;          // Storage doc ID
  entityCode: string;       // "ΑΠΟΘΗΚΗ 1"
  spaceType: 'parking' | 'storage';
  description: string;
  floor: string;
  areaNetSqm: number;
  areaSqm: number;
  hasOwnShares: boolean;    // Αν συμμετέχει αυτόνομα στα χιλιοστά
  millesimalShares: number; // Χιλιοστά αν hasOwnShares=true
}
```

---

## 6. Report Builder Impact — Τι σημαίνει αυτό για τα Domains

### 6.1 Domain A4 (Αποθήκες) — Ενημερωμένες Στήλες

**Tier 1 (Flat Table) — Primary columns:**

| Στήλη | Πεδίο | Τύπος | Σημείωση |
|-------|-------|-------|----------|
| Όνομα | `name` | text | |
| Κωδικός | `code` | text | ADR-233 |
| Τύπος | `type` | enum | 9 τιμές (large, small, basement, ground, special, storage, parking, garage, warehouse) |
| Κατάσταση | `status` | enum | 6 τιμές (available, occupied, maintenance, reserved, sold, unavailable) |
| Εμπορ. Κατάσταση | `commercialStatus` | enum | 4 τιμές (unavailable, for-sale, reserved, sold) |
| Κτίριο | `buildingId` → join building name | text | FK join |
| Όροφος | `floor` | text | i18n key |
| Εμβαδόν (τ.μ.) | `area` | number | |
| Τιμή (EUR) | `price` | number | |
| Ζητούμενη Τιμή | `commercial.askingPrice` | currency | |
| Τελική Τιμή | `commercial.finalPrice` | currency | |
| Αγοραστής | `commercial.buyerName` | text | Denormalized |
| Χιλιοστά | `millesimalShares` | number | 0 = κοινόχρηστο |
| Ύψος (μ.) | `height` | number | |
| Διαστάσεις | `dimensions` | text | |
| Τμήμα | `section` | text | Zone εντός κτιρίου |
| Ρεύμα | `hasElectricity` | boolean | |
| Νερό | `hasWater` | boolean | |
| Κλιματισμός | `hasClimateControl` | boolean | |
| Ασφάλεια | `hasSecurity` | boolean | |
| Ημ/νία Πώλησης | `soldAt` | date | |
| Σημειώσεις | `notes` | text | |
| Ημ/νία Δημιουργίας | `createdAt` | date | |

**Tier 1 — Computed/Joined columns (cross-entity):**

| Στήλη | Join | Τύπος | Σημείωση |
|-------|------|-------|----------|
| Έργο | JOIN projects WHERE id = projectId | text | Όνομα project |
| Κτίριο (όνομα) | JOIN buildings WHERE id = buildingId | text | Όνομα building |
| Εταιρεία | JOIN contacts WHERE id = linkedCompanyId | text | Κατασκευαστής |
| Αγοραστής (πλήρης) | JOIN contacts WHERE id = commercial.buyerContactId | text | Πλήρη στοιχεία αγοραστή |
| Αρ. Συνδεδ. Μονάδων | COUNT units WHERE linkedSpaces[].spaceId = storage.id | number | Πόσες μονάδες συνδέονται |
| Κωδ. Μονάδας | units.linkedSpaces[].allocationCode | text | Κωδικός κατανομής |
| Τύπος Συμπερίληψης | units.linkedSpaces[].inclusion | enum | included/excluded/rented/sold |
| Αρ. Contact Links | COUNT contact_links WHERE targetEntityId = storage.id | number | Πόσες επαφές συνδέονται |
| Τιμή/τ.μ. | COMPUTED: price / area | currency | Υπολογιζόμενο |

### 6.2 Tier 2 (Row Repetition) — Arrays που χρειάζονται expansion

| Array | Πεδία ανά row | Μέγιστο πλήθος |
|-------|---------------|----------------|
| `features[]` | feature (i18n key) | ~9 |
| `linkedSpaces` (reverse) | unitName, allocationCode, inclusion, salePrice | ~5 |
| `contact_links` (reverse) | contactName, role, status | ~10 |
| `ownership_tables` (reverse) | entityCode, millesimalShares, hasOwnShares | ~5 |

### 6.3 Tier 3 (Storage Card PDF) — Layout

```
┌─────────────────────────────────────────┐
│ [LOGO] ΑΠΟΘΗΚΗ: [code] — [name]        │
│        Κτίριο: [building] | Όροφος: [x] │
├─────────────────────────────────────────┤
│ ΒΑΣΙΚΑ ΣΤΟΙΧΕΙΑ                          │
│ Τύπος: [type] | Κατάσταση: [status]     │
│ Εμβαδόν: [area] τ.μ. | Ύψος: [height]μ │
│ Διαστάσεις: [dimensions]                │
│ Τμήμα: [section]                        │
├─────────────────────────────────────────┤
│ ΧΑΡΑΚΤΗΡΙΣΤΙΚΑ                           │
│ ✅ Ρεύμα  ✅ Φωτισμός  ❌ Νερό         │
│ ✅ Ασφάλεια  ❌ Κλιματισμός             │
│ [πλήρης λίστα features]                 │
├─────────────────────────────────────────┤
│ ΕΜΠΟΡΙΚΑ ΣΤΟΙΧΕΙΑ                        │
│ Κατάσταση: [commercialStatus]           │
│ Ζητούμενη: [askingPrice] EUR            │
│ Τελική: [finalPrice] EUR                │
│ Αγοραστής: [buyerName]                  │
│ Χιλιοστά: [millesimalShares]            │
│ Κράτηση: [reservationDeposit] EUR       │
├─────────────────────────────────────────┤
│ ΣΥΝΔΕΣΕΙΣ ΜΕ ΜΟΝΑΔΕΣ                    │
│ [πίνακας: Μονάδα, Κωδικός, Inclusion]   │
├─────────────────────────────────────────┤
│ ΠΙΝΑΚΑΣ ΧΙΛΙΟΣΤΩΝ                        │
│ [πίνακας: entityCode, shares, area]     │
├─────────────────────────────────────────┤
│ ΕΠΑΦΕΣ                                   │
│ [πίνακας: Επαφή, Ρόλος, Status]        │
├─────────────────────────────────────────┤
│ ΕΡΓΟ & ΕΤΑΙΡΕΙΑ                          │
│ Έργο: [projectName]                     │
│ Εταιρεία: [linkedCompanyName]           │
├─────────────────────────────────────────┤
│ ΣΗΜΕΙΩΣΕΙΣ                               │
│ [notes]                                 │
└─────────────────────────────────────────┘
```

---

## 7. Πρόσθετες Πληροφορίες

### 7.1 Enum Values (Source of Truth)

**StorageType** (9 τιμές):

| Τιμή | i18n Key | Περιγραφή |
|------|----------|-----------|
| `large` | `storage.types.large` | Μεγάλη αποθήκη |
| `small` | `storage.types.small` | Μικρή αποθήκη |
| `basement` | `storage.types.basement` | Υπόγειο |
| `ground` | `storage.types.ground` | Ισόγειο |
| `special` | `storage.types.special` | Ειδική |
| `storage` | `storage.types.storage` | Γενική αποθήκη |
| `parking` | `storage.types.parking` | Parking (legacy — βλ. SPEC-016) |
| `garage` | `storage.types.garage` | Γκαράζ |
| `warehouse` | `storage.types.warehouse` | Αποθήκη (warehouse) |

**StorageStatus** (6 τιμές):

| Τιμή | i18n Key | Περιγραφή |
|------|----------|-----------|
| `available` | `storage.status.available` | Διαθέσιμη |
| `occupied` | `storage.status.occupied` | Κατειλημμένη |
| `maintenance` | `storage.status.maintenance` | Συντήρηση |
| `reserved` | `storage.status.reserved` | Κρατημένη |
| `sold` | `storage.status.sold` | Πωλημένη |
| `unavailable` | `storage.status.unavailable` | Μη διαθέσιμη |

**SpaceCommercialStatus** (4 τιμές):

| Τιμή | Περιγραφή |
|------|-----------|
| `unavailable` | Δεν πωλείται |
| `for-sale` | Προς πώληση |
| `reserved` | Κρατημένη |
| `sold` | Πωλημένη |

### 7.2 Standard Floors (i18n Keys)

14 προκαθορισμένοι όροφοι: basement3, basement2, basement1, basement, ground, floor1-floor9.

### 7.3 Deletion Strategy

```
deletion-registry.ts:
  strategy: BLOCK (conditional)
  ├── Αν commercial.buyerContactId ≠ null → BLOCK (πωλημένη)
  ├── cascade: search_documents (entityId)
  └── dependencies: contact_links (targetEntityId)
```

### 7.4 Cascade Propagation

| Trigger | Propagation | Service |
|---------|-------------|---------|
| Storage code αλλαγή | → unit.linkedSpaces[].allocationCode | `cascade-propagation.service.ts` |
| Building link αλλαγή | → child entities (via entity-linking) | `entity-linking.service.ts` |
| Storage πώληση | → field locking (commercialStatus, buildingId, linkedSpaces) | `unit-field-locking.ts` |

### 7.5 Real-time Events

| Event | Payload Fields |
|-------|----------------|
| `StorageCreated` | storageId, name, buildingId, type, status, timestamp |
| `StorageUpdated` | storageId, name, type, status, floor, area, buildingId, timestamp |
| `StorageDeleted` | storageId, timestamp |

### 7.6 Migration History

| Migration | Περιγραφή |
|-----------|-----------|
| `006_normalize_storage_building_references` | Μετατροπή `building` (name) → `buildingId` (FK). Non-destructive, backward compatible. |

---

## 8. Στατιστικά

| Μέτρηση | Τιμή |
|---------|------|
| Πεδία Storage (primary interface) | 21 |
| Πεδία StorageUnit (legacy interface) | 20 πρόσθετα |
| Πεδία SpaceCommercialData (nested) | 6 |
| Πεδία Coordinates (nested) | 2 |
| Features (i18n keys) | 9 |
| StorageType enum values | 9 |
| StorageStatus enum values | 6 |
| SpaceCommercialStatus enum values | 4 |
| Standard floors | 14 |
| Direct cross-entity references | 10 |
| Indirect references (via linkedSpaces) | 3 |
| Real-time events | 3 |
| Subcollections | 0 |
| API endpoints | 5 (GET list, POST, GET single, PATCH, DELETE) |
| **Σύνολο πεδίων (πλήρης αποθήκη)** | **~60** |

---

## 9. Σύγκριση με Parking (SPEC-016)

| Χαρακτηριστικό | Storage (SPEC-015) | Parking (SPEC-016) |
|----------------|--------------------|--------------------|
| Collection | `storage_units` | `parking_spaces` |
| Primary Type | `Storage` | (αντίστοιχο) |
| StorageType overlap | `parking` τιμή υπάρχει στο enum | Ξεχωριστή οντότητα |
| LinkedSpaces | spaceType = `'storage'` | spaceType = `'parking'` |
| Commercial overlay | Ίδιο (SpaceCommercialData) | Ίδιο (SpaceCommercialData) |
| Subcollections | 0 | 0 |
| ADR-199 fields | millesimalShares, commercialStatus, commercial | Ίδια |

> **Σημείωση**: Η τιμή `parking` στο `StorageType` enum είναι legacy — τα parking spaces πλέον είναι ξεχωριστή collection (`parking_spaces`). Βλ. SPEC-016 για πλήρη χαρτογράφηση.
