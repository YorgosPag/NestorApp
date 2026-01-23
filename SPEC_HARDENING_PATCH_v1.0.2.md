# 📝 SPEC HARDENING PATCH v1.0.2
**Base Document**: UNIT_FIELDS_FINAL_SPECIFICATION.md v1.0.1
**Date**: 2026-01-23
**Requested by**: ChatGPT (Enterprise Blockers)
**Prepared by**: Claude

---

## 🚨 FINAL ENTERPRISE FIXES (v1.0.2)

### 1️⃣ **Remove FirestoreDate Alias**

#### ❌ WRONG (v1.0.1):
```typescript
export type FirestoreTimestamp = Timestamp;
export type FirestoreDate = FirestoreTimestamp; // ❌ Confusing alias!
```

#### ✅ CORRECT (v1.0.2):
```typescript
// src/types/common/firestore-types.ts
import { Timestamp } from 'firebase/firestore';

export type FirestoreTimestamp = Timestamp;
// NO FirestoreDate alias - use FirestoreTimestamp everywhere
```

**Rule**: ONE canonical time type: `FirestoreTimestamp`. Period.

---

### 2️⃣ **FacetsRecomputeJob - Scalable Design**

#### ❌ WRONG (v1.0.1 - doesn't scale):
```typescript
interface FacetsRecomputeJob {
  affectedUnits: string[]; // ❌ Can exceed 1MB doc limit!
}
```

#### ✅ CORRECT (v1.0.2 - enterprise scale):
```typescript
interface FacetsRecomputeJob {
  id: string;
  triggerType: 'unit' | 'building' | 'project' | 'linked' | 'sale';
  triggerId: string;           // ID of changed entity

  // Query specification instead of ID array
  query: {
    collection: 'units';
    where: Array<{
      field: string;
      operator: FirebaseFirestore.WhereFilterOp;
      value: any;
    }>;
    orderBy?: string;
  };

  // Progress tracking
  lastProcessedDocId?: string;  // Cursor for pagination
  processedCount: number;        // Units processed so far
  totalEstimated: number;        // Estimated total (from count query)
  batchSize: number;            // Units per batch (default 500)

  // Status & timing
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: FirestoreTimestamp;
  startedAt?: FirestoreTimestamp;
  completedAt?: FirestoreTimestamp;
  error?: string;
  retryCount: number;
}

// Example for building change:
const job: FacetsRecomputeJob = {
  triggerType: 'building',
  triggerId: 'building-123',
  query: {
    collection: 'units',
    where: [
      { field: 'buildingId', operator: '==', value: 'building-123' }
    ],
    orderBy: '__name__'  // Document ID for stable pagination
  },
  lastProcessedDocId: undefined,
  processedCount: 0,
  totalEstimated: 250,  // From count query
  batchSize: 500,
  status: 'pending',
  createdAt: Timestamp.now(),
  retryCount: 0
};
```

---

### 3️⃣ **Canonical Constants Location**

#### PRE-CHECK REQUIRED:
```bash
# Check for existing canonical constants
grep -r "export.*const.*ORIENTATION\|export.*const.*VIEW_TYPE" src/
grep -r "domain-constants\|app-constants\|system-constants" src/
ls -la src/config/
ls -la src/constants/
```

#### DECISION TREE:
```
IF exists(src/config/domain-constants.ts) THEN
  → Extend that file with new lookups
ELSE IF exists(src/constants/index.ts) THEN
  → Add new lookups there
ELSE
  → Create src/constants/unit-lookups.ts (NOT "extended")
  → Document as THE canonical location
  → Add to centralized_systems.md
```

#### ✅ FINAL STRUCTURE (no "extended"):
```typescript
// src/constants/unit-lookups.ts
// THE canonical location for all unit-related lookups

// REUSE existing UnitType from src/types/unit.ts
export { UnitType } from '@/types/unit';

// NEW lookups (English codes, Greek via i18n)
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
  SAUNA: 'sauna'
} as const;

export const SecurityFeature = {
  ALARM: 'alarm',
  SECURITY_DOOR: 'security-door',
  CCTV: 'cctv',
  ACCESS_CONTROL: 'access-control'
} as const;

// Type exports
export type OrientationType = typeof Orientation[keyof typeof Orientation];
export type ViewTypeValue = typeof ViewType[keyof typeof ViewType];
export type InteriorFeatureCode = typeof InteriorFeature[keyof typeof InteriorFeature];
export type SecurityFeatureCode = typeof SecurityFeature[keyof typeof SecurityFeature];
```

---

### 4️⃣ **Implementation Tracker Correction**

#### ❌ WRONG (misleading):
```markdown
**Started**: 2026-01-23  // Wrong! Implementation hasn't started
```

#### ✅ CORRECT:
```markdown
**Started**: TBD (will be filled when Phase 1 implementation begins)
**Spec Hardening Completed**: 2026-01-23
```

---

## 📋 FINAL TYPE DEFINITIONS (v1.0.2)

### **Unit Interface with ALL Corrections**
```typescript
import { FirestoreTimestamp } from '@/types/common/firestore-types';
import { UnitType } from '@/types/unit'; // EXISTING
import {
  OrientationType,
  ViewTypeValue,
  InteriorFeatureCode,
  SecurityFeatureCode
} from '@/constants/unit-lookups'; // NEW canonical location

interface UnitFields {
  // Identity
  id: string;
  code?: string;
  name: string;
  type: UnitType;  // REUSE existing Greek values
  useCategory: 'residential' | 'commercial' | 'mixed';

  // Hierarchy (canonical naming)
  projectId: string;
  buildingId: string;
  floorId: string;    // NOT levelId
  floor: number;      // Numeric level

  // Areas
  areas: {
    gross: number;
    net?: number;
    balcony?: number;
    terrace?: number;
    garden?: number;
  };

  // Layout
  layout: {
    bedrooms?: number;
    bathrooms?: number;
    wc?: number;
    totalRooms?: number;
    levels?: number;
    balconies?: number;
  };

  // Orientation & Views
  orientations: OrientationType[];  // Array for corner units
  views: Array<{
    type: ViewTypeValue;
    quality?: 'full' | 'partial' | 'distant';
  }>;

  // Dates - ALL use FirestoreTimestamp (no Date, no alias)
  deliveryDate?: FirestoreTimestamp;
  renovationYear?: number;  // Year as number is OK

  // Energy
  energy?: {
    class: 'A+' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
    certificateId?: string;
    certificateDate?: FirestoreTimestamp;  // NOT Date
    validUntil?: FirestoreTimestamp;       // NOT Date
  };

  // Features (NO booleans!)
  interiorFeatures: InteriorFeatureCode[];
  securityFeatures: SecurityFeatureCode[];

  // Coverage (queryable contract)
  unitCoverage: {
    hasPhotos: boolean;         // Explicit true/false
    hasFloorplans: boolean;     // Explicit true/false
    hasDocuments: boolean;      // Explicit true/false
    updatedAt: FirestoreTimestamp;
  };
}
```

---

## ✅ QUALITY GATES FOR PHASE 1 (FINAL)

Before starting Phase 1:
1. ✅ All dates use `FirestoreTimestamp` (no Date, no alias)
2. ✅ Reusing existing `UnitType` from `src/types/unit.ts`
3. ✅ Using `floorId` naming everywhere
4. ✅ FacetsRecomputeJob uses query spec, not ID arrays
5. ✅ Constants in canonical location (determined by pre-check)
6. ✅ Implementation Tracker shows correct dates
7. ⏳ Migration plan for existing data
8. ⏳ Final ChatGPT approval of v1.0.2

---

## 📊 VERSION HISTORY

- **v1.0.0**: Original specification (95% consensus)
- **v1.0.1**: First hardening (4 fixes by ChatGPT)
- **v1.0.2**: Final hardening (4 enterprise blockers fixed)
  - Removed confusing FirestoreDate alias
  - Scalable FacetsRecomputeJob design
  - Canonical constants location
  - Correct tracker dates

---

**This v1.0.2 patch addresses ALL enterprise blockers. Ready for Phase 1 after approval.**