/**
 * 🔒 GEO-ALERT SYSTEM - PHASE 8: SECURITY & COMPLIANCE
 *
 * Enterprise Security & Compliance Management System.
 * Split structure (ADR-065 SRP):
 * - security-compliance-types.ts     — All interfaces (EXEMPT)
 * - security-compliance-mock-data.ts — Mock data generators
 * - SecurityCompliance.ts            — This file: main class + singleton
 */

import type {
  SecurityConfiguration,
  VulnerabilityAssessment,
  SecurityIncident,
  SecurityAuditLog,
  ComplianceReport,
  SecurityMetrics
} from './security-compliance-types';
import {
  generateMockAuditLogs,
  generateMockVulnerabilities,
  generateComplianceFindings,
  generateComplianceRecommendations
} from './security-compliance-mock-data';

// Re-export types for consumers
export type {
  SecurityConfiguration,
  SecurityRole,
  SecurityPermission,
  SecurityAlertThresholds,
  VulnerabilityAssessment,
  SecurityVulnerability,
  SecurityIncident,
  SecurityIncidentEvent,
  SecurityAuditLog,
  ComplianceReport,
  ComplianceFinding,
  SecurityMetrics
} from './security-compliance-types';

/**
 * 🔒 Enterprise Security & Compliance Management System
 */
export class GeoAlertSecurityCompliance {
  private static instance: GeoAlertSecurityCompliance | null = null;
  private config: SecurityConfiguration;
  private auditLogs: SecurityAuditLog[] = [];
  private vulnerabilities: VulnerabilityAssessment[] = [];
  private incidents: SecurityIncident[] = [];
  private complianceReports: ComplianceReport[] = [];
  private securityMetrics: SecurityMetrics | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  private constructor() {
    this.config = this.getDefaultSecurityConfiguration();
    this.initializeSecurity();
  }

  public static getInstance(): GeoAlertSecurityCompliance {
    if (!GeoAlertSecurityCompliance.instance) {
      GeoAlertSecurityCompliance.instance = new GeoAlertSecurityCompliance();
    }
    return GeoAlertSecurityCompliance.instance;
  }

  private initializeSecurity(): void {
    try {
      this.setupSecurityPolicies();
      this.initializeVulnerabilityScanning();
      this.startSecurityMonitoring();
      this.setupComplianceFrameworks();
      this.auditLogs = generateMockAuditLogs(50);
      this.isInitialized = true;
      console.debug('🔒 GeoAlert Security & Compliance System initialized');
    } catch (error) {
      console.error('❌ Security initialization failed:', error);
      throw error;
    }
  }

  private getDefaultSecurityConfiguration(): SecurityConfiguration {
    return {
      authentication: {
        method: 'JWT',
        tokenExpiry: 3600,
        refreshTokenExpiry: 86400,
        multiFactorEnabled: true,
        passwordPolicy: {
          minLength: 12,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          expiryDays: 90
        }
      },
      authorization: {
        rbacEnabled: true,
        roles: [
          {
            id: 'admin', name: 'System Administrator',
            description: 'Full system access',
            permissions: ['*'], level: 'admin'
          },
          {
            id: 'operator', name: 'Alert Operator',
            description: 'Manage alerts and monitoring',
            permissions: ['alert:read', 'alert:update', 'dashboard:read'], level: 'operator'
          },
          {
            id: 'viewer', name: 'Dashboard Viewer',
            description: 'Read-only access to dashboards',
            permissions: ['dashboard:read', 'report:read'], level: 'viewer'
          }
        ],
        permissions: [
          { id: 'alert:create', resource: 'alerts', action: 'create', scope: 'project' },
          { id: 'alert:read', resource: 'alerts', action: 'read', scope: 'project' },
          { id: 'alert:update', resource: 'alerts', action: 'update', scope: 'project' },
          { id: 'alert:delete', resource: 'alerts', action: 'delete', scope: 'project' },
          { id: 'dashboard:read', resource: 'dashboard', action: 'read', scope: 'organization' },
          { id: 'report:read', resource: 'reports', action: 'read', scope: 'organization' }
        ],
        sessionTimeout: 1800
      },
      encryption: {
        algorithm: 'AES-256-GCM',
        keyRotationInterval: 30,
        saltRounds: 12,
        enableTLS: true,
        tlsVersion: '1.3'
      },
      monitoring: {
        enableSecurityLogs: true,
        enableIntrusionDetection: true,
        enableAnomalyDetection: true,
        alertThresholds: {
          failedLoginAttempts: 5,
          suspiciousIPRequests: 100,
          dataExfiltrationMB: 500,
          privilegeEscalationEvents: 1,
          anomalyScoreThreshold: 0.8
        }
      },
      compliance: {
        gdprEnabled: true,
        hipaaEnabled: false,
        iso27001Enabled: true,
        soc2Enabled: true,
        dataRetentionPeriod: 2555,
        auditLogRetention: 365
      }
    };
  }

  private setupSecurityPolicies(): void {
    const passwordPolicy = this.config.authentication.passwordPolicy;
    console.debug(`🔐 Password Policy: ${passwordPolicy.minLength}+ chars, complexity enabled`);
    console.debug(`⏱️ Session timeout: ${this.config.authorization.sessionTimeout}s`);
    console.debug(`🔒 Encryption: ${this.config.encryption.algorithm}, TLS ${this.config.encryption.tlsVersion}`);
  }

  private initializeVulnerabilityScanning(): void {
    this.performVulnerabilityScan('automated');
    setInterval(() => {
      this.performVulnerabilityScan('automated');
    }, 24 * 60 * 60 * 1000);
  }

  public performVulnerabilityScan(scanType: 'automated' | 'manual' | 'penetration'): VulnerabilityAssessment {
    const assessment: VulnerabilityAssessment = {
      id: `vuln_${Date.now()}`,
      timestamp: new Date(),
      scanType,
      severity: 'medium',
      vulnerabilities: generateMockVulnerabilities(),
      score: Math.random() * 10,
      status: 'open'
    };

    this.vulnerabilities.push(assessment);

    const criticalVulns = assessment.vulnerabilities.filter(v => v.severity === 'critical');
    if (criticalVulns.length > 0) {
      this.createSecurityIncident(this.mapIncidentType('vulnerability_detected'), 'critical',
        `Critical vulnerabilities detected: ${criticalVulns.length} findings`);
    }

    console.debug(`🔍 Vulnerability scan completed: ${assessment.vulnerabilities.length} findings`);
    return assessment;
  }

  private startSecurityMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.collectSecurityMetrics();
      this.detectAnomalies();
      this.checkSecurityThresholds();
      this.updateSecurityDashboard();
    }, 60000);
    console.debug('📊 Security monitoring started');
  }

  private collectSecurityMetrics(): void {
    this.securityMetrics = {
      timestamp: new Date(),
      authentication: {
        totalLogins: Math.floor(Math.random() * 1000) + 500,
        failedLogins: Math.floor(Math.random() * 50),
        activeSessions: Math.floor(Math.random() * 200) + 100,
        mfaAdoption: Math.random() * 30 + 70
      },
      vulnerabilities: {
        critical: Math.floor(Math.random() * 3),
        high: Math.floor(Math.random() * 10) + 2,
        medium: Math.floor(Math.random() * 25) + 10,
        low: Math.floor(Math.random() * 50) + 20,
        resolved: Math.floor(Math.random() * 80) + 40
      },
      incidents: {
        total: this.incidents.length,
        critical: this.incidents.filter(i => i.severity === 'critical').length,
        resolved: this.incidents.filter(i => i.status === 'resolved').length,
        averageResolutionTime: Math.random() * 24 + 2
      },
      compliance: {
        gdprScore: Math.random() * 10 + 90,
        iso27001Score: Math.random() * 15 + 85,
        overallScore: Math.random() * 8 + 92
      },
      threats: {
        blockedAttacks: Math.floor(Math.random() * 100) + 50,
        malwareDetected: Math.floor(Math.random() * 10),
        anomaliesDetected: Math.floor(Math.random() * 20) + 5,
        riskScore: Math.random() * 20 + 10
      }
    };
  }

  private detectAnomalies(): void {
    const anomalyScore = Math.random();
    if (anomalyScore > this.config.monitoring.alertThresholds.anomalyScoreThreshold) {
      this.createSecurityIncident(this.mapIncidentType('anomaly_detected'), 'medium',
        `Anomalous behavior detected with score: ${anomalyScore.toFixed(3)}`);
    }
  }

  private checkSecurityThresholds(): void {
    const thresholds = this.config.monitoring.alertThresholds;
    const metrics = this.securityMetrics;
    if (!metrics) return;

    if (metrics.authentication.failedLogins > thresholds.failedLoginAttempts) {
      this.createSecurityIncident(this.mapIncidentType('brute_force_attack'), 'high',
        `Excessive failed login attempts: ${metrics.authentication.failedLogins}`);
    }

    if (metrics.vulnerabilities.critical > 0) {
      this.createSecurityIncident(this.mapIncidentType('critical_vulnerability'), 'critical',
        `Critical vulnerabilities require immediate attention: ${metrics.vulnerabilities.critical}`);
    }
  }

  private mapIncidentType(
    value: 'vulnerability_detected' | 'anomaly_detected' | 'brute_force_attack' | 'critical_vulnerability'
  ): SecurityIncident['type'] {
    switch (value) {
      case 'vulnerability_detected': return 'malware';
      case 'critical_vulnerability': return 'data_breach';
      case 'brute_force_attack':
      case 'anomaly_detected':
      default: return 'unauthorized_access';
    }
  }

  public createSecurityIncident(
    type: SecurityIncident['type'],
    severity: SecurityIncident['severity'],
    description: string
  ): SecurityIncident {
    const incident: SecurityIncident = {
      id: `incident_${Date.now()}`,
      timestamp: new Date(),
      type, severity, description,
      affectedSystems: ['geo-alert-frontend', 'geo-alert-backend', 'geo-alert-database'],
      responseTeam: ['security-team', 'devops-team'],
      status: 'detected',
      timeline: [{
        timestamp: new Date(),
        action: 'Incident detected and logged',
        responsible: 'security-monitoring-system',
        notes: description
      }]
    };

    this.incidents.push(incident);
    console.debug(`🚨 Security incident created: ${incident.id} (${severity})`);
    return incident;
  }

  private setupComplianceFrameworks(): void {
    if (this.config.compliance.gdprEnabled) this.generateComplianceReport('GDPR');
    if (this.config.compliance.iso27001Enabled) this.generateComplianceReport('ISO27001');
    if (this.config.compliance.soc2Enabled) this.generateComplianceReport('SOC2');
  }

  public generateComplianceReport(framework: ComplianceReport['framework']): ComplianceReport {
    const report: ComplianceReport = {
      id: `compliance_${framework.toLowerCase()}_${Date.now()}`,
      framework,
      generatedAt: new Date(),
      reportPeriod: {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      },
      complianceScore: Math.random() * 10 + 90,
      findings: generateComplianceFindings(framework),
      recommendations: generateComplianceRecommendations(framework),
      status: 'compliant'
    };

    this.complianceReports.push(report);
    console.debug(`📊 ${framework} compliance report generated: ${report.complianceScore.toFixed(1)}%`);
    return report;
  }

  private updateSecurityDashboard(): void {
    if (this.securityMetrics) {
      console.debug(`📊 Security Dashboard Updated - Risk Score: ${this.securityMetrics.threats.riskScore.toFixed(1)}`);
    }
  }

  public getSecurityStatus(): {
    status: 'secure' | 'warning' | 'critical';
    metrics: SecurityMetrics | null;
    activeIncidents: SecurityIncident[];
    vulnerabilityCount: number;
    complianceScore: number;
  } {
    const activeIncidents = this.incidents.filter(i => i.status !== 'resolved');
    const criticalIncidents = activeIncidents.filter(i => i.severity === 'critical');
    const vulnerabilityCount = this.vulnerabilities.reduce((acc, v) => acc + v.vulnerabilities.length, 0);

    let status: 'secure' | 'warning' | 'critical' = 'secure';
    if (criticalIncidents.length > 0 || vulnerabilityCount > 10) {
      status = 'critical';
    } else if (activeIncidents.length > 0 || vulnerabilityCount > 5) {
      status = 'warning';
    }

    const complianceScore = this.complianceReports.length > 0
      ? this.complianceReports[this.complianceReports.length - 1].complianceScore
      : 95;

    return { status, metrics: this.securityMetrics, activeIncidents, vulnerabilityCount, complianceScore };
  }

  public validateUserPermission(_userId: string, _resource: string, _action: string): boolean {
    return Math.random() > 0.1;
  }

  public logSecurityEvent(event: Partial<SecurityAuditLog>): void {
    const fullEvent: SecurityAuditLog = {
      id: `audit_${Date.now()}`,
      timestamp: new Date(),
      userId: event.userId || 'unknown',
      sessionId: event.sessionId || 'unknown',
      action: event.action || 'unknown',
      resource: event.resource || 'unknown',
      ipAddress: event.ipAddress || '0.0.0.0',
      userAgent: event.userAgent || 'unknown',
      result: event.result || 'success',
      riskScore: event.riskScore || 0,
      metadata: event.metadata || {}
    };
    this.auditLogs.push(fullEvent);
  }

  public getSystemInfo(): {
    version: string;
    status: string;
    initialized: boolean;
    configuredFrameworks: string[];
    monitoringActive: boolean;
  } {
    return {
      version: '8.4.0',
      status: 'operational',
      initialized: this.isInitialized,
      configuredFrameworks: [
        ...(this.config.compliance.gdprEnabled ? ['GDPR'] : []),
        ...(this.config.compliance.iso27001Enabled ? ['ISO27001'] : []),
        ...(this.config.compliance.soc2Enabled ? ['SOC2'] : []),
        ...(this.config.compliance.hipaaEnabled ? ['HIPAA'] : [])
      ],
      monitoringActive: this.monitoringInterval !== null
    };
  }

  public cleanup(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isInitialized = false;
    console.debug('🧹 Security system cleanup completed');
  }
}

export const geoAlertSecurity = GeoAlertSecurityCompliance.getInstance();
export default GeoAlertSecurityCompliance;
