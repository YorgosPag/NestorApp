import {
  ContactRelationship,
  ContactWithRelationship,
  OrganizationTree,
  RelationshipSearchCriteria,
  RelationshipType
} from '@/types/contacts/relationships';

import { RelationshipCRUDService } from './core/RelationshipCRUDService';
import { RelationshipValidationService } from './core/RelationshipValidationService';
import { RelationshipCacheAdapter } from './adapters/RelationshipCacheAdapter';
import { RelationshipSearchService } from './search/RelationshipSearchService';
import { ContactRelationshipExtendedService } from './ContactRelationshipExtendedService';

import type { CacheStats } from './adapters/RelationshipCacheAdapter';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('ContactRelationshipService');

export type CacheStatistics = CacheStats;

/**
 * Contact Relationship Service — Enterprise Orchestrator (Facade).
 *
 * Core CRUD + queries live here.
 * Bulk, department, import/export, cache management, and legacy compat
 * are delegated to ContactRelationshipExtendedService.
 */
export class ContactRelationshipService {

  // ========================================================================
  // CORE CRUD
  // ========================================================================

  static async createRelationship(data: Partial<ContactRelationship>): Promise<ContactRelationship> {
    const result = await RelationshipCRUDService.createRelationship(data);

    if (data.sourceContactId) RelationshipCacheAdapter.invalidateContact(data.sourceContactId);
    if (data.targetContactId) RelationshipCacheAdapter.invalidateContact(data.targetContactId);
    RelationshipCacheAdapter.invalidatePattern('search:*');
    return result;
  }

  static async getRelationshipById(relationshipId: string): Promise<ContactRelationship | null> {
    return await RelationshipCRUDService.getRelationshipById(relationshipId);
  }

  static async getRelationship(
    sourceId: string,
    targetId: string,
    relationshipType: RelationshipType
  ): Promise<ContactRelationship | null> {
    return await RelationshipCRUDService.getSpecificRelationship(sourceId, targetId, relationshipType);
  }

  static async updateRelationship(
    relationshipId: string,
    updates: Partial<ContactRelationship>
  ): Promise<ContactRelationship> {
    const result = await RelationshipCRUDService.updateRelationship(relationshipId, updates);

    if (updates.sourceContactId) RelationshipCacheAdapter.invalidateContact(updates.sourceContactId);
    if (updates.targetContactId) RelationshipCacheAdapter.invalidateContact(updates.targetContactId);
    RelationshipCacheAdapter.invalidatePattern('search:*');
    return result;
  }

  static async terminateRelationship(relationshipId: string, terminatedBy: string): Promise<ContactRelationship> {
    const relationship = await RelationshipCRUDService.getRelationshipById(relationshipId);
    const result = await RelationshipCRUDService.terminateRelationship(relationshipId, terminatedBy);

    if (relationship) {
      RelationshipCacheAdapter.invalidateContact(relationship.sourceContactId);
      RelationshipCacheAdapter.invalidateContact(relationship.targetContactId);
    }
    RelationshipCacheAdapter.invalidatePattern('search:*');
    return result;
  }

  static async deleteRelationship(relationshipId: string, deletedBy: string): Promise<boolean> {
    const relationship = await RelationshipCRUDService.getRelationshipById(relationshipId);
    const result = await RelationshipCRUDService.deleteRelationship(relationshipId, deletedBy);

    if (relationship) {
      RelationshipCacheAdapter.invalidateContact(relationship.sourceContactId);
      RelationshipCacheAdapter.invalidateContact(relationship.targetContactId);
    }
    RelationshipCacheAdapter.invalidatePattern('search:*');
    return result;
  }

  // ========================================================================
  // QUERIES (with cache)
  // ========================================================================

  static async getContactRelationships(
    contactId: string,
    includeInactive = false
  ): Promise<ContactRelationship[]> {
    if (!includeInactive) {
      const cached = RelationshipCacheAdapter.getCachedContactRelationships(contactId);
      if (cached) return cached;
    }

    const relationships = await RelationshipCRUDService.getContactRelationships(contactId, includeInactive);

    if (!includeInactive) {
      RelationshipCacheAdapter.cacheContactRelationships(contactId, relationships);
    }
    return relationships;
  }

  static async searchRelationships(criteria: RelationshipSearchCriteria): Promise<ContactRelationship[]> {
    const cached = RelationshipCacheAdapter.getCachedSearchResults(criteria);
    if (cached) return cached;

    const searchResult = await RelationshipSearchService.advancedSearch({
      sourceContactIds: criteria.sourceContactIds,
      targetContactIds: criteria.targetContactIds,
      relationshipTypes: criteria.relationshipTypes,
      departments: criteria.departments,
      statuses: criteria.statuses,
      textSearch: criteria.textSearch
    }, { includeInactive: false });

    const results = searchResult.items;
    RelationshipCacheAdapter.cacheSearchResults(criteria, results);
    return results;
  }

  // ========================================================================
  // VALIDATION
  // ========================================================================

  static async validateRelationshipData(data: Partial<ContactRelationship>): Promise<boolean> {
    try {
      await RelationshipValidationService.validateRelationshipData(data);
      return true;
    } catch (error) {
      logger.error('Validation failed:', error);
      return false;
    }
  }

  static async checkDuplicateRelationship(
    sourceId: string,
    targetId: string,
    relationshipType: RelationshipType
  ): Promise<boolean> {
    try {
      const existing = await this.getRelationship(sourceId, targetId, relationshipType);
      return existing !== null;
    } catch (error) {
      logger.error('Error checking duplicate:', error);
      return false;
    }
  }

  // ========================================================================
  // DELEGATED TO EXTENDED SERVICE
  // ========================================================================

  static async getOrganizationEmployees(organizationId: string, includeInactive = false): Promise<ContactWithRelationship[]> {
    return ContactRelationshipExtendedService.getOrganizationEmployees(organizationId, includeInactive);
  }

  static async getPersonEmployer(personId: string): Promise<ContactWithRelationship | null> {
    return ContactRelationshipExtendedService.getPersonEmployer(personId);
  }

  static async buildOrganizationHierarchy(organizationId: string): Promise<OrganizationTree> {
    return ContactRelationshipExtendedService.buildOrganizationHierarchy(organizationId);
  }

  static async bulkCreateRelationships(relationships: Partial<ContactRelationship>[]): Promise<ContactRelationship[]> {
    return ContactRelationshipExtendedService.bulkCreateRelationships(relationships);
  }

  static clearCache(): void {
    ContactRelationshipExtendedService.clearCache();
  }

  static getCacheStats(): CacheStatistics {
    return ContactRelationshipExtendedService.getCacheStats();
  }

  static generateId(): string {
    return ContactRelationshipExtendedService.generateId();
  }

  static async saveRelationship(relationship: ContactRelationship): Promise<void> {
    return ContactRelationshipExtendedService.saveRelationship(relationship);
  }

  /** @deprecated */
  static async queryDatabase(sqlQuery: string, params: string[]): Promise<ContactRelationship[]> {
    return ContactRelationshipExtendedService.queryDatabase(sqlQuery, params);
  }
}

export default ContactRelationshipService;
