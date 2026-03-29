# SPEC-014: Πλήρης Χαρτογράφηση — Μονάδες (Units)

**ADR**: 268 — Dynamic Report Builder
**Version**: 1.0
**Last Updated**: 2026-03-29
**Source of Truth**: Κώδικας (`src/types/unit.ts`, `src/config/firestore-collections.ts`)

---

## 1. Ταυτότητα Οντότητας

| Στοιχείο | Τιμή |
|----------|------|
| **Collection** | `units` |
| **TypeScript** | `Unit` (canonical), `UnitDoc` (Firestore migration), `UnitModel` (app normalized) |
| **ID Pattern** | Enterprise ID: `unit_XXXXX` (`enterprise-id.service.ts`, prefix `unit`) |
| **Tenant Isolation** | `linkedCompanyId` (ADR-232, inherited from project via cascade) |
| **Form Config** | `src/config/units-tabs-config.ts` |

---

## 2. Πλήρης Κατάλογος Πεδίων

### 2.1 Ταυτότητα & Ιεραρχία

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | Yes | Enterprise ID (`unit_XXXXX`) |
| 2 | `name` | string | Yes | Ονομασία μονάδας (π.χ. "Α1-01") |
| 3 | `unitName` | string | No | Fallback ονομασίας (backward compat) |
| 4 | `code` | string | No | Κωδικός (π.χ. "A-101") |
| 5 | `type` | `UnitType` | Yes | 14 τύποι: `studio`, `apartment_1br`, `apartment`, `apartment_2br`, `apartment_3br`, `maisonette`, `penthouse`, `loft`, `detached_house`, `villa`, `shop`, `office`, `hall`, `storage` + legacy Greek values |
| 6 | `useCategory` | enum | No | `residential` / `commercial` / `mixed` |
| 7 | `project` | string | Yes | Project ID (legacy alias) |
| 8 | `buildingId` | string | Yes | Building ID |
| 9 | `building` | string | Yes | Building name (legacy, denormalized) |
| 10 | `floorId` | string | Yes | Floor document ID |
| 11 | `floor` | number | Yes | Αριθμός ορόφου |
| 12 | `linkedCompanyId` | string \| null | No | Business entity (ADR-232, cascade from project) |
| 13 | `description` | string | No | Περιγραφή μονάδας |

### 2.2 Κατάσταση (Status — Τριπλή Αρχιτεκτονική)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 14 | `operationalStatus` | `OperationalStatus` | No | Φυσική κατάσταση: `ready`, `under-construction`, `inspection`, `maintenance`, `draft` |
| 15 | `status` | `LegacySalesStatus` | Yes | ⚠️ DEPRECATED — legacy sales status (`PropertyStatus` \| `'rented'`) |
| 16 | `commercialStatus` | `CommercialStatus` | No | Εμπορική κατάσταση (ADR-197): `unavailable`, `for-sale`, `for-rent`, `for-sale-and-rent`, `reserved`, `sold`, `rented` |

### 2.3 Τιμολόγηση & Πώληση (Legacy — DEPRECATED)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 17 | `price` | number | No | ⚠️ DEPRECATED — θα μεταφερθεί σε SalesAsset |
| 18 | `soldTo` | string \| null | No | ⚠️ DEPRECATED — αγοραστής (contact ID) |
| 19 | `saleDate` | string | No | ⚠️ DEPRECATED — ημ/νία πώλησης |

### 2.4 Εμβαδά & Μετρήσεις

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 20 | `area` | number | No | Legacy flat area (τ.μ.) |
| 21 | `areas.gross` | number | Yes* | Μικτό εμβαδόν (required εντός `areas`) |
| 22 | `areas.net` | number | No | Καθαρό εμβαδόν |
| 23 | `areas.balcony` | number | No | Εμβαδόν μπαλκονιού |
| 24 | `areas.terrace` | number | No | Εμβαδόν βεράντας |
| 25 | `areas.garden` | number | No | Εμβαδόν κήπου (ισόγειο) |

### 2.5 Διαρρύθμιση (Layout)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 26 | `layout.bedrooms` | number | No | Υπνοδωμάτια |
| 27 | `layout.bathrooms` | number | No | Μπάνια |
| 28 | `layout.wc` | number | No | Ξεχωριστό WC |
| 29 | `layout.totalRooms` | number | No | Σύνολο δωματίων |
| 30 | `layout.levels` | number | No | Επίπεδα (μεζονέτες) |
| 31 | `layout.balconies` | number | No | Αριθμός μπαλκονιών |

### 2.6 Προσανατολισμός & Θέα

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 32 | `orientations` | `OrientationType[]` | No | `north`, `northeast`, `east`, κλπ (8 τιμές) |
| 33 | `views` | `Array<{type, quality?}>` | No | `type`: `sea`/`mountain`/`city`/`park`/`garden`/`courtyard`, `quality`: `excellent`/`good`/`limited`/`none` |

### 2.7 Κατάσταση & Ετοιμότητα

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 34 | `condition` | `ConditionType` | No | Φυσική κατάσταση |
| 35 | `renovationYear` | number | No | Έτος τελευταίας ανακαίνισης |
| 36 | `deliveryDate` | Timestamp | No | Αναμενόμενη παράδοση |

### 2.8 Ενεργειακή Απόδοση

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 37 | `energy.class` | `EnergyClassType` | No | Ενεργειακή κλάση (A+, A, B+, B, Γ, Δ, Ε, Ζ, Η) |
| 38 | `energy.certificateId` | string | No | Αριθμός πιστοποιητικού ΠΕΑ |
| 39 | `energy.certificateDate` | Timestamp | No | Ημ/νία έκδοσης ΠΕΑ |
| 40 | `energy.validUntil` | Timestamp | No | Ημ/νία λήξης ΠΕΑ |

### 2.9 Εγκαταστάσεις (Systems Override)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 41 | `systemsOverride.heatingType` | `HeatingType` | No | Τύπος θέρμανσης (override κτιρίου) |
| 42 | `systemsOverride.heatingFuel` | `FuelType` | No | Καύσιμο θέρμανσης |
| 43 | `systemsOverride.coolingType` | `CoolingType` | No | Τύπος ψύξης |
| 44 | `systemsOverride.waterHeating` | `WaterHeatingType` | No | Θέρμανση νερού |

### 2.10 Υλικά & Τελειώματα

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 45 | `finishes.flooring` | `FlooringType[]` | No | Τύποι δαπέδου |
| 46 | `finishes.windowFrames` | `FrameType` | No | Κουφώματα |
| 47 | `finishes.glazing` | `GlazingType` | No | Υαλοπίνακες |

### 2.11 Χαρακτηριστικά (Feature Arrays)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 48 | `interiorFeatures` | `InteriorFeatureCodeType[]` | No | `fireplace`, `jacuzzi`, `sauna`, κλπ |
| 49 | `securityFeatures` | `SecurityFeatureCodeType[]` | No | `alarm`, `security-door`, κλπ |
| 50 | `unitAmenities` | `AmenityCodeType[]` | No | Παροχές μονάδας |

### 2.12 Πίνακας Ποσοστών

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 51 | `millesimalShares` | number \| null | No | Χιλιοστά ιδιοκτησίας (read-only, ενημερώνεται αυτόματα) |

### 2.13 Τεκμηρίωση (Coverage)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 52 | `unitCoverage.hasPhotos` | boolean | Yes* | Έχει φωτογραφίες (queryable — explicit true/false) |
| 53 | `unitCoverage.hasFloorplans` | boolean | Yes* | Έχει κατόψεις |
| 54 | `unitCoverage.hasDocuments` | boolean | Yes* | Έχει βασικά έγγραφα |
| 55 | `unitCoverage.updatedAt` | Timestamp | Yes* | Τελευταία ενημέρωση coverage |

### 2.14 Multi-Level (ADR-236)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 56 | `isMultiLevel` | boolean | No | Πολυεπίπεδη μονάδα (μεζονέτα, ρετιρέ, loft) |

---

## 3. Nested Objects / Arrays

### 3.1 `commercial` (UnitCommercialData — ADR-197)

Εμπορικά/πωλησιακά δεδομένα. Ανεξάρτητα από `operationalStatus`.

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 57 | `commercial.askingPrice` | number \| null | No | Ζητούμενη τιμή καταλόγου |
| 58 | `commercial.finalPrice` | number \| null | No | Τελική τιμή πώλησης |
| 59 | `commercial.reservationDeposit` | number \| null | No | Ποσό προκαταβολής κράτησης |
| 60 | `commercial.buyerContactId` | string \| null | No | Reference → contacts (αγοραστής) |
| 61 | `commercial.buyerName` | string \| null | No | Denormalized αγοραστής |
| 62 | `commercial.reservationDate` | Timestamp \| null | No | Ημ/νία κράτησης |
| 63 | `commercial.saleDate` | Timestamp \| null | No | Ημ/νία πώλησης |
| 64 | `commercial.cancellationDate` | Timestamp \| null | No | Ημ/νία ακύρωσης |
| 65 | `commercial.listedDate` | Timestamp \| null | No | Ημ/νία εισαγωγής στην αγορά |
| 66 | `commercial.transactionChainId` | string \| null | No | Αλυσίδα συναλλαγών (ADR-198) |
| 67 | `commercial.legalPhase` | `LegalPhase` \| null | No | Νομική φάση (denormalized, ADR-230) |
| 68 | `commercial.paymentSummary` | `PaymentSummary` \| null | No | Σύνοψη πληρωμών (denormalized, ADR-234) |

### 3.2 `commercial.owners[]` (PropertyOwnerEntry — ADR-244)

Πολλαπλοί ιδιοκτήτες / συν-αγοραστές. Συνυπάρχει με `buyerContactId`.

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `contactId` | string | Contact ID ιδιοκτήτη |
| `name` | string | Ονοματεπώνυμο (denormalized) |
| `ownershipPct` | number | Ποσοστό ιδιοκτησίας (0-100) |
| `role` | `PropertyOwnerRole` | `buyer` / `co_buyer` / `landowner` |
| `paymentPlanId` | string \| null | Σύνδεση με ατομικό πλάνο αποπληρωμής |

### 3.3 `commercial.paymentSummary` (PaymentSummary — ADR-234)

Denormalized σύνοψη από PaymentPlanService.

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `planStatus` | `PaymentPlanStatus` | negotiation/draft/active/completed/cancelled |
| `totalAmount` | number | Συνολικό ποσό |
| `paidAmount` | number | Πληρωμένο ποσό |
| `remainingAmount` | number | Υπόλοιπο |
| `paidPercentage` | number | % εξόφλησης |
| `totalInstallments` | number | Σύνολο δόσεων |
| `paidInstallments` | number | Πληρωμένες δόσεις |
| `overdueInstallments` | number | Ληξιπρόθεσμες δόσεις |
| `nextInstallmentAmount` | number \| null | Ποσό επόμενης δόσης |
| `nextInstallmentDate` | string \| null | Ημ/νία επόμενης δόσης |
| `loanStatus` | `LoanStatus` | Legacy loan status |
| `primaryLoanStatus` | `LoanTrackingStatus` | Phase 2 loan status |
| `primaryLoanBank` | string \| null | Τράπεζα δανείου |
| `totalApprovedLoanAmount` | number \| null | Εγκεκριμένο ποσό δανείων |
| `totalDisbursedAmount` | number | Εκταμιευθέν ποσό |
| `paymentPlanId` | string | Reference → payment plan |

### 3.4 `linkedSpaces[]` (LinkedSpace)

Σχέσεις μονάδας → parking / storage.

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `spaceId` | string | Document ID parking/storage |
| `spaceType` | `AllocationSpaceType` | `parking` / `storage` |
| `quantity` | number | Πλήθος χώρων |
| `inclusion` | `SpaceInclusionType` | Τρόπος ένταξης |
| `allocationCode` | string? | Κωδικός (π.χ. "P-101", "S-42") |
| `notes` | string? | Σημειώσεις |
| `metadata` | `Record<string, string\|number\|boolean>` | Extensible metadata |
| `includedInSale` | boolean? | Συμπεριλαμβάνεται στην πώληση (ADR-199) |
| `salePrice` | number \| null | Τιμή χώρου αν ξεχωριστή |

### 3.5 `levels[]` (UnitLevel — ADR-236)

Πολλαπλοί όροφοι (μεζονέτα, penthouse, loft).

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `floorId` | string | Floor document ID |
| `floorNumber` | number | Αριθμός ορόφου (sorting) |
| `name` | string | Εμφανιζόμενο όνομα (π.χ. "Ισόγειο") |
| `isPrimary` | boolean | Κύριος όροφος (είσοδος) — ακριβώς 1 per unit |

### 3.6 `levelData` (Record<floorId, LevelData> — ADR-236 Phase 2)

Per-level δεδομένα (εμβαδά, layout, φινιρίσματα). Keyed by `floorId`.

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `areas.gross` | number | Μικτό εμβαδόν επιπέδου |
| `areas.net` | number? | Καθαρό εμβαδόν |
| `areas.balcony` | number? | Μπαλκόνι |
| `areas.terrace` | number? | Βεράντα |
| `areas.garden` | number? | Κήπος |
| `layout.bedrooms` | number? | Υπνοδωμάτια στο επίπεδο |
| `layout.bathrooms` | number? | Μπάνια |
| `layout.wc` | number? | WC |
| `orientations` | `OrientationType[]` | Προσανατολισμός επιπέδου |
| `finishes.flooring` | `FlooringType[]` | Δάπεδα |
| `finishes.windowFrames` | `FrameType` | Κουφώματα |
| `finishes.glazing` | `GlazingType` | Υαλοπίνακες |

### 3.7 `views[]`

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `type` | `ViewTypeValue` | `sea`, `mountain`, `city`, `park`, `garden`, `courtyard` |
| `quality` | `ViewQuality` | `excellent`, `good`, `limited`, `none` (optional) |

---

## 4. Subcollections

### 4.1 Payment Plans — `units/{unitId}/payment_plans`

**TypeScript**: `PaymentPlan` (`src/types/payment-plan.ts`)

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `id` | string | Document ID |
| `unitId` | string | Parent unit |
| `buildingId` | string | Building context |
| `projectId` | string | Project context |
| `buyerContactId` | string | Αγοραστής (contact ref) |
| `buyerName` | string | Denormalized |
| `status` | `PaymentPlanStatus` | `negotiation`/`draft`/`active`/`completed`/`cancelled` |
| `planGroupId` | string? | ADR-244: ομάδα πλάνων (joint/individual) |
| `planType` | `'joint'`/`'individual'` | ADR-244 |
| `ownerContactId` | string? | ADR-244: ιδιοκτήτης ατομικού πλάνου |
| `ownerName` | string? | Denormalized |
| `ownershipPct` | number? | Ποσοστό ιδιοκτησίας (%) |
| `totalAmount` | number | Συνολικό ποσό |
| `paidAmount` | number | Πληρωμένο |
| `remainingAmount` | number | Υπόλοιπο |
| `currency` | `'EUR'` | Νόμισμα |
| `installments[]` | `Installment[]` | Array δόσεων |
| `loan` | `LoanInfo` | Legacy δάνειο |
| `loans[]` | `LoanTracking[]` | Phase 2: multi-bank |
| `config` | `PaymentPlanConfig` | Ρυθμίσεις (grace, fees, κλπ) |
| `taxRegime` | `SaleTaxRegime` | Φορολογικό καθεστώς |
| `taxRate` | number | Ποσοστό φόρου |
| `notes` | string \| null | Σημειώσεις |
| `createdAt` | string | Audit |
| `createdBy` | string | Audit |
| `updatedAt` | string | Audit |
| `updatedBy` | string | Audit |

### 4.2 Payments — `units/{unitId}/payments`

**TypeScript**: `PaymentRecord` (`src/types/payment-plan.ts`)

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `id` | string | Document ID |
| `paymentPlanId` | string | Reference → payment plan |
| `installmentIndex` | number | Σε ποια δόση αντιστοιχεί |
| `amount` | number | Ποσό |
| `method` | `PaymentMethod` | `bank_transfer`/`bank_cheque`/`personal_cheque`/`bank_loan`/`cash`/`promissory_note`/`offset` |
| `paymentDate` | string | ISO ημ/νία |
| `methodDetails` | `PaymentMethodDetails` | Discriminated union λεπτομερειών |
| `splitAllocations[]` | `SplitAllocation[]` | Κατανομή σε δόσεις |
| `overpaymentAmount` | number | Περίσσεια |
| `invoiceId` | string \| null | → accounting invoice (ADR-198) |
| `transactionChainId` | string \| null | → transaction chain |
| `notes` | string \| null | Σημειώσεις |
| `createdAt` | string | Audit |
| `createdBy` | string | Audit |
| `updatedAt` | string | Audit |

### 4.3 Photos — `units/{unitId}/photos`

### 4.4 Documents — `units/{unitId}/documents`

### 4.5 History — `units/{unitId}/history`

### 4.6 Grants — `units/{unitId}/grants` (RBAC)

---

## 5. Σχέσεις με ΟΛΕΣ τις Οντότητες (Relationship Map)

### 5.1 Διάγραμμα Σχέσεων

```
                              ┌──────────────┐
                              │   ΜΟΝΑΔΑ     │
                              │   (units)    │
                              └──────┬───────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
    ┌─────┴─────┐            ┌───────┴───────┐          ┌──────┴──────┐
    │ ΙΕΡΑΡΧΙΑ  │            │ ΟΙΚΟΝΟΜΙΚΑ    │          │ ΑΝΘΡΩΠΟΙ    │
    │           │            │               │          │             │
    ├───────────┤            ├───────────────┤          ├─────────────┤
    │ projects  │            │ payment_plans │          │ contacts    │
    │ buildings │            │ payments      │          │ (buyer)     │
    │ floors    │            │ legal_contr.  │          │ contacts    │
    │           │            │ cheques       │          │ (owners[])  │
    │           │            │ brokerage_agr.│          │ contact_    │
    │           │            │ commission_rec│          │  links      │
    │           │            │ acct_invoices │          └─────────────┘
    └───────────┘            └───────────────┘
          │                          │
    ┌─────┴─────┐            ┌───────┴───────┐
    │ ΧΩΡΟΙ     │            │ CRM           │
    │           │            │               │
    ├───────────┤            ├───────────────┤
    │ parking_  │            │ opportunities │
    │  spots    │            │ communic.     │
    │ storage_  │            │ conversations │
    │  units    │            │ file_links    │
    │ ownership │            └───────────────┘
    │ _tables   │
    └───────────┘
```

### 5.2 Αναλυτικός Πίνακας Σχέσεων

| # | Collection | Πεδίο(α) σύνδεσης | Σχέση | Περιγραφή |
|---|------------|-------------------|-------|-----------|
| 1 | **projects** | `unit.project` / `unit.projectId` → `project.id` | N:1 | Μονάδα ανήκει σε 1 Έργο |
| 2 | **buildings** | `unit.buildingId` → `building.id` | N:1 | Μονάδα ανήκει σε 1 Κτίριο |
| 3 | **floors** | `unit.floorId` → `floor.id` | N:1 | Μονάδα βρίσκεται σε 1 Όροφο |
| 4 | **contacts** | `unit.commercial.buyerContactId` → `contact.id` | N:1 | Αγοραστής μονάδας |
| 5 | **contacts** | `unit.commercial.owners[].contactId` → `contact.id` | N:M | Ιδιοκτήτες/Συν-αγοραστές (ADR-244) |
| 6 | **parking_spots** | `unit.linkedSpaces[].spaceId` WHERE `spaceType='parking'` | N:M | Θέσεις στάθμευσης μονάδας |
| 7 | **storage_units** | `unit.linkedSpaces[].spaceId` WHERE `spaceType='storage'` | N:M | Αποθήκες μονάδας |
| 8 | **payment_plans** | Subcollection `units/{id}/payment_plans` | 1:N | Πλάνα αποπληρωμής |
| 9 | **payments** | Subcollection `units/{id}/payments` | 1:N | Καταγραφές πληρωμών |
| 10 | **legal_contracts** | `contract.unitId` → `unit.id` | 1:N | Συμβόλαια (preliminary, final, payoff) |
| 11 | **cheques** | `cheque.context.unitId` → `unit.id` | 1:N | Αξιόγραφα (εισερχόμενα/εξερχόμενα) |
| 12 | **brokerage_agreements** | `agreement.unitId` → `unit.id` (scope='unit') | 1:N | Μεσιτικές συμφωνίες |
| 13 | **commission_records** | `record.unitId` → `unit.id` | 1:N | Εγγραφές προμηθειών |
| 14 | **ownership_tables** | `table.rows[].entityRef.id` WHERE `collection='units'` | N:M | Πίνακας χιλιοστών συνιδιοκτησίας |
| 15 | **opportunities** | `opportunity.interestedIn.unitIds[]` / `opportunity.unitId` | N:M | CRM leads/ευκαιρίες |
| 16 | **communications** | `communication.unitId` → `unit.id` | 1:N | Επικοινωνίες σχετικές |
| 17 | **conversations** | `conversation.linkedEntities.unitId` → `unit.id` | 1:N | Omnichannel conversations |
| 18 | **contact_links** | `link.targetEntityId` WHERE `targetEntityType='unit'` | N:M | Σύνδεση contacts → μονάδα (engineers, contractors, κλπ) |
| 19 | **file_links** | `link.unitId` → `unit.id` | 1:N | Αρχεία συνδεδεμένα (ADR-191) |
| 20 | **companies** | `unit.linkedCompanyId` → `company.id` | N:1 | Κατασκευαστική εταιρεία (ADR-232) |

---

## 6. Report Builder Impact — Τι σημαίνει αυτό για τα Domains

### 6.1 Domain A3 (Μονάδες) — Ενημερωμένες Στήλες

**Tier 1 (Flat Table) — Primary columns:**

| Στήλη | Πεδίο | Τύπος | Σημείωση |
|-------|-------|-------|----------|
| Κωδικός | `code` | text | |
| Ονομασία | `name` | text | |
| Τύπος | `type` | enum | 14 τύποι + legacy |
| Κατηγορία χρήσης | `useCategory` | enum | residential/commercial/mixed |
| Operational Status | `operationalStatus` | enum | 5 τιμές |
| Commercial Status | `commercialStatus` | enum | 7 τιμές (ADR-197) |
| Όροφος | `floor` | number | |
| Μικτό εμβαδόν | `areas.gross` | number | τ.μ. |
| Καθαρό εμβαδόν | `areas.net` | number | τ.μ. |
| Μπαλκόνι | `areas.balcony` | number | τ.μ. |
| Βεράντα | `areas.terrace` | number | τ.μ. |
| Κήπος | `areas.garden` | number | τ.μ. |
| Υπνοδωμάτια | `layout.bedrooms` | number | |
| Μπάνια | `layout.bathrooms` | number | |
| Δωμάτια (σύνολο) | `layout.totalRooms` | number | |
| Ενεργειακή κλάση | `energy.class` | enum | |
| Κατάσταση | `condition` | enum | |
| Τιμή καταλόγου | `commercial.askingPrice` | currency | |
| Τελική τιμή | `commercial.finalPrice` | currency | |
| Αγοραστής | `commercial.buyerName` | text | denormalized |
| Νομική φάση | `commercial.legalPhase` | enum | 7 τιμές (ADR-230) |
| Χιλιοστά | `millesimalShares` | number | ‰ |
| Multi-level | `isMultiLevel` | boolean | |
| Φωτογραφίες | `unitCoverage.hasPhotos` | boolean | |
| Κατόψεις | `unitCoverage.hasFloorplans` | boolean | |
| Έγγραφα | `unitCoverage.hasDocuments` | boolean | |
| Κατασκευαστής | `linkedCompanyId` (join) | text | company name |
| Ημ/νία παράδοσης | `deliveryDate` | date | |

**Tier 1 — Computed/Joined columns (cross-entity):**

| Στήλη | Join | Τύπος | Σημείωση |
|-------|------|-------|----------|
| Έργο | JOIN projects ON projectId | text | Όνομα έργου |
| Κτίριο | JOIN buildings ON buildingId | text | Όνομα κτιρίου |
| Πληρωμένο % | `commercial.paymentSummary.paidPercentage` | number | % εξόφλησης |
| Πληρωμένο ποσό | `commercial.paymentSummary.paidAmount` | currency | |
| Υπόλοιπο | `commercial.paymentSummary.remainingAmount` | currency | |
| Ληξιπρόθεσμες δόσεις | `commercial.paymentSummary.overdueInstallments` | number | |
| Αρ. Συμβολαίων | COUNT legal_contracts WHERE unitId | number | |
| Αρ. Αξιογράφων | COUNT cheques WHERE context.unitId | number | |
| Σύν. Αξιογράφων | SUM cheques.amount WHERE context.unitId | currency | |
| Αρ. Ιδιοκτητών | COUNT commercial.owners[] | number | ADR-244 |
| Αρ. Parking | COUNT linkedSpaces WHERE spaceType='parking' | number | |
| Αρ. Αποθηκών | COUNT linkedSpaces WHERE spaceType='storage' | number | |
| Ημέρες στην αγορά | DATEDIFF(now, commercial.listedDate) | number | Days on market |
| Αρ. Ευκαιριών | COUNT opportunities WHERE unitIds[] | number | CRM |
| Αρ. Μεσιτικών | COUNT brokerage_agreements WHERE unitId | number | |

### 6.2 Tier 2 (Row Repetition) — Arrays που χρειάζονται expansion

| Array | Πεδία ανά row | Μέγιστο πλήθος |
|-------|---------------|----------------|
| `commercial.owners[]` | contactId, name, ownershipPct, role | ~5 |
| `linkedSpaces[]` | spaceId, spaceType, quantity, allocationCode, inclusion, includedInSale | ~10 |
| `levels[]` | floorId, floorNumber, name, isPrimary | ~4 |
| `orientations[]` | value (single string) | 8 (max) |
| `views[]` | type, quality | ~6 |
| `interiorFeatures[]` | code (single string) | ~10 |
| `securityFeatures[]` | code (single string) | ~5 |
| `unitAmenities[]` | code (single string) | ~10 |
| `finishes.flooring[]` | code (single string) | ~3 |
| `installments[]` (via payment_plans) | label, type, amount, dueDate, status, paidAmount | ~12 |

### 6.3 Tier 3 (Unit Card PDF) — Sections

```
┌─────────────────────────────────────────┐
│ [ΦΩΤΟ] ΚΩΔΙΚΟΣ — ΟΝΟΜΑΣΙΑ ΜΟΝΑΔΑΣ      │
│        Τύπος | Κατηγορία | Status       │
├─────────────────────────────────────────┤
│ ΤΟΠΟΘΕΣΙΑ                                │
│ Έργο | Κτίριο | Όροφος                  │
│ Κατασκευαστής (company)                 │
├─────────────────────────────────────────┤
│ ΕΜΒΑΔΑ & ΔΙΑΡΡΥΘΜΙΣΗ                     │
│ Μικτό | Καθαρό | Μπαλκόνι | Βεράντα    │
│ Υπνοδ. | Μπάνια | WC | Δωμάτια         │
│ Multi-level: [πίνακας levels + areas]   │
├─────────────────────────────────────────┤
│ ΧΑΡΑΚΤΗΡΙΣΤΙΚΑ                           │
│ Προσανατολισμοί: [λίστα]               │
│ Θέα: [πίνακας type + quality]           │
│ Ενέργεια: Κλάση | ΠΕΑ | Ημ/νίες        │
│ Εσωτ. Features: [λίστα]                │
│ Ασφάλεια: [λίστα]                       │
│ Παροχές: [λίστα]                        │
│ Τελειώματα: Δάπεδα | Κουφώματα | Υαλ.  │
│ Εγκαταστάσεις: Θέρμ. | Ψύξη | Νερό    │
├─────────────────────────────────────────┤
│ ΕΜΠΟΡΙΚΑ ΣΤΟΙΧΕΙΑ                        │
│ Κατάσταση | Τιμή Καταλ. | Τελική Τιμή  │
│ Αγοραστής | Ημ/νία Κράτησης | Πώλησης  │
│ Νομική Φάση | Transaction Chain         │
├─────────────────────────────────────────┤
│ ΙΔΙΟΚΤΗΤΕΣ (via owners[])               │
│ [πίνακας: Όνομα, %, Ρόλος, Πλάνο]     │
├─────────────────────────────────────────┤
│ ΠΛΗΡΩΜΕΣ (via payment_plans)             │
│ Status | Σύνολο | Πληρωμένο | Υπόλοιπο │
│ [πίνακας δόσεων: Ετικέτα, Ποσό, Due]   │
│ Δάνειο: Τράπεζα | Ποσό | Κατάσταση    │
├─────────────────────────────────────────┤
│ ΣΥΜΒΟΛΑΙΑ (via legal_contracts)          │
│ [πίνακας: Τύπος, Status, Ποσό]         │
│ Δικηγόροι | Συμβολαιογράφος             │
├─────────────────────────────────────────┤
│ ΑΞΙΟΓΡΑΦΑ (via cheques)                  │
│ [πίνακας: Αριθμός, Ποσό, Status]       │
├─────────────────────────────────────────┤
│ ΣΥΝΔΕΔΕΜΕΝΟΙ ΧΩΡΟΙ                       │
│ [πίνακας: Τύπος, Κωδικός, Inclusion]   │
├─────────────────────────────────────────┤
│ ΠΙΝΑΚΑΣ ΠΟΣΟΣΤΩΝ                         │
│ Χιλιοστά: X‰ | Κατηγορία: main/aux     │
├─────────────────────────────────────────┤
│ ΤΕΚΜΗΡΙΩΣΗ                               │
│ Φωτογραφίες: ✓/✗ | Κατόψεις: ✓/✗      │
│ Έγγραφα: ✓/✗                            │
├─────────────────────────────────────────┤
│ ΣΗΜΕΙΩΣΕΙΣ                               │
│ [description]                           │
└─────────────────────────────────────────┘
```

---

## 7. Στατιστικά

| Μέτρηση | Τιμή |
|---------|------|
| Πεδία direct (Unit interface) | 56 |
| Πεδία `commercial` (nested) | 12 + paymentSummary(16) + owners(5×N) |
| Πεδία `linkedSpaces` (nested array) | 9 per entry |
| Πεδία `levels` / `levelData` (ADR-236) | 4 per level + 12 per levelData |
| Subcollections | 6 (payment_plans, payments, photos, documents, history, grants) |
| Payment plan fields | 25+ |
| Payment record fields | 14 |
| Cross-entity references | 20 collections |
| Tier 1 columns (flat) | 28 primary + 15 computed = **43** |
| Tier 2 arrays | 10 |
| **Σύνολο πεδίων (πλήρης μονάδα)** | **~130+** |
