'use client';
import React, { useEffect, useState, useRef } from 'react';
import { HOVER_TEXT_EFFECTS } from '@/components/ui/effects';
import { portalComponents } from '@/styles/design-tokens';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useIconSizes } from '@/hooks/useIconSizes';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// ⌨️ ENTERPRISE: Centralized keyboard shortcuts - Single source of truth
import { matchesShortcut } from '../../config/keyboard-shortcuts';
// 🎨 ENTERPRISE: Lucide icons instead of emoji
import {
  Crosshair,
  Wrench,
  Layers,
  Image,
  Box,
  Home,
  BarChart3,
  FileText,
  X
} from 'lucide-react';

interface ElementMetrics {
  name: string;
  icon: React.ReactNode;
  element: HTMLElement | null;
  rect: DOMRect | null;
  className?: string;
}

// ============================================================================
// LAYOUT MAPPER STYLES - ENTERPRISE TOKENS
// ============================================================================

/**
 * @description Centralized styles for LayoutMapper component
 * All values derived from PANEL_LAYOUT tokens - zero hardcoded values
 */
const LAYOUT_MAPPER_STYLES = {
  // Hint badge (shown when debug is OFF)
  HINT_BADGE: {
    POSITION: 'fixed',
    CONTAINER: `fixed ${PANEL_LAYOUT.MARGIN.TOP_SM} ${PANEL_LAYOUT.POSITION.RIGHT_2} ${PANEL_LAYOUT.TYPOGRAPHY.XS} bg-black ${PANEL_LAYOUT.BG_OPACITY['50']} ${PANEL_LAYOUT.SPACING.COMPACT} ${PANEL_LAYOUT.INPUT.BORDER_RADIUS}`,
  },

  // Debug overlay container
  DEBUG_OVERLAY: {
    CONTAINER: `fixed ${PANEL_LAYOUT.INSET['0']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`,
  },

  // Measurement box for each element
  // 🏢 ENTERPRISE: Using FONT_FAMILY.BASE for consistency with app UI
  MEASUREMENT_BOX: {
    BASE: `absolute border border-dashed ${PANEL_LAYOUT.OPACITY['60']}`,
    LABEL: `absolute ${PANEL_LAYOUT.POSITION.NEGATIVE_TOP_6} ${PANEL_LAYOUT.POSITION.LEFT_0} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_FAMILY.BASE} bg-black ${PANEL_LAYOUT.SPACING.HORIZONTAL_XS} ${PANEL_LAYOUT.INPUT.BORDER_RADIUS} whitespace-nowrap flex items-center gap-1`,
    COORD_TOP_LEFT: `absolute ${PANEL_LAYOUT.POSITION.TOP_0} ${PANEL_LAYOUT.POSITION.LEFT_0} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_FAMILY.BASE} ${PANEL_LAYOUT.SPACING.HORIZONTAL_XS}`,
    COORD_BOTTOM_RIGHT: `absolute ${PANEL_LAYOUT.POSITION.BOTTOM_0} ${PANEL_LAYOUT.POSITION.RIGHT_0} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_FAMILY.BASE} ${PANEL_LAYOUT.SPACING.HORIZONTAL_XS}`,
  },

  // Info panel (right side) - 🎨 ENTERPRISE: bg-card + FONT_FAMILY.BASE for UI consistency
  INFO_PANEL: {
    CONTAINER: `fixed ${PANEL_LAYOUT.POSITION.TOP_20} ${PANEL_LAYOUT.POSITION.RIGHT_4} ${PANEL_LAYOUT.SPACING.LG} ${PANEL_LAYOUT.INPUT.BORDER_RADIUS} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_FAMILY.BASE} max-w-md bg-card border border-border shadow-lg`,
    HEADER: `flex justify-between items-center ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`,
    HEADER_TITLE: `${PANEL_LAYOUT.FONT_WEIGHT.BOLD} flex items-center gap-2`,
    METRIC_ITEM: `${PANEL_LAYOUT.MARGIN.BOTTOM_XS} flex items-start gap-2`,
    METRIC_DETAILS: `${PANEL_LAYOUT.MARGIN.LEFT_HALF} ${PANEL_LAYOUT.TYPOGRAPHY.XS}`,
    // 🎨 ENTERPRISE: Centered footer
    FOOTER: `${PANEL_LAYOUT.MARGIN.TOP_LG} ${PANEL_LAYOUT.PADDING.TOP_SM} text-center`,
  },
} as const;

export default function LayoutMapper() {
  const [metrics, setMetrics] = useState<ElementMetrics[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout>();
  const { getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();

  const measureElements = () => {
    // ✅ ENTERPRISE: All debug colors via centralized COLOR_BRIDGE tokens
    // 🎨 ENTERPRISE: Lucide icons instead of emoji
    const elementsToMeasure = [
      // Core UI Elements
      { name: 'Main Toolbar', icon: <Wrench className={iconSizes.xs} />, selector: '[data-testid="dxf-main-toolbar"]', className: colors.bg.debugBlue },

      // 🏢 ENTERPRISE: Individual floating panels with unique data-testid
      { name: 'Overlay Toolbar', icon: <Layers className={iconSizes.xs} />, selector: '[data-testid="overlay-toolbar-panel"]', className: colors.bg.debugYellow },
      { name: 'Overlay Properties', icon: <Layers className={iconSizes.xs} />, selector: '[data-testid="overlay-properties-panel"]', className: colors.bg.debugPurple },

      // Canvas Elements
      { name: 'DXF Canvas', icon: <Image className={iconSizes.xs} />, selector: '.dxf-canvas', className: colors.bg.debugGreen },
      { name: 'Layer Canvas', icon: <Layers className={iconSizes.xs} />, selector: '.layer-canvas', className: colors.bg.debugOrange },

      // Container Elements
      { name: 'Canvas Stack', icon: <Box className={iconSizes.xs} />, selector: '.canvas-stack', className: colors.bg.debugPink },
      { name: 'Canvas Area', icon: <Home className={iconSizes.xs} />, selector: '.canvas-area', className: colors.bg.hover },

      // Status Bar (may not be rendered)
      { name: 'CAD Status Bar', icon: <BarChart3 className={iconSizes.xs} />, selector: '[data-testid="cad-status-bar"]', className: colors.bg.info },

      // PDF Background (only when PDF loaded)
      { name: 'PDF Background', icon: <FileText className={iconSizes.xs} />, selector: '[data-testid="pdf-background-canvas"]', className: colors.bg.debugRed }
    ];

    const newMetrics: ElementMetrics[] = elementsToMeasure.map(({ name, icon, selector, className }) => {
      const element = document.querySelector(selector) as HTMLElement;
      const rect = element?.getBoundingClientRect() || null;

      return {
        name,
        icon,
        element,
        rect,
        className
      };
    });

    setMetrics(newMetrics);

    // 🎯 DEBUG: Εκτύπωση μετρήσεων
    console.log('🔧 LAYOUT MEASUREMENTS:');
    newMetrics.forEach(({ name, rect }) => {
      if (rect) {
        console.log(`  - ${name}:`, {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          top: Math.round(rect.top),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left)
        });
      } else {
        console.log(`  - ${name}: NOT FOUND`);
      }
    });
  };

  useEffect(() => {
    if (isVisible) {
      measureElements();
      intervalRef.current = setInterval(measureElements, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isVisible]);

  // ⌨️ ENTERPRISE: Keyboard shortcut using centralized keyboard-shortcuts.ts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (matchesShortcut(e, 'debugLayoutMapper')) {
        e.preventDefault();
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isVisible]);

  if (!isVisible) {
    return (
      <div
        className={`${LAYOUT_MAPPER_STYLES.HINT_BADGE.CONTAINER} ${colors.text.disabled}`}
        style={{ zIndex: portalComponents.overlay.debug.info.zIndex() }}
      >
        Press Ctrl+Shift+L για Layout Debug
      </div>
    );
  }

  return (
    <>
      {/* Corner Markers */}
      {metrics.length > 0 && (
        <div
          className={LAYOUT_MAPPER_STYLES.DEBUG_OVERLAY.CONTAINER}
          style={{ zIndex: portalComponents.overlay.debug.main.zIndex() }}
        >
          {metrics.map(({ name, icon, rect, className }) =>
            rect && (
              <div
                key={name}
                className={`${LAYOUT_MAPPER_STYLES.MEASUREMENT_BOX.BASE} ${className}`}
                style={{
                  left: rect.left,
                  top: rect.top,
                  width: rect.width,
                  height: rect.height,
                  pointerEvents: 'none'
                }}
                title={name}
              >
                {/* Ετικέτα με διαστάσεις */}
                <div className={`${LAYOUT_MAPPER_STYLES.MEASUREMENT_BOX.LABEL} ${colors.text.WHITE}`}>
                  {icon}
                  <span>{name}: {Math.round(rect.width)}x{Math.round(rect.height)}</span>
                </div>

                {/* Συντεταγμένες στις γωνίες */}
                <div className={`${LAYOUT_MAPPER_STYLES.MEASUREMENT_BOX.COORD_TOP_LEFT} ${colors.text.WHITE} ${colors.bg.danger}`}>
                  ({Math.round(rect.left)},{Math.round(rect.top)})
                </div>
                <div className={`${LAYOUT_MAPPER_STYLES.MEASUREMENT_BOX.COORD_BOTTOM_RIGHT} ${colors.text.WHITE} ${colors.bg.danger}`}>
                  ({Math.round(rect.right)},{Math.round(rect.bottom)})
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Info Panel - 🎨 ENTERPRISE: bg-card centralized background */}
      <div
        className={LAYOUT_MAPPER_STYLES.INFO_PANEL.CONTAINER}
        style={{ zIndex: portalComponents.overlay.debug.controls.zIndex() }}
      >
        <div className={LAYOUT_MAPPER_STYLES.INFO_PANEL.HEADER}>
          <h3 className={`${LAYOUT_MAPPER_STYLES.INFO_PANEL.HEADER_TITLE} ${colors.text.WHITE}`}>
            <Crosshair className={iconSizes.sm} />
            <span>LAYOUT MAPPER</span>
          </h3>
          <button
            onClick={() => setIsVisible(false)}
            className={`${colors.text.RED_LIGHT} ${HOVER_TEXT_EFFECTS.RED_LIGHT} p-1`}
          >
            <X className={iconSizes.xs} />
          </button>
        </div>

        {metrics.map(({ name, icon, rect }) => (
          <div key={name} className={LAYOUT_MAPPER_STYLES.INFO_PANEL.METRIC_ITEM}>
            <span className={colors.text.info}>{icon}</span>
            <div>
              <strong className={colors.text.info}>{name}:</strong>
              {rect ? (
                <div className={LAYOUT_MAPPER_STYLES.INFO_PANEL.METRIC_DETAILS}>
                  Position: ({Math.round(rect.x)}, {Math.round(rect.y)})<br/>
                  Size: {Math.round(rect.width)} x {Math.round(rect.height)}<br/>
                  Bounds: L{Math.round(rect.left)} T{Math.round(rect.top)} R{Math.round(rect.right)} B{Math.round(rect.bottom)}
                </div>
              ) : (
                <span className={`${colors.text.danger} ${PANEL_LAYOUT.MARGIN.LEFT_SM}`}>NOT FOUND</span>
              )}
            </div>
          </div>
        ))}

        {/* 🎨 ENTERPRISE: Centered footer */}
        <div className={`${LAYOUT_MAPPER_STYLES.INFO_PANEL.FOOTER} ${getDirectionalBorder('muted', 'top')} ${colors.text.warning}`}>
          Ctrl+Shift+L: Toggle | Auto-refresh: 1s
        </div>
      </div>
    </>
  );
}
