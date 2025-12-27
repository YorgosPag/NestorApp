/**
 * Advanced Usage Example - TestsModal
 *
 * This example demonstrates advanced features:
 * - Custom notification system (toast library)
 * - Keyboard shortcuts (Ctrl+T to open)
 * - Auto-run tests on mount
 * - Test results history
 * - Custom styling
 *
 * Perfect for: Production apps, advanced features, power users
 *
 * NOTE: This is a DOCUMENTATION file, not meant to be compiled.
 * Copy this code to your project and adjust the import path.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { TestsModal } from '../TestsModal'; // Adjust path to: './components/tests-modal/TestsModal'
import { useBorderTokens } from '@/hooks/useBorderTokens'; // Enterprise border system
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors'; // Enterprise semantic colors

// Example: Using react-hot-toast for notifications
// npm install react-hot-toast
import toast, { Toaster } from 'react-hot-toast';
import { INTERACTIVE_PATTERNS, GRADIENT_HOVER_EFFECTS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';

interface TestResult {
  testId: string;
  testName: string;
  status: 'success' | 'error';
  timestamp: Date;
  duration: number;
}

export function AdvancedUsageExample() {
  const { getStatusBorder, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();

  // 1. Modal state
  const [isTestsOpen, setIsTestsOpen] = useState(false);

  // 2. Test results history
  const [testHistory, setTestHistory] = useState<TestResult[]>([]);

  // 3. Custom notification handler with toast library
  const showNotification = useCallback((message: string, type?: 'success' | 'info' | 'warning' | 'error') => {
    const toastOptions = {
      duration: 4000,
      position: 'bottom-right' as const,
    };

    switch (type) {
      case 'success':
        toast.success(message, toastOptions);
        break;
      case 'error':
        toast.error(message, toastOptions);
        break;
      case 'warning':
        toast(message, { icon: '⚠️', ...toastOptions });
        break;
      case 'info':
      default:
        toast(message, { icon: 'ℹ️', ...toastOptions });
        break;
    }

    // Also log to console (debugging)
    console.log(`[${type || 'info'}] ${message}`);

    // Track test results
    if (message.includes('Completed') || message.includes('Failed')) {
      const testId = extractTestId(message);
      const testName = extractTestName(message);
      const status = message.includes('Failed') ? 'error' : 'success';

      setTestHistory(prev => [
        ...prev,
        {
          testId,
          testName,
          status,
          timestamp: new Date(),
          duration: 0 // Could be extracted from message
        }
      ]);
    }
  }, []);

  // 4. Keyboard shortcut: Ctrl+T to open modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 't') {
        e.preventDefault();
        setIsTestsOpen(prev => !prev);
        console.log('🧪 Tests modal toggled via Ctrl+T');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 5. Auto-run tests on mount (optional)
  const [hasAutoRun, setHasAutoRun] = useState(false);
  useEffect(() => {
    const shouldAutoRun = new URLSearchParams(window.location.search).get('autorun') === 'true';

    if (shouldAutoRun && !hasAutoRun) {
      setHasAutoRun(true);
      setIsTestsOpen(true);
      console.log('🚀 Auto-running tests on mount...');
    }
  }, [hasAutoRun]);

  // 6. Clear test history
  const clearHistory = useCallback(() => {
    setTestHistory([]);
    toast.success('Test history cleared!');
  }, []);

  // 7. Export test history as JSON
  const exportHistory = useCallback(() => {
    const json = JSON.stringify(testHistory, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-history-${Date.now()}.json`;
    a.click();
    toast.success('Test history exported!');
  }, [testHistory]);

  return (
    <div className={`min-h-screen ${colors.bg.primary} text-white p-4`}>
      {/* Toast container */}
      <Toaster />

      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2">DXF Viewer - Advanced Testing</h1>
          <p className="text-gray-400">
            Press <kbd className={`px-2 py-1 ${colors.bg.secondary} rounded`}>Ctrl+T</kbd> to toggle tests modal
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Run Tests Button */}
          <button
            onClick={() => setIsTestsOpen(true)}
            className={`p-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg ${GRADIENT_HOVER_EFFECTS.PRIMARY_BUTTON} transition-all`}
          >
            <div className="text-xl mb-1">🧪 Run Tests</div>
            <div className="text-sm text-purple-200">Open testing interface</div>
          </button>

          {/* Test History Stats */}
          <button
            onClick={() => setIsTestsOpen(true)}
            className={`p-4 ${colors.bg.secondary} rounded-lg ${INTERACTIVE_PATTERNS.BUTTON_SECONDARY_HOVER} transition-all`}
          >
            <div className="text-xl mb-1">
              📊 {testHistory.length} Tests Run
            </div>
            <div className="text-sm text-gray-400">
              ✅ {testHistory.filter(t => t.status === 'success').length} passed,{' '}
              ❌ {testHistory.filter(t => t.status === 'error').length} failed
            </div>
          </button>

          {/* Clear History */}
          <button
            onClick={clearHistory}
            disabled={testHistory.length === 0}
            className={`p-4 ${colors.bg.secondary} rounded-lg ${INTERACTIVE_PATTERNS.BUTTON_SECONDARY_HOVER} transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="text-xl mb-1">🗑️ Clear History</div>
            <div className="text-sm text-gray-400">Reset test results</div>
          </button>
        </div>

        {/* Test History Table */}
        {testHistory.length > 0 && (
          <div className={`${colors.bg.secondary} rounded-lg p-4 mb-8`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">📝 Test History</h2>
              <button
                onClick={exportHistory}
                className={`px-3 py-1 bg-purple-600 rounded ${INTERACTIVE_PATTERNS.PURPLE_HOVER} text-sm`}
              >
                📥 Export JSON
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`${getDirectionalBorder('muted', 'bottom')}`}>
                  <tr className="text-left">
                    <th className="pb-2">Test</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {testHistory.slice(-10).reverse().map((result, idx) => (
                    <tr key={idx} className={`${getDirectionalBorder('muted', 'bottom')}`}>
                      <td className="py-2">{result.testName}</td>
                      <td className="py-2">
                        {result.status === 'success' ? (
                          <span className="text-green-500">✅ Passed</span>
                        ) : (
                          <span className="text-red-500">❌ Failed</span>
                        )}
                      </td>
                      <td className="py-2 text-gray-400 text-sm">
                        {result.timestamp.toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`bg-blue-900/20 ${getStatusBorder('info')} rounded-lg p-4`}>
            <div className="text-blue-400 font-bold mb-2">💡 Pro Tip</div>
            <div className="text-sm">
              Use Ctrl+T keyboard shortcut to quickly open/close the tests modal.
              Great for rapid testing during development!
            </div>
          </div>

          <div className={`bg-green-900/20 ${getStatusBorder('success')} rounded-lg p-4`}>
            <div className="text-green-400 font-bold mb-2">🚀 Auto-Run</div>
            <div className="text-sm">
              Add <code className={`px-1 ${colors.bg.secondary} rounded`}>?autorun=true</code> to URL
              to automatically open tests on page load.
            </div>
          </div>
        </div>
      </div>

      {/* Tests Modal */}
      <TestsModal
        isOpen={isTestsOpen}
        onClose={() => setIsTestsOpen(false)}
        showCopyableNotification={showNotification}
      />
    </div>
  );
}

/**
 * Helper Functions
 */

function extractTestId(message: string): string {
  // Extract test ID from notification message
  // Example: "✅ Line Drawing Test Completed!" → "line-drawing"
  return message.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

function extractTestName(message: string): string {
  // Extract test name from notification message
  // Example: "✅ Line Drawing Test Completed!" → "Line Drawing Test"
  const match = message.match(/^[^a-zA-Z]*([a-zA-Z\s]+Test)/);
  return match ? match[1] : 'Unknown Test';
}

/**
 * Advanced Features Explained:
 *
 * 1. **Custom Notification System**
 *    - Uses react-hot-toast for beautiful notifications
 *    - Different icons for success/error/warning/info
 *    - Positioned at bottom-right
 *    - Auto-dismiss after 4 seconds
 *
 * 2. **Keyboard Shortcuts**
 *    - Ctrl+T to toggle tests modal
 *    - Global event listener
 *    - Cleaned up on unmount
 *
 * 3. **Test History Tracking**
 *    - Stores all test results in state
 *    - Shows last 10 results in table
 *    - Tracks success/failure counts
 *    - Export to JSON for analysis
 *
 * 4. **Auto-Run on Mount**
 *    - Check URL parameter ?autorun=true
 *    - Automatically open modal and run tests
 *    - Useful for CI/CD integration
 *
 * 5. **Export Functionality**
 *    - Export test history as JSON file
 *    - Download with timestamp
 *    - Useful for test reporting
 */

/**
 * Production Considerations:
 *
 * 1. **Performance**
 *    - Test history limited to last 100 results (prevent memory leak)
 *    - Use localStorage to persist history across sessions
 *    - Consider IndexedDB for large datasets
 *
 * 2. **Security**
 *    - Sanitize test messages before displaying
 *    - Validate URL parameters
 *    - Rate-limit test execution
 *
 * 3. **Accessibility**
 *    - Add ARIA labels for screen readers
 *    - Keyboard navigation support
 *    - High contrast mode support
 *
 * 4. **Error Handling**
 *    - Catch and log all errors
 *    - Show user-friendly error messages
 *    - Retry failed tests option
 */

/**
 * Integration with CI/CD:
 *
 * Example: Run tests headlessly in CI pipeline
 *
 * ```bash
 * # Open app with autorun flag
 * npx playwright test --headed --timeout=60000 \
 *   --url "http://localhost:3001/dxf/viewer?autorun=true"
 *
 * # Wait for tests to complete
 * # Check test history JSON for results
 * ```
 */
