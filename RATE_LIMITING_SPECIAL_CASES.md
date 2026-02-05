# 🔍 Rate Limiting Special Cases & Edge Cases

**Date**: 2026-02-06
**Purpose**: Detailed analysis για routes που χρειάζονται ειδική προσοχή

---

## 🚨 Critical Security Routes (Highest Risk)

### 1. Admin Bootstrap Endpoint
**Route**: `/api/admin/bootstrap-admin`
**Current**: NO rate limiting
**Risk Level**: 🔴 CRITICAL

**Why Critical**:
- Creates super_admin users (highest privilege)
- One-time use protection στο code, αλλά ΟΧΙ rate limiting
- Could be bruteforced για development environments

**Recommended**:
```typescript
// EXTRA strict rate limit για bootstrap
export const POST = withSensitiveRateLimit(
  handleBootstrapAdmin,
  {
    category: 'SENSITIVE', // 20 req/min
    getKey: (req) => {
      // Use IP-based rate limiting για bootstrap (no user auth yet)
      const ip = req.headers.get('x-forwarded-for') || 'unknown';
      return `bootstrap:${hashIpAddress(ip)}`;
    }
  }
);
```

**Additional Protection**:
- Consider EVEN LOWER limit (5 req/min) για bootstrap
- Alert on ANY usage (should only be called once ever)

---

### 2. Migration Execution Endpoints
**Routes**:
- `/api/admin/migrations/execute`
- `/api/admin/migrations/execute-admin`
- `/api/admin/migrations/normalize-floors`

**Current**: NO rate limiting
**Risk Level**: 🔴 CRITICAL

**Why Critical**:
- System-wide database changes
- Can affect ALL tenants (not tenant-scoped)
- CPU/memory intensive operations
- Could DoS the entire application

**Recommended**:
```typescript
// HEAVY rate limit (10 req/min) is NOT ENOUGH
// Migrations should be EXTREMELY restricted
export const POST = withHeavyRateLimit(migrationHandler);

// BETTER: Custom ultra-low limit
export const POST = withRateLimit(migrationHandler, {
  category: 'HEAVY',
  customLimit: 3, // Only 3 migrations per minute
  customWindow: 300000, // 5-minute window
});
```

**Additional Recommendations**:
- Add manual confirmation step (2FA for migrations)
- Require explicit super_admin approval
- Log ALL migration attempts to separate audit log

---

### 3. User Claims Management
**Route**: `/api/admin/set-user-claims`
**Current**: NO rate limiting
**Risk Level**: 🔴 CRITICAL

**Why Critical**:
- Changes user permissions (globalRole, companyId)
- Could escalate privileges
- Affects authentication/authorization

**Recommended**:
```typescript
export const POST = withSensitiveRateLimit(setUserClaimsHandler);
```

**Additional Protection**:
- Alert on ANY role changes to super_admin
- Require MFA for role elevation
- Audit log με before/after values

---

## ⚠️ High-Risk Data Modification Routes

### 4. Batch Operations
**Routes**:
- `/api/buildings/populate` (creates multiple buildings)
- `/api/projects/create-for-companies` (batch project creation)
- `/api/contacts/add-real-contacts` (batch contact creation)

**Current**: NO rate limiting
**Risk Level**: 🟠 HIGH

**Why High-Risk**:
- Create multiple records in one request
- Can exceed Firestore quota limits
- Memory/CPU intensive

**Recommended**:
```typescript
export const POST = withHeavyRateLimit(batchHandler);
```

**Additional Recommendations**:
- Add batch size limits (max 100 items per request)
- Implement pagination για large datasets
- Add progress tracking για long-running batches

---

### 5. Data Fix Endpoints
**Routes**:
- `/api/fix-companies`
- `/api/fix-projects`
- `/api/buildings/fix-project-ids`
- `/api/projects/fix-company-ids`

**Current**: NO rate limiting
**Risk Level**: 🟠 HIGH

**Why High-Risk**:
- Modify existing data (no rollback)
- Could break relationships if buggy
- Affect multiple tenants

**Recommended**:
```typescript
export const POST = withSensitiveRateLimit(fixHandler);
```

**Additional Recommendations**:
- ALWAYS run with dry-run first
- Backup data before fixes
- Add rollback mechanism
- Limit to super_admin only (no company_admin access)

---

## 🔄 Webhook Endpoints (Special Handling)

### 6. Telegram Webhook
**Route**: `/api/communications/webhooks/telegram`
**Current**: NO rate limiting
**Risk Level**: 🟡 MEDIUM

**Current Implementation**:
```typescript
export async function POST(request: NextRequest): Promise<NextResponse> {
  return handlePOST(request);
}
```

**Recommended**:
```typescript
import { withTelegramRateLimit } from '@/lib/middleware/with-rate-limit';

export const POST = withTelegramRateLimit(handlePOST);
```

**Why TELEGRAM category**:
- Telegram has own rate limits (30 msg/sec)
- Webhook signature verification already exists
- Need to allow burst traffic from legitimate users
- Limit: 15 req/min (balanced για chat applications)

**Additional Protection**:
- Verify Telegram webhook signature BEFORE processing
- Rate limit per chat_id (not just global)
- Implement queue για webhook processing (like Mailgun)

---

### 7. Sendgrid Webhooks
**Routes**:
- `/api/webhooks/sendgrid`
- `/api/webhooks/sendgrid/inbound`

**Current**: NO rate limiting
**Risk Level**: 🟡 MEDIUM

**Recommended**:
```typescript
import { withWebhookRateLimit } from '@/lib/middleware/with-rate-limit';

export const POST = withWebhookRateLimit(handleSendgridWebhook);
```

**Why WEBHOOK category**:
- External service (Sendgrid) controls request rate
- Need to handle burst traffic (email delivery events)
- Limit: 30 req/min (same as Mailgun)

**Additional Protection**:
- Verify Sendgrid webhook signature
- Implement idempotency (prevent duplicate processing)
- Add queue for async processing (like email-ingestion-worker)

---

### 8. Cron Endpoint
**Route**: `/api/cron/email-ingestion`
**Current**: NO rate limiting
**Risk Level**: 🟢 LOW (but needs protection)

**Why Special**:
- Triggered by Vercel Cron (every minute)
- Has CRON_SECRET verification
- NOT exposed to public

**Recommended**:
```typescript
import { withWebhookRateLimit } from '@/lib/middleware/with-rate-limit';

export const POST = withWebhookRateLimit(handleEmailIngestionCron);
```

**Why still add rate limiting**:
- Defense in depth (even with CRON_SECRET)
- Prevent abuse if secret leaks
- Protect against misconfigured cron jobs

**Additional Recommendations**:
- Consider SKIP rate limiting for verified Vercel Cron requests:
```typescript
export const POST = withRateLimit(handleCron, {
  skip: (req) => {
    // Skip rate limiting for verified Vercel Cron
    const authHeader = req.headers.get('authorization');
    return authHeader === `Bearer ${process.env.CRON_SECRET}`;
  }
});
```

---

## 🏗️ Heavy Processing Endpoints

### 9. Floorplan Processing
**Route**: `/api/floorplans/process`
**Current**: NO rate limiting
**Risk Level**: 🟠 HIGH

**Why High-Risk**:
- CPU/memory intensive (DXF parsing)
- In-memory mutex για concurrent processing
- Can timeout (5-minute limit)

**Current Protection**:
```typescript
const processingInProgress = new Set<string>();

if (processingInProgress.has(fileId)) {
  return NextResponse.json({ error: 'Already processing' }, { status: 409 });
}
```

**Recommended**:
```typescript
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';

export const POST = withHeavyRateLimit(handleFloorplanProcess);
```

**Why HEAVY category**:
- DXF parsing can take 5-30 seconds
- High memory usage (large files)
- Should limit concurrent processing
- Limit: 10 req/min (prevents resource exhaustion)

**Additional Recommendations**:
- Rate limit per user (not just global)
- Add file size limits (max 10MB for DXF)
- Implement background processing για large files
- Consider moving to queue-based processing (like email-ingestion)

---

### 10. File Upload/Download
**Routes**:
- `/api/upload/photo`
- `/api/download`

**Current**: NO rate limiting
**Risk Level**: 🟡 MEDIUM

**Recommended**:
```typescript
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';

export const POST = withStandardRateLimit(handlePhotoUpload);
export const GET = withStandardRateLimit(handleDownload);
```

**Why STANDARD (not HEAVY)**:
- File uploads go to Firebase Storage (not in-memory)
- Firebase Storage has own rate limits
- Average upload time: 1-3 seconds
- Limit: 60 req/min (allows reasonable user activity)

**Additional Recommendations**:
- Add file size limits (already exists: max 10MB)
- Rate limit per user (not just global)
- Monitor storage quota (Firebase free tier: 5GB)

---

## 🔍 Search & List Endpoints

### 11. Global Search
**Route**: `/api/search`
**Current**: NO rate limiting
**Risk Level**: 🟡 MEDIUM

**Why Needs Rate Limiting**:
- Firestore composite index queries (expensive)
- Can be used for data scraping
- High traffic endpoint (users search frequently)

**Recommended**:
```typescript
import { withHighRateLimit } from '@/lib/middleware/with-rate-limit';

const searchHandler = withAuth<ApiSuccessResponse<SearchResponseData>>(
  async (request, ctx, cache) => {
    // ... search logic
  },
  { permissions: 'search:global:execute' }
);

export const GET = withHighRateLimit(searchHandler);
```

**Why HIGH category**:
- Search is fast (< 100ms with indexes)
- Users expect instant results (no delay)
- Limit: 100 req/min (allows rapid typing/searching)

**Additional Recommendations**:
- Implement client-side debouncing (300ms delay before search)
- Cache search results (already implemented)
- Add query length validation (min 2 chars already exists)

---

### 12. List Endpoints
**Routes**:
- `/api/projects/list`
- `/api/contacts/list-companies`
- `/api/projects/by-company/[companyId]`

**Current**: NO rate limiting
**Risk Level**: 🟡 MEDIUM

**Why Needs Rate Limiting**:
- Return large datasets (100+ items)
- Used in grids/tables (frequent polling)
- Can be used for data scraping

**Recommended**:
```typescript
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';

export const GET = withStandardRateLimit(listHandler);
```

**Why STANDARD (not HIGH)**:
- List endpoints use caching (30s TTL)
- Less frequent than search (loaded once per page)
- Limit: 60 req/min (prevents polling abuse)

**Additional Recommendations**:
- Ensure caching is enabled (already exists για projects/list)
- Add pagination για large datasets
- Use Firestore cursor-based pagination (efficient)

---

## 📧 Communication Endpoints

### 13. Email Send
**Routes**:
- `/api/communications/email`
- `/api/communications/email/property-share`

**Current**: NO rate limiting
**Risk Level**: 🟠 HIGH

**Why High-Risk**:
- External API calls (Brevo/Mailgun)
- Cost per email (API quota)
- Could be used for spam

**Recommended**:
```typescript
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';

export const POST = withStandardRateLimit(sendEmailHandler);
```

**Why STANDARD**:
- Legitimate users send 5-10 emails per hour
- Not high-frequency operation
- Limit: 60 req/min (generous για normal use, blocks spam)

**Additional Recommendations**:
- Add daily email limit per user (100 emails/day)
- Validate email addresses (prevent abuse)
- Log ALL email sends για audit
- Monitor Brevo/Mailgun quota usage

---

## 🧪 Testing & Diagnostic Endpoints

### 14. Test/Diagnostic Routes
**Routes**:
- `/api/units/test-connection`
- `/api/floors/diagnostic`
- `/api/floors/enterprise-audit`

**Current**: NO rate limiting
**Risk Level**: 🟢 LOW

**Why Low-Risk**:
- Read-only operations (no data modification)
- Used for debugging/testing
- Low traffic

**Recommended**:
```typescript
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';

export const GET = withStandardRateLimit(diagnosticHandler);
```

**Why STANDARD**:
- Not high-frequency operations
- Can be resource-intensive (diagnostic queries)
- Limit: 60 req/min (prevents abuse)

**Additional Recommendations**:
- Consider restricting to development environment
- Add super_admin only access
- Return detailed error logs (already exists)

---

## 🔐 Authentication Endpoints

### 15. Session Management
**Route**: `/api/auth/session`
**Current**: NO rate limiting
**Risk Level**: 🔴 CRITICAL

**Why Critical**:
- Authentication endpoint (high-value target)
- Could be bruteforced
- Session token management

**Recommended**:
```typescript
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';

export const POST = withSensitiveRateLimit(sessionHandler);
```

**Why SENSITIVE**:
- Security-critical operation
- Limit: 20 req/min (prevents brute force)
- Stricter than normal CRUD

**Additional Recommendations**:
- Implement exponential backoff (increase delay after failed attempts)
- Add IP-based blocking (3 failed attempts = temp ban)
- Log ALL session creation attempts
- Alert on unusual session activity

---

### 16. MFA Enrollment
**Route**: `/api/auth/mfa/enroll/complete`
**Current**: NO rate limiting
**Risk Level**: 🟠 HIGH

**Why High-Risk**:
- Security feature (could be abused to disable MFA)
- One-time token validation
- Affects account security

**Recommended**:
```typescript
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';

export const POST = withSensitiveRateLimit(mfaEnrollHandler);
```

**Why SENSITIVE**:
- Security-critical operation
- Limit: 20 req/min (prevents token brute force)
- Stricter rate limiting needed

**Additional Recommendations**:
- Implement token expiration (5-minute window)
- Add attempt counter (max 5 attempts per enrollment)
- Require re-authentication for MFA changes
- Log ALL MFA enrollment attempts

---

## 🎯 Recommendations Summary

### Ultra-Critical (Custom Lower Limits)
1. **Bootstrap Admin**: 5 req/min (instead of 20)
2. **Migrations**: 3 req/5min (instead of 10/min)
3. **User Claims**: 10 req/min (instead of 20)

### Additional Protection Layers
1. **Rate Limiting + MFA**: για admin operations
2. **Rate Limiting + Signature Verification**: για webhooks
3. **Rate Limiting + Idempotency**: για batch operations
4. **Rate Limiting + Caching**: για list endpoints

### Monitoring Requirements
1. **Alert on 429 responses** > 5% για any endpoint
2. **Alert on rate limit violations** για SENSITIVE endpoints
3. **Daily report** με top rate-limited users
4. **Weekly audit** για rate limit effectiveness

---

## 📋 Implementation Checklist για Special Cases

### Πριν την Υλοποίηση
- [ ] Review route purpose & risk level
- [ ] Check existing security measures
- [ ] Determine appropriate rate limit category
- [ ] Consider custom limits για ultra-critical routes

### Κατά την Υλοποίηση
- [ ] Add rate limiting wrapper
- [ ] Test with rapid requests
- [ ] Verify 429 responses work
- [ ] Check headers (X-RateLimit-*)

### Μετά την Υλοποίηση
- [ ] Update documentation
- [ ] Add monitoring alerts
- [ ] Test in production
- [ ] Monitor for false positives

---

**END OF SPECIAL CASES ANALYSIS**

Γιώργο, αυτό το αρχείο περιέχει detailed analysis για τα routes που χρειάζονται ειδική προσοχή! 🎯
