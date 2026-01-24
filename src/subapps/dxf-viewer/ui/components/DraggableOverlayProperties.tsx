'use client';

/**
 * 🏢 DRAGGABLE OVERLAY PROPERTIES PANEL
 *
 * Floating panel για overlay properties editing.
 * Χρησιμοποιεί το κεντρικοποιημένο FloatingPanel compound component.
 *
 * @version 3.0.0 - Enterprise FloatingPanel Integration
 * @since 2025-01-02
 */

import React from 'react';
import { Activity } from 'lucide-react';
import { FloatingPanel } from '@/components/ui/floating';
import { OverlayProperties } from '../OverlayProperties';
import type { Overlay, UpdateOverlayData } from '../../overlays/types';
// 🏢 ENTERPRISE: Centralized tokens + Panel Anchoring System (ADR-029)
import { PANEL_LAYOUT, PanelPositionCalculator } from '../../config/panel-tokens';

// ============================================================================
// TYPES - Enterprise TypeScript Standards (ZERO any)
// ============================================================================

interface DraggableOverlayPropertiesProps {
  overlay: Overlay;
  onUpdate: (overlayId: string, updates: UpdateOverlayData) => void;
  onClose: () => void;
}

// ============================================================================
// CONSTANTS - Enterprise Design Tokens
// ============================================================================

const PANEL_DIMENSIONS = {
  width: 340,
  height: 500
} as const;

/**
 * 🏢 ENTERPRISE: Client-side position calculator
 * Position at BOTTOM-RIGHT corner of screen
 * 🎯 CRITICAL: The BOTTOM of the panel must align with the app's status bar (not go below it)
 *
 * NOTE: This function is passed to useDraggable via getClientPosition
 * and is called ONLY after mount on client side (solves SSR hydration issues)
 */
/**
 * 🏢 ENTERPRISE: Panel Position Calculator (ADR-029)
 * Uses centralized PanelPositionCalculator for consistent, DOM-based positioning
 * Anchor: BOTTOM-RIGHT (panel bottom aligns with status bar top)
 */
const getClientPosition = () => {
  return PanelPositionCalculator.getBottomRightPosition(
    PANEL_DIMENSIONS.width,
    PANEL_DIMENSIONS.height
  );
};

// 🏢 ENTERPRISE: SSR-safe fallback position (used only during initial render)
const SSR_FALLBACK_POSITION = { x: 100, y: 100 };

// ============================================================================
// COMPONENT - Enterprise FloatingPanel Pattern
// ============================================================================

/**
 * 🏢 DraggableOverlayProperties Component
 *
 * Uses centralized FloatingPanel compound component for consistent
 * behavior across all floating panels in the application.
 */
export const DraggableOverlayProperties: React.FC<DraggableOverlayPropertiesProps> = ({
  overlay,
  onUpdate,
  onClose
}) => {
  return (
    <FloatingPanel
      defaultPosition={SSR_FALLBACK_POSITION}
      dimensions={PANEL_DIMENSIONS}
      onClose={onClose}
      className={PANEL_LAYOUT.LAYOUT_DIMENSIONS.PANEL_WIDTH_MD}
      draggableOptions={{
        getClientPosition  // 🏢 ENTERPRISE: Client-side position calculation
      }}
    >
      <FloatingPanel.Header
        title="Overlay Properties"
        icon={<Activity />}
      />
      <FloatingPanel.Content>
        <OverlayProperties
          overlay={overlay}
          onUpdate={onUpdate}
          onClose={onClose}
        />
      </FloatingPanel.Content>
    </FloatingPanel>
  );
};

export default DraggableOverlayProperties;

/**
 * 🏢 ENTERPRISE COMPLIANCE:
 *
 * ✅ Uses centralized FloatingPanel compound component
 * ✅ Zero duplicate draggable logic
 * ✅ Zero inline styles
 * ✅ Proper TypeScript types (no any)
 * ✅ Consistent with other floating panels
 * ✅ ~80 lines reduced to ~50 lines
 */
