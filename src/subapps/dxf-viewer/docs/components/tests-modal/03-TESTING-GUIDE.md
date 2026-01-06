# 🧪 TestsModal - Testing Guide

**How to Write, Run & Test the TestsModal System**

---

## 📊 Overview

TestsModal is designed to be **highly testable** due to its modular architecture. Each component, hook, and function can be tested in isolation.

---

## 🎯 Testing Strategy

### Test Pyramid

```
           /\
          /  \         E2E Tests (Playwright)
         /____\        - Full user workflows
        /      \       - Cross-browser testing
       /        \
      /__________\     Integration Tests (Jest/Vitest)
     /            \    - Component interactions
    /              \   - Hook integrations
   /________________\
  /                  \ Unit Tests (Vitest/Jest)
 /____________________\ - Individual functions
                        - Pure logic testing
```

---

## 🔧 Setup

### Install Dependencies

```bash
# Unit testing (Vitest)
npm install --save-dev vitest @testing-library/react @testing-library/react-hooks

# E2E testing (Playwright)
npm install --save-dev @playwright/test
npx playwright install
```

### Configuration

**vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

**playwright.config.ts:**
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3001',
  },
});
```

---

## ✅ Unit Testing

### Testing Custom Hooks

#### Example: `useTestState.test.ts`

```typescript
import { renderHook, act } from '@testing-library/react';
import { useTestState } from '../hooks/useTestState';

describe('useTestState', () => {
  it('should initialize with empty sets', () => {
    const { result } = renderHook(() => useTestState());

    expect(result.current.runningTests.size).toBe(0);
    expect(result.current.completedTests.size).toBe(0);
    expect(result.current.activeTab).toBe('automated');
  });

  it('should start a test', () => {
    const { result } = renderHook(() => useTestState());

    act(() => {
      result.current.startTest('test-1');
    });

    expect(result.current.runningTests.has('test-1')).toBe(true);
  });

  it('should complete a test', () => {
    const { result } = renderHook(() => useTestState());

    act(() => {
      result.current.startTest('test-1');
      result.current.completeTest('test-1');
    });

    expect(result.current.runningTests.has('test-1')).toBe(false);
    expect(result.current.completedTests.has('test-1')).toBe(true);
  });

  it('should fail a test', () => {
    const { result } = renderHook(() => useTestState());

    act(() => {
      result.current.startTest('test-1');
      result.current.failTest('test-1');
    });

    expect(result.current.runningTests.has('test-1')).toBe(false);
    expect(result.current.completedTests.has('test-1')).toBe(false);
  });

  it('should change active tab', () => {
    const { result } = renderHook(() => useTestState());

    act(() => {
      result.current.setActiveTab('unit');
    });

    expect(result.current.activeTab).toBe('unit');
  });
});
```

---

### Testing Components

#### Example: `TestButton.test.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { TestButton } from '../components/TestButton';

describe('TestButton', () => {
  const mockTest = {
    id: 'test-1',
    name: '🧪 Test 1',
    description: 'Test description',
    action: jest.fn(),
  };

  const mockOnRun = jest.fn();

  it('should render test name and description', () => {
    render(
      <TestButton
        test={mockTest}
        isRunning={false}
        isCompleted={false}
        onRun={mockOnRun}
      />
    );

    expect(screen.getByText('🧪 Test 1')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('should call onRun when clicked', () => {
    render(
      <TestButton
        test={mockTest}
        isRunning={false}
        isCompleted={false}
        onRun={mockOnRun}
      />
    );

    fireEvent.click(screen.getByRole('button'));

    expect(mockOnRun).toHaveBeenCalledWith('test-1', mockTest.action);
  });

  it('should be disabled when running', () => {
    render(
      <TestButton
        test={mockTest}
        isRunning={true}
        isCompleted={false}
        onRun={mockOnRun}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should show running indicator', () => {
    render(
      <TestButton
        test={mockTest}
        isRunning={true}
        isCompleted={false}
        onRun={mockOnRun}
      />
    );

    expect(screen.getByText('⏳')).toBeInTheDocument();
  });

  it('should show completed indicator', () => {
    render(
      <TestButton
        test={mockTest}
        isRunning={false}
        isCompleted={true}
        onRun={mockOnRun}
      />
    );

    // CheckCircle icon should be present
    expect(screen.getByRole('button')).toHaveClass('bg-green-500/10');
  });
});
```

---

### Testing Factory Functions

#### Example: `automatedTests.test.ts`

```typescript
import { getAutomatedTests } from '../constants/automatedTests';

describe('getAutomatedTests', () => {
  const mockNotify = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 10 tests', () => {
    const tests = getAutomatedTests(mockNotify);
    expect(tests).toHaveLength(10);
  });

  it('should have unique test IDs', () => {
    const tests = getAutomatedTests(mockNotify);
    const ids = tests.map(t => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(tests.length);
  });

  it('should call notify when test action executed', async () => {
    const tests = getAutomatedTests(mockNotify);
    const systemInfoTest = tests.find(t => t.id === 'system-info');

    await systemInfoTest?.action();

    expect(mockNotify).toHaveBeenCalled();
  });
});
```

---

## 🔗 Integration Testing

### Testing Component Interactions

#### Example: `AutomatedTestsTab.test.tsx`

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AutomatedTestsTab } from '../components/AutomatedTestsTab';

describe('AutomatedTestsTab', () => {
  const mockTestState = {
    runningTests: new Set(),
    completedTests: new Set(),
    activeTab: 'automated' as const,
    setActiveTab: jest.fn(),
    startTest: jest.fn(),
    completeTest: jest.fn(),
    failTest: jest.fn(),
  };

  const mockTests = [
    {
      id: 'test-1',
      name: 'Test 1',
      description: 'Desc 1',
      action: jest.fn().mockResolvedValue(undefined),
    },
  ];

  const mockHandleRunTest = jest.fn();
  const mockHandleRunAllTests = jest.fn();

  it('should render all test buttons', () => {
    render(
      <AutomatedTestsTab
        runAllTestsGroup={mockTests}
        individualToolsGroup={[]}
        testState={mockTestState}
        handleRunAllTests={mockHandleRunAllTests}
        handleRunTest={mockHandleRunTest}
      />
    );

    expect(screen.getByText('Test 1')).toBeInTheDocument();
  });

  it('should call handleRunAllTests when clicking Run All', () => {
    render(
      <AutomatedTestsTab
        runAllTestsGroup={mockTests}
        individualToolsGroup={[]}
        testState={mockTestState}
        handleRunAllTests={mockHandleRunAllTests}
        handleRunTest={mockHandleRunTest}
      />
    );

    fireEvent.click(screen.getByText(/Run All Automated Tests/));

    expect(mockHandleRunAllTests).toHaveBeenCalled();
  });

  it('should pass test to handleRunTest when clicking individual test', () => {
    render(
      <AutomatedTestsTab
        runAllTestsGroup={mockTests}
        individualToolsGroup={[]}
        testState={mockTestState}
        handleRunAllTests={mockHandleRunAllTests}
        handleRunTest={mockHandleRunTest}
      />
    );

    fireEvent.click(screen.getByText('Test 1'));

    expect(mockHandleRunTest).toHaveBeenCalledWith('test-1', expect.any(Function));
  });
});
```

---

## 🎭 E2E Testing (Playwright)

### Full User Workflow Test

#### Example: `testsModal.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('TestsModal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dxf/viewer');
  });

  test('should open modal when clicking Run Tests button', async ({ page }) => {
    // Click "Run Tests" button in toolbar
    await page.click('[data-testid="run-tests-button"]');

    // Modal should be visible
    await expect(page.locator('text=DXF Viewer Tests')).toBeVisible();
  });

  test('should switch tabs correctly', async ({ page }) => {
    await page.click('[data-testid="run-tests-button"]');

    // Click "Unit & E2E Tests" tab
    await page.click('text=🧪 Unit & E2E Tests');

    // Should show Vitest button
    await expect(page.locator('text=Run Vitest Tests')).toBeVisible();
  });

  test('should run a single test', async ({ page }) => {
    await page.click('[data-testid="run-tests-button"]');

    // Click "System Info Test"
    await page.click('text=ℹ️ System Info Test');

    // Should show running indicator
    await expect(page.locator('text=⏳')).toBeVisible();

    // Wait for completion
    await page.waitForSelector('.bg-green-500\\/10', { timeout: 5000 });

    // Should show completed indicator
    const completedButton = page.locator('text=ℹ️ System Info Test').locator('..');
    await expect(completedButton).toHaveClass(/bg-green-500/);
  });

  test('should drag modal to new position', async ({ page }) => {
    await page.click('[data-testid="run-tests-button"]');

    const modal = page.locator('text=DXF Viewer Tests').locator('..');

    // Get initial position
    const initialBox = await modal.boundingBox();

    // Drag modal
    await modal.dragTo(page.locator('body'), {
      targetPosition: { x: 100, y: 100 },
    });

    // Get new position
    const newBox = await modal.boundingBox();

    // Position should have changed
    expect(newBox?.x).not.toBe(initialBox?.x);
    expect(newBox?.y).not.toBe(initialBox?.y);
  });

  test('should close modal when clicking X button', async ({ page }) => {
    await page.click('[data-testid="run-tests-button"]');

    // Modal should be visible
    await expect(page.locator('text=DXF Viewer Tests')).toBeVisible();

    // Click close button
    await page.click('[aria-label="Close modal"]');

    // Modal should be hidden
    await expect(page.locator('text=DXF Viewer Tests')).not.toBeVisible();
  });
});
```

---

## 📊 Coverage

### Running Coverage Reports

```bash
# Unit test coverage
npm run test:coverage

# View HTML report
open coverage/index.html
```

### Target Coverage

| Metric | Target | Current |
|--------|--------|---------|
| **Statements** | > 80% | TBD |
| **Branches** | > 75% | TBD |
| **Functions** | > 80% | TBD |
| **Lines** | > 80% | TBD |

---

## 🎯 Best Practices

### 1. Test File Naming

```
src/
├── hooks/
│   ├── useTestState.ts
│   └── useTestState.test.ts      ✅ Co-located
├── components/
│   ├── TestButton.tsx
│   └── TestButton.test.tsx        ✅ Co-located
```

### 2. Test Organization

```typescript
describe('ComponentName', () => {
  describe('when prop X is true', () => {
    it('should render Y', () => {
      // Test implementation
    });
  });

  describe('when user clicks button', () => {
    it('should call callback', () => {
      // Test implementation
    });
  });
});
```

### 3. Mock External Dependencies

```typescript
// Mock notification function
const mockNotify = jest.fn();

// Mock fetch API
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true }),
  })
);
```

### 4. Test One Thing at a Time

```typescript
// ❌ Bad: Testing multiple things
it('should render and handle click', () => {
  render(<Button />);
  expect(screen.getByText('Click')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Click'));
  expect(mockCallback).toHaveBeenCalled();
});

// ✅ Good: Separate tests
it('should render button text', () => {
  render(<Button />);
  expect(screen.getByText('Click')).toBeInTheDocument();
});

it('should call callback when clicked', () => {
  render(<Button />);
  fireEvent.click(screen.getByText('Click'));
  expect(mockCallback).toHaveBeenCalled();
});
```

---

## 🚀 Running Tests

### Unit Tests

```bash
# Run all tests
npm run test

# Run specific file
npm run test useTestState.test.ts

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

### E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run in headed mode (see browser)
npm run test:e2e:headed

# Run specific browser
npm run test:e2e -- --project=chromium
```

---

## 🐛 Debugging Tests

### Debug Unit Tests

```bash
# Run with Node debugger
node --inspect-brk node_modules/.bin/vitest run
```

### Debug E2E Tests

```typescript
// Add page.pause() to stop execution
test('my test', async ({ page }) => {
  await page.goto('/dxf/viewer');
  await page.pause(); // Opens inspector
  await page.click('button');
});
```

---

## 📚 See Also

- [📖 Architecture](./01-ARCHITECTURE.md) - System design
- [📖 API Reference](./02-API-REFERENCE.md) - API docs
- [📖 Performance](./04-PERFORMANCE.md) - Performance metrics

---

**Last Updated:** 2025-10-06
**Version:** 2.0.0
