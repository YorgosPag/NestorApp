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

## Design decisions

**Q4 — AI confidence display:** Shown per-field in edit mode only (hidden in browse view per ADR-328 §5.CC.1). Color-coded: 🟢 ≥85% high, 🟡 60–84% medium, 🔴 <60% low. User knows where to focus review. Data already stored in Firestore from scan — no extra extraction needed.

**Q3 — Edit lock on accepted/awarded quotes:** Locked — read-only when `status === 'accepted'` or award is set. Clear CTA shown: «Για επεξεργασία → Επαναφορά σε Υπό Εξέταση». One-click Restore (already built in Phase 11) unlocks → user edits → re-approves. Full chain logged in history (ADR-330). Rationale: silent edits on committed data = legal risk + broken audit trail. Industry standard: Primavera, Procore, SAP Ariba all enforce state-machine discipline on approved bids.

**Q2 — Editable fields:** Both levels editable:
- **Header**: date, reference number, validity (validUntil), payment terms, delivery terms, warranty, vatIncluded flag, laborIncluded flag
- **Lines**: description, quantity, unit, unitPrice, vatRate, lineTotal (auto/override toggle)
Rationale: AI makes mistakes. If only editable at scan time, users are stuck with wrong data. Industry standard (Primavera, SAP Ariba, Procore): full edit after initial entry. Rule: what you can see, you can edit.

**Q1 — Edit placement:** Inline edit mode — the same page switches to editable state (no modal, no new page). Fields become editable in-place when Edit is clicked. Save/Cancel buttons appear. Pattern: Google Sheets, Gmail draft, Linear, Notion. The "Edit Dialog" name in the ADR title is a misnomer — rename to "Quote Edit Mode".

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
