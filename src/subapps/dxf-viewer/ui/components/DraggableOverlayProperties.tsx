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
 * Calculate initial position on client side
 */
const getInitialPosition = () => {
  if (typeof window === 'undefined') return { x: 100, y: 100 };
  return {
    x: window.innerWidth - PANEL_DIMENSIONS.width - 30,
    y: 100
  };
};

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
      defaultPosition={getInitialPosition()}
      dimensions={PANEL_DIMENSIONS}
      onClose={onClose}
      className="w-[340px]"
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
