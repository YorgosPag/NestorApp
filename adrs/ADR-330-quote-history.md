# ADR-330 — Quote History Side Panel

**Status:** PROPOSED  
**Date:** 2026-04-30  
**Author:** Giorgio Pagonis  
**Supersedes:** N/A  
**Related:** ADR-328 §5.R (history placeholder wired, implementation deferred)

---

## Context

ADR-328 §5.R defines the History side panel for the RFQ detail page. The panel button is wired as a disabled placeholder. Full audit event display — including `linesSumMismatch` inconsistencies (§5.Z.4) and award reason edit (§5.X, §5.BB) — is deferred to this ADR.

## Scope

- History event list for a quote (creation, status transitions, line edits, award, notifications)
- Side-by-side diff view between quote versions (v(N) vs v(N-1))
- `awardReason` edit action: creates new audit entry `action: 'reason_modified'` — original never mutated (ADR-195 invariant)
- `linesSumMismatch` inconsistencies storage — API route extended to persist `inconsistencies` array
- i18n keys under `rfqs.history.*`

## Out of scope

- Global activity feed across all quotes (future)

## References

- ADR-328 §5.R — original specification and placeholder
- ADR-328 §5.X — award reason capture (edit-reason action deferred here)
- ADR-328 §5.Z.4 — inconsistencies audit metadata deferred here
- ADR-195 — EntityAuditService, audit trail invariants

## Changelog

| Date | Change |
|------|--------|
| 2026-04-30 | Stub created from ADR-328 §5.R deferral |
