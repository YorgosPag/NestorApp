'use client';

/**
 * 🏢 ENTERPRISE: CanvasLayerStack Transform Bridge — ADR-040 Phase XXII.A
 *
 * Thin subscriber wrapper that decouples CanvasSection (orchestrator) from the
 * wheel-zoom re-render cascade. CanvasSection no longer subscribes to the
 * transform store; this bridge does, and passes the live transform down to
 * CanvasLayerStack (shell).
 *
 * Architectural rationale:
 * - CanvasSection used to consume the merged `useCanvasContext()`, which forced
 *   it to re-render on every wheel notch. That cascaded through 15+ child hooks,
 *   each with their own deps, closures, and effects. Profile showed ~77% time
 *   spent in `flushSyncWorkOnAllRoots` during zoom.
 * - Phase XXII.A switches CanvasSection to `useCanvasRefs()` (stable) and reads
 *   transform via `getImmediateTransform()` at event time. Hooks read from the
 *   SSoT at event time too — no React reactivity needed for them.
 * - The remaining consumers that genuinely need React reactivity to transform
 *   are the visual layers below CanvasLayerStack (crosshair, snap indicators,
 *   grip overlays, preview, etc.). Those need fresh transform per frame.
 * - This bridge is the single subscription point. Pre-commit CHECK 6C bans
 *   `useSyncExternalStore` in CanvasSection.tsx and CanvasLayerStack.tsx
 *   directly; this wrapper sits between them and is allowed to subscribe.
 *
 * Phase XXII.B will push subscriptions further down into individual leaves
 * (e.g., crosshair, snap-indicator, grip overlay) so even CanvasLayerStack
 * stops re-rendering on wheel. For now this is the minimum-risk fix that
 * preserves all visual behavior while eliminating the 15-hook cascade.
 *
 * @see ADR-040 Phase XXII.A
 * @see CanvasSection.tsx — `useCanvasRefs()` migration
 */

import React from 'react';
import { useTransformValue } from '../../systems/cursor/ImmediateTransformStore';
import { CanvasLayerStack } from './CanvasLayerStack';
import type { CanvasLayerStackProps } from './canvas-layer-stack-types';

export const CanvasLayerStackTransformBridge: React.FC<Omit<CanvasLayerStackProps, 'transform'>> = (props) => {
  // ADR-040 Phase XXII.A: sole transform subscriber on the CanvasSection→CanvasLayerStack
  // path. Re-renders on wheel; CanvasSection (parent) stays inert.
  const transform = useTransformValue();
  return <CanvasLayerStack {...props} transform={transform} />;
};
