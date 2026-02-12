# Addendum: Enterprise Lockdowns for Obligations Document Control
Date: 2026-02-12
Applies to: Obligations module (`/obligations`) and PDF issue/export pipeline

## 1) Doc Numbering Spec (Locked)
Format:
- `OBL-{YYYY}-{SCOPE}-{SEQ4}`
- Example: `OBL-2026-PRJ42-0007`, `OBL-2026-BLD12-0013`, `OBL-2026-UNT3A-0021`

Rules:
- `YYYY`: issue year.
- `SCOPE`: normalized scope key from project/building/unit.
- `SEQ4`: zero-padded running sequence per `{YYYY, SCOPE}`.
- Uniqueness required at least on active records by (`docNumber`, `revision`).

Indexes:
- obligations: `docNumber` ASC, `revision` DESC
- obligations: `projectId` ASC, `updatedAt` DESC
- obligations: `buildingId` ASC, `updatedAt` DESC

Collision handling:
- Generate server-side.
- Retry with next sequence if collision detected.
- Never reuse deleted sequence ids.

## 2) Status State Machine (Locked)
Statuses:
- `draft`, `in-review`, `returned`, `approved`, `issued`, `superseded`, `archived`, `completed`

Allowed transitions:
- `draft -> in-review`
- `in-review -> returned | approved`
- `returned -> in-review | draft`
- `approved -> issued | returned`
- `issued -> superseded | archived | completed`
- `superseded -> archived`
- `completed -> archived`

Validation requirements:
- To `in-review`: assignee + due date required.
- To `approved`: at least one approval entry marked approved.
- To `issued`: docNumber + revision + approved entries required.
- To `superseded`: revisionNotes required.

Permission policy (role-level, to enforce in auth layer):
- `draft/in-review/returned`: author/reviewer/project-manager
- `approved/issued`: approver/legal/project-manager
- `superseded/archived`: legal/project-manager

## 3) Export vs Issue (Locked)
- `Export PDF` is always available for working copies.
- `Issue PDF` is allowed only for `status=issued` and passes state validations.
- `Issue PDF` produces immutable issue record + distribution proof.

## 4) Transmittal Model (Locked)
Entity: `obligation_transmittals`
- `obligationId`, `revision`, `docNumber`
- `issuedBy`, `issuedAt`
- `recipients[]` (id/email, role, channel)
- `attachments[]` (fileId, label)
- `message`
- `deliveryProof[]` (channel, deliveredAt, status)
- `hash` (PDF hash)

This entity is mandatory for enterprise-grade issuance traceability.

## 5) WORM / Retention (Locked)
- Issued snapshots immutable (append-only).
- No hard delete on issued snapshots/transmittals.
- Retention policy minimum 10 years (configurable by jurisdiction).
- All changes logged in audit trail with actor/timestamp/correlationId.

## 6) Signing Architecture (Locked Direction)
- Server-side signing pipeline.
- PAdES baseline profile.
- Trusted timestamping + long-term validation material retention.
- Verification result stored alongside `pdfSnapshot`.

## 7) PDF Quality Gates (Locked)
- Golden output tests for representative templates.
- Deterministic layout checks for headings/page breaks/TOC numbering.
- Performance budget for large documents.
- Idempotent issue operation (same input -> same snapshot hash).
- Concurrency guard: single successful issue action per revision.

## 8) Canonical PDF Structure (Locked)
1. Cover
2. Document Control Summary
3. TOC
4. Clauses
5. Appendices (phase/milestone/cost) when present
6. Approvals/Signatures
7. Distribution/Issue reference

No alternate structure variants are allowed.
