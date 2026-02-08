/**
 * 🏭 SMART ACTION BUTTONS FACTORY - ENTERPRISE PATTERN
 *
 * Fortune 500 level action button factory που εξαλείφει όλα τα
 * action button duplicates και δημιουργεί intelligent configurations
 * χρησιμοποιώντας existing centralized ActionButtons system.
 *
 * @created 2025-12-27
 * @author Claude AI Assistant
 * @version 1.0.0 - ENTERPRISE FOUNDATION
 * @compliance CLAUDE.md Enterprise Standards - ZERO DUPLICATES
 */

// ============================================================================
// 🏢 ENTERPRISE IMPORTS - CENTRALIZED SYSTEMS INTEGRATION
// ============================================================================

import * as React from 'react';

// Import από existing centralized ActionButtons system - ZERO duplicates
import {
  SaveButton,
  CancelButton,
  DeleteButton,
  AddButton,
  EditButton,
  ArchiveButton,
  RestoreButton,
  ToolbarAddButton,
  ToolbarEditButton,
  ToolbarDeleteButton,
  ToolbarArchiveButton,
  ToolbarCallButton,
  ToolbarEmailButton,
  ToolbarSMSButton,
  ToolbarExportButton,
  ToolbarImportButton,
  ToolbarSortToggleButton,
  ToolbarHelpButton,
  ToolbarFavoritesButton,
  ToolbarArchivedFilterButton,
  ToolbarRefreshButton,
  BUTTON_CATEGORIES,
  BUTTON_STYLES
} from '@/components/ui/form/ActionButtons';

// Import από existing centralized configuration system
import { getActionButtons } from '@/subapps/dxf-viewer/config/modal-select';

// Import από existing centralized design system
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// ============================================================================
// 🎯 SMART ACTION FACTORY TYPE DEFINITIONS
// ============================================================================

// Entity types που υποστηρίζονται από το Factory
export type ActionEntityType =
  | 'contact'
  | 'opportunity'
  | 'task'
  | 'property'
  | 'project'
  | 'geo-canvas'
  | 'dxf-viewer'
  | 'performance'
  | 'form'
  | 'modal'
  | 'toolbar'
  | 'dashboard';

// Operation types που υποστηρίζονται από το Factory
export type ActionOperationType =
  | 'create'
  | 'update'
  | 'delete'
  | 'archive'
  | 'restore'
  | 'export'
  | 'import'
  | 'submit'
  | 'cancel'
  | 'reset'
  | 'refresh'
  | 'help'
  | 'sort'
  | 'filter'
  | 'communicate'
  | 'process'
  | 'analyze';

// Layout patterns για action groups
export type ActionLayoutType =
  | 'horizontal'    // Flex row
  | 'vertical'      // Flex column
  | 'grid'          // CSS Grid
  | 'floating'      // Floating action bar
  | 'inline'        // Inline με text
  | 'stack';        // Stacked με spacing

// Button variants που συνδέονται με το existing BUTTON_CATEGORIES
export type ActionVariant = keyof typeof BUTTON_CATEGORIES;

// ============================================================================
// 🏢 SMART ACTION CONFIGURATION INTERFACES
// ============================================================================

/**
 * Configuration για individual action button
 */
export interface SmartActionConfig {
  /** Τύπος action από το existing centralized system */
  action: ActionOperationType;
  /** Variant που συνδέεται με BUTTON_CATEGORIES */
  variant?: ActionVariant;
  /** Size από το existing system */
  size?: 'sm' | 'default' | 'lg';
  /** Custom label (αν διαφέρει από τα centralized) */
  label?: string;
  /** onClick handler */
  onClick?: () => void;
  /** Disabled state */
  disabled?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Badge count για notifications */
  badge?: number;
  /** Active state για filters/toggles */
  active?: boolean;
  /** Sort direction για sort buttons */
  sortDirection?: 'asc' | 'desc';
  /** Custom className */
  className?: string;
  /** Optional icon */
  icon?: React.ReactNode;
}

/**
 * Configuration για group actions
 */
export interface SmartActionGroupConfig {
  /** Entity type για context-aware configuration */
  entityType: ActionEntityType;
  /** Layout pattern για το group */
  layout: ActionLayoutType;
  /** Spacing μεταξύ των actions */
  spacing?: 'tight' | 'normal' | 'loose';
  /** Actions που περιλαμβάνονται */
  actions: SmartActionConfig[];
  /** Custom className για το group container */
  className?: string;
  /** Responsive behavior */
  responsive?: {
    mobile?: ActionLayoutType;
    tablet?: ActionLayoutType;
    desktop?: ActionLayoutType;
  };
}

/**
 * Configuration για action bars
 */
export interface SmartActionBarConfig {
  /** Entity type για context */
  entityType: ActionEntityType;
  /** Position του action bar */
  position: 'top' | 'bottom' | 'left' | 'right' | 'floating';
  /** Groups που περιλαμβάνονται */
  groups: SmartActionGroupConfig[];
  /** Custom className */
  className?: string;
}

// ============================================================================
// 🏭 SMART ACTION FACTORY ENGINE
// ============================================================================

/**
 * Singleton Smart Action Factory Engine
 */
class SmartActionFactoryEngine {
  private static instance: SmartActionFactoryEngine;
  private actionLabels = getActionButtons();

  private constructor() {
    // Singleton pattern
  }

  public static getInstance(): SmartActionFactoryEngine {
    if (!SmartActionFactoryEngine.instance) {
      SmartActionFactoryEngine.instance = new SmartActionFactoryEngine();
    }
    return SmartActionFactoryEngine.instance;
  }

  /**
   * 🎯 Map action type to existing ActionButton component
   */
  private getActionComponent(config: SmartActionConfig): React.ReactElement {
    const props = {
      onClick: config.onClick,
      disabled: config.disabled,
      loading: config.loading,
      className: config.className,
      children: config.label
    };

    switch (config.action) {
      case 'create':
        return React.createElement(AddButton, { ...props, children: config.label || this.actionLabels.add });

      case 'update':
        return React.createElement(EditButton, { ...props, children: config.label || this.actionLabels.edit });

      case 'delete':
        return React.createElement(DeleteButton, { ...props, children: config.label || this.actionLabels.delete });

      case 'archive':
        return React.createElement(ArchiveButton, { ...props, children: config.label || this.actionLabels.archive });

      case 'restore':
        return React.createElement(RestoreButton, { ...props, children: config.label || this.actionLabels.restore });

      case 'submit':
        return React.createElement(SaveButton, { ...props, children: config.label || this.actionLabels.save });

      case 'cancel':
        return React.createElement(CancelButton, { ...props, children: config.label || this.actionLabels.cancel });

      case 'export':
        return React.createElement(ToolbarExportButton, {
          ...props,
          size: config.size || 'sm',
          children: config.label || this.actionLabels.export
        });

      case 'import':
        return React.createElement(ToolbarImportButton, {
          ...props,
          size: config.size || 'sm',
          children: config.label || this.actionLabels.import
        });

      case 'refresh':
        return React.createElement(ToolbarRefreshButton, {
          ...props,
          size: config.size || 'sm',
          children: config.label || this.actionLabels.refresh
        });

      case 'help':
        return React.createElement(ToolbarHelpButton, {
          ...props,
          size: config.size || 'sm',
          children: config.label || this.actionLabels.help
        });

      case 'sort':
        return React.createElement(ToolbarSortToggleButton, {
          ...props,
          size: config.size || 'sm',
          sortDirection: config.sortDirection || 'asc'
        });

      case 'communicate':
        // Default to email για communicate action
        return React.createElement(ToolbarEmailButton, {
          ...props,
          size: config.size || 'sm',
          children: config.label || this.actionLabels.email
        });

      default:
        // Fallback to AddButton για unknown actions
        return React.createElement(AddButton, { ...props, children: config.label || 'Action' });
    }
  }

  /**
   * 🎨 Get layout classes από centralized systems
   */
  private getLayoutClasses(layout: ActionLayoutType, spacing: string = 'normal'): string {
    const spaceClasses = {
      tight: 'gap-1',
      normal: 'gap-3',
      loose: 'gap-6'
    };

    const space = spaceClasses[spacing as keyof typeof spaceClasses] || spaceClasses.normal;

    switch (layout) {
      case 'horizontal':
        return `flex flex-row items-center ${space}`;
      case 'vertical':
        return `flex flex-col ${space}`;
      case 'grid':
        return `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 ${space}`;
      case 'floating':
        return `fixed bottom-4 right-4 flex flex-col ${space} z-50`;
      case 'inline':
        return `inline-flex items-center ${space}`;
      case 'stack':
        return `space-y-2`;
      default:
        return `flex flex-row items-center ${space}`;
    }
  }

  /**
   * 🎯 Create Smart Action Group
   */
  public createActionGroup(config: SmartActionGroupConfig): React.ReactElement {
    const layoutClasses = this.getLayoutClasses(config.layout, config.spacing);
    const { quick } = useBorderTokens();
    const colors = useSemanticColors();

    // Generate action buttons από το existing centralized system
    const actionButtons = config.actions.map((actionConfig, index) =>
      React.createElement('div',
        { key: `action-${index}` },
        this.getActionComponent(actionConfig)
      )
    );

    return React.createElement(
      'div',
      {
        className: `${layoutClasses} ${quick.card} ${colors.bg.primary} p-4 ${config.className || ''}`
      },
      ...actionButtons
    );
  }

  /**
   * 🏢 Create Smart Action Bar
   */
  public createActionBar(config: SmartActionBarConfig): React.ReactElement {
    const { quick } = useBorderTokens();
    const colors = useSemanticColors();

    // Position classes
    const positionClasses = {
      top: 'fixed top-0 left-0 right-0 z-40',
      bottom: 'fixed bottom-0 left-0 right-0 z-40',
      left: 'fixed left-0 top-0 bottom-0 z-40',
      right: 'fixed right-0 top-0 bottom-0 z-40',
      floating: 'fixed bottom-4 right-4 z-50'
    };

    const positionClass = positionClasses[config.position];

    // Generate action groups
    const actionGroups = config.groups.map((groupConfig, index) =>
      React.createElement('div',
        { key: `group-${index}` },
        this.createActionGroup(groupConfig)
      )
    );

    return React.createElement(
      'div',
      {
        className: `${positionClass} ${quick.card} ${colors.bg.secondary} border-t ${config.className || ''}`
      },
      ...actionGroups
    );
  }
}

// ============================================================================
// 🌟 PUBLIC SMART FACTORY API
// ============================================================================

// Singleton instance
const smartActionFactory = SmartActionFactoryEngine.getInstance();

/**
 * 🏭 Create Smart Action Button
 * Δημιουργεί individual action button χρησιμοποιώντας το existing centralized system
 */
export function createSmartAction(config: SmartActionConfig): React.ReactElement {
  return smartActionFactory['getActionComponent'](config);
}

/**
 * 🏭 Create Smart Action Group
 * Δημιουργεί group action buttons με intelligent layout
 */
export function createSmartActionGroup(config: SmartActionGroupConfig): React.ReactElement {
  return smartActionFactory.createActionGroup(config);
}

/**
 * 🏭 Create Smart Action Bar
 * Δημιουργεί complete action bar με positioning
 */
export function createSmartActionBar(config: SmartActionBarConfig): React.ReactElement {
  return smartActionFactory.createActionBar(config);
}

/**
 * 🎯 Get Action Labels
 * Επιστρέφει τα centralized labels για consistency
 */
export function getSmartActionLabels() {
  return getActionButtons();
}

/**
 * 🎨 Get Action Categories
 * Επιστρέφει τα existing BUTTON_CATEGORIES για consistency
 */
export function getSmartActionCategories() {
  return BUTTON_CATEGORIES;
}

/**
 * 🏢 Legacy Support Function για backward compatibility
 * Converts old ActionButton configs to Smart Factory format
 */
export function migrateLegacyActionButton(
  onClick: () => void,
  icon: React.ReactNode,
  label: string,
  variant: 'blue' | 'green' | 'purple' | ActionVariant,
  options?: {
    title?: string;
    fullWidth?: boolean;
    disabled?: boolean;
  }
): React.ReactElement {
  // Map legacy variants to enterprise categories
  const variantMap = {
    blue: 'primary' as ActionVariant,
    green: 'success' as ActionVariant,
    purple: 'utility' as ActionVariant
  };

  const actionVariant = typeof variant === 'string' && variant in variantMap
    ? variantMap[variant as 'blue' | 'green' | 'purple']
    : variant as ActionVariant;

  // Determine action type από label (intelligent mapping)
  let actionType: ActionOperationType = 'create';
  if (label.toLowerCase().includes('export')) actionType = 'export';
  else if (label.toLowerCase().includes('refresh') || label.toLowerCase().includes('test')) actionType = 'refresh';
  else if (label.toLowerCase().includes('optimize')) actionType = 'process';
  else if (label.toLowerCase().includes('analytic')) actionType = 'analyze';

  return createSmartAction({
    action: actionType,
    variant: actionVariant,
    label,
    onClick,
    disabled: options?.disabled,
    className: options?.fullWidth ? 'w-full' : undefined
  });
}

// Export Smart Factory Engine για advanced usage
export { SmartActionFactoryEngine };
