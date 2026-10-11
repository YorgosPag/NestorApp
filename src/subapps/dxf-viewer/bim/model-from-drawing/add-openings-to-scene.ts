/**
 * ADR-911 Φ4-2 — ο ΓΡΑΦΕΑΣ ανοιγμάτων του βοηθού «Μοντέλο από το σχέδιο»: η εγκεκριμένη πρόταση
 * γίνεται οντότητες στη σκηνή, ατομικά και αναιρέσιμα.
 *
 * Καμία γεωμετρία εδώ. Το τι γράφεται το αποφασίζει ΟΛΟ το καθαρό `planOpeningWrite`· αυτό το
 * αρχείο το εκτελεί ως ΜΙΑ εγγραφή ιστορικού (`runAsSingleUndo`, ADR-729 — Revit
 * `TransactionGroup.Assimilate`): ένα Ctrl+Z αναιρεί γεφυρώσεις, επεκτάσεις, νέα κομμάτια,
 * ενώσεις γειτόνων και ανοίγματα ΜΑΖΙ. Ανά κούφωμα, ένα undo στη μέση αλυσίδας θα άφηνε ενωμένο
 * τοίχο με τα μισά του ανοίγματα.
 *
 * Σειρά μέσα στην ομάδα (κάθε βήμα βρίσκει στη σκηνή ό,τι χρειάζεται):
 *   1. τοίχοι — αντικατάσταση (`ReplaceWallsCommand`) ή σκέτη δημιουργία (`CreateWallsCommand`)·
 *   2. ενώσεις / νέος άξονας υπαρχόντων τοίχων (`RetrimWallsCommand`)·
 *   3. καθρέφτης ξενιστή (`SetHostedOpeningIdsCommand`)·
 *   4. μεταφορά υπαρχόντων ανοιγμάτων (`RehostOpeningsCommand`) — ο νέος ξενιστής υπάρχει ήδη·
 *   5. τα νέα ανοίγματα (`CreateOpeningsCommand`).
 *
 * Όλες οι εκπομπές δημιουργίας φέρουν `origin: 'bulk'`: εγκεκριμένη παρτίδα, ο ανά-οντότητα
 * ανιχνευτής του ADR-533 σιωπά. ΔΕΝ περνά από το `onOpeningCreated` (γυμνό `setLevelScene`, μη
 * αναιρέσιμο — ADR-568 §5)· καταλήγει στην ίδια κατάσταση σκηνής: άνοιγμα + καθρέφτης ξενιστή.
 *
 * @see ./opening-write-plan.ts — το σχέδιο (ό,τι γράφεται)
 * @see ../walls/add-wall-to-scene.ts — ο αδελφός γραφέας τοίχων της Φ2
 */

import { resolveSceneUnits } from '../../utils/scene-units';
import { getGlobalCommandHistory } from '../../core/commands/CommandHistory';
import { CreateOpeningsCommand } from '../../core/commands/entity-commands/CreateOpeningsCommand';
import { CreateWallsCommand } from '../../core/commands/entity-commands/CreateWallsCommand';
import { ReplaceWallsCommand } from '../../core/commands/entity-commands/ReplaceWallsCommand';
import { RetrimWallsCommand } from '../../core/commands/entity-commands/RetrimWallsCommand';
import {
  RehostOpeningsCommand,
  SetHostedOpeningIdsCommand,
} from '../../core/commands/entity-commands/opening-host-commands';
import type { ISceneManager } from '../../core/commands/interfaces';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import type { WallSceneAccessor } from '../walls/add-wall-to-scene';
import type { OpeningProposalItem } from './opening-proposal';
import { planOpeningWrite, type OpeningWritePlan, type OpeningWriteRefusal } from './opening-write-plan';

export interface AddOpeningsOptions {
  /** Η περιγραφή της εγγραφής στο ιστορικό αναίρεσης (i18n — από τον καλούντα). */
  readonly undoName: string;
  /** Γεννήτρια id ενωμένου τοίχου — εγχύσιμη για ντετερμινιστικά tests. */
  readonly newWallId?: () => string;
}

/** Γιατί δεν γράφτηκε τίποτα. */
export type AddOpeningsRefusal = OpeningWriteRefusal | 'no-active-scene';

export interface AddOpeningsResult {
  /** Το σχέδιο ΟΠΩΣ εκτελέστηκε. Απόν ⇔ δεν γράφτηκε τίποτα. */
  readonly plan?: OpeningWritePlan;
  readonly refusal?: AddOpeningsRefusal;
}

/** Οι εντολές του σχεδίου, με τη σειρά που πρέπει να τρέξουν. */
function executePlan(plan: OpeningWritePlan, adapter: ISceneManager, undoName: string): void {
  const history = getGlobalCommandHistory();
  const bulk = { origin: 'bulk' } as const;
  history.runAsSingleUndo(undoName, () => {
    if (plan.removedWalls.length > 0) {
      history.execute(new ReplaceWallsCommand(plan.removedWalls, plan.addedWalls, adapter, bulk));
    } else if (plan.addedWalls.length > 0) {
      history.execute(new CreateWallsCommand(plan.addedWalls, adapter, bulk));
    }
    if (plan.wallPatches.length > 0) history.execute(new RetrimWallsCommand(plan.wallPatches, adapter));
    if (plan.mirrorPatches.length > 0) history.execute(new SetHostedOpeningIdsCommand(plan.mirrorPatches, adapter));
    if (plan.rehosted.length > 0) {
      const entries = plan.rehosted.map((u) => ({ entityId: u.openingId, prev: u.previousParams, next: u.nextParams }));
      history.execute(new RehostOpeningsCommand(entries, adapter));
    }
    history.execute(new CreateOpeningsCommand(plan.openings, adapter, bulk));
  });
}

/**
 * Γράφει τα «πόρτα» / «παράθυρο» της πρότασης στην ενεργή σκηνή. Όλα ή τίποτα: αν το σχέδιο
 * αρνηθεί για οποιονδήποτε λόγο, η σκηνή και το ιστορικό μένουν ανέγγιχτα.
 */
export function addOpeningsToScene(
  items: readonly OpeningProposalItem[],
  accessor: WallSceneAccessor,
  options: AddOpeningsOptions,
): AddOpeningsResult {
  const levelId = accessor.currentLevelId;
  const scene = levelId ? accessor.getLevelScene(levelId) : null;
  if (!levelId || !scene) return { refusal: 'no-active-scene' };

  const planned = planOpeningWrite({
    entities: scene.entities ?? [],
    items,
    layerId: levelId,
    sceneUnits: resolveSceneUnits(scene),
    newWallId: options.newWallId,
  });
  if (!planned.ok) return { refusal: planned.refusal };

  // ADR-527: shared singleton adapter per (accessor, level) — not a fresh `new` per call.
  const adapter = createLevelSceneManagerAdapter(accessor.getLevelScene, accessor.setLevelScene, levelId);
  executePlan(planned.plan, adapter, options.undoName);
  return { plan: planned.plan };
}
