/**
 * ORGANIZATION HIERARCHY — Types & Helper Functions
 *
 * Internal helper functions and types for the OrganizationHierarchyService.
 * Extracted for SRP compliance (ADR-065 Phase 4).
 */

import {
  OrganizationTree,
  OrganizationHierarchyNode,
  ContactWithRelationship,
  RelationshipType
} from '@/types/contacts/relationships';
import { Contact, isCompanyContact, isServiceContact } from '@/types/contacts';
import { ContactsService } from '@/services/contacts.service';
import { FirestoreRelationshipAdapter } from '../adapters/FirestoreRelationshipAdapter';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('OrganizationHierarchyHelpers');

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
  spanOfControl: number;
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
// UTILITY FUNCTIONS
// ============================================================================

export function getOrganizationName(organization: Contact): string {
  if (isCompanyContact(organization)) {
    return organization.companyName;
  }
  if (isServiceContact(organization)) {
    return organization.serviceName;
  }
  return 'Unknown Organization';
}

export function calculateTenure(startDate?: string): number {
  if (!startDate) return 0;
  const start = new Date(startDate);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
}

export function estimateHierarchyLevel(relationshipType: string): number {
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

export function getLevelName(level: number): string {
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

// ============================================================================
// DATA LOADING
// ============================================================================

export async function getOrganizationEmployees(organizationId: string): Promise<ContactWithRelationship[]> {
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
            organizationName: 'Organization',
            organizationType: 'company'
          }
        });
      }
    }

    return employees;
  } catch (error) {
    logger.error('Error getting organization employees:', error);
    return [];
  }
}

// ============================================================================
// NODE BUILDING
// ============================================================================

export async function buildHierarchyNodes(employees: ContactWithRelationship[]): Promise<OrganizationHierarchyNode[]> {
  return employees.map(employee => ({
    contact: employee.contact,
    relationship: employee.relationship,
    subordinates: [],
    level: 0,
    departmentInfo: {
      name: employee.relationship.department || 'Unknown',
      size: 0
    },
    manager: undefined,
    directReportCount: 0,
    tenureMonths: calculateTenure(employee.relationship.startDate ?? undefined)
  }));
}

export async function calculateHierarchyLevelsForNodes(nodes: OrganizationHierarchyNode[]): Promise<OrganizationHierarchyNode[]> {
  logger.info('Calculating hierarchy levels for', nodes.length, 'employees');

  return nodes.map(node => ({
    ...node,
    level: estimateHierarchyLevel(node.relationship.relationshipType)
  }));
}

export function identifyTopLevelExecutives(nodes: OrganizationHierarchyNode[]): OrganizationHierarchyNode[] {
  return nodes.filter(node =>
    ['director', 'executive', 'ceo', 'chairman'].includes(node.relationship.relationshipType)
  );
}

export function buildDepartmentBreakdown(nodes: OrganizationHierarchyNode[]): OrganizationTree['departments'] {
  const departments: OrganizationTree['departments'] = {};
  const departmentGroups = new Map<string, OrganizationHierarchyNode[]>();

  nodes.forEach(node => {
    const deptName = node.relationship.department || 'Unknown';
    if (!departmentGroups.has(deptName)) {
      departmentGroups.set(deptName, []);
    }
    departmentGroups.get(deptName)!.push(node);
  });

  departmentGroups.forEach((employees, deptName) => {
    const departmentHead = employees
      .filter(emp => ['manager', 'director', 'department_head'].includes(emp.relationship.relationshipType))
      .sort((a, b) => (b.level || 0) - (a.level || 0))[0];

    departments[deptName] = {
      head: departmentHead,
      employees,
      subDepartments: []
    };
  });

  return departments;
}

export function calculateOrganizationStatistics(
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

// ============================================================================
// ANALYSIS
// ============================================================================

export function calculateComplexity(tree: OrganizationTree): number {
  const employeeCount = tree.statistics.totalEmployees;
  const departmentCount = tree.statistics.totalDepartments;
  const hierarchyDepth = tree.statistics.hierarchyDepth;
  return Math.round((employeeCount / 10) + (departmentCount * 2) + (hierarchyDepth * 3));
}

export async function calculateDetailedMetrics(tree: OrganizationTree): Promise<OrganizationMetrics> {
  const totalEmployees = tree.statistics.totalEmployees;
  const departmentCount = tree.statistics.totalDepartments;
  const managementLayers = tree.statistics.hierarchyDepth;

  const managers = tree.topLevel.length + Object.values(tree.departments)
    .filter(dept => dept.head)
    .length;

  const spanOfControl = managers > 0 ? Math.round(totalEmployees / managers) : 0;

  return {
    totalEmployees,
    managementLayers,
    spanOfControl,
    organizationalComplexity: calculateComplexity(tree),
    departmentCount,
    averageTeamSize: tree.statistics.averageTeamSize,
    managerToEmployeeRatio: managers / Math.max(totalEmployees - managers, 1)
  };
}

export async function analyzeDepartments(tree: OrganizationTree): Promise<Record<string, DepartmentSummary>> {
  const departmentSummaries: Record<string, DepartmentSummary> = {};

  for (const [deptName, dept] of Object.entries(tree.departments)) {
    const employees = dept.employees || [];
    const managers = employees.filter(emp =>
      ['manager', 'director', 'department_head'].includes(emp.relationship.relationshipType)
    );

    const tenures = employees.map(emp => calculateTenure(emp.relationship.startDate ?? undefined));
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

export function buildHierarchyLevelsList(tree: OrganizationTree): HierarchyLevel[] {
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
      name: getLevelName(level),
      employees: levelEmployees,
      managerCount: managers.length,
      directReportCount: levelEmployees.reduce((sum, emp) => sum + (emp.directReportCount || 0), 0)
    });
  }

  return levels;
}

export function generateRecommendations(tree: OrganizationTree, metrics: OrganizationMetrics): string[] {
  const recommendations: string[] = [];

  if (metrics.spanOfControl > 15) {
    recommendations.push('Consider reducing span of control - some managers have too many direct reports');
  }
  if (metrics.spanOfControl < 4) {
    recommendations.push('Span of control is low - consider consolidating management layers');
  }
  if (metrics.managementLayers > 7) {
    recommendations.push('Organization has many management layers - consider flattening structure');
  }
  if (metrics.averageTeamSize < 3) {
    recommendations.push('Some departments are very small - consider consolidation');
  }
  if (metrics.averageTeamSize > 20) {
    recommendations.push('Some departments are large - consider splitting into smaller units');
  }

  return recommendations;
}
