# SPEC-257C: Selective Payment Visibility

| Field | Value |
|-------|-------|
| **ADR** | ADR-257 (Customer AI Access Control) |
| **Phase** | 3 of 7 |
| **Priority** | HIGH — core buyer functionality |
| **Status** | PENDING |
| **Depends On** | SPEC-257B (unit-level scoping must work) |

---

## Objective

Ο buyer βλέπει ΜΟΝΟ: επόμενη δόση, ληξιπρόθεσμες, συνολικό υπόλοιπο — στο δικό του unit.

## Current State

- `blockedFields` μπλοκάρει ΟΛΑ τα `PAYMENT_SUMMARY_FIELDS` για buyer
- Buyer ρωτάει "πόσα χρωστάω;" → "Δεν έχω αυτή την πληροφορία"
- All-or-nothing: ή βλέπεις ΟΛΑ ή ΤΙΠΟΤΑ

## Target State

- Buyer βλέπει (ΜΟΝΟ δικό unit):
  - `commercial.paymentSummary.nextInstallmentAmount`
  - `commercial.paymentSummary.nextInstallmentDate`
  - `commercial.paymentSummary.remainingAmount`
  - `commercial.paymentSummary.overdueInstallments` (αριθμός μόνο)
- Buyer ΔΕΝ βλέπει:
  - `commercial.askingPrice` (τιμή λίστας)
  - `commercial.paymentSummary.totalAmount` (συνολικό ποσό πώλησης)
  - `commercial.paymentSummary.paidAmount` (πληρωμένο)
  - `commercial.paymentSummary.paidPercentage`
- Owner βλέπει: ΟΛΑ τα παραπάνω + `finalPrice`

## Files to Modify

| File | Action | Details |
|------|--------|---------|
| `src/config/ai-role-access-matrix.ts` | MODIFY | Νέο concept: split payment fields σε `blocked` + `visible` |
| `src/services/ai-pipeline/tools/agentic-tool-executor.ts` | MODIFY | `redactRoleBlockedFields()` — granular per-field |

## Implementation Steps

### Step 1: Split payment fields στο SSoT matrix

```typescript
// ai-role-access-matrix.ts — νέα shared field sets

const BUYER_BLOCKED_PAYMENT_FIELDS = [
  'commercial.paymentSummary.totalAmount',
  'commercial.paymentSummary.paidAmount',
  'commercial.paymentSummary.paidPercentage',
  'commercial.paymentSummary.paidInstallments',
  'commercial.paymentSummary.totalInstallments',
] as const;

// Buyer VISIBLE (ΔΕΝ μπαίνουν στο blockedFields):
// - nextInstallmentAmount, nextInstallmentDate, remainingAmount, overdueInstallments
```

### Step 2: Update buyer config

```typescript
buyer: {
  blockedFields: [
    ...COMMERCIAL_PRICING_FIELDS,       // askingPrice, finalPrice
    ...BUYER_IDENTITY_FIELDS,           // buyerContactId, buyerName (άλλων)
    ...BUYER_BLOCKED_PAYMENT_FIELDS,    // paidAmount, totalAmount, paidPct
  ],
  // NOT blocking: nextInstallment, remainingAmount, overdueInstallments
}
```

### Step 3: Update owner config

```typescript
owner: {
  blockedFields: [
    ...COMMERCIAL_PRICING_FIELDS.filter(f => f !== 'commercial.finalPrice'),
    // Owner βλέπει finalPrice + ΟΛΑ payment fields
  ],
}
```

## AI Response Format (Απόφαση Γιώργου)

```
"Η επόμενη δόση σου είναι €10.000 στις 30/04. Συνολικό υπόλοιπο: €55.000"
```

ΟΧΙ αναλυτικά, ΟΧΙ PDF, ΟΧΙ export.

## Existing Functions to Reuse

- `deriveBlockedFieldSet()` — `ai-role-access-matrix.ts` (auto flat→nested derivation)
- `redactRoleBlockedFields()` — `agentic-tool-executor.ts` (already handles both forms)
- `COMMERCIAL_PRICING_FIELDS`, `PAYMENT_SUMMARY_FIELDS` — shared field sets

## Acceptance Criteria

- [ ] Buyer ρωτάει "πόσα χρωστάω;" → βλέπει υπόλοιπο + επόμενη δόση
- [ ] Buyer ΔΕΝ βλέπει paidAmount, totalAmount, paidPercentage
- [ ] Buyer ΔΕΝ βλέπει askingPrice
- [ ] Owner βλέπει finalPrice + ΟΛΑ payment fields
- [ ] Tenant ΔΕΝ βλέπει τίποτα payment-related
