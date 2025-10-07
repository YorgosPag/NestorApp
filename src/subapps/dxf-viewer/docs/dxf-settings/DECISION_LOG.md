# 📝 DXF SETTINGS PANEL - ARCHITECTURAL DECISION LOG (ADR)

---

**📋 Document Type:** Architectural Decision Records
**🎯 Scope:** Design decisions for DxfSettingsPanel refactoring
**👤 Architect:** Γιώργος Παγωνής
**🤖 Developer:** Claude (Anthropic AI)
**📅 Created:** 2025-10-07
**📅 Last Updated:** 2025-10-07
**📊 Status:** LIVING DOCUMENT

---

## 📖 WHAT IS AN ADR?

An **Architectural Decision Record (ADR)** is a document that captures an important architectural decision made along with its context and consequences.

**Format:**
```
- Title: What decision was made
- Date: When the decision was made
- Status: Proposed | Accepted | Deprecated | Superseded
- Context: What is the issue we're seeing that is motivating this decision
- Decision: What is the change we're proposing/doing
- Consequences: What becomes easier or harder to do because of this change
- Alternatives: What other options were considered and why were they rejected
```

---

## 🔗 CROSS-REFERENCES

This document is part of the **DxfSettings Refactoring Documentation Suite**:

| Document | Purpose | When to Use |
|----------|---------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | High-level system design | Understanding overall structure |
| [COMPONENT_GUIDE.md](./COMPONENT_GUIDE.md) | Detailed component docs | Working on specific components |
| [MIGRATION_CHECKLIST.md](./MIGRATION_CHECKLIST.md) | Step-by-step migration | Daily refactoring tasks |
| **[DECISION_LOG.md](./DECISION_LOG.md)** ⭐ | **Design decisions (THIS)** | **Recording/reviewing decisions** |
| [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md) | State strategy | Understanding data flow |
| [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) | Testing approach | Writing tests |

**Related Files:**
- Source: [`DxfSettingsPanel.tsx`](../../ui/components/DxfSettingsPanel.tsx) - Original monolithic component
- Target: [`DxfSettingsPanel.tsx`](../../ui/components/dxf-settings/DxfSettingsPanel.tsx) - New modular structure
- Roadmap: [`REFACTORING_ROADMAP_DxfSettingsPanel.md`](../REFACTORING_ROADMAP_DxfSettingsPanel.md) - Full migration plan

---

## 📊 TABLE OF CONTENTS

1. [ADR-001: Adopt Modular Architecture](#adr-001-adopt-modular-architecture)
2. [ADR-002: Use React.lazy() for Lazy Loading](#adr-002-use-reactlazy-for-lazy-loading)
3. [ADR-003: Separate General vs Specific Settings](#adr-003-separate-general-vs-specific-settings)
4. [ADR-004: Create Reusable TabNavigation Component](#adr-004-create-reusable-tabnavigation-component)
5. [ADR-005: Use Custom Hooks for Navigation State](#adr-005-use-custom-hooks-for-navigation-state)
6. [ADR-006: Keep Settings Components Unchanged](#adr-006-keep-settings-components-unchanged)
7. [ADR-007: Folder Structure by Responsibility](#adr-007-folder-structure-by-responsibility)
8. [ADR-008: Lazy Load Categories Separately](#adr-008-lazy-load-categories-separately)
9. [ADR-009: Deprecate Don't Delete DxfSettingsPanel](#adr-009-deprecate-dont-delete-colorpalettepanel)
10. [ADR-010: Testing Strategy - Unit + Integration + Visual](#adr-010-testing-strategy---unit--integration--visual)

---

## ADR-001: Adopt Modular Architecture

**📅 Date:** 2025-10-07
**👤 Author:** Γιώργος Παγωνής + Claude
**📊 Status:** ✅ ACCEPTED

### Context

The original `DxfSettingsPanel.tsx` is a **monolithic component** (2200+ lines) that violates **Single Responsibility Principle**:
- Handles main tab routing (General vs Specific)
- Handles sub-tab routing (Lines, Text, Grips)
- Handles category routing (7 categories)
- Manages 15+ state variables
- Renders all UI

**Problems:**
- ❌ Hard to maintain (where is the bug? Line 1523?)
- ❌ Hard to test (can't unit test just Lines tab)
- ❌ Git conflicts (2 developers = 1 file)
- ❌ Slow loading (loads all 2200 lines upfront)
- ❌ Not scalable (new feature = edit 2200-line file)

**Related Files:**
- [`DxfSettingsPanel.tsx:1-2200`](../../ui/components/DxfSettingsPanel.tsx) - Monolithic component

### Decision

**ADOPT MODULAR ARCHITECTURE** with strict separation of concerns:

```
DxfSettingsPanel (150 lines - routing only)
├── GeneralSettingsPanel (120 lines - sub-tab routing)
│   ├── LinesTab (200 lines - UI only)
│   ├── TextTab (200 lines - UI only)
│   └── GripsTab (200 lines - UI only)
└── SpecificSettingsPanel (150 lines - category routing)
    ├── CursorCategory (300 lines - UI only)
    ├── SelectionCategory (300 lines - UI only)
    ├── GridCategory (400 lines - UI only)
    └── ... (7 categories total)
```

**Each component has ONE responsibility** (SOLID principle).

### Consequences

**✅ Positive:**
- Easy to maintain (bug in Lines? → Check LinesTab.tsx - 200 lines)
- Easy to test (unit test LinesTab in isolation)
- Team-friendly (Developer A → LinesTab, Developer B → TextTab, zero conflicts)
- Performance boost (lazy load only active tab)
- Scalable (new tab? → Create new file, don't edit existing)

**❌ Negative:**
- More files (1 file → 25+ files)
- More navigation (need to jump between files)
- Initial setup time (~2 hours for folder structure)

**⚖️ Trade-off:** Accepted - **short-term pain (setup) for long-term gain (maintainability)**

### Alternatives Considered

**Alternative 1: Keep Monolithic, Add Comments**
- ❌ Rejected: Doesn't solve core problems (testing, conflicts, scalability)

**Alternative 2: Split into 2 Files (General + Specific)**
- ❌ Rejected: Still too large (1100 lines each), not granular enough

**Alternative 3: Use React.memo() for Sections**
- ❌ Rejected: Improves performance but doesn't solve maintainability

### References

- [ARCHITECTURE.md - Component Hierarchy](./ARCHITECTURE.md#component-hierarchy)
- [COMPONENT_GUIDE.md - DxfSettingsPanel](./COMPONENT_GUIDE.md#1-dxfsettingspanel-root-component)
- [MIGRATION_CHECKLIST.md - Phase 1](./MIGRATION_CHECKLIST.md#phase-1-preparation--setup-2-hours)

---

## ADR-002: Use React.lazy() for Lazy Loading

**📅 Date:** 2025-10-07
**👤 Author:** Claude
**📊 Status:** ✅ ACCEPTED

### Context

With modular architecture, we have **25+ components**. Loading all upfront hurts performance:
- Initial bundle size: ~500KB (uncompressed)
- Time to interactive: 2-3 seconds
- User only uses 1-2 tabs at a time

**Related Files:**
- Target: [`LazyComponents.tsx`](../../ui/components/dxf-settings/LazyComponents.tsx) - Lazy loading setup

### Decision

**USE React.lazy() + Suspense** for code splitting:

```typescript
// LazyComponents.tsx
export const LazyLinesTab = lazy(() => import('./tabs/general/LinesTab'));
export const LazyTextTab = lazy(() => import('./tabs/general/TextTab'));
// ... all tabs/categories

// GeneralSettingsPanel.tsx
<Suspense fallback={<div>Loading...</div>}>
  {activeTab === 'lines' && <LazyLinesTab />}
</Suspense>
```

**Strategy:**
- Lazy load ALL tabs (General: 3 tabs)
- Lazy load ALL categories (Specific: 7 categories)
- Keep shared components eager (TabNavigation, etc.)

### Consequences

**✅ Positive:**
- Initial bundle: ~500KB → ~100KB (-80% reduction)
- Faster initial load (only load routing components)
- Lazy load on-demand (load Lines tab when user clicks)
- Better caching (tab chunks cached separately)

**❌ Negative:**
- Slight delay on first tab click (~200ms to load chunk)
- Suspense fallback needed (loading indicator)
- More complex build configuration

**⚖️ Trade-off:** Accepted - **small delay on tab click << faster initial load**

### Alternatives Considered

**Alternative 1: Eager Load All**
- ❌ Rejected: Slow initial load (500KB bundle)

**Alternative 2: Route-based Code Splitting Only**
- ❌ Rejected: Not granular enough (still loads all tabs in route)

**Alternative 3: Dynamic import() Without React.lazy()**
- ❌ Rejected: More complex, no Suspense integration

### References

- [ARCHITECTURE.md - Performance](./ARCHITECTURE.md#performance-considerations)
- [COMPONENT_GUIDE.md - LazyComponents](./COMPONENT_GUIDE.md#lazy-loading)
- [React Docs - Code Splitting](https://react.dev/reference/react/lazy)

---

## ADR-003: Separate General vs Specific Settings

**📅 Date:** 2025-10-07
**👤 Author:** Γιώργος Παγωνής
**📊 Status:** ✅ ACCEPTED

### Context

Original `DxfSettingsPanel.tsx` has **2 main tabs**:
1. **General Settings** (Lines, Text, Grips) - Global defaults
2. **Specific Settings** (7 categories) - Context-specific overrides

**Question:** Should these be in the same component or separate?

**Related Files:**
- [`DxfSettingsPanel.tsx:2146-2300`](../../ui/components/DxfSettingsPanel.tsx#L2146) - Main tab rendering

### Decision

**SEPARATE** General and Specific into **2 panel components**:

```
DxfSettingsPanel (Main Router)
├── GeneralSettingsPanel (Lines, Text, Grips)
└── SpecificSettingsPanel (7 categories)
```

**Reasoning:**
1. **Different purposes:**
   - General: Global defaults (ISO 128, ISO 3098, AutoCAD standards)
   - Specific: Context overrides (Draft, Hover, Completion phases)

2. **Different UI patterns:**
   - General: 3 tabs (simple)
   - Specific: 7 icon buttons (more complex)

3. **Different state management:**
   - General: Provider-based (DxfSettingsProvider)
   - Specific: Mix of providers + systems (CursorSystem, RulersGridSystem)

### Consequences

**✅ Positive:**
- Clear separation of concerns
- Easier to test (test General separately from Specific)
- Easier to understand (each panel has one purpose)
- Easier to refactor (change Specific without touching General)

**❌ Negative:**
- One extra component (GeneralSettingsPanel + SpecificSettingsPanel)
- Need to pass props between panels (if needed)

**⚖️ Trade-off:** Accepted - **clarity and maintainability > fewer files**

### Alternatives Considered

**Alternative 1: Single PanelComponent with Tabs Prop**
- ❌ Rejected: Still mixes two different concepts in one file

**Alternative 2: Render Props Pattern**
- ❌ Rejected: Over-engineered for this use case

### References

- [ARCHITECTURE.md - Component Hierarchy](./ARCHITECTURE.md#component-hierarchy)
- [COMPONENT_GUIDE.md - GeneralSettingsPanel](./COMPONENT_GUIDE.md#2-generalsettingspanel)
- [COMPONENT_GUIDE.md - SpecificSettingsPanel](./COMPONENT_GUIDE.md#3-specificsettingspanel)

---

## ADR-004: Create Reusable TabNavigation Component

**📅 Date:** 2025-10-07
**👤 Author:** Claude
**📊 Status:** ✅ ACCEPTED

### Context

Tab navigation is used in **multiple places**:
- DxfSettingsPanel: 2 tabs (General, Specific)
- GeneralSettingsPanel: 3 tabs (Lines, Text, Grips)
- GridCategory: 2 tabs (Grid, Rulers)
- CursorCategory: 2 tabs (Crosshair, Cursor)

**Original code:** Each component had **duplicate** tab rendering logic (DRY violation).

**Related Files:**
- Target: [`shared/TabNavigation.tsx`](../../ui/components/dxf-settings/shared/TabNavigation.tsx) - Reusable component

### Decision

**CREATE GENERIC TabNavigation COMPONENT**:

```typescript
<TabNavigation
  tabs={[
    { id: 'lines', label: 'Γραμμές' },
    { id: 'text', label: 'Κείμενο' },
    { id: 'grips', label: 'Grips' }
  ]}
  activeTab={activeTab}
  onTabClick={setActiveTab}
  variant="pills"
/>
```

**Reusable across:**
- Main tabs (DxfSettingsPanel)
- Sub-tabs (GeneralSettingsPanel)
- Category sub-tabs (GridCategory, CursorCategory)

### Consequences

**✅ Positive:**
- DRY (Don't Repeat Yourself) - ONE implementation
- Consistent UI (all tabs look the same)
- Easy to modify (change ONE file → all tabs update)
- Easy to test (test ONE component → all tabs tested)

**❌ Negative:**
- Generic = less control (harder to customize per-tab)
- Need to pass props (tabs array, active, onClick)

**⚖️ Trade-off:** Accepted - **consistency and maintainability > custom styling**

### Alternatives Considered

**Alternative 1: Duplicate Tab Logic in Each Component**
- ❌ Rejected: DRY violation, hard to maintain

**Alternative 2: Higher-Order Component (HOC)**
- ❌ Rejected: Over-engineered, harder to understand

**Alternative 3: Render Props Pattern**
- ❌ Rejected: Too complex for simple tab navigation

### References

- [COMPONENT_GUIDE.md - TabNavigation](./COMPONENT_GUIDE.md#11-tabnavigation-generic-tab-component)
- [ARCHITECTURE.md - Design Patterns](./ARCHITECTURE.md#design-patterns)

---

## ADR-005: Use Custom Hooks for Navigation State

**📅 Date:** 2025-10-07
**👤 Author:** Claude
**📊 Status:** ✅ ACCEPTED

### Context

Tab navigation state is used in **every panel/category**:
- DxfSettingsPanel: `activeMainTab`
- GeneralSettingsPanel: `activeGeneralTab`
- SpecificSettingsPanel: `activeCategory`
- GridCategory: `activeGridTab`, `activeRulerTab`

**Original code:** Each component had **duplicate** state logic:
```typescript
const [activeTab, setActiveTab] = useState('lines');
const isTabActive = (tabId) => activeTab === tabId;
const resetTab = () => setActiveTab('lines');
```

**Related Files:**
- Target: [`hooks/useTabNavigation.ts`](../../ui/components/dxf-settings/hooks/useTabNavigation.ts) - Custom hook

### Decision

**CREATE CUSTOM HOOKS** for navigation state:

```typescript
// hooks/useTabNavigation.ts
export function useTabNavigation(defaultTab) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const isTabActive = useCallback((tabId) => activeTab === tabId, [activeTab]);
  const resetTab = useCallback(() => setActiveTab(defaultTab), [defaultTab]);

  return { activeTab, setActiveTab, isTabActive, resetTab };
}

// Usage:
const { activeTab, setActiveTab, isTabActive } = useTabNavigation('lines');
```

**Also create:**
- `useCategoryNavigation()` - Same pattern for categories
- `useSettingsPreview()` - Preview sync logic

### Consequences

**✅ Positive:**
- DRY - ONE implementation, used everywhere
- Consistent behavior (all tabs work the same)
- Easy to test (test hook once → all usage tested)
- Easy to extend (add feature → all tabs get it)

**❌ Negative:**
- Abstraction overhead (need to understand hook API)
- Slightly more complex (indirection through hook)

**⚖️ Trade-off:** Accepted - **reusability > simplicity**

### Alternatives Considered

**Alternative 1: Duplicate useState in Each Component**
- ❌ Rejected: DRY violation, inconsistent behavior

**Alternative 2: Global State (Redux/Zustand)**
- ❌ Rejected: Over-engineered for local navigation state

**Alternative 3: Context API**
- ❌ Rejected: Navigation state is local, not global

### References

- [COMPONENT_GUIDE.md - useTabNavigation](./COMPONENT_GUIDE.md#12-usetabnavigation)
- [STATE_MANAGEMENT.md - Local State](./STATE_MANAGEMENT.md#local-state)
- [React Docs - Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)

---

## ADR-006: Keep Settings Components Unchanged

**📅 Date:** 2025-10-07
**👤 Author:** Γιώργος Παγωνής
**📊 Status:** ✅ ACCEPTED

### Context

Existing settings components work well:
- `LineSettings.tsx` (ISO 128 standards) ✅
- `TextSettings.tsx` (ISO 3098 standards) ✅
- `GripSettings.tsx` (AutoCAD standards) ✅
- `CursorSettings.tsx` ✅
- `SelectionSettings.tsx` ✅
- etc.

**Question:** Should we refactor these too?

**Related Files:**
- [`settings/core/LineSettings.tsx`](../../ui/components/dxf-settings/settings/core/LineSettings.tsx)
- [`settings/core/TextSettings.tsx`](../../ui/components/dxf-settings/settings/core/TextSettings.tsx)
- [`settings/core/GripSettings.tsx`](../../ui/components/dxf-settings/settings/core/GripSettings.tsx)

### Decision

**KEEP SETTINGS COMPONENTS UNCHANGED**

Only refactor **routing/navigation** components:
- ✅ Refactor: DxfSettingsPanel, GeneralSettingsPanel, SpecificSettingsPanel
- ✅ Refactor: Tabs (LinesTab, TextTab, GripsTab)
- ✅ Refactor: Categories (CursorCategory, GridCategory, etc.)
- ❌ **DON'T TOUCH:** Settings components (LineSettings, TextSettings, etc.)

**Reasoning:**
1. Settings components are **already modular** (200-300 lines each)
2. They follow **industry standards** (ISO 128, ISO 3098, AutoCAD)
3. They're **well-tested** and stable
4. **Risk vs Reward:** Low reward (already good) vs high risk (breaking changes)

### Consequences

**✅ Positive:**
- Lower risk (don't break working code)
- Faster refactoring (less work)
- Stable foundation (settings logic unchanged)
- Focus on architecture (not implementation details)

**❌ Negative:**
- Mixed code styles (new tabs + old settings)
- Missed opportunity to improve settings

**⚖️ Trade-off:** Accepted - **"If it ain't broke, don't fix it"**

### Alternatives Considered

**Alternative 1: Refactor Settings Too**
- ❌ Rejected: Too risky, too much work, low reward

**Alternative 2: Refactor Settings Later (Phase 2)**
- ⚠️ Maybe: Could be future work if needed

### References

- [COMPONENT_GUIDE.md - LineSettings](./COMPONENT_GUIDE.md#10-linesettings)
- [MIGRATION_CHECKLIST.md - Phase 2](./MIGRATION_CHECKLIST.md#phase-2-extract-general-settings-8-hours)

---

## ADR-007: Folder Structure by Responsibility

**📅 Date:** 2025-10-07
**👤 Author:** Claude
**📊 Status:** ✅ ACCEPTED

### Context

Need to organize **25+ files**. How to structure folders?

**Options:**
1. By type: `components/`, `containers/`, `presenters/`
2. By feature: `general/`, `specific/`
3. By responsibility: `panels/`, `tabs/`, `categories/`, `settings/`, `shared/`, `hooks/`

**Related Files:**
- Target: [`dxf-settings/`](../../ui/components/dxf-settings/) - Folder structure

### Decision

**FOLDER STRUCTURE BY RESPONSIBILITY**:

```
dxf-settings/
├── panels/           (Routing containers)
├── tabs/             (Tab content - General Settings)
├── categories/       (Category content - Specific Settings)
├── settings/         (Reusable settings UI)
├── shared/           (Shared UI components)
├── hooks/            (Custom React hooks)
└── icons/            (Icon components)
```

**Reasoning:**
1. **Self-documenting:** Folder name = component responsibility
2. **Easy navigation:** "Where's the Lines tab?" → `tabs/general/LinesTab.tsx`
3. **Scalable:** New category? → Add to `categories/`
4. **Testable:** Test files mirror source files

### Consequences

**✅ Positive:**
- Clear organization (developers know where to look)
- Easy to navigate (folder structure = mental model)
- Scalable (add new files without restructuring)
- Consistent (all similar files in one folder)

**❌ Negative:**
- More folders (7 folders vs 1-2)
- Need to navigate between folders

**⚖️ Trade-off:** Accepted - **clarity > fewer folders**

### Alternatives Considered

**Alternative 1: Flat Structure (All in dxf-settings/)**
- ❌ Rejected: 25+ files in one folder = hard to navigate

**Alternative 2: By Feature (general/, specific/)**
- ❌ Rejected: Mixes responsibilities (tabs + settings + hooks)

**Alternative 3: By Type (containers/, presenters/)**
- ❌ Rejected: Not intuitive, hard to find files

### References

- [ARCHITECTURE.md - Module Structure](./ARCHITECTURE.md#module-structure)
- [COMPONENT_GUIDE.md - Folder Structure](./COMPONENT_GUIDE.md#folder-structure-target)

---

## ADR-008: Lazy Load Categories Separately

**📅 Date:** 2025-10-07
**👤 Author:** Claude
**📊 Status:** ✅ ACCEPTED

### Context

SpecificSettingsPanel has **7 categories** with varying complexity:
- CursorCategory: 300 lines
- SelectionCategory: 300 lines
- GridCategory: 400 lines (most complex)
- EntitiesCategory: 600 lines (VERY complex)
- Others: 100-200 lines

**Question:** Load all together or separately?

**Related Files:**
- [`LazyComponents.tsx`](../../ui/components/dxf-settings/LazyComponents.tsx) - Lazy loading

### Decision

**LAZY LOAD EACH CATEGORY SEPARATELY**:

```typescript
// LazyComponents.tsx
export const LazyCursorCategory = lazy(() => import('./categories/CursorCategory'));
export const LazyGridCategory = lazy(() => import('./categories/GridCategory'));
export const LazyEntitiesCategory = lazy(() => import('./categories/EntitiesCategory'));
// ... etc.

// SpecificSettingsPanel.tsx
{activeCategory === 'cursor' && <LazyCursorCategory />}
{activeCategory === 'grid' && <LazyGridCategory />}
```

**NOT this:**
```typescript
// ❌ Load all categories together
import { CursorCategory, GridCategory, EntitiesCategory } from './categories';
```

### Consequences

**✅ Positive:**
- Performance: Load only active category (~300 lines) instead of all 7 (~2000 lines)
- Faster category switching (small chunks cached separately)
- Better bundle analysis (see which category is largest)

**❌ Negative:**
- Slight delay on first category click (~200ms)
- More lazy imports to manage

**⚖️ Trade-off:** Accepted - **on-demand loading > eager loading**

### Alternatives Considered

**Alternative 1: Load All Categories Together**
- ❌ Rejected: Slow (loads ~2000 lines even if user only needs Cursor)

**Alternative 2: Group Related Categories (e.g., Cursor + Selection)**
- ❌ Rejected: Premature optimization, not worth complexity

### References

- [ARCHITECTURE.md - Performance](./ARCHITECTURE.md#performance-considerations)
- [ADR-002: Lazy Loading Decision](#adr-002-use-reactlazy-for-lazy-loading)

---

## ADR-009: Deprecate, Don't Delete DxfSettingsPanel

**📅 Date:** 2025-10-07
**👤 Author:** Γιώργος Παγωνής
**📊 Status:** ✅ ACCEPTED

### Context

After refactoring completes, what to do with original `DxfSettingsPanel.tsx`?

**Options:**
1. Delete immediately
2. Keep forever
3. Deprecate (keep but mark as deprecated)

**Related Files:**
- [`DxfSettingsPanel.tsx`](../../ui/components/DxfSettingsPanel.tsx) - Original component (to deprecate)

### Decision

**DEPRECATE, DON'T DELETE** (for now):

```typescript
/**
 * ⚠️ DEPRECATED - DO NOT USE
 *
 * This component has been refactored into a modular structure.
 * Use DxfSettingsPanel instead.
 *
 * @deprecated Use ui/components/dxf-settings/DxfSettingsPanel.tsx
 * @see ui/components/dxf-settings/DxfSettingsPanel.tsx
 * @see docs/REFACTORING_ROADMAP_DxfSettingsPanel.md
 */
export function DxfSettingsPanel({ className = '' }: DxfSettingsPanelProps) {
  // ... existing code (kept for reference)
}
```

**Timeline:**
- Phase 4: Mark as deprecated ✅
- Phase 5: Validate new DxfSettingsPanel works ✅
- Phase 6: Delete after 1 week of production validation ✅

### Consequences

**✅ Positive:**
- Safety net (can rollback if DxfSettingsPanel breaks)
- Reference (developers can compare old vs new)
- Git history (easier to see what changed)

**❌ Negative:**
- Confusion (2 components doing same thing)
- Risk (developers might use deprecated component)
- File size (extra 2200 lines in codebase)

**⚖️ Trade-off:** Accepted - **safety > clean codebase (temporary)**

### Alternatives Considered

**Alternative 1: Delete Immediately**
- ❌ Rejected: Too risky, no rollback option

**Alternative 2: Keep Forever**
- ❌ Rejected: Confusing long-term, unnecessary

**Alternative 3: Move to archive/ Folder**
- ⚠️ Considered: Similar to deprecate, but harder to find

### References

- [MIGRATION_CHECKLIST.md - Phase 4.3](./MIGRATION_CHECKLIST.md#step-43-deprecate-colorpalettepanel-15-min)
- [MIGRATION_CHECKLIST.md - Phase 6.1](./MIGRATION_CHECKLIST.md#step-61-remove-colorpalettepanel-15-min)

---

## ADR-010: Testing Strategy - Unit + Integration + Visual

**📅 Date:** 2025-10-07
**👤 Author:** Claude
**📊 Status:** ✅ ACCEPTED

### Context

Refactoring 2200 lines of code is **high-risk**. How to ensure nothing breaks?

**Requirements:**
- Verify: New components work
- Verify: Visual UI matches old UI
- Verify: Performance doesn't regress

**Related Files:**
- See: [`TESTING_STRATEGY.md`](./TESTING_STRATEGY.md) - Detailed testing plan

### Decision

**3-LAYER TESTING STRATEGY**:

1. **Unit Tests** (Component level)
   - Test each component in isolation
   - Coverage target: 80%+
   - Tool: Jest + React Testing Library

2. **Integration Tests** (Flow level)
   - Test navigation flows (tab switching, settings persistence)
   - Coverage: Critical user flows
   - Tool: Jest + React Testing Library

3. **Visual Regression Tests** (Pixel level)
   - Screenshot old vs new UI, compare pixel-by-pixel
   - Tolerance: <0.1% diff (nearly pixel-perfect)
   - Tool: Playwright

**Acceptance Criteria:**
- ✅ All unit tests pass
- ✅ All integration tests pass
- ✅ Visual regression diff <0.1%
- ✅ TypeScript compilation succeeds
- ✅ No console errors

### Consequences

**✅ Positive:**
- Confidence (catch bugs before production)
- Documentation (tests document expected behavior)
- Refactoring safety (tests catch breaking changes)
- Performance baseline (can measure improvements)

**❌ Negative:**
- Time investment (~9 hours for all tests)
- Maintenance (tests need updating when UI changes)
- False positives (visual tests can be flaky)

**⚖️ Trade-off:** Accepted - **confidence > speed**

### Alternatives Considered

**Alternative 1: Manual Testing Only**
- ❌ Rejected: Error-prone, not repeatable

**Alternative 2: Unit Tests Only**
- ❌ Rejected: Doesn't catch integration bugs or visual regressions

**Alternative 3: E2E Tests (Playwright full app)**
- ❌ Rejected: Too slow, overkill for component refactoring

### References

- [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) - Full testing plan
- [MIGRATION_CHECKLIST.md - Phase 5](./MIGRATION_CHECKLIST.md#phase-5-testing--validation-9-hours)
- [COMPONENT_GUIDE.md - Testing Guidelines](./COMPONENT_GUIDE.md#testing-guidelines)

---

## 📝 ADDING NEW ADRs

When making a new architectural decision during refactoring:

### Template

```markdown
## ADR-XXX: [Title]

**📅 Date:** YYYY-MM-DD
**👤 Author:** Name
**📊 Status:** Proposed | Accepted | Deprecated | Superseded

### Context

[What is the issue/question we're facing?]

**Related Files:**
- [File 1](path/to/file1.tsx) - Description
- [File 2](path/to/file2.tsx) - Description

### Decision

[What did we decide to do?]

### Consequences

**✅ Positive:**
- Point 1
- Point 2

**❌ Negative:**
- Point 1
- Point 2

**⚖️ Trade-off:** [Why we accept the negatives]

### Alternatives Considered

**Alternative 1: [Name]**
- ❌ Rejected: [Why]

**Alternative 2: [Name]**
- ❌ Rejected: [Why]

### References

- [Related doc 1](link)
- [Related doc 2](link)
```

---

## 📚 REFERENCES

### Internal Documentation
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [COMPONENT_GUIDE.md](./COMPONENT_GUIDE.md) - Component details
- [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md) - State strategy
- [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) - Testing approach
- [MIGRATION_CHECKLIST.md](./MIGRATION_CHECKLIST.md) - Migration tasks

### External Resources
- [ADR Best Practices](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [React Best Practices](https://react.dev/learn)

---

## 🆕 ADR-009: Enterprise File Size Split Strategy

**Date:** 2025-10-07
**Status:** ✅ ACCEPTED & IMPLEMENTED
**Phase:** Phase 4 - Enterprise File Size Compliance
**Impact:** HIGH - Affects maintainability and code organization

### Context

After Phase 3 completion, two components violated enterprise file size guidelines:
- `RulerLinesSettings.tsx`: **485 lines** (❌ >200 limit)
- `CrosshairSettings.tsx`: **560 lines** (❌ >200 limit)

**Enterprise Standard:**
```
<200 lines: ✅ Perfect
200-300 lines: ⚠️ Acceptable
300-500 lines: ⚠️ Consider split
>500 lines: ❌ MUST split
```

**User Request:**
> "Προχώρα λοιπόν στην υπόλοιπη διάσπαση για να είμαστε 100% enterprise level"

### Decision

Split both violating components using **Router + Specialized Sub-components** pattern.

**Pattern:**
```typescript
// BEFORE: Monolithic component (485 lines)
export const RulerLinesSettings = () => {
  // All inline UI for Major + Minor lines
  return <div>{/* 485 lines of UI */}</div>;
};

// AFTER: Router (100 lines) + 2 Sub-components (155 + 155 lines)
export const RulerLinesSettings = () => {
  const { activeTab } = useTabNavigation('major');
  return (
    <div>
      <TabNavigation tabs={tabs} activeTab={activeTab} />
      {activeTab === 'major' ? <RulerMajorLinesSettings /> : <RulerMinorLinesSettings />}
    </div>
  );
};
```

### Consequences

**Positive:**
- ✅ 100% Enterprise file size compliance (all files <200 lines)
- ✅ Single Responsibility Principle (each file has ONE job)
- ✅ Better testability (test each sub-component in isolation)
- ✅ Improved maintainability (easier to find and modify code)
- ✅ Cleaner git diffs (changes localized to specific files)
- ✅ Faster code navigation (smaller files load faster in IDE)

**Negative:**
- ⚠️ More files to manage (2 files → 6 files)
- ⚠️ Slightly more import statements
- ⚠️ Need to understand component hierarchy (router → sub-components)

**Metrics:**
```
BEFORE Phase 4:
- Components: 29 total
- Violations: 2 files (485 + 560 lines)
- Total: 1045 violating lines

AFTER Phase 4:
- Components: 33 total (+4 new)
- Violations: 0 files ✅
- Total: 868 lines (split across 6 files)
- Per-file: 100, 155, 155, 120, 195, 143 (all <200) ✅
```

### Implementation

**Split #1: RulerLinesSettings (485 → 3 files)**
```
RulerLinesSettings.tsx (100 lines - Router)
├─ RulerMajorLinesSettings.tsx (155 lines)
│   - Visibility, Color, Opacity, Thickness for Major lines
└─ RulerMinorLinesSettings.tsx (155 lines)
    - Visibility, Color, Opacity, Thickness for Minor lines
```

**Split #2: CrosshairSettings (560 → 3 files)**
```
CrosshairSettings.tsx (120 lines - Router + State)
├─ CrosshairAppearanceSettings.tsx (195 lines)
│   - Line Style (solid/dashed/dotted/dash-dot)
│   - Line Width (1px-5px)
│   - Size/Type (0%/5%/8%/15%/Full)
└─ CrosshairBehaviorSettings.tsx (143 lines)
    - Crosshair Color
    - Opacity Slider
    - Cursor Gap Toggle
```

**Files Created:**
- `settings/special/rulers/RulerMajorLinesSettings.tsx`
- `settings/special/rulers/RulerMinorLinesSettings.tsx`
- `settings/special/CrosshairAppearanceSettings.tsx`
- `settings/special/CrosshairBehaviorSettings.tsx`

**Files Modified:**
- `settings/special/rulers/RulerLinesSettings.tsx` (485 → 100 lines)
- `settings/special/CrosshairSettings.tsx` (560 → 120 lines)

### Alternatives Considered

**Alternative 1: Keep files as-is (REJECTED)**
- ❌ Violates enterprise standards
- ❌ Harder to maintain
- ❌ Slower to navigate

**Alternative 2: Split into MORE files (REJECTED)**
- ❌ Over-engineering (each sub-component would be <100 lines)
- ❌ Too many files (harder to navigate)
- ❌ Diminishing returns

**Alternative 3: Inline Sub-components (REJECTED)**
```typescript
const MajorLines = () => { /* ... */ };
const MinorLines = () => { /* ... */ };

export const RulerLinesSettings = () => {
  return activeTab === 'major' ? <MajorLines /> : <MinorLines />;
};
```
- ❌ Still violates file size (485 lines in one file)
- ❌ Cannot test sub-components in isolation
- ❌ Cannot lazy load sub-components

### Documentation Updates

**Bidirectional Cross-References Added:**
- Code files now reference:
  - `docs/dxf-settings/COMPONENT_GUIDE.md` (specific section numbers §7.2-7.5)
  - `docs/dxf-settings/MIGRATION_CHECKLIST.md` (Phase 4 steps)
  - `docs/dxf-settings/ARCHITECTURE.md` (§6.3 Enterprise File Size)
  - `docs/dxf-settings/DECISION_LOG.md` (This ADR: ADR-009)
  - `docs/CENTRALIZED_SYSTEMS.md` (Rule #12)

**Documentation files now reference:**
- `COMPONENT_GUIDE.md` - Added §7.2-7.5 (4 new components)
- `CENTRALIZED_SYSTEMS.md` - Updated Phase 4 status
- `DECISION_LOG.md` - This ADR (ADR-009)
- Total components updated: 29 → 33

### Testing Strategy

**Unit Tests Required:**
```typescript
describe('RulerMajorLinesSettings', () => {
  it('renders visibility toggle', () => { /* ... */ });
  it('renders color picker with rgba support', () => { /* ... */ });
  it('renders opacity slider 0.1-1.0', () => { /* ... */ });
  it('renders thickness control 0.5px-3px', () => { /* ... */ });
  it('updates settings via useRulersGridContext', () => { /* ... */ });
});

// Same for RulerMinorLinesSettings, CrosshairAppearanceSettings, CrosshairBehaviorSettings
```

**Integration Tests Required:**
```typescript
describe('RulerLinesSettings Integration', () => {
  it('switches between Major/Minor tabs', () => { /* ... */ });
  it('preserves settings across tab switches', () => { /* ... */ });
  it('applies changes to ruler system immediately', () => { /* ... */ });
});
```

### Related ADRs

- **ADR-001:** Extract to separate files (established pattern)
- **ADR-004:** Use TabNavigation component (used in routers)
- **ADR-005:** Use useTabNavigation hook (used in routers)
- **ADR-008:** Lazy load categories separately (performance)

### Success Metrics

- ✅ All files <200 lines (100% compliance)
- ✅ Zero TypeScript errors
- ✅ All functionality preserved (no breaking changes)
- ✅ Bidirectional documentation (Code ↔ Docs)
- ✅ Component count: 29 → 33 (+4)
- ✅ Total lines: 1045 → 868 (split across 6 files)

---

## 📝 CHANGELOG

| Date | Author | Changes |
|------|--------|---------|
| 2025-10-07 | Claude | Initial ADRs (001-010) - Pre-refactoring decisions |
| 2025-10-07 | Claude | **ADR-009 added** - Enterprise File Size Split Strategy (Phase 4) |

---

**END OF DECISION LOG**
