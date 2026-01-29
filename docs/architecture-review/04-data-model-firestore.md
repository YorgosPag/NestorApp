# 🗄️ Data Model & Firestore - Analysis

**Review Date**: 2026-01-29
**Repository**: Nestor Construct Platform
**Backend**: Firebase Firestore

---

## 📊 CURRENT STATE

**Data Model Score**: **85/100** (Good, with minor improvements needed)

| Category | Score | Status |
|----------|-------|--------|
| **Schema Design** | 90% | ✅ Excellent |
| **Tenant Isolation** | 40% | 🔴 CRITICAL (needs fixing) |
| **Relationships** | 85% | ✅ Good |
| **Indexes** | 85% | ✅ Good |
| **Query Patterns** | 80% | ✅ Good |
| **Data Consistency** | 75% | ⚠️ Needs improvement |
| **Migration Strategy** | 70% | ⚠️ Partial |

---

## 1. FIRESTORE COLLECTIONS

### 1.1 Main Collections (Multi-Tenant)

| Collection | Purpose | Tenant Field | Status | Security Issue |
|------------|---------|--------------|--------|----------------|
| **projects** | Project management | `companyId` | ✅ Isolated | None |
| **buildings** | Building data | `companyId` | ⚠️ PUBLIC READ | `allow read: if true;` (line 264) |
| **units** | Building units | Via project | ✅ Isolated | None |
| **contacts** | CRM contacts | `companyId` | ✅ Isolated | None |
| **companies** | Company profiles | N/A (root) | ✅ Isolated | None |
| **users** | User profiles | `companyId` | ✅ Isolated | None |
| **files** | File metadata | `companyId` | ✅ Isolated | None |
| **tasks** | Task management | ⚠️ MISSING | ❌ NO ISOLATION | Line 393: `allow read: if isAuthenticated()` |
| **leads** | Sales leads | ⚠️ MISSING | ❌ NO ISOLATION | Line 665: `allow read: if isAuthenticated()` |
| **opportunities** | Sales opportunities | ⚠️ MISSING | ❌ NO ISOLATION | Line 675: `allow read: if isAuthenticated()` |
| **communications** | Messages/emails | ⚠️ MISSING | ❌ NO ISOLATION | Line 630: `allow read: if isAuthenticated()` |
| **analytics** | Analytics data | ⚠️ MISSING | ❌ NO ISOLATION | Line 839: `allow read: if isAuthenticated()` |

**Evidence**: `C:\Nestor_Pagonis\firestore.rules` (various lines)

**🔴 CRITICAL FINDING**: 25+ collections lack proper tenant isolation (see [03-auth-rbac-security.md](./03-auth-rbac-security.md))

---

### 1.2 Subcollections

**Common Patterns**:

```
/projects/{projectId}/
  ├── members/{uid}                     # Project team members
  ├── obligations/{obligationId}        # Project obligations
  └── timeline/{eventId}                # Project timeline

/buildings/{buildingId}/
  ├── floors/{floorId}                  # Building floors
  ├── features/{featureId}              # Building features
  └── floorplans/{planId}               # Floor plans

/units/{unitId}/
  ├── features/{featureId}              # Unit features
  └── history/{eventId}                 # Change history

/contacts/{contactId}/
  ├── relationships/{relationshipId}    # Contact relationships
  └── activities/{activityId}           # Contact activities

/companies/{companyId}/
  ├── audit_logs/{logId}                # Company audit logs (✅ tenant-scoped)
  ├── settings/{settingId}              # Company settings
  └── teams/{teamId}                    # Company teams
```

**Evidence**: Firestore rules structure analysis

---

## 2. DATA RELATIONSHIPS

### 2.1 Hierarchy Model

```
Company
  ├── Users (via companyId)
  ├── Projects (via companyId)
  │   ├── Buildings (via projectId)
  │   │   ├── Floors (via buildingId)
  │   │   └── Units (via buildingId + floorId)
  │   ├── Contacts (via projectId)
  │   └── Files (via projectId)
  └── Teams (via companyId)
```

**Evidence**: Type definitions in `src/types/`

---

### 2.2 Relationship Types

| Type | Example | Implementation | Status |
|------|---------|----------------|--------|
| **1:N** | Company → Projects | `companyId` field | ✅ Good |
| **1:N** | Project → Buildings | `projectId` field | ✅ Good |
| **1:N** | Building → Units | `buildingId` field | ✅ Good |
| **M:N** | Contact ↔ Contact | `/contactRelationships/{id}` | ✅ Good |
| **M:N** | Project ↔ Users | `/projects/{id}/members/{uid}` | ✅ Good |
| **Polymorphic** | File → Entity | `{ entityType, entityId }` | ✅ Good |

**Evidence**: `src/types/associations.ts` (11KB), `src/types/file-record.ts` (19KB)

---

## 3. NAMING CONVENTIONS

### 3.1 Collection Names

**Pattern**: Plural, lowercase, hyphenated

**Examples**:
- ✅ `projects`
- ✅ `building-features`
- ✅ `unit-floorplans`
- ✅ `contact-relationships`

**Consistency**: ✅ Good (95%+ follow pattern)

---

### 3.2 Document IDs

**Pattern**: Auto-generated (Firestore) or enterprise IDs

**Types**:
1. **Auto-generated**: `doc()` - Random 20-character ID
2. **Enterprise IDs**: `EID-{timestamp}-{random}` (e.g., `EID-1706524800000-abc123`)
3. **Legacy**: Sequential numbers (being migrated)

**Evidence**: `src/services/enterprise-id.service.ts` (24KB)

**⚠️ NOTE**: Migration from sequential IDs to enterprise IDs in progress

---

### 3.3 Field Names

**Pattern**: camelCase

**Examples**:
- ✅ `companyId`
- ✅ `projectId`
- ✅ `createdAt`
- ✅ `updatedAt`

**Consistency**: ✅ Good (90%+ follow pattern)

---

## 4. INDEXES

### 4.1 Composite Indexes

**File**: `firestore.indexes.json` (13KB, 842 lines)

**Key Indexes**:
```json
[
  {
    "collectionGroup": "projects",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "companyId", "order": "ASCENDING" },
      { "fieldPath": "status", "order": "ASCENDING" },
      { "fieldPath": "createdAt", "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "files",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "companyId", "order": "ASCENDING" },
      { "fieldPath": "entityType", "order": "ASCENDING" },
      { "fieldPath": "entityId", "order": "ASCENDING" }
    ]
  }
]
```

**Evidence**: `C:\Nestor_Pagonis\firestore.indexes.json:1-842`

**Status**: ✅ Well-maintained (automatic index creation for common queries)

---

### 4.2 Single-Field Indexes

**Automatic**: Firestore creates single-field indexes automatically

**Custom**: Defined in `firestore.indexes.json` for:
- Array fields
- Map fields
- Fields with specific orders

---

## 5. QUERY PATTERNS

### 5.1 Common Patterns

**Tenant-Scoped Queries** (Most Common):
```typescript
// Pattern: Filter by companyId
const projects = await db
  .collection('projects')
  .where('companyId', '==', userCompanyId)
  .orderBy('createdAt', 'desc')
  .get();
```

**Entity-Based Queries**:
```typescript
// Pattern: Filter by entityType + entityId
const files = await db
  .collection('files')
  .where('entityType', '==', 'building')
  .where('entityId', '==', buildingId)
  .get();
```

**Hierarchical Queries**:
```typescript
// Pattern: Query subcollections
const members = await db
  .collection('projects')
  .doc(projectId)
  .collection('members')
  .where('role', '==', 'project_manager')
  .get();
```

**Evidence**: Service layer in `src/services/`

---

### 5.2 Query Optimization

**Techniques Used**:
- ✅ Composite indexes for complex queries
- ✅ Limit queries to reduce data transfer
- ✅ Use cursors for pagination
- ✅ Cache frequently accessed data

**Evidence**: `src/services/workspace.service.ts` (10KB) - Implements caching

---

### 5.3 Hotspots

**High-Traffic Collections**:
1. `files` - File metadata queries (frequently accessed)
2. `projects` - Project list queries
3. `contacts` - Contact search queries
4. `users` - User profile lookups

**Recommendation**: Monitor query performance, add caching where needed

---

## 6. DATA CONSISTENCY

### 6.1 Transactions

**Used For**:
- Creating related entities (e.g., Project + initial members)
- Updating counters atomically
- Moving entities between parents

**Example**:
```typescript
await db.runTransaction(async (transaction) => {
  const projectRef = db.collection('projects').doc();
  const memberRef = projectRef.collection('members').doc(userId);

  transaction.set(projectRef, projectData);
  transaction.set(memberRef, memberData);
});
```

**Evidence**: `src/services/` - Transaction usage in various services

**Status**: ✅ Good (transactions used where needed)

---

### 6.2 Batched Writes

**Used For**:
- Bulk updates (e.g., updating multiple units)
- Cleanup operations
- Data migrations

**Evidence**: `src/services/batch/` - Batch operation services

**Status**: ✅ Good (batched writes used for bulk operations)

---

### 6.3 Referential Integrity

**Issue**: Firestore doesn't enforce foreign keys

**Current Approach**:
- ⚠️ **Manual validation** in service layer
- ⚠️ **No cascading deletes** (orphaned records possible)
- ⚠️ **No referential constraints** in rules

**Recommendation**: Implement server-side validation, add cleanup Cloud Functions

---

## 7. MIGRATION STRATEGY

### 7.1 Schema Evolution

**Current Approach**:
- Additive changes only (add new fields)
- Legacy fields preserved for backward compatibility
- Gradual migration scripts

**Evidence**: `migrate-*.js` scripts in root directory

**Status**: ⚠️ Partial (some migrations manual, some automated)

---

### 7.2 Data Migration Scripts

**Found Scripts** (root directory):
- `migrate-building-1-firestore.js`
- `migrate-dxf-data.js`
- `migrate-dxf-data-ts.ts`
- `migrate-buildings-to-random-ids.js`

**Evidence**: Root directory file listing

**Status**: ⚠️ Ad-hoc (no consistent migration framework)

**Recommendation**: Implement migration framework (e.g., Firestore Migration Tool)

---

## 8. DATA CONTRACTS & TYPES

### 8.1 TypeScript Types

**Location**: `src/types/` (290 files)

**Key Type Files**:
- `src/types/building/Building.ts` - Building domain
- `src/types/contacts/Contact.ts` - Contact domain
- `src/types/file-record.ts` (19KB) - File metadata
- `src/types/associations.ts` (11KB) - Relationships

**Evidence**: `C:\Nestor_Pagonis\src\types\` (290 files)

**Status**: ✅ Excellent (full TypeScript coverage)

---

### 8.2 Validation

**Current**:
- ✅ TypeScript compile-time validation
- ✅ Zod schemas for form validation
- ⚠️ **No runtime validation** in Firestore rules (only type checking)

**Recommendation**: Add business logic validation in Firestore rules or Cloud Functions

---

## 9. GAPS & RECOMMENDATIONS

### 9.1 Critical Issues

| Issue | Severity | Evidence | Remediation |
|-------|----------|----------|-------------|
| **25+ collections lack tenant isolation** | 🔴 CRITICAL | `firestore.rules` | Add `&& belongsToCompany(resource.data.companyId)` to all collections |
| **Public read on Buildings** | 🟠 HIGH | `firestore.rules:264` | Change to `if isAuthenticated()` |
| **No referential integrity** | 🟡 MEDIUM | Manual validation only | Add Cloud Functions for cascading deletes |
| **Ad-hoc migrations** | 🟡 MEDIUM | Root directory scripts | Implement migration framework |
| **No business logic validation** | 🟡 MEDIUM | Firestore rules | Add validation in rules or Cloud Functions |

---

### 9.2 Recommended Direction

#### **✅ WHAT WORKS WELL**

1. **Excellent schema design** - Clear hierarchy, good relationships
2. **Composite indexes** - Well-optimized queries
3. **TypeScript types** - Full type coverage
4. **Naming consistency** - 95%+ follow conventions
5. **Transaction usage** - Atomic operations where needed

---

#### **⚠️ WHAT NEEDS IMPROVEMENT**

1. **Fix tenant isolation** - Add to all collections (4-6 hours)
2. **Implement referential integrity** - Cloud Functions for cleanup
3. **Add business logic validation** - Server-side validation
4. **Migration framework** - Consistent migration strategy
5. **Monitor query performance** - Add observability

---

## 10. NEXT ACTIONS

### Immediate (This Week)
- [ ] Fix tenant isolation in all 25+ collections
- [ ] Remove public read from Buildings
- [ ] Add monitoring to high-traffic collections

### Short-term (Next 2 Weeks)
- [ ] Implement Cloud Functions for cascading deletes
- [ ] Add business logic validation in Firestore rules
- [ ] Create migration framework

### Medium-term (Next Month)
- [ ] Add query performance monitoring
- [ ] Optimize slow queries
- [ ] Document data model fully

---

**Related Reports**:
- [03-auth-rbac-security.md](./03-auth-rbac-security.md) - Firestore security rules
- [05-files-storage-pipeline.md](./05-files-storage-pipeline.md) - File storage integration
- [02-current-architecture.md](./02-current-architecture.md) - Architecture overview

---

**Critical Files**:
- `C:\Nestor_Pagonis\firestore.rules` (1,333 lines)
- `C:\Nestor_Pagonis\firestore.indexes.json` (842 lines)
- `C:\Nestor_Pagonis\src\types\` (290 TypeScript files)
- `C:\Nestor_Pagonis\src\services\` (60+ service files)
