/**
 * COORDINATE CALIBRATION OVERLAY
 * ✅ ΦΑΣΗ 7: Χρήση κεντρικού CoordinateTransforms - SINGLE SOURCE OF TRUTH
 * Εργαλείο debugging για έλεγχο ακρίβειας coordinate transformations
 */

'use client';
import React, { useState, useRef } from 'react';
import { Lightbulb } from 'lucide-react';
import { CoordinateTransforms } from '../rendering/core/CoordinateTransforms';
import type { Point2D, Viewport } from '../rendering/types/Types';
import type { SceneModel } from '../types/scene';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { portalComponents, layoutUtilities } from '@/styles/design-tokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/hooks/useSemanticColors';  // ✅ ENTERPRISE: Background centralization - ZERO DUPLICATES
import { PANEL_LAYOUT } from '../config/panel-tokens';  // ✅ ENTERPRISE: Centralized spacing tokens
import {
  getCalibrationOverlayContainerStyles,
  getCalibrationDebugPanelStyles,
  getCalibrationTestMarkerStyles,
  getCalibrationTooltipStyles
} from './DxfViewerComponents.styles';

interface CoordinateCalibrationOverlayProps {
  mousePos: Point2D | null;
  worldPos: Point2D | null;
  canvasRect?: DOMRect;
  currentScene?: SceneModel;
  show?: boolean;
  onToggle?: (show: boolean) => void;
}

interface ClickTest {
  id: number;
  cssPoint: Point2D;
  worldPoint: Point2D;
  roundTripError: number;
  timestamp: string;
}

export default function CoordinateCalibrationOverlay({
  mousePos,
  worldPos,
  canvasRect,
  currentScene,
  show = false,
  onToggle
}: CoordinateCalibrationOverlayProps) {
  const iconSizes = useIconSizes();
  const { getElementBorder, quick } = useBorderTokens();
  const colors = useSemanticColors();  // ✅ ENTERPRISE: Background centralization - ZERO DUPLICATES
  const [clickTests, setClickTests] = useState<ClickTest[]>([]);
  const [showDetails, setShowDetails] = useState(true);
  const clickIdRef = useRef(0);

  if (!show) return null;

  // Scene info
  const entitiesCount = currentScene?.entities?.length ?? 0;
  const layersCount = currentScene?.layers ? Object.keys(currentScene.layers).length : 0;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  // ✅ Χρήση κεντρικού CoordinateTransforms για round-trip test
  const calculateRoundTripError = (cssPoint: Point2D): number => {
    if (!canvasRect) return -1;

    const viewport: Viewport = { width: canvasRect.width, height: canvasRect.height };

    // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση CoordinateTransforms
    const worldPt = CoordinateTransforms.screenToWorld(cssPoint, { scale: 1, offsetX: 0, offsetY: 0 }, viewport);
    const backToCss = CoordinateTransforms.worldToScreen(worldPt, { scale: 1, offsetX: 0, offsetY: 0 }, viewport);

    const deltaX = cssPoint.x - backToCss.x;
    const deltaY = cssPoint.y - backToCss.y;
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  };

  // Handle calibration click test
  const handleCalibrationClick = (e: React.MouseEvent) => {
    if (!canvasRect) return;

    const cssPoint = { x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top };
    const viewport: Viewport = { width: canvasRect.width, height: canvasRect.height };

    // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση CoordinateTransforms
    const worldPoint = CoordinateTransforms.screenToWorld(cssPoint, { scale: 1, offsetX: 0, offsetY: 0 }, viewport);
    const roundTripError = calculateRoundTripError(cssPoint);

    const newTest: ClickTest = {
      id: ++clickIdRef.current,
      cssPoint,
      worldPoint,
      roundTripError,
      timestamp: new Date().toLocaleTimeString()
    };

    setClickTests(prev => [...prev, newTest]);
  };

  // Current mouse round-trip error
  const currentRoundTripError = mousePos ? calculateRoundTripError(mousePos) : null;

  return (
    <div style={getCalibrationOverlayContainerStyles(portalComponents.overlay.calibration.zIndex())}>
      <div style={getCalibrationDebugPanelStyles()}>
        <header className={`flex justify-between items-center ${PANEL_LAYOUT.MARGIN.BOTTOM_MD}`}>
          <h3 className={`${PANEL_LAYOUT.TYPOGRAPHY.LG} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD} ${colors.text.cyanAccent}`}>🔧 Καλιμπράρισμα Συντεταγμένων</h3>
          <button onClick={() => onToggle?.(false)} className={`${colors.text.muted} ${INTERACTIVE_PATTERNS.TEXT_HOVER} ${PANEL_LAYOUT.TYPOGRAPHY.XL}`} title="Κλείσιμο">×</button>
        </header>
        <section className={PANEL_LAYOUT.SPACING.GAP_MD}>
          {/* ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση CoordinateTransforms */}
          <article className={`${colors.bg.info} ${PANEL_LAYOUT.SPACING.SM} rounded ${PANEL_LAYOUT.TYPOGRAPHY.XS}`}>
            <p className={`${colors.text.infoLight} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${PANEL_LAYOUT.MARGIN.BOTTOM_XS}`}>✅ Coordinate System:</p>
            <p className={colors.text.infoLighter}>Using centralized <strong>CoordinateTransforms</strong></p>
            <p className={`${colors.text.successLight} ${PANEL_LAYOUT.TYPOGRAPHY.XS}`}>Single Source of Truth ✅</p>
          </article>

          <article className={`${colors.bg.secondary} ${PANEL_LAYOUT.SPACING.MD} rounded ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>
            <p className={`${colors.text.cyanLight} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>📊 Κατάσταση Σκηνής:</p>
            <div className="flex justify-between items-center">
              <span>
                <span className={`inline-block ${iconSizes.xs} ${quick.button} ${PANEL_LAYOUT.MARGIN.RIGHT_SM} ${entitiesCount > 0 ? `${colors.bg.success}` : `${colors.bg.error}`}`}></span>
                <span className={`${colors.text.primary}`}>Οντότητες: {entitiesCount}</span>
              </span>
              <span className={`${colors.text.muted}`}>Επίπεδα: {layersCount}</span>
            </div>
            {entitiesCount === 0 && <p className={`${colors.text.errorLight} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>⚠️ Δεν υπάρχουν οντότητες</p>}
          </article>

          <nav className={`flex ${PANEL_LAYOUT.GAP.SM}`}>
            <button onClick={() => setShowDetails(!showDetails)} className={`${PANEL_LAYOUT.SPACING.COMPACT} rounded ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${showDetails ? colors.bg.hover : colors.bg.active}`}>
              {showDetails ? '📊 Απόκρυψη' : '📊 Εμφάνιση'}
            </button>
          </nav>

          {showDetails && (
            <article className={`${colors.bg.secondary} ${PANEL_LAYOUT.SPACING.MD} rounded ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>
              <p className={`${colors.text.cyanLight} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>📍 Συντεταγμένες:</p>
              {mousePos ? (
                <>
                  <p className={colors.text.successLight}>🖱️ CSS: ({mousePos.x.toFixed(1)}, {mousePos.y.toFixed(1)})</p>
                  {worldPos && <p className={colors.text.warningLight}>🌍 Κόσμος: ({worldPos.x.toFixed(2)}, {worldPos.y.toFixed(2)})</p>}
                  {currentRoundTripError !== null && (
                    <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.MARGIN.TOP_XS} ${currentRoundTripError < 0.5 ? colors.text.successLighter : colors.text.orangeLight}`}>
                      🔄 Σφάλμα round-trip: {currentRoundTripError.toFixed(2)}px {currentRoundTripError < 0.5 ? '✅' : '⚠️'}
                    </p>
                  )}
                  <p className={`${colors.text.muted} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>dPR: {dpr.toFixed(2)} | Ζουμ: {(100/dpr).toFixed(0)}%</p>
                </>
              ) : <p className={colors.text.muted}>Μετακινήστε το ποντίκι πάνω από τον καμβά...</p>}
            </article>
          )}

          <article className={`${colors.bg.secondary} ${PANEL_LAYOUT.SPACING.MD} rounded ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>
            <div className={`flex justify-between items-center ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>
              <span className={`${colors.text.cyanLight} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD}`}>🎯 Τεστ Κλικ:</span>
              <button onClick={() => setClickTests([])} className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${colors.bg.error} ${INTERACTIVE_PATTERNS.BUTTON_DESTRUCTIVE_HOVER} ${PANEL_LAYOUT.BUTTON.PADDING_COMPACT} rounded`}>Καθαρισμός</button>
            </div>
            <div className={`${PANEL_LAYOUT.SPACING.SM} ${quick.input} cursor-crosshair pointer-events-auto ${getElementBorder('input', 'focus')}`} onClick={handleCalibrationClick}>
              <div className={`text-center ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.cyanLight} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>Κλικ εδώ για τεστ ακρίβειας</div>
              <div className={`${PANEL_LAYOUT.MAX_HEIGHT.XS} overflow-y-auto ${PANEL_LAYOUT.SPACING.GAP_XS}`}>
                {clickTests.length === 0 ? (
                  <div className={`${colors.text.muted} ${PANEL_LAYOUT.TYPOGRAPHY.XS} text-center`}>Δεν υπάρχουν δοκιμές</div>
                ) : (
                  clickTests.slice(-2).map(test => (
                    <div key={test.id} className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${getElementBorder('card', 'default')} ${quick.card} ${PANEL_LAYOUT.SPACING.HORIZONTAL_SM}`}>
                      <div className={`${colors.text.primary}`}>#{test.id} @ {test.timestamp}</div>
                      <div className={colors.text.successLight}>CSS: ({test.cssPoint.x.toFixed(1)}, {test.cssPoint.y.toFixed(1)})</div>
                      <div className={colors.text.warningLight}>Κόσμος: ({test.worldPoint.x.toFixed(2)}, {test.worldPoint.y.toFixed(2)})</div>
                      <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${test.roundTripError < 0.5 ? colors.text.successLighter : colors.text.orangeLight}`}>
                        Error: {test.roundTripError.toFixed(2)}px {test.roundTripError < 0.5 ? 'ΤΕΛΕΙΟ ✅' : 'ΧΡΕΙΑΖΕΤΑΙ ΔΙΟΡΘΩΣΗ ⚠️'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </article>

          <aside className={`${colors.bg.info} ${PANEL_LAYOUT.SPACING.SM} rounded ${PANEL_LAYOUT.TYPOGRAPHY.XS}`}>
            <div className={`${colors.text.infoLight} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${PANEL_LAYOUT.MARGIN.BOTTOM_XS} flex items-center ${PANEL_LAYOUT.GAP.XS}`}><Lightbulb className={iconSizes.xs} /> Συμβουλές:</div>
            <ul className={`${colors.text.infoLighter} ${PANEL_LAYOUT.SPACING.GAP_XS}`}>
              <li>• Round-trip σφάλμα &lt; 0.5px</li>
              <li>• Δοκιμάστε σε διαφορετικά zoom</li>
              <li>• {entitiesCount > 0 ? 'Οντότητες OK ✅' : 'Φορτώστε DXF ⚠️'}</li>
              <li>• Χρήση κεντρικού CoordinateTransforms ✅</li>
            </ul>
          </aside>
        </section>
      </div>
      {clickTests.slice(-3).map(test => (
        <div
          key={test.id}
          style={getCalibrationTestMarkerStyles(
            test.cssPoint.x,
            test.cssPoint.y,
            test.roundTripError < 0.5
          )}
        >
          <div style={getCalibrationTooltipStyles()}>
            #{test.id}
          </div>
        </div>
      ))}
      <style jsx>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
