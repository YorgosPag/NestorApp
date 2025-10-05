# 🏥 Service Health Monitor

## 📊 Overview

Enterprise-grade **real-time service health monitoring** system για το DXF Viewer application.

## 🎯 Purpose

- **Proactive Monitoring**: Continuous health checking για όλα τα services
- **Performance Tracking**: Response time monitoring και degradation detection
- **Availability Alerts**: Real-time notifications για service failures
- **Historical Analysis**: Health history tracking για trend analysis
- **DevOps Integration**: Export reports για monitoring dashboards

## 🚀 Quick Start

### Browser Dashboard

1. **Start dev server**:
   ```bash
   npm run dev:fast
   ```

2. **Open health dashboard**:
   ```
   http://localhost:3003/dxf-viewer/services/__health__/health-dashboard.html
   ```

3. **Click "Start Auto-Refresh"** για automatic monitoring

### Programmatic Usage

```typescript
import {
  serviceHealthMonitor,
  HealthStatus
} from '@/subapps/dxf-viewer/services';

// ===== AUTOMATIC MONITORING =====

// Start automatic health checks (every 30 seconds)
serviceHealthMonitor.start();

// Subscribe to health updates
const unsubscribe = serviceHealthMonitor.subscribe(report => {
  console.log('Health Status:', report.overallStatus);

  if (report.overallStatus === HealthStatus.UNHEALTHY) {
    // Alert DevOps team
    sendAlert('Services are unhealthy!', report);
  }
});

// Stop monitoring
serviceHealthMonitor.stop();
unsubscribe();

// ===== MANUAL CHECKS =====

// Check all services
const report = await serviceHealthMonitor.checkAllServices();
console.log('Overall Status:', report.overallStatus);
console.log('Healthy Services:', report.healthyServices);
console.log('Unhealthy Services:', report.unhealthyServices);

// Check specific service
const result = await serviceHealthMonitor.checkService('fit-to-view');
console.log('Fit-to-View Status:', result.status);
console.log('Response Time:', result.responseTime + 'ms');

// ===== HISTORY & ANALYTICS =====

// Get service history
const history = serviceHealthMonitor.getServiceHistory('hit-testing', 10);
console.log('Last 10 health checks:', history);

// Get last report
const lastReport = serviceHealthMonitor.getLastReport();
console.log('Last check:', lastReport);
```

### Console API

```javascript
// Start monitoring
serviceHealth.start()

// Stop monitoring
serviceHealth.stop()

// Check all services now
await serviceHealth.check()

// Get last report
serviceHealth.report()

// Get statistics
serviceHealth.stats()

// Pretty print status
await serviceHealth.log()
```

## 📈 Health Status Levels

### ✅ HEALTHY
- Response time < 500ms
- No errors
- Service initialized successfully

### ⚠️ DEGRADED
- Response time: 500ms - 1000ms
- Service working but slow
- May need attention

### ❌ UNHEALTHY
- Response time > 1000ms
- Service errors
- Not registered or failed to initialize

### ❓ UNKNOWN
- Service not checked yet
- Pending initialization

## 🔧 Configuration

```typescript
serviceHealthMonitor.configure({
  enabled: true,                 // Enable/disable monitoring
  intervalMs: 30000,             // Check every 30 seconds
  timeoutMs: 1000,               // Max 1 second per check
  degradedThresholdMs: 500,      // > 500ms = degraded
  unhealthyThresholdMs: 1000     // > 1000ms = unhealthy
});
```

## 📊 Health Report Structure

```typescript
interface HealthReport {
  timestamp: number;              // Report timestamp
  overallStatus: HealthStatus;    // Overall system health
  totalServices: number;          // Total registered services
  healthyServices: number;        // Count of healthy services
  degradedServices: number;       // Count of degraded services
  unhealthyServices: number;      // Count of unhealthy services
  services: HealthCheckResult[];  // Individual service results
}

interface HealthCheckResult {
  service: ServiceName;           // Service identifier
  status: HealthStatus;           // Health status
  responseTime: number;           // Response time in ms
  lastChecked: number;            // Timestamp
  error?: string;                 // Error message (if any)
  metadata?: {                    // Service metadata
    initialized: boolean;
    instanceCount: number;
    lastAccessed: number;
  };
}
```

## 🎯 Use Cases

### 1. Production Monitoring

```typescript
// Monitor production health
serviceHealthMonitor.start();

serviceHealthMonitor.subscribe(report => {
  // Send to analytics
  analytics.track('service_health', {
    status: report.overallStatus,
    healthy: report.healthyServices,
    degraded: report.degradedServices,
    unhealthy: report.unhealthyServices
  });

  // Alert on critical issues
  if (report.unhealthyServices > 0) {
    slack.send(`⚠️ ${report.unhealthyServices} services are unhealthy!`);
  }
});
```

### 2. Load Testing Validation

```typescript
// Before load test
const beforeReport = await serviceHealthMonitor.checkAllServices();
console.log('Pre-test health:', beforeReport.overallStatus);

// Run load test
await runLoadTest();

// After load test
const afterReport = await serviceHealthMonitor.checkAllServices();

// Compare response times
afterReport.services.forEach(after => {
  const before = beforeReport.services.find(s => s.service === after.service);
  const degradation = after.responseTime / before.responseTime;

  if (degradation > 2) {
    console.warn(`⚠️ ${after.service} is 2x slower after load test!`);
  }
});
```

### 3. Automated Testing

```typescript
describe('Service Health', () => {
  it('should have all services healthy', async () => {
    const report = await serviceHealthMonitor.checkAllServices();

    expect(report.overallStatus).toBe(HealthStatus.HEALTHY);
    expect(report.unhealthyServices).toBe(0);
    expect(report.degradedServices).toBe(0);
  });

  it('should respond quickly', async () => {
    const report = await serviceHealthMonitor.checkAllServices();

    report.services.forEach(service => {
      expect(service.responseTime).toBeLessThan(100);
    });
  });
});
```

### 4. DevOps Dashboard Integration

```typescript
// Export health data για Grafana/Datadog
setInterval(async () => {
  const report = await serviceHealthMonitor.checkAllServices();

  // Send to monitoring system
  prometheusClient.gauge('app_service_health', {
    status: report.overallStatus,
    healthy: report.healthyServices,
    degraded: report.degradedServices,
    unhealthy: report.unhealthyServices
  });

  // Per-service metrics
  report.services.forEach(service => {
    prometheusClient.histogram('service_response_time', service.responseTime, {
      service: service.service,
      status: service.status
    });
  });
}, 10000); // Every 10 seconds
```

## 🔔 Notification Examples

### Slack Integration

```typescript
async function notifySlack(report: HealthReport) {
  if (report.overallStatus === HealthStatus.UNHEALTHY) {
    await fetch('https://hooks.slack.com/services/YOUR/WEBHOOK/URL', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 *Service Health Alert*`,
        attachments: [{
          color: 'danger',
          fields: [
            { title: 'Status', value: report.overallStatus, short: true },
            { title: 'Unhealthy', value: String(report.unhealthyServices), short: true },
            { title: 'Timestamp', value: new Date(report.timestamp).toISOString() }
          ]
        }]
      })
    });
  }
}

serviceHealthMonitor.subscribe(notifySlack);
```

### Email Alerts

```typescript
async function emailAlert(report: HealthReport) {
  if (report.unhealthyServices > 0) {
    const unhealthyList = report.services
      .filter(s => s.status === HealthStatus.UNHEALTHY)
      .map(s => `${s.service}: ${s.error || 'Unknown error'}`)
      .join('\n');

    await sendEmail({
      to: 'devops@company.com',
      subject: '⚠️ Service Health Alert',
      body: `
        Unhealthy services detected:

        ${unhealthyList}

        Time: ${new Date(report.timestamp).toISOString()}
      `
    });
  }
}
```

## 📊 Metrics & KPIs

### Service Availability

```typescript
// Calculate uptime percentage
function calculateUptime(serviceName: ServiceName, hours: number = 24): number {
  const history = serviceHealthMonitor.getServiceHistory(serviceName, hours * 120); // 2 checks/min
  const totalChecks = history.length;
  const healthyChecks = history.filter(h => h.status === HealthStatus.HEALTHY).length;

  return (healthyChecks / totalChecks) * 100;
}

console.log('Fit-to-View uptime (24h):', calculateUptime('fit-to-view', 24) + '%');
```

### Response Time Trends

```typescript
function getResponseTimeTrend(serviceName: ServiceName): {
  average: number;
  min: number;
  max: number;
  p95: number;
} {
  const history = serviceHealthMonitor.getServiceHistory(serviceName, 100);
  const times = history.map(h => h.responseTime).sort((a, b) => a - b);

  return {
    average: times.reduce((a, b) => a + b, 0) / times.length,
    min: Math.min(...times),
    max: Math.max(...times),
    p95: times[Math.floor(times.length * 0.95)]
  };
}
```

## 🧪 Testing

```typescript
// Test health monitor functionality
describe('ServiceHealthMonitor', () => {
  beforeEach(() => {
    serviceHealthMonitor.reset();
  });

  it('should detect healthy services', async () => {
    const result = await serviceHealthMonitor.checkService('fit-to-view');
    expect(result.status).toBe(HealthStatus.HEALTHY);
    expect(result.responseTime).toBeLessThan(100);
  });

  it('should detect unhealthy services', async () => {
    const result = await serviceHealthMonitor.checkService('invalid' as ServiceName);
    expect(result.status).toBe(HealthStatus.UNHEALTHY);
    expect(result.error).toBeDefined();
  });

  it('should track history', async () => {
    await serviceHealthMonitor.checkService('fit-to-view');
    await serviceHealthMonitor.checkService('fit-to-view');

    const history = serviceHealthMonitor.getServiceHistory('fit-to-view');
    expect(history.length).toBe(2);
  });
});
```

## 📁 Files

```
services/
├── __health__/
│   ├── health-dashboard.html    # Visual monitoring dashboard
│   └── README.md                # This file
├── ServiceHealthMonitor.ts      # Core health monitoring logic
└── index.ts                     # Exports
```

## 🎓 Enterprise Patterns Used

1. **Observer Pattern** - Subscribe to health updates
2. **Singleton Pattern** - Single health monitor instance
3. **Strategy Pattern** - Configurable health check thresholds
4. **Command Pattern** - Start/stop monitoring commands
5. **Repository Pattern** - Health history storage

## 📚 References

- [Site Reliability Engineering (Google)](https://sre.google/books/)
- [The Twelve-Factor App - XI. Logs](https://12factor.net/logs)
- [Observability Engineering (Honeycomb)](https://www.honeycomb.io/observability-engineering)

---

**Created**: 2025-09-30
**Author**: Claude AI (Enterprise Architecture Assistant)
**Purpose**: Enterprise-grade service health monitoring
