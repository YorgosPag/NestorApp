/**
 * PERFORMANCE PROFILER — MAIN CLASS
 * Singleton profiler: session management, monitoring loops, trace recording,
 * profiling utilities, and public API. Delegates collection, analysis, and
 * reporting to extracted modules. Split per ADR-065 SRP pattern.
 */
declare const performance: Performance;
declare const PerformanceObserver: typeof window.PerformanceObserver;

import { generateTraceId, generateSessionId } from '@/services/enterprise-id.service';

export type {
  ProfileSession, ProfileMetrics, RenderingMetrics, ComputationMetrics,
  AlgorithmMetrics, NetworkMetrics, ResourceMetrics, UserInteractionMetrics,
  MemoryMetrics, BrowserMetrics, PerformanceTrace, ProfileAnalysis,
  Bottleneck, PerformanceRecommendation, SessionMetadata, ProfilerConfig,
} from './performance-profiler-types';

import type {
  ProfileSession, PerformanceTrace, ProfilerConfig, NavigatorWithConnection,
} from './performance-profiler-types';

import {
  initializeMetrics, collectSessionMetadata, updateFrameMetrics,
  updateNetworkStats, getMemoryInfo, updateAlgorithmMetrics,
  calculateFinalStatistics, dispatchPerformanceEntry,
  buildResourceFromEntry, updateNetworkBandwidth,
} from './performance-profiler-collectors';

import {
  initializeAnalysis, detectBottlenecks, generateRecommendations,
  calculatePerformanceScores, analyzeTrends,
} from './performance-profiler-analysis';

import {
  exportChromeDevTools, exportFlameGraph, generateHTMLReport,
} from './performance-profiler-reporting';

export class GeoAlertPerformanceProfiler {
  private static instance: GeoAlertPerformanceProfiler | null = null;
  private config: ProfilerConfig;
  private activeSessions: Map<string, ProfileSession> = new Map();
  private performanceObserver?: PerformanceObserver;
  private traces: Map<string, PerformanceTrace> = new Map();
  private isProfileActive: boolean = false;
  private frameMonitor?: number;

  private constructor() {
    this.config = this.getDefaultConfig();
    this.initializePerformanceObserver();
  }

  public static getInstance(): GeoAlertPerformanceProfiler {
    if (!GeoAlertPerformanceProfiler.instance) {
      GeoAlertPerformanceProfiler.instance = new GeoAlertPerformanceProfiler();
    }
    return GeoAlertPerformanceProfiler.instance;
  }

  private getDefaultConfig(): ProfilerConfig {
    return {
      sampling: { interval: 100, bufferSize: 10000, enableAutoSampling: true },
      metrics: {
        enableRendering: true, enableComputation: true, enableNetwork: true,
        enableMemory: true, enableUserInteraction: true,
      },
      analysis: {
        enableBottleneckDetection: true, enableTrendAnalysis: true, confidenceThreshold: 80,
      },
      export: { format: 'json', includeSourceMaps: true, enableVisualization: true },
    };
  }

  private initializePerformanceObserver(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

    try {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          Array.from(this.activeSessions.values()).forEach((session) => {
            dispatchPerformanceEntry(session, entry);
          });
        });
      });

      this.performanceObserver.observe({
        entryTypes: [
          'measure', 'navigation', 'resource', 'paint',
          'largest-contentful-paint', 'first-input', 'layout-shift', 'longtask',
        ],
      });
    } catch (error) {
      console.warn('PerformanceObserver initialization failed:', error);
    }
  }

  // --- Session Management ---

  public startProfiling(sessionName: string = 'default'): string {
    const sessionId = generateSessionId();

    const session: ProfileSession = {
      id: sessionId,
      name: sessionName,
      startTime: performance.now(),
      metrics: initializeMetrics(),
      traces: [],
      analysis: initializeAnalysis(),
      metadata: collectSessionMetadata(),
    };

    this.activeSessions.set(sessionId, session);
    this.isProfileActive = true;

    this.startFrameMonitoring();
    this.startResourceMonitoring();
    this.startUserInteractionMonitoring();

    return sessionId;
  }

  public async stopProfiling(sessionId: string): Promise<ProfileSession> {
    const session = this.activeSessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    session.endTime = performance.now();
    session.duration = session.endTime - session.startTime;

    this.stopFrameMonitoring();
    this.isProfileActive = false;

    await this.finalizeMetrics(session);
    await this.analyzePerformance(session);

    return session;
  }

  // --- Frame Monitoring ---

  private startFrameMonitoring(): void {
    if (!this.config.metrics.enableRendering) return;

    let lastFrameTime = performance.now();
    const frameTimes: number[] = [];

    const monitorFrame = () => {
      if (!this.isProfileActive) return;

      const currentTime = performance.now();
      const frameTime = currentTime - lastFrameTime;
      lastFrameTime = currentTime;
      frameTimes.push(frameTime);

      Array.from(this.activeSessions.values()).forEach((session) => {
        updateFrameMetrics(session, frameTime, frameTimes);
      });

      this.frameMonitor = requestAnimationFrame(monitorFrame);
    };

    this.frameMonitor = requestAnimationFrame(monitorFrame);
  }

  private stopFrameMonitoring(): void {
    if (this.frameMonitor) {
      cancelAnimationFrame(this.frameMonitor);
      this.frameMonitor = undefined;
    }
  }

  // --- Resource Monitoring ---

  private startResourceMonitoring(): void {
    if (!this.config.metrics.enableNetwork) return;

    if ('connection' in navigator) {
      const nav = navigator as NavigatorWithConnection;
      const connection = nav.connection;
      if (connection && 'addEventListener' in connection) {
        (connection as EventTarget).addEventListener('change', () => {
          if (!connection) return;
          Array.from(this.activeSessions.values()).forEach((session) => {
            updateNetworkBandwidth(session, connection);
          });
        });
      }
    }

    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    resources.forEach((entry) => {
      const resource = buildResourceFromEntry(entry);
      Array.from(this.activeSessions.values()).forEach((session) => {
        session.metrics.network.resources.push(resource);
        updateNetworkStats(session, resource);
      });
    });
  }

  // --- User Interaction Monitoring ---

  private startUserInteractionMonitoring(): void {
    if (!this.config.metrics.enableUserInteraction) return;

    document.addEventListener('click', (e) => this.recordInteraction('click', e));
    document.addEventListener('scroll', (e) => this.recordInteraction('scroll', e));
    document.addEventListener('keydown', (e) => this.recordInteraction('keypress', e));
    document.addEventListener('touchstart', (e) => this.recordInteraction('touch', e));
  }

  private recordInteraction(type: string, event: Event): void {
    const timestamp = performance.now();

    Array.from(this.activeSessions.values()).forEach((session) => {
      const interaction = session.metrics.userInteraction.interactions;
      switch (type) {
        case 'click': interaction.clicks++; break;
        case 'scroll': interaction.scrolls++; break;
        case 'keypress': interaction.keypresses++; break;
        case 'touch': interaction.touches++; break;
      }

      this.recordTrace({
        id: `interaction-${Date.now()}`,
        name: `user-${type}`,
        category: 'user',
        startTime: timestamp, endTime: timestamp, duration: 0,
        details: { type, target: (event.target as Element)?.tagName || 'unknown' },
        children: [],
        metadata: {},
      });
    });
  }

  // --- Trace Recording ---

  public recordTrace(trace: PerformanceTrace): void {
    this.traces.set(trace.id, trace);

    Array.from(this.activeSessions.values()).forEach((session) => {
      session.traces.push(trace);
    });

    if (this.traces.size > this.config.sampling.bufferSize) {
      const oldestKey = this.traces.keys().next().value;
      if (typeof oldestKey === 'string') this.traces.delete(oldestKey);
    }
  }

  public startTrace(name: string, category: PerformanceTrace['category'] = 'computation'): string {
    const traceId = generateTraceId();
    const trace: PerformanceTrace = {
      id: traceId, name, category,
      startTime: performance.now(), endTime: 0, duration: 0,
      details: {}, children: [],
      metadata: { stackTrace: new Error().stack || 'Stack trace not available' },
    };
    this.traces.set(traceId, trace);
    return traceId;
  }

  public endTrace(traceId: string, details?: Record<string, unknown>): PerformanceTrace | null {
    const trace = this.traces.get(traceId);
    if (!trace) return null;

    trace.endTime = performance.now();
    trace.duration = trace.endTime - trace.startTime;
    if (details) trace.details = { ...trace.details, ...details };

    Array.from(this.activeSessions.values()).forEach((session) => {
      session.traces.push({ ...trace });
    });

    return trace;
  }

  // --- Analysis & Finalization (delegates to modules) ---

  private async analyzePerformance(session: ProfileSession): Promise<void> {
    session.analysis.bottlenecks = await detectBottlenecks(session);
    session.analysis.recommendations = await generateRecommendations(session);
    session.analysis.score = calculatePerformanceScores(session);
    session.analysis.trends = analyzeTrends(session);
  }

  private async finalizeMetrics(session: ProfileSession): Promise<void> {
    if (this.config.metrics.enableMemory) {
      session.metrics.memory.heap = getMemoryInfo();
    }
    updateAlgorithmMetrics(session);
    calculateFinalStatistics(session);
  }

  // --- Profiling Utilities ---

  public profileFunction<T>(
    fn: () => T, name: string, category: PerformanceTrace['category'] = 'computation'
  ): { result: T; trace: PerformanceTrace } {
    const traceId = this.startTrace(name, category);
    try {
      const result = fn();
      const trace = this.endTrace(traceId, { result: 'success' });
      return { result, trace: trace! };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.endTrace(traceId, { result: 'error', error: msg });
      throw error;
    }
  }

  public async profileAsync<T>(
    fn: () => Promise<T>, name: string, category: PerformanceTrace['category'] = 'computation'
  ): Promise<{ result: T; trace: PerformanceTrace }> {
    const traceId = this.startTrace(name, category);
    try {
      const result = await fn();
      const trace = this.endTrace(traceId, { result: 'success' });
      return { result, trace: trace! };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.endTrace(traceId, { result: 'error', error: msg });
      throw error;
    }
  }

  public measureComponentRender(componentName: string): {
    start: () => void;
    end: () => PerformanceTrace | null;
  } {
    let traceId: string;
    return {
      start: () => { traceId = this.startTrace(`render-${componentName}`, 'rendering'); },
      end: () => this.endTrace(traceId, { component: componentName }),
    };
  }

  // --- Export & Reporting (delegates to reporting module) ---

  public exportSession(sessionId: string, format?: 'json' | 'chrome-devtools' | 'flame-graph'): string {
    const session = this.activeSessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const exportFormat = format || this.config.export.format;
    switch (exportFormat) {
      case 'chrome-devtools': return exportChromeDevTools(session);
      case 'flame-graph': return exportFlameGraph(session);
      default: return JSON.stringify(session, null, 2);
    }
  }

  public generateReport(sessionId: string): string {
    const session = this.activeSessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    return generateHTMLReport(session);
  }

  // --- Utility Methods ---

  public getActiveSessions(): Map<string, ProfileSession> { return this.activeSessions; }

  public updateConfig(config: Partial<ProfilerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public clearSessions(): void {
    this.activeSessions.clear();
    this.traces.clear();
  }

  public getPerformanceInsights(): {
    activeProfiles: number;
    totalTraces: number;
    averagePerformanceScore: number;
    commonBottlenecks: string[];
  } {
    const sessions = Array.from(this.activeSessions.values());
    const averageScore = sessions.length > 0
      ? sessions.reduce((sum, s) => sum + s.analysis.score.overall, 0) / sessions.length : 0;
    const bottleneckTypes = sessions.flatMap((s) => s.analysis.bottlenecks.map((b) => b.type));

    return {
      activeProfiles: sessions.length,
      totalTraces: this.traces.size,
      averagePerformanceScore: Math.round(averageScore),
      commonBottlenecks: Array.from(new Set(bottleneckTypes)),
    };
  }
}

// Global exports
export const geoAlertPerformanceProfiler = GeoAlertPerformanceProfiler.getInstance();

export const startProfiler = (name?: string) => geoAlertPerformanceProfiler.startProfiling(name);
export const stopProfiler = (id: string) => geoAlertPerformanceProfiler.stopProfiling(id);
export const profileFunction = <T>(fn: () => T, name: string) =>
  geoAlertPerformanceProfiler.profileFunction(fn, name);
export const profileAsync = <T>(fn: () => Promise<T>, name: string) =>
  geoAlertPerformanceProfiler.profileAsync(fn, name);

export default geoAlertPerformanceProfiler;
