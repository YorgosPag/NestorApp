/**
 * ADR-929 §6.23 · §6.24 — η **πλήρης** βαθμονομημένη κατάσταση ενός ορόφου: θέση της εικόνας, βαθμονόμηση (ή καμία) και
 * κλίμακα συλλογής. Είναι το «πριν» και το «μετά» της εντολής αναίρεσης (`CalibrationChangeCommand`).
 *
 * 🔑 **Γιατί και το `scale`.** Για εικόνες η κλίμακα συλλογής μετρά **μόνη της** ως γνωστή κλίμακα
 * (`resolveRasterPixelScale` → `fromGalleryScale`). Η αναίρεση μιας **πρώτης** βαθμονόμησης που άφηνε το `scale` θα άφηνε
 * τον όροφο να μοιάζει βαθμονομημένος.
 * 🔑 **Αντίγραφο.** Το `commitCalibration` αλλάζει αισιόδοξα το store· το στιγμιότυπο δεν μοιράζεται αναφορές μαζί του.
 *
 * ΚΑΘΑΡΟ (pure) — μηδέν store/δίκτυο.
 *
 * @module subapps/dxf-viewer/floorplan-background/geometry/calibration-snapshot
 */

import {
  transformsEqual,
  type BackgroundScale,
  type BackgroundTransform,
  type CalibrationData,
  type FloorplanBackground,
} from '../providers/types';

export interface CalibrationSnapshot {
  readonly floorId: string;
  readonly transform: BackgroundTransform;
  /** `null` ⇒ ο όροφος δεν είναι βαθμονομημένος. */
  readonly calibration: CalibrationData | null;
  /** Η κλίμακα συλλογής· `null` ⇒ καμία. */
  readonly scale: BackgroundScale | null;
}

type SnapshotSource = Pick<FloorplanBackground, 'transform' | 'calibration' | 'scale'>;

/** Η κατάσταση του υποβάθρου τώρα· `null` μόνο όταν δεν υπάρχει υπόβαθρο. */
export function calibrationSnapshot(floorId: string, bg: SnapshotSource | null): CalibrationSnapshot | null {
  if (!bg) return null;
  return { floorId, transform: { ...bg.transform }, calibration: bg.calibration ?? null, scale: bg.scale ?? null };
}

/**
 * Ίδια βαθμονομημένη κατάσταση; Θέση **κατά τιμή** (`transformsEqual`), βαθμονόμηση κατά χρόνο + μέθοδο + μήκος (μία
 * εγγραφή ⇒ ένα `calibratedAt`). Ό,τι γράφει ο server επιπλέον (`calibratedBy`) δεν αλλάζει την ταυτότητα.
 */
export function sameCalibrationState(a: SnapshotSource, b: SnapshotSource): boolean {
  if (!transformsEqual(a.transform, b.transform)) return false;
  // Παλιές εγγραφές μπορεί να μην έχουν καθόλου πεδίο `calibration` (`undefined`): σημαίνει το ίδιο με `null`.
  const ca = a.calibration ?? null;
  const cb = b.calibration ?? null;
  if (ca === null || cb === null) return ca === cb;
  return ca.calibratedAt === cb.calibratedAt && ca.method === cb.method && ca.realDistance === cb.realDistance;
}
