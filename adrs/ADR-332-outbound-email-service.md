# ADR-332 — Outbound Email Service

**Status:** RESOLVED — NOT NEEDED (V15 pre-flight cleared)  
**Date:** 2026-04-30  
**Author:** Giorgio Pagonis  
**Supersedes:** N/A  
**Related:** ADR-328 §5.V.4 (V15 pre-flight), ADR-070 / ADR-071 (email pipeline)

---

## Context

ADR-328 §5.V.4 requires verifying that an outbound email service exists before implementing vendor notifications. The verification step V15 was marked as a hard prerequisite: if absent, ADR-332 (this ADR) must be opened before proceeding.

## Resolution

During ADR-328 Phase 12 pre-flight (2026-04-30), V15 was confirmed: outbound email is available via `sendReplyViaMailgun` (pattern from `po-email-service.ts`). ADR-328 Phase 12 reused this existing service for vendor winner/rejection notifications and invite emails.

**This ADR is therefore a no-op.** The outbound email service is already operational as part of ADR-070 / ADR-071 (email pipeline). No new service layer is required.

## If you are reading this after 2026-05-06

If the `sendReplyViaMailgun` service has been removed or refactored, re-evaluate whether a dedicated outbound email service ADR is needed.

## References

- ADR-070 — Email ingestion pipeline (also provides outbound via Mailgun)
- ADR-071 — Email routing rules
- ADR-328 §5.V — Vendor notification implementation

## Changelog

| Date | Change |
|------|--------|
| 2026-04-30 | Stub created; immediately resolved as NOT NEEDED (V15 cleared in Phase 12) |
