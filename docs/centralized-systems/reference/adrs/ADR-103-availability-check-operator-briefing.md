# ADR-103: Availability Check & AI Operator Briefing

> **Status**: IMPLEMENTED
> **Date**: 2026-02-08
> **Category**: AI Architecture / Pipeline Infrastructure
> **Related**: ADR-080, ADR-089, ADR-169, UC-001

## Context

Το UC-001 (Αίτημα Ραντεβού) δημιουργούσε proposals χωρίς πληροφορίες διαθεσιμότητας.
Ο χειριστής (operator) έπρεπε να ελέγξει χειροκίνητα το ημερολόγιο πριν εγκρίνει.

## Decision

Δημιουργία server-side availability check service που:

1. **LOOKUP step**: Ερωτά τα υπάρχοντα ραντεβού για τη ζητούμενη ημερομηνία
2. **PROPOSE step**: Συμπεριλαμβάνει `operatorBriefing` (εσωτερική ενημέρωση AI) στο proposal
3. **Operator Inbox UI**: Εμφανίζει ξεχωριστό Card "Ενημέρωση AI" με:
   - Λίστα υπαρχόντων ραντεβού εκείνη τη μέρα
   - Ελεγχο σύγκρουσης ωρών (conflict detection)
   - Visual feedback: μπλε border αν OK, κόκκινο αν σύγκρουση

## Architecture

```
Email → AI detects appointment_request
→ UC-001 LOOKUP:
    1. Find sender contact (existing)
    2. Extract date/time from AI entities (existing)
    3. checkAvailability() ← NEW: query Firestore for same-date appointments
→ UC-001 PROPOSE:
    - operatorBriefing: "Στις 15/02 υπάρχουν 2 ραντεβού: 10:00 - X, 14:00 - Y. Η ώρα 11:00 είναι διαθέσιμη."
    - draftReply: (email template for customer — existing)
→ Operator Inbox:
    - Card 1: "Ενημέρωση AI — Διαθεσιμότητα" (internal, blue/red border)
    - Card 2: "Προσχέδιο Απάντησης" (email to customer)
```

## Implementation Files

| File | Purpose |
|------|---------|
| `src/services/ai-pipeline/shared/availability-check.ts` | Server-side availability query + briefing builder |
| `src/services/ai-pipeline/modules/uc-001-appointment/appointment-module.ts` | LOOKUP + PROPOSE integration |
| `src/components/admin/operator-inbox/ProposalReviewCard.tsx` | UI Card rendering |

## Briefing Scenarios

| Scenario | Briefing Output |
|----------|----------------|
| Δεν ζητήθηκε ημερομηνία | "Ο αποστολέας δεν ζήτησε συγκεκριμένη ημερομηνία." |
| Ημερομηνία ελεύθερη | "Στις X δεν υπάρχουν ραντεβού. Η ημερομηνία είναι διαθέσιμη." |
| Ημερομηνία με ραντεβού, ώρα ελεύθερη | "Στις X υπάρχουν N ραντεβού: [λίστα]. Η ώρα Y είναι διαθέσιμη." |
| Σύγκρουση ώρας | "Στις X υπάρχουν N ραντεβού: [λίστα]. ⚠ Η ώρα Y ΣΥΓΚΡΟΥΕΤΑΙ." |

## Design Decisions

- **Non-fatal**: Αν η query αποτύχει, η proposal δημιουργείται χωρίς briefing
- **Server-side only**: Χρησιμοποιεί admin Firestore SDK (όχι client)
- **Reusable**: Η `checkAvailability()` είναι στο `shared/` — διαθέσιμη για μελλοντικά modules
- **Separation of concerns**: Το `operatorBriefing` είναι εσωτερικό — ξεχωριστό από το `draftReply` (email πελάτη)

## Changelog

| Date | Change |
|------|--------|
| 2026-02-08 | Initial implementation — PRE-001 partial completion |
