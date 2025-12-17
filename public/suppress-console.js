/**
 * 🏢 ENTERPRISE CONSOLE SUPPRESSION SYSTEM
 *
 * Παγκόσμια καταστολή console noise για production-ready εφαρμογές.
 * Ενσωματώνει τα υπάρχοντα enterprise συστήματα:
 * - UnifiedDebugManager (NODE_ENV-based)
 * - suppress-react-stacks (React internals filtering)
 * - OptimizedLogger (emergency silence)
 *
 * @enterprise-grade SINGLE SOURCE OF TRUTH για console management
 * @security ZERO console leakage σε production
 * @performance Minimal overhead, intelligent filtering
 */

(function() {
  'use strict';

  // ═══ ENTERPRISE ENVIRONMENT DETECTION ═══

  const isProduction = typeof window !== 'undefined' &&
    (window.location.hostname !== 'localhost' &&
     window.location.hostname !== '127.0.0.1' &&
     !window.location.hostname.includes('vercel.app'));

  const isDevelopment = !isProduction;

  // ═══ REACT STACK PATTERNS (από suppress-react-stacks.ts) ═══

  const BLOCKED_REACT_PATTERNS = [
    'commitPassiveMountOnFiber',
    'recursivelyTraversePassiveMountEffects',
    'commitHookEffectListMount',
    'commitHookPassiveMountEffects',
    'react-dom.development.js',
    'react_devtools_backend',
    'performConcurrentWorkOnRoot',
    'workLoopSync',
    'flushPassiveEffects',
    'beginWork',
    'completeWork'
  ];

  // ═══ PRODUCTION NOISE PATTERNS ═══

  const BLOCKED_PRODUCTION_PATTERNS = [
    'Warning: ',
    'Download the React DevTools',
    'ReactDOM.render is no longer supported',
    'Warning: ReactDOM.render',
    'Warning: componentWill',
    'Warning: Failed prop type',
    'console.warn @ react-dom',
    'Warning: Each child in a list'
  ];

  // ═══ INTELLIGENT PATTERN DETECTION ═══

  function containsBlockedPattern(args) {
    return args.some(arg => {
      if (typeof arg === 'string') {
        // React patterns (development + production)
        const hasReactPattern = BLOCKED_REACT_PATTERNS.some(pattern =>
          arg.includes(pattern)
        );

        // Production-specific patterns
        const hasProductionPattern = isProduction &&
          BLOCKED_PRODUCTION_PATTERNS.some(pattern => arg.includes(pattern));

        return hasReactPattern || hasProductionPattern;
      }

      // Check stringified objects
      if (arg && typeof arg === 'object') {
        const str = arg.toString();
        return BLOCKED_REACT_PATTERNS.some(pattern => str.includes(pattern));
      }

      return false;
    });
  }

  // ═══ ENTERPRISE CONSOLE OVERRIDE SYSTEM ═══

  function initializeEnterpriseConsole() {
    // Store originals για potential restore
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.debug
    };

    // ✅ PRODUCTION: Complete suppression
    if (isProduction) {
      console.log = function() {};
      console.warn = function() {};
      console.info = function() {};
      console.debug = function() {};

      // Errors μόνο για critical issues
      console.error = function(...args) {
        // Allow μόνο genuine errors, not React warnings
        const hasRealError = args.some(arg =>
          arg instanceof Error ||
          (typeof arg === 'string' && arg.toLowerCase().includes('error'))
        );

        if (hasRealError && !containsBlockedPattern(args)) {
          originalConsole.error.apply(console, args);
        }
      };

      return;
    }

    // ✅ DEVELOPMENT: Intelligent filtering
    console.log = function(...args) {
      if (!containsBlockedPattern(args)) {
        originalConsole.log.apply(console, args);
      }
    };

    console.warn = function(...args) {
      if (!containsBlockedPattern(args)) {
        originalConsole.warn.apply(console, args);
      }
    };

    console.error = function(...args) {
      if (!containsBlockedPattern(args)) {
        originalConsole.error.apply(console, args);
      }
    };

    console.info = function(...args) {
      if (!containsBlockedPattern(args)) {
        originalConsole.info.apply(console, args);
      }
    };

    console.debug = function(...args) {
      if (!containsBlockedPattern(args)) {
        originalConsole.debug.apply(console, args);
      }
    };

    // ✅ Store originals for debugging access
    if (isDevelopment) {
      window.__ENTERPRISE_CONSOLE__ = {
        original: originalConsole,
        restore: function() {
          Object.assign(console, originalConsole);
          console.log('🔄 Console restored to original state');
        },
        patterns: {
          react: BLOCKED_REACT_PATTERNS,
          production: BLOCKED_PRODUCTION_PATTERNS
        }
      };
    }
  }

  // ═══ REACT DEVTOOLS SUPPRESSION (από suppress-react-stacks.ts) ═══

  function suppressReactDevTools() {
    if (typeof window !== 'undefined' && window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      // Disable DevTools warnings σε production
      if (isProduction) {
        window.__REACT_DEVTOOLS_GLOBAL_HOOK__.inject = function() {};
        window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers = new Map();
        window.__REACT_DEVTOOLS_GLOBAL_HOOK__.supportsFiber = true;
      }
    }
  }

  // ═══ CANVAS ARC PATCHING (από layout.tsx) ═══

  function patchCanvasArc() {
    if (typeof window !== 'undefined' && !window.__ARC_PATCHED__) {
      window.__ARC_PATCHED__ = true;
      const proto = CanvasRenderingContext2D.prototype;
      const origArc = proto.arc;

      proto.arc = function patchedArc(x, y, r, s, e, ccw) {
        // Kill-switch: σχολίασέ το για να ΞΑΝΑΦΑΝΕΙ ο κύκλος
        // Ενεργό => ΔΕΝ ζωγραφίζονται καθόλου κύκλοι
        return; // προσωρινό hard stop

        // Αν θέλεις να επαναφέρεις το default συμπεριφορά:
        // return origArc.apply(this, arguments);
      };
    }
  }

  // ═══ ENTERPRISE INITIALIZATION SEQUENCE ═══

  function initializeEnterpriseSuppression() {
    try {
      // 1. Console suppression (πρώτα για να μην έχουμε noise κατά την initialization)
      initializeEnterpriseConsole();

      // 2. React DevTools suppression
      suppressReactDevTools();

      // 3. Canvas Arc patching
      patchCanvasArc();

      // ✅ Success notification (μόνο σε development)
      if (isDevelopment) {
        setTimeout(() => {
          console.log('✅ Enterprise console suppression active (DEV mode - intelligent filtering)');
        }, 100);
      }

    } catch (error) {
      // Fallback: Basic suppression αν κάτι πάει στραβά
      if (isProduction) {
        console.log = console.warn = console.info = console.debug = function() {};
      }
    }
  }

  // ═══ IMMEDIATE EXECUTION ═══

  // Execute αμέσως για beforeInteractive timing
  initializeEnterpriseSuppression();

  // ✅ Backup execution on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEnterpriseSuppression);
  } else {
    // Document already loaded
    setTimeout(initializeEnterpriseSuppression, 0);
  }

})();