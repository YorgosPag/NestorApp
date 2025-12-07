// ============================================================================
// STATISTICS CALCULATOR UTILITY - ENTERPRISE MODULE
// ============================================================================
//
// 📊 Pure functions για υπολογισμό relationship statistics
// Separated από το main component για reusability και testability
//
// ============================================================================

import type { ContactRelationship } from '@/types/contacts/relationships';

// ============================================================================
// TYPES
// ============================================================================

export interface RelationshipStats {
  total: number;
  byType: Record<string, number>;
  mostCommon: string | null;
  employees: number;
  shareholders: number;
  consultants: number;
  management: {
    direct: number;
    positionBased: number;
    total: number;
  };
  recent: number;
  key: number;
  departments: number;
}

// ============================================================================
// CALCULATIONS
// ============================================================================

/**
 * 📊 Calculate comprehensive relationship statistics
 */
export function calculateRelationshipStats(
  relationships: ContactRelationship[]
): RelationshipStats {
  // Basic stats by type
  const relationshipsByType = relationships.reduce((acc, rel) => {
    acc[rel.relationshipType] = (acc[rel.relationshipType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Most common relationship type
  const mostCommon = Object.entries(relationshipsByType)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || null;

  // Specific counts
  const employees = relationshipsByType['employee'] || 0;
  const shareholders = relationshipsByType['shareholder'] || 0;
  const consultants = relationshipsByType['consultant'] || 0;

  // Management calculations
  const management = calculateManagementStats(relationships);

  // Recent relationships (last month)
  const recent = calculateRecentRelationships(relationships);

  // Key relationships
  const key = relationships.filter(rel =>
    rel.relationshipType === 'employee' ||
    rel.relationshipType === 'shareholder' ||
    rel.relationshipType === 'partner'
  ).length;

  // Departments
  const departments = calculateDepartmentsCount(relationships);

  return {
    total: relationships.length,
    byType: relationshipsByType,
    mostCommon,
    employees,
    shareholders,
    consultants,
    management,
    recent,
    key,
    departments
  };
}

/**
 * 🏢 Calculate management-level relationship statistics
 */
export function calculateManagementStats(relationships: ContactRelationship[]) {
  const managementTypes = ['director', 'manager', 'executive', 'ceo', 'chairman'];

  const direct = relationships.filter(rel =>
    managementTypes.includes(rel.relationshipType)
  ).length;

  const positionBased = relationships.filter(rel =>
    rel.position && (
      rel.position.toLowerCase().includes('διευθυντής') ||
      rel.position.toLowerCase().includes('manager') ||
      rel.position.toLowerCase().includes('ceo') ||
      rel.position.toLowerCase().includes('cto') ||
      rel.position.toLowerCase().includes('γενικός διευθυντής') ||
      rel.position.toLowerCase().includes('ανώτερο στέλεχος')
    ) && !managementTypes.includes(rel.relationshipType) // Avoid double counting
  ).length;

  return {
    direct,
    positionBased,
    total: direct + positionBased
  };
}

/**
 * 📅 Calculate recent relationships count (last month)
 */
export function calculateRecentRelationships(relationships: ContactRelationship[]): number {
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  return relationships.filter(rel => {
    if (!rel.createdAt) return false;

    let relCreatedAt: Date;

    // Handle different createdAt formats
    if (typeof rel.createdAt === 'string') {
      relCreatedAt = new Date(rel.createdAt);
    } else if (rel.createdAt && typeof rel.createdAt === 'object' && 'toDate' in rel.createdAt) {
      // Firestore Timestamp object
      relCreatedAt = rel.createdAt.toDate();
    } else if (rel.createdAt instanceof Date) {
      relCreatedAt = rel.createdAt;
    } else {
      return false;
    }

    return relCreatedAt > oneMonthAgo;
  }).length;
}

/**
 * 🏢 Calculate unique departments count
 */
export function calculateDepartmentsCount(relationships: ContactRelationship[]): number {
  const departmentsWithData = relationships.filter(rel =>
    rel.department && rel.department.trim()
  );

  return new Set(
    departmentsWithData.map(rel => rel.department!.trim())
  ).size;
}

// ============================================================================
// EXPORT
// ============================================================================

export default calculateRelationshipStats;