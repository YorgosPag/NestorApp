'use client';

// Re-export types από το LineSettingsContext για unified approach
export type {
  LineSettings,
  LineType,
  LineCapStyle,
  LineJoinStyle,
  LineTemplate,
  TemplateCategory
} from '../contexts/LineSettingsContext';

// Default settings που χρησιμοποιούνται από το ConfigurationProvider
export const DEFAULT_LINE_SETTINGS = {
  enabled: true,
  lineType: 'solid' as const,
  lineWidth: 2,
  color: '#ffffff',
  opacity: 1.0,
  dashScale: 1.0,
  dashOffset: 0,
  lineCap: 'butt' as const,
  lineJoin: 'miter' as const,
  breakAtCenter: false,
  hoverColor: '#ffff00',
  hoverType: 'solid' as const,
  hoverWidth: 3,
  hoverOpacity: 0.8,
  finalColor: '#00ff00',
  finalType: 'solid' as const,
  finalWidth: 2,
  finalOpacity: 1.0,
  activeTemplate: null
};