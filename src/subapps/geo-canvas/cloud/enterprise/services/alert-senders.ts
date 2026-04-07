/**
 * ALERT SENDERS - Infrastructure & Performance alert creation
 *
 * Extracted from alert-service.ts for SRP compliance (ADR-065)
 * Contains all alert sending functions + description builders
 *
 * @module enterprise/services/alert-senders
 * @version 1.0.0
 */

import { createModuleLogger } from '@/lib/telemetry';
import type { InfrastructureStatus, ComponentStatus } from '../types/infrastructure';
import type { SecurityIncident } from '../types/status';

const logger = createModuleLogger('AlertSenders');

// ============================================================================
// Types
// ============================================================================

/** Alert severity levels */
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical' | 'info';

/** Alert creation arguments */
type CreateAlertArgs = [
  type: string,
  title: string,
  description: string,
  severity: AlertSeverity,
  source: string,
  metadata?: Record<string, unknown>
];

/** Alert engine interface (subset used by senders) */
export interface AlertEngineSender {
  createAlert: (...args: CreateAlertArgs) => { id: string; type: string };
}

// ============================================================================
// DESCRIPTION BUILDERS
// ============================================================================

/**
 * Build health alert description
 */
export function buildHealthAlertDescription(
  status: InfrastructureStatus,
  alertType: 'critical' | 'degraded' | 'recovered'
): string {
  const { overall, components } = status;

  const healthyComponents = components.filter(c => c.health === 'healthy').length;
  const warningComponents = components.filter(c => c.health === 'warning').length;
  const criticalComponents = components.filter(c => c.health === 'critical').length;

  let description = `Infrastructure health is ${overall.health}. `;
  description += `Availability: ${overall.availability.toFixed(1)}%. `;
  description += `Components: ${healthyComponents} healthy, ${warningComponents} warning, ${criticalComponents} critical.`;

  if (alertType === 'recovered') {
    description += ' System has recovered to normal operation.';
  } else if (alertType === 'critical') {
    description += ' Immediate attention required.';
  }

  return description;
}

/**
 * Build component alert description
 */
export function buildComponentAlertDescription(
  component: ComponentStatus,
  alertType: 'failure' | 'recovery' | 'degradation'
): string {
  let description = `Component ${component.name} (${component.type}) `;
  description += `in ${component.provider}/${component.region} `;

  switch (alertType) {
    case 'failure':
      description += `has failed. Status: ${component.status}, Health: ${component.health}`;
      if (component.errors.length > 0) {
        description += `. Errors: ${component.errors.map(e => e.message).join(', ')}`;
      }
      break;
    case 'degradation':
      description += `is experiencing degraded performance. Health: ${component.health}`;
      break;
    case 'recovery':
      description += `has recovered. Status: ${component.status}`;
      break;
  }

  return description;
}

// ============================================================================
// INFRASTRUCTURE ALERT SENDERS
// ============================================================================

/**
 * Send infrastructure health alert
 */
export async function sendHealthAlert(
  engine: AlertEngineSender,
  status: InfrastructureStatus,
  alertType: 'critical' | 'degraded' | 'recovered'
): Promise<void> {
  try {
    const severity = alertType === 'critical' ? 'critical' :
                   alertType === 'degraded' ? 'high' : 'medium';

    const title = `Infrastructure ${alertType === 'recovered' ? 'Recovery' : 'Health Alert'}`;
    const description = buildHealthAlertDescription(status, alertType);

    engine.createAlert(
      'infrastructure-health',
      title,
      description,
      severity,
      'cloud-infrastructure',
      {
        overall: status.overall,
        timestamp: status.timestamp,
        componentCount: status.components.length,
        providerCount: status.providers.length
      }
    );
  } catch (error) {
    logger.error('Failed to send health alert', { error });
  }
}

/**
 * Send component failure alert
 */
export async function sendComponentAlert(
  engine: AlertEngineSender,
  component: ComponentStatus,
  alertType: 'failure' | 'recovery' | 'degradation'
): Promise<void> {
  try {
    const severity = alertType === 'failure' ? 'high' :
                   alertType === 'degradation' ? 'medium' : 'low';

    const title = `Component ${component.name} ${alertType === 'recovery' ? 'Recovered' : 'Issue'}`;
    const description = buildComponentAlertDescription(component, alertType);

    engine.createAlert(
      'component-alert',
      title,
      description,
      severity,
      'cloud-infrastructure',
      {
        componentId: component.id,
        componentType: component.type,
        provider: component.provider,
        region: component.region,
        status: component.status,
        health: component.health
      }
    );
  } catch (error) {
    logger.error('Failed to send component alert', { error });
  }
}

/**
 * Send cost threshold alert
 */
export async function sendCostAlert(
  engine: AlertEngineSender,
  currentSpend: number,
  budgetLimit: number,
  utilizationPercent: number
): Promise<void> {
  try {
    const severity = utilizationPercent > 95 ? 'critical' :
                   utilizationPercent > 80 ? 'high' : 'medium';

    const title = `Budget Alert: ${utilizationPercent.toFixed(1)}% Utilized`;
    const description = `Current spending: $${currentSpend.toFixed(2)} of $${budgetLimit.toFixed(2)} budget (${utilizationPercent.toFixed(1)}% utilized)`;

    engine.createAlert(
      'cost-threshold',
      title,
      description,
      severity,
      'cloud-infrastructure',
      {
        currentSpend,
        budgetLimit,
        utilizationPercent,
        remainingBudget: budgetLimit - currentSpend
      }
    );
  } catch (error) {
    logger.error('Failed to send cost alert', { error });
  }
}

/**
 * Send security incident alert
 */
export async function sendSecurityAlert(
  engine: AlertEngineSender,
  incident: SecurityIncident
): Promise<void> {
  try {
    const title = `Security Incident: ${incident.type.toUpperCase()}`;
    const description = `${incident.severity.toUpperCase()} security incident detected. ${incident.impact}`;

    engine.createAlert(
      'security-incident',
      title,
      description,
      incident.severity as AlertSeverity,
      'cloud-infrastructure',
      {
        incidentId: incident.id,
        incidentType: incident.type,
        affectedSystems: incident.affectedSystems,
        status: incident.status,
        startTime: incident.startTime
      }
    );
  } catch (error) {
    logger.error('Failed to send security alert', { error });
  }
}

// ============================================================================
// PERFORMANCE ALERT SENDERS
// ============================================================================

/**
 * Send performance degradation alert
 */
export async function sendPerformanceAlert(
  engine: AlertEngineSender,
  metric: string,
  currentValue: number,
  threshold: number,
  unit: string = ''
): Promise<void> {
  try {
    const severity = currentValue > threshold * 1.5 ? 'high' : 'medium';
    const title = `Performance Alert: ${metric}`;
    const description = `${metric} is ${currentValue}${unit}, exceeding threshold of ${threshold}${unit}`;

    engine.createAlert(
      'performance-degradation',
      title,
      description,
      severity,
      'cloud-infrastructure',
      {
        metric,
        currentValue,
        threshold,
        unit,
        exceedancePercent: ((currentValue - threshold) / threshold * 100)
      }
    );
  } catch (error) {
    logger.error('Failed to send performance alert', { error });
  }
}

/**
 * Send availability alert
 */
export async function sendAvailabilityAlert(
  engine: AlertEngineSender,
  currentAvailability: number,
  slaTarget: number,
  timeWindow: string = '24h'
): Promise<void> {
  try {
    const severity = currentAvailability < slaTarget * 0.9 ? 'critical' : 'high';
    const title = `Availability SLA Breach`;
    const description = `Current availability ${currentAvailability.toFixed(2)}% is below SLA target of ${slaTarget}% (${timeWindow})`;

    engine.createAlert(
      'sla-breach',
      title,
      description,
      severity,
      'cloud-infrastructure',
      {
        currentAvailability,
        slaTarget,
        timeWindow,
        breach: slaTarget - currentAvailability
      }
    );
  } catch (error) {
    logger.error('Failed to send availability alert', { error });
  }
}
