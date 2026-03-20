# SPEC-255B: API Route Tenant Checks

> **Parent**: [ADR-255](../ADR-255-security-hardening-phase-4.md)
> **Priority**: P0 (CRITICAL)
> **Effort**: 4h
> **Status**: 📋 PLANNED

---

## Problem

~20 API routes κάτω από entity-specific paths δεν ελέγχουν αν η entity ανήκει στο tenant του χρήστη. Authenticated user A (company X) μπορεί να κάνει operations σε entities από company Y αν γνωρίζει το ID.

---

## Existing Infrastructure

### Tenant Isolation Utilities (`src/lib/auth/tenant-isolation.ts`)

**Ήδη υπάρχουν**:
- `requireProjectInTenant({ ctx, projectId, path })` — lines 49-78
- `requireBuildingInTenant({ ctx, buildingId, path })` — lines 80-121
- `TenantIsolationError` — typed error class
- `isRoleBypass()` — super admin bypass

**Canonical usage** (π.χ. `src/app/api/contacts/[contactId]/units/route.ts`):
```typescript
const ctx = await withAuth(req);
await requireUnitInTenant({ ctx, unitId, path: '/api/units/[id]/...' });
```

### Needed: New Functions

```typescript
// Pattern identical to requireProjectInTenant
export async function requireUnitInTenant(params: {
  ctx: AuthContext;
  unitId: string;
  path: string;
}): Promise<TenantUnit>

export async function requireStorageInTenant(params: {
  ctx: AuthContext;
  storageId: string;
  path: string;
}): Promise<TenantStorage>

export async function requireParkingInTenant(params: {
  ctx: AuthContext;
  parkingId: string;
  path: string;
}): Promise<TenantParking>

export async function requireOpportunityInTenant(params: {
  ctx: AuthContext;
  opportunityId: string;
  path: string;
}): Promise<TenantOpportunity>
```

---

## Routes Requiring Tenant Checks

### Units (`/api/units/[id]/...`) — ~12 routes

| Route | Current Auth | Fix |
|-------|-------------|-----|
| `/api/units/[id]/payments` | `withAuth` only | + `requireUnitInTenant` |
| `/api/units/[id]/payments/[paymentId]` | `withAuth` only | + `requireUnitInTenant` |
| `/api/units/[id]/cheques` | `withAuth` only | + `requireUnitInTenant` |
| `/api/units/[id]/cheques/[chequeId]` | `withAuth` only | + `requireUnitInTenant` |
| `/api/units/[id]/cheques/[chequeId]/transition` | `withAuth` only | + `requireUnitInTenant` |
| `/api/units/[id]/payment-plan` | `withAuth` only | + `requireUnitInTenant` |
| `/api/units/[id]/loans` | `withAuth` only | + `requireUnitInTenant` |
| `/api/units/[id]/loans/[loanId]` | `withAuth` only | + `requireUnitInTenant` |
| `/api/units/[id]/loans/[loanId]/transition` | `withAuth` only | + `requireUnitInTenant` |
| `/api/units/[id]/activity` | `withAuth` only | + `requireUnitInTenant` |
| `/api/units/[id]/hierarchy` | `withAuth` only | + `requireUnitInTenant` |
| `/api/units/[id]/ownership` | `withAuth` only | + `requireUnitInTenant` |

### Storages (`/api/storages/[id]/...`) — ~3 routes

| Route | Current Auth | Fix |
|-------|-------------|-----|
| `/api/storages/[id]` | `withAuth` only | + `requireStorageInTenant` |
| `/api/storages/[id]/activity` | `withAuth` only | + `requireStorageInTenant` |
| `/api/storages/[id]/ownership` | `withAuth` only | + `requireStorageInTenant` |

### Parking (`/api/parking/[id]/...`) — ~3 routes

| Route | Current Auth | Fix |
|-------|-------------|-----|
| `/api/parking/[id]` | `withAuth` only | + `requireParkingInTenant` |
| `/api/parking/[id]/activity` | `withAuth` only | + `requireParkingInTenant` |
| `/api/parking/[id]/history` | `withAuth` only | + `requireParkingInTenant` |

### Opportunities (`/api/opportunities/[id]/...`) — ~2 routes

| Route | Current Auth | Fix |
|-------|-------------|-----|
| `/api/opportunities/[id]` | `withAuth` only | + `requireOpportunityInTenant` |
| `/api/opportunities/[id]/activity` | `withAuth` only | + `requireOpportunityInTenant` |

---

## Implementation Pattern

Κάθε route handler αλλάζει από:

```typescript
// BEFORE
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth(req);
  const { id } = await params;
  // ... direct Firestore query
}
```

σε:

```typescript
// AFTER
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth(req);
  const { id } = await params;
  await requireUnitInTenant({ ctx, unitId: id, path: '/api/units/[id]/...' });
  // ... Firestore query (now guaranteed tenant-safe)
}
```

---

## Acceptance Criteria

- [ ] `requireUnitInTenant()` implemented in `tenant-isolation.ts`
- [ ] `requireStorageInTenant()` implemented
- [ ] `requireParkingInTenant()` implemented
- [ ] `requireOpportunityInTenant()` implemented
- [ ] All ~20 routes updated with appropriate tenant check
- [ ] User from company X gets 404 when accessing entity from company Y
- [ ] Super admin bypass works (ADR-232)
- [ ] Audit log entries created on all denials

---

## Risks

- **Performance**: Each tenant check = 1 extra Firestore read. Acceptable for security.
- **Breaking existing functionality**: Routes that previously returned data will now return 404 for cross-tenant access — this is the desired behavior.
