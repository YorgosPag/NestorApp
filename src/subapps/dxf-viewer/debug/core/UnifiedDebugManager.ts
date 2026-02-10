/**
 * Unified Debug Manager
 * Κεντρικοποιημένος manager που ενοποιεί όλα τα debug systems
 * Αντικαθιστά τα διάσπαρτα OptimizedLogger, DebugManager, devlog
 */

import type {
  DebugConfig,
  LogEntry,
  DebugStatistics,
  LogLevel,
  Logger,
  DebugModule,
  PerformanceMetrics
} from './types';

/**
 * 🏢 ENTERPRISE: Window interface for debug manager globals
 */
interface DxfDebugManagerAPI {
  enable: () => void;
  disable: () => void;
  enableModule: (name: string) => void;
  disableModule: (name: string) => void;
  emergencySilence: () => void;
  emergencyRestore: () => void;
  stats: () => DebugStatistics;
  modules: () => string[];
  config: () => { enabled: boolean; level: string; modules: string[]; maxLogsPerSecond: number; enablePerformanceTracking: boolean; enableEmergencySilence: boolean };
}

declare global {
  interface Window {
    dxfDebugManager?: DxfDebugManagerAPI;
  }
}

class UnifiedDebugManagerCore {
  private static instance: UnifiedDebugManagerCore;

  private config: DebugConfig = {
    enabled: process.env.NODE_ENV !== 'production',
    level: 'info',
    modules: new Set(['DxfViewer', 'Canvas', 'Rendering', 'Snap', 'HitTest']),
    maxLogsPerSecond: 50,
    enablePerformanceTracking: true,
    enableEmergencySilence: false
  };

  private modules: Map<string, DebugModule> = new Map();
  private logHistory: LogEntry[] = [];
  private statistics: DebugStatistics;
  private logCounts: Map<string, number> = new Map();
  private lastResetTime = Date.now();
  private startTime = Date.now();

  // Performance tracking
  private performance: PerformanceMetrics = {
    renderCount: 0,
    perfCount: 0,
    hotPathCount: 0,
    averageRenderTime: 0,
    lastLogTime: 0
  };

  // Emergency silence
  private emergencySilenced = false;
  private originalConsole: {
    log: typeof console.log;
    warn: typeof console.warn;
    error: typeof console.error;
  } | null = null;

  constructor() {
    this.statistics = {
      totalLogs: 0,
      logsByModule: new Map(),
      logsByLevel: new Map(),
      performance: this.performance,
      emergencySilenced: false,
      uptime: 0
    };

    this.initializeDefaultModules();
    this.setupGlobalAccess();
  }

  static getInstance(): UnifiedDebugManagerCore {
    if (!UnifiedDebugManagerCore.instance) {
      UnifiedDebugManagerCore.instance = new UnifiedDebugManagerCore();
    }
    return UnifiedDebugManagerCore.instance;
  }

  // ═══ MODULE MANAGEMENT ═══

  private initializeDefaultModules(): void {
    const defaultModules = [
      'DxfViewer', 'Canvas', 'Rendering', 'Snap', 'HitTest',
      'LayerCanvas', 'DxfCanvas', 'Performance', 'Events'
    ];

    defaultModules.forEach(name => {
      this.registerModule(name);
    });
  }

  registerModule(name: string): DebugModule {
    if (this.modules.has(name)) {
      return this.modules.get(name)!;
    }

    const module: DebugModule = {
      name,
      enabled: this.config.modules.has(name),
      logger: this.createModuleLogger(name),
      statistics: {
        logCount: 0,
        lastActivity: Date.now()
      }
    };

    this.modules.set(name, module);
    return module;
  }

  private createModuleLogger(moduleName: string): Logger {
    return {
      error: (...args: unknown[]) => this.log('error', moduleName, ...args),
      warn: (...args: unknown[]) => this.log('warn', moduleName, ...args),
      info: (...args: unknown[]) => this.log('info', moduleName, ...args),
      debug: (...args: unknown[]) => this.log('debug', moduleName, ...args),
      verbose: (...args: unknown[]) => this.log('verbose', moduleName, ...args)
    };
  }

  // ═══ LOGGING CORE ═══

  private log(level: LogLevel, module: string, ...args: unknown[]): void {
    if (!this.shouldLog(level, module)) return;

    const timestamp = Date.now();
    const entry: LogEntry = {
      timestamp,
      level,
      module,
      message: this.formatMessage(...args),
      data: args.length > 1 ? args.slice(1) : undefined
    };

    // Rate limiting
    if (!this.checkRateLimit(module)) return;

    // Update statistics
    this.updateStatistics(level, module);

    // Store in history (limited)
    this.logHistory.push(entry);
    if (this.logHistory.length > 1000) {
      this.logHistory = this.logHistory.slice(-500); // Keep last 500
    }

    // Output to console
    this.outputToConsole(level, module, ...args);
  }

  private shouldLog(level: LogLevel, module: string): boolean {
    if (!this.config.enabled) return level === 'error';
    if (this.emergencySilenced && level !== 'error') return false;

    const moduleObj = this.modules.get(module);
    if (!moduleObj?.enabled) return false;

    const levelPriority = this.getLevelPriority(level);
    const configPriority = this.getLevelPriority(this.config.level);

    return levelPriority >= configPriority;
  }

  private getLevelPriority(level: LogLevel): number {
    const priorities = { error: 5, warn: 4, info: 3, debug: 2, verbose: 1 };
    return priorities[level] || 0;
  }

  private checkRateLimit(module: string): boolean {
    const now = Date.now();
    if (now - this.lastResetTime > 1000) {
      this.logCounts.clear();
      this.lastResetTime = now;
    }

    const count = this.logCounts.get(module) || 0;
    if (count >= this.config.maxLogsPerSecond) return false;

    this.logCounts.set(module, count + 1);
    return true;
  }

  private formatMessage(...args: unknown[]): string {
    return args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
  }

  private outputToConsole(level: LogLevel, module: string, ...args: unknown[]): void {
    if (this.emergencySilenced && level !== 'error') return;

    const prefix = `[${module}]`;

    switch (level) {
      case 'error':
        console.error(prefix, ...args);
        break;
      case 'warn':
        console.warn(prefix, ...args);
        break;
      default:
        console.log(prefix, ...args);
    }
  }

  // ═══ PERFORMANCE LOGGING ═══

  performanceLog(type: 'render' | 'perf' | 'hot', module: string, ...args: unknown[]): void {
    if (!this.config.enablePerformanceTracking) return;

    this.performance[type === 'render' ? 'renderCount' : type === 'perf' ? 'perfCount' : 'hotPathCount']++;

    const frequencies = { render: 60, perf: 100, hot: 300 };
    const count = this.performance[type === 'render' ? 'renderCount' : type === 'perf' ? 'perfCount' : 'hotPathCount'];

    if (count % frequencies[type] === 0) {
      this.log('debug', module, `[${type.toUpperCase()}]`, ...args);
    }
  }

  batchLog(module: string, message: string): void {
    // Simple immediate logging for now - can be enhanced with batching later
    this.log('debug', module, '[BATCH]', message);
  }

  // ═══ EMERGENCY CONTROLS ═══

  enableEmergencySilence(): void {
    if (this.emergencySilenced) return;

    this.originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error
    };

    console.log = (...args: unknown[]) => {
      const str = String(args[0] || '');
      if (str.includes('⚠') || str.includes('❌') || str.includes('error')) {
        this.originalConsole!.log(...args);
      }
    };

    this.emergencySilenced = true;
    this.originalConsole.log('🔇 Emergency silence mode enabled');
  }

  disableEmergencySilence(): void {
    if (!this.emergencySilenced || !this.originalConsole) return;

    console.log = this.originalConsole.log;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;

    this.emergencySilenced = false;
    console.log('🔊 Emergency silence mode disabled');
  }

  // ═══ STATISTICS & MANAGEMENT ═══

  private updateStatistics(level: LogLevel, module: string): void {
    this.statistics.totalLogs++;

    const moduleCount = this.statistics.logsByModule.get(module) || 0;
    this.statistics.logsByModule.set(module, moduleCount + 1);

    const levelCount = this.statistics.logsByLevel.get(level) || 0;
    this.statistics.logsByLevel.set(level, levelCount + 1);

    this.statistics.uptime = Date.now() - this.startTime;
    this.statistics.emergencySilenced = this.emergencySilenced;

    // Update module statistics
    const moduleObj = this.modules.get(module);
    if (moduleObj) {
      moduleObj.statistics.logCount++;
      moduleObj.statistics.lastActivity = Date.now();
    }
  }

  getStatistics(): DebugStatistics {
    return { ...this.statistics };
  }

  getModules(): Map<string, DebugModule> {
    return new Map(this.modules);
  }

  // ═══ CONFIGURATION ═══

  configure(newConfig: Partial<DebugConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Update module enablement
    this.modules.forEach((module, name) => {
      module.enabled = this.config.modules.has(name);
    });
  }

  enableModule(name: string): void {
    this.config.modules.add(name);
    const module = this.modules.get(name);
    if (module) {
      module.enabled = true;
    } else {
      this.registerModule(name);
    }
  }

  disableModule(name: string): void {
    this.config.modules.delete(name);
    const module = this.modules.get(name);
    if (module) {
      module.enabled = false;
    }
  }

  // ═══ GLOBAL ACCESS ═══

  private setupGlobalAccess(): void {
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
      window.dxfDebugManager = {
        enable: () => this.configure({ enabled: true }),
        disable: () => this.configure({ enabled: false }),
        enableModule: (name: string) => this.enableModule(name),
        disableModule: (name: string) => this.disableModule(name),
        emergencySilence: () => this.enableEmergencySilence(),
        emergencyRestore: () => this.disableEmergencySilence(),
        stats: () => this.getStatistics(),
        modules: () => Array.from(this.modules.keys()),
        config: () => ({ ...this.config, modules: Array.from(this.config.modules) })
      };
    }
  }

  // ═══ CLEANUP ═══

  reset(): void {
    this.logHistory = [];
    this.logCounts.clear();
    this.statistics = {
      totalLogs: 0,
      logsByModule: new Map(),
      logsByLevel: new Map(),
      performance: {
        renderCount: 0,
        perfCount: 0,
        hotPathCount: 0,
        averageRenderTime: 0,
        lastLogTime: 0
      },
      emergencySilenced: false,
      uptime: 0
    };
    this.performance = {
      renderCount: 0,
      perfCount: 0,
      hotPathCount: 0,
      averageRenderTime: 0,
      lastLogTime: 0
    };
    this.startTime = Date.now();
  }
}

// ═══ SINGLETON EXPORT ═══
export const UnifiedDebugManager = UnifiedDebugManagerCore.getInstance();

// ═══ CONVENIENT EXPORTS ═══
export const getDebugLogger = (module: string) => {
  return UnifiedDebugManager.registerModule(module).logger;
};

export const dlog = (module: string, ...args: unknown[]) => {
  UnifiedDebugManager.registerModule(module).logger.debug(...args);
};

export const dwarn = (module: string, ...args: unknown[]) => {
  UnifiedDebugManager.registerModule(module).logger.warn(...args);
};

export const derr = (module: string, ...args: unknown[]) => {
  UnifiedDebugManager.registerModule(module).logger.error(...args);
};

export const drender = (module: string, ...args: unknown[]) => {
  UnifiedDebugManager.performanceLog('render', module, ...args);
};

export const dperf = (module: string, ...args: unknown[]) => {
  UnifiedDebugManager.performanceLog('perf', module, ...args);
};

export const dhot = (module: string, ...args: unknown[]) => {
  UnifiedDebugManager.performanceLog('hot', module, ...args);
};

export const dbatch = (module: string, message: string) => {
  UnifiedDebugManager.batchLog(module, message);
};