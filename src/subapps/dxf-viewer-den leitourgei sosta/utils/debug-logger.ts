/**
 * 🐛 DEBUG LOGGER - Centralized Debug Logging με Environment Control
 *
 * Αντικαθιστά console.log με conditional logging που μπορεί να ενεργοποιηθεί/απενεργοποιηθεί.
 *
 * @module utils/debug-logger
 *
 * @example
 * ```typescript
 * import { debugLog } from '@/utils/debug-logger';
 *
 * // Basic usage
 * debugLog('CanvasSection', 'Rendering canvas', { width: 800, height: 600 });
 *
 * // With emoji prefix
 * debugLog('DxfCanvas', '🎨 Rendering scene', scene);
 *
 * // Error logging (always shows)
 * debugLog.error('TransformContext', 'Transform failed', error);
 * ```
 *
 * @control
 * - **Development**: Set `NEXT_PUBLIC_DEBUG=true` στο `.env.local`
 * - **Production**: Set `NEXT_PUBLIC_DEBUG=false` ή remove το variable
 * - **Per-Component**: Set `NEXT_PUBLIC_DEBUG_COMPONENTS=CanvasSection,DxfCanvas`
 */

// 🎯 DEBUG CONFIGURATION
const IS_DEBUG_ENABLED = process.env.NEXT_PUBLIC_DEBUG === 'true';
const DEBUG_COMPONENTS = process.env.NEXT_PUBLIC_DEBUG_COMPONENTS?.split(',').map(c => c.trim()) || [];
const DEBUG_ALL = IS_DEBUG_ENABLED && DEBUG_COMPONENTS.length === 0;

/**
 * 🎨 LOG LEVEL COLORS (για console styling)
 */
const LOG_COLORS = {
  info: 'color: #2196F3', // Blue
  success: 'color: #4CAF50', // Green
  warning: 'color: #FF9800', // Orange
  error: 'color: #F44336', // Red
  debug: 'color: #9E9E9E' // Gray
} as const;

/**
 * 🐛 DEBUG LOG - Main logging function
 *
 * @param {string} component - Component name (e.g., 'CanvasSection', 'DxfCanvas')
 * @param {string} message - Log message
 * @param {any} data - Optional data to log
 * @param {keyof typeof LOG_COLORS} level - Log level (default: 'debug')
 */
export function debugLog(
  component: string,
  message: string,
  data?: any,
  level: keyof typeof LOG_COLORS = 'debug'
): void {
  // Check if logging is enabled για αυτό το component
  const isComponentEnabled = DEBUG_ALL || DEBUG_COMPONENTS.includes(component);

  if (!isComponentEnabled && level !== 'error') {
    return; // Skip logging
  }

  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  const prefix = `[${timestamp}] [${component}]`;

  // Console styling
  const style = LOG_COLORS[level];

  if (data !== undefined) {
    console.log(`%c${prefix} ${message}`, style, data);
  } else {
    console.log(`%c${prefix} ${message}`, style);
  }
}

/**
 * 🎨 Convenience methods για different log levels
 */
debugLog.info = (component: string, message: string, data?: any) => {
  debugLog(component, message, data, 'info');
};

debugLog.success = (component: string, message: string, data?: any) => {
  debugLog(component, message, data, 'success');
};

debugLog.warning = (component: string, message: string, data?: any) => {
  debugLog(component, message, data, 'warning');
};

debugLog.error = (component: string, message: string, data?: any) => {
  debugLog(component, message, data, 'error');
};

/**
 * 🔍 DEBUG GROUP - Grouped logging
 *
 * @example
 * ```typescript
 * debugLog.group('CanvasSection', 'Rendering State', () => {
 *   debugLog('CanvasSection', 'Width', 800);
 *   debugLog('CanvasSection', 'Height', 600);
 * });
 * ```
 */
debugLog.group = (component: string, title: string, fn: () => void) => {
  const isComponentEnabled = DEBUG_ALL || DEBUG_COMPONENTS.includes(component);

  if (!isComponentEnabled) {
    return;
  }

  console.group(`[${component}] ${title}`);
  fn();
  console.groupEnd();
};

/**
 * 📊 DEBUG TABLE - Table logging
 *
 * @example
 * ```typescript
 * debugLog.table('CanvasSection', 'Entities', entities);
 * ```
 */
debugLog.table = (component: string, title: string, data: any[]) => {
  const isComponentEnabled = DEBUG_ALL || DEBUG_COMPONENTS.includes(component);

  if (!isComponentEnabled) {
    return;
  }

  console.log(`[${component}] ${title}:`);
  console.table(data);
};

/**
 * ⏱️ DEBUG TIMER - Performance timing
 *
 * @example
 * ```typescript
 * const timer = debugLog.timer('CanvasSection', 'Render');
 * // ... do work ...
 * timer.end(); // Logs: [CanvasSection] Render: 45.23ms
 * ```
 */
debugLog.timer = (component: string, label: string) => {
  const isComponentEnabled = DEBUG_ALL || DEBUG_COMPONENTS.includes(component);

  if (!isComponentEnabled) {
    return {
      end: () => {} // No-op
    };
  }

  const startTime = performance.now();

  return {
    end: () => {
      const duration = performance.now() - startTime;
      debugLog.info(component, `${label}: ${duration.toFixed(2)}ms`);
    }
  };
};

/**
 * 🔧 DEBUG STATUS - Check if debug is enabled
 */
debugLog.isEnabled = (component?: string): boolean => {
  if (component) {
    return DEBUG_ALL || DEBUG_COMPONENTS.includes(component);
  }
  return IS_DEBUG_ENABLED;
};

/**
 * 📋 DEBUG CONFIG - Get current debug configuration
 */
debugLog.getConfig = () => ({
  enabled: IS_DEBUG_ENABLED,
  all: DEBUG_ALL,
  components: DEBUG_COMPONENTS
});

/**
 * 🚨 ALWAYS LOG - Για critical messages που πρέπει να φαίνονται ΠΑΝΤΑ
 *
 * @example
 * ```typescript
 * debugLog.always('CanvasSection', '🚨 Critical Error', error);
 * ```
 */
debugLog.always = (component: string, message: string, data?: any) => {
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  const prefix = `[${timestamp}] [${component}]`;

  if (data !== undefined) {
    console.log(`%c${prefix} ${message}`, LOG_COLORS.error, data);
  } else {
    console.log(`%c${prefix} ${message}`, LOG_COLORS.error);
  }
};

// Export default
export default debugLog;
