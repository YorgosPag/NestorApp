// ============================================================================
// RELATIONSHIPS SUMMARY COMPONENT - ENTERPRISE REFACTORED
// ============================================================================
//
// 📊 Modular, enterprise-grade relationships summary component
// Refactored από monolithic RelationshipsSummary για better maintainability
//
// ============================================================================

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Building2 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: Import centralized components και hooks
import type { ContactType } from '@/types/contacts';
import type { ContactRelationship } from '@/types/contacts/relationships'; // 🏢 ENTERPRISE: Type-safe relationships
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { useContactNames } from './hooks/useContactNames';
import { useRelationshipContext } from './context/RelationshipProvider';
import { useOrganizationTree } from './hooks/useOrganizationTree';
import { OrganizationTree } from './OrganizationTree';

// 🎯 ENTERPRISE: Import modular components
import { StatisticsSection } from './summary/StatisticsSection';
import { RecentRelationshipsSection } from './summary/RecentRelationshipsSection';
import { ActionsSection } from './summary/ActionsSection';
import { NewContactState, LoadingState, EmptyState } from './summary/StateComponents';

// 🔗 ENTERPRISE: Import navigation utilities
import { navigateToDashboardFilter, navigateToRelationshipContact } from './utils/summary/contact-navigation';

// ============================================================================
// TYPES
// ============================================================================

interface RelationshipsSummaryProps {
  /** Contact ID for the relationship source */
  contactId: string;
  /** Type of contact */
  contactType: ContactType;
  /** Whether in read-only mode */
  readonly?: boolean;
  /** Callback when user wants to manage relationships */
  onManageRelationships?: () => void;
  /** Optional CSS class */
  className?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * 📊 RelationshipsSummary Component - Enterprise Refactored
 *
 * Modular, enterprise-grade relationships summary με separation of concerns
 *
 * Features:
 * - Modular component architecture
 * - Centralized business logic
 * - Performance optimized με memoization
 * - Clean separation between UI και data logic
 * - Reusable sub-components
 */
export const RelationshipsSummary: React.FC<RelationshipsSummaryProps> = ({
  contactId,
  contactType,
  readonly = false,
  onManageRelationships,
  className
}) => {
  // ============================================================================
  // HOOKS
  // ============================================================================

  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const router = useRouter();
  const { t } = useTranslation('contacts');

  const {
    relationships,
    loading: relationshipsLoading,
    error: relationshipsError,
    refreshRelationships
  } = useRelationshipContext();

  const {
    organizationTree,
    loading: treeLoading,
    error: treeError,
    shouldShowTree
  } = useOrganizationTree(contactId, contactType);

  const { contactNames } = useContactNames(relationships, contactId);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const isNewContact = !contactId || contactId === 'new-contact';
  const hasRelationships = relationships.length > 0;
  const isLoading = relationshipsLoading || treeLoading;

  // ============================================================================
  // HANDLERS
  // ============================================================================

  /**
   * 🎯 Handle dashboard card click navigation
   */
  const handleDashboardCardClick = (stat: DashboardStat, index: number) => {
    navigateToDashboardFilter(
      stat.title,
      relationships,
      contactNames,
      contactId,
      router
    );
  };

  /**
   * 🔗 Handle individual relationship click - ENTERPRISE TYPE SAFE
   */
  const handleRelationshipClick = (relationship: ContactRelationship) => {
    navigateToRelationshipContact(
      relationship,
      contactNames,
      contactId,
      router
    );
  };

  /**
   * 🔄 Handle refresh button click με enhanced feedback
   */
  const handleRefresh = async () => {
    try {
      console.log('🔄 SUMMARY: Manual refresh triggered by user');
      await refreshRelationships();
      console.log('✅ SUMMARY: Manual refresh completed successfully');
    } catch (error) {
      console.error('❌ SUMMARY: Manual refresh failed:', error);
    }
  };

  // ============================================================================
  // EARLY RETURNS FOR DIFFERENT STATES
  // ============================================================================

  if (isNewContact) {
    return <NewContactState className={className} />;
  }

  if (isLoading) {
    return <LoadingState className={className} />;
  }

  if (!hasRelationships) {
    return (
      <EmptyState
        className={className}
        readonly={readonly}
        onManageRelationships={onManageRelationships}
      />
    );
  }

  // ============================================================================
  // MAIN RENDER - WITH DATA
  // ============================================================================

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <div className="flex items-center space-x-2">
              <Users className={iconSizes.md} />
              <span>{t('relationships.summary.title')}</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* 📊 Statistics Dashboard */}
          <StatisticsSection
            relationships={relationships}
            contactId={contactId}
            onCardClick={handleDashboardCardClick}
          />

          {/* 🏢 Organization Tree (για companies/services) */}
          {shouldShowTree && (
            <div className="mt-6 mb-6">
              <div className="flex items-center space-x-2 mb-4">
                <Building2 className={`${iconSizes.md} text-blue-600`} />
                <h4 className="text-sm font-medium text-gray-900">{t('relationships.summary.organizationChart')}</h4>
              </div>
              <div className={`${colors.bg.secondary} rounded-lg p-4 border`}>
                <OrganizationTree
                  tree={organizationTree}
                  loading={treeLoading}
                  error={treeError}
                  readonly={readonly}
                />
              </div>
            </div>
          )}

          {/* 🔍 Recent Relationships */}
          <RecentRelationshipsSection
            relationships={relationships}
            contactNames={contactNames}
            contactId={contactId}
            onRelationshipClick={handleRelationshipClick}
          />

          {/* 🎛️ Action Buttons */}
          <ActionsSection
            readonly={readonly}
            onManageRelationships={onManageRelationships}
          />
        </CardContent>
      </Card>
    </div>
  );
};

// ============================================================================
// EXPORT
// ============================================================================

export default RelationshipsSummary;