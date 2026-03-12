# ADR-201: Centralized CompanyId Resolution

| Field | Value |
|-------|-------|
| **Status** | ✅ APPROVED |
| **Date** | 2026-03-12 |
| **Category** | Backend Systems / Multi-Tenant |
| **Author** | Claude Agent |

## Context

Το companyId resolution ήταν **διάσπαρτο σε 8+ σημεία** στον κώδικα, με κάθε σημείο να αποφασίζει μόνο του:

```typescript
// Pattern που επαναλαμβανόταν 7+ φορές μόνο στο SimpleProjectDialog:
const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);
const companyId = selectedBuilding?.companyId || user?.companyId || selectedCompanyId;
```

Αυτό οδήγησε σε:
- **Mismatch bugs**: Save-side χρησιμοποιούσε `user?.companyId`, load-side χρησιμοποιούσε `building.companyId`
- **Αδιαφάνεια**: Δεν ήταν ξεκάθαρο ποιο source κέρδισε
- **Duplication**: Ίδιο pattern σε 8+ αρχεία

## Decision

Δημιουργήθηκε **pure function** `resolveCompanyId()` στο `src/services/company-id-resolver.ts` με σταθερή σειρά προτεραιότητας:

1. `building.companyId` — Firestore source of truth (supports super_admin cross-tenant)
2. `user.companyId` — Auth user's tenant (fallback)
3. `selectedCompanyId` — UI selection (last resort)

### API

| Function | Throws? | Use case |
|----------|---------|----------|
| `resolveCompanyId(ctx)` | ✅ Yes | Service calls (companyId is required) |
| `resolveCompanyIdForBuilding(params)` | ✅ Yes | SimpleProjectDialog (lookup building from array) |
| `tryResolveCompanyId(ctx)` | ❌ No | React components (optional render) |

## Files Created

- `src/services/company-id-resolver.ts` — Core resolver (pure functions)

## Files Modified

| File | Change |
|------|--------|
| `SimpleProjectDialog.tsx` | 7 inline resolutions → `resolveCompanyIdForBuilding()` |
| `BuildingFloorplanTab.tsx` | Inline fallback → `tryResolveCompanyId()` |
| `SpaceFloorplanInline.tsx` | Added `building` prop + `tryResolveCompanyId()` |

## Consequences

- **Positive**: Single point of truth, traceable via `source` field, testable pure function
- **Positive**: Eliminates class of save/load companyId mismatch bugs
- **Neutral**: No breaking changes — external API unchanged
