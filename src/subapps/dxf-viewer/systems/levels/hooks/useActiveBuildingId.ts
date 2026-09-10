'use client';

/**
 * **ADR-845 §7.15 (Ο-18 / Ο-32)** — το ΕΝΑ σπίτι της ερώτησης *«ποιο κτήριο
 * δουλεύουμε;»*, μαζί με τη διεύθυνση που τη θυμάται.
 *
 * ## Γιατί hook και όχι δύο κλήσεις της καθαρής συνάρτησης
 *
 * Οι καταναλωτές είναι **δύο** *(`LevelPanel` για τη σειρά των επιπέδων,
 * `DxfViewerDialogs` για το modal «Διαχείριση Ορόφων»)*. Καθένας τους χρειάζεται
 * **τρία** πράγματα: την ανάγνωση της διεύθυνσης, τη λύση, και το **γράψιμο
 * πίσω**. Γραμμένα δύο φορές, θα ήταν sibling clone — ακριβώς το σχήμα που πιάνει
 * το CHECK 3.28 και που το ADR-584 ονόμασε *«κεντρικοποιείς το Α, γράφεις Β+Γ ως
 * δίδυμα»*.
 *
 * ## Η διεύθυνση **μαθαίνει**, δεν διατάζει
 *
 * Μόλις η εμβέλεια γίνει γνωστή από το ανοιχτό επίπεδο, γράφεται στη διεύθυνση με
 * `history.replaceState` *(μηδέν πλοήγηση, μηδέν re-render — ADR-040)*. Έτσι:
 *
 * - το link που θα μοιραστεί ο μηχανικός **κουβαλά** το κτήριο, χωρίς να το
 *   επιλέξει κανείς από πουθενά — δηλαδή παίρνουμε το «ένα μοντέλο ανά κτήριο»
 *   που το Revit πετυχαίνει **μόνο με χωριστά αρχεία**, χωρίς τα χωριστά αρχεία·
 * - και το επόμενο φόρτωμα ξέρει **τι να ζητήσει** πριν υπάρξει ανοιχτό επίπεδο.
 *
 * @module subapps/dxf-viewer/systems/levels/hooks/useActiveBuildingId
 * @see systems/levels/level-floor-resolution — ο καθαρός κανόνας των τριών σκαλιών
 * @see services/viewport-persistence — το ΕΝΑ σημείο που ξέρει τα κλειδιά της διεύθυνσης
 */

import { useEffect, useState } from 'react';
import {
  readActiveBuildingFromUrl,
  writeActiveBuildingToUrl,
} from '../../../services/viewport-persistence';
import { resolveActiveBuildingId } from '../level-floor-resolution';
import type { Level } from '../config';

/**
 * Το ενεργό `buildingId` του viewer — και η διεύθυνση μένει συγχρονισμένη μαζί του.
 *
 * ⚠️ Η αρχική ανάγνωση γίνεται **μία φορά** (lazy initialiser): το
 * `window.location` δεν είναι reactive, και μια ανάγνωση σε κάθε render θα ήταν
 * σιωπηλή εξάρτηση από κάτι που αλλάζει εκτός React.
 */
export function useActiveBuildingId(
  levels: readonly Level[] | null | undefined,
  currentLevelId: string | null | undefined,
): string | null {
  const [declared, setDeclared] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : readActiveBuildingFromUrl(),
  );

  const resolved = resolveActiveBuildingId(levels, currentLevelId, declared);

  useEffect(() => {
    if (!resolved || resolved === declared) return;
    writeActiveBuildingToUrl(resolved);
    setDeclared(resolved);
  }, [resolved, declared]);

  return resolved;
}
