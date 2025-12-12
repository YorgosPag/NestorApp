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
import { Button } from '@/components/ui/button';
import { designSystem } from '@/lib/design-system';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';

// 🏢 ENTERPRISE: Import centralized social platforms configuration
import {
  SOCIAL_SHARING_PLATFORMS,
  generatePlatformButtonStyles,
  generatePlatformIconStyles,
  generatePlatformLabelStyles
} from '@/lib/social-sharing/SocialSharingPlatforms';
import type { SharePlatform } from '@/lib/social-sharing/SocialSharingPlatforms';

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
    columns?: 2 | 3 | 4 | 6;
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
      console.log(`📊 Analytics: ${finalAnalyticsConfig.category}.${platform.id}.click`);
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
    const columnClasses = {
      2: 'grid-cols-2',
      3: 'grid-cols-3',
      4: 'grid-cols-4',
      6: 'grid-cols-6'
    };

    const spacingClasses = {
      tight: 'gap-2',
      normal: 'gap-4',
      relaxed: 'gap-6'
    };

    return designSystem.cn(
      'grid',
      columnClasses[finalGridConfig.columns],
      spacingClasses[finalGridConfig.spacing]
    );
  };

  /**
   * 📱 Render Platform Button
   */
  const renderPlatformButton = (platform: SharePlatform) => {
    const IconComponent = platform.icon;

    return (
      <Button
        key={platform.id}
        type="button"
        variant="ghost"
        disabled={loading}
        onClick={() => handlePlatformClick(platform)}
        className={designSystem.cn(
          // Use centralized platform button styles
          generatePlatformButtonStyles(platform, finalGridConfig.buttonVariant),
          // Additional responsive classes
          'group relative overflow-hidden',
          INTERACTIVE_PATTERNS.BUTTON_ENHANCED,
          // Loading state
          loading && 'opacity-50 cursor-not-allowed',
          // Focus states using design system
          'focus:outline-none focus:ring-2',
          designSystem.getStatusColor('info', 'border'),
          'focus:ring-offset-2'
        )}
      >
        <article className="flex flex-col items-center space-y-2" role="button" aria-label={`Κοινοποίηση σε ${platform.name}`}>
          {/* Platform Icon */}
          <figure role="img" aria-label={`Εικονίδιο ${platform.name}`}>
            <IconComponent
              className={designSystem.cn(
                generatePlatformIconStyles(finalGridConfig.iconSize),
                // Add white text color για contrast
                'text-white'
              )}
            />
          </figure>

          {/* Platform Label */}
          {finalGridConfig.showLabels && (
            <header className={designSystem.cn(
              generatePlatformLabelStyles('xs'),
              'text-white'
            )}>
              {platform.name}
            </header>
          )}
        </article>

        {/* Gradient Overlay για extra depth */}
        <aside className={designSystem.cn(
          "absolute inset-0 opacity-0 group-hover:opacity-20",
          TRANSITION_PRESETS.STANDARD_OPACITY,
          "bg-gradient-to-br from-white via-transparent to-transparent"
        )} role="presentation" aria-hidden="true" />
      </Button>
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
    'aria-label': 'Επιλογή κοινωνικής πλατφόρμας για κοινοποίηση',
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
      )} role="status" aria-label="Δεν υπάρχουν Πλατφόρμες">
        <p className={designSystem.cn(
          designSystem.getTypographyClass('sm'),
          designSystem.colorScheme.responsive.muted.split(' ')[1] // text-muted-foreground
        )}>
          Δεν υπάρχουν διαθέσιμες πλατφόρμες κοινοποίησης
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
      <nav className={getGridClasses()} role="group" aria-label="Πλατφόρμες Κοινωνικής Κοινοποίησης">
        {filteredPlatforms.map(renderPlatformButton)}
      </nav>

      {/* Debug Info (only in development) */}
      {process.env.NODE_ENV === 'development' && finalAnalyticsConfig.trackClicks && (
        <aside className={designSystem.cn(
          designSystem.getTypographyClass('xs'),
          designSystem.colorScheme.responsive.muted.split(' ')[1], // text-muted-foreground
          "text-center"
        )} role="note" aria-label="Πληροφορίες Ανάπτυξης">
          🔍 Debug: {filteredPlatforms.length} platforms, {finalGridConfig.columns} columns
        </aside>
      )}

      {/* Loading Overlay */}
      {loading && (
        <aside className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 flex items-center justify-center rounded-lg" role="status" aria-live="polite" aria-label="Φόρτωση Πλατφορμών">
          <p className={designSystem.cn(
            designSystem.getTypographyClass('sm', 'medium'),
            designSystem.colorScheme.responsive.muted.split(' ')[1] // text-muted-foreground
          )}>
            Φόρτωση...
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