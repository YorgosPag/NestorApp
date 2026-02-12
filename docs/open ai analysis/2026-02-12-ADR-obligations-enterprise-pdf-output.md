# ADR Proposal: Enterprise Obligations PDF Output & Document Control
Date: 2026-02-12
Status: Proposed

## Context
Το Nestor obligations module εξάγει PDF, αλλά λείπουν enterprise document-control στοιχεία (doc identity, revision governance, issue/distribution, approvals/signatures).

## Decision
Υιοθετούμε governed PDF output με fixed δομή και metadata policy.

### Mandatory PDF Structure
1. Cover Page (Company / Project / Building-Unit Scope / Parties)
2. Document Control Summary (Doc No, Revision, Status, Issue Date, Prepared/Reviewed/Approved)
3. TOC
4. Contractual Clauses
5. Optional Appendices (phase/milestone/cost bindings)
6. Approvals/Signatures Block
7. Distribution & Issue Log

### Status Print Semantics
- `draft`: watermark draft, no issue log mandatory
- `in-review` / `returned`: review panel mandatory
- `approved`: approval panel mandatory
- `issued`: issue log + distribution mandatory
- `superseded`: superseded banner + replacement reference
- `archived`: archived banner + immutable snapshot reference

## Data Model Impact (Firestore)
Primary collection: `obligations`
- Add/standardize: `docNumber`, `revision`, `issueDate`, `distribution[]`, `issueLog[]`, `pdfSnapshot`, `approvals[]`, `scope` (project/building/unit)

Secondary collection: `obligation_revisions`
- Immutable snapshot ανά revision για legal traceability

## Consequences
Positive:
- Auditability, traceability, καλύτερη νομική/συμβατική αποτύπωση.
- Enterprise-style UX συμβατό με CDE πρακτικές.

Tradeoffs:
- Περισσότερα απαιτούμενα metadata στη ροή έκδοσης.
- Απαιτεί migration strategy για παλιές εγγραφές.

## Implementation Notes
- Reuse υπάρχον `src/services/pdf/*` renderer architecture.
- Backward compatible fallbacks όταν metadata λείπουν.
- Share flow: preview/download + native share fallback.
