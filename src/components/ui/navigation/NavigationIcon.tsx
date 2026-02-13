'use client';

/**
 * 🔗 ENTERPRISE NAVIGATION ICON COMPONENT
 *
 * Centralized navigation icon for cards across the entire application.
 * Used in: Company cards, Project cards, Building cards, Unit cards, etc.
 *
 * Enterprise Pattern: SAP Fiori, Microsoft Dynamics, Salesforce Lightning
 *
 * @enterprise-certified
 * @centralized-system
 */

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('NavigationIcon');
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// ============================================================================
// TYPES
// ============================================================================

export interface NavigationIconProps {
  /**
   * The route to navigate to
   * @example "/contacts/123" or "/projects/456"
   */
  href: string;

  /**
   * Tooltip text (optional, defaults to i18n key 'icons.open')
   * @example Uses t('icons.openInContacts') for contacts
   */
  tooltip?: string;

  /**
   * Open in new tab behavior
   * @default false (ctrl+click always opens new tab)
   */
  openInNewTab?: boolean;

  /**
   * Visual size of the icon
   * @default 'sm'
   */
  size?: 'xs' | 'sm' | 'md' | 'lg';

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Visibility behavior
   * @default 'hover' - Shows on hover
   * 'always' - Always visible
   * 'subtle' - Always visible but very light
   */
  visibility?: 'hover' | 'always' | 'subtle';

  /**
   * Position within the card
   * @default 'top-right'
   */
  position?: 'top-right' | 'top-left' | 'inline';

  /**
   * Analytics tracking
   */
  analyticsLabel?: string;
}

// ============================================================================
// SIZE CONFIGURATIONS
// ============================================================================

const SIZE_CONFIG = {
  xs: {
    icon: 14,
    padding: 'p-1',
    offset: 'top-1 right-1'
  },
  sm: {
    icon: 16,
    padding: 'p-1.5',
    offset: 'top-2 right-2'
  },
  md: {
    icon: 18,
    padding: 'p-2',
    offset: 'top-3 right-3'
  },
  lg: {
    icon: 20,
    padding: 'p-2.5',
    offset: 'top-4 right-4'
  }
} as const;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * 🔗 NavigationIcon - Enterprise centralized navigation component
 * 🏢 ENTERPRISE: Uses i18n for all tooltips
 *
 * @example
 * ```tsx
 * // In a Company Card - tooltip auto-resolved via i18n
 * <div className="company-card relative">
 *   <CompanyNavigationIcon
 *     companyId={companyId}
 *     analyticsLabel="company-to-contacts"
 *   />
 *   <h3>{companyName}</h3>
 * </div>
 *
 * // In a Project Card - tooltip auto-resolved via i18n
 * <div className="project-card relative">
 *   <ProjectNavigationIcon projectId={projectId} />
 * </div>
 * ```
 */
export function NavigationIcon({
  href,
  tooltip,
  openInNewTab = false,
  size = 'sm',
  className,
  visibility = 'hover',
  position = 'top-right',
  analyticsLabel,
  asChild = false
}: NavigationIconProps & { asChild?: boolean }) {
  const router = useRouter();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('navigation');
  const config = SIZE_CONFIG[size];

  // 🏢 ENTERPRISE: Default tooltip from i18n
  const tooltipText = tooltip || t('icons.open');

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation(); // Prevent card click
    e.preventDefault();

    // Analytics tracking (if configured)
    if (analyticsLabel && typeof window !== 'undefined') {
      // Track navigation event
      logger.info('Navigation event', { analyticsLabel, href });
    }

    // Handle navigation
    const shouldOpenNewTab = openInNewTab || e.ctrlKey || e.metaKey;

    if (shouldOpenNewTab) {
      window.open(href, '_blank', 'noopener,noreferrer');
    } else {
      router.push(href);
    }
  };

  // ============================================================================
  // VISIBILITY CLASSES
  // ============================================================================

  const visibilityClasses = {
    hover: 'opacity-0 group-hover:opacity-100',
    always: 'opacity-100',
    subtle: 'opacity-40 hover:opacity-100'
  };

  const positionClasses = {
    'top-right': `absolute ${config.offset}`,
    'top-left': `absolute ${config.offset.replace('right', 'left')}`,
    'inline': 'relative inline-flex ml-2'
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleClick}
            className={cn(
              // Base styles
              'rounded-md',
              'transition-all duration-200',
              'hover:bg-accent/10',
              'active:scale-95',
              'focus:outline-none focus:ring-2 focus:ring-primary/20',

              // Size
              config.padding,

              // Position
              positionClasses[position],

              // Visibility
              visibilityClasses[visibility],

              // Z-index for absolute positioning
              position !== 'inline' && 'z-10',

              // Custom classes
              className
            )}
            aria-label={tooltipText}
          >
            <ExternalLink
              size={config.icon}
              className="text-muted-foreground hover:text-foreground"
            />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            {tooltipText}
            {!openInNewTab && (
              <span className="ml-1 opacity-60">
                {t('icons.ctrlClickNewTab')}
              </span>
            )}
          </p>
        </TooltipContent>
      </Tooltip>
  );
}

// ============================================================================
// EXPORT VARIANTS FOR SPECIFIC USE CASES
// ============================================================================

/**
 * Pre-configured for Company Cards in Navigation
 * 🏢 ENTERPRISE: Uses i18n for tooltip
 */
export function CompanyNavigationIcon({ companyId, tooltip, ...props }: Omit<NavigationIconProps, 'href'> & { companyId: string }) {
  // 🏢 ENTERPRISE: i18n hook for default tooltip
  const { t } = useTranslation('navigation');
  return (
    <NavigationIcon
      href={`/contacts/${companyId}`}
      tooltip={tooltip || t('icons.openInContacts')}
      analyticsLabel="nav-company-to-contacts"
      {...props}
    />
  );
}

/**
 * Pre-configured for Project Cards in Navigation
 * 🏢 ENTERPRISE: Uses i18n for tooltip
 */
export function ProjectNavigationIcon({ projectId, tooltip, ...props }: Omit<NavigationIconProps, 'href'> & { projectId: string }) {
  // 🏢 ENTERPRISE: i18n hook for default tooltip
  const { t } = useTranslation('navigation');
  return (
    <NavigationIcon
      href={`/projects/${projectId}`}
      tooltip={tooltip || t('icons.openInProjects')}
      analyticsLabel="nav-project-to-projects"
      {...props}
    />
  );
}

/**
 * Pre-configured for Building Cards in Navigation
 * 🏢 ENTERPRISE: Uses i18n for tooltip
 */
export function BuildingNavigationIcon({ buildingId, tooltip, ...props }: Omit<NavigationIconProps, 'href'> & { buildingId: string }) {
  // 🏢 ENTERPRISE: i18n hook for default tooltip
  const { t } = useTranslation('navigation');
  return (
    <NavigationIcon
      href={`/buildings/${buildingId}`}
      tooltip={tooltip || t('icons.openInBuildings')}
      analyticsLabel="nav-building-to-buildings"
      {...props}
    />
  );
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default NavigationIcon;