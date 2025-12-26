/**
 * 🎯 CONTROL POINT LAYER - ENTERPRISE COMPONENT
 *
 * Professional control point rendering για interactive map coordinate picking.
 * Handles visual states, interactions και polygon completion logic.
 *
 * ✅ Enterprise Standards:
 * - TypeScript strict typing
 * - React memo optimization
 * - Design token integration
 * - Accessibility support
 * - Professional interaction patterns
 *
 * @module ControlPointLayer
 */

import React, { memo } from 'react';
import { Marker } from 'react-map-gl/maplibre';
import type { GeoControlPoint } from '../../types';
import { mapControlPointTokens } from '@/styles/design-tokens';
import { interactiveMapStyles } from '../InteractiveMap.styles';

// ============================================================================
// 🎯 ENTERPRISE TYPE DEFINITIONS
// ============================================================================

export interface ControlPointLayerProps {
  /** Control points to render */
  controlPoints: GeoControlPoint[];
  /** Whether to show control points */
  showControlPoints?: boolean;
  /** Whether map is loaded */
  mapLoaded?: boolean;
  /** Whether polygon is complete */
  isPolygonComplete?: boolean;
  /** Currently selected point ID */
  selectedPointId?: string;
  /** Legacy polygon closure handler */
  onLegacyPolygonClosure?: () => void;
}

// ============================================================================
// 🎯 CONTROL POINT LAYER COMPONENT
// ============================================================================

/**
 * Enterprise control point layer με professional interaction patterns
 */
export const ControlPointLayer: React.FC<ControlPointLayerProps> = memo(({
  controlPoints = [],
  showControlPoints = true,
  mapLoaded = false,
  isPolygonComplete = false,
  selectedPointId,
  onLegacyPolygonClosure
}) => {
  // Early return για performance optimization
  if (!showControlPoints || !mapLoaded || controlPoints.length === 0) {
    return null;
  }

  const isFirstPointSpecial = controlPoints.length >= 3; // Highlight first point when 3+ points

  return (
    <>
      {controlPoints.map((cp, index) => {
        const isFirstPoint = index === 0;
        const shouldHighlightFirst = isFirstPointSpecial && isFirstPoint && !isPolygonComplete;

        return (
          <Marker
            key={cp.id}
            longitude={cp.geo.lng}
            latitude={cp.geo.lat}
          >
            <div
              className={`rounded-full border transition-all relative z-50 ${
                mapControlPointTokens.getControlPointStyle(
                  selectedPointId === cp.id, // isActive
                  shouldHighlightFirst,       // shouldHighlight
                  isPolygonComplete           // isCompleted
                ).classes
              }`}
              style={interactiveMapStyles.controlPoints.interaction(
                selectedPointId === cp.id,
                shouldHighlightFirst,
                isPolygonComplete
              )}
              title={
                isPolygonComplete
                  ? `${cp.id} - ✅ ΚΛΕΙΣΤΟ Πολύγωνο (±${cp.accuracy}m)`
                  : shouldHighlightFirst
                  ? `${cp.id} - 🔄 Κάντε κλικ για ΚΛΕΙΣΙΜΟ πολυγώνου (±${cp.accuracy}m)`
                  : `${cp.id} (±${cp.accuracy}m)`
              }
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();

                if (isPolygonComplete) {
                  return;
                }

                if (shouldHighlightFirst && onLegacyPolygonClosure) {
                  onLegacyPolygonClosure();
                }
              }}
              // ✅ ACCESSIBILITY: Keyboard support
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (!isPolygonComplete && shouldHighlightFirst && onLegacyPolygonClosure) {
                    onLegacyPolygonClosure();
                  }
                }
              }}
              // ✅ ACCESSIBILITY: Make focusable
              tabIndex={shouldHighlightFirst ? 0 : -1}
              role="button"
              aria-label={
                isPolygonComplete
                  ? `Control point ${cp.id}, polygon completed, accuracy ${cp.accuracy} meters`
                  : shouldHighlightFirst
                  ? `Control point ${cp.id}, click to close polygon, accuracy ${cp.accuracy} meters`
                  : `Control point ${cp.id}, accuracy ${cp.accuracy} meters`
              }
            />
          </Marker>
        );
      })}
    </>
  );
});

ControlPointLayer.displayName = 'ControlPointLayer';

/**
 * ✅ ENTERPRISE CONTROL POINT LAYER COMPLETE (2025-12-17)
 *
 * Features Implemented:
 * ✅ TypeScript strict typing με enterprise interfaces
 * ✅ React memo optimization για performance
 * ✅ Professional interaction patterns
 * ✅ Design token integration με mapControlPointTokens
 * ✅ Accessibility support (keyboard, ARIA, focus management)
 * ✅ Conditional rendering για different states
 * ✅ Visual state management (highlighting, completion)
 * ✅ Professional error prevention (stopPropagation)
 * ✅ Clean props interface με clear responsibilities
 *
 * Extracted από InteractiveMap.tsx:
 * 🔥 renderControlPoints function (lines 796-848)
 * 🔥 Control point rendering logic
 * 🔥 Visual state management
 * 🔥 Interaction handling
 *
 * Enterprise Benefits:
 * 🎯 Single Responsibility - Μόνο control point rendering
 * 🔄 Reusability - Μπορεί να χρησιμοποιηθεί σε άλλα contexts
 * 🧪 Testability - Isolated component με clear props
 * ⚡ Performance - React memo optimization
 * ♿ Accessibility - Full keyboard και screen reader support
 * 🎨 Consistency - Design token integration
 */