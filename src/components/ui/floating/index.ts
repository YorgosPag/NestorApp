/**
 * 🏢 ENTERPRISE FLOATING PANEL SYSTEM - PUBLIC API
 *
 * Centralized exports για το Floating Panel compound component system.
 *
 * @module floating
 * @version 2.0.0
 */

// ============================================================================
// MAIN COMPONENT EXPORTS
// ============================================================================

export {
  FloatingPanel,
  FloatingPanelRoot,
  FloatingPanelHeader,
  FloatingPanelContent,
  FloatingPanelClose,
  FloatingPanelDragHandle,
  useFloatingPanelContext,
  // ADR-724 Φ3 — μη-πετώσα παραλλαγή, για components που ζουν και μέσα και έξω από panel.
  useFloatingPanelContextOptional
} from './FloatingPanel';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  FloatingPanelProps,
  FloatingPanelHeaderProps,
  FloatingPanelContentProps,
  FloatingPanelCloseProps,
  FloatingPanelDragHandleProps,
  FloatingPanelPosition,
  FloatingPanelDimensions,
  FloatingPanelContextValue
} from './FloatingPanel';

// ============================================================================
// ADR-723 — ΓΕΩΜΕΤΡΙΑ: κανόνας ορίων + μόνιμη θέση/μέγεθος
// ============================================================================
//
// Ο κανόνας «πού επιτρέπεται να κάθεται μια παλέτα» είναι ΕΝΑΣ και ζει στο
// `floating-panel-geometry`. Τον μοιράζονται το σύρσιμο, η αλλαγή μεγέθους και η επαναφορά
// από localStorage — ώστε να μην μπορεί μια αποθηκευμένη θέση να επαναφέρει panel εκτός οθόνης
// (το τεκμηριωμένο «palette lost off-screen» του AutoCAD).

export {
  MINIMUM_VISIBLE_HEADER,
  DEFAULT_MIN_PANEL_SIZE,
  panelDragBounds,
  clampPanelSize,
  clampPanelPosition,
  clampPanelGeometry,
  isPanelGeometryWithinBounds,
  parsePanelGeometry,
} from './floating-panel-geometry';

export type {
  PanelPosition,
  PanelSize,
  PanelGeometry,
  ViewportSize,
} from './floating-panel-geometry';

export {
  readPanelGeometry,
  writePanelGeometry,
  clearPanelGeometry,
  clearAllPanelGeometry,
} from './floating-panel-persistence';

export type { FloatingPanelId } from './floating-panel-persistence';

export { useFloatingPanelGeometry } from './useFloatingPanelGeometry';
export type {
  UseFloatingPanelGeometryOptions,
  FloatingPanelGeometryState,
} from './useFloatingPanelGeometry';

// ============================================================================
// LEGACY COMPONENT EXPORTS - REMOVED (FloatingCardHeader.tsx.OLD)
// ============================================================================
// 🗑️ FloatingCardHeader was orphan code - not used anywhere
// 🗑️ Renamed to .OLD for testing - delete if no issues
// 🗑️ Use FloatingPanel compound component instead

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export { FloatingPanel as default } from './FloatingPanel';

/**
 * 🏢 USAGE EXAMPLES:
 *
 * // Basic usage with compound components
 * import { FloatingPanel } from '@/components/ui/floating';
 *
 * <FloatingPanel defaultPosition={{ x: 100, y: 100 }} onClose={handleClose}>
 *   <FloatingPanel.Header title="My Panel" icon={<Activity />} />
 *   <FloatingPanel.Content>
 *     Content here
 *   </FloatingPanel.Content>
 * </FloatingPanel>
 *
 * // With custom dimensions
 * <FloatingPanel
 *   defaultPosition={{ x: 200, y: 150 }}
 *   dimensions={{ width: 400, height: 500 }}
 *   onClose={handleClose}
 * >
 *   ...
 * </FloatingPanel>
 */
