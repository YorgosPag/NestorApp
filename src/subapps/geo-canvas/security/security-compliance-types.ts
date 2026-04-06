/**
 * 🔒 GEO-ALERT SECURITY & COMPLIANCE — TYPE DEFINITIONS
 *
 * All interfaces for security configuration, incidents, compliance,
 * and metrics. Extracted from SecurityCompliance.ts (ADR-065 SRP).
 */

export interface SecurityConfiguration {
  authentication: {
    method: 'JWT' | 'OAuth2' | 'SAML' | 'LDAP';
    tokenExpiry: number;
    refreshTokenExpiry: number;
    multiFactorEnabled: boolean;
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
      expiryDays: number;
    };
  };
  authorization: {
    rbacEnabled: boolean;
    roles: SecurityRole[];
    permissions: SecurityPermission[];
    sessionTimeout: number;
  };
  encryption: {
    algorithm: 'AES-256-GCM' | 'ChaCha20-Poly1305';
    keyRotationInterval: number;
    saltRounds: number;
    enableTLS: boolean;
    tlsVersion: '1.2' | '1.3';
  };
  monitoring: {
    enableSecurityLogs: boolean;
    enableIntrusionDetection: boolean;
    enableAnomalyDetection: boolean;
    alertThresholds: SecurityAlertThresholds;
  };
  compliance: {
    gdprEnabled: boolean;
    hipaaEnabled: boolean;
    iso27001Enabled: boolean;
    soc2Enabled: boolean;
    dataRetentionPeriod: number;
    auditLogRetention: number;
  };
}

export interface SecurityRole {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  level: 'admin' | 'operator' | 'viewer' | 'guest';
}

export interface SecurityPermission {
  id: string;
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'execute';
  scope: 'global' | 'organization' | 'project' | 'personal';
}

export interface SecurityAlertThresholds {
  failedLoginAttempts: number;
  suspiciousIPRequests: number;
  dataExfiltrationMB: number;
  privilegeEscalationEvents: number;
  anomalyScoreThreshold: number;
}

export interface VulnerabilityAssessment {
  id: string;
  timestamp: Date;
  scanType: 'automated' | 'manual' | 'penetration';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  vulnerabilities: SecurityVulnerability[];
  score: number;
  status: 'open' | 'in_progress' | 'resolved' | 'accepted_risk';
}

export interface SecurityVulnerability {
  id: string;
  cveId?: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cvssScore: number;
  affectedComponent: string;
  exploitability: 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  remediation: string;
  references: string[];
}

export interface SecurityIncident {
  id: string;
  timestamp: Date;
  type: 'data_breach' | 'unauthorized_access' | 'malware' | 'ddos' | 'insider_threat';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  affectedSystems: string[];
  responseTeam: string[];
  status: 'detected' | 'investigating' | 'containing' | 'resolved';
  timeline: SecurityIncidentEvent[];
}

export interface SecurityIncidentEvent {
  timestamp: Date;
  action: string;
  responsible: string;
  notes: string;
}

export interface SecurityAuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  sessionId: string;
  action: string;
  resource: string;
  ipAddress: string;
  userAgent: string;
  result: 'success' | 'failure' | 'blocked';
  riskScore: number;
  metadata: Record<string, unknown>;
}

export interface ComplianceReport {
  id: string;
  framework: 'GDPR' | 'HIPAA' | 'ISO27001' | 'SOC2' | 'PCI_DSS';
  generatedAt: Date;
  reportPeriod: {
    startDate: Date;
    endDate: Date;
  };
  complianceScore: number;
  findings: ComplianceFinding[];
  recommendations: string[];
  status: 'compliant' | 'non_compliant' | 'partially_compliant';
}

export interface ComplianceFinding {
  control: string;
  requirement: string;
  status: 'compliant' | 'non_compliant' | 'not_applicable';
  evidence: string[];
  gaps: string[];
  riskLevel: 'high' | 'medium' | 'low';
}

export interface SecurityMetrics {
  timestamp: Date;
  authentication: {
    totalLogins: number;
    failedLogins: number;
    activeSessions: number;
    mfaAdoption: number;
  };
  vulnerabilities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    resolved: number;
  };
  incidents: {
    total: number;
    critical: number;
    resolved: number;
    averageResolutionTime: number;
  };
  compliance: {
    gdprScore: number;
    iso27001Score: number;
    overallScore: number;
  };
  threats: {
    blockedAttacks: number;
    malwareDetected: number;
    anomaliesDetected: number;
    riskScore: number;
  };
}
