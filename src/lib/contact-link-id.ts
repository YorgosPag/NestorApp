/**
 * =============================================================================
 * Contact Link ID Generator — SSOT (Pure Function, Zero Dependencies)
 * =============================================================================
 *
 * Single source of truth for contact_link document ID generation.
 * Used by both client-side (AssociationService) and server-side (API routes).
 *
 * Pattern: cl_{contactId}_{entityType}_{entityId}[_{role}]
 *
 * @module lib/contact-link-id
 * @enterprise ADR-032 - Linking Model (Associations)
 * @see SPEC-257A - Unit-Level Contact Links
 */

/**
 * Generate a deterministic contact link document ID.
 *
 * @param contactId - Source contact ID
 * @param targetEntityType - Target entity type ('project', 'building', 'property')
 * @param targetEntityId - Target entity document ID
 * @param role - Optional association role ('buyer', 'owner', 'tenant', etc.)
 * @returns Deterministic link ID (e.g. `cl_cont_xyz_project_proj_abc_worker`)
 */
export function buildContactLinkKey(
  contactId: string,
  targetEntityType?: string,
  targetEntityId?: string,
  role?: string,
): string {
  const parts: string[] = ['cl', contactId];
  if (targetEntityType) parts.push(targetEntityType);
  if (targetEntityId) parts.push(targetEntityId);
  if (role) parts.push(role);
  return parts.join('_');
}

// Back-compat alias — deterministic composite key not entity ID (SSoT enterprise-id generates random prefix+nanoid)
export { buildContactLinkKey as generateContactLinkId };
