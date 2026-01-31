# 🏗️ **INFRASTRUCTURE SYSTEMS**

> **Enterprise Documentation**: Performance, logging, authentication, and core infrastructure

**📊 Stats**: 8 ADRs | Last Updated: 2026-01-31

---

## 🎯 **RELATED ADRs**

| ADR | Decision | Status |
|-----|----------|--------|
| **ADR-019** | Centralized Performance Thresholds | ✅ APPROVED |
| **ADR-020** | Centralized Auth Module | ✅ APPROVED |
| **ADR-020.1** | Conditional App Shell Layout | ✅ APPROVED |
| **ADR-030** | Unified Frame Scheduler | ✅ IMPLEMENTED |
| **ADR-031** | Enterprise Command Pattern (Undo/Redo) | ✅ IMPLEMENTED |
| **ADR-033** | Hybrid Layer Movement System | 📋 PLANNING |
| **ADR-034** | Geometry Calculations Centralization | ✅ APPROVED |
| **ADR-036** | Enterprise Structured Logging | ✅ APPROVED |

---

## ⚡ **ADR-019: CENTRALIZED PERFORMANCE THRESHOLDS**

**Date**: 2026-01-11
**Status**: ✅ APPROVED

### Decision

Single source of truth for all performance limits.

### Canonical Source

```typescript
import { PERFORMANCE_THRESHOLDS } from '@/lib/performance-utils';

// Thresholds
PERFORMANCE_THRESHOLDS.FPS_TARGET           // 60
PERFORMANCE_THRESHOLDS.FPS_MIN              // 30
PERFORMANCE_THRESHOLDS.FRAME_BUDGET_MS      // 16.67
PERFORMANCE_THRESHOLDS.MEMORY_WARNING_MB    // 500
PERFORMANCE_THRESHOLDS.MEMORY_CRITICAL_MB   // 1000
```

---

## 🔐 **ADR-020: CENTRALIZED AUTH MODULE**

**Date**: 2026-01-11
**Status**: ✅ APPROVED

### Decision

Single auth module replacing scattered Firebase contexts.

### Canonical Module

```typescript
// ✅ CANONICAL
import { AuthProvider, useAuth } from '@/auth';

// ❌ DELETED
// - FirebaseAuthContext.tsx
// - UserRoleContext.tsx
```

### Usage

```typescript
function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}

function ProtectedPage() {
  const { user, isLoading, signOut } = useAuth();

  if (isLoading) return <Spinner />;
  if (!user) return <Redirect to="/login" />;

  return <Dashboard />;
}
```

---

## 🎭 **ADR-020.1: CONDITIONAL APP SHELL LAYOUT**

**Date**: 2026-01-11
**Status**: ✅ APPROVED

### Decision

Auth routes use standalone layout, app routes use shell layout.

### Canonical Component

```typescript
import { ConditionalAppShell } from '@/components/layout/ConditionalAppShell';

// Auto-detects route type
<ConditionalAppShell>
  {children}
</ConditionalAppShell>
```

---

## 🎬 **ADR-030: UNIFIED FRAME SCHEDULER**

**Date**: 2026-01-25
**Status**: ✅ IMPLEMENTED

### Decision

Single RAF (requestAnimationFrame) loop with priority queue.

### Canonical Service

```typescript
import { UnifiedFrameScheduler } from '@/subapps/dxf-viewer/services/UnifiedFrameScheduler';

// Priority levels
scheduler.schedule(callback, 'high');   // UI interactions
scheduler.schedule(callback, 'normal'); // Rendering
scheduler.schedule(callback, 'low');    // Analytics
```

### Benefits

- Single RAF loop (vs multiple competing loops)
- Priority-based execution
- Automatic frame budget management
- Memory-efficient cleanup

---

## ↩️ **ADR-031: ENTERPRISE COMMAND PATTERN**

**Date**: 2026-01-25
**Status**: ✅ IMPLEMENTED

### Decision

GoF Command Pattern for all undoable operations (AutoCAD/Photoshop/Figma pattern).

### Canonical Structure

```typescript
import {
  Command,
  CommandHistory,
  CommandManager
} from '@/subapps/dxf-viewer/core/commands';

// Example command
class DrawLineCommand implements Command {
  execute(): void { /* draw */ }
  undo(): void { /* remove */ }
  serialize(): SerializedCommand { /* persist */ }
}
```

### Features

- Serialization for persistence
- Audit trail for all operations
- Batch operations support
- Memory-efficient history

---

## 📐 **ADR-034: GEOMETRY CALCULATIONS CENTRALIZATION**

**Date**: 2026-01-26
**Status**: ✅ APPROVED

### Decision

Separate math calculations from rendering logic.

### Canonical Structure

```
geometry-utils.ts          # Pure math (SSOT for calculations)
geometry-rendering-utils.ts # Canvas rendering helpers
```

### Usage

```typescript
// Math calculations
import {
  calculatePolygonArea,
  calculatePolygonCentroid,
  isPointInPolygon
} from '@/subapps/dxf-viewer/utils/geometry-utils';

// Rendering helpers
import {
  renderPolygon,
  renderDimension
} from '@/subapps/dxf-viewer/utils/geometry-rendering-utils';
```

---

## 📊 **ADR-036: ENTERPRISE STRUCTURED LOGGING**

**Date**: 2026-01-26
**Status**: ✅ APPROVED

### Decision

Replace `console.log` with structured logging.

### Canonical Logger

```typescript
// ✅ CANONICAL
import { Logger } from '@/lib/telemetry';

Logger.info('User action', { action: 'draw', tool: 'line' });
Logger.warn('Performance issue', { fps: 25 });
Logger.error('Operation failed', { error, context });

// ❌ DEPRECATED
console.log('User action');  // ESLint: custom/no-console-log (warn)
console.warn('Issue');
```

### ESLint Rule

```javascript
// eslint-config
rules: {
  'custom/no-console-log': 'warn'
}
```

---

## 📚 **RELATED DOCUMENTATION**

- **[ADR Index](../reference/adr-index.md)** - Complete ADR listing
- **[Security](../security/index.md)** - Security systems
- **[Performance](../reference/api-quick-reference.md)** - API patterns

---

> **🔄 Last Updated**: 2026-01-31
>
> **👥 Maintainers**: Γιώργος Παγώνης + Claude Code (Anthropic AI)
