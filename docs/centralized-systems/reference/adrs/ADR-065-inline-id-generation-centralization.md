# ADR-065: Inline ID Generation Centralization

## Status: ✅ IMPLEMENTED

**Date**: 2026-02-01
**Category**: Entity Systems
**Impact**: High - Security & Data Integrity

---

## Context

Το codebase είχε **7 instances** όπου τα entity IDs δημιουργούνταν inline με το pattern:
```typescript
`${entityType}_${Date.now()}`
```

Αυτό δημιουργούσε σοβαρά προβλήματα:

### Προβλήματα

| Issue | Severity | Description |
|-------|----------|-------------|
| **Collision Risk** | 🔴 Critical | `Date.now()` = milliseconds. Δύο entities στο ίδιο ms = ίδιο ID |
| **Predictable IDs** | 🟠 High | Timestamps είναι guessable - security vulnerability |
| **Inconsistent Format** | 🟡 Medium | `line_1738416000000` vs enterprise `ent_a1b2c3d4-...` |
| **No Audit Trail** | 🟡 Medium | Enterprise IDs έχουν logging, inline όχι |

---

## Decision

**Αντικατάσταση όλων των inline ID generation patterns με centralized enterprise service.**

### Centralized Solutions Used

| Pattern | Replacement | Format |
|---------|-------------|--------|
| `` `line_${Date.now()}` `` | `generateEntityId()` | `ent_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx` |
| `` `circle_${Date.now()}` `` | `generateEntityId()` | `ent_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx` |
| `` `point_${Date.now()}` `` | `generateEntityId()` | `ent_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx` |
| `` `polyline_${Date.now()}` `` | `generateEntityId()` | `ent_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx` |
| `` `level_${Date.now()}` `` | `generateLayerId()` | `lyr_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx` |
| `` `floorplan_${Date.now()}` `` | `generateFloorId()` | `flr_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx` |

### Enterprise ID Service Features

- **Crypto-secure**: UUID v4 via `crypto.randomUUID()`
- **Collision Detection**: Retry mechanism με max 5 attempts
- **Audit Logging**: Development mode logging
- **Namespace Prefixes**: Type-safe prefixes (`ent_`, `lyr_`, `flr_`)

---

## Files Updated

### 1. `systems/levels/utils.ts`
- **Changes**: 2 replacements
- **Line 29**: `level_${Date.now()}` → `generateLayerId()`
- **Line 108**: `floorplan_${Date.now()}` → `generateFloorId()`

### 2. `systems/dynamic-input/hooks/useDynamicInputHandler.ts`
- **Changes**: 4 replacements
- **Line 42**: `line_${Date.now()}` → `generateEntityId()`
- **Line 75**: `circle_${Date.now()}` → `generateEntityId()`
- **Line 87**: `circle_${Date.now()}` → `generateEntityId()`
- **Line 100**: `point_${Date.now()}` → `generateEntityId()`

### 3. `services/EntityMergeService.ts`
- **Changes**: 1 replacement
- **Line 90**: `polyline_${Date.now()}` → `generateEntityId()`

---

## Consequences

### Positive

| Benefit | Description |
|---------|-------------|
| ✅ **Zero Collisions** | UUID v4 = 2^122 possible values |
| ✅ **Security** | Unpredictable, crypto-secure |
| ✅ **Consistency** | Single format across codebase |
| ✅ **Auditability** | Logging & tracking support |
| ✅ **Type Safety** | Prefixed namespacing |

### Negative

| Trade-off | Mitigation |
|-----------|------------|
| Longer IDs | Compression in storage |
| Slightly slower | Negligible for entity creation |

---

## Verification

### TypeScript Check
```bash
npx tsc --noEmit --project src/subapps/dxf-viewer/tsconfig.json
```

### Grep Check (should return empty)
```bash
grep -rn "\`[a-z]*_\${Date.now()}\`" src/subapps/dxf-viewer/
```

### Functional Tests
- [ ] Entity creation (line, circle, point, polyline)
- [ ] Level creation/deletion
- [ ] Floorplan import
- [ ] Entity merge operations

---

## Related ADRs

- **ADR-017**: Enterprise ID Generation (foundation)
- **ADR-012**: Entity Linking Service
- **ADR-057**: Unified Entity Completion Pipeline

---

## References

- **Enterprise ID Service**: `@/services/enterprise-id.service.ts`
- **DXF-Viewer Wrapper**: `systems/entity-creation/utils.ts`
