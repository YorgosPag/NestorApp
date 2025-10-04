/**
 * DXF Debug Logger - Selective logging για performance
 * Χρήση: window.__DXF_DEBUG__ = true στο console για ενεργοποίηση
 */

// ═══ DEBUG FLAG ═══
export const DXF_DEBUG = 
  typeof window !== 'undefined' && 
  (window as any).__DXF_DEBUG__ === true;

// ═══ PERFORMANCE AWARE LOGGERS ═══

export const dlog = (...args: any[]): void => {
  if (process.env.NODE_ENV !== 'production' && DXF_DEBUG) {
    console.log(...args);
  }
};

export const dwarn = (...args: any[]): void => {
  if (process.env.NODE_ENV !== 'production' && DXF_DEBUG) {
    console.warn(...args);
  }
};

export const derr = (...args: any[]): void => {
  // Errors πάντα εμφανίζονται
  console.error(...args);
};

export const dinfo = (...args: any[]): void => {
  if (process.env.NODE_ENV !== 'production' && DXF_DEBUG) {
    console.info(...args);
  }
};

// ═══ PERFORMANCE LOGGERS ═══

let perfCounter = 0;
export const dperflog = (label: string, ...args: any[]): void => {
  perfCounter++;
  // Μόνο κάθε 100ο log για να μη γεμίσει η κονσόλα
  if (process.env.NODE_ENV !== 'production' && DXF_DEBUG && perfCounter % 100 === 0) {
    console.log(`[PERF-${perfCounter}] ${label}:`, ...args);
  }
};

export const drenderlog = (label: string, ...args: any[]): void => {
  // Render logs μόνο κάθε 60ό frame (~1 δευτερόλεπτο σε 60fps)
  perfCounter++;
  if (process.env.NODE_ENV !== 'production' && DXF_DEBUG && perfCounter % 60 === 0) {
    console.log(`[RENDER-${Math.floor(perfCounter/60)}] ${label}:`, ...args);
  }
};

// ═══ HOT PATH LOGGER (πολύ σπάνια) ═══
export const dhotlog = (label: string, ...args: any[]): void => {
  perfCounter++;
  // Hot path logs μόνο κάθε 300ό event (~5 δευτερόλεπτα)
  if (process.env.NODE_ENV !== 'production' && DXF_DEBUG && perfCounter % 300 === 0) {
    console.log(`[HOT-${Math.floor(perfCounter/300)}] ${label}:`, ...args);
  }
};

// ═══ BATCH LOGGER ═══
let logBatch: string[] = [];
let batchTimer: NodeJS.Timeout | null = null;

export const dbatchlog = (message: string): void => {
  if (!DXF_DEBUG) return;
  
  logBatch.push(message);
  
  if (batchTimer) {
    clearTimeout(batchTimer);
  }
  
  batchTimer = setTimeout(() => {
    if (logBatch.length > 0) {
      console.log('[BATCH]', logBatch.join(' | '));
      logBatch = [];
    }
    batchTimer = null;
  }, 1000); // Batch κάθε 1 δευτερόλεπτο
};

// ═══ UTILITIES ═══

export const enableDxfDebug = (): void => {
  (window as any).__DXF_DEBUG__ = true;
  console.log('🐛 DXF Debug enabled. Refresh για να εφαρμοστεί.');
};

export const disableDxfDebug = (): void => {
  (window as any).__DXF_DEBUG__ = false;
  console.log('🔇 DXF Debug disabled. Refresh για να εφαρμοστεί.');
};

export const getDxfDebugStatus = (): boolean => {
  return DXF_DEBUG;
};

// ═══ PERFORMANCE MONITOR ═══
export const resetPerfCounter = (): void => {
  perfCounter = 0;
  console.log('🔄 Performance counter reset');
};

export const getPerfStats = () => {
  return {
    totalEvents: perfCounter,
    debugEnabled: DXF_DEBUG,
    batchQueueSize: logBatch.length
  };
};

// ═══ GLOBAL HELPERS (development only) ═══
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as any).dxfDebug = {
    enable: enableDxfDebug,
    disable: disableDxfDebug,
    status: getDxfDebugStatus,
    stats: getPerfStats,
    reset: resetPerfCounter
  };
}
