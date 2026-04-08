// ============================================================================
// 🔗 SHARE PLATFORM GRID COMPONENT - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ SOCIAL SHARING
// ============================================================================
//
// 🎯 PURPOSE: Reusable platform grid για social sharing με centralized design
// 🔗 USED BY: ShareModal, PropertySharing, ContactSharing
// 🏢 STANDARDS: Enterprise platform patterns, centralized design system
//
// ============================================================================

'use client';

import React from 'react';
import { designSystem } from '@/lib/design-system';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('SharePlatformGrid');
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// 🏢 ENTERPRISE: Import centralized social platforms configuration
import {
  SOCIAL_SHARING_PLATFORMS,
} from '@/lib/social-sharing/SocialSharingPlatforms';
import type { SharePlatform } from '@/lib/social-sharing/SocialSharingPlatforms';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SharePlatformGridProps {
  /** Callback when a platform is selected */
  onPlatformSelect: (platformId: string) => void;

  /** Loading state για disabled interactions */
  loading?: boolean;

  /** Optional platform filtering */
  includePlatforms?: string[];
  excludePlatforms?: string[];

  /** Grid configuration */
  gridConfig?: {
    /** Columns για grid layout */
    columns?: 2 | 3 | 4 | 5 | 6;
    /** Button variant style */
    buttonVariant?: 'default' | 'compact' | 'minimal';
    /** Icon size */
    iconSize?: 'sm' | 'md' | 'lg';
    /** Show platform labels */
    showLabels?: boolean;
    /** Custom spacing */
    spacing?: 'tight' | 'normal' | 'relaxed';
  };

  /** Custom styling */
  className?: string;

  /** Analytics configuration */
  analytics?: {
    /** Track platform selections */
    trackClicks?: boolean;
    /** Custom event category */
    category?: string;
  };
}

// ============================================================================
// SHARE PLATFORM GRID COMPONENT
// ============================================================================

export const SharePlatformGrid: React.FC<SharePlatformGridProps> = ({
  onPlatformSelect,
  loading = false,
  includePlatforms,
  excludePlatforms = [],
  gridConfig = {},
  className,
  analytics = {}
}) => {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('common');
  const colors = useSemanticColors();

  // ============================================================================
  // CONFIGURATION με DEFAULTS
  // ============================================================================

  const finalGridConfig = {
    columns: 3,
    buttonVariant: 'default' as const,
    iconSize: 'md' as const,
    showLabels: true,
    spacing: 'normal' as const,
    ...gridConfig
  };

  const finalAnalyticsConfig = {
    trackClicks: false,
    category: 'social_sharing',
    ...analytics
  };

  // ============================================================================
  // PLATFORM FILTERING
  // ============================================================================

  const filteredPlatforms = SOCIAL_SHARING_PLATFORMS.filter(platform => {
    // Include filter
    if (includePlatforms && !includePlatforms.includes(platform.id)) {
      return false;
    }

    // Exclude filter
    if (excludePlatforms.includes(platform.id)) {
      return false;
    }

    return true;
  });

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  /**
   * 🎯 Handle Platform Selection με analytics
   */
  const handlePlatformClick = (platform: SharePlatform) => {
    if (loading) return;

    // Analytics tracking
    if (finalAnalyticsConfig.trackClicks) {
      // Track analytics event here if needed
      logger.info('Analytics event', { category: finalAnalyticsConfig.category, platformId: platform.id, action: 'click' });
    }

    onPlatformSelect(platform.id);
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  /**
   * 🎨 Get Grid Classes based on configuration
   */
  const getGridClasses = () => {
    const columnClasses: Record<number, string> = {
      2: 'grid-cols-2',
      3: 'grid-cols-3',
      4: 'grid-cols-4',
      5: 'grid-cols-5',
      6: 'grid-cols-6'
    };

    const spacingClasses = {
      tight: 'gap-2',
      normal: 'gap-4',
      relaxed: 'gap-6'
    };

    return designSystem.cn(
      'flex flex-wrap justify-center',
      spacingClasses[finalGridConfig.spacing]
    );
  };

  /**
   * 📱 Render Platform Button
   */
  const renderPlatformButton = (platform: SharePlatform) => {
    const IconComponent = platform.icon;

    return (
      <button
        key={platform.id}
        type="button"
        disabled={loading}
        onClick={() => handlePlatformClick(platform)}
        aria-label={t('sharing.shareOn', { platform: platform.name })}
        className={designSystem.cn(
          'flex flex-col items-center justify-center gap-1.5',
          'w-16 h-16 rounded-full',
          `bg-gradient-to-br ${platform.colors.gradient}`,
          'ring-1 ring-black/10',
          'transition-transform duration-150 ease-out',
          'hover:scale-110 active:scale-95',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          designSystem.getStatusColor('info', 'border'),
          loading && 'opacity-50 cursor-not-allowed',
        )}
      >
        <IconComponent className="w-6 h-6 text-white" />
        {finalGridConfig.showLabels && (
          <span className="text-[10px] font-medium text-white leading-none">
            {platform.name}
          </span>
        )}
      </button>
    );
  };

  // ============================================================================
  // ACCESSIBILITY & PERFORMANCE
  // ============================================================================

  /**
   * ♿ Accessibility Props
   */
  const getAccessibilityProps = () => ({
    role: 'grid',
    'aria-label': t('sharing.selectPlatform'),
    'aria-busy': loading
  });

  // ============================================================================
  // RENDER
  // ============================================================================

  // Early return αν δεν υπάρχουν platforms
  if (filteredPlatforms.length === 0) {
    return (
      <section className={designSystem.cn(
        "p-6 text-center",
        designSystem.colorScheme.responsive.muted.split(' ')[0], // border-muted
        "rounded-lg"
      )} role="status" aria-label={t('sharing.noPlatforms')}>
        <p className={designSystem.cn(
          designSystem.getTypographyClass('sm'),
          designSystem.colorScheme.responsive.muted.split(' ')[1] // text-muted-foreground
        )}>
          {t('sharing.noPlatformsMessage')}
        </p>
      </section>
    );
  }

  return (
    <section
      className={designSystem.cn("space-y-4", className)}
      {...getAccessibilityProps()}
    >
      {/* Platform Grid */}
      <nav className={designSystem.cn(getGridClasses(), 'py-2')} role="group" aria-label={t('sharing.socialPlatforms')}>
        {filteredPlatforms.map(renderPlatformButton)}
      </nav>

      {/* Loading Overlay */}
      {loading && (
        <aside className={`absolute inset-0 ${colors.bg.overlay} flex items-center justify-center rounded-lg`} role="status" aria-live="polite" aria-label={t('sharing.loadingPlatforms')}>
          <p className={designSystem.cn(
            designSystem.getTypographyClass('sm', 'medium'),
            designSystem.colorScheme.responsive.muted.split(' ')[1] // text-muted-foreground
          )}>
            {t('status.loading')}
          </p>
        </aside>
      )}
    </section>
  );
};

// ============================================================================
// CONVENIENCE COMPONENTS για Common Use Cases
// ============================================================================

/**
 * 📱 Compact Social Grid για mobile/small spaces
 */
export const CompactSharePlatformGrid: React.FC<Omit<SharePlatformGridProps, 'gridConfig'>> = (props) => (
  <SharePlatformGrid
    {...props}
    gridConfig={{
      columns: 6,
      buttonVariant: 'compact',
      iconSize: 'sm',
      showLabels: false,
      spacing: 'tight'
    }}
  />
);

/**
 * 🎯 Featured Social Grid για main sharing modals
 */
export const FeaturedSharePlatformGrid: React.FC<Omit<SharePlatformGridProps, 'gridConfig'>> = (props) => (
  <SharePlatformGrid
    {...props}
    gridConfig={{
      columns: 3,
      buttonVariant: 'default',
      iconSize: 'md',
      showLabels: true,
      spacing: 'normal'
    }}
  />
);

/**
 * 📋 Minimal Social Grid για subtle integrations
 */
export const MinimalSharePlatformGrid: React.FC<Omit<SharePlatformGridProps, 'gridConfig'>> = (props) => (
  <SharePlatformGrid
    {...props}
    gridConfig={{
      columns: 4,
      buttonVariant: 'minimal',
      iconSize: 'sm',
      showLabels: false,
      spacing: 'tight'
    }}
  />
);

// ============================================================================
// EXPORTS
// ============================================================================

export default SharePlatformGrid;