# 📋 UNIT FIELDS - ENTERPRISE FINAL SPECIFICATION v1.0.4
**Version**: 1.0.4
**Date**: 2026-01-23
**Status**: DRAFT / Pending approval by Γιώργος
**Authors**: Claude + ChatGPT Analysis + Enterprise Review

---

## 🎯 EXECUTIVE AGREEMENT

After thorough analysis and cross-validation between Claude and ChatGPT, we have reached **95% consensus** on an enterprise-grade specification that:

1. ✅ **Respects existing architecture**: Physical Spaces vs Sellable Assets separation
2. ✅ **Implements Single Source of Truth**: No data duplication
3. ✅ **Uses enterprise patterns**: Arrays/lookups, computed projections, metadata-driven
4. ✅ **Is Firestore-compatible**: Facets pattern for queryable filters
5. ✅ **Is future-proof**: Extensible structures, clear inheritance rules

---

## 🏗️ DATA HIERARCHY & FIELD OWNERSHIP

### 📍 **PROJECT LEVEL** (Source of Truth)
```typescript
interface ProjectFields {
  // Location (NEVER duplicate in Unit)
  address: string;           // Full postal address
  city: string;             // City/region
  geo?: GeoPoint;           // Coordinates for map/distance calculations

  // Optional location context
  locationContextTags?: LocationTag[];  // ['nearSea', 'nearMetro', 'quietArea']

  // Project metadata (inherited by all children)
  constructionCompany: string;
  architect?: string;
  permitNumber?: string;
}
```

### 🏢 **BUILDING LEVEL** (Shared Amenities + Defaults)
```typescript
interface BuildingFields {
  // Identity
  name: string;              // "Building A"
  buildingType: BuildingType;

  // Shared amenities (inherited by units for display)
  sharedAmenities: AmenityCode[];  // ['pool', 'elevator', 'gym', 'doorman']

  // System defaults (can be overridden by units)
  systemsDefaults: {
    heatingType?: HeatingType;
    heatingFuel?: FuelType;
    coolingType?: CoolingType;
    waterHeating?: WaterHeatingType;
  };

  // Optional override (rare case)
  buildingAddressOverride?: string;  // Only if different from project
}
```

### 🏠 **UNIT LEVEL** (Physical Space Truth)
```typescript
interface UnitFields {
  // === IDENTITY ===
  id: string;                    // System ID
  code?: string;                 // Human-readable "A-101"
  name: string;                  // "Apartment A1"
  type: UnitType;               // REUSE existing: 'Διαμέρισμα 2Δ', 'Στούντιο', etc
  useCategory: 'residential' | 'commercial' | 'mixed';

  // === HIERARCHY REFS (for inheritance) ===
  projectId: string;
  buildingId: string;
  floorId: string;

  // === AREAS (measurements) ===
  areas: {
    gross: number;              // Total area (required)
    net?: number;               // Usable area
    balcony?: number;           // Balcony area
    terrace?: number;           // Terrace area
    garden?: number;            // Garden area (ground floor)
  };

  // === LAYOUT (room configuration) ===
  layout: {
    bedrooms?: number;
    bathrooms?: number;
    wc?: number;               // Separate WC
    totalRooms?: number;       // Total room count
    levels?: number;           // For maisonettes
    balconies?: number;        // Number of balconies
  };

  // === ORIENTATION & VIEWS ===
  orientations: OrientationType[];   // ['N', 'E'] for corner unit
  views: Array<{
    type: ViewTypeValue;       // 'sea' | 'mountain' | 'city' | 'park'
    quality?: ViewQuality;     // 'full' | 'partial' | 'distant'
  }>;

  // === CONDITION & READINESS ===
  operationalStatus: OperationalStatus;  // 'ready' | 'under-construction'
  condition?: ConditionType;             // 'new' | 'excellent' | 'good' | 'needs-renovation'
  renovationYear?: number;                // If unit was renovated
  deliveryDate?: Timestamp;              // Expected delivery (Firestore Timestamp)

  // === SYSTEMS (with override capability) ===
  systemsOverride?: Partial<{
    heatingType: HeatingType;
    heatingFuel: FuelType;
    coolingType: CoolingType;
    waterHeating: WaterHeatingType;
  }>;

  // === ENERGY PERFORMANCE ===
  energy?: {
    class: EnergyClass;         // 'A+' | 'A' | 'B' | ... | 'G'
    certificateId?: string;
    certificateDate?: Timestamp;  // Firestore Timestamp
    validUntil?: Timestamp;        // Firestore Timestamp
  };

  // === MATERIALS & FINISHES ===
  finishes: {
    flooring?: FlooringType[];  // ['tiles', 'wood']
    windowFrames?: FrameType;   // 'aluminum' | 'pvc' | 'wood'
    glazing?: GlazingType;      // 'single' | 'double' | 'triple' | 'energy'
  };

  // === FEATURES (NO BOOLEANS!) ===
  interiorFeatures: InteriorFeatureCode[];     // ['fireplace', 'jacuzzi', 'smartHome']
  securityFeatures: SecurityFeatureCode[];    // ['alarm', 'securityDoor', 'cctv']
  unitAmenities?: AmenityCode[];       // Private amenities if needed

  // === DOCUMENTATION COVERAGE ===
  unitCoverage: {
    hasPhotos: boolean;         // MUST be explicit true/false
    hasFloorplans: boolean;     // MUST be explicit true/false
    hasDocuments: boolean;      // MUST be explicit true/false
    hasVirtualTour?: boolean;   // Optional future field
    has3DModel?: boolean;       // Optional future field
    updatedAt: Timestamp;       // Firestore Timestamp (NOT Date)
  };
}
```

### 🚗 **LINKED SPACES** (Relationships, NOT Booleans)
```typescript
interface LinkedSpace {
  spaceId: string;              // ID of parking/storage space
  spaceType: 'parking' | 'storage';
  quantity: number;             // How many (for bundled spaces)
  inclusion: 'included' | 'optional' | 'rented';
  allocationCode?: string;      // "P-101"
  notes?: string;              // Additional info
}

// In Unit:
linkedSpaces?: LinkedSpace[];   // Relationships to parking/storage
```

---

## 🔄 INHERITANCE & MERGE RULES

### **1. Address Resolution**
```typescript
resolvedAddress = building.buildingAddressOverride ?? project.address
// Unit NEVER stores address
```

### **2. Systems Merge Rule**
```typescript
resolvedSystems[field] = unit.systemsOverride?.[field]
                       ?? building.systemsDefaults?.[field]
                       ?? null
```

### **3. Amenities Display**
```typescript
// Building amenities shown as context (read-only)
displayAmenities = {
  shared: building.sharedAmenities,    // From building
  private: unit.unitAmenities || []    // From unit
}
```

### **4. Location Context**
```typescript
resolvedLocation = {
  address: resolvedAddress,            // From project/building
  building: building.name,             // From building
  floor: floor.name,                   // From floor
  unit: unit.name,                     // From unit
  contextTags: project.locationContextTags  // From project
}
```

---

## 🔍 FACETS (Computed Search Index)

### **Purpose**: Enable fast Firestore queries without joins

### **Rules**:
1. ✅ **COMPUTED ONLY** - Never manually edited
2. ✅ **SERVER-SIDE ONLY** - Cloud Functions maintain them
3. ✅ **AUDITED** - Every update logged with timestamp
4. ✅ **VERSIONED** - For migration compatibility

### **Facet Structure**:
```typescript
interface UnitFacets {
  // Derived booleans for filters
  hasParking: boolean;         // linkedSpaces.some(s => s.spaceType === 'parking')
  hasStorage: boolean;         // linkedSpaces.some(s => s.spaceType === 'storage')
  hasFireplace: boolean;       // interiorFeatures.includes('fireplace')
  hasView: boolean;           // views.length > 0
  hasPool: boolean;           // building.sharedAmenities.includes('pool')
  hasElevator: boolean;       // building.sharedAmenities.includes('elevator')

  // Computed metrics
  pricePerSqm?: number;       // From SellableAsset.price / unit.areas.gross
  totalArea: number;          // Sum of all areas

  // Metadata
  computedAt: Timestamp;      // When computed
  computedBy: string;         // Function name
  version: number;           // Schema version
}
```

### **Facets Recompute Job (Enterprise Scale)**:
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

  // Progress tracking
  lastProcessedDocId?: string;
  processedCount: number;
  totalEstimated: number;
  batchSize: number;

  // Status & timing
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  error?: string;
  retryCount: number;
}
```

---

## 🚫 CRITICAL DECISIONS (NO CONFLICTS!)

### ❌ **NO BOOLEAN EXPLOSION**
```typescript
// WRONG (old proposal had these):
interface WrongAmenities {
  hasFireplace?: boolean;  // ❌ NO!
  hasJacuzzi?: boolean;   // ❌ NO!
  hasAlarm?: boolean;     // ❌ NO!
}

// CORRECT:
interiorFeatures: ['fireplace', 'jacuzzi']  // ✅ Arrays!
```

### ❌ **NO CUSTOM LABELS PER ENTRY**
```typescript
// WRONG:
features: [{
  code: 'fireplace',
  customLabel: { el: 'Τζάκι', en: 'Fireplace' }  // ❌ NO!
}]

// CORRECT:
features: ['fireplace']  // ✅ Use i18n keys: features.fireplace
```

### ❌ **NO PRICE IN UNIT**
```typescript
// WRONG:
unit.price = 200000;           // ❌ NO! Price belongs to SellableAsset
unit.pricePerSqm = 2000;       // ❌ NO! Computed from SellableAsset

// CORRECT:
sellableAsset.price = 200000;  // ✅ In sales domain
facets.pricePerSqm = 2000;     // ✅ Computed projection
```

---

## 📊 LOOKUP ENUMS (Centralized)

### **CANONICAL LOCATION (FINAL DECISION)**
Based on pre-check evidence and existing patterns, the canonical constants file is:

**`src/constants/unit-features-enterprise.ts`** - Following existing naming pattern

```typescript
// src/constants/unit-features-enterprise.ts
import type { Timestamp } from 'firebase/firestore';

// REUSE EXISTING from src/types/unit.ts
export type { UnitType } from '@/types/unit';

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
  GARDEN: 'garden',
  COURTYARD: 'courtyard'
} as const;

export const InteriorFeature = {
  FIREPLACE: 'fireplace',
  JACUZZI: 'jacuzzi',
  SAUNA: 'sauna',
  SMART_HOME: 'smart-home',
  SOLAR_PANELS: 'solar-panels',
  UNDERFLOOR_HEATING: 'underfloor-heating',
  AIR_CONDITIONING: 'air-conditioning',
  ALARM_SYSTEM: 'alarm-system'
} as const;

export const SecurityFeature = {
  ALARM: 'alarm',
  SECURITY_DOOR: 'security-door',
  CCTV: 'cctv',
  ACCESS_CONTROL: 'access-control',
  INTERCOM: 'intercom',
  MOTION_SENSORS: 'motion-sensors'
} as const;

export const AmenityCode = {
  POOL: 'pool',
  ELEVATOR: 'elevator',
  GYM: 'gym',
  DOORMAN: 'doorman',
  GARDEN: 'garden',
  PLAYGROUND: 'playground',
  PARKING_GARAGE: 'parking-garage'
} as const;

export const EnergyClass = {
  A_PLUS: 'A+',
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  E: 'E',
  F: 'F',
  G: 'G'
} as const;

// Type exports for TypeScript safety
export type OrientationType = typeof Orientation[keyof typeof Orientation];
export type ViewTypeValue = typeof ViewType[keyof typeof ViewType];
export type InteriorFeatureCode = typeof InteriorFeature[keyof typeof InteriorFeature];
export type SecurityFeatureCode = typeof SecurityFeature[keyof typeof SecurityFeature];
export type AmenityCodeType = typeof AmenityCode[keyof typeof AmenityCode];
export type EnergyClassType = typeof EnergyClass[keyof typeof EnergyClass];

export type ViewQuality = 'full' | 'partial' | 'distant';
export type OperationalStatus = 'ready' | 'under-construction';
export type ConditionType = 'new' | 'excellent' | 'good' | 'needs-renovation';
export type HeatingType = 'central' | 'autonomous' | 'heat-pump' | 'solar' | 'none';
export type FuelType = 'natural-gas' | 'oil' | 'electricity' | 'solar' | 'heat-pump';
export type CoolingType = 'central-air' | 'split-units' | 'fan-coil' | 'none';
export type WaterHeatingType = 'electric' | 'gas' | 'solar' | 'heat-pump';
export type FlooringType = 'tiles' | 'wood' | 'laminate' | 'marble' | 'carpet';
export type FrameType = 'aluminum' | 'pvc' | 'wood';
export type GlazingType = 'single' | 'double' | 'triple' | 'energy';
export type BuildingType = 'apartment-complex' | 'villa' | 'maisonette' | 'commercial';
export type LocationTag = 'nearSea' | 'nearMetro' | 'quietArea' | 'cityCenter' | 'suburban';
```

---

## 📋 MIGRATION STRATEGY

### **UnitDoc vs UnitModel Pattern**
```typescript
// Layer 1: Firestore Document (allows missing fields)
interface UnitDoc {
  // Legacy compatibility - all new fields optional
  id?: string;
  name?: string;
  type?: UnitType;

  // New fields are optional during migration
  orientations?: OrientationType[];
  views?: Array<{ type: ViewTypeValue; quality?: ViewQuality }>;
  interiorFeatures?: InteriorFeatureCode[];
  securityFeatures?: SecurityFeatureCode[];
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
  orientations: OrientationType[];
  views: Array<{ type: ViewTypeValue; quality?: ViewQuality }>;
  interiorFeatures: InteriorFeatureCode[];
  securityFeatures: SecurityFeatureCode[];

  // Coverage defaults to false
  unitCoverage: {
    hasPhotos: boolean;
    hasFloorplans: boolean;
    hasDocuments: boolean;
    updatedAt: Timestamp;
  };
}
```

### **Normalizer Contract (NO Hardcoded Defaults)**
```typescript
// CLEAN normalizer - NO hardcoded domain defaults
function normalizeUnit(doc: UnitDoc, backfillData?: BackfillDefaults): UnitModel {
  // POST-BACKFILL: All fields required
  if (!backfillData) {
    if (!doc.id || !doc.name || !doc.type) {
      throw new Error('Invalid unit data: missing required fields post-backfill');
    }

    return {
      id: doc.id,
      name: doc.name,
      type: doc.type,
      orientations: doc.orientations || [],
      views: doc.views || [],
      interiorFeatures: doc.interiorFeatures || [],
      securityFeatures: doc.securityFeatures || [],
      unitCoverage: {
        hasPhotos: doc.unitCoverage?.hasPhotos ?? false,
        hasFloorplans: doc.unitCoverage?.hasFloorplans ?? false,
        hasDocuments: doc.unitCoverage?.hasDocuments ?? false,
        updatedAt: doc.unitCoverage?.updatedAt || (() => {
          throw new Error('unitCoverage.updatedAt required post-backfill');
        })()
      }
    };
  }

  // PRE-BACKFILL: Use provided defaults
  return {
    id: doc.id || backfillData.id,
    name: doc.name || backfillData.name,
    type: doc.type || backfillData.type,
    orientations: doc.orientations || [],
    views: doc.views || [],
    interiorFeatures: doc.interiorFeatures || [],
    securityFeatures: doc.securityFeatures || [],
    unitCoverage: {
      hasPhotos: doc.unitCoverage?.hasPhotos ?? false,
      hasFloorplans: doc.unitCoverage?.hasFloorplans ?? false,
      hasDocuments: doc.unitCoverage?.hasDocuments ?? false,
      updatedAt: backfillData.updatedAt // Server-provided timestamp
    }
  };
}

interface BackfillDefaults {
  id: string;           // Generated by server
  name: string;         // Business logic derived
  type: UnitType;       // Business logic derived
  updatedAt: Timestamp; // Server timestamp, NOT Timestamp.now()
}
```

---

## 🔧 TYPE DEFINITIONS (src/types/unit.ts EXTENSION)

**CANONICAL PATH**: Extend existing `src/types/unit.ts` (NOT separate file)

```typescript
// APPEND to existing src/types/unit.ts
import type { Timestamp } from 'firebase/firestore';
import type {
  OrientationType,
  ViewTypeValue,
  ViewQuality,
  InteriorFeatureCode,
  SecurityFeatureCode,
  AmenityCodeType,
  EnergyClassType,
  OperationalStatus,
  ConditionType,
  HeatingType,
  FuelType,
  CoolingType,
  WaterHeatingType,
  FlooringType,
  FrameType,
  GlazingType
} from '@/constants/unit-features-enterprise';

// Extended Unit interface (merges with existing)
interface UnitFieldsExtended {
  // Identity (extends existing)
  code?: string;
  useCategory: 'residential' | 'commercial' | 'mixed';

  // Hierarchy
  floorId: string;

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
  orientations: OrientationType[];
  views: Array<{
    type: ViewTypeValue;
    quality?: ViewQuality;
  }>;

  // Condition & Readiness
  operationalStatus: OperationalStatus;
  condition?: ConditionType;
  renovationYear?: number;
  deliveryDate?: Timestamp;

  // Systems
  systemsOverride?: Partial<{
    heatingType: HeatingType;
    heatingFuel: FuelType;
    coolingType: CoolingType;
    waterHeating: WaterHeatingType;
  }>;

  // Energy
  energy?: {
    class: EnergyClassType;
    certificateId?: string;
    certificateDate?: Timestamp;
    validUntil?: Timestamp;
  };

  // Materials
  finishes: {
    flooring?: FlooringType[];
    windowFrames?: FrameType;
    glazing?: GlazingType;
  };

  // Features
  interiorFeatures: InteriorFeatureCode[];
  securityFeatures: SecurityFeatureCode[];
  unitAmenities?: AmenityCodeType[];

  // Linked Spaces
  linkedSpaces?: Array<{
    spaceId: string;
    spaceType: 'parking' | 'storage';
    quantity: number;
    inclusion: 'included' | 'optional' | 'rented';
    allocationCode?: string;
    notes?: string;
  }>;
}

// Merge with existing Unit interface
export interface Unit extends UnitFieldsExtended {
  // ... existing Unit fields remain unchanged
}
```

---

## 🚀 IMPLEMENTATION PHASES

### **Phase 1: Domain Contracts** (1 week)
- [ ] Extend src/types/unit.ts with new fields
- [ ] Create src/constants/unit-features-enterprise.ts
- [ ] Create migration types (UnitDoc vs UnitModel)
- [ ] Create clean normalizer functions

### **Phase 2: Relationships** (3 days)
- [ ] Implement LinkedSpaces model
- [ ] Create linking UI components
- [ ] Update Firestore rules

### **Phase 3: Facets Engine** (1 week)
- [ ] Create Cloud Function for compute
- [ ] Implement audit logging
- [ ] Create backfill script
- [ ] Test query performance

### **Phase 4: UI Updates** (1 week)
- [ ] Update UnitListCard display
- [ ] Update PropertyDetailsContent
- [ ] Update filters to use facets
- [ ] Add new field sections

### **Phase 5: Data Entry** (1 week)
- [ ] Create/Update forms
- [ ] Add validation
- [ ] Implement bulk edit

---

## ✅ VALIDATION CHECKLIST

Before any Phase 1 implementation:

- [ ] NO hardcoded strings (use lookups from unit-features-enterprise.ts)
- [ ] NO boolean explosion (use arrays)
- [ ] NO manual facets (server-only)
- [ ] NO price in Unit (SellableAsset only)
- [ ] NO custom labels (use i18n keys)
- [ ] All coverage fields explicit boolean
- [ ] All timestamps are Firestore.Timestamp
- [ ] Inheritance rules documented
- [ ] TypeScript strict mode passes
- [ ] Lint passes
- [ ] NO "any" types anywhere
- [ ] NO SDK coupling in contracts
- [ ] ONE canonical constants file referenced everywhere

---

## 📚 QUALITY GATES FOR ΓΙΏΡΓΟΣ APPROVAL

### **SPEC-ONLY REQUIREMENTS (v1.0.4)**:
1. ✅ **Status corrected** - "DRAFT / Pending approval by Γιώργος"
2. ✅ **Version consistency** - v1.0.4 throughout all documents
3. ✅ **ONE canonical constants file** - unit-features-enterprise.ts everywhere
4. ✅ **NO hardcoded defaults** - Clean normalizer contracts
5. ✅ **Exact file paths** - No "or" statements, precise locations
6. ✅ **NO contradictions** - One canonical path per concept
7. ✅ **Enterprise compliance** - No any, no SDK coupling, proper types

### **IF CODE IS TOUCHED**:
- lint + typecheck + tests + build required
- Commands and outputs must be documented
- All violations fixed before approval

---

**This v1.0.4 specification addresses ALL enterprise blockers identified by ChatGPT and is ready for Γιώργος approval to proceed to Phase 1.**