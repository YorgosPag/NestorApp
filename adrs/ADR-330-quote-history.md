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

## Design decisions

**Q6 — Diff detail:** Full field-level diff per event. Every changed field shown as old → new. Example:
```
Γιώργης επεξεργάστηκε γραμμή 3:
  Τιμή:     1.200€ → 1.100€
  Ποσότητα: 5 → 6
  Μονάδα:   τεμ → m²
```
Implementation: `EntityAuditService.recordChange()` already stores `changes: { field, oldValue, newValue }[]` — the UI renders it as a diff list. No extra storage work needed.

**Q5 — Visibility / Permissions:** Same as Contacts history — **Company Admin + Super Admin only**. Firestore rules on `entity_audit_trail` deny reads to non-admin users (enforced at DB level, not UI). Regular users simply don't see the History button or get an access error. No custom permission logic needed — the existing rules cover it.

**Q4 — Scope:** History is **RFQ-level** (one unified timeline for the entire RFQ), not per-tab. Events from all 3 tabs (Quotes, Comparison, Setup) appear in a single chronological feed. Pattern matches the centralized Contacts history (same component, different data source). SSOT: reuse the existing centralized history component — do not build a new one. Pre-implementation step: grep for the Contacts history component and extend it for RFQ events.

**Q3 — Sort order:** Newest first (most recent event at top). Pattern: Gmail, Linear, GitHub activity feed.

**Q2 — Event detail level:** Full context per event: actor (name) + action + details + relative timestamp. Examples:
- Status: «Γιώργης Παγώνης → Εγκρίθηκε — πριν 2 ώρες»
- Line edit: «Γιώργης Παγώνης άλλαξε τιμή γραμμής 3: 1.200€ → 1.100€ — πριν 2 ώρες»
- Award: «Γιώργης Παγώνης ανέδειξε νικητή: Θερμόλαντ (12.500€) — χθες στις 14:32»
- Notification: «Εστάλη email απόρριψης στον Θερμόλαντ — πριν 3 ημέρες»

**Q1 — Event types:** All 4 groups logged and displayed:
- **Status transitions**: submitted → under_review → accepted/rejected, award, restore
- **Line edits**: price change per line (old → new), line added, line removed
- **Communications**: vendor notification sent (winner/rejection template), renewal request sent
- **Scan & versioning**: AI scan completed, new version created (v2, v3…), version superseded

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
