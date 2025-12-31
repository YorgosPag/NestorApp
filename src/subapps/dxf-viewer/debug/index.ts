/**
 * Non-JSX Debug Exports
 * Pure TypeScript exports for non-React contexts
 */

// Re-export core debug functions (non-JSX)
export {
  UnifiedDebugManager,
  getDebugLogger,
  dlog,
  dwarn,
  derr,
  drender,
  dperf,
  dhot,
  dbatch
} from './core/UnifiedDebugManager';

export type {
  DebugConfig,
  LogEntry,
  DebugStatistics,
  LogLevel,
  LogFunction,
  DebugModule
} from './core/types';

// Re-export test functions
export { runGridEnterpriseTests } from './grid-enterprise-test';

// Note: JSX components (panels, UI) are only available in index.tsx