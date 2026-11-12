/**
 * ADR-929 Δ21 (δ) — οι **διορθώσεις τιμών** του ανθρώπου μέσα στον ελεγκτή της αναγνώρισης. Υπο-module του ενός γραφέα του
 * `planRecognitionStore` (`planRecognitionSession.corrections`), όπως το `plan-ocr-controller`.
 *
 * Κύκλος: κλικ σε γραμμή της λίστας «Τι διάβασα» → `correct` · `markNotDimension` · `revert` → νέο σύνολο διορθώσεων στο
 * store → ξανατρέχει **μόνο** η `fusePlan` (καθαρή, χωρίς Worker) με την ανάγνωση της μηχανής **και** τις διορθώσεις →
 * νέα πηγή γραμμών στον βοηθό από το ΙΔΙΟ κανάλι (`publish`).
 *
 * 🔑 Η ανάγνωση της μηχανής μένει ανέγγιχτη στο store (`reading`)· οι διορθώσεις ζουν δίπλα της (`readingCorrections`) και
 *   εφαρμόζονται από τη σύντηξη του ιδιοκτήτη. Έτσι μια «επαναφορά» επιστρέφει **ακριβώς** σε ό,τι διάβασε η μηχανή.
 * 🔑 Ιδεμποτία: ίδια διόρθωση δύο φορές ⇒ καμία δεύτερη σύντηξη· διόρθωση ίση με την ανάγνωση της μηχανής ⇒ επαναφορά.
 * ⚠️ Καμία μόνιμη αποθήκευση (→ Φ8): νέα αναγνώριση ή νέα ανάγνωση τις σβήνει (ο ιδιοκτήτης).
 *
 * Zero React.
 *
 * @see ./plan-recognition-session.ts (ο ιδιοκτήτης)
 * @see ../../bim/plan-recognition/reading/reading-corrections.ts (η καθαρή μετατροπή)
 */

import type { PlanFusionResult } from '../../bim/plan-recognition/fusion/plan-fusion-types';
import type { PlanReadingOutcome } from '../../bim/plan-recognition/plan-recognition-types';
import {
  withReadingCorrection,
  type PlanReadingCorrection,
  type PlanReadingCorrections,
} from '../../bim/plan-recognition/reading/reading-corrections';
import { planRecognitionStore, type PlanRecognitionRun } from './plan-recognition-store';

export interface PlanReadingCorrectionsDeps<T> {
  /** Η σύντηξη του ιδιοκτήτη με **ρητές** διορθώσεις (καθαρή). */
  readonly fuse: (run: PlanRecognitionRun, reading: PlanReadingOutcome | null, corrections: PlanReadingCorrections) => PlanFusionResult;
  /** Νέα έκδοση πηγής γραμμών για αποτέλεσμα που **ήδη** γράφτηκε στο store. */
  readonly lineSource: (run: PlanRecognitionRun, fusion: PlanFusionResult) => T;
  /** Παράδοση στον βοηθό: πηγή που δεν ζήτησε άμεσα ο wiring. */
  readonly publish: (source: T) => void;
}

const sameCorrection = (a: PlanReadingCorrection | undefined, b: PlanReadingCorrection | null): boolean => {
  if (a === undefined || b === null) return a === undefined && b === null;
  return a.kind === b.kind && (a.kind !== 'value' || (b.kind === 'value' && a.raw === b.raw));
};

export function createPlanReadingCorrectionsController<T>(depsOf: () => PlanReadingCorrectionsDeps<T>) {
  /** Μία αλλαγή για ένα κείμενο της τρέχουσας ανάγνωσης· `false` = δεν υπάρχει τέτοιο κείμενο ή ανάγνωση. */
  function commit(textId: string, requested: PlanReadingCorrection | null): boolean {
    const { run, reading, readingCorrections } = planRecognitionStore.get();
    if (!run || reading?.status !== 'read') return false;
    const machine = reading.reading.texts.find((t) => t.id === textId);
    if (!machine) return false;
    const { model } = reading.reading;
    const correction = requested?.kind === 'value' && requested.raw.trim() === machine.raw.trim() ? null : requested;
    const current = readingCorrections.model === model ? readingCorrections.byTextId[textId] : undefined;
    if (sameCorrection(current, correction)) return true;
    const next = withReadingCorrection(readingCorrections, model, textId, correction);
    const fusion = depsOf().fuse(run, reading, next);
    planRecognitionStore.patch({ readingCorrections: next, fusion });
    depsOf().publish(depsOf().lineSource(run, fusion));
    return true;
  }

  return {
    /** «Διόρθωση τιμής»: το κείμενο όπως γράφεται στο χαρτί (κενό ⇒ τίποτα). */
    correct(textId: string, raw: string): boolean {
      return raw.trim() === '' ? false : commit(textId, { kind: 'value', raw: raw.trim() });
    },

    /** «Δεν είναι διάσταση»: το κείμενο μένει ορατό, δεν γίνεται περιορισμός του λύτη. */
    markNotDimension(textId: string): boolean {
      return commit(textId, { kind: 'not-dimension' });
    },

    /** «Επαναφορά»: ισχύει πάλι ό,τι διάβασε η μηχανή. */
    revert(textId: string): boolean {
      return commit(textId, null);
    },

    /** Η γραμμή της λίστας που δείχνει ο άνθρωπος (επισήμανση στον καμβά)· `null` = καμία. */
    hover(textId: string | null): void {
      if (planRecognitionStore.get().readHoverTextId !== textId) planRecognitionStore.patch({ readHoverTextId: textId });
    },
  };
}
