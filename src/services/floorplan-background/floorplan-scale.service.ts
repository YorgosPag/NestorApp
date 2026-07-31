/**
 * =============================================================================
 * 🏢 ENTERPRISE: Floorplan Scale Service (ADR-340 Phase 9)
 * =============================================================================
 *
 * Persists `BackgroundScale` calibration metadata on `floorplan_backgrounds`.
 * `unitsPerMeter` is the conversion ratio used by dimension/measurement
 * renderers and the FloorplanGallery transient measure tool to compute
 * real-world distances from native (DXF world / PDF pixel / Image pixel) coords.
 *
 * Responsibilities:
 * - `setBackgroundScale` — write/replace `scale` on a background doc
 * - `getBackgroundScale` — pure helper to read from an in-memory entity
 * - `detectDxfInsUnits` — pure mapping from DXF $INSUNITS code to BackgroundScale
 *
 * Tenant isolation enforced on every write via `companyId` equality.
 *
 * @module services/floorplan-background/floorplan-scale.service
 * @enterprise ADR-340 Phase 9 — Multi-Kind Overlays / Calibration
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import type {
  BackgroundScale,
  BackgroundScaleSourceUnit,
} from '@/types/floorplan-overlays';
import type { FloorplanBackground } from '@/subapps/dxf-viewer/floorplan-background/providers/types';
// SSoT «δικαιούμαι να γράψω σε ΑΥΤΟ το υπόβαθρο;» — κοινό με το background service.
import { txReadOwnedRow } from './background-ownership';

const logger = createModuleLogger('FloorplanScaleService');

// ─── DXF $INSUNITS → BackgroundScale mapping ─────────────────────────────────
//
// DXF stores native units in the `$INSUNITS` header variable. v1 maps the
// three real-world metric codes (mm/cm/m). Other codes (inches, feet, etc.)
// fall back to `null` → user-prompted calibration.
//
// Reference: AutoCAD DXF Reference, Chapter 3 (HEADER Section).

interface InsUnitsEntry {
  unitsPerMeter: number;
  sourceUnit: BackgroundScaleSourceUnit;
}

const INSUNITS_MAP: Record<number, InsUnitsEntry> = {
  4: { unitsPerMeter: 1000, sourceUnit: 'mm' },
  5: { unitsPerMeter: 100, sourceUnit: 'cm' },
  6: { unitsPerMeter: 1, sourceUnit: 'm' },
};

/**
 * Returns a `BackgroundScale` derived from a DXF `$INSUNITS` header value, or
 * `null` if the code is unknown / unsupported in v1 (caller falls back to
 * manual calibration). Pure function; no side effects.
 */
export function detectDxfInsUnits(insUnitsCode: number | undefined): BackgroundScale | null {
  if (insUnitsCode === undefined || insUnitsCode === null) return null;
  const entry = INSUNITS_MAP[insUnitsCode];
  if (!entry) return null;
  return {
    unitsPerMeter: entry.unitsPerMeter,
    sourceUnit: entry.sourceUnit,
  };
}

// ─── Pure read helper ─────────────────────────────────────────────────────────

/**
 * Returns the calibration scale for a background, or `null` if uncalibrated.
 * Pure helper — no Firestore round-trip.
 */
export function getBackgroundScale(
  background: Pick<FloorplanBackground, 'scale'> | null | undefined,
): BackgroundScale | null {
  if (!background?.scale) return null;
  if (typeof background.scale.unitsPerMeter !== 'number' || background.scale.unitsPerMeter <= 0) {
    return null;
  }
  return background.scale;
}

// ─── Server write ─────────────────────────────────────────────────────────────

export interface SetBackgroundScaleInput {
  companyId: string;
  backgroundId: string;
  scale: BackgroundScale;
  updatedBy: string;
}

/**
 * Persist the scale metadata on a background. Tenant isolation enforced.
 *
 * Ρίχνει `BackgroundNotFoundError` αν δεν υπάρχει και `CrossTenantAccessError`
 * αν ανήκει σε άλλον πελάτη — **τυποποιημένα**, ώστε το route να αποφασίζει με
 * `instanceof` και όχι με ανάγνωση κειμένου. Τι από την άρνηση φεύγει στο σύρμα
 * το κρίνει το route (ADR-742 §3.4): bypass ρόλος → `403`, κάθε άλλος → `404`
 * πανομοιότυπο με το γνήσιο «δεν βρέθηκε».
 */
export async function setBackgroundScale(
  input: SetBackgroundScaleInput,
): Promise<{ unitsPerMeter: number; sourceUnit: BackgroundScaleSourceUnit }> {
  if (!Number.isFinite(input.scale.unitsPerMeter) || input.scale.unitsPerMeter <= 0) {
    throw new Error('Invalid scale.unitsPerMeter');
  }
  if (!['mm', 'cm', 'm', 'pixel'].includes(input.scale.sourceUnit)) {
    throw new Error('Invalid scale.sourceUnit');
  }

  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.FLOORPLAN_BACKGROUNDS).doc(input.backgroundId);

  await db.runTransaction(async (tx) => {
    // SSoT: ύπαρξη + ιδιοκτησία **μέσα** στη συναλλαγή. Μέχρι το ADR-742 αυτές
    // οι τέσσερις γραμμές ήταν αντιγραμμένες εδώ με σκέτο `Error`, οπότε το
    // route αναγκαζόταν να διαβάσει κείμενο μηνύματος για απόφαση ασφαλείας.
    await txReadOwnedRow(
      tx,
      ref,
      input.backgroundId,
      input.companyId,
      'Cross-tenant scale write denied',
    );
    const now = Date.now();
    const scaleDoc: BackgroundScale & { calibratedAt: number; calibratedBy: string } = {
      unitsPerMeter: input.scale.unitsPerMeter,
      sourceUnit: input.scale.sourceUnit,
      calibratedAt: now,
      calibratedBy: input.updatedBy,
    };
    tx.update(ref, {
      scale: scaleDoc,
      updatedAt: now,
      updatedBy: input.updatedBy,
    });
  });

  logger.info('Background scale updated', {
    backgroundId: input.backgroundId,
    companyId: input.companyId,
    unitsPerMeter: input.scale.unitsPerMeter,
    sourceUnit: input.scale.sourceUnit,
  });

  return {
    unitsPerMeter: input.scale.unitsPerMeter,
    sourceUnit: input.scale.sourceUnit,
  };
}
