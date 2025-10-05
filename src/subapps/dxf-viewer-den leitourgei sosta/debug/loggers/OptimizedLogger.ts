/**
 * Optimized Logger - drender με throttling + emergency silencer
 * Λύνει το console.log spam στο render loop
 */

// ═══ DEBUG FLAGS ═══

export const DXF_DEBUG =
  process.env.NODE_ENV !== 'production' &&
  (typeof window !== 'undefined' && (window as { __DXF_DEBUG__?: boolean }).__DXF_DEBUG__ === true);

export const DXF_RENDER_DEBUG =
  process.env.NODE_ENV !== 'production' &&
  (typeof window !== 'undefined' && (window as { __DXF_RENDER_DEBUG__?: boolean }).__DXF_RENDER_DEBUG__ === true);

// ═══ EMERGENCY SILENCER ═══

let emergencySilenceMode = false;
let originalConsoleLog: typeof console.log;

export function enableEmergencySilence(): void {
  if (emergencySilenceMode) return;
  
  originalConsoleLog = console.log;
  console.log = (...args: Parameters<typeof console.log>) => {
    const str = String(args[0] || '');
    // Allow μόνο warnings και errors
    if (str.includes('⚠') || str.includes('❌') || str.includes('error')) {
      originalConsoleLog(...args);
    }
  };
  
  emergencySilenceMode = true;
  originalConsoleLog('🔇 Emergency silence mode enabled');
}

export function disableEmergencySilence(): void {
  if (!emergencySilenceMode || !originalConsoleLog) return;
  
  console.log = originalConsoleLog;
  emergencySilenceMode = false;

}

export function isEmergencySilenced(): boolean {
  return emergencySilenceMode;
}

// ═══ STANDARD LOGGERS ═══

export const dlog = (...args: Parameters<typeof console.log>): void => {
  if (DXF_DEBUG && !emergencySilenceMode) {
    console.log(...args);
  }
};

export const dwarn = (...args: Parameters<typeof console.warn>): void => {
  if (!emergencySilenceMode) {
    console.warn(...args);
  }
};

export const derr = (...args: Parameters<typeof console.error>): void => {
  // Errors πάντα εμφανίζονται
  console.error(...args);
};

// ═══ THROTTLED RENDER LOGGER ═══

let renderLogCounter = 0;
const RENDER_LOG_FREQUENCY = 60; // Κάθε 60ό render

export const drender = (() => {
  return (...args: Parameters<typeof console.log>): void => {
    renderLogCounter++;

    if (DXF_RENDER_DEBUG && !emergencySilenceMode && renderLogCounter % RENDER_LOG_FREQUENCY === 0) {
      console.log(...args);
    }
  };
})();

// ═══ PERFORMANCE LOGGERS ═══

let perfLogCounter = 0;
const PERF_LOG_FREQUENCY = 100;

export const dperf = (() => {
  return (...args: Parameters<typeof console.log>): void => {
    perfLogCounter++;
    
    if (DXF_DEBUG && !emergencySilenceMode && perfLogCounter % PERF_LOG_FREQUENCY === 0) {

    }
  };
})();

// ═══ HOT PATH LOGGER (πολύ σπάνια) ═══

let hotPathCounter = 0;
const HOT_PATH_FREQUENCY = 300;

export const dhot = (() => {
  return (...args: Parameters<typeof console.log>): void => {
    hotPathCounter++;
    
    if (DXF_DEBUG && !emergencySilenceMode && hotPathCounter % HOT_PATH_FREQUENCY === 0) {

    }
  };
})();

// ═══ BATCH LOGGER ═══

let batchQueue: string[] = [];
let batchTimer: NodeJS.Timeout | null = null;

export const dbatch = (message: string): void => {
  if (!DXF_DEBUG || emergencySilenceMode) return;
  
  batchQueue.push(message);
  
  if (batchTimer) {
    clearTimeout(batchTimer);
  }
  
  batchTimer = setTimeout(() => {
    if (batchQueue.length > 0) {

      batchQueue = [];
    }
    batchTimer = null;
  }, 1000);
};

// ═══ STATISTICS & CONTROL ═══

export function getLoggerStats() {
  return {
    debugEnabled: DXF_DEBUG,
    renderDebugEnabled: DXF_RENDER_DEBUG,
    emergencySilenced: emergencySilenceMode,
    renderLogCount: renderLogCounter,
    perfLogCount: perfLogCounter,
    hotPathCount: hotPathCounter,
    batchQueueSize: batchQueue.length
  };
}

export function resetLogCounters(): void {
  renderLogCounter = 0;
  perfLogCounter = 0;
  hotPathCounter = 0;
  batchQueue = [];
  if (batchTimer) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }
  dlog('�� Log counters reset');
}

export function setRenderLogFrequency(frequency: number): void {
  // Δυναμική αλλαγή frequency
  (global as { RENDER_LOG_FREQUENCY?: number }).RENDER_LOG_FREQUENCY = frequency;
  dlog('🔺 Render log frequency set to', frequency);
}

// ═══ GLOBAL HELPERS (development only) ═══

if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as { dxfLogger?: object }).dxfLogger = {
    enableDebug: () => { (window as { __DXF_DEBUG__?: boolean }).__DXF_DEBUG__ = true; },
    disableDebug: () => { (window as { __DXF_DEBUG__?: boolean }).__DXF_DEBUG__ = false; },
    enableRenderDebug: () => { (window as { __DXF_RENDER_DEBUG__?: boolean }).__DXF_RENDER_DEBUG__ = true; },
    disableRenderDebug: () => { (window as { __DXF_RENDER_DEBUG__?: boolean }).__DXF_RENDER_DEBUG__ = false; },
    emergencySilence: enableEmergencySilence,
    emergencyRestore: disableEmergencySilence,
    stats: getLoggerStats,
    reset: resetLogCounters
  };
}

// ═══ CONVENIENCE EXPORTS ═══

export {
  dlog as dlogOriginal,
  dwarn as dwarnOriginal,
  derr as derrOriginal
};

// Backward compatibility με devlog.ts
export const dhotlog = dhot;
export const dperflog = dperf;
export const drenderlog = drender;
export const dbatchlog = dbatch;
