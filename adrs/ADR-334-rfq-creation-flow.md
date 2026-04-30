# ADR-334 — RFQ Creation Flow Refinement

**Status:** PROPOSED  
**Date:** 2026-04-30  
**Author:** Giorgio Pagonis  
**Supersedes:** N/A  
**Related:** ADR-328 §5.DD (creation flow out of scope, audit and deferral)

---

## Context

ADR-328 §5.DD audits the current RFQ creation flow and explicitly declares it out of scope. The detail page (`/procurement/rfqs/[id]`) uses a tolerance contract: graceful fallbacks for missing fields (`projectName` resolved from `projectId`, `category` absent from schema — shown as `—`). The creation flow itself is not changed.

ADR-328 §5.DD.3 documents the current minimum: only `title` + `projectId` required. §5.DD.4 defines a "sensible minimum" recommendation for this ADR based on construction industry patterns (Procore, SAP Ariba).

## Key findings from ADR-328 §5.DD.3 audit

- `RFQ` schema has `status`, `projectId` ✅ but NO `projectName` denormalized and NO `category` field
- Award does not auto-transition RFQ to `closed` — gap documented for ADR-335
- Denormalization decision: prefer denormalize `projectName` at creation/update time

## Recommended scope (§5.DD.4)

- Add `projectName` denormalization at creation and on project rename
- Add `category` field to `RFQ` schema (construction trade category)
- Refine required fields to sensible minimum (title, projectId, deadline, at least 1 line)
- Integrate with BOQ picker enhancements

## References

- ADR-328 §5.DD — creation flow audit, tolerance contract, deferral rationale
- ADR-335 — RFQ lifecycle (award→status transition gap)

## Changelog

| Date | Change |
|------|--------|
| 2026-04-30 | Stub created from ADR-328 §5.DD deferral |
