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
  useFloatingPanelContext
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
  FloatingPanelDimensions
} from './FloatingPanel';

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
