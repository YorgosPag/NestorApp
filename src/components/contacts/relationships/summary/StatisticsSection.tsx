// ============================================================================
// STATISTICS SECTION COMPONENT - ENTERPRISE MODULE
// ============================================================================
//
// 📊 Dedicated component για relationship statistics dashboard
// Extracted από RelationshipsSummary για modularity
//
// ============================================================================

'use client';

import React from 'react';
import type { ContactRelationship } from '@/types/contacts/relationships';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useRelationshipStatistics } from '../hooks/summary/useRelationshipStatistics';

// ============================================================================
// TYPES
// ============================================================================

interface StatisticsSectionProps {
  /** Array of contact relationships */
  relationships: ContactRelationship[];
  /** Current contact ID for context */
  contactId: string;
  /** Callback when dashboard card is clicked */
  onCardClick?: (stat: DashboardStat, index: number) => void;
  /** Optional CSS className */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * 📊 StatisticsSection Component
 *
 * Enterprise dashboard component για relationship statistics
 *
 * Features:
 * - Centralized statistics calculation
 * - Interactive dashboard cards
 * - Performance optimized with memoization
 * - Responsive design
 */
export const StatisticsSection: React.FC<StatisticsSectionProps> = ({
  relationships,
  contactId,
  onCardClick,
  className = "mb-6"
}) => {
  // ============================================================================
  // HOOKS
  // ============================================================================

  const { quick } = useBorderTokens();
  const { stats, dashboardStats } = useRelationshipStatistics(relationships, contactId);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={className}>
      <UnifiedDashboard
        stats={dashboardStats}
        columns={4}
        className={`p-4 ${quick.borderB} bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 ${quick.card.replace('border', 'rounded-lg')}`}
        onCardClick={onCardClick}
      />
    </div>
  );
};

// ============================================================================
// EXPORT
// ============================================================================

export default StatisticsSection;