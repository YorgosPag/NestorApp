/**
 * 🖱️ useDraggable Hook - Enterprise Centralized System
 *
 * @description Centralized draggable functionality για όλη την εφαρμογή
 * @version 1.0.0 - Enterprise Foundation
 * @source Generalized από useDraggableModal.ts (A+ rated, 64 lines)
 * @migration Zero-risk migration από DXF Viewer tests modal
 *
 * 🏆 ENTERPRISE FEATURES:
 * - Auto-centering/positioning capability
 * - Button/input exclusion (smart interaction handling)
 * - Viewport bounds constraint
 * - TypeScript full support
 * - Memory-efficient event handling
 * - Clean API design
 *
 * 🎯 CENTRALIZATION TARGET:
 * - Replaces: DraggableOverlayProperties custom logic (40 lines)
 * - Replaces: DraggableOverlayToolbar custom logic (30 lines)
 * - Supports: Performance Monitor draggable functionality
 * - Future: Touch support, grid snapping, multi-drag
 */

import { useState, useEffect, useRef } from 'react';

// ============================================================================
// TYPES & INTERFACES - Enterprise TypeScript Standards
// ============================================================================

/** Position coordinates interface */
export interface Position {
  x: number;
  y: number;
}

/** Draggable configuration options */
export interface DraggableOptions {
  /** Initial position - if not provided, uses auto-centering */
  initialPosition?: Position;
  /** Enable auto-centering on first use */
  autoCenter?: boolean;
  /** Container element for bounds calculation */
  container?: HTMLElement | null;
  /** Minimum position constraints */
  minPosition?: Position;
  /** Maximum position constraints */
  maxPosition?: Position;
  /** Element width for bounds calculation */
  elementWidth?: number;
  /** Element height for bounds calculation */
  elementHeight?: number;
  /** Disable dragging */
  disabled?: boolean;
  /**
   * 🏢 ENTERPRISE: Client-side position calculator
   * Called ONLY after mount on client side to get the correct position
   * Solves SSR hydration issues where window is undefined during SSR
   */
  getClientPosition?: () => Position;
}

/** Hook return interface */
export interface DraggableState {
  /** Current position */
  position: Position;
  /** Is currently being dragged */
  isDragging: boolean;
  /** DOM reference for the draggable element */
  elementRef: React.RefObject<HTMLDivElement>;
  /** Mouse down handler to initiate drag */
  handleMouseDown: (e: React.MouseEvent) => void;
  /** Set position programmatically */
  setPosition: (position: Position) => void;
}

// ============================================================================
// ENTERPRISE CONSTANTS - No Hard Values
// ============================================================================

/** Default element dimensions for bounds calculation */
const DEFAULT_ELEMENT_SIZE = {
  width: 320,
  height: 400
} as const;

/** Default auto-center offset from top */
const DEFAULT_AUTO_CENTER_TOP_OFFSET = 50;

// ============================================================================
// MAIN HOOK - Enterprise Implementation
// ============================================================================

/**
 * Enterprise draggable hook
 *
 * @param isVisible - Visibility state for auto-centering logic
 * @param options - Configuration options
 * @returns DraggableState interface
 */
export function useDraggable(
  isVisible: boolean = true,
  options: DraggableOptions = {}
): DraggableState {

  // Destructure options with defaults
  const {
    initialPosition,
    autoCenter = true,
    container = null,
    minPosition = { x: 0, y: 0 },
    maxPosition,
    elementWidth = DEFAULT_ELEMENT_SIZE.width,
    elementHeight = DEFAULT_ELEMENT_SIZE.height,
    disabled = false,
    getClientPosition
  } = options;

  // ========================================================================
  // STATE MANAGEMENT - Enterprise State Design
  // ========================================================================

  const [position, setPosition] = useState<Position>(
    initialPosition || { x: 0, y: 0 }
  );
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });
  const elementRef = useRef<HTMLDivElement>(null);

  // ========================================================================
  // 🏢 ENTERPRISE: CLIENT-SIDE POSITION CALCULATION
  // Solves SSR hydration issues - calculates position AFTER mount
  // ========================================================================

  const [hasCalculatedClientPosition, setHasCalculatedClientPosition] = useState(false);

  useEffect(() => {
    // Only run once after mount, and only if getClientPosition is provided
    if (getClientPosition && !hasCalculatedClientPosition && typeof window !== 'undefined') {
      const clientPosition = getClientPosition();
      setPosition(clientPosition);
      setHasCalculatedClientPosition(true);
    }
  }, [getClientPosition, hasCalculatedClientPosition]);

  // ========================================================================
  // AUTO-CENTERING LOGIC - Enterprise UX
  // ========================================================================

  useEffect(() => {
    // Skip auto-centering if client position was calculated
    if (hasCalculatedClientPosition) return;

    if (
      isVisible &&
      autoCenter &&
      position.x === 0 &&
      position.y === 0 &&
      !initialPosition
    ) {
      const viewport = container || window;
      const viewportWidth = container?.clientWidth || (viewport as Window).innerWidth;
      const viewportHeight = container?.clientHeight || (viewport as Window).innerHeight;

      const centerX = Math.max(0, (viewportWidth - elementWidth) / 2);
      const centerY = DEFAULT_AUTO_CENTER_TOP_OFFSET;

      setPosition({ x: centerX, y: centerY });
    }
  }, [
    isVisible,
    autoCenter,
    position.x,
    position.y,
    initialPosition,
    container,
    elementWidth,
    elementHeight,
    hasCalculatedClientPosition
  ]);

  // ========================================================================
  // DRAG HANDLERS - Enterprise Event Management
  // ========================================================================

  /**
   * Initialize drag operation with smart exclusions
   * ADR-176: Migrated from mouse to pointer events for touch support
   */
  const handleMouseDown = (e: React.PointerEvent | React.MouseEvent) => {
    if (disabled) return;

    const target = e.target as HTMLElement;

    // ENTERPRISE FIX: Allow drag from dedicated drag handles even if they're inside buttons
    const isDragHandle = target.closest('[data-drag-handle="true"], .cursor-grab');

    if (!isDragHandle) {
      // Enterprise Feature: Smart interaction exclusion
      const isInteractiveElement = target.closest(
        'button, input, select, textarea, a, [role="button"]'
      );

      if (isInteractiveElement) {
        return;
      }
    }

    // Prevent text selection during drag
    e.preventDefault();

    // ADR-176: Capture pointer for reliable tracking across element boundaries
    if ('pointerId' in e) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }

    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  /** Calculate viewport bounds constraints */
  const calculateBounds = (newX: number, newY: number): Position => {
    const viewport = container || window;
    const viewportWidth = container?.clientWidth || (viewport as Window).innerWidth;
    const viewportHeight = container?.clientHeight || (viewport as Window).innerHeight;

    // Calculate maximum position based on viewport and element size
    const maxX = maxPosition?.x ?? Math.max(0, viewportWidth - elementWidth);
    const maxY = maxPosition?.y ?? Math.max(0, viewportHeight - elementHeight);

    return {
      x: Math.max(minPosition.x, Math.min(newX, maxX)),
      y: Math.max(minPosition.y, Math.min(newY, maxY))
    };
  };

  // ========================================================================
  // MOUSE MOVE & UP HANDLERS - Enterprise Performance
  // ========================================================================

  useEffect(() => {
    if (!isDragging) return;

    /** ADR-176: Handle pointer move during drag (touch + mouse) */
    const handlePointerMove = (e: PointerEvent) => {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;

      const constrainedPosition = calculateBounds(newX, newY);
      setPosition(constrainedPosition);
    };

    /** ADR-176: Handle pointer up to end drag */
    const handlePointerUp = (e: PointerEvent) => {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      setIsDragging(false);
    };

    // Enterprise Event Management: Pointer events for touch + mouse
    document.addEventListener('pointermove', handlePointerMove, { passive: false });
    document.addEventListener('pointerup', handlePointerUp, { once: true });

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, dragStart, minPosition, maxPosition, elementWidth, elementHeight, container]);

  // ========================================================================
  // PUBLIC API - Enterprise Interface
  // ========================================================================

  return {
    position,
    isDragging,
    elementRef,
    handleMouseDown,
    setPosition: (newPosition: Position) => {
      const constrainedPosition = calculateBounds(newPosition.x, newPosition.y);
      setPosition(constrainedPosition);
    }
  };
}

// ============================================================================
// EXPORTS - Enterprise Module System
// ============================================================================

export default useDraggable;