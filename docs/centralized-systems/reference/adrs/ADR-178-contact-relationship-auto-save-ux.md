# ADR-178: Contact Relationship Auto-Save UX (PendingRelationshipGuard)

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-13 |
| **Category** | UX / Contact Relationships |
| **Author** | Claude Code (Anthropic AI) + Γιώργος Παγώνης |

---

## Summary

Enterprise UX pattern that auto-saves pending relationship form data when the parent contact is saved, preventing data loss from users not clicking the "Add" button inside the relationship form.

---

## Problem

Users filling in the relationship form (selecting target contact, type, notes) would then click the main contact **"Save"** button, expecting all changes (including the pending relationship) to be saved. However, the relationship form required its own **"Add/Προσθήκη"** button click. This caused repeated frustration and the perception that "relationships don't work".

### Root Cause
Two separate save actions existed without clear user guidance:
1. **Relationship form "Add"** button - saves the relationship to Firestore `contact_relationships`
2. **Contact "Save"** button - saves only the contact fields via `ContactsService.updateContactFromForm()`

---

## Solution: PendingRelationshipGuard

### Architecture: Service Locator Pattern (Module Singleton)

A module-level singleton that bridges the gap between the `ContactRelationshipManager` (which owns the relationship form submit logic) and `ContactDetails` (which owns the main contact save logic).

### Flow

```
1. ContactRelationshipManager mounts
   → PendingRelationshipGuard.register(handleSubmit)

2. User fills relationship form (selects target contact)
   → PendingRelationshipGuard.setHasPendingData(true)

3. User clicks main contact "Save" button
   → ContactDetails.handleSaveEdit()
   → PendingRelationshipGuard.submitPending()  // Auto-submits relationship
   → ContactsService.updateContactFromForm()    // Then saves contact

4. Component unmounts
   → PendingRelationshipGuard.unregister()
```

### Visual Feedback

An amber warning banner appears inside the relationship form when data is pending:

> Πάτησε "Προσθήκη" για να αποθηκεύσεις τη σχέση. Η σχέση αποθηκεύεται επίσης αυτόματα όταν αποθηκεύεις την επαφή.

---

## Files

| File | Role |
|------|------|
| `src/utils/pending-relationship-guard.ts` | Module singleton (Service Locator) |
| `src/components/contacts/relationships/ContactRelationshipManager.tsx` | Registers `handleSubmit` + tracks dirty state |
| `src/components/contacts/details/ContactDetails.tsx` | Calls `submitPending()` before contact save |
| `src/components/contacts/relationships/RelationshipForm.tsx` | Amber warning banner UI |
| `src/i18n/locales/el/contacts.json` | Greek i18n key: `relationships.form.pendingReminder` |
| `src/i18n/locales/en/contacts.json` | English i18n key: `relationships.form.pendingReminder` |

---

## API

```typescript
// src/utils/pending-relationship-guard.ts

export const PendingRelationshipGuard = {
  register(submitFn: () => Promise<void>): void;   // Register submit callback
  unregister(): void;                               // Cleanup on unmount
  setHasPendingData(hasPending: boolean): void;     // Mark form as dirty/clean
  get hasPendingData(): boolean;                    // Check if pending data exists
  submitPending(): Promise<boolean>;                // Auto-submit (returns true if submitted)
};
```

---

## Complete Relationship Save Flow (Post ADR-178)

### Creating a Relationship

```
1. User navigates to contact details
2. User clicks "Προσθήκη Σχέσης" (Add Relationship)
3. ContactRelationshipManager shows RelationshipForm
4. User selects target contact via ContactSearchManager (EnterpriseContactDropdown)
5. User selects relationship type (31 available types)
6. User optionally fills: position, department, dates, notes, contact info

Two paths to save:

  PATH A (explicit):
    7a. User clicks "Προσθήκη" button inside RelationshipForm
    8a. RelationshipForm.validateForm() → validation passes
    9a. useRelationshipForm.handleSubmit()
    10a. ContactRelationshipService.createRelationship()
    11a. RelationshipCRUDService → FirestoreRelationshipAdapter.saveRelationship()
    12a. Firestore setDoc to contact_relationships collection
    13a. Cache invalidation (RelationshipCacheAdapter + RequestDeduplicator)
    14a. handleGlobalRefresh() → RelationshipProvider reloads
    15a. UI updates with new relationship in list

  PATH B (auto-save via PendingRelationshipGuard):
    7b. User clicks main contact "Save" button (without clicking "Add")
    8b. ContactDetails.handleSaveEdit()
    9b. PendingRelationshipGuard.hasPendingData === true
    10b. PendingRelationshipGuard.submitPending() → executes same flow as 9a-15a
    11b. ContactsService.updateContactFromForm() → saves contact fields
    12b. Both relationship AND contact are saved
```

### Firestore Document Structure

```
Collection: contact_relationships/{id}
{
  id: "rel_XXXXX",
  sourceContactId: string,
  targetContactId: string,
  relationshipType: RelationshipType,  // 31 types
  status: "active" | "inactive" | "pending" | "terminated" | "suspended",
  position?: string,
  department?: string,
  startDate?: string,
  endDate?: string,
  notes?: string,
  contactInfo?: ProfessionalContactInfo,
  createdBy: string,
  lastModifiedBy: string,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Firestore Rules (contact_relationships)

```
CREATE requires: sourceContactId (string), targetContactId (string),
                 relationshipType (string), status (string)
READ: authenticated users with company match or creator
```

---

## Services Architecture

```
src/services/contact-relationships/
├── ContactRelationshipService.ts      # Main orchestrator (cache + CRUD delegation)
├── core/
│   ├── RelationshipCRUDService.ts     # Firestore CRUD + validation
│   └── RelationshipValidationService.ts  # Business rules
├── adapters/
│   └── FirestoreRelationshipAdapter.ts   # Raw Firestore operations
└── cache/
    └── RelationshipCacheAdapter.ts    # Service-layer cache (30s TTL)
```

### UI Component Architecture

```
ContactDetails (main contact page)
  └── UnifiedContactTabbedSection
       └── RelationshipProvider (context: relationships state)
            └── ContactRelationshipManager (orchestrator)
                 ├── RelationshipForm
                 │    ├── ContactSearchManager (EnterpriseContactDropdown)
                 │    └── RelationshipFormFields (type, position, dates, notes)
                 ├── OrganizationTree (for companies)
                 └── RelationshipList (expandable cards)
```

---

## Related ADRs

| ADR | Relation |
|-----|----------|
| ADR-012 | Entity Linking Service — foundational relationship service |
| ADR-121 | Contact Persona System — role-based fields per contact |
| ADR-177 | Employer Picker — entity linking with company contacts |
| ADR-090 | IKA/EFKA Labor Compliance — employment relationships |

---

## Fixes Included

### Stack Overflow in `isEmploymentRelationship` (Production)
- **Problem**: `isEmploymentRelationship()` import from `@/types/contacts/relationships` caused `Maximum call stack size exceeded` in production bundles (likely circular dependency)
- **Fix**: Replaced with inline array check in `RelationshipCRUDService.ts`
- **File**: `src/services/contact-relationships/core/RelationshipCRUDService.ts`

### Diagnostic Cleanup
- Removed all `console.log('🔴 DIAG[...]')` statements from 6 files
- Replaced with proper `logger.error()` calls where error logging was needed

---

## Changelog

| Date | Change |
|------|--------|
| 2026-02-13 | Initial implementation: PendingRelationshipGuard, auto-save, amber banner, i18n keys, stack overflow fix, diagnostic cleanup |
