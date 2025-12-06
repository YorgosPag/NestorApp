// ============================================================================
// PHOTO CONTEXTS & MAPPINGS - ENTERPRISE MODULE
// ============================================================================
//
// 🗂️ Context mappings and configuration relationships
// Cross-reference configurations and context-aware utilities
// Part of modular Enterprise photo configuration architecture
//
// ============================================================================

import { PhotoType } from './helpers';
import { PHOTO_LAYOUTS } from '../dimensions/layouts';
import { PHOTO_COLORS, PHOTO_BORDERS, PHOTO_TEXT_COLORS } from '../styling/colors';
import { PHOTO_TYPOGRAPHY } from '../styling/typography';
import { PHOTO_COMBINED_EFFECTS } from '../styling/effects';

/**
 * Photo context enumeration για different usage scenarios
 */
export type PhotoContext = 'form' | 'display' | 'upload' | 'gallery' | 'preview' | 'modal';

/**
 * Context-aware photo configurations
 */
export const PHOTO_CONTEXT_CONFIGS = {
  /** Form context - χρήση σε forms για upload/edit */
  form: {
    colors: PHOTO_COLORS.UPLOAD_BACKGROUND,
    borders: PHOTO_BORDERS.EMPTY_STATE,
    typography: PHOTO_TYPOGRAPHY.UPLOAD_TEXT,
    effects: PHOTO_COMBINED_EFFECTS.UPLOAD_ZONE,
    layout: PHOTO_LAYOUTS.UPLOAD_SECTION
  },

  /** Display context - χρήση για readonly display */
  display: {
    colors: PHOTO_COLORS.PHOTO_BACKGROUND,
    borders: PHOTO_BORDERS.STANDARD,
    typography: PHOTO_TYPOGRAPHY.LABEL,
    effects: PHOTO_COMBINED_EFFECTS.PHOTO_PREVIEW,
    layout: PHOTO_LAYOUTS.PHOTO_GRID
  },

  /** Upload context - χρήση για drag & drop uploads */
  upload: {
    colors: PHOTO_COLORS.EMPTY_STATE_BACKGROUND,
    borders: `${PHOTO_BORDERS.EMPTY_STATE} ${PHOTO_BORDERS.EMPTY_HOVER}`,
    typography: PHOTO_TYPOGRAPHY.UPLOAD_TEXT,
    effects: PHOTO_COMBINED_EFFECTS.UPLOAD_ZONE,
    layout: PHOTO_LAYOUTS.UPLOAD_SECTION
  },

  /** Gallery context - χρήση για photo galleries */
  gallery: {
    colors: PHOTO_COLORS.PHOTO_BACKGROUND,
    borders: PHOTO_BORDERS.STANDARD,
    typography: PHOTO_TYPOGRAPHY.METADATA,
    effects: PHOTO_COMBINED_EFFECTS.INTERACTIVE_CARD,
    layout: PHOTO_LAYOUTS.PHOTO_GRID
  },

  /** Preview context - χρήση για quick previews */
  preview: {
    colors: PHOTO_COLORS.PHOTO_BACKGROUND,
    borders: PHOTO_BORDERS.STANDARD,
    typography: PHOTO_TYPOGRAPHY.DESCRIPTION,
    effects: PHOTO_COMBINED_EFFECTS.PHOTO_PREVIEW,
    layout: PHOTO_LAYOUTS.INDIVIDUAL_GRID
  },

  /** Modal context - χρήση για detailed modals */
  modal: {
    colors: PHOTO_COLORS.PHOTO_BACKGROUND,
    borders: PHOTO_BORDERS.PRIMARY,
    typography: PHOTO_TYPOGRAPHY.TITLE,
    effects: PHOTO_COMBINED_EFFECTS.INTERACTIVE_CARD,
    layout: PHOTO_LAYOUTS.SERVICE_CENTER
  }
} as const;

/**
 * Photo type to default context mapping
 */
export const TYPE_TO_CONTEXT_MAP: Record<PhotoType, PhotoContext> = {
  'company-logo': 'display',
  'company-representative': 'preview',
  'individual': 'gallery',
  'service-logo': 'modal',
  'project': 'gallery',
  'building': 'gallery'
} as const;

/**
 * Context to color scheme mapping για semantic coloring
 */
export const CONTEXT_COLOR_SCHEMES = {
  form: {
    primary: PHOTO_TEXT_COLORS.MEDIUM,
    secondary: PHOTO_TEXT_COLORS.LIGHT_MUTED,
    accent: PHOTO_TEXT_COLORS.LABEL,
    background: PHOTO_COLORS.UPLOAD_BACKGROUND
  },

  display: {
    primary: PHOTO_TEXT_COLORS.FOREGROUND_MUTED,
    secondary: PHOTO_TEXT_COLORS.MUTED,
    accent: PHOTO_TEXT_COLORS.LABEL,
    background: PHOTO_COLORS.PHOTO_BACKGROUND
  },

  upload: {
    primary: PHOTO_TEXT_COLORS.MEDIUM,
    secondary: PHOTO_TEXT_COLORS.LIGHT_MUTED,
    accent: PHOTO_TEXT_COLORS.OVERLAY,
    background: PHOTO_COLORS.EMPTY_STATE_BACKGROUND
  },

  gallery: {
    primary: PHOTO_TEXT_COLORS.FOREGROUND_MUTED,
    secondary: PHOTO_TEXT_COLORS.MUTED,
    accent: PHOTO_TEXT_COLORS.OVERLAY,
    background: PHOTO_COLORS.PHOTO_BACKGROUND
  },

  preview: {
    primary: PHOTO_TEXT_COLORS.FOREGROUND_MUTED,
    secondary: PHOTO_TEXT_COLORS.LIGHT_MUTED,
    accent: PHOTO_TEXT_COLORS.LABEL,
    background: PHOTO_COLORS.MUTED_BACKGROUND
  },

  modal: {
    primary: PHOTO_TEXT_COLORS.FOREGROUND_MUTED,
    secondary: PHOTO_TEXT_COLORS.MUTED,
    accent: PHOTO_TEXT_COLORS.OVERLAY,
    background: PHOTO_COLORS.PHOTO_BACKGROUND
  }
} as const;

/**
 * Get context-aware configuration για photo type and usage context
 */
export function getPhotoContextConfig(
  type: PhotoType,
  context?: PhotoContext
): typeof PHOTO_CONTEXT_CONFIGS[PhotoContext] {
  const effectiveContext = context || TYPE_TO_CONTEXT_MAP[type];
  return PHOTO_CONTEXT_CONFIGS[effectiveContext];
}

/**
 * Build complete context-aware class string
 */
export function buildContextPhotoClass(
  type: PhotoType,
  context?: PhotoContext,
  additionalClasses?: string[]
): string {
  const config = getPhotoContextConfig(type, context);
  const classes = [
    config.colors,
    config.borders,
    config.typography,
    config.effects
  ];

  if (additionalClasses?.length) {
    classes.push(...additionalClasses);
  }

  return classes.filter(Boolean).join(' ');
}

/**
 * Get color scheme για specific context
 */
export function getContextColorScheme(context: PhotoContext) {
  return CONTEXT_COLOR_SCHEMES[context];
}

/**
 * Cross-reference mapping για finding related configurations
 */
export const PHOTO_CROSS_REFERENCE = {
  /** Find all contexts that use a specific layout */
  byLayout: {
    [PHOTO_LAYOUTS.COMPANY_GRID.container]: ['display', 'preview'] as PhotoContext[],
    [PHOTO_LAYOUTS.INDIVIDUAL_GRID.container]: ['gallery', 'preview'] as PhotoContext[],
    [PHOTO_LAYOUTS.SERVICE_CENTER.container]: ['modal'] as PhotoContext[],
    [PHOTO_LAYOUTS.PHOTO_GRID.container]: ['gallery', 'display'] as PhotoContext[],
    [PHOTO_LAYOUTS.UPLOAD_SECTION.container]: ['form', 'upload'] as PhotoContext[]
  },

  /** Find contexts that use specific colors */
  byColor: {
    [PHOTO_COLORS.PHOTO_BACKGROUND]: ['display', 'gallery', 'preview', 'modal'] as PhotoContext[],
    [PHOTO_COLORS.UPLOAD_BACKGROUND]: ['form'] as PhotoContext[],
    [PHOTO_COLORS.EMPTY_STATE_BACKGROUND]: ['upload'] as PhotoContext[]
  },

  /** Find types that work best with specific contexts */
  byContext: {
    form: ['company-logo', 'individual', 'service-logo'] as PhotoType[],
    display: ['company-logo', 'project', 'building'] as PhotoType[],
    upload: ['company-logo', 'company-representative', 'individual', 'service-logo'] as PhotoType[],
    gallery: ['individual', 'project', 'building'] as PhotoType[],
    preview: ['company-representative', 'individual'] as PhotoType[],
    modal: ['service-logo', 'project', 'building'] as PhotoType[]
  }
} as const;