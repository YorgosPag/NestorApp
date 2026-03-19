# ADR-247: Entity Relationship Integrity Audit

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-03-19 |
| **Category** | Entity Systems / Data Integrity |
| **Type** | AUDIT (documentation-only, no code changes) |
| **Trigger** | Bug: same parking/storage linkable to multiple units (no server-side guard) |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## 1. Context

### Τι συνέβη

Κατά τη δοκιμαστική περίοδο (2026-03-19) ανακαλύφθηκε κρίσιμο bug: η ίδια αποθήκη/parking μπορούσε να συνδεθεί ως παρακολούθημα (linked space) σε πολλαπλές μονάδες **χωρίς κανένα server-side guard**. Η διόρθωση έγινε client-side (`LinkedSpacesCard.tsx`) αλλά αποκάλυψε πιθανά παρόμοια gaps σε ολόκληρο το entity relationship model.

### Σκοπός Audit

Καθολική έρευνα **84+ αρχείων** για εντοπισμό κάθε σημείου όπου:
- Υπάρχει client-side guard αλλά λείπει server-side validation
- Denormalized data μπορεί να γίνει stale
- Referential integrity δεν επαλαηθεύεται
- Race conditions είναι πιθανά

### Scope

| Εντός Scope | Εκτός Scope |
|-------------|-------------|
| Server-side validation gaps | Code implementation (αυτό είναι documentation-only) |
| Race condition windows | Performance optimization |
| Denormalized data staleness | UI/UX improvements |
| Orphaned reference detection | New feature development |
| Cascade propagation completeness | Third-party integrations |

### Σχετικά ADRs

| ADR | Τίτλος | Σχέση |
|-----|--------|-------|
| ADR-238 | Linked Spaces Implementation | Ο μηχανισμός σύνδεσης spaces→units |
| ADR-239 | Entity Linking Centralization | Κεντρικοποιημένο linking service |
| ADR-231 | Cascade Entity Linking | Cascade propagation for IDs |
| ADR-226 | Deletion Guard (Phase 1) | Dependency-based deletion blocking |
| ADR-232 | linkedCompanyId vs companyId | Distinction between ownership models |
| ADR-195 | Entity Audit Trail | Fire-and-forget change tracking |

---

## 2. Ευρήματα

### Σύνοψη

| # | Εύρημα | Severity | Server Guard | Client Guard |
|---|--------|----------|-------------|--------------|
| F-1 | Same space → multiple units | CRITICAL | ❌ Missing | ✅ Exists |
| F-2 | linkedCompanyId orphaned refs | CRITICAL | ❌ Missing | ❌ Missing |
| F-3 | Denormalized names staleness | HIGH | ❌ Missing | ❌ Missing |
| F-4 | allocationCode staleness | HIGH | ❌ Missing | ❌ Missing |
| F-5 | Building → multiple projects | MEDIUM | ❌ Missing | ❌ Missing |

---

### F-1: Same Space → Multiple Units (CRITICAL)

**Περιγραφή**: Η ίδια θέση parking ή αποθήκη μπορεί να συνδεθεί σε πολλαπλές μονάδες ταυτόχρονα. Υπάρχει client-side guard αλλά **κανένα server-side validation**.

**Client-side guard** (`src/features/property-details/components/LinkedSpacesCard.tsx`):
- Lines 106-178: `occupiedSpaceIds` (Set) τραβάει όλα τα units του κτιρίου και αποκλείει ήδη-συνδεδεμένα spaces
- Lines 494, 533: `.filter(p => !occupiedSpaceIds.has(p.id))` αποκλείει occupied spaces από dropdowns
- Lines 268-291: Optimistic update pattern (Google Docs-style)

**Server-side gap** (`src/app/api/units/[id]/route.ts`):
- Lines 103-291: PATCH handler αποδέχεται `linkedSpaces` array χωρίς κανέναν uniqueness check
- Κανένα Firestore transaction ή unique constraint

**Race condition scenario**:
1. User A ανοίγει Unit 101, βλέπει Parking P-5 ελεύθερο
2. User B ανοίγει Unit 202, βλέπει Parking P-5 ελεύθερο (πριν το save του A)
3. User A κάνει save → P-5 συνδέεται στο Unit 101
4. User B κάνει save → P-5 συνδέεται ΚΑΙ στο Unit 202
5. **Αποτέλεσμα**: P-5 σε 2 units — data corruption

**Recommended fix**: Server-side Firestore transaction στο PATCH `/api/units/[id]` που:
1. Κάνει read σε ΟΛΑ τα units του ίδιου building
2. Ελέγχει ότι κανένα requested spaceId δεν υπάρχει σε άλλο unit
3. Αποτυγχάνει αν εντοπιστεί conflict (HTTP 409)

---

### F-2: linkedCompanyId Orphaned References (CRITICAL)

**Περιγραφή**: Το πεδίο `linkedCompanyId` cascade-propagates από project → buildings → units, αλλά **δεν ελέγχεται ποτέ αν η εταιρεία υπάρχει ή ανήκει στον ίδιο tenant**.

**Cascade propagation** (`src/lib/firestore/cascade-propagation.service.ts`):
- Lines 70-78: `propagateBuildingProjectLink()` resolves linkedCompanyId from project
- Αν project.linkedCompanyId δείχνει σε deleted contact → propagates orphaned reference
- **Κανένας existence check** κατά τη σύνδεση

**Orphan scenario**:
1. Company "ΑΛΦΑ ΑΕ" (contact-123) συνδέεται σε Project
2. Project propagates `linkedCompanyId: "contact-123"` σε buildings/units
3. Κάποιος **διαγράφει** τον contact "ΑΛΦΑ ΑΕ"
4. Deletion guard ΔΕΝ ελέγχει αν αυτός ο contact χρησιμοποιείται ως linkedCompanyId
5. **Αποτέλεσμα**: Orphaned references σε πολλαπλά buildings/units

**Fallback behavior** (`src/app/api/projects/by-company/[companyId]/route.ts`):
- Queries by `linkedCompanyId` OR falls back to `companyId` — masks the orphaned reference

**Recommended fix**:
1. Προσθήκη dependency στο deletion-registry: contact deletion blocked αν χρησιμοποιείται ως linkedCompanyId
2. Ή: cascade nullification (set linkedCompanyId = null σε όλα τα children)

---

### F-3: Denormalized Names Staleness (HIGH)

**Περιγραφή**: Πολλαπλά entity types αποθηκεύουν denormalized ονόματα γονικών entities. Η μετονομασία γονέα **δεν ενημερώνει τα παιδιά**.

**Εντοπισμένα denormalized name fields**:

| Entity | Field | Source | File |
|--------|-------|--------|------|
| Unit | `buyerName` | Contact name | `src/types/unit.ts:111-134` |
| Company | `name` | Contact name | `src/types/company.ts:57` |
| Storage | `building` (name) | Building name | Migration `006_normalize_storage_building_references.ts` |

**Τι ΔΕΝ υπάρχει**:
- ❌ Κανένα `renameBuilding()` function
- ❌ Κανένα `renameCompany()` function
- ❌ Κανένα `renameProject()` function
- ❌ Κανένα event/trigger που propagates name changes

**Τι ΥΠΑΡΧΕΙ** (μόνο για IDs):
- ✅ `cascade-propagation.service.ts` propagates `projectId`, `companyId`, `linkedCompanyId`
- ✅ Change detection (Lines 143-150) checks αν η τιμή πράγματι άλλαξε

**Staleness scenario**:
1. Building "ΠΥΡΓΟΣ Α" → μετονομάζεται σε "ΠΥΡΓΟΣ ΑΛΦΑ"
2. Denormalized `buildingName` σε units/floors/parking/storage παραμένει "ΠΥΡΓΟΣ Α"
3. UI εμφανίζει παλιό όνομα σε λίστες, κάρτες, emails

**Impact**: Cosmetic αλλά confusing — δεν σπάει functionality, αλλά δημιουργεί ασυνέπεια στο UI.

**Recommended fix**: Cascade name propagation function (παρόμοια αρχιτεκτονική με ID propagation) ή lazy resolution (resolve name on read αντί για denormalization).

---

### F-4: allocationCode Staleness (HIGH)

**Περιγραφή**: Το `allocationCode` αποθηκεύεται σε entities αλλά αλλαγή στον κωδικό **δεν propagates** στα linked children.

**References**:
- `src/config/domain-constants.ts` — allocationCode definitions
- `src/hooks/sales/useLinkedSpacesForSale.ts` — reads allocationCode
- `src/features/property-details/components/LinkedSpacesCard.tsx` — displays allocationCode
- `src/config/audit-tracked-fields.ts` — allocationCode tracked in `UNIT_TRACKED_FIELDS`

**Τι λείπει**:
- ❌ Κανένα cascade function για allocationCode changes
- ❌ Αλλαγή allocationCode σε parking/storage δεν ενημερώνει linkedSpaces array σε units

**Staleness scenario**:
1. Parking P-5 έχει `allocationCode: "A-05"`
2. Χρήστης αλλάζει σε `allocationCode: "A-05B"`
3. LinkedSpaces record στο Unit 101 διατηρεί παλιό `allocationCode: "A-05"`
4. UI εμφανίζει παλιό κωδικό στην κάρτα linked spaces

**Recommended fix**: Αν `allocationCode` αποθηκεύεται denormalized στο `linkedSpaces[]` array → cascade update. Εναλλακτικά, resolve on read.

---

### F-5: Building → Multiple Projects (MEDIUM)

**Περιγραφή**: Ένα building μπορεί να ανατεθεί σε πολλαπλά projects χωρίς κανέναν constraint.

**Entity linking config** (`src/lib/firestore/entity-linking.types.ts`, Lines 96-105):
```
'building:projectId': {
  lockedStatuses: null,       // ← NO LOCKING
  lockedStatusField: null,    // ← NO STATUS FIELD
}
```

**Τι σημαίνει**: Ο χρήστης μπορεί ελεύθερα να αλλάξει `projectId` σε building χωρίς restriction. Αυτό σημαίνει ότι:
1. Building Α ανήκει στο Project 1
2. Χρήστης αλλάζει Building Α στο Project 2
3. Δεν υπάρχει check αν Building Α **ήδη** συνδέεται μέσω άλλης διαδρομής

**Σημείωση**: Αυτό μπορεί να είναι **intentional** — ένα building μπορεί να μεταφερθεί μεταξύ projects. Αλλά δεν υπάρχει confirmation/guard.

**Cascade propagation**: ✅ Λειτουργεί σωστά — `propagateBuildingProjectLink()` ενημερώνει τα children (floors, units, parking, storage) κατά τη μεταφορά.

**Recommended fix**: Business rule decision needed — αν buildings πρέπει να είναι exclusive σε ένα project, πρόσθεσε validation.

---

## 3. Protected Areas (No Action Needed)

Τα παρακάτω λειτουργούν σωστά και δεν χρειάζονται αλλαγές.

### 3.1 Sold Unit Field Locking ✅

**File**: `src/app/api/units/[id]/route.ts` (Lines 110-130)

17 πεδία κλειδώνονται όταν `commercialStatus === 'sold' || 'rented'`:
- `code`, `type`, `name`, `areas`, `layout`, `floor`, `floorId`
- `commercialStatus`, `buildingId`, **`linkedSpaces`**
- `orientations`, `condition`, `energy`, `systemsOverride`
- `finishes`, `interiorFeatures`, `securityFeatures`
- `levels`, `isMultiLevel`, `levelData`

HTTP 403 response: `Cannot modify locked fields on a ${status} unit`

### 3.2 Sold Parking/Storage Unlink Blocked ✅

**File**: `src/lib/firestore/entity-linking.types.ts` (Lines 65-84)

```
'storage:buildingId': { lockedStatuses: ['sold'], lockedStatusField: 'status' }
'parking:buildingId': { lockedStatuses: ['sold'], lockedStatusField: 'status' }
```

Δεν μπορεί να αλλάξει `buildingId` σε sold parking/storage.

### 3.3 Deletion Guards ✅

**File**: `src/lib/firestore/deletion-guard.ts`

- `checkDeletionDependencies()` (Lines 50-109): Blocks deletion αν υπάρχουν dependencies
- `executeCascadeDeletions()` (Lines 138-203): Auto-deletes junction records
- `executeDeletion()` (Lines 224-307): Full guarded deletion with audit trail
- Conditional blocks: sold units/parking/storage cannot be deleted (Lines 190-194, 363-367)

### 3.4 Cascade Propagation for IDs ✅

**File**: `src/lib/firestore/cascade-propagation.service.ts`

4 cascade functions με batched writes (safe under 450 ops/batch):

| Function | Lines | Propagates |
|----------|-------|------------|
| `propagateBuildingProjectLink()` | 61-128 | projectId + linkedCompanyId → children |
| `propagateProjectCompanyLink()` | 144-214 | linkedCompanyId → children |
| `propagateUnitBuildingLink()` | 228-290 | projectId + companyId → children |
| `propagateChildBuildingLink()` | 307-356 | projectId + companyId + linkedCompanyId → children |

Change detection (Lines 143-150): Ελέγχει αν η τιμή πράγματι άλλαξε πριν κάνει cascade.

### 3.5 Audit Trail ✅

**File**: `src/services/entity-audit.service.ts`

- `recordChange()` (Lines 73-108): Fire-and-forget audit for all entity changes
- Uses `generateEntityAuditId()` for enterprise ID generation
- Records: entityType, entityId, action, changes[], performedBy, timestamp
- Tracked fields: `src/config/audit-tracked-fields.ts` — 24+ unit fields, 15+ contact fields

### 3.6 Tenant Isolation ✅

**File**: `src/lib/firestore/deletion-guard.ts` (Line 332)

```
query = query.where('companyId', '==', companyId);
```

Όλα τα dependency checks φιλτράρονται ανά `companyId` (εκτός accounting collections).

---

## 4. Risk Matrix

| # | Εύρημα | Severity | Probability | Impact | Priority |
|---|--------|----------|-------------|--------|----------|
| F-1 | Same space → multiple units | CRITICAL | Medium (requires concurrent users) | Data corruption | P0 |
| F-2 | linkedCompanyId orphaned refs | CRITICAL | Low (requires contact deletion) | Broken references | P1 |
| F-3 | Denormalized names staleness | HIGH | High (every rename) | UI inconsistency | P2 |
| F-4 | allocationCode staleness | HIGH | Medium (code changes) | UI inconsistency | P2 |
| F-5 | Building → multiple projects | MEDIUM | Low (unusual operation) | Data ambiguity | P3 |

---

## 5. Recommended Implementation Roadmap

> **Σημείωση**: Αυτό το ADR είναι AUDIT-ONLY. Η υλοποίηση θα γίνει σε μελλοντικά ADRs.

### Phase 1: Critical Fixes (P0-P1)

| Task | Estimated Effort | Dependencies |
|------|-----------------|--------------|
| F-1: Server-side unique constraint (Firestore transaction) | 2-3h | None |
| F-2: Contact deletion → linkedCompanyId dependency check | 1-2h | deletion-registry.ts |

### Phase 2: Staleness Resolution (P2)

| Task | Estimated Effort | Dependencies |
|------|-----------------|--------------|
| F-3: Name cascade propagation function | 3-4h | cascade-propagation.service.ts |
| F-4: allocationCode cascade propagation | 2-3h | cascade-propagation.service.ts |

### Phase 3: Business Rules (P3)

| Task | Estimated Effort | Dependencies |
|------|-----------------|--------------|
| F-5: Building→Project exclusivity (business decision) | 1h (if needed) | Γιώργος decision |

---

## 6. Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-19 | Initial audit — 5 findings, 6 protected areas documented | Claude Code |
