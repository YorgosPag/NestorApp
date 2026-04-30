# ADR-335 — RFQ Lifecycle Management

**Status:** PROPOSED  
**Date:** 2026-04-30  
**Author:** Giorgio Pagonis  
**Supersedes:** N/A  
**Related:** ADR-328 §5.EE (lifecycle management out of scope, audit and deferral)

---

## Context

ADR-328 §5.EE audits the current RFQ status field and explicitly declares lifecycle changes out of scope. The detail page uses a read-only tolerance contract for `closed`, `cancelled`, and `archived` statuses. The gap identified: awarding a winner does NOT auto-transition RFQ `status` to `closed` — these are decoupled.

## Key findings from ADR-328 §5.EE.3 audit

- `RFQ.status` values present: `draft`, `active`, `closed`, `archived`
- No `cancelled` status in current schema (tolerance contract uses `closed` as proxy)
- Award (`winnerQuoteId` set) and status are decoupled — no auto-close on award
- No close UI exists on the detail page (read-only closed state only)

## Recommended scope (§5.EE.4 — sensible lifecycle)

- Auto-transition RFQ `status → closed` when winner is awarded (or make it explicit one-click)
- Add `cancelled` status with reason capture
- Close/Reopen actions in the RFQ header
- Archive flow: closed → archived with configurable delay or manual trigger
- Read-only enforcement: prevent line edits and invite sends when `status === 'closed'`

## References

- ADR-328 §5.EE — lifecycle audit, tolerance contract, deferral rationale
- ADR-334 — RFQ creation flow (category field, denormalization — related schema work)

## Changelog

| Date | Change |
|------|--------|
| 2026-04-30 | Stub created from ADR-328 §5.EE deferral |
