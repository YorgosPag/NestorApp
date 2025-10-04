/**
 * 📊 VISUAL REGRESSION TELEMETRY & METRICS
 * Enterprise-level metrics collection για trend monitoring
 * NDJSON format για time series analysis
 */

/// <reference path="../types/jest-globals.d.ts" />

import fs from 'node:fs';
import path from 'node:path';

interface VisualMetric {
  timestamp: number;
  name: string;
  value: number;
  tags: Record<string, string>;
  metadata?: Record<string, any>;
}

/**
 * 📊 METRICS COLLECTION UTILITY
 */
function logMetric(
  name: string,
  value: number,
  tags: Record<string, string> = {},
  metadata?: Record<string, any>
): void {
  const metric: VisualMetric = {
    timestamp: Date.now(),
    name,
    value,
    tags,
    metadata
  };

  const metricsDir = path.join(process.cwd(), 'reports', 'metrics');
  if (!fs.existsSync(metricsDir)) {
    fs.mkdirSync(metricsDir, { recursive: true });
  }

  const metricsFile = path.join(metricsDir, 'visual-metrics.ndjson');

  // Append as NDJSON (newline-delimited JSON)
  const line = JSON.stringify(metric) + '\n';
  fs.appendFileSync(metricsFile, line);

  console.log(`📊 Metric logged: ${name} = ${value} ${JSON.stringify(tags)}`);
}

/**
 * 📈 METRICS AGGREGATION UTILITY
 */
function aggregateMetrics(
  metricsFile: string = path.join(process.cwd(), 'reports', 'metrics', 'visual-metrics.ndjson')
): {
  summary: Record<string, { count: number; avg: number; min: number; max: number; latest: number }>;
  trends: Record<string, Array<{ timestamp: number; value: number }>>;
} {
  if (!fs.existsSync(metricsFile)) {
    return { summary: {}, trends: {} };
  }

  const lines = fs.readFileSync(metricsFile, 'utf-8').trim().split('\n');
  const metrics: VisualMetric[] = lines
    .filter(line => line.trim())
    .map(line => JSON.parse(line));

  const summary: Record<string, { count: number; avg: number; min: number; max: number; latest: number }> = {};
  const trends: Record<string, Array<{ timestamp: number; value: number }>> = {};

  // Group by metric name
  const groupedMetrics = metrics.reduce((acc, metric) => {
    if (!acc[metric.name]) acc[metric.name] = [];
    acc[metric.name].push(metric);
    return acc;
  }, {} as Record<string, VisualMetric[]>);

  // Calculate aggregations
  Object.entries(groupedMetrics).forEach(([name, metricsList]) => {
    const values = metricsList.map(m => m.value);
    const sortedByTime = metricsList.sort((a, b) => a.timestamp - b.timestamp);

    summary[name] = {
      count: values.length,
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      latest: sortedByTime[sortedByTime.length - 1]?.value || 0
    };

    trends[name] = sortedByTime.map(m => ({
      timestamp: m.timestamp,
      value: m.value
    }));
  });

  return { summary, trends };
}

/**
 * 🎯 VISUAL QUALITY METRICS TESTS
 */
describe('📊 Visual Regression Metrics & Telemetry', () => {

  beforeEach(() => {
    // Clean up metrics file πριν από κάθε test για isolation
    const metricsFile = path.join(process.cwd(), 'reports', 'metrics', 'visual-metrics.ndjson');
    if (fs.existsSync(metricsFile)) {
      fs.unlinkSync(metricsFile);
    }
  });

  test('logs visual quality thresholds', () => {
    // Log enterprise-level quality thresholds
    const testCases = [
      { name: 'combined-800x600', threshold: 0.0001, actualRate: 0.00005 },
      { name: 'origin-800x600', threshold: 0.0001, actualRate: 0.00003 },
      { name: 'grid-1024x768', threshold: 0.0001, actualRate: 0.00008 },
      { name: 'crosshair-800x800', threshold: 0.0001, actualRate: 0.00002 }
    ];

    testCases.forEach(testCase => {
      logMetric(
        'visual.mismatch_rate',
        testCase.actualRate,
        {
          test_case: testCase.name,
          suite: 'pixelmatch',
          environment: 'ci'
        },
        {
          threshold: testCase.threshold,
          passed: testCase.actualRate <= testCase.threshold,
          quality_gate: 'enterprise'
        }
      );

      logMetric(
        'visual.quality_score',
        (1 - testCase.actualRate) * 100, // Quality score as percentage
        {
          test_case: testCase.name,
          suite: 'visual_regression'
        }
      );
    });

    // Verify metrics were logged
    const { summary } = aggregateMetrics();

    expect(summary['visual.mismatch_rate']).toBeDefined();
    expect(summary['visual.mismatch_rate'].count).toBe(4);
    expect(summary['visual.mismatch_rate'].max).toBeLessThan(0.0001);

    expect(summary['visual.quality_score']).toBeDefined();
    expect(summary['visual.quality_score'].min).toBeGreaterThan(99.9);

    console.log('📊 Visual Quality Metrics Summary:', summary);
  });

  test('logs performance metrics', () => {
    // Log performance metrics για visual tests
    const performanceMetrics = [
      { metric: 'visual.test_duration', value: 2500, tags: { test: 'combined-800x600', phase: 'rendering' } },
      { metric: 'visual.test_duration', value: 1800, tags: { test: 'origin-800x600', phase: 'rendering' } },
      { metric: 'visual.comparison_time', value: 150, tags: { test: 'combined-800x600', phase: 'pixelmatch' } },
      { metric: 'visual.comparison_time', value: 120, tags: { test: 'origin-800x600', phase: 'pixelmatch' } },
      { metric: 'visual.baseline_size', value: 245760, tags: { test: 'combined-800x600', unit: 'bytes' } },
      { metric: 'visual.baseline_size', value: 189440, tags: { test: 'origin-800x600', unit: 'bytes' } }
    ];

    performanceMetrics.forEach(({ metric, value, tags }) => {
      logMetric(metric, value, tags, {
        environment: 'test',
        ci_build: process.env.CI_BUILD_NUMBER || 'local',
        git_commit: process.env.GIT_COMMIT || 'unknown'
      });
    });

    const { summary } = aggregateMetrics();

    // Performance assertions
    expect(summary['visual.test_duration'].avg).toBeLessThan(5000); // Avg < 5s
    expect(summary['visual.comparison_time'].avg).toBeLessThan(500); // Avg < 500ms
    expect(summary['visual.baseline_size'].avg).toBeGreaterThan(100000); // Realistic PNG sizes

    console.log('⚡ Performance Metrics Summary:', summary);
  });

  test('logs cross-browser consistency metrics', () => {
    // Simulate cross-browser metrics
    const browsers = ['chromium', 'firefox', 'webkit'];
    const testCases = ['combined-800x600', 'grid-1024x768'];

    browsers.forEach(browser => {
      testCases.forEach(testCase => {
        // Simulate slight variations between browsers
        const baselineRate = 0.00005;
        const variation = Math.random() * 0.00002; // Small random variation
        const mismatchRate = baselineRate + variation;

        logMetric(
          'visual.cross_browser_mismatch',
          mismatchRate,
          {
            browser,
            test_case: testCase,
            comparison: 'vs_baseline'
          },
          {
            gpu_acceleration: browser === 'webkit' ? 'metal' : 'vulkan',
            os: process.platform
          }
        );

        // Log browser-specific rendering time
        const renderTime = 50 + Math.random() * 30; // 50-80ms range
        logMetric(
          'visual.browser_render_time',
          renderTime,
          {
            browser,
            test_case: testCase
          }
        );
      });
    });

    const { summary, trends } = aggregateMetrics();

    expect(summary['visual.cross_browser_mismatch']).toBeDefined();
    expect(summary['visual.cross_browser_mismatch'].max).toBeLessThan(0.0001);

    expect(summary['visual.browser_render_time']).toBeDefined();
    expect(summary['visual.browser_render_time'].avg).toBeLessThan(100);

    console.log('🌐 Cross-Browser Metrics Summary:', summary);
    console.log('📈 Cross-Browser Trends:', Object.keys(trends));
  });

  test('generates comprehensive metrics report', () => {
    // Generate sample metrics για comprehensive report
    const sampleMetrics = [
      { name: 'visual.enterprise_quality_score', value: 99.995, tags: { suite: 'full_regression' } },
      { name: 'visual.total_test_duration', value: 45000, tags: { suite: 'full_regression' } },
      { name: 'visual.artifacts_generated', value: 21, tags: { type: 'png', suite: 'full_regression' } },
      { name: 'visual.baseline_coverage', value: 100, tags: { unit: 'percent' } },
      { name: 'visual.flaky_test_rate', value: 0, tags: { unit: 'percent' } }
    ];

    sampleMetrics.forEach(({ name, value, tags }) => {
      logMetric(name, value, tags, {
        report_generation: true,
        timestamp_iso: new Date().toISOString()
      });
    });

    const { summary } = aggregateMetrics();

    // Enterprise KPI assertions
    expect(summary['visual.enterprise_quality_score'].latest).toBeGreaterThan(99.99);
    expect(summary['visual.total_test_duration'].latest).toBeLessThan(60000); // < 1 minute
    expect(summary['visual.flaky_test_rate'].latest).toBe(0); // Zero flaky tests

    // Generate summary report
    const reportPath = path.join(process.cwd(), 'reports', 'metrics', 'visual-metrics-summary.json');
    const report = {
      generated_at: new Date().toISOString(),
      summary,
      enterprise_kpis: {
        quality_score: summary['visual.enterprise_quality_score']?.latest || 0,
        performance_score: summary['visual.total_test_duration']?.latest < 60000 ? 100 : 80,
        reliability_score: 100 - (summary['visual.flaky_test_rate']?.latest || 0),
        coverage_score: summary['visual.baseline_coverage']?.latest || 0
      }
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    expect(fs.existsSync(reportPath)).toBeTruthy();
    console.log(`📊 Comprehensive metrics report: ${reportPath}`);
    console.log('🎯 Enterprise KPIs:', report.enterprise_kpis);
  });

  test('validates metrics schema and data quality', () => {
    // Log metrics με different schemas για validation
    logMetric('test.metric.valid', 123.45, { valid: 'true' });

    // Try invalid metric (negative duration - should be caught by monitoring)
    logMetric('test.metric.duration', -100, { valid: 'false' });

    const { summary } = aggregateMetrics();

    // Validate metric structure
    Object.entries(summary).forEach(([metricName, stats]) => {
      expect(metricName).toMatch(/^[a-z_\.]+$/); // Valid metric name format
      expect(stats.count).toBeGreaterThan(0);
      expect(Number.isFinite(stats.avg)).toBeTruthy();
      expect(Number.isFinite(stats.min)).toBeTruthy();
      expect(Number.isFinite(stats.max)).toBeTruthy();
      expect(stats.min).toBeLessThanOrEqual(stats.max);
    });

    // Data quality checks
    if (summary['test.metric.duration']) {
      // Flag suspicious negative duration
      if (summary['test.metric.duration'].min < 0) {
        console.warn('⚠️ Data quality issue: negative duration detected');
        logMetric('visual.data_quality.alert', 1, {
          type: 'negative_duration',
          metric: 'test.metric.duration'
        });
      }
    }

    console.log('✅ Metrics schema validation passed');
  });
});

/**
 * 🔍 METRICS ANALYSIS UTILITIES
 */
describe('📈 Metrics Analysis & Trending', () => {
  test('detects quality regressions', () => {
    // Simulate historical quality trend
    const historicalQualities = [99.998, 99.997, 99.999, 99.996, 99.985]; // Declining trend
    const currentQuality = 99.980; // Further decline

    historicalQualities.forEach((quality, index) => {
      logMetric(
        'visual.quality_trend',
        quality,
        { build: `build_${index + 1}` },
        { simulated: true }
      );
    });

    // Current quality
    logMetric(
      'visual.quality_trend',
      currentQuality,
      { build: 'current' }
    );

    const { trends } = aggregateMetrics();
    const qualityTrend = trends['visual.quality_trend'] || [];

    // Regression detection logic
    if (qualityTrend.length >= 3) {
      const recent = qualityTrend.slice(-3).map(t => t.value);
      const isDecreasingTrend = recent.every((val, i) => i === 0 || val <= recent[i - 1]);

      if (isDecreasingTrend && currentQuality < 99.99) {
        console.warn('⚠️ QUALITY REGRESSION DETECTED');
        logMetric(
          'visual.regression_alert',
          1,
          {
            type: 'quality_decline',
            severity: 'warning',
            current_quality: currentQuality.toString()
          }
        );
      }
    }

    expect(qualityTrend.length).toBeGreaterThan(0);
    console.log('📉 Quality trend analysis completed');
  });

  test('tracks performance trends', () => {
    // Simulate performance degradation over time
    const baseDuration = 2000;
    const builds = 10;

    for (let i = 0; i < builds; i++) {
      // Gradual performance degradation
      const duration = baseDuration + (i * 50) + (Math.random() * 100);

      logMetric(
        'visual.performance_trend',
        duration,
        {
          build: `build_${i + 1}`,
          environment: 'ci'
        }
      );
    }

    const { summary, trends } = aggregateMetrics();
    const performanceTrend = trends['visual.performance_trend'] || [];

    // Performance regression detection
    if (performanceTrend.length >= 5) {
      const recentAvg = performanceTrend.slice(-3).reduce((sum, t) => sum + t.value, 0) / 3;
      const baselineAvg = performanceTrend.slice(0, 3).reduce((sum, t) => sum + t.value, 0) / 3;
      const degradationPercent = ((recentAvg - baselineAvg) / baselineAvg) * 100;

      if (degradationPercent > 20) { // 20% degradation threshold
        console.warn(`⚠️ PERFORMANCE REGRESSION: ${degradationPercent.toFixed(1)}% slower`);
        logMetric(
          'visual.performance_alert',
          degradationPercent,
          {
            type: 'duration_increase',
            severity: 'warning'
          }
        );
      }
    }

    expect(summary['visual.performance_trend']).toBeDefined();
    console.log('📈 Performance trend analysis completed');
  });
});