# ADR-199: Παρακολουθήματα Πωλήσεων (Parking & Storage as Sale Appurtenances)

> **Status**: APPROVED
> **Date**: 2026-03-11
> **Author**: Claude Code (Anthropic AI) + Γιώργος Παγώνης
> **Category**: Domain / Sales Architecture
> **References**: ADR-182, ADR-191, ADR-197, ADR-198, `REAL_ESTATE_ARCHITECTURE_DECISIONS.md` (LOCKED)

---

## 1. Context — Πρόβλημα

Στην τρέχουσα εφαρμογή, η ροή πώλησης (Reserve → Sell → Revert) αφορά **αποκλειστικά μονάδες (Units)**. Τα `parking_spots` και `storage_units` υπάρχουν ως ανεξάρτητες Firestore collections (ADR-182), αλλά **δεν συμμετέχουν στη ροή πώλησης**.

Στην ελληνική αγορά ακινήτων, ένα διαμέρισμα πωλείται συχνά **μαζί** με θέση στάθμευσης ή/και αποθήκη ως **παρακολουθήματα** (appurtenances). Η τρέχουσα αρχιτεκτονική δεν υποστηρίζει αυτό το σενάριο.

### Τι αλλάζει:
1. Parking/Storage εντάσσονται στη ροή πώλησης ως παρακολουθήματα μονάδων
2. Parking/Storage **με χιλιοστά οικοπέδου** μπορούν να πωληθούν αυτόνομα
3. Τα τιμολόγια γίνονται multi-line (μονάδα + παρακολουθήματα)
4. Η αλλαγή status (reserve/sell/revert) propagates στα linked spaces

---

## 2. Ανάλυση Ελληνικού Δικαίου — Χιλιοστά Οικοπέδου & Πώληση

### 2.1 Νομοθετικό Πλαίσιο

| Νόμος | Τι ρυθμίζει |
|-------|-------------|
| **Ν. 3741/1929** | Οριζόντια & κάθετη ιδιοκτησία — κάθε αυτοτελής χώρος = ξεχωριστή ιδιοκτησία αν έχει χιλιοστά |
| **Ν. 4495/2017, ΝΟΚ** | Πολεοδομική νομοθεσία — κάθε ανεξάρτητη ιδιοκτησία απαιτεί δικά της χιλιοστά |
| **Κτηματολόγιο** | Κάθε αυτοτελής χώρος = ξεχωριστό ΚΑΕΚ αν έχει χιλιοστά |
| **ΚΠολΔ** | Αυτοτελής πώληση = ξεχωριστό συμβόλαιο → ξεχωριστά χιλιοστά required |

### 2.2 Κατηγοριοποίηση Οντοτήτων

| Οντότητα | Χιλιοστά | Νομικό Καθεστώς | Αυτόνομη Πώληση | Παρακολούθημα |
|----------|----------|-----------------|-----------------|---------------|
| **Μονάδα** (apartment/shop/office) | **ΠΑΝΤΑ** | Αυτοτελής οριζόντια ιδιοκτησία | ✅ ΝΑΙ | N/A |
| **Κλειστή θέση στάθμευσης** (underground/covered) | **ΜΠΟΡΕΙ** | Αν έχει χιλιοστά → αυτοτελής | ✅ Μόνο αν `millesimalShares > 0` | ✅ ΝΑΙ |
| **Υπαίθρια θέση στάθμευσης** (pilotis/open_space) | **ΠΟΤΕ** | Πάντα παρακολούθημα (κοινόχρηστος χώρος) | ❌ ΟΧΙ | ✅ ΝΑΙ (μόνο) |
| **Αποθήκη** (basement/ground) | **ΜΠΟΡΕΙ** | Αν έχει χιλιοστά → αυτοτελής | ✅ Μόνο αν `millesimalShares > 0` | ✅ ΝΑΙ |

### 2.3 Κανόνας `canSellIndependently`

```
canSellIndependently(space) = millesimalShares !== null && millesimalShares > 0
```

- **TRUE**: Κλειστό parking ή αποθήκη ΜΕ χιλιοστά → εμφανίζεται στα Saleable Assets, δικά του Reserve/Sell buttons
- **FALSE**: Υπαίθρια parking, χώροι χωρίς χιλιοστά → πωλούνται ΜΟΝΟ ως παρακολούθημα μονάδας

### 2.4 Mapping `locationZone` → Δυνατότητα Χιλιοστών

| `locationZone` (ParkingSpot) | Μπορεί να έχει χιλιοστά | Τυπικό σενάριο |
|------------------------------|-------------------------|----------------|
| `underground` | ✅ ΝΑΙ | Κλειστή θέση σε υπόγειο |
| `covered_outdoor` | ✅ ΝΑΙ | Κλειστή/στεγασμένη θέση |
| `pilotis` | ❌ ΟΧΙ | Κοινόχρηστος χώρος pilotis |
| `open_space` | ❌ ΟΧΙ | Ανοιχτός κοινόχρηστος χώρος |
| `rooftop` | ❌ Σπάνια | Ανοιχτή ταράτσα (κοινόχρηστη) |

---

## 3. Τρέχουσα Αρχιτεκτονική — Ευρήματα Έρευνας

### 3.1 Hierarchy (ADR-182 — LOCKED)

```
Company → Project → Building → [Units | Parking | Storage]  (parallel)
```

Parking και Storage είναι **peer categories** με Units, ΟΧΙ children.

### 3.2 Υπάρχοντα Types

#### LinkedSpace (`src/types/unit.ts:189-210`)
```typescript
export interface LinkedSpace {
  spaceId: string;
  spaceType: AllocationSpaceType;  // 'parking' | 'storage'
  quantity: number;
  inclusion: SpaceInclusionType;   // 'included' | 'optional' | 'rented'
  allocationCode?: string;
  notes?: string;
  metadata?: Record<string, string | number | boolean>;
}
```

#### ParkingSpot (`src/types/parking.ts:51-81`)
- Έχει: `id`, `number`, `status`, `price`, `area`, `locationZone`, `type`
- **ΔΕΝ έχει**: `millesimalShares`, `commercialStatus`, `commercial` (commercial data)

#### Storage (`src/types/storage/contracts.ts:15-34`)
- Έχει: `id`, `name`, `type`, `status`, `price`, `area`
- **ΔΕΝ έχει**: `millesimalShares`, `commercialStatus`, `commercial`

#### Unit Commercial Data (`src/types/unit.ts:96-126`)
- `UnitCommercialData`: askingPrice, finalPrice, reservationDeposit, buyerContactId, buyerName, dates, transactionChainId
- `CommercialStatus`: 'unavailable' | 'for-sale' | 'for-rent' | 'for-sale-and-rent' | 'reserved' | 'sold' | 'rented'

### 3.3 Sales Flow (τρέχον — μόνο Units)

| Component | File | Λειτουργία |
|-----------|------|------------|
| `SalesActionDialogs` | `src/components/sales/dialogs/SalesActionDialogs.tsx` | Reserve/Sell/Revert dialogs — δέχεται `unit: Unit` |
| `SalesAccountingBridge` | `src/services/sales-accounting/sales-accounting-bridge.ts` | ADR-198 — δημιουργεί invoices/journals |
| `SalesAccountingEvent` | `src/services/sales-accounting/types.ts` | Event types — `unitId`, `unitName` |
| `InvoiceLineItem` | `src/subapps/accounting/types/invoice.ts:49-66` | Line item — ήδη multi-line capable |

### 3.4 Κρίσιμη Παρατήρηση

Η αρχιτεκτονική τιμολογίων (ADR-198) **ήδη** υποστηρίζει `lineItems[]` — κάθε invoice έχει array γραμμών. Αυτό σημαίνει ότι η επέκταση σε multi-line (unit + parking + storage) είναι **backward-compatible**.

---

## 4. Αποφάσεις — Data Model

### 4a. Νέο πεδίο `millesimalShares` στα ParkingSpot & Storage

**Σκεπτικό**: Τα χιλιοστά καθορίζουν αν ένα parking/storage είναι αυτοτελής ιδιοκτησία ή παρακολούθημα.

```typescript
// src/types/parking.ts — ParkingSpot interface extension
export interface ParkingSpot {
  // ... existing fields ...

  /** Χιλιοστά οικοπέδου (null = χωρίς, δεν μπορεί να πωληθεί αυτόνομα) */
  millesimalShares?: number | null;
}

// src/types/storage/contracts.ts — Storage interface extension
export interface Storage {
  // ... existing fields ...

  /** Χιλιοστά οικοπέδου (null = χωρίς, δεν μπορεί να πωληθεί αυτόνομα) */
  millesimalShares?: number | null;
}
```

**Migration**: Existing documents χωρίς `millesimalShares` = `undefined` → treated as `null` (no shares, cannot sell independently).

### 4b. Shared `SpaceCommercialData` Interface

**Σκεπτικό**: Parking/Storage χρειάζονται commercial data **μόνο αν** πωλούνται (ως παρακολούθημα ή αυτόνομα). Αντί να αντιγράψουμε ολόκληρο το `UnitCommercialData`, δημιουργούμε lightweight shared interface.

```typescript
// src/types/shared/space-commercial.ts (NEW)

/**
 * Commercial data for parking/storage spaces that participate in a sale.
 * Subset of UnitCommercialData — only what makes sense for spaces.
 * @see ADR-199
 */
export interface SpaceCommercialData {
  /** Ζητούμενη τιμή (catalog) */
  askingPrice: number | null;

  /** Τελική τιμή πώλησης */
  finalPrice: number | null;

  /** Reference → contacts collection (αγοραστής) */
  buyerContactId: string | null;

  /** Denormalized buyer name */
  buyerName: string | null;

  /** Αν πωλήθηκε ως παρακολούθημα → ID πώλησης γονικής μονάδας */
  parentUnitSaleId: string | null;

  /** Transaction chain ID (κοινό με τη γονική πώληση ή ανεξάρτητο) */
  transactionChainId: string | null;

  /** Ημερομηνία πώλησης */
  saleDate: Timestamp | null;

  /** Ημερομηνία κράτησης */
  reservationDate: Timestamp | null;
}
```

### 4c. Προσθήκη `commercialStatus` στα ParkingSpot & Storage

```typescript
// ParkingSpot extension
export interface ParkingSpot {
  // ... existing fields ...
  millesimalShares?: number | null;
  commercialStatus?: CommercialStatus;       // Reuse existing union
  commercial?: SpaceCommercialData;
}

// Storage extension
export interface Storage {
  // ... existing fields ...
  millesimalShares?: number | null;
  commercialStatus?: CommercialStatus;
  commercial?: SpaceCommercialData;
}
```

**Import**: Επαναχρήση `CommercialStatus` από `src/types/unit.ts` (ίδιο union type).

### 4d. Επέκταση `LinkedSpace` για Sale Context

```typescript
export interface LinkedSpace {
  // ... existing fields ...

  /** Αν το space είναι επιλεγμένο στην πώληση αυτής της μονάδας */
  includedInSale?: boolean;

  /** Τιμή παρακολουθήματος σε αυτή την πώληση (null = included free) */
  salePrice?: number | null;
}
```

**Σημείωση**: Αυτά τα πεδία γράφονται ΜΟΝΟ κατά τη στιγμή πώλησης/κράτησης. Σε normal state είναι `undefined`.

### 4e. Helper Function `canSellIndependently`

```typescript
// src/utils/sales/space-sale-helpers.ts (NEW)

import type { ParkingSpot } from '@/types/parking';
import type { Storage } from '@/types/storage/contracts';

type SaleableSpace = Pick<ParkingSpot, 'millesimalShares'> | Pick<Storage, 'millesimalShares'>;

/**
 * Ελέγχει αν ένα parking/storage μπορεί να πωληθεί αυτόνομα.
 * Βασίζεται στα χιλιοστά οικοπέδου (Ν. 3741/1929).
 *
 * @returns true αν millesimalShares > 0
 * @see ADR-199 §2.3
 */
export function canSellIndependently(space: SaleableSpace): boolean {
  return (space.millesimalShares ?? 0) > 0;
}
```

### 4f. `SaleableAsset` Union Type

```typescript
// src/types/shared/saleable-asset.ts (NEW)

import type { Unit, CommercialStatus, UnitCommercialData } from '@/types/unit';
import type { ParkingSpot } from '@/types/parking';
import type { Storage } from '@/types/storage/contracts';
import type { SpaceCommercialData } from './space-commercial';

/**
 * Discriminated union για assets που μπορούν να πωληθούν.
 * Χρησιμοποιείται στα generalized Sale dialogs.
 * @see ADR-199 §4c
 */
export type SaleableAsset =
  | { assetType: 'unit'; data: Unit }
  | { assetType: 'parking'; data: ParkingSpot & { commercialStatus?: CommercialStatus; commercial?: SpaceCommercialData } }
  | { assetType: 'storage'; data: Storage & { commercialStatus?: CommercialStatus; commercial?: SpaceCommercialData } };

/**
 * Εξάγει human-readable label για ένα saleable asset.
 */
export function getSaleableAssetLabel(asset: SaleableAsset): string {
  switch (asset.assetType) {
    case 'unit': return asset.data.code ?? asset.data.name ?? asset.data.id;
    case 'parking': return asset.data.number ?? asset.data.id;
    case 'storage': return asset.data.name ?? asset.data.id;
  }
}
```

---

## 5. Αποφάσεις — Sale Flow (UI/UX)

### 5a. Reserve/Sell Dialogs — Section "Παρακολουθήματα"

**Τρέχον**: `SalesActionDialogs.tsx` δέχεται `unit: Unit` → εμφανίζει ΜΟΝΟ τιμή μονάδας.

**Νέο**: Τα Reserve/Sell dialogs αποκτούν optional section "Παρακολουθήματα":

```
┌─────────────────────────────────────────────┐
│  🏠 Κράτηση Μονάδας Α-101                   │
│                                             │
│  Τιμή Μονάδας: [___250.000___] €            │
│  Προκαταβολή:  [_____5.000___] €            │
│  Αγοραστής:    [Ιωάννης Κ.  ▼]             │
│                                             │
│  ─── Παρακολουθήματα ───                    │
│  ☑ P-101 Κλειστή θέση (underground)  15.000€│
│  ☐ S-03  Αποθήκη (basement)           8.000€│
│                                             │
│  ═══════════════════════════════════════════ │
│  ΣΥΝΟΛΟ: 265.000 € (μονάδα + parking)       │
│                                             │
│  [Ακύρωση]                     [Κράτηση ✓]  │
└─────────────────────────────────────────────┘
```

**Λογική εμφάνισης**:
- Αν η μονάδα έχει `linkedSpaces` → εμφάνιση section
- Αν δεν έχει linked spaces → hidden (backward compatible, ίδιο UI)
- Κάθε linked space = checkbox + τιμή (editable)
- Default selection: `inclusion === 'included'` → pre-checked

### 5b. Υπολογισμός Συνόλου

```
totalPrice = unitPrice + Σ(selectedAppurtenances.map(a => a.salePrice ?? a.price ?? 0))
```

### 5c. Γενίκευση Dialogs σε `SaleableAsset`

Τα dialogs γενικεύονται ώστε να δέχονται `SaleableAsset` αντί `Unit`:
- **Unit sale**: Full dialog (τιμή + αγοραστής + παρακολουθήματα)
- **Parking sale** (standalone): Simplified dialog (τιμή + αγοραστής, χωρίς section παρακολουθημάτων)
- **Storage sale** (standalone): Same simplified pattern

### 5d. Guard: Reserve/Sell Buttons

| Entity | Condition | Εμφάνιση Buttons |
|--------|-----------|------------------|
| Unit | `commercialStatus === 'for-sale'` | ✅ Πάντα (ήδη υπάρχει) |
| ParkingSpot | `canSellIndependently(spot) && commercialStatus === 'for-sale'` | ✅ Μόνο αν χιλιοστά > 0 |
| Storage | `canSellIndependently(storage) && commercialStatus === 'for-sale'` | ✅ Μόνο αν χιλιοστά > 0 |
| Parking (χωρίς χιλιοστά) | — | ❌ ΠΟΤΕ standalone buttons — μόνο μέσω μονάδας |

---

## 6. Αποφάσεις — Invoice / Accounting (ADR-198 Extension)

### 6a. Multi-line Items

**Τρέχον**: 1 invoice = 1 line item (μόνο unit).
**Νέο**: 1 invoice = N line items (unit + selected appurtenances).

```
Τιμολόγιο Πώλησης ΤΠ-Α-0042
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Περιγραφή                    Καθαρό    ΦΠΑ 24%
1  Διαμέρισμα Α-101 (85 τ.μ.)  201.612,90  48.387,10
2  Θέση Στάθμευσης P-101        12.096,77   2.903,23
3  Αποθήκη S-03                  6.451,61   1.548,39
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ΣΥΝΟΛΟ                      220.161,28  52.838,72
   ΠΛΗΡΩΤΕΟ                               273.000,00 €
```

### 6b. Επέκταση `SalesAccountingEvent` Types

```typescript
// src/services/sales-accounting/types.ts — EXTENSION

/** Line item input για multi-asset invoices */
export interface SaleLineItemInput {
  /** Τύπος asset */
  assetType: 'unit' | 'parking' | 'storage';
  /** Firestore document ID */
  assetId: string;
  /** Display name (e.g., "Α-101", "P-101", "S-03") */
  assetName: string;
  /** Gross amount (including VAT) */
  grossAmount: number;
  /** Area in m² (for description) */
  area: number | null;
}

/** Extended base event with optional line items */
export interface SalesAccountingEventBase {
  // ... existing fields ...

  /** Multi-line items (αν υπάρχουν παρακολουθήματα) */
  lineItems?: SaleLineItemInput[];

  /** IDs παρακολουθημάτων (parking/storage) που συμπεριλαμβάνονται */
  relatedAssetIds?: string[];
}
```

### 6c. Invoice Asset Tracking

```typescript
// Extension στο Invoice type
export interface Invoice {
  // ... existing fields ...

  /** Primary asset (backward compatible — unitId stays) */
  unitId: string | null;

  /** Related asset IDs (parking/storage παρακολουθήματα) */
  relatedAssetIds?: string[];
}
```

### 6d. ΦΠΑ Υπολογισμός

- Νεόδμητα ακίνητα: **ΦΠΑ 24%** ξεχωριστά ανά γραμμή
- `netAmount = grossAmount / 1.24`
- `vatAmount = grossAmount - netAmount`
- Κάθε line item = ξεχωριστός υπολογισμός (σύμφωνα με myDATA απαιτήσεις)

---

## 7. Αποφάσεις — Status Synchronization

### 7a. Server-side Sync (NOT Client-side)

**Κρίσιμο**: Η αλλαγή status των παρακολουθημάτων γίνεται **server-side** (API route), ΟΧΙ client-side. Αυτό εξασφαλίζει atomicity και αποτρέπει inconsistent states.

### 7b. Reserve Unit → Propagation

```
Reserve Unit Α-101 (with P-101, S-03 selected)
  │
  ├─ Unit Α-101: commercialStatus = 'reserved'
  │  └─ commercial.buyerContactId = buyer.id
  │
  ├─ ParkingSpot P-101:
  │  ├─ status = 'reserved'  (existing ParkingSpotStatus)
  │  ├─ commercialStatus = 'reserved'  (NEW)
  │  └─ commercial.parentUnitSaleId = unit.id
  │
  └─ Storage S-03:
     ├─ status = 'reserved'  (existing StorageStatus)
     ├─ commercialStatus = 'reserved'  (NEW)
     └─ commercial.parentUnitSaleId = unit.id
```

### 7c. Sell Unit → Propagation

```
Sell Unit Α-101 (with P-101, S-03)
  │
  ├─ Unit Α-101: commercialStatus = 'sold'
  │
  ├─ ParkingSpot P-101: status = 'sold', commercialStatus = 'sold'
  │
  └─ Storage S-03: status = 'sold', commercialStatus = 'sold'
```

### 7d. Revert Unit → Propagation

```
Revert Unit Α-101
  │
  ├─ Unit Α-101: commercialStatus = 'for-sale', clear commercial
  │
  ├─ ParkingSpot P-101:
  │  ├─ status = 'available'
  │  ├─ commercialStatus = 'for-sale' (αν canSellIndependently) ή 'unavailable'
  │  └─ clear commercial data
  │
  └─ Storage S-03:
     ├─ status = 'available'
     ├─ commercialStatus = 'for-sale' (αν canSellIndependently) ή 'unavailable'
     └─ clear commercial data
```

### 7e. Conflict Prevention

| Σενάριο | Αντιμετώπιση |
|---------|-------------|
| Parking already reserved/sold | ❌ Block — δεν μπορεί να προστεθεί σε νέα πώληση |
| Παρακολούθημα χωρίς linked space | ❌ Block — πρέπει πρώτα να γίνει link μέσω LinkedSpacesCard |
| Ανεξάρτητη πώληση + ταυτόχρονα linked | ❌ Block — αν είναι linked ΚΑΙ selected, πωλείται μέσω unit |

---

## 8. Σενάρια Πώλησης (7 Complete Scenarios)

### Σενάριο 1: Μονάδα Μόνη

```
Μονάδα Α-101, τιμή 250.000€, χωρίς linked spaces
→ Reserve: 5.000€ προκαταβολή → Unit reserved
→ Sell: 250.000€ → Unit sold
→ Invoice: 1 line item (μονάδα μόνο)
```

**Backward compatible** — ίδια ροή με σήμερα.

### Σενάριο 2: Μονάδα + Parking Παρακολούθημα

```
Μονάδα Α-101 (250.000€) + P-101 κλειστή underground (15.000€)
LinkedSpace: { spaceId: 'P-101', inclusion: 'included' }

→ Reserve dialog: ☑ P-101 (pre-checked, included)
→ Total: 265.000€
→ Reserve: 5.000€ deposit
→ Both Α-101 and P-101 → status: reserved
→ Sell: 265.000€ final
→ Invoice: 2 line items (unit 250k + parking 15k)
```

### Σενάριο 3: Μονάδα + Αποθήκη Παρακολούθημα

```
Μονάδα Β-202 (180.000€) + S-03 basement (8.000€)
LinkedSpace: { spaceId: 'S-03', inclusion: 'optional' }

→ Reserve dialog: ☐ S-03 (unchecked by default, optional)
→ User checks S-03 → Total: 188.000€
→ Reserve + Sell → both entities synced
→ Invoice: 2 line items
```

### Σενάριο 4: Μονάδα + Parking + Αποθήκη

```
Μονάδα Α-301 (320.000€) + P-205 (18.000€) + S-12 (10.000€)
LinkedSpaces: [
  { spaceId: 'P-205', inclusion: 'included' },
  { spaceId: 'S-12', inclusion: 'optional' }
]

→ Reserve dialog: ☑ P-205 (included), ☐ S-12 (optional)
→ User checks both → Total: 348.000€
→ Invoice: 3 line items (unit + parking + storage)
```

### Σενάριο 5: Parking Ανεξάρτητο (ΜΕ Χιλιοστά)

```
P-301 κλειστό underground, millesimalShares: 15, τιμή 25.000€
canSellIndependently(P-301) = true

→ Εμφανίζεται στην Sales page ως standalone asset
→ Reserve/Sell buttons visible
→ Reserve dialog: simplified (τιμή + αγοραστής, χωρίς section παρακολουθημάτων)
→ Invoice: 1 line item (parking μόνο)
```

### Σενάριο 6: Αποθήκη Ανεξάρτητη (ΜΕ Χιλιοστά)

```
S-05 basement, millesimalShares: 8, τιμή 12.000€
canSellIndependently(S-05) = true

→ Ίδια ροή με Σενάριο 5
→ Invoice: 1 line item (storage μόνο)
```

### Σενάριο 7: Parking + Αποθήκη Bundle (Phase 3)

```
P-301 (25.000€) + S-05 (12.000€), ΧΩΡΙΣ μονάδα
Και τα δύο με millesimalShares > 0

→ Phase 3 enhancement: bundle sale dialog
→ Invoice: 2 line items (parking + storage)
→ Shared transactionChainId
```

---

## 9. Φάσεις Υλοποίησης

### Phase 1: Data Model + Backend Services (Foundation)

| # | Εργασία | Αρχεία |
|---|---------|--------|
| 1.1 | Προσθήκη `millesimalShares` στο `ParkingSpot` type | `src/types/parking.ts` |
| 1.2 | Προσθήκη `millesimalShares` στο `Storage` type | `src/types/storage/contracts.ts` |
| 1.3 | Δημιουργία `SpaceCommercialData` interface | `src/types/shared/space-commercial.ts` |
| 1.4 | Προσθήκη `commercialStatus` + `commercial` στα parking/storage types | `src/types/parking.ts`, `src/types/storage/contracts.ts` |
| 1.5 | Επέκταση `LinkedSpace` με `includedInSale`, `salePrice` | `src/types/unit.ts` |
| 1.6 | Δημιουργία `canSellIndependently` helper | `src/utils/sales/space-sale-helpers.ts` |
| 1.7 | Δημιουργία `SaleableAsset` union type | `src/types/shared/saleable-asset.ts` |
| 1.8 | Επέκταση `SalesAccountingEvent` με `lineItems[]` | `src/services/sales-accounting/types.ts` |
| 1.9 | Επέκταση `SalesAccountingBridge` για multi-line invoices | `src/services/sales-accounting/sales-accounting-bridge.ts` |
| 1.10 | API route για status sync (reserve/sell/revert propagation) | `src/app/api/sales/appurtenances/route.ts` |

**Estimated complexity**: Medium — type extensions + 1 new API route + bridge modification.

### Phase 2: UI — Dialogs με Παρακολουθήματα

| # | Εργασία | Αρχεία |
|---|---------|--------|
| 2.1 | Section "Παρακολουθήματα" στο ReserveDialog | `src/components/sales/dialogs/SalesActionDialogs.tsx` |
| 2.2 | Section "Παρακολουθήματα" στο SellDialog | Same file |
| 2.3 | Revert propagation (clear παρακολουθήματα) | Same file + API call |
| 2.4 | Σύνολο calculation (unit + Σ selected spaces) | Same file |
| 2.5 | Fetch linked spaces + τιμές κατά το dialog open | Custom hook |
| 2.6 | i18n keys για labels παρακολουθημάτων | `src/i18n/locales/{el,en}/sales.json` |

**Estimated complexity**: Medium — UI additions σε existing dialogs.

### Phase 3: Ανεξάρτητη Πώληση Parking/Storage

| # | Εργασία | Αρχεία |
|---|---------|--------|
| 3.1 | Γενίκευση dialogs σε `SaleableAsset` | `SalesActionDialogs.tsx` |
| 3.2 | Guard: Reserve/Sell buttons visible μόνο αν `canSellIndependently` | Parking/Storage card components |
| 3.3 | Sales page: εμφάνιση standalone parking/storage | Sales page components |
| 3.4 | `millesimalShares` input field στα Parking/Storage forms | Parking/Storage edit forms |
| 3.5 | Bundle sale: P+S χωρίς unit | New dialog variant |

**Estimated complexity**: Medium-High — requires dialog generalization.

### Phase 4: Enhancements

| # | Εργασία |
|---|---------|
| 4.1 | Dashboard: parking/storage revenue tracking |
| 4.2 | Reports: sales breakdown per asset type |
| 4.3 | Bulk actions: reserve/sell μαζί πολλαπλές μονάδες + παρακολουθήματα |
| 4.4 | Notifications: email/Telegram alerts per παρακολούθημα |

---

## 10. Backward Compatibility

### 10.1 Τι ΔΕΝ αλλάζει

| Existing Feature | Impact |
|-----------------|--------|
| Sales χωρίς linked spaces | ✅ ZERO impact — dialog shows no appurtenances section |
| `SalesAccountingEvent.unitId` | ✅ Stays — primary asset reference |
| `InvoiceLineItem` structure | ✅ Already supports multi-line — no change |
| Parking/Storage status flow | ✅ Existing `ParkingSpotStatus`/`StorageStatus` stays |
| LinkedSpacesCard UI | ✅ No change — space linking remains independent of sale |

### 10.2 Τι ΠΡΟΣΤΙΘΕΤΑΙ (additive only)

| Addition | Type |
|----------|------|
| `millesimalShares` field | Optional — `undefined` = backward compatible |
| `commercialStatus` on parking/storage | Optional — `undefined` = no commercial tracking |
| `commercial` on parking/storage | Optional — `undefined` = no commercial data |
| `includedInSale` on LinkedSpace | Optional — `undefined` = not part of sale |
| `lineItems[]` on SalesAccountingEvent | Optional — `undefined` = single-line (current behavior) |
| `relatedAssetIds[]` on Invoice | Optional — `undefined` = no related assets |

### 10.3 Migration Strategy

**ZERO migration needed** — all new fields are optional. Existing documents work unchanged. Fields are populated only when a sale includes appurtenances for the first time.

---

## 11. Technical Constraints & Edge Cases

### 11.1 Firestore Atomicity

Η πώληση μονάδας + N παρακολουθημάτων πρέπει να είναι **atomic** (all-or-nothing). Χρήση Firestore `batch` writes ή `transaction`:

```typescript
// Pseudo-code for atomic reserve
const batch = writeBatch(db);
batch.update(unitRef, { commercialStatus: 'reserved', ... });
batch.update(parkingRef, { status: 'reserved', commercialStatus: 'reserved', ... });
batch.update(storageRef, { status: 'reserved', commercialStatus: 'reserved', ... });
await batch.commit(); // All or nothing
```

### 11.2 Double-Status Concern

Parking/Storage θα έχουν **δύο** status:
- `status` (existing): operational status ('available', 'occupied', 'reserved', 'sold', 'maintenance')
- `commercialStatus` (new): commercial disposition ('unavailable', 'for-sale', 'reserved', 'sold')

**Κανόνας**: `status` tracks physical/operational state. `commercialStatus` tracks commercial state. Κατά τη πώληση, **και τα δύο** ενημερώνονται ταυτόχρονα.

### 11.3 Orphan Detection

Αν μια μονάδα ακυρωθεί (revert) αλλά ένα παρακολούθημα ήταν ήδη sold standalone (μέσω Phase 3), **δεν γίνεται revert** στο παρακολούθημα:

```
if (space.commercial?.parentUnitSaleId === unit.id) {
  // Revert only if it was part of THIS unit's sale
  revertSpace(space);
} else {
  // Space was sold independently — leave it alone
  skip();
}
```

---

## 12. Open Questions (για Discussion)

| # | Ερώτηση | Πρόταση |
|---|---------|---------|
| Q1 | Πρέπει τα parking/storage να εμφανίζονται στην κύρια Sales page ή μόνο μέσω unit; | Phase 1-2: μόνο μέσω unit. Phase 3: standalone στη Sales page |
| Q2 | Χρειάζεται ξεχωριστό permission/role για πώληση parking/storage; | Όχι — ίδιο permission με unit sales |
| Q3 | Τι γίνεται με ήδη rented parking/storage κατά πώληση; | Η πώληση ακυρώνει αυτόματα ενοικίαση (Phase 4) |
| Q4 | Bundle pricing: μπορεί ο χρήστης να αλλάξει τιμή παρακολουθήματος κατά πώληση; | ✅ ΝΑΙ — editable στο dialog |

---

## 13. Glossary

| Όρος | Ελληνικά | English | Ορισμός |
|------|----------|---------|---------|
| Παρακολούθημα | Παρακολούθημα | Appurtenance | Βοηθητικός χώρος (parking/storage) που ακολουθεί τη μονάδα στην πώληση |
| Χιλιοστά οικοπέδου | Χιλιοστά | Millesimal shares | Ποσοστό ιδιοκτησίας στο οικόπεδο (‰), καθορίζει αν χώρος = αυτοτελής ιδιοκτησία |
| Αυτοτελής ιδιοκτησία | Αυτοτελής | Independent property | Χώρος με δικά του χιλιοστά, μπορεί να πωληθεί αυτόνομα |
| Transaction Chain | Αλυσίδα συναλλαγών | Transaction chain | Κοινό ID για deposit/final/credit invoices μιας πώλησης (ADR-198) |

---

## 14. References

| Document | Path |
|----------|------|
| LinkedSpace interface | `src/types/unit.ts:189-210` |
| UnitCommercialData | `src/types/unit.ts:96-126` |
| CommercialStatus union | `src/types/unit.ts:76-86` |
| ParkingSpot type | `src/types/parking.ts:51-81` |
| Storage type | `src/types/storage/contracts.ts:15-34` |
| Domain constants (allocations) | `src/config/domain-constants.ts:559-630` |
| SalesActionDialogs | `src/components/sales/dialogs/SalesActionDialogs.tsx` |
| Sales-to-Accounting bridge | `src/services/sales-accounting/sales-accounting-bridge.ts` |
| SalesAccountingEvent types | `src/services/sales-accounting/types.ts` |
| InvoiceLineItem | `src/subapps/accounting/types/invoice.ts:49-66` |
| Hierarchy audit (ADR-182) | `docs/centralized-systems/reference/adrs/ADR-182-parking-storage-hierarchy-audit.md` |
| Sales pages (ADR-197) | `docs/centralized-systems/reference/adrs/ADR-197-sales-pages-implementation.md` |
| Sales-to-Accounting bridge (ADR-198) | `docs/centralized-systems/reference/adrs/ADR-198-sales-accounting-bridge.md` |
| Architecture decisions (LOCKED) | `docs/centralized-systems/reference/REAL_ESTATE_ARCHITECTURE_DECISIONS.md` |
