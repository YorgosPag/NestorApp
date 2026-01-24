'use client';
import React, { useEffect, useState, useRef } from 'react';
import { HOVER_TEXT_EFFECTS } from '@/components/ui/effects';
import { portalComponents } from '@/styles/design-tokens';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// ⌨️ ENTERPRISE: Centralized keyboard shortcuts - Single source of truth
import { matchesShortcut } from '../../config/keyboard-shortcuts';

interface ElementMetrics {
  name: string;
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
  MEASUREMENT_BOX: {
    BASE: `absolute border border-dashed ${PANEL_LAYOUT.OPACITY['60']}`,
    // ✅ ENTERPRISE: Label styled at runtime with colors.text.WHITE and bg-black
    LABEL: `absolute ${PANEL_LAYOUT.POSITION.NEGATIVE_TOP_6} ${PANEL_LAYOUT.POSITION.LEFT_0} ${PANEL_LAYOUT.TYPOGRAPHY.XS} font-mono bg-black ${PANEL_LAYOUT.SPACING.HORIZONTAL_XS} ${PANEL_LAYOUT.INPUT.BORDER_RADIUS} whitespace-nowrap`,
    // ✅ ENTERPRISE: Coordinate badges styled at runtime with colors.text.WHITE
    COORD_TOP_LEFT: `absolute ${PANEL_LAYOUT.POSITION.TOP_0} ${PANEL_LAYOUT.POSITION.LEFT_0} ${PANEL_LAYOUT.TYPOGRAPHY.XS} font-mono ${PANEL_LAYOUT.SPACING.HORIZONTAL_XS}`,
    COORD_BOTTOM_RIGHT: `absolute ${PANEL_LAYOUT.POSITION.BOTTOM_0} ${PANEL_LAYOUT.POSITION.RIGHT_0} ${PANEL_LAYOUT.TYPOGRAPHY.XS} font-mono ${PANEL_LAYOUT.SPACING.HORIZONTAL_XS}`,
  },

  // Info panel (right side)
  INFO_PANEL: {
    CONTAINER: `fixed ${PANEL_LAYOUT.POSITION.TOP_20} ${PANEL_LAYOUT.POSITION.RIGHT_4} ${PANEL_LAYOUT.SPACING.LG} ${PANEL_LAYOUT.INPUT.BORDER_RADIUS} ${PANEL_LAYOUT.TYPOGRAPHY.XS} font-mono max-w-md`,
    HEADER: `flex justify-between items-center ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`,
    // ✅ ENTERPRISE: Header title uses font-bold, color applied via colors.text.WHITE runtime
    HEADER_TITLE: PANEL_LAYOUT.FONT_WEIGHT.BOLD,
    METRIC_ITEM: PANEL_LAYOUT.MARGIN.BOTTOM_XS,
    METRIC_DETAILS: `${PANEL_LAYOUT.MARGIN.LEFT_HALF} ${PANEL_LAYOUT.MARGIN.LEFT_SM} ${PANEL_LAYOUT.TYPOGRAPHY.XS}`,
    FOOTER: `${PANEL_LAYOUT.MARGIN.TOP_LG} ${PANEL_LAYOUT.PADDING.TOP_SM}`,
  },
} as const;

export default function LayoutMapper() {
  const [metrics, setMetrics] = useState<ElementMetrics[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout>();
  const { getStatusBorder, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();

  const measureElements = () => {
    // ✅ ENTERPRISE: All debug colors via centralized COLOR_BRIDGE tokens
    const elementsToMeasure = [
      // Core UI Elements
      { name: '🔧 Central Toolbar', selector: '[class*="toolbar"], .toolbar-container', className: colors.bg.debugBlue },
      { name: '📏 Horizontal Ruler', selector: '.horizontal-ruler, [class*="horizontal-ruler"]', className: colors.bg.debugYellow },
      { name: '📐 Vertical Ruler', selector: '.vertical-ruler, [class*="vertical-ruler"]', className: colors.bg.debugYellow },

      // Canvas Elements
      { name: '🎨 DXF Canvas', selector: '.dxf-canvas, canvas[class*="dxf"]', className: colors.bg.debugGreen },
      { name: '🎭 Layer Canvas', selector: '.layer-canvas, canvas[class*="layer"]', className: colors.bg.debugPurple },
      { name: '⭕ Crosshair Canvas', selector: 'canvas[class*="crosshair"]', className: colors.bg.debugRed },

      // Container Elements
      { name: '📦 Canvas Section', selector: '[class*="canvas-section"], [class*="CanvasSection"]', className: colors.bg.debugOrange },
      { name: '🏠 Canvas Container', selector: '[class*="canvas-container"], [class*="CanvasContainer"]', className: colors.bg.debugPink },
      { name: '🖼️ Main Layout', selector: '[class*="dxf-layout"], [class*="DxfLayout"]', className: colors.bg.debugIndigo },

      // Status & UI Elements
      { name: '📊 Status Bar', selector: '[class*="status"], [class*="StatusBar"]', className: colors.bg.hover },
      { name: '🎛️ Control Panel', selector: '[class*="control"], [class*="panel"]', className: colors.bg.debugTeal }
    ];

    const newMetrics: ElementMetrics[] = elementsToMeasure.map(({ name, selector, className }) => {
      const element = document.querySelector(selector) as HTMLElement;
      const rect = element?.getBoundingClientRect() || null;

      return {
        name,
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
      intervalRef.current = setInterval(measureElements, 1000); // Μέτρηση κάθε δευτερόλεπτο
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
          {metrics.map(({ name, rect, className }) =>
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
                  {name}: {Math.round(rect.width)}x{Math.round(rect.height)}
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

      {/* Info Panel */}
      <div
        className={`${LAYOUT_MAPPER_STYLES.INFO_PANEL.CONTAINER} ${colors.bg.overlay} ${colors.text.success}`}
        style={{ zIndex: portalComponents.overlay.debug.controls.zIndex() }}
      >
        <div className={LAYOUT_MAPPER_STYLES.INFO_PANEL.HEADER}>
          <h3 className={`${LAYOUT_MAPPER_STYLES.INFO_PANEL.HEADER_TITLE} ${colors.text.WHITE}`}>🎯 LAYOUT MAPPER</h3>
          <button
            onClick={() => setIsVisible(false)}
            className={`${colors.text.RED_LIGHT} ${HOVER_TEXT_EFFECTS.RED_LIGHT}`}
          >
            x
          </button>
        </div>

        {metrics.map(({ name, rect }) => (
          <div key={name} className={LAYOUT_MAPPER_STYLES.INFO_PANEL.METRIC_ITEM}>
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
        ))}

        <div className={`${LAYOUT_MAPPER_STYLES.INFO_PANEL.FOOTER} ${getDirectionalBorder('muted', 'top')} ${colors.text.warning}`}>
          Ctrl+Shift+L: Toggle | Auto-refresh: 1s
        </div>
      </div>
    </>
  );
}
