// ============================================================================
// CONTACT RELATIONSHIP SERVICE - MAIN ORCHESTRATOR
// ============================================================================
//
// 🎯 Main service orchestrator για contact relationship management
// Coordinates between specialized services για enterprise-grade functionality
//
// UPDATED: 2025-12-07 - Full Integration με Modular Architecture
// - ✅ Integrated με RelationshipCacheAdapter για performance
// - ✅ Delegates to specialized services (Search, Hierarchy, Bulk, Import/Export)
// - ✅ Enhanced cache invalidation strategies
// - ✅ Department management operations
// - ✅ Backward compatibility με existing API
//
// Architectural Pattern: Facade Pattern + Service Orchestration + Caching Layer
// Responsibility: High-level API coordination, cache management, service delegation
//
// ============================================================================

import {
  ContactRelationship,
  ContactWithRelationship,
  OrganizationTree,
  RelationshipSearchCriteria,
  RelationshipType
} from '@/types/contacts/relationships';
import type { Contact, ContactType } from '@/types/contacts';

// Import enterprise ID generation
import { generateRelationshipId } from '@/services/enterprise-id.service';

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions for ContactRelationshipService
// ============================================================================

/**
 * Minimal contact for placeholder usage when full Contact is not loaded
 */
interface MinimalContact {
  id: string;
}

/**
 * Import error type for organizational structure import
 */
interface ImportError {
  message: string;
  row?: number;
  field?: string;
}

/**
 * Department head information
 */
interface DepartmentHeadInfo {
  contactId: string;
  name?: string;
  position?: string;
}

/**
 * Bulk operation options
 */
interface BulkOperationOptions {
  validateBeforeCreate?: boolean;
  skipDuplicates?: boolean;
  batchSize?: number;
  onProgress?: (progress: number) => void;
}

/**
 * Export filters for organization data
 */
interface ExportFilters {
  includeInactive?: boolean;
  departments?: string[];
  relationshipTypes?: RelationshipType[];
  dateRange?: { start: Date; end: Date };
}

/**
 * Cache configuration options
 */
interface CacheConfig {
  enabled?: boolean;
  defaultTTL?: number;
  maxEntries?: number;
  cleanupInterval?: number;
}

// Import specialized services
import { RelationshipCRUDService } from './core/RelationshipCRUDService';
import { RelationshipValidationService } from './core/RelationshipValidationService';
import { FirestoreRelationshipAdapter } from './adapters/FirestoreRelationshipAdapter';
import { RelationshipCacheAdapter } from './adapters/RelationshipCacheAdapter';

// Import search services
import { RelationshipSearchService } from './search/RelationshipSearchService';

// Import hierarchy services
import { OrganizationHierarchyService } from './hierarchy/OrganizationHierarchyService';
import { DepartmentManagementService } from './hierarchy/DepartmentManagementService';

// Import bulk services
import { BulkRelationshipService, BulkOperationResult as ServiceBulkOperationResult } from './bulk/BulkRelationshipService';
import { ImportExportService } from './bulk/ImportExportService';

// Import types from specialized services
import { DepartmentMetrics as ServiceDepartmentMetrics } from './hierarchy/DepartmentManagementService';
import { CacheStats } from './adapters/RelationshipCacheAdapter';
import type { ExportResult } from './bulk/ImportExportService';

// Re-export CacheStats as CacheStatistics for backward compatibility
export type CacheStatistics = CacheStats;

/**
 * Import error format from ImportExportService
 */
interface ServiceImportError {
  row: number;
  data: unknown;
  error: string;
}

// ============================================================================
// MAIN ORCHESTRATOR SERVICE
// ============================================================================

/**
 * 🎯 Contact Relationship Service - Enterprise Orchestrator
 *
 * Main service που orchestrates all relationship management functionality.
 * Provides unified API interface για all relationship operations.
 *
 * Architecture Benefits:
 * - Single entry point για relationship operations
 * - Service composition and orchestration
 * - Backward compatibility με existing code
 * - Clean separation of concerns
 * - Enterprise scalability patterns
 */
export class ContactRelationshipService {

  // ========================================================================
  // CORE CRUD OPERATIONS - Delegated to RelationshipCRUDService
  // ========================================================================

  /**
   * 🔗 Create New Relationship
   */
  static async createRelationship(data: Partial<ContactRelationship>): Promise<ContactRelationship> {
    return await RelationshipCRUDService.createRelationship(data);
  }

  /**
   * 📖 Get Relationship by ID
   */
  static async getRelationshipById(relationshipId: string): Promise<ContactRelationship | null> {
    return await RelationshipCRUDService.getRelationshipById(relationshipId);
  }

  /**
   * 🔍 Get Specific Relationship
   */
  static async getRelationship(
    sourceId: string,
    targetId: string,
    relationshipType: RelationshipType
  ): Promise<ContactRelationship | null> {
    return await RelationshipCRUDService.getSpecificRelationship(sourceId, targetId, relationshipType);
  }

  /**
   * 📝 Update Relationship
   */
  static async updateRelationship(
    relationshipId: string,
    updates: Partial<ContactRelationship>
  ): Promise<ContactRelationship> {
    return await RelationshipCRUDService.updateRelationship(relationshipId, updates);
  }

  /**
   * 🗑️ Delete Relationship
   */
  static async deleteRelationship(relationshipId: string, deletedBy: string): Promise<boolean> {
    return await RelationshipCRUDService.deleteRelationship(relationshipId, deletedBy);
  }

  // ========================================================================
  // RELATIONSHIP QUERIES - με Cache Integration
  // ========================================================================

  /**
   * 👥 Get All Contact Relationships (με Cache)
   */
  static async getContactRelationships(
    contactId: string,
    includeInactive = false
  ): Promise<ContactRelationship[]> {
    // Try cache first
    if (!includeInactive) {
      const cached = RelationshipCacheAdapter.getCachedContactRelationships(contactId);
      if (cached) {
        return cached;
      }
    }

    // Fetch από database
    const relationships = await RelationshipCRUDService.getContactRelationships(contactId, includeInactive);

    // Cache result
    if (!includeInactive) {
      RelationshipCacheAdapter.cacheContactRelationships(contactId, relationships);
    }

    return relationships;
  }

  /**
   * 🏢 Get Organization Employees (με Enhanced Caching)
   */
  static async getOrganizationEmployees(
    organizationId: string,
    includeInactive = false
  ): Promise<ContactWithRelationship[]> {
    console.log('🏢 ORCHESTRATOR: Getting organization employees', { organizationId, includeInactive });

    try {
      // Check cache first με filters
      const filters = { includeInactive };
      const cached = RelationshipCacheAdapter.getCachedOrganizationRelationships(organizationId, filters);
      if (cached) {
        console.log('🎯 ORCHESTRATOR: Organization employees cache hit');
        // Convert cached relationships to ContactWithRelationship format
        // Note: Contact object is minimal placeholder - full contact loaded separately
        return cached.map(relationship => ({
          contact: { id: relationship.sourceContactId } as MinimalContact as Contact,
          relationship,
          organizationContext: {
            organizationId,
            organizationName: 'Organization Name', // Placeholder
            organizationType: 'company' as ContactType
          }
        }));
      }

      const relationshipTypes: RelationshipType[] = [
        'employee', 'manager', 'director', 'executive',
        'civil_servant', 'department_head', 'ministry_official'
      ];

      const relationships = await FirestoreRelationshipAdapter.getOrganizationEmployees(
        organizationId,
        relationshipTypes
      );

      // Filter by status αν needed
      const filteredRelationships = includeInactive
        ? relationships
        : relationships.filter(rel => rel.status === 'active');

      // Cache the filtered relationships
      RelationshipCacheAdapter.cacheOrganizationRelationships(
        organizationId,
        filteredRelationships,
        filters
      );

      // Convert to ContactWithRelationship format
      // Note: Contact object is minimal placeholder - full contact loaded separately
      return filteredRelationships.map(relationship => ({
        contact: { id: relationship.sourceContactId } as MinimalContact as Contact,
        relationship,
        organizationContext: {
          organizationId,
          organizationName: 'Organization Name', // Placeholder
          organizationType: 'company' as ContactType
        }
      }));

    } catch (error) {
      console.error('❌ ORCHESTRATOR: Error getting organization employees:', error);
      return [];
    }
  }

  /**
   * 👤 Get Person's Employer (με Enhanced Caching)
   */
  static async getPersonEmployer(personId: string): Promise<ContactWithRelationship | null> {
    console.log('👤 ORCHESTRATOR: Getting person employer for:', personId);

    try {
      // Use cached contact relationships if available
      const relationships = await this.getContactRelationships(personId);

      // Find employment relationship where person is source
      const employmentRel = relationships.find(rel =>
        rel.sourceContactId === personId &&
        ['employee', 'manager', 'director', 'executive', 'civil_servant'].includes(rel.relationshipType) &&
        rel.status === 'active'
      );

      if (!employmentRel) {
        console.log('🔍 ORCHESTRATOR: No active employment relationship found');
        return null;
      }

      console.log('✅ ORCHESTRATOR: Found employment relationship:', employmentRel.relationshipType);

      // Return employer info
      // Note: Contact object is minimal placeholder - full contact loaded separately
      return {
        contact: { id: employmentRel.targetContactId } as MinimalContact as Contact,
        relationship: employmentRel,
        organizationContext: {
          organizationId: employmentRel.targetContactId,
          organizationName: 'Organization Name', // Placeholder
          organizationType: 'company' as ContactType
        }
      };

    } catch (error) {
      console.error('❌ ORCHESTRATOR: Error getting person employer:', error);
      return null;
    }
  }

  // ========================================================================
  // ADVANCED SEARCH - Placeholder για future implementation
  // ========================================================================

  /**
   * 🔍 Advanced Relationship Search
   */
  static async searchRelationships(criteria: RelationshipSearchCriteria): Promise<ContactRelationship[]> {
    console.log('🔍 ORCHESTRATOR: Performing advanced relationship search', criteria);

    // Check cache first για common searches
    const cached = RelationshipCacheAdapter.getCachedSearchResults(criteria);
    if (cached) {
      console.log('🎯 ORCHESTRATOR: Search cache hit');
      return cached;
    }

    // Delegate to specialized search service using advancedSearch
    // Pass through the criteria which already uses plural property names
    const searchResult = await RelationshipSearchService.advancedSearch({
      sourceContactIds: criteria.sourceContactIds,
      targetContactIds: criteria.targetContactIds,
      relationshipTypes: criteria.relationshipTypes,
      departments: criteria.departments,
      statuses: criteria.statuses,
      textSearch: criteria.textSearch
    }, {
      // Note: includeInactive not in RelationshipSearchCriteria, using default behavior
      includeInactive: false
    });

    const results = searchResult.items;

    // Cache results
    RelationshipCacheAdapter.cacheSearchResults(criteria, results);

    return results;
  }

  // ========================================================================
  // ORGANIZATIONAL HIERARCHY - Placeholder για future implementation
  // ========================================================================

  /**
   * 📊 Build Organization Hierarchy
   */
  static async buildOrganizationHierarchy(organizationId: string): Promise<OrganizationTree> {
    console.log('📊 ORCHESTRATOR: Building organization hierarchy για:', organizationId);

    try {
      // Check cache first - organization hierarchies are expensive to compute
      const cacheKey = { type: 'organization' as const, id: organizationId, params: { hierarchy: true } };
      const cached = RelationshipCacheAdapter.get<OrganizationTree>(cacheKey);
      if (cached) {
        console.log('🎯 ORCHESTRATOR: Organization hierarchy cache hit');
        return cached;
      }

      // Delegate to specialized hierarchy service
      const hierarchy = await OrganizationHierarchyService.buildOrganizationHierarchy(organizationId);

      // Cache με longer TTL για hierarchies (30 minutes)
      RelationshipCacheAdapter.set(cacheKey, hierarchy, 30 * 60 * 1000);

      return hierarchy;

    } catch (error) {
      console.error('❌ ORCHESTRATOR: Error building organization hierarchy:', error);
      throw error;
    }
  }

  // ========================================================================
  // BULK OPERATIONS - Placeholder για future implementation
  // ========================================================================

  /**
   * 🔄 Bulk Create Relationships
   */
  static async bulkCreateRelationships(relationships: Partial<ContactRelationship>[]): Promise<ContactRelationship[]> {
    console.log('🔄 ORCHESTRATOR: Bulk creating relationships', { count: relationships.length });

    const results: ContactRelationship[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < relationships.length; i++) {
      try {
        const relationship = await this.createRelationship(relationships[i]);
        results.push(relationship);
      } catch (error) {
        errors.push({ index: i, error: (error as Error).message });
      }
    }

    if (errors.length > 0) {
      console.warn('⚠️ ORCHESTRATOR: Bulk create had errors:', errors);
    }

    console.log('✅ ORCHESTRATOR: Bulk create completed', { success: results.length, errors: errors.length });
    return results;
  }

  /**
   * 📋 Import Organization from CSV/Excel
   */
  static async importOrganizationalStructure(
    organizationId: string,
    employeeData: Array<{
      firstName: string;
      lastName: string;
      email: string;
      position: string;
      department: string;
      manager?: string;
      startDate?: string;
    }>
  ): Promise<{ success: ContactRelationship[]; errors: ServiceImportError[] }> {
    console.log('📋 ORCHESTRATOR: Starting organizational structure import', {
      organizationId,
      employeeCount: employeeData.length
    });

    try {
      // Delegate to specialized import service
      const result = await ImportExportService.importOrganizationStructure(
        '', // CSV data - would need to be converted από employeeData
        organizationId,
        {
          createMissingContacts: true,
          validateData: true,
          skipDuplicates: true
        }
      );

      // Invalidate relevant caches after successful import
      RelationshipCacheAdapter.invalidateOrganization(organizationId);
      RelationshipCacheAdapter.invalidatePattern('search:*');

      return {
        success: result.importedRelationships > 0 ? [] : [], // Would need to return actual relationships
        errors: result.errors
      };

    } catch (error) {
      console.error('❌ ORCHESTRATOR: Organization import failed:', error);
      const importError: ServiceImportError = {
        row: 0,
        data: null,
        error: error instanceof Error ? error.message : 'Unknown import error'
      };
      return { success: [], errors: [importError] };
    }
  }

  // ========================================================================
  // VALIDATION UTILITIES
  // ========================================================================

  /**
   * 🔍 Validate Relationship Data
   */
  static async validateRelationshipData(data: Partial<ContactRelationship>): Promise<boolean> {
    try {
      await RelationshipValidationService.validateRelationshipData(data);
      return true;
    } catch (error) {
      console.error('❌ ORCHESTRATOR: Validation failed:', error);
      return false;
    }
  }

  /**
   * 🔍 Check Duplicate Relationship
   */
  static async checkDuplicateRelationship(
    sourceId: string,
    targetId: string,
    relationshipType: RelationshipType
  ): Promise<boolean> {
    try {
      const existing = await this.getRelationship(sourceId, targetId, relationshipType);
      return existing !== null;
    } catch (error) {
      console.error('❌ ORCHESTRATOR: Error checking duplicate:', error);
      return false;
    }
  }

  // ========================================================================
  // DEPARTMENT MANAGEMENT - Delegated to DepartmentManagementService
  // ========================================================================

  /**
   * 🏗️ Create Department
   */
  static async createDepartment(
    organizationId: string,
    departmentName: string,
    departmentHead: DepartmentHeadInfo,
    budget?: number
  ): Promise<{ success: boolean; departmentId: string }> {
    console.log('🏗️ ORCHESTRATOR: Creating department', departmentName);

    try {
      // Convert DepartmentHeadInfo to minimal IndividualContact format for service compatibility
      const headAsContact: Contact = {
        id: departmentHead.contactId,
        type: 'individual',
        firstName: departmentHead.name?.split(' ')[0] || 'Department',
        lastName: departmentHead.name?.split(' ').slice(1).join(' ') || 'Head',
        createdAt: new Date(),
        updatedAt: new Date(),
        isFavorite: false,
        status: 'active',
        // Add position from DepartmentHeadInfo if available
        jobTitle: departmentHead.position
      };

      const result = await DepartmentManagementService.createDepartment(
        organizationId,
        departmentName,
        headAsContact,
        budget
      );

      // Invalidate organization cache
      RelationshipCacheAdapter.invalidateOrganization(organizationId);

      return result;

    } catch (error) {
      console.error('❌ ORCHESTRATOR: Department creation failed:', error);
      throw error;
    }
  }

  /**
   * 👤 Transfer Employee
   */
  static async transferEmployee(
    employeeId: string,
    fromDepartment: string,
    toDepartment: string,
    newPosition?: string,
    reason?: string
  ): Promise<boolean> {
    console.log('👤 ORCHESTRATOR: Transferring employee', { employeeId, fromDepartment, toDepartment });

    try {
      const result = await DepartmentManagementService.transferEmployee(
        employeeId,
        fromDepartment,
        toDepartment,
        newPosition,
        reason
      );

      // Invalidate employee's relationship cache
      RelationshipCacheAdapter.invalidateContact(employeeId);

      return result;

    } catch (error) {
      console.error('❌ ORCHESTRATOR: Employee transfer failed:', error);
      return false;
    }
  }

  /**
   * 📊 Get Department Metrics
   */
  static async getDepartmentMetrics(
    organizationId: string,
    departmentName: string
  ): Promise<ServiceDepartmentMetrics> {
    console.log('📊 ORCHESTRATOR: Getting department metrics', departmentName);

    try {
      // Check cache first για metrics
      const cacheKey = { type: 'department' as const, id: departmentName, params: { organizationId, metrics: true } };
      const cached = RelationshipCacheAdapter.get<ServiceDepartmentMetrics>(cacheKey);
      if (cached) {
        console.log('🎯 ORCHESTRATOR: Department metrics cache hit');
        return cached;
      }

      // Delegate to department service
      const metrics = await DepartmentManagementService.getDepartmentMetrics(organizationId, departmentName);

      // Cache με shorter TTL για metrics (5 minutes)
      RelationshipCacheAdapter.set(cacheKey, metrics, 5 * 60 * 1000);

      return metrics;

    } catch (error) {
      console.error('❌ ORCHESTRATOR: Department metrics failed:', error);
      throw error;
    }
  }

  // ========================================================================
  // BULK OPERATIONS - Enhanced με Caching
  // ========================================================================

  /**
   * 🔄 Enhanced Bulk Create Relationships
   */
  static async bulkCreateRelationshipsEnhanced(
    relationships: Partial<ContactRelationship>[],
    options: BulkOperationOptions = {}
  ): Promise<ServiceBulkOperationResult> {
    console.log('🔄 ORCHESTRATOR: Enhanced bulk creating relationships', { count: relationships.length });

    try {
      // Delegate to specialized bulk service
      const result = await BulkRelationshipService.bulkCreateRelationships(relationships, options);

      // Invalidate relevant caches after bulk creation
      const affectedContacts = new Set<string>();
      const affectedOrganizations = new Set<string>();

      relationships.forEach(rel => {
        if (rel.sourceContactId) affectedContacts.add(rel.sourceContactId);
        if (rel.targetContactId) affectedOrganizations.add(rel.targetContactId);
      });

      // Invalidate contact caches
      affectedContacts.forEach(contactId => {
        RelationshipCacheAdapter.invalidateContact(contactId);
      });

      // Invalidate organization caches
      affectedOrganizations.forEach(orgId => {
        RelationshipCacheAdapter.invalidateOrganization(orgId);
      });

      // Invalidate search caches
      RelationshipCacheAdapter.invalidatePattern('search:*');

      return result;

    } catch (error) {
      console.error('❌ ORCHESTRATOR: Enhanced bulk create failed:', error);
      throw error;
    }
  }

  /**
   * 📤 Export Organization Data
   */
  static async exportOrganizationData(
    organizationId: string,
    format: 'csv' | 'json' | 'xml' = 'csv',
    filters?: ExportFilters
  ): Promise<ExportResult> {
    console.log('📤 ORCHESTRATOR: Exporting organization data', { organizationId, format });

    try {
      // Delegate to import/export service
      const result = await ImportExportService.exportOrganizationalChart(organizationId, format);

      return result;

    } catch (error) {
      console.error('❌ ORCHESTRATOR: Organization export failed:', error);
      throw error;
    }
  }

  // ========================================================================
  // CACHE MANAGEMENT - Public API
  // ========================================================================

  /**
   * 🧹 Clear All Relationship Cache
   */
  static clearCache(): void {
    console.log('🧹 ORCHESTRATOR: Clearing all relationship cache');
    RelationshipCacheAdapter.clear();
  }

  /**
   * 📊 Get Cache Statistics
   */
  static getCacheStats(): CacheStatistics {
    return RelationshipCacheAdapter.getStatistics();
  }

  /**
   * ⚙️ Configure Cache Settings
   */
  static configureCaching(config: CacheConfig): void {
    console.log('⚙️ ORCHESTRATOR: Configuring cache settings', config);
    RelationshipCacheAdapter.configure(config);
  }

  // ========================================================================
  // LEGACY COMPATIBILITY METHODS
  // ========================================================================

  /**
   * 🔧 Generate ID (Legacy compatibility)
   */
  static generateId(): string {
    return generateRelationshipId();
  }

  /**
   * 💾 Save Relationship (Legacy compatibility)
   */
  static async saveRelationship(relationship: ContactRelationship): Promise<void> {
    return await FirestoreRelationshipAdapter.saveRelationship(relationship);
  }

  /**
   * 🔍 Query Database (Legacy compatibility)
   * @deprecated Use specific methods like getContactRelationships, getOrganizationEmployees instead
   */
  static async queryDatabase(sqlQuery: string, params: string[]): Promise<ContactRelationship[]> {
    console.warn('⚠️ ORCHESTRATOR: queryDatabase is deprecated - use specific methods instead');

    // Enhanced legacy support με caching
    try {
      // Basic legacy support για common queries
      if (sqlQuery.includes('source_contact_id = ?') && params.length >= 1) {
        return await this.getContactRelationships(params[0]);
      }

      if (sqlQuery.includes('target_contact_id = ?') && params.length >= 1) {
        // getOrganizationEmployees returns ContactWithRelationship[], extract relationships
        const employees = await this.getOrganizationEmployees(params[0]);
        return employees.map(e => e.relationship);
      }

      // Try to parse query για advanced search
      if (sqlQuery.includes('department =') || sqlQuery.includes('relationship_type =')) {
        console.log('🔍 ORCHESTRATOR: Converting legacy SQL query to search criteria');
        // Could implement SQL-to-criteria conversion here
        return [];
      }

      return [];

    } catch (error) {
      console.error('❌ ORCHESTRATOR: Legacy query failed:', error);
      return [];
    }
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export default ContactRelationshipService;