/**
 * ADR-929 §6.24 — η βαθμονόμηση είναι **βήμα του ενός ιστορικού αναίρεσης** (Ctrl+Z), όπως κάθε άλλη αλλαγή του χρήστη.
 *
 * 📐 **Πρακτική των μεγάλων.** Figma: κάθε αλλαγή του χρήστη στο **ίδιο** ιστορικό, ο χρήστης αναιρεί **μόνο τις δικές
 * του** αλλαγές, με πρόθεση (όχι επαναφορά ολόκληρης κατάστασης)· ο server συγχρονίζεται από πίσω. Revit: το Scale είναι
 * βήμα του undo. Ως τώρα η βαθμονόμηση έμενε **έξω** από το ιστορικό (ADR-941 Δ15): μετά από Ctrl+Z της «Βαθμονόμηση και
 * εισαγωγή» η εικόνα έμενε στη νέα θέση και οι οντότητες σε λάθος σημείο.
 *
 * 🔑 **Πώς.** `CalibrationChangeCommand` κρατά δύο **πλήρη** στιγμιότυπα (`before` / `after`: θέση · βαθμονόμηση ή καμία ·
 * κλίμακα συλλογής) και γράφει από τη **μία** πόρτα (`commitPlacement`): ο server ξαναμετακινεί και τα overlays.
 * - Μπαίνει στο ιστορικό **μόνο μετά** το επιβεβαιωμένο «saved» — μια εγγραφή που δεν έμεινε δεν αναιρείται. Γι' αυτό το
 *   `execute` είναι **ιδεμποτικό**: όταν η κατάσταση ήδη είναι `after`, δεν κάνει τίποτα.
 * - `undo` / `redo` μόνο αν η κατάσταση είναι ακόμη αυτή που άφησε η εντολή· αλλιώς (άλλη καρτέλα, άλλος χρήστης) **δεν**
 *   γράφει πάνω σε ξένη αλλαγή και το λέει (`floorplan:calibration-history-skipped` ⇒ toast). Ποτέ σιωπηλά.
 * - Μέσα σε `runAsSingleUndo` (εισαγωγή PDF) γίνεται μέρος της **μίας** ενέργειας: ένα Ctrl+Z αναιρεί και τα δύο.
 *
 * @module subapps/dxf-viewer/floorplan-background/services/calibration-command
 * @see ./commit-calibration.ts (η μία πόρτα εγγραφής)
 * @see ../geometry/calibration-snapshot.ts
 */

import { BaseCommand } from '../../core/commands/base-command';
import { getGlobalCommandHistory } from '../../core/commands/CommandHistory';
import type { ICommand } from '../../core/commands/interfaces';
import { EventBus } from '../../systems/events/EventBus';
import type { BackgroundTransform, CalibrationData } from '../providers/types';
import { getFloorBackground } from '../stores/floorplanBackgroundStore';
import { calibrationSnapshot, sameCalibrationState, type CalibrationSnapshot } from '../geometry/calibration-snapshot';
import { commitCalibration, commitPlacement, type CalibrationCommitResult } from './commit-calibration';

const COMMAND_TYPE = 'floorplan-calibration-change';

/** Γράφει `target` μόνο αν η κατάσταση είναι ακόμη `expected` (ή ήδη `target`, ιδεμποτικά). */
function moveCalibration(target: CalibrationSnapshot, expected: CalibrationSnapshot): void {
  const bg = getFloorBackground(target.floorId);
  if (!bg || sameCalibrationState(bg, target)) return;
  if (!sameCalibrationState(bg, expected)) {
    EventBus.emit('floorplan:calibration-history-skipped', { floorId: target.floorId, reason: 'changed-meanwhile' });
    return;
  }
  void commitPlacement(target).then((result) => {
    if (result.status !== 'saved') EventBus.emit('floorplan:calibration-history-skipped', { floorId: target.floorId, reason: 'failed' });
  });
}

export class CalibrationChangeCommand extends BaseCommand {
  readonly type = COMMAND_TYPE;

  constructor(readonly name: string, private readonly before: CalibrationSnapshot, private readonly after: CalibrationSnapshot) {
    super();
  }

  execute(): void {
    moveCalibration(this.after, this.before);
  }

  undo(): void {
    moveCalibration(this.before, this.after);
  }

  getDescription(): string {
    return this.name;
  }

  getAffectedEntityIds(): string[] {
    return [this.after.floorId];
  }

  protected serializeData(): Record<string, unknown> {
    return { before: this.before, after: this.after };
  }
}

/**
 * Καταγράφει στο ιστορικό μια βαθμονόμηση που **ήδη** σώθηκε: `after` = η κατάσταση του store τώρα (η απάντηση του
 * server). Μέσα σε `runAsSingleUndo` γίνεται μέρος της ομάδας. `null` ⇒ τίποτα δεν άλλαξε, άρα τίποτα να αναιρεθεί.
 */
export function recordCalibrationChange(before: CalibrationSnapshot, name: string): CalibrationChangeCommand | null {
  const after = calibrationSnapshot(before.floorId, getFloorBackground(before.floorId));
  if (after === null || sameCalibrationState(before, after)) return null;
  const command = new CalibrationChangeCommand(name, before, after);
  getGlobalCommandHistory().execute(command);
  return command;
}

export interface CalibrationChange {
  readonly result: CalibrationCommitResult;
  /** Η εντολή στο ιστορικό (μόνο στο `saved`)· αυτή αναιρεί το κουμπί «Αναίρεση» και το Ctrl+Z. */
  readonly command: CalibrationChangeCommand | null;
}

/** Νέα βαθμονόμηση από τη μία πόρτα + καταγραφή στο ιστορικό αναίρεσης (κάρτα κλίμακας · διάλογος δύο σημείων). */
export async function changeCalibration(
  floorId: string,
  transform: BackgroundTransform,
  calibration: CalibrationData,
  name: string,
): Promise<CalibrationChange> {
  const before = calibrationSnapshot(floorId, getFloorBackground(floorId));
  const result = await commitCalibration(floorId, transform, calibration);
  const command = result.status === 'saved' && before !== null ? recordCalibrationChange(before, name) : null;
  return { result, command };
}

/**
 * Το κουμπί «Αναίρεση» ενός μηνύματος = **το ίδιο** Ctrl+Z, μόνο όταν η ενέργεια είναι ακόμη η τελευταία του ιστορικού.
 * Αλλιώς `false`: η αναίρεση εκτός σειράς θα έσπαγε το ιστορικό (ο χρήστης χρησιμοποιεί Ctrl+Z).
 */
export function undoIfLast(command: ICommand): boolean {
  const history = getGlobalCommandHistory();
  return history.getLastCommand() === command ? history.undo() : false;
}
