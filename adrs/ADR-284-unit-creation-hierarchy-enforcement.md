# ADR-284: Unit Creation Hierarchy Enforcement (Company → Project → Building → Floor → Unit)

**Status**: PROPOSED
**Date**: 2026-04-04
**Author**: Claude + Γιώργος Παγώνης
**Related**: ADR-078 (Property Mutation Gateway), ADR-197 §2.9 (Sales Dialogs), ADR-232 (linkedCompanyId), ADR-233 (Entity Codes), ADR-236 (Multi-Level Units)
**Category**: Data Integrity / Referential Integrity / Enterprise Validation

---

## 1. Πρόβλημα

### 1.1 Η Ερώτηση

Μπορεί ο χρήστης να δηλώσει μία **Μονάδα (Unit/Διαμέρισμα)** προς πώληση **χωρίς** να είναι συνδεδεμένη με:

- **Εταιρεία** (Company)
- **Έργο** (Project)
- **Κτίριο** (Building)
- **Όροφο** (Floor)

Η αναμενόμενη ιεραρχία (top-down):

```
Εταιρεία → Έργο → Κτίριο → Όροφος → Μονάδα
```

### 1.2 Τι Επιτρέπει ο Τρέχων Κώδικας (Source of Truth Audit, 2026-04-04)

| Layer | Τι ελέγχεται σήμερα | Αρχείο | Gap |
|-------|---------------------|--------|-----|
| **TypeScript Types** | `buildingId: string` + `floorId: string` δηλώνονται required (χωρίς `?`) | `src/types/property.ts:319-487` | Types λένε required, runtime δεν επιβάλλει |
| **Client-side Form Validation** | Μόνο `name` + `buildingId` validated | `src/components/properties/hooks/usePropertyForm.ts:97-117` | `floorId` **ΔΕΝ** validated — μπορεί να μείνει κενό |
| **UI Cascading** | Floor dropdown disabled μέχρι να επιλεγεί Building ✅ | `src/components/properties/dialogs/AddPropertyDialog.tsx:155-204` | Κανείς Company/Project selector — buildings περνάνε ως prop |
| **Required UI Markers** | `<FormField required>` μόνο σε Name + Building | `AddPropertyDialog.tsx:110,155` | Floor field ΔΕΝ έχει required marker |
| **Server-side Policy** | `assertCreatePolicy()` ελέγχει **ΜΟΝΟ** `name` | `src/services/property/property-mutation-gateway.ts:141-145` | **Direct API POST με κενά buildingId/floorId ΔΕΝ αποτρέπεται — orphan unit δυνατή** |
| **API Route Validation** | `name` required μόνο | `src/app/api/properties/create/route.ts:70-89` | Δεν ελέγχει αν buildingId/floorId υπάρχουν σε Firestore |
| **Upstream Chain Validation** | `usePropertyHierarchyValidation` **ΥΠΑΡΧΕΙ**, αλλά τρέχει ΜΟΝΟ σε Sales dialogs | `src/hooks/sales/usePropertyHierarchyValidation.ts` | Δεν τρέχει κατά τη δημιουργία Unit |
| **Firestore Rules** | Global deny (`allow read, write: if false`) — όλο μέσω server | `firestore.rules:1-22` | Κανένα referential integrity rule |

### 1.3 Κρίσιμο Εύρημα

**Υπάρχει ασυμμετρία**: ο UI επιβάλλει `buildingId` στο happy path, αλλά:

1. Το **server policy έχει τρύπα** — direct API call χωρίς UI μπορεί να δημιουργήσει orphan Unit.
2. Το **floorId δεν ελέγχεται πουθενά** ως required (ούτε UI, ούτε server).
3. Ένα **Building χωρίς projectId** (orphan Building) μπορεί να χρησιμοποιηθεί ως parent — δημιουργώντας spider-web orphan chains.
4. Η **upstream chain validation** υπάρχει αλλά τρέχει μόνο κατά τη στιγμή της πώλησης, **πολύ αργά**: η Μονάδα έχει ήδη δημιουργηθεί ως orphan.

---

## 2. Απόφαση: Defense-in-Depth σε 3 Layers (Google Pattern)

### 2.1 Design Principles

1. **Fail-safe defaults**: Ο server **ΠΑΝΤΑ** απορρίπτει orphan records — ακόμη κι αν το UI το επιτρέψει.
2. **Progressive disclosure**: Το UI εξηγεί **τι λείπει** με inline guidance, όχι κρυφά errors.
3. **Actionable blocks**: Αν δεν υπάρχει parent, δώσε **CTA** ("Δημιούργησε πρώτα Κτίριο") — ποτέ dead-end.
4. **Single source of truth**: Επανάχρηση του υπάρχοντος `usePropertyHierarchyValidation` — όχι νέος κώδικας.
5. **Referential integrity**: Κάθε Unit **πρέπει** να ανήκει σε έγκυρη αλυσίδα Project → Building → Floor.

### 2.2 Κανόνας (αδιαπραγμάτευτος) — **Discriminated βάσει τύπου μονάδας**

Η ιεραρχία **ΔΕΝ είναι ενιαία** για όλους τους τύπους Unit. Χωρίζεται σε **δύο families** βάσει του field `type: PropertyType`:

#### Family A — **In-Building Units** (12 τύποι)
Τύποι: `studio`, `apartment_1br`, `apartment`, `apartment_2br`, `apartment_3br`, `maisonette`, `penthouse`, `loft`, `shop`, `office`, `hall`, `storage`

> **Πλήρης 5-level Ιεραρχία**: `Company → Project → Building → Floor → Unit`
>
> **Υποχρεωτικά**:
> - Έγκυρο `buildingId` (υπάρχον Building στο Firestore)
> - Έγκυρο `floorId` (υπάρχον Floor **του ίδιου Building**)
> - Το Building πρέπει να έχει έγκυρο `projectId` (υπάρχον Project)
> - **Το Project πρέπει να έχει έγκυρο `linkedCompanyId`** (υπάρχον Company) — **⚠️ SUPERSEDES ADR-232**

#### Family B — **Standalone Units** (2 τύποι)
Τύποι: `detached_house` (Μονοκατοικία), `villa` (Βίλα)

> **Πλήρης 4-level Ιεραρχία**: `Company → Project → Unit` (χωρίς Building/Floor)
>
> **Υποχρεωτικά**:
> - Έγκυρο `projectId` **απευθείας στο Property** (υπάρχον Project στο Firestore)
> - **Το Project πρέπει να έχει έγκυρο `linkedCompanyId`** (υπάρχον Company) — **⚠️ SUPERSEDES ADR-232**
> - `buildingId` = **null** (ΔΕΝ έχει κτίριο — είναι αυτοτελές κτίσμα)
> - `floorId` = **null** (ΔΕΝ έχει όροφο ως entity — το field `floor` numeric μπορεί να μείνει για levels)

### ⚠️ BREAKING CHANGE: ADR-232 Revision (2026-04-04)

**ADR-284 SUPERSEDES το σχετικό τμήμα του ADR-232**.

**Πριν (ADR-232)**: `Project.linkedCompanyId` = **optional** — Projects μπορούσαν να υπάρχουν χωρίς Company (ιδιώτες επενδυτές, joint ventures).

**Μετά (ADR-284)**: `Project.linkedCompanyId` = **REQUIRED** — κάθε Project πρέπει να ανήκει σε Company.

**Reasoning**:
- Πλήρης 5-level hierarchy enforcement
- Data integrity at root of hierarchy, όχι σε leaves
- Απλοποιεί ownership/permissions model (κάθε entity έχει owner Company)
- Joint ventures/ιδιώτες → δημιουργούν "Personal Company" ή "JV Company" entity

**Scope επέκταση**: Το ADR-284 καλύπτει τώρα **και Project creation validation**, όχι μόνο Unit.

### 2.3 Discriminator Logic (business rule)

```typescript
const STANDALONE_UNIT_TYPES: PropertyType[] = ['detached_house', 'villa'];

function isStandaloneUnit(type: PropertyType): boolean {
  return STANDALONE_UNIT_TYPES.includes(type);
}
```

**Decision log (2026-04-04)**:
- **Μεζονέτα (`maisonette`)**: Θεωρείται **in-building** (Family A). Η μεζονέτα είναι συνήθως διπατρικό διαμέρισμα σε πολυκατοικία (common case στην ελληνική αγορά). Αν χρειαστεί στο μέλλον standalone μεζονέτα → νέος τύπος `detached_maisonette`.
- **Direct Project linking**: Τα standalone units συνδέονται **απευθείας** με Project, χωρίς virtual Building wrapper (honest data model).

### 2.4 Schema Change Required — `projectId` on Property

**Trigger**: Η Family B απαιτεί `projectId` field **απευθείας στο Property**. Σήμερα ο κώδικας δεν έχει αυτό το field (μόνο `project: string` για display name, και έμμεσα μέσω `Building.projectId`).

**Νέο field**:
```typescript
interface Property {
  // ...existing
  projectId: string;              // ADR-284: Always required (both families)
  buildingId: string | null;      // ADR-284: null for standalone
  floorId: string | null;         // ADR-284: null for standalone
}
```

**Backward compatibility**: Για in-building units, το `projectId` θα γεμίζεται **automatically** από `Building.projectId` κατά τη δημιουργία (server-side), ώστε όλα τα Properties να έχουν direct `projectId` reference — απλοποιεί queries ("όλες οι units ενός Project" χωρίς join μέσω Building).

---

## 3. Αρχιτεκτονική Υλοποίησης

### 3.0 Layer 0 — Project Creation Policy (NEW — ADR-284 scope extension)

**Στόχος**: Fix στο root — ΚΑΜΙΑ Project χωρίς Company.

**Αρχείο**: `src/services/project/project-mutation-gateway.ts` (ή ισοδύναμο)

```typescript
function assertProjectCreatePolicy(projectData: Record<string, unknown>): void {
  if (isBlank(projectData.name)) {
    throw new ProjectMutationPolicyError('Project name is required.');
  }

  // ADR-284: linkedCompanyId REQUIRED (supersedes ADR-232)
  if (isBlank(projectData.linkedCompanyId)) {
    throw new ProjectMutationPolicyError(
      'Company (linkedCompanyId) is required — every project must belong to a company.'
    );
  }
}

async function assertCompanyExists(linkedCompanyId: string): Promise<void> {
  const company = await fetchCompany(linkedCompanyId);
  if (!company) {
    throw new ProjectMutationPolicyError('Linked Company not found in Firestore.');
  }
}
```

**Integration point**: Project create/update API routes.

---

### 3.1 Layer 1 — Server-Side Policy for Units (CRITICAL, μηδενική ανοχή)

**Στόχος**: Να μπλοκάρει orphan units **ανεξάρτητα** από το UI. Επίσης verifies upstream Company chain.

**Αρχείο**: `src/services/property/property-mutation-gateway.ts`

**Επέκταση του `assertCreatePolicy()`** (γραμμή 141) — **discriminated βάσει type**:

```typescript
const STANDALONE_UNIT_TYPES: PropertyType[] = ['detached_house', 'villa'];

function assertCreatePolicy(propertyData: Record<string, unknown>): void {
  if (isBlank(propertyData.name)) {
    throw new PropertyMutationPolicyError('Property name is required before creation.');
  }

  const type = propertyData.type as PropertyType;
  if (isBlank(type)) {
    throw new PropertyMutationPolicyError('Property type is required before creation.');
  }

  const isStandalone = STANDALONE_UNIT_TYPES.includes(type);

  // ADR-284: projectId is ALWAYS required (both families)
  if (isBlank(propertyData.projectId)) {
    throw new PropertyMutationPolicyError(
      'Project (projectId) is required — a unit cannot exist without a project.'
    );
  }

  if (isStandalone) {
    // Family B: Standalone (detached_house, villa) — NO building/floor required
    // Enforce nullability to prevent inconsistent state
    if (!isBlank(propertyData.buildingId) || !isBlank(propertyData.floorId)) {
      throw new PropertyMutationPolicyError(
        `Standalone units (${type}) cannot have buildingId/floorId — they connect directly to Project.`
      );
    }
  } else {
    // Family A: In-building (12 types) — buildingId + floorId required
    if (isBlank(propertyData.buildingId)) {
      throw new PropertyMutationPolicyError(
        `Building (buildingId) is required for type "${type}" — in-building units must belong to a building.`
      );
    }
    if (isBlank(propertyData.floorId)) {
      throw new PropertyMutationPolicyError(
        `Floor (floorId) is required for type "${type}" — in-building units must be placed on a floor.`
      );
    }
  }
}
```

**Νέα function `assertUpstreamChainExists()`** (async — fetches από Firestore, conditional):

```typescript
async function assertUpstreamChainExists(
  propertyData: Record<string, unknown>
): Promise<void> {
  const type = propertyData.type as PropertyType;
  const isStandalone = STANDALONE_UNIT_TYPES.includes(type);
  const projectId = propertyData.projectId as string;

  // Both families: Verify Project exists AND has linkedCompanyId (ADR-284 §2.2)
  const project = await fetchProject(projectId);
  if (!project) throw new PropertyMutationPolicyError('Project not found in Firestore.');
  if (isBlank(project.linkedCompanyId)) {
    throw new PropertyMutationPolicyError(
      'Project has no linked Company — every project must belong to a Company (ADR-284 supersedes ADR-232).'
    );
  }
  const company = await fetchCompany(project.linkedCompanyId);
  if (!company) {
    throw new PropertyMutationPolicyError('Linked Company not found — data integrity violation.');
  }

  if (isStandalone) {
    // Family B: Done — no building/floor chain to verify
    return;
  }

  // Family A: Verify Building + Floor chain
  const buildingId = propertyData.buildingId as string;
  const floorId = propertyData.floorId as string;

  const building = await fetchBuilding(buildingId);
  if (!building) throw new PropertyMutationPolicyError('Building not found.');
  if (building.projectId !== projectId) {
    throw new PropertyMutationPolicyError(
      'Building.projectId mismatch — building belongs to different project.'
    );
  }

  const floor = await fetchFloor(floorId);
  if (!floor) throw new PropertyMutationPolicyError('Floor not found.');
  if (floor.buildingId !== buildingId) {
    throw new PropertyMutationPolicyError(
      'Floor.buildingId mismatch — floor belongs to different building.'
    );
  }

  // ADR-284 §3.1.1: Multi-level units — per-level validation (ADR-236 integration)
  if (propertyData.isMultiLevel === true && Array.isArray(propertyData.levels)) {
    for (const level of propertyData.levels) {
      const levelFloorId = level.floorId as string;
      if (!levelFloorId) {
        throw new PropertyMutationPolicyError('Multi-level: every level must have floorId.');
      }
      const levelFloor = await fetchFloor(levelFloorId);
      if (!levelFloor) {
        throw new PropertyMutationPolicyError(`Multi-level: floor ${levelFloorId} not found.`);
      }
      if (levelFloor.buildingId !== buildingId) {
        throw new PropertyMutationPolicyError(
          `Multi-level: floor ${levelFloorId} belongs to different building — all levels must share the same Building.`
        );
      }
    }
  }
}
```

### 3.1.1 Multi-Level Validation Rule (ADR-236 integration)

**Κανόνας**: Όλα τα floors στο `levels[]` array **πρέπει να ανήκουν στο ίδιο Building** με το primary `floorId`.

**Παράδειγμα**:
- ✅ Μεζονέτα: Floor 1 + Floor 2 του **Κτιρίου Α** → valid
- ❌ Μεζονέτα: Floor 1 του Κτιρίου Α + Floor 2 του **Κτιρίου Β** → REJECTED (cross-building nonsense)

**Ισχύει**: Μόνο για Family A (in-building). Τα standalone units (detached_house, villa) δεν έχουν `isMultiLevel` meaningful use case (για διπλοκατοικίες χρησιμοποιούμε `detached_house` με internal `floor: 2` field).

**Cost**: N+1 extra Firestore reads (N = levels count, συνήθως 2-3). Αποδεκτό για data integrity.

**Integration point**: Καλείται στο `/src/app/api/properties/create/route.ts` **πριν** το `setDoc()`.

**Server-side auto-fill**: Για in-building units, το `projectId` γεμίζεται automatically από `Building.projectId` αν ο client δεν το στείλει (defense-in-depth).

---

### 3.2 Layer 2 — Client Form Validation (fast UX feedback)

**Στόχος**: Ο χρήστης βλέπει αμέσως τι λείπει, χωρίς round-trip.

**Αρχείο**: `src/components/properties/hooks/usePropertyForm.ts` (γραμμές 97-117)

**Conditional validation** (mirror του server logic):

```typescript
const STANDALONE_UNIT_TYPES: PropertyType[] = ['detached_house', 'villa'];

const validate = useCallback((): boolean => {
  const newErrors: Partial<Record<keyof PropertyFormData, string>> = {};

  if (!formData.name.trim()) {
    newErrors.name = t('dialog.addUnit.validation.nameRequired');
  }
  if (!formData.type) {
    newErrors.type = t('dialog.addUnit.validation.typeRequired');
  }
  // ADR-284: projectId always required
  if (!formData.projectId) {
    newErrors.projectId = t('dialog.addUnit.validation.projectRequired');
  }

  const isStandalone = STANDALONE_UNIT_TYPES.includes(formData.type);

  if (!isStandalone) {
    // Family A: In-building — building+floor required
    if (!formData.buildingId) {
      newErrors.buildingId = t('dialog.addUnit.validation.buildingRequired');
    }
    if (!formData.floorId) {
      newErrors.floorId = t('dialog.addUnit.validation.floorRequired');
    }
  }
  // Family B: No building/floor validation — UI hides these fields entirely

  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
}, [formData, t]);
```

**Αρχείο**: `src/components/properties/dialogs/AddPropertyDialog.tsx`

- **Type field**: πρώτο στη φόρμα (discriminator — καθορίζει τι εμφανίζεται μετά)
- **Project field**: πάντα visible, required
- **Building/Floor fields**: εμφανίζονται **ΜΟΝΟ** αν `!isStandaloneUnit(type)` (conditional rendering)
- **Disable** το "Αποθήκευση" button όσο λείπουν required fields (βάσει family)
- **Tooltip** στο disabled button:
  - Family A: *"Επίλεξε Έργο, Κτίριο & Όροφο για να συνεχίσεις"*
  - Family B: *"Επίλεξε Έργο για να συνεχίσεις"*

---

### 3.3 Layer 3 — Pre-Flight Checks & Empty State CTAs

**Στόχος**: Ο χρήστης ποτέ δεν φτάνει σε dead-end. Πάντα ξέρει τι πρέπει να κάνει.

**Αρχείο**: `src/components/properties/dialogs/AddPropertyDialog.tsx`

#### Case 0 — Δεν υπάρχουν Projects καθόλου (και για τα 2 families)

```
📁 Δεν υπάρχουν Έργα ακόμη.

Κάθε Μονάδα πρέπει να ανήκει σε Έργο.

[+ Δημιούργησε Έργο]
```

#### Family A Empty States (In-Building types)

**Case A1 — Δεν υπάρχουν Buildings στο επιλεγμένο Project**:

```
🏗️ Το Έργο "{projectName}" δεν έχει Κτίρια ακόμη.

Για τύπο "{type}" χρειάζεσαι: Έργο → Κτίριο → Όροφος

[+ Δημιούργησε Κτίριο στο Έργο]
```

**Case A2 — Building υπάρχει αλλά δεν έχει Floors**:

```
⚠️ Το Κτίριο "{buildingName}" δεν έχει ορόφους.

[+ Πρόσθεσε Όροφο στο Κτίριο]
```

**Case A3 — Orphan Building (χωρίς projectId)**: **Hard Block + Inline Fix Modal**

**Απόφαση (2026-04-04)**: Google pattern — blocking με zero context switching.

Integration του `usePropertyHierarchyValidation` στο `AddPropertyDialog`:

```
🔗 Το Κτίριο "{buildingName}" δεν είναι συνδεδεμένο με Έργο.

[Σύνδεσέ το τώρα ▼]  [Επίλεξε άλλο Κτίριο]
```

**Flow μετά από click "Σύνδεσέ το τώρα"**:

```
┌─────────────────────────────────────────┐
│  Σύνδεση Κτιρίου με Έργο                │
│                                         │
│  Κτίριο: "Κτίριο Α"                     │
│                                         │
│  Έργο *                                 │
│  [Select Project ▼]                     │
│                                         │
│           [Ακύρωση]  [Αποθήκευση]       │
└─────────────────────────────────────────┘
```

**Transaction logic** (server-side, atomic):
```typescript
async function linkBuildingToProject(
  buildingId: string,
  projectId: string,
  actorId: string
): Promise<void> {
  // 1. Verify Project exists
  // 2. Verify Building exists AND currently has null/undefined projectId
  // 3. Update building.projectId + audit log
  // 4. If any step fails, rollback
}
```

**Περιορισμός** (scope-limiting):
- Το inline modal **ΜΟΝΟ** αναθέτει `projectId` στο Building.
- **Δεν** επιτρέπει edit άλλων Building fields (permit number, square meters, coordinates).
- Για full Building edit → redirect στη σελίδα του Building (separate flow).

**Γιατί (γ) και όχι (α) redirect**:
- ✅ Ταιριάζει στην ελληνική construction reality (μικρομεσαίες εταιρείες, ίδιος χρήστης φτιάχνει Projects+Buildings+Units)
- ✅ Google pattern — zero navigation away
- ✅ Edge case only (αν εφαρμοστεί σωστά το ADR-284, ορφανά Buildings δεν θα υπάρχουν καν)
- ⚠️ Αν μελλοντικά γίνει enterprise με roles/compliance audit → migration σε (α) redirect

#### Family B Empty States (Standalone types)

**Case B1 — Τύπος standalone, φόρμα απλοποιείται**:

Όταν ο user επιλέγει `detached_house` ή `villa`:
```
🏡 Αυτοτελές Κτίσμα

Οι μονοκατοικίες/βίλες συνδέονται απευθείας με Έργο.
Δεν χρειάζονται Κτίριο ή Όροφο.
```

Τα fields Building/Floor **εξαφανίζονται** με smooth transition. Εμφανίζεται μόνο το Project selector.

#### Κοινό UX Pattern

Το **Type field** είναι πάντα **πρώτο** στη φόρμα — καθορίζει τη δομή των επόμενων fields (progressive disclosure).

#### CTA Strategy: HYBRID (Inline + Navigation) — απόφαση 2026-04-04

**Απλές οντότητες → Inline** (nested dialog, zero context loss):
- **Project creation** → Inline modal μέσα στο AddPropertyDialog (σχετικά απλή φόρμα)
- **Floor creation** → Inline modal (πολύ απλή: όνομα + level number)

**Σύνθετες οντότητες → Navigation**:
- **Building creation** → Redirect στο `AddBuildingDialog` (3 tabs: Basic, Details, Features — δεν χωράει σε nested modal)

**State preservation για navigation** (Building):
- Προτού redirect, σώζουμε το partial Unit form state σε **sessionStorage** (key: `unit-form-draft`).
- Μετά το successful Building creation, επιστροφή στο AddPropertyDialog με `buildingId` pre-selected.
- Αν ο χρήστης cancel-άρει, το draft παραμένει (auto-recovery on dialog reopen).

**Pattern summary**:

| Entity | CTA Pattern | Justification |
|--------|-------------|---------------|
| Project | **Inline** | Απλή φόρμα, βασικά fields |
| Floor | **Inline** | Πολύ απλή (όνομα + level) |
| Building | **Navigation** + sessionStorage | 3 tabs, πολύπλοκη φόρμα |
| Company | **Navigation** (out of scope Q8) | Full company form |

**Consistency tradeoff**: Ο χρήστης μαθαίνει 2 patterns — αποδεκτό γιατί ταιριάζει στην πραγματική πολυπλοκότητα κάθε entity (UX principle: form complexity dictates interaction pattern).

---

## 4. Εναλλακτικές που Απορρίφθηκαν

| Εναλλακτική | Γιατί ΟΧΙ |
|-------------|-----------|
| Allow orphan units με `status: 'draft'` | Data model pollution — οι draft orphan units γίνονται zombie data, δύσκολα να καθαριστούν |
| Validation ΜΟΝΟ σε Firestore rules | Το security model είναι υπό redesign (SECURITY_AUDIT_REPORT.md) — δεν μπορούμε να βασιστούμε σε rules προς το παρόν |
| Lazy validation στη στιγμή της πώλησης (`usePropertyHierarchyValidation` only) | **Πολύ αργά** — η Μονάδα έχει ήδη δημιουργηθεί ως orphan |
| Block μόνο στο client, όχι server | Direct API call μπορεί να κάνει bypass — enterprise απαγόρευση |

---

## 5. Συνέπειες

### 5.1 Θετικές

- ✅ **Data integrity guaranteed**: Καμία orphan Unit δεν μπορεί να δημιουργηθεί.
- ✅ **UX feedback μέσω empty states + CTAs**: Ο χρήστης ξέρει τι να κάνει.
- ✅ **Defense-in-depth**: 3 layers — αν ένα αποτύχει, τα άλλα πιάνουν.
- ✅ **Enterprise-grade**: Αντίστοιχο με Gmail/Drive/Calendar hierarchical patterns.
- ✅ **Reuses existing code**: `usePropertyHierarchyValidation` δεν γράφεται από την αρχή.

### 5.2 Breaking Changes & Data Strategy

**Development mode — clean slate approach** (decision 2026-04-04):

- Η εφαρμογή βρίσκεται σε **development**, ΟΧΙ production.
- Τα υπάρχοντα δεδομένα στο Firestore είναι **πρόχειρα/δοκιμαστικά** και θα διαγραφούν πριν το production cut-over.
- **Δεν χρειάζεται migration path** για legacy orphan units.
- **Δεν χρειάζεται backfill script** ή "ήπια" rules για υπάρχοντα documents.
- Οι νέοι κανόνες εφαρμόζονται **strict από την πρώτη μέρα** — σε creates ΚΑΙ updates.

**Επιπτώσεις**:
- ⚠️ Αν υπάρχουν orphan test units, τα **updates** τους θα αποτυγχάνουν μέχρι να διορθωθούν parent refs (αποδεκτό σε dev).
- ⚠️ Test data scripts / fixtures: αν δημιουργούν units χωρίς buildingId/floorId → update τους.

### 5.3 Production Cut-Over Note

Πριν το production release, ο Γιώργος θα κάνει:
1. Wipe των test data από το Firestore.
2. Recreate με σωστή hierarchy (Company → Project → Building → Floor → Unit).
3. Validation ότι όλα τα units έχουν valid upstream chain.

---

## 6. Implementation Phases

| Phase | Περιγραφή | Blocking? |
|-------|-----------|-----------|
| **Phase 1a** | Project server policy (Layer 0) — assertProjectCreatePolicy + linkedCompanyId required | CRITICAL |
| **Phase 1b** | Unit server policy (Layer 1) — discriminated validation + upstream chain (includes Company check) | CRITICAL |
| **Phase 2** | Client validation (Layer 2) — discriminated form validation | HIGH |
| **Phase 3a** | Empty state CTAs (Layer 3) | MEDIUM |
| **Phase 3b** | Inline fix modal για orphan Buildings (`linkBuildingToProject`) | MEDIUM |
| **Phase 3c** | Project form: Company field required + no-Companies empty state | MEDIUM |
| **Phase 4** | i18n keys (EN/EL) | με Phase 2+3 |
| **Phase 5** | Tests (unit + E2E) | με κάθε phase |

> **Σημείωση**: Δεν υπάρχει Phase 0 (orphan audit) — dev data, clean slate (βλ. §5.2).

---

## 7. i18n Keys (νέα)

```json
{
  "dialog.addUnit.validation.typeRequired": "Ο Τύπος Μονάδας είναι υποχρεωτικός",
  "dialog.addUnit.validation.projectRequired": "Το Έργο είναι υποχρεωτικό",
  "dialog.addUnit.validation.buildingRequired": "Το Κτίριο είναι υποχρεωτικό για αυτόν τον τύπο μονάδας",
  "dialog.addUnit.validation.floorRequired": "Ο Όροφος είναι υποχρεωτικός για αυτόν τον τύπο μονάδας",
  "dialog.addUnit.emptyState.noProjects.title": "Δεν υπάρχουν Έργα ακόμη",
  "dialog.addUnit.emptyState.noProjects.description": "Κάθε Μονάδα πρέπει να ανήκει σε Έργο",
  "dialog.addUnit.emptyState.noProjects.cta": "Δημιούργησε Έργο",
  "dialog.addUnit.emptyState.noBuildings.title": "Το Έργο δεν έχει Κτίρια ακόμη",
  "dialog.addUnit.emptyState.noBuildings.cta": "Δημιούργησε Κτίριο στο Έργο",
  "dialog.addUnit.emptyState.noFloors.title": "Το Κτίριο δεν έχει ορόφους",
  "dialog.addUnit.emptyState.noFloors.cta": "Πρόσθεσε Όροφο",
  "dialog.addUnit.emptyState.orphanBuilding.title": "Το Κτίριο δεν είναι συνδεδεμένο με Έργο",
  "dialog.addUnit.emptyState.orphanBuilding.cta.fixNow": "Σύνδεσέ το τώρα",
  "dialog.addUnit.emptyState.orphanBuilding.cta.pickOther": "Επίλεξε άλλο Κτίριο",
  "dialog.linkBuildingToProject.title": "Σύνδεση Κτιρίου με Έργο",
  "dialog.linkBuildingToProject.buildingLabel": "Κτίριο",
  "dialog.linkBuildingToProject.projectLabel": "Έργο",
  "dialog.linkBuildingToProject.save": "Αποθήκευση",
  "dialog.linkBuildingToProject.cancel": "Ακύρωση",
  "dialog.addUnit.standaloneInfo.title": "Αυτοτελές Κτίσμα",
  "dialog.addUnit.standaloneInfo.description": "Οι μονοκατοικίες/βίλες συνδέονται απευθείας με Έργο. Δεν χρειάζονται Κτίριο ή Όροφο.",
  "dialog.addUnit.saveButton.tooltip.disabled.familyA": "Επίλεξε Έργο, Κτίριο & Όροφο για να συνεχίσεις",
  "dialog.addUnit.saveButton.tooltip.disabled.familyB": "Επίλεξε Έργο για να συνεχίσεις"
}
```

---

## 8. Verification / Test Plan

### Unit Tests

**Family A (In-Building):**
- POST με type=`apartment`, χωρίς `buildingId` → **400**
- POST με type=`apartment`, `buildingId` που δεν υπάρχει → **400** (chain validation)
- POST με type=`apartment`, `building.projectId !== projectId` → **400** (mismatch)
- POST με type=`apartment`, `floor.buildingId !== buildingId` → **400** (mismatch)

**Family B (Standalone):**
- POST με type=`detached_house`, χωρίς `projectId` → **400**
- POST με type=`villa` + `buildingId` set → **400** (standalone cannot have building)
- POST με type=`detached_house`, valid projectId, no building/floor → **201 OK**

**Common:**
- POST χωρίς `type` → **400**
- POST χωρίς `projectId` → **400** (always required)
- POST με `projectId` που δείχνει σε Project **χωρίς** `linkedCompanyId` → **400** (ADR-284 §2.2)

**Project creation (NEW scope):**
- POST `/api/projects/create` χωρίς `linkedCompanyId` → **400**
- POST με `linkedCompanyId` που δεν υπάρχει → **400**

**Multi-level (ADR-236 integration):**
- POST με `isMultiLevel: true`, levels[].floorId αλλά `levelFloor.buildingId !== primaryBuildingId` → **400** (cross-building nonsense)
- POST με `isMultiLevel: true`, `levels[]` κενό array → **400** (ADR-236: at least 2 floors)
- POST με `isMultiLevel: true`, valid levels in same building → **201 OK**

### E2E Manual

- Dialog με **zero buildings** → Empty state CTA εμφανίζεται
- Επιλογή building **χωρίς floors** → Empty state CTA εμφανίζεται
- Save **χωρίς floor** → Button disabled + tooltip

### Regression

- **Sales dialogs** συνεχίζουν να δουλεύουν (ίδιο hook `usePropertyHierarchyValidation`)
- **Υπάρχουσες units** φορτώνονται κανονικά (read path)

### TypeScript

- `npx tsc --noEmit` (background, μετά το commit)

---

## 9. Critical Files Reference

| Αρχείο | Ρόλος |
|--------|-------|
| `src/types/property.ts:319-487` | Types (ήδη σωστοί) |
| `src/services/property/property-mutation-gateway.ts:141` | **Layer 1** — Server policy |
| `src/app/api/properties/create/route.ts:70-89` | **Layer 1** — Upstream chain check |
| `src/components/properties/hooks/usePropertyForm.ts:97-117` | **Layer 2** — Client validation |
| `src/components/properties/dialogs/AddPropertyDialog.tsx:155-204` | **Layer 2+3** — UI required + empty states |
| `src/components/properties/dialogs/useAddPropertyDialogState.ts` | State hook για cascading |
| `src/hooks/sales/usePropertyHierarchyValidation.ts` | **REUSE** — Upstream chain validation hook |
| `src/services/firestore/firestore-query.service.ts` | Reuse `subscribeDoc` pattern |
| `src/i18n/locales/{en,el}/*.json` | i18n keys |

---

## 9.1 Prerequisites Verification (Gap Analysis, 2026-04-04)

**Γιατί**: Verify-upfront practice (Google design review + AEC preconstruction planning). Γραπτώς, πριν την υλοποίηση.

### Existing Components (✅ READY)

| Component | Path | Notes |
|-----------|------|-------|
| `AddProjectDialog` | `src/components/projects/dialogs/AddProjectDialog.tsx` | 2-tab form, **Company dropdown already required** (`companyId` field) |
| `AddBuildingDialog` | `src/components/building-management/dialogs/AddBuildingDialog.tsx` | 3-tab form, edit mode (`editBuilding` prop), company filter |
| Project API | `src/app/api/projects/route.ts` | POST/GET/PUT endpoints |
| Building API | `src/app/api/buildings/route.ts` | POST/GET/PUT endpoints |
| Floors API handler | `src/app/api/floors/route.ts` | `handleCreateFloor()` exists |
| Buildings page | `src/app/buildings/page.tsx` | Main listing/management page |

### MISSING Components (❌ PREREQUISITE PHASES)

| Gap | Impact | New Prerequisite |
|-----|--------|------------------|
| **No `AddFloorDialog`** — only inline string input in StorageTab | CTA "+ Πρόσθεσε Όροφο στο Κτίριο" (Case A2) δεν έχει dialog | **Prerequisite P1**: Δημιουργία `AddFloorDialog` component |
| **`AddBuildingDialog` δεν έχει `projectId` selector field** — έχει μόνο company filter | Building.projectId required (ADR-284 §2.2) — πρέπει να ρωτάει στο UI | **Prerequisite P2**: Επέκταση `AddBuildingDialog` με Project selector (required field) |

### ⚠️ Semantic Clarification: `companyId` vs `linkedCompanyId`

Στον υπάρχοντα κώδικα υπάρχουν **δύο distinct fields**:

| Field | Semantic | Source | Mutability |
|-------|----------|--------|------------|
| `companyId` | **Tenant/owner** — ποια εταιρεία/οργάνωση έχει αυτό το record | System-assigned | Immutable |
| `linkedCompanyId` | **Business link** — με ποια Company συνδέεται (per ADR-232) | User-assigned | Mutable |

**Απόφαση για ADR-284**:
- Το ADR-284 αναφέρεται στο **`linkedCompanyId`** (business link).
- Το `companyId` (tenant) είναι out-of-scope — σύστημα-επίπεδο field.
- Project form έχει ήδη company dropdown (για `companyId` tenant) — πιθανώς χρειάζεται **δεύτερο** dropdown για `linkedCompanyId` (business link) ή ενοποίηση αν σημασιολογικά είναι το ίδιο.
- **Action item για Phase 3c**: Ο implementation agent πρέπει να verify στο `AddProjectDialog` αν το field "Company" είναι `companyId` ή `linkedCompanyId`, και να προσαρμόσει ανάλογα.

---

## 10. Execution Strategy (Context-Safe Implementation)

**Απόφαση Γιώργου (2026-04-04)**: FULL implementation (όλες οι phases). Κάθε phase σε καθαρό context (`/clear` μεταξύ phases).

### Principle: ADR-as-SSoT

Αυτό το ADR είναι **πλήρως αυτόνομο**. Κάθε επόμενος agent μπορεί:
1. Να κάνει `/clear`
2. Να λάβει εντολή *"Υλοποίησε Phase X από ADR-284"*
3. Να διαβάσει ΜΟΝΟ αυτό το ADR + τα files της phase (listed below)
4. Να εκτελέσει χωρίς να χρειάζεται την προηγούμενη συνομιλία

### Phase Execution Batches

| Batch | Phases | Files | Complexity | Suggested Context |
|-------|--------|-------|------------|-------------------|
| **Batch 0** | **Prerequisites P1 (AddFloorDialog) + P2 (AddBuildingDialog projectId field)** | 3-4 files | Medium | Fresh context |
| **Batch 1** | 1a (Project policy) | 2-3 files | Low | Fresh context |
| **Batch 2** | 1b (Unit policy + chain validation) | 3-4 files | Medium | Fresh context |
| **Batch 3** | 2 (Client form validation, discriminated) | 2-3 files | Medium | Fresh context |
| **Batch 4** | 3a (Empty state CTAs) + 3c (Project form Company field — verify companyId vs linkedCompanyId) | 3-4 files | Medium | Fresh context |
| **Batch 5** | 3b (Inline fix modal `linkBuildingToProject`) | 3-5 files | High | Fresh context |
| **Batch 6** | 4 (i18n EN/EL) + 5 (tests) | 2-3 + test files | Low | Fresh context |

**Μεταξύ batches**: `/clear` + εντολή *"Υλοποίησε Batch N από ADR-284"*.

### Handoff Template (για κάθε batch)

Ο επόμενος agent θα λαμβάνει εντολή της μορφής:
> "Διάβασε το `adrs/ADR-284-unit-creation-hierarchy-enforcement.md`. Υλοποίησε **Batch N**: [phases list]. Ακολούθησε τις εντολές του ADR. Commit μετά από κάθε batch. ΜΗΝ κάνεις push."

### Dependencies (Execution Order)

```
Batch 0 (Prerequisites: AddFloorDialog + AddBuildingDialog projectId) ─→ Batch 1 (Project policy)
                                                                           │
                                                                           ├─→ Batch 2 (Unit policy — depends on Project having linkedCompanyId)
                                                                           │
Batch 2 ───────────────────────────────────────────────────────────────────┴─→ Batch 3 (Client mirrors server)
                                                                               │
                                                                               ├─→ Batch 4 (Empty states build on client validation + Batch 0 dialogs)
                                                                               │
                                                                               └─→ Batch 5 (Inline fix modal)
                                                                                   │
                                                                                   └─→ Batch 6 (i18n + tests for all above)
```

**Κανόνας**: Δεν ξεκινάμε επόμενο batch αν δεν έχει ολοκληρωθεί και γίνει commit το προηγούμενο.

### Acceptance Criteria per Batch

**Batch 0 Acceptance** (Prerequisites): ✅ **COMPLETED 2026-04-04**
- ✅ `AddFloorDialog` component υπάρχει, accepts `buildingId` prop, creates floor via `/api/floors/route.ts`
  - File: `src/components/building-management/dialogs/AddFloorDialog.tsx`
  - Fields: `name` (required), `level` (required, range -5..100)
  - Uses `createFloorWithPolicy` service + toast notifications
  - Handles 409 duplicate floor level error
- ✅ `AddBuildingDialog` έχει required `projectId` selector field (δίπλα στον existing company filter)
  - Validation: `projectRequired` error in `useBuildingForm.validate()`
  - UI: `required` marker + `border-destructive` on error + error message display
- ✅ Both dialogs match existing UI patterns (Radix Select per ADR-001)
- ✅ TypeScript compiles (exit 0, no errors in modified files)
- ✅ i18n keys added to EN + EL (`dialog.validation.projectRequired` + full `dialog.addFloor.*` namespace)

**Batch 1 Acceptance**: ✅ **COMPLETED 2026-04-04**
- ✅ `assertProjectCreatePolicy()` υπάρχει και rejects χωρίς linkedCompanyId
  - File: `src/services/projects/project-mutation-policy.ts` (NEW, ~90 lines)
  - Exports: `ProjectMutationPolicyError`, `assertProjectCreatePolicy`, `assertLinkedCompanyExists`
- ✅ Server-side enforcement in POST `/api/projects/list`
  - Policy called BEFORE Firestore writes
  - `ProjectMutationPolicyError` → `ApiError(400)` (maps to 400 Bad Request)
  - Verifies linkedCompanyId points to existing contact with `type === 'company'`
- ✅ TypeScript compiles (exit 0 on modified files)
- ⏸️ Unit test pending (will be added in Batch 6 per execution strategy)

**Batch 2 Acceptance**: ✅ **COMPLETED 2026-04-04**
- ✅ `assertPropertyCreatePolicy()` discriminated βάσει type (Family A vs Family B)
- ✅ `assertUpstreamChainExists()` verifies full chain (Company + Project + Building + Floor + multi-level)
- ✅ Server-side integration στο `/api/properties/create` POST (policy calls πριν το `createEntity()`)
- ✅ `PropertyCreationPolicyError` → `ApiError(400)` mapping
- ✅ `resolveProjectIdFromBuilding()` defense-in-depth auto-fill
- ⏸️ Unit tests pending (will be added in Batch 6 per execution strategy)
- ✅ TypeScript compiles (0 errors στα νέα/τροποποιημένα αρχεία)

**Batch 3 Acceptance**:
- `usePropertyForm.validate()` discriminated βάσει type
- Save button disabled όσο λείπουν required fields
- Tooltip εμφανίζεται
- TypeScript compiles

**Batch 4 Acceptance**:
- Empty state CTAs εμφανίζονται σωστά (no Projects, no Buildings, no Floors)
- Project form έχει Company required field
- TypeScript compiles

**Batch 5 Acceptance**:
- Inline modal `linkBuildingToProject` δουλεύει
- Transaction atomic (rollback on failure)
- TypeScript compiles

**Batch 6 Acceptance**:
- Όλα τα i18n keys υπάρχουν σε EN + EL
- Tests pass
- TypeScript compiles, 0 errors στο scope των αλλαγών

---

## 11. Changelog

- **2026-04-04**: PROPOSED (initial document) — Claude + Γιώργος Παγώνης
- **2026-04-04**: Απάντηση Γιώργου σε Q1 — dev data, clean slate. Αφαιρέθηκε Phase 0 (audit) & migration path. Strict rules από την αρχή.
- **2026-04-04**: Απάντηση Γιώργου σε Q2 — **Discriminated hierarchy βάσει type**. 2 families: In-Building (12 τύποι, require building+floor) + Standalone (detached_house, villa — direct to project). Μεζονέτα = in-building. Schema change: νέο `projectId` field στο Property.
- **2026-04-04**: Απάντηση Γιώργου σε Q3 — **Hard block + Inline fix modal** για orphan Buildings. Google pattern, zero context switching. Scope-limited: το inline modal αναθέτει ΜΟΝΟ `projectId` στο Building (όχι full edit). Νέο `linkBuildingToProject` transaction endpoint.
- **2026-04-04**: Απάντηση Γιώργου σε Q4 — **linkedCompanyId REQUIRED** στο Project. ⚠️ SUPERSEDES ADR-232. Πλήρης 5-level hierarchy (Company → Project → Building → Floor → Unit). Scope επεκτάθηκε: νέο Layer 0 (Project creation policy), νέα Phase 3c.
- **2026-04-04**: Απάντηση Γιώργου σε Q5 — **PER-LEVEL validation** για multi-level units. Κάθε floor στο `levels[]` πρέπει να ανήκει στο ίδιο Building. Νέα §3.1.1 Multi-Level Validation Rule (ADR-236 integration).
- **2026-04-04**: Απάντηση Γιώργου σε Q6 — **FULL implementation** (όλες οι phases). Context-safe execution: κάθε batch σε καθαρό context με `/clear` μεταξύ. Προστέθηκε §10 Execution Strategy με 6 batches, dependencies, acceptance criteria.
- **2026-04-04**: Απάντηση Γιώργου σε Q7 — **VERIFY NOW**. Gap analysis εκτελέστηκε. Ευρήματα: `AddProjectDialog` + `AddBuildingDialog` EXIST. **GAPS**: (1) `AddFloorDialog` MISSING, (2) `AddBuildingDialog` δεν έχει projectId selector. Προστέθηκε **Batch 0 Prerequisites** + §9.1 Gap Analysis με semantic clarification `companyId` vs `linkedCompanyId`.
- **2026-04-04**: Απάντηση Γιώργου σε Q8 — **HYBRID CTA strategy**. Inline για Project + Floor (απλές φόρμες). Navigation για Building (3 tabs, σύνθετη). State preservation via sessionStorage για partial Unit form κατά το Building navigation.
- **2026-04-04**: **Q&A COMPLETE** — Όλες οι 8 αρχικές ερωτήσεις απαντήθηκαν. Το ADR είναι πλήρες και αυτόνομο. Status: **PROPOSED → READY FOR IMPLEMENTATION** pending final review.
- **2026-04-04**: **Batch 0 IMPLEMENTED** — P1 `AddFloorDialog` (new, 225 lines), P2 `AddBuildingDialog.projectId` required (validation + UI). 4 files touched: `AddFloorDialog.tsx` (new), `useBuildingForm.ts`, `AddBuildingDialogTabs.tsx`, `el/en building.json`. TypeScript 0 errors. Ready for Batch 1.
- **2026-04-04**: **Batch 1 IMPLEMENTED** — Layer 0 Project Creation Policy. New module `project-mutation-policy.ts` (ProjectMutationPolicyError + assertProjectCreatePolicy + assertLinkedCompanyExists). POST `/api/projects/list` enforces policy server-side → 400 on missing/invalid linkedCompanyId. Companies resolved from CONTACTS collection (type='company'). TypeScript 0 errors. Ready for Batch 2.
- **2026-04-04**: **Batch 2 IMPLEMENTED** — Layer 1 Server-Side Unit Creation Policy. New server-only module `src/services/property/property-creation-policy.ts` (PropertyCreationPolicyError + STANDALONE_UNIT_TYPES + assertPropertyCreatePolicy + assertUpstreamChainExists + resolveProjectIdFromBuilding). Discriminated validation βάσει type (Family A in-building vs Family B standalone: detached_house, villa). Async upstream chain check: Project→Company (both families), Building→Project + Floor→Building + per-level validation για multi-level (Family A only, §3.1.1). POST `/api/properties/create` enforces policy server-side πριν `createEntity()` → 400 on violation. Defense-in-depth auto-fill `projectId` από `Building.projectId` για Family A. TypeScript 0 errors. Ready for Batch 3.
