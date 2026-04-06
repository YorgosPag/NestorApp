/**
 * 🔒 GEO-ALERT SECURITY — MOCK DATA GENERATORS
 *
 * Mock data generation for security testing and demo purposes.
 * Extracted from SecurityCompliance.ts (ADR-065 SRP).
 */

import type {
  SecurityAuditLog,
  SecurityVulnerability,
  ComplianceFinding
} from './security-compliance-types';

/**
 * Generate mock audit log entries for testing
 */
export function generateMockAuditLogs(count: number): SecurityAuditLog[] {
  const logs: SecurityAuditLog[] = [];
  const actions = ['login', 'logout', 'view_dashboard', 'create_alert', 'update_settings'];
  const resources = ['dashboard', 'alerts', 'users', 'settings'];

  for (let i = 0; i < count; i++) {
    logs.push({
      id: `audit_${Date.now()}_${i}`,
      timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      userId: `user_${Math.floor(Math.random() * 100)}`,
      sessionId: `session_${Math.random().toString(36).substr(2, 9)}`,
      action: actions[Math.floor(Math.random() * actions.length)],
      resource: resources[Math.floor(Math.random() * resources.length)],
      ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      result: Math.random() > 0.1 ? 'success' : 'failure',
      riskScore: Math.random() * 100,
      metadata: { additional: 'mock_data' }
    });
  }

  return logs;
}

/**
 * Generate mock vulnerability findings
 */
export function generateMockVulnerabilities(): SecurityVulnerability[] {
  return [
    {
      id: 'vuln_001',
      cveId: 'CVE-2024-0001',
      title: 'Cross-Site Scripting (XSS) in Dashboard',
      description: 'Potential XSS vulnerability in user input validation',
      severity: 'medium',
      cvssScore: 5.4,
      affectedComponent: 'geo-alert-frontend',
      exploitability: 'medium',
      impact: 'medium',
      remediation: 'Implement proper input sanitization and CSP headers',
      references: ['https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2024-0001']
    },
    {
      id: 'vuln_002',
      title: 'Outdated Dependencies',
      description: 'Several npm packages have known vulnerabilities',
      severity: 'low',
      cvssScore: 3.1,
      affectedComponent: 'geo-alert-backend',
      exploitability: 'low',
      impact: 'low',
      remediation: 'Update dependencies to latest secure versions',
      references: []
    }
  ];
}

/**
 * Generate mock compliance findings for a framework
 */
export function generateComplianceFindings(framework: string): ComplianceFinding[] {
  return [
    {
      control: `${framework}-AC-01`,
      requirement: 'Access Control Policies and Procedures',
      status: 'compliant',
      evidence: ['Security policy document', 'RBAC implementation'],
      gaps: [],
      riskLevel: 'low'
    },
    {
      control: `${framework}-AU-01`,
      requirement: 'Audit and Accountability',
      status: 'compliant',
      evidence: ['Audit log system', 'Security monitoring'],
      gaps: [],
      riskLevel: 'low'
    },
    {
      control: `${framework}-SC-01`,
      requirement: 'System and Communications Protection',
      status: 'non_compliant',
      evidence: ['TLS encryption', 'Data encryption at rest'],
      gaps: ['Missing network segmentation'],
      riskLevel: 'medium'
    }
  ];
}

/**
 * Generate compliance recommendations
 */
export function generateComplianceRecommendations(_framework: string): string[] {
  return [
    'Implement network segmentation for better isolation',
    'Enhance monitoring and alerting capabilities',
    'Conduct regular security awareness training',
    'Implement automated vulnerability scanning',
    'Review and update incident response procedures'
  ];
}
