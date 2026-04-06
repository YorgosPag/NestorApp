/**
 * CI/CD Pipeline — Default Configuration Factory
 *
 * Creates the default pipeline configuration with 7 stages,
 * security scanning, monitoring, and deployment settings.
 *
 * @see CICDPipeline.ts — main class
 * @see cicd-pipeline-types.ts — type definitions
 */

import type { PipelineConfiguration } from './cicd-pipeline-types';

/**
 * Creates the default GeoAlert CI/CD pipeline configuration.
 * 7 stages: build → test → security → quality → deploy-staging → deploy-production → notify
 */
export function createDefaultPipelineConfiguration(): PipelineConfiguration {
  return {
    general: {
      name: 'geoalert-main-pipeline',
      version: '8.6.0',
      environment: 'production',
      triggerEvents: [
        {
          type: 'push',
          branches: ['main', 'develop'],
          conditions: [
            { type: 'file_changed', pattern: 'src/**/*', exclude: ['*.md', '*.txt'] },
          ],
        },
        { type: 'pull_request', branches: ['main'], conditions: [] },
        { type: 'schedule', schedule: '0 2 * * *', conditions: [] },
      ],
      parallelExecution: true,
      maxRetries: 3,
      timeout: 120,
    },
    stages: [
      {
        id: 'build',
        name: 'Build & Compile',
        type: 'build',
        enabled: true,
        continueOnError: false,
        timeout: 15,
        steps: [
          { id: 'checkout', name: 'Checkout Code', type: 'script', script: ['git checkout $BRANCH', 'git pull origin $BRANCH'], timeout: 5 },
          {
            id: 'install-deps', name: 'Install Dependencies', type: 'npm', command: 'npm ci', timeout: 10,
            cache: { key: 'node-modules-{{ checksum "package-lock.json" }}', paths: ['node_modules'], ttl: 24 },
          },
          {
            id: 'build-app', name: 'Build Application', type: 'npm', command: 'npm run build', timeout: 15,
            artifacts: { name: 'build-artifacts', paths: ['dist/', 'build/'], retention: 30, public: false },
          },
        ],
      },
      {
        id: 'test',
        name: 'Testing & Quality',
        type: 'test',
        dependsOn: ['build'],
        enabled: true,
        continueOnError: false,
        timeout: 30,
        steps: [
          {
            id: 'unit-tests', name: 'Unit Tests', type: 'npm', command: 'npm run test:unit', timeout: 15,
            artifacts: { name: 'test-results', paths: ['coverage/', 'test-results.xml'], retention: 14, public: true },
          },
          { id: 'e2e-tests', name: 'E2E Tests', type: 'npm', command: 'npm run test:e2e', timeout: 20 },
          { id: 'lint', name: 'Code Linting', type: 'npm', command: 'npm run lint', timeout: 5 },
          { id: 'type-check', name: 'TypeScript Check', type: 'npm', command: 'npm run type-check', timeout: 5 },
        ],
      },
      {
        id: 'security',
        name: 'Security Scanning',
        type: 'security',
        dependsOn: ['build'],
        parallelWith: ['test'],
        enabled: true,
        continueOnError: false,
        timeout: 20,
        steps: [
          { id: 'sast-scan', name: 'Static Security Scan', type: 'script', script: ['npm audit --audit-level moderate', 'npx snyk test'], timeout: 10 },
          { id: 'dependency-scan', name: 'Dependency Vulnerability Scan', type: 'script', script: ['npx audit-ci --moderate'], timeout: 5 },
          { id: 'secret-scan', name: 'Secret Detection', type: 'script', script: ['npx secretlint "**/*"'], timeout: 5 },
        ],
      },
      {
        id: 'quality',
        name: 'Quality Gates',
        type: 'quality',
        dependsOn: ['test', 'security'],
        enabled: true,
        continueOnError: false,
        timeout: 10,
        steps: [
          { id: 'coverage-check', name: 'Coverage Threshold', type: 'script', script: ['npm run coverage:check'], timeout: 2 },
          { id: 'quality-gate', name: 'SonarQube Quality Gate', type: 'script', script: ['sonar-scanner', 'sonar-quality-gate-check'], timeout: 5 },
        ],
      },
      {
        id: 'deploy-staging',
        name: 'Deploy to Staging',
        type: 'deploy',
        dependsOn: ['quality'],
        enabled: true,
        continueOnError: false,
        timeout: 20,
        environment: {
          name: 'staging',
          url: 'https://staging.geoalert.example.com',
          variables: { 'NODE_ENV': 'staging', 'API_URL': 'https://api-staging.geoalert.example.com' },
          secrets: ['DB_PASSWORD', 'JWT_SECRET', 'API_KEY'],
        },
        steps: [
          { id: 'build-docker', name: 'Build Docker Image', type: 'docker', command: 'docker build -t geoalert:staging .', timeout: 10 },
          { id: 'deploy-k8s', name: 'Deploy to Kubernetes', type: 'kubernetes', script: ['kubectl apply -f k8s/staging/', 'kubectl rollout status deployment/geoalert-staging'], timeout: 15 },
        ],
      },
      {
        id: 'deploy-production',
        name: 'Deploy to Production',
        type: 'deploy',
        dependsOn: ['deploy-staging'],
        enabled: true,
        continueOnError: false,
        timeout: 30,
        environment: {
          name: 'production',
          url: 'https://geoalert.example.com',
          variables: { 'NODE_ENV': 'production', 'API_URL': 'https://api.geoalert.example.com' },
          secrets: ['DB_PASSWORD', 'JWT_SECRET', 'API_KEY'],
          approvalRequired: true,
          approvers: ['tech-lead', 'devops-team'],
        },
        steps: [
          { id: 'build-docker-prod', name: 'Build Production Docker Image', type: 'docker', command: 'docker build -t geoalert:latest .', timeout: 10 },
          { id: 'deploy-k8s-prod', name: 'Deploy to Production Kubernetes', type: 'kubernetes', script: ['kubectl apply -f k8s/production/', 'kubectl rollout status deployment/geoalert-production'], timeout: 20 },
        ],
      },
      {
        id: 'notify',
        name: 'Notifications',
        type: 'notify',
        dependsOn: ['deploy-production'],
        enabled: true,
        continueOnError: true,
        timeout: 5,
        steps: [
          { id: 'slack-notify', name: 'Slack Notification', type: 'script', script: ['curl -X POST -H "Content-type: application/json" --data "$SLACK_PAYLOAD" $SLACK_WEBHOOK'], timeout: 2 },
        ],
      },
    ],
    notifications: {
      enabled: true,
      channels: [
        { type: 'slack', enabled: true, config: { webhook: 'https://hooks.slack.com/services/xxx/yyy/zzz', channel: '#deployments' } },
        { type: 'email', enabled: true, config: { smtp: 'smtp.example.com', from: 'devops@example.com' }, recipients: ['team@example.com'] },
      ],
      events: [
        { event: 'success', channels: ['slack', 'email'] },
        { event: 'failure', channels: ['slack', 'email'] },
        { event: 'deployment_success', channels: ['slack'] },
      ],
      templates: [
        { name: 'success', subject: '✅ Deployment Successful - GeoAlert {{ version }}', body: 'GeoAlert {{ version }} has been successfully deployed to {{ environment }}.', format: 'text' },
        { name: 'failure', subject: '❌ Deployment Failed - GeoAlert {{ version }}', body: 'GeoAlert {{ version }} deployment to {{ environment }} has failed. Check logs for details.', format: 'text' },
      ],
    },
    security: {
      enableSAST: true,
      enableDAST: false,
      enableDependencyScanning: true,
      enableContainerScanning: true,
      enableSecretScanning: true,
      enableLicenseScanning: true,
      vulnerabilityThreshold: 'medium',
      blockOnVulnerabilities: true,
    },
    monitoring: {
      enableMetrics: true,
      enableLogging: true,
      enableTracing: true,
      metricsEndpoint: 'https://metrics.geoalert.example.com',
      alertThresholds: { buildDurationMinutes: 45, failureRate: 10, queueTime: 10, resourceUsage: 80 },
    },
    deployment: {
      strategy: 'rolling',
      environments: [
        {
          name: 'staging', type: 'staging', cluster: 'geoalert-staging-cluster', namespace: 'geoalert-staging',
          replicas: 2, resources: { cpu: '500m', memory: '1Gi', storage: '5Gi' },
          autoPromote: true, manualApproval: false, approvers: [],
        },
        {
          name: 'production', type: 'production', cluster: 'geoalert-production-cluster', namespace: 'geoalert-production',
          replicas: 5, resources: { cpu: '1000m', memory: '2Gi', storage: '10Gi' },
          autoPromote: false, manualApproval: true, approvers: ['tech-lead', 'product-owner'],
        },
      ],
      rollback: { enabled: true, autoRollback: true, rollbackOnFailure: true, maxRevisions: 10, rollbackTimeout: 10 },
      healthChecks: { enabled: true, endpoint: '/health', timeout: 30, interval: 10, retries: 3, initialDelay: 60 },
      scaling: {
        enabled: true, minReplicas: 2, maxReplicas: 20, targetCPU: 70, targetMemory: 80,
        scaleUpPolicy: { stabilizationWindow: 60, policies: [{ type: 'pods', value: 2, period: 60 }, { type: 'percent', value: 50, period: 60 }] },
        scaleDownPolicy: { stabilizationWindow: 300, policies: [{ type: 'pods', value: 1, period: 60 }] },
      },
    },
  };
}
