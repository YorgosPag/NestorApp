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

## Design decisions

**Q3 — BOQ integration depth:** ⚠️ OPEN QUESTION — needs real-world testing before decision. Giorgio confirmed BOQ→RFQ is the primary flow (almost every RFQ starts from BOQ). Full connection desired but exact semantics unclear: (A) copy lines only, (B) live sync, (C) award price feeds back to BOQ as actual cost, or combination. Decision deferred until Giorgio tests current BOQ picker and has a concrete picture. Do NOT implement deeper integration without reopening this question first.

**Q2 — projectName denormalization:** Store `projectName` inside the RFQ document (Firestore NoSQL pattern — duplicate where you read). On project rename: batch update all related RFQs in the project update API route. Rationale: Firestore reads cost money; extra query per RFQ page load adds latency and cost. Google's official Firestore guidance recommends denormalization for frequently-read fields.

**Q1 — Required fields:** Two-gate model:
- **Gate 1 (create draft):** title + projectId only — saves immediately, no blocking. No change from today.
- **Gate 2 (activate → send invites):** deadline + at least 1 line required. System blocks activation with clear validation message, not creation. Category field not needed at RFQ level — each line already has per-line trade (ειδικότητα).
- Pattern: Primavera Unifier, Procore, SAP Ariba all use draft-first + activation gate.

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
