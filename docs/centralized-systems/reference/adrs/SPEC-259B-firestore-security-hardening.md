# SPEC-259B: Firestore Security Hardening — 6 Unprotected Collections

| Field | Value |
|-------|-------|
| **ADR** | ADR-259 (Production Readiness Audit) |
| **Phase** | 2 of 4 |
| **Priority** | CRITICAL — data breach risk |
| **Status** | ✅ IMPLEMENTED |
| **Depends On** | — (no dependencies, can start immediately) |

---

## Objective

Προσθήκη companyId-based tenant isolation στις 6 collections που σήμερα έχουν μόνο `isAuthenticated()` check. Fix client-side anti-pattern στο `companies.service.ts`. Στόχος: **κανένας authenticated user δεν μπορεί να δει δεδομένα άλλης εταιρείας**.

---

## Current State

### 6 Απροστάτευτες Collections

| # | Collection | Τρέχον Rule | Line στο firestore.rules | Κατάσταση |
|---|-----------|------------|--------------------------|---------|
| 1 | **notifications** | `userId == request.auth.uid` | 732-754 | ✅ ΗΔΗ ασφαλές (owner-based) |
| 2 | **tasks** | `belongsToCompany()` + `createdBy/assignedTo` | 770-823 | ✅ ΗΔΗ ασφαλές (tenant-isolated) |
| 3 | **workspaces** | `belongsToCompany()` + legacy fallback | 1341-1355 | ⚠️ FIXED by SPEC-259B — legacy fallback αφαιρέθηκε |
| 4 | **users** | `isOwner(userId)` | 1305-1314 | ⚠️ FIXED by SPEC-259B — belongsToCompany + isSuperAdminOnly |
| 5 | **companies** | `getUserCompanyId() == companyId` | 502-514 | ✅ ΗΔΗ fixed by ADR-252 FR-C3 |
| 6 | **system** | `isCompanyAdmin()` | 1516-1525 | ✅ ΗΔΗ fixed by ADR-252 FR-M1 |

### Helper Functions (ΗΔΗ υπάρχουν — lines 3080-3225)

```
isAuthenticated()              → request.auth != null
getUserCompanyId()             → request.auth.token.companyId
belongsToCompany(companyId)    → getUserCompanyId() == companyId
isSuperAdminOnly()             → getGlobalRole() == 'super_admin'
isCompanyAdminOfCompany(id)    → super_admin OR (company_admin AND belongsToCompany)
```

### Client-side Anti-pattern

**Αρχείο**: `src/services/companies.service.ts` (lines 78-83)
```typescript
const projectsQuery = query(collection(db, PROJECTS_COLLECTION));
const projectsSnapshot = await getDocs(projectsQuery);
// ❌ Χωρίς where('companyId', '==', userCompanyId)
```

### Legacy Fallback Pattern

Πολλές collections (projects, contacts, buildings, κλπ) έχουν:
```
|| (!resource.data.keys().hasAny(['companyId']) && resource.data.createdBy == request.auth.uid)
```
Documents χωρίς `companyId` → fallback σε `createdBy`.

---

## Target State

- ✅ Κάθε collection: `belongsToCompany(resource.data.companyId)` ή equivalent
- ✅ `companies`: user βλέπει ΜΟΝΟ τη δική του company
- ✅ `users`: user βλέπει ΜΟΝΟ users της ίδιας company
- ✅ `notifications/tasks/workspaces`: tenant-isolated
- ✅ `system`: μόνο admin της ίδιας company
- ✅ `companies.service.ts`: WHERE clause με companyId
- ✅ Deploy: `firebase deploy --only firestore:rules --project pagonis-87766`

---

## Files to Modify

| File | Action | Details |
|------|--------|---------|
| `firestore.rules` | MODIFY | Fix 6 collections — add companyId checks |
| `src/services/companies.service.ts` | MODIFY | Add `where('companyId', '==', userCompanyId)` |

---

## Implementation Steps

### Step 1: notifications (firestore.rules line 732-752)

**Before**:
```
match /notifications/{notificationId} {
  allow read: if isAuthenticated();
  allow write: if isAuthenticated();
}
```

**After**:
```
match /notifications/{notificationId} {
  allow read: if isAuthenticated()
    && (belongsToCompany(resource.data.companyId)
        || resource.data.userId == request.auth.uid
        || isSuperAdminOnly());
  allow create: if isAuthenticated()
    && belongsToCompany(request.resource.data.companyId);
  allow update, delete: if isAuthenticated()
    && (belongsToCompany(resource.data.companyId)
        || resource.data.userId == request.auth.uid);
}
```

**Λογική**: Notification ανήκει σε company ΚΑΙ/Η σε συγκεκριμένο user. Read: company match ή own notification. Super admin: bypass.

### Step 2: tasks (firestore.rules line 770-823)

**After**:
```
match /tasks/{taskId} {
  allow read: if isAuthenticated()
    && (belongsToCompany(resource.data.companyId)
        || resource.data.assignedTo == request.auth.uid
        || resource.data.createdBy == request.auth.uid
        || isSuperAdminOnly());
  allow create: if isAuthenticated()
    && belongsToCompany(request.resource.data.companyId);
  allow update: if isAuthenticated()
    && (belongsToCompany(resource.data.companyId)
        || resource.data.assignedTo == request.auth.uid);
  allow delete: if isAuthenticated()
    && isCompanyAdminOfCompany(resource.data.companyId);
}
```

**Λογική**: Task ανήκει σε company. Read: company match ή assigned/created by user. Delete: μόνο admin.

### Step 3: workspaces (firestore.rules line 1341-1368)

**After**:
```
match /workspaces/{workspaceId} {
  allow read: if isAuthenticated()
    && (belongsToCompany(resource.data.companyId)
        || isSuperAdminOnly());
  allow create: if isAuthenticated()
    && belongsToCompany(request.resource.data.companyId);
  allow update: if isAuthenticated()
    && belongsToCompany(resource.data.companyId);
  allow delete: if isAuthenticated()
    && isCompanyAdminOfCompany(resource.data.companyId);
}
```

### Step 4: users (firestore.rules line 1305-1322)

**After**:
```
match /users/{userId} {
  allow read: if isAuthenticated()
    && (request.auth.uid == userId
        || belongsToCompany(resource.data.companyId)
        || isSuperAdminOnly());
  allow update: if isAuthenticated()
    && (request.auth.uid == userId
        || isCompanyAdminOfCompany(resource.data.companyId));
  allow create: if isAuthenticated()
    && isCompanyAdminOfCompany(request.resource.data.companyId);
  allow delete: if false;  // Κανένας δεν σβήνει user document
}
```

**Λογική**: User βλέπει εαυτό + users ίδιας company. Update: εαυτό ή admin. Delete: απαγορεύεται.

### Step 5: companies (firestore.rules line 502-520)

**After**:
```
match /companies/{companyId} {
  allow read: if isAuthenticated()
    && (belongsToCompany(companyId)
        || isSuperAdminOnly());
  allow update: if isAuthenticated()
    && isCompanyAdminOfCompany(companyId);
  allow create: if isAuthenticated()
    && isSuperAdminOnly();
  allow delete: if false;  // Κανένας δεν σβήνει company
}
```

**Λογική**: Company doc: μόνο μέλη βλέπουν. Create: μόνο super admin. Delete: απαγορεύεται.

### Step 6: system (firestore.rules line 1516-1540)

**After**:
```
match /system/{settingId} {
  allow read: if isAuthenticated()
    && (isCompanyAdminOfCompany(resource.data.companyId)
        || isSuperAdminOnly());
  allow write: if isAuthenticated()
    && isSuperAdminOnly();
}
```

**Λογική**: System settings: read μόνο admin ίδιας company ή super admin. Write: μόνο super admin.

### Step 7: Fix companies.service.ts

**Αρχείο**: `src/services/companies.service.ts` (lines 78-83)

**Before**:
```typescript
const projectsQuery = query(collection(db, PROJECTS_COLLECTION));
```

**After**:
```typescript
const projectsQuery = query(
  collection(db, PROJECTS_COLLECTION),
  where('companyId', '==', userCompanyId),
);
```

**Σημείωση**: Χρειάζεται να περαστεί `userCompanyId` ως parameter στη function.

### Step 8: Deploy

```bash
firebase deploy --only firestore:rules --project pagonis-87766
```

---

## Pre-deployment Checklist

| Check | Verification |
|-------|-------------|
| Existing documents have companyId? | Query collections — verify field exists |
| Users have companyId in auth token? | Check Firebase Auth custom claims |
| Super admin bypass works? | Test with Γιώργος account |
| Normal user isolated? | Test cross-company read attempt |
| Legacy fallback still needed? | Check if documents without companyId exist |

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Documents without companyId become inaccessible | Legacy fallback pattern (createdBy) retained |
| Wrong companyId in auth token | Firebase Auth custom claims are server-set |
| Super admin locked out | Explicit `isSuperAdminOnly()` bypass in every rule |
| Client queries break | Firestore returns permission-denied → app shows error |

---

## Verification

1. **Before deploy**: Read current rules, verify exact line numbers match
2. **Deploy to staging** (αν υπάρχει) ή directly to production
3. **Test as normal user**: Attempt to read other company's projects → should fail
4. **Test as admin**: Read own company data → should work
5. **Test as super admin**: Read any company data → should work
6. **Test companies.service.ts**: Projects loaded only for current company

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-23 | SPEC created — pending implementation |
| 2026-03-23 | ✅ IMPLEMENTED — Pre-check: 0 workspaces, 2 users (both with companyId). Rules: users (belongsToCompany + isSuperAdminOnly read, isCompanyAdminOfCompany write, delete=false), workspaces (legacy fallback removed). Client: companies.service.ts (where companyId filter via resolveUserCompanyId), contact-linker.ts (where companyId via getCompanyId SSoT). notifications + tasks already secured. companies + system already fixed by ADR-252. |
