# ADR-331 — Construction-Grade Quote Comparison: Inclusions, TCO, Weighted Scoring

**Status:** PROPOSED  
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
- Vendor qualification flags (certifications, past consistency)
- Reference patterns: Procore, SAP Ariba (construction-leaning per §5.T.3)
- Replace naive `isCheapestEligible` comparison with normalized TCO

## Out of scope

- Export to PDF/Excel (separate export ADR, may overlap)

## References

- ADR-328 §5.T — ComparisonPanel scope audit and construction-grade deferral
- ADR-328 §5.X — award reason: "naive cheapest" note referencing ADR-331 refinement
- `src/subapps/procurement/utils/quote-cheapest.ts` — naive implementation to replace

## Changelog

| Date | Change |
|------|--------|
| 2026-04-30 | Stub created from ADR-328 §5.T deferral |
