/**
 * Relationship Query Builder — Factory Methods
 *
 * Extracted from RelationshipQueryBuilder.ts (ADR-065 Phase 6).
 * Convenience factory methods for common query patterns.
 *
 * @module services/contact-relationships/search/relationship-query-factories
 */

import { FIELDS } from '@/config/firestore-field-constants';
import { ENTITY_STATUS } from '@/constants/entity-status-values';
import { RelationshipQueryBuilder } from './RelationshipQueryBuilder';

/**
 * Quick Contact Query — finds all relationships for a contact
 */
export function queryForContact(contactId: string): RelationshipQueryBuilder {
  return RelationshipQueryBuilder.create()
    .where('sourceContactId', '==', contactId)
    .orWhere('targetContactId', '==', contactId)
    .where(FIELDS.STATUS, '==', ENTITY_STATUS.ACTIVE);
}

/**
 * Quick Organization Query — finds all members of an organization
 */
export function queryForOrganization(organizationId: string): RelationshipQueryBuilder {
  return RelationshipQueryBuilder.create()
    .where('targetContactId', '==', organizationId)
    .whereIn('relationshipType', [
      'employee', 'manager', 'director', 'executive',
      'civil_servant', 'department_head', 'ministry_official'
    ])
    .where(FIELDS.STATUS, '==', ENTITY_STATUS.ACTIVE);
}

/**
 * Quick Department Query — finds all members of a department
 */
export function queryForDepartment(department: string): RelationshipQueryBuilder {
  return RelationshipQueryBuilder.create()
    .where('department', '==', department)
    .where(FIELDS.STATUS, '==', ENTITY_STATUS.ACTIVE)
    .orderBy('position', 'asc');
}
