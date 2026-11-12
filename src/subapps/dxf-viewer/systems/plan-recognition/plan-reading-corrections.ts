/**
 * ADR-929 Δ21 (δ) — οι **διορθώσεις τιμών** του ανθρώπου μέσα στον ελεγκτή της αναγνώρισης. Υπο-module του ενός γραφέα του
 * `planRecognitionStore` (`planRecognitionSession.corrections`), όπως το `plan-ocr-controller`.
 *
 * Κύκλος: κλικ σε γραμμή της λίστας «Τι διάβασα» → `correct` · `markNotDimension` · `confirm` · `revert` → νέο σύνολο διορθώσεων στο
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
  effectiveReadingCorrection,
  previewReadingCorrection,
  withReadingCorrection,
  type PlanCorrectionPreview,
  type PlanReadingCorrection,
  type PlanReadingCorrections,
} from '../../bim/plan-recognition/reading/reading-corrections';
import type { Point2D } from '../../rendering/types/Types';
import type { RasterPlacement } from '../../floorplan-background/geometry/raster-scene-mapping';
import { sceneTextRing } from './plan-overlay-geometry';
import { planRecognitionStore, type PlanRecognitionRun } from './plan-recognition-store';

export interface PlanReadingCorrectionsDeps<T> {
  /** Η σύντηξη του ιδιοκτήτη με **ρητές** διορθώσεις (καθαρή). */
  readonly fuse: (run: PlanRecognitionRun, reading: PlanReadingOutcome | null, corrections: PlanReadingCorrections) => PlanFusionResult;
  /** Νέα έκδοση πηγής γραμμών για αποτέλεσμα που **ήδη** γράφτηκε στο store. */
  readonly lineSource: (run: PlanRecognitionRun, fusion: PlanFusionResult) => T;
  /** Παράδοση στον βοηθό: πηγή που δεν ζήτησε άμεσα ο wiring. */
  readonly publish: (source: T) => void;
  /** Βήμα 2 — η τοποθέτηση του υποβάθρου ενός ορόφου, διαβασμένη τη στιγμή της πράξης· `null` = κανένα. */
  readonly placement: (floorId: string) => RasterPlacement | null;
}

/** Βήμα 2 — πού να πάει η όψη: το πλαίσιο του κειμένου στη σκηνή, και αν κρατιέται το ζουμ του ανθρώπου. */
export interface PlanReadFocusTarget {
  readonly points: readonly Point2D[];
  readonly preserveZoom: boolean;
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
    const correction = effectiveReadingCorrection(machine, requested);
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

    /** Βήμα 3 — «Σωστό ✓»: η μηχανή διάβασε σωστά· προέλευση «άνθρωπος», βεβαιότητα 1, ίδιο κείμενο. */
    confirm(textId: string): boolean {
      return commit(textId, { kind: 'confirmed' });
    },

    /** «Επαναφορά»: ισχύει πάλι ό,τι διάβασε η μηχανή. */
    revert(textId: string): boolean {
      return commit(textId, null);
    },

    /**
     * Βήμα 5 — τι **θα** γινόταν το κείμενο αν αποθηκευόταν τώρα το `raw` (ζωντανή ερμηνεία στο πεδίο). Μόνο ανάγνωση:
     * τίποτα δεν γράφεται, καμία σύντηξη. Διαβάζει το store τη στιγμή της κλήσης (getter, ποτέ στιγμιότυπο).
     */
    preview(textId: string, raw: string): PlanCorrectionPreview | null {
      const { reading, readingCorrections } = planRecognitionStore.get();
      return reading?.status === 'read' ? previewReadingCorrection(reading.reading, readingCorrections, textId, raw) : null;
    },

    /**
     * Βήμα 2 — «Εστίαση στην πηγή»: το πλαίσιο του κειμένου στη **σκηνή** (η ΙΔΙΑ αντιστοίχιση px → σκηνή με την
     * επισήμανση, `sceneTextRing`) και αν είναι επόμενο άλμα αυτής της ανάγνωσης (`preserveZoom`). Θυμάται το κείμενο·
     * την κίνηση της όψης την κάνει ο καλών (`focusReviewTarget`). `null` = άγνωστο κείμενο ή χωρίς υπόβαθρο.
     */
    focusTarget(textId: string): PlanReadFocusTarget | null {
      const { run, reading, readFocusTextId } = planRecognitionStore.get();
      const text = reading?.status === 'read' ? reading.reading.texts.find((t) => t.id === textId) : undefined;
      const placement = run ? depsOf().placement(run.floorId) : null;
      if (!text || !placement) return null;
      planRecognitionStore.patch({ readFocusTextId: textId });
      return { points: sceneTextRing(text.rect, placement), preserveZoom: readFocusTextId !== null };
    },

    /** Η γραμμή της λίστας που δείχνει ο άνθρωπος (επισήμανση στον καμβά)· `null` = καμία. */
    hover(textId: string | null): void {
      if (planRecognitionStore.get().readHoverTextId !== textId) planRecognitionStore.patch({ readHoverTextId: textId });
    },
  };
}
