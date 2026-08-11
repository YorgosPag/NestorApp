/**
 * 🔴 **ΤΟ ΚΟΙΝΟ ΟΡΓΑΝΟ ΤΩΝ ΔΙΑΔΡΟΜΩΝ ΠΡΟΧΕΙΡΟΥ** — ζωντανή σκηνή, ζωντανή οντότητα πίνακα, και
 * εντολές που **εκτελούνται στ' αλήθεια**.
 *
 * ## Γιατί εξήχθη (ADR-753 §29, N.18 / CHECK 3.28)
 * Οι διαδρομές επικόλλησης είναι **τρεις** (`Ctrl+V` · δεξί κλικ · κουμπί κορδέλας) και κάθε μία
 * χρειάζεται το ίδιο ακριβώς στήσιμο: έναν `LevelManagerLike` με μία σκηνή, μια οντότητα πίνακα
 * μέσα της, και έναν εκτελεστή εντολών που **γράφει** τη σκηνή. Γραμμένο δεύτερη φορά μέσα στο
 * αρχείο του `Ctrl+V`, θα ήταν sibling clone ~50 γραμμών — και το σοβαρό δεν είναι οι γραμμές:
 * ένα από τα δύο θα μάθαινε κάποτε να εκτελεί τις εντολές αλλιώς, και οι δύο διαδρομές θα
 * μετρούνταν σε **διαφορετικό** κόσμο ενώ θα ισχυρίζονταν ότι λένε τα ίδια.
 *
 * ## 🔑 Η εντολή εκτελείται, δεν καταγράφεται
 * Το `execute` καλεί `command.execute()`. Χωρίς αυτό, το test θα μετρούσε **προθέσεις** αντί για
 * αποτέλεσμα — ακριβώς το «ένα anchor χωρίς εκτέλεση είναι σχόλιο» του ADR-587. Οι εντολές
 * κρατιούνται **επιπλέον**, για όποιον θέλει να μετρήσει «πόσα βήματα undo».
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/__tests__/table-clipboard-harness
 * @see ui/table-cell-editor/use-table-range-actions.ts — η διαδρομή του πληκτρολογίου
 * @see ui/table-cell-editor/use-table-menu-clipboard.ts — η διαδρομή του ποντικιού
 */

import { buildTableEntity } from '../../../bim/table/build-table-entity';
import type { ICommand } from '../../../core/commands';
import type { PersistedTableModel } from '../../../types/table';
import type { TableEntity } from '../../../types/table-entity';
import type { LevelManagerLike } from '../../../hooks/canvas/canvas-click-types';

export const HARNESS_LEVEL_ID = 'level-1';
export const HARNESS_TABLE_ID = 'table-1';

export interface TableClipboardHarness {
  readonly levelManager: LevelManagerLike;
  /** Η οντότητα **όπως είναι τώρα** στη σκηνή — ποτέ το αρχικό στιγμιότυπο. */
  readonly liveTable: () => TableEntity | null;
  readonly execute: (command: ICommand) => void;
  readonly commands: ICommand[];
  readonly currentModel: () => PersistedTableModel;
}

/** Στήνει σκηνή με **έναν** πίνακα που κρατά το δοσμένο μοντέλο. */
export function createTableClipboardHarness(model: PersistedTableModel): TableClipboardHarness {
  const table: TableEntity = {
    ...buildTableEntity({ x: 0, y: 0 }, {}, HARNESS_TABLE_ID, 'layer-0'),
    model,
  };
  let scene = { entities: [table] } as unknown as ReturnType<LevelManagerLike['getLevelScene']>;

  const levelManager = {
    currentLevelId: HARNESS_LEVEL_ID,
    getLevelScene: () => scene,
    setLevelScene: (_id: string, next: typeof scene) => { scene = next; },
  } as unknown as LevelManagerLike;

  const liveTable = (): TableEntity | null => {
    const found = scene?.entities.find((e) => e.id === HARNESS_TABLE_ID);
    return (found as unknown as TableEntity) ?? null;
  };

  const commands: ICommand[] = [];
  const execute = (command: ICommand): void => { commands.push(command); command.execute(); };

  return { levelManager, liveTable, execute, commands, currentModel: () => liveTable()!.model };
}
