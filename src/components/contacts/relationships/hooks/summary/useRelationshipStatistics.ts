// ============================================================================
// USE RELATIONSHIP STATISTICS HOOK - ENTERPRISE MODULE
// ============================================================================
//
// 📊 Custom hook για relationship statistics με memoization
// Optimized για performance και reusability
//
// ============================================================================

import { useMemo } from 'react';
import type { ContactRelationship } from '@/types/contacts/relationships';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { calculateRelationshipStats, type RelationshipStats } from '../../utils/summary/statistics-calculator';
import {
  Users,
  UserCheck,
  Briefcase,
  Calendar,
  Star,
  Target,
  Award,
  Zap
} from 'lucide-react';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('useRelationshipStatistics');

// ============================================================================
// HOOK
// ============================================================================

/**
 * 📊 useRelationshipStatistics Hook
 *
 * Provides comprehensive relationship statistics with performance optimization
 *
 * @param relationships - Array of contact relationships
 * @param contactId - Current contact ID for debugging
 * @returns Statistics object and dashboard stats array
 */
export function useRelationshipStatistics(
  relationships: ContactRelationship[],
  contactId: string
) {
  // ============================================================================
  // MEMOIZED CALCULATIONS
  // ============================================================================

  const stats: RelationshipStats = useMemo(() => {
    logger.info('RELATIONSHIPS STATS: Current relationships for contactId', { contactId, count: relationships.length });
    logger.info('RELATIONSHIPS TYPES:', { data: relationships.map(r => ({
      id: r.id,
      type: r.relationshipType,
      source: r.sourceContactId,
      target: r.targetContactId
    })) });

    const calculatedStats = calculateRelationshipStats(relationships);

    logger.info('RELATIONSHIPS BY TYPE:', { data: calculatedStats.byType });
    logger.info('MANAGEMENT STATS:', { data: {
      directManagementCount: calculatedStats.management.direct,
      positionBasedManagementCount: calculatedStats.management.positionBased,
      totalManagementCount: calculatedStats.management.total,
      relationshipsByType: calculatedStats.byType,
      managementRelationships: relationships.filter(rel => {
        const managementTypes = ['director', 'manager', 'executive', 'ceo', 'chairman'];
        return managementTypes.includes(rel.relationshipType) ||
          (rel.position && (
            rel.position.toLowerCase().includes('διευθυντής') ||
            rel.position.toLowerCase().includes('manager') ||
            rel.position.toLowerCase().includes('ceo')
          ));
      }).map(r => ({ type: r.relationshipType, position: r.position }))
    } });

    return calculatedStats;
  }, [relationships, contactId]);

  // ============================================================================
  // DASHBOARD STATS GENERATION
  // ============================================================================

  // 🌐 i18n: All dashboard stat titles converted to i18n keys - 2026-01-18
  const dashboardStats: DashboardStat[] = useMemo(() => {
    return [
      // 🔝 Πάνω σειρά (4 κάρτες) - Βασικά Στοιχεία
      {
        title: "relationships.stats.totalRelationships",
        value: stats.total,
        icon: Users,
        color: "blue"
      },
      {
        title: "relationships.stats.employees",
        value: stats.employees,
        icon: Briefcase,
        color: "green"
      },
      {
        title: "relationships.stats.shareholders",
        value: stats.shareholders,
        icon: Award,
        color: "purple"
      },
      {
        title: "relationships.stats.consultants",
        value: stats.consultants,
        icon: Zap,
        color: "orange"
      },

      // 🔽 Κάτω σειρά (4 κάρτες) - Λεπτομέρειες
      {
        title: "relationships.stats.management",
        value: stats.management.total,
        icon: UserCheck,
        color: "indigo"
      },
      {
        title: "relationships.stats.recent",
        value: stats.recent,
        icon: Calendar,
        color: "pink"
      },
      {
        title: "relationships.stats.key",
        value: stats.key,
        icon: Star,
        color: "yellow"
      },
      {
        title: "relationships.stats.departments",
        value: stats.departments,
        icon: Target,
        color: "cyan"
      }
    ];
  }, [stats]);

  // ============================================================================
  // DEBUG LOGGING
  // ============================================================================

  useMemo(() => {
    logger.info('DEBUG RELATIONSHIPS DATA:', { data: relationships.map(rel => ({
      id: rel.id,
      type: rel.relationshipType,
      createdAt: rel.createdAt,
      createdAtType: typeof rel.createdAt,
      department: rel.department,
      departmentType: typeof rel.department
    })) });

    relationships.forEach(rel => {
      logger.info('RECENT CHECK:', { data: {
        id: rel.id,
        createdAt: rel.createdAt,
        createdAtExists: !!rel.createdAt,
        createdAtType: typeof rel.createdAt
      } });

      if (rel.createdAt) {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        let relCreatedAt: Date;
        if (typeof rel.createdAt === 'string') {
          relCreatedAt = new Date(rel.createdAt);
        } else if (rel.createdAt && typeof rel.createdAt === 'object' && 'toDate' in rel.createdAt) {
          relCreatedAt = rel.createdAt.toDate();
        } else if (rel.createdAt instanceof Date) {
          relCreatedAt = rel.createdAt;
        } else {
          return;
        }

        const isRecent = relCreatedAt > oneMonthAgo;
        logger.info('RECENT RESULT:', { data: {
          id: rel.id,
          relCreatedAt: relCreatedAt.toISOString(),
          oneMonthAgo: oneMonthAgo.toISOString(),
          isRecent
        } });
      }

      const hasDept = !!(rel.department && rel.department.trim());
      logger.info('DEPT CHECK:', { data: {
        id: rel.id,
        department: rel.department,
        departmentTrimmed: rel.department?.trim(),
        hasDept,
        type: rel.relationshipType
      } });
    });

    const departmentsWithData = relationships.filter(rel =>
      rel.department && rel.department.trim()
    );

    logger.info('DEPARTMENTS FINAL:', { data: {
      departmentsWithData: departmentsWithData.length,
      uniqueDepartments: Array.from(new Set(departmentsWithData.map(rel => rel.department!.trim()))),
      departmentsCount: stats.departments
    } });
  }, [relationships, stats.departments]);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    stats,
    dashboardStats
  };
}

// ============================================================================
// EXPORT
// ============================================================================

export default useRelationshipStatistics;