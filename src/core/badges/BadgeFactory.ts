/**
 * 🏷️ BADGE FACTORY - ENTERPRISE PATTERN
 *
 * Central factory για δημιουργία όλων των badges
 * Single Source of Truth - Factory Pattern Implementation
 */

import { cn } from '../../lib/utils';
import { designTokens } from '@/styles/design-tokens';
import type {
  DomainType,
  ProjectStatus,
  BuildingStatus,
  ContactStatus,
  PropertyStatus,
  UnitStatus,
  NavigationStatus,
  BadgeDefinition,
  BadgeFactoryOptions,
  BadgeVariant
} from '../types/BadgeTypes';
import { createUnifiedBadgeSystem } from '../status/StatusConstants';
import type { UseSemanticColorsReturn } from '../../ui-adapters/react/useSemanticColors';

// ===== MAIN BADGE FACTORY CLASS =====

export class BadgeFactory {
  /**
   * ✅ ENTERPRISE PROFESSIONAL: Δημιουργεί badge με dependency injection pattern
   * @param colors - useSemanticColors result (από React component)
   */
  static create(
    domain: DomainType,
    status: string,
    colors: UseSemanticColorsReturn,
    options: BadgeFactoryOptions = {}
  ): BadgeDefinition {
    // Δημιούργησε το unified badge system με τα injected colors
    const UNIFIED_BADGE_SYSTEM = createUnifiedBadgeSystem(colors);

    // Βρες την κατάλληλη configuration
    const badgeConfig = this.getBadgeConfig(domain, status, UNIFIED_BADGE_SYSTEM);

    if (!badgeConfig) {
      // Fallback για unknown statuses
      return this.createFallbackBadge(status, options);
    }

    // Merge με τα user options
    return {
      ...badgeConfig,
      variant: options.variant || badgeConfig.variant,
      size: options.size || badgeConfig.size || 'default',
      className: cn(badgeConfig.className, options.className),
      label: this.resolveLabel(options, badgeConfig.label),
      // Προσθήκη icon logic
      icon: options.showIcon === false ? undefined : badgeConfig.icon
    };
  }

  /**
   * ✅ ENTERPRISE PROFESSIONAL: Δημιουργεί project badge με dependency injection
   */
  static createProjectBadge(
    status: ProjectStatus,
    colors: UseSemanticColorsReturn,
    options: BadgeFactoryOptions = {}
  ): BadgeDefinition {
    return this.create('PROJECT', status, colors, options);
  }

  /**
   * ✅ ENTERPRISE PROFESSIONAL: Δημιουργεί building badge με dependency injection
   */
  static createBuildingBadge(
    status: BuildingStatus,
    colors: UseSemanticColorsReturn,
    options: BadgeFactoryOptions = {}
  ): BadgeDefinition {
    return this.create('BUILDING', status, colors, options);
  }

  /**
   * ✅ ENTERPRISE PROFESSIONAL: Δημιουργεί contact badge με dependency injection
   */
  static createContactBadge(
    status: ContactStatus,
    colors: UseSemanticColorsReturn,
    options: BadgeFactoryOptions = {}
  ): BadgeDefinition {
    return this.create('CONTACT', status, colors, options);
  }

  /**
   * ✅ ENTERPRISE PROFESSIONAL: Δημιουργεί property badge με dependency injection
   */
  static createPropertyBadge(
    status: PropertyStatus,
    colors: UseSemanticColorsReturn,
    options: BadgeFactoryOptions = {}
  ): BadgeDefinition {
    return this.create('PROPERTY', status, colors, options);
  }

  /**
   * ✅ ENTERPRISE PROFESSIONAL: Δημιουργεί unit badge με dependency injection
   */
  static createUnitBadge(
    status: UnitStatus,
    colors: UseSemanticColorsReturn,
    options: BadgeFactoryOptions = {}
  ): BadgeDefinition {
    return this.create('UNIT', status, colors, options);
  }

  /**
   * ✅ ENTERPRISE PROFESSIONAL: Δημιουργεί navigation badge με dependency injection
   */
  static createNavigationBadge(
    status: NavigationStatus,
    colors: UseSemanticColorsReturn,
    options: BadgeFactoryOptions = {}
  ): BadgeDefinition {
    return this.create('NAVIGATION', status, colors, options);
  }

  /**
   * ✅ ENTERPRISE PROFESSIONAL: Δημιουργεί common badge με dependency injection
   */
  static createCommonBadge(
    status: string,
    colors: UseSemanticColorsReturn,
    options: BadgeFactoryOptions = {}
  ): BadgeDefinition {
    // Δημιούργησε το unified badge system με τα injected colors
    const UNIFIED_BADGE_SYSTEM = createUnifiedBadgeSystem(colors);
    const badgeConfig = UNIFIED_BADGE_SYSTEM.common[status];

    if (!badgeConfig) {
      return this.createFallbackBadge(status, options);
    }

    return {
      ...badgeConfig,
      variant: options.variant || badgeConfig.variant,
      size: options.size || badgeConfig.size || 'default',
      className: cn(badgeConfig.className, options.className),
      label: this.resolveLabel(options, badgeConfig.label)
    };
  }

  // ===== PRIVATE HELPER METHODS =====

  /**
   * ✅ ENTERPRISE PROFESSIONAL: Βρίσκει την κατάλληλη badge configuration με dependency injection
   */
  private static getBadgeConfig(domain: DomainType, status: string, badgeSystem: { domains: Record<string, Record<string, BadgeDefinition>> }): BadgeDefinition | null {
    const domainConfig = badgeSystem.domains[domain];
    return domainConfig?.[status as keyof typeof domainConfig] || null;
  }

  /**
   * Δημιουργεί fallback badge για άγνωστα statuses
   */
  private static createFallbackBadge(
    status: string,
    options: BadgeFactoryOptions
  ): BadgeDefinition {
    return {
      label: this.resolveLabel(options, status),
      variant: options.variant || 'outline',
      size: options.size || 'default',
      color: designTokens.colors.text.secondary,
      backgroundColor: designTokens.colors.background.secondary,
      className: cn('badge-fallback', options.className)
    };
  }

  private static resolveLabel(options: BadgeFactoryOptions, fallback: string): string {
    const { customLabel } = options;
    if (typeof customLabel === 'string') {
      return customLabel;
    }
    if (typeof customLabel === 'number') {
      return String(customLabel);
    }
    return fallback;
  }

  // ===== UTILITY METHODS =====

  /**
   * ✅ ENTERPRISE PROFESSIONAL: Επιστρέφει όλα τα διαθέσιμα statuses για domain
   */
  static getAvailableStatuses(domain: DomainType, colors: UseSemanticColorsReturn): string[] {
    const UNIFIED_BADGE_SYSTEM = createUnifiedBadgeSystem(colors);
    const domainConfig = UNIFIED_BADGE_SYSTEM.domains[domain];
    return domainConfig ? Object.keys(domainConfig) : [];
  }

  /**
   * ✅ ENTERPRISE PROFESSIONAL: Ελέγχει αν ένα status υπάρχει σε domain
   */
  static isValidStatus(domain: DomainType, status: string, colors: UseSemanticColorsReturn): boolean {
    const UNIFIED_BADGE_SYSTEM = createUnifiedBadgeSystem(colors);
    const domainConfig = UNIFIED_BADGE_SYSTEM.domains[domain];
    return domainConfig ? status in domainConfig : false;
  }

  /**
   * ✅ ENTERPRISE PROFESSIONAL: Επιστρέφει CSS classes για badge με dependency injection
   */
  static getBadgeClasses(
    domain: DomainType,
    status: string,
    colors: UseSemanticColorsReturn,
    additionalClasses?: string
  ): string {
    const UNIFIED_BADGE_SYSTEM = createUnifiedBadgeSystem(colors);
    const badgeConfig = this.getBadgeConfig(domain, status, UNIFIED_BADGE_SYSTEM);

    if (!badgeConfig) {
      return cn('badge-fallback', additionalClasses);
    }

    const baseClasses = this.getVariantClasses(badgeConfig.variant);
    const sizeClasses = this.getSizeClasses(badgeConfig.size || 'default');

    return cn(
      'badge',
      baseClasses,
      sizeClasses,
      badgeConfig.className,
      additionalClasses
    );
  }

  /**
   * Επιστρέφει CSS classes για variant
   */
  private static getVariantClasses(variant: BadgeVariant): string {
    const variantClasses = {
      default: 'badge-default',
      secondary: 'badge-secondary',
      destructive: 'badge-destructive',
      outline: 'badge-outline',
      success: 'badge-success',
      warning: 'badge-warning',
      error: 'badge-error',
      info: 'badge-info',
      purple: 'badge-purple'
    };

    return variantClasses[variant] || variantClasses.default;
  }

  /**
   * Επιστρέφει CSS classes για size
   */
  private static getSizeClasses(size: string): string {
    const sizeClasses = {
      sm: 'badge-sm',
      default: 'badge-default-size',
      lg: 'badge-lg'
    };

    return sizeClasses[size as keyof typeof sizeClasses] || sizeClasses.default;
  }

  // ===== BATCH OPERATIONS =====

  /**
   * ✅ ENTERPRISE PROFESSIONAL: Δημιουργεί πολλαπλά badges με μία κλήση και dependency injection
   */
  static createBadges(
    badges: Array<{ domain: DomainType; status: string; options?: BadgeFactoryOptions }>,
    colors: UseSemanticColorsReturn
  ): BadgeDefinition[] {
    return badges.map(({ domain, status, options }) =>
      this.create(domain, status, colors, options || {})
    );
  }
}

// ===== CONVENIENCE FUNCTIONS =====

/**
 * ✅ ENTERPRISE PROFESSIONAL: Shorthand function για project badges με dependency injection
 */
export const createProjectBadge = (
  status: ProjectStatus,
  colors: UseSemanticColorsReturn,
  options?: BadgeFactoryOptions
): BadgeDefinition => BadgeFactory.createProjectBadge(status, colors, options);

/**
 * ✅ ENTERPRISE PROFESSIONAL: Shorthand function για building badges με dependency injection
 */
export const createBuildingBadge = (
  status: BuildingStatus,
  colors: UseSemanticColorsReturn,
  options?: BadgeFactoryOptions
): BadgeDefinition => BadgeFactory.createBuildingBadge(status, colors, options);

/**
 * ✅ ENTERPRISE PROFESSIONAL: Shorthand function για contact badges με dependency injection
 */
export const createContactBadge = (
  status: ContactStatus,
  colors: UseSemanticColorsReturn,
  options?: BadgeFactoryOptions
): BadgeDefinition => BadgeFactory.createContactBadge(status, colors, options);

/**
 * ✅ ENTERPRISE PROFESSIONAL: Shorthand function για property badges με dependency injection
 */
export const createPropertyBadge = (
  status: PropertyStatus,
  colors: UseSemanticColorsReturn,
  options?: BadgeFactoryOptions
): BadgeDefinition => BadgeFactory.createPropertyBadge(status, colors, options);

/**
 * ✅ ENTERPRISE PROFESSIONAL: Shorthand function για unit badges με dependency injection
 */
export const createUnitBadge = (
  status: UnitStatus,
  colors: UseSemanticColorsReturn,
  options?: BadgeFactoryOptions
): BadgeDefinition => BadgeFactory.createUnitBadge(status, colors, options);


