# ADR-226: Centralized Deletion Guard — Referential Integrity Protection

| Metadata | Value |
|----------|-------|
| **Status** | IN PROGRESS (Phase 0-7 ✅, Phase 8 ✅ Company Identity Guard) |
| **Date** | 2026-03-13 |
| **Category** | Backend Systems / Data & State |
| **Canonical Location** | `src/lib/firestore/deletion-guard.ts` (proposed) |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## 1. Context

### Το Πρόβλημα

Η εφαρμογή **δεν έχει κανένα μηχανισμό referential integrity** για τις DELETE operations. Κάθε entity μπορεί να σβηστεί ελεύθερα, αφήνοντας ορφανά references σε δεκάδες collections.

### Τρέχουσα Κατάσταση DELETE Operations

| Entity | Endpoint | Cascade | Dependency Check | Preview |
|--------|----------|---------|-----------------|---------|
| **Project** | `DELETE /api/projects/[id]` | buildings → units/floors/parking/storage | ❌ Κανένας | ✅ cascade-preview |
| **Building** | `DELETE /api/buildings/[id]` | units/floors/parking/storage | ❌ Κανένας | ✅ cascade-preview |
| **Contact** | `DELETE /api/contacts/[id]` | ❌ Κανένα | ❌ Κανένας | ❌ Κανένα |
| **Unit** | `DELETE /api/units/[id]` | ❌ Κανένα | ❌ Κανένας | ❌ Κανένα |
| **Floor** | `DELETE /api/floors` | ❌ Κανένα | ❌ Κανένας | ❌ Κανένα |
| **Parking** | `DELETE /api/parking/[id]` | ❌ Κανένα | ❌ Κανένας | ❌ Κανένα |
| **Storage** | `DELETE /api/storages/[id]` | ❌ Κανένα | ❌ Κανένας | ❌ Κανένα |

### Κρίσιμα Issues

- ❌ **Zero referential integrity**: Σβήνεις contact → ορφανεύονται πωλήσεις, επικοινωνίες, ραντεβού
- ❌ **Permission inconsistencies**: Units/Parking/Storage χρησιμοποιούν `units:units:update` αντί `:delete`
- ❌ **Floors** χρησιμοποιούν `projects:floors:view` αντί `:delete`
- ❌ **Hard delete χωρίς ανίχνευση εξαρτήσεων**: Contacts, Units σβήνονται χωρίς κανέναν έλεγχο
- ✅ **Accounting invoices**: Σωστά soft delete (fiscal compliance) — μόνο θετικό παράδειγμα

---

## 2. Decision

### Αρχιτεκτονική: Centralized Deletion Guard Middleware

Ένα **declarative dependency registry** που ορίζει per-entity ποια collections εξαρτώνται, ποια στρατηγική ισχύει, και ποιο UI preview εμφανίζεται πριν τη διαγραφή.

### 2.1 Φιλοσοφία: BOTTOM-UP ONLY — Μηδενικό Cascade

**ΑΡΧΗ**: Η διαγραφή γίνεται **ΜΟΝΟ από κάτω προς τα πάνω**. Ποτέ από πάνω προς τα κάτω.

Αν ένα entity έχει τέκνα/εξαρτήσεις → **BLOCK**. Ο χρήστης πρέπει πρώτα να πάει στα τέκνα, να τα διαγράψει χειροκίνητα, και μετά να επιστρέψει στον γονέα.

**Παράδειγμα — Διαγραφή Project:**
1. Χρήστης πατάει "Διαγραφή Project" → ❌ "Έχει 2 κτίρια. Πήγαινε πρώτα σβήσε τα κτίρια."
2. Πάει στο Building A → ❌ "Έχει 3 μονάδες. Πήγαινε πρώτα σβήσε τις μονάδες."
3. Πάει στο Unit 1 → ❌ "Έχει 1 opportunity. Πήγαινε πρώτα σβήσε το."
4. Σβήνει το opportunity → ✅
5. Σβήνει Unit 1 → ✅ (πλέον χωρίς εξαρτήσεις)
6. Σβήνει Unit 2, Unit 3 → ✅
7. Σβήνει Building A → ✅ (πλέον χωρίς μονάδες)
8. Σβήνει Building B (ίδια διαδικασία)
9. Σβήνει Project → ✅ (πλέον χωρίς κτίρια)

### Δύο Στρατηγικές Διαγραφής

| Στρατηγική | Συμπεριφορά | Πότε χρησιμοποιείται |
|------------|-------------|---------------------|
| **BLOCK** | ❌ Αποτρέπει τη διαγραφή αν υπάρχουν εξαρτήσεις — preview με clickable links στα τέκνα, ο χρήστης τα διαγράφει χειροκίνητα bottom-up | Όλα τα entities (Project, Building, Contact, Unit, Floor, Company, Parking/Storage πωλημένα) |
| **SOFT_DELETE** | 🗂️ Σημαίνει ως `deletedAt` χωρίς πραγματική διαγραφή | Fiscal/audit entities (invoices) |

#### BLOCK — UX Flow

1. Χρήστης πατάει "Διαγραφή" → API ελέγχει εξαρτήσεις
2. **Αν υπάρχουν εξαρτήσεις** → Dialog εμφανίζεται:
   - "Δεν μπορεί να διαγραφεί. Έχει τις εξής εξαρτήσεις:"
   - Λίστα εξαρτήσεων με **clickable links** (ο χρήστης πηγαίνει κατευθείαν στο record)
   - **Ένα κουμπί**: "Κατάλαβα" → Κλείνει dialog
3. **Αν ΔΕΝ υπάρχουν εξαρτήσεις** → Confirmation dialog: "Είσαι σίγουρος;" → Διαγραφή

### 2.2 Χαρτογράφηση Εξαρτήσεων per Entity

#### CONTACT → Εξαρτήσεις (Στρατηγική: **BLOCK**)

Αν σβηστεί ένα contact, ορφανεύονται:

| Collection | Foreign Key | Περιγραφή |
|------------|-------------|-----------|
| `units` | `commercial.buyerContactId` | Μονάδες πωλημένες σε αυτόν |
| `parking_spots` | `commercial.buyerContactId` | Parking πωλημένα |
| `storage_units` | `commercial.buyerContactId` | Αποθήκες πωλημένες |
| `opportunities` | `contactId` | Ευκαιρίες πώλησης |
| `communications` | `contactId` | Ιστορικό επικοινωνιών |
| `appointments` | `requester.contactId` | Ραντεβού |
| `contact_relationships` | `sourceContactId` / `targetContactId` | Σχέσεις contacts |
| `contact_links` | `sourceContactId` | Συνδέσεις entity |
| `obligations` | `sections[].contactId` | Υποχρεώσεις (nested array) |
| `external_identities` | `internalContactId` | Εξωτερικές ταυτότητες |
| `employment_records` | `contactId` | Εργασιακά αρχεία |
| `attendance_events` | `employeeId` | Παρουσίες |

**Στρατηγική BLOCK**: Ο χρήστης βλέπει πλήρες preview με clickable links στις εξαρτήσεις. Πρέπει να τις διαγράψει χειροκίνητα πρώτα (bottom-up).

#### UNIT → Εξαρτήσεις (Στρατηγική: **BLOCK**)

| Collection | Foreign Key | Περιγραφή |
|------------|-------------|-----------|
| `entity_links` | `entityId` (type='unit') | Parking/storage allocations |
| `opportunities` | `unitIds[]` | Ευκαιρίες πώλησης (array-contains) |
| `communications` | `unitId` | Επικοινωνίες |
| `contact_links` | `targetEntityId` (type='unit') | Συνδέσεις contact↔unit |
| `boq_items` | `linkedUnitId` | BOQ items (επιμετρήσεις) |
| `obligations` | `unitId` | Υποχρεώσεις |

**Στρατηγική BLOCK**: Preview με clickable links — ο χρήστης διαγράφει χειροκίνητα τις εξαρτήσεις πρώτα (bottom-up).

#### FLOOR → Εξαρτήσεις (Στρατηγική: **BLOCK**)

| Collection | Foreign Key | Περιγραφή |
|------------|-------------|-----------|
| `units` | `floorId` | Μονάδες σε αυτόν τον όροφο |

**Γιατί BLOCK**: Όροφος με μονάδες δεν μπορεί να σβηστεί — πρώτα μετακίνησε ή σβήσε τις μονάδες.

#### PROJECT → Εξαρτήσεις (Στρατηγική: **BLOCK**)

Σήμερα υπάρχει cascade (buildings → units/floors/parking/storage) — **θα αντικατασταθεί** με BLOCK. Εξαρτήσεις:

| Collection | Foreign Key | Περιγραφή |
|------------|-------------|-----------|
| `buildings` | `projectId` | Κτίρια |
| `opportunities` | `projectIds[]` | Ευκαιρίες πώλησης (array-contains) |
| `communications` | `projectId` | Επικοινωνίες |
| `contact_links` | `targetEntityId` (type='project') | Συνδέσεις contact↔project |
| `construction_phases` | `projectId` | Φάσεις κατασκευής |
| `obligations` | `projectId` | Υποχρεώσεις |

**Στρατηγική BLOCK**: "Πήγαινε πρώτα σβήσε τα κτίρια, τις ευκαιρίες, τις φάσεις κατασκευής κλπ."

#### BUILDING → Εξαρτήσεις (Στρατηγική: **BLOCK**)

Σήμερα υπάρχει cascade (units/floors/parking/storage) — **θα αντικατασταθεί** με BLOCK. Εξαρτήσεις:

| Collection | Foreign Key | Περιγραφή |
|------------|-------------|-----------|
| `units` | `buildingId` | Μονάδες |
| `floors` | `buildingId` | Όροφοι |
| `parking_spots` | `buildingId` | Θέσεις στάθμευσης |
| `storage_units` | `buildingId` | Αποθήκες |
| `building_milestones` | `buildingId` | Building timeline |
| `floorplans` | `buildingId` | Κατόψεις |

**Στρατηγική BLOCK**: "Πήγαινε πρώτα σβήσε τις μονάδες, τους ορόφους, τα parking, τις αποθήκες, τα milestones, τις κατόψεις."

#### COMPANY → Εξαρτήσεις (Στρατηγική: **BLOCK — ΠΡΑΚΤΙΚΑ ΑΔΥΝΑΤΗ ΔΙΑΓΡΑΦΗ**)

| Collection | Foreign Key | Περιγραφή |
|------------|-------------|-----------|
| `projects` | `companyId` | **ΟΛΑ** τα έργα |
| `contacts` | `companyId` | **ΟΛΕΣ** οι επαφές |
| `buildings` | `companyId` | **ΟΛΑ** τα κτίρια |

Διαγραφή company = διαγραφή **ΟΛΗ** η βάση δεδομένων. **ΑΠΑΓΟΡΕΥΕΤΑΙ**.

#### PARKING / STORAGE → Εξαρτήσεις (Στρατηγική: **BLOCK αν πωλημένο**)

| Collection | Foreign Key | Περιγραφή |
|------------|-------------|-----------|
| `entity_links` | `entityId` (type='parking'/'storage') | Allocations σε units |

Αν `commercial.buyerContactId` υπάρχει → **BLOCK** (πωλημένο). Αλλιώς → επιτρέπεται.

---

### 2.3 Proposed Architecture

#### Canonical Files

```
src/lib/firestore/deletion-guard.ts        ← Core engine (dependency check + strategy execution)
src/config/deletion-registry.ts             ← Declarative dependency registry per entity
src/lib/firestore/cascade-delete.ts         ← ΥΠΑΡΧΕΙ ΗΔΗ — επέκταση
```

#### Dependency Registry (Declarative Config)

```typescript
// src/config/deletion-registry.ts

import { COLLECTIONS } from '@/config/firestore-collections';

interface DependencyDef {
  /** Collection to scan for orphans */
  collection: string;
  /** Foreign key field pointing to the entity being deleted */
  foreignKey: string;
  /** Human-readable label for UI preview */
  label: string;
  /** How to query: 'equals' for simple FK, 'array-contains' for array fields */
  queryType: 'equals' | 'array-contains';
  /** Nested path for deep fields (e.g., 'commercial.buyerContactId') */
  nestedPath?: string;
}

interface EntityDeletionConfig {
  /** Default strategy when dependencies exist */
  strategy: 'BLOCK' | 'SOFT_DELETE';
  /** Dependencies to check before allowing deletion */
  dependencies: DependencyDef[];
  /** Conditional: override strategy based on entity state (e.g., parking πωλημένο) */
  conditionalBlock?: {
    field: string;
    condition: 'exists' | 'not-null';
    message: string;
  };
}

const DELETION_REGISTRY: Record<string, EntityDeletionConfig> = {
  contact: {
    strategy: 'BLOCK',
    dependencies: [
      { collection: COLLECTIONS.UNITS, foreignKey: 'commercial.buyerContactId', label: 'Πωλημένες μονάδες', queryType: 'equals' },
      { collection: COLLECTIONS.PARKING_SPACES, foreignKey: 'commercial.buyerContactId', label: 'Πωλημένα parking', queryType: 'equals' },
      { collection: COLLECTIONS.STORAGE, foreignKey: 'commercial.buyerContactId', label: 'Πωλημένες αποθήκες', queryType: 'equals' },
      { collection: COLLECTIONS.OPPORTUNITIES, foreignKey: 'contactId', label: 'Ευκαιρίες', queryType: 'equals' },
      { collection: COLLECTIONS.COMMUNICATIONS, foreignKey: 'contactId', label: 'Επικοινωνίες', queryType: 'equals' },
      { collection: COLLECTIONS.APPOINTMENTS, foreignKey: 'requester.contactId', label: 'Ραντεβού', queryType: 'equals' },
      { collection: COLLECTIONS.CONTACT_RELATIONSHIPS, foreignKey: 'sourceContactId', label: 'Σχέσεις (source)', queryType: 'equals' },
      { collection: COLLECTIONS.CONTACT_RELATIONSHIPS, foreignKey: 'targetContactId', label: 'Σχέσεις (target)', queryType: 'equals' },
      { collection: COLLECTIONS.CONTACT_LINKS, foreignKey: 'sourceContactId', label: 'Συνδέσεις', queryType: 'equals' },
      { collection: COLLECTIONS.EXTERNAL_IDENTITIES, foreignKey: 'internalContactId', label: 'Εξωτερικές ταυτότητες', queryType: 'equals' },
      { collection: COLLECTIONS.EMPLOYMENT_RECORDS, foreignKey: 'contactId', label: 'Εργασιακά αρχεία', queryType: 'equals' },
      { collection: COLLECTIONS.ATTENDANCE_EVENTS, foreignKey: 'employeeId', label: 'Παρουσίες', queryType: 'equals' },
    ],
  },

  unit: {
    strategy: 'BLOCK',
    dependencies: [
      { collection: COLLECTIONS.OPPORTUNITIES, foreignKey: 'unitIds', label: 'Ευκαιρίες', queryType: 'array-contains' },
      { collection: COLLECTIONS.COMMUNICATIONS, foreignKey: 'unitId', label: 'Επικοινωνίες', queryType: 'equals' },
      { collection: COLLECTIONS.CONTACT_LINKS, foreignKey: 'targetEntityId', label: 'Συνδέσεις contact', queryType: 'equals' },
      { collection: COLLECTIONS.BOQ_ITEMS, foreignKey: 'linkedUnitId', label: 'BOQ items', queryType: 'equals' },
      { collection: COLLECTIONS.OBLIGATIONS, foreignKey: 'unitId', label: 'Υποχρεώσεις', queryType: 'equals' },
    ],
  },

  floor: {
    strategy: 'BLOCK',
    dependencies: [
      { collection: COLLECTIONS.UNITS, foreignKey: 'floorId', label: 'Μονάδες', queryType: 'equals' },
    ],
  },

  project: {
    strategy: 'BLOCK',
    dependencies: [
      { collection: COLLECTIONS.BUILDINGS, foreignKey: 'projectId', label: 'Κτίρια', queryType: 'equals' },
      { collection: COLLECTIONS.OPPORTUNITIES, foreignKey: 'projectIds', label: 'Ευκαιρίες', queryType: 'array-contains' },
      { collection: COLLECTIONS.COMMUNICATIONS, foreignKey: 'projectId', label: 'Επικοινωνίες', queryType: 'equals' },
      { collection: COLLECTIONS.CONTACT_LINKS, foreignKey: 'targetEntityId', label: 'Συνδέσεις', queryType: 'equals' },
      { collection: COLLECTIONS.CONSTRUCTION_PHASES, foreignKey: 'projectId', label: 'Φάσεις κατασκευής', queryType: 'equals' },
      { collection: COLLECTIONS.OBLIGATIONS, foreignKey: 'projectId', label: 'Υποχρεώσεις', queryType: 'equals' },
    ],
  },

  building: {
    strategy: 'BLOCK',
    dependencies: [
      { collection: COLLECTIONS.UNITS, foreignKey: 'buildingId', label: 'Μονάδες', queryType: 'equals' },
      { collection: COLLECTIONS.FLOORS, foreignKey: 'buildingId', label: 'Όροφοι', queryType: 'equals' },
      { collection: COLLECTIONS.PARKING_SPACES, foreignKey: 'buildingId', label: 'Parking', queryType: 'equals' },
      { collection: COLLECTIONS.STORAGE, foreignKey: 'buildingId', label: 'Αποθήκες', queryType: 'equals' },
      { collection: COLLECTIONS.BUILDING_MILESTONES, foreignKey: 'buildingId', label: 'Milestones', queryType: 'equals' },
      { collection: COLLECTIONS.FLOORPLANS, foreignKey: 'buildingId', label: 'Κατόψεις', queryType: 'equals' },
    ],
  },

  company: {
    strategy: 'BLOCK', // ΠΡΑΚΤΙΚΑ ΑΔΥΝΑΤΗ ΔΙΑΓΡΑΦΗ
    dependencies: [
      { collection: COLLECTIONS.PROJECTS, foreignKey: 'companyId', label: 'Έργα', queryType: 'equals' },
      { collection: COLLECTIONS.CONTACTS, foreignKey: 'companyId', label: 'Επαφές', queryType: 'equals' },
      { collection: COLLECTIONS.BUILDINGS, foreignKey: 'companyId', label: 'Κτίρια', queryType: 'equals' },
    ],
  },
};
```

#### Core Engine API

```typescript
// src/lib/firestore/deletion-guard.ts

interface DependencyCheckResult {
  /** Whether deletion is allowed */
  allowed: boolean;
  /** Dependencies found (for preview UI with clickable links) */
  dependencies: Array<{
    label: string;
    collection: string;
    count: number;
    /** Document IDs for clickable navigation links */
    documentIds: string[];
  }>;
  /** Total dependent documents */
  totalDependents: number;
  /** Human-readable message for the UI dialog */
  message: string;
}

/**
 * Checks all dependencies before allowing a delete operation.
 * Returns a preview of what will be affected.
 *
 * - Αν totalDependents > 0 → allowed = false, UI δείχνει clickable links
 * - Αν totalDependents === 0 → allowed = true, UI δείχνει confirmation
 */
async function checkDeletionDependencies(
  db: FirebaseFirestore.Firestore,
  entityType: string,
  entityId: string
): Promise<DependencyCheckResult>;

/**
 * Executes deletion ΜΟΝΟ αν δεν υπάρχουν εξαρτήσεις.
 * Πρέπει πρώτα να κληθεί checkDeletionDependencies().
 * Αν allowed === false → throws error.
 *
 * Μετά τη διαγραφή → γράφει audit trail entry στο entity_audit_trail.
 */
async function executeDeletion(
  db: FirebaseFirestore.Firestore,
  entityType: string,
  entityId: string,
  deletedBy: { uid: string; email: string }
): Promise<{ success: boolean }>;

// Audit trail entry format:
// {
//   entityType: 'contact',
//   entityId: 'abc123',
//   action: 'DELETE',
//   deletedBy: { uid: '...', email: '...' },
//   deletedAt: Timestamp.now(),
//   metadata: { /* snapshot of entity before deletion */ }
// }
```

#### cascade-delete.ts — ✅ ΑΠΟΣΥΡΘΗΚΕ (Phase 4)

Το `cascadeDeleteChildren()` στο `src/lib/firestore/cascade-delete.ts` **διαγράφηκε** — αντικαταστάθηκε πλήρως από `executeDeletion()` στο `deletion-guard.ts`. Τα cascade-preview routes επίσης διαγράφηκαν — αντικαταστάθηκαν από `/api/deletion-guard/{entityType}/{entityId}`.

---

## 3. Consequences

### Positive

- ✅ **Zero ορφανά records**: Κάθε delete ελέγχεται πριν εκτελεστεί
- ✅ **Μέγιστη ασφάλεια**: Κανένα cascade — ο χρήστης ελέγχει πλήρως τι σβήνεται
- ✅ **Declarative config**: Νέα dependencies προστίθενται χωρίς αλλαγή κώδικα engine
- ✅ **Enterprise-grade**: Αντίστοιχο με FK ON DELETE RESTRICT σε relational databases
- ✅ **Preview UI**: Ο χρήστης βλέπει clickable links στα τέκνα που εμποδίζουν τη διαγραφή

### Negative

- ⚠️ **Performance**: Κάθε delete κάνει N queries (ένα per dependency) — αλλά deletes είναι σπάνια operations
- ⚠️ **Firestore limitation**: `array-contains` queries δεν επιτρέπουν compound filters — πρέπει client-side filtering για `targetEntityId` + `type`
- ⚠️ **Nested fields**: `obligations.sections[].contactId` δεν μπορεί να ελεγχθεί με simple query — χρειάζεται dedicated handling

---

## 4. Prohibitions (after this ADR)

- ⛔ **ΑΠΑΓΟΡΕΥΕΤΑΙ** νέο DELETE endpoint χωρίς integration με Deletion Guard
- ⛔ **ΑΠΑΓΟΡΕΥΕΤΑΙ** cascade delete — η διαγραφή γίνεται ΜΟΝΟ bottom-up, χειροκίνητα
- ⛔ **ΑΠΑΓΟΡΕΥΕΤΑΙ** hard delete σε entity που έχει τέκνα/εξαρτήσεις
- ⛔ **ΑΠΑΓΟΡΕΥΕΤΑΙ** διαγραφή company — μόνο deactivation/archive
- ⛔ **ΑΠΟΣΥΡΕΤΑΙ** η υπάρχουσα cascade delete σε Project/Building endpoints

---

## 5. Implementation Phases

### Phase 0: Permission Fixes ✅ IMPLEMENTED (2026-03-13)

| Task | Endpoint | Τρέχον Permission | Σωστό Permission | Status |
|------|----------|-------------------|-----------------|--------|
| 0.1 | DELETE /api/units/[id] | `units:units:update` | `units:units:delete` | ✅ |
| 0.2 | DELETE /api/parking/[id] | `units:units:update` | `units:units:delete` | ✅ |
| 0.3 | DELETE /api/storages/[id] | `units:units:update` | `units:units:delete` | ✅ |
| 0.4 | DELETE /api/floors | `projects:floors:view` | `projects:floors:delete` | ✅ |

**Νέα permissions**: `units:units:delete`, `projects:floors:delete` στο PERMISSIONS registry.
**Roles ενημερωμένοι**: `company_admin` + `project_manager` έχουν και τα 2 νέα delete permissions.
**Parking/Storage**: Χρησιμοποιούν `units:units:delete` (sub-entities του units domain).

### Phase 1: Core Infrastructure (Priority: HIGH) — ✅ IMPLEMENTED (2026-03-13)

| Task | Αρχείο | Περιγραφή | Status |
|------|--------|-----------|--------|
| 1.1 | `src/config/deletion-registry.ts` | Declarative dependency registry (8 entity types, 35 dependencies) | ✅ |
| 1.2 | `src/lib/firestore/deletion-guard.ts` | Core engine: `checkDeletionDependencies()` + `executeDeletion()` | ✅ |
| 1.3 | `src/app/api/deletion-guard/[entityType]/[entityId]/route.ts` | Preview API endpoint (GET) with permission checks | ✅ |

**Implementation Notes (Phase 1)**:
- Registry covers: contact (12 deps), unit (5), floor (1), project (6), building (6), company (3), parking (1 + conditional), storage (1 + conditional)
- Parallel `Promise.all` queries for all dependencies (max 12 for contacts)
- Tenant isolation: every query includes `companyId` filter
- Conditional blocks: parking/storage check `commercial.buyerContactId` before dependency scan
- On query failure → safe default (treated as blocking)
- Audit trail via `EntityAuditService.recordChange()` with full JSON snapshot on delete
- Preview API at `GET /api/deletion-guard/{entityType}/{entityId}` with matching delete permissions

### Phase 2: BLOCK Guard σε ΟΛΑ τα entities (Priority: CRITICAL) — ✅ IMPLEMENTED (2026-03-13)

| Task | Αρχείο | Περιγραφή | Status |
|------|--------|-----------|--------|
| 2.1 | `src/app/api/contacts/[contactId]/route.ts` | `contactRef.delete()` → `executeDeletion()` | ✅ |
| 2.2 | `src/app/api/units/[id]/route.ts` | `docRef.delete()` → `executeDeletion()`, removed manual EntityAuditService | ✅ |
| 2.3 | `src/app/api/floors/route.ts` | `floorRef.delete()` → `executeDeletion()` | ✅ |
| 2.4 | `src/app/api/projects/[projectId]/route.ts` | **REMOVED cascade** → `executeDeletion()` (bottom-up BLOCK) | ✅ |
| 2.5 | `src/app/api/buildings/[buildingId]/route.ts` | **REMOVED cascade** → `executeDeletion()` (bottom-up BLOCK) | ✅ |
| 2.6 | `src/app/api/parking/[id]/route.ts` | `docRef.delete()` → `executeDeletion()` (conditional BLOCK for sold) | ✅ |
| 2.7 | `src/app/api/storages/[id]/route.ts` | `docRef.delete()` → `executeDeletion()` (conditional BLOCK for sold) | ✅ |

**Implementation Notes (Phase 2)**:
- All 7 DELETE endpoints now use `executeDeletion()` which checks dependencies before allowing deletion
- Projects/Buildings: **CASCADE REMOVED** — replaced with BLOCK guard (bottom-up only)
- Removed `cascadeDeleteChildren` + `CascadeChild` imports from projects and buildings
- Removed `BUILDING_CHILDREN` constants from both files
- Units: Removed redundant manual `EntityAuditService.recordChange()` — `executeDeletion()` handles full snapshot audit
- Parking/Storage: Conditional block via `commercial.buyerContactId` handled by deletion-guard engine
- Dual audit pattern: `executeDeletion()` → entity audit trail; `logAuditEvent()` → auth audit trail (kept in all handlers)
- Error response: 409 Conflict with dependency details when deletion is blocked

### Phase 3: UI — Deletion Blocked Dialog + Integration — ✅ IMPLEMENTED (2026-03-13)

| Task | Αρχείο | Περιγραφή | Status |
|------|--------|-----------|--------|
| 3.1 | `src/components/shared/DeletionBlockedDialog.tsx` | Reusable AlertDialog: λίστα εξαρτήσεων (label + count) + κουμπί "Κατάλαβα" | ✅ |
| 3.2 | `src/hooks/useDeletionGuard.ts` | Custom hook: pre-check fetch + state + blocked dialog rendering | ✅ |
| 3.3 | `src/i18n/locales/{el,en}/common.json` | i18n keys: `deletionGuard.*` (blocked, understood, count, deleteFirst) | ✅ |
| 3.4 | `BuildingsPageContent.tsx` | Cascade preview → `useDeletionGuard('building')` | ✅ |
| 3.5 | `projects-page-content.tsx` | Cascade preview → `useDeletionGuard('project')` | ✅ |
| 3.6 | `UnitsTabContent.tsx` | Pre-check before delete via `useDeletionGuard('unit')` | ✅ |
| 3.7 | `ParkingTabContent.tsx` | Pre-check before delete via `useDeletionGuard('parking')` | ✅ |
| 3.8 | `StorageTab.tsx` | Pre-check before delete via `useDeletionGuard('storage')` | ✅ |
| 3.9 | `DeleteContactDialog.tsx` | Pre-check on open via `useDeletionGuard('contact')` | ✅ |
| 3.10 | `FloorsTabContent.tsx` | Pre-check before delete via `useDeletionGuard('floor')` | ✅ |

**Implementation Notes (Phase 3)**:
- `DeletionBlockedDialog`: AlertDialog (Radix) with ShieldAlert icon, dependency list (label + count), single "Κατάλαβα" button
- `useDeletionGuard(entityType)`: Returns `{ checking, blocked, **checkResult**, checkBeforeDelete, resetCheck, BlockedDialog }` — encapsulates entire pre-check flow. ⚠️ Το `checkResult` **λείπε** από αυτή τη γραμμή μέχρι τις 2026-07-17 ενώ ο κώδικας το επέστρεφε από την αρχή· ο `PermanentDeleteDialog` το καταναλώνει (φτιάχνει δικό του `DeletionBlockedDialog` αντί για το έτοιμο). Το αρχείο είναι `.tsx`, όχι `.ts` όπως λέει ο πίνακας 3.2.
- **Από 2026-07-17 (ADR-584 / N.18)**: η μηχανή δεν ζει πια εδώ — το `useDeletionGuard` είναι **binding** του `src/hooks/guards/useDependencyGuard.tsx` (SSoT). Δες «Client guard SSoT» παρακάτω.
- Buildings/Projects: **REMOVED** entire cascade preview flow (states, useEffect, useMemo cascadeDescription) — replaced with single hook call
- Units/Parking/Storage/Floors: Pre-check added before delete confirmation dialog
- Contacts (SmartDialog): Wrapper runs pre-check on dialog open; if blocked → closes SmartDialog, shows BlockedDialog
- Server-side 409 guard remains as fallback for any bypass
- i18n: `common.deletionGuard.*` namespace (el + en)

### Phase 4: Cleanup — Deprecate Cascade Delete & Preview — ✅ IMPLEMENTED (2026-03-13)

| Task | Αρχείο | Περιγραφή | Status |
|------|--------|-----------|--------|
| 4.1 | `src/lib/firestore/cascade-delete.ts` | **DELETED** — αντικαταστάθηκε πλήρως από `deletion-guard.ts` | ✅ |
| 4.2 | `src/app/api/buildings/[buildingId]/cascade-preview/route.ts` | **DELETED** — αντικαταστάθηκε από `/api/deletion-guard/building/{id}` | ✅ |
| 4.3 | `src/app/api/projects/[projectId]/cascade-preview/route.ts` | **DELETED** — αντικαταστάθηκε από `/api/deletion-guard/project/{id}` | ✅ |
| 4.4 | `src/components/building-management/building-services.ts` | **EDIT** — αφαίρεση `BuildingCascadePreviewData` + `getBuildingCascadePreview()` | ✅ |
| 4.5 | `src/services/projects-client.service.ts` | **EDIT** — αφαίρεση `CascadeChildItem` + `CascadePreviewData` + `getProjectCascadePreview()` | ✅ |

**Implementation Notes (Phase 4)**:
- Deleted 3 files: cascade-delete engine, buildings cascade-preview route, projects cascade-preview route
- Removed dead code from 2 service files (interfaces + functions no longer imported anywhere)
- References in `useEnterpriseRelationships.ts` and `RelationshipCRUDService.ts` are UNRELATED (relationship cascade, different system) — kept as-is
- Zero production risk: all deleted code was already unused after Phases 2-3 replaced it

### Phase 5: Cascade Dependencies for Junction Records — ✅ IMPLEMENTED (2026-03-14)

| Task | Αρχείο | Περιγραφή | Status |
|------|--------|-----------|--------|
| 5.1 | `src/config/deletion-registry.ts` | Νέο `CascadeDependencyDef` type + `cascadeDependencies` στο `EntityDeletionConfig` | ✅ |
| 5.2 | `src/config/deletion-registry.ts` | Μετακίνηση `contact_relationships` (x2) + `contact_links` σε `cascadeDependencies` | ✅ |
| 5.3 | `src/config/deletion-registry.ts` | Bug fix: `skipCompanyFilter: true` σε 6 entries χωρίς `companyId` | ✅ |
| 5.4 | `src/lib/firestore/deletion-guard.ts` | Νέα `executeCascadeDeletions()` — batched delete (450/batch) | ✅ |
| 5.5 | `src/lib/firestore/deletion-guard.ts` | `executeDeletion()` flow: CHECK → CASCADE → DELETE → AUDIT | ✅ |
| 5.6 | `src/lib/firestore/deletion-guard.ts` | Cascade info στο audit trail (`_cascade_deletions` field) | ✅ |

**Implementation Notes (Phase 5)**:

#### Bug Fix: `skipCompanyFilter`
5 collections δεν έχουν `companyId` field: `contact_relationships`, `contact_links`, `external_identities`, `employment_records`, `attendance_events`. Χωρίς `skipCompanyFilter: true`, η query πρόσθετε `.where('companyId', '==', companyId)` → 0 results → ο guard **ποτέ δεν μπλόκαρε** τη διαγραφή λόγω αυτών. FIXED.

#### Cascade vs Block
- **Cascade** (auto-delete): Junction records χωρίς ανεξάρτητη αξία — `contact_relationships`, `contact_links`
- **Block** (manual delete): Child entities με ανεξάρτητη αξία — units, opportunities, external_identities, employment_records, attendance_events

#### Execution Order
```
1. checkDeletionDependencies()  → Αν BLOCK deps υπάρχουν → abort (409)
2. executeCascadeDeletions()    → Auto-delete junction records (batched)
3. docRef.delete()              → Delete entity
4. Audit trail                  → Full snapshot + cascade details
```

**ΚΡΙΣΙΜΟ**: Cascade εκτελείται ΜΟΝΟ αν ΔΕΝ υπάρχουν blocking dependencies. Αν αποτύχει cascade → throw 500, ΔΕΝ σβήνεται η parent entity.

#### Reciprocal Handling
Τα reciprocal relationships καλύπτονται αυτόματα:
- Σχέση A→B: `sourceContactId == A` → cascade
- Reciprocal B→A: `targetContactId == A` → cascade

### Phase 6: Soft Delete Pattern (Priority: LOW — μελλοντικό)

| Task | Αρχείο | Περιγραφή |
|------|--------|-----------|
| 6.1 | Soft delete utility | `softDelete()` function: sets `deletedAt`, `deletedBy`, keeps document |
| 6.2 | Query filters | Global query filter: `where('deletedAt', '==', null)` |
| 6.3 | Restore API | Endpoint για undo soft-deleted entities |

---

## 6. Στρατηγική ανά Entity — Σύνοψη

| Entity | Στρατηγική | Εξαρτήσεις | Priority |
|--------|-----------|------------|----------|
| **Company** | 🚫 BLOCK (πάντα) | projects, contacts, buildings | Phase 2 |
| **Project** | 🚫 BLOCK | 6 collections (buildings, opportunities, communications, contact_links, construction_phases, obligations) — **αντικατάσταση cascade** | Phase 2 |
| **Building** | 🚫 BLOCK | 6 collections (units, floors, parking, storage, milestones, floorplans) — **αντικατάσταση cascade** | Phase 2 |
| **Contact** | 🚫 BLOCK | 12 collections — preview + clickable links + χειροκίνητη bottom-up διαγραφή | Phase 2 |
| **Unit** | 🚫 BLOCK | 6 collections — preview + clickable links + χειροκίνητη bottom-up διαγραφή | Phase 2 |
| **Floor** | 🚫 BLOCK | units | Phase 2 |
| **Parking** | 🚫 BLOCK αν πωλημένο | entity_links + conditional check `commercial.buyerContactId` | Phase 2 |
| **Storage** | 🚫 BLOCK αν πωλημένο | entity_links + conditional check `commercial.buyerContactId` | Phase 2 |
| **Invoice** | 🗂️ SOFT_DELETE | (fiscal compliance — ήδη υλοποιημένο) | ✅ Done |

---

## 7. References

- **DELETED (Phase 4)**: ~~`src/lib/firestore/cascade-delete.ts`~~ — αντικαταστάθηκε από `deletion-guard.ts`
- **DELETED (Phase 4)**: ~~`src/app/api/projects/[projectId]/cascade-preview/route.ts`~~ — αντικαταστάθηκε από `/api/deletion-guard/project/{id}`
- **DELETED (Phase 4)**: ~~`src/app/api/buildings/[buildingId]/cascade-preview/route.ts`~~ — αντικαταστάθηκε από `/api/deletion-guard/building/{id}`
- **SSoT**: `src/config/firestore-collections.ts` — COLLECTIONS constants
- Related: [ADR-210](./ADR-210-document-id-generation-audit.md) — Document ID patterns
- Industry: PostgreSQL FK constraints with ON DELETE RESTRICT / CASCADE / SET NULL

---

## 8. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-03-13 | ADR Created — Full dependency mapping completed | Γιώργος Παγώνης + Claude Code |
| 2026-03-13 | **ΦΙΛΟΣΟΦΙΑ BOTTOM-UP ONLY**: Καταργείται κάθε cascade delete. Ο χρήστης διαγράφει ΜΟΝΟ από κάτω προς τα πάνω, χειροκίνητα. Αντικατάσταση υπάρχοντος cascade σε Project/Building. | Γιώργος Παγώνης |
| 2026-03-13 | ΟΛΑ τα entities → **BLOCK** strategy. Parking/Storage → conditional BLOCK (μόνο αν πωλημένα). | Γιώργος Παγώνης |
| 2026-03-13 | Permission fixes: **Phase 0 — ✅ IMPLEMENTED**. Νέα permissions: `units:units:delete`, `projects:floors:delete`. Roles: company_admin + project_manager. Parking/Storage → `units:units:delete` (sub-entities). | Γιώργος Παγώνης + Claude Code |
| 2026-03-13 | Υπάρχοντα cascade-preview dialogs (Project/Building) → **ΑΝΤΙΚΑΤΑΣΤΑΣΗ** με Deletion Blocked dialogs | Γιώργος Παγώνης |
| 2026-03-13 | Μηνύματα Deletion Blocked dialog μέσω **i18n** (ελληνικά + αγγλικά) | Γιώργος Παγώνης |
| 2026-03-13 | Κάθε επιτυχής διαγραφή → **audit trail** (`entity_audit_trail`): ποιος, πότε, τι σβήστηκε + **full JSON snapshot** των δεδομένων πριν τη διαγραφή | Γιώργος Παγώνης |
| 2026-03-13 | **Phase 1 — ✅ IMPLEMENTED**: Deletion registry (8 entities, 35 deps), core engine (`checkDeletionDependencies` + `executeDeletion`), preview API (`GET /api/deletion-guard/{entityType}/{entityId}`). Parallel queries, tenant isolation, conditional blocks, safe defaults on failure. | Claude Code |
| 2026-03-13 | **Phase 2 — ✅ IMPLEMENTED**: All 7 DELETE endpoints integrated with `executeDeletion()`. Projects/Buildings cascade **REMOVED** → bottom-up BLOCK. Units manual audit removed (executeDeletion handles it). Parking/Storage conditional BLOCK for sold items. Dual audit pattern (entity + auth). | Claude Code |
| 2026-03-13 | **Phase 3 — ✅ IMPLEMENTED**: `DeletionBlockedDialog` (AlertDialog + ShieldAlert), `useDeletionGuard` hook (pre-check + state + BlockedDialog). Integrated in 7 components: Buildings, Projects (replaced cascade preview), Units, Parking, Storage, Contacts (SmartDialog wrapper), Floors. i18n keys in `common.deletionGuard.*`. | Claude Code |
| 2026-03-13 | **Phase 4 — ✅ IMPLEMENTED**: Cleanup — deleted `cascade-delete.ts`, buildings + projects `cascade-preview/route.ts`. Removed dead code: `BuildingCascadePreviewData` + `getBuildingCascadePreview()` from building-services, `CascadeChildItem` + `CascadePreviewData` + `getProjectCascadePreview()` from projects-client.service. Zero risk — all code was already unused. | Claude Code |
| 2026-03-14 | **ΚΡΙΣΙΜΟ BUG FIX**: `skipCompanyFilter` — 5 collections χωρίς `companyId` (contact_relationships, contact_links, external_identities, employment_records, attendance_events) δεν ελέγχονταν ποτέ σωστά. Query με `.where('companyId', '==', companyId)` σε collection χωρίς `companyId` → πάντα 0 results → guard δεν μπλόκαρε ποτέ. | Γιώργος Παγώνης + Claude Code |
| 2026-03-14 | **Phase 5 — ✅ IMPLEMENTED**: Cascade dependencies for junction records. `contact_relationships` (x2) + `contact_links` → auto-delete πριν τον blocking check. Νέο `CascadeDependencyDef` type, `executeCascadeDeletions()` (batched 450/batch), audit trail με cascade details. Execution order: CHECK → CASCADE → DELETE → AUDIT. | Claude Code |
| 2026-04-01 | **Phase 6 — Address Impact Guard (ADR-277)**: Extension του guard pattern σε address edits/deletes. Νέο `address-impact-preview.service.ts` (read-only Firestore queries), API route, `AddressImpactDialog` + `BranchDeleteConfirmDialog`, map drag hierarchy warning. Deferred submit pattern (mirrors ADR-249 name cascade). Βλ. [ADR-277](./ADR-277-address-impact-guard.md). | Claude Code |
| 2026-04-01 | **Phase 7 — Soft Delete / Trash (ADR-191 pattern)**: Contacts DELETE endpoint → soft-delete (`status='deleted'`, `deletedAt`, `deletedBy`, `previousStatus`). Νέα API: `POST /restore` (επαναφορά), `DELETE /permanent-delete` (hard delete — μόνο από trash, τρέχει `executeDeletion()`). Undo toast 5sec μέσω NotificationProvider actions. Trash view στο Contacts page (toggle button header, `TrashActionsBar`). `PermanentDeleteDialog` — μόνο αυτό χρησιμοποιεί `useDeletionGuard` pre-check. Auto-purge cron (daily 03:00 UTC, 30-day retention). Query filtering: `contacts-query.service.ts` excludes `status='deleted'` from normal queries. Zero αλλαγές σε `deletion-registry.ts`/`deletion-guard.ts` — soft-deleted contacts μένουν στην ίδια collection, references valid. | Claude Code |
| 2026-04-01 | **Phase 8 — Company Identity Field Guard (ADR-278)**: Extension του guard pattern σε company master-data field edits (companyName, vatNumber, gemiNumber, taxOffice, legalForm, tradeName, gemiStatus). Κατηγοριοποίηση πεδίων σε A (identity-critical), B (accounting/compliance), C (display). Block unsafe clears, impact preview dialog πριν αλλαγές σε Cat A/B fields. Νέο `company-identity-impact-preview.service.ts` (5 parallel Firestore queries), API route, `CompanyIdentityImpactDialog`, utility `company-identity-guard.ts`. Guard #3 στο `useContactSubmission` (μετά Name Cascade + Address Impact). Βλ. [ADR-278](./ADR-278-company-identity-field-guard.md). | Claude Code |
| 2026-04-01 | **Phase 9 — Communication Field Impact Detection (ADR-280)**: Extension του guard pattern σε primary communication field edits (email, phone, website). Ανίχνευση: primary email/phone αλλαγή, corporate website αλλαγή, unsafe removal (τελευταίο email/phone). Block αν αφαιρεθούν ΟΛΑ emails/phones εταιρείας. Impact preview dialog πριν αλλαγή primary fields. Array validation στο submit path: format, duplicates, primary enforcement. Νέα: `communication-impact-guard.ts`, `communication-array-validation.ts`, `communication-impact-preview.service.ts` (4+subcollection parallel Firestore queries), API route, `CommunicationImpactDialog`. Guard #4 στο `useContactSubmission` (μετά Identity Impact). Μόνο company contacts. i18n el/en. | Claude Code |
| 2026-04-20 | **Phase 10 — Property Cascade Completion + Storage Cleanup**: `deletion-registry.ts` extended με `useCollectionGroup?: boolean` (στο `CascadeDependencyDef`) και νέο `StorageCleanupDef` + `storageCleanup?` στο `EntityDeletionConfig`. `property.cascadeDependencies` καλύπτει πλέον `files`, `shares`, και DXF overlay polygons (`collectionGroup('items')` με `linked.propertyId`). Νέα `storageCleanup` entry για `property`: prefix `companies/{companyId}/entities/property/{entityId}/` (φωτογραφίες, κατόψεις, share PDFs). Νέα modules: `deletion-storage-cleanup.ts` (best-effort prefix purge μέσω `bucket.deleteFiles`, pattern από `files/purge/route.ts`), `deletion-link-guard.ts` (SRP split: link-removal metadata out of core guard), `deletion-common.ts` (shared `MAX_PREVIEW_IDS` + `getDefaultRemediation`). Audit trail τώρα περιέχει `_storage_cleanup` change entry. **Policy**: `entity_audit_trail` παραμένει εκτός cascade — διατηρείται ως permanent audit log (Google pattern). | Γιώργος Παγώνης + Claude Code |
| 2026-07-17 | **Client guard SSoT (N.18 / ADR-584)**: η μηχανή pre-check ήταν γραμμένη **δύο φορές** (`useDeletionGuard` ↔ `useLinkRemovalGuard`, 3 clones / ~46 διπλές γρ.) — ίδια state machine, ίδιο dialog wiring, ίδιο fail-closed catch· διέφεραν μόνο route/μήνυμα/log prefix. Νέο SSoT `src/hooks/guards/useDependencyGuard.tsx` (`DependencyGuardSpec` = τα 3 σημεία που διαφέρουν)· τα δύο hooks έγιναν bindings με **αυτούσιο** public API → **κανένας από τους 10 καταναλωτές δεν άγγιξε**. Registry module `dependency-guard` (pattern grep-verified: χτυπά **μόνο** το SSoT → **0 προϋπάρχουσες παραβιάσεις, κανένα `ssot:baseline`**· golden 90/90). ⛔ `useLandownerUnlinkGuard` (ADR-244) **ΕΞΩ** — άλλος τύπος, χωρίς dialog, **fail-OPEN κατά ρητή απόφαση**· merge θα αντέστρεφε την πολιτική ασφαλείας του. **ΟΛΑ ήταν ΑΤΕΣΤΩΤΑ** → 22 characterization tests (ΠΡΙΝ το refactor, GREEN πριν ΚΑΙ μετά, ίδιες assertions), mutation-verified ×2 (λάθος route σε binding → 1 κόκκινο· fail-open στη μηχανή → **4 κόκκινα**). Διορθώθηκαν 2 ανακρίβειες του ADR: το `checkResult` έλειπε από το documented return, και το αρχείο είναι `.tsx` όχι `.ts`. | Γιώργος Παγώνης + Claude Code |
| 2026-07-17 | **Ο σύνδεσμος ήταν μονόδρομος — μπήκε η πόρτα από τον κώδικα προς την απόφαση.** Το §597-614 (παραπάνω) τεκμηριώνει σωστά το fail-closed συμβόλαιο ΚΑΙ την εξαίρεση `useLandownerUnlinkGuard`. Αλλά **το ADR ήξερε για τον κώδικα, ο κώδικας δεν ήξερε για το ADR**: το header του hook έδειχνε `@enterprise ADR-244 — Landowner Safety Guard`, ενώ **(α)** το ADR-244 υπάρχει **ΔΥΟ φορές** (`ADR-244-multi-buyer-co-ownership.md` / `ADR-244-role-management-admin-console.md` — 3η περίπτωση διπλής αρίθμησης μετά το γνωστό ADR-145) και **(β)** **κανένα από τα δύο δεν αναφέρει λέξη** για fail-open (grep: 0 hits σε `fail-open\|allow removal\|silently block`). Δηλαδή ο αντιγραφέας ακολουθούσε την ταμπέλα και προσγειωνόταν σε λάθος έγγραφο. **Fix (1 αρχείο, σχόλια μόνο, μηδέν runtime):** στο `useLandownerUnlinkGuard.ts` μπήκε `@variance` (τι διαφέρει / από ποια αδέλφια / γιατί / ⛔ μην το ευθυγραμμίσεις) + `@variance-adr` που δείχνει **εδώ**, στο §597-614. **Το σκεπτικό:** η αντιγραφή ΔΕΝ ανιχνεύεται αξιόπιστα — ο state-of-the-art ανιχνευτής inconsistent clones (Jürgens et al., ICSE 2009) έχει precision **0,83 ≈ 17% false positives** έναντι του **≤10%** πήχη της Google για blocking checks· το εργαλείο (ConQAT) είναι EOL, ο διάδοχος (Teamscale) εμπορικός, και **κανένα** maintained MIT/Apache/BSD εργαλείο δεν κάνει inconsistency detection (SourcererCC = GPLv3 → N.5 ⛔). Άρα **αντί να κυνηγάμε την αντιγραφή, η απόφαση μπαίνει ΜΕΣΑ στο αντιγραφόμενο**: το copy-paste μεταφέρει την προειδοποίηση δωρεάν. Στηρίζεται μετρημένα: follow-up της ίδιας ομάδας βρήκε **ίδιο εργαλείο → 3%-33% fault rate** ανάλογα με το αν υπήρχε διαδικασία επίγνωσης — **ο μοχλός είναι η σύμβαση, όχι ο ανιχνευτής**. ✅ **ΤΡΙΑΖ ΟΛΟΚΛΗΡΩΘΗΚΕ ΤΗΝ ΙΔΙΑ ΜΕΡΑ — ΤΟ «17» ΚΑΤΕΡΡΕΥΣΕ ΣΕ «1». ΚΑΜΙΑ ΕΚΣΤΡΑΤΕΙΑ ΔΕΝ ΧΡΕΙΑΖΕΤΑΙ.** Το «~17 σημεία» ήταν **ωμό grep λέξεων** (`unlike\|deliberately\|on purpose\|better to`), ΟΧΙ 17 επαληθευμένες αποφάσεις — καταγράφεται εδώ ως προειδοποίηση: **μη χτίσεις εκστρατεία πάνω σε αριθμό grep**. Κριτήριο τριάζ: *θα έσπαγε κάτι σιωπηλά αν κάποιος «ευθυγράμμιζε» το σημείο με τα αδέλφια του;* Αποτέλεσμα και των 17: **3 σκουπίδια grep/περιγραφικά** (`usePhotoUploadLogic:110` = η λέξη «purpose» σε άσχετη πρόταση· `useDebouncedCallback:3`, `popover:18` = περιγραφή συμπεριφοράς)· **3 ΗΔΗ ΥΠΟΔΕΙΓΜΑΤΙΚΑ ΣΩΣΤΑ** (`parking-general-tab-config`, `storage-general-tab-config`, `space-payload-builder` → «ADR-588 keeps the two forms separate on purpose» **+ `@see` που ΑΝΟΙΓΕΙ**: επαληθεύτηκε ότι §«General tab» γρ. 47, §«Out of scope (deliberate)» γρ. 69-70 και §«Decision — Phase 2» γρ. 76 **υπάρχουν όντως** και τεκμηριώνουν το «γιατί όχι God-shell»)· **οι υπόλοιπες = σημειώσεις «μη με πειράξεις» στη σωστή γραμμή, χωρίς αδέλφια από τα οποία να αποκλίνουν** (π.χ. `base-tabs.tsx:78` χαλαρό `!= null` — πραγματική παγίδα, αλλά το σχόλιο κάθεται ΠΑΝΩ της· ταμπέλα δεν προσθέτει τίποτα). **🔴 ΤΟ ΣΥΜΠΕΡΑΣΜΑ: ο μηχανισμός (απόφαση σε ADR + ταμπέλα από τον κώδικα που ΑΝΟΙΓΕΙ) ΤΗΡΕΙΤΑΙ ΗΔΗ στο repo. Το `useLandownerUnlinkGuard` ήταν ΑΝΩΜΑΛΙΑ — σπασμένη ταμπέλα, όχι απούσα σύμβαση. Διορθώθηκε. Δεν υπάρχει εκκρεμής εκστρατεία `@variance`.** 📌 **ΕΝΑ γνήσιο απομένει, ΕΚΤΟΣ scope εδώ:** `useLegalContracts.ts:136` («no propertyId guard, unlike the finance hooks») — ίδιο σχήμα, ίδια οικογένεια με το πραγματικό bug `deletePlan`-χωρίς-guard· δείχνει `@enterprise ADR-230` που **δεν αναφέρει λέξη** γι' αυτό (grep: 0 hits). Ανήκει στο **`gateway-action`** SSoT (`src/lib/mutations/gateway-action.ts`), όχι στο ADR-230 → θέλει **νέα ενότητα ADR, όχι σχόλιο**. ⚠️ **ΜΗΝ το πιάσεις χωρίς έλεγχο:** υπάρχει `HANDOFFS/2026-07-17_gateway-action-ssot_handoff.md` — πιθανός άλλος πράκτορας στην ίδια γωνιά, κοινό δέντρο. | Γιώργος Παγώνης + Claude Code |

---

---

## Client guard SSoT — `useDependencyGuard` (2026-07-17)

**Κανόνας: κάθε client-side dependency pre-check περνά από `src/hooks/guards/useDependencyGuard.tsx`.**
Registry module: `dependency-guard` (CHECK 3.7).

Η ροή «ρώτα τον server πριν την καταστροφική ενέργεια» ήταν γραμμένη **δύο φορές** — 3 clones /
~46 διπλές γραμμές μεταξύ `useDeletionGuard` και `useLinkRemovalGuard`. Ίδια state machine, ίδιο
dialog wiring, ίδιο fail-closed catch· διέφεραν **μόνο** route, μήνυμα και log prefix.

| Hook | Route | Επιφάνεια |
|---|---|---|
| `useDeletionGuard(entityType)` | `/api/deletion-guard/{entityType}/{id}` | `checking, blocked, checkResult, checkBeforeDelete, resetCheck, BlockedDialog` |
| `useLinkRemovalGuard()` | `/api/link-removal-guard/{linkId}` | `checking, blocked, checkBeforeRemove, BlockedDialog` — σκόπιμα στενότερη |

Ό,τι διαφέρει ζει στο `DependencyGuardSpec` (`checkRoute` / `unavailableMessage` / `logName`) —
**τίποτε άλλο**. Τα δύο μηνύματα («η **διαγραφή** μπλοκαρίστηκε…» vs «η **αποσύνδεση**
μπλοκαρίστηκε…») είναι **spec, όχι drift**: περιγράφουν την ενέργεια στον χρήστη. Τα public APIs
έμειναν **αυτούσια** → κανένας από τους 10 καταναλωτές δεν άγγιξε.

### 🔴 Το συμβόλαιο που προστατεύει το SSoT: **FAIL-CLOSED**

Αν ο **ίδιος ο έλεγχος** σκάσει (network/500), και τα δύο guards **μπλοκάρουν** — δεν λένε
«προχώρα». Ο server-side 409 guard είναι το **τελευταίο** δίχτυ, όχι το πρώτο. Αυτό είναι ακριβώς
το είδος απόφασης που χάνεται σε τρίτη αντιγραφή: τίποτα στο happy path δεν την αποκαλύπτει.
Κλειδωμένο με tests (mutation-verified: fail-open → 4 κόκκινα).

### ⛔ `useLandownerUnlinkGuard` ΔΕΝ είναι μέλος — και δεν πρέπει να γίνει

Μοιάζει αδελφό (ίδιο `apiClient`, ίδιο `[hook] Pre-check failed` log) και το grep το φέρνει, αλλά
είναι **άλλη μηχανή**: **ADR-244**, τύπος `LandownerUnlinkResult` (`variant: confirm|warning|blocked`
+ `blockingDeps`/`warningDeps`, **όχι** `DependencyCheckResult`), **δεν αποδίδει dialog** (ο γονιός
ελέγχει το 3-variant σενάριο), δύο ορίσματα, επιστρέφει το **πλήρες result** αντί για boolean — και,
κρίσιμα, **fail-OPEN κατά ρητή τεκμηριωμένη απόφαση** («better to allow removal than to silently
block the user»). Merge θα **αντέστρεφε τη σκόπιμη πολιτική ασφαλείας του** σε fail-closed.
Το `forbiddenPattern` (`apiClient\.get<DependencyCheckResult>`) είναι γι' αυτό διαλεγμένο ώστε **να
μην το πιάνει**: ούτε αυτό ούτε οι server-side guards (`deletion-guard.ts` / `deletion-link-guard.ts`,
που **φτιάχνουν** τον τύπο αντί να τον κατεβάζουν) ματσάρουν ποτέ.


*ADR Format based on: Michael Nygard's Architecture Decision Records*
*Enterprise standards inspired by: PostgreSQL referential integrity, Autodesk Vault deletion policies*
