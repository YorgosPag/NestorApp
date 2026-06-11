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

Default level is **side-aware** (2026-06-11 — was `dev=DEBUG / prod=INFO`):

| Runtime side | Default level | Reason |
|--------------|---------------|--------|
| **Browser** (`typeof window !== 'undefined'`) | `WARN` | Product-console hygiene — the user's DevTools console shows only warnings/errors out of the box (Revit / Google / VS-Code-grade). DEBUG/INFO are opt-in. |
| **Server** (Node / SSR / route handlers) | `INFO` | Production observability — business and lifecycle events must still reach server logs / telemetry. |

Resolution order (highest → lowest): explicit `level` arg → `localStorage['LOG_LEVEL']` (browser runtime override, no rebuild — refresh re-reads) → `NEXT_PUBLIC_LOG_LEVEL` (build-time env) → side-aware default. String→enum parsing is the SSoT `parseLogLevel` helper. Per-module override: `createModuleLogger('X', LogLevel.WARN)`.

### Anti-pattern

❌ Raising the **server** default threshold to `WARN` to silence noisy server-side `info` logs. Fixes the symptom (log flood), masks the cause (mis-leveled statements) and hides genuine business events from observability. Demote the individual statement to `debug` instead.

✅ The **browser** `WARN` default is NOT this anti-pattern: it is deliberate product-console hygiene for the END-USER's DevTools (a clean console is a product feature, like Revit's), it does not touch server observability, and it is fully opt-out per-session (`localStorage.setItem('LOG_LEVEL','info'|'debug')`). Mis-leveled statements should STILL be demoted when spotted (boy-scout) so server `INFO` logs stay meaningful — the two policies are complementary, not substitutes.

---

### Changelog

| Date | Change |
|------|--------|
| 2026-02-12 | Migrated 6 unconditional `console.log` in `DxfViewerContent.tsx` (core render flow) to `dlog('DxfViewerContent', ...)` |
| 2026-05-09 | Codified Log Level Semantics + default thresholds. Reverted `createModuleLogger` default from `WARN` (silenced everything) back to dev-DEBUG / prod-INFO. Demoted per-snapshot / per-event `info` logs in `useRealtimeTasks`, `useRealtimeOpportunities`, `AuthContext`, `opportunities-client.service` to `debug`. |
| 2026-05-09 | Demoted 9 mis-leveled `info` → `debug` after suppress-console removal exposed dev-mode noise. Per-snapshot/per-fetch logs in `useRealtimeBuildings` (2x), `useFirestoreBuildings`, `useFloorplanFiles`, `useObligations` (3x), `enterprise-api-client` (2x request+response). Boy Scout cleanup matching ADR-036 anti-pattern guidance ("Demote the statement instead"). |
| 2026-05-09 | Demoted final `useRealtimeMessages` info→debug + added missing composite index `messages: companyId+conversationId+createdAt(desc)` to `firestore.indexes.json` to satisfy CHECK 3.15 (Firestore Index Coverage). Deploy via `firebase deploy --only firestore:indexes --project pagonis-87766` (build ~2-5 min). |
| 2026-05-09 | **Deprecated `public/suppress-console.js`** (597-line global console monkey-patch, 250+ hardcoded `BLOCKED_*_PATTERNS` arrays, `unhandledrejection` filter masking Firestore permission errors, `?showErrors=1` opt-in bypass). Replaced by `public/react-bugfix-guards.js` (preserves only the React 19.2.1 `String.prototype.repeat` guard). Production silence now via `NEXT_PUBLIC_LOG_LEVEL=warn` env var on Netcup — no global console override. React DevTools "Default levels" dropdown handles user-side noise filtering. Migration: layout.tsx Script src updated; `window.__ENTERPRISE_CONSOLE__` global removed (no callsites). Firestore "Missing or insufficient permissions" errors now surface in console — fix at source via Firestore rules, do not re-suppress. |
| 2026-06-11 | **Side-aware default level + runtime override (browser console hygiene)**. Reported by Giorgio: browser DevTools console flooded with `[DEBUG]`/`[INFO]` on every page load (60fps building-subscription debug, per-request API traces, lifecycle INFO). Two root causes. **(1) Dev default was `DEBUG`** → all trace-level logs printed in the browser. Changed `createModuleLogger` default to **side-aware**: browser (`typeof window !== 'undefined'`) → `WARN` (product-console hygiene, only warnings/errors surface — Revit/Google/VS-Code-grade), server → `INFO` (production observability preserved). DEBUG/INFO now opt-in. **(2) No runtime knob** → silencing required an env change + rebuild. Added `localStorage['LOG_LEVEL']` browser override (read at logger-construction time, refresh re-reads; mirrors Firebase `setLogLevel` / `debug` pkg's `localStorage.debug`) with resolution order: explicit arg → localStorage → `NEXT_PUBLIC_LOG_LEVEL` → side-aware default. Extracted SSoT `parseLogLevel` helper (env + localStorage share it). **Anti-pattern reconciliation**: the existing "don't raise threshold to WARN to silence noisy info" rule still holds for SERVER-side — the browser `WARN` default is deliberate end-user product hygiene (opt-out per-session via localStorage), not a server-observability mask; mis-leveled statements should still be demoted boy-scout. Also: SSoT-routed raw `console.*` that bypassed the Logger (so weren't gated) in `useCircleTTT`/`useLinePerpendicular`/`useLineParallel`, `preloadRoutes`, `DxfPerformanceOptimizer`, `consoleLoggerAdapter` (settings-sync `LoggerPort`). **Killed the surviving `[DEBUG] [DxfFirestore]` flood**: `dxf-firestore-logger.ts` was a hand-rolled `new Logger({ level: dev ? DEBUG : ERROR })` that bypassed the SSoT factory entirely (so neither the side-aware default nor the localStorage override reached it) → routed through `createModuleLogger('DxfFirestore')`. **Demoted** the per-request `[API Contract] … not canonical format` warn → `debug` in `enterprise-api-client.ts` (tracked dev tech-debt in `API_CONTRACT_MIGRATION_PLAN.md`, not user-actionable — the canonical example of "demote, don't suppress"). Deferred (separate monorepo package, relative imports, no `@/` alias → must not depend on `src/`): `packages/core/alert-engine` (~45 raw console, init-only). Files: `src/lib/telemetry/Logger.ts`, `dxf-firestore-logger.ts`, `enterprise-api-client.ts`, `consoleLoggerAdapter.ts`. ⚠️ Requires dev-server FULL restart (HMR caches the old Logger module). | Opus 4.8 |

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
