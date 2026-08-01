/**
 * 🔧 SERVICE IDENTITY IMPACT PREVIEW — Thin Wrapper
 *
 * Delegates to the unified ContactImpactEngine for dependency queries.
 * Maps generic result to the ContactIdentityImpactPreview shape
 * expected by the ContactIdentityImpactDialog.
 *
 * @module lib/firestore/service-identity-impact-preview
 * @enterprise ADR-145 — Contact Dependency SSoT
 */

import 'server-only';

import { computeContactImpact } from './contact-impact-engine';
import {
  allowIdentityImpact,
  unavailableIdentityImpact,
} from './contact-identity-impact-primitives';
import type {
  ContactIdentityImpactDependency,
  ContactIdentityImpactPreview,
} from '@/types/contact-identity-impact';
import type { ServiceIdentityFieldChange } from '@/utils/contactForm/service-identity-guard';

// ============================================================================
// PREVIEW
// ============================================================================

export async function previewServiceIdentityImpact(
  contactId: string,
  companyId: string,
  changes: ReadonlyArray<ServiceIdentityFieldChange>,
): Promise<ContactIdentityImpactPreview> {
  if (changes.length === 0) {
    return allowIdentityImpact(changes);
  }

  try {
    const result = await computeContactImpact(contactId, 'identityChange', 'service', companyId);

    const dependencies: ContactIdentityImpactDependency[] = result.dependencies.map((dep) => ({
      id: dep.id === 'contactRelationships' ? 'contactRelationships' as const : 'projectLinks' as const,
      count: dep.count,
      mode: 'warn' as const,
    }));

    const warningCount = dependencies.reduce((sum, d) => sum + d.count, 0);
    const affectedDomains = warningCount > 0
      ? ['linkedProjects' as const, 'searchAndReporting' as const, 'relationshipViews' as const]
      : ['searchAndReporting' as const];

    return {
      mode: warningCount > 0 ? 'warn' : 'allow',
      changes, dependencies, affectedDomains,
      messageKey: `identityImpact.messages.${warningCount > 0 ? 'warn' : 'allow'}`,
      blockingCount: 0, warningCount,
    };
  } catch {
    return unavailableIdentityImpact(changes, ['searchAndReporting', 'relationshipViews']);
  }
}
