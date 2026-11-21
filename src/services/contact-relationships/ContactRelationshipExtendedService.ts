import {
  ContactRelationship,
  ContactWithRelationship,
  OrganizationTree
} from '@/types/contacts/relationships';
import {
  EMPLOYMENT_RELATIONSHIP_TYPES,
  ORG_CHART_RELATIONSHIP_TYPES
} from '@/types/contacts/relationships/core/relationship-metadata';
import type { Contact, ContactType } from '@/types/contacts';

import { generateRelationshipId } from '@/services/enterprise-id.service';

import { FirestoreRelationshipAdapter } from './adapters/FirestoreRelationshipAdapter';
import { RelationshipCacheAdapter } from './adapters/RelationshipCacheAdapter';
import { OrganizationHierarchyService } from './hierarchy/OrganizationHierarchyService';
import { DepartmentManagementService } from './hierarchy/DepartmentManagementService';
import { DepartmentMetrics as ServiceDepartmentMetrics } from './hierarchy/DepartmentManagementService';
import type { CacheStats } from './adapters/RelationshipCacheAdapter';
import { RelationshipCRUDService } from './core/RelationshipCRUDService';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ContactRelationshipExtendedService');

export type CacheStatistics = CacheStats;

interface MinimalContact { id: string }

interface DepartmentHeadInfo {
  contactId: string;
  name?: string;
  position?: string;
}

interface CacheConfig {
  enabled?: boolean;
  defaultTTL?: number;
  maxEntries?: number;
  cleanupInterval?: number;
}

/**
 * Extended operations for ContactRelationshipService.
 * Handles: bulk, department, import/export, cache, legacy.
 */
export class ContactRelationshipExtendedService {

  // ========================================================================
  // ORGANIZATIONAL HIERARCHY
  // ========================================================================

  static async getOrganizationEmployees(
    organizationId: string,
    includeInactive = false
  ): Promise<ContactWithRelationship[]> {
    try {
      const filters = { includeInactive };
      const cached = RelationshipCacheAdapter.getCachedOrganizationRelationships(organizationId, filters);
      if (cached) {
        return cached.map(relationship => ({
          contact: { id: relationship.sourceContactId } as MinimalContact as Contact,
          relationship,
          organizationContext: {
            organizationId,
            organizationName: 'Organization Name',
            organizationType: 'company' as ContactType
          }
        }));
      }

      const relationships = await FirestoreRelationshipAdapter.getOrganizationEmployees(
        organizationId,
        ORG_CHART_RELATIONSHIP_TYPES
      );

      const filteredRelationships = includeInactive
        ? relationships
        : relationships.filter(rel => rel.status === 'active');

      RelationshipCacheAdapter.cacheOrganizationRelationships(
        organizationId,
        filteredRelationships,
        filters
      );

      return filteredRelationships.map(relationship => ({
        contact: { id: relationship.sourceContactId } as MinimalContact as Contact,
        relationship,
        organizationContext: {
          organizationId,
          organizationName: 'Organization Name',
          organizationType: 'company' as ContactType
        }
      }));

    } catch (error) {
      logger.error('Error getting organization employees:', error);
      return [];
    }
  }

  static async getPersonEmployer(personId: string): Promise<ContactWithRelationship | null> {
    try {
      const relationships = await RelationshipCRUDService.getContactRelationships(personId);

      const employmentRel = relationships.find(rel =>
        rel.sourceContactId === personId &&
        EMPLOYMENT_RELATIONSHIP_TYPES.includes(rel.relationshipType) &&
        rel.status === 'active'
      );

      if (!employmentRel) return null;

      return {
        contact: { id: employmentRel.targetContactId } as MinimalContact as Contact,
        relationship: employmentRel,
        organizationContext: {
          organizationId: employmentRel.targetContactId,
          organizationName: 'Organization Name',
          organizationType: 'company' as ContactType
        }
      };

    } catch (error) {
      logger.error('Error getting person employer:', error);
      return null;
    }
  }

  static async buildOrganizationHierarchy(organizationId: string): Promise<OrganizationTree> {
    try {
      const cacheKey = { type: 'organization' as const, id: organizationId, params: { hierarchy: true } };
      const cached = RelationshipCacheAdapter.get<OrganizationTree>(cacheKey);
      if (cached) return cached;

      const hierarchy = await OrganizationHierarchyService.buildOrganizationHierarchy(organizationId);
      RelationshipCacheAdapter.set(cacheKey, hierarchy, 30 * 60 * 1000);

      return hierarchy;
    } catch (error) {
      logger.error('Error building organization hierarchy:', error);
      throw error;
    }
  }

  // ========================================================================
  // DEPARTMENT MANAGEMENT
  // ========================================================================

  static async createDepartment(
    organizationId: string,
    departmentName: string,
    departmentHead: DepartmentHeadInfo,
    budget?: number
  ): Promise<{ success: boolean; departmentId: string }> {
    try {
      const headAsContact: Contact = {
        id: departmentHead.contactId,
        type: 'individual',
        firstName: departmentHead.name?.split(' ')[0] || 'Department',
        lastName: departmentHead.name?.split(' ').slice(1).join(' ') || 'Head',
        createdAt: new Date(),
        updatedAt: new Date(),
        isFavorite: false,
        status: 'active',
        jobTitle: departmentHead.position
      };

      const result = await DepartmentManagementService.createDepartment(
        organizationId,
        departmentName,
        headAsContact,
        budget
      );

      RelationshipCacheAdapter.invalidateOrganization(organizationId);
      return result;
    } catch (error) {
      logger.error('Department creation failed:', error);
      throw error;
    }
  }

  static async transferEmployee(
    employeeId: string,
    fromDepartment: string,
    toDepartment: string,
    newPosition?: string,
    reason?: string
  ): Promise<boolean> {
    try {
      const result = await DepartmentManagementService.transferEmployee(
        employeeId, fromDepartment, toDepartment, newPosition, reason
      );
      RelationshipCacheAdapter.invalidateContact(employeeId);
      return result;
    } catch (error) {
      logger.error('Employee transfer failed:', error);
      return false;
    }
  }

  static async getDepartmentMetrics(
    organizationId: string,
    departmentName: string
  ): Promise<ServiceDepartmentMetrics> {
    try {
      const cacheKey = { type: 'department' as const, id: departmentName, params: { organizationId, metrics: true } };
      const cached = RelationshipCacheAdapter.get<ServiceDepartmentMetrics>(cacheKey);
      if (cached) return cached;

      const metrics = await DepartmentManagementService.getDepartmentMetrics(organizationId, departmentName);
      RelationshipCacheAdapter.set(cacheKey, metrics, 5 * 60 * 1000);
      return metrics;
    } catch (error) {
      logger.error('Department metrics failed:', error);
      throw error;
    }
  }

  // ========================================================================
  // BULK OPERATIONS
  // ========================================================================

  static async bulkCreateRelationships(relationships: Partial<ContactRelationship>[]): Promise<ContactRelationship[]> {
    const results: ContactRelationship[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < relationships.length; i++) {
      try {
        const relationship = await RelationshipCRUDService.createRelationship(relationships[i]);
        results.push(relationship);
      } catch (error) {
        errors.push({ index: i, error: (error as Error).message });
      }
    }

    if (errors.length > 0) {
      logger.warn('Bulk create had errors:', errors);
    }
    return results;
  }

  // ========================================================================
  // CACHE MANAGEMENT
  // ========================================================================

  static clearCache(): void {
    RelationshipCacheAdapter.clear();
  }

  static getCacheStats(): CacheStatistics {
    return RelationshipCacheAdapter.getStatistics();
  }

  static configureCaching(config: CacheConfig): void {
    RelationshipCacheAdapter.configure(config);
  }

  // ========================================================================
  // LEGACY COMPATIBILITY
  // ========================================================================

  static generateId(): string {
    return generateRelationshipId();
  }

  static async saveRelationship(relationship: ContactRelationship): Promise<void> {
    return await FirestoreRelationshipAdapter.saveRelationship(relationship);
  }

  /**
   * @deprecated Use specific methods instead
   */
  static async queryDatabase(sqlQuery: string, params: string[]): Promise<ContactRelationship[]> {
    logger.warn('queryDatabase is deprecated - use specific methods instead');

    try {
      if (sqlQuery.includes('source_contact_id = ?') && params.length >= 1) {
        return await RelationshipCRUDService.getContactRelationships(params[0]);
      }

      if (sqlQuery.includes('target_contact_id = ?') && params.length >= 1) {
        const employees = await this.getOrganizationEmployees(params[0]);
        return employees.map(e => e.relationship);
      }

      return [];
    } catch (error) {
      logger.error('Legacy query failed:', error);
      return [];
    }
  }
}
