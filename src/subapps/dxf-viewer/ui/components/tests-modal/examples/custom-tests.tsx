/**
 * Custom Tests Example - TestsModal
 *
 * This example demonstrates how to add your own custom tests
 * to the TestsModal system.
 *
 * Perfect for: Adding project-specific tests, extending functionality
 *
 * NOTE: This is a DOCUMENTATION file, not meant to be compiled.
 * Copy this code to your project and adjust the import paths.
 */

import React, { useState } from 'react';
import { TestsModal } from '../../TestsModal'; // Corrected path to TestsModal
import { useBorderTokens } from '@/hooks/useBorderTokens'; // Enterprise border system
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors'; // Enterprise semantic colors
import type { TestDefinition, NotificationFn } from '../types/tests.types'; // Adjust path accordingly
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';

/**
 * Example 1: Simple Custom Test
 *
 * A basic test that validates browser compatibility
 */
export function createBrowserCompatibilityTest(notify: NotificationFn): TestDefinition {
  return {
    id: 'browser-compatibility',
    name: '🌐 Browser Compatibility Check',
    description: 'Validates that the browser supports all required features',
    action: async () => {
      notify('🟢 Running browser compatibility check...', 'info');

      const requiredFeatures = [
        { name: 'WebGL', check: () => !!document.createElement('canvas').getContext('webgl') },
        { name: 'LocalStorage', check: () => typeof localStorage !== 'undefined' },
        { name: 'Fetch API', check: () => typeof fetch !== 'undefined' },
        { name: 'ES6 Modules', check: () => typeof Symbol !== 'undefined' },
        { name: 'CSS Grid', check: () => CSS.supports('display', 'grid') }
      ];

      const results = requiredFeatures.map(feature => ({
        name: feature.name,
        supported: feature.check()
      }));

      const allSupported = results.every(r => r.supported);

      if (allSupported) {
        notify(
          `✅ Browser Compatibility: All features supported!\n${results.map(r => `✅ ${r.name}`).join('\n')}`,
          'success'
        );
      } else {
        const unsupported = results.filter(r => !r.supported);
        notify(
          `❌ Browser Compatibility: Missing features!\n${unsupported.map(r => `❌ ${r.name}`).join('\n')}`,
          'error'
        );
      }
    }
  };
}

/**
 * Example 2: Async Test with API Call
 *
 * A test that validates the backend API is responding
 */
export function createApiHealthCheck(notify: NotificationFn, apiUrl: string): TestDefinition {
  return {
    id: 'api-health-check',
    name: '🏥 API Health Check',
    description: 'Validates that the backend API is online and responding',
    action: async () => {
      notify('🟢 Checking API health...', 'info');

      try {
        const startTime = performance.now();
        const response = await fetch(`${apiUrl}/health`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });

        const duration = performance.now() - startTime;

        if (response.ok) {
          const data = await response.json();
          notify(
            `✅ API Health: OK\n` +
            `📊 Status: ${response.status}\n` +
            `⏱️ Response Time: ${Math.round(duration)}ms\n` +
            `📍 Version: ${data.version || 'unknown'}`,
            'success'
          );
        } else {
          notify(
            `⚠️ API Health: Degraded\n` +
            `📊 Status: ${response.status}\n` +
            `⏱️ Response Time: ${Math.round(duration)}ms`,
            'warning'
          );
        }
      } catch (error) {
        notify(
          `❌ API Health: Offline\n` +
          `⚠️ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'error'
        );
      }
    }
  };
}

/**
 * Example 3: Performance Test
 *
 * A test that measures rendering performance
 */
export function createPerformanceTest(notify: NotificationFn): TestDefinition {
  return {
    id: 'performance-benchmark',
    name: '⚡ Performance Benchmark',
    description: 'Measures canvas rendering performance',
    action: async () => {
      notify('🟢 Running performance benchmark...', 'info');

      const iterations = 1000;
      const results: number[] = [];

      // Simulate canvas operations
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();

        // Simulate expensive operation
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'red';
          ctx.fillRect(0, 0, 100, 100);
        }

        const duration = performance.now() - startTime;
        results.push(duration);
      }

      // Calculate statistics
      const average = results.reduce((a, b) => a + b, 0) / results.length;
      const min = Math.min(...results);
      const max = Math.max(...results);

      const status = average < 1 ? 'success' : average < 5 ? 'warning' : 'error';

      notify(
        `${status === 'success' ? '✅' : status === 'warning' ? '⚠️' : '❌'} Performance Benchmark:\n` +
        `📊 Average: ${average.toFixed(2)}ms\n` +
        `⬇️ Min: ${min.toFixed(2)}ms\n` +
        `⬆️ Max: ${max.toFixed(2)}ms\n` +
        `🔄 Iterations: ${iterations}`,
        status
      );
    }
  };
}

/**
 * Example 4: Data Validation Test
 *
 * A test that validates DXF file structure
 */
export function createDxfValidationTest(
  notify: NotificationFn,
  getDxfData: () => any | null
): TestDefinition {
  return {
    id: 'dxf-validation',
    name: '📐 DXF File Validation',
    description: 'Validates the loaded DXF file structure',
    action: async () => {
      notify('🟢 Validating DXF file...', 'info');

      const dxfData = getDxfData();

      if (!dxfData) {
        notify('❌ DXF Validation: No file loaded!', 'error');
        return;
      }

      const validations = [
        {
          name: 'Has entities',
          check: () => dxfData.entities && dxfData.entities.length > 0
        },
        {
          name: 'Has layers',
          check: () => dxfData.tables && dxfData.tables.layer
        },
        {
          name: 'Has header',
          check: () => dxfData.header && Object.keys(dxfData.header).length > 0
        },
        {
          name: 'Valid entity types',
          check: () => dxfData.entities.every((e: any) => e.type)
        }
      ];

      const results = validations.map(v => ({
        name: v.name,
        passed: v.check()
      }));

      const allPassed = results.every(r => r.passed);

      if (allPassed) {
        notify(
          `✅ DXF Validation: Passed!\n` +
          `📊 Entities: ${dxfData.entities.length}\n` +
          `${results.map(r => `✅ ${r.name}`).join('\n')}`,
          'success'
        );
      } else {
        const failed = results.filter(r => !r.passed);
        notify(
          `❌ DXF Validation: Failed!\n` +
          `${failed.map(r => `❌ ${r.name}`).join('\n')}`,
          'error'
        );
      }
    }
  };
}

/**
 * Example 5: Using Custom Tests in Your App
 */
export function CustomTestsExample() {
  const [isTestsOpen, setIsTestsOpen] = useState(false);
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  const showNotification = (message: string, type?: 'success' | 'info' | 'warning' | 'error') => {
    console.log(`[${type || 'info'}] ${message}`);
  };

  // Mock function to get DXF data (replace with your actual implementation)
  const getDxfData = () => {
    // Return your loaded DXF data
    return {
      entities: [{ type: 'LINE' }, { type: 'CIRCLE' }],
      tables: { layer: {} },
      header: { $ACADVER: 'AC1015' }
    };
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Custom Tests Example</h1>

      <div className="space-y-2 mb-4">
        <p className={colors.text.muted}>
          This example shows how to create custom tests for your specific needs.
        </p>
        <p className={colors.text.muted}>
          Click "Run Tests" to see the custom tests in action.
        </p>
      </div>

      <button
        onClick={() => setIsTestsOpen(true)}
        className={`px-4 py-2 ${colors.bg.purpleButton} ${colors.text.WHITE} rounded-lg transition-colors ${HOVER_BACKGROUND_EFFECTS.PURPLE_BUTTON}`}
      >
        🧪 Run Tests
      </button>

      <TestsModal
        isOpen={isTestsOpen}
        onClose={() => setIsTestsOpen(false)}
        showCopyableNotification={showNotification}
      />

      {/* Info Panel */}
      <div className={`mt-8 ${colors.bg.infoPanel} ${getStatusBorder('info')} rounded-lg p-4`}>
        <div className={`${colors.text.infoAccent} font-bold mb-2`}>💡 How to Add Custom Tests</div>
        <div className="text-sm space-y-2">
          <p>1. Create a factory function that returns a TestDefinition</p>
          <p>2. Add your test to constants/automatedTests.ts</p>
          <p>3. Your test will appear in the Automated Tests tab</p>
        </div>
      </div>
    </div>
  );
}

/**
 * How to Integrate Custom Tests:
 *
 * Method 1: Add to constants/automatedTests.ts
 * -----------------------------------------------
 *
 * // constants/automatedTests.ts
 * export function getAutomatedTests(notify: NotificationFn): TestDefinition[] {
 *   return [
 *     // ... existing tests
 *     createBrowserCompatibilityTest(notify),
 *     createApiHealthCheck(notify, process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'),
 *     createPerformanceTest(notify)
 *   ];
 * }
 *
 *
 * Method 2: Create a separate constants file
 * -------------------------------------------
 *
 * // constants/customTests.ts
 * export function getCustomTests(notify: NotificationFn, getDxfData: () => any): TestDefinition[] {
 *   return [
 *     createBrowserCompatibilityTest(notify),
 *     createApiHealthCheck(notify, process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'),
 *     createPerformanceTest(notify),
 *     createDxfValidationTest(notify, getDxfData)
 *   ];
 * }
 *
 * // Then in TestsModal.tsx
 * const customTests = getCustomTests(showCopyableNotification, getDxfData);
 *
 *
 * Method 3: Pass tests as props
 * ------------------------------
 *
 * // Update TestsModal to accept custom tests
 * interface TestsModalProps {
 *   isOpen: boolean;
 *   onClose: () => void;
 *   showCopyableNotification: NotificationFn;
 *   customTests?: TestDefinition[]; // New optional prop
 * }
 *
 * // Usage
 * <TestsModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   showCopyableNotification={notify}
 *   customTests={[
 *     createBrowserCompatibilityTest(notify),
 *     createApiHealthCheck(notify, process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')
 *   ]}
 * />
 */

/**
 * Test Structure Template:
 *
 * export function createMyCustomTest(notify: NotificationFn, ...dependencies): TestDefinition {
 *   return {
 *     id: 'my-custom-test',           // Unique ID (kebab-case)
 *     name: '🎯 My Custom Test',      // Display name (with emoji)
 *     description: 'What this test does', // Short description
 *     action: async () => {
 *       // 1. Start notification
 *       notify('🟢 Test starting...', 'info');
 *
 *       try {
 *         // 2. Test logic
 *         const result = await runTestLogic();
 *
 *         // 3. Success notification
 *         notify('✅ Test passed!', 'success');
 *       } catch (error) {
 *         // 4. Error notification
 *         notify(`❌ Test failed: ${error.message}`, 'error');
 *       }
 *     }
 *   };
 * }
 */

/**
 * Best Practices:
 *
 * 1. **Always use try-catch** - Handle errors gracefully
 * 2. **Provide detailed feedback** - Include metrics, durations, status
 * 3. **Use emojis** - Makes tests easier to identify visually
 * 4. **Keep tests fast** - Aim for < 2 seconds execution time
 * 5. **Test one thing** - Each test should have a single purpose
 * 6. **Use meaningful IDs** - kebab-case, descriptive
 * 7. **Add descriptions** - Explain what the test validates
 * 8. **Inject dependencies** - Don't use globals, pass via parameters
 */

/**
 * Common Test Patterns:
 *
 * Pattern 1: Validation Test
 * - Check if something exists
 * - Validate data structure
 * - Example: DXF file validation
 *
 * Pattern 2: Performance Test
 * - Measure execution time
 * - Compare against benchmarks
 * - Example: Rendering speed test
 *
 * Pattern 3: Integration Test
 * - Test multiple components together
 * - Validate workflows
 * - Example: Load DXF → Parse → Render
 *
 * Pattern 4: API Test
 * - Call external services
 * - Validate responses
 * - Example: Backend health check
 *
 * Pattern 5: Regression Test
 * - Test for known bugs
 * - Prevent regressions
 * - Example: Zoom-to-cursor accuracy
 */
