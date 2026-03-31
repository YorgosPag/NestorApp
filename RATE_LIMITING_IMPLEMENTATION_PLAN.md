# 🔒 Rate Limiting Implementation Plan

**Date**: 2026-02-06
**Status**: Ready for Implementation
**Current Coverage**: 1/94 routes (1.06%)
**Target**: 94/94 routes (100%)

---

## 📊 Executive Summary

### Current State
- **Rate Limiting System**: ✅ Enterprise-grade με Upstash Redis (PRODUCTION-READY)
- **Location**: `src/lib/middleware/with-rate-limit.ts`
- **Categories**: 6 pre-configured wrappers (HIGH, STANDARD, SENSITIVE, HEAVY, WEBHOOK, TELEGRAM)
- **Implementation**: Μόνο 1 route χρησιμοποιεί rate limiting (Mailgun webhook)
- **Coverage**: 1.06% (CRITICAL GAP!)

### Security Impact
⚠️ **ΚΡΙΣΙΜΟ**: 93/94 routes (98.94%) είναι ΕΚΤΕΘΕΙΜΕΝΑ σε:
- DoS attacks (resource exhaustion)
- Brute force attacks (admin endpoints)
- Data scraping (list endpoints)
- API abuse (unlimited requests)

### Implementation Strategy
1. **PRIORITY 1 (ΚΡΙΣΙΜΟ)**: Admin & Sensitive routes - 31 routes
2. **PRIORITY 2 (HIGH)**: Migration & Heavy operations - 15 routes
3. **PRIORITY 3 (MEDIUM)**: CRUD & Standard operations - 37 routes
4. **PRIORITY 4 (LOW)**: Search, List, Read-only - 10 routes

---

## 🎯 Rate Limit Categories Overview

### Available Wrappers

| Category | Wrapper | Limit | Use Case |
|----------|---------|-------|----------|
| **HIGH** | `withHighRateLimit` | 100 req/min | Search, list endpoints (fast, frequent) |
| **STANDARD** | `withStandardRateLimit` | 60 req/min | CRUD operations |
| **SENSITIVE** | `withSensitiveRateLimit` | 20 req/min | Admin, financial, user management |
| **HEAVY** | `withHeavyRateLimit` | 10 req/min | Reports, exports, migrations |
| **WEBHOOK** | `withWebhookRateLimit` | 30 req/min | External webhooks |
| **TELEGRAM** | `withTelegramRateLimit` | 15 req/min | Telegram bot endpoints |

---

## 📋 Implementation Table (All 94 Routes)

### PRIORITY 1: SENSITIVE (31 routes) - ΚΡΙΣΙΜΟ!

| # | Route | Current | Category | Wrapper | Reason |
|---|-------|---------|----------|---------|--------|
| 1 | `/api/admin/bootstrap-admin` | ❌ | SENSITIVE | `withSensitiveRateLimit` | Admin user creation |
| 2 | `/api/admin/cleanup-duplicates` | ❌ | SENSITIVE | `withSensitiveRateLimit` | Data cleanup |
| 3 | `/api/admin/create-clean-projects` | ❌ | SENSITIVE | `withSensitiveRateLimit` | Data creation |
| 4 | `/api/admin/fix-building-project` | ❌ | SENSITIVE | `withSensitiveRateLimit` | Data fix |
| 5 | `/api/admin/fix-projects-direct` | ❌ | SENSITIVE | `withSensitiveRateLimit` | Data fix |
| 6 | `/api/admin/fix-unit-project` | ❌ | SENSITIVE | `withSensitiveRateLimit` | Data fix |
| 7 | `/api/admin/migrate-units` | ❌ | SENSITIVE | `withSensitiveRateLimit` | Migration |
| 8 | `/api/admin/seed-parking` | ❌ | SENSITIVE | `withSensitiveRateLimit` | Data seeding |
| 9 | `/api/admin/seed-floors` | ❌ | SENSITIVE | `withSensitiveRateLimit` | Data seeding |
| 10 | `/api/admin/set-user-claims` | ❌ | SENSITIVE | `withSensitiveRateLimit` | User permissions |
| 11 | `/api/admin/setup-admin-config` | ❌ | SENSITIVE | `withSensitiveRateLimit` | Admin config |
| 12 | `/api/admin/search-backfill` | ❌ | SENSITIVE | `withSensitiveRateLimit` | Data backfill |
| 13 | `/api/admin/migrations/execute` | ❌ | SENSITIVE | `withSensitiveRateLimit` | Migration execution |
| 14 | `/api/admin/migrations/execute-admin` | ❌ | SENSITIVE | `withSensitiveRateLimit` | Admin migration |
| 15 | `/api/admin/migrations/normalize-floors` | ❌ | SENSITIVE | `withSensitiveRateLimit` | Data normalization |
| 16 | `/api/admin/telegram/webhook` | ❌ | TELEGRAM | `withTelegramRateLimit` | Telegram admin |
| 17 | `/api/admin/migrate-dxf` | ❌ | SENSITIVE | `withSensitiveRateLimit` | DXF migration |
| 18 | `/api/admin/migrate-building-features` | ❌ | SENSITIVE | `withSensitiveRateLimit` | Building migration |
| 19 | `/api/auth/session` | ❌ | SENSITIVE | `withSensitiveRateLimit` | Session management |
| 20 | `/api/auth/mfa/enroll/complete` | ❌ | SENSITIVE | `withSensitiveRateLimit` | MFA enrollment |
| 21 | `/api/fix-companies` | ❌ | SENSITIVE | `withSensitiveRateLimit` | Company data fix |
| 22 | `/api/fix-projects` | ❌ | SENSITIVE | `withSensitiveRateLimit` | Project data fix |
| 23 | `/api/setup/firebase-collections` | ❌ | SENSITIVE | `withSensitiveRateLimit` | Database setup |
| 24 | `/api/projects/bootstrap` | ❌ | SENSITIVE | `withSensitiveRateLimit` | Projects bootstrap |
| 25 | `/api/units/admin-link` | ❌ | SENSITIVE | `withSensitiveRateLimit` | Admin unit link |
| 26 | `/api/units/force-update` | ❌ | SENSITIVE | `withSensitiveRateLimit` | Force update |
| 27 | `/api/units/final-solution` | ❌ | SENSITIVE | `withSensitiveRateLimit` | Unit solution |
| 28 | `/api/floors/admin` | ❌ | SENSITIVE | `withSensitiveRateLimit` | Floor admin |
| 29 | `/api/navigation/radical-clean-schema` | ❌ | SENSITIVE | `withSensitiveRateLimit` | Schema cleanup |
| 30 | `/api/navigation/force-uniform-schema` | ❌ | SENSITIVE | `withSensitiveRateLimit` | Schema enforcement |
| 31 | `/api/enterprise-ids/migrate` | ❌ | SENSITIVE | `withSensitiveRateLimit` | ID migration |

---

### PRIORITY 2: HEAVY (15 routes) - Migration & Heavy Operations

| # | Route | Current | Category | Wrapper | Reason |
|---|-------|---------|----------|---------|--------|
| 32 | `/api/buildings/fix-project-ids` | ❌ | HEAVY | `withHeavyRateLimit` | Batch fix |
| 33 | `/api/buildings/populate` | ❌ | HEAVY | `withHeavyRateLimit` | Data population |
| 34 | `/api/buildings/seed` | ❌ | HEAVY | `withHeavyRateLimit` | Data seeding |
| 35 | `/api/projects/add-buildings` | ❌ | HEAVY | `withHeavyRateLimit` | Batch operation |
| 36 | `/api/projects/create-for-companies` | ❌ | HEAVY | `withHeavyRateLimit` | Batch creation |
| 37 | `/api/projects/fix-company-ids` | ❌ | HEAVY | `withHeavyRateLimit` | Batch fix |
| 38 | `/api/projects/quick-fix` | ❌ | HEAVY | `withHeavyRateLimit` | Quick fix |
| 39 | `/api/units/connect-to-buildings` | ❌ | HEAVY | `withHeavyRateLimit` | Batch connection |
| 40 | `/api/contacts/add-real-contacts` | ❌ | HEAVY | `withHeavyRateLimit` | Batch add |
| 41 | `/api/contacts/update-existing` | ❌ | HEAVY | `withHeavyRateLimit` | Batch update |
| 42 | `/api/contacts/create-sample` | ❌ | HEAVY | `withHeavyRateLimit` | Sample creation |
| 43 | `/api/navigation/auto-fix-missing-companies` | ❌ | HEAVY | `withHeavyRateLimit` | Auto-fix |
| 44 | `/api/navigation/fix-contact-id` | ❌ | HEAVY | `withHeavyRateLimit` | ID fix |
| 45 | `/api/navigation/add-companies` | ❌ | HEAVY | `withHeavyRateLimit` | Company add |
| 46 | `/api/navigation/normalize-schema` | ❌ | HEAVY | `withHeavyRateLimit` | Schema normalization |

---

### PRIORITY 3: STANDARD (37 routes) - CRUD Operations

| # | Route | Current | Category | Wrapper | Reason |
|---|-------|---------|----------|---------|--------|
| 47 | `/api/buildings` | ❌ | STANDARD | `withStandardRateLimit` | CRUD |
| 48 | `/api/buildings/[buildingId]/customers` | ❌ | STANDARD | `withStandardRateLimit` | CRUD |
| 49 | `/api/projects/list` | ❌ | STANDARD | `withStandardRateLimit` | List |
| 50 | `/api/projects/[projectId]` | ❌ | STANDARD | `withStandardRateLimit` | CRUD |
| 51 | `/api/projects/[projectId]/customers` | ❌ | STANDARD | `withStandardRateLimit` | CRUD |
| 52 | `/api/projects/by-company/[companyId]` | ❌ | STANDARD | `withStandardRateLimit` | List |
| 53 | `/api/projects/structure/[projectId]` | ❌ | STANDARD | `withStandardRateLimit` | Read |
| 54 | `/api/v2/projects/[projectId]/customers` | ❌ | STANDARD | `withStandardRateLimit` | CRUD |
| 55 | `/api/units` | ❌ | STANDARD | `withStandardRateLimit` | CRUD |
| 56 | `/api/units/real-update` | ❌ | STANDARD | `withStandardRateLimit` | Update |
| 57 | `/api/units/test-connection` | ❌ | STANDARD | `withStandardRateLimit` | Test |
| 58 | `/api/floors` | ❌ | STANDARD | `withStandardRateLimit` | CRUD |
| 59 | `/api/floors/diagnostic` | ❌ | STANDARD | `withStandardRateLimit` | Diagnostic |
| 60 | `/api/floors/enterprise-audit` | ❌ | STANDARD | `withStandardRateLimit` | Audit |
| 61 | `/api/parking` | ❌ | STANDARD | `withStandardRateLimit` | CRUD |
| 62 | `/api/storages` | ❌ | STANDARD | `withStandardRateLimit` | CRUD |
| 63 | `/api/companies` | ❌ | STANDARD | `withStandardRateLimit` | CRUD |
| 64 | `/api/contacts/[contactId]` | ❌ | STANDARD | `withStandardRateLimit` | CRUD |
| 65 | `/api/contacts/[contactId]/units` | ❌ | STANDARD | `withStandardRateLimit` | CRUD |
| 66 | `/api/contacts/list-companies` | ❌ | STANDARD | `withStandardRateLimit` | List |
| 67 | `/api/relationships/children` | ❌ | STANDARD | `withStandardRateLimit` | Read |
| 68 | `/api/relationships/create` | ❌ | STANDARD | `withStandardRateLimit` | Create |
| 69 | `/api/notifications` | ❌ | STANDARD | `withStandardRateLimit` | CRUD |
| 70 | `/api/notifications/ack` | ❌ | STANDARD | `withStandardRateLimit` | Update |
| 71 | `/api/notifications/action` | ❌ | STANDARD | `withStandardRateLimit` | Update |
| 72 | `/api/notifications/dispatch` | ❌ | STANDARD | `withStandardRateLimit` | Create |
| 73 | `/api/notifications/seed` | ❌ | STANDARD | `withStandardRateLimit` | Seed |
| 74 | `/api/notifications/preferences` | ❌ | STANDARD | `withStandardRateLimit` | CRUD |
| 75 | `/api/notifications/error-report` | ❌ | STANDARD | `withStandardRateLimit` | Create |
| 76 | `/api/conversations` | ❌ | STANDARD | `withStandardRateLimit` | CRUD |
| 77 | `/api/conversations/[conversationId]/messages` | ❌ | STANDARD | `withStandardRateLimit` | CRUD |
| 78 | `/api/conversations/[conversationId]/send` | ❌ | STANDARD | `withStandardRateLimit` | Create |
| 79 | `/api/messages/delete` | ❌ | STANDARD | `withStandardRateLimit` | Delete |
| 80 | `/api/messages/edit` | ❌ | STANDARD | `withStandardRateLimit` | Update |
| 81 | `/api/messages/pin` | ❌ | STANDARD | `withStandardRateLimit` | Update |
| 82 | `/api/messages/[messageId]/reactions` | ❌ | STANDARD | `withStandardRateLimit` | CRUD |
| 83 | `/api/communications/email` | ❌ | STANDARD | `withStandardRateLimit` | Send |

---

### PRIORITY 4: HIGH/SPECIAL (11 routes) - Search, List, Webhooks, Heavy Processing

| # | Route | Current | Category | Wrapper | Reason |
|---|-------|---------|----------|---------|--------|
| 84 | `/api/search` | ❌ | HIGH | `withHighRateLimit` | Search endpoint |
| 85 | `/api/upload/photo` | ❌ | STANDARD | `withStandardRateLimit` | File upload |
| 86 | `/api/download` | ❌ | STANDARD | `withStandardRateLimit` | File download |
| 87 | `/api/floorplans/process` | ❌ | HEAVY | `withHeavyRateLimit` | DXF processing |
| 88 | `/api/floorplans/scene` | ❌ | STANDARD | `withStandardRateLimit` | Scene fetch |
| 89 | `/api/communications/email/property-share` | ❌ | STANDARD | `withStandardRateLimit` | Email send |
| 90 | `/api/communications/webhooks/telegram` | ❌ | TELEGRAM | `withTelegramRateLimit` | Telegram webhook |
| 91 | `/api/communications/webhooks/mailgun/inbound` | ✅ | WEBHOOK | `withWebhookRateLimit` | **DONE** |
| 92 | `/api/webhooks/sendgrid` | ❌ | WEBHOOK | `withWebhookRateLimit` | Sendgrid webhook |
| 93 | `/api/webhooks/sendgrid/inbound` | ❌ | WEBHOOK | `withWebhookRateLimit` | Sendgrid inbound |
| 94 | `/api/cron/email-ingestion` | ❌ | WEBHOOK | `withWebhookRateLimit` | Cron job |

---

## 🔧 Implementation Examples

### Example 1: Admin Endpoint (SENSITIVE)

**Before**:
```typescript
// src/app/api/admin/bootstrap-admin/route.ts
export async function POST(request: NextRequest): Promise<NextResponse> {
  // ... handler logic
}
```

**After**:
```typescript
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';

async function handleBootstrapAdmin(request: NextRequest): Promise<NextResponse> {
  // ... handler logic (same as before)
}

export const POST = withSensitiveRateLimit(handleBootstrapAdmin);
```

---

### Example 2: CRUD Endpoint (STANDARD) με withAuth

**Before**:
```typescript
// src/app/api/buildings/route.ts
export const GET = withAuth<ApiSuccessResponse<BuildingsResponseData>>(
  async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
    // ... handler logic
  },
  { permissions: 'buildings:buildings:view' }
);
```

**After (Composite Pattern)**:
```typescript
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';

const getBuildingsHandler = withAuth<ApiSuccessResponse<BuildingsResponseData>>(
  async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
    // ... handler logic (no change)
  },
  { permissions: 'buildings:buildings:view' }
);

export const GET = withStandardRateLimit(getBuildingsHandler);
```

**Explanation**: Rate limiting wraps withAuth (outer middleware pattern).

---

### Example 3: Migration Endpoint (HEAVY)

**Before**:
```typescript
// src/app/api/admin/migrations/execute/route.ts
export async function POST(request: NextRequest) {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      return handleMigrationExecution(req, ctx);
    },
    { permissions: 'admin:migrations:execute' }
  );
  return handler(request);
}
```

**After**:
```typescript
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';

const migrationHandler = withAuth(
  async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return handleMigrationExecution(req, ctx);
  },
  { permissions: 'admin:migrations:execute' }
);

export const POST = withHeavyRateLimit(migrationHandler);
```

---

### Example 4: Webhook Endpoint (Already Done - Reference)

**Current Implementation (Mailgun)**:
```typescript
// src/app/api/communications/webhooks/mailgun/inbound/route.ts
import { withWebhookRateLimit } from '@/lib/middleware/with-rate-limit';

async function handleMailgunInbound(request: NextRequest): Promise<Response> {
  // ... webhook logic
}

export const POST = withWebhookRateLimit(handleMailgunInbound);
```

**Pattern to follow** for other webhooks (Sendgrid, Telegram).

---

### Example 5: Search Endpoint (HIGH)

**Before**:
```typescript
// src/app/api/search/route.ts
export const GET = withAuth<ApiSuccessResponse<SearchResponseData>>(
  async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
    // ... search logic
  },
  { permissions: 'search:global:execute' }
);
```

**After**:
```typescript
import { withHighRateLimit } from '@/lib/middleware/with-rate-limit';

const searchHandler = withAuth<ApiSuccessResponse<SearchResponseData>>(
  async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
    // ... search logic (no change)
  },
  { permissions: 'search:global:execute' }
);

export const GET = withHighRateLimit(searchHandler);
```

---

## 🧪 Testing Plan

### 1. TypeScript Compilation
```bash
npx tsc --noEmit
```

**Expected**: Μηδέν type errors μετά την προσθήκη rate limiting.

---

### 2. Manual Testing (Development)

#### Test Rate Limiting Enforcement

**Step 1**: Ενεργοποίηση rate limiting σε ένα endpoint (π.χ. `/api/search`).

**Step 2**: Δοκιμή με rapid requests:
```bash
# Send 105 requests in 1 minute (HIGH limit: 100/min)
for i in {1..105}; do
  curl "http://localhost:3000/api/search?q=test" \
    -H "Authorization: Bearer YOUR_TOKEN" &
done
```

**Expected Result**:
- First 100 requests: `200 OK` με `X-RateLimit-Remaining` header
- Requests 101-105: `429 Too Many Requests`

**Response Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1707214800
Retry-After: 45
```

---

#### Test Different Categories

**SENSITIVE endpoint** (20 req/min):
```bash
# Admin endpoint - should block after 20 requests
for i in {1..25}; do
  curl -X POST "http://localhost:3000/api/admin/bootstrap-admin" \
    -H "Authorization: Bearer ADMIN_TOKEN" \
    -d '{"test": true}' &
done
```

**HEAVY endpoint** (10 req/min):
```bash
# Migration endpoint - should block after 10 requests
for i in {1..15}; do
  curl -X POST "http://localhost:3000/api/floorplans/process" \
    -H "Authorization: Bearer TOKEN" \
    -d '{"fileId": "test"}' &
done
```

---

### 3. Automated Testing (Future - Optional)

**Jest/Vitest Integration Tests**:
```typescript
describe('Rate Limiting', () => {
  it('should enforce SENSITIVE rate limit (20/min)', async () => {
    const requests = Array(25).fill(null).map(() =>
      fetch('/api/admin/bootstrap-admin', { method: 'POST' })
    );

    const responses = await Promise.all(requests);
    const rateLimited = responses.filter(r => r.status === 429);

    expect(rateLimited.length).toBeGreaterThan(0);
  });

  it('should reset rate limit after window expires', async () => {
    // Send 100 requests
    await Promise.all(Array(100).fill(null).map(() =>
      fetch('/api/search?q=test')
    ));

    // Wait 61 seconds (window expires)
    await new Promise(resolve => setTimeout(resolve, 61000));

    // Should succeed again
    const response = await fetch('/api/search?q=test');
    expect(response.status).toBe(200);
  });
});
```

---

### 4. Production Monitoring

**Upstash Redis Dashboard**:
- Monitor rate limit key counts
- Track 429 error rates
- Identify abusive users (high rate limit violations)

**Vercel Analytics**:
- Monitor `/api/*` response times
- Track 429 responses per endpoint
- Alert on unusual 429 spikes

**Logs**:
```typescript
// Rate limiter logs:
logger.warn('Request denied', {
  identifierHash: 'a1b2c3d4',
  endpoint: '/api/admin/bootstrap-admin',
  current: 21,
  limit: 20,
});
```

---

## 📅 Implementation Roadmap

### Phase 1: ΚΡΙΣΙΜΑ (Week 1)
**Target**: 31 SENSITIVE routes

**Day 1-2**: Admin endpoints (16 routes)
- `/api/admin/*` routes
- `/api/auth/*` routes

**Day 3**: Data fix endpoints (7 routes)
- `/api/fix-*` routes
- `/api/setup/*` routes
- `/api/enterprise-ids/migrate`

**Day 4**: Admin operations (8 routes)
- `/api/units/admin-link`
- `/api/units/force-update`
- `/api/units/final-solution`
- `/api/floors/admin`
- `/api/navigation/radical-clean-schema`
- `/api/navigation/force-uniform-schema`
- `/api/projects/bootstrap`

**Day 5**: Testing & verification
- TypeScript compilation
- Manual testing
- Production deployment

---

### Phase 2: HEAVY (Week 2)
**Target**: 15 HEAVY routes

**Day 1**: Building operations (3 routes)
- `/api/buildings/fix-project-ids`
- `/api/buildings/populate`
- `/api/buildings/seed`

**Day 2**: Project operations (4 routes)
- `/api/projects/add-buildings`
- `/api/projects/create-for-companies`
- `/api/projects/fix-company-ids`
- `/api/projects/quick-fix`

**Day 3**: Units & Contacts (5 routes)
- `/api/units/connect-to-buildings`
- `/api/contacts/add-real-contacts`
- `/api/contacts/update-existing`
- `/api/contacts/create-sample`

**Day 4**: Navigation operations (3 routes)
- `/api/navigation/auto-fix-missing-companies`
- `/api/navigation/fix-contact-id`
- `/api/navigation/add-companies`
- `/api/navigation/normalize-schema`

**Day 5**: Testing & verification

---

### Phase 3: STANDARD (Week 3)
**Target**: 37 STANDARD routes

**Day 1-2**: Main CRUD routes (20 routes)
- `/api/buildings`
- `/api/projects/*`
- `/api/units`
- `/api/floors`
- `/api/parking`
- `/api/storages`
- `/api/companies`

**Day 3**: Contacts & Relationships (5 routes)
- `/api/contacts/*`
- `/api/relationships/*`

**Day 4**: Notifications & Messages (12 routes)
- `/api/notifications/*`
- `/api/conversations/*`
- `/api/messages/*`
- `/api/communications/email`

**Day 5**: Testing & verification

---

### Phase 4: HIGH/SPECIAL (Week 4)
**Target**: 11 routes

**Day 1**: Search & Files (5 routes)
- `/api/search`
- `/api/upload/photo`
- `/api/download`
- `/api/floorplans/process`
- `/api/floorplans/scene`

**Day 2**: Webhooks (5 routes)
- `/api/communications/webhooks/telegram`
- `/api/webhooks/sendgrid`
- `/api/webhooks/sendgrid/inbound`
- `/api/cron/email-ingestion`
- `/api/communications/email/property-share`

**Day 3**: Testing & verification

**Day 4**: Production monitoring setup

**Day 5**: Documentation & audit

---

## 🎯 Success Criteria

### Technical
- ✅ All 94 routes have rate limiting
- ✅ TypeScript compilation με zero errors
- ✅ Manual testing confirms limits work
- ✅ Upstash Redis dashboard shows traffic

### Security
- ✅ Admin endpoints limited to 20 req/min
- ✅ Migration endpoints limited to 10 req/min
- ✅ No unlimited endpoints remaining
- ✅ 429 responses με proper headers

### Performance
- ✅ Rate limiting adds <5ms latency
- ✅ Upstash Redis SLA: 99.9% uptime
- ✅ No performance degradation

---

## 📝 Notes

### Composite Middleware Pattern
When combining rate limiting με withAuth:

**Correct Order**:
```typescript
const authHandler = withAuth(async (req, ctx, cache) => {
  // handler logic
}, { permissions: 'resource:action' });

export const GET = withRateLimit(authHandler);
```

**Why**: Rate limiting should be the OUTER middleware (first check).
**Flow**: Rate limit → Auth → Handler

---

### Environment Variables
Ensure production has:
```env
# Upstash Redis (required για rate limiting)
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# Optional: Rate limit IP salt
RATE_LIMIT_IP_SALT=your-secret-salt
```

---

### Monitoring
**Key Metrics**:
- `rate_limit.requests_allowed` (Counter)
- `rate_limit.requests_denied` (Counter)
- `rate_limit.check_duration_ms` (Histogram)

**Alerts**:
- 429 rate > 5% of total requests → Investigate
- Upstash Redis down → Critical alert

---

## 🚀 Quick Start Guide

### για τον Γιώργο (Manual Implementation)

**Step 1**: Pick a route από PRIORITY 1 (π.χ. `/api/admin/bootstrap-admin`).

**Step 2**: Open the file:
```bash
code src/app/api/admin/bootstrap-admin/route.ts
```

**Step 3**: Add import:
```typescript
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
```

**Step 4**: Wrap the handler:
```typescript
// Before
export async function POST(request: NextRequest): Promise<NextResponse> {
  // ...
}

// After
async function handleBootstrapAdmin(request: NextRequest): Promise<NextResponse> {
  // ... (same logic)
}

export const POST = withSensitiveRateLimit(handleBootstrapAdmin);
```

**Step 5**: Test:
```bash
npm run dev
curl -X POST http://localhost:3000/api/admin/bootstrap-admin
```

**Step 6**: Verify rate limiting works:
```bash
# Send 25 requests (limit: 20)
for i in {1..25}; do curl -X POST http://localhost:3000/api/admin/bootstrap-admin; done
```

**Expected**: First 20 succeed, last 5 return 429.

**Step 7**: Commit:
```bash
git add src/app/api/admin/bootstrap-admin/route.ts
git commit -m "feat: add rate limiting to bootstrap-admin endpoint (SENSITIVE - 20/min)"
```

**Repeat για κάθε route!**

---

## 📊 Progress Tracking

### Current Status (2026-02-06)
```
SENSITIVE:  0/31 (0%)   ████████████████████ PRIORITY 1
HEAVY:      0/15 (0%)   ████████████████████ PRIORITY 2
STANDARD:   0/37 (0%)   ████████████████████ PRIORITY 3
HIGH/SPEC:  1/11 (9%)   ██░░░░░░░░░░░░░░░░░░ PRIORITY 4

TOTAL:      1/94 (1%)   █░░░░░░░░░░░░░░░░░░░
```

**Next Milestone**: 31/94 (33%) - All SENSITIVE routes protected.

---

## 🔗 References

- **Rate Limit Middleware**: `src/lib/middleware/with-rate-limit.ts`
- **Rate Limit Config**: `src/lib/middleware/rate-limit-config.ts`
- **Upstash Redis**: https://upstash.com/docs/redis
- **Security Audit**: `SECURITY_AUDIT_REPORT.md` (Main project root)

---

**END OF IMPLEMENTATION PLAN**

Γιώργο, το implementation plan είναι έτοιμο! 🎉

Περιέχει:
- ✅ Πλήρη κατηγοριοποίηση όλων των 94 routes
- ✅ Priority order (SENSITIVE → HEAVY → STANDARD → HIGH)
- ✅ Code examples για κάθε pattern
- ✅ Testing plan
- ✅ 4-week roadmap
- ✅ Quick start guide

Να ξεκινήσουμε την υλοποίηση;
