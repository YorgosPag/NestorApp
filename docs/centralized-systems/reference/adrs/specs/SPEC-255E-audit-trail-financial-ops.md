# SPEC-255E: Audit Trail — Financial Operations

> **Parent**: [ADR-255](../ADR-255-security-hardening-phase-4.md)
> **Priority**: P1
> **Effort**: 6h
> **Status**: ✅ IMPLEMENTED (2026-03-21)

---

## Problem

Financial operations (cheque transitions, loan transitions, entity deletions) lack audit trail logging. In case of dispute or investigation, there is no record of:
- Who changed a cheque from `pending` to `bounced`
- Who deleted a payment record
- When a loan status changed to `defaulted`

---

## Existing Infrastructure

### Audit System (`src/lib/auth/audit.ts`, 699 lines)

**Core function**:
```typescript
logAuditEvent(ctx, action, targetId, targetType, {
  previousValue, newValue, metadata
})
```

**Existing convenience functions** (15+):
- `logRoleChange()`, `logPermissionGranted()`, `logOwnershipChanged()`
- `logCommunicationCreated()`, `logCommunicationApproved()`
- `logWebhookEvent()`, `logDirectOperation()`, `logSystemOperation()`

**Missing**: Financial-specific convenience functions.

---

## New Convenience Functions

### `logFinancialTransition()`

```typescript
// Add to src/lib/auth/audit.ts

export async function logFinancialTransition(
  ctx: AuthContext,
  entityType: 'cheque' | 'loan' | 'payment' | 'invoice',
  entityId: string,
  fromStatus: string,
  toStatus: string,
  metadata?: Record<string, string | number | boolean>
): Promise<void> {
  await logAuditEvent(ctx, 'FINANCIAL_TRANSITION', entityId, entityType, {
    previousValue: { status: fromStatus },
    newValue: { status: toStatus },
    metadata: {
      ...metadata,
      transitionType: `${fromStatus}→${toStatus}`,
    },
  });
}
```

### `logEntityDeleted()`

```typescript
export async function logEntityDeleted(
  ctx: AuthContext,
  entityType: AuditTargetType,
  entityId: string,
  metadata?: Record<string, string | number | boolean>
): Promise<void> {
  await logAuditEvent(ctx, 'ENTITY_DELETED', entityId, entityType, {
    metadata: {
      ...metadata,
      deletedAt: new Date().toISOString(),
    },
  });
}
```

---

## Financial Transitions Requiring Audit (~15)

### Cheque Transitions

| Route | Transition | Current Logging |
|-------|-----------|----------------|
| `/api/units/[id]/cheques/[id]/transition` | `pending` → `deposited` | ❌ None |
| | `deposited` → `clearing` | ❌ None |
| | `clearing` → `cleared` | ❌ None |
| | `clearing` → `bounced` | ❌ None |
| | `bounced` → `redeposited` | ❌ None |
| | `*` → `cancelled` | ❌ None |

### Loan Transitions

| Route | Transition | Current Logging |
|-------|-----------|----------------|
| `/api/units/[id]/loans/[id]/transition` | `active` → `paid_off` | ❌ None |
| | `active` → `defaulted` | ❌ None |
| | `active` → `restructured` | ❌ None |
| | `defaulted` → `recovered` | ❌ None |

### Payment Status Changes

| Route | Transition | Current Logging |
|-------|-----------|----------------|
| `/api/units/[id]/payments/[id]` (PATCH) | `pending` → `confirmed` | ❌ None |
| | `confirmed` → `refunded` | ❌ None |

### Invoice Transitions

| Route | Transition | Current Logging |
|-------|-----------|----------------|
| `/api/accounting/invoices/[id]` (PATCH) | `draft` → `sent` | ❌ None |
| | `sent` → `paid` | ❌ None |
| | `*` → `cancelled` | ❌ None |

---

## DELETE Operations Requiring Audit (~35)

All DELETE handlers across the API should log before deletion:

```typescript
// Pattern for every DELETE handler:
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth(req);
  const { id } = await params;

  // 1. Fetch entity before deletion (for audit record)
  const entity = await adminDb.collection('entities').doc(id).get();

  // 2. Log deletion with entity snapshot
  await logEntityDeleted(ctx, 'entity', id, {
    name: entity.data()?.name ?? 'unknown',
  });

  // 3. Perform deletion
  await adminDb.collection('entities').doc(id).delete();

  return NextResponse.json({ success: true });
}
```

### High-Priority DELETE Routes

| Route | Entity | Business Impact |
|-------|--------|----------------|
| `/api/units/[id]/payments/[id]` | Payment | Financial record loss |
| `/api/units/[id]/cheques/[id]` | Cheque | Financial record loss |
| `/api/units/[id]/loans/[id]` | Loan | Financial record loss |
| `/api/contacts/[id]` | Contact | Customer data loss |
| `/api/projects/[id]` | Project | Project data loss |
| `/api/buildings/[id]` | Building | Property data loss |
| `/api/opportunities/[id]` | Opportunity | Sales data loss |

---

## AuditAction Type Extension

```typescript
// Add to existing AuditAction type:
| 'FINANCIAL_TRANSITION'
| 'ENTITY_DELETED'
```

---

## Acceptance Criteria

- [ ] `logFinancialTransition()` convenience function added to `audit.ts`
- [ ] `logEntityDeleted()` convenience function added to `audit.ts`
- [ ] All cheque transition endpoints log transitions
- [ ] All loan transition endpoints log transitions
- [ ] All DELETE endpoints log entity deletion with snapshot
- [ ] Audit entries queryable by `entityType` and `action`
- [ ] No financial operation can occur without audit trail

---

## Risks

- **Performance**: Each audit log = 1 Firestore write. For bulk operations, consider batch logging.
- **Storage**: Audit logs grow indefinitely. Future: implement TTL or archival strategy (not in scope).
- **Failure mode**: If audit write fails, should the operation proceed? **Yes** — log to console as fallback (existing pattern in `audit.ts`).
