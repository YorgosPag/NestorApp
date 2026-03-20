# SPEC-255A: Firestore Rules — Tenant Isolation

> **Parent**: [ADR-255](../ADR-255-security-hardening-phase-4.md)
> **Priority**: P0 (CRITICAL)
> **Effort**: 2h
> **Status**: 📋 PLANNED

---

## Problem

2 Firestore collections λείπουν tenant isolation rules:

| Collection | Current Rule | companyId in Docs? | Action Required |
|------------|-------------|-------------------|-----------------|
| `file_comments` | `allow read, write: if isAuthenticated()` | **ΟΧΙ** — δεν γράφεται κατά τη δημιουργία | 1. Code fix, 2. Backfill, 3. Rule update |
| `file_audit_log` | `allow read, write: if isAuthenticated()` | **ΝΑΙ** — ήδη γράφει `companyId` | Rule update μόνο |

### Excluded Collections (No Action Needed)
- `bot_configs` → **Δεν χρησιμοποιείται** στον κώδικα → skip
- `security_roles` → Read-only, generic role definitions (δεν περιέχουν company data) → acceptable as-is

---

## Existing Infrastructure

- **Firestore function**: `belongsToCompany()` — ήδη χρησιμοποιείται σε ~30 collections
- **Pattern** (from `firestore.rules`):
  ```
  match /collection/{docId} {
    allow read: if isAuthenticated() && belongsToCompany();
    allow write: if isAuthenticated() && belongsToCompany();
  }
  ```

---

## Implementation Steps

### Step 1: Fix `file_comments` — Add companyId to setDoc (PREREQUISITE)

**File**: `src/services/file-comment.service.ts` (line ~79)

**Current code** — `setDoc()` call does NOT include `companyId`:
```typescript
await setDoc(commentRef, {
  fileId,
  userId,
  userName,
  content,
  createdAt: serverTimestamp(),
  // ❌ Missing: companyId
});
```

**Required change**:
```typescript
await setDoc(commentRef, {
  fileId,
  userId,
  userName,
  content,
  companyId, // ✅ Add from auth context
  createdAt: serverTimestamp(),
});
```

### Step 2: Backfill Script for Existing Comments

Existing `file_comments` documents without `companyId` need backfill:
- Query all comments
- For each comment, resolve `companyId` from `userId` via `users` collection
- Batch update with `companyId`

### Step 3: Update Firestore Rules

**File**: `firestore.rules`

**`file_comments`** (line ~2393):
```
// BEFORE
match /file_comments/{commentId} {
  allow read, write: if isAuthenticated();
}

// AFTER
match /file_comments/{commentId} {
  allow read: if isAuthenticated() && belongsToCompany();
  allow create: if isAuthenticated() && request.resource.data.companyId == request.auth.token.companyId;
  allow update, delete: if isAuthenticated() && belongsToCompany();
}
```

**`file_audit_log`** (line ~2437):
```
// BEFORE
match /file_audit_log/{logId} {
  allow read, write: if isAuthenticated();
}

// AFTER
match /file_audit_log/{logId} {
  allow read: if isAuthenticated() && belongsToCompany();
  allow write: if isAuthenticated() && belongsToCompany();
}
```

---

## Acceptance Criteria

- [ ] `file_comments` — νέα documents περιλαμβάνουν `companyId`
- [ ] Existing comments χωρίς `companyId` backfilled
- [ ] Firestore rules enforce `belongsToCompany()` σε `file_comments` και `file_audit_log`
- [ ] User A (company X) δεν βλέπει comments/logs από company Y
- [ ] Firebase deploy successful: `firebase deploy --only firestore:rules --project pagonis-87766`

---

## Risks

- **Backfill failure**: Αν comments δεν μπορούν να resolved σε company → set `companyId: 'ORPHANED'` + manual review
- **Rule deployment**: Test σε emulator πρώτα πριν production deploy
