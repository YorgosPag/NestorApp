/**
 * 📍 ADDRESS IMPACT PREVIEW — Thin Wrapper
 *
 * Delegates to the unified ContactImpactEngine for dependency queries.
 * Maps generic result to the AddressImpactPreview shape
 * expected by the AddressImpactDialog.
 *
 * @module lib/firestore/address-impact-preview
 * @enterprise ADR-277 — Address Impact Guard
 */

import 'server-only';

import { computeContactImpact, findDependencyCount } from './contact-impact-engine';

// ============================================================================
// TYPES
// ============================================================================

export interface AddressImpactPreview {
  readonly totalAffected: number;
  readonly properties: number;
  readonly paymentPlans: number;
  readonly invoices: number;
  readonly apyCertificates: number;
}

// ============================================================================
// PREVIEW
// ============================================================================

export async function previewAddressImpact(
  contactId: string,
): Promise<AddressImpactPreview> {
  const result = await computeContactImpact(contactId, 'addressChange', 'company');

  return {
    totalAffected: result.totalAffected,
    properties: findDependencyCount(result, 'properties'),
    paymentPlans: findDependencyCount(result, 'propertyPaymentPlans'),
    invoices: findDependencyCount(result, 'invoices'),
    apyCertificates: findDependencyCount(result, 'apyCertificates'),
  };
}
