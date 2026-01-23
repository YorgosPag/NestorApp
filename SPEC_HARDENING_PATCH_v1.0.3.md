# 📝 SPEC HARDENING PATCH v1.0.3 - FINAL ENTERPRISE FIXES
**Base Document**: UNIT_FIELDS_FINAL_SPECIFICATION.md v1.0.2
**Date**: 2026-01-23
**Requested by**: ChatGPT (5 Critical Blockers)
**Prepared by**: Claude

---

## 🚨 CRITICAL BLOCKERS FIXED (v1.0.3)

### 1️⃣ **ZERO ANY - Fixed Query Value Type**

#### ❌ WRONG (v1.0.2 - violates ZERO any):
```typescript
interface FacetsRecomputeJob {
  query: {
    where: Array<{
      field: string;
      operator: FirebaseFirestore.WhereFilterOp; // SDK coupling!
      value: any; // ❌ VIOLATION: any is forbidden!
    }>;
  };
}
```

#### ✅ CORRECT (v1.0.3 - enterprise compliant):
```typescript
// SDK-agnostic types (no Firebase imports in contracts!)
type WhereOperator = '==' | '!=' | '<' | '<=' | '>' | '>=' |
                      'array-contains' | 'array-contains-any' |
                      'in' | 'not-in';

type QueryValue = string | number | boolean | null |
                  string[] | number[]; // Union, NOT any!

interface FacetsRecomputeJob {
  id: string;
  triggerType: 'unit' | 'building' | 'project' | 'linked' | 'sale';
  triggerId: string;

  // SDK-agnostic query specification
  query: {
    collection: 'units';
    where: Array<{
      field: string;
      operator: WhereOperator;  // String union, not SDK type
      value: QueryValue;         // Strict union, not any!
    }>;
    orderBy?: string;
  };

  // Progress tracking (unchanged)
  lastProcessedDocId?: string;
  processedCount: number;
  totalEstimated: number;
  batchSize: number;

  // Status & timing (using existing Timestamp import)
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Timestamp;  // Already imported in src/types/unit.ts
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  error?: string;
  retryCount: number;
}
```

---

### 2️⃣ **Fix Type Export for UnitType**

#### ❌ WRONG (v1.0.2 - will break):
```typescript
// src/constants/unit-lookups.ts
export { UnitType } from '@/types/unit'; // Wrong for type alias!
```

#### ✅ CORRECT (v1.0.3):
```typescript
// src/constants/unit-lookups.ts
// Re-export the TYPE (not value)
export type { UnitType } from '@/types/unit';

// Or if we need the values, import and re-export:
import type { UnitType } from '@/types/unit';
export type { UnitType };
```

---

### 3️⃣ **Use Existing Timestamp Import Pattern**

#### PRE-CHECK RESULT:
- `Timestamp` is already imported in multiple places
- Pattern: `import type { Timestamp } from 'firebase/firestore'`
- NO need for new firestore-types.ts file!

#### ✅ CORRECT (v1.0.3 - reuse existing):
```typescript
// In Unit interface and all other types
import type { Timestamp } from 'firebase/firestore';

interface UnitFields {
  // ... other fields ...

  deliveryDate?: Timestamp;  // NOT Date, NOT custom type

  energy?: {
    class: EnergyClass;
    certificateId?: string;
    certificateDate?: Timestamp;
    validUntil?: Timestamp;
  };

  unitCoverage: {
    hasPhotos: boolean;
    hasFloorplans: boolean;
    hasDocuments: boolean;
    updatedAt: Timestamp;  // Already correct
  };
}
```

---

### 4️⃣ **Migration Strategy - UnitDoc vs UnitModel**

#### NEW ADDITION - Required for Phase 1:

```typescript
/**
 * MIGRATION STRATEGY: Legacy Support + Normalization
 *
 * Problem: Existing units don't have all new fields
 * Solution: Two-layer approach
 */

// Layer 1: Firestore Document (allows missing fields)
interface UnitDoc {
  // All fields optional for legacy compatibility
  id?: string;
  name?: string;
  type?: UnitType;

  // New fields are optional during migration
  orientations?: string[];
  views?: Array<{ type: string; quality?: string }>;
  interiorFeatures?: string[];
  securityFeatures?: string[];
  unitCoverage?: Partial<{
    hasPhotos: boolean;
    hasFloorplans: boolean;
    hasDocuments: boolean;
    updatedAt: Timestamp;
  }>;
}

// Layer 2: Application Model (normalized with defaults)
interface UnitModel {
  // All fields have values (never undefined in app)
  id: string;
  name: string;
  type: UnitType;

  // Arrays default to empty
  orientations: string[];
  views: Array<{ type: string; quality?: string }>;
  interiorFeatures: string[];
  securityFeatures: string[];

  // Coverage defaults to false
  unitCoverage: {
    hasPhotos: boolean;
    hasFloorplans: boolean;
    hasDocuments: boolean;
    updatedAt: Timestamp;
  };
}

// Normalizer function (at repository boundary)
function normalizeUnit(doc: UnitDoc): UnitModel {
  return {
    id: doc.id || '',
    name: doc.name || 'Unnamed Unit',
    type: doc.type || 'Διαμέρισμα 2Δ',

    // Arrays default to empty
    orientations: doc.orientations || [],
    views: doc.views || [],
    interiorFeatures: doc.interiorFeatures || [],
    securityFeatures: doc.securityFeatures || [],

    // Coverage with defaults
    unitCoverage: {
      hasPhotos: doc.unitCoverage?.hasPhotos ?? false,
      hasFloorplans: doc.unitCoverage?.hasFloorplans ?? false,
      hasDocuments: doc.unitCoverage?.hasDocuments ?? false,
      updatedAt: doc.unitCoverage?.updatedAt || Timestamp.now()
    }
  };
}
```

#### BACKFILL PLAN:

```typescript
/**
 * BACKFILL STRATEGY (Phase 1, Task 1)
 *
 * 1. Create Cloud Function: backfillUnitFields
 * 2. Process in batches of 500
 * 3. For each unit:
 *    - Add missing arrays as []
 *    - Add unitCoverage with false defaults
 *    - Preserve existing data
 * 4. Track progress in BackfillJob collection
 * 5. Estimated time: ~2 hours for 10,000 units
 */

interface BackfillJob {
  id: string;
  type: 'unit-fields-v1.0.3';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: {
    total: number;
    processed: number;
    failed: number;
  };
  startedAt: Timestamp;
  completedAt?: Timestamp;
  lastProcessedId?: string;
}
```

---

### 5️⃣ **Canonical Constants Location (Final Decision)**

#### PRE-CHECK RESULT:
- NO existing orientation/view/feature constants
- NO existing src/constants/unit-lookups.ts
- Existing pattern: src/constants/property-statuses-enterprise.ts

#### ✅ DECISION (v1.0.3):
```typescript
// CREATE NEW: src/constants/unit-features-enterprise.ts
// (follows existing naming pattern)

import type { UnitType } from '@/types/unit'; // Type re-export
export type { UnitType };

// All new lookups here (canonical location)
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
  SAUNA: 'sauna',
  UNDERFLOOR_HEATING: 'underfloor-heating'
} as const;

export const SecurityFeature = {
  ALARM: 'alarm',
  SECURITY_DOOR: 'security-door',
  CCTV: 'cctv',
  ACCESS_CONTROL: 'access-control',
  INTERCOM: 'intercom'
} as const;

// Type exports for type safety
export type OrientationType = typeof Orientation[keyof typeof Orientation];
export type ViewTypeValue = typeof ViewType[keyof typeof ViewType];
export type InteriorFeatureCode = typeof InteriorFeature[keyof typeof InteriorFeature];
export type SecurityFeatureCode = typeof SecurityFeature[keyof typeof SecurityFeature];
```

---

## 📋 UPDATED CANONICAL SPECIFICATION (v1.0.3)

This REPLACES all previous versions. Single source of truth:

```typescript
// src/types/unit-extended.ts (or extend existing unit.ts)
import type { Timestamp } from 'firebase/firestore';
import type { UnitType } from './unit'; // EXISTING Greek values
import type {
  OrientationType,
  ViewTypeValue,
  InteriorFeatureCode,
  SecurityFeatureCode
} from '@/constants/unit-features-enterprise';

interface UnitFields {
  // === IDENTITY ===
  id: string;
  code?: string;
  name: string;
  type: UnitType;  // REUSE: 'Στούντιο' | 'Γκαρσονιέρα' | etc
  useCategory: 'residential' | 'commercial' | 'mixed';

  // === HIERARCHY (canonical naming) ===
  projectId: string;
  buildingId: string;
  floorId: string;    // NOT levelId
  floor: number;      // Numeric level

  // === ALL DATES USE TIMESTAMP ===
  deliveryDate?: Timestamp;      // NOT Date
  renovationYear?: number;        // Year as number is OK

  // === ENERGY ===
  energy?: {
    class: 'A+' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
    certificateId?: string;
    certificateDate?: Timestamp;  // NOT Date
    validUntil?: Timestamp;       // NOT Date
  };

  // === FEATURES (Arrays, NO booleans) ===
  orientations: OrientationType[];
  views: Array<{
    type: ViewTypeValue;
    quality?: 'full' | 'partial' | 'distant';
  }>;
  interiorFeatures: InteriorFeatureCode[];
  securityFeatures: SecurityFeatureCode[];

  // === COVERAGE (explicit booleans for queries) ===
  unitCoverage: {
    hasPhotos: boolean;
    hasFloorplans: boolean;
    hasDocuments: boolean;
    updatedAt: Timestamp;
  };

  // ... other fields remain same ...
}
```

---

## ✅ QUALITY GATES FOR PHASE 1 (FINAL v1.0.3)

ALL must be checked before Phase 1 starts:

1. ✅ **ZERO any** - QueryValue is strict union
2. ✅ **NO SDK coupling** - WhereOperator is string union
3. ✅ **Correct type exports** - `export type { UnitType }`
4. ✅ **Timestamps everywhere** - No Date, no aliases
5. ✅ **Migration strategy defined** - UnitDoc vs UnitModel
6. ✅ **Backfill plan ready** - Cloud Function spec
7. ✅ **Constants canonical** - unit-features-enterprise.ts
8. ✅ **Single source spec** - This v1.0.3 is authoritative

---

## 📊 VERSION HISTORY

- **v1.0.0**: Original specification (95% consensus)
- **v1.0.1**: First hardening (4 fixes)
- **v1.0.2**: Enterprise fixes (4 more blockers)
- **v1.0.3**: FINAL - All blockers resolved
  - Fixed ZERO any violation
  - Removed SDK coupling
  - Added migration strategy
  - Unified canonical spec

---

**Phase 1 can start after ChatGPT approves this v1.0.3**