# ADR-167: Enterprise Project Address System

| Metadata | Value |
|----------|-------|
| **Status** | ✅ APPROVED |
| **Date** | 2026-02-02 |
| **Category** | Entity Systems |
| **Canonical Location** | `@/types/project/` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical Types**: `@/types/project/addresses`
- **Canonical Helpers**: `@/types/project/address-helpers`
- **Prohibited**: Duplicate address data in buildings, ad-hoc address computations
- **Pattern**: Project addresses as source of truth, buildings inherit via references

---

## Context

### Business Problem

Greek construction projects often face complex address scenarios:

1. **Multi-frontage buildings** - Corner buildings with entrances on multiple streets (γωνιακά κτίρια)
2. **Block-spanning projects** - Projects occupying entire city blocks with different street numbers per side
3. **Multiple access points** - Separate entrances for residents, deliveries, parking
4. **Administrative vs. operational addresses** - Legal address vs. actual site locations

### Previous State

- **Single address string** per project/building (`address: string, city: string`)
- **Duplication** when buildings needed different addresses
- **No structure** for multiple entrances or block sides
- **Lost information** about address relationships and hierarchy

---

## Decision

### Architecture: Inheritance Pattern

Implement enterprise-grade multi-address system based on:

- **SAP**: Primary + Secondary addresses with usage roles
- **Salesforce**: ContactPointAddress with preference ranking
- **Procore**: Location hierarchy
- **Google Maps**: Building outlines with multiple entrance points

### Data Model

```typescript
// PROJECT: Source of truth
interface Project {
  addresses?: ProjectAddress[];  // All project addresses
  // Legacy: address, city (backward compatible)
}

// BUILDING: Inherits via references (NO duplication)
interface Building {
  addressConfigs?: BuildingAddressReference[];  // References to project addresses
  primaryProjectAddressId?: string;              // Which address is primary
  // Legacy: address, city (backward compatible)
}
```

### Core Types

1. **ProjectAddress** - Complete address with:
   - Type classification (site/entrance/delivery/legal/postal/billing/correspondence/other)
   - Block side direction (north/south/east/west/corner/etc.)
   - Geographic coordinates (GIS-ready)
   - ΚΑΕΚ (cadastral code), municipality, neighborhood
   - Primary flag (exactly ONE per project - enforced by Zod)

2. **BuildingAddressReference** - Inheritance config:
   - `inheritFromProject: boolean` (default: true)
   - `projectAddressId: string` (required when inheriting)
   - `override: Partial<>` (controlled overrides only - label, coordinates, description)

### Enterprise Invariants (Zod)

```typescript
// 1. Exactly ONE isPrimary=true per project
projectAddressesSchema.refine((addresses) => {
  const primaryCount = addresses.filter(a => a.isPrimary).length;
  return primaryCount === 1;
});

// 2. If inheritFromProject=true → projectAddressId REQUIRED
buildingAddressReferenceSchema.refine((data) => {
  if (data.inheritFromProject && !data.projectAddressId) {
    return false;
  }
  return true;
});

// 3. No duplicate address IDs
projectAddressesSchema.refine((addresses) => {
  const ids = addresses.map(a => a.id);
  return ids.length === new Set(ids).size;
});

// 4. No duplicate projectAddressId references in building
buildingAddressConfigsSchema.refine((configs) => {
  const refs = configs
    .filter(c => c.inheritFromProject && c.projectAddressId)
    .map(c => c.projectAddressId);
  return refs.length === new Set(refs).size;
});
```

### Helper Functions (Single Source of Truth)

```typescript
// ALWAYS use these - never compute addresses inline
getPrimaryAddress(addresses): ProjectAddress
resolveBuildingAddresses(configs, projectAddresses): ProjectAddress[]
formatAddressLine(address): string
migrateLegacyAddress(legacy): ProjectAddress[]
```

---

## Implementation

### Phase 1: Data Model & Validation (Completed)

✅ Created:
- `src/types/project/addresses.ts` - Type definitions
- `src/types/project/address-helpers.ts` - Helpers & resolver
- `src/types/project/index.ts` - Re-exports

✅ Updated:
- `src/types/project.ts` - Added `addresses?: ProjectAddress[]`
- `src/types/building/contracts.ts` - Added `addressConfigs[]` and `primaryProjectAddressId`
- `src/types/validation/schemas.ts` - Zod schemas with invariants

✅ i18n:
- `src/i18n/locales/el/building.json` - Added `address` section
- `src/i18n/locales/el/projects.json` - Added `address` section

### Phase 2: Minimal UI (Future)

- Project form: Primary + secondary address inputs
- Building form: Address inheritance toggle + primary selection
- Display components: Show multiple addresses with labels

### Phase 3: Full UI Components (Future - if needed)

- AddressCard - Single address display with block side badge
- AddressListCard - All addresses with primary indicator
- AddressFormSection - Full address CRUD

---

## Examples

### Corner Building with 2 Entrances

```typescript
const project: Project = {
  id: 'proj_1',
  name: 'Οικοδομή Σαμοθράκης-Καλαμαριάς',
  addresses: [
    {
      id: 'addr_1',
      street: 'Σαμοθράκης',
      number: '16',
      city: 'Θεσσαλονίκη',
      postalCode: '54636',
      country: 'GR',
      type: 'site',
      isPrimary: true,
      blockSide: 'south',
      label: 'Κύρια είσοδος - Σαμοθράκης',
    },
    {
      id: 'addr_2',
      street: 'Καλαμαριάς',
      number: '23',
      city: 'Θεσσαλονίκη',
      postalCode: '54636',
      country: 'GR',
      type: 'entrance',
      isPrimary: false,
      blockSide: 'east',
      label: 'Δευτερεύουσα είσοδος - Καλαμαριάς',
    },
  ],
};

const building: Building = {
  id: 'bldg_1',
  name: 'Κτίριο Α',
  projectId: 'proj_1',
  addressConfigs: [
    {
      inheritFromProject: true,
      projectAddressId: 'addr_1', // Primary entrance
    },
    {
      inheritFromProject: true,
      projectAddressId: 'addr_2', // Secondary entrance
      override: {
        label: 'Είσοδος Κτιρίου Α - Καλαμαριάς',
      },
    },
  ],
  primaryProjectAddressId: 'addr_1',
};

// Resolve building addresses
const resolved = resolveBuildingAddresses(
  building.addressConfigs,
  project.addresses
);
// Result: [addr_1 with original label, addr_2 with overridden label]
```

### Migration from Legacy

```typescript
// Old format
const oldProject = {
  id: 'proj_1',
  address: 'Λεωφ. Κηφισίας 100',
  city: 'Αθήνα',
};

// Migrate
const addresses = migrateLegacyAddress(oldProject);
// Result: [{
//   id: 'addr_...',
//   street: 'Λεωφ. Κηφισίας 100',
//   city: 'Αθήνα',
//   postalCode: '',
//   country: 'GR',
//   type: 'site',
//   isPrimary: true,
//   label: 'Κύρια διεύθυνση (legacy)',
// }]
```

---

## Consequences

### Positive

✅ **Zero duplication** - Buildings reference project addresses, no copying
✅ **Multi-entrance support** - Corner buildings, multiple frontages covered
✅ **Enterprise patterns** - Follows SAP/Salesforce/Procore best practices
✅ **GIS-ready** - Coordinates support for maps integration
✅ **Type-safe** - Zod validation catches invalid configurations
✅ **Backward compatible** - Legacy address/city fields preserved
✅ **Single source of truth** - resolveBuildingAddresses() prevents inline logic
✅ **i18n ready** - All labels/types translated

### Negative

⚠️ **Complexity increase** - More fields to manage than simple string
⚠️ **Migration required** - Existing projects need legacy→new conversion
⚠️ **Learning curve** - Team needs to understand inheritance pattern

### Mitigation

- **Helpers abstract complexity** - Use `resolveBuildingAddresses()`, `formatAddressLine()`
- **Gradual migration** - `migrateLegacyAddress()` handles conversion automatically
- **Documentation** - This ADR + inline JSDoc comments
- **Validation** - Zod catches mistakes early (exactly one primary, valid refs, etc.)

---

## Testing Requirements

- [ ] Unit tests for `migrateLegacyAddress()`
- [ ] Unit tests for `getPrimaryAddress()`
- [ ] Unit tests for `resolveBuildingAddresses()`
- [ ] Zod invariant tests (exactly one primary, no duplicates)
- [ ] Integration tests (project + building address resolution)

---

## Quality Gates

- [ ] TypeScript compilation passes (`npx tsc --noEmit`)
- [ ] Lint passes (`npm run lint`)
- [ ] All tests green
- [ ] Build succeeds (`npm run build`)
- [ ] No hardcoded labels in UI (all i18n)
- [ ] No inline address computations (all via helpers)

---

## References

### Enterprise Patterns

- SAP: Standard address + address usage roles
- Salesforce: ContactPointAddress with preference ranking
- Oracle: Multi ship-to addresses
- Procore: Location Breakdown Structure (LBS)
- Autodesk ACC: Multi-tiered locations
- Google Maps Platform: Building entrances concept

### Related ADRs

- ADR-012: Entity Linking Service (reference pattern inspiration)
- ADR-017: Enterprise ID Generation (ID format for address IDs)
- ADR-051: Enterprise Filter System (address-based filtering)

### Documentation

- Migration guide: Use `migrateLegacyAddress()` for existing data
- Helper reference: Always use `resolveBuildingAddresses()` for display
- Validation: Zod schemas enforce invariants automatically

---

**Last Updated**: 2026-02-02
**Status**: ✅ APPROVED - Implementation Phase 1 Complete
