# SPEC-244A: Phase 0 — Θεμέλια (Πολλαπλοί Ιδιοκτήτες)

**Parent ADR**: ADR-244 (Multi-Buyer Co-Ownership)
**Status**: READY FOR IMPLEMENTATION
**Risk**: ZERO — δεν σπάει τίποτα, μόνο προσθέσεις
**Εκτίμηση**: 3-4 ώρες

---

## ΣΤΟΧΟΣ

Θέσε τα θεμέλια χωρίς να αλλάξεις τίποτα στον υπάρχοντα κώδικα. Μετά αυτή τη φάση, η εφαρμογή λειτουργεί ΑΚΡΙΒΩΣ ίδια, αλλά τα νέα types + UI υπάρχουν έτοιμα.

---

## ΑΛΛΑΓΕΣ

### 1. Νέο type: `PropertyOwnerEntry`

**Αρχείο**: `src/types/ownership-table.ts` (δίπλα στο `LandownerEntry`)

```typescript
/**
 * Ιδιοκτήτης/Συνιδιοκτήτης ακινήτου.
 * Ενιαίο type για αγοραστές, συν-αγοραστές, οικοπεδούχους.
 * Pattern: LandownerEntry (ήδη υπάρχει, ίδια δομή)
 */
export interface PropertyOwnerEntry {
  readonly contactId: string;
  readonly name: string;
  readonly ownershipPct: number;        // 0-100 (π.χ. 50 = 50%)
  readonly role: PropertyOwnerRole;
  readonly paymentPlanId: string | null; // null = κοινό πλάνο
}

export type PropertyOwnerRole = 'buyer' | 'co-buyer' | 'landowner';
```

### 2. Πρόσθεσε `owners` field στο `UnitCommercialData`

**Αρχείο**: `src/types/unit.ts` (μέσα στο `UnitCommercialData`)

```typescript
export interface UnitCommercialData {
  // ... existing fields (buyerContactId, buyerName — KEEP AS IS)

  /** Πολλαπλοί ιδιοκτήτες (Phase 0 ADR-244). Συνυπάρχει με buyerContactId. */
  owners?: PropertyOwnerEntry[] | null;
}
```

**ΚΡΙΣΙΜΟ**: `buyerContactId` ΔΕΝ αφαιρείται. Τα 2 πεδία **συνυπάρχουν**.

### 3. Νέοι Contact Relationship Types

**Αρχείο**: `src/types/contacts/relationships/core/relationship-types.ts`

Πρόσθεσε στο array:
```typescript
'buyer',        // Αγοραστής ακινήτου
'co_buyer',     // Συν-αγοραστής
'landowner',    // Οικοπεδούχος
```

### 4. Καρτέλα "Οικοπεδούχοι" στο Project

**Νέο αρχείο**: `src/components/projects/tabs/ProjectLandownersTab.tsx`

UI:
- Λίστα οικοπεδούχων (ContactSearchManager + ποσοστό γης %)
- Πρόσθεσε/αφαίρεσε οικοπεδούχο
- Σύνολο ποσοστών = 100%
- Αποθήκευση στο Firestore: `projects/{projectId}` → νέο field `landowners: LandownerEntry[]`

**Αρχείο**: `src/types/project.ts`

Πρόσθεσε:
```typescript
export interface Project {
  // ... existing

  /** Οικοπεδούχοι — SSoT, χρησιμοποιείται στο Bartex + πίνακα ποσοστών */
  landowners?: LandownerEntry[] | null;

  /** Ποσοστό αντιπαροχής (%) — αν ισχύει */
  bartexPercentage?: number | null;
}
```

**Registration στο navigation**: Πρόσθεσε tab στο project detail view tabs array.

---

## ΑΡΧΕΙΑ ΠΟΥ ΑΛΛΑΖΟΥΝ

| # | Αρχείο | Αλλαγή | Risk |
|---|--------|--------|------|
| 1 | `src/types/ownership-table.ts` | + `PropertyOwnerEntry` type | ZERO |
| 2 | `src/types/unit.ts` | + `owners?` field (δίπλα στο `buyerContactId`) | ZERO |
| 3 | `src/types/project.ts` | + `landowners?`, `bartexPercentage?` | ZERO |
| 4 | `src/types/contacts/relationships/core/relationship-types.ts` | + 3 roles | ZERO |
| 5 | `src/components/projects/tabs/ProjectLandownersTab.tsx` | **ΝΕΟ** | ZERO |
| 6 | Project detail view tabs config | + registration νέου tab | ZERO |

---

## VERIFICATION

1. `npx tsc --noEmit` → 0 errors
2. Existing features δουλεύουν ίδια (reserve, sell, payment plans)
3. Project detail view → νέα καρτέλα "Οικοπεδούχοι" εμφανίζεται
4. Μπορείς να προσθέσεις/αφαιρέσεις οικοπεδούχους + ποσοστά

---

## DEPENDENCIES

- **Χρειάζεται**: `ContactSearchManager` (ήδη υπάρχει)
- **Χρειάζεται**: `LandownerEntry` pattern (ήδη υπάρχει)
- **ΔΕΝ χρειάζεται**: Αλλαγές σε sales flow, payment plans, ή πίνακα ποσοστών
