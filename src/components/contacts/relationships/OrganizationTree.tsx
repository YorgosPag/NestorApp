// ============================================================================
// ORGANIZATION TREE COMPONENT
// ============================================================================
//
// 🌳 Component for displaying organization hierarchy tree
// Extracted from ContactRelationshipManager for better modularity
//
// ============================================================================

'use client';

import React from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Users } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/hooks/useSemanticColors';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: Import centralized types
import type { OrganizationTree as OrganizationTreeType } from '@/types/contacts/relationships';
import { TRANSITION_PRESETS, INTERACTIVE_PATTERNS } from '@/components/ui/effects';

// 🪝 Import contact name hook
import { useContactName } from './hooks/useContactName';

const logger = createModuleLogger('OrganizationTree');

// 🏢 ENTERPRISE: Helper component for contact badge
interface ContactBadgeProps {
  contactId: string;
  position?: string;
  relationshipType?: string;
}

const ContactBadge: React.FC<ContactBadgeProps> = ({ contactId, position, relationshipType }) => {
  logger.info('ContactBadge rendering', { contactId, position, relationshipType });
  const { contactName, loading } = useContactName(contactId);
  const { getStatusBorder, quick } = useBorderTokens();
  const colors = useSemanticColors();
  logger.info('ContactBadge hook result', { contactName, loading });

  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('contacts');

  if (loading) {
    return (
      <Badge variant="outline" className={`text-xs ${colors.bg.secondary} ${quick.table} ${colors.text.muted}`}>
        {t('relationships.organizationTree.loading')}
      </Badge>
    );
  }

  // Display contact name with position if available
  const unknownContact = t('relationships.organizationTree.unknownContact');
  const defaultEmployee = t('relationships.organizationTree.employee');
  const displayText = contactName && contactName !== unknownContact
    ? (position ? `${contactName} (${position})` : contactName)
    : (position || relationshipType || defaultEmployee);

  return (
    <Badge
      variant="outline"
      className={`text-xs ${colors.bg.info} ${getStatusBorder('info')} ${colors.text.info}`}
    >
      {displayText}
    </Badge>
  );

};

// 🏢 ENTERPRISE: Component props interface
interface OrganizationTreeProps {
  /** The organization tree data */
  tree: OrganizationTreeType | null;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: string | null;
  /** Read-only mode */
  readonly?: boolean;
}

/**
 * 🌳 OrganizationTree Component
 *
 * Displays organization hierarchy with statistics and department breakdown
 *
 * Features:
 * - Organization statistics display
 * - Department breakdown
 * - Hierarchy depth visualization
 * - Recent additions preview
 * - Loading and error states
 */
export const OrganizationTree: React.FC<OrganizationTreeProps> = ({
  tree,
  loading,
  error,
  readonly = false
}) => {
  // ============================================================================
  // HOOKS
  // ============================================================================
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('contacts');

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  /**
   * ⏳ Render loading state
   */
  const renderLoadingState = () => {
    const iconSizes = useIconSizes();
    return (
      <div className={`text-center ${colors.text.muted} py-8`}>
        <Building2 className={`${iconSizes.xl} mx-auto mb-2 animate-pulse`} />
        <p>{t('relationships.organizationTree.loadingTree')}</p>
      </div>
    );
  };

  /**
   * ❌ Render error state
   */
  const renderErrorState = () => {
    const iconSizes = useIconSizes();
    return (
      <div className={`text-center ${colors.text.danger} py-8`}>
        <Building2 className={`${iconSizes.xl} mx-auto mb-2`} />
        <p className="font-medium">{t('relationships.organizationTree.loadError')}</p>
        <p className={`text-sm ${colors.text.muted} mt-1`}>{error}</p>
      </div>
    );
  };

  /**
   * 📭 Render empty state
   */
  const renderEmptyState = () => {
    const iconSizes = useIconSizes();
    return (
      <div className={`text-center ${colors.text.muted} py-8`}>
        <Building2 className={`${iconSizes.xl} mx-auto mb-2 ${colors.text.disabled}`} />
        <p className="font-medium">{t('relationships.organizationTree.emptyTree')}</p>
        <p className="text-sm mt-1">
          {t('relationships.organizationTree.noEmployeeRelationships')}
        </p>
      </div>
    );
  };

  /**
   * 🏗️ Render organization statistics - ADAPTIVE & USER-FRIENDLY
   */
  const renderStatistics = () => {
    const iconSizes = useIconSizes();
    if (!tree?.statistics) return null;

    const { totalEmployees, hierarchyDepth, departmentCount } = tree.statistics;

    // Only show statistics that have meaningful values > 0
    const stats = [];

    if ((totalEmployees || 0) > 0) {
      stats.push({
        value: totalEmployees,
        label: t('relationships.organizationTree.totalEmployees'),
        icon: Users,
        color: 'blue'
      });
    }

    if ((departmentCount || 0) > 0) {
      stats.push({
        value: departmentCount,
        label: t('relationships.organizationTree.activeDepartments'),
        icon: Building2,
        color: 'green'
      });
    }

    if ((hierarchyDepth || 0) > 1) { // Only show if > 1 (meaningful hierarchy)
      stats.push({
        value: hierarchyDepth,
        label: t('relationships.organizationTree.managementLevels'),
        icon: Building2,
        color: 'purple'
      });
    }

    // If no meaningful stats, show user-friendly message
    if (stats.length === 0) {
      return (
        <div className={`text-center p-6 ${colors.bg.secondary} ${quick.card} border border-dashed ${quick.table}`}>
          <Building2 className={`${iconSizes.xl} mx-auto mb-3 ${colors.text.muted}`} />
          <h3 className={`font-medium ${colors.text.primary} mb-1`}>{t('relationships.organizationTree.simpleStructure')}</h3>
          <p className={`text-sm ${colors.text.muted}`}>
            {t('relationships.organizationTree.simpleStructureDescription')}
          </p>
        </div>
      );
    }

    // Render only meaningful statistics
    return (
      <div className={`grid grid-cols-1 ${stats.length > 1 ? 'md:grid-cols-' + Math.min(stats.length, 3) : ''} gap-4 mb-6`}>
        {stats.map(({ value, label, icon: Icon, color }, index) => {
          // 🏢 ENTERPRISE: Safe centralized color mapping
          const getStatBackground = (colorName: string) => {
            switch(colorName) {
              case 'blue': return colors.bg.info;
              case 'green': return colors.bg.success;
              case 'purple': return colors.bg.secondary; // No purple in system, use secondary
              default: return colors.bg.secondary;
            }
          };

          return (
            <div key={index} className={`text-center p-4 ${getStatBackground(color)} ${quick.card}`}>
              <Icon className={`${iconSizes.lg} mx-auto mb-2 text-${color}-600`} />
              <p className={`text-2xl font-bold text-${color}-800`}>{value}</p>
              <p className={`text-sm text-${color}-600`}>{label}</p>
            </div>
          );
        })}
      </div>
    );
  };

  /**
   * 🏢 Render departments breakdown
   */
  const renderDepartments = () => {
    if (!tree?.departments || Object.keys(tree.departments).length === 0) {
      return null;
    }

    return (
      <div className="mb-6">
        <h4 className={`text-sm font-medium ${colors.text.primary} mb-3`}>{t('relationships.organizationTree.departmentsAndEmployees')}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(tree.departments).map(([department, employees]) => (
            <div
              key={department}
              className={`p-3 ${quick.card} ${colors.bg.secondary} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className={`font-medium ${colors.text.primary}`}>
                  {department || t('relationships.organizationTree.generalDepartment')}
                </p>
                <Badge variant="secondary" className="text-xs">
                  {Array.isArray(employees) ? employees.length : 0}
                </Badge>
              </div>

              {Array.isArray(employees) && employees.length > 0 && (
                <div className="space-y-1">
                  {employees.slice(0, 3).map((employee, index) => (
                    <p key={index} className={`text-xs ${colors.text.muted}`}>
                      • {employee.position || t('relationships.organizationTree.employee')}
                    </p>
                  ))}
                  {employees.length > 3 && (
                    <p className={`text-xs ${colors.text.muted} italic`}>
                      {t('relationships.organizationTree.moreItems', { count: employees.length - 3 })}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  /**
   * 👥 Render recent additions
   */
  const renderRecentAdditions = () => {
    logger.info('renderRecentAdditions called', { hasTree: !!tree, childrenCount: tree?.children?.length || 0 });

    if (!tree?.children || tree.children.length === 0) {
      logger.info('No children found, returning null');
      return null;
    }

    logger.info('About to render children', { count: tree.children.length });
    return (
      <div>
        <h4 className={`text-sm font-medium ${colors.text.primary} mb-3`}>{t('relationships.organizationTree.recentAdditions')}</h4>
        <div className="flex flex-wrap gap-2">
          {tree.children.slice(0, 8).map((child, index) => (
            <ContactBadge
              key={child.id || index}
              contactId={child.id}
              position={child.position}
              relationshipType={child.relationshipType}
            />
          ))}
          {tree.children.length > 8 && (
            <Badge variant="outline" className={`text-xs ${colors.text.muted}`}>
              {t('relationships.organizationTree.moreItems', { count: tree.children.length - 8 })}
            </Badge>
          )}
        </div>
      </div>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  // Handle loading state
  if (loading) {
    return renderLoadingState();
  }

  // Handle error state
  if (error) {
    return renderErrorState();
  }

  // Handle empty/null tree
  if (!tree) {
    return renderEmptyState();
  }

  return (
    <div className="space-y-6">
      {/* Organization Statistics */}
      {renderStatistics()}

      {/* Departments Breakdown */}
      {renderDepartments()}

      {/* Recent Additions */}
      {renderRecentAdditions()}

      {/* Additional Info */}
      {tree.statistics && (
        <Card className={`${colors.bg.secondary} ${quick.table}`}>
          <CardContent className="pt-4">
            <div className={`text-xs ${colors.text.muted} space-y-1`}>
              <p>
                <strong>{t('relationships.organizationTree.lastUpdated')}:</strong>{' '}
                {tree.updatedAt
                  ? new Date(tree.updatedAt).toLocaleDateString('el-GR')
                  : t('relationships.organizationTree.unknown')
                }
              </p>
              <p>
                <strong>{t('relationships.organizationTree.createdAt')}:</strong>{' '}
                {tree.createdAt
                  ? new Date(tree.createdAt).toLocaleDateString('el-GR')
                  : t('relationships.organizationTree.unknown')
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OrganizationTree;