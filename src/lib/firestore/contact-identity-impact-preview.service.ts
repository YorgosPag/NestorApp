/**
 * 👤 INDIVIDUAL IDENTITY IMPACT PREVIEW — Thin Wrapper
 *
 * Delegates to the unified ContactImpactEngine for dependency queries.
 * Preserves the field-category-specific blocking logic (e.g., AMKA change
 * blocks if attendance records exist, other identity changes only warn).
 *
 * @module lib/firestore/contact-identity-impact-preview
 * @enterprise ADR-145 — Contact Dependency SSoT
 */

import 'server-only';

import { computeContactImpact } from './contact-impact-engine';
import type {
  ContactIdentityAffectedDomainId,
  ContactIdentityImpactDependency,
  ContactIdentityImpactPreview,
} from '@/types/contact-identity-impact';
import type { IndividualIdentityFieldChange } from '@/utils/contactForm/individual-identity-guard';

// ============================================================================
// FIELD CATEGORY SETS
// ============================================================================

const DISPLAY_FIELDS = new Set(['firstName', 'lastName']);
const IDENTITY_FIELDS = new Set(['fatherName', 'motherName', 'birthDate', 'birthCountry', 'gender']);
const REGULATED_FIELDS = new Set(['amka', 'documentType', 'documentIssuer', 'documentNumber', 'documentIssueDate', 'documentExpiryDate']);

function hasAnyField(
  changes: ReadonlyArray<IndividualIdentityFieldChange>,
  fields: ReadonlySet<string>,
): boolean {
  return changes.some((c) => fields.has(c.field));
}

function buildAffectedDomains(
  changes: ReadonlyArray<IndividualIdentityFieldChange>,
): ReadonlyArray<ContactIdentityAffectedDomainId> {
  const domains = new Set<ContactIdentityAffectedDomainId>();

  if (hasAnyField(changes, DISPLAY_FIELDS)) {
    domains.add('linkedProjects');
    domains.add('searchAndReporting');
  }
  if (hasAnyField(changes, IDENTITY_FIELDS)) {
    domains.add('searchAndReporting');
  }
  if (changes.some((c) => c.field === 'amka')) {
    domains.add('ikaAttendance');
    domains.add('employmentCompliance');
  }
  if (hasAnyField(changes, REGULATED_FIELDS)) {
    domains.add('documentsAndIdentifiers');
  }

  return [...domains];
}

function extractFieldCategories(
  changes: ReadonlyArray<IndividualIdentityFieldChange>,
): ReadonlyArray<string> {
  const categories = new Set<string>();
  for (const change of changes) {
    categories.add(change.category);
  }
  return [...categories];
}

// ============================================================================
// PREVIEW
// ============================================================================

export async function previewContactIdentityImpact(
  contactId: string,
  changes: ReadonlyArray<IndividualIdentityFieldChange>,
): Promise<ContactIdentityImpactPreview> {
  if (changes.length === 0) {
    return {
      mode: 'allow', changes, dependencies: [], affectedDomains: [],
      messageKey: 'identityImpact.messages.allow', blockingCount: 0, warningCount: 0,
    };
  }

  const hasAmkaChange = changes.some((c) => c.field === 'amka');
  const fieldCategories = extractFieldCategories(changes);

  try {
    const result = await computeContactImpact(
      contactId, 'identityChange', 'individual', undefined, fieldCategories,
    );

    // Map engine results to identity-specific dependency format
    const dependencies: ContactIdentityImpactDependency[] = result.dependencies
      .filter((dep) => ['projectLinks', 'attendanceEvents', 'employmentRecords', 'opportunities', 'properties', 'parking', 'storage', 'communications', 'projectsAsLandowner', 'contactRelationships'].includes(dep.id))
      .map((dep) => ({
        id: mapToLegacyDependencyId(dep.id),
        count: dep.count,
        mode: resolveIdentityMode(dep.id, hasAmkaChange),
      }));

    const blockingCount = dependencies
      .filter((d) => d.mode === 'block')
      .reduce((sum, d) => sum + d.count, 0);
    const warningCount = dependencies
      .filter((d) => d.mode === 'warn')
      .reduce((sum, d) => sum + d.count, 0);

    const affectedDomains = buildAffectedDomains(changes);

    let mode: ContactIdentityImpactPreview['mode'] = 'allow';
    if (blockingCount > 0) mode = 'block';
    else if (warningCount > 0 || affectedDomains.length > 0) mode = 'warn';

    return {
      mode, changes, dependencies, affectedDomains,
      messageKey: `identityImpact.messages.${mode}`, blockingCount, warningCount,
    };
  } catch {
    return {
      mode: 'block', changes, dependencies: [], affectedDomains: buildAffectedDomains(changes),
      messageKey: 'identityImpact.messages.unavailable', blockingCount: 0, warningCount: 0,
    };
  }
}

// ============================================================================
// MAPPING HELPERS
// ============================================================================

function mapToLegacyDependencyId(engineId: string): 'projectLinks' | 'attendanceEvents' | 'employmentRecords' | 'contactRelationships' {
  switch (engineId) {
    case 'projectLinks': return 'projectLinks';
    case 'attendanceEvents': return 'attendanceEvents';
    case 'employmentRecords': return 'employmentRecords';
    case 'contactRelationships': return 'contactRelationships';
    default: return 'projectLinks';
  }
}

function resolveIdentityMode(depId: string, hasAmkaChange: boolean): 'warn' | 'block' {
  if ((depId === 'attendanceEvents' || depId === 'employmentRecords') && hasAmkaChange) {
    return 'block';
  }
  return 'warn';
}
