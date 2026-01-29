# PR-1C: Rate Limiting

**Status**: Ready for Testing
**Created**: 2026-01-29
**Author**: Claude (Anthropic AI)
**Priority**: BLOCKER #3 (Security Gate)

---

## Executive Summary

This PR implements **centralized rate limiting** for all API endpoints. Prevents DoS attacks, resource abuse, and billing explosion by limiting requests per user per time window.

### Key Changes

1. **Rate Limiter Module**: `src/lib/middleware/rate-limiter.ts`
2. **Middleware Wrapper**: `src/lib/middleware/with-rate-limit.ts`
3. **Configurable Limits**: Per-category limits (HIGH, STANDARD, SENSITIVE, HEAVY, WEBHOOK)
4. **HTTP Headers**: Standard rate limit headers on all responses

---

## Security Analysis

### Attack Vectors Mitigated

| Attack | Before PR-1C | After PR-1C |
|--------|--------------|-------------|
| **DoS** | Unlimited requests | Limited per user |
| **Credential stuffing** | Unlimited attempts | 20/minute (SENSITIVE) |
| **Scraping** | Unlimited | 100/minute (HIGH) |
| **Report abuse** | Unlimited exports | 10/minute (HEAVY) |
| **Webhook spam** | Unlimited | 30/minute (WEBHOOK) |

### Rate Limit Configuration

| Category | Limit | Use Case |
|----------|-------|----------|
| **HIGH** | 100/min | Search, list endpoints |
| **STANDARD** | 60/min | CRUD operations |
| **SENSITIVE** | 20/min | Admin, financial |
| **HEAVY** | 10/min | Reports, exports |
| **WEBHOOK** | 30/min | External webhooks |

---

## Implementation Architecture

### Sliding Window Algorithm

```
┌────────────────────────────────────────────────────────────────────┐
│                    Sliding Window Rate Limiter                      │
├────────────────────────────────────────────────────────────────────┤
│  Window: 60 seconds                                                 │
│                                                                      │
│  Request arrives at t=0    ────────────────────────────┐            │
│                                                         │            │
│  ┌─────────────────────────────────────────────────────┴──────────┐ │
│  │ t=-60s                                              t=0         │ │
│  │  │                                                   │          │ │
│  │  ├──X──X──X──X──X──X──X──X──X──X──────────────────X──┤          │ │
│  │  │  │  │  │  │  │  │  │  │  │  │                  │  │          │ │
│  │  │  └──┴──┴──┴──┴──┴──┴──┴──┴──┘                  │  │          │ │
│  │  │      Past requests (in window)                 NEW │          │ │
│  │  │                                                     │          │ │
│  │  └── Window slides with each request ────────────────┘          │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Count = requests where timestamp > (now - windowMs)                │
│  Allowed = count < limit                                            │
└────────────────────────────────────────────────────────────────────┘
```

### Module Structure

```
src/lib/middleware/
├── rate-limiter.ts      # Core rate limiting logic
├── with-rate-limit.ts   # Middleware wrapper for handlers
└── index.ts             # Module exports
```

---

## Usage

### Basic Usage

```typescript
import { withRateLimit } from '@/lib/middleware';

// Apply rate limiting to a handler
export const GET = withRateLimit(myHandler);
```

### With Auth Middleware

```typescript
import { withAuth } from '@/lib/auth';
import { withRateLimit } from '@/lib/middleware';

// Rate limit + auth
export const GET = withRateLimit(
  withAuth(handler, { permissions: 'projects:view' }),
  { category: 'HIGH' }
);
```

### Pre-configured Wrappers

```typescript
import {
  withHighRateLimit,      // 100/min
  withStandardRateLimit,  // 60/min
  withSensitiveRateLimit, // 20/min
  withHeavyRateLimit,     // 10/min
  withWebhookRateLimit,   // 30/min
} from '@/lib/middleware';

// For search endpoints
export const GET = withHighRateLimit(searchHandler);

// For admin endpoints
export const GET = withSensitiveRateLimit(adminHandler);

// For report generation
export const GET = withHeavyRateLimit(reportHandler);
```

### Custom Key Extraction

```typescript
// Use API key instead of auth token
export const GET = withRateLimit(handler, {
  getKey: (req) => req.headers.get('x-api-key'),
});
```

### Skip Rate Limiting

```typescript
// Skip for internal service calls
export const GET = withRateLimit(handler, {
  skip: (req) => req.headers.get('x-internal-service') === 'true',
});
```

---

## HTTP Response Headers

All responses include rate limit headers:

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 45
X-RateLimit-Category: STANDARD
```

### Rate Limited Response (429)

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please wait 45 seconds before retrying.",
  "category": "STANDARD",
  "limit": 60,
  "current": 60,
  "retryAfterSeconds": 45
}
```

Headers:
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 45
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 45
```

---

## Endpoint Category Mapping

### Auto-Detection

The middleware auto-detects categories based on path prefixes:

| Path Pattern | Category | Limit |
|--------------|----------|-------|
| `/api/admin/*` | SENSITIVE | 20/min |
| `/api/search/*` | HIGH | 100/min |
| `/api/projects/list` | HIGH | 100/min |
| `/api/reports/*` | HEAVY | 10/min |
| `/api/export/*` | HEAVY | 10/min |
| `/api/communications/webhooks/*` | WEBHOOK | 30/min |
| Everything else | STANDARD | 60/min |

### Override Auto-Detection

```typescript
// Force SENSITIVE category regardless of path
export const GET = withRateLimit(handler, { category: 'SENSITIVE' });
```

---

## Memory Management

### Automatic Cleanup

- Expired entries cleaned every 60 seconds
- Entries removed when no requests in window
- Memory grows linearly with active users

### Monitoring

```typescript
import { getRateLimitStats } from '@/lib/middleware';

const stats = getRateLimitStats();
console.log(stats);
// { totalEntries: 150, entriesByCategory: { HIGH: 50, STANDARD: 80, ... } }
```

---

## Production Considerations

### Single Instance vs Multi-Instance

**Current Implementation**: In-memory storage (single instance)

**For Multi-Instance Deployment**:
1. Replace `Map` with Redis
2. Use `SETNX` + `EXPIRE` for atomic operations
3. Consider using Redis Cluster for scalability

### Tuning Limits

Monitor these metrics:
- Rate limit violations per endpoint
- User complaint rate
- Resource utilization

Adjust `RATE_LIMIT_CONFIG.LIMITS` based on:
- Peak traffic patterns
- User behavior analysis
- Resource capacity

---

## Testing

### Manual Test Cases

1. **Standard endpoint**:
   - Make 60 requests/minute → All pass
   - Make 61st request → 429 response

2. **Sensitive endpoint**:
   - Make 20 requests/minute → All pass
   - Make 21st request → 429 response

3. **Headers check**:
   - Verify `X-RateLimit-*` headers present
   - Verify `Retry-After` on 429

### Test Commands

```bash
# Test rate limiting manually
for i in {1..65}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    http://localhost:3000/api/projects/list \
    -H "Authorization: Bearer <token>"
done

# Expected: 60 "200" responses, then "429" responses
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Legitimate users blocked | Low | Medium | Generous limits, clear error messages |
| Memory exhaustion | Low | High | Automatic cleanup, entry limit |
| Clock skew issues | Low | Low | Uses relative timestamps |

---

## Rollback Plan

If issues found after merge:

1. Remove `withRateLimit` wrappers from handlers
2. Or set all limits to very high values:
   ```typescript
   LIMITS: {
     HIGH: 10000,
     STANDARD: 10000,
     // ...
   }
   ```

---

## Acceptance Criteria

- [x] **AC-1**: Rate limiter module created with sliding window
- [x] **AC-2**: Middleware wrapper created for handlers
- [x] **AC-3**: Pre-configured wrappers for each category
- [x] **AC-4**: HTTP headers included in responses
- [x] **AC-5**: 429 response with retry-after
- [x] **AC-6**: Memory cleanup scheduler active
- [x] **AC-7**: Module exports centralized in index.ts
- [ ] **AC-8**: Manual testing with rate limit scenarios

---

## Local_Protocol Compliance

- [x] No `any` types
- [x] No `as any`
- [x] No `@ts-ignore`
- [x] No inline styles
- [x] No duplicates (centralized module)
- [x] No hardcoded values (all in RATE_LIMIT_CONFIG)

---

## Files Created

| File | Purpose |
|------|---------|
| `src/lib/middleware/rate-limiter.ts` | Core rate limiting logic |
| `src/lib/middleware/with-rate-limit.ts` | Middleware wrapper |
| `src/lib/middleware/index.ts` | Module exports |
| `docs/prs/PR-1C-rate-limiting.md` | This documentation |

---

## Integration Steps

After merging, apply rate limiting to critical endpoints:

1. **Admin routes**: `src/app/api/admin/**`
2. **Search routes**: `src/app/api/search/**`
3. **Webhook routes**: `src/app/api/communications/webhooks/**`
4. **Export routes**: `src/app/api/export/**`

Example integration:

```typescript
// Before
export const GET = withAuth(handler, options);

// After
import { withSensitiveRateLimit } from '@/lib/middleware';
export const GET = withSensitiveRateLimit(withAuth(handler, options));
```

---

## Next Steps

After this PR is merged:

1. **PR-2**: Data Migration (companyId backfill)
2. **PR-3**: Production Readiness & Observability
3. **Apply rate limiting** to all existing API routes

---

## Related Documentation

- **Auth Middleware**: `src/lib/auth/middleware.ts`
- **Telegram Rate Limit**: `src/app/api/communications/webhooks/telegram/message/rate-limit.ts`
- **Security Audit**: `SECURITY_AUDIT_REPORT.md`

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-29 | Claude (Anthropic AI) | Initial PR documentation |
