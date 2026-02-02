# 🏢 Enterprise Address System - Integration Guide

## Overview

Enterprise-grade multi-address system for construction projects.

**Pattern**: SAP Real Estate, Salesforce CPQ, Microsoft Dynamics, Procore

**Status**: ✅ Phase 1 Complete (Types & Components)

---

## Architecture

```
Project (Firestore)
├── id: string
├── name: string
├── address: string                    ← LEGACY (backward compatible)
├── city: string                       ← LEGACY (backward compatible)
└── addresses?: ProjectAddress[]       ← NEW (enterprise multi-address)
    ├── [0] { isPrimary: true, street: "Σαμοθράκης", number: "16", ... }
    ├── [1] { isPrimary: false, street: "Καλαμαριάς", number: "23", ... }
    └── [2] { isPrimary: false, street: "Θέρμης", number: "45", ... }

Building (Firestore)
├── id: string
├── name: string
├── address?: string                            ← LEGACY
├── city?: string                               ← LEGACY
└── addressConfig?: BuildingAddressReference    ← NEW
    ├── inheritFromProject: true
    ├── projectAddressId: "addr_1"              (optional - which project address)
    └── override?: { number: "Floor 3" }        (optional - building-specific overrides)
```

---

## Completed Components

### ✅ Phase 1: Infrastructure

**Types**:
- `src/types/project/addresses.ts` - ProjectAddress, BuildingAddressReference, types
- `src/types/project/address-helpers.ts` - Helper utilities (format, migrate, validate)
- `src/types/project/index.ts` - Centralized exports

**UI Components**:
- `src/components/shared/addresses/AddressCard.tsx` - Single address display
- `src/components/shared/addresses/AddressListCard.tsx` - Address list with primary indicator
- `src/components/shared/addresses/AddressFormSection.tsx` - Address form (Radix Select - ADR-001)
- `src/components/shared/addresses/index.ts` - Component exports

---

## Integration Strategy (SAP/Salesforce Pattern)

### Phase 2: Data Layer Integration

**2.1 Update Firestore Schema** (Non-breaking)

```typescript
// src/services/projects/contracts.ts
import type { ProjectAddress } from '@/types/project/addresses';

export interface FirestoreProject {
  // ... existing fields ...

  // LEGACY (keep for backward compatibility)
  address: string;
  city: string;

  // NEW (optional - gradual rollout)
  addresses?: ProjectAddress[];
}
```

**2.2 Update Projects Service**

```typescript
// src/services/projects/repositories/projects-repository.ts

import { migrateLegacyAddress, extractLegacyFields } from '@/types/project/address-helpers';

class ProjectsRepository {
  async createProject(data: CreateProjectData) {
    // If new addresses provided, extract legacy fields for compatibility
    if (data.addresses && data.addresses.length > 0) {
      const legacy = extractLegacyFields(data.addresses);
      data.address = legacy.address;
      data.city = legacy.city;
    }

    // Save to Firestore (both legacy and new fields)
    await firestore.collection('PROJECTS').doc(id).set({
      ...data,
      address: data.address,     // LEGACY
      city: data.city,           // LEGACY
      addresses: data.addresses  // NEW
    });
  }

  async getProject(id: string) {
    const doc = await firestore.collection('PROJECTS').doc(id).get();
    const project = doc.data();

    // Migration: If no new addresses, create from legacy
    if (!project.addresses && project.address && project.city) {
      project.addresses = migrateLegacyAddress(project.address, project.city);
    }

    return project;
  }
}
```

**2.3 Update Project Type**

```typescript
// src/types/project.ts

import type { ProjectAddress } from './project/addresses';

export interface Project {
  // ... existing fields ...

  // LEGACY (backward compatible - keep for now)
  address: string;
  city: string;

  // NEW: Enterprise addresses
  addresses?: ProjectAddress[];
}
```

### Phase 3: UI Integration

**3.1 Update AddProjectDialog**

Replace simple text inputs with AddressFormSection:

```typescript
// src/components/projects/dialogs/AddProjectDialog.tsx

import { AddressFormSection } from '@/components/shared/addresses';
import { createProjectAddress, extractLegacyFields } from '@/types/project/address-helpers';

function AddProjectDialog() {
  const [addresses, setAddresses] = useState<ProjectAddress[]>([]);

  const handleAddressChange = (addressData) => {
    const newAddress = createProjectAddress({
      ...addressData,
      isPrimary: addresses.length === 0 // First address is primary
    });

    setAddresses([newAddress]);
  };

  const handleSubmit = async () => {
    // Extract legacy fields for backward compatibility
    const legacy = extractLegacyFields(addresses);

    await createProject({
      name,
      ...other fields,
      address: legacy.address,  // LEGACY
      city: legacy.city,        // LEGACY
      addresses                 // NEW
    });
  };

  return (
    <Dialog>
      {/* ... other fields ... */}

      <AddressFormSection
        onChange={handleAddressChange}
        showErrors={validationAttempted}
      />
    </Dialog>
  );
}
```

**3.2 Update ProjectCard**

Show primary address with indicator for additional addresses:

```typescript
// src/components/projects/projects/ProjectCard/ProjectCardContent/ProjectCardLocation.tsx

import { getPrimaryAddress } from '@/types/project/address-helpers';
import { Badge } from '@/components/ui/badge';

function ProjectCardLocation({ project }) {
  // Use new addresses if available, fallback to legacy
  const addresses = project.addresses || migrateLegacyAddress(project.address, project.city);
  const primary = getPrimaryAddress(addresses);

  if (!primary) return null;

  return (
    <div className="flex items-center gap-2">
      <MapPin />
      <span>{formatAddressLine(primary)}</span>

      {addresses.length > 1 && (
        <Badge variant="outline">
          +{addresses.length - 1} ακόμα
        </Badge>
      )}
    </div>
  );
}
```

**3.3 Update Building Forms**

Add address inheritance UI:

```typescript
// src/components/building-management/tabs/GeneralTabContent.tsx

import { AddressListCard } from '@/components/shared/addresses';

function GeneralTabContent({ building, project }) {
  const [inheritAddress, setInheritAddress] = useState(
    building.addressConfig?.inheritFromProject ?? true
  );

  const resolvedAddress = inheritAddress
    ? resolveBuildingAddress(building.addressConfig, project.addresses)
    : building.customAddress;

  return (
    <>
      <Checkbox
        checked={inheritAddress}
        onCheckedChange={setInheritAddress}
        label="Κληρονομία διεύθυνσης από έργο"
      />

      {inheritAddress && project.addresses && (
        <AddressListCard
          addresses={project.addresses}
          onEditAddress={undefined} // Read-only for buildings
        />
      )}
    </>
  );
}
```

### Phase 4: Testing & Validation

**4.1 Test Migration**

```typescript
// Test: Legacy → New migration
const legacy = { address: "Σαμοθράκης 16", city: "Θεσσαλονίκη" };
const migrated = migrateLegacyAddress(legacy.address, legacy.city);

expect(migrated).toHaveLength(1);
expect(migrated[0].street).toBe("Σαμοθράκης");
expect(migrated[0].number).toBe("16");
expect(migrated[0].isPrimary).toBe(true);
```

**4.2 Test Backward Compatibility**

```typescript
// Test: New → Legacy extraction
const newAddresses: ProjectAddress[] = [
  { street: "Σαμοθράκης", number: "16", city: "Θεσσαλονίκη", isPrimary: true, ... }
];

const legacy = extractLegacyFields(newAddresses);

expect(legacy.address).toBe("Σαμοθράκης 16");
expect(legacy.city).toBe("Θεσσαλονίκη");
```

**4.3 Test Firestore Operations**

```typescript
// Test: Create project with new addresses
await createProject({
  name: "Test Project",
  addresses: [
    createProjectAddress({
      street: "Σαμοθράκης",
      number: "16",
      city: "Θεσσαλονίκη",
      postalCode: "54621",
      isPrimary: true
    })
  ]
});

// Verify both legacy and new fields are saved
const saved = await getProject(projectId);
expect(saved.address).toBe("Σαμοθράκης 16");  // LEGACY
expect(saved.addresses).toHaveLength(1);       // NEW
```

---

## Rollout Strategy (SAP/Salesforce Pattern)

### Option A: Feature Flag (Recommended)

```typescript
// src/config/features.ts
export const FEATURES = {
  MULTI_ADDRESS_SYSTEM: process.env.NEXT_PUBLIC_ENABLE_MULTI_ADDRESS === 'true'
};

// In components:
if (FEATURES.MULTI_ADDRESS_SYSTEM) {
  return <AddressFormSection />;
} else {
  return <LegacyAddressInputs />;
}
```

### Option B: Gradual Migration

1. **Week 1**: Deploy types & components (no UI changes)
2. **Week 2**: Update AddProjectDialog (new projects get new format)
3. **Week 3**: Add migration UI (allow editing existing projects)
4. **Week 4**: Update all display components

---

## Backward Compatibility Guarantees

✅ **Old projects continue to work** - Legacy `address` and `city` fields remain
✅ **New projects are compatible with old code** - Legacy fields auto-generated
✅ **No breaking changes** - Gradual rollout with feature flags
✅ **Data integrity** - Migration utilities ensure consistency

---

## Next Steps

- [ ] Phase 2: Update Firestore schema & Projects service
- [ ] Phase 3: Integrate UI components
- [ ] Phase 4: Testing & validation
- [ ] Phase 5: Production rollout

---

**Created**: 2026-02-02
**Pattern**: SAP/Salesforce/Microsoft Dynamics
**Status**: Ready for Phase 2
