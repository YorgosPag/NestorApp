# SPEC-255D: Input Validation — Zod

> **Parent**: [ADR-255](../ADR-255-security-hardening-phase-4.md)
> **Priority**: P2 (Incremental)
> **Effort**: Ongoing (migrate-on-touch)
> **Status**: 📋 PLANNED

---

## Problem

73 API routes accept `req.json()` without schema validation. Malformed or malicious input passes directly to Firestore writes and business logic.

---

## Existing Infrastructure

- **Zod** is already installed and used in `src/subapps/accounting/` routes
- **Pattern** (from accounting):
  ```typescript
  import { z } from 'zod';

  const CreateInvoiceSchema = z.object({
    contactId: z.string().min(1),
    amount: z.number().positive(),
    description: z.string().max(500),
    // ...
  });

  export async function POST(req: NextRequest) {
    const ctx = await withAuth(req);
    const body = CreateInvoiceSchema.parse(await req.json());
    // body is now fully typed and validated
  }
  ```

---

## Tiered Migration Strategy

### Tier 1: Financial Routes (15 routes) — P1 priority

Highest risk — money movement and financial records.

| Route Pattern | Count | Schema Needed |
|---------------|-------|--------------|
| `/api/units/[id]/payments` | 3 (GET/POST/PATCH) | `PaymentSchema` |
| `/api/units/[id]/cheques` | 3 | `ChequeSchema` |
| `/api/units/[id]/cheques/[id]/transition` | 1 | `ChequeTransitionSchema` |
| `/api/units/[id]/loans` | 3 | `LoanSchema` |
| `/api/units/[id]/loans/[id]/transition` | 1 | `LoanTransitionSchema` |
| `/api/units/[id]/payment-plan` | 2 | `PaymentPlanSchema` |
| `/api/accounting/*` | 2 (remaining) | Various |

### Tier 2: Entity CRUD (30 routes) — P2 priority

Core business entities — projects, buildings, contacts, units.

| Route Pattern | Count | Schema Needed |
|---------------|-------|--------------|
| `/api/projects` | 4 | `ProjectSchema` |
| `/api/buildings/[id]` | 4 | `BuildingSchema` |
| `/api/contacts` | 4 | `ContactSchema` |
| `/api/units` | 4 | `UnitSchema` |
| `/api/storages` | 3 | `StorageSchema` |
| `/api/parking` | 3 | `ParkingSchema` |
| `/api/opportunities` | 4 | `OpportunitySchema` |
| `/api/communications` | 4 | `CommunicationSchema` |

### Tier 3: Remaining (28 routes) — migrate-on-touch

Settings, preferences, admin operations, non-critical data.

---

## Global Schemas (Reusable)

```typescript
// src/lib/validation/shared-schemas.ts

/** Limit page size to prevent abuse */
export const PageSizeSchema = z.number().int().min(1).max(100).default(20);

/** Common pagination params */
export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: PageSizeSchema,
});

/** Common ID param */
export const IdParamSchema = z.string().min(1).max(128);

/** Date range filter */
export const DateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

/** Sort params */
export const SortSchema = z.object({
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});
```

---

## Implementation Pattern

```typescript
// src/app/api/units/[id]/payments/route.ts

import { z } from 'zod';

const CreatePaymentSchema = z.object({
  amount: z.number().positive().max(999_999_999),
  date: z.string().datetime(),
  method: z.enum(['cash', 'bank_transfer', 'cheque', 'card']),
  description: z.string().max(500).optional(),
  receiptNumber: z.string().max(50).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth(req);
  const { id: unitId } = await params;
  await requireUnitInTenant({ ctx, unitId, path: '/api/units/[id]/payments' });

  const body = CreatePaymentSchema.parse(await req.json());
  // ZodError auto-caught → 400 response
  // body is now typed as { amount: number; date: string; method: ...; }
}
```

---

## Error Handling

Zod parse errors return structured 400 response:

```typescript
// In withAuth or global error handler:
if (error instanceof ZodError) {
  return NextResponse.json(
    { error: 'Validation failed', details: error.errors },
    { status: 400 }
  );
}
```

---

## Acceptance Criteria

- [ ] Shared schemas created in `src/lib/validation/shared-schemas.ts`
- [ ] Tier 1 routes (financial) have Zod validation
- [ ] `PageSizeSchema` prevents unbounded queries
- [ ] ZodError returns 400 with structured error details
- [ ] No `any` types introduced — schemas produce proper TypeScript types

---

## Risks

- **Breaking existing clients**: Strict validation may reject previously-accepted loose input. Mitigation: use `.optional()` and `.default()` generously during initial rollout.
- **Schema drift**: Schemas must match Firestore document structure. Mitigation: derive Firestore types from Zod schemas (`z.infer<typeof Schema>`).
