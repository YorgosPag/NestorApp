'use client';

/**
 * ADR-739 Φ.Δ βήμα 9 — **η μία διαδρομή commit ενός πίνακα**, ως hook.
 *
 * ## Γιατί βγήκε από το `use-table-range-actions`
 * Ζούσε εκεί ως ιδιωτικό `useCallback` όσο ο μόνος καταναλωτής ήταν το πρόχειρο. Με το μενού
 * των ζωνών έγιναν **δύο**, και η αντιγραφή θα ήταν λάθος σε δύο επίπεδα ταυτόχρονα:
 *
 *  - **Μηχανικά**: εννιά γραμμές με `createLevelSceneManagerAdapter` + `buildTableModelCommand`
 *    + `execute` είναι ακριβώς το σχήμα που πιάνει το CHECK 3.28 (jscpd, N.18) ως sibling clone.
 *  - **Ουσιαστικά**: ο §6.6 του ADR-739 απαιτεί **μία** διαδρομή δέσμευσης για κάθε αλλαγή
 *    πίνακα, ώστε «20 κελιά = ένα undo» να μην είναι υπόσχεση αλλά δομή. Δεύτερο αντίγραφο
 *    σημαίνει δεύτερο σημείο που μπορεί κάποτε να μάθει κάτι (π.χ. έλεγχο κλειδώματος) και το
 *    πρώτο όχι.
 *
 * Η συμπεριφορά είναι **αυτούσια**: `false` όταν λείπει οντότητα/όροφος ή όταν το μοντέλο
 * γύρισε ίδιο by-reference — δηλαδή καμία εντολή, κανένα βήμα undo για το τίποτα.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-model-commit
 * @see bim/table/table-cell-edit-session.ts — `buildTableModelCommand` (ο φύλακας του no-op)
 */

import { useCallback } from 'react';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { buildTableModelCommand } from '../../bim/table/table-cell-edit-session';
// 🔴 ADR-739 §48 — δες τη χρήση παρακάτω: η αλλαγή του πίνακα ακυρώνει την υπόσχεση του
// προχείρου. Ο **ζωγράφος** έχει το δομικό δίχτυ· εδώ σταματά ο παλμός.
import { clearTableCopyMarquee } from '../../state/table-copy-marquee-store';
import type { TableEntity } from '../../types/table-entity';
import type { ICommand, ISceneManager } from '../../core/commands';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';
import { activeTableModel } from '../../bim/table/table-worksheet-resolve';
import type { PersistedTableModel } from '../../types/table';

export interface UseTableModelCommitParams {
  readonly levelManager: LevelManagerLike;
  readonly execute: (command: ICommand) => void;
}

/**
 * Οντότητα + νέο μοντέλο → **μία** εντολή. `true` όταν όντως εκτελέστηκε κάτι.
 *
 * Η οντότητα είναι **όρισμα κλήσης** και όχι εξάρτηση του hook, επειδή αυτό ακριβώς είναι
 * που πρέπει να διαβαστεί **τη στιγμή της ενέργειας**: το `getLevelScene` ανανεώνεται
 * ασύγχρονα, οπότε μια αναφορά κλεισμένη στο render μπορεί να είναι μπαγιάτικη (το σφάλμα
 * που τεκμηριώνει το `liveEntity` στο `useTableCellDoubleClickEditor`). Έτσι ο ίδιος
 * δεσμευτής εξυπηρετεί και τον καταναλωτή που κρατά την οντότητα σε render (πρόχειρο) και
 * εκείνον που τη διαβάζει με getter (μενού ζωνών).
 */
export type TableModelCommit = (entity: TableEntity, nextModel: PersistedTableModel) => boolean;

/**
 * 🔴 **ADR-833 Φάση 4 — Ο ΠΥΡΗΝΑΣ: «φτιάξε εντολή πίνακα και εκτέλεσέ την».**
 *
 * ## Γιατί εξήχθη, και γιατί ΠΡΙΝ γραφτεί ο δεύτερος καταναλωτής
 * Οι πράξεις **φύλλων** (προσθήκη/διαγραφή/μετονομασία/αναδιάταξη + πολυφυλλική εισαγωγή)
 * χρειάζονται **ακριβώς** την ίδια ακολουθία: όροφος → adapter → κατασκευαστής εντολής →
 * `execute` → σβήσιμο μυρμηγκιών. Ένα δεύτερο `useTableWorksheetCommit` με αυτό το σώμα θα ήταν
 * ο sibling clone που πιάνει το CHECK 3.28 (jscpd, N.18) — και το ακριβό δεν είναι οι οκτώ
 * γραμμές: είναι ότι το δεύτερο αντίγραφο είναι πάντα εκείνο που **ξεχνά** τα μυρμήγκια.
 *
 * Ο καλών δίνει **μόνο** τη διαφορά: ποιος κατασκευαστής εντολής, με ποια ορίσματα.
 *
 * 🔑 Η **επιλογή** του κατασκευαστή μένει στον καλούντα και δεν γίνεται παράμετρος-διακόπτης:
 * ένα `kind: 'model' | 'worksheets'` εδώ θα ήταν ένα σώμα με δύο συμπεριφορές κρυμμένες σε
 * `if` — η ακριβώς αντίθετη κίνηση από SSoT (ίδιο επιχείρημα με το `stamp-table-chrome-rect`).
 */
export type TableCommandCommit = (build: (sceneManager: ISceneManager) => ICommand | null) => boolean;

export function useTableCommandCommit(params: UseTableModelCommitParams): TableCommandCommit {
  const { levelManager, execute } = params;

  return useCallback<TableCommandCommit>(
    (build) => {
      const { currentLevelId, getLevelScene, setLevelScene } = levelManager;
      if (!currentLevelId || !setLevelScene) return false;
      const sceneManager = createLevelSceneManagerAdapter(getLevelScene, setLevelScene, currentLevelId);
      const command = build(sceneManager);
      if (!command) return false;
      execute(command);
      // 🔴 ADR-739 §48 — **η αλλαγή σβήνει τα μυρμήγκια** (Excel parity): το περίγραμμα
      // υπόσχεται «αυτά τα κελιά, όπως τα βλέπεις», και μια δομική αλλαγή κάνει την υπόσχεση
      // ψέμα. Μπαίνει **μετά** το `if (!command)`, άρα εκτελείται μόνο σε **πραγματική** αλλαγή
      // — ο φύλακας ταυτότητας του `buildTableModelCommand` κάνει ήδη τη διάκριση, και μια
      // δεύτερη σύγκριση εδώ θα ήταν δεύτερη άποψη για το «άλλαξε κάτι;».
      //
      // Ιδεμποτής, άρα αβλαβής όταν δεν υπάρχει marquee. Ο ζωγράφος έχει **ούτως ή άλλως** το
      // δικό του δίχτυ (σύγκριση `modelRef`) για όποια διαδρομή δεν περνά από εδώ· αυτό εδώ
      // υπάρχει για να μη μείνει ο **παλμός** να τρέχει σε marquee που δεν φαίνεται πια.
      clearTableCopyMarquee();
      return true;
    },
    [levelManager, execute],
  );
}

/**
 * Οντότητα + νέο μοντέλο → **μία** εντολή, μέσα από τον {@link useTableCommandCommit}.
 *
 * Μένει ως **όνομα πρόθεσης** και όχι ως παραλλαγή υλοποίησης: οι ~δέκα καλούντες του λένε
 * «γράψε αυτό το μοντέλο», και δεν έχουν λόγο να ξέρουν ότι υπάρχει adapter σκηνής.
 */
export function useTableModelCommit(params: UseTableModelCommitParams): TableModelCommit {
  const commit = useTableCommandCommit(params);
  return useCallback(
    (entity, nextModel) => commit((sceneManager) => buildTableModelCommand(entity, nextModel, sceneManager)),
    [commit],
  );
}

/**
 * ADR-750 Φ3 — **καθαρός μετασχηματισμός πάνω στον ζωντανό πίνακα**, το ένα επίπεδο πιο πάνω.
 *
 * Το {@link useTableModelCommit} απαντά «πώς γράφεται»· αυτό απαντά «πάνω σε τι». Η ακολουθία
 * *ζωντανή οντότητα → μετασχηματισμός → φύλακας ταυτότητας → commit* ήταν γραμμένη **δύο** φορές
 * (μορφοποίηση άξονα, εντολές περιγράμματος) και το CHECK 3.28 τη μέτρησε ως sibling clone στο
 * ίδιο commit — δηλαδή το ίδιο ακριβώς σχήμα που γέννησε το `useTableModelCommit`, ένα επίπεδο
 * ψηλότερα. Η επανάληψη σταματά εδώ.
 *
 * 🔴 Ο έλεγχος `next === activeTableModel(live)` **δεν είναι βελτιστοποίηση**: οι καθαρές πράξεις του
 * ADR-750 επιστρέφουν το ίδιο αντικείμενο by-reference όταν καμία τιμή δεν αλλάζει, και ένα
 * commit εκεί θα έγραφε βήμα undo που δεν αναιρεί τίποτα — «πάτησα δεύτερη φορά το ίδιο κουμπί
 * και τώρα το `Ctrl+Z` δεν κάνει τίποτα».
 *
 * ⚠️ Δεν αγγίζει τον **δρομέα**, επίτηδες: η μορφοποίηση δεν προσθέτει ούτε αφαιρεί γραμμές,
 * άρα η θέση παραμένει έγκυρη — και ένα γράψιμο δρομέα θα ζητούσε πίσω την εστίαση από το
 * κουμπί που μόλις πατήθηκε (το πρώτο «Β» θα δούλευε, το δεύτερο θα έπεφτε στο κενό). Οι
 * **δομικές** πράξεις που όντως μετακινούν τον δρομέα κρατούν δική τους διαδρομή.
 */
export function useLiveTableMutation(
  params: UseTableModelCommitParams & { readonly liveTable: () => TableEntity | null },
): (mutate: (model: PersistedTableModel) => PersistedTableModel) => void {
  const { levelManager, execute, liveTable } = params;
  const commitModel = useTableModelCommit({ levelManager, execute });

  return useCallback(
    (mutate) => {
      const live = liveTable();
      if (!live) return;
      const nextModel = mutate(activeTableModel(live));
      if (nextModel === activeTableModel(live)) return;
      commitModel(live, nextModel);
    },
    [liveTable, commitModel],
  );
}
