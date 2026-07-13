/**
 * ADR-650 M7 — `buildSurveyDeliverables`: ο ΚΑΘΑΡΟΣ πυρήνας του «ένα κουμπί → φάκελος».
 *
 * Παίρνει ό,τι ΥΠΑΡΧΕΙ ήδη (σημεία, όριο, η ΜΙΑ παράγωγη επιφάνεια, οι όγκοι του M6, οι δηλωμένες
 * τιμές του τίτλου) και επιστρέφει τα παραδοτέα ως **δεδομένα**: τιτλοφορημένοι πίνακες + τα
 * μετρημένα μεγέθη του οικοπέδου + η ετυμηγορία ανοχών. **Καμία** παρενέργεια: δεν αγγίζει σκηνή,
 * δεν κατεβάζει αρχείο, δεν διαβάζει store. Έτσι το ίδιο αποτέλεσμα τροφοδοτεί ΚΑΙ τους πίνακες
 * μέσα στο σχέδιο ΚΑΙ το ZIP — μία αλήθεια, δύο έξοδοι (Απόφαση §12.5).
 *
 * Ό,τι λείπει ΔΕΝ σιωπά: επιστρέφεται ως `warnings`, ώστε ο μηχανικός να δει «δεν υπάρχει όριο →
 * δεν έγινε εμβαδομέτρηση» αντί για έναν φάκελο που λείπει μισός χωρίς εξήγηση.
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { ExportableTableSection } from '../../../bim/schedule/types';
import type { TinSampler } from '../tin-sampler';
import type { CutFillResult, TopoPoint } from '../topo-types';
import {
  runToleranceChecks,
  toleranceVerdict,
  type DeclaredPlot,
  type ToleranceCheck,
  type ToleranceStatus,
} from './greek-survey-rules';
import {
  buildCoordinateTable,
  buildPlotMeasurements,
  buildToleranceTable,
  buildVolumeTable,
  type PlotMeasurements,
  type ToleranceLabels,
  type VolumeLabels,
} from './survey-tables';

/** Οι ήδη μεταφρασμένες επικεφαλίδες των τεσσάρων ενοτήτων του φακέλου. */
export interface SectionTitles {
  readonly coordinates: string;
  readonly plot: string;
  readonly volumes: string;
  readonly tolerance: string;
}

/** Ό,τι χρειάζεται ο πυρήνας — όλα δεδομένα, κανένα store. */
export interface SurveyDeliverablesInput {
  readonly points: readonly TopoPoint[];
  /** Το όριο οικοπέδου (M6 Γ). `null` ⇒ δεν έγινε εμβαδομέτρηση ούτε έλεγχος ανοχών. */
  readonly boundary: readonly Point2D[] | null;
  /** Δειγματολήπτης της ΜΙΑΣ παράγωγης επιφάνειας — για το Ζ των κορυφών. */
  readonly sampler: TinSampler;
  /** Το αποτέλεσμα του M6. `null` ⇒ δεν έχουν τρέξει όγκοι. */
  readonly cutFill: CutFillResult | null;
  readonly declared: DeclaredPlot;
  readonly titles: SectionTitles;
  readonly volumeLabels: VolumeLabels;
  readonly toleranceLabels: ToleranceLabels;
}

/** Γιατί ο φάκελος βγήκε ελλιπής — i18n key suffixes κάτω από `topography.deliverables.warn.*`. */
export type DeliverableWarning = 'no-points' | 'no-boundary' | 'no-volumes';

export interface SurveyDeliverables {
  /** Οι πίνακες, με τη σειρά που τους διαβάζει ο μηχανικός. Άδειες ενότητες παραλείπονται. */
  readonly sections: readonly ExportableTableSection[];
  /** Εμβαδόν + περίμετρος + πίνακας κορυφών. `null` όταν δεν έχει οριστεί όριο. */
  readonly plot: PlotMeasurements | null;
  readonly checks: readonly ToleranceCheck[];
  readonly verdict: ToleranceStatus;
  readonly warnings: readonly DeliverableWarning[];
}

export function buildSurveyDeliverables(input: SurveyDeliverablesInput): SurveyDeliverables {
  const { points, boundary, sampler, cutFill, declared, titles } = input;

  const sections: ExportableTableSection[] = [];
  const warnings: DeliverableWarning[] = [];

  if (points.length === 0) warnings.push('no-points');
  else sections.push({ title: titles.coordinates, table: buildCoordinateTable(points) });

  const plot = boundary && boundary.length >= 3 ? buildPlotMeasurements(boundary, sampler) : null;
  if (plot) sections.push({ title: titles.plot, table: plot.table });
  else warnings.push('no-boundary');

  if (cutFill) {
    sections.push({ title: titles.volumes, table: buildVolumeTable(cutFill, input.volumeLabels) });
  } else {
    warnings.push('no-volumes');
  }

  // Χωρίς μετρημένο οικόπεδο δεν υπάρχει τι να συγκριθεί με τον τίτλο — κανένας έλεγχος,
  // ποτέ ψεύτικο «πέρασε».
  const checks = plot
    ? runToleranceChecks({ areaM2: plot.areaM2, perimeterM: plot.perimeterM }, declared)
    : [];
  if (checks.length > 0) {
    sections.push({
      title: titles.tolerance,
      table: buildToleranceTable(checks, input.toleranceLabels),
    });
  }

  return { sections, plot, checks, verdict: toleranceVerdict(checks), warnings };
}
