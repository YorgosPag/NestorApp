/**
 * PERFORMANCE PROFILER — REPORTING & EXPORT
 * Geo-Alert System - Phase 7: Advanced Performance Profiling & Analysis
 *
 * Export formats (JSON, Chrome DevTools, Flame Graph) and HTML report generation.
 * Extracted from PerformanceProfiler.ts (ADR-065).
 */

import { GEO_COLORS } from '../config/color-config';
import type { ProfileSession } from './performance-profiler-types';

// ============================================================================
// EXPORT FORMATS
// ============================================================================

export function exportChromeDevTools(session: ProfileSession): string {
  const traceEvents = session.traces.map((trace) => ({
    name: trace.name,
    cat: trace.category,
    ph: 'X',
    ts: trace.startTime * 1000,
    dur: trace.duration * 1000,
    pid: 1,
    tid: 1,
    args: trace.details,
  }));

  return JSON.stringify(
    {
      traceEvents,
      displayTimeUnit: 'ms',
      metadata: session.metadata,
    },
    null,
    2
  );
}

export function exportFlameGraph(session: ProfileSession): string {
  const flameGraphData = session.traces.map((trace) => ({
    name: trace.name,
    value: trace.duration,
    children: trace.children.map((child) => ({
      name: child.name,
      value: child.duration,
    })),
  }));

  return JSON.stringify(flameGraphData, null, 2);
}

// ============================================================================
// HTML REPORT GENERATION
// ============================================================================

export function generateHTMLReport(session: ProfileSession): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Performance Profile Report - ${session.name}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; }
        .header { background: linear-gradient(135deg, ${GEO_COLORS.MONITORING.DASHBOARD_PRIMARY} 0%, ${GEO_COLORS.MONITORING.DASHBOARD_SECONDARY} 100%); color: ${GEO_COLORS.MONITORING.DASHBOARD_TEXT}; padding: 20px; border-radius: 8px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card { background: hsl(var(--card)); padding: 15px; border-radius: 8px; border-left: 4px solid ${GEO_COLORS.MONITORING.INFO}; }
        .score { font-size: 2em; font-weight: bold; color: ${GEO_COLORS.MONITORING.SUCCESS}; }
        .bottleneck { background: hsl(var(--muted)); padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid ${GEO_COLORS.MONITORING.WARNING}; }
        .recommendation { background: hsl(var(--accent)); padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid ${GEO_COLORS.MONITORING.INFO}; }
        .critical { border-left-color: ${GEO_COLORS.MONITORING.ERROR}; }
        .high { border-left-color: ${GEO_COLORS.MONITORING.WARNING}; }
        .medium { border-left-color: ${GEO_COLORS.MONITORING.WARNING}; }
        .low { border-left-color: ${GEO_COLORS.MONITORING.SUCCESS}; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Performance Profile Report</h1>
        <p><strong>Session:</strong> ${session.name} (${session.duration?.toFixed(2)}ms)</p>
        <p><strong>Environment:</strong> ${session.metadata.environment} | <strong>Device:</strong> ${session.metadata.deviceType}</p>
      </div>

      <div class="metrics">
        <div class="metric-card">
          <h3>Overall Score</h3>
          <div class="score">${session.analysis.score.overall}/100</div>
        </div>
        <div class="metric-card">
          <h3>Rendering</h3>
          <p>FPS: ${session.metrics.rendering.frameRate.average.toFixed(1)}</p>
          <p>Frame Drops: ${session.metrics.rendering.frameRate.drops}</p>
          <p>Score: ${session.analysis.score.rendering}/100</p>
        </div>
        <div class="metric-card">
          <h3>Network</h3>
          <p>Requests: ${session.metrics.network.requests.total}</p>
          <p>Resources: ${session.metrics.network.resources.length}</p>
          <p>Score: ${session.analysis.score.network}/100</p>
        </div>
        <div class="metric-card">
          <h3>Memory</h3>
          <p>Heap Used: ${formatBytes(session.metrics.memory.heap.used)}</p>
          <p>Suspected Leaks: ${session.metrics.memory.leaks.suspected}</p>
        </div>
      </div>

      <h2>Performance Bottlenecks</h2>
      ${session.analysis.bottlenecks
        .map(
          (bottleneck) => `
        <div class="bottleneck ${bottleneck.severity}">
          <h4>${bottleneck.type.toUpperCase()}: ${bottleneck.description}</h4>
          <p><strong>Impact:</strong> ${bottleneck.impact.toFixed(2)}ms</p>
          <p><strong>Root Cause:</strong> ${bottleneck.rootCause}</p>
          <p><strong>Estimated Fix:</strong> ${bottleneck.estimatedFix}</p>
        </div>
      `
        )
        .join('')}

      <h2>Optimization Recommendations</h2>
      ${session.analysis.recommendations
        .map(
          (rec) => `
        <div class="recommendation ${rec.priority}">
          <h4>${rec.title} (${rec.priority.toUpperCase()})</h4>
          <p>${rec.description}</p>
          <p><strong>Implementation:</strong> ${rec.implementation}</p>
          <p><strong>Expected Improvement:</strong> ${rec.expectedImprovement}% | <strong>Effort:</strong> ${rec.effort}</p>
        </div>
      `
        )
        .join('')}

      <h2>Detailed Metrics</h2>
      <div class="metrics">
        <div class="metric-card">
          <h4>Algorithms Performance</h4>
          ${Object.entries(session.metrics.computation.algorithms)
            .map(
              ([name, metrics]) => `
            <p><strong>${name}:</strong> ${metrics.executionCount} calls, ${metrics.averageTime.toFixed(2)}ms avg</p>
          `
            )
            .join('')}
        </div>
        <div class="metric-card">
          <h4>User Interactions</h4>
          <p>Clicks: ${session.metrics.userInteraction.interactions.clicks}</p>
          <p>Scrolls: ${session.metrics.userInteraction.interactions.scrolls}</p>
          <p>Response Time: ${session.metrics.userInteraction.responsiveness.averageResponseTime.toFixed(2)}ms</p>
        </div>
      </div>
    </body>
    </html>
    `;
}

// ============================================================================
// UTILITIES
// ============================================================================

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
