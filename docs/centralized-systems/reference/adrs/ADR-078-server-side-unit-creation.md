# ADR-078: Server-Side Unit Creation via Admin SDK

## Status
✅ IMPLEMENTED

## Date
2026-02-06

## Category
Backend Systems

## Context

Firestore security rules block client-side unit creation:
```
// firestore.rules:389
allow create: if false;
```

The existing `addUnit()` function in `units.service.ts` uses client-side `addDoc()` which is blocked by these rules. Users clicking the "+" button on the Units page (`/units`) could not create new units.

## Decision

Implement a **server-side API endpoint** using Firebase Admin SDK — the same proven pattern used for buildings (`/api/buildings` POST handler).

### Architecture

```
AddUnitDialog → useUnitForm.handleSubmit()
  → createUnit() [units.service.ts]
    → apiClient.post('/api/units/create', data) [Bearer token auto-injected]
      → /api/units/create/route.ts [API endpoint]
        → withStandardRateLimit(withAuth(handler, { permissions: 'units:units:create' }))
        → getAdminFirestore().collection('units').add(data) [Admin SDK — bypasses rules]
        → Response: { success: true, data: { unitId } }
    → RealtimeService.dispatchUnitCreated() [client-side, after success]
```

### Security

- **Authentication**: `withAuth` middleware verifies Firebase ID token
- **Authorization**: `units:units:create` permission required
- **Rate Limiting**: `withStandardRateLimit` prevents abuse
- **Tenant Isolation**: `companyId` forced from `ctx.companyId` (cannot be spoofed)
- **Audit Trail**: `logAuditEvent('data_created', 'unit', ...)` logs creation
- **Validation**: Unit name required, undefined fields cleaned

### Permissions

| Role | Permission |
|------|-----------|
| `super_admin` | Bypass (all permissions) |
| `company_admin` | `units:units:create` ✅ (newly added) |
| `project_manager` | `units:units:create` ✅ (newly added) |

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/lib/auth/types.ts` | EDIT | Added `units:units:create` permission |
| `src/lib/auth/roles.ts` | EDIT | Granted to `company_admin` + `project_manager` |
| `src/app/api/units/create/route.ts` | NEW | Server-side API endpoint |
| `src/services/units.service.ts` | EDIT | Added `createUnit()` function |
| `src/components/units/hooks/useUnitForm.ts` | EDIT | Uses `createUnit()` instead of `addUnit()` |

## Consequences

### Positive
- Units can now be created despite `allow create: if false` in Firestore rules
- Consistent pattern with buildings creation (ADR proven)
- Full audit trail for unit creation
- Rate limiting prevents abuse
- Tenant isolation enforced server-side

### Negative
- Slightly higher latency (API round-trip vs direct Firestore write)
- Additional endpoint to maintain

## References
- Buildings API pattern: `src/app/api/buildings/route.ts` (POST handler)
- Enterprise API Client: `src/lib/api/enterprise-api-client.ts`
- RealtimeService: `src/services/realtime/RealtimeService.ts`
