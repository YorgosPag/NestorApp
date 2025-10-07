# 🏗️ DXF SETTINGS PANEL - ENTERPRISE ARCHITECTURE

---

**📋 Document Type:** Architecture Overview
**🎯 Scope:** DxfSettingsPanel (formerly ColorPalettePanel)
**👤 Architect:** Γιώργος Παγωνής
**🤖 Developer:** Claude (Anthropic AI)
**📅 Created:** 2025-10-07
**📅 Last Updated:** 2025-10-07
**📊 Status:** DRAFT - Pre-Refactoring

---

## 📖 TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [System Context](#system-context)
3. [Architecture Principles](#architecture-principles)
4. [Component Architecture](#component-architecture)
5. [Data Flow](#data-flow)
6. [State Management](#state-management)
7. [Module Structure](#module-structure)
8. [Design Patterns](#design-patterns)
9. [Security & Permissions](#security--permissions)
10. [Performance Considerations](#performance-considerations)
11. [Future Roadmap](#future-roadmap)

---

## 📊 EXECUTIVE SUMMARY

### What is DxfSettingsPanel?

The **DxfSettingsPanel** is the central configuration hub for the DXF Viewer application. It provides a hierarchical settings interface with:

- **2 Main Tabs:** General Settings, Specific Settings
- **3 General Sub-tabs:** Lines, Text, Grips
- **7 Specific Categories:** Cursor, Selection, Grid, Grips, Layers, Entities, Lighting

### Why Refactor?

The original `ColorPalettePanel.tsx` (2200+ lines) violated **Single Responsibility Principle** and created:
- ❌ High maintenance cost
- ❌ Difficult testing
- ❌ Git collaboration conflicts
- ❌ Poor scalability

### Target Architecture

**Modular, Enterprise-Grade Architecture** following:
- ✅ SOLID Principles
- ✅ Clean Architecture (UI → Domain → Infrastructure)
- ✅ Lazy Loading for performance
- ✅ Testable components (unit + integration)
- ✅ Team-friendly structure (minimal Git conflicts)

---

## 🌍 SYSTEM CONTEXT

### Position in DXF Viewer

```
DXF Viewer Application
│
├── App Router (Next.js)
│   └── /dxf/viewer
│       └── DxfViewerContent.tsx
│           └── FloatingPanelContainer.tsx
│               └── usePanelContentRenderer.tsx
│                   └── DxfSettingsPanel.tsx ⭐ (THIS MODULE)
│
├── Centralized Systems
│   ├── CursorSystem (systems/cursor/)
│   ├── RulersGridSystem (systems/rulers-grid/)
│   ├── SelectionSystem (systems/selection/)
│   └── ZoomManager (systems/zoom/)
│
└── Providers
    ├── DxfSettingsProvider
    ├── TransformContext
    └── CanvasContext
```

### External Dependencies

| System | Purpose | Interface |
|--------|---------|-----------|
| **DxfSettingsProvider** | Global settings storage | Hooks: `useLineSettingsFromProvider()`, etc. |
| **CursorSystem** | Cursor/Crosshair settings | Hook: `useCursorSettings()` |
| **RulersGridSystem** | Grid/Rulers settings | Hook: `useRulersGridContext()` |
| **TransformContext** | Viewport transform state | Hook: `useTransform()` |
| **CanvasContext** | Canvas operations | Hook: `useCanvasOperations()` |

---

## 🎯 ARCHITECTURE PRINCIPLES

### 1. **Single Responsibility Principle (SRP)**

**Rule:** Each component has ONE responsibility.

```
❌ OLD (ColorPalettePanel.tsx):
- Main tab routing (General vs Specific)
- Sub-tab routing (Lines, Text, Grips)
- Category routing (7 categories)
- State management (15+ useState)
- All UI rendering
- Settings logic

✅ NEW (Modular):
- DxfSettingsPanel → Main tab routing ONLY
- GeneralSettingsPanel → Sub-tab routing ONLY
- LinesTab → Lines settings UI ONLY
```

### 2. **Open/Closed Principle (OCP)**

**Rule:** Open for extension, closed for modification.

```typescript
// ✅ Adding a new tab? Create new file, don't edit existing
// NEW: tabs/general/ColorsTab.tsx
export const ColorsTab: React.FC = () => { /* ... */ };

// THEN: Update GeneralSettingsPanel routing (minimal change)
case 'colors': return <LazyColorsTab />;
```

### 3. **Dependency Inversion Principle (DIP)**

**Rule:** Depend on abstractions (hooks), not concretions.

```typescript
// ✅ LinesTab depends on abstraction (hook)
const lineSettings = useLineSettingsFromProvider();

// ❌ NOT this (direct dependency):
import { DxfSettingsProvider } from '...';
const settings = DxfSettingsProvider.getLineSettings();
```

### 4. **Separation of Concerns (SoC)**

**Rule:** UI, Logic, State are separate.

```
UI Layer:         tabs/general/LinesTab.tsx
Logic Layer:      hooks/useLineSettingsFromProvider.ts
State Layer:      providers/DxfSettingsProvider.tsx
```

### 5. **Don't Repeat Yourself (DRY)**

**Rule:** Reusable components for common patterns.

```typescript
// ✅ Generic tab navigation (reusable)
<TabNavigation tabs={tabs} activeTab={activeTab} onTabClick={setActiveTab} />

// Used by:
// - GeneralSettingsPanel (Lines, Text, Grips)
// - SpecificSettingsPanel (7 categories)
// - GridCategory (Grid, Rulers)
```

---

## 🏛️ COMPONENT ARCHITECTURE

### Layered Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER (UI Components)                         │
│  ├── DxfSettingsPanel.tsx (Main Router)                     │
│  ├── Panels (GeneralSettingsPanel, SpecificSettingsPanel)   │
│  ├── Tabs (LinesTab, TextTab, GripsTab)                     │
│  └── Categories (CursorCategory, GridCategory, etc.)        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  APPLICATION LAYER (Hooks & Logic)                          │
│  ├── useTabNavigation (Tab state management)                │
│  ├── useCategoryNavigation (Category state)                 │
│  ├── useLineSettingsFromProvider (Settings access)          │
│  └── useUnifiedLinePreview (Preview logic)                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  DOMAIN LAYER (Business Logic)                              │
│  ├── Line Settings (ISO 128 standards)                      │
│  ├── Text Settings (ISO 3098 standards)                     │
│  ├── Grip Settings (AutoCAD standards)                      │
│  └── Validation Rules (min/max, formats)                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  INFRASTRUCTURE LAYER (Storage & External)                  │
│  ├── DxfSettingsProvider (React Context)                    │
│  ├── localStorage Persistence                               │
│  ├── CursorSystem Integration                               │
│  └── RulersGridSystem Integration                           │
└─────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
DxfSettingsPanel (Root)
│
├── Main Tab Navigation
│   ├── Button: "Γενικές Ρυθμίσεις"
│   └── Button: "Ειδικές Ρυθμίσεις"
│
├── GeneralSettingsPanel (activeMainTab === 'general')
│   │
│   ├── Sub-Tab Navigation
│   │   ├── Button: "Γραμμές"
│   │   ├── Button: "Κείμενο"
│   │   └── Button: "Grips"
│   │
│   └── Tab Content (Lazy Loaded)
│       ├── LinesTab (activeGeneralTab === 'lines')
│       │   ├── LinePreview
│       │   ├── CurrentSettingsDisplay
│       │   └── LineSettings
│       │
│       ├── TextTab (activeGeneralTab === 'text')
│       │   ├── TextPreview
│       │   ├── CurrentSettingsDisplay
│       │   └── TextSettings
│       │
│       └── GripsTab (activeGeneralTab === 'grips')
│           ├── GripPreview
│           ├── CurrentSettingsDisplay
│           └── GripSettings
│
└── SpecificSettingsPanel (activeMainTab === 'specific')
    │
    ├── Category Navigation (7 Icon Buttons)
    │   ├── 🎯 Crosshair & Cursor
    │   ├── 📦 Selection Boxes
    │   ├── 📏 Grid & Rulers
    │   ├── 🔘 Grips & Handles
    │   ├── 🎨 Layer Colors
    │   ├── 🏗️ Entities
    │   └── 💡 Lighting & Effects
    │
    └── Category Content (Lazy Loaded)
        ├── CursorCategory (activeCategory === 'cursor')
        │   ├── Sub-tabs: Crosshair, Cursor
        │   └── CursorSettings
        │
        ├── SelectionCategory (activeCategory === 'selection')
        │   ├── Sub-tabs: Window, Crossing
        │   └── SelectionSettings
        │
        ├── GridCategory (activeCategory === 'grid')
        │   ├── Sub-tabs: Grid (Major/Minor), Rulers (4 tabs)
        │   └── Grid/Ruler Settings
        │
        ├── LayersCategory (activeCategory === 'layers')
        │   └── LayersSettings
        │
        ├── EntitiesCategory (activeCategory === 'entities')
        │   ├── Tool Categories: Drawing, Measurements
        │   ├── Tool Icons: 8 tools
        │   └── Line Tool: 4 phases × 3 sub-tabs
        │
        ├── GripsCategory (Coming Soon)
        └── LightingCategory (Coming Soon)
```

---

## 🔄 DATA FLOW

### Settings Read Flow (User Views Settings)

```
┌──────────────┐
│  User Opens  │
│  DxfSettings │
│    Panel     │
└──────┬───────┘
       │
       ↓
┌──────────────────────┐
│  DxfSettingsPanel    │
│  (Routing Only)      │
└──────┬───────────────┘
       │
       ↓ (activeMainTab === 'general')
┌──────────────────────────┐
│  GeneralSettingsPanel    │
│  (Sub-tab Routing)       │
└──────┬───────────────────┘
       │
       ↓ (activeGeneralTab === 'lines')
┌──────────────────────────┐
│  LinesTab                │
│  └─ useLineSettings()    │◄─────┐
└──────┬───────────────────┘      │
       │                           │
       ↓                           │
┌──────────────────────────┐      │
│  LineSettings Component  │      │
│  (Renders UI)            │      │
└──────────────────────────┘      │
                                  │
                                  │
                          ┌───────┴────────┐
                          │ DxfSettings    │
                          │ Provider       │
                          │ (React Context)│
                          └───────┬────────┘
                                  │
                                  ↓
                          ┌───────────────┐
                          │ localStorage  │
                          │ (Persistence) │
                          └───────────────┘
```

### Settings Write Flow (User Changes Settings)

```
┌──────────────┐
│  User Changes│
│  Line Color  │
│  to #FF0000  │
└──────┬───────┘
       │
       ↓
┌──────────────────────┐
│  LineSettings        │
│  onChange handler    │
└──────┬───────────────┘
       │
       ↓
┌──────────────────────────────┐
│  useLineSettings().update()  │
└──────┬───────────────────────┘
       │
       ↓
┌──────────────────────────┐
│  DxfSettingsProvider     │
│  updateLineSettings()    │
└──────┬───────────────────┘
       │
       ├──────────────────────┐
       │                      │
       ↓                      ↓
┌──────────────┐    ┌─────────────────┐
│ React State  │    │  localStorage   │
│ (Immediate)  │    │  (Persist)      │
└──────┬───────┘    └─────────────────┘
       │
       ↓
┌──────────────────────┐
│  All Subscribers     │
│  Re-render           │
│  ├─ LinePreview      │
│  ├─ LinesTab         │
│  └─ Canvas (via hook)│
└──────────────────────┘
```

### Preview Synchronization Flow

```
General Settings Tab              Specific Settings (Entities)
┌──────────────────┐              ┌──────────────────────────┐
│ LinesTab         │              │ EntitiesCategory         │
│ ├─ lineSettings  │              │ ├─ Line Tool → Draft     │
│ └─ updateSettings│              │ └─ draftSettings         │
└────────┬─────────┘              └────────┬─────────────────┘
         │                                  │
         │                                  │
         ↓                                  ↓
┌─────────────────────────────────────────────────────────────┐
│           DxfSettingsProvider (Global State)                │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ General      │  │ Draft        │  │ Hover           │   │
│  │ Line Settings│  │ Line Settings│  │ Line Settings   │   │
│  └──────────────┘  └──────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         │                                  │
         │                                  │
         ↓                                  ↓
┌──────────────────┐              ┌──────────────────────────┐
│ LinePreview      │              │ Draft Phase Preview      │
│ (General Tab)    │              │ (Entities Category)      │
└──────────────────┘              └──────────────────────────┘

Override Logic:
- If draftSettings.overrideGlobalSettings === true
  → Use draftSettings.lineSettings
- Else
  → Use global lineSettings (from General Tab)
```

---

## 📦 STATE MANAGEMENT

### State Ownership Map

| Component | State Owned | Scope | Persistence |
|-----------|-------------|-------|-------------|
| **DxfSettingsPanel** | `activeMainTab` | Local | Session only |
| **GeneralSettingsPanel** | `activeGeneralTab` | Local | Session only |
| **SpecificSettingsPanel** | `activeCategory` | Local | Session only |
| **LinesTab** | Preview state (temp) | Local | None |
| **DxfSettingsProvider** | Line/Text/Grip settings | Global | localStorage |
| **CursorSystem** | Cursor/Crosshair settings | System | localStorage |
| **RulersGridSystem** | Grid/Rulers settings | System | localStorage |

### State Synchronization Strategy

**Problem:** Settings can be changed in multiple places:
1. General Settings → Lines Tab
2. Specific Settings → Entities → Line Tool → Draft Phase

**Solution:** Single Source of Truth with Override Pattern

```typescript
// SINGLE SOURCE OF TRUTH: DxfSettingsProvider
const globalLineSettings = useLineSettingsFromProvider();

// OVERRIDE PATTERN: Entities → Draft Phase
const draftSettings = useUnifiedLineDraft();

// EFFECTIVE SETTINGS (computed):
const effectiveSettings = draftSettings.overrideGlobalSettings
  ? draftSettings.lineSettings
  : globalLineSettings.settings;
```

**Benefits:**
- ✅ No state duplication
- ✅ Clear ownership
- ✅ Predictable behavior
- ✅ Easy to test

---

## 📁 MODULE STRUCTURE

### Folder Structure (Target)

```
src/subapps/dxf-viewer/ui/components/dxf-settings/
│
├── 📄 DxfSettingsPanel.tsx                  (Main entry point - 150 lines)
├── 📄 LazyComponents.tsx                    (Lazy loading exports)
│
├── 📂 panels/
│   ├── 📄 GeneralSettingsPanel.tsx          (Sub-tab routing - 120 lines)
│   └── 📄 SpecificSettingsPanel.tsx         (Category routing - 150 lines)
│
├── 📂 tabs/
│   └── 📂 general/
│       ├── 📄 LinesTab.tsx                  (Lines settings UI - 200 lines)
│       ├── 📄 TextTab.tsx                   (Text settings UI - 200 lines)
│       └── 📄 GripsTab.tsx                  (Grips settings UI - 200 lines)
│
├── 📂 categories/
│   ├── 📄 CursorCategory.tsx                (Cursor settings - 300 lines)
│   ├── 📄 SelectionCategory.tsx             (Selection settings - 300 lines)
│   ├── 📄 GridCategory.tsx                  (Grid/Rulers - 400 lines)
│   ├── 📄 GripsCategory.tsx                 (Coming Soon - 100 lines)
│   ├── 📄 LayersCategory.tsx                (Layers settings - 200 lines)
│   ├── 📄 EntitiesCategory.tsx              (Entities settings - 600 lines)
│   └── 📄 LightingCategory.tsx              (Coming Soon - 100 lines)
│
├── 📂 settings/                              (EXISTING - NO CHANGES)
│   ├── 📂 core/
│   │   ├── 📄 LineSettings.tsx              (Line properties UI)
│   │   ├── 📄 TextSettings.tsx              (Text properties UI)
│   │   └── 📄 GripSettings.tsx              (Grip properties UI)
│   └── 📂 special/
│       ├── 📄 CursorSettings.tsx
│       ├── 📄 SelectionSettings.tsx
│       ├── 📄 LayersSettings.tsx
│       ├── 📄 EntitiesSettings.tsx
│       └── 📄 ComingSoonSettings.tsx
│
├── 📂 shared/
│   ├── 📄 LinePreview.tsx                   (Existing)
│   ├── 📄 CurrentSettingsDisplay.tsx        (Existing)
│   ├── 📄 OverrideToggle.tsx                (Existing)
│   ├── 📄 SubTabRenderer.tsx                (Existing)
│   ├── 📄 TabNavigation.tsx                 🆕 Generic tab nav
│   └── 📄 CategoryButton.tsx                🆕 Generic category button
│
├── 📂 hooks/                                 🆕 New folder
│   ├── 📄 useTabNavigation.ts               🆕 Tab state management
│   ├── 📄 useCategoryNavigation.ts          🆕 Category state
│   └── 📄 useSettingsPreview.ts             🆕 Preview sync
│
└── 📂 icons/
    └── 📄 DxfSettingsIcons.tsx              (Existing)
```

### Module Boundaries

**Rule:** Strict import boundaries to prevent circular dependencies.

```typescript
// ✅ ALLOWED:
// tabs/general/LinesTab.tsx
import { LineSettings } from '../../settings/core/LineSettings';
import { TabNavigation } from '../../shared/TabNavigation';
import { useLineSettingsFromProvider } from '../../../../providers/DxfSettingsProvider';

// ❌ FORBIDDEN:
// tabs/general/LinesTab.tsx
import { TextTab } from './TextTab'; // ❌ Tabs should not import other tabs
import { GeneralSettingsPanel } from '../../panels/GeneralSettingsPanel'; // ❌ Child cannot import parent
```

**Enforced by:** ESLint rules (future: `eslint-plugin-boundaries`)

---

## 🎨 DESIGN PATTERNS

### 1. **Container/Presenter Pattern**

**Container:** Manages state and logic
**Presenter:** Pure UI, receives props

```typescript
// CONTAINER: GeneralSettingsPanel (state + routing)
export const GeneralSettingsPanel: React.FC = () => {
  const { activeTab, setActiveTab } = useTabNavigation('lines');

  return (
    <TabNavigationPresenter
      tabs={tabs}
      activeTab={activeTab}
      onTabClick={setActiveTab}
    />
  );
};

// PRESENTER: TabNavigation (pure UI)
export const TabNavigation: React.FC<TabNavigationProps> = ({
  tabs, activeTab, onTabClick
}) => {
  return (/* Pure UI rendering */);
};
```

### 2. **Factory Pattern**

**Use Case:** Creating appropriate component based on type

```typescript
// LazyComponents.tsx (Factory)
export const LazyLinesTab = lazy(() => import('./tabs/general/LinesTab'));
export const LazyTextTab = lazy(() => import('./tabs/general/TextTab'));

// GeneralSettingsPanel (Factory User)
const renderTabContent = () => {
  switch (activeTab) {
    case 'lines': return <LazyLinesTab />;
    case 'text': return <LazyTextTab />;
    // Factory creates appropriate component
  }
};
```

### 3. **Strategy Pattern**

**Use Case:** Different preview strategies per context

```typescript
// Different strategies for line preview
interface LinePreviewStrategy {
  getEffectiveSettings(): LineSettings;
}

class GeneralTabStrategy implements LinePreviewStrategy {
  getEffectiveSettings() {
    return useLineSettingsFromProvider().settings;
  }
}

class DraftPhaseStrategy implements LinePreviewStrategy {
  getEffectiveSettings() {
    const draft = useUnifiedLineDraft();
    return draft.overrideGlobalSettings
      ? draft.lineSettings
      : globalSettings;
  }
}
```

### 4. **Facade Pattern**

**Use Case:** Simplify complex subsystem

```typescript
// DxfSettingsPanel is a facade for entire settings system
<DxfSettingsPanel /> // Simple API

// Behind the scenes:
// - GeneralSettingsPanel
// - SpecificSettingsPanel
// - 3 General tabs
// - 7 Specific categories
// - 15+ sub-components
```

### 5. **Composition Pattern**

**Use Case:** Build complex UI from simple components

```typescript
// LinesTab composed of smaller parts
<LinesTab>
  <LinePreview settings={effectiveSettings} />
  <CurrentSettingsDisplay activeTab="lines" />
  <LineSettings />
</LinesTab>
```

---

## 🔒 SECURITY & PERMISSIONS

### Current State

**No RBAC implemented** - All settings accessible to all users.

### Future Enterprise Requirements (Post-Refactoring)

1. **Role-Based Access Control (RBAC)**
   ```typescript
   // Example: Only admins can change global settings
   const { hasPermission } = usePermissions();

   if (!hasPermission('settings.global.edit')) {
     return <ReadOnlySettings />;
   }
   ```

2. **Feature Flags**
   ```typescript
   // Example: Hide "Coming Soon" categories unless flag enabled
   const { isFeatureEnabled } = useFeatureFlags();

   if (!isFeatureEnabled('settings.lighting')) {
     return null; // Don't show Lighting category
   }
   ```

3. **Audit Trails**
   ```typescript
   // Log all settings changes
   const updateSettings = (newSettings) => {
     auditLog.record({
       action: 'settings.line.update',
       user: currentUser.id,
       before: currentSettings,
       after: newSettings,
       timestamp: Date.now()
     });
   };
   ```

---

## ⚡ PERFORMANCE CONSIDERATIONS

### Lazy Loading Strategy

**Problem:** Loading all 25+ components upfront is slow.

**Solution:** Code splitting with React.lazy()

```typescript
// Only load active tab/category
const LazyLinesTab = lazy(() => import('./tabs/general/LinesTab'));

// Result:
// - Initial bundle: Only DxfSettingsPanel + GeneralSettingsPanel (~20KB)
// - On tab click: Load LinesTab chunk (~30KB)
// - Total savings: ~80% reduction in initial load
```

### Memoization

**Problem:** Re-rendering expensive components on every state change.

**Solution:** React.memo + useMemo + useCallback

```typescript
// Memoize expensive preview calculation
const effectiveSettings = useMemo(
  () => getEffectiveLineSettings(),
  [overrideSettings, globalSettings]
);

// Memoize component
export const LinePreview = React.memo(({ settings }) => {
  // Only re-render if settings change
});
```

### Virtual Scrolling (Future)

**Problem:** EntitiesCategory has 8+ tools, each with 4 phases × 3 sub-tabs = 96 possible states.

**Solution:** Virtual scrolling for long lists (future enhancement).

---

## 🚀 FUTURE ROADMAP

### Phase 1: UI Refactoring (Current) - 37 hours
- ✅ Modular component structure
- ✅ Lazy loading
- ✅ Unit + Integration tests

### Phase 2: Enterprise Hardening (Post-Refactoring) - TBD

Based on ChatGPT-5 feedback, add:

1. **Domain/Use-Case Layer** (Week 6)
   - Extract business logic from UI
   - Create `domain/` folder with entities, use-cases, ports

2. **State Management Upgrade** (Week 7)
   - Evaluate Redux Toolkit vs Zustand vs React Query
   - Centralized state strategy
   - Cache/invalidation policy

3. **Observability** (Week 8)
   - Sentry integration
   - Structured logging
   - Performance budgets (Lighthouse CI)

4. **Security** (Week 9)
   - RBAC implementation
   - Feature flags (LaunchDarkly or similar)
   - Audit trails

5. **Design System** (Week 10)
   - Storybook setup
   - Design tokens
   - Dark mode support
   - a11y compliance (WCAG 2.1 AA)

6. **Testing Strategy** (Week 11)
   - Contract tests (consumer-driven)
   - E2E critical flows (Playwright)
   - Visual regression suite (Chromatic)
   - Coverage target: 80%+ per layer

7. **CI/CD Pipeline** (Week 12)
   - Quality gates (lint, test, build)
   - Preview environments (Vercel/Netlify)
   - Automated releases

8. **Documentation** (Ongoing)
   - ADRs for key decisions
   - API documentation
   - Runbooks for incidents

---

## 📚 REFERENCES

### Internal Documentation
- [REFACTORING_ROADMAP_ColorPalettePanel.md](./REFACTORING_ROADMAP_ColorPalettePanel.md)
- [COMPONENT_GUIDE.md](./COMPONENT_GUIDE.md)
- [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md)
- [TESTING_STRATEGY.md](./TESTING_STRATEGY.md)
- [DECISION_LOG.md](./DECISION_LOG.md)

### External Standards
- **ISO 128:** Line conventions (General Settings → Lines)
- **ISO 3098:** Text conventions (General Settings → Text)
- **AutoCAD Standards:** Grip conventions (General Settings → Grips)
- **SOLID Principles:** https://en.wikipedia.org/wiki/SOLID
- **Clean Architecture:** https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html

---

## 📝 CHANGELOG

| Date | Author | Changes |
|------|--------|---------|
| 2025-10-07 | Claude | Initial draft - Pre-refactoring architecture |

---

**END OF ARCHITECTURE DOCUMENT**
