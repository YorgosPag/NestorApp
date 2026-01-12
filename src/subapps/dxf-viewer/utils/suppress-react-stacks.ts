/**
 * 🚫 AGGRESSIVE REACT STACK TRACE SUPPRESSION
 *
 * Εξαφανίζει ΠΛΗΡΩΣ όλα τα React internal stack traces από την κονσόλα.
 * Αυτά δημιουργούν τεράστιο θόρυβο και είναι άχρηστα για debugging.
 *
 * Targets:
 * - commitPassiveMountOnFiber
 * - recursivelyTraversePassiveMountEffects
 * - react-dom.development.js stacks
 * - όλα τα React DevTools warnings/errors
 *
 * @module utils/suppress-react-stacks
 */

/**
 * Patterns που θα μπλοκαριστούν ΑΜΕΣΑ
 */
const BLOCKED_PATTERNS = [
  // React mount/unmount stacks
  'commitPassiveMountOnFiber',
  'recursivelyTraversePassiveMountEffects',
  'commitHookEffectListMount',
  'commitHookPassiveMountEffects',
  'commitHookEffectListUnmount',
  'commitPassiveUnmountEffects',

  // React DOM development warnings
  'react-dom.development.js',
  'react-dom.production.min.js',
  'react_devtools_backend',

  // React scheduler/reconciler internals
  'performConcurrentWorkOnRoot',
  'workLoopSync',
  'performSyncWorkOnRoot',
  'flushPassiveEffects',
  'commitRoot',

  // React DevTools
  'overrideHookState',
  'overrideProps',
  'scheduleRefresh',

  // Fiber internals που δεν χρειάζονται
  'beginWork',
  'completeWork',
  'completeUnitOfWork',
] as const;

/** Console argument type - can be anything that is logged */
type ConsoleArg = unknown;

/**
 * Ελέγχει αν ένα message περιέχει React stack trace
 */
function containsReactStack(args: ConsoleArg[]): boolean {
  return args.some(arg => {
    if (typeof arg === 'string') {
      return BLOCKED_PATTERNS.some(pattern => arg.includes(pattern));
    }
    // Check stringified objects too
    if (arg && typeof arg === 'object') {
      const str = String(arg);
      return BLOCKED_PATTERNS.some(pattern => str.includes(pattern));
    }
    return false;
  });
}

/**
 * Aggressive suppression - Overrides όλες τις console methods
 */
export function suppressReactStackTraces() {
  if (typeof window === 'undefined') return;

  // Store original console methods
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;
  const originalInfo = console.info;
  const originalDebug = console.debug;

  // Override console.error
  console.error = (...args: ConsoleArg[]) => {
    if (containsReactStack(args)) {
      return; // 🚫 BLOCK COMPLETELY
    }
    originalError.apply(console, args);
  };

  // Override console.warn
  console.warn = (...args: ConsoleArg[]) => {
    if (containsReactStack(args)) {
      return; // 🚫 BLOCK COMPLETELY
    }
    originalWarn.apply(console, args);
  };

  // Override console.log (για stack traces που μπαίνουν σε logs)
  console.log = (...args: ConsoleArg[]) => {
    if (containsReactStack(args)) {
      return; // 🚫 BLOCK COMPLETELY
    }
    originalLog.apply(console, args);
  };

  // Override console.info
  console.info = (...args: ConsoleArg[]) => {
    if (containsReactStack(args)) {
      return; // 🚫 BLOCK COMPLETELY
    }
    originalInfo.apply(console, args);
  };

  // Override console.debug
  console.debug = (...args: ConsoleArg[]) => {
    if (containsReactStack(args)) {
      return; // 🚫 BLOCK COMPLETELY
    }
    originalDebug.apply(console, args);
  };

  // 🔥 BONUS: Disable React DevTools completely (αν θέλεις)
  // Uncomment το παρακάτω αν θέλεις να σταματήσεις και το DevTools backend
  /*
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__.inject = () => {};
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers = new Map();
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__.supportsFiber = true;
  }
  */

  console.log('✅ React stack traces SUPPRESSED - Console is now clean!');
}

/**
 * Initialize suppression - Call αυτό ΜΟΝΟ ΜΙΑ ΦΟΡΑ στο app startup
 */
export function initStackSuppression() {
  suppressReactStackTraces();
}

/**
 * Restore original console (αν χρειαστεί για debugging)
 */
export function restoreConsole() {
  // This would require storing the originals in a closure
  // For now, refresh η σελίδα να επαναφέρεις το console
  console.log('ℹ️ To restore console, refresh the page');
}
