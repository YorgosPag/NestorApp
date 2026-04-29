# ADR-327 HANDOFF — Multi-Vendor Architecture Phase 1 COMPLETO

**Date**: 2026-04-29
**Previous session ended at**: Step (i) committed — Sourcing event aggregate card in RFQ detail page. Context ~50%.
**Status**: Phase 1 steps (a)-(i) tutti completati. Phase 2+ deferred.

---

## 📐 ROADMAP PROGRESS

```
✅ a. Types + enterprise IDs + SSoT registry
✅ b. Firestore rules + indexes (deployed)
✅ c. Services (sourcing-event + rfq-line + rfq-service modify)
✅ d. API endpoints (8 routes)
✅ e. UI components — hooks + RfqBuilder migration + RfqLinesPanel + detail page
✅ f. BOQ picker inside RfqBuilder
✅ g. Vendor multi-select — VendorPickerSection
✅ h. Email dispatch on createRfq() — fire-and-forget via dispatchRfqInviteEmails
✅ i. Comparison view extensions (multi-vendor aggregate)
```

---

## 🌐 STEP (i) DELIVERABLES

### New files (3)

| File | Purpose |
|------|---------|
| `src/app/api/procurement/sourcing-events/[eventId]/aggregate/route.ts` | GET aggregate — SourcingEvent + sibling RFQ best totals |
| `src/subapps/procurement/hooks/useSourcingEventAggregate.ts` | Client hook — lazy fetch when sourcingEventId present |
| `src/subapps/procurement/components/SourcingEventSummaryCard.tsx` | Purple card — event title, stats, sibling RFQ table |

### Modified files (3)

| File | Change |
|------|--------|
| `src/app/procurement/rfqs/[id]/page.tsx` | Import hook + component; render when `rfq?.sourcingEventId` |
| `src/i18n/locales/el/quotes.json` | +10 keys `comparison.sourcingEvent.*` |
| `src/i18n/locales/en/quotes.json` | +10 keys `comparison.sourcingEvent.*` |

### Key aggregate shape

```typescript
interface SourcingEventAggregate {
  eventId: string;
  title: string;
  status: SourcingEventStatus;
  rfqCount: number;
  tradeCount: number;
  uniqueVendorCount: number;
  bestPackageTotal: number | null;
  isPartialTotal: boolean;
  rfqs: Array<{
    rfqId: string; title: string; trade: string | null;
    status: RfqStatus; bestQuoteTotal: number | null; winnerQuoteId: string | null;
  }>;
}
```

---

## ⚠️ CRITICAL — DO NOT

1. ❌ **DO NOT push** without explicit order (N.(-1))
2. ❌ **DO NOT expose `unitPrice` to vendors**

---

## 📚 REFERENCES

- **ADR-327 master**: `docs/centralized-systems/reference/adrs/ADR-327-quote-management-comparison-system.md`
- **Aggregate API**: `src/app/api/procurement/sourcing-events/[eventId]/aggregate/route.ts`
- **Hook**: `src/subapps/procurement/hooks/useSourcingEventAggregate.ts`
- **Card**: `src/subapps/procurement/components/SourcingEventSummaryCard.tsx`
