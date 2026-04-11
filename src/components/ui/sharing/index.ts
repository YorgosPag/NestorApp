/**
 * =============================================================================
 * 🏢 ENTERPRISE: Unified Share Surface — Barrel Export
 * =============================================================================
 *
 * Public surface of the sharing primitive layer.
 *
 * @module components/ui/sharing
 * @see ADR-147 Unified Share Surface
 */

export { ShareSurfaceShell } from './ShareSurfaceShell';
export { ShareStatusBanner } from './ShareStatusBanner';
export type { ShareStatusBannerProps } from './ShareStatusBanner';
export { useShareFlow } from './useShareFlow';

export type {
  PermissionPanelProps,
  ShareableEntity,
  ShareDraftUpdater,
  ShareFlowHandle,
  ShareFlowOptions,
  ShareFlowState,
  ShareFlowStatus,
  SharePermissionModel,
  ShareSurfaceLabels,
  ShareSurfaceShellProps,
} from '@/types/sharing';
