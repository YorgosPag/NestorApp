# ADR-333 — Quote Edit Dialog with AI Confidence

**Status:** PROPOSED  
**Date:** 2026-04-30  
**Author:** Giorgio Pagonis  
**Supersedes:** N/A  
**Related:** ADR-328 §5.CC (AI confidence deferred), §5.I.3 (Edit action placeholder)

---

## Context

ADR-328 §5.CC.3 defers the Quote Edit Dialog to this ADR. The "Edit" overflow action in `QuoteDetailsHeader` is a `handleStub` placeholder with `comingSoon` tooltip. AI confidence percentage is intentionally hidden from browse views (§5.CC.1) — it may surface in the edit dialog to help the user understand extraction quality during manual correction.

ADR-328 §5.Z note: negative `unitPrice` is blocked at API level by `min(0)` in `UpdateQuoteSchema`. The edit dialog should resolve this with proper UX (explicit discount-line flag).

## Scope

- Full quote field editing: vendor, date, reference, validity, payment/delivery terms, warranty
- Line editing with AI confidence per-field display (only visible in edit mode)
- Discount-line flag to allow negative unit prices
- Attachment management: upload, list, preview, delete, download (or sibling ADR)
- Save via `PATCH /api/quotes/{id}` with optimistic update
- i18n keys under `rfqs.editDialog.*`

## Out of scope

- AI re-extraction on edit (would require new scan — separate flow)

## References

- ADR-328 §5.CC — AI confidence and edit dialog deferral
- ADR-328 §5.I.3 — Edit action placeholder in header actions
- ADR-328 §5.Z — Line validation (negative price note)

## Changelog

| Date | Change |
|------|--------|
| 2026-04-30 | Stub created from ADR-328 §5.CC.3 deferral |
