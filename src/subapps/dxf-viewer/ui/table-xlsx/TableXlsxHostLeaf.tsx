'use client';

/**
 * ADR-833 §1.3 — Το **φύλλο** που μαζεύει μόνο του τις εξαρτήσεις του host `.xlsx`.
 *
 * ## 🔴 Γιατί φύλλο και όχι props στον `DxfViewerDialogs`
 * Ίδιος λόγος με το `BimScheduleHostLeaf` δίπλα του (ADR-532 Στάδιο B5): το
 * `useSelectedEntityIds()` αλλάζει σε **κάθε κλικ επιλογής**. Καλεσμένο στον container, ένα
 * απλό κλικ θα ξανα-απέδιδε και τους 28 hosts του portal tree· απομονωμένο εδώ, ξανα-αποδίδει
 * **αυτό** και μόνο — που ούτως ή άλλως δεν ζωγραφίζει τίποτα (ένα κρυφό `<input>`).
 *
 * ## ⚠️ Ο πίνακας διαβάζεται με **getter**, τη στιγμή του πατήματος
 * `getSelectedTable` και όχι `selectedTable` (ADR-040 κανόνας #2): ανάμεσα στο πάτημα του
 * κουμπιού και στην επιλογή αρχείου μεσολαβεί **ο επιλογέας του λειτουργικού** — δηλαδή
 * απεριόριστος χρόνος, μέσα στον οποίο ο χρήστης μπορεί να έχει αλλάξει επιλογή ή να έχει κάνει
 * `Ctrl+Z`. Ένα στιγμιότυπο κλεισμένο σε render θα έγραφε σε πίνακα που δεν είναι πια εκεί.
 *
 * @see ./TableXlsxHost.tsx — το κρυφό input + οι listeners
 */

import React from 'react';
import { useSelectedEntityIds } from '../../systems/selection';
import { useLevels } from '../../systems/levels';
import { useCommandHistory } from '../../core/commands';
import { useNotifications } from '@/providers/NotificationProvider';
import { resolveSceneUnits } from '../../utils/scene-units';
import { resolveSelectedTable } from '../table-cell-editor/table-entity-lookup';
import { TableXlsxHost } from './TableXlsxHost';

/** Ίδιος ορισμός με τον `DxfViewerDialogs` — ο διαχειριστής δεν εξάγει δικό του τύπο. */
type LevelManager = ReturnType<typeof useLevels>;

export interface TableXlsxHostLeafProps {
  readonly levelManager: LevelManager;
}

export const TableXlsxHostLeaf = React.memo(function TableXlsxHostLeaf(
  props: TableXlsxHostLeafProps,
): React.JSX.Element {
  const { levelManager } = props;
  const selectionIds = useSelectedEntityIds();
  const { execute } = useCommandHistory();
  const notifications = useNotifications();

  // Οι δύο τιμές διαβάζονται **τη στιγμή της ενέργειας** — δες την κεφαλίδα.
  const selectionRef = React.useRef(selectionIds);
  selectionRef.current = selectionIds;

  const getSelectedTable = React.useCallback(
    () => resolveSelectedTable(levelManager, () => selectionRef.current),
    [levelManager],
  );

  const levelId = levelManager.currentLevelId;
  const sceneUnits = levelId ? resolveSceneUnits(levelManager.getLevelScene(levelId)) : 'mm';

  const notify = React.useCallback(
    (message: string) => notifications.info(message),
    [notifications],
  );

  return (
    <TableXlsxHost
      levelManager={levelManager}
      execute={execute}
      getSelectedTable={getSelectedTable}
      sceneUnits={sceneUnits}
      notify={notify}
    />
  );
});
