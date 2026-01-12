/**
 * Centralized Debug Manager
 * Replaces console.log calls with conditional logging
 * Prevents infinite loops from excessive logging
 */

interface DebugConfig {
  enabled: boolean;
  maxLogsPerSecond: number;
  enabledModules: Set<string>;
}

class DebugManagerClass {
  private config: DebugConfig = {
    enabled: false, // ✅ DISABLED by default in production
    maxLogsPerSecond: 50, // Rate limiting
    enabledModules: new Set([
      // Canvas V2 system modules for debugging
      'CanvasV2System',
      'RulersGridSystem',
      'LayerCanvas',
      'DxfCanvas'
    ])
  };

  private logCounts = new Map<string, number>();
  private lastResetTime = Date.now();

  enable(modules?: string[]) {
    this.config.enabled = true;
    if (modules) {
      this.config.enabledModules = new Set(modules);
    }
  }

  disable() {
    this.config.enabled = false;
  }

  /**
   * Conditional console.log replacement
   * Only logs if module is enabled and rate limit not exceeded
   */
  log(module: string, ...args: unknown[]) {
    if (!this.config.enabled) return;
    if (!this.config.enabledModules.has(module)) return;

    // Rate limiting to prevent spam
    const now = Date.now();
    if (now - this.lastResetTime > 1000) {
      this.logCounts.clear();
      this.lastResetTime = now;
    }

    const currentCount = this.logCounts.get(module) || 0;
    if (currentCount >= this.config.maxLogsPerSecond) {
      return; // Skip if rate limit exceeded
    }

    this.logCounts.set(module, currentCount + 1);
  }

  /**
   * Force log (bypasses rate limiting) - for critical errors
   */
  error(module: string, ...args: unknown[]) {
    console.error(`[${module}] ERROR:`, ...args);
  }

  /**
   * Warn log (bypasses rate limiting) - for warnings
   */
  warn(module: string, ...args: unknown[]) {
    console.warn(`[${module}] WARN:`, ...args);
  }

  getStats() {
    return {
      enabled: this.config.enabled,
      enabledModules: Array.from(this.config.enabledModules),
      currentLogCounts: Object.fromEntries(this.logCounts)
    };
  }
}

// Global instance
export const DebugManager = new DebugManagerClass();

// Convenience function for quick access
export const dlog = (module: string, ...args: unknown[]) => {
  DebugManager.log(module, ...args);
};

// Enable debugging in development
if (process.env.NODE_ENV === 'development') {
  // 🏢 ENTERPRISE: Type assertion for window global (debug only)
  const debugWindow = window as Window & { __DEBUG_MANAGER__?: typeof DebugManager };
  debugWindow.__DEBUG_MANAGER__ = DebugManager;
}