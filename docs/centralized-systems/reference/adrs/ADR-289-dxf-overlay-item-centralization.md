# ADR-289: DXF Overlay Item Centralization (SSOT API Gateway)

**Status**: Accepted
**Date**: 2026-04-05
**Related**: ADR-237 (Polygon Overlay Bridge), ADR-285 (DXF Tenant Scoping), ADR-286 (DXF Level CRUD Centralization), ADR-288 (CAD File Metadata Centralization), ADR-238 (Entity Creation Centralization)

## Context

Overlay polygons (property/parking/storage/footprint outlines drawn on top of DXF scenes) are stored under the Firestore subcollection:

```
dxf-overlay-levels/{levelId}/items/{overlayId}
```

Until this ADR, all overlay mutations (add, update, remove, restore, vertex edits) were performed via **direct client-side Firestore writes** in `src/subapps/dxf-viewer/overlays/overlay-store.tsx`:

- `setDoc` for create + restore (upsert with original id)
- `updateDoc` for partial updates (including vertex manipulation)
- `deleteDoc` for remove
- `serverTimestamp()` for createdAt/updatedAt/restoredAt

This violated the centralization principle established by:
- **ADR-286**: DXF level CRUD routed through `/api/dxf-levels`
- **ADR-288**: CAD file metadata routed through `/api/cad-files`

Direct client writes bypass audit logging, server-side tenant enforcement, and the SSOT entity creation pipeline. The previous `companyId`/`createdBy` stamping lived in the client (ADR-285 CL #2), making it fragile to auth context drift and introducing redundancy with server-side rule checks.

## Decision

Introduce a dedicated API endpoint `/api/dxf-overlay-items` that handles all overlay mutations via the server-side admin SDK, and refactor `overlay-store.tsx` to route every write through a client gateway module.

### Endpoint shape

`POST /api/dxf-overlay-items` — Create new overlay. Server generates the `overlayId` via `enterprise-id.service.generateOverlayId()`.

`PUT /api/dxf-overlay-items` — Upsert (restore flow). Client supplies the original `overlayId` and optional `createdAtMs` timestamp to preserve chronology. Stamps `restoredAt`.

`PATCH /api/dxf-overlay-items` — Partial update of an existing overlay. Supports `polygon`, `kind`, `status`, `label`, `linked` (with explicit `null` to clear), `style`. `updatedAt` is bumped server-side.

`DELETE /api/dxf-overlay-items?levelId=...&overlayId=...` — Remove an overlay after tenant validation.

`GET /api/dxf-overlay-items?levelId=...` — Tenant-scoped list for admin/debug. Primary clients continue to use `onSnapshot` subscriptions (read-only path is not changed).

### Subcollection handling

Because `createEntity()` (ADR-238) assumes flat top-level collections and overlays live in a subcollection, the handler uses **direct adminDb writes** against the path `dxf-overlay-levels/{levelId}/items/{overlayId}` — same strategy as ADR-288 (`cadFiles` upsert). The `ENTITY_REGISTRY` entry for `dxfOverlayItem` exists purely for SSOT documentation (`collection` records the parent prefix); the handler calls `generateOverlayId()` directly and manages the subcollection path locally.

### Tenant enforcement

- **Create/Upsert**: `companyId` is always stamped from `ctx.companyId`; `createdBy` falls back to `ctx.uid` if not supplied (restore preserves original).
- **Update/Delete**: Existing document's `companyId` is verified against `ctx.companyId` (super_admin bypass via `isRoleBypass`).
- All mutations emit audit events (`data_created` / `data_updated` / `data_deleted` / `access_denied`).

### Permissions

- `dxf:layers:view` — POST, PUT, PATCH, GET
- `dxf:layers:manage` — DELETE

## Implementation

### New files

| File | Purpose |
|---|---|
| `src/app/api/dxf-overlay-items/route.ts` | HTTP method handlers (GET/POST/PUT/PATCH/DELETE) |
| `src/app/api/dxf-overlay-items/dxf-overlay-items.handlers.ts` | Business logic + tenant checks + audit |
| `src/app/api/dxf-overlay-items/dxf-overlay-items.schemas.ts` | Zod validation schemas |
| `src/app/api/dxf-overlay-items/dxf-overlay-items.types.ts` | Response payload types |
| `src/services/dxf-overlay-item-mutation-gateway.ts` | Client wrapper: `createOverlayItemWithPolicy`, `upsertOverlayItemWithPolicy`, `updateOverlayItemWithPolicy`, `deleteOverlayItemWithPolicy` |

### Modified files

| File | Change |
|---|---|
| `src/lib/firestore/entity-creation.types.ts` | Added `'dxfOverlayItem'` to `ServerEntityType`, `'generateOverlayId'` to `EntityIdGeneratorName`, + `dxfOverlayItem` entry in `ENTITY_REGISTRY` (SSOT documentation only) |
| `src/config/domain-constants.ts` | Added `API_ROUTES.DXF_OVERLAY_ITEMS.LIST = '/api/dxf-overlay-items'` |
| `src/subapps/dxf-viewer/overlays/overlay-store.tsx` | Replaced 4 direct Firestore writes (add/update/remove/restore) with gateway calls. Removed `setDoc`, `updateDoc`, `deleteDoc`, `doc`, `serverTimestamp`, `generateOverlayId` imports. `onSnapshot` subscription unchanged (readers still client-side). |

### Readers unchanged

The `onSnapshot` subscriptions in `overlay-store.tsx` and `useFloorOverlays.ts` continue to read directly from Firestore subcollections. Firestore security rules remain the access gate for reads — no server round-trip is needed for the real-time path.

## Consequences

### Positive
- All overlay writes flow through a single audited, tenant-enforced pipeline.
- `companyId`/`createdBy` stamping is server-only — no client auth plumbing.
- Polygon format normalization (`[x,y]` → `{x,y}`) still happens client-side before gateway call, keeping the wire format stable.
- Mirror of the ADR-286 + ADR-288 patterns — consistent mental model across DXF modules.
- Future rate limiting, validation tightening, and cross-cutting concerns apply to a single endpoint.

### Trade-offs
- Overlay writes now incur HTTP round-trip (authenticated) instead of direct Firestore RPC. The optimistic update still occurs via the `onSnapshot` reflection, so perceived latency is dominated by the Firestore write propagation, not the added hop.
- Vertex-drag operations (`addVertex`/`updateVertex`/`removeVertex`) generate PATCH calls at drag-finish, not mid-drag — same cadence as before since the previous code also used `updateDoc` per call.

## Changelog

- **2026-04-05** — ADR-289 accepted. Implemented `/api/dxf-overlay-items` (POST/PUT/PATCH/DELETE/GET), `dxf-overlay-item-mutation-gateway.ts`, and refactored `overlay-store.tsx` to route all mutations through the gateway. `onSnapshot` readers unchanged.
