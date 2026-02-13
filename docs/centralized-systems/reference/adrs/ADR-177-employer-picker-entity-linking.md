# ADR-177: Employer Picker — Entity Linking with Company Contacts

**Status**: Accepted
**Date**: 2026-02-13
**Category**: UI Component / Data Quality

## Context

Στη φόρμα επαφών (Individual Contact), το πεδίο "Εργοδότης" ήταν απλό text input. Αυτό οδηγούσε σε ασυνέπεια δεδομένων (π.χ. "ΤΕΡΝΑ", "Τέρνα ΑΕ", "TERNA" — ίδια εταιρεία, 3 διαφορετικές εγγραφές).

Βάσει best practices (Salesforce Account linking, HubSpot Company association, LinkedIn employer entity, Dynamics 365 Account lookup), ο εργοδότης πρέπει να συνδέεται με existing Company contacts.

## Decision

Δημιουργήθηκε `EmployerPicker` component (autocomplete) που:

1. **Αναζητά** existing Company contacts (companyName, tradeName, vatNumber)
2. **Συνδέει** τον Individual με Company μέσω `employerId` (entity linking)
3. **Εμφανίζει** badge "LINKED" (πράσινο) όταν υπάρχει σύνδεση
4. **Επιτρέπει** free text fallback για εταιρείες που δεν υπάρχουν ως contacts

## Architecture

### Component
- **Path**: `src/components/shared/EmployerPicker.tsx`
- **Pattern**: Ακολουθεί ακριβώς το `EscoOccupationPicker.tsx` (ADR-034)
- **UI**: Radix Popover + Input (ADR-001 compliant)
- **Icon**: `Building2` (αριστερά), `Loader2`/`X` (δεξιά)
- **Search**: Debounced 300ms, min 2 chars, client-side filtering

### Data Model

```typescript
// IndividualContact (contracts.ts)
employer?: string;        // Display name (always set)
employerId?: string;      // Company contact ID (set when linked)

// EmployerPickerValue
interface EmployerPickerValue {
  employer: string;       // Human-readable text
  employerId?: string;    // Linked company ID
}
```

### Integration Points
- **Form**: Custom renderer στο `UnifiedContactTabbedSection.tsx`
- **Write mapper**: `individual.ts` — `employerId: formData.employerId || null`
- **Read mapper**: `individualMapper.ts` — `getSafeFieldValue(contact, 'employerId')`

## Canonical Sources

| Source | Path |
|--------|------|
| Component | `src/components/shared/EmployerPicker.tsx` |
| Type | `EmployerPickerValue` in EmployerPicker.tsx |
| Contact type | `employerId` in `src/types/contacts/contracts.ts` |
| Form type | `employerId` in `src/types/ContactFormTypes.ts` |

## Consequences

### Positive
- Συνέπεια δεδομένων: Μία εταιρεία → ένα ID
- Entity linking: Δυνατότητα reverse lookup (ποιοι εργαζόμενοι ανήκουν σε ποια εταιρεία)
- Backward compatible: Υπάρχοντα contacts με free text employer συνεχίζουν να λειτουργούν

### Negative
- Επιπλέον API call για fetch company contacts (cached, μία φορά)
- Client-side filtering αντί server-side (αποδεκτό για <500 companies)
