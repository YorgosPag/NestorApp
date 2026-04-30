# ADR-331 — Construction-Grade Quote Comparison: Inclusions, TCO, Weighted Scoring

**Status:** IMPLEMENTED  
**Date:** 2026-04-30  
**Author:** Giorgio Pagonis  
**Supersedes:** N/A  
**Related:** ADR-328 §5.T (ComparisonPanel scope audit, construction-grade deferred)

---

## Context

ADR-328 §5.T audits the existing `ComparisonPanel` and confirms it is solid for small-scale procurement (3–5 quotes, §5.N). Construction-grade features — Inclusions/Exclusions matrix, normalized TCO, weighted scoring, vendor qualification — are explicitly deferred to this ADR per §5.T.4.

The naive cheapest-detection in `quote-cheapest.ts` (`isCheapestEligible` compares pre-VAT net totals) is documented as a placeholder pending normalized TCO from this ADR.

## Scope

- Inclusions/Exclusions matrix (per-quote, per-line)
- Normalized TCO calculation (labor, VAT, delivery, warranty capitalized)
- Weighted scoring model (price / reliability / delivery / terms — user-adjustable weights)
- Reference patterns: Procore, SAP Ariba (construction-leaning per §5.T.3)
- Replace naive `isCheapestEligible` comparison with normalized TCO

## Design decisions

**Q4 — Vendor certifications:** Removed from scope. Never a real need in practice — not worth building. If it becomes relevant in the future, open a new ADR.

**Q3 — Scoring weights:** Company-level defaults (set once in Settings, apply to all RFQs) + optional per-RFQ override when a specific project has different priorities (e.g. fire protection RFQ: certifications weight ↑, price weight ↓). Pattern: SAP Ariba per-event model, simplified. No per-RFQ configuration forced — defaults cover 90% of cases.

**Q2 — Normalization components:**
- **VAT (compute)**: if `vatIncluded === false` → normalized total = `total × 1.24`. Only item computed as a € delta. Precise and unambiguous.
- **Labor (flag)**: if `laborIncluded === false` → show ⚠️ «Δεν περιλαμβάνει εργατικά». Cannot compute market rate → flag only. #1 hidden cost in Greek construction.
- **Delivery (flag)**: if delivery cost is a line item → already in total. If absent → flag «Μεταφορά εκτός τιμής».
- **Warranty (display field)**: show warranty duration (e.g. «12 μήνες» vs «24 μήνες») as a comparison field. Do not capitalize into €.
- Rule: only compute what can be computed correctly. Everything else is a flag.

**Q1b — Normalization input:** AI proposes automatically (existing `vatIncluded`, `laborIncluded` flags already extracted during scan), user can override per-quote if AI was wrong. Pattern: AI-first + manual correction. No extra scan step needed — data already exists in Quote object.

**Q1 — Core problem:** The current comparison uses raw totals only. Two quotes are not comparable as-is when they differ in VAT inclusion (24% vs 0%), labor inclusion (yes vs no), or delivery costs. The system declares the wrong winner. The fix: normalize all quotes to the same base before comparing (apples-to-apples).

## Out of scope

- Export to PDF/Excel (separate export ADR, may overlap)

## References

- ADR-328 §5.T — ComparisonPanel scope audit and construction-grade deferral
- ADR-328 §5.X — award reason: "naive cheapest" note referencing ADR-331 refinement
- `src/subapps/procurement/utils/quote-cheapest.ts` — naive implementation to replace

## Implementation notes

- `normalizeTco(quote)` in `comparison-service.ts` reads `extractedData.vatIncluded/laborIncluded` (AI-extracted, existing fields). VAT delta computed as `total × 0.24` when `vatIncluded === false`. Labor/delivery → flags only (no € computation per Q2 rule).
- `QuoteComparisonEntry` now carries `tco: TcoNormalization` — normalized total, VAT delta, labor flag, delivery flag, warranty text.
- `priceScore()` and `cheapest` flag use `normalizedTotal` (apples-to-apples ranking).
- `ComparisonPanel` shows delta badge (`+€X VAT`) in Total column; labor/delivery/warranty flags inline per row.
- Per-RFQ TCO override (Q1b) is V2 — requires `tcoOverrides` API params + re-ranking.

## Changelog

| Date | Change |
|------|--------|
| 2026-04-30 | Stub created from ADR-328 §5.T deferral |
| 2026-04-30 | IMPLEMENTED — TCO normalization (VAT delta, labor/delivery flags, warranty), normalized ranking in `comparison-service.ts`, TCO display in `ComparisonPanel.tsx` |
