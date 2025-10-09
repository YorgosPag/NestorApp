/**
 * @file Metrics & Counters
 * @module settings/telemetry/Metrics
 *
 * ENTERPRISE STANDARD - Production metrics tracking
 *
 * **FEATURES:**
 * - Counters (incremental values)
 * - Gauges (current values)
 * - Histograms (distribution tracking)
 * - Timers (latency tracking)
 *
 *  - Module #7
 */

// ============================================================================
// METRIC TYPES
// ============================================================================

interface Counter {
  type: 'counter';
  value: number;
}

interface Gauge {
  type: 'gauge';
  value: number;
}

interface Histogram {
  type: 'histogram';
  values: number[];
  count: number;
  sum: number;
  min: number;
  max: number;
}

type Metric = Counter | Gauge | Histogram;

// ============================================================================
// METRICS REGISTRY
// ============================================================================

export class Metrics {
  private metrics: Map<string, Metric> = new Map();

  // ==========================================================================
  // COUNTERS
  // ==========================================================================

  /**
   * Increment counter
   *
   * @param name - Counter name
   * @param value - Increment amount (default: 1)
   */
  increment(name: string, value = 1): void {
    const metric = this.metrics.get(name);

    if (!metric) {
      this.metrics.set(name, { type: 'counter', value });
      return;
    }

    if (metric.type !== 'counter') {
      console.warn(`[Metrics] "${name}" is not a counter, ignoring increment`);
      return;
    }

    metric.value += value;
  }

  /**
   * Decrement counter
   *
   * @param name - Counter name
   * @param value - Decrement amount (default: 1)
   */
  decrement(name: string, value = 1): void {
    this.increment(name, -value);
  }

  /**
   * Get counter value
   *
   * @param name - Counter name
   * @returns Counter value or 0
   */
  getCounter(name: string): number {
    const metric = this.metrics.get(name);
    return metric?.type === 'counter' ? metric.value : 0;
  }

  // ==========================================================================
  // GAUGES
  // ==========================================================================

  /**
   * Set gauge value
   *
   * @param name - Gauge name
   * @param value - New value
   */
  setGauge(name: string, value: number): void {
    this.metrics.set(name, { type: 'gauge', value });
  }

  /**
   * Get gauge value
   *
   * @param name - Gauge name
   * @returns Gauge value or 0
   */
  getGauge(name: string): number {
    const metric = this.metrics.get(name);
    return metric?.type === 'gauge' ? metric.value : 0;
  }

  // ==========================================================================
  // HISTOGRAMS
  // ==========================================================================

  /**
   * Record histogram value
   *
   * @param name - Histogram name
   * @param value - Value to record
   */
  recordHistogram(name: string, value: number): void {
    const metric = this.metrics.get(name);

    if (!metric) {
      this.metrics.set(name, {
        type: 'histogram',
        values: [value],
        count: 1,
        sum: value,
        min: value,
        max: value
      });
      return;
    }

    if (metric.type !== 'histogram') {
      console.warn(`[Metrics] "${name}" is not a histogram, ignoring record`);
      return;
    }

    metric.values.push(value);
    metric.count++;
    metric.sum += value;
    metric.min = Math.min(metric.min, value);
    metric.max = Math.max(metric.max, value);
  }

  /**
   * Get histogram statistics
   *
   * @param name - Histogram name
   * @returns Histogram stats or null
   */
  getHistogram(name: string): {
    count: number;
    sum: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const metric = this.metrics.get(name);

    if (!metric || metric.type !== 'histogram') {
      return null;
    }

    const sorted = [...metric.values].sort((a, b) => a - b);
    const avg = metric.sum / metric.count;

    return {
      count: metric.count,
      sum: metric.sum,
      min: metric.min,
      max: metric.max,
      avg,
      p50: this.percentile(sorted, 0.50),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99)
    };
  }

  // ==========================================================================
  // TIMERS
  // ==========================================================================

  /**
   * Start timer
   *
   * @param name - Timer name
   * @returns Stop function
   */
  startTimer(name: string): () => void {
    const start = performance.now();

    return () => {
      const duration = performance.now() - start;
      this.recordHistogram(name, duration);
    };
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Get all metrics
   *
   * @returns All metrics as JSON-serializable object
   */
  getAll(): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    this.metrics.forEach((metric, name) => {
      if (metric.type === 'counter' || metric.type === 'gauge') {
        result[name] = metric.value;
      } else if (metric.type === 'histogram') {
        result[name] = this.getHistogram(name);
      }
    });

    return result;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
  }

  /**
   * Reset specific metric
   *
   * @param name - Metric name
   */
  resetMetric(name: string): void {
    this.metrics.delete(name);
  }

  /**
   * Export metrics as JSON
   *
   * @returns JSON string
   */
  toJSON(): string {
    return JSON.stringify(this.getAll(), null, 2);
  }

  // ==========================================================================
  // PRIVATE
  // ==========================================================================

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;

    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }
}

// ============================================================================
// GLOBAL METRICS INSTANCE
// ============================================================================

let globalMetrics: Metrics | null = null;

/**
 * Get global metrics instance
 *
 * @returns Global metrics
 */
export function getMetrics(): Metrics {
  if (!globalMetrics) {
    globalMetrics = new Metrics();
  }
  return globalMetrics;
}

/**
 * Set global metrics instance
 *
 * @param metrics - Metrics instance
 */
export function setMetrics(metrics: Metrics): void {
  globalMetrics = metrics;
}

/**
 * Create metrics instance
 *
 * @returns Metrics instance
 */
export function createMetrics(): Metrics {
  return new Metrics();
}
