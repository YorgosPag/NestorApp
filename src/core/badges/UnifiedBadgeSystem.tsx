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
import { BadgeFactory } from './BadgeFactory';
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
  // Δημιουργία badge configuration μέσω Factory
  const badgeConfig = BadgeFactory.create(domain, status, options);

  // Custom styling
  const customStyle = {
    color: badgeConfig.color,
    backgroundColor: badgeConfig.backgroundColor
  };

  return (
    <Badge
      variant={badgeConfig.variant}
      className={cn(
        'transition-all duration-200 cursor-default',
        badgeConfig.className,
        onClick && 'cursor-pointer hover:opacity-80'
      )}
      style={customStyle}
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

      {/* Label */}
      {children || badgeConfig.label}
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
  const badgeConfig = BadgeFactory.createCommonBadge(status, props);

  const customStyle = {
    color: badgeConfig.color,
    backgroundColor: badgeConfig.backgroundColor
  };

  return (
    <Badge
      variant={badgeConfig.variant}
      className={cn(
        'transition-all duration-200 cursor-default',
        badgeConfig.className,
        props.onClick && 'cursor-pointer hover:opacity-80'
      )}
      style={customStyle}
      onClick={props.onClick}
      onMouseEnter={props.onMouseEnter}
      onMouseLeave={props.onMouseLeave}
    >
      {props.children || badgeConfig.label}
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
  return React.useMemo(() =>
    BadgeFactory.create(domain, status, options || {}),
    [domain, status, options]
  );
};

/**
 * Hook για validation
 */
export const useBadgeValidation = (domain: DomainType, status: string) => {
  return React.useMemo(() => ({
    isValid: BadgeFactory.isValidStatus(domain, status),
    availableStatuses: BadgeFactory.getAvailableStatuses(domain)
  }), [domain, status]);
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