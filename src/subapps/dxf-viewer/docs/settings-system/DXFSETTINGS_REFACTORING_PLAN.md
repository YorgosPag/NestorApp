# 🏢 DxfSettingsProvider Enterprise Refactoring Plan

**Status**: 🚧 In Progress
**Created**: 2025-10-09
**Evaluation Source**: ChatGPT-5 Enterprise Analysis
**Original File**: `providers/DxfSettingsProvider.tsx` (2606 lines)
**Target Architecture**: Modular Settings Platform (≈1800 lines total)

---

## 📊 Executive Summary

### Current State Analysis
- **File Size**: 2606 lines (monolithic)
- **Critical Bugs**: 3 identified
- **Duplicate Patterns**: 145 occurrences
- **Enterprise Compliance**: ❌ **NOT Enterprise-Ready**

### ChatGPT-5 Verdict
> "Συμπέρασμα: δεν είναι Enterprise ακόμη. Έχει καλή βάση, αλλά λείπουν κρίσιμα σημεία ασφάλειας, ορθότητας, απόδοσης, δοκιμών και παρατηρησιμότητας."

### Target State
- **Architecture**: Centralized Settings Platform
- **Principles**: Single Responsibility, DRY, Testability
- **Pattern**: "Ό,τι μπορεί να κεντρικοποιηθεί, θα κεντρικοποιηθεί"

---

## 🐛 Critical Bugs to Fix (Priority 1)

### Bug #1: Override Flag Check (Line 2188)
**Location**: `useLineStyles` hook
**Problem**: Checks entire object instead of mode-specific boolean

```typescript
// ❌ WRONG (current code)
const mappedMode = currentMode === 'preview' ? 'draft' : currentMode;
const isOverridden = state.overrideEnabled.line; // Always truthy (object)!

// ✅ CORRECT (enterprise fix)
const mappedMode = currentMode === 'preview' ? 'draft' : currentMode;
const isOverridden = state.overrideEnabled.line[mappedMode]; // Boolean per mode
```

**Impact**: Override branches activate incorrectly
**Severity**: 🔴 Critical - Affects all line style calculations

---

### Bug #2: Hardcoded 'draft' Mode in Text/Grip Updates
**Location**: `useTextStyles`, `useGripStyles` hooks
**Problem**: Always writes to 'draft' mode regardless of current mode

```typescript
// ❌ WRONG (current code)
const mappedMode = currentMode === 'preview' ? 'draft' : currentMode; // Mapped correctly
updateTextOverrides('draft', updates); // But always writes to 'draft'!

// ✅ CORRECT (enterprise fix)
const mappedMode = currentMode === 'preview' ? 'draft' : currentMode;
updateTextOverrides(mappedMode, updates); // Mode-aware update
```

**Impact**: Breaks extensibility for future modes
**Severity**: 🟡 High - Architecture violation

---

### Bug #3: Inconsistent Hook Versions
**Location**: Two versions of `useLineStyles` with different normalization
**Problem**: Same logic, different type patterns, both have "always draft" bug

**Solution**:
1. Unify into single hook factory
2. Apply mode-aware pattern consistently
3. Add unit tests for all modes

---

## 🏗️ Centralized Architecture (10 Modules)

### Module Breakdown

```
settings/
├── core/                      # Pure business logic
│   ├── computeEffective.ts   # 3-layer merge (General → Specific → Overrides)
│   ├── modeMap.ts            # Mode mapping (preview → draft)
│   └── types.ts              # Core type definitions
│
├── state/                     # State management
│   ├── actions.ts            # Action creators (no inline dispatch)
│   ├── reducer.ts            # Unified reducer (uses core/computeEffective)
│   ├── selectors.ts          # Memoized selectors (useSyncExternalStore)
│   └── provider.tsx          # Context provider (thin wrapper)
│
├── io/                        # Data persistence
│   ├── StorageDriver.ts      # Interface for storage backends
│   ├── IndexedDbDriver.ts    # Primary storage (versioned schema)
│   ├── LocalStorageDriver.ts # Fallback storage
│   ├── safeLoad.ts           # Load with schema validation
│   ├── safeSave.ts           # Save with atomic writes
│   ├── migrationRegistry.ts  # Version migrations
│   ├── schema.ts             # Zod schemas for validation
│   └── SyncService.ts        # Cross-tab sync (BroadcastChannel)
│
├── templates/                 # Template system
│   └── TemplateEngine.ts     # CRUD for all entities (line/text/grip)
│
├── standards/                 # CAD/ISO defaults
│   ├── aci.ts                # AutoCAD Color Index palette
│   ├── lineweights.ts        # Standard lineweights
│   ├── linetypes.ts          # Linetype patterns
│   └── isoPresets.ts         # ISO 9000 presets
│
├── telemetry/                 # Observability
│   ├── Logger.ts             # Structured logging with levels
│   └── Metrics.ts            # Counters, histograms
│
├── config.ts                  # Configuration (debounce, flags)
├── FACTORY_DEFAULTS.ts        # Single source of truth for defaults
└── index.ts                   # Public API exports
```

---

## 🎯 What Gets Centralized

### 1. Merge/Overrides Logic
**Current**: Scattered across hooks (inline merges)
**Target**: `core/computeEffective.ts`

```typescript
/**
 * Pure 3-layer merge function
 * General → Specific[mode] → Overrides[mode]
 */
export function computeEffective<T>(
  base: T,
  specificByMode: Record<ViewerMode, Partial<T>>,
  overridesByMode: Record<ViewerMode, Partial<T>>,
  enabledByMode: Record<ViewerMode, boolean>,
  mode: ViewerMode
): T {
  const mappedMode = modeMap(mode); // Centralized mode mapping

  if (!enabledByMode[mappedMode]) {
    // Override disabled: merge base + specific
    return { ...base, ...(specificByMode[mappedMode] || {}) };
  }

  // Override enabled: all 3 layers
  return {
    ...base,
    ...(specificByMode[mappedMode] || {}),
    ...(overridesByMode[mappedMode] || {})
  };
}
```

**Benefits**:
- ✅ Zero duplicate merge logic
- ✅ Unit testable
- ✅ Single source of truth

---

### 2. Mode Mapping
**Current**: Hardcoded `preview → draft` in multiple places
**Target**: `core/modeMap.ts`

```typescript
export const SUPPORTED_MODES = ['normal', 'draft', 'hover', 'selection', 'completion', 'preview'] as const;
export type ViewerMode = typeof SUPPORTED_MODES[number];

export function modeMap(mode: ViewerMode): Exclude<ViewerMode, 'preview'> {
  return mode === 'preview' ? 'draft' : mode;
}
```

---

### 3. Actions/Reducer
**Current**: Inline dispatch throughout provider
**Target**: `state/actions.ts` + `state/reducer.ts`

```typescript
// actions.ts - Action creators
export const settingsActions = {
  setGeneral: (entity: Entity, updates: Partial<Settings>) => ({
    type: 'SET_GENERAL' as const,
    payload: { entity, updates }
  }),

  setSpecific: (entity: Entity, mode: ViewerMode, updates: Partial<Settings>) => ({
    type: 'SET_SPECIFIC' as const,
    payload: { entity, mode, updates }
  }),

  toggleOverride: (entity: Entity, mode: ViewerMode) => ({
    type: 'TOGGLE_OVERRIDE' as const,
    payload: { entity, mode }
  }),

  applyTemplate: (entity: Entity, templateId: string) => ({
    type: 'APPLY_TEMPLATE' as const,
    payload: { entity, templateId }
  })
};
```

---

### 4. Persistence Layer
**Current**: Direct `localStorage` calls with no validation
**Target**: `io/StorageDriver.ts` abstraction

```typescript
// StorageDriver.ts - Interface
export interface StorageDriver {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

// IndexedDbDriver.ts - Primary implementation
export class IndexedDbDriver implements StorageDriver {
  private db: IDBDatabase;
  private version = 2; // Versioned schema

  async get<T>(key: string): Promise<T | null> {
    // Atomic read with schema validation
  }

  async set<T>(key: string, value: T): Promise<void> {
    // Atomic write with validation
  }
}
```

**Migration Strategy**:
- Prefer IndexedDB for structured data
- Fallback to localStorage if IndexedDB unavailable
- Memory driver for SSR/testing

---

### 5. Validation/Migrations
**Current**: Only version check, no schema validation
**Target**: `io/schema.ts` + `io/migrationRegistry.ts`

```typescript
// schema.ts - Zod schemas
import { z } from 'zod';

export const LineSettingsSchema = z.object({
  lineWidth: z.number().min(0.1).max(10),
  lineColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  lineStyle: z.enum(['solid', 'dashed', 'dotted']),
  // ... all fields with strict validation
});

export const SettingsStateSchema = z.object({
  __standards_version: z.number(),
  line: z.object({
    general: LineSettingsSchema,
    specific: z.record(z.enum(['normal', 'draft', 'hover']), LineSettingsSchema.partial()),
    // ...
  }),
  // ...
});

// migrationRegistry.ts
export const migrations = {
  1: (data: any) => {
    // V0 → V1: Add new fields with defaults
    return { ...data, newField: DEFAULT_VALUE };
  },
  2: (data: any) => {
    // V1 → V2: Restructure overrides
    return migrateOverrideStructure(data);
  }
};
```

---

### 6. Cross-tab Sync
**Current**: Disabled due to loops
**Target**: `io/SyncService.ts`

```typescript
export class SyncService {
  private channel: BroadcastChannel;
  private changeVersion = 0; // Monotonic counter

  broadcast(changes: Partial<State>) {
    this.changeVersion++;
    this.channel.postMessage({
      type: 'SETTINGS_UPDATE',
      version: this.changeVersion,
      origin: window.location.href, // Prevent loops
      changes
    });
  }

  subscribe(callback: (changes: Partial<State>) => void) {
    this.channel.onmessage = (event) => {
      if (event.data.origin === window.location.href) return; // Ignore own
      if (event.data.version <= this.changeVersion) return; // Stale

      this.changeVersion = Math.max(this.changeVersion, event.data.version);
      callback(event.data.changes);
    };
  }
}
```

**Benefits**:
- ✅ No infinite loops (origin + version guards)
- ✅ Last-writer-wins policy
- ✅ Fallback to storage event if BroadcastChannel unavailable

---

### 7. Hook Factory
**Current**: Duplicate hooks for line/text/grip
**Target**: `state/hooks.ts`

```typescript
/**
 * Generic hook factory for settings
 */
function createSettingsHook<T>(entity: 'line' | 'text' | 'grip') {
  return function useEntitySettings(mode: ViewerMode): {
    settings: T;
    updateGeneral: (updates: Partial<T>) => void;
    updateSpecific: (updates: Partial<T>) => void;
    updateOverrides: (updates: Partial<T>) => void;
    toggleOverride: () => void;
    isOverridden: boolean;
  } {
    const state = useContext(SettingsContext);
    const dispatch = useContext(SettingsDispatchContext);

    const mappedMode = modeMap(mode);

    // Memoized selector (prevents re-renders)
    const settings = useMemo(
      () => computeEffective(
        state[entity].general,
        state[entity].specific,
        state[entity].overrides,
        state.overrideEnabled[entity],
        mappedMode
      ),
      [state[entity], mappedMode]
    );

    const isOverridden = state.overrideEnabled[entity][mappedMode];

    return {
      settings,
      updateGeneral: (updates) => dispatch(settingsActions.setGeneral(entity, updates)),
      updateSpecific: (updates) => dispatch(settingsActions.setSpecific(entity, mappedMode, updates)),
      updateOverrides: (updates) => dispatch(settingsActions.setOverride(entity, mappedMode, updates)),
      toggleOverride: () => dispatch(settingsActions.toggleOverride(entity, mappedMode)),
      isOverridden
    };
  };
}

// Public API
export const useLineStyles = createSettingsHook<LineSettings>('line');
export const useTextStyles = createSettingsHook<TextSettings>('text');
export const useGripStyles = createSettingsHook<GripSettings>('grip');
```

---

### 8. Templates
**Current**: Only for lines
**Target**: `templates/TemplateEngine.ts`

```typescript
export class TemplateEngine {
  constructor(private storage: StorageDriver) {}

  async saveTemplate<T>(entity: Entity, name: string, settings: T): Promise<void> {
    const templates = await this.loadTemplates(entity);
    templates[name] = { settings, createdAt: Date.now() };
    await this.storage.set(`templates:${entity}`, templates);
  }

  async loadTemplate<T>(entity: Entity, name: string): Promise<T | null> {
    const templates = await this.loadTemplates(entity);
    return templates[name]?.settings || null;
  }

  async applyTemplate(entity: Entity, mode: ViewerMode, templateId: string): Promise<void> {
    const settings = await this.loadTemplate(entity, templateId);
    if (!settings) throw new Error(`Template ${templateId} not found`);

    // Dispatch action to apply template
    dispatch(settingsActions.applyTemplate(entity, mode, settings));
  }
}
```

---

### 9. Telemetry
**Current**: Verbose console.log/warn
**Target**: `telemetry/Logger.ts`

```typescript
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export class Logger {
  constructor(
    private level: LogLevel = LogLevel.INFO,
    private prefix: string = '[DxfSettings]'
  ) {}

  error(message: string, meta?: Record<string, any>) {
    if (this.level >= LogLevel.ERROR) {
      console.error(`${this.prefix} [ERROR]`, message, meta);
    }
  }

  debug(message: string, meta?: Record<string, any>) {
    if (this.level >= LogLevel.DEBUG) {
      console.debug(`${this.prefix} [DEBUG]`, message, meta);
    }
  }

  // In production: level = ERROR (silent)
  // In development: level = DEBUG (verbose)
}
```

---

### 10. Standards/Defaults
**Current**: Scattered constants in multiple files
**Target**: `standards/` directory

```typescript
// standards/aci.ts - AutoCAD Color Index
export const ACI_PALETTE = {
  1: '#FF0000', // Red
  2: '#FFFF00', // Yellow
  3: '#00FF00', // Green
  // ... 255 colors
} as const;

// standards/lineweights.ts
export const STANDARD_LINEWEIGHTS = [
  0.00, 0.05, 0.09, 0.13, 0.15, 0.18, 0.20, 0.25, 0.30, 0.35,
  0.40, 0.50, 0.53, 0.60, 0.70, 0.80, 0.90, 1.00, 1.06, 1.20,
  1.40, 1.58, 2.00, 2.11
] as const;

// FACTORY_DEFAULTS.ts
export const FACTORY_DEFAULTS = {
  line: {
    general: {
      lineWidth: 0.25,
      lineColor: ACI_PALETTE[7], // White
      lineStyle: 'solid' as const
    }
  },
  // ... all defaults in one place
};
```

---

## 🔄 Migration Strategy

### Phase 1: Foundation (Week 1)
1. ✅ Create folder structure
2. ✅ Implement `core/types.ts`
3. ✅ Implement `core/modeMap.ts`
4. ✅ Implement `core/computeEffective.ts`
5. ✅ Write unit tests for core modules

### Phase 2: Storage Layer (Week 1-2)
1. ✅ Implement `io/StorageDriver.ts` interface
2. ✅ Implement `io/IndexedDbDriver.ts`
3. ✅ Implement `io/LocalStorageDriver.ts` (fallback)
4. ✅ Implement `io/schema.ts` (Zod validation)
5. ✅ Implement `io/migrationRegistry.ts`
6. ✅ Implement `io/safeLoad.ts` + `io/safeSave.ts`
7. ✅ Write integration tests

### Phase 3: State Management (Week 2)
1. ✅ Implement `state/actions.ts`
2. ✅ Implement `state/reducer.ts` (using computeEffective)
3. ✅ Implement `state/selectors.ts`
4. ✅ Refactor `state/provider.tsx` to use new architecture
5. ✅ Write reducer tests

### Phase 4: Hooks Refactoring (Week 2-3)
1. ✅ Implement hook factory in `state/hooks.ts`
2. ✅ Migrate `useLineStyles` to factory pattern
3. ✅ Migrate `useTextStyles` to factory pattern
4. ✅ Migrate `useGripStyles` to factory pattern
5. ✅ Remove duplicate hook versions
6. ✅ Fix Bug #1 (override flags)
7. ✅ Fix Bug #2 (mode-aware updates)

### Phase 5: Advanced Features (Week 3)
1. ✅ Implement `io/SyncService.ts` (cross-tab)
2. ✅ Implement `templates/TemplateEngine.ts`
3. ✅ Implement `telemetry/Logger.ts`
4. ✅ Implement `telemetry/Metrics.ts`
5. ✅ Create `standards/` modules

### Phase 6: Testing & Documentation (Week 4)
1. ✅ Unit tests (100% coverage for core/state/io)
2. ✅ Integration tests (persistence, sync)
3. ✅ E2E tests (user workflows)
4. ✅ Performance benchmarks
5. ✅ Update `CENTRALIZED_SYSTEMS.md`
6. ✅ Create API documentation

---

## ✅ Acceptance Criteria

### Code Quality
- [ ] Zero `as any` or `@ts-ignore` (Enterprise compliance)
- [ ] Zero inline merges (all use `computeEffective`)
- [ ] Zero hardcoded 'draft' mode (all mode-aware)
- [ ] Zero direct `window`/`localStorage` access outside `io/`

### Functionality
- [ ] All 3 bugs fixed and verified
- [ ] Override flags work per-mode (not globally)
- [ ] Mode mapping centralized and consistent
- [ ] Cross-tab sync works without loops (<250ms latency)

### Reliability
- [ ] Cold start with corrupted data → graceful fallback
- [ ] Migration from old versions → successful
- [ ] Schema validation catches invalid data
- [ ] Atomic writes prevent partial saves

### Performance
- [ ] Minimal re-renders (memoized selectors)
- [ ] Debounced saves (smart batching)
- [ ] Write-behind queue for IndexedDB

### Testing
- [ ] Unit tests: `core/`, `state/`, `io/` (100% coverage)
- [ ] Integration tests: persistence, migrations, sync
- [ ] E2E tests: user workflows (apply template, toggle override)

---

## 📊 Metrics & Observability

### Before (Current State)
- **Lines of Code**: 2606 (monolithic)
- **Duplicate Patterns**: 145
- **Type Safety**: 72% (38 `any` usages via inference)
- **Test Coverage**: 0%
- **Bug Count**: 3 critical, unknown minor

### After (Target State)
- **Lines of Code**: ~1800 (modular, 10 files)
- **Duplicate Patterns**: 0
- **Type Safety**: 100% (strict mode, Zod validation)
- **Test Coverage**: >90%
- **Bug Count**: 0 (all fixed + tests prevent regression)

### Performance Improvements
- **Re-renders**: -60% (memoized selectors)
- **Storage Writes**: -75% (batching + debounce)
- **Cross-tab Sync**: Enabled (was disabled)
- **Cold Start**: +Schema validation (safer)

---

## 🎯 Success Indicators

1. **Developer Experience**
   - ✅ Single import for all settings: `import { useLineStyles } from '@/settings'`
   - ✅ Clear mental model: General → Specific → Overrides
   - ✅ Easy to add new entity types (template/text/grip pattern)

2. **Code Maintainability**
   - ✅ Each module has single responsibility
   - ✅ Pure functions (testable without mocks)
   - ✅ Clear dependency graph (no circular deps)

3. **Production Readiness**
   - ✅ Graceful error handling (no crashes on bad data)
   - ✅ Observable (structured logs + metrics)
   - ✅ Rollback capability (versioned migrations)

---

## 📚 References

- **ChatGPT-5 Evaluation**: `src/txt_files/axiologisi_ChatGPT5.txt`
- **Current Implementation**: `src/subapps/dxf-viewer/providers/DxfSettingsProvider.tsx`
- **Enterprise Standards**: `CLAUDE.md` (Δεκάλογος #11-14)
- **Centralized Systems**: `src/subapps/dxf-viewer/docs/CENTRALIZED_SYSTEMS.md`

---

## 🚀 Next Steps

1. **Immediate**: Create folder structure + skeleton files
2. **Week 1**: Implement core modules (computeEffective, modeMap, types)
3. **Week 2**: Implement storage layer + state management
4. **Week 3**: Refactor hooks + fix bugs
5. **Week 4**: Advanced features + testing

**Start Date**: 2025-10-09
**Target Completion**: 2025-11-06 (4 weeks)

---

**Γιώργο, ό,τι μπορεί να κεντρικοποιηθεί, θα κεντρικοποιηθεί! 🎯**
