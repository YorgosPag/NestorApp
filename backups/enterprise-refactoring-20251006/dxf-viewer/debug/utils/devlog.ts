/**
 * DXF Debug Logger - Selective logging για performance
 * Χρήση: window.__DXF_DEBUG__ = true στο console για ενεργοποίηση
 */

// ═══ DEBUG FLAG ═══
declare global {
  interface Window {
    __DXF_DEBUG__?: boolean;
    dxfDebug?: {
      enable: () => void;
      disable: () => void;
      status: () => boolean;
      stats: () => { totalEvents: number; debugEnabled: boolean; batchQueueSize: number };
      reset: () => void;
    };
  }
}

export const DXF_DEBUG =
  typeof window !== 'undefined' &&
  window.__DXF_DEBUG__ === true;

// ═══ PERFORMANCE AWARE LOGGERS ═══

export const dlog = (...args: Parameters<typeof console.log>): void => {
  if (process.env.NODE_ENV !== 'production' && DXF_DEBUG) {

  }
};

export const dwarn = (...args: Parameters<typeof console.warn>): void => {
  if (process.env.NODE_ENV !== 'production' && DXF_DEBUG) {
    console.warn(...args);
  }
};

export const derr = (...args: Parameters<typeof console.error>): void => {
  // Errors πάντα εμφανίζονται
  console.error(...args);
};

export const dinfo = (...args: Parameters<typeof console.info>): void => {
  if (process.env.NODE_ENV !== 'production' && DXF_DEBUG) {
    console.info(...args);
  }
};

// ═══ PERFORMANCE LOGGERS ═══

let perfCounter = 0;
export const dperflog = (label: string, ...args: Parameters<typeof console.log>): void => {
  perfCounter++;
  // Μόνο κάθε 100ο log για να μη γεμίσει η κονσόλα
  if (process.env.NODE_ENV !== 'production' && DXF_DEBUG && perfCounter % 100 === 0) {

  }
};

export const drenderlog = (label: string, ...args: Parameters<typeof console.log>): void => {
  // Render logs μόνο κάθε 60ό frame (~1 δευτερόλεπτο σε 60fps)
  perfCounter++;
  if (process.env.NODE_ENV !== 'production' && DXF_DEBUG && perfCounter % 60 === 0) {

  }
};

// ═══ HOT PATH LOGGER (πολύ σπάνια) ═══
export const dhotlog = (label: string, ...args: Parameters<typeof console.log>): void => {
  perfCounter++;
  // Hot path logs μόνο κάθε 300ό event (~5 δευτερόλεπτα)
  if (process.env.NODE_ENV !== 'production' && DXF_DEBUG && perfCounter % 300 === 0) {

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

      logBatch = [];
    }
    batchTimer = null;
  }, 1000); // Batch κάθε 1 δευτερόλεπτο
};

// ═══ UTILITIES ═══

export const enableDxfDebug = (): void => {
  if (typeof window !== 'undefined') {
    window.__DXF_DEBUG__ = true;
  }

};

export const disableDxfDebug = (): void => {
  if (typeof window !== 'undefined') {
    window.__DXF_DEBUG__ = false;
  }

};

export const getDxfDebugStatus = (): boolean => {
  return DXF_DEBUG;
};

// ═══ PERFORMANCE MONITOR ═══
export const resetPerfCounter = (): void => {
  perfCounter = 0;

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
  window.dxfDebug = {
    enable: enableDxfDebug,
    disable: disableDxfDebug,
    status: getDxfDebugStatus,
    stats: getPerfStats,
    reset: resetPerfCounter
  };
}
