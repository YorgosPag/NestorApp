# ⚡ Rate Limiting Quick Reference Guide

**Purpose**: Γρήγορη αναφορά για υλοποίηση rate limiting σε API routes

---

## 🚀 5-Second Decision Tree

```
┌─────────────────────────────────────────┐
│   Τι κάνει το endpoint;                 │
└─────────────────────────────────────────┘
              │
       ┌──────┴──────┐
       │  Admin?     │────── YES ──► SENSITIVE (20/min)
       └──────┬──────┘
              │ NO
       ┌──────┴──────┐
       │  Migration? │────── YES ──► HEAVY (10/min)
       └──────┬──────┘
              │ NO
       ┌──────┴──────┐
       │  Webhook?   │────── YES ──► WEBHOOK (30/min) or TELEGRAM (15/min)
       └──────┬──────┘
              │ NO
       ┌──────┴──────┐
       │  Search?    │────── YES ──► HIGH (100/min)
       └──────┬──────┘
              │ NO
       ┌──────┴──────┐
       │  Heavy      │────── YES ──► HEAVY (10/min)
       │  Processing?│
       └──────┬──────┘
              │ NO
              │
              ▼
         STANDARD (60/min)
```

---

## 📦 Import Statement (Copy-Paste)

```typescript
import { withHighRateLimit } from '@/lib/middleware/with-rate-limit';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { withWebhookRateLimit } from '@/lib/middleware/with-rate-limit';
import { withTelegramRateLimit } from '@/lib/middleware/with-rate-limit';
```

**Tip**: Only import όποιο χρειάζεσαι!

---

## 🎯 Copy-Paste Templates

### Template 1: Simple Handler (No withAuth)

**Before**:
```typescript
export async function POST(request: NextRequest): Promise<NextResponse> {
  // handler logic
  return NextResponse.json({ ok: true });
}
```

**After**:
```typescript
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';

async function handleRequest(request: NextRequest): Promise<NextResponse> {
  // handler logic (same as before)
  return NextResponse.json({ ok: true });
}

export const POST = withSensitiveRateLimit(handleRequest);
```

---

### Template 2: With withAuth (Composite Pattern)

**Before**:
```typescript
export const GET = withAuth<ApiSuccessResponse<DataType>>(
  async (request: NextRequest, ctx: AuthContext, cache: PermissionCache) => {
    // handler logic
    return apiSuccess({ data: [] }, 'Success');
  },
  { permissions: 'resource:action' }
);
```

**After**:
```typescript
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';

const getHandler = withAuth<ApiSuccessResponse<DataType>>(
  async (request: NextRequest, ctx: AuthContext, cache: PermissionCache) => {
    // handler logic (same as before)
    return apiSuccess({ data: [] }, 'Success');
  },
  { permissions: 'resource:action' }
);

export const GET = withStandardRateLimit(getHandler);
```

---

### Template 3: Multiple HTTP Methods

**Before**:
```typescript
export async function GET(request: NextRequest) {
  // GET logic
}

export async function POST(request: NextRequest) {
  // POST logic
}

export async function PATCH(request: NextRequest) {
  // PATCH logic
}
```

**After**:
```typescript
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';

async function handleGet(request: NextRequest) {
  // GET logic (same as before)
}

async function handlePost(request: NextRequest) {
  // POST logic (same as before)
}

async function handlePatch(request: NextRequest) {
  // PATCH logic (same as before)
}

export const GET = withStandardRateLimit(handleGet);
export const POST = withStandardRateLimit(handlePost);
export const PATCH = withStandardRateLimit(handlePatch);
```

---

### Template 4: Webhook με Signature Verification

**Before**:
```typescript
export async function POST(request: NextRequest): Promise<Response> {
  // Verify signature
  if (!verifySignature(request)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Process webhook
  return NextResponse.json({ ok: true });
}
```

**After**:
```typescript
import { withWebhookRateLimit } from '@/lib/middleware/with-rate-limit';

async function handleWebhook(request: NextRequest): Promise<Response> {
  // Verify signature (same as before)
  if (!verifySignature(request)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Process webhook (same as before)
  return NextResponse.json({ ok: true });
}

export const POST = withWebhookRateLimit(handleWebhook);
```

---

### Template 5: Custom Rate Limit (Ultra-Critical)

**Use Case**: Bootstrap admin, migrations (need LOWER limits).

```typescript
import { withRateLimit } from '@/lib/middleware/with-rate-limit';

async function handleUltraCritical(request: NextRequest): Promise<NextResponse> {
  // handler logic
  return NextResponse.json({ ok: true });
}

export const POST = withRateLimit(handleUltraCritical, {
  category: 'SENSITIVE', // Base category
  // Custom lower limit (optional - if default SENSITIVE 20/min is too high)
  // customLimit: 5,
  // customWindow: 60000, // 1 minute
});
```

---

## 🔍 Category Selection Guide

### SENSITIVE (20 req/min)
**Keywords**: admin, auth, user, claims, permissions, security, mfa, session
**Examples**:
- `/api/admin/bootstrap-admin`
- `/api/auth/session`
- `/api/admin/set-user-claims`

```typescript
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
export const POST = withSensitiveRateLimit(handler);
```

---

### HEAVY (10 req/min)
**Keywords**: migration, batch, process, export, report, populate, seed
**Examples**:
- `/api/admin/migrations/execute`
- `/api/floorplans/process`
- `/api/buildings/populate`

```typescript
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
export const POST = withHeavyRateLimit(handler);
```

---

### STANDARD (60 req/min)
**Keywords**: create, update, delete, get, list, CRUD
**Examples**:
- `/api/buildings`
- `/api/projects/list`
- `/api/contacts/[contactId]`

```typescript
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
export const GET = withStandardRateLimit(handler);
```

---

### HIGH (100 req/min)
**Keywords**: search, autocomplete, typeahead, suggest
**Examples**:
- `/api/search`

```typescript
import { withHighRateLimit } from '@/lib/middleware/with-rate-limit';
export const GET = withHighRateLimit(handler);
```

---

### WEBHOOK (30 req/min)
**Keywords**: webhook, external, sendgrid, mailgun, stripe
**Examples**:
- `/api/webhooks/sendgrid`
- `/api/communications/webhooks/mailgun/inbound` ✅ (already done)

```typescript
import { withWebhookRateLimit } from '@/lib/middleware/with-rate-limit';
export const POST = withWebhookRateLimit(handler);
```

---

### TELEGRAM (15 req/min)
**Keywords**: telegram, bot, chat
**Examples**:
- `/api/communications/webhooks/telegram`
- `/api/admin/telegram/webhook`

```typescript
import { withTelegramRateLimit } from '@/lib/middleware/with-rate-limit';
export const POST = withTelegramRateLimit(handler);
```

---

## ✅ Testing Checklist

### 1. TypeScript Compilation
```bash
npx tsc --noEmit
```
**Expected**: ✅ No errors

---

### 2. Local Testing (Development)
```bash
# Start dev server
npm run dev

# Test endpoint
curl http://localhost:3000/api/your-endpoint
```
**Expected**: ✅ 200 OK με headers:
- `X-RateLimit-Limit: 60`
- `X-RateLimit-Remaining: 59`
- `X-RateLimit-Reset: 1707214800`

---

### 3. Rate Limit Enforcement Test
```bash
# Send 65 requests (για STANDARD 60/min)
for i in {1..65}; do
  curl http://localhost:3000/api/your-endpoint &
done
```
**Expected**:
- ✅ First 60: `200 OK`
- ✅ Last 5: `429 Too Many Requests`

---

### 4. 429 Response Verification
```bash
curl -i http://localhost:3000/api/your-endpoint
```
**Expected Response** (after limit):
```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1707214860
Retry-After: 45

{
  "error": "Rate limit exceeded. Try again in 45 seconds.",
  "limit": 60,
  "remaining": 0,
  "resetAt": "2026-02-06T12:01:00.000Z"
}
```

---

## 🐛 Common Mistakes & Fixes

### Mistake 1: Wrapping in Wrong Order

❌ **Wrong**:
```typescript
export const GET = withRateLimit(
  withAuth(handler, { permissions: 'resource:action' })
);
```

✅ **Correct**:
```typescript
const authHandler = withAuth(handler, { permissions: 'resource:action' });
export const GET = withRateLimit(authHandler);
```

**Why**: Rate limiting should be OUTER middleware (checked first).

---

### Mistake 2: Missing Import

❌ **Error**:
```
Cannot find name 'withStandardRateLimit'
```

✅ **Fix**:
```typescript
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
```

---

### Mistake 3: Wrong Category

❌ **Wrong** (admin endpoint με STANDARD):
```typescript
export const POST = withStandardRateLimit(adminHandler); // 60/min - too permissive!
```

✅ **Correct**:
```typescript
export const POST = withSensitiveRateLimit(adminHandler); // 20/min - secure!
```

---

### Mistake 4: Forgetting to Export

❌ **Wrong**:
```typescript
const POST = withRateLimit(handler);
// NOT exported - route won't work!
```

✅ **Correct**:
```typescript
export const POST = withRateLimit(handler);
```

---

## 📊 Rate Limit Categories - Visual Comparison

```
HIGH        ████████████████████ 100/min  (Search, Fast Reads)
STANDARD    ████████████░░░░░░░░  60/min  (CRUD Operations)
WEBHOOK     ██████░░░░░░░░░░░░░░  30/min  (External Webhooks)
SENSITIVE   ████░░░░░░░░░░░░░░░░  20/min  (Admin, Auth)
TELEGRAM    ███░░░░░░░░░░░░░░░░░  15/min  (Telegram Bot)
HEAVY       ██░░░░░░░░░░░░░░░░░░  10/min  (Migrations, Processing)
```

**Rule of Thumb**:
- **Fast & Frequent** → HIGH (100/min)
- **Normal CRUD** → STANDARD (60/min)
- **Security-Critical** → SENSITIVE (20/min)
- **Resource-Intensive** → HEAVY (10/min)
- **When in doubt** → STANDARD (60/min)

---

## 🎯 Priority Implementation Order

```
1. SENSITIVE (31 routes)  🔴 ΚΡΙΣΙΜΟ - START HERE!
   └─► Admin, Auth, Security endpoints

2. HEAVY (15 routes)      🟠 HIGH
   └─► Migrations, Batch operations

3. STANDARD (37 routes)   🟡 MEDIUM
   └─► CRUD operations

4. HIGH/WEBHOOK (11 routes) 🟢 LOW
   └─► Search, Webhooks
```

---

## 📝 Commit Message Templates

### Single Route
```bash
git commit -m "feat: add rate limiting to /api/admin/bootstrap-admin (SENSITIVE - 20/min)"
```

### Multiple Routes (Same Category)
```bash
git commit -m "feat: add rate limiting to admin endpoints (SENSITIVE - 20/min)

- /api/admin/bootstrap-admin
- /api/admin/set-user-claims
- /api/admin/setup-admin-config"
```

### Bulk Implementation
```bash
git commit -m "feat: add rate limiting to all STANDARD CRUD endpoints (60/min)

Implemented withStandardRateLimit for 37 routes:
- Buildings, Projects, Units, Floors
- Parking, Storages, Companies
- Contacts, Relationships
- Notifications, Messages

Coverage: 38/94 routes (40%)"
```

---

## 🚀 Fastest Implementation Workflow

### Step 1: Open Route File
```bash
code src/app/api/admin/bootstrap-admin/route.ts
```

### Step 2: Add Import (Top of File)
```typescript
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
```

### Step 3: Extract Handler Function
**Before**:
```typescript
export async function POST(request: NextRequest): Promise<NextResponse> {
  // ... logic
}
```

**After**:
```typescript
async function handleBootstrapAdmin(request: NextRequest): Promise<NextResponse> {
  // ... logic (copy-paste from above)
}
```

### Step 4: Wrap & Export
```typescript
export const POST = withSensitiveRateLimit(handleBootstrapAdmin);
```

### Step 5: Verify
```bash
npx tsc --noEmit
# ✅ No errors → Good to go!
```

### Step 6: Test
```bash
curl -X POST http://localhost:3000/api/admin/bootstrap-admin
# ✅ Check for X-RateLimit-* headers
```

### Step 7: Commit
```bash
git add src/app/api/admin/bootstrap-admin/route.ts
git commit -m "feat: add rate limiting to bootstrap-admin (SENSITIVE - 20/min)"
```

**Time**: ~2-3 minutes per route!

---

## 🔗 Related Files

### Core Files
- **Rate Limit Middleware**: `src/lib/middleware/with-rate-limit.ts`
- **Rate Limit Config**: `src/lib/middleware/rate-limit-config.ts`
- **Rate Limiter**: `src/lib/middleware/rate-limiter.ts`

### Documentation
- **Implementation Plan**: `RATE_LIMITING_IMPLEMENTATION_PLAN.md`
- **Special Cases**: `RATE_LIMITING_SPECIAL_CASES.md`
- **This Guide**: `RATE_LIMITING_QUICK_REFERENCE.md`

### Environment
```env
# .env.local (required για rate limiting)
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
RATE_LIMIT_IP_SALT=your-secret-salt
```

---

## 📞 Need Help?

### Category Selection Confusion?
1. Check `RATE_LIMITING_IMPLEMENTATION_PLAN.md` Table
2. Look at route keywords (admin? migration? CRUD?)
3. When in doubt: use STANDARD (60/min)

### Implementation Issues?
1. Check `RATE_LIMITING_SPECIAL_CASES.md` for edge cases
2. Verify import statement
3. Test with `npx tsc --noEmit`

### Testing Problems?
1. Ensure Upstash Redis is configured (check `.env.local`)
2. Verify headers with `curl -i`
3. Check browser Network tab (DevTools)

---

**END OF QUICK REFERENCE**

Γιώργο, αυτό το guide είναι perfect για γρήγορη υλοποίηση! 🚀

Copy-paste templates + 2-3 minutes per route = DONE! ✅
