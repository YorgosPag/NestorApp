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

### 3.0.5 Layer 0.5 — Building Creation Policy (NEW — Gap Discovery 2026-04-04)

**Στόχος**: Fix στο Building layer — ΚΑΝΕΝΑ Building χωρίς `projectId`. Κλείνει το security/integrity gap που αποκαλύφθηκε μετά το Batch 3 (βλ. §9.2 Gap Discovery).

**Αρχεία**:
- NEW: `src/services/building/building-creation-policy.ts` (server-only)
- MOD: `src/app/api/buildings/route.ts` (POST handler — enforce policy)

**Server Policy**:

```typescript
// src/services/building/building-creation-policy.ts (server-only)
export class BuildingCreationPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BuildingCreationPolicyError';
  }
}

export function assertBuildingCreatePolicy(data: Record<string, unknown>): void {
  if (isBlank(data.name)) {
    throw new BuildingCreationPolicyError('Building name is required.');
  }
  // ADR-284: projectId REQUIRED (every building must belong to a project)
  if (isBlank(data.projectId)) {
    throw new BuildingCreationPolicyError(
      'Project (projectId) is required — every building must belong to a project.'
    );
  }
}

export async function assertBuildingUpstreamChain(
  db: FirebaseFirestore.Firestore,
  data: { projectId: string }
): Promise<void> {
  // Verify Project exists
  const project = await db.collection(COLLECTIONS.PROJECTS).doc(data.projectId).get();
  if (!project.exists) {
    throw new BuildingCreationPolicyError('Referenced Project not found.');
  }
  // Verify Project has linkedCompanyId (5-level chain integrity)
  const linkedCompanyId = project.data()?.linkedCompanyId;
  if (isBlank(linkedCompanyId)) {
    throw new BuildingCreationPolicyError(
      'Referenced Project is orphan (no linkedCompanyId). Fix Project first.'
    );
  }
}
```

**Integration point**: `/api/buildings` POST, **πριν** το `createEntity()` call.

**Error mapping**: `BuildingCreationPolicyError` → `ApiError(400 Bad Request)`.

**Defense-in-depth rationale**:
- Server enforcement is the **only** security boundary — UI validation can be bypassed (browser devtools, direct API calls, import scripts).
- Mirror του pattern από Batch 1 (Project policy) + Batch 2 (Property policy) — identical contract, identical error mapping.
- Closes the gap που παρακάμπτεται από το inline "Fill then Create" flow (βλ. §9.2).

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

## 9.2 Gap Discovery — Building Layer Bypass (2026-04-04, μετά Batch 3)

**Ανακαλύφθηκε από production testing**: Ο Γιώργος δημιούργησε κτίριο ("κτίριο Δέλτα") χωρίς `projectId`. **Saved κανονικά, zero warnings.** Το enforcement του ADR-284 παρακάμφθηκε εντελώς.

### Root Cause: 2 Παράλληλα UI Paths για Building Creation (❌ ΟΧΙ SSoT)

| # | Path | Αρχείο | Client Validation | Server Validation |
|---|------|--------|-------------------|-------------------|
| **#1** | **Dialog** | `src/components/building-management/dialogs/add-building-dialog/` + `useBuildingForm.ts` | ✅ projectId required (Batch 0) | ❌ ΛΕΙΠΕΙ |
| **#2** | **Inline "Fill then Create"** | `src/components/building-management/BuildingsPageContent.tsx:91-115` (Salesforce temp-row pattern `__new__`) | ❌ ΚΑΜΙΑ | ❌ ΛΕΙΠΕΙ |

**Path που τρέχει κανονικά στο production**: #2 (Inline). Το κουμπί "Νέο Κτίριο" ανοίγει temp row, όχι dialog. Το Path #1 (AddBuildingDialog) είναι πιθανώς orphan/dead code — **verification pending**.

### Server Gap

- `/api/buildings` POST route **ΔΕΝ** έχει policy enforcement.
- Σε αντίθεση με:
  - `/api/projects/list` POST → `assertProjectCreatePolicy()` (Batch 1) ✅
  - `/api/properties/create` POST → `assertPropertyCreatePolicy()` (Batch 2) ✅
- Αποτέλεσμα: **Οποιοσδήποτε client** (Postman, curl, import script, inline UI, dialog UI) μπορεί να στείλει Building χωρίς `projectId`.

### Impact Assessment

| Layer | Status πριν το fix |
|---|---|
| Layer 0 (Project policy) | ✅ Υλοποιήθηκε (Batch 1) |
| **Layer 0.5 (Building policy server)** | ❌ **ΛΕΙΠΕΙ** |
| Layer 1 (Property policy server) | ✅ Υλοποιήθηκε (Batch 2) |
| Layer 2 (Property client validation) | ✅ Υλοποιήθηκε (Batch 3) |
| UI — AddBuildingDialog client | ✅ Required projectId (Batch 0) |
| **UI — Inline "Fill then Create"** | ❌ **ΚΑΝΕΝΑΣ ΕΛΕΓΧΟΣ** |
| SSoT για building creation | ❌ 2 παράλληλα paths |

### Orphan Data

Το κτίριο Δέλτα ήδη υπάρχει στο Firestore χωρίς `projectId`. **Migration required** (post-fix) για:
1. Εντοπισμό όλων των orphan buildings (`where projectId is null/empty`)
2. Admin dashboard tile: "X buildings without projectId — fix now"
3. Επιλογή: auto-assign σε default "unassigned" project, ή block τις downstream operations μέχρι να γίνει manual fix.

### Fix Strategy (Google Playbook — Server First)

**Φιλοσοφία**: Server enforcement κλείνει το security gap **ανεξάρτητα** από UI cleanup. Multiple UI paths είναι OK αν όλα περνούν από το ίδιο validated server endpoint.

**Προτεινόμενη σειρά** (βλ. Batches 3.5a + 3.5b στο §10):
1. **Batch 3.5a — Server Policy FIRST**: `building-creation-policy.ts` + `/api/buildings` POST enforcement → 400 αν λείπει projectId. Κλείνει το hole **immediately**. (~3 αρχεία)
2. **Batch 3.5b — Inline UI Validation**: `BuildingsPageContent.tsx` inline flow → require projectId + disabled save + tooltip (Google Docs draft pattern). (~2-3 αρχεία)
3. **Post-hoc**: Dead code audit (AddBuildingDialog usage?), SSoT consolidation via shared service, orphan migration. **Tech debt, όχι blocker.**

### Critical Files για επόμενο context

**Server-side (Batch 3.5a)**:
- `src/app/api/buildings/route.ts` — POST handler (current: no policy)
- `src/services/building/building-mutation-gateway.ts` — existing gateway για dialog path
- `src/services/property/property-creation-policy.ts` — **PATTERN TO MIRROR** (Batch 2)
- `src/services/projects/project-mutation-policy.ts` — **PATTERN TO MIRROR** (Batch 1)

**Client-side (Batch 3.5b)**:
- `src/components/building-management/BuildingsPageContent.tsx:91-115` — inline temp-row flow
- `src/components/building-management/hooks/useBuildingForm.ts` — existing validation (reuse logic)

**Verification commands (για επόμενο agent)**:
```bash
# Verify actual production path:
grep -rn "POST.*buildings" src/app/api/buildings/
grep -rn "AddBuildingDialog" src/  # dead code check
grep -rn "__new__" src/components/building-management/  # inline flow
```

---

## 9.3 Gap Discovery — Property Layer Bypass (2026-04-04, μετά Batch 5)

**Ανακαλύφθηκε από production testing**: Ο Γιώργος προσπάθησε να testάρει Batch 3+4+5 μέσω της σελίδας `/properties`, αλλά η σελίδα χρησιμοποιεί **inline temp-row flow** αντί για το `AddPropertyDialog`. Οι ADR-284 integrations (discriminated validation, empty states, orphan fix modal) **ΔΕΝ** έχουν εφαρμοστεί εκεί.

### Root Cause: 2 Παράλληλα UI Paths για Property Creation (❌ ΟΧΙ SSoT)

| # | Path | Αρχείο | Client Validation (Batch 3) | Empty States (Batch 4) | Orphan Fix Modal (Batch 5) | Server Validation |
|---|------|--------|------------------------------|------------------------|----------------------------|-------------------|
| **#1** | **Dialog** (ContactDetails) | `src/components/properties/dialogs/AddPropertyDialog.tsx` + `usePropertyForm.ts` + `useAddPropertyDialogState.ts` | ✅ (Batch 3) | ✅ (Batch 4) | ✅ (Batch 5) | ✅ (Batch 2) |
| **#2** | **Inline "Temp Row"** (`/properties`) | `src/components/properties/UnitsPageContent.tsx` + inline temp-row pattern | ❌ ΛΕΙΠΕΙ | ❌ ΛΕΙΠΕΙ | ❌ ΛΕΙΠΕΙ | ✅ (Batch 2) |

**Αντανάκλαση §9.2**: Το ίδιο exact pattern gap με το Buildings (dialog vs inline). Η εφαρμογή έχει consistent anti-pattern: 2 παράλληλα UI paths χωρίς SSoT για κάθε entity creation.

### Impact Assessment

| Layer | Status |
|-------|--------|
| Server policy (Layer 1, Batch 2) | ✅ Προστατεύει — bypass requests απορρίπτονται με 400 |
| **UX για inline path (Batch 3+4+5)** | ❌ **ΛΕΙΠΕΙ** — users βλέπουν generic errors μετά από failed save αντί για discriminated UI, empty state CTAs, orphan detection |
| SSoT για property creation UI | ❌ 2 παράλληλα paths, δική τους form state logic |

**Security boundary is intact** — οποιοδήποτε client (dialog, inline, Postman) που στείλει invalid Property θα πάρει 400 από τον server.

### Fix Strategy (Google Playbook — UX Consolidation)

**Φιλοσοφία**: Server enforcement είναι intact. UX parity είναι tech debt που κλείνει σε χωριστό batch για να μη μεγαλώσει το scope του τρέχοντος work.

**Προτεινόμενη σειρά**:
1. **Post-Batch 5 (tech debt)**: Batch 7 — Inline Property creation UI parity:
   - Προσθήκη discriminated validation (Family A vs Family B) στο inline form
   - Empty state CTAs (no Projects / no Buildings / no Floors / orphan Building)
   - Orphan fix modal integration
2. **Long-term**: SSoT consolidation via shared hook (`usePropertyFormValidation`) που χρησιμοποιείται και από τα 2 paths — ή ενοποίηση σε ένα component.

### Critical Files για επόμενο context

**Client-side (Batch 7 candidate)**:
- `src/components/properties/UnitsPageContent.tsx` — inline temp-row flow (entry point)
- `src/components/building-management/tabs/PropertyInlineCreateForm.tsx` — alternative inline form (per-building tab)
- `src/components/properties/hooks/usePropertyForm.ts` — **REUSE** — has discriminated logic from Batch 3

**Verification commands**:
```bash
grep -rn "PropertyInlineCreateForm\|UnitsPageContent" src/components/properties/
grep -rn "setIsCreatingNewUnit" src/components/properties/UnitsPageContent.tsx
```

### Orphan Data

Προς το παρόν **0 known orphan Properties** (server enforcement protects since Batch 2). Αν βρεθούν παλιά test data → ίδιο pattern με §9.2 (admin dashboard tile + manual cleanup).

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
| **🚨 Batch 3.5a** | **Layer 0.5 — Building server policy (Gap Discovery §9.2)** | 3 files | Low-Medium | **Fresh context (PRIORITY)** |
| **🚨 Batch 3.5b** | **Inline Building creation UI validation (`BuildingsPageContent.tsx`)** | 2-3 files | Medium | Fresh context |
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
                          ┌────────────────────────────────────────────────────┤
                          │                                                    │
                          ▼ [GAP DISCOVERY 2026-04-04, §9.2]                    │
           🚨 Batch 3.5a (Building server policy — SECURITY)                    │
                          │                                                    │
                          └─→ 🚨 Batch 3.5b (Inline UI validation)              │
                                              │                                │
                                              ▼                                │
                                              Batch 4 (Empty states) ◄─────────┘
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

**Batch 3 Acceptance**: ✅ **COMPLETED 2026-04-04**
- ✅ `usePropertyForm.validate()` discriminated βάσει type (Family A vs Family B)
  - File: `src/components/properties/hooks/usePropertyForm.ts`
  - Exports: `STANDALONE_UNIT_TYPES`, `isStandaloneUnitType()`
  - Adds `projectId` to `PropertyFormData` + `INITIAL_FORM_DATA`
  - Discriminated validation: `nameRequired`, `typeRequired`, `projectRequired` (both families); `buildingRequired` + `floorRequired` (Family A); `standaloneNoBuilding` (Family B)
  - Derived `isValid` memo (silent — for Save button disabled state)
  - `handleSubmit` sends `projectId` + omits `buildingId/floorId` for Family B
- ✅ Save button disabled όσο λείπουν required fields (via `isValid`)
- ✅ Tooltip εμφανίζεται με family-specific message (`inBuildingRequired` / `standaloneRequired`)
- ✅ AddPropertyDialog UI updated:
  - File: `src/components/properties/dialogs/AddPropertyDialog.tsx`
  - Project selector (Radix Select per ADR-001) — required, always visible
  - Building/Floor fields conditionally hidden for standalone units
  - Type field marked required + error display
  - SaveButton wrapped in Tooltip when disabled
- ✅ Dialog state hook loads projects + handles type change:
  - File: `src/components/properties/dialogs/useAddPropertyDialogState.ts`
  - `getProjectsList()` on dialog open
  - `handleTypeChange()` auto-clears building/floor when switching to standalone
  - Exposes `isStandalone`, `projects`, `projectsLoading`
- ✅ i18n keys added to EL + EN (`dialog.addUnit.validation.*`, `dialog.addUnit.fields.project`, `dialog.addUnit.placeholders.project`, `dialog.addUnit.tooltips.*`)
- ✅ TypeScript compiles (0 errors στα τροποποιημένα αρχεία)
- ⏸️ NO COMMIT (per Γιώργος instruction — commits for Batches 3+4+5+6 will happen together at the end)

**🚨 Batch 3.5a Acceptance** (Building Server Policy — Gap Discovery §9.2):
- [x] NEW `src/services/building/building-creation-policy.ts` (server-only) δημιουργήθηκε:
  - [x] `BuildingCreationPolicyError` class exported
  - [x] `assertBuildingCreatePolicy(data)` — sync validation: name required, projectId required
  - [x] `assertBuildingUpstreamChain(db, data)` — async: Project exists + has linkedCompanyId
  - [x] Mirror του pattern από `src/services/property/property-creation-policy.ts` (Batch 2)
  - [x] Mirror του pattern από `src/services/projects/project-mutation-policy.ts` (Batch 1)
- [x] `/api/buildings` POST route enforces policy **πριν** το `createEntity()`:
  - [x] `assertBuildingCreatePolicy(body)` call
  - [x] `assertBuildingUpstreamChain(db, body)` call (async)
  - [x] `BuildingCreationPolicyError` → `ApiError(400 Bad Request)` mapping
- [x] TypeScript compiles (0 errors στα νέα/τροποποιημένα αρχεία)
- [ ] Manual verification: POST στο `/api/buildings` χωρίς `projectId` → 400 response (pending Γιώργος)
- [ ] Manual verification: POST στο `/api/buildings` με invalid `projectId` → 400 response (pending Γιώργος)
- [ ] Manual verification: POST στο `/api/buildings` με valid `projectId` (που έχει `linkedCompanyId`) → 201 Created (pending Γιώργος)
- ⏸️ NO COMMIT (join με τα υπόλοιπα batches)

**🚨 Batch 3.5b Acceptance** (Inline Building UI Validation):
- [x] `BuildingsPageContent.tsx` inline "Fill then Create" flow:
  - [x] Temp row δέχεται `projectId` field (Radix Select per ADR-001) — **ήδη υπήρχε** via `EntityLinkCard` στο `GeneralTabContent`
  - [x] Save action blocked αν λείπει `projectId` ή `name` (client-side pre-flight) — enforced στο `handleSave()` σε create mode
  - [x] Tooltip/message εμφανίζεται όταν Save blocked: "Επίλεξε Έργο για να συνεχίσεις" — **error banner pattern** (Google Docs draft) via `saveError` state
  - [x] Google Docs draft pattern: temp row σε "draft" state μέχρι να γίνει valid — error surfaces μετά από failed save attempt
- [x] Inline flow καλεί το ίδιο `createBuildingWithPolicy()` gateway (SSoT via API) — ήδη καλύπτεται
- [x] Server errors από το Batch 3.5a displayed ως saveError banner (ίδιο channel με client errors)
- [x] i18n keys added στο EL + EN: `building.validation.projectRequired`
- [x] TypeScript compiles (0 errors στα τροποποιημένα αρχεία)
- [x] Projectid error auto-clears όταν ο χρήστης επιλέξει Έργο via `EntityLinkCard` (useEffect watch linkedId)
- [ ] Manual verification: Inline create χωρίς projectId → blocked με error banner (pending Γιώργος)
- [ ] Manual verification: Inline create με projectId → saved + appears in list (pending Γιώργος)
- ⏸️ NO COMMIT (join με τα υπόλοιπα batches)

**Batch 4 Acceptance**:
- [x] Empty state CTAs εμφανίζονται σωστά (no Projects, no Buildings, no Floors) — `AddPropertyDialog` renders 3 inline empty-state sections με CTAs
- [x] Project form έχει Company required field — AddProjectDialog ήδη είχε Company dropdown; fixed critical bug: `useProjectForm.handleSubmit` τώρα στέλνει `linkedCompanyId` (server policy απαιτούσε το, φόρμα δεν το έστελνε → 400)
- [x] TypeScript compiles (0 errors στα 5 τροποποιημένα αρχεία)
- [x] HYBRID CTA strategy (ADR §3.3): **Inline nested dialogs** για Project (`NestedAddProjectDialog`) + Floor (`AddFloorDialog`); **Navigation redirect** για Building (`/buildings?projectId=...`)
- [x] Filter buildings by `projectId` στο Building dropdown (prevents cross-project selection)
- [x] i18n keys added σε EL + EN: `dialog.addUnit.emptyState.{noProjects,noBuildings,noFloors}.*`
- [x] `reloadProjects()` callback καλείται μετά από inline Project creation → dropdown refresh
- ⏸️ NO COMMIT (join με τα υπόλοιπα batches)

**Batch 5 Acceptance**: ✅ **COMPLETED 2026-04-04**
- ✅ New API endpoint `POST /api/buildings/[buildingId]/link-project` — atomic Firestore `runTransaction`:
  - File: `src/app/api/buildings/[buildingId]/link-project/route.ts` (NEW)
  - Step 1: verifies Project exists + has `linkedCompanyId` (5-level chain integrity)
  - Step 2: verifies Building exists + tenant-isolation (403 if cross-company)
  - Step 3: scope guard — **rejects with 409** if Building already has a non-empty `projectId` (no cross-project reassignment here)
  - Step 4: atomic `tx.update({ projectId, updatedAt, updatedBy })`
  - Cascade + audit via existing `linkEntity('building:projectId', …)` (fire-and-forget) + `logAuditEvent`
  - Rate-limited via `withStandardRateLimit`, permission `buildings:buildings:update`
- ✅ API route added to `API_ROUTES.BUILDINGS.LINK_PROJECT` in `src/config/domain-constants.ts`
- ✅ New component `LinkBuildingToProjectDialog`:
  - File: `src/components/building-management/dialogs/LinkBuildingToProjectDialog.tsx` (NEW)
  - Read-only Building name + required Project selector (Radix Select per ADR-001)
  - Scope-limiting by design: assigns ONLY `projectId` (per ADR §3.3 constraint)
  - Uses centralized `apiClient.post` + `API_ROUTES.BUILDINGS.LINK_PROJECT(buildingId)`
  - Error surface: inline error below Select + toast; auto-clear on Project change
- ✅ `AddPropertyDialog` integration:
  - File: `src/components/properties/dialogs/AddPropertyDialog.tsx`
  - New empty-state section "Το Κτίριο δεν είναι συνδεδεμένο με Έργο" with 2 CTAs:
    `[Σύνδεσέ το τώρα]` → opens `LinkBuildingToProjectDialog`
    `[Επίλεξε άλλο Κτίριο]` → clears `buildingId`
  - On link success → `handleSelectChange('projectId', linkedProjectId)` auto-selects the project (form becomes valid)
- ✅ `useAddPropertyDialogState` extensions:
  - File: `src/components/properties/dialogs/useAddPropertyDialogState.ts`
  - New memos: `selectedBuilding`, `isOrphanBuilding` (detects Building with blank projectId)
  - Extended `emptyStates.orphanBuilding` flag
  - New state `showLinkBuildingDialog` + setter
- ✅ i18n keys added to EL + EN (`dialog.addUnit.emptyState.orphanBuilding.*`, `dialog.linkBuildingToProject.*`)
- ✅ TypeScript compiles (0 errors στα νέα/τροποποιημένα αρχεία — see background check)
- Files touched (5): `route.ts` (new), `LinkBuildingToProjectDialog.tsx` (new), `AddPropertyDialog.tsx`, `useAddPropertyDialogState.ts`, `domain-constants.ts`, `el/properties.json`, `en/properties.json`
- [ ] Manual verification: orphan Building detection + link flow (pending Γιώργος)
- ⏸️ NO COMMIT (per Γιώργος instruction)

**Batch 6 Acceptance**:
- Όλα τα i18n keys υπάρχουν σε EN + EL
- Tests pass
- TypeScript compiles, 0 errors στο scope των αλλαγών

---

## 11. Changelog

- **2026-04-05**: **📁 ADR RELOCATION** — Moved ADR-282/283/284/285 from `adrs/` → `docs/centralized-systems/reference/adrs/` (canonical SSoT location, 285 files). Git history preserved via `git mv`. `adrs/` directory deleted.
- **2026-04-05**: **🏛️ ARCHITECTURE REVISION (UI)** — Γιώργος: Family A Units show **Κτίριο + Όροφος only** in UI (Project field HIDDEN — projectId is grandparent, not parent). Family B Units show **Project only** (direct parent). Rule: "κάθε παιδί δείχνει στον γονέα του". **UI change**: `NewUnitHierarchySection.handleBuildingChange` auto-derives `projectId` from selected `Building.projectId` (denormalized cache — server policy still requires it). `{isStandalone && ...}` conditional hides Project selector for Family A. **Data model ADR-284 §2.4 still retains `projectId` on Property** for query performance (denormalized). UI-level revision only.
- **2026-04-05**: **Batch 7.1 IMPLEMENTED — FloorInlineCreateForm SSoT Extraction** (Γιώργος request). NEW `src/components/building-management/tabs/FloorInlineCreateForm.tsx` — self-contained component με own state (number/name/elevation + manuallyEdited flags), Revit/ArchiCAD auto-suggest pattern (number→name+elevation with DEFAULT_STOREY_HEIGHT=3.0m), createNameMismatch warning, API call, Check/X buttons. Used by **3 places** (SSoT): (1) `FloorsTabContent.tsx` (Building → Floors tab — refactored), (2) `NewUnitHierarchySection` empty-state CTA "Πρόσθεσε Όροφο" (replaces AddFloorDialog modal), (3) inline noFloors button inside Floor field area. `useFloorsTabState.ts` cleaned: create state extracted. Only `showCreateForm` toggle remains. i18n: `dialog.addUnit.emptyState.noFloors.inlineCta` + `actions.save_loading` (common-actions) added EL+EN.
- **2026-04-05**: **Batch 7.2 FIX — Auto-code regeneration in create mode**. Bug: `useEntityCodeSuggestion` in `PropertyFieldsBlock` kept reading stale `property.buildingId/floor/floorId` from `__new__` template. Fix: `codeBuildingId`/`codeFloorId`/`codeFloorLevel` derived conditionally — `isCreatingNewUnit ? formData.X : property.X`. Reset effect now depends on unified inputs. Code regenerates live as user changes Building/Floor.
- **2026-04-05**: **Batch 7.3 FIX — Type field dedup**. `PropertyFieldsEditForm` rendered its own Type dropdown alongside `NewUnitHierarchySection` Type → duplicate UI. Added `isCreatingNewUnit?: boolean` prop to `PropertyFieldsEditFormProps`; Type fieldset wrapped in `{!isCreatingNewUnit && (...)}`. Create mode: Type owned by `NewUnitHierarchySection`. Edit mode: Type stays in `PropertyFieldsEditForm`.
- **2026-04-05**: **Batch 7.4 FIX — Inline noFloors CTA in Floor field** (Γιώργος request). When user selects Building with no floors, Floor `<Select>` replaced by dashed outline `<Button>` "Δεν υπάρχουν όροφοι — Πρόσθεσε Όροφο" + Plus icon. Click opens inline `FloorInlineCreateForm` (SSoT). Uses design-system `Button` + i18n key (no hardcoded strings, no native `<button>`).
- **2026-04-05**: **Batch 7.5 FIX — Template literal fallback για i18n interpolation**. Bug: empty state titles displayed `{{buildingName}}` literally. Root cause unclear. Workaround: replaced `t('...title', { buildingName })` with inline template literals in `PropertyHierarchyEmptyStates.tsx`.
- **2026-04-05**: **Batch 7.6 — UI layout fix**. `NewUnitHierarchySection` collapsed to 0 height in narrow sidebar (flex parent). Added `minHeight: 280px` + `shrink-0` class.
- **2026-04-05**: **Batch 7.7 REFACTOR — SRP split to unblock 500-line hook**. Το Batch 7 πρόσθεσε hierarchy fields/imports στο `PropertyFieldsBlock.tsx` (542 γρ.) και inline edit row στο `PropertiesTabContent.tsx` (522 γρ.), ξεπερνώντας το Google-style 500-line limit (CLAUDE.md N.7.1). **Split 1** — `PropertyFieldsBlock.tsx` (542→462): extracted `buildUpdatesFromForm` (80 γρ. form→`Partial<Property>` mapping) σε νέο **SSoT module** `src/features/property-details/components/property-fields-form-mapper.ts` (pure function `buildPropertyUpdatesFromForm({ formData, property, suggestedCode, isMultiLevel })`). Reusable από tests/άλλα mutation sites. **Split 2** — `PropertiesTabContent.tsx` (522→480): extracted inline edit row UI (~45 γρ.) σε νέο component `src/components/building-management/tabs/PropertyInlineEditRow.tsx` (SRP: μία ευθύνη = inline edit row). Καθαρίστηκαν unused imports (TableCell, Check, X). Zero behavior change — καθαρός structural refactor. Commits: `1377e8da` (main split + Batch 3-7 bundle) + `e36f72f9` (type widening fix: `suggestedCode: string | null | undefined`, `isMultiLevel: boolean | undefined`).
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
- **2026-04-04**: **🚨 GAP DISCOVERY (§9.2)** — Production testing αποκάλυψε κρίσιμο security gap: ο Γιώργος δημιούργησε "κτίριο Δέλτα" χωρίς `projectId`, saved κανονικά με zero warnings. Root cause: (1) 2 παράλληλα UI paths για Building creation (❌ ΟΧΙ SSoT) — `AddBuildingDialog` (έχει Batch 0 validation) vs. inline "Fill then Create" στο `BuildingsPageContent.tsx:91-115` (καμία validation). (2) `/api/buildings` POST route ΔΕΝ έχει server-side policy (σε αντίθεση με `/api/projects` και `/api/properties`). **Google Playbook fix**: Server First → Νέο **Layer 0.5 (§3.0.5)** — `building-creation-policy.ts` + `/api/buildings` enforcement (Batch 3.5a, PRIORITY). Μετά inline UI validation (Batch 3.5b). SSoT via API, όχι via UI consolidation. Orphan data migration = post-hoc tech debt. Added **Batches 3.5a + 3.5b** στο §10 execution strategy με full acceptance criteria. Critical files reference για επόμενο context: §9.2.
- **2026-04-04**: **Batch 3 IMPLEMENTED** — Layer 2 Client Form Validation. `usePropertyForm.ts` updated: new `STANDALONE_UNIT_TYPES` + `isStandaloneUnitType()` exports, `projectId` added to `PropertyFormData`, discriminated `validate()` (Family A vs Family B), derived `isValid` memo για Save button disabled state, `handleSubmit` sends `projectId` + omits building/floor για Family B. `AddPropertyDialog.tsx` updated: Project selector (Radix Select), Building/Floor conditionally hidden για standalone, Save button wrapped σε Tooltip με family-specific messages (`inBuildingRequired` / `standaloneRequired`). `useAddPropertyDialogState.ts`: loads projects list on open, `handleTypeChange()` auto-clears building/floor when switching to standalone. i18n keys added σε EL + EN (`dialog.addUnit.validation.*` + `fields.project` + `tooltips.*`). TypeScript 0 errors. NO COMMIT — uncommitted changes αφημένα για επόμενο batch (Γιώργος: commits για Batches 3+4+5+6 θα γίνουν όλα μαζί στο τέλος).
- **2026-04-04**: **Batch 4 IMPLEMENTED** — Phase 3a (Empty State CTAs) + Phase 3c (Project form Company field). **Phase 3c CRITICAL FIX**: `useProjectForm.handleSubmit` στέλνει τώρα `linkedCompanyId: formData.companyId` στο payload — ο server policy (Batch 1) απαιτεί `linkedCompanyId`, η φόρμα δεν το έστελνε → κάθε project creation επέστρεφε 400 (silent regression). **Phase 3a**: `AddPropertyDialog.tsx` renders 3 inline empty-state sections (no Projects / no Buildings in selected Project / no Floors in selected Building) με CTAs. HYBRID strategy per §3.3: **inline nested dialogs** για Project (`AddProjectDialog`) + Floor (`AddFloorDialog`), **navigation redirect** για Building (`/buildings?projectId=...`). `useAddPropertyDialogState.ts`: new `filteredBuildings` (filter by `projectId`), `emptyStates` memo, nested dialog state (`showAddProjectDialog`, `showAddFloorDialog`), `reloadProjects` callback. Building dropdown τώρα εμφανίζει μόνο buildings του επιλεγμένου project. i18n: EL + EN keys `dialog.addUnit.emptyState.{noProjects,noBuildings,noFloors}.*`. 5 αρχεία: `useProjectForm.ts`, `useAddPropertyDialogState.ts`, `AddPropertyDialog.tsx`, `el/properties.json`, `en/properties.json`. TypeScript 0 errors. NO COMMIT. Ready for Batch 5 (linkBuildingToProject inline fix modal).
- **2026-04-04**: **🚨 Batch 3.5b IMPLEMENTED** — Inline Building UI Validation (closes §9.2 client-side gap). `GeneralTabContent.tsx` (inline "Fill then Create" flow) `handleSave()` enhanced: σε create mode απαιτεί `projectId` (από `projectLink.getPayload()`) επιπλέον του `name`. On validation failure → error banner (Google Docs draft pattern) με localized message "Επίλεξε Έργο για να συνεχίσεις". Auto-clear του error όταν χρήστης επιλέξει project (useEffect watch `projectLink.linkedId`). Προστέθηκε i18n key `validation.projectRequired` σε EL + EN `building.json`. Inline flow ήδη χρησιμοποιεί `createBuildingWithPolicy()` gateway (SSoT via API) — no refactor needed. Defense-in-depth: server policy (Batch 3.5a) είναι το security boundary, client validation είναι UX layer. 3 αρχεία modified. TypeScript 0 errors. NO COMMIT. Manual verification pending Γιώργος.
- **2026-04-04**: **🚨 Batch 3.5a IMPLEMENTED** — Layer 0.5 Building Server Policy (Gap Discovery §9.2 closed). New server-only module `src/services/building/building-creation-policy.ts` (BuildingCreationPolicyError + assertBuildingCreatePolicy + assertBuildingUpstreamChain). Mirrors pattern από Batch 1 (project-mutation-policy) + Batch 2 (property-creation-policy). `/api/buildings` POST route enforces policy server-side **πριν** `createEntity()`: sync validation (name + projectId required) + async upstream chain (Project exists + has linkedCompanyId). `BuildingCreationPolicyError` → `ApiError(400 Bad Request)` mapping. Security hole closed: οποιοσδήποτε client (Postman, curl, inline UI, import script) χωρίς έγκυρο projectId παίρνει 400. 2 αρχεία (1 new + 1 modified). TypeScript 0 errors. NO COMMIT (join με υπόλοιπα batches). Manual verification pending Γιώργος. Ready for Batch 3.5b.
- **2026-04-04**: **Batch 7 IMPLEMENTED** — SSoT Property Creation Validation Layer (Option B2). NEW shared primitives: `src/types/property-creation.ts` (PropertyCreationFormFields), `src/hooks/properties/usePropertyCreateValidation.ts` (discriminated validation hook + pure `validatePropertyCreationFields`), `PropertyHierarchyEmptyStates.tsx` (extracted reusable CTAs), `useNewUnitHierarchy.ts` (self-contained hierarchy state for inline flow), `NewUnitHierarchySection.tsx` (UI section with Type/Project/Building/Floor selectors + empty states + orphan fix integration). Refactored: `usePropertyForm.ts` (Path #1) uses shared validator — no behavior change. `AddPropertyDialog.tsx` uses extracted PropertyHierarchyEmptyStates (DRY — ~100 lines removed). `PropertyFieldsBlock.tsx` (Path #2 inline __new__): extended formData με projectId/buildingId/floorId + renders NewUnitHierarchySection όταν isCreatingNewUnit=true + pre-flight discriminated validation + Family-aware payload. `PropertyInlineCreateForm.tsx` (Path #3 Building tab): added required projectId prop + standalone type guard + floorId resolution from FloorRecord. `usePolygonHandlers.ts` (Path #4 DXF viewer): added `resolveProjectIdFromBuilding()` client helper + orphan Building guard. Primary user-facing fix: closes §9.3 gap. Server policy (Batch 2) remains security boundary. SSoT achieved at validation/types layer. 12 files. NO COMMIT.
- **2026-04-04**: **🚨 GAP DISCOVERY (§9.3)** — Manual testing Batch 5 αποκάλυψε δεύτερο UI parity gap: η σελίδα `/properties` χρησιμοποιεί **inline temp-row flow** (`UnitsPageContent.tsx` + `PropertyInlineCreateForm.tsx`) αντί για το `AddPropertyDialog`. Οι ADR-284 integrations (Batch 3 discriminated validation, Batch 4 empty states, Batch 5 orphan fix modal) **ΔΕΝ** έχουν εφαρμοστεί στο inline path. Το ίδιο exact anti-pattern με §9.2 (Buildings: dialog vs inline). **Server boundary (Batch 2) intact** — bypass requests απορρίπτονται με 400. UX parity είναι tech debt → **Batch 7 candidate** (post-Batch 6). Added **§9.3 Gap Discovery** με impact assessment, fix strategy, και critical files reference για επόμενο context.
- **2026-04-04**: **Batch 5 IMPLEMENTED** — Phase 3b Inline fix modal για orphan Buildings. NEW API endpoint `POST /api/buildings/[buildingId]/link-project` με atomic `runTransaction` (verifies Project.linkedCompanyId + Building tenant + orphan state, then `tx.update({ projectId })`; 409 αν Building ήδη συνδεδεμένο — cross-project reassignment out of scope per §3.3). Cascade via existing `linkEntity('building:projectId', …)`. API_ROUTES.BUILDINGS.LINK_PROJECT προστέθηκε στο `domain-constants.ts`. NEW `LinkBuildingToProjectDialog` component: read-only Building name + required Project Select (Radix per ADR-001), uses `apiClient.post`, toast + inline errors. Integration στο `AddPropertyDialog`: new empty-state "Orphan Building" με [Σύνδεσέ το τώρα] + [Επίλεξε άλλο Κτίριο] CTAs, auto-selects linked project on success. `useAddPropertyDialogState` επέκταση: `selectedBuilding`/`isOrphanBuilding` memos + `emptyStates.orphanBuilding` + `showLinkBuildingDialog` state. i18n EL+EN: `dialog.addUnit.emptyState.orphanBuilding.*` + `dialog.linkBuildingToProject.*`. 7 files (2 new + 5 modified). TypeScript 0 errors. NO COMMIT. Manual verification pending Γιώργος.
- **2026-04-04**: **Batch 2 IMPLEMENTED** — Layer 1 Server-Side Unit Creation Policy. New server-only module `src/services/property/property-creation-policy.ts` (PropertyCreationPolicyError + STANDALONE_UNIT_TYPES + assertPropertyCreatePolicy + assertUpstreamChainExists + resolveProjectIdFromBuilding). Discriminated validation βάσει type (Family A in-building vs Family B standalone: detached_house, villa). Async upstream chain check: Project→Company (both families), Building→Project + Floor→Building + per-level validation για multi-level (Family A only, §3.1.1). POST `/api/properties/create` enforces policy server-side πριν `createEntity()` → 400 on violation. Defense-in-depth auto-fill `projectId` από `Building.projectId` για Family A. TypeScript 0 errors. Ready for Batch 3.
