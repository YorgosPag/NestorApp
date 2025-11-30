/**
 * 🏷️ BADGE FACTORY - ENTERPRISE PATTERN
 *
 * Central factory για δημιουργία όλων των badges
 * Single Source of Truth - Factory Pattern Implementation
 */

import { cn } from '@/lib/utils';
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
import { UNIFIED_BADGE_SYSTEM } from '../status/StatusConstants';

// ===== MAIN BADGE FACTORY CLASS =====

export class BadgeFactory {
  /**
   * Δημιουργεί badge για συγκεκριμένο domain και status
   */
  static create(
    domain: DomainType,
    status: string,
    options: BadgeFactoryOptions = {}
  ): BadgeDefinition {
    // Βρες την κατάλληλη configuration
    const badgeConfig = this.getBadgeConfig(domain, status);

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
      label: options.customLabel || badgeConfig.label,
      // Προσθήκη icon logic
      icon: options.showIcon === false ? undefined : badgeConfig.icon
    };
  }

  /**
   * Δημιουργεί project badge
   */
  static createProjectBadge(
    status: ProjectStatus,
    options: BadgeFactoryOptions = {}
  ): BadgeDefinition {
    return this.create('PROJECT', status, options);
  }

  /**
   * Δημιουργεί building badge
   */
  static createBuildingBadge(
    status: BuildingStatus,
    options: BadgeFactoryOptions = {}
  ): BadgeDefinition {
    return this.create('BUILDING', status, options);
  }

  /**
   * Δημιουργεί contact badge
   */
  static createContactBadge(
    status: ContactStatus,
    options: BadgeFactoryOptions = {}
  ): BadgeDefinition {
    return this.create('CONTACT', status, options);
  }

  /**
   * Δημιουργεί property badge
   */
  static createPropertyBadge(
    status: PropertyStatus,
    options: BadgeFactoryOptions = {}
  ): BadgeDefinition {
    return this.create('PROPERTY', status, options);
  }

  /**
   * Δημιουργεί unit badge
   */
  static createUnitBadge(
    status: UnitStatus,
    options: BadgeFactoryOptions = {}
  ): BadgeDefinition {
    return this.create('UNIT', status, options);
  }

  /**
   * Δημιουργεί navigation badge
   */
  static createNavigationBadge(
    status: NavigationStatus,
    options: BadgeFactoryOptions = {}
  ): BadgeDefinition {
    return this.create('NAVIGATION', status, options);
  }

  /**
   * Δημιουργεί common badge
   */
  static createCommonBadge(
    status: string,
    options: BadgeFactoryOptions = {}
  ): BadgeDefinition {
    const badgeConfig = UNIFIED_BADGE_SYSTEM.common[status];

    if (!badgeConfig) {
      return this.createFallbackBadge(status, options);
    }

    return {
      ...badgeConfig,
      variant: options.variant || badgeConfig.variant,
      size: options.size || badgeConfig.size || 'default',
      className: cn(badgeConfig.className, options.className),
      label: options.customLabel || badgeConfig.label
    };
  }

  // ===== PRIVATE HELPER METHODS =====

  /**
   * Βρίσκει την κατάλληλη badge configuration
   */
  private static getBadgeConfig(domain: DomainType, status: string): BadgeDefinition | null {
    const domainConfig = UNIFIED_BADGE_SYSTEM.domains[domain];
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
      label: options.customLabel || status,
      variant: options.variant || 'outline',
      size: options.size || 'default',
      color: '#6B7280',
      backgroundColor: '#F9FAFB',
      className: cn('badge-fallback', options.className)
    };
  }

  // ===== UTILITY METHODS =====

  /**
   * Επιστρέφει όλα τα διαθέσιμα statuses για domain
   */
  static getAvailableStatuses(domain: DomainType): string[] {
    const domainConfig = UNIFIED_BADGE_SYSTEM.domains[domain];
    return domainConfig ? Object.keys(domainConfig) : [];
  }

  /**
   * Ελέγχει αν ένα status υπάρχει σε domain
   */
  static isValidStatus(domain: DomainType, status: string): boolean {
    const domainConfig = UNIFIED_BADGE_SYSTEM.domains[domain];
    return domainConfig ? status in domainConfig : false;
  }

  /**
   * Επιστρέφει CSS classes για badge
   */
  static getBadgeClasses(
    domain: DomainType,
    status: string,
    additionalClasses?: string
  ): string {
    const badgeConfig = this.getBadgeConfig(domain, status);

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
   * Δημιουργεί πολλαπλά badges με μία κλήση
   */
  static createBadges(
    badges: Array<{ domain: DomainType; status: string; options?: BadgeFactoryOptions }>
  ): BadgeDefinition[] {
    return badges.map(({ domain, status, options }) =>
      this.create(domain, status, options || {})
    );
  }
}

// ===== CONVENIENCE FUNCTIONS =====

/**
 * Shorthand function για project badges
 */
export const createProjectBadge = (
  status: ProjectStatus,
  options?: BadgeFactoryOptions
): BadgeDefinition => BadgeFactory.createProjectBadge(status, options);

/**
 * Shorthand function για building badges
 */
export const createBuildingBadge = (
  status: BuildingStatus,
  options?: BadgeFactoryOptions
): BadgeDefinition => BadgeFactory.createBuildingBadge(status, options);

/**
 * Shorthand function για contact badges
 */
export const createContactBadge = (
  status: ContactStatus,
  options?: BadgeFactoryOptions
): BadgeDefinition => BadgeFactory.createContactBadge(status, options);

/**
 * Shorthand function για property badges
 */
export const createPropertyBadge = (
  status: PropertyStatus,
  options?: BadgeFactoryOptions
): BadgeDefinition => BadgeFactory.createPropertyBadge(status, options);

/**
 * Shorthand function για unit badges
 */
export const createUnitBadge = (
  status: UnitStatus,
  options?: BadgeFactoryOptions
): BadgeDefinition => BadgeFactory.createUnitBadge(status, options);

/**
 * Shorthand function για navigation badges
 */
export const createNavigationBadge = (
  status: NavigationStatus,
  options?: BadgeFactoryOptions
): BadgeDefinition => BadgeFactory.createNavigationBadge(status, options);