# 🧪 DXF SETTINGS PANEL - TESTING STRATEGY

---

**📋 Document Type:** Testing Strategy & Guidelines
**🎯 Scope:** Testing approach for DxfSettingsPanel refactoring
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
| [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md) | State strategy | Understanding data flow |
| **[TESTING_STRATEGY.md](./TESTING_STRATEGY.md)** ⭐ | **Testing approach (THIS)** | **Writing tests** |

**Related Files:**
- Source: [`DxfSettingsPanel.tsx`](../../ui/components/DxfSettingsPanel.tsx) - Original component (to test against)
- Target: [`DxfSettingsPanel.tsx`](../../ui/components/dxf-settings/DxfSettingsPanel.tsx) - New implementation
- Tests: [`__tests__/`](../../ui/components/dxf-settings/__tests__/) - Test suite location

**Related Enterprise Docs:**
- [MASTER_ROADMAP.md](../../docs/MASTER_ROADMAP.md) - Full enterprise roadmap
- Phase A: [Testing Plan](../../docs/MASTER_ROADMAP.md#phase-a-testing)
- Phase B: [Contract Testing](../../docs/testing/CONTRACT_TESTING.md)
- Phase C: [E2E Strategy](../../docs/testing/E2E_STRATEGY.md)

---

## 📖 TABLE OF CONTENTS

1. [Testing Philosophy](#testing-philosophy)
2. [Test Pyramid](#test-pyramid)
3. [Unit Testing](#unit-testing)
4. [Integration Testing](#integration-testing)
5. [Visual Regression Testing](#visual-regression-testing)
6. [Performance Testing](#performance-testing)
7. [Accessibility Testing](#accessibility-testing)
8. [Coverage Targets](#coverage-targets)
9. [Test Infrastructure](#test-infrastructure)
10. [CI/CD Integration](#cicd-integration)

---

## 🎯 TESTING PHILOSOPHY

### Core Principles

**1. Confidence over Coverage**
- 80% coverage with meaningful tests > 100% coverage with shallow tests
- Test behavior, not implementation
- Tests should catch real bugs, not just increase metrics

**2. Test in Isolation**
- Unit tests: Component in isolation (mocked dependencies)
- Integration tests: Components working together (real dependencies)
- E2E tests: Full user flows (real environment)

**3. Fast Feedback Loop**
- Unit tests: <5 seconds for entire suite
- Integration tests: <30 seconds
- Visual regression: <2 minutes

**4. Maintainable Tests**
- DRY (Don't Repeat Yourself) - Use test utilities
- Clear test names - Describe what is being tested
- Arrange-Act-Assert pattern

---

## 📊 TEST PYRAMID

### Pyramid Structure (Phase A - UI Refactoring)

```
                    ▲
                   / \
                  /   \
                 /  E2E \          ← 5% (Critical flows only)
                /  Tests \            ~10 tests
               ───────────
              /           \
             / Integration \       ← 15% (Component interactions)
            /     Tests     \         ~50 tests
           ───────────────────
          /                   \
         /    Unit Tests       \    ← 80% (Component/Hook isolation)
        /                       \      ~200 tests
       ───────────────────────────
```

### Test Distribution

| Test Type | Count | Time | Coverage | Priority |
|-----------|-------|------|----------|----------|
| **Unit** | 200+ | <5s | 80%+ | ⭐⭐⭐ Critical |
| **Integration** | 50+ | <30s | Key flows | ⭐⭐⭐ Critical |
| **Visual Regression** | 15+ | <2m | All tabs/categories | ⭐⭐⭐ Critical |
| **Performance** | 5+ | <1m | Key metrics | ⭐⭐ High |
| **Accessibility** | Auto | <10s | WCAG 2.1 AA | ⭐⭐ High |
| **E2E** | 10+ | <5m | Critical paths | ⭐ Medium |

---

## 🧪 UNIT TESTING

### What to Unit Test

**✅ DO Test:**
- Component rendering (does it render without crashing?)
- User interactions (onClick, onChange handlers)
- State changes (does state update correctly?)
- Props handling (does component respect props?)
- Custom hooks (do they return correct values?)
- Utility functions (pure logic)

**❌ DON'T Test:**
- Implementation details (internal state names)
- Third-party libraries (React, Tailwind)
- CSS styling (use visual regression instead)

---

### Unit Test Examples

#### Example 1: Component Rendering

```typescript
// DxfSettingsPanel.test.tsx
import { render, screen } from '@testing-library/react';
import { DxfSettingsPanel } from './DxfSettingsPanel';

describe('DxfSettingsPanel', () => {
  it('renders without crashing', () => {
    render(<DxfSettingsPanel />);
    expect(screen.getByText('Γενικές Ρυθμίσεις')).toBeInTheDocument();
    expect(screen.getByText('Ειδικές Ρυθμίσεις')).toBeInTheDocument();
  });

  it('renders with default tab "specific"', () => {
    render(<DxfSettingsPanel />);
    const specificButton = screen.getByText('Ειδικές Ρυθμίσεις');
    expect(specificButton).toHaveClass('bg-blue-600'); // Active class
  });

  it('switches to general tab on button click', () => {
    render(<DxfSettingsPanel />);

    const generalButton = screen.getByText('Γενικές Ρυθμίσεις');
    fireEvent.click(generalButton);

    expect(generalButton).toHaveClass('bg-blue-600');
    expect(screen.getByTestId('general-settings-panel')).toBeInTheDocument();
  });
});
```

---

#### Example 2: Custom Hook Testing

```typescript
// useTabNavigation.test.ts
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

  it('isTabActive returns correct boolean', () => {
    const { result } = renderHook(() => useTabNavigation('lines'));

    expect(result.current.isTabActive('lines')).toBe(true);
    expect(result.current.isTabActive('text')).toBe(false);
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

#### Example 3: Settings Persistence

```typescript
// LinesTab.test.tsx
describe('LinesTab Settings Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads settings from localStorage on mount', () => {
    // Arrange: Pre-populate localStorage
    localStorage.setItem(
      'dxf-settings-general-lines',
      JSON.stringify({ color: '#00FF00', width: 1.5 })
    );

    // Act: Render component
    render(<LinesTab />);

    // Assert: Settings loaded
    expect(screen.getByLabelText(/line color/i)).toHaveValue('#00FF00');
    expect(screen.getByLabelText(/line width/i)).toHaveValue(1.5);
  });

  it('saves settings to localStorage on change', async () => {
    // Arrange
    render(<LinesTab />);

    // Act: Change color
    const colorInput = screen.getByLabelText(/line color/i);
    fireEvent.change(colorInput, { target: { value: '#FF0000' } });

    // Assert: Saved to localStorage
    await waitFor(() => {
      const saved = localStorage.getItem('dxf-settings-general-lines');
      const settings = JSON.parse(saved);
      expect(settings.color).toBe('#FF0000');
    });
  });
});
```

---

### Test Utilities

**Create reusable test helpers:**

```typescript
// __tests__/utils/testUtils.tsx
import { render, RenderOptions } from '@testing-library/react';
import { DxfSettingsProvider } from '../../providers/DxfSettingsProvider';

// Wrapper with all providers
const AllProviders = ({ children }) => {
  return (
    <DxfSettingsProvider>
      {children}
    </DxfSettingsProvider>
  );
};

// Custom render with providers
export function renderWithProviders(
  ui: React.ReactElement,
  options?: RenderOptions
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

// Mock localStorage
export function mockLocalStorage() {
  const store = {};

  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => { store[key] = value; }),
    clear: jest.fn(() => { Object.keys(store).forEach(k => delete store[k]); })
  };
}
```

**Usage:**
```typescript
import { renderWithProviders, mockLocalStorage } from './utils/testUtils';

test('component with providers', () => {
  renderWithProviders(<LinesTab />);
  // ...
});
```

---

## 🔗 INTEGRATION TESTING

### What to Integration Test

**✅ DO Test:**
- Navigation flows (tab switching)
- Settings synchronization (General → Specific)
- Provider interactions (state updates across components)
- Lazy loading (components load correctly)

**❌ DON'T Test:**
- Individual components (use unit tests)
- Full user journeys (use E2E tests)

---

### Integration Test Examples

#### Example 1: Tab Switching Flow

```typescript
// GeneralSettingsPanel.integration.test.tsx
describe('GeneralSettingsPanel Tab Switching', () => {
  it('switches tabs and preserves state', async () => {
    // Arrange
    render(<GeneralSettingsPanel />);

    // Act: Change setting in Lines tab
    const colorInput = screen.getByLabelText(/line color/i);
    fireEvent.change(colorInput, { target: { value: '#FF0000' } });

    // Act: Switch to Text tab
    fireEvent.click(screen.getByText('Κείμενο'));
    await waitFor(() => {
      expect(screen.getByTestId('text-tab')).toBeInTheDocument();
    });

    // Act: Switch back to Lines tab
    fireEvent.click(screen.getByText('Γραμμές'));
    await waitFor(() => {
      expect(screen.getByTestId('lines-tab')).toBeInTheDocument();
    });

    // Assert: Color persisted
    expect(screen.getByLabelText(/line color/i)).toHaveValue('#FF0000');
  });
});
```

---

#### Example 2: Lazy Loading Verification

```typescript
// SpecificSettingsPanel.integration.test.tsx
describe('SpecificSettingsPanel Lazy Loading', () => {
  it('lazy loads categories on demand', async () => {
    // Arrange
    render(<SpecificSettingsPanel />);

    // Act: Click Grid category
    fireEvent.click(screen.getByTitle(/Grid & Rulers/i));

    // Assert: GridCategory loaded
    await waitFor(() => {
      expect(screen.getByTestId('grid-category')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Assert: Check Network tab (manual verification)
    // Expected: grid-category.chunk.js loaded
  });

  it('does not load categories until clicked', () => {
    // Arrange
    render(<SpecificSettingsPanel defaultCategory="cursor" />);

    // Assert: Only CursorCategory loaded (not Grid, Entities, etc.)
    expect(screen.getByTestId('cursor-category')).toBeInTheDocument();
    expect(screen.queryByTestId('grid-category')).not.toBeInTheDocument();
    expect(screen.queryByTestId('entities-category')).not.toBeInTheDocument();
  });
});
```

---

## 🎨 VISUAL REGRESSION TESTING

### What to Visual Test

**✅ DO Test:**
- All tabs (General: 3 tabs)
- All categories (Specific: 7 categories)
- All sub-tabs (Grid: 6 sub-tabs, Entities: 10+ sub-tabs)
- Different viewport sizes (1280x800, 1920x1080, 3840x2160)

---

### Visual Regression Setup (Playwright)

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',

  // Ensure deterministic rendering
  use: {
    baseURL: 'http://localhost:3001',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Fixed device pixel ratio for consistent screenshots
    deviceScaleFactor: 1,
  },

  // Test against multiple viewports
  projects: [
    {
      name: 'Desktop HD',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'Desktop Full HD',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
    {
      name: 'Desktop 4K',
      use: { ...devices['Desktop Chrome'], viewport: { width: 3840, height: 2160 } },
    },
  ],

  // Screenshot comparison
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.001, // 0.1% tolerance (CAD standard)
      threshold: 0.2,
    },
  },
});
```

---

### Visual Test Examples

```typescript
// e2e/dxf-settings-visual.spec.ts
import { test, expect } from '@playwright/test';

test.describe('DxfSettings Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dxf/viewer');
    await page.click('text=Ρυθμίσεις DXF');
  });

  test('General Settings - Lines Tab', async ({ page }) => {
    await page.click('text=Γενικές Ρυθμίσεις');
    await page.click('text=Γραμμές');

    // Wait for animations to complete
    await page.waitForTimeout(500);

    // Take screenshot
    await expect(page).toHaveScreenshot('general-lines-tab.png');
  });

  test('General Settings - Text Tab', async ({ page }) => {
    await page.click('text=Γενικές Ρυθμίσεις');
    await page.click('text=Κείμενο');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('general-text-tab.png');
  });

  test('Specific Settings - Grid Category - All Sub-tabs', async ({ page }) => {
    await page.click('text=Ειδικές Ρυθμίσεις');
    await page.click('[title="Grid & Rulers"]');

    // Grid - Major Lines
    await page.click('text=Grid');
    await page.click('text=Major Lines');
    await expect(page).toHaveScreenshot('grid-major-lines.png');

    // Grid - Minor Lines
    await page.click('text=Minor Lines');
    await expect(page).toHaveScreenshot('grid-minor-lines.png');

    // Rulers - Background
    await page.click('text=Rulers');
    await page.click('text=Background');
    await expect(page).toHaveScreenshot('rulers-background.png');

    // ... test all 6 sub-tabs
  });
});
```

---

### Baseline Generation

```bash
# Generate baseline screenshots (first time)
npm run test:visual:update

# Run visual regression tests
npm run test:visual

# View HTML report
npm run test:visual:report
```

---

## ⚡ PERFORMANCE TESTING

### What to Performance Test

**Metrics to Track:**
1. **Initial Load Time** (<3s)
2. **Tab Switch Time** (<150ms)
3. **Settings Update Time** (<100ms)
4. **Bundle Size** (per chunk)
5. **Memory Usage** (no leaks)

---

### Performance Test Examples

```typescript
// __tests__/performance/DxfSettingsPanel.perf.test.tsx
import { render } from '@testing-library/react';
import { DxfSettingsPanel } from '../DxfSettingsPanel';

describe('DxfSettingsPanel Performance', () => {
  it('renders in less than 100ms', () => {
    const start = performance.now();

    render(<DxfSettingsPanel />);

    const end = performance.now();
    const renderTime = end - start;

    expect(renderTime).toBeLessThan(100); // 100ms budget
  });

  it('tab switch completes in less than 150ms', async () => {
    const { rerender } = render(<DxfSettingsPanel />);

    const start = performance.now();

    // Trigger tab switch
    rerender(<DxfSettingsPanel defaultTab="general" />);

    const end = performance.now();
    const switchTime = end - start;

    expect(switchTime).toBeLessThan(150); // 150ms P90 target
  });
});
```

---

### Bundle Size Analysis

```bash
# Analyze bundle size
npm run analyze

# Check size budgets
npm run size-limit

# Expected results:
# - DxfSettingsPanel.js: ~20KB (gzipped)
# - LinesTab.chunk.js: ~30KB (gzipped)
# - GridCategory.chunk.js: ~40KB (gzipped)
# - Total: <200KB (all chunks combined)
```

---

## ♿ ACCESSIBILITY TESTING

### What to A11y Test

**WCAG 2.1 AA Compliance:**
- ✅ Keyboard navigation
- ✅ Screen reader support
- ✅ Color contrast (4.5:1 for text)
- ✅ Focus indicators
- ✅ ARIA labels

---

### A11y Test Examples

```typescript
// __tests__/a11y/DxfSettingsPanel.a11y.test.tsx
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('DxfSettingsPanel Accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(<DxfSettingsPanel />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });

  it('supports keyboard navigation', () => {
    render(<DxfSettingsPanel />);

    const generalButton = screen.getByText('Γενικές Ρυθμίσεις');
    generalButton.focus();

    expect(generalButton).toHaveFocus();

    // Tab to next button
    userEvent.tab();
    expect(screen.getByText('Ειδικές Ρυθμίσεις')).toHaveFocus();
  });

  it('has sufficient color contrast', async () => {
    const { container } = render(<DxfSettingsPanel />);
    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: true } }
    });

    expect(results).toHaveNoViolations();
  });
});
```

---

## 📊 COVERAGE TARGETS

### Coverage by Component Type

| Component Type | Unit Coverage | Integration Coverage | Overall Target |
|----------------|---------------|----------------------|----------------|
| **Root** (DxfSettingsPanel) | 90%+ | 95%+ | 90%+ |
| **Panels** | 85%+ | 90%+ | 85%+ |
| **Tabs** | 80%+ | 75%+ | 80%+ |
| **Categories** | 75%+ | 70%+ | 75%+ |
| **Settings** | 70%+ | N/A | 70%+ |
| **Shared** | 90%+ | N/A | 90%+ |
| **Hooks** | 95%+ | N/A | 95%+ |

### Overall Coverage Target: **80%+**

---

### Coverage Commands

```bash
# Run tests with coverage
npm run test:coverage

# Generate HTML report
npm run test:coverage:html

# Open report
open coverage/index.html

# Coverage thresholds (in package.json)
{
  "jest": {
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

---

## 🛠️ TEST INFRASTRUCTURE

### Test Stack

| Tool | Purpose | Version |
|------|---------|---------|
| **Jest** | Test runner | ^29.0.0 |
| **React Testing Library** | Component testing | ^14.0.0 |
| **Playwright** | Visual regression + E2E | ^1.40.0 |
| **jest-axe** | Accessibility testing | ^8.0.0 |
| **MSW** | API mocking | ^2.0.0 |

---

### Test File Structure

```
src/subapps/dxf-viewer/
├── ui/components/dxf-settings/
│   ├── DxfSettingsPanel.tsx
│   ├── __tests__/
│   │   ├── unit/
│   │   │   ├── DxfSettingsPanel.test.tsx
│   │   │   ├── GeneralSettingsPanel.test.tsx
│   │   │   ├── LinesTab.test.tsx
│   │   │   └── ... (all components)
│   │   ├── integration/
│   │   │   ├── GeneralSettings.integration.test.tsx
│   │   │   ├── SpecificSettings.integration.test.tsx
│   │   │   └── LazyLoading.integration.test.tsx
│   │   ├── a11y/
│   │   │   └── DxfSettings.a11y.test.tsx
│   │   └── utils/
│   │       ├── testUtils.tsx
│   │       └── mockData.ts
│   └── hooks/
│       ├── useTabNavigation.ts
│       └── __tests__/
│           └── useTabNavigation.test.ts
│
└── e2e/
    ├── dxf-settings-visual.spec.ts
    ├── dxf-settings-e2e.spec.ts
    └── screenshots/
        ├── baseline/
        └── actual/
```

---

## 🚀 CI/CD INTEGRATION

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test DxfSettings

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      - name: Install dependencies
        run: npm ci

      - name: Run integration tests
        run: npm run test:integration

  visual-regression:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run visual tests
        run: npm run test:visual

      - name: Upload screenshots
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: visual-diff
          path: e2e/screenshots/
```

---

### Pre-commit Hook

```bash
# .husky/pre-commit
#!/bin/sh
npm run test:unit -- --bail --findRelatedTests
npm run lint
```

---

## 📚 REFERENCES

### Internal Documentation
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [COMPONENT_GUIDE.md](./COMPONENT_GUIDE.md) - Component details
- [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md) - State strategy
- [DECISION_LOG.md](./DECISION_LOG.md) - Design decisions

### External Resources
- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright](https://playwright.dev/)
- [jest-axe](https://github.com/nickcolley/jest-axe)
- [Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)

### Related Enterprise Docs
- [Phase B: Contract Testing](../../docs/testing/CONTRACT_TESTING.md)
- [Phase C: E2E Strategy](../../docs/testing/E2E_STRATEGY.md)
- [Performance Testing](../../docs/testing/PERFORMANCE_TESTING.md)

---

## 📝 CHANGELOG

| Date | Author | Changes |
|------|--------|---------|
| 2025-10-07 | Claude | Initial testing strategy (Phase A - UI Refactoring) |

---

**END OF TESTING STRATEGY DOCUMENT**
