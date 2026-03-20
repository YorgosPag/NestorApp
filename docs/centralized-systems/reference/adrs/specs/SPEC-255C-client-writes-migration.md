# SPEC-255C: Client-Side Writes Migration

> **Parent**: [ADR-255](../ADR-255-security-hardening-phase-4.md)
> **Priority**: P1
> **Effort**: 8h
> **Status**: 📋 PLANNED

---

## Problem

19 files perform direct Firestore writes from the client (browser). Client-side writes bypass:
- Server-side validation
- Audit logging
- Tenant isolation checks (beyond Firestore rules)
- Business logic enforcement

3 files are **CRITICAL** because they handle legally-binding or government-regulated data.

---

## Severity Classification

### CRITICAL (3 files) — Legal/Government Data

| File | Collection | Risk | Migration Target |
|------|-----------|------|-----------------|
| `src/hooks/useAttendanceEvents.ts` | `attendance_events` | Νομικά binding εργασιακά δεδομένα | `POST /api/attendance/events` |
| `src/hooks/useEfkaDeclaration.ts` | `efka_declarations` | Κρατική δήλωση ΕΦΚΑ | `POST /api/efka/declarations` |
| `src/hooks/useEmploymentRecords.ts` | `employment_records` | Νομικά binding εργασιακές συμβάσεις | `PATCH /api/employment-records/[id]` |

### HIGH (6 files) — Business Data

| File | Collection | Risk | Migration Target |
|------|-----------|------|-----------------|
| `src/stores/overlay-store.tsx` | `overlays` | DXF overlay data manipulation | `POST/PATCH /api/overlays` |
| `src/services/communications-client.service.ts` | `communications` | Εταιρική αλληλογραφία | `POST /api/communications` |
| `src/components/WorkersTabContent.tsx` | `workers` | Εργαζόμενοι στο project | `POST /api/workers` |
| `src/hooks/useFloorplanImages.ts` | `floorplan_images` | Εικόνες κατόψεων | `POST /api/floorplans/images` |
| `src/hooks/useFloorplanOverlays.ts` | `floorplan_overlays` | Overlay δεδομένα κατόψεων | `POST /api/floorplans/overlays` |
| `src/components/FileComments.tsx` | `file_comments` | Σχόλια σε αρχεία | `POST /api/files/[id]/comments` |

### MEDIUM (10 files) — Lower Risk

| File | Collection | Notes |
|------|-----------|-------|
| Various UI components | Various | Settings, preferences, non-critical data |

---

## Migration Pattern

### Before (Client-Side Write)
```typescript
// ❌ Direct Firestore write from browser
import { setDoc, doc } from 'firebase/firestore';

async function createRecord(data: RecordData) {
  const id = generateId('rec');
  await setDoc(doc(db, 'records', id), {
    ...data,
    createdAt: serverTimestamp(),
  });
}
```

### After (Server-Side via API Route)
```typescript
// ✅ API route with full server-side checks
// Client:
async function createRecord(data: RecordData) {
  const response = await fetch('/api/records', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create record');
  return response.json();
}

// Server (route.ts):
export async function POST(req: NextRequest) {
  const ctx = await withAuth(req);
  const body = schema.parse(await req.json()); // Zod validation
  const id = generateRecordId();
  await adminDb.collection('records').doc(id).set({
    ...body,
    companyId: ctx.companyId, // ✅ Tenant isolation
    createdBy: ctx.userId,    // ✅ Audit trail
    createdAt: FieldValue.serverTimestamp(),
  });
  await logAuditEvent(ctx, 'RECORD_CREATED', id, 'record');
  return NextResponse.json({ id });
}
```

---

## Implementation Order

1. **CRITICAL files first** (attendance, EFKA, employment) — legal obligation
2. **HIGH files** (communications, workers, overlays) — business data
3. **MEDIUM files** — migrate-on-touch strategy

---

## Acceptance Criteria

- [ ] 3 CRITICAL files migrated to server-side API routes
- [ ] Each new API route includes: `withAuth`, Zod validation, `companyId` enforcement, audit logging
- [ ] Client hooks updated to call API instead of direct Firestore
- [ ] No regressions in UI functionality
- [ ] Enterprise ID generation preserved (server-side)

---

## Risks

- **Latency**: API call adds ~50-100ms vs direct Firestore. Acceptable trade-off for security.
- **Offline support**: Client-side writes work offline (Firestore cache). Server-side requires connectivity. Currently not a concern (app requires connectivity).
- **Optimistic updates**: Some UI uses optimistic patterns. These must be preserved via local state + API confirmation.
