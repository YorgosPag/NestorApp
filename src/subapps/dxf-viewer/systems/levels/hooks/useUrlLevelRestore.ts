'use client';

/**
 * useUrlLevelRestore — one-shot επαναφορά του ανοιχτού επιπέδου από τη διεύθυνση (ADR-400).
 *
 * Όταν η λίστα των επιπέδων περιέχει το επίπεδο που δηλώνει το `?lvl=`, το επιλέγει **μία φορά**
 * (F5, μοιρασμένος σύνδεσμος, «Άνοιγμα στο DXF»). Δεν παλεύει με την επανεκλογή της συνδρομής
 * (`useLevelsFirestoreSync`): μετά την επαναφορά ο άνθρωπος αλλάζει επίπεδο ελεύθερα.
 *
 * ## Ο σύνδεσμος διαβάζεται ΜΙΑ φορά, στο mount (ADR-914 §2.16)
 *
 * Ήταν effect που ξαναδιάβαζε τη διεύθυνση όταν έφτανε η λίστα. Όσο το `lvl` γραφόταν μόνο μαζί
 * με την κάμερα αυτό ήταν ακίνδυνο — σε ουδέτερο μετασχηματισμό κανείς δεν έγραφε. Από τότε που
 * το `lvl` γράφεται σε **κάθε** αλλαγή επιπέδου, ο γραφέας (`useViewportUrlSync`, effect
 * **απογόνου**) τρέχει πριν από αυτό το effect (**πρόγονος**): στο πρώτο snapshot θα έγραφε το
 * επίπεδο που εξέλεξε η συνδρομή, και η επαναφορά θα διάβαζε εκείνο αντί για τον σύνδεσμο. Η
 * πρόθεση κρατιέται από το πρώτο render — το `window.location` δεν είναι reactive, και μια
 * ανάγνωση αργότερα είναι σιωπηλή εξάρτηση από κάτι που αλλάζει εκτός React (ίδιο ιδίωμα με το
 * `?bldg=` στο `useActiveBuildingId`).
 *
 * @module subapps/dxf-viewer/systems/levels/hooks/useUrlLevelRestore
 * @see docs/centralized-systems/reference/adrs/ADR-400-viewport-state-persistence.md
 */

import { useEffect, useRef, useState } from 'react';
import { readViewportFromUrl } from '../../../services/viewport-persistence';
import type { Level } from '../config';

export function useUrlLevelRestore(
  levels: readonly Level[],
  currentLevelId: string | null,
  setCurrentLevelId: (levelId: string) => void,
): void {
  const [linkedLevelId] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : readViewportFromUrl().levelId ?? null,
  );
  const restoredRef = useRef(false);

  useEffect(() => {
    if (restoredRef.current || !linkedLevelId) return;
    // Δεν είναι (ακόμη) στη λίστα ⇒ περιμένει: μπορεί να το φέρει επόμενο snapshot.
    if (!levels.some((l) => l.id === linkedLevelId)) return;
    restoredRef.current = true;
    if (linkedLevelId !== currentLevelId) setCurrentLevelId(linkedLevelId);
  }, [levels, currentLevelId, linkedLevelId, setCurrentLevelId]);
}
