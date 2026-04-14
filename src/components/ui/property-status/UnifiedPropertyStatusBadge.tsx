/**
 * 🏢 UNIFIED PROPERTY STATUS BADGE
 *
 * Enterprise-class component για εμφάνιση καταστάσεων ακινήτων
 * Ενσωματωμένο με το κεντρικοποιημένο UnifiedBadgeSystem
 *
 * @created 2025-12-14
 * @author Claude AI Assistant
 * @version 2.0.0
 * @enterprise Production-ready status display using centralized badge system
 */

'use client';

import React from 'react';
import { PropertyBadge } from '@/core/badges/UnifiedBadgeSystem';
import { cn } from '@/lib/utils';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import {
  EnhancedPropertyStatus,
  getEnhancedStatusLabel,
  getStatusCategory,
  isPropertyAvailable,
  isPropertyCommitted,
  isPropertyOffMarket,
  hasPropertyIssues
} from '@/constants/property-statuses-enterprise';

import type {
  PropertyStatus,
  BadgeFactoryOptions
} from '@/core/types/BadgeTypes';
import '@/lib/design-system';

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

export interface UnifiedPropertyStatusBadgeProps {
  /** Property status */
  status: EnhancedPropertyStatus;

  /** Size variant */
  size?: 'sm' | 'default' | 'lg';

  /** Variant override */
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'purple';

  /** Show status icon */
  showIcon?: boolean;

  /** Show category prefix */
  showCategory?: boolean;

  /** Custom label override */
  customLabel?: string;

  /** Interactive mode */
  interactive?: boolean;

  /** Click handler */
  onClick?: () => void;

  /** Custom className */
  className?: string;

  /** Additional options για το centralized system */
  badgeOptions?: BadgeFactoryOptions;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * 🏷️ Unified Property Status Badge
 *
 * Enterprise component που χρησιμοποιεί το κεντρικοποιημένο UnifiedBadgeSystem
 * για consistent εμφάνιση property statuses σε όλη την εφαρμογή
 */
export function UnifiedPropertyStatusBadge({
  status,
  size = 'default',
  variant,
  showIcon = true,
  showCategory = false,
  customLabel,
  interactive = false,
  onClick,
  className,
  badgeOptions = {}
}: UnifiedPropertyStatusBadgeProps) {

  // ========================================================================
  // COMPUTED VALUES
  // ========================================================================

  const statusLabel = customLabel || getEnhancedStatusLabel(status);
  const category = getStatusCategory(status);

  // Badge configuration options for centralized system
  const centralizedOptions: BadgeFactoryOptions = {
    size: size,
    variant: variant,
    showIcon: showIcon,
    customLabel: statusLabel,
    className: cn(
      // Base styles
      'transition-all duration-200',

      // Interactive styles
      interactive && 'cursor-pointer hover:scale-105 hover:shadow-md',
      interactive && 'focus:outline-none focus:ring-2 focus:ring-offset-2',

      // Category-specific styling hints
      isPropertyAvailable(status) && 'ring-green-200/50',
      isPropertyCommitted(status) && 'ring-orange-200/50',
      isPropertyOffMarket(status) && 'ring-gray-200/50',
      hasPropertyIssues(status) && 'ring-red-200/50',

      className
    ),
    ...badgeOptions
  };

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  const handleClick = () => {
    if (interactive && onClick) {
      onClick();
    }
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="inline-flex items-center gap-2">
      {/* Category Prefix (optional) */}
      {showCategory && (
        <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-sm">
          {category}
        </span>
      )}

      {/* Main Badge using Centralized System */}
      <PropertyBadge
        status={status as PropertyStatus}
        onClick={interactive ? handleClick : undefined}
        onMouseEnter={interactive ? undefined : undefined}
        onMouseLeave={interactive ? undefined : undefined}
        {...centralizedOptions}
      >
        {statusLabel}
      </PropertyBadge>
    </div>
  );
}

// ============================================================================
// CONVENIENCE COMPONENTS
// ============================================================================

/**
 * 📊 Status Badge με Category Grouping
 */
export function CategoryStatusBadge({
  status,
  showCategory = true,
  ...props
}: UnifiedPropertyStatusBadgeProps & { showCategory?: boolean }) {
  return (
    <UnifiedPropertyStatusBadge
      status={status}
      showCategory={showCategory}
      {...props}
    />
  );
}

/**
 * 📈 Status Badge με Analytics Info
 */
export function AnalyticsStatusBadge({
  status,
  count,
  percentage,
  ...props
}: UnifiedPropertyStatusBadgeProps & { count?: number; percentage?: number }) {
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);

  return (
    <div className="flex items-center gap-3">
      <UnifiedPropertyStatusBadge status={status} {...props} />

      {(count !== undefined || percentage !== undefined) && (
        <div className="flex flex-col text-xs text-muted-foreground">
          {count !== undefined && (
            <span className="font-medium">{t('statusSelector.countLabel', { count })}</span>
          )}
          {percentage !== undefined && (
            <span className="opacity-75">{percentage.toFixed(1)}%</span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 🔄 Status Badge με Transition Actions
 */
export function InteractiveStatusBadge({
  status,
  allowedTransitions = [],
  onStatusChange,
  ...props
}: UnifiedPropertyStatusBadgeProps & {
  allowedTransitions?: EnhancedPropertyStatus[];
  onStatusChange?: (newStatus: EnhancedPropertyStatus) => void;
}) {
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const [showTransitions, setShowTransitions] = React.useState(false);

  return (
    <div className="relative">
      <UnifiedPropertyStatusBadge
        status={status}
        interactive
        onClick={() => setShowTransitions(!showTransitions)}
        {...props}
      />

      {/* Transition Menu */}
      {showTransitions && allowedTransitions.length > 0 && (
        <div className={`absolute top-full left-0 mt-2 ${colors.bg.primary} ${quick.card} shadow-lg p-3 z-20 min-w-48`}>
          <div className="text-xs font-medium text-muted-foreground mb-2">
            {t('statusSelector.changeStatus')}
          </div>

          <div className="space-y-1">
            {allowedTransitions.map(transition => (
              <button
                key={transition}
                className="flex items-center gap-2 w-full text-left text-sm p-2 hover:bg-muted rounded transition-colors"
                onClick={() => {
                  onStatusChange?.(transition);
                  setShowTransitions(false);
                }}
              >
                <UnifiedPropertyStatusBadge
                  status={transition}
                  size="sm"
                  showIcon={false}
                />
                <span className="text-xs text-muted-foreground">
                  {getStatusCategory(transition)}
                </span>
              </button>
            ))}
          </div>

          {/* Close button */}
          <button
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowTransitions(false)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * 🎯 Create multiple badges for status groups
 */
export function createStatusBadgeGroup(
  statuses: EnhancedPropertyStatus[],
  options?: Partial<UnifiedPropertyStatusBadgeProps>
) {
  return statuses.map(status => ({
    status,
    label: getEnhancedStatusLabel(status),
    category: getStatusCategory(status),
    isAvailable: isPropertyAvailable(status),
    isCommitted: isPropertyCommitted(status),
    isOffMarket: isPropertyOffMarket(status),
    hasIssues: hasPropertyIssues(status),
    component: (
      <UnifiedPropertyStatusBadge
        key={status}
        status={status}
        {...options}
      />
    )
  }));
}

/**
 * 📋 Get badge configuration for external systems
 */
export function getPropertyStatusBadgeConfig(status: EnhancedPropertyStatus) {
  return {
    status,
    label: getEnhancedStatusLabel(status),
    category: getStatusCategory(status),
    metadata: {
      isAvailable: isPropertyAvailable(status),
      isCommitted: isPropertyCommitted(status),
      isOffMarket: isPropertyOffMarket(status),
      hasIssues: hasPropertyIssues(status)
    }
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  UnifiedPropertyStatusBadge,
  CategoryStatusBadge,
  AnalyticsStatusBadge,
  InteractiveStatusBadge,
  createStatusBadgeGroup,
  getPropertyStatusBadgeConfig,
};

// Types already exported inline above