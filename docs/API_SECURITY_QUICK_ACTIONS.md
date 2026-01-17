# ⚡ API SECURITY AUDIT - QUICK ACTION GUIDE

**Date**: 2026-01-17
**Urgency**: 🔴 **IMMEDIATE ACTION REQUIRED**

---

## 🚨 CRITICAL - DELETE THESE FILES IMMEDIATELY (Day 1)

### Remote Code Execution (RCE) - SECURITY BREACH ACTIVE

```bash
# DELETE IMMEDIATELY:
rm src/app/api/run-jest/route.ts
rm src/app/api/run-playwright/route.ts
rm src/app/api/run-vitest/route.ts
rm src/app/api/debug/firestore-data/route.ts
rm src/app/api/floors/debug/route.ts

# Commit and deploy:
git add .
git commit -m "SECURITY: Delete RCE and public debug endpoints (ADR-029)"
git push origin main
```

**Why**: These endpoints allow **arbitrary code execution** and **public data access**.

**Impact**: Closes **5 CRITICAL security vulnerabilities**.

---

## 🟠 HIGH PRIORITY - PROTECT THESE FILES (Week 1-2)

### Top 10 Most Dangerous Unprotected Endpoints

| Priority | File | Issue | Fix |
|----------|------|-------|-----|
| 1 | `buildings/route.ts` | Wrong `withAuth` pattern | Fix pattern (see template below) |
| 2 | `floors/route.ts` | Wrong `withAuth` pattern | Fix pattern |
| 3 | `units/route.ts` | Wrong `withAuth` pattern | Fix pattern |
| 4 | `units/final-solution/route.ts` | No auth + mass update | Add `withAuth` + `super_admin` |
| 5 | `units/force-update/route.ts` | No auth + mass update | Add `withAuth` + `super_admin` |
| 6 | `projects/fix-company-ids/route.ts` | No auth + mass update | Add `withAuth` + `super_admin` |
| 7 | `projects/quick-fix/route.ts` | No auth + mass update | Add `withAuth` + `super_admin` |
| 8 | `communications/email/route.ts` | No auth + email sending | Add `withAuth` + permission |
| 9 | `conversations/[conversationId]/send/route.ts` | No auth + no tenant | Add `withAuth` + tenant |
| 10 | `floors/admin/route.ts` | No auth | Add `withAuth` + `super_admin` |

---

## 📋 QUICK FIX TEMPLATES

### Template 1: Fix Wrong `withAuth` Pattern

**Files**: `buildings/route.ts`, `floors/route.ts`, `units/route.ts`

```typescript
// ❌ CURRENT (WRONG):
export const GET = withAuth<Response>(
  async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
    return NextResponse.json({ data }); // ❌ Wrong pattern
  },
  { permissions: 'buildings:buildings:view' }
);

// ✅ CORRECT:
export const GET = async (request: NextRequest) => {
  const handler = withAuth<Response>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      return NextResponse.json({ data });
    },
    { permissions: 'buildings:buildings:view' }
  );

  return handler(request);
};
```

---

### Template 2: Add `withAuth` + `super_admin` + Audit

**Files**: `units/final-solution/route.ts`, `units/force-update/route.ts`, etc.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logDataFix, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';

export const POST = withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
    const startTime = Date.now();

    // 🔒 Layer 2: Explicit super_admin check
    if (ctx.globalRole !== 'super_admin') {
      return NextResponse.json({
        success: false,
        error: 'Forbidden: This operation requires super_admin role',
        code: 'SUPER_ADMIN_REQUIRED',
      }, { status: 403 });
    }

    try {
      // ... existing business logic here ...

      const duration = Date.now() - startTime;

      // 🔒 Layer 4: Audit logging (non-blocking)
      const metadata = extractRequestMetadata(req);
      await logDataFix(
        ctx,
        'operation_name_here',
        {
          // ... audit data ...
          executionTimeMs: duration,
          result: 'success',
          metadata,
        },
        `Operation by ${ctx.globalRole} ${ctx.email}`
      ).catch((err: unknown) => {
        console.error('⚠️ Audit logging failed (non-blocking):', err);
      });

      return NextResponse.json({ success: true });

    } catch (error: unknown) {
      console.error('❌ Error:', error);
      return NextResponse.json({
        success: false,
        error: 'Operation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  },
  { permissions: 'admin:data:fix' } // 🔒 Layer 1: Permission check
);
```

---

### Template 3: Add Tenant Scoping

**Files**: All endpoints accessing multi-tenant collections

```typescript
// ❌ WRONG (no tenant scoping):
const data = await adminDb.collection(COLLECTIONS.UNITS).get();

// ✅ CORRECT (with tenant scoping):
const data = await adminDb
  .collection(COLLECTIONS.UNITS)
  .where('companyId', '==', ctx.companyId) // ✅ Tenant isolation
  .get();
```

---

## 📊 PROGRESS TRACKER

### Phase 1: CRITICAL (Week 1)

- [ ] **Day 1**: Delete RCE endpoints (5 files)
- [ ] **Day 1**: Redeploy to Vercel
- [ ] **Days 2-7**: Fix buildings/units/floors (15 files)

**Target Completion**: End of Week 1
**Expected Compliance**: 47% → 65%

---

### Phase 2: HIGH (Week 2)

- [ ] **Days 8-14**: Fix projects/communications (9 files)
- [ ] **Days 8-14**: Fix notifications/companies (9 files)

**Target Completion**: End of Week 2
**Expected Compliance**: 65% → 85%

---

### Phase 3: MEDIUM (Week 3)

- [ ] **Days 15-17**: Fix remaining endpoints (6 files)
- [ ] **Days 18-21**: Migrate Client SDK → Admin SDK (2 files)

**Target Completion**: End of Week 3
**Expected Compliance**: 85% → 98%

---

## 🎯 SUCCESS CRITERIA

### After Phase 1:
- ✅ 0 RCE endpoints
- ✅ 0 public debug endpoints
- ✅ 65% ADR-029 compliance

### After Phase 2:
- ✅ 0 CRITICAL vulnerabilities
- ✅ 0 HIGH risk endpoints
- ✅ 85% ADR-029 compliance

### After Phase 3:
- ✅ 98%+ ADR-029 compliance
- ✅ Full tenant isolation
- ✅ Comprehensive audit trail

---

## 🔧 TESTING CHECKLIST

After each fix, test:

1. **Authentication**:
   ```bash
   # Should fail without token:
   curl https://nestor-app.vercel.app/api/buildings
   # Should succeed with valid token:
   curl -H "Authorization: Bearer YOUR_TOKEN" https://nestor-app.vercel.app/api/buildings
   ```

2. **Permission Check**:
   - User without permission → 403 Forbidden
   - User with permission → 200 OK

3. **Tenant Isolation**:
   - User from Company A → Only sees Company A data
   - User from Company B → Only sees Company B data

4. **Audit Logging**:
   - Check Firestore `/audit` collection
   - Verify operation was logged with correct user/timestamp

---

## 📞 SUPPORT

**For questions**: See full audit report at `docs/API_SECURITY_AUDIT_COMPREHENSIVE.md`

**ADR-029 Reference**: API Endpoint Security Standard

---

**Status**: ⚠️ **ACTION REQUIRED**
**Next Review**: After Phase 3 completion
