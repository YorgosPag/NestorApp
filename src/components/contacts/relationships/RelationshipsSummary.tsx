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
import { Button } from '@/components/ui/button';
import { Users, Building2, TrendingUp, Settings, RefreshCw } from 'lucide-react';

// 🏢 ENTERPRISE: Import centralized components και hooks
import type { ContactType } from '@/types/contacts';
import type { DashboardStat } from '@/core/dashboards/UnifiedDashboard';
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

  const router = useRouter();

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
   * 🔗 Handle individual relationship click
   */
  const handleRelationshipClick = (relationship: any) => {
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
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Σχέσεις Επαφής</span>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={handleRefresh}
                size="sm"
                variant="outline"
                className="text-blue-600 border-blue-300 hover:bg-blue-50"
                disabled={relationshipsLoading}
                title="Ανανέωση σχέσεων"
              >
                <RefreshCw className={`h-4 w-4 ${relationshipsLoading ? 'animate-spin' : ''}`} />
              </Button>
              {!readonly && onManageRelationships && (
                <Button
                  onClick={onManageRelationships}
                  size="sm"
                  variant="outline"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Διαχείριση
                </Button>
              )}
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
                <Building2 className="h-5 w-5 text-blue-600" />
                <h4 className="text-sm font-medium text-gray-900">Οργανωτικό Διάγραμμα</h4>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border">
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