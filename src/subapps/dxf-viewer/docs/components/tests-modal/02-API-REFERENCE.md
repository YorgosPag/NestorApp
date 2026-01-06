# 📖 TestsModal - API Reference

**Complete API Documentation for All Components & Hooks**

---

## 📦 Main Component

### `TestsModal`

Modal component for test management interface.

**Import:**
```typescript
import { TestsModal } from './components/tests-modal/TestsModal';
```

**Props:**
```typescript
interface TestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  showCopyableNotification: NotificationFn;
}
```

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | `boolean` | ✅ | Controls modal visibility |
| `onClose` | `() => void` | ✅ | Callback when user closes modal |
| `showCopyableNotification` | `NotificationFn` | ✅ | Notification handler function |

**Example:**
```typescript
<TestsModal
  isOpen={true}
  onClose={() => setIsOpen(false)}
  showCopyableNotification={(msg, type) => alert(msg)}
/>
```

---

## 🎣 Custom Hooks

### `useTestState()`

Manages test execution state.

**Import:**
```typescript
import { useTestState } from './tests-modal/hooks/useTestState';
```

**Returns:**
```typescript
interface TestState {
  runningTests: Set<string>;
  completedTests: Set<string>;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  startTest: (id: string) => void;
  completeTest: (id: string) => void;
  failTest: (id: string) => void;
}
```

**Methods:**

#### `startTest(id: string)`
Marks a test as currently running.

```typescript
const testState = useTestState();
testState.startTest('grid-enterprise');
// runningTests.has('grid-enterprise') === true
```

#### `completeTest(id: string)`
Marks a test as successfully completed.

```typescript
testState.completeTest('grid-enterprise');
// runningTests.has('grid-enterprise') === false
// completedTests.has('grid-enterprise') === true
```

#### `failTest(id: string)`
Removes a test from running state (error handling).

```typescript
testState.failTest('grid-enterprise');
// runningTests.has('grid-enterprise') === false
// completedTests.has('grid-enterprise') === false
```

#### `setActiveTab(tab: TabType)`
Changes the active tab.

```typescript
testState.setActiveTab('unit');
// activeTab === 'unit'
```

---

### `useDraggableModal(isOpen: boolean)`

Provides drag & drop functionality for modal repositioning.

**Import:**
```typescript
import { useDraggableModal } from './tests-modal/hooks/useDraggableModal';
```

**Parameters:**
- `isOpen: boolean` - Modal visibility state

**Returns:**
```typescript
interface DraggableState {
  position: { x: number; y: number };
  isDragging: boolean;
  modalRef: React.RefObject<HTMLDivElement>;
  handleMouseDown: (e: React.MouseEvent) => void;
}
```

**Example:**
```typescript
const draggable = useDraggableModal(isOpen);

<div
  ref={draggable.modalRef}
  style={{
    left: `${draggable.position.x}px`,
    top: `${draggable.position.y}px`,
    cursor: draggable.isDragging ? 'grabbing' : 'grab'
  }}
  onMouseDown={draggable.handleMouseDown}
>
  {/* Modal content */}
</div>
```

**Behavior:**
- Auto-centers on first open
- Tracks mouse movement during drag
- Updates position in real-time

---

### `useApiTests(notify: NotificationFn, state: TestState)`

Handles server-side test execution (Vitest, Jest, Playwright).

**Import:**
```typescript
import { useApiTests } from './tests-modal/hooks/useApiTests';
```

**Parameters:**
- `notify: NotificationFn` - Notification callback
- `state: TestState` - Test state manager

**Returns:**
```typescript
interface ApiTestHandlers {
  handleRunVitest: () => Promise<void>;
  handleRunJest: () => Promise<void>;
  handleRunPlaywright: () => Promise<void>;
}
```

**Methods:**

#### `handleRunVitest()`
Executes Vitest tests via `/api/run-vitest`.

```typescript
const apiTests = useApiTests(showNotification, testState);
await apiTests.handleRunVitest();
```

**Response:**
```typescript
{
  success: boolean;
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  duration: number; // milliseconds
  timestamp: string;
}
```

#### `handleRunJest()`
Executes Jest tests via `/api/run-jest`.

#### `handleRunPlaywright()`
Executes Playwright E2E tests via `/api/run-playwright`.

**Note:** Tests run server-side. Check server logs for detailed output.

---

### `useTestExecution(notify: NotificationFn, state: TestState)`

Handles automated test execution logic.

**Import:**
```typescript
import { useTestExecution } from './tests-modal/hooks/useTestExecution';
```

**Parameters:**
- `notify: NotificationFn` - Notification callback
- `state: TestState` - Test state manager

**Returns:**
```typescript
interface TestExecutionHandlers {
  handleRunTest: (testId: string, testFunction: () => Promise<void>) => Promise<void>;
  handleRunAllTests: () => Promise<void>;
}
```

**Methods:**

#### `handleRunTest(testId, testFunction)`
Executes a single test.

```typescript
const { handleRunTest } = useTestExecution(notify, testState);

await handleRunTest('my-test', async () => {
  // Test implementation
  await myTestFunction();
});
```

**Behavior:**
1. Calls `state.startTest(testId)`
2. Executes `testFunction()`
3. On success: calls `state.completeTest(testId)`
4. On error: calls `state.failTest(testId)`

#### `handleRunAllTests()`
Executes all automated tests in batch.

```typescript
await handleRunAllTests();
```

**Integration:**
- Uses `unified-test-runner` for batch execution
- Formats results with `formatReportForCopy()`
- Shows summary notification

---

### `useStandaloneTests(notify: NotificationFn, state: TestState)`

Handles standalone test script execution.

**Import:**
```typescript
import { useStandaloneTests } from './tests-modal/hooks/useStandaloneTests';
```

**Parameters:**
- `notify: NotificationFn` - Notification callback
- `state: TestState` - Test state manager

**Returns:**
```typescript
interface StandaloneTestHandlers {
  handleRunCoordinateReversibility: () => Promise<void>;
  handleRunGridWorkflow: () => Promise<void>;
}
```

**Methods:**

#### `handleRunCoordinateReversibility()`
Tests coordinate transformation accuracy.

```typescript
const standaloneTests = useStandaloneTests(notify, testState);
await standaloneTests.handleRunCoordinateReversibility();
```

**Test:** Verifies `screenToWorld(worldToScreen(p)) === p`

#### `handleRunGridWorkflow()`
Validates CAD QA standards (5 categories).

---

## 🧩 Components

### `TestButton`

Reusable test button with status indicators.

**Import:**
```typescript
import { TestButton } from './tests-modal/components/TestButton';
```

**Props:**
```typescript
interface TestButtonProps {
  test: TestDefinition;
  isRunning: boolean;
  isCompleted: boolean;
  onRun: (testId: string, action: () => Promise<void>) => void;
}
```

| Prop | Type | Description |
|------|------|-------------|
| `test` | `TestDefinition` | Test configuration object |
| `isRunning` | `boolean` | Whether test is currently executing |
| `isCompleted` | `boolean` | Whether test completed successfully |
| `onRun` | `Function` | Callback when test button clicked |

**Example:**
```typescript
<TestButton
  test={{
    id: 'my-test',
    name: '🧪 My Test',
    description: 'Test description',
    action: async () => { /* test logic */ }
  }}
  isRunning={runningTests.has('my-test')}
  isCompleted={completedTests.has('my-test')}
  onRun={handleRunTest}
/>
```

**Visual States:**
- **Running:** 🟡 Yellow background, spinning ⏳ icon
- **Completed:** 🟢 Green background, ✅ CheckCircle icon
- **Idle:** ⚪ Gray background, ▶️ Play icon

---

### `TestTabs`

Tab navigation component.

**Import:**
```typescript
import { TestTabs } from './tests-modal/components/TestTabs';
```

**Props:**
```typescript
interface TestTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}
```

| Prop | Type | Description |
|------|------|-------------|
| `activeTab` | `'automated' \| 'unit' \| 'standalone'` | Currently active tab |
| `onTabChange` | `Function` | Callback when tab changes |

**Example:**
```typescript
<TestTabs
  activeTab="automated"
  onTabChange={(tab) => setActiveTab(tab)}
/>
```

---

### `AutomatedTestsTab`

Automated tests tab content.

**Import:**
```typescript
import { AutomatedTestsTab } from './tests-modal/components/AutomatedTestsTab';
```

**Props:**
```typescript
interface AutomatedTestsTabProps {
  runAllTestsGroup: TestDefinition[];
  individualToolsGroup: TestDefinition[];
  testState: TestState;
  handleRunAllTests: () => Promise<void>;
  handleRunTest: (testId: string, testFunction: () => Promise<void>) => Promise<void>;
}
```

**Example:**
```typescript
<AutomatedTestsTab
  runAllTestsGroup={automatedTests}
  individualToolsGroup={debugTools}
  testState={testState}
  handleRunAllTests={handleRunAllTests}
  handleRunTest={handleRunTest}
/>
```

---

### `UnitTestsTab`

Unit & E2E tests tab content.

**Import:**
```typescript
import { UnitTestsTab } from './tests-modal/components/UnitTestsTab';
```

**Props:**
```typescript
interface UnitTestsTabProps {
  testState: TestState;
  apiTests: ApiTestHandlers;
}
```

**Example:**
```typescript
<UnitTestsTab
  testState={testState}
  apiTests={apiTests}
/>
```

---

### `StandaloneTestsTab`

Standalone tests tab content.

**Import:**
```typescript
import { StandaloneTestsTab } from './tests-modal/components/StandaloneTestsTab';
```

**Props:**
```typescript
interface StandaloneTestsTabProps {
  testState: TestState;
  standaloneTests: StandaloneTestHandlers;
}
```

**Example:**
```typescript
<StandaloneTestsTab
  testState={testState}
  standaloneTests={standaloneTests}
/>
```

---

## 🏭 Factory Functions

### `getAutomatedTests(notify: NotificationFn)`

Returns array of automated test definitions.

**Import:**
```typescript
import { getAutomatedTests } from './tests-modal/constants/automatedTests';
```

**Parameters:**
- `notify: NotificationFn` - Notification callback

**Returns:** `TestDefinition[]` (10 tests)

**Example:**
```typescript
const tests = getAutomatedTests(showCopyableNotification);
// Returns array of 10 test objects
```

**Tests Included:**
1. ✏️ Line Drawing Test
2. 🎯 Canvas Alignment Test
3. 🔄 Layering Workflow Test
4. 🔍 DOM Inspector Test
5. 🏢 Enterprise Cursor Test
6. 📐 Grid Enterprise Test
7. 🎯 Origin Markers Test
8. 📏 Ruler Debug Test
9. 👁️ Canvas Visibility Test
10. ℹ️ System Info Test

---

### `getDebugTools(notify: NotificationFn)`

Returns array of debug tool definitions.

**Import:**
```typescript
import { getDebugTools } from './tests-modal/constants/debugTools';
```

**Parameters:**
- `notify: NotificationFn` - Notification callback

**Returns:** `TestDefinition[]` (5 tools)

**Example:**
```typescript
const tools = getDebugTools(showCopyableNotification);
// Returns array of 5 debug tool objects
```

**Tools Included:**
1. 📐 Toggle Corner Markers
2. 🎯 Toggle Origin (0,0) Markers
3. 📏 Toggle Ruler Debug
4. 🎯 Toggle Cursor-Snap Alignment
5. 🎯 Toggle Live Coordinates

---

## 📝 Type Definitions

### `TabType`
```typescript
type TabType = 'automated' | 'unit' | 'standalone';
```

---

### `NotificationFn`
```typescript
type NotificationFn = (
  message: string,
  type?: 'success' | 'info' | 'warning' | 'error'
) => void;
```

---

### `TestDefinition`
```typescript
interface TestDefinition {
  id: string;              // Unique identifier
  name: string;            // Display name (with emoji)
  description: string;     // Short description
  action: () => Promise<void>; // Test implementation
}
```

---

### `TestState`
```typescript
interface TestState {
  runningTests: Set<string>;
  completedTests: Set<string>;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  startTest: (id: string) => void;
  completeTest: (id: string) => void;
  failTest: (id: string) => void;
}
```

---

### `DraggableState`
```typescript
interface DraggableState {
  position: { x: number; y: number };
  isDragging: boolean;
  modalRef: React.RefObject<HTMLDivElement>;
  handleMouseDown: (e: React.MouseEvent) => void;
}
```

---

### `ApiTestHandlers`
```typescript
interface ApiTestHandlers {
  handleRunVitest: () => Promise<void>;
  handleRunJest: () => Promise<void>;
  handleRunPlaywright: () => Promise<void>;
}
```

---

### `TestExecutionHandlers`
```typescript
interface TestExecutionHandlers {
  handleRunTest: (testId: string, testFunction: () => Promise<void>) => Promise<void>;
  handleRunAllTests: () => Promise<void>;
}
```

---

### `StandaloneTestHandlers`
```typescript
interface StandaloneTestHandlers {
  handleRunCoordinateReversibility: () => Promise<void>;
  handleRunGridWorkflow: () => Promise<void>;
}
```

---

## 🔗 Complete Example

```typescript
import React, { useState } from 'react';
import { TestsModal } from './tests-modal/TestsModal';

function MyApp() {
  const [isTestsOpen, setIsTestsOpen] = useState(false);

  const showNotification = (message: string, type?: string) => {
    // Your notification implementation
    console.log(`[${type || 'info'}] ${message}`);
  };

  return (
    <div>
      <button onClick={() => setIsTestsOpen(true)}>
        Run Tests 🧪
      </button>

      <TestsModal
        isOpen={isTestsOpen}
        onClose={() => setIsTestsOpen(false)}
        showCopyableNotification={showNotification}
      />
    </div>
  );
}
```

---

## 📚 See Also

- [📖 Architecture](./01-ARCHITECTURE.md) - System design
- [📖 Testing Guide](./03-TESTING-GUIDE.md) - How to test
- [📖 Performance](./04-PERFORMANCE.md) - Metrics & benchmarks

---

**Last Updated:** 2025-10-06
**Version:** 2.0.0
