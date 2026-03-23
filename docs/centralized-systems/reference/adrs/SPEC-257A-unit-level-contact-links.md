# SPEC-257A: Unit-Level Contact Links

| Field | Value |
|-------|-------|
| **ADR** | ADR-257 (Customer AI Access Control) |
| **Phase** | 1 of 7 |
| **Priority** | CRITICAL — all other phases depend on this |
| **Status** | IMPLEMENTED (2026-03-23) |

---

## Objective

Δημιουργία unit-level contact links ώστε κάθε buyer/owner/tenant να συνδέεται με ΣΥΓΚΕΚΡΙΜΕΝΟ unit (όχι μόνο project).

## Current State

- `contact_links` συνδέουν contact → project (`targetEntityType: "project"`)
- Δεν υπάρχει τρόπος να ξέρουμε ΠΟΙΟ unit αγόρασε ένας buyer μέσω contact_links
- Η πληροφορία υπάρχει ΜΟΝΟ στο unit document (`commercial.buyerContactId`)

## Target State

- `contact_links` συνδέουν contact → unit (`targetEntityType: "unit"`, `targetEntityId: "unit_xxx"`)
- Δημιουργούνται ΑΥΤΟΜΑΤΑ κατά την κράτηση (reservation)
- Co-buyers: link για ΚΑΘΕ contact στο `owners[]`

## Files to Modify

| File | Action | Details |
|------|--------|---------|
| `src/services/association.service.ts` | REUSE | `linkContactToEntity()` — ήδη υποστηρίζει `targetEntityType: "unit"` |
| `src/types/entity-associations.ts` | READ ONLY | Unit roles ήδη ορισμένα: `owner, tenant, buyer, seller_lawyer, buyer_lawyer, notary` |
| `src/app/api/units/[id]/route.ts` | MODIFY | Στο PUT (reservation) → αυτόματη δημιουργία contact_link |
| `src/config/firestore-schema-map.ts` | VERIFY | contact_links schema ήδη ενημερωμένο |

## Implementation Steps

### Step 1: Auto-create link on reservation
Στο API route `PUT /api/units/[id]` — όταν γίνεται reservation (status → reserved + buyerContactId set):

```
if (commercial.buyerContactId changed && newStatus === 'reserved') {
  await AssociationService.linkContactToEntity({
    sourceWorkspaceId: companyId,
    sourceContactId: commercial.buyerContactId,
    targetEntityType: 'unit',
    targetEntityId: unitId,
    role: 'buyer',
    createdBy: userId,
  });
}
```

### Step 2: Auto-create links for co-buyers (ADR-244)
Αν `commercial.owners[]` υπάρχει:

```
for (const owner of commercial.owners) {
  await AssociationService.linkContactToEntity({
    sourceWorkspaceId: companyId,
    sourceContactId: owner.contactId,
    targetEntityType: 'unit',
    targetEntityId: unitId,
    role: owner.role, // 'buyer' | 'co_buyer' | 'landowner'
    createdBy: userId,
  });
}
```

### Step 3: Admin can create via AI
Ο admin μέσω Telegram: "Σύνδεσε τον Γιάννη ως αγοραστή στο ΔΙΑΜΕΡΙΣΜΑ Α-1"
- Ήδη λειτουργεί μέσω `firestore_write("contact_links", create, {...})`
- Χρειάζεται μόνο prompt update: "targetEntityType μπορεί να είναι 'unit'"

### Step 4: Deactivate on cancellation
Αν ακυρωθεί κράτηση → `status: "inactive"` στο contact_link (ΟΧΙ delete — audit trail)

## Existing Functions to Reuse

- `AssociationService.linkContactToEntity()` — `src/services/association.service.ts:106-229`
- `generateContactLinkId()` — `src/services/association.service.ts:747`
- `ENTITY_ASSOCIATION_ROLES.unit` — `src/types/entity-associations.ts:40-47`
- `COLLECTIONS.CONTACT_LINKS` — `src/config/firestore-collections.ts:73`

## Acceptance Criteria

- [x] Reservation creates unit-level contact_link automatically
- [x] Co-buyers get separate links with correct role
- [x] Admin can create via Telegram AI (already worked via agentic firestore_write)
- [x] Cancellation deactivates link (inactive, not deleted)
- [x] Zero duplicate links (check before create — idempotent upsert)

## Dependencies

- None (first phase)

---

## Implementation Notes (2026-03-23)

### Architecture

- **Server-side only** — All logic in `src/app/api/units/[id]/route.ts` using Admin SDK
- **Fire-and-forget pattern** — Same as `activateClientPersona()`, non-blocking
- **ID generation inlined** — Mirrors `AssociationService.generateContactLinkId()` to avoid client SDK import
- **Batch deactivation** — Uses Firestore batch write for atomic cancellation

### Helpers Added to route.ts

| Function | Purpose |
|----------|---------|
| `generateContactLinkId()` | ID: `cl_{contactId}_unit_{unitId}_{role}` |
| `mapOwnerRoleToLinkRole()` | PropertyOwnerRole → contact_link role |
| `upsertUnitContactLink()` | Idempotent: active→skip, inactive→reactivate, missing→create |
| `autoCreateUnitContactLinks()` | Primary buyer + co-buyers (ADR-244) |
| `deactivateUnitContactLinks()` | Batch soft-delete on cancellation |

### Triggers

- **Create**: `commercialStatus` → `reserved` ή `sold` (PATCH handler)
- **Deactivate**: `commercialStatus` αλλάζει ΑΠΟ `reserved`/`sold` ΣΕ οτιδήποτε άλλο
