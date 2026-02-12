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

### Changelog

| Date | Change |
|------|--------|
| 2026-02-12 | Migrated 6 unconditional `console.log` in `DxfViewerContent.tsx` (core render flow) to `dlog('DxfViewerContent', ...)` |

---
