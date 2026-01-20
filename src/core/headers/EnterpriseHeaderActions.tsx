// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
// ============================================================================
// ENTERPRISE HEADER ACTIONS - CENTRALIZED COMPONENT
// ============================================================================
//
// 🏢 Enterprise-grade header actions component that consolidates duplicate
// HeaderActions from projects and buildings pages into a single reusable component
//
// 🎯 CONSOLIDATION TARGET:
// - src/components/projects/page/HeaderActions.tsx (36 lines) ✅ REPLACED
// - src/components/building-management/BuildingsPage/HeaderActions.tsx (37 lines) ✅ REPLACED
//
// 🚀 ENTERPRISE FEATURES:
// - Configurable entity type (project, building, contact, etc.)
// - Dashboard toggle functionality
// - Enterprise TypeScript patterns (no `as any`, function overloads)
// - Backward compatibility with existing usage
// - Accessible tooltips and keyboard navigation
// - Responsive design patterns
//
// ============================================================================

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { BarChart3, Plus, LucideIcon } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { cn } from '@/lib/utils';
import { GRADIENT_HOVER_EFFECTS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { useTranslation } from 'react-i18next';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * 🏢 Enterprise Header Actions Props
 *
 * Configurable props for different entity types and use cases
 */
// 🏢 ENTERPRISE: Component type with static factory methods
interface EnterpriseHeaderActionsComponent extends React.FC<EnterpriseHeaderActionsProps> {
  /** Projects header actions factory */
  forProjects: (props: Omit<EnterpriseHeaderActionsProps, 'entityType'>) => React.ReactElement;
  /** Buildings header actions factory */
  forBuildings: (props: Omit<EnterpriseHeaderActionsProps, 'entityType'>) => React.ReactElement;
  /** Contacts header actions factory */
  forContacts: (props: Omit<EnterpriseHeaderActionsProps, 'entityType'>) => React.ReactElement;
  /** Units header actions factory */
  forUnits: (props: Omit<EnterpriseHeaderActionsProps, 'entityType'>) => React.ReactElement;
}

export interface EnterpriseHeaderActionsProps {
  /** Dashboard toggle state */
  showDashboard: boolean;

  /** Dashboard toggle callback */
  setShowDashboard: (show: boolean) => void;

  /** Entity type for button text (e.g., "έργο", "κτίριο", "επαφή") */
  entityType: string;

  /** Optional callback for create new entity action */
  onCreateNew?: () => void;

  /** Optional icon for create button (defaults to Plus) */
  createIcon?: LucideIcon;

  /** Optional dashboard tooltip text override */
  dashboardTooltip?: string;

  /** Optional create button tooltip text override */
  createTooltip?: string;

  /** Optional custom className for container */
  className?: string;

  /** Whether to show create button (default: true) */
  showCreateButton?: boolean;

  /** Whether to show dashboard button (default: true) */
  showDashboardButton?: boolean;

  /** Optional custom create button text (overrides entityType-based text) */
  customCreateText?: string;

  /** Additional actions to render before create button */
  additionalActions?: React.ReactNode;
}

// ============================================================================
// ENTITY TYPE KEYS (i18n)
// ============================================================================

// 🏢 ENTERPRISE: Maps entity type identifiers to i18n keys
const ENTITY_TYPE_KEYS: Record<string, string> = {
  'project': 'headerActions.entities.project',
  'building': 'headerActions.entities.building',
  'contact': 'headerActions.entities.contact',
  'unit': 'headerActions.entities.unit',
  // Legacy Greek identifiers for backward compatibility
  'έργο': 'headerActions.entities.project',
  'κτίριο': 'headerActions.entities.building',
  'επαφή': 'headerActions.entities.contact',
  'μονάδα': 'headerActions.entities.unit',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * 🏢 EnterpriseHeaderActions Component
 *
 * Centralized header actions component that replaces duplicate
 * HeaderActions components across the application
 *
 * @example
 * // Projects page usage (language-neutral identifier)
 * <EnterpriseHeaderActions
 *   showDashboard={showDashboard}
 *   setShowDashboard={setShowDashboard}
 *   entityType="project"
 *   onCreateNew={handleCreateProject}
 * />
 *
 * @example
 * // Buildings page usage (language-neutral identifier)
 * <EnterpriseHeaderActions
 *   showDashboard={showDashboard}
 *   setShowDashboard={setShowDashboard}
 *   entityType="building"
 *   onCreateNew={handleCreateBuilding}
 * />
 */
const EnterpriseHeaderActionsBase: React.FC<EnterpriseHeaderActionsProps> = ({
  showDashboard,
  setShowDashboard,
  entityType,
  onCreateNew,
  createIcon: CreateIcon = Plus,
  dashboardTooltip,
  createTooltip,
  className,
  showCreateButton = true,
  showDashboardButton = true,
  customCreateText,
  additionalActions
}) => {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('common');

  // ============================================================================
  // COMPUTED VALUES (i18n)
  // ============================================================================

  // 🏢 ENTERPRISE: Get entity label from i18n
  const entityLabelKey = ENTITY_TYPE_KEYS[entityType] || 'headerActions.entities.project';
  const entityLabel = t(entityLabelKey);

  // 🏢 ENTERPRISE: Generate i18n-enabled button text and tooltips
  const dashboardLabel = t('headerActions.dashboard');
  const createButtonText = customCreateText || t('headerActions.createNew', { entity: entityLabel });
  const finalDashboardTooltip = dashboardTooltip || t('headerActions.toggleDashboard');
  const finalCreateTooltip = createTooltip || t('headerActions.createTooltip', { entity: entityLabel });

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleDashboardToggle = React.useCallback(() => {
    setShowDashboard(!showDashboard);
  }, [showDashboard, setShowDashboard]);

  const handleCreateNew = React.useCallback(() => {
    onCreateNew?.();
  }, [onCreateNew]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Dashboard Toggle Button */}
      {showDashboardButton && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={showDashboard ? 'default' : 'outline'}
              size="sm"
              onClick={handleDashboardToggle}
              aria-label={finalDashboardTooltip}
            >
              <BarChart3 className={`${iconSizes.sm} mr-2`} />
              {dashboardLabel}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{finalDashboardTooltip}</TooltipContent>
        </Tooltip>
      )}

      {/* Additional Actions Slot */}
      {additionalActions}

      {/* Create New Entity Button */}
      {showCreateButton && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className={`${GRADIENT_HOVER_EFFECTS.PRIMARY_BUTTON} ${TRANSITION_PRESETS.STANDARD_ALL}`}
              onClick={handleCreateNew}
              aria-label={finalCreateTooltip}
            >
              <CreateIcon className={`${iconSizes.sm} mr-2`} />
              {createButtonText}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{finalCreateTooltip}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};

// ============================================================================
// ENTERPRISE PATTERNS & CONVENIENCE FACTORIES
// ============================================================================

/**
 * 🏢 Convenience factory functions for common use cases
 */
// 🏢 ENTERPRISE: Factory functions with language-neutral entity identifiers
export const EnterpriseHeaderActionsFactories = {
  /**
   * Projects header actions factory
   */
  forProjects: (props: Omit<EnterpriseHeaderActionsProps, 'entityType'>) =>
    <EnterpriseHeaderActions {...props} entityType="project" />,

  /**
   * Buildings header actions factory
   */
  forBuildings: (props: Omit<EnterpriseHeaderActionsProps, 'entityType'>) =>
    <EnterpriseHeaderActions {...props} entityType="building" />,

  /**
   * Contacts header actions factory
   */
  forContacts: (props: Omit<EnterpriseHeaderActionsProps, 'entityType'>) =>
    <EnterpriseHeaderActions {...props} entityType="contact" />,

  /**
   * Units header actions factory
   */
  forUnits: (props: Omit<EnterpriseHeaderActionsProps, 'entityType'>) =>
    <EnterpriseHeaderActions {...props} entityType="unit" />
};

// Factory methods available as separate exports

// ============================================================================
// EXPORTS
// ============================================================================

// 🏢 ENTERPRISE: Create component with static factory methods
// This enables: EnterpriseHeaderActions.forProjects(...) usage
export const EnterpriseHeaderActions = Object.assign(EnterpriseHeaderActionsBase, {
  forProjects: EnterpriseHeaderActionsFactories.forProjects,
  forBuildings: EnterpriseHeaderActionsFactories.forBuildings,
  forContacts: EnterpriseHeaderActionsFactories.forContacts,
  forUnits: EnterpriseHeaderActionsFactories.forUnits,
}) as EnterpriseHeaderActionsComponent;

export default EnterpriseHeaderActions;

// ============================================================================
// BACKWARD COMPATIBILITY
// ============================================================================

/**
 * 🔄 Legacy HeaderActions type for backward compatibility
 * This ensures existing code continues to work during migration
 */
export type HeaderActionsProps = Pick<EnterpriseHeaderActionsProps, 'showDashboard' | 'setShowDashboard'>;

/**
 * 🔄 Legacy HeaderActions component (projects)
 * @deprecated Use EnterpriseHeaderActions.forProjects instead
 */
export const ProjectHeaderActions = (props: HeaderActionsProps) =>
  EnterpriseHeaderActions.forProjects(props);

/**
 * 🔄 Legacy HeaderActions component (buildings)
 * @deprecated Use EnterpriseHeaderActions.forBuildings instead
 */
export const BuildingHeaderActions = (props: HeaderActionsProps) =>
  EnterpriseHeaderActions.forBuildings(props);