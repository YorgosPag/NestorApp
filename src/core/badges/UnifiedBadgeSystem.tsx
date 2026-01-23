/**
 * 🏷️ UNIFIED BADGE SYSTEM - CENTRAL COMPONENT
 *
 * Κεντρικό React component για όλα τα badges
 * Single Source of Truth - Enterprise Implementation
 */

'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { BadgeFactory } from './BadgeFactory';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';
import type {
  DomainType,
  ProjectStatus,
  BuildingStatus,
  ContactStatus,
  PropertyStatus,
  UnitStatus,
  BadgeFactoryOptions,
  BadgeDefinition
} from '../types/BadgeTypes';

// ===== MAIN UNIFIED BADGE COMPONENT =====

interface UnifiedBadgeProps extends BadgeFactoryOptions {
  domain: DomainType;
  status: string;
  children?: React.ReactNode;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const UnifiedBadge: React.FC<UnifiedBadgeProps> = ({
  domain,
  status,
  children,
  onClick,
  onMouseEnter,
  onMouseLeave,
  ...options
}) => {
  // ✅ ZERO HARDCODED VALUES - Use centralized semantic colors
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n support for all domain badges
  const { t } = useTranslation();
  // Δημιουργία badge configuration μέσω Factory
  const badgeConfig = BadgeFactory.create(domain, status, colors, options);

  // 🏢 ENTERPRISE: Auto-detect namespace from label prefix and translate
  const translateLabel = (label: string | undefined): string => {
    if (!label) return '';

    // Extract namespace from label prefix (e.g., 'projects.status.planning' → namespace: 'projects')
    const parts = label.split('.');
    if (parts.length >= 2) {
      const namespace = parts[0];
      const key = parts.slice(1).join('.');
      return t(key, { ns: namespace, defaultValue: label });
    }
    return label;
  };

  const translatedLabel = translateLabel(badgeConfig.label);

  return (
    <Badge
      variant={badgeConfig.variant}
      className={cn(
        'transition-all duration-200 cursor-default',
        badgeConfig.className,
        onClick && `cursor-pointer ${INTERACTIVE_PATTERNS.OPACITY_HOVER}`
        // 🏢 ENTERPRISE: Removed getDynamicElementClasses - Badge variants now handle colors
      )}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Icon rendering (if enabled) */}
      {badgeConfig.icon && options.showIcon !== false && (
        <span className="mr-1">
          {/* TODO: Icon component integration */}
        </span>
      )}

      {/* Label - 🏢 ENTERPRISE: Now uses translated label */}
      {children || translatedLabel}
    </Badge>
  );
};

// ===== TYPED DOMAIN-SPECIFIC COMPONENTS =====

interface ProjectBadgeProps extends Omit<UnifiedBadgeProps, 'domain' | 'status'> {
  status: ProjectStatus;
}

export const ProjectBadge: React.FC<ProjectBadgeProps> = ({ status, ...props }) => (
  <UnifiedBadge domain="PROJECT" status={status} {...props} />
);

interface BuildingBadgeProps extends Omit<UnifiedBadgeProps, 'domain' | 'status'> {
  status: BuildingStatus;
}

export const BuildingBadge: React.FC<BuildingBadgeProps> = ({ status, ...props }) => (
  <UnifiedBadge domain="BUILDING" status={status} {...props} />
);

interface ContactBadgeProps extends Omit<UnifiedBadgeProps, 'domain' | 'status'> {
  status: ContactStatus;
}

export const ContactBadge: React.FC<ContactBadgeProps> = ({ status, ...props }) => (
  <UnifiedBadge domain="CONTACT" status={status} {...props} />
);

interface PropertyBadgeProps extends Omit<UnifiedBadgeProps, 'domain' | 'status'> {
  status: PropertyStatus;
}

export const PropertyBadge: React.FC<PropertyBadgeProps> = ({ status, ...props }) => (
  <UnifiedBadge domain="PROPERTY" status={status} {...props} />
);

interface UnitBadgeProps extends Omit<UnifiedBadgeProps, 'domain' | 'status'> {
  status: UnitStatus;
}

export const UnitBadge: React.FC<UnitBadgeProps> = ({ status, ...props }) => (
  <UnifiedBadge domain="UNIT" status={status} {...props} />
);

// ===== COMMON/SHARED BADGE COMPONENT =====

interface CommonBadgeProps extends Omit<UnifiedBadgeProps, 'domain'> {
  status: 'new' | 'updated' | 'deleted' | string;
}

export const CommonBadge: React.FC<CommonBadgeProps> = ({ status, ...props }) => {
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('common');
  const badgeConfig = BadgeFactory.createCommonBadge(status, colors, props);

  // 🏢 ENTERPRISE: Translate label if it's an i18n key
  const translatedLabel = badgeConfig.label?.startsWith('common.')
    ? t(badgeConfig.label.replace('common.', ''))
    : badgeConfig.label;

  return (
    <Badge
      variant={badgeConfig.variant}
      className={cn(
        'transition-all duration-200 cursor-default',
        badgeConfig.className,
        props.onClick && `cursor-pointer ${INTERACTIVE_PATTERNS.OPACITY_HOVER}`
        // 🏢 ENTERPRISE: Removed getDynamicElementClasses - Badge variants now handle colors
      )}
      onClick={props.onClick}
      onMouseEnter={props.onMouseEnter}
      onMouseLeave={props.onMouseLeave}
    >
      {props.children || translatedLabel}
    </Badge>
  );
};

// ===== BADGE GROUP COMPONENT =====

interface BadgeGroupProps {
  badges: Array<{
    domain: DomainType;
    status: string;
    options?: BadgeFactoryOptions;
    label?: string;
  }>;
  className?: string;
  spacing?: 'tight' | 'normal' | 'loose';
}

export const BadgeGroup: React.FC<BadgeGroupProps> = ({
  badges,
  className,
  spacing = 'normal'
}) => {
  const spacingClasses = {
    tight: 'gap-1',
    normal: 'gap-2',
    loose: 'gap-3'
  };

  return (
    <div className={cn('flex flex-wrap items-center', spacingClasses[spacing], className)}>
      {badges.map((badge, index) => (
        <UnifiedBadge
          key={index}
          domain={badge.domain}
          status={badge.status}
          {...badge.options}
        >
          {badge.label}
        </UnifiedBadge>
      ))}
    </div>
  );
};

// ===== UTILITY HOOKS =====

/**
 * Hook για badge configuration
 */
export const useBadgeConfig = (domain: DomainType, status: string, options?: BadgeFactoryOptions): BadgeDefinition => {
  // ✅ ZERO HARDCODED VALUES - Use centralized semantic colors
  const colors = useSemanticColors();
  return React.useMemo(() =>
    BadgeFactory.create(domain, status, colors, options || {}),
    [domain, status, colors, options]
  );
};

/**
 * Hook για validation
 */
export const useBadgeValidation = (domain: DomainType, status: string) => {
  // ✅ ZERO HARDCODED VALUES - Use centralized semantic colors
  const colors = useSemanticColors();
  return React.useMemo(() => ({
    isValid: BadgeFactory.isValidStatus(domain, status, colors),
    availableStatuses: BadgeFactory.getAvailableStatuses(domain, colors)
  }), [domain, status, colors]);
};

// ===== HIGHER-ORDER COMPONENTS =====

/**
 * HOC για conditional badge rendering
 */
export const withConditionalBadge = <T extends {}>(
  Component: React.ComponentType<T>,
  condition: (props: T) => boolean,
  badgeConfig: { domain: DomainType; status: string; options?: BadgeFactoryOptions }
) => {
  return (props: T) => (
    <div className="relative">
      <Component {...props} />
      {condition(props) && (
        <div className="absolute -top-2 -right-2">
          <UnifiedBadge
            domain={badgeConfig.domain}
            status={badgeConfig.status}
            size="sm"
            {...badgeConfig.options}
          />
        </div>
      )}
    </div>
  );
};

// ===== EXPORTS =====

export default UnifiedBadge;
export {
  type UnifiedBadgeProps,
  type ProjectBadgeProps,
  type BuildingBadgeProps,
  type ContactBadgeProps,
  type PropertyBadgeProps,
  type UnitBadgeProps,
  type CommonBadgeProps,
  type BadgeGroupProps
};