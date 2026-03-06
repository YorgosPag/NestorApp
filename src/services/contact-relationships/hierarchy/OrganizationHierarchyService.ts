// ============================================================================
// ORGANIZATION HIERARCHY SERVICE
// ============================================================================
//
// 🌳 Organization hierarchy building και management
// Enterprise-grade organizational structure analysis και visualization
//
// Architectural Pattern: Composite Pattern + Tree Builder Pattern
// Responsibility: Organizational hierarchy construction και analysis
//
// ============================================================================

import {
  OrganizationTree,
  OrganizationHierarchyNode,
  ContactWithRelationship,
  RelationshipType
} from '@/types/contacts/relationships';
import { Contact, isCompanyContact, isServiceContact } from '@/types/contacts';
import { ContactsService } from '@/services/contacts.service';

// 🏢 ENTERPRISE: Helper function to get organization name with type safety
function getOrganizationName(organization: Contact): string {
  if (isCompanyContact(organization)) {
    return organization.companyName;
  }
  if (isServiceContact(organization)) {
    return organization.serviceName;
  }
  return 'Unknown Organization';
}
import { FirestoreRelationshipAdapter } from '../adapters/FirestoreRelationshipAdapter';
import { RelationshipQueryBuilder } from '../search/RelationshipQueryBuilder';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('OrganizationHierarchyService');

// ============================================================================
// HIERARCHY TYPES
// ============================================================================

export interface HierarchyLevel {
  level: number;
  name: string;
  employees: OrganizationHierarchyNode[];
  managerCount: number;
  directReportCount: number;
}

export interface DepartmentSummary {
  name: string;
  head?: Contact;
  employeeCount: number;
  managerCount: number;
  averageTenure: number;
  budgetAllocation?: number;
  subDepartments: string[];
}

export interface OrganizationMetrics {
  totalEmployees: number;
  managementLayers: number;
  spanOfControl: number; // Average direct reports per manager
  organizationalComplexity: number;
  departmentCount: number;
  averageTeamSize: number;
  managerToEmployeeRatio: number;
}

export interface HierarchyAnalysis {
  tree: OrganizationTree;
  metrics: OrganizationMetrics;
  departments: Record<string, DepartmentSummary>;
  levels: HierarchyLevel[];
  recommendations: string[];
}

// ============================================================================
// ORGANIZATION HIERARCHY SERVICE
// ============================================================================

/**
 * 🌳 Organization Hierarchy Service
 *
 * Enterprise-grade service για building και analyzing organizational hierarchies.
 * Constructs complete org charts, calculates metrics, και provides insights.
 *
 * Features:
 * - Complete organizational tree building
 * - Management hierarchy analysis
 * - Department structure mapping
 * - Organizational metrics calculation
 * - Performance insights και recommendations
 * - Hierarchy optimization suggestions
 */
export class OrganizationHierarchyService {

  // ========================================================================
  // HIERARCHY BUILDING METHODS
  // ========================================================================

  /**
   * 🌳 Build Complete Organization Hierarchy - REAL DATA από Firebase
   *
   * Constructs full organizational tree με all employees και relationships
   */
  static async buildOrganizationHierarchy(organizationId: string): Promise<OrganizationTree> {
    logger.info('🌳 HIERARCHY: Building REAL organization hierarchy for:', organizationId);
    logger.info('🔧 HIERARCHY: FIXED - Now building children array with contact IDs for UI component');

    try {
      // Get organization contact από Firebase
      const organization = await ContactsService.getContact(organizationId);
      if (!organization) {
        throw new Error(`Organization not found: ${organizationId}`);
      }

      logger.info('🏢 HIERARCHY: Organization found:', organization.type, getOrganizationName(organization));

      // Get all REAL employees από Firebase
      const employees = await this.getOrganizationEmployees(organizationId);
      logger.info('👥 HIERARCHY: Found employees:', employees.length);

      if (employees.length === 0) {
        // Return empty but valid tree για organizations με no employees
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

      // Build hierarchy nodes and derive structured data
      const nodes = await this.buildHierarchyNodes(employees);
      const nodesWithLevels = await this.calculateHierarchyLevels(nodes);
      const departments = this.buildDepartmentBreakdown(nodesWithLevels);
      const statistics = this.calculateOrganizationStatistics(nodesWithLevels, departments);
      const topLevel = this.identifyTopLevelExecutives(nodesWithLevels);

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


      logger.info('👥 HIERARCHY: Created children array with', children.length, 'employees:',
        children.map(c => ({ id: c.id, position: c.position, type: c.relationshipType }))
      );

      const now = new Date().toISOString();
      const result: OrganizationTree = {
        organization,
        topLevel,
        statistics,
        departments,
        lastUpdated: now,
        updatedAt: now,
        createdAt: now,
        children // 🔧 FIX: Add children array for UI component
      };

      logger.info('✅ HIERARCHY: REAL organization hierarchy built successfully', {
        employeeCount: employees.length,
        departmentCount: Object.keys(departments).length,
        hierarchyDepth: statistics.hierarchyDepth,
        departments: Object.keys(departments)
      });

      return result;

    } catch (error) {
      logger.error('❌ HIERARCHY: Error building REAL organization hierarchy:', error);
      throw error;
    }
  }

  /**
   * 📊 Analyze Organization Hierarchy
   *
   * Comprehensive analysis με metrics και recommendations
   */
  static async analyzeOrganization(organizationId: string): Promise<HierarchyAnalysis> {
    logger.info('📊 HIERARCHY: Analyzing organization:', organizationId);

    try {
      // Build basic hierarchy
      const tree = await this.buildOrganizationHierarchy(organizationId);

      // Calculate detailed metrics
      const metrics = await this.calculateDetailedMetrics(tree);

      // Analyze departments
      const departments = await this.analyzeDepartments(tree);

      // Build hierarchy levels
      const levels = this.buildHierarchyLevels(tree);

      // Generate recommendations
      const recommendations = this.generateRecommendations(tree, metrics);

      return {
        tree,
        metrics,
        departments,
        levels,
        recommendations
      };

    } catch (error) {
      logger.error('❌ HIERARCHY: Error analyzing organization:', error);
      throw error;
    }
  }

  /**
   * 👤 Get Manager Chain
   *
   * Gets complete management chain για specific employee
   */
  static async getManagerChain(employeeId: string): Promise<OrganizationHierarchyNode[]> {
    logger.info('👤 HIERARCHY: Getting manager chain for:', employeeId);

    try {
      const chain: OrganizationHierarchyNode[] = [];
      let currentEmployee = employeeId;

      // Walk up the hierarchy
      while (currentEmployee) {
        const employee = await ContactsService.getContact(currentEmployee);
        if (!employee) break;

        // Find manager relationship
        const relationships = await RelationshipQueryBuilder
          .create()
          .fromContact(currentEmployee)
          .ofTypes(['employee', 'manager', 'director'])
          .activeOnly()
          .compile();

        // For now, simplified - need to implement proper query execution
        break;
      }

      return chain;

    } catch (error) {
      logger.error('❌ HIERARCHY: Error getting manager chain:', error);
      return [];
    }
  }

  /**
   * 👥 Get Direct Reports
   *
   * Gets all direct reports για specific manager
   */
  static async getDirectReports(managerId: string): Promise<OrganizationHierarchyNode[]> {
    logger.info('👥 HIERARCHY: Getting direct reports for:', managerId);

    try {
      // Get all relationships where this person is target (manager)
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
              subordinates: [], // Will be filled recursively αν needed
              level: 0, // Will be calculated
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
      logger.error('❌ HIERARCHY: Error getting direct reports:', error);
      return [];
    }
  }

  // ========================================================================
  // DEPARTMENT ANALYSIS METHODS
  // ========================================================================

  /**
   * 🏢 Analyze Department Structure
   *
   * Detailed analysis of specific department
   */
  static async analyzeDepartment(organizationId: string, departmentName: string): Promise<DepartmentSummary> {
    logger.info('🏢 HIERARCHY: Analyzing department:', departmentName);

    try {
      // Get all employees στο department
      const departmentEmployees = await RelationshipQueryBuilder
        .create()
        .toContact(organizationId)
        .inDepartment(departmentName)
        .activeOnly()
        .compile();

      // For now, return simplified summary
      return {
        name: departmentName,
        employeeCount: 0, // Will be calculated από query results
        managerCount: 0,
        averageTenure: 0,
        subDepartments: []
      };

    } catch (error) {
      logger.error('❌ HIERARCHY: Error analyzing department:', error);
      throw error;
    }
  }

  /**
   * 🔄 Reorganize Department
   *
   * Suggests reorganization για department optimization
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
    logger.info('🔄 HIERARCHY: Suggesting reorganization for:', departmentName);

    try {
      const currentStructure = await this.analyzeDepartment(organizationId, departmentName);

      // Generate reorganization suggestions
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
        timeline: '3-6 months για full implementation'
      };

    } catch (error) {
      logger.error('❌ HIERARCHY: Error suggesting reorganization:', error);
      throw error;
    }
  }

  /**
   * 📏 Calculate Real Hierarchy Depth από Real Data
   */
  private static calculateRealHierarchyDepth(employees: ContactWithRelationship[]): number {
    if (employees.length === 0) return 0;

    // Count different relationship types που indicate hierarchy levels
    const relationshipTypes = new Set(employees.map(emp => emp.relationship.relationshipType));

    // Simple depth calculation based on relationship types
    let depth = 0;
    if (relationshipTypes.has('executive') || relationshipTypes.has('director')) depth = 3;
    else if (relationshipTypes.has('manager') || relationshipTypes.has('department_head')) depth = 2;
    else depth = 1;

    return depth;
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  /**
   * 👥 Get Organization Employees
   */
  private static async getOrganizationEmployees(organizationId: string): Promise<ContactWithRelationship[]> {
    try {
      const employmentTypes: RelationshipType[] = [
        'employee',
        'manager',
        'director',
        'executive',
        'civil_servant',
        'department_head'
      ];
      const relationships = await FirestoreRelationshipAdapter.getOrganizationEmployees(organizationId, employmentTypes);

      const employees: ContactWithRelationship[] = [];

      for (const relationship of relationships) {
        const contact = await ContactsService.getContact(relationship.sourceContactId);
        if (contact) {
          employees.push({
            contact,
            relationship,
            organizationContext: {
              organizationId,
              organizationName: 'Organization', // TODO: Get from org contact
              organizationType: 'company'
            }
          });
        }
      }

      return employees;

    } catch (error) {
      logger.error('❌ HIERARCHY: Error getting organization employees:', error);
      return [];
    }
  }

  /**
   * 🏗️ Build Hierarchy Nodes
   */
  private static async buildHierarchyNodes(employees: ContactWithRelationship[]): Promise<OrganizationHierarchyNode[]> {
    return employees.map(employee => ({
      contact: employee.contact,
      relationship: employee.relationship,
      subordinates: [],
      level: 0, // Will be calculated
      departmentInfo: {
        name: employee.relationship.department || 'Unknown',
        size: 0 // Will be calculated
      },
      manager: undefined, // Will be set during hierarchy calculation
      directReportCount: 0,
      tenureMonths: this.calculateTenure(employee.relationship.startDate)
    }));
  }

  /**
   * 📊 Calculate Hierarchy Levels
   */
  private static async calculateHierarchyLevels(nodes: OrganizationHierarchyNode[]): Promise<OrganizationHierarchyNode[]> {
    // This is a complex algorithm που builds parent-child relationships
    // For now, simplified implementation

    logger.info('📊 HIERARCHY: Calculating hierarchy levels για', nodes.length, 'employees');

    // TODO: Implement proper hierarchy level calculation
    // This involves finding manager relationships και building tree structure

    return nodes.map(node => ({
      ...node,
      level: this.estimateHierarchyLevel(node.relationship.relationshipType)
    }));
  }

  /**
   * 👑 Identify Top Level Executives
   */
  private static identifyTopLevelExecutives(nodes: OrganizationHierarchyNode[]): OrganizationHierarchyNode[] {
    return nodes.filter(node =>
      ['director', 'executive', 'ceo', 'chairman'].includes(node.relationship.relationshipType)
    );
  }

  /**
   * 🏢 Build Department Breakdown
   */
  private static buildDepartmentBreakdown(nodes: OrganizationHierarchyNode[]): OrganizationTree['departments'] {
    const departments: OrganizationTree['departments'] = {};

    // Group employees by department
    const departmentGroups = new Map<string, OrganizationHierarchyNode[]>();

    nodes.forEach(node => {
      const deptName = node.relationship.department || 'Unknown';
      if (!departmentGroups.has(deptName)) {
        departmentGroups.set(deptName, []);
      }
      departmentGroups.get(deptName)!.push(node);
    });

    // Build department structures
    departmentGroups.forEach((employees, deptName) => {
      // Find department head (highest level manager στο department)
      const departmentHead = employees
        .filter(emp => ['manager', 'director', 'department_head'].includes(emp.relationship.relationshipType))
        .sort((a, b) => (b.level || 0) - (a.level || 0))[0];

      departments[deptName] = {
        head: departmentHead,
        employees,
        subDepartments: [] // TODO: Implement sub-department detection
      };
    });

    return departments;
  }

  /**
   * 📈 Calculate Organization Statistics
   */
  private static calculateOrganizationStatistics(
    nodes: OrganizationHierarchyNode[],
    departments: OrganizationTree['departments']
  ): OrganizationTree['statistics'] {
    const totalEmployees = nodes.length;
    const totalDepartments = Object.keys(departments).length;
    const maxLevel = Math.max(...nodes.map(n => n.level || 0), 0);

    return {
      totalEmployees,
      totalDepartments,
      averageTeamSize: Math.round(totalEmployees / Math.max(totalDepartments, 1)),
      hierarchyDepth: maxLevel
    };
  }

  /**
   * 📊 Calculate Detailed Metrics
   */
  private static async calculateDetailedMetrics(tree: OrganizationTree): Promise<OrganizationMetrics> {
    const totalEmployees = tree.statistics.totalEmployees;
    const departmentCount = tree.statistics.totalDepartments;

    // Calculate management layers
    const managementLayers = tree.statistics.hierarchyDepth;

    // Calculate span of control (simplified)
    const managers = tree.topLevel.length + Object.values(tree.departments)
      .filter(dept => dept.head)
      .length;

    const spanOfControl = managers > 0 ? Math.round(totalEmployees / managers) : 0;

    return {
      totalEmployees,
      managementLayers,
      spanOfControl,
      organizationalComplexity: this.calculateComplexity(tree),
      departmentCount,
      averageTeamSize: tree.statistics.averageTeamSize,
      managerToEmployeeRatio: managers / Math.max(totalEmployees - managers, 1)
    };
  }

  /**
   * 🏢 Analyze Departments
   */
  private static async analyzeDepartments(tree: OrganizationTree): Promise<Record<string, DepartmentSummary>> {
    const departmentSummaries: Record<string, DepartmentSummary> = {};

    for (const [deptName, dept] of Object.entries(tree.departments)) {
      const employees = dept.employees || [];
      const managers = employees.filter(emp =>
        ['manager', 'director', 'department_head'].includes(emp.relationship.relationshipType)
      );

      // Calculate average tenure
      const tenures = employees.map(emp => this.calculateTenure(emp.relationship.startDate));
      const averageTenure = tenures.length > 0
        ? tenures.reduce((sum, tenure) => sum + tenure, 0) / tenures.length
        : 0;

      departmentSummaries[deptName] = {
        name: deptName,
        head: dept.head?.contact,
        employeeCount: employees.length,
        managerCount: managers.length,
        averageTenure,
        subDepartments: dept.subDepartments || []
      };
    }

    return departmentSummaries;
  }

  /**
   * 📈 Build Hierarchy Levels
   */
  private static buildHierarchyLevels(tree: OrganizationTree): HierarchyLevel[] {
    const levels: HierarchyLevel[] = [];
    const maxLevel = tree.statistics.hierarchyDepth;

    for (let level = 0; level <= maxLevel; level++) {
      const levelEmployees = Object.values(tree.departments)
        .flatMap(dept => dept.employees || [])
        .filter(emp => (emp.level || 0) === level);

      const managers = levelEmployees.filter(emp =>
        ['manager', 'director', 'executive'].includes(emp.relationship.relationshipType)
      );

      levels.push({
        level,
        name: this.getLevelName(level),
        employees: levelEmployees,
        managerCount: managers.length,
        directReportCount: levelEmployees.reduce((sum, emp) => sum + (emp.directReportCount || 0), 0)
      });
    }

    return levels;
  }

  /**
   * 💡 Generate Recommendations
   */
  private static generateRecommendations(tree: OrganizationTree, metrics: OrganizationMetrics): string[] {
    const recommendations: string[] = [];

    // Span of control analysis
    if (metrics.spanOfControl > 15) {
      recommendations.push('Consider reducing span of control - some managers have too many direct reports');
    }

    if (metrics.spanOfControl < 4) {
      recommendations.push('Span of control is low - consider consolidating management layers');
    }

    // Hierarchy depth analysis
    if (metrics.managementLayers > 7) {
      recommendations.push('Organization has many management layers - consider flattening structure');
    }

    // Department size analysis
    if (metrics.averageTeamSize < 3) {
      recommendations.push('Some departments are very small - consider consolidation');
    }

    if (metrics.averageTeamSize > 20) {
      recommendations.push('Some departments are large - consider splitting into smaller units');
    }

    return recommendations;
  }

  /**
   * 🧮 Calculate Complexity
   */
  private static calculateComplexity(tree: OrganizationTree): number {
    const employeeCount = tree.statistics.totalEmployees;
    const departmentCount = tree.statistics.totalDepartments;
    const hierarchyDepth = tree.statistics.hierarchyDepth;

    // Simple complexity formula
    return Math.round((employeeCount / 10) + (departmentCount * 2) + (hierarchyDepth * 3));
  }

  /**
   * ⏱️ Calculate Tenure
   */
  private static calculateTenure(startDate?: string): number {
    if (!startDate) return 0;

    const start = new Date(startDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - start.getTime());
    const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));

    return diffMonths;
  }

  /**
   * 📊 Estimate Hierarchy Level
   */
  private static estimateHierarchyLevel(relationshipType: string): number {
    const levelMap: Record<string, number> = {
      'employee': 1,
      'manager': 2,
      'director': 3,
      'executive': 4,
      'ceo': 5,
      'chairman': 6
    };

    return levelMap[relationshipType] || 1;
  }

  /**
   * 🏷️ Get Level Name
   */
  private static getLevelName(level: number): string {
    const names = [
      'Individual Contributors',
      'Front-line Employees',
      'Team Leaders/Supervisors',
      'Middle Management',
      'Senior Management',
      'Executive Leadership',
      'Board Level'
    ];

    return names[level] || `Level ${level}`;
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export default OrganizationHierarchyService;
