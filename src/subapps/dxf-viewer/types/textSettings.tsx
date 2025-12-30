'use client';

// Re-export types από το TextSettingsContext για unified approach
export type {
  TextSettings,
  TextTemplate
} from '../contexts/TextSettingsContext.tsx';

import { UI_COLORS } from '../config/color-config';

// Default settings που χρησιμοποιούνται από το ConfigurationProvider
export const DEFAULT_TEXT_SETTINGS = {
  enabled: true,
  fontFamily: 'Arial, sans-serif',
  fontSize: 12,
  color: UI_COLORS.WHITE,
  isBold: false,
  isItalic: false,
  isUnderline: false,
  isStrikethrough: false,
  isSuperscript: false,
  isSubscript: false
};