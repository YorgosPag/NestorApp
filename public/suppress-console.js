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
    'react-dom-client.development.js',  // 🏢 FIX: Missing React 18 client pattern
    'react_devtools_backend',
    'performConcurrentWorkOnRoot',
    'workLoopSync',
    'flushPassiveEffects',
    'flushPendingEffects',              // 🏢 FIX: Additional React 18 pattern
    'flushSyncWorkAcrossRoots',         // 🏢 FIX: Additional React 18 pattern
    'flushSpawnedWork',                 // 🏢 FIX: Additional React 18 pattern
    'beginWork',
    'completeWork',
    'react_stack_bottom_frame',         // 🏢 FIX: React async stack frame
    'runWithFiberInDEV',                // 🏢 FIX: React DEV mode fiber runner
    'commitRoot',                       // 🏢 FIX: React commit phase
    'commitRootWhenReady',              // 🏢 FIX: React commit ready
    'performWorkOnRoot',                // 🏢 FIX: React work scheduler
    'performWorkOnRootViaSchedulerTask',// 🏢 FIX: React scheduler task
    'performWorkUntilDeadline',         // 🏢 FIX: React scheduler deadline
    'initializeElement',                // 🏢 FIX: React element init
    'initializeModelChunk',             // 🏢 FIX: React server component
    'initializeFakeTask',               // 🏢 FIX: React debug task
    'initializeDebugInfo',              // 🏢 FIX: React debug info
    'initializeDebugChunk',             // 🏢 FIX: React debug chunk
    'parseModelString',                 // 🏢 FIX: React model parsing
    'getOutlinedModel',                 // 🏢 FIX: React outlined model
    'resolveModelChunk',                // 🏢 FIX: React model chunk
    'processFullStringRow',             // 🏢 FIX: React string processing
    'processFullBinaryRow',             // 🏢 FIX: React binary processing
    'processBinaryChunk',               // 🏢 FIX: React binary chunk
    'react-server-dom-turbopack',       // 🏢 FIX: React server DOM turbopack
    'scheduler.development.js',         // 🏢 FIX: React scheduler
    'app-bootstrap',                    // 🏢 FIX: Next.js app bootstrap
    'app-next-turbopack',               // 🏢 FIX: Next.js turbopack
    'dev-base.ts',                      // 🏢 FIX: Turbopack dev base
    'runtime-backend-dom',              // 🏢 FIX: Turbopack runtime
    'runtime-utils',                    // 🏢 FIX: Turbopack utils
    'ResponseInstance',                 // 🏢 FIX: React server response
    'createResponseFromOptions',        // 🏢 FIX: React server response create
    'createFromReadableStream',         // 🏢 FIX: React readable stream
    'instantiateModule',                // 🏢 FIX: Module instantiation
    'getOrInstantiateModuleFromParent', // 🏢 FIX: Module parent instantiation
    'getOrInstantiateRuntimeModule',    // 🏢 FIX: Runtime module instantiation
    'registerChunk',                    // 🏢 FIX: Chunk registration
    'commonJsRequire',                  // 🏢 FIX: CommonJS require
    'runModuleExecutionHooks',          // 🏢 FIX: Module execution hooks
    'loadScriptsInSequence',            // 🏢 FIX: Script loading
    'appBootstrap',                     // 🏢 FIX: App bootstrap
    '"use client"',                     // 🏢 FIX: React client directive
    '"use server"',                     // 🏢 FIX: React server directive
    '<RootLayout>'                      // 🏢 FIX: Root layout tag
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

  // ═══ DXF VIEWER VERBOSE DEBUG PATTERNS (2026-01-26) ═══
  // 🏢 ENTERPRISE FIX: Αυτά τα patterns δημιουργούν τεράστιο θόρυβο στην κονσόλα
  // Αφαίρεση για καθαρότερο debugging

  const BLOCKED_DXF_DEBUG_PATTERNS = [
    // Mouse/Click Events - Verbose logging
    '🔍 MOUSE DOWN EVENT',
    '🔍 handleMouseDown',
    '🔍 handleMouseUp check',
    '🖱️ handleCanvasClick CALLED',
    '📍 COORDINATE DEBUG',

    // Drawing System - Verbose logging
    '🚀 AUTO-START CHECK',
    '🚀 CALLING startDrawing',
    '📊 DXFSCENE DEBUG',
    '🔍 UPDATEPREVIEW MULTIPOINT',
    '🔍 PREVIEW ENTITY CREATED',

    // Transform System - Verbose logging
    '⚠️ DXFCANVAS INITIAL TRANSFORM',
    '🔄 TRANSFORM CHANGE',

    // FPS/Performance - Spam logs
    'measureFPS @',
    'requestAnimationFrame',
    '⚠️ Performance Alert [WARNING]: FPS below threshold',

    // Realtime/Session - Verbose logging
    '📤 [RealtimeService] Dispatching',
    '🔐 Session created',
    '🔐 Session revoked',
    '📤 [RealtimeService] Dispatching SESSION',
    '📤 [RealtimeService] Dispatching event:',

    // Fast Refresh - Development noise
    '[Fast Refresh]',

    // StoreSync - Info logs
    '[INFO] [StoreSync]',

    // API verbose success logs (keep errors)
    '🌐 [API] GET',
    '✅ [API] GET',

    // Auth verbose logs
    '⏳ [NavigationContext] Waiting for auth',
    '⏳ [NotificationDrawer] Waiting for auth',
    '🔐 [UserRoleContext] Security service',
    '[ENTERPRISE] [AuthContext] Auth state',
    '[ENTERPRISE] [AuthContext] Session validation',
    '🔐 [AuthContext] Custom claims',
    '🔐 [AuthContext] New session created',
    '✅ [AuthContext] Valid session',
    '🔐 EnterpriseSessionService initialized',
    '🔐 EnterpriseTwoFactorService created',
    '🔔 [RealtimeService] Initialized',
    '🔕 [useRealtimeBuildings] Cleaning',
    '🔕 [useRealtimeUnits] Cleaning',
    '🔔 [useRealtimeBuildings] User authenticated',
    '🔔 [useRealtimeUnits] User authenticated',
    '📡 [useRealtimeBuildings] Received',
    '📡 [useRealtimeUnits] Received',
    '🔐 Admin access granted',
    '🔐 [UserRoleContext] User role determined',
    '🔒 Loaded',

    // Navigation verbose logs
    '🚀 [NavigationContext] Initializing navigation',
    '🚀 [Navigation] Starting bootstrap',
    '✅ [Navigation] Bootstrap loaded',
    '✅ [NavigationContext] Bootstrap complete',

    // Notification verbose logs
    '🔔 [NotificationDrawer] Loading',
    '✅ [NotificationDrawer] User preferences',

    // ProjectHierarchy verbose logs
    '✅ [ProjectHierarchy] Auth ready',
    '🔄 [ProjectHierarchy] Starting to load',
    '✅ [ProjectHierarchy] Companies loaded',

    // WorkspaceContext logs
    '⚠️ [WorkspaceContext] No workspaces',

    // API Contract logs (not errors)
    '⚠️ [API Contract]',

    // Duplicate company warnings (known issue)
    '🏢 Duplicate company by ID found',

    // Auto-optimizations
    '🔍 Auto-optimizations enabled',
    '⚙️ Performance configuration updated',

    // Function call stack traces
    'await in ',
    'console.warn @ suppress-console',
    'console.log @ suppress-console',

    // Enterprise suppression confirmation (noisy)
    '✅ Enterprise console suppression active'
  ];

  // ═══ PERFORMANCE MONITORING NOISE PATTERNS ═══

  const BLOCKED_PERFORMANCE_PATTERNS = [
    'Performance monitoring started',
    'Performance monitoring stopped',
    'monitoring started',
    'monitoring stopped',
    'Memory monitoring started',
    'Memory monitoring stopped',
    'Production monitoring started',
    'Production monitoring stopped',
    'Security monitoring started',
    'Container monitoring started',
    'Container monitoring stopped',
    'Infrastructure monitoring started',
    'Infrastructure monitoring stopped',
    'Pipeline monitoring started',
    'Pipeline monitoring enabled',
    'Automated monitoring started',
    'Automated monitoring stopped',
    'Starting monitoring',
    'Stopping monitoring',
    'Starting container monitoring',
    'Stopping container monitoring',
    'Starting infrastructure monitoring',
    'Stopping infrastructure monitoring',
    'MEMORY LEAK DETECTOR - Starting monitoring',
    'PRODUCTION MONITORING - Starting comprehensive monitoring',
    '📊 Performance monitoring',
    '🛑 Performance monitoring',
    '📊 Security monitoring',
    '📊 Starting container monitoring',
    '📊 Pipeline monitoring',
    '🛑 Stopping',
    '✅ Memory monitoring',
    '✅ Production monitoring',
    '✅ Container monitoring',
    '✅ Infrastructure monitoring',
    '🔍 MEMORY LEAK DETECTOR',
    '🚨 Technical: Automated monitoring',
    '🏢 Professional: Setting up batch real estate monitoring',
    '✅ Professional: Batch monitoring setup completed',
    '📊 Professional: Real estate monitoring dashboard opened'
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

        // Performance monitoring patterns (development + production)
        const hasPerformancePattern = BLOCKED_PERFORMANCE_PATTERNS.some(pattern =>
          arg.includes(pattern)
        );

        // 🏢 FIX (2026-01-26): DXF Viewer debug patterns (development only)
        const hasDxfDebugPattern = isDevelopment &&
          BLOCKED_DXF_DEBUG_PATTERNS.some(pattern => arg.includes(pattern));

        return hasReactPattern || hasProductionPattern || hasPerformancePattern || hasDxfDebugPattern;
      }

      // Check stringified objects
      if (arg && typeof arg === 'object') {
        const str = arg.toString();
        const hasReactPattern = BLOCKED_REACT_PATTERNS.some(pattern => str.includes(pattern));
        const hasPerformancePattern = BLOCKED_PERFORMANCE_PATTERNS.some(pattern => str.includes(pattern));
        // 🏢 FIX (2026-01-26): Also check DXF patterns in objects
        const hasDxfDebugPattern = isDevelopment &&
          BLOCKED_DXF_DEBUG_PATTERNS.some(pattern => str.includes(pattern));
        return hasReactPattern || hasPerformancePattern || hasDxfDebugPattern;
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
        // 🏢 FIX (2026-01-26): Enable/disable DXF debug temporarily
        enableDxfDebug: function() {
          BLOCKED_DXF_DEBUG_PATTERNS.length = 0;
          console.log('🔓 DXF debug patterns ENABLED - verbose logging active');
        },
        patterns: {
          react: BLOCKED_REACT_PATTERNS,
          production: BLOCKED_PRODUCTION_PATTERNS,
          performance: BLOCKED_PERFORMANCE_PATTERNS,
          dxfDebug: BLOCKED_DXF_DEBUG_PATTERNS  // 🏢 FIX (2026-01-26)
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