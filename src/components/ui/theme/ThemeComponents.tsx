'use client';

// Enterprise Theming System - Centralized Design Tokens
// Separates concerns: Container backgrounds vs Component states vs Content themes

import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/hooks/useSemanticColors';

// 🏭 THEME SYSTEM FACTORY - Enterprise Dynamic Theming
export function getThemeSystem() {
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  return {
    // 🎨 CONTAINER BACKGROUNDS - Independent from component states
    containers: {
      // Toolbar containers (bottom toolbars, action panels) - Enterprise centralized
      toolbar: `${quick.borderT} bg-card/50 backdrop-blur-sm p-2`,
      toolbarDark: `${quick.borderT} ${quick.input} ${colors.bg.primary}/90 backdrop-blur-sm p-2`,
      toolbarLight: `${quick.borderT} ${quick.input} ${colors.bg.secondary}/90 backdrop-blur-sm p-2`,

      // Card containers (dialogs, panels, widgets) - Enterprise centralized
      card: `${quick.card} bg-card p-4`,
      cardDark: `${quick.card} ${colors.bg.primary} p-4`,
      cardLight: `${quick.card} ${colors.bg.primary} p-4`,

    // Contact card backgrounds (list items)
    contactCard: `bg-card ${INTERACTIVE_PATTERNS.ACCENT_HOVER}`,
    contactCardSelected: colors.bg.info,
    contactCardArchived: "bg-muted/30",

    // Minimal containers (simple wrappers)
    minimal: "bg-background p-2",
    minimalDark: `${colors.bg.elevated} p-2`,
    minimalLight: `${colors.bg.secondary} p-2`
  },

  // 🎯 TAB TRIGGERS - Component interaction states
  tabs: {
    // Default tab styling with centralized typography (Label Medium: 12px, medium, muted)
    trigger: `flex items-center gap-1 transition-colors text-xs font-medium ${colors.text.muted}`,

    // Active states for different themes
    activeDefault: `data-[state=active]:${colors.bg.info} data-[state=active]:${colors.text.foreground}`,
    activeSuccess: `data-[state=active]:${colors.bg.success} data-[state=active]:${colors.text.foreground}`,
    activeWarning: `data-[state=active]:${colors.bg.warning} data-[state=active]:${colors.text.foreground}`,
    activeDanger: `data-[state=active]:${colors.bg.error} data-[state=active]:${colors.text.foreground}`,

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
    neutral: `${colors.bg.secondary}/30 ${quick.rounded} p-3`,
    info: `${colors.bg.info}/50 ${quick.rounded} p-3 ${quick.input} ${getStatusBorder('info')}/60`,
    success: `${colors.bg.success}/50 ${quick.rounded} p-3 ${quick.input} ${getStatusBorder('success')}/60`,
    warning: `${colors.bg.warning}/50 ${quick.rounded} p-3 ${quick.input} ${getStatusBorder('warning')}/60`,
    danger: `${colors.bg.error}/50 ${quick.rounded} p-3 ${quick.input} ${getStatusBorder('error')}/60`
  },

  // 🔤 TYPOGRAPHY HIERARCHY - Enterprise text roles (Material Design + IBM Carbon inspired)
  typography: {
    // Display roles (hero content, metrics, brand moments)
    displayLarge: `text-4xl font-normal ${colors.text.foreground} tracking-tight`, // 36px
    displayMedium: `text-3xl font-normal ${colors.text.foreground} tracking-tight`, // 30px
    displaySmall: `text-2xl font-normal ${colors.text.foreground} tracking-tight`, // 24px

    // Headline roles (page titles, section headers)
    headlineLarge: `text-xl font-semibold ${colors.text.foreground}`, // 20px
    headlineMedium: `text-lg font-semibold ${colors.text.foreground}`, // 18px
    headlineSmall: `text-base font-semibold ${colors.text.foreground}`, // 16px

    // Title roles (component titles, card headers)
    titleLarge: `text-base font-medium ${colors.text.foreground}`, // 16px
    titleMedium: `text-sm font-medium ${colors.text.foreground}`, // 14px
    titleSmall: `text-xs font-medium ${colors.text.foreground}`, // 12px

    // Body roles (paragraphs, content text)
    bodyLarge: `text-base font-normal ${colors.text.foreground}`, // 16px
    bodyMedium: `text-sm font-normal ${colors.text.foreground}`, // 14px
    bodySmall: `text-xs font-normal ${colors.text.muted}`, // 12px

    // Label roles (form labels, captions, metadata)
    labelLarge: `text-sm font-medium ${colors.text.muted}`, // 14px
    labelMedium: `text-xs font-medium ${colors.text.muted}`, // 12px
    labelSmall: `text-xs font-medium ${colors.text.muted}` // 11px
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