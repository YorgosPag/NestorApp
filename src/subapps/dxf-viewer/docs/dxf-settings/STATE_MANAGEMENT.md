# 🗂️ DXF SETTINGS PANEL - STATE MANAGEMENT STRATEGY

---

**📋 Document Type:** State Management Architecture
**🎯 Scope:** State strategy for DxfSettingsPanel module
**👤 Architect:** Γιώργος Παγωνής
**🤖 Developer:** Claude (Anthropic AI)
**📅 Created:** 2025-10-07
**📅 Last Updated:** 2025-10-07
**📊 Status:** LIVING DOCUMENT

---

## 🔗 CROSS-REFERENCES

This document is part of the **DxfSettings Refactoring Documentation Suite**:

| Document | Purpose | When to Use |
|----------|---------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | High-level system design | Understanding overall structure |
| [COMPONENT_GUIDE.md](./COMPONENT_GUIDE.md) | Detailed component docs | Working on specific components |
| [MIGRATION_CHECKLIST.md](./MIGRATION_CHECKLIST.md) | Step-by-step migration | Daily refactoring tasks |
| [DECISION_LOG.md](./DECISION_LOG.md) | Design decisions | Recording/reviewing decisions |
| **[STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md)** ⭐ | **State strategy (THIS)** | **Understanding data flow** |
| [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) | Testing approach | Writing tests |

**Related Files:**
- Source: [`ColorPalettePanel.tsx`](../../ui/components/ColorPalettePanel.tsx) - Original state (15+ useState)
- Target: [`DxfSettingsPanel.tsx`](../../ui/components/dxf-settings/DxfSettingsPanel.tsx) - New state architecture
- Providers: [`DxfSettingsProvider.tsx`](../../providers/DxfSettingsProvider.tsx) - Global settings state

**Related Roadmap:**
- [MASTER_ROADMAP.md](../../docs/MASTER_ROADMAP.md) - Full enterprise roadmap
- Phase B: [Platform State Management](../../docs/platform/PLATFORM_ARCHITECTURE.md#state-management)

---

## 📖 TABLE OF CONTENTS

1. [State Architecture Overview](#state-architecture-overview)
2. [State Types](#state-types)
3. [State Ownership Map](#state-ownership-map)
4. [State Flow Diagrams](#state-flow-diagrams)
5. [Persistence Strategy](#persistence-strategy)
6. [Synchronization Patterns](#synchronization-patterns)
7. [Performance Optimizations](#performance-optimizations)
8. [Testing State](#testing-state)
9. [Migration Plan](#migration-plan)
10. [Future: Redux/Zustand Integration](#future-reduxzustand-integration)

---

## 🏗️ STATE ARCHITECTURE OVERVIEW

### Current State (ColorPalettePanel - Monolithic)

```
ColorPalettePanel.tsx (2200+ lines)
├── 15+ useState hooks (all in one component!)
│   ├── activeMainTab
│   ├── activeGeneralTab
│   ├── activeCategory
│   ├── activeCursorTab
│   ├── activeSelectionTab
│   ├── activeGridTab
│   ├── activeGridLinesTab
│   ├── activeRulerTab
│   └── ... (10+ more)
└── Settings state from providers
    ├── useLineSettingsFromProvider()
    ├── useTextSettingsFromProvider()
    ├── useCursorSettings()
    └── useRulersGridContext()
```

**Problems:**
- ❌ All state in ONE component (hard to test)
- ❌ No clear ownership (who owns what?)
- ❌ State re-renders entire component (slow)
- ❌ Hard to debug (which state caused re-render?)

---

### Target State (DxfSettingsPanel - Modular)

```
┌─────────────────────────────────────────────────────────────┐
│  LOCAL STATE (Component-level)                              │
│  ├── DxfSettingsPanel: activeMainTab                        │
│  ├── GeneralSettingsPanel: activeGeneralTab                 │
│  ├── SpecificSettingsPanel: activeCategory                  │
│  └── GridCategory: activeGridTab, activeRulerTab            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  PROVIDER STATE (Global settings)                           │
│  ├── DxfSettingsProvider (React Context)                    │
│  │   ├── Line settings (ISO 128)                            │
│  │   ├── Text settings (ISO 3098)                           │
│  │   └── Grip settings (AutoCAD)                            │
│  ├── CursorSystem (Centralized system)                      │
│  │   └── Cursor/Crosshair settings                          │
│  └── RulersGridSystem (Centralized system)                  │
│      └── Grid/Rulers settings                               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  PERSISTENCE LAYER (localStorage)                           │
│  ├── dxf-settings-general-lines                             │
│  ├── dxf-settings-general-text                              │
│  ├── dxf-settings-general-grips                             │
│  ├── cursor-system-settings                                 │
│  └── rulers-grid-system-settings                            │
└─────────────────────────────────────────────────────────────┘
```

**Benefits:**
- ✅ Clear ownership (each component owns its state)
- ✅ Isolated re-renders (only affected component re-renders)
- ✅ Easy to test (mock provider state)
- ✅ Easy to debug (clear state hierarchy)

---

## 📊 STATE TYPES

### 1. **Local UI State** (Component-specific, ephemeral)

**Scope:** Component lifecycle only
**Persistence:** None (resets on unmount)
**Examples:**
- Active tab/category
- Dropdown open/closed
- Tooltip visible/hidden

**Implementation:**
```typescript
// Local state - NOT persisted
const [activeTab, setActiveTab] = useState('lines');
```

**Ownership:**
| State | Owner | Lifetime |
|-------|-------|----------|
| `activeMainTab` | DxfSettingsPanel | Until panel closes |
| `activeGeneralTab` | GeneralSettingsPanel | Until switch to Specific |
| `activeCategory` | SpecificSettingsPanel | Until switch to General |

---

### 2. **Global Settings State** (Application-wide, persistent)

**Scope:** Entire application
**Persistence:** localStorage
**Examples:**
- Line settings (color, width, type)
- Text settings (font, size)
- Cursor settings (crosshair color)

**Implementation:**
```typescript
// Global state - persisted to localStorage
const { settings, updateSettings } = useLineSettingsFromProvider();
```

**Ownership:**
| State | Owner | Persistence Key |
|-------|-------|-----------------|
| Line settings | DxfSettingsProvider | `dxf-settings-general-lines` |
| Text settings | DxfSettingsProvider | `dxf-settings-general-text` |
| Grip settings | DxfSettingsProvider | `dxf-settings-general-grips` |
| Cursor settings | CursorSystem | `cursor-system-settings` |
| Grid/Rulers | RulersGridSystem | `rulers-grid-system-settings` |

---

### 3. **Derived State** (Computed from other state)

**Scope:** Computed on-the-fly
**Persistence:** None (always computed)
**Examples:**
- Effective line settings (with override logic)
- Preview settings (Draft vs Completion)

**Implementation:**
```typescript
// Derived state - computed from base state
const effectiveLineSettings = useMemo(() => {
  return draftSettings.overrideGlobalSettings
    ? draftSettings.lineSettings
    : globalLineSettings.settings;
}, [draftSettings, globalLineSettings]);
```

---

## 🗺️ STATE OWNERSHIP MAP

### Detailed State Tree

```
DxfSettingsPanel
├── LOCAL: activeMainTab ('general' | 'specific')
│
├── IF activeMainTab === 'general'
│   └── GeneralSettingsPanel
│       ├── LOCAL: activeGeneralTab ('lines' | 'text' | 'grips')
│       │
│       ├── IF activeGeneralTab === 'lines'
│       │   └── LinesTab
│       │       ├── PROVIDER: useLineSettingsFromProvider()
│       │       ├── DERIVED: effectiveLineSettings
│       │       └── LOCAL: previewState (temp)
│       │
│       ├── IF activeGeneralTab === 'text'
│       │   └── TextTab
│       │       ├── PROVIDER: useTextSettingsFromProvider()
│       │       └── DERIVED: effectiveTextSettings
│       │
│       └── IF activeGeneralTab === 'grips'
│           └── GripsTab
│               ├── PROVIDER: useGripSettingsFromProvider()
│               └── DERIVED: effectiveGripSettings
│
└── IF activeMainTab === 'specific'
    └── SpecificSettingsPanel
        ├── LOCAL: activeCategory (7 categories)
        │
        ├── IF activeCategory === 'cursor'
        │   └── CursorCategory
        │       ├── LOCAL: activeCursorTab ('crosshair' | 'cursor')
        │       └── SYSTEM: useCursorSettings()
        │
        ├── IF activeCategory === 'grid'
        │   └── GridCategory
        │       ├── LOCAL: activeGridTab ('grid' | 'rulers')
        │       ├── LOCAL: activeGridLinesTab ('major' | 'minor')
        │       ├── LOCAL: activeRulerTab (4 tabs)
        │       └── SYSTEM: useRulersGridContext()
        │
        └── IF activeCategory === 'entities'
            └── EntitiesCategory
                ├── LOCAL: selectedTool (8 tools)
                ├── LOCAL: activeLineTab (4 phases)
                ├── PROVIDER: useUnifiedLineDraft()
                ├── PROVIDER: useUnifiedLineCompletion()
                ├── PROVIDER: useUnifiedLineHover()
                └── PROVIDER: useUnifiedLineSelection()
```

---

## 🔄 STATE FLOW DIAGRAMS

### Flow 1: User Changes Line Color (General Settings)

```
┌──────────────────────────────────────────────────────────────┐
│ 1. USER ACTION                                               │
│    User changes line color to #FF0000 in LinesTab           │
└───────────────────────────┬──────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 2. COMPONENT HANDLER                                         │
│    LineSettings.onChange({ color: '#FF0000' })              │
└───────────────────────────┬──────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 3. HOOK UPDATE                                               │
│    useLineSettingsFromProvider().updateSettings()            │
└───────────────────────────┬──────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 4. PROVIDER UPDATE                                           │
│    DxfSettingsProvider.setState({ lineSettings: {...} })    │
└───────────────────────────┬──────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 5. PERSISTENCE                                               │
│    localStorage.setItem('dxf-settings-general-lines', ...)  │
└───────────────────────────┬──────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 6. RE-RENDER SUBSCRIBERS                                     │
│    ├── LinesTab (re-renders with new color)                 │
│    ├── LinePreview (shows new color)                        │
│    └── Canvas (applies new color to lines)                  │
└──────────────────────────────────────────────────────────────┘
```

---

### Flow 2: Override Pattern (Entities → Draft Phase)

```
┌──────────────────────────────────────────────────────────────┐
│ SCENARIO: User enables "Override Global Settings" in Draft  │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ INITIAL STATE                                                │
│ ├── Global Line Settings: { color: '#FFFFFF', width: 0.25 } │
│ └── Draft Settings: { overrideGlobalSettings: false }       │
└───────────────────────────┬──────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ USER ENABLES OVERRIDE                                        │
│    Draft: overrideGlobalSettings = true                     │
│    Draft: lineSettings = { color: '#FF0000', width: 1.0 }   │
└───────────────────────────┬──────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ EFFECTIVE SETTINGS CALCULATION                               │
│                                                              │
│    const effectiveSettings = useMemo(() => {                │
│      return draftSettings.overrideGlobalSettings            │
│        ? draftSettings.lineSettings  // #FF0000, 1.0        │
│        : globalLineSettings.settings // #FFFFFF, 0.25       │
│    }, [draftSettings, globalLineSettings]);                 │
└───────────────────────────┬──────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ PREVIEW UPDATES                                              │
│    Draft Phase Preview: Shows RED, 1.0mm line               │
│    General Settings Preview: Still WHITE, 0.25mm (unchanged)│
└──────────────────────────────────────────────────────────────┘
```

---

## 💾 PERSISTENCE STRATEGY

### localStorage Keys Mapping

| Setting Type | localStorage Key | Format | Max Size |
|--------------|------------------|--------|----------|
| **General - Lines** | `dxf-settings-general-lines` | JSON | ~1KB |
| **General - Text** | `dxf-settings-general-text` | JSON | ~1KB |
| **General - Grips** | `dxf-settings-general-grips` | JSON | ~1KB |
| **Cursor System** | `cursor-system-settings` | JSON | ~500B |
| **Grid System** | `rulers-grid-system-settings` | JSON | ~2KB |
| **Draft Phase** | `dxf-settings-draft-lines` | JSON | ~1KB |
| **Completion Phase** | `dxf-settings-completion-lines` | JSON | ~1KB |
| **Hover Phase** | `dxf-settings-hover-lines` | JSON | ~500B |
| **Selection Phase** | `dxf-settings-selection-lines` | JSON | ~500B |

**Total localStorage usage:** ~8KB (well under 5MB limit)

---

### Persistence Flow

```typescript
// 1. User changes setting
updateLineSettings({ color: '#FF0000' });

// 2. Provider updates state
setLineSettings(newSettings);

// 3. useEffect persists to localStorage
useEffect(() => {
  localStorage.setItem(
    'dxf-settings-general-lines',
    JSON.stringify(lineSettings)
  );
}, [lineSettings]);

// 4. On app load, restore from localStorage
useEffect(() => {
  const saved = localStorage.getItem('dxf-settings-general-lines');
  if (saved) {
    setLineSettings(JSON.parse(saved));
  }
}, []);
```

---

### Error Handling

```typescript
// Graceful degradation for localStorage errors
function saveToLocalStorage(key: string, value: any) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded, clearing old data');
      clearOldSettings();
      localStorage.setItem(key, JSON.stringify(value));
    } else {
      console.error('Failed to save settings:', error);
      // Fallback: Use in-memory state only
    }
  }
}
```

---

## 🔄 SYNCHRONIZATION PATTERNS

### Pattern 1: Single Source of Truth

**Problem:** Settings can be changed in multiple places (General tab, Entities tab)

**Solution:** DxfSettingsProvider is the ONLY source of truth

```typescript
// ✅ CORRECT: All components read from provider
const lineSettings = useLineSettingsFromProvider();

// ❌ WRONG: Don't duplicate state
const [lineSettings, setLineSettings] = useState({ ... });
```

---

### Pattern 2: Override with Fallback

**Use Case:** Entities → Draft Phase can override General Settings

```typescript
// Draft Phase Settings
const draftSettings = useUnifiedLineDraft();

// Global Settings
const globalSettings = useLineSettingsFromProvider();

// Effective Settings (with fallback)
const effectiveSettings = draftSettings.overrideGlobalSettings
  ? draftSettings.lineSettings  // Use draft-specific
  : globalSettings.settings;     // Fall back to global
```

---

### Pattern 3: Debounced Updates

**Problem:** Rapid slider changes cause too many re-renders

**Solution:** Debounce updates to localStorage

```typescript
import { useDebouncedCallback } from 'use-debounce';

const debouncedSave = useDebouncedCallback(
  (settings) => {
    localStorage.setItem('dxf-settings-general-lines', JSON.stringify(settings));
  },
  500 // 500ms debounce
);

const updateLineSettings = (newSettings) => {
  setLineSettings(newSettings);      // Immediate UI update
  debouncedSave(newSettings);        // Debounced persistence
};
```

---

## ⚡ PERFORMANCE OPTIMIZATIONS

### 1. **React.memo for Expensive Components**

```typescript
// LinePreview re-renders only when settings change
export const LinePreview = React.memo(({ settings }) => {
  return <canvas>...</canvas>;
}, (prevProps, nextProps) => {
  return isEqual(prevProps.settings, nextProps.settings);
});
```

---

### 2. **useMemo for Derived State**

```typescript
// Expensive calculation - memoized
const effectiveSettings = useMemo(() => {
  return calculateEffectiveSettings(
    draftSettings,
    globalSettings,
    overrideFlags
  );
}, [draftSettings, globalSettings, overrideFlags]);
```

---

### 3. **useCallback for Event Handlers**

```typescript
// Stable callback reference (prevents child re-renders)
const handleColorChange = useCallback((color: string) => {
  updateLineSettings({ color });
}, [updateLineSettings]);
```

---

### 4. **Context Splitting**

```typescript
// ❌ BAD: One context for all settings (re-renders everything)
<SettingsContext.Provider value={{ lines, text, grips }}>

// ✅ GOOD: Separate contexts (re-render only affected)
<LineSettingsContext.Provider value={lines}>
<TextSettingsContext.Provider value={text}>
<GripSettingsContext.Provider value={grips}>
```

---

## 🧪 TESTING STATE

### Unit Testing State Hooks

```typescript
// hooks/useTabNavigation.test.ts
import { renderHook, act } from '@testing-library/react';
import { useTabNavigation } from './useTabNavigation';

describe('useTabNavigation', () => {
  it('initializes with default tab', () => {
    const { result } = renderHook(() => useTabNavigation('lines'));
    expect(result.current.activeTab).toBe('lines');
  });

  it('updates active tab', () => {
    const { result } = renderHook(() => useTabNavigation('lines'));

    act(() => {
      result.current.setActiveTab('text');
    });

    expect(result.current.activeTab).toBe('text');
  });

  it('resetTab returns to default', () => {
    const { result } = renderHook(() => useTabNavigation('lines'));

    act(() => {
      result.current.setActiveTab('text');
      result.current.resetTab();
    });

    expect(result.current.activeTab).toBe('lines');
  });
});
```

---

### Integration Testing State Persistence

```typescript
// LinesTab.integration.test.tsx
describe('LinesTab Settings Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves settings to localStorage on change', async () => {
    render(<LinesTab />);

    const colorInput = screen.getByLabelText(/line color/i);
    fireEvent.change(colorInput, { target: { value: '#FF0000' } });

    await waitFor(() => {
      const saved = localStorage.getItem('dxf-settings-general-lines');
      const settings = JSON.parse(saved);
      expect(settings.color).toBe('#FF0000');
    });
  });

  it('loads settings from localStorage on mount', () => {
    // Pre-populate localStorage
    localStorage.setItem(
      'dxf-settings-general-lines',
      JSON.stringify({ color: '#00FF00' })
    );

    render(<LinesTab />);

    const colorInput = screen.getByLabelText(/line color/i);
    expect(colorInput).toHaveValue('#00FF00');
  });
});
```

---

## 🔀 MIGRATION PLAN

### Step 1: Extract Local State to Hooks

**Before (ColorPalettePanel):**
```typescript
const [activeTab, setActiveTab] = useState('lines');
const isTabActive = (tabId) => activeTab === tabId;
```

**After (useTabNavigation hook):**
```typescript
const { activeTab, setActiveTab, isTabActive } = useTabNavigation('lines');
```

---

### Step 2: Move to Nearest Component Owner

**Before (All state in ColorPalettePanel):**
```typescript
// ColorPalettePanel.tsx - 2200 lines
const [activeMainTab, setActiveMainTab] = useState('specific');
const [activeGeneralTab, setActiveGeneralTab] = useState('lines');
// ... 15+ more useState
```

**After (State in component that owns it):**
```typescript
// DxfSettingsPanel.tsx - 150 lines
const { activeTab: activeMainTab } = useTabNavigation('specific');

// GeneralSettingsPanel.tsx - 120 lines
const { activeTab: activeGeneralTab } = useTabNavigation('lines');
```

---

### Step 3: Verify No Regressions

**Checklist:**
- [ ] All tabs still accessible
- [ ] Settings persist correctly
- [ ] Preview updates on change
- [ ] No console errors
- [ ] Performance same or better

---

## 🔮 FUTURE: Redux/Zustand Integration (Phase B)

### Current Approach (React Context)

**Pros:**
- ✅ Simple (built-in React)
- ✅ No external dependencies
- ✅ Good for small/medium state

**Cons:**
- ❌ Re-renders all consumers on any change
- ❌ No dev tools (without extra setup)
- ❌ No middleware (logging, persistence)

---

### Future Approach (Zustand - Recommended for Phase B)

**When to migrate:** When we need:
1. Better performance (selective subscriptions)
2. Dev tools (time-travel debugging)
3. Middleware (persistence, logging, undo/redo)
4. Cross-tab synchronization

**Implementation:**
```typescript
// store/dxfSettingsStore.ts (Future - Phase B)
import create from 'zustand';
import { persist } from 'zustand/middleware';

interface DxfSettingsStore {
  lineSettings: LineSettings;
  textSettings: TextSettings;
  updateLineSettings: (settings: Partial<LineSettings>) => void;
}

export const useDxfSettingsStore = create<DxfSettingsStore>()(
  persist(
    (set) => ({
      lineSettings: DEFAULT_LINE_SETTINGS,
      textSettings: DEFAULT_TEXT_SETTINGS,

      updateLineSettings: (newSettings) =>
        set((state) => ({
          lineSettings: { ...state.lineSettings, ...newSettings }
        }))
    }),
    {
      name: 'dxf-settings-storage', // localStorage key
      version: 1
    }
  )
);

// Usage (same API as before!)
const { lineSettings, updateLineSettings } = useDxfSettingsStore();
```

**Benefits:**
- ✅ Selective subscriptions (re-render only what changed)
- ✅ Built-in persistence middleware
- ✅ Dev tools integration
- ✅ Smaller bundle than Redux (~1KB vs ~8KB)

---

## 📚 REFERENCES

### Internal Documentation
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [COMPONENT_GUIDE.md](./COMPONENT_GUIDE.md) - Component details
- [DECISION_LOG.md](./DECISION_LOG.md) - Design decisions
- [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) - Testing approach

### External Resources
- [React Context API](https://react.dev/reference/react/useContext)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [State Management Patterns](https://kentcdodds.com/blog/application-state-management-with-react)
- [localStorage Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)

### Related Enterprise Docs
- [Phase B: Platform State](../../docs/platform/PLATFORM_ARCHITECTURE.md#state-management)
- [Redux/Zustand Evaluation](../../docs/MASTER_ROADMAP.md#phase-b-state-strategy)

---

## 📝 CHANGELOG

| Date | Author | Changes |
|------|--------|---------|
| 2025-10-07 | Claude | Initial state management strategy (Phase A - React Context) |

---

**END OF STATE MANAGEMENT DOCUMENT**
