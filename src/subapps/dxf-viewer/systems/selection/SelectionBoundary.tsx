'use client';

import React, { useContext } from 'react';
import { SelectionContext, SelectionSystem } from './SelectionSystem';

/**
 * ADR-688 / ADR-371 — «παρέχω τον SelectionContext ΜΟΝΟ αν λείπει».
 *
 * Γιατί υπάρχει: μια επιφάνεια που ΑΠΑΙΤΕΙ επιλογή (π.χ. το `BimViewport3D`, που
 * καλεί άνευ όρων `useUniversalSelectionStable` μέσω edit-interaction + clipboard)
 * δεν πρέπει να στηρίζει την εξάρτησή της σε καλούντα δύο επίπεδα πιο πάνω. Ο
 * μόνος `<SelectionSystem>` του δέντρου ζει στο `DxfViewerApp`, οπότε ΚΑΘΕ άλλο
 * mount site (Properties read-only overlay, test-harness) έριχνε τη σελίδα με
 * «useUniversalSelectionStable must be used within a SelectionSystem».
 *
 * ⚠️ ΓΙΑΤΙ «ΜΟΝΟ αν λείπει» και ΟΧΙ πάντα: ο `SelectedEntitiesStore` είναι
 * module-level singleton με **ΕΝΑΝ** legacy sink (`registerLegacySink`,
 * `useSelectionSystemState`). Δεύτερος φωλιασμένος provider θα άρπαζε τον sink του
 * host και στο unmount θα τον μηδένιζε — δηλαδή θα έσπαγε τη ζωντανή επιλογή του
 * `/dxf/viewer`. Άρα: υπάρχει context → τον ΚΡΑΤΑΜΕ αυτούσιο, μηδέν δεύτερη πηγή.
 *
 * ADR-040: μηδέν high-freq συνδρομή εδώ. Το `useContext` ακούει το `contextValue`,
 * που κατά ADR-532 ΔΕΝ αλλάζει σε επιλογή οντοτήτων — και είναι ακριβώς το σήμα
 * που ο καταναλωτής (`useUniversalSelectionStable`) άκουγε ήδη.
 */
export function SelectionBoundary({ children }: { children: React.ReactNode }) {
  const host = useContext(SelectionContext);

  if (host) return <>{children}</>;

  return <SelectionSystem>{children}</SelectionSystem>;
}
