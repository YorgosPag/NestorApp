/**
 * AUTOMATED TESTING PIPELINE — Default Configuration
 * Geo-Alert System - Phase 7
 *
 * Factory function for the default pipeline configuration.
 * Pure data — no logic.
 */

import type { PipelineConfig } from './testing-pipeline-types';

/** Create the default pipeline configuration with all stages, triggers, and quality gates */
export function createDefaultPipelineConfig(): PipelineConfig {
  return {
    stages: [
      {
        name: 'pre-build',
        type: 'analysis',
        enabled: true,
        dependsOn: [],
        timeout: 300000,
        retryCount: 2,
        tasks: [
          {
            name: 'code-quality-check',
            type: 'code-quality',
            config: { rules: 'strict', threshold: 8.0 },
            criticalPath: false,
            allowFailure: false,
            artifacts: ['quality-report.json'],
            metrics: ['complexity', 'duplication']
          },
          {
            name: 'security-scan',
            type: 'security-tests',
            config: { scanType: 'static', severity: 'high' },
            criticalPath: true,
            allowFailure: false,
            artifacts: ['security-report.json'],
            metrics: ['vulnerabilities', 'risk-score']
          }
        ],
        conditions: []
      },
      {
        name: 'build',
        type: 'build',
        enabled: true,
        dependsOn: ['pre-build'],
        timeout: 600000,
        retryCount: 1,
        tasks: [
          {
            name: 'typescript-compile',
            type: 'build',
            config: { target: 'production', optimization: true },
            criticalPath: true,
            allowFailure: false,
            artifacts: ['dist/'],
            metrics: ['build-time', 'bundle-size']
          },
          {
            name: 'bundle-analysis',
            type: 'bundle-analysis',
            config: { detailed: true, visualization: true },
            criticalPath: false,
            allowFailure: true,
            artifacts: ['bundle-report.html'],
            metrics: ['bundle-size', 'chunk-count']
          }
        ],
        conditions: []
      },
      {
        name: 'unit-testing',
        type: 'test',
        enabled: true,
        dependsOn: ['build'],
        timeout: 900000,
        retryCount: 2,
        tasks: [
          {
            name: 'unit-tests',
            type: 'unit-tests',
            config: { coverage: true, parallel: true },
            criticalPath: true,
            allowFailure: false,
            artifacts: ['coverage/', 'test-results.xml'],
            metrics: ['test-count', 'coverage-percentage']
          },
          {
            name: 'component-tests',
            type: 'integration-tests',
            config: { components: 'all', mocking: true },
            criticalPath: true,
            allowFailure: false,
            artifacts: ['component-test-results.xml'],
            metrics: ['component-coverage']
          }
        ],
        conditions: []
      },
      {
        name: 'integration-testing',
        type: 'test',
        enabled: true,
        dependsOn: ['unit-testing'],
        timeout: 1200000,
        retryCount: 2,
        tasks: [
          {
            name: 'api-integration',
            type: 'integration-tests',
            config: { apis: 'all', database: 'mock' },
            criticalPath: true,
            allowFailure: false,
            artifacts: ['integration-results.xml'],
            metrics: ['api-coverage', 'response-time']
          },
          {
            name: 'cross-system-tests',
            type: 'integration-tests',
            config: { systems: ['dxf', 'map', 'alerts'], real: false },
            criticalPath: false,
            allowFailure: true,
            artifacts: ['system-test-results.xml'],
            metrics: ['system-integration-score']
          }
        ],
        conditions: []
      },
      {
        name: 'performance-testing',
        type: 'test',
        enabled: true,
        dependsOn: ['integration-testing'],
        timeout: 1800000,
        retryCount: 1,
        tasks: [
          {
            name: 'performance-profiling',
            type: 'performance-tests',
            config: { duration: 300, scenarios: 'all' },
            criticalPath: true,
            allowFailure: false,
            artifacts: ['performance-report.html'],
            metrics: ['performance-score', 'memory-usage']
          },
          {
            name: 'memory-leak-detection',
            type: 'performance-tests',
            config: { monitoring: 600, threshold: 'strict' },
            criticalPath: false,
            allowFailure: true,
            artifacts: ['memory-analysis.json'],
            metrics: ['leak-count', 'memory-growth']
          },
          {
            name: 'load-testing',
            type: 'load-tests',
            config: { users: 100, duration: 300 },
            criticalPath: false,
            allowFailure: true,
            artifacts: ['load-test-results.html'],
            metrics: ['throughput', 'response-time']
          }
        ],
        conditions: []
      },
      {
        name: 'e2e-testing',
        type: 'test',
        enabled: true,
        dependsOn: ['performance-testing'],
        timeout: 2400000,
        retryCount: 2,
        tasks: [
          {
            name: 'user-workflows',
            type: 'e2e-tests',
            config: { browser: 'chrome', headless: true },
            criticalPath: true,
            allowFailure: false,
            artifacts: ['e2e-results.xml', 'screenshots/'],
            metrics: ['workflow-success-rate']
          },
          {
            name: 'visual-regression',
            type: 'visual-regression',
            config: { baseline: 'main', threshold: 0.1 },
            criticalPath: false,
            allowFailure: true,
            artifacts: ['visual-diff-report.html'],
            metrics: ['visual-changes']
          },
          {
            name: 'accessibility-tests',
            type: 'accessibility-tests',
            config: { standard: 'WCAG-AA', tools: 'axe' },
            criticalPath: false,
            allowFailure: true,
            artifacts: ['accessibility-report.html'],
            metrics: ['accessibility-score']
          }
        ],
        conditions: []
      },
      {
        name: 'quality-gates',
        type: 'analysis',
        enabled: true,
        dependsOn: ['e2e-testing'],
        timeout: 300000,
        retryCount: 0,
        tasks: [
          {
            name: 'gate-evaluation',
            type: 'code-quality',
            config: { gates: 'all', strict: true },
            criticalPath: true,
            allowFailure: false,
            artifacts: ['quality-gates-report.json'],
            metrics: ['gates-passed', 'overall-quality']
          }
        ],
        conditions: []
      }
    ],
    triggers: [
      {
        type: 'manual',
        condition: {},
        branches: ['*'],
        enabled: true
      },
      {
        type: 'schedule',
        condition: { cron: '0 2 * * *' },
        branches: ['main', 'develop'],
        enabled: true
      },
      {
        type: 'merge-request',
        condition: { target: ['main', 'develop'] },
        branches: ['*'],
        enabled: true
      }
    ],
    environment: 'development',
    parallelExecution: true,
    retryPolicy: {
      maxRetries: 3,
      backoffStrategy: 'exponential',
      retryableErrors: ['timeout', 'network', 'flaky'],
      skipRetryOn: ['compilation', 'syntax']
    },
    notifications: {
      channels: [
        {
          type: 'email',
          config: { to: ['team@example.com'] },
          enabled: true,
          conditions: ['failure', 'success']
        },
        {
          type: 'slack',
          config: { webhook: 'https://hooks.slack.com/...' },
          enabled: true,
          conditions: ['failure']
        }
      ],
      events: ['pipeline-completed', 'pipeline-failed', 'quality-gate-failed'],
      templates: [
        {
          event: 'pipeline-completed',
          subject: '✅ Pipeline Completed Successfully',
          body: 'All tests passed and quality gates met.',
          priority: 'medium'
        },
        {
          event: 'pipeline-failed',
          subject: '❌ Pipeline Failed',
          body: 'Pipeline execution failed. Please check the logs.',
          priority: 'high'
        }
      ]
    },
    reporting: {
      formats: ['html', 'json', 'junit'],
      storage: {
        type: 'local',
        config: { path: './reports' },
        encryption: false
      },
      retention: 30,
      aggregation: {
        metrics: ['test-coverage', 'performance-score', 'quality-score'],
        trends: true,
        comparisons: true,
        baseline: 'main'
      }
    },
    quality: {
      testCoverage: {
        enabled: true,
        threshold: 85,
        operator: 'gte',
        blocking: true,
        message: 'Test coverage must be at least 85%'
      },
      performanceScore: {
        enabled: true,
        threshold: 80,
        operator: 'gte',
        blocking: true,
        message: 'Performance score must be at least 80'
      },
      securityScore: {
        enabled: true,
        threshold: 0,
        operator: 'eq',
        blocking: true,
        message: 'No security vulnerabilities allowed'
      },
      codeQuality: {
        enabled: true,
        threshold: 8.0,
        operator: 'gte',
        blocking: false,
        message: 'Code quality should be at least 8.0'
      },
      bundleSize: {
        enabled: true,
        threshold: 3 * 1024 * 1024,
        operator: 'lte',
        blocking: false,
        message: 'Bundle size should not exceed 3MB'
      },
      memoryLeaks: {
        enabled: true,
        threshold: 0,
        operator: 'eq',
        blocking: true,
        message: 'No memory leaks allowed'
      }
    }
  };
}
