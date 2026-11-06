/**
 * ADR-929 Φ5.2γ (ADR-340) — **η μία** πράξη που γράφει βαθμονόμηση υποβάθρου. Τη χρησιμοποιεί ο διάλογος
 * δύο σημείων σήμερα και η κάρτα προτεινόμενης κλίμακας της Φ5.3 αύριο.
 *
 * 🔴 **Γιατί υπάρχει.** Η βαθμονόμηση ζούσε μόνο στη μνήμη: το `applyCalibration` άλλαζε τη θέση (που το
 * autosave έστελνε ως απλό transform) και το `calibration`, που **δεν** αποθηκευόταν. Μετά από ανανέωση η
 * εικόνα είχε σωστό μέγεθος, αλλά «δεν ήταν βαθμονομημένη» ⇒ η έγκριση τοίχων από εικόνα ξανακλείδωνε.
 * Ο client του `PATCH kind:'calibration'` υπήρχε, χωρίς κανέναν καλούντα.
 *
 * Ροή (Google Docs / Figma: αισιόδοξα, μετά βεβαίωση, αλλιώς επαναφορά):
 * 1. Η βαθμονόμηση γίνεται ιδιοκτήτρια της θέσης (`setCalibrationPending`) και εφαρμόζεται αμέσως στο store.
 * 2. Μπαίνει στην **ίδια** ουρά με το autosave ⇒ όταν έρθει η σειρά της, το `oldTransform` είναι ό,τι έχει
 *    ο server (ποτέ μια αισιόδοξη θέση που δεν γράφτηκε). Με αυτό ο server μετακινεί και τα overlays.
 * 3. Επιτυχία ⇒ υιοθετείται η απάντηση του server (με `calibratedBy`, `scale`) ως δεσμευμένη αλήθεια.
 *    `409 CALIBRATION_STALE` ⇒ η θέση άλλαξε αλλού: υιοθετείται η θέση του server. Άλλο σφάλμα ⇒ επαναφορά.
 *
 * Ιδεμποτικό: η ίδια βαθμονόμηση δύο φορές γράφει την ίδια κατάσταση· ο `apiClient` στέλνει `Idempotency-Key`
 * (ADR-872), άρα μια αυτόματη επανάληψη δεν ξανατρέχει την αναπροσαρμογή των overlays.
 *
 * @module subapps/dxf-viewer/floorplan-background/services/commit-calibration
 */

import { ApiClientError } from '@/lib/api/api-client-types';
import { createModuleLogger } from '@/lib/telemetry';
import { CALIBRATION_STALE_ERROR_CODE, type BackgroundTransform, type CalibrationData, type FloorplanBackground } from '../providers/types';
import { getFloorBackground, useFloorplanBackgroundStore, type AdoptedPlacement } from '../stores/floorplanBackgroundStore';
import { FloorplanBackgroundApiClient } from './floorplan-background-api-client';
import {
  enqueueBackgroundWrite,
  getCommittedBackground,
  setCalibrationPending,
  setCommittedBackground,
  snapshotOf,
} from './background-write-ledger';

const logger = createModuleLogger('commitCalibration');

export type CalibrationCommitStatus = 'saved' | 'conflict' | 'failed';

export interface CalibrationCommitResult {
  readonly status: CalibrationCommitStatus;
  /** >0 ⇒ ο server άφησε overlays με κακή γεωμετρία στη θέση τους (ADR-340). */
  readonly overlaysSkipped: number;
}

function placementOf(bg: FloorplanBackground): AdoptedPlacement {
  return { transform: { ...bg.transform }, calibration: bg.calibration };
}

/** Η πραγματική εγγραφή — τρέχει μέσα στην ουρά του ορόφου. */
async function writeCalibration(
  floorId: string,
  backgroundId: string,
  fallbackOld: BackgroundTransform,
  next: AdoptedPlacement & { calibration: CalibrationData },
): Promise<CalibrationCommitResult> {
  const oldTransform = getCommittedBackground(floorId)?.transform ?? fallbackOld;
  const response = await FloorplanBackgroundApiClient.patchCalibration(backgroundId, {
    oldTransform,
    newTransform: next.transform,
    calibration: next.calibration,
  });
  const saved = response.background;
  useFloorplanBackgroundStore.getState()._adoptPlacement(floorId, {
    transform: saved.transform,
    calibration: saved.calibration,
    scale: saved.scale,
    updatedAt: saved.updatedAt,
    updatedBy: saved.updatedBy,
  });
  setCommittedBackground(floorId, snapshotOf(saved));
  return { status: 'saved', overlaysSkipped: response.remap.overlaysSkipped };
}

/** Ο server έχει άλλη θέση: την υιοθετούμε (δική του αλήθεια), όχι τη δική μας παλιά. */
async function adoptServerAfterConflict(floorId: string): Promise<void> {
  const { background } = await FloorplanBackgroundApiClient.getByFloor(floorId);
  if (!background) return;
  useFloorplanBackgroundStore.getState()._adoptPlacement(floorId, placementOf(background));
  setCommittedBackground(floorId, snapshotOf(background));
}

function isStale(err: unknown): boolean {
  return err instanceof ApiClientError && err.statusCode === 409 && err.errorCode === CALIBRATION_STALE_ERROR_CODE;
}

/**
 * Γράφει τη βαθμονόμηση ενός ορόφου. Εφαρμόζεται αμέσως (αισιόδοξα) και κλείνει τη συνεδρία· το
 * αποτέλεσμα λέει αν έμεινε.
 */
export async function commitCalibration(
  floorId: string,
  transform: BackgroundTransform,
  calibration: CalibrationData,
): Promise<CalibrationCommitResult> {
  const bg = getFloorBackground(floorId);
  if (!bg) return { status: 'failed', overlaysSkipped: 0 };
  const previous = placementOf(bg);
  setCalibrationPending(floorId, true);
  useFloorplanBackgroundStore.getState().applyCalibration(floorId, transform, calibration);
  try {
    return await enqueueBackgroundWrite(floorId, () =>
      writeCalibration(floorId, bg.id, previous.transform, { transform, calibration }));
  } catch (err) {
    logger.error('Calibration commit failed', { floorId, backgroundId: bg.id, err });
    if (isStale(err)) {
      await adoptServerAfterConflict(floorId).catch((e: unknown) => logger.error('Re-read after conflict failed', { floorId, e }));
      return { status: 'conflict', overlaysSkipped: 0 };
    }
    useFloorplanBackgroundStore.getState()._adoptPlacement(floorId, previous);
    return { status: 'failed', overlaysSkipped: 0 };
  } finally {
    setCalibrationPending(floorId, false);
  }
}
