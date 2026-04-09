/**
 * 📧 COMMUNICATION IMPACT PREVIEW — Thin Wrapper
 *
 * Delegates to the unified ContactImpactEngine for dependency queries.
 * Maps generic result to the CommunicationImpactPreview shape
 * expected by the CommunicationImpactDialog.
 *
 * Now supports ALL contact types (individual, company, service),
 * not just company. The registry handles per-type filtering.
 *
 * @module lib/firestore/communication-impact-preview
 * @enterprise ADR-280 — Communication Field Impact Detection
 */

import 'server-only';

import { computeContactImpact, findDependencyCount } from './contact-impact-engine';
import type { ContactType } from '@/types/contacts';

// ============================================================================
// TYPES
// ============================================================================

export interface CommunicationImpactPreview {
  readonly totalAffected: number;
  readonly properties: number;
  readonly paymentPlans: number;
  readonly projects: number;
  readonly communications: number;
  readonly invoices: number;
  readonly apyCertificates: number;
}

// ============================================================================
// PREVIEW
// ============================================================================

export async function previewCommunicationImpact(
  contactId: string,
  contactType: ContactType = 'company',
): Promise<CommunicationImpactPreview> {
  const result = await computeContactImpact(contactId, 'communicationChange', contactType);

  return {
    totalAffected: result.totalAffected,
    properties: findDependencyCount(result, 'properties'),
    paymentPlans: findDependencyCount(result, 'propertyPaymentPlans'),
    projects: findDependencyCount(result, 'projectsAsCompany'),
    communications: findDependencyCount(result, 'communications'),
    invoices: findDependencyCount(result, 'invoices'),
    apyCertificates: findDependencyCount(result, 'apyCertificates'),
  };
}
