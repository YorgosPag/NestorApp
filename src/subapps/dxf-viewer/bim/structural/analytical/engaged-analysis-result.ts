/**
 * Engaged-gated analysis result — store-coupled SSoT (ADR-491 / ADR-488).
 *
 * ΕΝΑ μέρος που εφαρμόζει το gate «**το FEM αποτέλεσμα μετράει ΜΟΝΟ όταν ο μηχανικός
 * παρατηρεί στατικά**» (`isAnalysisEngaged`, ADR-488 — Revit «analytical results enabled»):
 *   · engaged    → το τρέχον `AnalysisResultsStore.get()`.
 *   · μη-engaged → `EMPTY_ANALYSIS_RESULT` (μηδέν override → οι consumers πέφτουν σε e₀).
 *
 * **Γιατί SSoT:** το ίδιο gate το χρειάζονται ΚΑΙ ο render path (`active-reinforcement.
 * resolveActiveColumnFemMoment`) ΚΑΙ ο persisted path (`structural-auto-reinforce-core`).
 * Αν ζούσε copy-paste σε δύο σημεία, ένα θα μπορούσε να ξεχάσει το gate → render ≠ persisted
 * (stale FEM influence). Εδώ είναι **μία αλήθεια** → τα δύο path συμφωνούν πάντα.
 *
 * Pure store reads (zero firebase) → jest-safe & ADR-040 safe (low-freq, ΟΧΙ subscription).
 *
 * @see ./solver/analysis-results-store.ts — η πηγή (ungated)
 * @see ../../../state/analysis-diagram-view-store.ts — isAnalysisEngaged (το predicate)
 * @see ./column-fem-moment.ts — ο pure reader που καταναλώνει το (gated) αποτέλεσμα
 * @see docs/centralized-systems/reference/adrs/ADR-491-fem-driven-column-mn-reinforcement.md
 */

import { AnalysisResultsStore } from './solver/analysis-results-store';
import { EMPTY_ANALYSIS_RESULT, type AnalysisResult } from './solver/solver-types';
import { useAnalysisDiagramViewStore, isAnalysisEngaged } from '../../../state/analysis-diagram-view-store';

/** Το FEM αποτέλεσμα όταν ο μηχανικός παρατηρεί στατικά, αλλιώς κενό (μηδέν override). */
export function resolveEngagedAnalysisResult(): AnalysisResult {
  return isAnalysisEngaged(useAnalysisDiagramViewStore.getState())
    ? AnalysisResultsStore.get()
    : EMPTY_ANALYSIS_RESULT;
}
