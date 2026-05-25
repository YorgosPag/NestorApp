'use client';

/**
 * ADR-375 Phase B.2 — BIM Render Settings Service.
 *
 * Persists `BimRenderSettings` to `dxf_viewer_levels/{levelId}.bimRenderSettings`
 * via the existing `updateDxfLevelWithPolicy` mutation gateway (ADR-286).
 *
 * No direct Firestore SDK calls — all writes go through the server route
 * which enforces tenant isolation and version-checked updates.
 */

import { updateDxfLevelWithPolicy } from '@/services/dxf-level-mutation-gateway';
import type { BimRenderSettings } from '../config/bim-render-settings-types';

/**
 * Persist `settings` for the given level.
 * Fire-and-forget safe: callers may omit await for non-blocking debounce paths.
 */
export async function saveBimRenderSettings(
  levelId: string,
  settings: BimRenderSettings,
): Promise<void> {
  await updateDxfLevelWithPolicy({
    payload: { levelId, bimRenderSettings: settings },
  });
}
