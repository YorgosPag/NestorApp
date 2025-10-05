# ADR 001: Custom Hooks Pattern for State Management

**Status:** ✅ Accepted
**Date:** 2025-10-06
**Author:** Claude (AI) & Γιώργος (Human Developer)
**Context:** TestsModal Refactoring Phase 1

---

## 🎯 Decision

Extract all state management logic from the monolithic TestsModal component into **5 dedicated custom React hooks**.

---

## 📊 Context

### The Problem

TestsModal.tsx (v1.0) had **950 lines** with mixed responsibilities:
- State management (100+ lines)
- UI rendering (400+ lines)
- Test definitions (300+ lines)
- Event handlers (150+ lines)

**Code sample before:**
```typescript
// Inside TestsModal.tsx (lines 50-150)
const [runningTests, setRunningTests] = useState(new Set<string>());
const [completedTests, setCompletedTests] = useState(new Set<string>());
const [activeTab, setActiveTab] = useState<TabType>('automated');
const [position, setPosition] = useState({ x: 0, y: 0 });
const [isDragging, setIsDragging] = useState(false);
const modalRef = useRef<HTMLDivElement>(null);

// 50+ more lines of state logic...
const startTest = useCallback((id: string) => { /* ... */ }, []);
const completeTest = useCallback((id: string) => { /* ... */ }, []);
const handleMouseDown = useCallback((e: React.MouseEvent) => { /* ... */ }, []);
const handleRunVitest = useCallback(async () => { /* ... */ }, []);
// ... more callbacks
```

**Issues:**
- ❌ Hard to test state logic (mixed with UI)
- ❌ Hard to understand (too many responsibilities)
- ❌ Hard to reuse state logic
- ❌ Violates Single Responsibility Principle

---

## 🔍 Options Considered

### Option A: Keep Everything in Component (Status Quo)

**Pros:**
- ✅ No refactoring needed
- ✅ All code in one place

**Cons:**
- ❌ 950 lines - unmaintainable
- ❌ Can't test state logic independently
- ❌ Can't reuse state logic
- ❌ Violates SRP

**Verdict:** ❌ Rejected

---

### Option B: Use Redux/Zustand (External State Management)

**Pros:**
- ✅ Centralized global state
- ✅ DevTools support
- ✅ Time-travel debugging

**Cons:**
- ❌ Overkill for local modal state
- ❌ Additional dependencies
- ❌ Boilerplate code (actions, reducers, store)
- ❌ Steeper learning curve

**Verdict:** ❌ Rejected (over-engineering)

---

### Option C: Custom Hooks Pattern (Chosen ✅)

**Pros:**
- ✅ Zero dependencies (pure React)
- ✅ Testable in isolation
- ✅ Reusable across components
- ✅ Follows React best practices
- ✅ Reduces component size by 32%

**Cons:**
- ⚠️ Need to create multiple files (but organized)

**Verdict:** ✅ **ACCEPTED**

---

## 🏗️ Implementation

### Created 5 Custom Hooks

#### 1. `hooks/useTestState.ts` (44 lines)
**Responsibility:** Test execution state management

```typescript
export const useTestState = () => {
  const [runningTests, setRunningTests] = useState(new Set<string>());
  const [completedTests, setCompletedTests] = useState(new Set<string>());
  const [activeTab, setActiveTab] = useState<TabType>('automated');

  const startTest = useCallback((id: string) => {
    setRunningTests(prev => new Set(prev).add(id));
  }, []);

  const completeTest = useCallback((id: string) => {
    setRunningTests(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setCompletedTests(prev => new Set(prev).add(id));
  }, []);

  const failTest = useCallback((id: string) => {
    setRunningTests(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  return {
    runningTests,
    completedTests,
    activeTab,
    setActiveTab,
    startTest,
    completeTest,
    failTest
  };
};
```

---

#### 2. `hooks/useDraggableModal.ts` (64 lines)
**Responsibility:** Drag & drop modal positioning

```typescript
export const useDraggableModal = (isOpen: boolean) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  // Auto-center on first open
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const rect = modalRef.current.getBoundingClientRect();
      setPosition({
        x: (window.innerWidth - rect.width) / 2,
        y: (window.innerHeight - rect.height) / 2
      });
    }
  }, [isOpen]);

  // ... drag handlers

  return { position, isDragging, modalRef, handleMouseDown };
};
```

---

#### 3. `hooks/useApiTests.ts` (108 lines)
**Responsibility:** Server-side test execution (Vitest/Jest/Playwright)

---

#### 4. `hooks/useTestExecution.ts` (56 lines)
**Responsibility:** Automated test execution logic

---

#### 5. `hooks/useStandaloneTests.ts` (63 lines)
**Responsibility:** Standalone test script execution

---

## 📈 Results

### Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **TestsModal.tsx size** | 950 lines | 650 lines | **-300 lines (32% ↓)** |
| **Testable modules** | 0 | 5 hooks | **+5 testable units** |
| **Responsibilities** | 7+ mixed | 1 per hook | **SRP achieved ✅** |
| **Reusability** | None | High | **Can reuse hooks ✅** |

---

### Code Quality

**Before:**
```typescript
// TestsModal.tsx - 950 lines, everything mixed
const TestsModal = ({ isOpen, onClose, showCopyableNotification }) => {
  // 100+ lines of state
  // 50+ lines of callbacks
  // 400+ lines of JSX
  // 300+ lines of test definitions
  // ... impossible to test
};
```

**After:**
```typescript
// TestsModal.tsx - 650 lines, clean separation
const TestsModal = ({ isOpen, onClose, showCopyableNotification }) => {
  // Clean hook composition
  const testState = useTestState();
  const draggable = useDraggableModal(isOpen);
  const { handleRunTest, handleRunAllTests } = useTestExecution(showCopyableNotification, testState);
  const apiTests = useApiTests(showCopyableNotification, testState);
  const standaloneTests = useStandaloneTests(showCopyableNotification, testState);

  // Just UI rendering
  return (
    <div ref={draggable.modalRef}>
      {/* Clean JSX */}
    </div>
  );
};
```

---

## ✅ Benefits

### 1. **Testability**
Each hook can be tested in isolation:
```typescript
// useTestState.test.ts
import { renderHook, act } from '@testing-library/react';
import { useTestState } from '../hooks/useTestState';

describe('useTestState', () => {
  it('should start a test', () => {
    const { result } = renderHook(() => useTestState());
    act(() => result.current.startTest('test-1'));
    expect(result.current.runningTests.has('test-1')).toBe(true);
  });
});
```

---

### 2. **Reusability**
Hooks can be used in other components:
```typescript
// Future: Use in a different modal
const OtherModal = () => {
  const testState = useTestState(); // Reuse same logic!
  // ...
};
```

---

### 3. **Maintainability**
Each hook has **one clear purpose**:
- `useTestState` → Test state management
- `useDraggableModal` → Drag & drop logic
- `useApiTests` → API test handlers
- `useTestExecution` → Test execution logic
- `useStandaloneTests` → Standalone test handlers

---

### 4. **Performance**
- Easier to apply React.memo() optimizations
- Easier to identify re-render causes
- Hooks are lazily evaluated

---

## 🏆 Industry Alignment

This pattern is used by:

- **Google**: Material-UI uses custom hooks extensively
- **Meta**: React team recommends custom hooks for logic extraction
- **Airbnb**: Airbnb React Style Guide encourages custom hooks
- **Vercel**: Next.js documentation uses custom hooks pattern
- **Netflix**: Polaris design system uses custom hooks

**Enterprise Standard:** ✅ Yes

---

## ⚠️ Risks & Mitigations

### Risk 1: Hook Dependencies
**Risk:** Hooks depend on each other (e.g., useTestExecution needs testState)

**Mitigation:**
- Clear dependency injection via parameters
- Well-documented interfaces
- TypeScript type safety

---

### Risk 2: Over-Abstraction
**Risk:** Too many small hooks → fragmentation

**Mitigation:**
- Only create hooks for clear responsibilities
- Each hook must be >40 lines to justify extraction
- Avoid premature abstraction

---

## 🔮 Future Considerations

### Potential Enhancements

1. **Add unit tests for all hooks** (currently pending)
2. **Add JSDoc comments** for better IDE support
3. **Consider React.memo()** if profiling shows re-render issues
4. **Extract shared logic** if multiple hooks duplicate code

---

## 📚 References

- [React Docs: Building Your Own Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [Kent C. Dodds: Application State Management with React](https://kentcdodds.com/blog/application-state-management-with-react)
- [Robin Wieruch: React Custom Hooks](https://www.robinwieruch.de/react-hooks/)

---

## ✍️ Sign-off

**Decision:** ✅ Accepted
**Implementation:** ✅ Complete
**Testing:** ⏳ Pending (unit tests to be added)
**Documentation:** ✅ Complete

**Reviewed by:** Γιώργος
**Approved on:** 2025-10-06

---

**Related ADRs:**
- [ADR 002: Factory Functions](./002-factory-functions.md)
- [ADR 003: Component Structure](./003-component-structure.md)
