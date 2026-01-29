# API Contract Migration Plan

## Overview

**Status**: Migration Mode (warn + fallback)
**Target**: Strict enforcement after all endpoints migrate

## Current State

### enterprise-api-client.ts (Line 577-586)
```typescript
// 🚨 CONTRACT VIOLATION: 200 OK but not canonical format
// MIGRATION MODE: Log warning but allow raw response for backwards compatibility
// TODO: Switch to strict enforcement after all 71 endpoints migrate to apiSuccess()
console.warn(
  `⚠️ [API Contract] ${context.url} returned 200 but not canonical format. ` +
  `Keys: [${keys.join(', ')}]. Migrate to apiSuccess() from ApiErrorHandler.`
);
return json as T;
```

## Canonical Response Format

All API endpoints MUST return:

```typescript
// Success Response
{
  success: true,
  data: T,
  timestamp: string,
  requestId?: string
}

// Error Response
{
  success: false,
  error: string,
  errorCode?: string,
  timestamp: string,
  requestId?: string
}
```

## Migration Helper

Use `apiSuccess()` from `@/lib/api/ApiErrorHandler`:

```typescript
import { apiSuccess } from '@/lib/api/ApiErrorHandler';

// Before (non-compliant)
return NextResponse.json({ items: data });

// After (compliant)
return apiSuccess(data);
```

## Migration Phases

### Phase 1: Discovery (COMPLETED)
- [x] Identify 71 endpoints using direct fetch()
- [x] Implement warn+fallback in enterprise-api-client
- [x] Create apiSuccess() helper

### Phase 2: Gradual Migration (IN PROGRESS)
- [ ] Migrate endpoints as they are touched
- [ ] Track migration progress in worklog
- [ ] No breaking changes (warn+fallback active)

### Phase 3: Strict Enforcement (FUTURE)
- [ ] All endpoints return canonical format
- [ ] Remove warn+fallback, enable strict mode
- [ ] ContractViolationError thrown for violations

## Migration Tracking

Run to find non-compliant endpoints:
```bash
grep -r "NextResponse.json" src/app/api --include="*.ts" | grep -v "apiSuccess"
```

## Feature Flag (Optional)

To enable strict mode before full migration:
```typescript
// In enterprise-api-client.ts
const STRICT_CONTRACT_MODE = process.env.STRICT_API_CONTRACT === 'true';

if (!STRICT_CONTRACT_MODE) {
  console.warn(`⚠️ [API Contract] ...`);
  return json as T;
} else {
  throw new ContractViolationError(...);
}
```

## References

- `src/lib/api/enterprise-api-client.ts` - API client with contract validation
- `src/lib/api/ApiErrorHandler.ts` - apiSuccess() helper
- `docs/worklogs/` - Migration progress logs
