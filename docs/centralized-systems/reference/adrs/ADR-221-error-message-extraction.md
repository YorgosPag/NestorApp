# ADR-221: Error Message Extraction Centralization

## Status
✅ **ACTIVE** — Phase 1 Implemented (2026-03-13)

## Context

Audit found **874 occurrences** of the pattern `err instanceof Error ? err.message : 'Unknown error'` across **402 files**. Every catch block re-implements the same error extraction logic with 4 inconsistent fallback patterns:

| Pattern | Occurrences |
|---------|-------------|
| `'Unknown error'` | 357 |
| `String(err)` | 275 |
| `'Failed to...'` | 150 |
| Greek fallbacks | 19 |

`ApiErrorHandler.extractErrorMessage()` already did the same thing but was `private` and not reusable.

## Decision

Create a single centralized `getErrorMessage()` function in `src/lib/error-utils.ts` that replaces all scattered error extraction patterns.

## SSoT (Single Source of Truth)

**File**: `src/lib/error-utils.ts`

```typescript
export function getErrorMessage(error: unknown, fallback = 'Unknown error'): string
```

### Capabilities
- **String errors**: Returns the string directly
- **Error instances**: Returns `.message`
- **Objects with `.message`**: Returns the string `.message` property
- **Objects with `.error`**: Returns the string `.error` property
- **Everything else**: Returns the `fallback` parameter (default: `'Unknown error'`)

### Usage

```typescript
import { getErrorMessage } from '@/lib/error-utils';

// Basic usage (fallback: 'Unknown error')
catch (err) {
  console.error(getErrorMessage(err));
}

// Custom fallback
catch (err) {
  setError(getErrorMessage(err, 'Failed to load data'));
}
```

## Migration

### Phase 1 (2026-03-13): 30 files, ~210 occurrences
Files with 5+ occurrences migrated. `ApiErrorHandler.extractErrorMessage()` now delegates to `getErrorMessage()`.

### Phase 2 (future): Remaining ~660 occurrences
Incremental migration as files are touched (migrate-on-touch strategy).

## Edge Cases — NOT migrated
- Firebase auth error code mapping (`AuthContext.tsx`)
- Patterns accessing `error.stack` (need `instanceof` for type narrowing)
- Test/debug files with trivial one-off usage

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-13 | Phase 1: Created `error-utils.ts`, migrated 30 files | Claude |
