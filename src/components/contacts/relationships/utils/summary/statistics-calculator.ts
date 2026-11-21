// ============================================================================
// STATISTICS CALCULATOR UTILITY - ENTERPRISE MODULE
// ============================================================================
//
// 📊 Pure functions για υπολογισμό relationship statistics
// Separated από το main component για reusability και testability
//
// ============================================================================

import type { ContactRelationship } from '@/types/contacts/relationships';
import { isManagerialRelationshipType } from '@/types/contacts/relationships/core/relationship-metadata';
import { isManagerialPosition } from '@/types/contacts/relationships/core/relationship-positions';
import { normalizeToDate } from '@/lib/date-local';

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
 * 🏢 Calculate management-level relationship statistics (ADR-372 §8.3):
 * `direct` = the ROLE is declared people-managing; `positionBased` = only the
 * position preset is. Free-text titles are never guessed.
 */
export function calculateManagementStats(relationships: ContactRelationship[]) {
  const direct = relationships.filter(rel =>
    isManagerialRelationshipType(rel.relationshipType)
  ).length;

  const positionBased = relationships.filter(rel =>
    isManagerialPosition(rel.position) &&
    !isManagerialRelationshipType(rel.relationshipType) // Avoid double counting
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
    const relCreatedAt = normalizeToDate(rel.createdAt);
    return relCreatedAt ? relCreatedAt > oneMonthAgo : false;
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