/**
 * Hover Configuration
 * Centralized configuration for consistent hover behavior styling
 */

import { UI_COLORS } from '../../config/color-config';
// 🏢 ADR-083: Centralized Line Dash Patterns
// 🏢 ADR-090: Centralized UI Fonts
import { LINE_DASH_PATTERNS, UI_FONTS } from '../../config/text-rendering-config';

export interface HoverConfig {
  colors: {
    distance: string;
    angle: string;
    area: string;
  };
  fonts: {
    distance: string;
    angle: string;
    area: string;
  };
  offsets: {
    gripAvoidance: number;
    arcRadius: number;
    textFromArc: number;
  };
  lineStyle: {
    dashPattern: number[];
  };
}

// Configuration based on existing polyline styling
export const HOVER_CONFIG: HoverConfig = {
  colors: {
    distance: UI_COLORS.MEASUREMENT_TEXT,  // Green - from existing distance labels
    angle: UI_COLORS.DEBUG_DISTANCE,     // Orange - from existing angle arcs
    area: UI_COLORS.BRIGHT_GREEN       // Bright green - from existing area labels
  },
  fonts: {
    distance: UI_FONTS.ARIAL.SMALL, // 🏢 ADR-090: Centralized font
    angle: UI_FONTS.ARIAL.SMALL,    // 🏢 ADR-090: Centralized font
    area: UI_FONTS.ARIAL.LARGE      // 🏢 ADR-090: Centralized font
  },
  offsets: {
    gripAvoidance: 20,    // From LineRenderer
    arcRadius: 30,        // From PolylineRenderer
    textFromArc: 20       // From PolylineRenderer
  },
  lineStyle: {
    // 🏢 ADR-083: Use centralized line dash pattern
    dashPattern: [...LINE_DASH_PATTERNS.SELECTION]
  }
};