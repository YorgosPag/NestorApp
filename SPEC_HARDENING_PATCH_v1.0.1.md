# 📝 SPEC HARDENING PATCH v1.0.1
**Base Document**: UNIT_FIELDS_FINAL_SPECIFICATION.md v1.0.0
**Date**: 2026-01-23
**Requested by**: ChatGPT
**Prepared by**: Claude

---

## 🚨 CRITICAL FIXES BEFORE IMPLEMENTATION

### 1️⃣ **Date → Timestamp Consistency**

#### ❌ WRONG (current spec):
```typescript
deliveryDate?: Date;
certificateDate?: Date;
validUntil?: Date;
```

#### ✅ CORRECT (patched):
```typescript
import { Timestamp } from 'firebase/firestore';

deliveryDate?: Timestamp;
certificateDate?: Timestamp;
validUntil?: Timestamp;
```

**Rule**: ALL date fields in Firestore MUST use `Timestamp`, never `Date`.

---

### 2️⃣ **Reuse Existing UnitType**

#### ❌ WRONG (spec proposed new):
```typescript
// src/constants/unit-lookups.ts
export const UnitType = {
  STUDIO: 'studio',
  APARTMENT_1BR: 'apartment-1br',
  // ...
}
```

#### ✅ CORRECT (reuse existing):
```typescript
// src/types/unit.ts - ALREADY EXISTS!
export type UnitType = 'Στούντιο' | 'Γκαρσονιέρα' | 'Διαμέρισμα 2Δ' | 'Διαμέρισμα 3Δ' | 'Μεζονέτα' | 'Κατάστημα' | 'Αποθήκη';
```

**Decision**:
- KEEP existing Greek UnitType values (no breaking change)
- New lookups (Orientation, ViewType, Features) can be created in English
- Use i18n for display labels

---

### 3️⃣ **Canonical Naming: floorId**

#### ❌ INCONSISTENT (spec mixed):
```typescript
floorId: string;  // Sometimes
levelId: string;  // Sometimes
floor: number;    // Sometimes
```

#### ✅ CANONICAL (everywhere):
```typescript
floorId: string;  // Reference to Floor document
floor: number;    // Numeric floor level (0, 1, 2, -1, etc)
```

**Rule**:
- `floorId` = document reference
- `floor` = numeric level
- NO `levelId` (avoid confusion)

---

### 4️⃣ **Facets Recompute Strategy**

#### ADD to Phase 3 specification:

```typescript
/**
 * FACETS RECOMPUTE TRIGGERS & FAN-OUT STRATEGY
 *
 * Triggers:
 * 1. Unit changes → recompute unit facets only
 * 2. Building changes → batch recompute all units in building
 * 3. Project changes → batch recompute all units in project
 * 4. LinkedSpace changes → recompute affected unit
 * 5. SellableAsset changes → recompute price facets
 *
 * Fan-out Rules:
 * - Max 500 units per batch (Firestore limit)
 * - Use Cloud Tasks for large batches
 * - Implement exponential backoff
 * - Track progress in FacetsRecomputeJob collection
 */

interface FacetsRecomputeJob {
  id: string;
  triggerType: 'unit' | 'building' | 'project' | 'linked' | 'sale';
  triggerId: string;      // ID of changed entity
  affectedUnits: string[]; // Units to recompute
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;        // 0-100
  startedAt: Timestamp;
  completedAt?: Timestamp;
  error?: string;
}
```

---

## 📋 UPDATED TYPE DEFINITIONS

### **Centralized Timestamp Type**
```typescript
// src/types/common/firestore-types.ts
import { Timestamp } from 'firebase/firestore';

export type FirestoreTimestamp = Timestamp;
export type FirestoreDate = FirestoreTimestamp; // Alias for clarity
```

### **Updated Unit Interface**
```typescript
import { FirestoreTimestamp } from '@/types/common/firestore-types';

interface UnitFields {
  // ... all other fields ...

  // Dates - ALL use FirestoreTimestamp
  deliveryDate?: FirestoreTimestamp;
  renovationYear?: number;  // Year stays as number (2024, not timestamp)

  energy?: {
    class: EnergyClass;
    certificateId?: string;
    certificateDate?: FirestoreTimestamp;  // Was Date
    validUntil?: FirestoreTimestamp;       // Was Date
  };

  unitCoverage: {
    hasPhotos: boolean;
    hasFloorplans: boolean;
    hasDocuments: boolean;
    updatedAt: FirestoreTimestamp;  // Already correct
  };
}
```

### **New Lookups Location**
```typescript
// src/constants/unit-lookups-extended.ts
// (to avoid collision with existing constants)

export const Orientation = {
  N: 'north',
  NE: 'northeast',
  E: 'east',
  SE: 'southeast',
  S: 'south',
  SW: 'southwest',
  W: 'west',
  NW: 'northwest'
} as const;

export const ViewType = {
  SEA: 'sea',
  MOUNTAIN: 'mountain',
  CITY: 'city',
  PARK: 'park',
  GARDEN: 'garden'
} as const;

export const InteriorFeature = {
  FIREPLACE: 'fireplace',
  JACUZZI: 'jacuzzi',
  SMART_HOME: 'smart-home',
  ALARM: 'alarm',
  // ... etc
} as const;

// KEEP existing UnitType from src/types/unit.ts
```

---

## ✅ QUALITY GATES FOR PHASE 1

Before starting Phase 1 implementation:

1. [ ] Confirm all dates use `FirestoreTimestamp`
2. [ ] Confirm reusing existing `UnitType`
3. [ ] Confirm `floorId` naming everywhere
4. [ ] Document fan-out strategy in Cloud Functions plan
5. [ ] Create migration plan for existing data
6. [ ] Review with ChatGPT for final approval

---

## 📊 VERSION HISTORY

- **v1.0.0**: Original specification (Claude + ChatGPT consensus)
- **v1.0.1**: Hardening patch (4 blockers fixed)
  - Date → Timestamp
  - Reuse existing UnitType
  - Canonical floorId
  - Fan-out recompute strategy

---

**This patch addresses ALL blockers identified by ChatGPT.**