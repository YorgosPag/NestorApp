# ADR 003: Component Composition Structure

**Status:** ✅ Accepted
**Date:** 2025-10-06
**Author:** Claude (AI) & Γιώργος (Human Developer)
**Context:** TestsModal Refactoring Phase 2

---

## 🎯 Decision

Extract UI rendering into **5 dedicated React components** using the **Composition Pattern**.

---

## 📊 Context

### The Problem

After Phase 1 (hooks extraction), TestsModal.tsx was reduced from 950 → 650 lines, but still had **400+ lines of inline JSX**.

**Code before:**
```typescript
const TestsModal = ({ isOpen, onClose, showCopyableNotification }) => {
  const testState = useTestState();
  const draggable = useDraggableModal(isOpen);
  // ... other hooks

  return (
    <div className="fixed inset-0 ...">
      {/* 50 lines: Tab navigation */}
      <div className="flex space-x-2">
        <button
          onClick={() => testState.setActiveTab('automated')}
          className={cn(
            'px-4 py-2 rounded-lg',
            testState.activeTab === 'automated' && 'bg-purple-600'
          )}
        >
          📋 Automated Tests
        </button>
        {/* ... 2 more tabs */}
      </div>

      {/* 150 lines: Automated Tests Tab */}
      {testState.activeTab === 'automated' && (
        <div className="space-y-4">
          <button onClick={handleRunAllTests}>
            🧪 Run All Tests
          </button>
          <div className="grid grid-cols-2 gap-2">
            {runAllTestsGroup.map(test => (
              <button
                key={test.id}
                onClick={() => handleRunTest(test.id, test.action)}
                disabled={testState.runningTests.has(test.id)}
                className={cn(
                  'relative p-3 rounded-lg border',
                  testState.runningTests.has(test.id) && 'bg-yellow-500/10',
                  testState.completedTests.has(test.id) && 'bg-green-500/10'
                )}
              >
                {/* ... 30 more lines per button */}
              </button>
            ))}
          </div>
          {/* ... debug tools section (100 lines) */}
        </div>
      )}

      {/* 120 lines: Unit Tests Tab */}
      {testState.activeTab === 'unit' && (
        <div>
          {/* ... similar inline JSX */}
        </div>
      )}

      {/* 90 lines: Standalone Tests Tab */}
      {testState.activeTab === 'standalone' && (
        <div>
          {/* ... similar inline JSX */}
        </div>
      )}
    </div>
  );
};
```

**Issues:**
- ❌ 400+ lines of inline JSX (hard to read)
- ❌ Repeated button patterns (test buttons)
- ❌ Hard to test UI components independently
- ❌ No component reusability
- ❌ Violates Single Responsibility Principle

---

## 🔍 Options Considered

### Option A: Keep Inline JSX (Status Quo)

**Pros:**
- ✅ No refactoring needed
- ✅ All UI in one place

**Cons:**
- ❌ 650 lines still too large
- ❌ Repeated code (test buttons)
- ❌ Can't test UI independently
- ❌ Can't reuse components

**Verdict:** ❌ Rejected

---

### Option B: One Component per Section (6+ files)

```
components/
├── TestTabs.tsx
├── AutomatedTestsTab.tsx
├── UnitTestsTab.tsx
├── StandaloneTestsTab.tsx
├── RunAllTestsButton.tsx
├── TestButton.tsx
├── DebugToolsSection.tsx
└── TestGrid.tsx
```

**Pros:**
- ✅ Maximum modularity
- ✅ Very small files

**Cons:**
- ❌ Too many files (over-engineering)
- ❌ Some components too small to justify
- ❌ Harder to navigate

**Verdict:** ⚠️ Too granular (over-optimization)

---

### Option C: Composition with Reusable Components (Chosen ✅)

```
components/
├── TestButton.tsx          (55 lines - reusable)
├── TestTabs.tsx            (50 lines - tab navigation)
├── AutomatedTestsTab.tsx   (96 lines - automated tests UI)
├── UnitTestsTab.tsx        (120 lines - unit tests UI)
└── StandaloneTestsTab.tsx  (91 lines - standalone tests UI)
```

**Pros:**
- ✅ **TestButton** reusable (used 3 times)
- ✅ Each component has clear purpose
- ✅ File sizes optimal (50-120 lines)
- ✅ Easy to test independently
- ✅ Reduces TestsModal.tsx: 650 → 420 lines (35% ↓)

**Cons:**
- ⚠️ Need to manage props (but clean interfaces)

**Verdict:** ✅ **ACCEPTED**

---

## 🏗️ Implementation

### Created 5 UI Components

#### 1. `components/TestButton.tsx` (55 lines) - Reusable ⭐

**Responsibility:** Render a single test button with status indicators

```typescript
interface TestButtonProps {
  test: TestDefinition;
  isRunning: boolean;
  isCompleted: boolean;
  onRun: (testId: string, action: () => Promise<void>) => void;
}

export const TestButton: React.FC<TestButtonProps> = ({
  test,
  isRunning,
  isCompleted,
  onRun
}) => {
  return (
    <button
      onClick={() => onRun(test.id, test.action)}
      disabled={isRunning}
      className={cn(
        'relative p-3 rounded-lg border transition-all',
        'hover:border-purple-400',
        isRunning && 'bg-yellow-500/10 border-yellow-500',
        isCompleted && 'bg-green-500/10 border-green-500'
      )}
    >
      <div className="flex items-start gap-2">
        {/* Status icon */}
        <div className="flex-shrink-0">
          {isRunning && <span className="animate-spin">⏳</span>}
          {isCompleted && !isRunning && <CheckCircle className="w-5 h-5 text-green-500" />}
          {!isRunning && !isCompleted && <Play className="w-5 h-5 text-gray-400" />}
        </div>

        {/* Test info */}
        <div className="flex-1 text-left">
          <div className="font-medium">{test.name}</div>
          <div className="text-sm text-gray-400">{test.description}</div>
        </div>
      </div>
    </button>
  );
};
```

**Why Reusable:**
- Used in AutomatedTestsTab (10 tests)
- Used in UnitTestsTab (3 tests)
- Used in StandaloneTestsTab (2 tests)
- **Saves ~200 lines** of duplicated JSX

---

#### 2. `components/TestTabs.tsx` (50 lines)

**Responsibility:** Tab navigation

```typescript
interface TestTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const TestTabs: React.FC<TestTabsProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'automated' as const, label: '📋 Automated Tests', icon: '🧪' },
    { id: 'unit' as const, label: '🧪 Unit & E2E Tests', icon: '🔬' },
    { id: 'standalone' as const, label: '📊 Standalone Tests', icon: '📈' }
  ];

  return (
    <div className="flex space-x-2 mb-4">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'px-4 py-2 rounded-lg transition-all',
            activeTab === tab.id
              ? 'bg-purple-600 text-white'
              : 'bg-gray-700 hover:bg-gray-600'
          )}
        >
          {tab.icon} {tab.label}
        </button>
      ))}
    </div>
  );
};
```

---

#### 3. `components/AutomatedTestsTab.tsx` (96 lines)

**Responsibility:** Automated tests tab content

```typescript
interface AutomatedTestsTabProps {
  runAllTestsGroup: TestDefinition[];
  individualToolsGroup: TestDefinition[];
  testState: TestState;
  handleRunAllTests: () => Promise<void>;
  handleRunTest: (testId: string, testFunction: () => Promise<void>) => Promise<void>;
}

export const AutomatedTestsTab: React.FC<AutomatedTestsTabProps> = ({
  runAllTestsGroup,
  individualToolsGroup,
  testState,
  handleRunAllTests,
  handleRunTest
}) => {
  return (
    <div className="space-y-6">
      {/* Run All Tests Button */}
      <button
        onClick={handleRunAllTests}
        className="w-full p-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg"
      >
        🧪 Run All Automated Tests ({runAllTestsGroup.length} tests)
      </button>

      {/* Automated Tests Grid */}
      <div>
        <h3 className="text-lg font-bold mb-3">📋 Automated Test Suite</h3>
        <div className="grid grid-cols-2 gap-2">
          {runAllTestsGroup.map(test => (
            <TestButton
              key={test.id}
              test={test}
              isRunning={testState.runningTests.has(test.id)}
              isCompleted={testState.completedTests.has(test.id)}
              onRun={handleRunTest}
            />
          ))}
        </div>
      </div>

      {/* Debug Tools Grid */}
      <div>
        <h3 className="text-lg font-bold mb-3">🛠️ Debug Tools (Manual)</h3>
        <div className="grid grid-cols-2 gap-2">
          {individualToolsGroup.map(tool => (
            <TestButton
              key={tool.id}
              test={tool}
              isRunning={testState.runningTests.has(tool.id)}
              isCompleted={testState.completedTests.has(tool.id)}
              onRun={handleRunTest}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
```

**Key:** Uses `TestButton` component twice (reusability!)

---

#### 4. `components/UnitTestsTab.tsx` (120 lines)

**Responsibility:** Unit & E2E tests tab content

**Structure:**
- Section 1: Unit Tests (Vitest, Jest)
- Section 2: E2E Tests (Playwright)
- Info note about server-side execution

---

#### 5. `components/StandaloneTestsTab.tsx` (91 lines)

**Responsibility:** Standalone tests tab content

**Structure:**
- Coordinate Reversibility test
- Grid Workflow test
- WIP warning notice

---

### Updated TestsModal.tsx

**Before (650 lines):**
```typescript
const TestsModal = ({ isOpen, onClose, showCopyableNotification }) => {
  const testState = useTestState();
  // ... hooks

  return (
    <div>
      {/* 50 lines: Inline tab buttons */}
      <div className="flex">
        <button onClick={...}>Automated</button>
        <button onClick={...}>Unit</button>
        <button onClick={...}>Standalone</button>
      </div>

      {/* 150 lines: Inline automated tests UI */}
      {testState.activeTab === 'automated' && (
        <div>{/* ... */}</div>
      )}

      {/* 120 lines: Inline unit tests UI */}
      {testState.activeTab === 'unit' && (
        <div>{/* ... */}</div>
      )}

      {/* 90 lines: Inline standalone tests UI */}
      {testState.activeTab === 'standalone' && (
        <div>{/* ... */}</div>
      )}
    </div>
  );
};
```

**After (420 lines):**
```typescript
const TestsModal = ({ isOpen, onClose, showCopyableNotification }) => {
  const testState = useTestState();
  // ... hooks

  const runAllTestsGroup = getAutomatedTests(showCopyableNotification);
  const individualToolsGroup = getDebugTools(showCopyableNotification);

  return (
    <div>
      {/* 1 line: Component composition */}
      <TestTabs
        activeTab={testState.activeTab}
        onTabChange={testState.setActiveTab}
      />

      {/* 5 lines: Component composition */}
      {testState.activeTab === 'automated' && (
        <AutomatedTestsTab
          runAllTestsGroup={runAllTestsGroup}
          individualToolsGroup={individualToolsGroup}
          testState={testState}
          handleRunAllTests={handleRunAllTests}
          handleRunTest={handleRunTest}
        />
      )}

      {/* 4 lines: Component composition */}
      {testState.activeTab === 'unit' && (
        <UnitTestsTab testState={testState} apiTests={apiTests} />
      )}

      {/* 4 lines: Component composition */}
      {testState.activeTab === 'standalone' && (
        <StandaloneTestsTab testState={testState} standaloneTests={standaloneTests} />
      )}
    </div>
  );
};
```

**Reduction:** 650 → 420 lines (35% ↓)

---

## 📈 Results

### Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **TestsModal.tsx size** | 650 lines | 420 lines | **-230 lines (35% ↓)** |
| **Inline JSX** | 400 lines | 50 lines | **-350 lines (87% ↓)** |
| **Component files** | 0 | 5 files | **+5 testable components** |
| **Code reuse** | None | TestButton 3x | **~200 lines saved** |

---

## ✅ Benefits

### 1. **Component Reusability**

**TestButton used 3 times:**
```typescript
// AutomatedTestsTab - 10 tests
{runAllTestsGroup.map(test => <TestButton test={test} ... />)}

// UnitTestsTab - 3 tests
<TestButton test={vitestTest} ... />
<TestButton test={jestTest} ... />
<TestButton test={playwrightTest} ... />

// StandaloneTestsTab - 2 tests
<TestButton test={coordinateTest} ... />
<TestButton test={gridTest} ... />
```

**Without reusability:** Would need ~200 lines of duplicated JSX

---

### 2. **Independent Testing**

Each component can be tested in isolation:

```typescript
// TestButton.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { TestButton } from '../components/TestButton';

describe('TestButton', () => {
  it('should show running indicator when isRunning=true', () => {
    render(
      <TestButton
        test={{ id: 'test-1', name: 'Test', action: jest.fn() }}
        isRunning={true}
        isCompleted={false}
        onRun={jest.fn()}
      />
    );

    expect(screen.getByText('⏳')).toBeInTheDocument();
  });
});
```

---

### 3. **Clear Component Hierarchy**

```
TestsModal (main container)
├── TestTabs (tab navigation)
├── AutomatedTestsTab (when activeTab === 'automated')
│   ├── TestButton (×10 automated tests)
│   └── TestButton (×5 debug tools)
├── UnitTestsTab (when activeTab === 'unit')
│   ├── TestButton (Vitest)
│   ├── TestButton (Jest)
│   └── TestButton (Playwright)
└── StandaloneTestsTab (when activeTab === 'standalone')
    ├── TestButton (Coordinate Reversibility)
    └── TestButton (Grid Workflow)
```

**Visual:** Easy to understand, follows React best practices

---

### 4. **Easier Maintenance**

**Adding a new tab:**

Before: Edit 650-line file, find right spot, avoid breaking inline JSX

After:
1. Create `components/MyNewTab.tsx` (< 100 lines)
2. Import in `TestsModal.tsx`
3. Add conditional render:
   ```typescript
   {testState.activeTab === 'mynew' && <MyNewTab ... />}
   ```

---

## 🏆 Industry Alignment

### Composition Pattern Used By:

**React Official Docs:**
> "We recommend using composition instead of inheritance to reuse code between components."

**Google (Material-UI):**
```typescript
<Dialog open={isOpen} onClose={onClose}>
  <DialogTitle>Title</DialogTitle>
  <DialogContent>Content</DialogContent>
  <DialogActions>Actions</DialogActions>
</Dialog>
```

**Meta (React Team):**
- Facebook codebase uses composition extensively
- React.Children API supports composition

**Airbnb:**
- Style guide recommends composition over inheritance
- Encourages small, composable components

**Netflix:**
- Polaris design system built on composition
- Reusable component library

**Enterprise Standard:** ✅ Yes (core React philosophy)

---

## ⚠️ Risks & Mitigations

### Risk 1: Prop Drilling
**Risk:** Passing props through multiple levels

**Mitigation:**
- Most props are at top level (TestsModal → Tab components)
- Only 1-2 levels deep (shallow hierarchy)
- Can use Context API if needed in future

---

### Risk 2: Component Props Too Complex
**Risk:** Tab components have 5+ props

**Mitigation:**
- Props are well-typed (TypeScript interfaces)
- Props are documented in API Reference
- Props follow clear patterns (testState, handlers)

---

### Risk 3: Over-Abstraction
**Risk:** Too many small components

**Mitigation:**
- **Only** extracted components that are:
  - Reusable (TestButton)
  - Clear responsibility (TestTabs, *TestsTab)
  - Reasonable size (50-120 lines)
- Avoided micro-components (< 30 lines)

---

## 🔮 Future Considerations

### Potential Enhancements

1. **React.memo() for TestButton** (if profiling shows re-renders)
   ```typescript
   export const TestButton = React.memo<TestButtonProps>(({ ... }) => {
     // Component implementation
   });
   ```

2. **Lazy load tab components** (code splitting)
   ```typescript
   const AutomatedTestsTab = React.lazy(() =>
     import('./components/AutomatedTestsTab')
   );
   ```

3. **Add TestCard component** (if buttons need more features)
   ```typescript
   // If test buttons become complex (>80 lines)
   export const TestCard = ({ test, ... }) => {
     // Enhanced UI with more features
   };
   ```

---

## 📚 References

- [React Docs: Composition vs Inheritance](https://react.dev/learn/composition-vs-inheritance)
- [Kent C. Dodds: Prop Drilling](https://kentcdodds.com/blog/prop-drilling)
- [Dan Abramov: Presentational and Container Components](https://medium.com/@dan_abramov/smart-and-dumb-components-7ca2f9a7c7d0)
- [Martin Fowler: Component](https://martinfowler.com/bliki/Component.html)

---

## ✍️ Sign-off

**Decision:** ✅ Accepted
**Implementation:** ✅ Complete
**Testing:** ⏳ Pending (component tests to be added)
**Documentation:** ✅ Complete

**Reviewed by:** Γιώργος
**Approved on:** 2025-10-06

---

**Related ADRs:**
- [ADR 001: Custom Hooks](./001-custom-hooks.md)
- [ADR 002: Factory Functions](./002-factory-functions.md)
