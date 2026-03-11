# ADR-199: Παρακολουθήματα Πωλήσεων (Parking & Storage as Sale Appurtenances)

> **Status**: IMPLEMENTED (Phase 1+2)
> **Date**: 2026-03-11 (Approved) / 2026-03-12 (Implemented)
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
| **Ν. 5005/2022** | Ειδική ρύθμιση θέσεων πιλοτής — ενσωμάτωση χιλιοστών σε κύρια ιδιοκτησία |
| **Ν. 5069/2023** | Τακτοποίηση "άκυρων" παλαιών θέσεων πιλοτής/ακάλυπτου |
| **ΑΠ 23/2000** | Πάγια νομολογία — ανοιχτές θέσεις = κοινόχρηστος χώρος, μόνο δικαίωμα αποκλειστικής χρήσης |
| **Κτηματολόγιο** | Κάθε αυτοτελής χώρος = ξεχωριστό ΚΑΕΚ αν έχει χιλιοστά |

### 2.2 Κατηγοριοποίηση Οντοτήτων

| Οντότητα | Χιλιοστά | Νομικό Καθεστώς | Αυτόνομη Πώληση | Παρακολούθημα |
|----------|----------|-----------------|-----------------|---------------|
| **Μονάδα** (apartment/shop/office) | **ΠΑΝΤΑ** | Αυτοτελής οριζόντια ιδιοκτησία | ✅ ΝΑΙ | N/A |
| **Κλειστή θέση στάθμευσης** (underground, κλειστό με τοίχους+πόρτα) | **ΠΑΝΤΑ** | Κύριος χώρος — σαν μονάδα με χρήση parking | ✅ ΝΑΙ (αυτόνομα Ή ως παρακολούθημα) | ✅ ΝΑΙ |
| **Ανοιχτή θέση πιλοτής** | **ΟΧΙ** (Ν. 5005/2022) | Κοινόχρηστος χώρος — μόνο δικαίωμα αποκλειστικής χρήσης | ❌ ΟΧΙ | ✅ ΝΑΙ (μόνο) |
| **Ανοιχτή θέση ακάλυπτου** | **ΟΧΙ** (ΑΠ 23/2000) | Κοινόχρηστος χώρος — μόνο αποκλειστική χρήση/παρακολούθημα | ❌ ΟΧΙ | ✅ ΝΑΙ (μόνο) |
| **Αποθήκη** | **ΣΤΗΝ ΕΥΧΕΡΕΙΑ ΕΡΓΟΛΑΒΟΥ** | Ο κατασκευαστής αποφασίζει αν θα δώσει χιλιοστά | ✅ Μόνο αν ο εργολάβος έδωσε χιλιοστά | ✅ ΝΑΙ (ακόμα κι αν έχει χιλιοστά) |

> **ΝΟΜΙΚΗ ΑΝΑΛΥΣΗ (Γιώργος, 2026-03-11 — βαθιά έρευνα)**:
>
> **Υπαίθριες θέσεις (πιλοτή + ακάλυπτος)**:
> - Η πάγια νομολογία του Αρείου Πάγου (ΑΠ 23/2000 και μεταγενέστερα) απαγορεύει ρητά τη σύσταση ανοιχτών θέσεων στάθμευσης ως ανεξάρτητες οριζόντιες ιδιοκτησίες
> - Ο ακάλυπτος χώρος και η πιλοτή = κοινόκτητα/κοινόχρηστα μέρη οικοδομής
> - Μόνο **δικαίωμα αποκλειστικής χρήσης** ως παρακολούθημα κύριας ιδιοκτησίας
> - Ν. 5005/2022: παλαιές θέσεις πιλοτής με χιλιοστά → ενσωμάτωση σε κύρια ιδιοκτησία ή μεταβίβαση ΜΟΝΟ σε ιδιοκτήτη κύριας ιδιοκτησίας της ΙΔΙΑΣ οικοδομής
> - **ΔΕΝ** επιτρέπεται πώληση σε τρίτο που δεν έχει ιδιοκτησία στην ίδια οικοδομή
>
> **Κλειστές θέσεις** (τοίχοι + πόρτα/ρολό):
> - Θεωρούνται κύριοι χώροι → παίρνουν χιλιοστά → ανεξάρτητες ιδιοκτησίες
> - Πωλούνται αυτόνομα ή ως παρακολούθημα
>
> **Αποθήκη**:
> - Στην ευχέρεια του εργολάβου. Ακόμα κι αν ΕΧΕΙ χιλιοστά, μπορεί να πωληθεί μαζί με μονάδα αντί αυτόνομα

### 2.3 Κανόνας `canSellIndependently`

```
canSellIndependently(space) = millesimalShares !== null && millesimalShares > 0
```

- **TRUE**: Κλειστό parking ή αποθήκη ΜΕ χιλιοστά → **ΜΠΟΡΕΙ** να πωληθεί αυτόνομα, αλλά **ΜΠΟΡΕΙ ΚΑΙ** να πωληθεί ως παρακολούθημα μονάδας (ο πωλητής αποφασίζει)
- **FALSE**: Υπαίθρια parking, αποθήκες χωρίς χιλιοστά → πωλούνται ΜΟΝΟ ως παρακολούθημα μονάδας

### 2.4 Mapping `locationZone` → Δυνατότητα Χιλιοστών

| `locationZone` (ParkingSpot) | Κλειστός/Ανοιχτός | Χιλιοστά | Αυτόνομη πώληση | Νομική βάση |
|------------------------------|-------------------|----------|-----------------|-------------|
| `underground` | Κλειστός | ✅ ΠΑΝΤΑ | ✅ ΝΑΙ | Κύριος χώρος — αυτοτελής ιδιοκτησία |
| `covered_outdoor` | Κλειστός (τοίχοι+πόρτα) | ✅ ΠΑΝΤΑ | ✅ ΝΑΙ | Κύριος χώρος |
| `pilotis` | **Ανοιχτός** | ❌ ΟΧΙ | ❌ ΟΧΙ | ΑΠ 23/2000, Ν. 5005/2022 — κοινόχρηστος |
| `open_space` | Ανοιχτός | ❌ ΟΧΙ | ❌ ΟΧΙ | ΑΠ 23/2000 — κοινόχρηστος ακάλυπτος |
| `rooftop` | Ανοιχτός | ❌ ΟΧΙ | ❌ ΟΧΙ | Κοινόχρηστη ταράτσα |

> **ΚΡΙΣΙΜΟ**: Η πιλοτή στην ελληνική νομοθεσία είναι κοινόχρηστος χώρος. Ακόμα κι αν ιστορικά κάποιες θέσεις πήραν χιλιοστά, ο Ν. 5005/2022 κατευθύνει προς ενσωμάτωση σε κύρια ιδιοκτησία. Για νέες οικοδομές, ο εργολάβος δίνει θέσεις πιλοτής ΜΟΝΟ ως δικαίωμα αποκλειστικής χρήσης (παρακολούθημα).

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
┌──────────────────────────────────────────────┐
│  🏠 Κράτηση Μονάδας Α-101                    │
│                                              │
│  Τιμή Μονάδας: [___250.000___] €             │
│  Προκαταβολή:  [_____5.000___] €             │
│  Αγοραστής:    [Ιωάννης Κ.  ▼]              │
│                                              │
│  ─── Παρακολουθήματα ────────────────────── │
│  ☑ P-101 Κλειστή θέση (underground) 15.000 € │
│  ☑ S-03  Αποθήκη (basement)          8.000 € │
│                                              │
│  ════════════════════════════════════════════ │
│  ΣΥΝΟΛΟ: 273.000 € (μονάδα + P-101 + S-03)  │
│                                              │
│  [Ακύρωση]                      [Κράτηση ✓]  │
└──────────────────────────────────────────────┘

Τα παρακολουθήματα εμφανίζονται ως checkboxes, PRE-CHECKED by default.
Ο πωλητής ΜΠΟΡΕΙ να αποεπιλέξει κάποιο αν η διαπραγμάτευση το απαιτεί.
Η τιμή κάθε παρακολουθήματος είναι editable.
```

**Λογική εμφάνισης**:
- Αν η μονάδα έχει `linkedSpaces` → εμφάνιση section (read-only λίστα, ΟΧΙ checkboxes)
- Αν δεν έχει linked spaces → hidden (backward compatible, ίδιο UI)
- Κάθε linked space = γραμμή με κωδικό + τιμή (editable τιμή μόνο)

**ΚΑΝΟΝΑΣ ΠΑΡΑΚΟΛΟΥΘΗΜΑΤΩΝ (Γιώργος, 2026-03-11)**:

Ο εργολάβος αποφασίζει **εξαρχής** ποια parking/αποθήκες πάνε μαζί με ποια μονάδα. Αυτό γίνεται μέσω του LinkedSpacesCard (ήδη υπάρχει). Ωστόσο:

- Στο dialog πώλησης: τα linked spaces εμφανίζονται ως **checkboxes, PRE-CHECKED** by default
- Ο πωλητής **ΜΠΟΡΕΙ να αποεπιλέξει** κάποιο αν η διαπραγμάτευση το απαιτεί (π.χ. ο αγοραστής δεν έχει αρκετά χρήματα)
- Αν αποεπιλεγεί ένα παρακολούθημα: **ΑΠΟΣΥΝΔΕΕΤΑΙ ΑΥΤΟΜΑΤΑ** από τη μονάδα και επιστρέφει στη λίστα του (ελεύθερο)
- Μετά την αποσύνδεση, η τύχη του εξαρτάται από τα χιλιοστά:
  - **Parking ΧΩΡΙΣ χιλιοστά** → δεν μπορεί να μείνει μόνο του, ο εργολάβος πρέπει να το συνδέσει σε **άλλη μονάδα** (UI warning/notification)
  - **Αποθήκη ΜΕ χιλιοστά** → μπορεί να μείνει ως **αυτόνομη οντότητα** προς πώληση, Ή ο εργολάβος να τη συνδέσει σε άλλη μονάδα
  - **Parking ΜΕ χιλιοστά** → ίδια λογική με αποθήκη — αυτόνομο ή σε άλλη μονάδα
- Το πιο συχνό σενάριο: μονάδα + 1 θέση στάθμευσης + 1 αποθήκη (ή και 2η θέση/αποθήκη) — πωλούνται μαζί
- Ο εργολάβος μπορεί επίσης να αλλάξει τα links πριν την πώληση (π.χ. μεταφορά P-101 από Α-101 σε Β-202)

**ΚΑΝΟΝΑΣ ΑΓΟΡΑΣΤΗ (Γιώργος, 2026-03-11)**: Όταν πωλούνται παρακολουθήματα μαζί με μονάδα, ο αγοραστής είναι **ΠΑΝΤΑ ο ίδιος** — ένας αγοραστής για μονάδα + όλα τα παρακολουθήματα. Δεν υπάρχει δυνατότητα διαφορετικού αγοραστή ανά παρακολούθημα. Αυτό σημαίνει:
- Στο dialog: **ένα** πεδίο αγοραστή (κοινό)
- Στο backend: ο `buyerContactId` γράφεται ίδιος σε unit + κάθε space
- Στο invoice: ένας πελάτης (customer) ανά τιμολόγιο

### 5b. Υπολογισμός Συνόλου & Προκαταβολή

```
totalPrice = unitPrice + Σ(selectedAppurtenances.map(a => a.salePrice ?? a.price ?? 0))
```

**ΚΑΝΟΝΑΣ ΠΑΚΕΤΟΥ (Γιώργος, 2026-03-11)**:
- Η προκαταβολή είναι **ΜΙΑ** για ολόκληρο το πακέτο — δεν χωρίζεται ανά item
- Στο dialog: ένα πεδίο "Προκαταβολή" που αφορά τα πάντα μαζί
- **ΑΛΛΑ** στο τιμολόγιο/συμβόλαιο **αναλύεται** τι αγοράζει: ξεχωριστή γραμμή ανά asset με τη δική του τιμή
- Δηλαδή: πώληση = 1 πακέτο, 1 αγοραστής, 1 προκαταβολή — τιμολόγιο = N γραμμές (ανάλυση)

### 5c. Κανόνας `inclusion: 'rented'` στην Πώληση (ΝΟΜΙΚΗ ΑΝΑΛΥΣΗ)

**ΑΠΟΦΑΣΗ (Γιώργος, 2026-03-11 — νομική έρευνα)**:

Linked spaces με `inclusion: 'rented'` **ΕΜΦΑΝΙΖΟΝΤΑΙ** στο dialog πώλησης και είναι **pre-checked**, γιατί:

1. **Ανοιχτό parking (παρακολούθημα)**: Η μόνη νόμιμη ερμηνεία `rented` = νοικιασμένο ΜΑΖΙ με το διαμέρισμα, ΟΧΙ αυτοτελώς σε τρίτο (ΑΠ 23/2000, Ν. 5005/2022). Η πώληση μεταβιβάζει τα πάντα — ο αγοραστής υπεισέρχεται στη μίσθωση (ΑΚ 614).
2. **Κλειστό parking (αυτοτελές)**: Ακόμα κι αν νοικιάζεται αυτοτελώς, μπορεί να πωληθεί — ο αγοραστής αναλαμβάνει τη μίσθωση.

**UI Behavior**:
- Αν linked space έχει `inclusion: 'rented'` → εμφανίζεται στο dialog με **warning badge**: "⚠️ Ενεργή μίσθωση — ο αγοραστής υπεισέρχεται"
- Pre-checked by default (πωλείται μαζί)
- Ο πωλητής μπορεί να αποεπιλέξει (αν η διαπραγμάτευση το απαιτεί)

**Νομικοί περιορισμοί ενοικίασης** (guards στο σύστημα):
- Ανοιχτό parking (χωρίς χιλιοστά) → ❌ ΑΠΑΓΟΡΕΥΕΤΑΙ αυτοτελής ενοικίαση σε τρίτο μη-ιδιοκτήτη
- Ανοιχτό parking → ✅ ΜΟΝΟ ενοικίαση μαζί με κύρια ιδιοκτησία (πακέτο)
- Κλειστό parking (με χιλιοστά) → ✅ Επιτρέπεται αυτοτελής ενοικίαση

### 5d. Γενίκευση Dialogs σε `SaleableAsset`

Τα dialogs γενικεύονται ώστε να δέχονται `SaleableAsset` αντί `Unit`:
- **Unit sale**: Full dialog (τιμή + αγοραστής + παρακολουθήματα)
- **Parking sale** (standalone): Simplified dialog (τιμή + αγοραστής, χωρίς section παρακολουθημάτων)
- **Storage sale** (standalone): Same simplified pattern

### 5e. Guard: Reserve/Sell Buttons

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

### 6c. Invoice Asset Tracking — Polymorphic Reference (Enterprise Pattern)

**ΑΠΟΦΑΣΗ: Α) Polymorphic `assetId` + `assetType`** — SAP RE-FX / Oracle Property Manager pattern.

```typescript
// Extension στο Invoice type

/** Τύπος πωλήσιμου asset */
export type SaleAssetType = 'unit' | 'parking' | 'storage';

export interface Invoice {
  // ... existing fields ...

  /** @deprecated Κρατείται για backward compat — νέος κώδικας χρησιμοποιεί primaryAssetId */
  unitId: string | null;

  /** Primary asset ID (unit, parking ή storage) */
  primaryAssetId: string | null;

  /** Τύπος primary asset */
  primaryAssetType: SaleAssetType | null;

  /** Related asset IDs (παρακολουθήματα — parking/storage που πουλήθηκαν μαζί) */
  relatedAssetIds?: string[];
}
```

**Migration**: `unitId` παραμένει για backward compatibility. Νέες πωλήσεις γράφουν **και τα δύο** (`unitId` + `primaryAssetId`). Αυτόνομες πωλήσεις parking/storage: `unitId: null`, `primaryAssetId: 'P-301'`, `primaryAssetType: 'parking'`.

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

### 11.2 Dual-Status Model (ΑΠΟΦΑΣΗ — Γιώργος, 2026-03-11)

**ΑΠΟΦΑΣΗ: Β) Δύο ξεχωριστά πεδία** — enterprise pattern, domain separation.

Parking/Storage θα έχουν **δύο ανεξάρτητα** status:

| Πεδίο | Αφορά | Τιμές | Παράδειγμα |
|-------|-------|-------|------------|
| `status` (existing) | **Φυσική/λειτουργική** κατάσταση | `available`, `occupied`, `maintenance` | "Η θέση είναι ελεύθερη φυσικά" |
| `commercialStatus` (new) | **Εμπορική** κατάσταση | `unavailable`, `for-sale`, `reserved`, `sold` | "Η θέση είναι προς πώληση" |

**Κρίσιμο**: Αφαιρούμε `reserved` και `sold` από το `status` (φυσική κατάσταση) — αυτά ανήκουν ΜΟΝΟ στο `commercialStatus`. Ένα parking μπορεί να είναι:
- `status: 'occupied'` + `commercialStatus: 'for-sale'` → κάποιος το χρησιμοποιεί αλλά είναι προς πώληση
- `status: 'available'` + `commercialStatus: 'reserved'` → φυσικά ελεύθερο, εμπορικά κρατημένο
- `status: 'maintenance'` + `commercialStatus: 'sold'` → πουλημένο αλλά σε συντήρηση

**Type Migration**:
- `ParkingSpotStatus` type: αφαιρούνται `reserved`, `sold` → μένουν `available`, `occupied`, `maintenance`
- `StorageStatus` type: αφαιρούνται `reserved`, `sold` → μένουν `available`, `occupied`, `maintenance`, `unavailable`
- Existing Firestore documents με `status: 'reserved'` ή `status: 'sold'`: migration script θα τα μετακινήσει στο `commercialStatus`, και θα γυρίσει το `status` σε `available`
- UI components που δείχνουν badges "Reserved"/"Sold": θα κοιτάνε πλέον το `commercialStatus`
- Backward compat: κρατάμε `reserved`/`sold` στο type ως **deprecated** μεταβατικά (2 εβδομάδες), μετά αφαιρούνται

**Sync rule**: Κατά reserve/sell/revert, ενημερώνεται ΜΟΝΟ το `commercialStatus`. Το `status` αλλάζει μόνο αν αλλάξει η φυσική κατάσταση.

### 11.3 Αποσύνδεση & Orphan Handling

Όταν ο πωλητής αποεπιλέγει ένα παρακολούθημα κατά την πώληση, το σύστημα:

1. **Αποσυνδέει αυτόματα** το space από τη μονάδα (αφαίρεση από `linkedSpaces[]`)
2. Το space επιστρέφει στη λίστα του ως ελεύθερο
3. Ανάλογα με τα χιλιοστά:

```
if (canSellIndependently(space)) {
  // Αποθήκη/parking ΜΕ χιλιοστά → μένει αυτόνομο, commercialStatus: 'for-sale'
  // Ο εργολάβος αποφασίζει: πώληση αυτόνομα ή σύνδεση σε άλλη μονάδα
} else {
  // Parking ΧΩΡΙΣ χιλιοστά → ΔΕΝ μπορεί να μείνει μόνο
  // → UI notification στον εργολάβο: "Η θέση P-101 πρέπει να συνδεθεί σε μονάδα"
  // → commercialStatus: 'unavailable' (δεν πωλείται μόνη)
}
```

### 11.4 Revert & Orphan Detection

Αν μια πώληση μονάδας ακυρωθεί (revert) αλλά ένα παρακολούθημα ήταν ήδη sold standalone (μέσω Phase 3), **δεν γίνεται revert** στο παρακολούθημα:

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
| **NEW** AppurtenancesSection UI | `src/components/sales/dialogs/AppurtenancesSection.tsx` |
| **NEW** useLinkedSpacesForSale hook | `src/hooks/sales/useLinkedSpacesForSale.ts` |
| **NEW** Appurtenance sync API | `src/app/api/sales/[unitId]/appurtenance-sync/route.ts` |

---

## Changelog

### 2026-03-12 — Phase 1+2 IMPLEMENTED

**Files changed:**
- `src/types/unit.ts` — Added `includedInSale`, `salePrice` to LinkedSpace
- `src/types/sales-shared.ts` — Added `canSellIndependently()` helper
- `src/services/sales-accounting/types.ts` — Added `SaleLineItem`, `lineItems` to base event
- `src/services/sales-accounting/sales-accounting-bridge.ts` — Multi-line `buildInvoiceInput()`
- `src/services/sales-accounting/index.ts` — Export `SaleLineItem`
- `src/components/sales/dialogs/SalesActionDialogs.tsx` — Reserve/Sell/Revert with appurtenances
- `src/features/property-details/PropertyDetailsContent.tsx` — Integrated LinkedSpacesCard in unit details

**Files created:**
- `src/app/api/sales/[unitId]/appurtenance-sync/route.ts` — Batch writes for parking/storage status
- `src/hooks/sales/useLinkedSpacesForSale.ts` — Hook for resolving linked spaces in sale dialogs
- `src/components/sales/dialogs/AppurtenancesSection.tsx` — UI component for appurtenances

### UI Integration
- LinkedSpacesCard rendered in PropertyDetailsContent after AttachmentsBlock
- Visible when unit has a buildingId and user is NOT in read-only mode
- Edit mode: select parking/storage from dropdowns, choose inclusion type, save
- View mode: read-only badges showing linked spaces

---

### 2026-03-12: Building Linking + Floor Dropdown for Parking & Storage

**Problem**: Parking & Storage detail pages lacked a "Building Link" card (unlike Units), and floor was a freetext input instead of a dropdown populated from the building's floors.

**Solution**:
- Created `FloorSelectField` (`src/components/shared/FloorSelectField.tsx`) — reusable Radix Select that fetches floors via `GET /api/floors?buildingId=X`
- Added `EntityLinkCard` to `ParkingGeneralTab` and `StorageGeneralTab` for building linking
- Replaced freetext floor `<Input>` with `FloorSelectField` in both tabs
- Floor resets to empty when building changes
- Floor disabled with hint when no building is linked
- i18n translations added for `entityLinks.building.*` in parking + storage namespaces (el/en)

### 2026-03-12: Unified Building Link + Floor Dropdown across Units, Parking & Storage

**Problem**: Units page had building link (`UnitEntityLinks`) at the bottom and floor as a plain number input, while Parking/Storage now used `EntityLinkCard` + `FloorSelectField` at the top. Inconsistent UX confused users.

**Solution**:
- Moved `UnitEntityLinks` **above** `UnitFieldsBlock` in `PropertyDetailsContent.tsx` — same position as Parking/Storage
- Replaced floor `<Input type="number">` with `FloorSelectField` dropdown in `UnitFieldsBlock.tsx`
- Added `buildingId` prop to `UnitFieldsBlock` — passed from parent via `resolvedProperty.buildingId`
- All 3 entity types (Unit, Parking, Storage) now follow identical pattern:
  1. EntityLinkCard for building selection
  2. FloorSelectField dropdown populated from linked building's floors
  3. Floor disabled with hint when no building linked

**Files changed**:
- `src/features/property-details/PropertyDetailsContent.tsx` — reordered UnitEntityLinks before UnitFieldsBlock
- `src/features/property-details/components/UnitFieldsBlock.tsx` — FloorSelectField + buildingId prop

### 2026-03-12: Building + Floor side-by-side at top of all detail tabs

**Problem**: EntityLinkCard (building) and FloorSelectField (floor) were in separate sections, not at the top, and labeled "Τοποθεσία" which confused users. Layout inconsistent across Units/Parking/Storage.

**Solution**:
- **All 3 tabs**: Building link + Floor card placed in `grid grid-cols-1 md:grid-cols-2` at the **top** of the page
- **ParkingGeneralTab**: Removed separate Location Card — floor now in top grid next to building link
- **StorageGeneralTab**: Same — removed separate Location Card
- **PropertyDetailsContent (Units)**: Building link + Floor side-by-side in top grid; floor removed from UnitFieldsBlock Location Card
- **UnitFieldsBlock**: Removed floor from Location Card → renamed to Orientation Card; removed `buildingId` prop (no longer needed)
- **Label change**: Card title uses "Όροφος" instead of "Τοποθεσία"

**Files changed**:
- `src/components/space-management/ParkingPage/ParkingDetails/tabs/ParkingGeneralTab.tsx`
- `src/components/space-management/StoragesPage/StorageDetails/tabs/StorageGeneralTab.tsx`
- `src/features/property-details/PropertyDetailsContent.tsx`
- `src/features/property-details/components/UnitFieldsBlock.tsx`

### 2026-03-12: Entity linking at top of Projects & Buildings

**Problem**: Projects had company selection inline inside BasicProjectInfoTab (not a standalone EntityLinkCard). Buildings had project EntityLinkCard below BasicInfoCard instead of at the top. Inconsistent with the Units/Parking/Storage pattern.

**Solution**:
- **Projects**: Extracted company link from `BasicProjectInfoTab` into standalone `EntityLinkCard` at the top of `GeneralProjectTab`. Cleaned up unused company-related code from BasicProjectInfoTab (imports, state, handlers).
- **Buildings**: Moved `EntityLinkCard` (project link) from below `BasicInfoCard` to **above** it — matching the "link at top" pattern.
- Label uses existing i18n key `basicInfo.companyLink.title` = "Σύνδεση με Εταιρεία" for projects.

**Files changed**:
- `src/components/projects/BasicProjectInfoTab.tsx` — removed company selection UI + unused imports/state
- `src/components/projects/general-tab/GeneralProjectTab.tsx` — added EntityLinkCard for company at top
- `src/components/building-management/tabs/GeneralTabContent.tsx` — moved EntityLinkCard above BasicInfoCard
