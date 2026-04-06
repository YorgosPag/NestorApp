/**
 * ORGANIZATION HIERARCHY SERVICE
 *
 * Enterprise-grade service for building and analyzing organizational hierarchies.
 *
 * Split into 2 files for SRP compliance (ADR-065 Phase 4):
 * - organization-hierarchy-helpers.ts — Types + internal helper functions
 * - OrganizationHierarchyService.ts   — Public API class (this file)
 */

import {
  OrganizationTree,
  OrganizationHierarchyNode,
} from '@/types/contacts/relationships';
import { ContactsService } from '@/services/contacts.service';
import { FirestoreRelationshipAdapter } from '../adapters/FirestoreRelationshipAdapter';
import { RelationshipQueryBuilder } from '../search/RelationshipQueryBuilder';
import { createModuleLogger } from '@/lib/telemetry';

// Re-export types for backward compatibility
export type {
  HierarchyLevel,
  DepartmentSummary,
  OrganizationMetrics,
  HierarchyAnalysis,
} from './organization-hierarchy-helpers';

import type { DepartmentSummary, HierarchyAnalysis } from './organization-hierarchy-helpers';
import {
  getOrganizationName,
  getOrganizationEmployees,
  buildHierarchyNodes,
  calculateHierarchyLevelsForNodes,
  identifyTopLevelExecutives,
  buildDepartmentBreakdown,
  calculateOrganizationStatistics,
  calculateDetailedMetrics,
  analyzeDepartments,
  buildHierarchyLevelsList,
  generateRecommendations,
} from './organization-hierarchy-helpers';

const logger = createModuleLogger('OrganizationHierarchyService');

// ============================================================================
// ORGANIZATION HIERARCHY SERVICE
// ============================================================================

export class OrganizationHierarchyService {

  // ========================================================================
  // HIERARCHY BUILDING
  // ========================================================================

  /**
   * Build Complete Organization Hierarchy from Firebase data.
   */
  static async buildOrganizationHierarchy(organizationId: string): Promise<OrganizationTree> {
    logger.info('Building organization hierarchy for:', organizationId);

    try {
      const organization = await ContactsService.getContact(organizationId);
      if (!organization) {
        throw new Error(`Organization not found: ${organizationId}`);
      }

      logger.info('Organization found:', organization.type, getOrganizationName(organization));

      const employees = await getOrganizationEmployees(organizationId);
      logger.info('Found employees:', employees.length);

      if (employees.length === 0) {
        return {
          organization,
          topLevel: [],
          statistics: {
            totalEmployees: 0,
            totalDepartments: 0,
            averageTeamSize: 0,
            hierarchyDepth: 0
          },
          departments: {},
          lastUpdated: new Date().toISOString()
        };
      }

      const nodes = await buildHierarchyNodes(employees);
      const nodesWithLevels = await calculateHierarchyLevelsForNodes(nodes);
      const departments = buildDepartmentBreakdown(nodesWithLevels);
      const statistics = calculateOrganizationStatistics(nodesWithLevels, departments);
      const topLevel = identifyTopLevelExecutives(nodesWithLevels);

      const children = nodesWithLevels
        .map(node => ({
          id: node.contact.id,
          position: node.relationship.position,
          relationshipType: node.relationship.relationshipType
        }))
        .filter(child => Boolean(child.id)) as Array<{
          id: string;
          position?: string;
          relationshipType?: string;
        }>;

      logger.info('Created children array with', children.length, 'employees');

      const now = new Date().toISOString();
      const result: OrganizationTree = {
        organization,
        topLevel,
        statistics,
        departments,
        lastUpdated: now,
        updatedAt: now,
        createdAt: now,
        children
      };

      logger.info('Organization hierarchy built successfully', {
        employeeCount: employees.length,
        departmentCount: Object.keys(departments).length,
        hierarchyDepth: statistics.hierarchyDepth,
      });

      return result;

    } catch (error) {
      logger.error('Error building organization hierarchy:', error);
      throw error;
    }
  }

  /**
   * Comprehensive hierarchy analysis with metrics and recommendations.
   */
  static async analyzeOrganization(organizationId: string): Promise<HierarchyAnalysis> {
    logger.info('Analyzing organization:', organizationId);

    try {
      const tree = await this.buildOrganizationHierarchy(organizationId);
      const metrics = await calculateDetailedMetrics(tree);
      const departments = await analyzeDepartments(tree);
      const levels = buildHierarchyLevelsList(tree);
      const recommendations = generateRecommendations(tree, metrics);

      return { tree, metrics, departments, levels, recommendations };
    } catch (error) {
      logger.error('Error analyzing organization:', error);
      throw error;
    }
  }

  // ========================================================================
  // EMPLOYEE QUERIES
  // ========================================================================

  /**
   * Get complete management chain for specific employee.
   */
  static async getManagerChain(employeeId: string): Promise<OrganizationHierarchyNode[]> {
    logger.info('Getting manager chain for:', employeeId);

    try {
      const chain: OrganizationHierarchyNode[] = [];
      let currentEmployee = employeeId;

      while (currentEmployee) {
        const employee = await ContactsService.getContact(currentEmployee);
        if (!employee) break;

        const relationships = await RelationshipQueryBuilder
          .create()
          .fromContact(currentEmployee)
          .ofTypes(['employee', 'manager', 'director'])
          .activeOnly()
          .compile();

        // Simplified — need to implement proper query execution
        break;
      }

      return chain;
    } catch (error) {
      logger.error('Error getting manager chain:', error);
      return [];
    }
  }

  /**
   * Get all direct reports for specific manager.
   */
  static async getDirectReports(managerId: string): Promise<OrganizationHierarchyNode[]> {
    logger.info('Getting direct reports for:', managerId);

    try {
      const relationships = await FirestoreRelationshipAdapter.getContactRelationships(managerId);
      const directReports: OrganizationHierarchyNode[] = [];

      for (const relationship of relationships) {
        if (relationship.targetContactId === managerId &&
            ['employee', 'manager', 'director'].includes(relationship.relationshipType)) {

          const contact = await ContactsService.getContact(relationship.sourceContactId);
          if (contact) {
            directReports.push({
              contact,
              relationship,
              subordinates: [],
              level: 0,
              departmentInfo: {
                name: relationship.department || 'Unknown',
                size: 0
              }
            });
          }
        }
      }

      return directReports;
    } catch (error) {
      logger.error('Error getting direct reports:', error);
      return [];
    }
  }

  // ========================================================================
  // DEPARTMENT ANALYSIS
  // ========================================================================

  /**
   * Detailed analysis of specific department.
   */
  static async analyzeDepartment(organizationId: string, departmentName: string): Promise<DepartmentSummary> {
    logger.info('Analyzing department:', departmentName);

    try {
      const departmentEmployees = await RelationshipQueryBuilder
        .create()
        .toContact(organizationId)
        .inDepartment(departmentName)
        .activeOnly()
        .compile();

      return {
        name: departmentName,
        employeeCount: 0,
        managerCount: 0,
        averageTenure: 0,
        subDepartments: []
      };
    } catch (error) {
      logger.error('Error analyzing department:', error);
      throw error;
    }
  }

  /**
   * Suggest reorganization for department optimization.
   */
  static async suggestReorganization(
    organizationId: string,
    departmentName: string
  ): Promise<{
    currentStructure: DepartmentSummary;
    suggestedStructure: DepartmentSummary;
    benefits: string[];
    risks: string[];
    timeline: string;
  }> {
    logger.info('Suggesting reorganization for:', departmentName);

    try {
      const currentStructure = await this.analyzeDepartment(organizationId, departmentName);

      const suggestedStructure: DepartmentSummary = {
        ...currentStructure,
        name: `${departmentName} (Optimized)`
      };

      return {
        currentStructure,
        suggestedStructure,
        benefits: [
          'Improved communication flow',
          'Reduced management overhead',
          'Better span of control',
          'Enhanced team collaboration'
        ],
        risks: [
          'Temporary productivity decrease',
          'Employee resistance to change',
          'Potential skill gaps'
        ],
        timeline: '3-6 months for full implementation'
      };
    } catch (error) {
      logger.error('Error suggesting reorganization:', error);
      throw error;
    }
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export default OrganizationHierarchyService;
