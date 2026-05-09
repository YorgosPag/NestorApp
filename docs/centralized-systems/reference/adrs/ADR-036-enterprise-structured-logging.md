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

---
