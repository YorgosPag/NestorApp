/**
 * Centralized Debug Types
 * Unified type definitions for all debug systems
 */

export interface DebugConfig {
  enabled: boolean;
  level: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
  modules: Set<string>;
  maxLogsPerSecond: number;
  enablePerformanceTracking: boolean;
  enableEmergencySilence: boolean;
}

export interface LogEntry {
  timestamp: number;
  level: string;
  module: string;
  message: string;
  data?: any;
}

export interface PerformanceMetrics {
  renderCount: number;
  perfCount: number;
  hotPathCount: number;
  averageRenderTime: number;
  lastLogTime: number;
}

export interface DebugStatistics {
  totalLogs: number;
  logsByModule: Map<string, number>;
  logsByLevel: Map<string, number>;
  performance: PerformanceMetrics;
  emergencySilenced: boolean;
  uptime: number;
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';
export type LogFunction = (...args: any[]) => void;

export interface Logger {
  error: LogFunction;
  warn: LogFunction;
  info: LogFunction;
  debug: LogFunction;
  verbose: LogFunction;
}

export interface DebugModule {
  name: string;
  enabled: boolean;
  logger: Logger;
  statistics: {
    logCount: number;
    lastActivity: number;
  };
}