# ADR-036: Enterprise Structured Logging

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Performance |
| **Canonical Location** | `Logger` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `Logger` from `@/lib/telemetry`
- **DXF Viewer**: `dlog()` from `debug/core/UnifiedDebugManager` (parallel system — module-aware debug logging)
- **Deprecated**: `console.log/warn/info/debug`
- **ESLint**: `custom/no-console-log` (warn mode)

### DXF Viewer Debug System

The DXF Viewer subapp uses `UnifiedDebugManager` with `dlog(module, ...args)` instead of the main app's `createModuleLogger()`. This is by design — the DXF Viewer debug system supports module-level enable/disable flags for high-frequency rendering logs.

| Function | Signature | Usage |
|----------|-----------|-------|
| `dlog` | `(module: string, ...args: unknown[])` | Debug-level logging |
| `dwarn` | `(module: string, ...args: unknown[])` | Warning-level logging |
| `derr` | `(module: string, ...args: unknown[])` | Error-level logging |

**Import**: `import { dlog } from '../debug';`

---

## Log Level Semantics (industry-standard)

| Level | Semantics | Examples |
|-------|-----------|----------|
| **DEBUG** | High-frequency trace, per-event, per-snapshot, per-fetch | Firestore snapshot received, cache hit, intermediate auth flow steps, optimistic update applied, subscription cleanup |
| **INFO**  | Significant business event (low-frequency, ~1× per user action) | Login success, task created, email sent, MFA verification successful, server session established |
| **WARN**  | Unexpected but recoverable | Failed to load custom claims (non-blocking), session sync failed (non-blocking), session revoked remotely |
| **ERROR** | Failure path, requires attention | Firestore subscribe error, MFA verification failed, auto-logout failure |

### Default thresholds (createModuleLogger)

| Env | Default level | Reason |
|-----|---------------|--------|
| `NODE_ENV=development` | `DEBUG` | Local dev needs full trace |
| `NODE_ENV=production`  | `INFO`  | Suppress per-event noise, keep business events |

Override globally with `NEXT_PUBLIC_LOG_LEVEL=debug|info|warn|error`. Per-module override: `createModuleLogger('X', LogLevel.WARN)`.

### Anti-pattern

❌ Raising default threshold to `WARN` to silence noisy `info` logs. Fixes the symptom (console flood), masks the cause (mis-leveled statements). Demote the statement instead.

---

### Changelog

| Date | Change |
|------|--------|
| 2026-02-12 | Migrated 6 unconditional `console.log` in `DxfViewerContent.tsx` (core render flow) to `dlog('DxfViewerContent', ...)` |
| 2026-05-09 | Codified Log Level Semantics + default thresholds. Reverted `createModuleLogger` default from `WARN` (silenced everything) back to dev-DEBUG / prod-INFO. Demoted per-snapshot / per-event `info` logs in `useRealtimeTasks`, `useRealtimeOpportunities`, `AuthContext`, `opportunities-client.service` to `debug`. |
| 2026-05-09 | Demoted 9 mis-leveled `info` → `debug` after suppress-console removal exposed dev-mode noise. Per-snapshot/per-fetch logs in `useRealtimeBuildings` (2x), `useFirestoreBuildings`, `useFloorplanFiles`, `useObligations` (3x), `enterprise-api-client` (2x request+response). Boy Scout cleanup matching ADR-036 anti-pattern guidance ("Demote the statement instead"). `useRealtimeMessages` deferred — touching it would require adding missing composite index (`companyId+conversationId+createdAt`) per CHECK 3.15, out of scope. |
| 2026-05-09 | **Deprecated `public/suppress-console.js`** (597-line global console monkey-patch, 250+ hardcoded `BLOCKED_*_PATTERNS` arrays, `unhandledrejection` filter masking Firestore permission errors, `?showErrors=1` opt-in bypass). Replaced by `public/react-bugfix-guards.js` (preserves only the React 19.2.1 `String.prototype.repeat` guard). Production silence now via `NEXT_PUBLIC_LOG_LEVEL=warn` env var on Netcup — no global console override. React DevTools "Default levels" dropdown handles user-side noise filtering. Migration: layout.tsx Script src updated; `window.__ENTERPRISE_CONSOLE__` global removed (no callsites). Firestore "Missing or insufficient permissions" errors now surface in console — fix at source via Firestore rules, do not re-suppress. |

---

## Migration Notes — Console Suppression Removal (2026-05-09)

### What changed
- `public/suppress-console.js` — **deleted**
- `public/react-bugfix-guards.js` — **new** (~20 lines, only React repeat guard)
- `src/app/layout.tsx` — `<Script src>` updated to new file
- `.env.example` — documented `NEXT_PUBLIC_LOG_LEVEL` (default: dev-DEBUG, prod-INFO; recommended prod = `warn`)

### Why
The old `suppress-console.js` was a layered hack:
1. Monkey-patched `console.log/warn/error/info/debug/group/groupCollapsed`
2. 250+ hardcoded string patterns in 4 arrays (DXF, performance, production, React) — high maintenance burden
3. Global `window.__ENTERPRISE_CONSOLE__` escape hatch (no callsites — only self-reference)
4. `unhandledrejection` filter swallowing `"Missing or insufficient permissions"` Firestore errors, masking rules bugs
5. CSS chunk `SyntaxError` filter (stale Vercel cache hack — Vercel paused, Netcup deploy)
6. `?showErrors=1` URL opt-in to bypass own filter — symptom of fragile architecture

### What stays
- React 19.2.1 `String.prototype.repeat` guard (browser side: `react-bugfix-guards.js`; server side: `instrumentation.ts`)
- Logger SSoT (`createModuleLogger`) with per-module prefix + level via `NEXT_PUBLIC_LOG_LEVEL`
- ESLint `custom/no-console-log` rule (warn mode)

### Production silence pattern
- Set `NEXT_PUBLIC_LOG_LEVEL=warn` on Netcup env vars
- Logger drops `debug`/`info` calls at threshold check (Logger.ts L403)
- No global console override — `console.error` from third-party code surfaces normally

### React internal noise
Filter at the user side via DevTools → Console → "Default levels" dropdown. Not the app's responsibility.

---
