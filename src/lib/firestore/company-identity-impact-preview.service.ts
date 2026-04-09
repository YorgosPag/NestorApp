/**
 * 🏢 COMPANY IDENTITY IMPACT PREVIEW — Thin Wrapper
 *
 * Delegates to the unified ContactImpactEngine for dependency queries.
 * Maps generic result to the CompanyIdentityImpactPreview shape
 * expected by the CompanyIdentityImpactDialog.
 *
 * @module lib/firestore/company-identity-impact-preview
 * @enterprise ADR-278 — Company Identity Field Guard
 */

import 'server-only';

import { computeContactImpact, findDependencyCount } from './contact-impact-engine';

// ============================================================================
// TYPES
// ============================================================================

export interface CompanyIdentityImpactPreview {
  readonly totalAffected: number;
  readonly projects: number;
  readonly properties: number;
  readonly obligations: number;
  readonly parking: number;
  readonly storage: number;
  readonly invoices: number;
  readonly apyCertificates: number;
}

// ============================================================================
// PREVIEW
// ============================================================================

export async function previewCompanyIdentityImpact(
  contactId: string,
): Promise<CompanyIdentityImpactPreview> {
  const result = await computeContactImpact(contactId, 'companyIdentityChange', 'company');

  return {
    totalAffected: result.totalAffected,
    projects: findDependencyCount(result, 'projectsAsCompany'),
    properties: findDependencyCount(result, 'properties'),
    obligations: findDependencyCount(result, 'obligations'),
    parking: findDependencyCount(result, 'parking'),
    storage: findDependencyCount(result, 'storage'),
    invoices: findDependencyCount(result, 'invoices'),
    apyCertificates: findDependencyCount(result, 'apyCertificates'),
  };
}
