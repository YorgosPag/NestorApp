# SPEC-019: Πλήρης Χαρτογράφηση — Πίνακας Χιλιοστών (Ownership Tables)

**ADR**: 268 — Dynamic Report Builder
**Version**: 1.1
**Last Updated**: 2026-03-30
**Source of Truth**: Κώδικας (`src/types/ownership-table.ts`, `src/services/ownership/`)

---

## 1. Ταυτότητα Οντότητας

| Στοιχείο | Τιμή |
|----------|------|
| **Collection** | `ownership_tables` |
| **TypeScript** | `OwnershipPercentageTable` (readonly), `MutableOwnershipPercentageTable` (editing) |
| **ID Pattern** | Deterministic: `ownership_{projectId}` (1:1 per project, NOT enterprise-id) |
| **Tenant Isolation** | Via `projectId` → project.linkedCompanyId (indirect) |
| **Subcollection** | `ownership_tables/{tableId}/revisions` (`OwnershipTableRevision`) |
| **Service** | `src/services/ownership/ownership-table-service.ts` (CRUD) |
| **Calculation Engine** | `src/services/ownership/ownership-calculation-engine.ts` (3 μέθοδοι) |
| **Config** | `src/components/projects/tabs/ownership-table-config.ts` (columns, helpers) |
| **ADR** | ADR-235 (Πίνακας Ποσοστών Συνιδιοκτησίας) |

### 1.1 Νομοθετικό Πλαίσιο

| Νόμος | Περιγραφή |
|-------|-----------|
| **Ν. 3741/1929** | Οριζόντια & Κάθετη Ιδιοκτησία |
| **ΠΟΛ 1149/1994** | Συντελεστές Ορόφου (ΑΑΔΕ) — 2 πίνακες (Α: ΣΕ<1.5, Β: ΣΕ≥1.5) |
| **ΑΚ 1002-1117** | Συνιδιοκτησία, χιλιοστά, κοινόχρηστα |

---

## 2. Πλήρης Κατάλογος Πεδίων — OwnershipPercentageTable

### 2.1 Ταυτότητα & Μεταδεδομένα

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string (readonly) | Yes | Document ID: `ownership_{projectId}` |
| 2 | `projectId` | string (readonly) | Yes | Reference → projects (1:1 αντιστοιχία) |
| 3 | `buildingIds` | ReadonlyArray\<string\> | Yes | Κτήρια που συμμετέχουν (κάθετη ιδιοκτησία = πολλά) |
| 4 | `status` | `OwnershipTableStatus` | Yes | `draft` / `finalized` / `registered` |
| 5 | `version` | number (readonly) | Yes | Τρέχουσα έκδοση (αυξάνεται σε κάθε finalize→draft cycle) |
| 6 | `createdAt` | Timestamp (readonly) | Yes | Ημ/νία δημιουργίας |
| 7 | `updatedAt` | Timestamp (readonly) | Yes | Τελευταία ενημέρωση |

### 2.2 Παράμετροι Υπολογισμού

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 8 | `calculationMethod` | `CalculationMethod` | Yes | `area` (κατ' εμβαδόν) / `value` (κατ' αντικειμενική αξία, ΠΟΛ 1149) / `volume` (κατ' όγκον) |
| 9 | `zonePrice` | number (readonly) | Yes | Τιμή ζώνης (€/τ.μ.) — χειροκίνητη εισαγωγή από μηχανικό |
| 10 | `commercialityCoefficient` | number (readonly) | Yes | Συντελεστής Εμπορικότητας (ΣΕ) — καθορίζει Πίνακα Α ή Β |

### 2.3 Αθροίσματα & Σύνοψη

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 11 | `totalShares` | number (readonly) | Yes | Σύνολο χιλιοστών — **ΠΡΕΠΕΙ = 1000** |
| 12 | `summaryByCategory.main.count` | number (readonly) | Yes | Πλήθος κύριων ιδιοκτησιών |
| 13 | `summaryByCategory.main.shares` | number (readonly) | Yes | Χιλιοστά κύριων |
| 14 | `summaryByCategory.auxiliary.count` | number (readonly) | Yes | Πλήθος βοηθητικών |
| 15 | `summaryByCategory.auxiliary.shares` | number (readonly) | Yes | Χιλιοστά βοηθητικών |

### 2.4 Νομικά Στοιχεία

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 16 | `notes` | string \| null (readonly) | No | Σημειώσεις (ελεύθερο κείμενο) |
| 17 | `deedNumber` | string \| null (readonly) | No | Αριθμός πράξης σύστασης (notarial deed) |
| 18 | `notary` | string \| null (readonly) | No | Συμβολαιογράφος σύστασης |
| 19 | `kaekCodes` | ReadonlyArray\<string\> \| null | No | Κωδικοί ΚΑΕΚ (Κτηματολόγιο) |

---

## 3. Nested Objects / Arrays

### 3.1 `rows[]` — OwnershipTableRow

Κάθε row = 1 αυτοτελής ιδιοκτησία (μονάδα, parking, αποθήκη, ή δικαίωμα αέρα).

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 20 | `ordinal` | number (readonly) | Yes | Αύξων αριθμός στον πίνακα |
| 21 | `buildingId` | string (readonly) | Yes | Reference → buildings (ομαδοποίηση) |
| 22 | `buildingName` | string (readonly) | Yes | Denormalized — εμφάνιση στον πίνακα |
| 23 | `entityRef.collection` | `OwnershipEntityCollection` | Yes | `units` / `parking_spots` / `storage_units` |
| 24 | `entityRef.id` | string (readonly) | Yes | Document ID οντότητας |
| 25 | `entityCode` | string (readonly) | Yes | Κωδικός (π.χ. "A1-01", "P-B1-03") |
| 26 | `description` | string (readonly) | Yes | Περιγραφή ιδιοκτησίας |
| 27 | `category` | `PropertyCategory` | Yes | `main` (κύρια) / `auxiliary` (βοηθητική) / `air_rights` (δικαιώματα αέρα) |
| 28 | `floor` | string (readonly) | Yes | Όροφος (text — "Ισόγειο", "1ος", κλπ) |
| 29 | `areaNetSqm` | number (readonly) | Yes | Καθαρό εμβαδόν (τ.μ.) |
| 30 | `areaSqm` | number (readonly) | Yes | Μικτό εμβαδόν (τ.μ.) — χρησιμοποιείται στον υπολογισμό |
| 31 | `heightM` | number \| null (readonly) | No | Ύψος ορόφου (μ.) — μόνο Μέθοδος Γ (Κατ' Όγκον) |
| 32 | `millesimalShares` | number (readonly) | Yes | Χιλιοστά οικοπέδου (‰) — **ΑΚΕΡΑΙΟΣ** |
| 33 | `isManualOverride` | boolean (readonly) | Yes | Χειροκίνητα τροποποιημένα χιλιοστά (ο μηχανικός τα άλλαξε) |
| 34 | `participatesInCalculation` | boolean (readonly) | Yes | Αν συμμετέχει στον υπολογισμό (false = ενημερωτικό, π.χ. parking) |
| 35 | `ownerParty` | `OwnerParty` | Yes | `contractor` / `landowner` / `buyer` / `unassigned` |
| 36 | `buyerContactId` | string \| null (readonly) | No | Contact ID αγοραστή (αν πωλήθηκε) |
| 37 | `buyerName` | string \| null (readonly) | No | Denormalized — ονοματεπώνυμο αγοραστή |
| 38 | `preliminaryContract` | string \| null (readonly) | No | Αριθμός προσυμφώνου |
| 39 | `finalContract` | string \| null (readonly) | No | Αριθμός οριστικού συμβολαίου |

### 3.2 `rows[].coefficients` — CalculationCoefficients

Ενεργό **μόνο** σε Μέθοδο Β (Κατ' Αντικειμενική Αξία). `null` για μεθόδους Α, Γ.

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 40 | `coefficients.floorCoefficient` | number (readonly) | Yes* | Συντελεστής ορόφου (ΠΟΛ 1149/1994) |
| 41 | `coefficients.valueCoefficient` | number (readonly) | Yes* | Συντελεστής αξίας (πρόσοψη, θέα, φωτισμός) — default 1.0 |

### 3.3 `rows[].linkedSpacesSummary[]` — LinkedSpaceDetail

Παρακολουθήματα (parking/storage) που ανήκουν στη μονάδα. Εμφανίζονται ως tree-branches κάτω από τη γονική μονάδα.

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 42 | `spaceId` | string (readonly) | Yes | Document ID parking/storage |
| 43 | `entityCode` | string (readonly) | Yes | Κωδικός (π.χ. "A-PK-0.02", "ΑΠΟΘΗΚΗ 1") |
| 44 | `spaceType` | `'parking'` \| `'storage'` | Yes | Τύπος χώρου |
| 45 | `description` | string (readonly) | Yes | Περιγραφή |
| 46 | `floor` | string (readonly) | Yes | Όροφος |
| 47 | `areaNetSqm` | number (readonly) | Yes | Καθαρό εμβαδόν (τ.μ.) |
| 48 | `areaSqm` | number (readonly) | Yes | Μικτό εμβαδόν (τ.μ.) |
| 49 | `hasOwnShares` | boolean (readonly) | Yes | Αυτοτελή χιλιοστά (true = δικά της χιλιοστά στον πίνακα, false = ακολουθεί μονάδα). Parking = πάντα false. |
| 50 | `millesimalShares` | number (readonly) | Yes | Χιλιοστά — ενεργό μόνο αν `hasOwnShares = true` |

### 3.4 `bartex` — BartexSummary

Σενάριο αντιπαροχής. `null` αν δεν ισχύει (π.χ. αυτοχρηματοδοτούμενο έργο).

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 51 | `bartex.bartexPercentage` | number (readonly) | Yes* | Ποσοστό αντιπαροχής (%) — π.χ. 40 = 40% στους οικοπεδούχους |
| 52 | `bartex.contractorShares` | number (readonly) | Yes* | Σύνολο χιλιοστών εργολάβου |
| 53 | `bartex.totalLandownerShares` | number (readonly) | Yes* | Σύνολο χιλιοστών ΟΛΩΝ των οικοπεδούχων |
| 54 | `bartex.contractorPropertyCount` | number (readonly) | Yes* | Πλήθος ιδιοκτησιών εργολάβου |
| 55 | `bartex.landownerPropertyCount` | number (readonly) | Yes* | Πλήθος ιδιοκτησιών οικοπεδούχων |

### 3.5 `bartex.landowners[]` — LandownerEntry

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 56 | `contactId` | string (readonly) | Yes | Contact ID οικοπεδούχου |
| 57 | `name` | string (readonly) | Yes | Ονοματεπώνυμο |
| 58 | `landOwnershipPct` | number (readonly) | Yes | Ποσοστό ιδιοκτησίας οικοπέδου (π.χ. 33.33 για 1/3) |
| 59 | `allocatedShares` | number (readonly) | Yes | Χιλιοστά που αναλογούν (υπολογίζεται αυτόματα) |

---

## 4. Subcollections

### 4.1 Revisions — `ownership_tables/{tableId}/revisions`

Immutable snapshots κάθε φορά που γίνεται finalize. Version history.

**TypeScript**: `OwnershipTableRevision` (`src/types/ownership-table.ts`)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 60 | `id` | string (readonly) | Yes | Revision document ID |
| 61 | `version` | number (readonly) | Yes | Αριθμός έκδοσης (1, 2, 3...) |
| 62 | `snapshot` | Omit\<OwnershipPercentageTable, 'id' \| 'version'\> | Yes | Πλήρες snapshot πίνακα τη στιγμή του finalize |
| 63 | `finalizedBy` | string (readonly) | Yes | User ID που έκανε finalize |
| 64 | `finalizedAt` | Timestamp (readonly) | Yes | Πότε έγινε finalize |
| 65 | `changeReason` | string \| null (readonly) | No | Λόγος αλλαγής (αν ξεκλειδώθηκε) |

---

## 5. Σχέσεις με ΟΛΕΣ τις Οντότητες (Relationship Map)

### 5.1 Διάγραμμα Σχέσεων

```
                    ┌─────────────────────┐
                    │   OWNERSHIP TABLE   │
                    │  (ownership_tables) │
                    │   1:1 per project   │
                    └──────────┬──────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
  ┌─────┴─────┐         ┌──────┴──────┐        ┌─────┴──────┐
  │ ΙΕΡΑΡΧΙΑ  │         │ ΑΚΙΝΗΤΑ     │        │ ΑΝΘΡΩΠΟΙ   │
  │           │         │ (via rows[])│        │            │
  ├───────────┤         ├─────────────┤        ├────────────┤
  │ projects  │         │ units       │        │ contacts   │
  │ buildings │         │ parking_    │        │ (buyer)    │
  │           │         │  spots      │        │ contacts   │
  │           │         │ storage_    │        │ (landowner)│
  │           │         │  units      │        └────────────┘
  └───────────┘         └─────────────┘
        │
  ┌─────┴─────┐
  │ REVISION  │
  │ HISTORY   │
  ├───────────┤
  │ revisions │
  │ (subcol)  │
  └───────────┘
```

### 5.2 Αναλυτικός Πίνακας Σχέσεων

| # | Collection | Πεδίο(α) σύνδεσης | Σχέση | Περιγραφή |
|---|------------|-------------------|-------|-----------|
| 1 | **projects** | `table.projectId` → `project.id` | **1:1** | ΕΝΑΣ πίνακας ανά έργο/οικόπεδο |
| 2 | **buildings** | `table.buildingIds[]` → `building.id` | 1:N | Κτήρια που περιλαμβάνει (κάθετη ιδιοκτησία) |
| 3 | **buildings** | `rows[].buildingId` → `building.id` | N:1 | Ομαδοποίηση rows ανά κτήριο |
| 4 | **units** | `rows[].entityRef` WHERE `collection='units'` | 1:N | Μονάδες στον πίνακα ως κύριες ιδιοκτησίες |
| 5 | **parking_spots** | `rows[].entityRef` WHERE `collection='parking_spots'` | 1:N | Parking — standalone (σπάνια) ή ως linkedSpace |
| 6 | **storage_units** | `rows[].entityRef` WHERE `collection='storage_units'` | 1:N | Αποθήκες — standalone ή ως linkedSpace |
| 7 | **parking_spots** | `rows[].linkedSpacesSummary[]` WHERE `spaceType='parking'` | N:M | Parking ως παρακολουθήματα μονάδων |
| 8 | **storage_units** | `rows[].linkedSpacesSummary[]` WHERE `spaceType='storage'` | N:M | Αποθήκες ως παρακολουθήματα μονάδων |
| 9 | **contacts** | `rows[].buyerContactId` → `contact.id` | N:M | Αγοραστής/ιδιοκτήτης μονάδας |
| 10 | **contacts** | `bartex.landowners[].contactId` → `contact.id` | N:M | Οικοπεδούχοι (ADR-244) |
| 11 | **projects** | `bartex.landowners[]` ↔ `project.landowners[]` | Cross-ref | SSoT αντιπαροχής — τα landowners ορίζονται στο Project |
| 12 | **units** | `unit.millesimalShares` ← `rows[].millesimalShares` | Denorm | Αυτόματη ενημέρωση χιλιοστών κατά finalize |
| 13 | **revisions** (subcol) | `ownership_tables/{id}/revisions` | 1:N | Immutable version history |

### 5.3 Σχέση with Floor Coefficient Tables

| Πίνακας | Condition | Χρήση |
|---------|-----------|-------|
| **FLOOR_COEFFICIENTS_TABLE_A** | ΣΕ < 1.5 (Κατοικίες — χαμηλή εμπορικότητα) | Μέθοδος Β |
| **FLOOR_COEFFICIENTS_TABLE_B** | ΣΕ ≥ 1.5 (Καταστήματα — υψηλή εμπορικότητα) | Μέθοδος Β |

**Πίνακας Α (ΣΕ < 1.5):**

| Όροφος | Συντελεστής |
|--------|-------------|
| Υπόγειο | 0.60 |
| Ισόγειο | 0.90 |
| 1ος | 1.00 |
| 2ος | 1.05 |
| 3ος | 1.10 |
| 4ος | 1.15 |
| 5ος+ | 1.20 |

**Πίνακας Β (ΣΕ ≥ 1.5):**

| Όροφος | Συντελεστής |
|--------|-------------|
| Υπόγειο | 0.60 |
| Ισόγειο | 1.20 |
| 1ος | 1.10 |
| 2ος | 1.05 |
| 3ος | 1.10 |
| 4ος | 1.15 |
| 5ος+ | 1.20 |
| 6ος+ | 1.25 |

### 5.4 3 Μέθοδοι Υπολογισμού Χιλιοστών

| Μέθοδος | Τύπος | Πότε χρησιμοποιείται |
|---------|-------|---------------------|
| **Α: Κατ' Εμβαδόν** | shares = (area / totalArea) × 1000 | Απλός αναλογικός — ίδια αξία ανά τ.μ. |
| **Β: Κατ' Αντικειμ. Αξία** | shares = (area × floorCoeff × valueCoeff) / total × 1000 | Πιο ακριβής — ΠΟΛ 1149/1994, ΣΕ, θέα/πρόσοψη |
| **Γ: Κατ' Όγκον** | shares = (area × height / totalVolume) × 1000 | Σπάνια — βιομηχανικά/εμπορικά |

**Rounding**: Largest Remainder Method (Hamilton) → **ΠΑΝΤΑ σύνολο = 1000** ακριβώς.

---

## 6. Report Builder Impact — Τι σημαίνει αυτό για τα Domains

### 6.0 Αρχιτεκτονική Απόφαση: Δύο Ξεχωριστά Domains (2026-03-30)

**Απόφαση**: Ο Πίνακας Χιλιοστών γίνεται **2 ξεχωριστά domains** στο Report Builder:

| Domain | ID | Grain | 1 row = |
|--------|----|-------|---------|
| **C7a: Ownership Summary** | `ownership_summary` | Table-level | 1 πίνακας χιλιοστών (per project) |
| **C7b: Ownership Detail** | `ownership_detail` | Row-level | 1 ιδιοκτησία (unit/parking/storage) |

**Λόγοι (Enterprise Data Modeling — Kimball Grain Consistency)**:
1. **SAP Pattern**: ME2M (PO headers) ≠ ME2L (PO line items) — ξεχωριστά reports ανά grain
2. **Oracle ERP**: Separate "Summary" / "Detail" report objects σε κάθε module
3. **Procore**: Budget Summary ≠ Budget Detail — δύο ξεχωριστά views
4. **Google BigQuery/Looker**: Separate fact tables ανά grain level (Kimball dimensional modeling)
5. **Grain mixing = broken aggregations**: Αν αναμείξεις 1 table-level row + 200 row-level rows, τα SUM/AVG/GROUP BY δίνουν λάθος αποτελέσματα

**Υλοποίηση**:
- C7a: Query `ownership_tables` collection, expose table-level + summary fields
- C7b: Query `ownership_tables` collection, **flatten `rows[]`** array → 1 result row per `OwnershipTableRow`
- C7b χρειάζεται **row expansion** στον executor (ίδιο pattern με Tier 2 row repetition)

---

### 6.1 Domain C7a (Ownership Summary) — Table-Level Columns

**Tier 1 (Flat Table) — Primary columns (Table Level):**

| Στήλη | Πεδίο | Τύπος | Σημείωση |
|-------|-------|-------|----------|
| Έργο | `projectId` (join → project.name) | text | |
| Status | `status` | enum | draft/finalized/registered |
| Μέθοδος | `calculationMethod` | enum | area/value/volume |
| Τιμή Ζώνης | `zonePrice` | currency | €/τ.μ. |
| ΣΕ | `commercialityCoefficient` | number | Συντελ. Εμπορικότητας |
| Σύνολο Χιλιοστών | `totalShares` | number | Πρέπει = 1000 |
| Κύριες (πλήθος) | `summaryByCategory.main.count` | number | |
| Κύριες (‰) | `summaryByCategory.main.shares` | number | |
| Βοηθητικές (πλήθος) | `summaryByCategory.auxiliary.count` | number | |
| Βοηθητικές (‰) | `summaryByCategory.auxiliary.shares` | number | |
| Αρ. Πράξης | `deedNumber` | text | |
| Συμβολαιογράφος | `notary` | text | |
| ΚΑΕΚ | `kaekCodes` (join) | text | Comma-separated |
| Κτήρια | `buildingIds.length` | number | Πόσα κτήρια |
| Εγγραφές | `rows.length` | number | Πόσες γραμμές |
| Έκδοση | `version` | number | |
| Αντιπαροχή | `bartex !== null` | boolean | Αν ισχύει |
| % Αντιπαροχής | `bartex.bartexPercentage` | number | Ποσοστό |

**Tier 1 — Computed/Joined columns (cross-entity):**

| Στήλη | Join | Τύπος | Σημείωση |
|-------|------|-------|----------|
| Αρ. Πωληθέντων | COUNT rows WHERE buyerContactId != null | number | |
| Αρ. Αδιάθετων | COUNT rows WHERE ownerParty = 'contractor' AND buyerContactId = null | number | |
| Χιλιοστά Εργολάβου | `bartex.contractorShares` | number | |
| Χιλιοστά Οικοπ/χων | `bartex.totalLandownerShares` | number | |
| Αρ. Οικοπεδούχων | `bartex.landowners.length` | number | |
| Αρ. Αναθεωρήσεων | COUNT revisions subcollection | number | |
| Σύν. Μικτό Εμβαδόν | SUM rows[].areaSqm | number | τ.μ. |
| Σύν. Καθαρό Εμβαδόν | SUM rows[].areaNetSqm | number | τ.μ. |
| Μέσος Χιλιοστών/Row | AVG rows[].millesimalShares | number | |
| Manual Overrides | COUNT rows WHERE isManualOverride | number | |

### 6.2 Domain C7b (Ownership Detail) — Row-Level Columns

**1 row = 1 OwnershipTableRow** (ιδιοκτησία). Flatten μέσω row expansion στον executor:

| Στήλη | Πεδίο | Τύπος | Σημείωση |
|-------|-------|-------|----------|
| Α/Α | `ordinal` | number | |
| Κτήριο | `buildingName` | text | |
| Κωδικός | `entityCode` | text | |
| Περιγραφή | `description` | text | |
| Κατηγορία | `category` | enum | main/auxiliary/air_rights |
| Collection | `entityRef.collection` | enum | units/parking_spots/storage_units |
| Όροφος | `floor` | text | |
| Εμβαδόν (μικτό) | `areaSqm` | number | τ.μ. |
| Εμβαδόν (καθαρό) | `areaNetSqm` | number | τ.μ. |
| Ύψος | `heightM` | number | μ. (μόνο Μέθοδος Γ) |
| Χιλιοστά | `millesimalShares` | number | ‰ |
| Manual Override | `isManualOverride` | boolean | |
| Συμμετέχει | `participatesInCalculation` | boolean | |
| Ιδιοκτήτης | `ownerParty` | enum | contractor/landowner/buyer/unassigned |
| Αγοραστής | `buyerName` | text | |
| Προσύμφωνο | `preliminaryContract` | text | |
| Οριστικό | `finalContract` | text | |
| Συντ. Ορόφου | `coefficients.floorCoefficient` | number | Μόνο Μέθοδος Β |
| Συντ. Αξίας | `coefficients.valueCoefficient` | number | Μόνο Μέθοδος Β |
| Παρακολουθήματα | COUNT linkedSpacesSummary | number | |

### 6.3 Tier 2 (Row Repetition) — Arrays που χρειάζονται expansion

| Array | Πεδία ανά row | Μέγιστο πλήθος |
|-------|---------------|----------------|
| `rows[]` | ordinal, buildingName, entityCode, category, areaSqm, millesimalShares, ownerParty, buyerName | ~50-200 |
| `rows[].linkedSpacesSummary[]` | spaceType, entityCode, areaSqm, hasOwnShares, millesimalShares | ~5 per row |
| `bartex.landowners[]` | name, landOwnershipPct, allocatedShares | ~5 |
| `buildingIds[]` | building ID (join → name) | ~10 |
| `kaekCodes[]` | KAEK code | ~10 |

### 6.4 Tier 3 (Ownership Table Card PDF) — Sections

```
┌─────────────────────────────────────────┐
│ ΠΙΝΑΚΑΣ ΠΟΣΟΣΤΩΝ ΣΥΝΙΔΙΟΚΤΗΣΙΑΣ        │
│ Έργο: [project name]                   │
│ Status: [draft/finalized/registered]    │
│ Έκδοση: [version] | Ημ/νία: [date]    │
├─────────────────────────────────────────┤
│ ΠΑΡΑΜΕΤΡΟΙ ΥΠΟΛΟΓΙΣΜΟΥ                   │
│ Μέθοδος: [area/value/volume]            │
│ Τιμή Ζώνης: €XX/τ.μ. | ΣΕ: X.XX      │
│ Πίνακας Συντελεστών: [A/B]             │
├─────────────────────────────────────────┤
│ ΚΤΗΡΙΑ                                   │
│ [πίνακας: Κτήριο A, Κτήριο B, ...]     │
├─────────────────────────────────────────┤
│ ΠΙΝΑΚΑΣ ΙΔΙΟΚΤΗΣΙΩΝ                      │
│ ┌─────┬────────┬────────┬──────┬──────┐ │
│ │ Α/Α │ Κωδικός│ Κτήριο │ τ.μ. │  ‰   │ │
│ ├─────┼────────┼────────┼──────┼──────┤ │
│ │  1  │ A1-01  │ Κτ. Α  │ 85.2 │  42  │ │
│ │  ├─ │ P-101  │ parking │  12  │  --  │ │
│ │  ├─ │ S-01   │ storage │   8  │   4  │ │
│ │  2  │ A1-02  │ Κτ. Α  │ 72.0 │  36  │ │
│ │ ... │  ...   │  ...   │ ...  │ ...  │ │
│ ├─────┼────────┼────────┼──────┼──────┤ │
│ │     │ ΣΥΝΟΛΟ │        │XXXX  │ 1000 │ │
│ └─────┴────────┴────────┴──────┴──────┘ │
├─────────────────────────────────────────┤
│ ΣΥΝΟΨΗ ΑΝΑ ΚΑΤΗΓΟΡΙΑ                    │
│ Κύριες: XX ιδιοκτησίες, YYY‰           │
│ Βοηθητικές: XX, ZZZ‰                   │
│ Σύνολο: 1000‰                           │
├─────────────────────────────────────────┤
│ ΑΝΤΙΠΑΡΟΧΗ (αν ισχύει)                  │
│ Ποσοστό: XX% | Εργολάβος: YYY‰         │
│ Οικοπεδούχοι:                           │
│ [πίνακας: Όνομα, %, Χιλιοστά]          │
├─────────────────────────────────────────┤
│ ΝΟΜΙΚΑ ΣΤΟΙΧΕΙΑ                          │
│ Πράξη: [deedNumber] | Συμβ/φος: [name] │
│ ΚΑΕΚ: [codes]                           │
├─────────────────────────────────────────┤
│ ΣΗΜΕΙΩΣΕΙΣ                               │
│ [notes]                                 │
└─────────────────────────────────────────┘
```

---

## 7. Enums & Constants

### 7.1 Enum Reference

| Enum | Τιμές | Χρήση |
|------|-------|-------|
| `CalculationMethod` | `area`, `value`, `volume` | Μέθοδος υπολογισμού (§5.4) |
| `PropertyCategory` | `main`, `auxiliary`, `air_rights` | Κατηγορία ιδιοκτησίας |
| `OwnerParty` | `contractor`, `landowner`, `buyer`, `unassigned` | Ιδιοκτήτης στο σενάριο αντιπαροχής |
| `OwnershipTableStatus` | `draft`, `finalized`, `registered` | Status πίνακα (FSM: draft↔finalized→registered) |
| `OwnershipEntityCollection` | `units`, `parking_spots`, `storage_units` | Τύπος entity reference |

### 7.2 Validation Constants

| Constant | Τιμή | Περιγραφή |
|----------|------|-----------|
| `TOTAL_SHARES_TARGET` | 1000 | Σύνολο χιλιοστών ΠΡΕΠΕΙ = 1000 |
| `MIN_SHARES_PER_ROW` | 1 | Ελάχιστα χιλιοστά ανά γραμμή |
| `PCT_TOLERANCE` | 0.01 | Ανοχή floating-point για 100% validation (owner-utils) |

---

## 8. Στατιστικά

| Μέτρηση | Τιμή |
|---------|------|
| Πεδία OwnershipPercentageTable | 19 (direct) |
| Πεδία OwnershipTableRow | 20 (per row) |
| Πεδία CalculationCoefficients | 2 (Μέθοδος Β only) |
| Πεδία LinkedSpaceDetail | 9 (per linked space) |
| Πεδία BartexSummary | 5 + landowners(4×N) |
| Πεδία CategorySummary | 2 × 2 = 4 |
| Πεδία OwnershipTableRevision | 5 + full snapshot |
| Enums | 5 |
| Floor coefficient entries | 7 (Table A) + 8 (Table B) = 15 |
| Calculation methods | 3 (area, value, volume) |
| Cross-entity references | 13 collections/patterns |
| Subcollections | 1 (revisions) |
| Tier 1 columns (table-level) | 18 primary + 10 computed = **28** |
| Tier 1 columns (row-level) | **20** |
| Tier 2 arrays | 5 |
| **Σύνολο πεδίων (πλήρης πίνακας)** | **~65 direct + 20×N rows + 9×M linkedSpaces** |
