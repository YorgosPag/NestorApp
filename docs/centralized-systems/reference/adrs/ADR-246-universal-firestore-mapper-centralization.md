# ADR-246: Καθολική Κεντρικοποίηση Firestore→API Mappers

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-03-19 |
| **Category** | Data Access Layer / Entity Systems |
| **Canonical Location** | `src/lib/firestore-mappers.ts` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## 1. Context

### Τι έχουμε σήμερα

Η εφαρμογή διαθέτει **ένα αρχικό centralized mapper** στο `src/lib/firestore-mappers.ts` με μόλις **2 entity mappers** (`mapStorageDoc`, `mapParkingDoc`), ενώ **27+ σημεία** στον κώδικα κάνουν inline/scattered Firestore→API mapping χωρίς κεντρικοποίηση.

### The Problem

- ❌ **Spread + Cast Anti-Pattern σε 15+ σημεία**: `{ id: doc.id, ...doc.data() } as Type` — zero type checking, silently passes invalid data
- ❌ **Named-but-inline mappers**: Αρχεία ορίζουν τον δικό τους `mapFirestoreToX()` αντί να χρησιμοποιούν κεντρικό mapper (π.χ. `companies/route.ts`, `projects/bootstrap/route.ts`)
- ❌ **Μη-type-safe field extraction**: `doc.data().fieldName` χωρίς validation σε πολλά routes
- ❌ **7+ entity types χωρίς centralized mapper**: Contact, Project, Building, Unit, Floor, Conversation, Message
- ❌ **Ασυνέπεια**: Κάθε API route ορίζει τα δικά του response interfaces αντί για shared DTOs
- ❌ **Timestamp handling**: Μη-ομοιόμορφη μετατροπή Firestore Timestamp → ISO string/Date

### Scope: Τι ΔΕΝ καλύπτει αυτό το ADR

- **ADR-214** (Firestore Query Centralization) — ΗΔΗ ΟΛΟΚΛΗΡΩΜΕΝΟ — αφορά query patterns, όχι mapping
- **ADR-218** (Timestamp Conversion) — ΗΔΗ ΟΛΟΚΛΗΡΩΜΕΝΟ — αφορά μόνο timestamps
- **ADR-220** (Field Extractor Centralization) — αφορά primitive field extraction (`getString`, `getNumber`)
- Αυτό το ADR αφορά **entity-level mapping**: Firestore Document → Typed API Response DTO

---

## 2. Decision

### 2.1 Κεντρικοποίηση ΟΛΩΝ των entity mappers στο `src/lib/firestore-mappers.ts`

Κάθε Firestore collection που εξυπηρετεί API routes αποκτά **ακριβώς ένα** centralized mapper function:

```typescript
// src/lib/firestore-mappers.ts

// ✅ ΥΠΑΡΧΟΝΤΑ (ADR-243)
export function mapStorageDoc(doc: QueryDocumentSnapshot): Storage;
export function mapParkingDoc(doc: QueryDocumentSnapshot): ParkingSpot;

// 🆕 ΝΕΟΙ MAPPERS (ADR-246)
export function mapContactDoc(doc: QueryDocumentSnapshot): ContactResponse;
export function mapCompanyDoc(doc: QueryDocumentSnapshot): CompanyResponse;
export function mapProjectDoc(doc: QueryDocumentSnapshot): ProjectResponse;
export function mapBuildingDoc(doc: QueryDocumentSnapshot): BuildingResponse;
export function mapUnitDoc(doc: QueryDocumentSnapshot): UnitResponse;
export function mapFloorDoc(doc: QueryDocumentSnapshot): FloorResponse;
export function mapConversationDoc(doc: QueryDocumentSnapshot): ConversationResponse;
export function mapMessageDoc(doc: QueryDocumentSnapshot): MessageResponse;
export function mapAuditTrailDoc(doc: QueryDocumentSnapshot): AuditTrailEntry;
export function mapTaskDoc(doc: QueryDocumentSnapshot): TaskResponse;
```

### 2.2 Canonical Mapper Contract

Κάθε mapper ΠΡΕΠΕΙ:

1. **Αποδέχεται `QueryDocumentSnapshot`** — όχι raw data
2. **Επιστρέφει strongly-typed DTO** — ποτέ `as any`, ποτέ `as Type`
3. **Χρησιμοποιεί field-extractors** από `@/lib/firestore/field-extractors.ts` — ποτέ raw `doc.data().field`
4. **Περιλαμβάνει validation** — enum values, required fields, fallback defaults
5. **Μετατρέπει timestamps** μέσω `normalizeToDate()` (ADR-218)
6. **Αποκλείει internal fields** — δεν επιστρέφει `companyId`, `__metadata`, κλπ.

### 2.3 Πρότυπο Mapper (βασισμένο στο existing `mapStorageDoc`)

```typescript
export function mapBuildingDoc(doc: QueryDocumentSnapshot): BuildingResponse {
  const data = doc.data();

  return {
    id: doc.id,
    name: getString(data, 'name', ''),
    address: getString(data, 'address', ''),
    projectId: getString(data, 'projectId', ''),
    totalFloors: getNumber(data, 'totalFloors', 0),
    status: validateEnum(getString(data, 'status'), VALID_BUILDING_STATUSES, 'active'),
    createdAt: normalizeToDate(data.createdAt)?.toISOString() ?? null,
    updatedAt: normalizeToDate(data.updatedAt)?.toISOString() ?? null,
  };
}
```

### 2.4 File Structure

```
src/lib/
├── firestore-mappers.ts            ← EXTEND (κεντρικό αρχείο, όλοι οι entity mappers)
├── firestore/
│   ├── field-extractors.ts         ← EXISTING (getString, getNumber, etc.)
│   └── field-validators.ts         ← OPTIONAL NEW (enum validation helpers)
```

---

## 3. Audit: Τρέχουσα Κατάσταση (27+ Scattered Mappings)

### 3.1 Ανά Entity Type

#### 📦 CONTACTS (4 σημεία scattered)

| # | Αρχείο | Pattern | Γραμμές |
|---|--------|---------|---------|
| 1 | `src/app/api/buildings/[buildingId]/customers/route.ts` | Spread+Cast | 87-90, 147-148 |
| 2 | `src/app/api/contacts/list-companies/route.ts` | Inline Field Extract | 68-75 |
| 3 | `src/app/api/contacts/search-individuals/route.ts` | Inline Field Extract | 78-88 |
| 4 | `src/services/projects/repositories/FirestoreProjectsRepository.ts` | Spread+Cast | 88-91 |

#### 🏢 BUILDINGS (2 σημεία scattered)

| # | Αρχείο | Pattern | Γραμμές |
|---|--------|---------|---------|
| 1 | `src/app/api/projects/structure/[projectId]/route.ts` | Spread+Cast | 135, 147-150 |
| 2 | `src/services/projects/repositories/FirestoreProjectsRepository.ts` | Spread+Cast | 56-59 |

#### 🏠 UNITS (4 σημεία scattered)

| # | Αρχείο | Pattern | Γραμμές |
|---|--------|---------|---------|
| 1 | `src/app/api/buildings/[buildingId]/customers/route.ts` | Spread+Cast | 87-90 |
| 2 | `src/app/api/units/admin-link/route.ts` | Spread+Cast | 62-64, 68-70 |
| 3 | `src/app/api/projects/structure/[projectId]/route.ts` | Spread+Cast | 147-150 |
| 4 | `src/services/projects/repositories/FirestoreProjectsRepository.ts` | Spread+Cast | 69-72 |

#### 📋 PROJECTS (3 σημεία scattered)

| # | Αρχείο | Pattern | Γραμμές |
|---|--------|---------|---------|
| 1 | `src/app/api/projects/structure/[projectId]/route.ts` | Spread+Cast | 107 |
| 2 | `src/services/projects/repositories/FirestoreProjectsRepository.ts` | Spread+Cast | 28-31, 46 |
| 3 | `src/database/migrations/001_fix_project_company_relationships.ts` | Spread+Cast | 86-89 |

#### 💬 CONVERSATIONS (1 σημείο — ΗΔΗ uses field-extractors)

| # | Αρχείο | Pattern | Γραμμές |
|---|--------|---------|---------|
| 1 | `src/app/api/conversations/route.ts` | Field Extractors ✅ | 183-217 |

#### 📝 AUDIT TRAIL (1 σημείο)

| # | Αρχείο | Pattern | Γραμμές |
|---|--------|---------|---------|
| 1 | `src/app/api/audit-trail/[entityType]/[entityId]/route.ts` | Spread+Cast+Timestamp | 83-97 |

#### ✅ TASKS (CRM) (1 σημείο — αφηρημένο μέσω Repository)

| # | Αρχείο | Pattern | Γραμμές |
|---|--------|---------|---------|
| 1 | `src/services/crm/tasks/repositories/TasksRepository.ts` | Query Service + Mapper | 50-105 |

#### ✅ STORAGE & PARKING (0 scattered — ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ)

| # | Αρχείο | Pattern | Status |
|---|--------|---------|--------|
| 1 | `src/lib/firestore-mappers.ts` | Named Mapper `mapStorageDoc` | ✅ Centralized |
| 2 | `src/lib/firestore-mappers.ts` | Named Mapper `mapParkingDoc` | ✅ Centralized |

### 3.2 Τα 3 Anti-Patterns

#### Anti-Pattern 1: Spread + Cast (15+ σημεία)

```typescript
// ❌ ΜΠΑΚΑΛΙΚΟ — zero type safety, passes undefined fields silently
const items = snapshot.docs.map(doc => ({
  id: doc.id,
  ...doc.data()
} as BuildingListItem));
```

**Γιατί είναι πρόβλημα:**
- Αν η Firestore schema αλλάξει, **κανένα compile-time error**
- Αν λείπει required field, **περνάει σιωπηλά ως `undefined`**
- `as Type` κάνει suppress ΟΛΟΥΣ τους TypeScript ελέγχους

#### Anti-Pattern 2: Named-but-Inline Mapper (2-3 σημεία)

```typescript
// ❌ Mapper ορισμένος τοπικά — δεν μπορεί να reuse
function mapFirestoreToCompanyContact(doc: DocumentSnapshot): CompanyContact {
  const data = doc.data();
  return { id: doc.id, name: data?.name ?? '', ... };
}
```

**Γιατί είναι πρόβλημα:**
- Κάθε route ορίζει τον δικό του mapper → N copies αντί για 1
- Αν αλλάξει η schema, πρέπει να βρεις ΟΛΑ τα copies

#### Anti-Pattern 3: Inline Field Extract (2+ σημεία)

```typescript
// ❌ Manual field access χωρίς extraction helpers
const company = {
  id: doc.id,
  name: doc.data().name || '',
  phone: doc.data().phone || '',
  vatNumber: doc.data().vatNumber || '',
};
```

**Γιατί είναι πρόβλημα:**
- `||` vs `??` — αν `name = 0` ή `name = false`, δίνει `''`
- Καμία validation, καμία type-narrowing

---

## 4. Prohibitions (μετά αυτό το ADR)

- ⛔ **ΑΠΑΓΟΡΕΥΕΤΑΙ** νέο `{ id: doc.id, ...doc.data() } as Type` σε API routes
- ⛔ **ΑΠΑΓΟΡΕΥΕΤΑΙ** ορισμός νέου entity mapper εκτός `firestore-mappers.ts`
- ⛔ **ΑΠΑΓΟΡΕΥΕΤΑΙ** direct `doc.data().field` σε API routes — χρήση field-extractors ή centralized mapper
- ⛔ **ΑΠΑΓΟΡΕΥΕΤΑΙ** `as any` ή `as unknown as Type` σε Firestore document conversions

---

## 5. Migration Plan (Incremental, By Entity)

### Φάση 1: High-Impact Entities (Projects, Buildings, Units)

| Mapper | Αρχεία προς migration | Εκτιμώμενα σημεία |
|--------|----------------------|-------------------|
| `mapProjectDoc()` | `FirestoreProjectsRepository`, `projects/structure`, migrations | 3 |
| `mapBuildingDoc()` | `FirestoreProjectsRepository`, `projects/structure` | 2 |
| `mapUnitDoc()` | `FirestoreProjectsRepository`, `projects/structure`, `units/admin-link`, `customers` | 4 |

**Σύνολο Φάσης 1:** 9 σημεία → 3 mappers

### Φάση 2: Contacts & Companies

| Mapper | Αρχεία προς migration | Εκτιμώμενα σημεία |
|--------|----------------------|-------------------|
| `mapContactDoc()` | `customers/route.ts`, `search-individuals` | 2 |
| `mapCompanyDoc()` | `list-companies/route.ts`, `FirestoreProjectsRepository` | 2 |

**Σύνολο Φάσης 2:** 4 σημεία → 2 mappers

### Φάση 3: Communication & CRM

| Mapper | Αρχεία προς migration | Εκτιμώμενα σημεία |
|--------|----------------------|-------------------|
| `mapConversationDoc()` | `conversations/route.ts` (ήδη field-extractors) | 1 |
| `mapMessageDoc()` | `messages/route.ts` | 1 |
| `mapTaskDoc()` | `TasksRepository.ts` | 1 |

**Σύνολο Φάσης 3:** 3 σημεία → 3 mappers

### Φάση 4: Remaining Entities

| Mapper | Αρχεία προς migration | Εκτιμώμενα σημεία |
|--------|----------------------|-------------------|
| `mapFloorDoc()` | `floors/route.ts`, migrations | 2 |
| `mapAuditTrailDoc()` | `audit-trail/route.ts` | 1 |

**Σύνολο Φάσης 4:** 3 σημεία → 2 mappers

### Migration Strategy: "Migrate on Touch"

Σύμφωνα με τη γενική στρατηγική του project:
- **Όταν αγγίζεται ένα route/service** → ΥΠΟΧΡΕΩΤΙΚΗ αντικατάσταση inline mapping με centralized mapper
- **Νέα API routes** → ΥΠΟΧΡΕΩΤΙΚΑ χρησιμοποιούν centralized mapper
- **Δεν απαιτείται big-bang migration** — incremental, safe, backward-compatible

---

## 6. Google-Level Standards

### Τι σημαίνει "Enterprise Mapper"

| Κριτήριο | Spread+Cast ❌ | Enterprise Mapper ✅ |
|-----------|---------------|---------------------|
| **Type Safety** | Zero — `as Type` bypasses TS | Full — compile-time errors |
| **Validation** | None — passes `undefined` | Enum checks, required fields, defaults |
| **Timestamp Handling** | Inconsistent — sometimes raw, sometimes ISO | Always via `normalizeToDate()` |
| **Field Filtering** | All fields exposed (including internals) | Only API-safe fields |
| **Single Source** | N copies per entity | 1 mapper, N consumers |
| **Testability** | Cannot unit-test mapping | Each mapper independently testable |
| **Schema Evolution** | Silent failures | Compile-time + runtime protection |

### Industry Precedent

- **Google Cloud Firestore SDK**: Official docs recommend dedicated converter functions (`FirestoreDataConverter<T>`)
- **Stripe API**: All Firestore→Response mapping centralized in `resource` objects
- **Firebase Admin SDK**: Uses `toJSON()` converters per document type

---

## 7. References

- **Related**: [ADR-243](.) — Initial `mapStorageDoc`/`mapParkingDoc` centralization
- **Related**: [ADR-214](./ADR-214-firestore-query-centralization.md) — Query Centralization (COMPLETED)
- **Related**: [ADR-218](./ADR-218-timestamp-conversion-centralization.md) — Timestamp Conversion
- **Related**: [ADR-220](./ADR-220-field-extractor-centralization.md) — Field Extractor Centralization
- **Existing Code**: `src/lib/firestore-mappers.ts` (canonical location)
- **Existing Code**: `src/lib/firestore/field-extractors.ts` (building block)
- **Industry Standard**: [Firestore Data Converters](https://firebase.google.com/docs/firestore/manage-data/add-data#custom_objects)

---

## 8. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-03-19 | ADR Created — Full audit of 27+ scattered mappings, 4-phase migration plan | Claude Code |
| 2026-03-19 | Status: APPROVED | Γιώργος Παγώνης |

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
*Enterprise standards inspired by: Google Cloud, Stripe, Firebase Admin SDK*
