// useSettingsPreview.ts - Custom hook για live preview των settings
// STATUS: ACTIVE - Phase 1 Step 1.4
// PURPOSE: Real-time preview της εμφάνισης με τα τρέχοντα settings

import { useMemo } from 'react';

/**
 * useSettingsPreview - Custom hook για live preview settings
 *
 * Purpose:
 * - Δημιουργεί preview data από τρέχοντα settings
 * - Επιστρέφει CSS styles για real-time rendering
 * - Optimized με useMemo για performance
 *
 * Use Cases:
 * - LinePreview component (preview line με current color/width/style)
 * - TextPreview component (preview text με current font/size)
 * - GripPreview component (preview grip με current color/size)
 *
 * @see docs/dxf-settings/COMPONENT_GUIDE.md#useSettingsPreview
 * @see docs/dxf-settings/STATE_MANAGEMENT.md - Derived State
 *
 * @example
 * ```tsx
 * // In LinePreview.tsx
 * const { previewStyles } = useLinePreview({
 *   color: '#FF0000',
 *   width: 2,
 *   style: 'solid',
 * });
 *
 * return <div style={previewStyles}>Preview Line</div>;
 * ```
 */

// ============================================================================
// LINE PREVIEW
// ============================================================================

export interface LineSettings {
  color: string;
  width: number;
  style: 'solid' | 'dashed' | 'dotted' | 'dash-dot';
}

export interface UseLinePreviewReturn {
  previewStyles: React.CSSProperties;
  svgPath?: string; // Για custom line styles (dashed, dotted, etc.)
}

/**
 * useLinePreview - Hook για Line preview
 *
 * @param settings - Current line settings (color, width, style)
 * @returns {UseLinePreviewReturn} - Preview styles και SVG path (αν χρειάζεται)
 */
export function useLinePreview(settings: LineSettings): UseLinePreviewReturn {
  const previewStyles = useMemo<React.CSSProperties>(() => {
    // Base styles
    const baseStyles: React.CSSProperties = {
      borderTopColor: settings.color,
      borderTopWidth: `${settings.width}px`,
      width: '100%',
      height: '1px',
    };

    // Line style mapping
    const styleMap: Record<
      LineSettings['style'],
      React.CSSProperties['borderTopStyle']
    > = {
      solid: 'solid',
      dashed: 'dashed',
      dotted: 'dotted',
      'dash-dot': 'dashed', // Fallback - custom SVG για πιο ακριβή rendering
    };

    return {
      ...baseStyles,
      borderTopStyle: styleMap[settings.style],
    };
  }, [settings.color, settings.width, settings.style]);

  // SVG path για custom line styles (μελλοντική επέκταση)
  const svgPath = useMemo(() => {
    if (settings.style === 'dash-dot') {
      // TODO: Implement custom SVG για dash-dot style
      return undefined;
    }
    return undefined;
  }, [settings.style]);

  return {
    previewStyles,
    svgPath,
  };
}

// ============================================================================
// TEXT PREVIEW
// ============================================================================

export interface TextSettings {
  color: string;
  fontSize: number;
  fontFamily: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
}

export interface UseTextPreviewReturn {
  previewStyles: React.CSSProperties;
  sampleText: string;
}

/**
 * useTextPreview - Hook για Text preview
 *
 * @param settings - Current text settings (color, font, size)
 * @returns {UseTextPreviewReturn} - Preview styles και sample text
 */
export function useTextPreview(settings: TextSettings): UseTextPreviewReturn {
  const previewStyles = useMemo<React.CSSProperties>(() => {
    return {
      color: settings.color,
      fontSize: `${settings.fontSize}px`,
      fontFamily: settings.fontFamily,
      fontWeight: settings.fontWeight || 'normal',
      fontStyle: settings.fontStyle || 'normal',
    };
  }, [
    settings.color,
    settings.fontSize,
    settings.fontFamily,
    settings.fontWeight,
    settings.fontStyle,
  ]);

  const sampleText = 'AaBbCc 123'; // Sample text για preview

  return {
    previewStyles,
    sampleText,
  };
}

// ============================================================================
// GRIP PREVIEW
// ============================================================================

export interface GripSettings {
  color: string;
  size: number;
  style: 'square' | 'circle' | 'cross';
}

export interface UseGripPreviewReturn {
  previewStyles: React.CSSProperties;
  gripShape: 'square' | 'circle' | 'cross';
}

/**
 * useGripPreview - Hook για Grip preview
 *
 * @param settings - Current grip settings (color, size, style)
 * @returns {UseGripPreviewReturn} - Preview styles και grip shape
 */
export function useGripPreview(settings: GripSettings): UseGripPreviewReturn {
  const previewStyles = useMemo<React.CSSProperties>(() => {
    const baseStyles: React.CSSProperties = {
      backgroundColor: settings.color,
      width: `${settings.size}px`,
      height: `${settings.size}px`,
    };

    // Shape-specific styles
    if (settings.style === 'circle') {
      return {
        ...baseStyles,
        borderRadius: '50%',
      };
    }

    if (settings.style === 'square') {
      return {
        ...baseStyles,
        borderRadius: '0',
      };
    }

    // Cross style - uses border για rendering
    if (settings.style === 'cross') {
      return {
        ...baseStyles,
        backgroundColor: 'transparent',
        borderTop: `2px solid ${settings.color}`,
        borderLeft: `2px solid ${settings.color}`,
        transform: 'rotate(45deg)',
      };
    }

    return baseStyles;
  }, [settings.color, settings.size, settings.style]);

  return {
    previewStyles,
    gripShape: settings.style,
  };
}

// ============================================================================
// GENERIC SETTINGS PREVIEW (για custom components)
// ============================================================================

export interface GenericSettings {
  [key: string]: string | number | boolean;
}

export interface UseSettingsPreviewReturn {
  previewData: GenericSettings;
  hasChanged: boolean;
}

/**
 * useSettingsPreview - Generic hook για settings preview
 *
 * @param currentSettings - Current settings
 * @param originalSettings - Original settings (για comparison)
 * @returns {UseSettingsPreviewReturn} - Preview data και change detection
 */
export function useSettingsPreview(
  currentSettings: GenericSettings,
  originalSettings?: GenericSettings
): UseSettingsPreviewReturn {
  const previewData = useMemo(() => {
    return { ...currentSettings };
  }, [currentSettings]);

  const hasChanged = useMemo(() => {
    if (!originalSettings) return false;

    return Object.keys(currentSettings).some((key) => {
      return currentSettings[key] !== originalSettings[key];
    });
  }, [currentSettings, originalSettings]);

  return {
    previewData,
    hasChanged,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  useLinePreview,
  useTextPreview,
  useGripPreview,
  useSettingsPreview,
};
