# SPEC-230A: Legal Professionals Placement

| Field | Value |
|-------|-------|
| **ADR** | ADR-230 |
| **Phase** | A — Professionals Infrastructure |
| **Priority** | HIGH |
| **Status** | PLANNING |
| **Estimated Effort** | 1 session |
| **Prerequisite** | None |
| **Dependencies** | SPEC-230C, SPEC-230D depend on this |

---

## 1. Objective

Extend τη μονάδα (unit) ώστε να δέχεται ανάθεση νομικών επαγγελματιών — δικηγόρων αγοραστή/πωλητή, συμβολαιογράφου, και μεσίτη — σε unit-level. Δημιουργία immutable `ProfessionalSnapshot` interface για freeze στοιχείων κατά τη δημιουργία contract.

**Hybrid approach**: Οι επαγγελματίες ανατίθενται live στη μονάδα (μέσω entity associations) και προστίθενται **σταδιακά** — δεν είναι υποχρεωτικοί. Στην Ελλάδα, συμβόλαιο μπορεί να γίνει ακόμα και χωρίς δικηγόρους. Οι επαγγελματίες καθορίζονται μετά την προφορική συμφωνία και την προκαταβολή (καπάρο).

Κατά τη μετάβαση σε **signed** γίνεται snapshot → immutable αντίγραφο στο contract document. Αν αλλάξει επαγγελματίας στο unit μετά, τα ήδη signed contracts κρατούν τα αρχικά στοιχεία.

---

## 2. Task A: Extend Unit Association Roles

### Target File
`src/types/entity-associations.ts` — γραμμή 40-44

### Current State
```typescript
unit: [
  'owner',
  'tenant',
  'buyer',
] as const,
```

### Required Change
```typescript
unit: [
  'owner',
  'tenant',
  'buyer',
  'seller_lawyer',
  'buyer_lawyer',
  'notary',
] as const,
```

### Impact Analysis
- `UnitRole` type αυτόματα ενημερώνεται (derived from `typeof ENTITY_ASSOCIATION_ROLES.unit[number]`)
- `AssociationRoleValue` union αυτόματα ενημερώνεται
- `getRolesForEntityType('unit')` αυτόματα επιστρέφει τους νέους ρόλους
- **UI**: Τα dropdowns ρόλων στο relationship panel θα δείξουν τους νέους ρόλους αυτόματα
- **Validation**: Κανένα breaking change — additive only

### Design Decision: Γιατί unit-level (όχι contract-level μόνο)
| Approach | Πλεονεκτήματα | Μειονεκτήματα |
|----------|---------------|---------------|
| Contract-only | Isolated per contract | Πρέπει να ξαναβάλεις τους ίδιους σε κάθε contract |
| Unit-only | Μία φορά ανάθεση | Δεν κρατάει ιστορικό per contract |
| **Hybrid (επιλέχθηκε)** | Ανάθεση μία φορά + snapshot per contract | Ελαφρώς πιο σύνθετο |

---

## 3. Task B: ProfessionalSnapshot Interface

### Target File
`src/types/legal-contracts.ts` (νέο αρχείο)

### Interface Definition
```typescript
import type { LawyerPersona, NotaryPersona, RealEstateAgentPersona } from '@/types/contacts/personas';

/**
 * Ρόλος επαγγελματία στη νομική διαδικασία
 */
/**
 * Νομικοί ρόλοι — ΜΟΝΟ δικηγόροι + συμβολαιογράφος.
 * Ο μεσίτης (realtor) ΔΕΝ ανήκει εδώ — είναι εμπορική σχέση,
 * διαχειρίζεται μέσω BrokerageAgreement (SPEC-230B).
 */
export type LegalProfessionalRole = 'seller_lawyer' | 'buyer_lawyer' | 'notary';

/**
 * Immutable snapshot στοιχείων επαγγελματία κατά τη δημιουργία contract.
 *
 * ΓΙΑΤΙ SNAPSHOT: Αν ο δικηγόρος αλλάξει αριθμό μητρώου ή ο μεσίτης αλλάξει
 * γραφείο, τα παλαιά contracts πρέπει να κρατούν τα στοιχεία ΤΗΣ ΕΠΟΧΗΣ.
 *
 * Pattern: SAP Business Partner snapshot — freeze at transaction time.
 */
export interface ProfessionalSnapshot {
  /** Contact ID — reference back to live contact */
  contactId: string;

  /** Display name at snapshot time */
  displayName: string;

  /** Role in this contract */
  role: LegalProfessionalRole;

  /** Phone at snapshot time */
  phone: string | null;

  /** Email at snapshot time */
  email: string | null;

  /** AFM/ΑΦΜ at snapshot time */
  taxId: string | null;

  /**
   * Role-specific fields (persona data at snapshot time).
   * Discriminated by `role`:
   * - seller_lawyer / buyer_lawyer → LawyerSnapshot
   * - notary → NotarySnapshot
   * - realtor → RealtorSnapshot
   */
  roleSpecificData: LawyerSnapshotData | NotarySnapshotData;

  /** Timestamp of snapshot creation */
  snapshotAt: string; // ISO date
}

/** Subset of LawyerPersona fields frozen at snapshot time */
export interface LawyerSnapshotData {
  type: 'lawyer';
  barAssociationNumber: string | null;
  barAssociation: string | null;
}

/** Subset of NotaryPersona fields frozen at snapshot time */
export interface NotarySnapshotData {
  type: 'notary';
  notaryRegistryNumber: string | null;
  notaryDistrict: string | null;
}

```

### Design Notes
- Discriminated union on `roleSpecificData.type` — enterprise TypeScript, όχι `any`
- Null-safe: Κάθε optional field → `| null` (Firestore-compatible, ADR rule)
- `contactId` → always kept for back-reference to live contact
- `snapshotAt` → audit trail — πότε πάρθηκε το snapshot

---

## 4. Task C: snapshotProfessionals() Method

### Target File
`src/services/association.service.ts` — νέα static method

### Method Signature
```typescript
/**
 * Snapshot professionals currently assigned to a unit.
 * Reads live associations from contact_links, resolves contact data,
 * and returns immutable ProfessionalSnapshot[] for embedding in a contract.
 *
 * @param unitId - The unit to snapshot professionals from
 * @param roles - Which roles to snapshot (default: all 4 legal roles)
 * @returns ProfessionalSnapshot[] — one per assigned professional
 */
static async snapshotProfessionals(
  unitId: string,
  roles?: LegalProfessionalRole[]
): Promise<ProfessionalSnapshot[]>
```

### Implementation Steps
1. Call `listContactLinks({ targetEntityType: 'unit', targetEntityId: unitId, status: 'active' })`
2. Filter links by role ∈ `['seller_lawyer', 'buyer_lawyer', 'notary']`
3. For each matching link:
   a. Fetch contact document from `COLLECTIONS.CONTACTS`
   b. Find active persona matching the role (using `findActivePersona()` from personas.ts)
   c. Build `ProfessionalSnapshot` with contact's current data
4. Return array of snapshots

### Dependencies
- `COLLECTIONS.CONTACTS` — for fetching contact documents
- `findActivePersona<T>()` — from `@/types/contacts/personas`
- `listContactLinks()` — existing method on same service

### Edge Cases
| Case | Behavior |
|------|----------|
| No professional assigned for a role | Skip that role in the returned array |
| Contact deleted after assignment | Include snapshot with available data, log warning |
| Professional has no active persona | Include snapshot with `roleSpecificData` null-safe defaults |
| Multiple professionals with same role | Include all (validation should prevent this, but snapshot is safe) |

---

## 5. Task D: i18n Keys for New Roles

### Target Files
- `src/i18n/locales/el/common.json`
- `src/i18n/locales/en/common.json`

### Keys to Add
```json
{
  "associations": {
    "roles": {
      "seller_lawyer": "Δικηγόρος Πωλητή",
      "buyer_lawyer": "Δικηγόρος Αγοραστή",
      "notary": "Συμβολαιογράφος"
    }
  }
}
```

English:
```json
{
  "associations": {
    "roles": {
      "seller_lawyer": "Seller's Lawyer",
      "buyer_lawyer": "Buyer's Lawyer",
      "notary": "Notary"
    }
  }
}
```

### Note
Ελέγξτε αν υπάρχουν ήδη i18n keys για roles στο section `associations.roles.*` ή `contacts.roles.*`. Αν ναι, extend εκεί. Αν όχι, δημιουργήστε νέο section.

---

## 6. Files Summary

| Action | File | What |
|--------|------|------|
| **MODIFY** | `src/types/entity-associations.ts` | +3 unit roles (seller_lawyer, buyer_lawyer, notary) |
| **CREATE** | `src/types/legal-contracts.ts` | ProfessionalSnapshot + role types |
| **MODIFY** | `src/services/association.service.ts` | +snapshotProfessionals() method |
| **MODIFY** | `src/i18n/locales/el/common.json` | +4 role labels |
| **MODIFY** | `src/i18n/locales/en/common.json` | +4 role labels |

---

## 7. Verification Criteria

1. `npx tsc --noEmit` — zero errors σε αλλαγμένα αρχεία
2. `UnitRole` type includes `'seller_lawyer' | 'buyer_lawyer' | 'notary'`
3. `getRolesForEntityType('unit')` returns 6 roles (was 3)
4. `ProfessionalSnapshot` properly typed — no `any`, discriminated union on roleSpecificData
5. `snapshotProfessionals('unit_123')` returns correct snapshot array
6. i18n keys resolve in both EL and EN

---

*SPEC Format: Google Engineering Design Docs standard*
