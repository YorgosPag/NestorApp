/**
 * 🚫 SUPPRESS REACT STACK TRACES
 *
 * Removes React internal stack traces από το console.
 * Αυτά είναι τα "commitPassiveMountOnFiber" κτλ. που δεν χρειάζονται.
 *
 * @module utils/suppress-react-stacks
 */

/**
 * Suppress React DevTools stack traces
 *
 * Κρύβει τα React internal stack traces που εμφανίζονται στο console
 * όταν κάνουμε console.log/warn/error.
 */
export function suppressReactStackTraces() {
  // Check if suppression is enabled
  if (process.env.REACT_APP_DISABLE_STACK_TRACE !== 'true') {
    return;
  }

  // Override console methods to filter React stacks
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  // Patterns to detect React stack traces
  const REACT_STACK_PATTERNS = [
    'commitPassiveMountOnFiber',
    'recursivelyTraversePassiveMountEffects',
    'commitHookEffectListMount',
    'commitHookPassiveMountEffects',
    'react-dom.development.js',
    'react-dom.production.min.js'
  ];

  // Helper to check if message contains React stack
  const containsReactStack = (args: any[]): boolean => {
    return args.some(arg => {
      if (typeof arg === 'string') {
        return REACT_STACK_PATTERNS.some(pattern => arg.includes(pattern));
      }
      return false;
    });
  };

  // Override console.error
  console.error = (...args: any[]) => {
    if (!containsReactStack(args)) {
      originalConsoleError.apply(console, args);
    }
  };

  // Override console.warn
  console.warn = (...args: any[]) => {
    if (!containsReactStack(args)) {
      originalConsoleWarn.apply(console, args);
    }
  };
}

/**
 * Initialize stack trace suppression
 * Call this ONCE at app startup
 */
export function initStackSuppression() {
  if (typeof window !== 'undefined') {
    suppressReactStackTraces();
  }
}
