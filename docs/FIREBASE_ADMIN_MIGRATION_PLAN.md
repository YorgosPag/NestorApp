# 🔄 Firebase Admin Canonicalization - Migration Plan

**Epic**: Firebase Admin Module Unification
**Status**: 📋 **PLANNED** - Staged migration required
**Priority**: MEDIUM (Technical debt, not breaking)
**Estimated Effort**: 2-3 weeks (staged across 4-5 PRs)

---

## 📊 CURRENT STATE

### **Repository-wide Inventory**

**Command Executed**:
```bash
grep -r '@/lib/firebase-admin' --include='*.ts' --include='*.tsx'
grep -r '@/lib/firebaseAdmin' --include='*.ts' --include='*.tsx'
```

**Results** (as of 2026-01-17):

| **Module** | **Files** | **Status** |
|------------|-----------|------------|
| `@/lib/firebaseAdmin` (CANONICAL) | 44 files | ✅ Active |
| `@/lib/firebase-admin` (NON-CANONICAL) | 16 files | ⚠️ Deprecated |

**Total**: 60 files use Firebase Admin SDK

---

## 🎯 MIGRATION GOAL

**Objective**: Eliminate dual Firebase Admin modules by migrating all 16 files to canonical module.

**Success Criteria**:
- ✅ 100% migration of non-canonical imports → canonical
- ✅ ZERO files use `@/lib/firebase-admin`
- ✅ Deprecation removed after verification
- ✅ All tests pass post-migration

---

## 📋 FILES TO MIGRATE (16 Total)

### **Category A: API Routes (11 files)**

**Batch 1** (4 files - PR #1):
1. `src/app/api/buildings/route.ts`
2. `src/app/api/buildings/fix-project-ids/route.ts`
3. `src/app/api/contacts/[contactId]/route.ts`
4. `src/app/api/contacts/[contactId]/units/route.ts`

**Batch 2** (4 files - PR #2):
5. `src/app/api/contacts/list-companies/route.ts`
6. `src/app/api/communications/webhooks/telegram/telegram-service.ts`
7. `src/app/api/communications/webhooks/telegram/firebase/safe-op.ts`
8. `src/app/api/communications/webhooks/telegram/firebase/availability.ts`

**Batch 3** (3 files - PR #3):
9. `src/database/migrations/005_assign_project_codes.ts`
10. `src/services/property-search.service.ts`
11. `src/services/storage.service.ts`

### **Category B: Services & Repositories (5 files)**

**Batch 4** (5 files - PR #4):
12. `src/services/projects/repositories/FirestoreProjectsRepository.ts`
13. `src/services/projects/services/ProjectsService.ts`
14. `src/services/projects/services/ProjectsService-broken.ts` (⚠️ Consider deleting if broken)
15. `src/services/relationships/enterprise-relationship-engine.ts`
16. `src/lib/firebase-admin.ts` (⚠️ Final removal - delete entire file)

---

## 🔧 MIGRATION STEPS (Per File)

### **1. Import Statement**
```diff
-import { db } from '@/lib/firebase-admin';
+import { adminDb } from '@/lib/firebaseAdmin';
```

### **2. Function Call Pattern**
```diff
-const snapshot = await db().collection('projects').get();
+const snapshot = await adminDb.collection('projects').get();
```

**Key Difference**: `db()` vs `adminDb` (no function call)

### **3. Null Safety** (if needed)
```diff
-if (!db()) {
+if (!adminDb) {
   console.error('Firebase Admin not initialized');
   return;
 }
```

### **4. TypeScript Imports**
```diff
-import type { Firestore } from 'firebase-admin/firestore';
 // No change needed - types remain same
```

---

## ⚠️ SPECIAL CASES

### **ProjectsService-broken.ts**
- **Status**: File suffix suggests it's broken/deprecated
- **Action**: Verify if used anywhere (`git grep ProjectsService-broken`)
- **If unused**: DELETE instead of migrating
- **If used**: Fix + migrate in same PR

### **Telegram Webhook Files**
- **3 files**: telegram-service.ts, safe-op.ts, availability.ts
- **Action**: Migrate together (same feature scope)
- **Testing**: Verify Telegram webhook still works post-migration

### **Migration 005_assign_project_codes.ts**
- **Type**: Database migration script
- **Risk**: May have run in production (check migration_history)
- **Action**: Migrate carefully, add note that old migrations should NOT re-run

---

## 📅 TIMELINE & STAGING

### **Phase 1: Deprecation Warning** ✅ **DONE**
- **Date**: 2026-01-17
- **Commit**: `8318aecf`
- **Action**: Added @deprecated JSDoc to `src/lib/firebase-admin.ts`

### **Phase 2: Staged Migration** ⏳ **PLANNED**
- **Batch 1 (PR #1)**: API routes (buildings, contacts) - Week 1
- **Batch 2 (PR #2)**: Telegram webhooks - Week 1
- **Batch 3 (PR #3)**: Migrations, services - Week 2
- **Batch 4 (PR #4)**: Projects services, final cleanup - Week 2

### **Phase 3: Verification** ⏳ **PLANNED**
- **Date**: After all migrations complete
- **Actions**:
  1. Run full test suite
  2. Verify `git grep '@/lib/firebase-admin'` returns ZERO code files
  3. Check TypeScript compilation (zero errors)
  4. Smoke test all migrated endpoints

### **Phase 4: Cleanup** ⏳ **PLANNED**
- **Date**: After verification passes
- **Actions**:
  1. Delete `src/lib/firebase-admin.ts`
  2. Update documentation (remove deprecation references)
  3. Celebrate! 🎉

---

## 🧪 TESTING STRATEGY

### **Per-Batch Testing**:
1. **Unit Tests**: Ensure existing tests pass
2. **TypeCheck**: `pnpm run typecheck` (zero errors)
3. **Lint**: `pnpm run lint` (zero new errors)
4. **Manual Smoke Test**: Call affected endpoints

### **Integration Testing**:
- **Buildings API**: List, create, update operations
- **Contacts API**: CRUD operations
- **Telegram Webhooks**: Send test message
- **Migrations**: Verify NOT re-run (check migration_history)

### **Final Verification**:
```bash
# Ensure ZERO non-canonical imports remain
git grep '@/lib/firebase-admin' -- '*.ts' '*.tsx'
# Expected: ZERO results (except docs)

# Ensure canonical module works
git grep '@/lib/firebaseAdmin' -- '*.ts' '*.tsx' | wc -l
# Expected: ~60 files (all code files)
```

---

## ⚠️ ROLLBACK PLAN

**If migration breaks production**:
1. **Immediate**: Revert PR (git revert)
2. **Investigation**: Identify broken endpoint
3. **Hotfix**: Create separate branch με targeted fix
4. **Resume**: Continue migration after stability restored

**Risk Mitigation**:
- Small batches (4-5 files per PR)
- Incremental testing
- Staging environment validation
- Feature flags (if needed for high-risk endpoints)

---

## 📝 PR TEMPLATE (For Migration PRs)

```markdown
## 🔄 Firebase Admin Migration - Batch N

**Part of**: Epic - Firebase Admin Canonicalization
**Migration Plan**: docs/FIREBASE_ADMIN_MIGRATION_PLAN.md

### What
Migrate N files from non-canonical `@/lib/firebase-admin` to canonical `@/lib/firebaseAdmin`

### Files Changed
- [ ] src/path/to/file1.ts
- [ ] src/path/to/file2.ts
- [ ] src/path/to/file3.ts
- [ ] src/path/to/file4.ts

### Changes
```diff
-import { db } from '@/lib/firebase-admin';
+import { adminDb } from '@/lib/firebaseAdmin';

-const snapshot = await db().collection('projects').get();
+const snapshot = await adminDb.collection('projects').get();
```

### Testing
- [x] TypeCheck passes (zero errors)
- [x] Lint passes (zero new errors)
- [x] Unit tests pass
- [x] Manual smoke test: [describe test]

### Batch Progress
- Batch 1: ✅ Merged
- Batch 2: ✅ Merged
- Batch 3: 🔄 This PR
- Batch 4: ⏳ Pending
```

---

## 📊 PROGRESS TRACKING

| **Batch** | **Files** | **PR** | **Status** | **Date** |
|-----------|-----------|--------|------------|----------|
| Batch 1 | 4 files (buildings, contacts) | #TBD | ⏳ Pending | Week 1 |
| Batch 2 | 4 files (Telegram webhooks) | #TBD | ⏳ Pending | Week 1 |
| Batch 3 | 3 files (migrations, services) | #TBD | ⏳ Pending | Week 2 |
| Batch 4 | 5 files (projects, cleanup) | #TBD | ⏳ Pending | Week 2 |

**Total Progress**: 0 / 16 files migrated (0%)

---

## 🎯 SUCCESS METRICS

**Definition of Done**:
- ✅ All 16 files migrated to canonical module
- ✅ `git grep '@/lib/firebase-admin'` returns ZERO code files
- ✅ All tests passing (unit + integration)
- ✅ TypeCheck: ZERO errors
- ✅ Lint: ZERO new errors
- ✅ `src/lib/firebase-admin.ts` DELETED
- ✅ Documentation updated (remove deprecation references)

**Code Quality**:
- NO regressions in functionality
- NO new TypeScript errors introduced
- NO new lint violations
- Consistent patterns across all migrated files

**Project Health**:
- Single source of truth for Firebase Admin
- Reduced cognitive load (one import pattern)
- Easier onboarding (clear canonical module)
- Foundation for future Firebase Admin enhancements

---

## 📞 QUESTIONS & SUPPORT

**Migration Issues**: Create issue με `firebase-admin-migration` label
**Technical Questions**: Contact project maintainers
**Blocker**: Escalate to Chief Manager / Γιώργος

---

**Created**: 2026-01-17
**Last Updated**: 2026-01-17
**Version**: 1.0
**Owner**: Claude Opus 4.5 + Γιώργος Παγώνης
