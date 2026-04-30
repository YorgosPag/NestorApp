# ADR-329 — Quote Comments Side Panel

**Status:** PROPOSED  
**Date:** 2026-04-30  
**Author:** Giorgio Pagonis  
**Supersedes:** N/A  
**Related:** ADR-328 §5.R (comments placeholder wired, implementation deferred)

---

## Context

ADR-328 §5.R defines the Comments side panel for the RFQ detail page. The panel button is wired in `QuoteDetailsHeader` as a disabled placeholder (`handleStub` via `comingSoon` tooltip). The full implementation is deferred to this ADR.

## Scope

- Comments thread UI in the right-pane side panel
- Per-quote comment creation, display, and deletion
- Real-time updates via Firestore `onSnapshot`
- Firestore collection: `quote_comments` (sub-collection of `quotes/{id}`)
- i18n keys under `rfqs.comments.*`

## Out of scope

- Comment reactions, mentions, or attachments (future)
- Cross-RFQ comment aggregation (future)

## References

- ADR-328 §5.R — original specification and placeholder
- ADR-195 — EntityAuditService (audit trail for comment creation/deletion)
- ADR-267 — QuoteDetailsHeader SSoT (where the Comments button lives)

## Changelog

| Date | Change |
|------|--------|
| 2026-04-30 | Stub created from ADR-328 §5.R deferral |
