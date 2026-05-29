'use client';

/**
 * ADR-396 P7 — Thermal Envelope persistence service.
 *
 * Persists το per-floor `ThermalEnvelopeSpec` στο
 * `dxf_viewer_levels/{levelId}.thermalEnvelopeSpec` μέσω του υπάρχοντος
 * `updateDxfLevelWithPolicy` mutation gateway (ADR-286) — μηδέν direct Firestore
 * SDK, tenant isolation + version-checked updates από το server route.
 *
 * Mirror του `bim-render-settings.service` (ADR-375 Phase B.2).
 *
 * @see ./bim-render-settings.service (pattern SSoT)
 */

import { updateDxfLevelWithPolicy } from '@/services/dxf-level-mutation-gateway';
import type { ThermalEnvelopeSpec } from '../bim/types/thermal-envelope-types';

/**
 * Persist το `spec` για τον δοθέντα όροφο.
 * Fire-and-forget safe: οι callers μπορούν να παραλείψουν το await σε
 * non-blocking debounce paths.
 */
export async function saveThermalEnvelopeSpec(
  levelId: string,
  spec: ThermalEnvelopeSpec,
): Promise<void> {
  await updateDxfLevelWithPolicy({
    payload: { levelId, thermalEnvelopeSpec: spec },
  });
}
