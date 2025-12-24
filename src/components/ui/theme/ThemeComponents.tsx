'use client';

// Enterprise Theming System - Centralized Design Tokens
// Separates concerns: Container backgrounds vs Component states vs Content themes

import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';

// 🏭 THEME SYSTEM FACTORY - Enterprise Dynamic Theming
export function getThemeSystem() {
  const { quick } = useBorderTokens();

  return {
    // 🎨 CONTAINER BACKGROUNDS - Independent from component states
    containers: {
      // Toolbar containers (bottom toolbars, action panels) - Enterprise centralized
      toolbar: `${quick.borderT} bg-card/50 backdrop-blur-sm p-2`,
      toolbarDark: `${quick.borderT} ${quick.input} bg-slate-800/90 backdrop-blur-sm p-2`,
      toolbarLight: `${quick.borderT} ${quick.input} bg-slate-50/90 backdrop-blur-sm p-2`,

      // Card containers (dialogs, panels, widgets) - Enterprise centralized
      card: `${quick.card} bg-card p-4`,
      cardDark: `${quick.card} bg-slate-800 p-4`,
      cardLight: `${quick.card} bg-white p-4`,

    // Contact card backgrounds (list items)
    contactCard: `bg-card ${INTERACTIVE_PATTERNS.ACCENT_HOVER}`,
    contactCardSelected: "bg-blue-50 dark:bg-blue-950/20",
    contactCardArchived: "bg-muted/30",

    // Minimal containers (simple wrappers)
    minimal: "bg-background p-2",
    minimalDark: "bg-slate-900 p-2",
    minimalLight: "bg-slate-50 p-2"
  },

  // 🎯 TAB TRIGGERS - Component interaction states
  tabs: {
    // Default tab styling with centralized typography (Label Medium: 12px, medium, muted)
    trigger: "flex items-center gap-1 transition-colors text-xs font-medium text-muted-foreground",

    // Active states for different themes
    activeDefault: "data-[state=active]:bg-blue-500 data-[state=active]:text-white",
    activeSuccess: "data-[state=active]:bg-green-500 data-[state=active]:text-white",
    activeWarning: "data-[state=active]:bg-orange-500 data-[state=active]:text-white",
    activeDanger: "data-[state=active]:bg-red-500 data-[state=active]:text-white",

    // Hover states
    hoverDefault: `${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`,
    hoverSuccess: `${INTERACTIVE_PATTERNS.SUCCESS_HOVER}`,
    hoverWarning: `${INTERACTIVE_PATTERNS.WARNING_HOVER}`,
    hoverDanger: `${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`
  },

  // 📝 CONTENT AREAS - Content background themes
  content: {
    // Standard content areas
    default: "mt-3",
    wrapper: "flex flex-wrap gap-2",

    // Themed content backgrounds - Enterprise semantic with reduced opacity
    neutral: `bg-slate-50/30 ${quick.rounded} p-3`,
    info: `bg-blue-50/50 ${quick.rounded} p-3 ${quick.input} border-blue-200/60`,
    success: `bg-green-50/50 ${quick.rounded} p-3 ${quick.input} border-green-200/60`,
    warning: `bg-orange-50/50 ${quick.rounded} p-3 ${quick.input} border-orange-200/60`,
    danger: `bg-red-50/50 ${quick.rounded} p-3 ${quick.input} border-red-200/60`
  },

  // 🔤 TYPOGRAPHY HIERARCHY - Enterprise text roles (Material Design + IBM Carbon inspired)
  typography: {
    // Display roles (hero content, metrics, brand moments)
    displayLarge: "text-4xl font-normal text-foreground tracking-tight", // 36px
    displayMedium: "text-3xl font-normal text-foreground tracking-tight", // 30px
    displaySmall: "text-2xl font-normal text-foreground tracking-tight", // 24px

    // Headline roles (page titles, section headers)
    headlineLarge: "text-xl font-semibold text-foreground", // 20px
    headlineMedium: "text-lg font-semibold text-foreground", // 18px
    headlineSmall: "text-base font-semibold text-foreground", // 16px

    // Title roles (component titles, card headers)
    titleLarge: "text-base font-medium text-foreground", // 16px
    titleMedium: "text-sm font-medium text-foreground", // 14px
    titleSmall: "text-xs font-medium text-foreground", // 12px

    // Body roles (paragraphs, content text)
    bodyLarge: "text-base font-normal text-foreground", // 16px
    bodyMedium: "text-sm font-normal text-foreground", // 14px
    bodySmall: "text-xs font-normal text-muted-foreground", // 12px

    // Label roles (form labels, captions, metadata)
    labelLarge: "text-sm font-medium text-muted-foreground", // 14px
    labelMedium: "text-xs font-medium text-muted-foreground", // 12px
    labelSmall: "text-xs font-medium text-muted-foreground/80" // 11px
    }
  } as const;
}

// 🎨 THEME VARIANTS FACTORY - Pre-configured combinations
export function getThemeVariants() {
  const THEME_SYSTEM = getThemeSystem();

  return {
    // Default enterprise theme
    default: {
      container: THEME_SYSTEM.containers.toolbar,
      tabTrigger: `${THEME_SYSTEM.tabs.trigger} ${THEME_SYSTEM.tabs.activeDefault} ${THEME_SYSTEM.tabs.hoverDefault}`,
      content: THEME_SYSTEM.content.default
    },

    // Success/positive theme
    success: {
      container: THEME_SYSTEM.containers.toolbar,
      tabTrigger: `${THEME_SYSTEM.tabs.trigger} ${THEME_SYSTEM.tabs.activeSuccess} ${THEME_SYSTEM.tabs.hoverSuccess}`,
      content: THEME_SYSTEM.content.default
    },

    // Warning/caution theme
    warning: {
      container: THEME_SYSTEM.containers.toolbar,
      tabTrigger: `${THEME_SYSTEM.tabs.trigger} ${THEME_SYSTEM.tabs.activeWarning} ${THEME_SYSTEM.tabs.hoverWarning}`,
      content: THEME_SYSTEM.content.default
    },

    // Danger/error theme
    danger: {
      container: THEME_SYSTEM.containers.toolbar,
      tabTrigger: `${THEME_SYSTEM.tabs.trigger} ${THEME_SYSTEM.tabs.activeDanger} ${THEME_SYSTEM.tabs.hoverDanger}`,
      content: THEME_SYSTEM.content.default
    },

    // Dark theme variant
    dark: {
      container: THEME_SYSTEM.containers.toolbarDark,
      tabTrigger: `${THEME_SYSTEM.tabs.trigger} ${THEME_SYSTEM.tabs.activeDefault} ${THEME_SYSTEM.tabs.hoverDefault}`,
      content: THEME_SYSTEM.content.default
    },

    // Light theme variant
    light: {
      container: THEME_SYSTEM.containers.toolbarLight,
      tabTrigger: `${THEME_SYSTEM.tabs.trigger} ${THEME_SYSTEM.tabs.activeDefault} ${THEME_SYSTEM.tabs.hoverDefault}`,
      content: THEME_SYSTEM.content.default
    },

    // Clean theme variant - No container styling, just clean tabs
    clean: {
      container: "",
      tabTrigger: `${THEME_SYSTEM.tabs.trigger} ${THEME_SYSTEM.tabs.activeDefault} ${THEME_SYSTEM.tabs.hoverDefault}`,
      content: THEME_SYSTEM.content.default
    }
  } as const;
}

// 🏗️ THEME UTILITIES
export type ThemeVariant = keyof ReturnType<typeof getThemeVariants>;
export type ContainerType = keyof ReturnType<typeof getThemeSystem>['containers'];
export type TabTheme = keyof ReturnType<typeof getThemeSystem>['tabs'];

/**
 * Get complete theme configuration for a specific variant
 */
export function getThemeVariant(variant: ThemeVariant = 'default') {
  return getThemeVariants()[variant];
}

/**
 * Get specific container styling
 */
export function getContainerTheme(containerType: ContainerType) {
  return getThemeSystem().containers[containerType];
}

/**
 * Create custom theme combination
 */
export function createCustomTheme(
  container: ContainerType,
  tabTheme: ThemeVariant = 'default'
) {
  const themeSystem = getThemeSystem();
  const themeVariants = getThemeVariants();

  return {
    container: themeSystem.containers[container],
    tabTrigger: themeVariants[tabTheme].tabTrigger,
    content: themeSystem.content.default
  };
}

/**
 * Get contact card backgrounds
 */
export function getContactCardBackgrounds() {
  const themeSystem = getThemeSystem();

  return {
    default: themeSystem.containers.contactCard,
    selected: themeSystem.containers.contactCardSelected,
    archived: themeSystem.containers.contactCardArchived
  };
}

/**
 * Get enterprise typography styles
 */
export function getTypographyStyles() {
  return getThemeSystem().typography;
}

/**
 * Get specific typography role
 */
export function getTypography(role: keyof ReturnType<typeof getThemeSystem>['typography']) {
  return getThemeSystem().typography[role];
}