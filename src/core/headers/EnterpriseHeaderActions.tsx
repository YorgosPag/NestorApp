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

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * 🏢 Enterprise Header Actions Props
 *
 * Configurable props for different entity types and use cases
 */
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
// UTILITY FUNCTIONS
// ============================================================================

/**
 * 🎯 Generate create button text based on entity type
 */
function generateCreateButtonText(entityType: string): string {
  // Capitalize first letter and add "Νέο"
  const capitalizedEntity = entityType.charAt(0).toUpperCase() + entityType.slice(1);
  return `Νέο ${capitalizedEntity}`;
}

/**
 * 🎯 Generate default tooltips
 */
function generateTooltips(entityType: string) {
  return {
    dashboard: 'Εμφάνιση/Απόκρυψη Dashboard',
    create: `Δημιουργία νέου ${entityType}`
  };
}

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
 * // Projects page usage
 * <EnterpriseHeaderActions
 *   showDashboard={showDashboard}
 *   setShowDashboard={setShowDashboard}
 *   entityType="έργο"
 *   onCreateNew={handleCreateProject}
 * />
 *
 * @example
 * // Buildings page usage
 * <EnterpriseHeaderActions
 *   showDashboard={showDashboard}
 *   setShowDashboard={setShowDashboard}
 *   entityType="κτίριο"
 *   onCreateNew={handleCreateBuilding}
 * />
 */
export const EnterpriseHeaderActions: React.FC<EnterpriseHeaderActionsProps> = ({
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

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const defaultTooltips = generateTooltips(entityType);
  const createButtonText = customCreateText || generateCreateButtonText(entityType);
  const finalDashboardTooltip = dashboardTooltip || defaultTooltips.dashboard;
  const finalCreateTooltip = createTooltip || defaultTooltips.create;

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
              Dashboard
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
export const EnterpriseHeaderActionsFactories = {
  /**
   * Projects header actions factory
   */
  forProjects: (props: Omit<EnterpriseHeaderActionsProps, 'entityType'>) =>
    <EnterpriseHeaderActions {...props} entityType="έργο" />,

  /**
   * Buildings header actions factory
   */
  forBuildings: (props: Omit<EnterpriseHeaderActionsProps, 'entityType'>) =>
    <EnterpriseHeaderActions {...props} entityType="κτίριο" />,

  /**
   * Contacts header actions factory
   */
  forContacts: (props: Omit<EnterpriseHeaderActionsProps, 'entityType'>) =>
    <EnterpriseHeaderActions {...props} entityType="επαφή" />,

  /**
   * Units header actions factory
   */
  forUnits: (props: Omit<EnterpriseHeaderActionsProps, 'entityType'>) =>
    <EnterpriseHeaderActions {...props} entityType="μονάδα" />
};

// Add factory methods to the main component
EnterpriseHeaderActions.forProjects = EnterpriseHeaderActionsFactories.forProjects;
EnterpriseHeaderActions.forBuildings = EnterpriseHeaderActionsFactories.forBuildings;
EnterpriseHeaderActions.forContacts = EnterpriseHeaderActionsFactories.forContacts;
EnterpriseHeaderActions.forUnits = EnterpriseHeaderActionsFactories.forUnits;

// ============================================================================
// EXPORTS
// ============================================================================

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