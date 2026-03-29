# SPEC-016: Πλήρης Χαρτογράφηση — Θέσεις Στάθμευσης (Parking Spots)

**ADR**: 268 — Dynamic Report Builder
**Version**: 1.0
**Last Updated**: 2026-03-29
**Source of Truth**: Κώδικας (`src/types/parking.ts`, `src/types/sales-shared.ts`, `src/lib/firestore-mappers.ts`)

---

## 1. Ταυτότητα Οντότητας

| Στοιχείο | Τιμή |
|----------|------|
| **Collection** | `parking_spots` (`COLLECTIONS.PARKING_SPACES`) |
| **TypeScript** | `ParkingSpot` (canonical, SSoT — ADR-191) |
| **ID Pattern** | Enterprise ID: `park_XXXXX` (`enterprise-id.service.ts`) |
| **Tenant Isolation** | `companyId` (ADR-029) |
| **Tabs Config** | `src/config/parking-tabs-config.ts` (6 tabs: info, floor-plan, documents, photos, videos, history) |
| **Entity Code** | ADR-233: `{Building}-{PK|PY}-{Floor}.{Seq}` (PK=κλειστό, PY=υπαίθριο) |
| **API Routes** | `GET/POST /api/parking`, `PATCH/DELETE /api/parking/[id]` |
| **Search Index** | `parkingNumber` (title), `type`, `status`, `notes` (searchable) |
| **Deletion Strategy** | `BLOCK` (conditional: αν `commercial.buyerContactId` not null → απαγορεύεται) |
| **Mapper** | `mapParkingDoc()` — `src/lib/firestore-mappers.ts` |

---

## 2. Πλήρης Κατάλογος Πεδίων

### 2.1 Βασικά Στοιχεία

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | — | Enterprise ID (`park_XXXXX`) |
| 2 | `number` | string | **Yes** | Display code, π.χ. "P-001" |
| 3 | `code` | string | No | ADR-233 entity code, π.χ. "A-PK-Y1.01" |
| 4 | `projectId` | string | No* | Έργο στο οποίο ανήκει (*de facto required) |
| 5 | `buildingId` | string \| null | No | Κτίριο (null = open space / unlinked) |
| 6 | `floorId` | string | No | Firestore doc ID ορόφου |
| 7 | `floor` | string | No | Floor/level identifier, π.χ. "-1", "0", "pilotis" |
| 8 | `companyId` | string | No* | Tenant isolation (*server-injected) |
| 9 | `createdBy` | string | No | User ID δημιουργού |
| 10 | `createdAt` | Date/Timestamp | No | Ημ/νία δημιουργίας |
| 11 | `updatedAt` | Date/Timestamp | No | Ημ/νία ενημέρωσης |

### 2.2 Φυσικά Χαρακτηριστικά

| # | Πε��ίο | Τύπος | Required | Περι��ραφή |
|---|-------|-------|----------|-----------|
| 12 | `type` | ParkingSpotType | No | `standard` / `handicapped` / `motorcycle` / `electric` / `visitor` |
| 13 | `status` | ParkingSpotStatus | No | `available` / `occupied` / `reserved` / `sold` / `maintenance` |
| 14 | `locationZone` | ParkingLocationZone \| null | No | `pilotis` / `underground` / `open_space` / `rooftop` / `covered_outdoor` |
| 15 | `location` | string | No | Freeform location description |
| 16 | `area` | number | No | Εμβαδόν σε m² |
| 17 | `price` | number | No | Τιμή σε € |
| 18 | `notes` | string | No | Ελεύθερες σημειώσεις |

### 2.3 Business Entity Link

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 19 | `linkedCompanyId` | string \| null | No | ADR-232: Κατασκευαστική εταιρεία (inherited via cascade από project) |

### 2.4 Sales / Appurtenance Fields (ADR-199)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 20 | `millesimalShares` | number \| null | No | Χιλιοστά — 0 = κοινόχρηστο, >0 = αυτοτελώς πωλήσιμο |
| 21 | `commercialStatus` | SpaceCommercialStatus | No | `unavailable` / `for-sale` / `reserved` / `sold` |
| 22 | `commercial` | SpaceCommercialData | No | Commercial overlay (nested object — βλ. §3) |

---

## 3. Nested Objects

### 3.1 `commercial` — SpaceCommercialData (ADR-199)

Εμφανίζεται μόνο όταν η θέση πωλείται ως αυτοτελής ή παρακολούθημα.

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 22a | `commercial.askingPrice` | number \| null | No | Ζητούμενη τιμή (€) |
| 22b | `commercial.finalPrice` | number \| null | No | Τελική τιμή πώλησης (€) |
| 22c | `commercial.buyerContactId` | string \| null | No | Contact ID αγοραστή (Firestore ref) |
| 22d | `commercial.buyerName` | string \| null | No | Denormalized όνομα αγοραστή |
| 22e | `commercial.listedDate` | Timestamp \| null | No | Ημ/νία καταχώρησης προς πώληση |
| 22f | `commercial.reservationDeposit` | number \| null | No | Ποσό κράτησης (€) |

---

## 4. Subcollections

**Η θέση στάθμευσης ΔΕΝ έχει subcollections.**

Τα σχετικά δεδομένα (contact_links, search_documents) βρίσκονται σε ξεχωριστές top-level collections.

---

## 5. Enums — Πλήρεις Τιμές

### 5.1 ParkingSpotType (5 τιμές)

| Τιμή | i18n Key | Περιγραφή |
|------|----------|-----------|
| `standard` | `parking.types.standard` | Κανονική θέση |
| `handicapped` | `parking.types.handicapped` | ΑμεΑ |
| `motorcycle` | `parking.types.motorcycle` | Μοτοσικλέτα |
| `electric` | `parking.types.electric` | Ηλεκτρικό όχημα |
| `visitor` | `parking.types.visitor` | Επισκέπτης |

### 5.2 ParkingSpotStatus (5 τιμές)

| Τιμή | i18n Key | Περιγραφή |
|------|----------|-----------|
| `available` | `parking.status.available` | Διαθέσιμη |
| `occupied` | `parking.status.occupied` | Κατειλημμένη |
| `reserved` | `parking.status.reserved` | Κρατημένη |
| `sold` | `parking.status.sold` | Πωλημένη |
| `maintenance` | `parking.status.maintenance` | Σε συντήρηση |

### 5.3 ParkingLocationZone (5 ��ιμές)

| Τιμή | i18n Key | ADR-233 Code | Περιγραφή |
|------|----------|--------------|-----------|
| `pilotis` | `parking.locationZone.pilotis` | PY | Πιλοτή |
| `underground` | `parking.locationZone.underground` | PK | Υπόγειο |
| `open_space` | `parking.locationZone.open_space` | PY | Ανοιχτός χώρος |
| `rooftop` | `parking.locationZone.rooftop` | PY | Ταράτσα |
| `covered_outdoor` | `parking.locationZone.covered_outdoor` | PY | Στεγασμένο υπαίθριο |

### 5.4 SpaceCommercialStatus (4 τιμές — shared with Storage)

| Τιμή | Περιγραφή |
|------|-----------|
| `unavailable` | Μη διαθέσιμη προς πώληση |
| `for-sale` | Προς πώλη��η |
| `reserved` | Κρατημένη (με προκαταβολή) |
| `sold` | Πωλημένη |

---

## 6. Σχέσεις με ΟΛΕΣ τις Οντότητες (Relationship Map)

### 6.1 Διάγραμμα Σχέσεων

```
                        ┌─────────────────┐
                        │   PARKING SPOT  │
                        │ (parking_spots) │
                        └────────┬��───────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
  ┌─���───┴─────┐          ┌────��─┴──────┐          ┌──────┴──────┐
  │ ΑΚΙΝΗΤΑ   │          │ ΠΩΛΗΣΕΙΣ    │          │ ΑΝΑΖΗΤΗΣΗ   │
  │           │          │             │          │             │
  ├───────────┤          ├────────���────┤          ├───────────���─┤
  │ projects  │          │ units       │          │ search_     │
  │ buildings │          │ (linkedSp.) │          │  documents  │
  │ floors    │          │ contacts    │          └───────���─────┘
  │ companies │          │ (buyer)     │
  │ (linked)  │          │ ownership_  │
  └───────────┘          │  tables     │
                         │ contact_    │
                         │  links      │
                         └──────────���──┘
```

### 6.2 Αναλυτικός Πίνακας Σχέσεων

| # | Collection | Πεδίο(α) σύνδεσης | Σχέση | Ρόλος Parking | Περιγραφ�� |
|---|------------|-------------------|-------|---------------|-----------|
| 1 | **projects** | `parking.projectId` → `projects.id` | N:1 | Θέση → Έργο | Κάθε θέση ανήκει σε ένα έργο |
| 2 | **buildings** | `parking.buildingId` → `buildings.id` | N:1 | Θέση → Κτίριο | Κτίριο θέσης (null = open space) |
| 3 | **floors** | `parking.floorId` → `floors.id` | N:1 | Θέση → Όροφος | Όροφος/επίπεδο θέσης |
| 4 | **contacts** | `parking.commercial.buyerContactId` → `contacts.id` | N:1 | Θέση → Αγοραστής | Ποιος αγόρασε τη θέση (ADR-199) |
| 5 | **companies** (tenant) | `parking.companyId` → `companies.id` | N:1 | Θέση → Εταιρεία | Tenant isolation (ADR-029) |
| 6 | **companies** (linked) | `parking.linkedCompanyId` → `contacts.id` | N:1 | Θέση → Κατασκευαστής | ADR-232: Business entity link (cascade) |
| 7 | **units** | `units.linkedSpaces[].spaceId` = `parking.id` WHERE `spaceType='parking'` | N:M | Θέση ← Μονάδα | Παρακολούθημα μονάδας (unit → parking allocation) |
| 8 | **ownership_tables** | `rows[].linkedSpacesSummary[].spaceId` = `parking.id` WHERE `spaceType='parking'` | N:M | Θέση ← Πίνακας χιλιοστών | Εμφανίζεται ως child branch στο tree (ΟΧΙ standalone row) |
| 9 | **contact_links** | `contact_links.targetEntityId` = `parking.id` | 1:N | Θέση ← Επαφή | Σύνδεση επαφών με θέση (deletion dependency) |
| 10 | **search_documents** | `search_documents.entityId` = `parking.id` | 1:1 | Θέση → Search index | Global search (ADR-029), cascade delete |
| 11 | **entity_links** | `sourceEntityId` / `targetEntityId` = `parking.id` | N:M | Θέση ↔ Μονάδα/Αποθήκη | Associations system (ADR-032), allocation metadata |

### 6.3 Σχέσεις μέσω Deletion Registry

Από `src/config/deletion-registry.ts`:

| Κατηγορία | Collection | Foreign Key | Τύπος |
|-----------|-----------|-------------|-------|
| **Cascade** | `search_documents` | `entityId` | Αυτόματη διαγραφή |
| **Blocking** | `contact_links` | `targetEntityId` | Αποτρέπει διαγραφή |
| **Conditional Block** | — | `commercial.buyerContactId` | Αν not-null → "Η θέση έχει πωληθεί" |

---

## 7. Report Builder Impact — Τι σημαίνει αυτό για τα Domains

### 7.1 Domain A4 (Θέσεις Στάθμευσης) — Ενημερωμένες Στήλες

Βάσει πλήρους χαρτογράφησης, το SPEC-001 domain A4 πρέπει να επεκταθεί:

**Tier 1 (Flat Table) — Primary columns:**

| Στήλη | Πεδίο | Τύπος | Σημείω��η |
|-------|-------|-------|----------|
| Αριθμός | `number` | text | Display code, π.χ. "P-001" |
| Κωδικός | `code` | text | ADR-233 code, π.χ. "A-PK-Y1.01" |
| Τύπος | `type` | enum | 5 τιμές (standard, handicapped, κλπ) |
| Κατάσταση | `status` | enum | 5 τιμές (available, sold, κλπ) |
| Ζώνη | `locationZone` | enum | 5 τιμές (pilotis, underground, κλπ) |
| Όροφος | `floor` | text | "-1", "0", "pilotis" |
| Τοποθεσία | `location` | text | Freeform |
| Εμβαδόν (m²) | `area` | number | |
| Τιμή (€) | `price` | number | |
| Χιλιοστά | `millesimalShares` | number | 0=κοινόχρηστο, >0=αυτοτελές |
| Εμπ. Κατάσταση | `commercialStatus` | enum | ADR-199 sales status |
| Ζητούμενη Τιμή | `commercial.askingPrice` | currency | |
| Τελική Τιμή | `commercial.finalPrice` | currency | |
| Αγοραστής | `commercial.buyerName` | text | Denormalized |
| Κράτηση (€) | `commercial.reservationDeposit` | currency | |
| Σημειώσεις | `notes` | text | |
| Ημ/νία Δημιουργίας | `createdAt` | date | |

**Tier 1 — Computed/Joined columns (cross-entity):**

| Στήλη | Join | Τύπος | Σημείωση |
|-------|------|-------|----------|
| Έργο | JOIN projects ON projectId | text | Όνομα έργου |
| Κτίριο | JOIN buildings ON buildingId | text | Όνομα κτιρίου (ή "—" αν open space) |
| Αγοραστής (πλήρης) | JOIN contacts ON commercial.buyerContactId | text | Πλήρες όνομα (fallback: buyerName) |
| Κατασκευαστής | JOIN contacts ON linkedCompanyId | text | ADR-232 business entity |
| Συνδ. Μονάδες | COUNT units WHERE linkedSpaces[].spaceId = id | number | Πόσες μονάδες χρησιμοποιούν τη θέση |
| Κωδ. Μονάδας | JOIN units WHERE linkedSpaces[].spaceId = id → code | text | Κωδικός parent unit (αν ένα) |
| Συνδ. Επαφές | COUNT contact_links WHERE targetEntityId | number | |
| Αυτοτελής | computed: millesimalShares > 0 | boolean | Αν πωλείται αυτοτελώς |

### 7.2 Tier 2 (Row Repetition) — Arrays που χρειάζονται expansion

Η θέση στάθμευσης ΔΕΝ έχει nested arrays στο ίδιο document.

Τα μοναδικά arrays προέρχονται από **cross-entity joins**:

| Πηγή | Πεδία ανά row | Μέγιστο πλήθος | Σημείωση |
|------|---------------|----------------|----------|
| `units.linkedSpaces[]` (reverse) | unitCode, unitType, inclusion, allocationCode | ~3 | Μονάδες που χρησιμοποιούν τη θέση |
| `contact_links` | contactName, role, reason | ~5 | Συνδεδεμένες επαφές |
| `ownership_tables.rows[].linkedSpacesSummary[]` (reverse) | entityCode, floor, areaSqm | ~1 | Εμφάνιση στον πίνακα χιλιοστών |

### 7.3 Tier 3 (Parking Spot Card PDF) — Sections

```
┌─────────────────────────────────────────┐
│ [P-001] ΘΕΣΗ ΣΤΑΘΜΕΥΣΗΣ               │
│ Κωδικός: A-PK-Y1.01 | Status          │
├─────────────────────────────────────────┤
│ ΤΟΠΟΘΕΣΙΑ                               │
│ Έργο | Κτίριο | Όροφος | Ζώνη         │
│ Τοποθεσία (freeform)                   │
├─────��───────────────────────────────────┤
│ ΧΑΡΑΚΤΗΡΙΣΤΙΚΑ                          │
│ Τύπος | Εμβαδόν | Χιλιοστά            │
├───���─────────────────────────���───────────┤
│ ΕΜΠΟΡΙΚΑ ΣΤΟΙΧΕΙΑ (αν for-sale/sold)    │
│ Ζητούμενη Τιμή | Τελική Τιμή          │
│ Αγοραστής | Κράτηση | Ημ/νία          │
├─────────────────────���───────────────────┤
│ ΣΥΝΔΕΣΕΙΣ                               │
│ Μονάδα: [κωδικός μονάδας, inclusion]   │
│ Επαφές: [πίνακας contact_links]        │
├─────────────────────────────────────────┤
│ ΣΗΜΕΙΩΣΕΙΣ                              │
│ [notes]                                │
└───────���───────────────────��─────────────┘
```

---

## 8. Ειδικές Σημειώσεις Αρχιτεκτονικής

### 8.1 ADR-199: Sales Appurtenance

Η θέση στάθμευσης μπορεί να πωληθεί ως:
- **Παρακολούθημα μονάδας** (millesimalShares = 0): ακολουθεί τη μονάδα, ΔΕΝ εμφανίζεται standalone στον πίνακα χιλιοστών
- **Αυτοτελής** (millesimalShares > 0): έχει δικά της χιλιοστά, εμφανίζεται ως standalone row στον πίνακα χιλιοστών

Helper: `canSellIndependently(millesimalShares)` → `sales-shared.ts`

### 8.2 ADR-233: Entity Code System

Format: `{Building}-{PK|PY}-{Floor}.{Seq}`
- PK = underground (κλειστό parking)
- PY = pilotis, open_space, rooftop, covered_outdoor (υπαίθριο)
- Config: `src/config/entity-code-config.ts` → `PARKING_ZONE_TO_CODE`

### 8.3 Unit ↔ Parking Allocation

Η σύνδεση γίνεται μέσω `units.linkedSpaces[]` array (ADR-032 Associations system):

```typescript
interface LinkedSpace {
  spaceId: string;              // parking doc ID
  spaceType: 'parking' | 'storage';
  quantity: number;
  inclusion: SpaceInclusionType; // 'included' | 'optional' | 'separate'
  allocationCode?: string;       // "P-101"
}
```

**TODO (ADR-AUDIT)**: Δεν υπάρχει denormalized `linkedUnitId` στο parking document — ο reverse lookup απαιτεί query σε `units` collection.

### 8.4 Ownership Table Integration

Στον πίνακα χιλιοστών (`ownership_tables`), η θέση εμφανίζεται ως `LinkedSpaceDetail` child branch:
- `participatesInCalculation = false` (πάντα — parking ΔΕΝ συμμετέχει στον υπολογισμό)
- `hasOwnShares = false` (πάντα — σε αντίθεση με storage που μπορεί να έχει)

### 8.5 Semantic Colors

Deprecated static map στο `types/parking.ts` → χρησιμοποίησε `useSemanticColors().getParkingStatusClass(status)`.

---

## 9. Στατιστικά

| Μέτρηση | Τιμή |
|---------|------|
| Πεδία direct (ParkingSpot) | 22 |
| Πεδία nested (commercial) | 6 |
| Enums | 4 (type, status, locationZone, commercialStatus) |
| Enum τιμές (σύνολο) | 19 |
| Subcollections | 0 |
| Cross-entity references | 11 collections |
| Tier 1 flat columns | 17 |
| Tier 1 computed/joined columns | 8 |
| Tier 2 expansion sources | 3 (from cross-entity joins) |
| **Σύνολο πεδίων (πλήρης θέση)** | **~28 direct + 6 nested = ~34** |
