'use client';

import { UI_COLORS } from '../config/color-config';

// Re-export types από το settings-core για unified approach
export type {
  LineSettings,
  LineType,
  LineCapStyle,
  LineJoinStyle
} from '../settings-core/types';

// Context-specific types
export type {
  LineTemplate,
  TemplateCategory
} from '../contexts/LineSettingsContext';

// Default settings που χρησιμοποιούνται από το ConfigurationProvider
export const DEFAULT_LINE_SETTINGS = {
  enabled: true,
  lineType: 'solid' as const,
  lineWidth: 2,
  color: UI_COLORS.WHITE,
  opacity: 1.0,
  dashScale: 1.0,
  dashOffset: 0,
  lineCap: 'butt' as const,
  lineJoin: 'miter' as const,
  breakAtCenter: false,
  hoverColor: UI_COLORS.BRIGHT_YELLOW,
  hoverType: 'solid' as const,
  hoverWidth: 3,
  hoverOpacity: 0.8,
  finalColor: UI_COLORS.BRIGHT_GREEN,
  finalType: 'solid' as const,
  finalWidth: 2,
  finalOpacity: 1.0,
  activeTemplate: null
};