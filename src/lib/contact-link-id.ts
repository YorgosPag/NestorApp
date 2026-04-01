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
 * @returns Deterministic link ID (e.g. `cl_cont_xyz_unit_unit_abc_buyer`)
 */
export function generateContactLinkId(
  contactId: string,
  targetEntityType?: string,
  targetEntityId?: string,
  role?: string,
): string {
  const base = `cl_${contactId}_${targetEntityType}_${targetEntityId}`;
  return role ? `${base}_${role}` : base;
}
