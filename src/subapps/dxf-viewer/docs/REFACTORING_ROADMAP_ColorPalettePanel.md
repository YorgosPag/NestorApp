# 🏢 ENTERPRISE REFACTORING ROADMAP
## DxfSettingsPanel.tsx → Modular DxfSettingsPanel Structure

---

**📋 Αρχιτέκτονας:** Γιώργος Παγωνής
**🤖 Developer:** Claude (Anthropic AI)
**📅 Date Created:** 2025-10-07
**🎯 Objective:** Refactor monolithic DxfSettingsPanel.tsx (2200+ lines) → Enterprise modular structure

---

## 📊 EXECUTIVE SUMMARY

| Metric | Current (AS-IS) | Target (TO-BE) | Improvement |
|--------|-----------------|----------------|-------------|
| **Total Files** | 1 monolithic | 25+ modular | +2400% modularity |
| **Max File Size** | 2200+ lines | ~600 lines | -73% complexity |
| **Avg File Size** | N/A | ~200 lines | Maintainable |
| **Testability** | ❌ Hard | ✅ Easy | Unit tests per tab |
| **Git Conflicts** | ❌ High risk | ✅ Low risk | Team-friendly |
| **Lazy Loading** | ❌ Limited | ✅ Full | Performance boost |
| **Debugging** | ❌ 2200 lines | ✅ ~200 lines | -90% search time |

---

## 🔍 CURRENT STATE ANALYSIS (AS-IS)

### 📂 Current File Structure

```
ui/components/
├── DxfSettingsPanel.tsx                 ❌ 2200+ lines (MONOLITHIC)
│   │
│   ├── Contains ALL logic:
│   │   ├── Main tab routing (General vs Specific)
│   │   ├── Sub-tab routing (Lines, Text, Grips)
│   │   ├── Category routing (7 categories)
│   │   ├── State management (15+ useState hooks)
│   │   ├── All UI rendering
│   │   ├── Cursor settings integration
│   │   ├── Grid/Rulers settings integration
│   │   ├── Line/Text/Grip settings integration
│   │   └── Preview components
│   │
│   └── Lines breakdown:
│       ├── Lines 1-100: Imports & types
│       ├── Lines 101-200: State declarations
│       ├── Lines 201-500: Cursor/Grid logic
│       ├── Lines 501-1000: General Settings UI
│       ├── Lines 1001-1500: Specific Settings UI (7 categories)
│       ├── Lines 1501-2000: Category rendering (Grid, Cursor, Selection, etc.)
│       └── Lines 2001-2200+: Main render & exports
│
├── dxf-settings/
│   ├── settings/
│   │   ├── core/                         ✅ Good structure
│   │   │   ├── LineSettings.tsx
│   │   │   ├── TextSettings.tsx
│   │   │   └── GripSettings.tsx
│   │   └── special/                      ✅ Good structure
│   │       ├── EntitiesSettings.tsx      (560 lines - also needs refactoring)
│   │       ├── CursorSettings.tsx
│   │       ├── SelectionSettings.tsx
│   │       └── LayersSettings.tsx
│   └── icons/
│       └── DxfSettingsIcons.tsx          ✅ Good structure
```

### 🐛 Current Problems

#### 1. **Monolithic Architecture**
```typescript
// DxfSettingsPanel.tsx (Lines 59-100+)
const [activeMainTab, setActiveMainTab] = useState<MainTab>('specific');
const [activeGeneralTab, setActiveGeneralTab] = useState<GeneralTab>('lines');
const [activeCategory, setActiveCategory] = useState<ColorCategory>('selection');
const [activeCursorTab, setActiveCursorTab] = useState<'crosshair' | 'cursor'>('crosshair');
const [activeSelectionTab, setActiveSelectionTab] = useState<'window' | 'crossing'>('window');
const [activeGridTab, setActiveGridTab] = useState<'grid' | 'rulers'>('grid');
const [activeGridLinesTab, setActiveGridLinesTab] = useState<'major' | 'minor'>('major');
const [activeRulerTab, setActiveRulerTab] = useState<'background' | 'lines' | 'text' | 'units'>('background');
// ... 10+ more useState hooks!
```

**Problem:** All state in ONE component → hard to test, debug, maintain

#### 2. **Render Logic Mixing**
```typescript
// Lines 2146-2220+ - General Settings rendering
{activeMainTab === 'general' && (
  <div className="min-h-[850px] max-h-[96vh] overflow-y-auto">
    {/* Preview */}
    {/* Current Settings Display */}
    {/* Sub-tabs Navigation */}
    {activeGeneralTab === 'lines' && <LineSettings />}
    {activeGeneralTab === 'text' && <TextSettings />}
    {activeGeneralTab === 'grips' && <GripSettings />}
  </div>
)}

// Lines 2225+ - Specific Settings rendering
{activeMainTab === 'specific' && (
  <div>
    {/* Category Navigation - 7 icon buttons */}
    {/* Category Content Rendering */}
    {renderCategoryContent()}
  </div>
)}
```

**Problem:** Routing + Rendering + State in SAME component → violation of Single Responsibility

#### 3. **renderCategoryContent() Method (Lines 1500+)**
```typescript
const renderCategoryContent = () => {
  switch (activeCategory) {
    case 'cursor':
      return (/* 200+ lines of Cursor UI */);
    case 'selection':
      return (/* 150+ lines of Selection UI */);
    case 'grid':
      return (/* 300+ lines of Grid/Rulers UI */);
    case 'entities':
      return <EntitiesSettings />;
    case 'layers':
      return <LayersSettings />;
    // ... more cases
  }
};
```

**Problem:** Huge switch statement → should be separate components

#### 4. **Testing Challenges**
```typescript
// HOW do you unit test JUST the Lines tab?
// Answer: You CAN'T! It's all in one 2200-line component!

// Current approach:
import { DxfSettingsPanel } from './DxfSettingsPanel';
// You have to test the ENTIRE component, not just Lines tab
```

**Problem:** No isolated testing → slow, brittle tests

#### 5. **Git Collaboration Issues**
```bash
# Scenario: 2 developers working simultaneously
Developer A: Editing Lines tab (lines 2210-2220)
Developer B: Editing Grid category (lines 1700-1850)

# Result: Git conflict in DxfSettingsPanel.tsx!
# Even though they're working on DIFFERENT features!
```

**Problem:** High conflict risk → slows down team velocity

---

## 🎯 TARGET STATE (TO-BE)

### 📂 Target File Structure

```
ui/components/dxf-settings/
│
├── 📄 DxfSettingsPanel.tsx                      (~150 lines)
│   ├── Responsibility: Main tab routing (General vs Specific)
│   ├── State: activeMainTab only
│   └── Renders: GeneralSettingsPanel OR SpecificSettingsPanel
│
├── 📂 panels/
│   ├── 📄 GeneralSettingsPanel.tsx              (~120 lines)
│   │   ├── Responsibility: Sub-tab routing (Lines, Text, Grips)
│   │   ├── State: activeGeneralTab only
│   │   ├── Renders: Tab navigation + active tab content
│   │   └── Lazy loads: LinesTab, TextTab, GripsTab
│   │
│   └── 📄 SpecificSettingsPanel.tsx             (~150 lines)
│       ├── Responsibility: Category routing (7 categories)
│       ├── State: activeCategory only
│       ├── Renders: Category icons + active category content
│       └── Lazy loads: 7 category components
│
├── 📂 tabs/
│   └── 📂 general/
│       ├── 📄 LinesTab.tsx                      (~200 lines)
│       │   ├── Responsibility: Lines settings UI only
│       │   ├── Hook: useLineSettingsFromProvider()
│       │   ├── Preview: LinePreview component
│       │   └── Settings: LineSettings component
│       │
│       ├── 📄 TextTab.tsx                       (~200 lines)
│       │   ├── Responsibility: Text settings UI only
│       │   ├── Hook: useTextSettingsFromProvider()
│       │   ├── Preview: TextPreview component
│       │   └── Settings: TextSettings component
│       │
│       └── 📄 GripsTab.tsx                      (~200 lines)
│           ├── Responsibility: Grips settings UI only
│           ├── Hook: useGripSettingsFromProvider()
│           ├── Preview: GripPreview component
│           └── Settings: GripSettings component
│
├── 📂 categories/
│   ├── 📄 CursorCategory.tsx                    (~300 lines)
│   │   ├── Responsibility: Cursor settings (Crosshair + Cursor)
│   │   ├── Sub-tabs: Crosshair, Cursor
│   │   └── Hook: useCursorSettings()
│   │
│   ├── 📄 SelectionCategory.tsx                 (~300 lines)
│   │   ├── Responsibility: Selection settings (Window + Crossing)
│   │   └── Sub-tabs: Window, Crossing
│   │
│   ├── 📄 GridCategory.tsx                      (~400 lines)
│   │   ├── Responsibility: Grid & Rulers settings
│   │   ├── Sub-tabs: Grid (Major/Minor), Rulers (4 tabs)
│   │   └── Hook: useRulersGridContext()
│   │
│   ├── 📄 GripsCategory.tsx                     (~100 lines)
│   │   └── Coming Soon placeholder
│   │
│   ├── 📄 LayersCategory.tsx                    (~200 lines)
│   │   └── Layers settings
│   │
│   ├── 📄 EntitiesCategory.tsx                  (~600 lines)
│   │   ├── Responsibility: Entities settings
│   │   ├── Tool categories: Drawing, Measurements
│   │   └── Tool-specific settings (Line tool: 4 phases)
│   │
│   └── 📄 LightingCategory.tsx                  (~100 lines)
│       └── Coming Soon placeholder
│
├── 📂 settings/                                  (EXISTING - NO CHANGES)
│   ├── core/ (LineSettings, TextSettings, GripSettings)
│   └── special/ (EntitiesSettings, CursorSettings, etc.)
│
├── 📂 shared/                                    (EXISTING + NEW)
│   ├── 📄 LinePreview.tsx                       ✅ Existing
│   ├── 📄 CurrentSettingsDisplay.tsx            ✅ Existing
│   ├── 📄 OverrideToggle.tsx                    ✅ Existing
│   ├── 📄 SubTabRenderer.tsx                    ✅ Existing
│   ├── 📄 TabNavigation.tsx                     🆕 New (generic tab nav)
│   └── 📄 CategoryButton.tsx                    🆕 New (generic category button)
│
├── 📂 hooks/                                     🆕 New folder
│   ├── 📄 useTabNavigation.ts                   🆕 Tab state management
│   ├── 📄 useCategoryNavigation.ts              🆕 Category state management
│   └── 📄 useSettingsPreview.ts                 🆕 Preview synchronization
│
└── 📂 icons/                                     (EXISTING - NO CHANGES)
    └── DxfSettingsIcons.tsx
```

### ✅ Benefits of Target Structure

1. **Single Responsibility:** Each file has ONE job
2. **Easy Testing:** Unit test each tab/category independently
3. **Team Collaboration:** Developers work in different files → no conflicts
4. **Performance:** Lazy load only active tab/category
5. **Maintainability:** Bug in Lines tab? → Check LinesTab.tsx (~200 lines)
6. **Scalability:** New tab/category? → Create new file, don't edit existing

---

## 🗺️ MIGRATION ROADMAP

### PHASE 1: PREPARATION & SETUP (Pre-Migration)

#### ✅ STEP 1.1: Create Folder Structure
**Duration:** 15 minutes
**Risk:** ⚪ None (only folder creation)

```bash
# Create new folders
ui/components/dxf-settings/
├── panels/
├── tabs/
│   └── general/
├── categories/
├── hooks/
└── shared/  # Already exists, just add new files
```

**Checklist:**
- [ ] Create `panels/` folder
- [ ] Create `tabs/general/` folder
- [ ] Create `categories/` folder
- [ ] Create `hooks/` folder
- [ ] Verify `shared/` folder exists
- [ ] Git commit: "chore: Create folder structure for DxfSettings refactoring"

---

#### ✅ STEP 1.2: Create Placeholder Files
**Duration:** 20 minutes
**Risk:** ⚪ None (empty files with basic structure)

```typescript
// Example: LinesTab.tsx placeholder
import React from 'react';

export interface LinesTabProps {
  onSettingChange?: (key: string, value: unknown) => void;
  currentSettings?: Record<string, unknown>;
}

export const LinesTab: React.FC<LinesTabProps> = () => {
  return (
    <div className="p-4">
      <h2>Lines Tab - Coming Soon</h2>
      <p>This tab will contain Lines settings from DxfSettingsPanel</p>
    </div>
  );
};
```

**Files to create:**
- [ ] `panels/GeneralSettingsPanel.tsx` (placeholder)
- [ ] `panels/SpecificSettingsPanel.tsx` (placeholder)
- [ ] `tabs/general/LinesTab.tsx` (placeholder)
- [ ] `tabs/general/TextTab.tsx` (placeholder)
- [ ] `tabs/general/GripsTab.tsx` (placeholder)
- [ ] `categories/CursorCategory.tsx` (placeholder)
- [ ] `categories/SelectionCategory.tsx` (placeholder)
- [ ] `categories/GridCategory.tsx` (placeholder)
- [ ] `categories/GripsCategory.tsx` (placeholder)
- [ ] `categories/LayersCategory.tsx` (placeholder)
- [ ] `categories/EntitiesCategory.tsx` (placeholder)
- [ ] `categories/LightingCategory.tsx` (placeholder)
- [ ] `DxfSettingsPanel.tsx` (placeholder)
- [ ] Git commit: "chore: Create placeholder files for DxfSettings refactoring"

---

#### ✅ STEP 1.3: Setup Lazy Loading Infrastructure
**Duration:** 30 minutes
**Risk:** 🟡 Low (needs testing)

```typescript
// ui/components/dxf-settings/LazyComponents.tsx
import { lazy } from 'react';

// General Settings Tabs
export const LazyLinesTab = lazy(() => import('./tabs/general/LinesTab').then(m => ({ default: m.LinesTab })));
export const LazyTextTab = lazy(() => import('./tabs/general/TextTab').then(m => ({ default: m.TextTab })));
export const LazyGripsTab = lazy(() => import('./tabs/general/GripsTab').then(m => ({ default: m.GripsTab })));

// Specific Settings Categories
export const LazyCursorCategory = lazy(() => import('./categories/CursorCategory').then(m => ({ default: m.CursorCategory })));
export const LazySelectionCategory = lazy(() => import('./categories/SelectionCategory').then(m => ({ default: m.SelectionCategory })));
export const LazyGridCategory = lazy(() => import('./categories/GridCategory').then(m => ({ default: m.GridCategory })));
export const LazyGripsCategory = lazy(() => import('./categories/GripsCategory').then(m => ({ default: m.GripsCategory })));
export const LazyLayersCategory = lazy(() => import('./categories/LayersCategory').then(m => ({ default: m.LayersCategory })));
export const LazyEntitiesCategory = lazy(() => import('./categories/EntitiesCategory').then(m => ({ default: m.EntitiesCategory })));
export const LazyLightingCategory = lazy(() => import('./categories/LightingCategory').then(m => ({ default: m.LightingCategory })));
```

**Checklist:**
- [ ] Create `LazyComponents.tsx`
- [ ] Add lazy imports for all tabs
- [ ] Add lazy imports for all categories
- [ ] Test lazy loading with placeholders
- [ ] Git commit: "feat: Setup lazy loading infrastructure for DxfSettings"

---

#### ✅ STEP 1.4: Create Shared Hooks
**Duration:** 45 minutes
**Risk:** 🟡 Low (pure logic, easy to test)

**File 1: `hooks/useTabNavigation.ts`**
```typescript
import { useState, useCallback } from 'react';

export type TabId = string;

export interface UseTabNavigationReturn {
  activeTab: TabId | null;
  setActiveTab: (tabId: TabId) => void;
  isTabActive: (tabId: TabId) => boolean;
  resetTab: () => void;
}

export function useTabNavigation(defaultTab: TabId | null = null): UseTabNavigationReturn {
  const [activeTab, setActiveTab] = useState<TabId | null>(defaultTab);

  const isTabActive = useCallback((tabId: TabId) => activeTab === tabId, [activeTab]);
  const resetTab = useCallback(() => setActiveTab(defaultTab), [defaultTab]);

  return {
    activeTab,
    setActiveTab,
    isTabActive,
    resetTab
  };
}
```

**File 2: `hooks/useCategoryNavigation.ts`**
```typescript
// Similar to useTabNavigation but for categories
// ... implementation
```

**File 3: `hooks/useSettingsPreview.ts`**
```typescript
// Hook για preview synchronization
// ... implementation
```

**Checklist:**
- [ ] Create `hooks/useTabNavigation.ts`
- [ ] Create `hooks/useCategoryNavigation.ts`
- [ ] Create `hooks/useSettingsPreview.ts`
- [ ] Write unit tests for hooks
- [ ] Git commit: "feat: Create shared hooks for tab/category navigation"

---

#### ✅ STEP 1.5: Create Shared Components
**Duration:** 1 hour
**Risk:** 🟡 Low (UI components, visual testing)

**File 1: `shared/TabNavigation.tsx`**
```typescript
import React from 'react';

export interface TabConfig {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface TabNavigationProps {
  tabs: TabConfig[];
  activeTab: string | null;
  onTabClick: (tabId: string) => void;
  className?: string;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  tabs,
  activeTab,
  onTabClick,
  className = ''
}) => {
  return (
    <nav className={`flex gap-2 ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabClick(tab.id)}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === tab.id
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          {tab.icon && <span className="mr-2">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </nav>
  );
};
```

**File 2: `shared/CategoryButton.tsx`**
```typescript
// Generic category icon button
// ... implementation
```

**Checklist:**
- [ ] Create `shared/TabNavigation.tsx`
- [ ] Create `shared/CategoryButton.tsx`
- [ ] Test components visually
- [ ] Git commit: "feat: Create shared UI components (TabNavigation, CategoryButton)"

---

### PHASE 2: EXTRACT GENERAL SETTINGS (Lines Tab First)

#### ✅ STEP 2.1: Extract LinesTab Component
**Duration:** 2 hours
**Risk:** 🟡 Medium (first extraction, sets the pattern)

**Source:** `DxfSettingsPanel.tsx` lines ~2210-2220 (Lines tab content)

**Target:** `tabs/general/LinesTab.tsx`

**Implementation:**
```typescript
// tabs/general/LinesTab.tsx
import React from 'react';
import { LineSettings } from '../../settings/core/LineSettings';
import { LinePreview } from '../../shared/LinePreview';
import { CurrentSettingsDisplay } from '../../shared/CurrentSettingsDisplay';
import { useLineSettingsFromProvider } from '../../../../providers/DxfSettingsProvider';
import { useUnifiedLinePreview } from '../../../../hooks/useUnifiedSpecificSettings';

export interface LinesTabProps {
  className?: string;
}

export const LinesTab: React.FC<LinesTabProps> = ({ className = '' }) => {
  const lineSettings = useLineSettingsFromProvider();
  const linePreviewHook = useUnifiedLinePreview();
  const effectiveLineSettings = linePreviewHook.getEffectiveLineSettings();

  return (
    <div className={`p-4 space-y-4 ${className}`}>
      {/* Preview Section */}
      <div className="bg-gray-800 rounded-lg p-4">
        <LinePreview
          lineSettings={effectiveLineSettings}
          textSettings={/* ... */}
          gripSettings={/* ... */}
        />
      </div>

      {/* Current Settings Display */}
      <CurrentSettingsDisplay
        activeTab="lines"
        lineSettings={lineSettings.settings}
        textSettings={/* ... */}
        gripSettings={/* ... */}
      />

      {/* Line Settings */}
      <LineSettings />
    </div>
  );
};
```

**Steps:**
1. [ ] Copy relevant code from DxfSettingsPanel.tsx (lines 2210-2220)
2. [ ] Extract state management (line-specific state only)
3. [ ] Extract hooks usage (useLineSettingsFromProvider, etc.)
4. [ ] Extract preview logic
5. [ ] Extract settings rendering
6. [ ] Update imports
7. [ ] Test in isolation (mount LinesTab directly)
8. [ ] Visual regression test (compare old vs new)
9. [ ] Git commit: "feat(refactor): Extract LinesTab from DxfSettingsPanel"

**Testing Checklist:**
- [ ] LinesTab renders correctly
- [ ] Preview updates on settings change
- [ ] Settings persist to provider
- [ ] No console errors
- [ ] Visual match with old implementation

---

#### ✅ STEP 2.2: Extract TextTab Component
**Duration:** 1.5 hours
**Risk:** 🟢 Low (same pattern as LinesTab)

**Source:** `DxfSettingsPanel.tsx` lines ~2214-2218 (Text tab content)

**Target:** `tabs/general/TextTab.tsx`

**Steps:**
1. [ ] Follow same pattern as LinesTab
2. [ ] Copy relevant code
3. [ ] Extract state & hooks
4. [ ] Test in isolation
5. [ ] Visual regression test
6. [ ] Git commit: "feat(refactor): Extract TextTab from DxfSettingsPanel"

**Testing Checklist:**
- [ ] TextTab renders correctly
- [ ] Settings updates work
- [ ] No console errors
- [ ] Visual match

---

#### ✅ STEP 2.3: Extract GripsTab Component
**Duration:** 1.5 hours
**Risk:** 🟢 Low (same pattern)

**Source:** `DxfSettingsPanel.tsx` lines ~2218-2220 (Grips tab content)

**Target:** `tabs/general/GripsTab.tsx`

**Steps:**
1. [ ] Follow same pattern as LinesTab/TextTab
2. [ ] Copy relevant code
3. [ ] Extract state & hooks
4. [ ] Test in isolation
5. [ ] Visual regression test
6. [ ] Git commit: "feat(refactor): Extract GripsTab from DxfSettingsPanel"

**Testing Checklist:**
- [ ] GripsTab renders correctly
- [ ] Settings updates work
- [ ] No console errors
- [ ] Visual match

---

#### ✅ STEP 2.4: Create GeneralSettingsPanel (Routing)
**Duration:** 1 hour
**Risk:** 🟡 Medium (integrates 3 tabs)

**Target:** `panels/GeneralSettingsPanel.tsx`

**Implementation:**
```typescript
// panels/GeneralSettingsPanel.tsx
import React, { Suspense } from 'react';
import { TabNavigation } from '../shared/TabNavigation';
import { useTabNavigation } from '../hooks/useTabNavigation';
import { LazyLinesTab, LazyTextTab, LazyGripsTab } from '../LazyComponents';

export type GeneralTab = 'lines' | 'text' | 'grips';

export interface GeneralSettingsPanelProps {
  defaultTab?: GeneralTab;
  className?: string;
}

export const GeneralSettingsPanel: React.FC<GeneralSettingsPanelProps> = ({
  defaultTab = 'lines',
  className = ''
}) => {
  const { activeTab, setActiveTab } = useTabNavigation(defaultTab);

  const tabs = [
    { id: 'lines', label: 'Γραμμές' },
    { id: 'text', label: 'Κείμενο' },
    { id: 'grips', label: 'Grips' }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'lines':
        return <LazyLinesTab />;
      case 'text':
        return <LazyTextTab />;
      case 'grips':
        return <LazyGripsTab />;
      default:
        return null;
    }
  };

  return (
    <div className={className}>
      {/* Tab Navigation */}
      <div className="border-b border-gray-600 mb-4">
        <TabNavigation
          tabs={tabs}
          activeTab={activeTab}
          onTabClick={setActiveTab}
          className="px-2 pb-2"
        />
      </div>

      {/* Tab Content */}
      <Suspense fallback={<div>Loading...</div>}>
        <div className="px-4">
          {renderTabContent()}
        </div>
      </Suspense>
    </div>
  );
};
```

**Steps:**
1. [ ] Create GeneralSettingsPanel.tsx
2. [ ] Setup tab navigation state
3. [ ] Integrate TabNavigation component
4. [ ] Setup lazy loading for tabs
5. [ ] Add Suspense boundaries
6. [ ] Test tab switching
7. [ ] Test lazy loading
8. [ ] Git commit: "feat(refactor): Create GeneralSettingsPanel with tab routing"

**Testing Checklist:**
- [ ] All 3 tabs accessible
- [ ] Tab switching works
- [ ] Lazy loading works (check Network tab)
- [ ] Suspense fallback shows during load
- [ ] No console errors

---

### PHASE 3: EXTRACT SPECIFIC CATEGORIES (One by One)

#### ✅ STEP 3.1: Extract CursorCategory
**Duration:** 2 hours
**Risk:** 🟡 Medium (has sub-tabs: Crosshair, Cursor)

**Source:** `DxfSettingsPanel.tsx` lines ~1500-1700 (Cursor case in renderCategoryContent)

**Target:** `categories/CursorCategory.tsx`

**Implementation:**
```typescript
// categories/CursorCategory.tsx
import React, { useState } from 'react';
import { CursorSettings } from '../../settings/special/CursorSettings';
import { useCursorSettings } from '../../../../systems/cursor';

export const CursorCategory: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'crosshair' | 'cursor'>('crosshair');
  const { settings, updateSettings } = useCursorSettings();

  return (
    <div className="p-4">
      {/* Sub-tabs */}
      <div className="flex gap-2 mb-4">
        {/* Crosshair, Cursor buttons */}
      </div>

      {/* Content */}
      <CursorSettings activeTab={activeSubTab} />
    </div>
  );
};
```

**Steps:**
1. [ ] Copy Cursor category code from DxfSettingsPanel.tsx
2. [ ] Extract sub-tab state (crosshair vs cursor)
3. [ ] Extract useCursorSettings() hook usage
4. [ ] Extract rendering logic
5. [ ] Test in isolation
6. [ ] Visual regression test
7. [ ] Git commit: "feat(refactor): Extract CursorCategory from DxfSettingsPanel"

---

#### ✅ STEP 3.2: Extract SelectionCategory
**Duration:** 2 hours
**Risk:** 🟡 Medium (has sub-tabs: Window, Crossing)

**Source:** `DxfSettingsPanel.tsx` (Selection case)

**Target:** `categories/SelectionCategory.tsx`

**Steps:** (Same pattern as CursorCategory)

---

#### ✅ STEP 3.3: Extract GridCategory
**Duration:** 3 hours
**Risk:** 🔴 High (complex: Grid [Major/Minor] + Rulers [4 tabs])

**Source:** `DxfSettingsPanel.tsx` (Grid case - ~300 lines)

**Target:** `categories/GridCategory.tsx`

**Steps:**
1. [ ] Copy Grid category code
2. [ ] Extract sub-tab state (Grid vs Rulers)
3. [ ] Extract Grid lines state (Major vs Minor)
4. [ ] Extract Ruler tabs state (Background, Lines, Text, Units)
5. [ ] Extract useRulersGridContext() hook
6. [ ] Test all 6 sub-tabs
7. [ ] Visual regression test
8. [ ] Git commit: "feat(refactor): Extract GridCategory from DxfSettingsPanel"

---

#### ✅ STEP 3.4-3.7: Extract Remaining Categories
**Duration:** 1-2 hours each
**Risk:** 🟢-🟡 Low to Medium

- [ ] STEP 3.4: GripsCategory (Coming Soon - simple)
- [ ] STEP 3.5: LayersCategory (medium complexity)
- [ ] STEP 3.6: EntitiesCategory (⚠️ 600 lines - may need sub-refactoring)
- [ ] STEP 3.7: LightingCategory (Coming Soon - simple)

---

#### ✅ STEP 3.8: Create SpecificSettingsPanel (Routing)
**Duration:** 1.5 hours
**Risk:** 🟡 Medium (integrates 7 categories)

**Target:** `panels/SpecificSettingsPanel.tsx`

**Implementation:**
```typescript
// panels/SpecificSettingsPanel.tsx
import React, { Suspense } from 'react';
import { useCategoryNavigation } from '../hooks/useCategoryNavigation';
import { CategoryButton } from '../shared/CategoryButton';
import {
  LazyCursorCategory,
  LazySelectionCategory,
  LazyGridCategory,
  // ... all categories
} from '../LazyComponents';

export type CategoryId = 'cursor' | 'selection' | 'grid' | 'grips' | 'layers' | 'entities' | 'lighting';

export const SpecificSettingsPanel: React.FC = () => {
  const { activeCategory, setActiveCategory } = useCategoryNavigation('selection');

  const categories = [
    { id: 'cursor', label: 'Crosshair & Cursor', icon: <CrosshairIcon /> },
    { id: 'selection', label: 'Selection Boxes', icon: <SelectionIcon /> },
    // ... all 7 categories
  ];

  const renderCategoryContent = () => {
    switch (activeCategory) {
      case 'cursor': return <LazyCursorCategory />;
      case 'selection': return <LazySelectionCategory />;
      // ... all cases
    }
  };

  return (
    <div>
      {/* Category Icons Navigation */}
      <nav className="flex gap-1 mb-4 p-2">
        {categories.map((cat) => (
          <CategoryButton
            key={cat.id}
            id={cat.id}
            icon={cat.icon}
            label={cat.label}
            isActive={activeCategory === cat.id}
            onClick={() => setActiveCategory(cat.id)}
          />
        ))}
      </nav>

      {/* Category Content */}
      <Suspense fallback={<div>Loading...</div>}>
        {renderCategoryContent()}
      </Suspense>
    </div>
  );
};
```

**Steps:**
1. [ ] Create SpecificSettingsPanel.tsx
2. [ ] Setup category navigation
3. [ ] Integrate all 7 categories
4. [ ] Setup lazy loading
5. [ ] Test category switching
6. [ ] Git commit: "feat(refactor): Create SpecificSettingsPanel with category routing"

---

### PHASE 4: MAIN PANEL REFACTORING

#### ✅ STEP 4.1: Create DxfSettingsPanel (Top-Level Routing)
**Duration:** 1 hour
**Risk:** 🟡 Medium (main integration point)

**Target:** `DxfSettingsPanel.tsx`

**Implementation:**
```typescript
// DxfSettingsPanel.tsx
import React, { Suspense } from 'react';
import { TabNavigation } from './shared/TabNavigation';
import { useTabNavigation } from './hooks/useTabNavigation';
import { GeneralSettingsPanel } from './panels/GeneralSettingsPanel';
import { SpecificSettingsPanel } from './panels/SpecificSettingsPanel';

export type MainTab = 'general' | 'specific';

export interface DxfSettingsPanelProps {
  className?: string;
  defaultTab?: MainTab;
}

export const DxfSettingsPanel: React.FC<DxfSettingsPanelProps> = ({
  className = '',
  defaultTab = 'specific'
}) => {
  const { activeTab, setActiveTab } = useTabNavigation(defaultTab);

  const mainTabs = [
    { id: 'general', label: 'Γενικές Ρυθμίσεις' },
    { id: 'specific', label: 'Ειδικές Ρυθμίσεις' }
  ];

  return (
    <div className={className}>
      {/* Main Tab Navigation */}
      <div className="border-b border-gray-600 mb-4">
        <TabNavigation
          tabs={mainTabs}
          activeTab={activeTab}
          onTabClick={setActiveTab}
          className="p-2"
        />
      </div>

      {/* Main Content */}
      <Suspense fallback={<div>Loading...</div>}>
        {activeTab === 'general' && <GeneralSettingsPanel />}
        {activeTab === 'specific' && <SpecificSettingsPanel />}
      </Suspense>
    </div>
  );
};
```

**Steps:**
1. [ ] Create DxfSettingsPanel.tsx
2. [ ] Setup main tab navigation (General vs Specific)
3. [ ] Integrate GeneralSettingsPanel
4. [ ] Integrate SpecificSettingsPanel
5. [ ] Test full navigation flow
6. [ ] Git commit: "feat(refactor): Create DxfSettingsPanel as main entry point"

---

#### ✅ STEP 4.2: Update usePanelContentRenderer Integration
**Duration:** 30 minutes
**Risk:** 🟢 Low (simple import change)

**File:** `ui/hooks/usePanelContentRenderer.tsx`

**Change:**
```typescript
// OLD:
import { LazyDxfSettingsPanel as DxfSettingsPanel } from '../components/LazyLoadWrapper';

// NEW:
import { DxfSettingsPanel } from '../components/dxf-settings/DxfSettingsPanel';

// In renderPanelContent():
case 'colors':
  return (
    <div>
      <LazyPanelWrapper loadingText="Φόρτωση παλέτας χρωμάτων...">
        <DxfSettingsPanel />  {/* Changed from DxfSettingsPanel */}
      </LazyPanelWrapper>
    </div>
  );
```

**Steps:**
1. [ ] Update import
2. [ ] Update component usage
3. [ ] Test panel loading in app
4. [ ] Git commit: "refactor: Switch from DxfSettingsPanel to DxfSettingsPanel"

---

#### ✅ STEP 4.3: Deprecate DxfSettingsPanel
**Duration:** 15 minutes
**Risk:** ⚪ None (documentation only)

**File:** `ui/components/DxfSettingsPanel.tsx`

**Add deprecation notice:**
```typescript
/**
 * ⚠️ LEGACY COMPONENT - MIGRATION COMPLETED
 *
 * This component has been successfully refactored into modular structure.
 * New implementation: ui/components/dxf-settings/DxfSettingsPanel.tsx
 *
 * @see ui/components/dxf-settings/DxfSettingsPanel.tsx
 * @see docs/REFACTORING_ROADMAP_DxfSettingsPanel.md
 */
export function DxfSettingsPanel({ className = '' }: DxfSettingsPanelProps) {
  // ... existing code (kept for reference until full migration validated)
}
```

**Steps:**
1. [ ] Add deprecation JSDoc
2. [ ] Keep file for now (don't delete yet)
3. [ ] Git commit: "docs: Mark DxfSettingsPanel as deprecated"

---

### PHASE 5: TESTING & VALIDATION

#### ✅ STEP 5.1: Unit Tests for All Components
**Duration:** 4 hours
**Risk:** 🟡 Medium (comprehensive testing)

**Test Files to Create:**
- [ ] `LinesTab.test.tsx`
- [ ] `TextTab.test.tsx`
- [ ] `GripsTab.test.tsx`
- [ ] `GeneralSettingsPanel.test.tsx`
- [ ] `CursorCategory.test.tsx`
- [ ] `SelectionCategory.test.tsx`
- [ ] `GridCategory.test.tsx`
- [ ] `SpecificSettingsPanel.test.tsx`
- [ ] `DxfSettingsPanel.test.tsx`

**Example Test:**
```typescript
// LinesTab.test.tsx
import { render, screen } from '@testing-library/react';
import { LinesTab } from './LinesTab';

describe('LinesTab', () => {
  it('renders without crashing', () => {
    render(<LinesTab />);
    expect(screen.getByText(/γραμμές/i)).toBeInTheDocument();
  });

  it('shows preview component', () => {
    render(<LinesTab />);
    expect(screen.getByTestId('line-preview')).toBeInTheDocument();
  });

  // ... more tests
});
```

---

#### ✅ STEP 5.2: Integration Tests
**Duration:** 2 hours
**Risk:** 🟡 Medium

**Test Scenarios:**
- [ ] Navigate from General → Specific → General (state preserved?)
- [ ] Change settings in LinesTab → verify persistence
- [ ] Switch categories rapidly → no crashes
- [ ] Lazy loading works correctly
- [ ] Settings sync between tabs

---

#### ✅ STEP 5.3: Visual Regression Tests
**Duration:** 2 hours
**Risk:** 🔴 High (critical - must match old UI exactly)

**Tool:** Playwright or Chromatic

**Test Cases:**
- [ ] Screenshot: General Settings → Lines Tab
- [ ] Screenshot: General Settings → Text Tab
- [ ] Screenshot: General Settings → Grips Tab
- [ ] Screenshot: Specific Settings → Cursor Category
- [ ] Screenshot: Specific Settings → Selection Category
- [ ] Screenshot: Specific Settings → Grid Category (all sub-tabs)
- [ ] Screenshot: Specific Settings → Entities Category

**Acceptance Criteria:**
- Visual diff < 0.1% (nearly pixel-perfect match)

---

#### ✅ STEP 5.4: Performance Testing
**Duration:** 1 hour
**Risk:** 🟢 Low

**Metrics to Check:**
- [ ] Bundle size: New structure vs old (should be smaller per chunk)
- [ ] Initial load time
- [ ] Tab switch time (should be faster with lazy loading)
- [ ] Memory usage (check for leaks)

**Tools:**
- Lighthouse
- React DevTools Profiler
- Chrome DevTools Performance tab

---

### PHASE 6: CLEANUP & DOCUMENTATION

#### ✅ STEP 6.1: Remove DxfSettingsPanel.tsx
**Duration:** 15 minutes
**Risk:** 🟢 Low (after full validation)

**Steps:**
1. [ ] Verify DxfSettingsPanel works in production
2. [ ] Verify all tests pass
3. [ ] Verify visual regression tests pass
4. [ ] Delete `ui/components/DxfSettingsPanel.tsx`
5. [ ] Update imports in `LazyLoadWrapper.tsx`
6. [ ] Git commit: "chore: Remove deprecated DxfSettingsPanel.tsx"

---

#### ✅ STEP 6.2: Update Documentation
**Duration:** 1 hour
**Risk:** ⚪ None

**Files to Update:**
- [ ] `docs/CENTRALIZED_SYSTEMS.md` → Add DxfSettingsPanel architecture
- [ ] `docs/ENTERPRISE_REFACTORING_PLAN.md` → Mark Phase complete
- [ ] `STRUCTURE_ΡΥΘΜΙΣΕΙΣ_DXF.txt` → Update with new structure
- [ ] Create `dxf-settings/README.md` → Architecture overview

---

#### ✅ STEP 6.3: Final Git Commit & Backup
**Duration:** 30 minutes
**Risk:** ⚪ None

**Steps:**
1. [ ] Git status check (ensure all changes committed)
2. [ ] Create BACKUP_SUMMARY.json
3. [ ] Run `auto-backup.ps1`
4. [ ] Git tag: `refactor/dxf-settings-modular-v1.0`
5. [ ] Update CHANGELOG.md

---

## 📊 PROGRESS TRACKING

### Overall Progress

| Phase | Status | Progress | Duration Est. | Duration Actual |
|-------|--------|----------|---------------|-----------------|
| **Phase 1: Setup** | ⏸️ Not Started | 0% | 2 hours | - |
| **Phase 2: General Settings** | ⏸️ Not Started | 0% | 8 hours | - |
| **Phase 3: Specific Categories** | ⏸️ Not Started | 0% | 14 hours | - |
| **Phase 4: Main Panel** | ⏸️ Not Started | 0% | 2 hours | - |
| **Phase 5: Testing** | ⏸️ Not Started | 0% | 9 hours | - |
| **Phase 6: Cleanup** | ⏸️ Not Started | 0% | 2 hours | - |
| **TOTAL** | ⏸️ Not Started | 0% | **37 hours** | **-** |

### Detailed Step Progress

#### Phase 1: Setup
- [ ] STEP 1.1: Create Folder Structure (15 min)
- [ ] STEP 1.2: Create Placeholder Files (20 min)
- [ ] STEP 1.3: Setup Lazy Loading (30 min)
- [ ] STEP 1.4: Create Shared Hooks (45 min)
- [ ] STEP 1.5: Create Shared Components (1 hour)

#### Phase 2: General Settings
- [ ] STEP 2.1: Extract LinesTab (2 hours)
- [ ] STEP 2.2: Extract TextTab (1.5 hours)
- [ ] STEP 2.3: Extract GripsTab (1.5 hours)
- [ ] STEP 2.4: Create GeneralSettingsPanel (1 hour)

#### Phase 3: Specific Categories
- [ ] STEP 3.1: Extract CursorCategory (2 hours)
- [ ] STEP 3.2: Extract SelectionCategory (2 hours)
- [ ] STEP 3.3: Extract GridCategory (3 hours)
- [ ] STEP 3.4: Extract GripsCategory (1 hour)
- [ ] STEP 3.5: Extract LayersCategory (2 hours)
- [ ] STEP 3.6: Extract EntitiesCategory (3 hours)
- [ ] STEP 3.7: Extract LightingCategory (1 hour)
- [ ] STEP 3.8: Create SpecificSettingsPanel (1.5 hours)

#### Phase 4: Main Panel
- [ ] STEP 4.1: Create DxfSettingsPanel (1 hour)
- [ ] STEP 4.2: Update usePanelContentRenderer (30 min)
- [ ] STEP 4.3: Deprecate DxfSettingsPanel (15 min)

#### Phase 5: Testing
- [ ] STEP 5.1: Unit Tests (4 hours)
- [ ] STEP 5.2: Integration Tests (2 hours)
- [ ] STEP 5.3: Visual Regression Tests (2 hours)
- [ ] STEP 5.4: Performance Testing (1 hour)

#### Phase 6: Cleanup
- [ ] STEP 6.1: Remove DxfSettingsPanel (15 min)
- [ ] STEP 6.2: Update Documentation (1 hour)
- [ ] STEP 6.3: Final Commit & Backup (30 min)

---

## ⚠️ RISK MANAGEMENT

### High-Risk Steps

| Step | Risk Level | Mitigation Strategy |
|------|-----------|---------------------|
| STEP 2.1: Extract LinesTab | 🟡 Medium | First extraction - sets pattern. Do slowly, test thoroughly. |
| STEP 3.3: Extract GridCategory | 🔴 High | Complex (6 sub-tabs). Break into smaller sub-steps. |
| STEP 3.6: Extract EntitiesCategory | 🔴 High | 600 lines - may need further refactoring. Consider sub-components. |
| STEP 5.3: Visual Regression | 🔴 High | Must match old UI exactly. Use automated screenshot diff. |

### Rollback Strategy

**If something breaks:**
1. Git revert to last known good commit
2. Analyze failure (logs, screenshots, error messages)
3. Fix in isolation (unit test first)
4. Re-attempt step

**Checkpoints (safe to rollback to):**
- After Phase 1 (Setup complete, no logic changed)
- After Phase 2 (General Settings working)
- After Phase 3 (All categories working)
- After Phase 5 (All tests passing)

---

## 🎯 SUCCESS CRITERIA

### Must-Have (Blocking)
- [ ] ✅ All tabs/categories render correctly
- [ ] ✅ Settings persist correctly
- [ ] ✅ No console errors
- [ ] ✅ Visual regression tests pass (<0.1% diff)
- [ ] ✅ All unit tests pass
- [ ] ✅ Integration tests pass
- [ ] ✅ TypeScript compilation succeeds
- [ ] ✅ Bundle size per chunk < old monolithic file

### Nice-to-Have (Non-Blocking)
- [ ] 🎁 Performance improvement (faster tab switching)
- [ ] 🎁 Bundle size reduction (smaller total)
- [ ] 🎁 Code coverage > 80%
- [ ] 🎁 Documentation complete

---

## 📝 NOTES & LEARNINGS

### Decisions Made

**Decision 1: Lazy Loading Strategy**
- Date: TBD
- Decision: Use React.lazy() for all tabs/categories
- Reasoning: Improve initial load time, reduce bundle size
- Alternative considered: Eager loading (rejected - too slow)

**Decision 2: Folder Structure**
- Date: TBD
- Decision: `tabs/general/` and `categories/` separation
- Reasoning: Clear distinction between General and Specific settings
- Alternative considered: Flat structure (rejected - too many files in one folder)

### Learnings

**Learning 1: TBD**
**Learning 2: TBD**

---

## 🚀 NEXT STEPS

1. **Γιώργος reviews this roadmap** ✅
2. **Γιώργος approves to proceed** (Ναι/Όχι)
3. **Start Phase 1: STEP 1.1** (Create folder structure)
4. **Update this document** as we progress (mark checkboxes ✅)
5. **Commit after each step** (atomic commits)

---

**📅 Last Updated:** 2025-10-07
**📊 Status:** DRAFT - Awaiting Approval
**👤 Next Action:** Γιώργος Review & Approval

---

**END OF ROADMAP**
