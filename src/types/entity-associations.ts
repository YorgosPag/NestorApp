/**
 * =============================================================================
 * Entity Association Types — Ρόλοι & View Models
 * =============================================================================
 *
 * Ρόλοι ανά entity type για σύνδεση επαφών με Έργα/Κτίρια/Μονάδες.
 * Ελληνική κατασκευαστική βιομηχανία domain.
 *
 * @module types/entity-associations
 * @enterprise ADR-032 - Linking Model (Associations)
 */

import type { EntityType } from '@/config/domain-constants';

// ============================================================================
// ASSOCIATION ROLES PER ENTITY TYPE
// ============================================================================

/**
 * Ρόλοι ανά entity type (Ελληνική κατασκευαστική βιομηχανία)
 */
export const ENTITY_ASSOCIATION_ROLES = {
  project: [
    'architect',
    'structural_engineer',
    'electrical_engineer',
    'mechanical_engineer',
    'surveyor',
    'energy_inspector',
    'supervising_engineer',
  ] as const,
  building: [
    'supervisor',
    'contractor',
    'manager',
    'engineer',
  ] as const,
  property: [
    'owner',
    'tenant',
    'buyer',
    'seller_lawyer',
    'buyer_lawyer',
    'notary',
  ] as const,
} as const;

/** Entity types that support associations */
export type AssociableEntityType = keyof typeof ENTITY_ASSOCIATION_ROLES;

/** Role values for project associations */
export type ProjectRole = typeof ENTITY_ASSOCIATION_ROLES.project[number];

/** Role values for building associations */
export type BuildingRole = typeof ENTITY_ASSOCIATION_ROLES.building[number];

/** Role values for property associations */
export type PropertyRole = typeof ENTITY_ASSOCIATION_ROLES.property[number];

/** Union of all role values */
export type AssociationRoleValue = ProjectRole | BuildingRole | PropertyRole;

// ============================================================================
// VIEW MODELS — FOR UI DISPLAY
// ============================================================================

/**
 * Enriched contact link for UI rendering (entity-side view).
 * Entity → "ποιες επαφές είναι συνδεδεμένες;"
 */
export interface EntityAssociationLink {
  /** Contact link ID (from Firestore) */
  linkId: string;
  /** Contact ID */
  contactId: string;
  /** Display name (resolved) */
  contactName: string;
  /** Contact type (individual / company / service) */
  contactType: string;
  /** Role in the association */
  role: string;
  /** When the link was created */
  createdAt: string;
  /** Whether this link is inherited from a parent entity (e.g. Project → Building) */
  inherited?: boolean;
  /** Source entity type from which this link is inherited */
  inheritedFromType?: EntityType;
  /** Source entity ID from which this link is inherited */
  inheritedFromId?: string;
}

/**
 * Enriched entity link for UI rendering (contact-side view).
 * Contact → "σε ποια entities είναι συνδεδεμένη;"
 */
export interface ContactEntityLink {
  /** Contact link ID */
  linkId: string;
  /** Target entity type */
  entityType: EntityType;
  /** Target entity ID */
  entityId: string;
  /** Display name of the entity (resolved) */
  entityName: string;
  /** Role of the contact in that entity */
  role: string;
  /** When the link was created */
  createdAt: string;
}

/**
 * Grouped entity links for a contact (reverse view)
 */
export interface GroupedContactEntityLinks {
  projects: ContactEntityLink[];
  buildings: ContactEntityLink[];
  properties: ContactEntityLink[];
}

// ============================================================================
// HELPER — Get roles for an entity type
// ============================================================================

/**
 * Returns the allowed roles for a given entity type.
 * Falls back to empty array for non-associable types.
 */
export function getRolesForEntityType(entityType: string): readonly string[] {
  if (entityType in ENTITY_ASSOCIATION_ROLES) {
    return ENTITY_ASSOCIATION_ROLES[entityType as AssociableEntityType];
  }
  return [];
}
