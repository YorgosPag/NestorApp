# Store Sync - Ports & Adapters Architecture

> ⚠️ **REMOVED 2026-06-20.** This hexagonal ports/adapters store-sync layer was retired.
> Settings → legacy style stores is now a single mapping SSoT in
> `stores/style-store-sync.ts`, driven once-on-load by `EnterpriseDxfSettingsProvider`.
> This document is kept for historical context only. See ADR-107 (changelog 2026-06-20).

**Status**: 🗑️ REMOVED (was: ✅ PRODUCTION READY)
**Version**: 1.0.0
**Date**: 2025-10-09
**Author**: Γιώργος Παγώνης + Claude Code (Anthropic AI)

---

## 📐 Architecture Overview

This module implements **Hexagonal Architecture** (Ports & Adapters Pattern) για το synchronization system μεταξύ Enterprise Settings και Legacy Stores.

### **Core Principle**: Dependency Inversion
```
Settings Domain (Pure Business Logic)
    ↓ depends on
Ports (Abstract Interfaces)
    ↑ implemented by
Adapters (Concrete Implementations → Legacy Stores)
```

**ZERO coupling** από το domain layer προς external dependencies!

---

## 📂 File Structure

```
settings/sync/
├── ports.ts                        # Abstract interfaces (contracts)
├── storeSync.ts                    # Pure business logic (core)
├── compositionRoot.ts              # Dependency Injection (DI)
├── adapters/
│   ├── index.ts                    # Central exports
│   ├── consoleLoggerAdapter.ts     # Logger implementation
│   ├── toolStyleAdapter.ts         # ToolStyle store wrapper
│   ├── textStyleAdapter.ts         # TextStyle store wrapper
│   ├── gripStyleAdapter.ts         # GripStyle store wrapper
│   ├── gridAdapter.ts              # Grid store wrapper
│   └── rulerAdapter.ts             # Ruler store wrapper
└── storeSync.test.ts               # Unit tests (fake ports)
```

---

## 🎯 Design Patterns

### 1. **Ports (Interfaces)**
Abstract contracts που ορίζουν τι χρειάζεται το domain layer.

**Location**: `ports.ts`

```typescript
export interface LoggerPort {
  info(msg: string, data?: unknown): void;
  warn(msg: string, data?: unknown): void;
  error(msg: string, data?: unknown): void;
}

export interface ToolStylePort {
  getCurrent(): Partial<ToolStyleState>;
  apply(partial: Partial<ToolStyleState>): void;
  onChange(handler: (partial: Partial<ToolStyleState>) => void): Unsubscribe;
}

export interface SyncDependencies {
  logger: LoggerPort;
  toolStyle?: ToolStylePort;
  textStyle?: TextStylePort;
  gripStyle?: GripStylePort;
  grid?: GridPort;
  ruler?: RulerPort;
}
```

**Benefits**:
- ✅ Zero coupling to concrete implementations
- ✅ Easy to mock/fake for testing
- ✅ Can swap implementations without changing core logic

---

### 2. **Core Logic (Pure Functions)**
Pure business logic που δεν εξαρτάται από τίποτα εκτός από ports.

**Location**: `storeSync.ts`

```typescript
export function createStoreSync(deps: SyncDependencies): StoreSync {
  return {
    start(getEffective: EffectiveSettingsGetter) {
      // Wire all ports
      if (deps.toolStyle) {
        const { push, subscriptions } = wirePort(
          deps.toolStyle,
          (getter) => mapLineToToolStyle(getter.line('preview')),
          deps,
          getEffective
        );
        pushers.push(push);
        allSubscriptions.push(...subscriptions);
      }

      return { stop, pushFromSettings };
    }
  };
}
```

**Key Features**:
- ✅ Factory function (not a class - easier to test)
- ✅ All dependencies injected via `deps` parameter
- ✅ No imports from `stores/*`, `contexts/*`, `components/*`
- ✅ Pure mapper functions (no side effects)

---

### 3. **Adapters (Implementations)**
Concrete implementations που wrap existing legacy stores.

**Location**: `adapters/*.ts`

**Example** (`toolStyleAdapter.ts`):
```typescript
import type { ToolStylePort } from '../ports';
import { toolStyleStore } from '../../../stores/ToolStyleStore';

export const toolStyleAdapter: ToolStylePort = {
  getCurrent() {
    const state = toolStyleStore.get();
    return {
      stroke: state.strokeColor,
      fill: state.fillColor,
      width: state.lineWidth,
      opacity: state.opacity,
      dashArray: []
    };
  },

  apply(partial) {
    const updates: Partial<ToolStyleState> = {};
    if (partial.stroke !== undefined) updates.strokeColor = partial.stroke;
    if (partial.fill !== undefined) updates.fillColor = partial.fill;
    if (partial.width !== undefined) updates.lineWidth = partial.width;
    if (partial.opacity !== undefined) updates.opacity = partial.opacity;
    toolStyleStore.set(updates);
  },

  onChange(handler) {
    return toolStyleStore.subscribe((state) => {
      handler({
        stroke: state.strokeColor,
        fill: state.fillColor,
        width: state.lineWidth,
        opacity: state.opacity,
        dashArray: []
      });
    });
  }
};
```

**Benefits**:
- ✅ Isolates legacy code (all imports here, not in core)
- ✅ Implements port interface (type-safe)
- ✅ Can be swapped without changing core logic
- ✅ Easy to test with fake implementations

---

### 4. **Composition Root (DI)**
Single place που συνδέει όλα τα pieces μαζί.

**Location**: `compositionRoot.ts`

```typescript
export function createSyncDependencies(options?: {
  enableSync?: boolean;
  ports?: {
    toolStyle?: boolean;
    textStyle?: boolean;
    gripStyle?: boolean;
    grid?: boolean;
    ruler?: boolean;
  };
}): SyncDependencies | undefined {
  if (options?.enableSync === false) return undefined;

  const deps: SyncDependencies = {
    logger: consoleLoggerAdapter,
    toolStyle: ports.toolStyle !== false ? toolStyleAdapter : undefined,
    textStyle: ports.textStyle !== false ? textStyleAdapter : undefined,
    gripStyle: ports.gripStyle !== false ? gripStyleAdapter : undefined,
    grid: ports.grid !== false ? gridAdapter : undefined,
    ruler: ports.ruler !== false ? rulerAdapter : undefined
  };

  return deps;
}
```

**Benefits**:
- ✅ Feature flag support (enable/disable sync)
- ✅ Individual port enable/disable
- ✅ Single responsibility (wiring only)
- ✅ Easy to configure per environment

---

## 🔄 Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                 EnterpriseDxfSettingsProvider           │
│  (React Component - Orchestrator)                       │
└─────────────────────────────────────────────────────────┘
                        │
                        │ syncDeps injected
                        ↓
┌─────────────────────────────────────────────────────────┐
│              createStoreSync(syncDeps)                  │
│  (Pure Function - Core Business Logic)                 │
└─────────────────────────────────────────────────────────┘
                        │
                        │ uses ports
                        ↓
┌─────────────────────────────────────────────────────────┐
│                    Ports (Interfaces)                   │
│  LoggerPort, ToolStylePort, TextStylePort, etc.        │
└─────────────────────────────────────────────────────────┘
                        ↑
                        │ implemented by
                        │
┌─────────────────────────────────────────────────────────┐
│                    Adapters                             │
│  consoleLoggerAdapter, toolStyleAdapter, etc.          │
└─────────────────────────────────────────────────────────┘
                        │
                        │ wraps
                        ↓
┌─────────────────────────────────────────────────────────┐
│                  Legacy Stores                          │
│  toolStyleStore, textStyleStore, gripStyleStore, etc.  │
└─────────────────────────────────────────────────────────┘
```

---

## 🧪 Testing Strategy

### **Fake Ports** (NOT Mocks!)

Instead of mocking frameworks, we use **fake implementations** of ports.

**Location**: `storeSync.test.ts`

```typescript
class FakeToolStylePort implements ToolStylePort {
  public applyCalls: Array<Parameters<ToolStylePort['apply']>[0]> = [];
  public changeHandlers: Array<(partial: unknown) => void> = [];

  getCurrent() {
    return { stroke: '#000000', fill: '#FFFFFF', width: 1, opacity: 1, dashArray: [] };
  }

  apply(partial: Parameters<ToolStylePort['apply']>[0]) {
    this.applyCalls.push(partial);
  }

  onChange(handler: (partial: Parameters<ToolStylePort['apply']>[0]) => void): Unsubscribe {
    this.changeHandlers.push(handler);
    return () => {
      const index = this.changeHandlers.indexOf(handler);
      if (index >= 0) this.changeHandlers.splice(index, 1);
    };
  }

  simulateChange(partial: Parameters<ToolStylePort['apply']>[0]) {
    this.changeHandlers.forEach(h => h(partial));
  }
}
```

**Benefits**:
- ✅ No mocking framework needed
- ✅ Tests are simple and readable
- ✅ Fake objects capture actual behavior
- ✅ Can test edge cases easily

---

## 🚀 Usage

### **1. Application Root** (DI Setup)

**File**: `DxfViewerApp.tsx`

```typescript
import { createSyncDependencies } from './settings/sync/compositionRoot';
import { EXPERIMENTAL_FEATURES } from './config/experimental-features';

const syncDeps = useMemo(() => {
  return createSyncDependencies({
    enableSync: EXPERIMENTAL_FEATURES.ENABLE_SETTINGS_SYNC,
    ports: {
      toolStyle: true,
      textStyle: true,
      gripStyle: true,
      grid: true,
      ruler: true
    }
  });
}, []);

return (
  <DxfSettingsProvider enabled={true} syncDeps={syncDeps}>
    {children}
  </DxfSettingsProvider>
);
```

### **2. Provider** (Sync Orchestration)

**File**: `EnterpriseDxfSettingsProvider.tsx`

```typescript
const syncRef = useRef<ReturnType<typeof createStoreSync>>();

useEffect(() => {
  if (!syncDeps || !state.isLoaded) return;

  syncRef.current = createStoreSync(syncDeps);

  const { stop, pushFromSettings } = syncRef.current.start({
    line: effectiveSettings.getEffectiveLineSettings,
    text: effectiveSettings.getEffectiveTextSettings,
    grip: effectiveSettings.getEffectiveGripSettings
  });

  return () => stop();
}, [syncDeps, state.isLoaded]);
```

---

## 🎛️ Feature Flags

### **Global Enable/Disable**

**File**: `config/experimental-features.ts`

```typescript
export const EXPERIMENTAL_FEATURES = {
  ENABLE_SETTINGS_SYNC: true,  // Master toggle
} as const;
```

### **Per-Port Enable/Disable**

```typescript
const syncDeps = createSyncDependencies({
  enableSync: true,
  ports: {
    toolStyle: true,   // Enable ToolStyle sync
    textStyle: false,  // Disable TextStyle sync
    gripStyle: true,
    grid: true,
    ruler: true
  }
});
```

---

## 🔍 Debugging & Testing

### **Browser Console**

```javascript
// Run full test suite
dxfDebug.testStoreSync()

// Or direct call
await runStoreSyncTests()
```

### **Test Coverage**

**15 comprehensive tests** across 8 categories:
1. Ports Integrity (2 tests)
2. Adapters Validation (4 tests)
3. Composition Root (3 tests)
4. Pure Functions (2 tests)
5. Bidirectional Sync (1 test)
6. Error Handling (1 test)
7. Feature Flags (1 test)
8. Subscription Cleanup (1 test)

---

## 📊 Benefits Summary

### **Architecture Benefits**
- ✅ **Zero Coupling**: Core logic has ZERO dependencies on legacy code
- ✅ **Testability**: 100% unit testable with fake ports
- ✅ **Maintainability**: Clear separation of concerns
- ✅ **Flexibility**: Can swap implementations without changing core
- ✅ **Type Safety**: Full TypeScript type safety

### **Business Benefits**
- ✅ **Gradual Migration**: Can enable/disable sync per environment
- ✅ **Backward Compatibility**: Legacy stores continue to work
- ✅ **Production Ready**: Comprehensive testing + error handling
- ✅ **Performance**: No unnecessary re-renders or subscriptions
- ✅ **Monitoring**: Built-in logging via LoggerPort

---

## 📚 References

### **Design Patterns**
- **Hexagonal Architecture** (Alistair Cockburn)
- **Dependency Inversion Principle** (SOLID)
- **Ports & Adapters Pattern**
- **Composition Root Pattern** (Mark Seemann)
- **Fake Objects over Mocks** (Martin Fowler)

### **Related Documentation**
- [Enterprise Settings Provider](../settings-provider/README.md)
- [Testing Infrastructure](../docs/TESTING_INFRASTRUCTURE.md)
- [Centralized Systems](../docs/CENTRALIZED_SYSTEMS.md)

---

## 🔮 Future Enhancements

### **Phase 9**: Additional Adapters
- [ ] Add `crosshairAdapter` για crosshair store sync
- [ ] Add `entitiesAdapter` για entities store sync

### **Phase 10**: Performance Optimization
- [ ] Debounce/throttle για high-frequency updates
- [ ] Batch updates για multiple settings changes

### **Phase 11**: Production Telemetry
- [ ] Add telemetry port για production monitoring
- [ ] Track sync performance metrics
- [ ] Error reporting integration

---

**END OF DOCUMENTATION**
