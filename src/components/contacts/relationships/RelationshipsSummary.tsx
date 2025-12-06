// ============================================================================
// RELATIONSHIPS SUMMARY COMPONENT
// ============================================================================
//
// 📊 Summary view of contact relationships for main tab display
// Shows key statistics, recent relationships, and management actions
//
// ============================================================================

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Building2,
  UserCheck,
  TrendingUp,
  Eye,
  Settings,
  Plus
} from 'lucide-react';

// 🏢 ENTERPRISE: Import centralized types and hooks
import type { ContactType } from '@/types/contacts';
import { useRelationshipList } from './hooks/useRelationshipList';
import { useOrganizationTree } from './hooks/useOrganizationTree';
import { getRelationshipDisplayProps } from './utils/relationship-types';

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

/**
 * 📊 RelationshipsSummary Component
 *
 * Displays a summary of contact relationships in the main tab
 *
 * Features:
 * - Key statistics (total relationships, by type)
 * - Organization chart preview (for companies/services)
 * - Recent relationships preview
 * - Action buttons for management
 * - Responsive design
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

  const {
    relationships,
    loading: relationshipsLoading,
    error: relationshipsError
  } = useRelationshipList(contactId, contactType);

  const {
    organizationTree,
    loading: treeLoading,
    error: treeError,
    shouldShowTree
  } = useOrganizationTree(contactId, contactType);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const isNewContact = !contactId || contactId === 'new-contact';
  const hasRelationships = relationships.length > 0;
  const isLoading = relationshipsLoading || treeLoading;

  // Statistics calculation
  const stats = React.useMemo(() => {
    const relationshipsByType = relationships.reduce((acc, rel) => {
      acc[rel.relationshipType] = (acc[rel.relationshipType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: relationships.length,
      byType: relationshipsByType,
      mostCommon: Object.entries(relationshipsByType)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || null
    };
  }, [relationships]);

  // Organization statistics
  const orgStats = React.useMemo(() => {
    if (!organizationTree) return { employees: 0, departments: 0, hierarchyLevels: 0 };

    return {
      employees: organizationTree.totalEmployees || 0,
      departments: organizationTree.departments?.length || 0,
      hierarchyLevels: organizationTree.hierarchyDepth || 0
    };
  }, [organizationTree]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  /**
   * 🆕 Render new contact state
   */
  const renderNewContactState = () => (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="text-center text-gray-500">
          <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <h3 className="font-medium text-lg mb-2">Σχέσεις Επαφής</h3>
          <p className="text-sm mb-4">
            Οι σχέσεις θα είναι διαθέσιμες μετά την αποθήκευση της επαφής.
          </p>
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-blue-600">
              💡 <strong>Συμβουλή:</strong> Αποθηκεύστε την επαφή για να προσθέσετε
              επαγγελματικές σχέσεις, εργαζόμενους και μετόχους.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  /**
   * ⏳ Render loading state
   */
  const renderLoadingState = () => (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Users className="h-5 w-5" />
          <span>Σχέσεις Επαφής</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Φόρτωση σχέσεων...</p>
        </div>
      </CardContent>
    </Card>
  );

  /**
   * 📭 Render empty state
   */
  const renderEmptyState = () => (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Σχέσεις Επαφής</span>
          </div>
          {!readonly && onManageRelationships && (
            <Button
              onClick={onManageRelationships}
              size="sm"
              className="ml-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Προσθήκη
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <h3 className="font-medium mb-2">Δεν υπάρχουν σχέσεις</h3>
          <p className="text-gray-500 text-sm mb-4">
            Προσθέστε επαγγελματικές σχέσεις, εργαζόμενους και συνεργάτες.
          </p>
          {!readonly && onManageRelationships && (
            <Button
              onClick={onManageRelationships}
              variant="outline"
              size="sm"
            >
              Ξεκινήστε εδώ
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  /**
   * 📊 Render statistics cards
   */
  const renderStatistics = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* Total Relationships */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-3">
            <Users className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-gray-600">Σύνολο Σχέσεων</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Organization Chart Stats (for companies/services) */}
      {shouldShowTree && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <Building2 className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{orgStats.employees}</p>
                <p className="text-sm text-gray-600">Εργαζόμενοι</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Most Common Relationship */}
      {stats.mostCommon && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <UserCheck className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-lg font-bold">{getRelationshipDisplayProps(stats.mostCommon).label}</p>
                <p className="text-sm text-gray-600">Συχνότερη Σχέση</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  /**
   * 🔍 Render recent relationships preview
   */
  const renderRecentRelationships = () => {
    const recentRelationships = relationships.slice(0, 3);

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Πρόσφατες Σχέσεις</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentRelationships.map((relationship) => {
              const displayProps = getRelationshipDisplayProps(relationship.relationshipType);
              const Icon = displayProps.icon;

              return (
                <div key={relationship.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Icon className="h-5 w-5 text-gray-600" />
                    <div>
                      <Badge className={displayProps.color} variant="outline">
                        {displayProps.label}
                      </Badge>
                      {relationship.position && (
                        <p className="text-sm text-gray-600 mt-1">{relationship.position}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(relationship.createdAt || '').toLocaleDateString('el-GR')}
                  </div>
                </div>
              );
            })}

            {relationships.length > 3 && (
              <div className="text-center pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onManageRelationships}
                  className="text-blue-600"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Προβολή όλων ({relationships.length - 3} ακόμα)
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  /**
   * 🎛️ Render action buttons
   */
  const renderActions = () => (
    <div className="flex justify-center space-x-3">
      <Button
        onClick={onManageRelationships}
        variant="outline"
        className="flex-1 max-w-xs"
      >
        <Eye className="h-4 w-4 mr-2" />
        Προβολή & Διαχείριση
      </Button>

      {!readonly && (
        <Button
          onClick={onManageRelationships}
          className="flex-1 max-w-xs"
        >
          <Settings className="h-4 w-4 mr-2" />
          Επεξεργασία Σχέσεων
        </Button>
      )}
    </div>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  // Handle different states
  if (isNewContact) {
    return renderNewContactState();
  }

  if (isLoading) {
    return renderLoadingState();
  }

  if (!hasRelationships) {
    return renderEmptyState();
  }

  // Main summary view with data
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
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Statistics */}
          {renderStatistics()}

          {/* Recent relationships */}
          {renderRecentRelationships()}

          {/* Action buttons */}
          {renderActions()}
        </CardContent>
      </Card>
    </div>
  );
};

export default RelationshipsSummary;