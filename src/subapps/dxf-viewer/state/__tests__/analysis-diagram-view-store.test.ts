/**
 * isAnalysisEngaged — ADR-488 SSoT predicate tests.
 *
 * Ο FEM solver είναι «ζωντανός» (proactive re-solve) όταν ο μηχανικός παρατηρεί
 * στατικά: ρητό latch «Ανάλυση» Ή οποιοδήποτε results overlay ορατό. Αλλιώς dormant.
 */

import { isAnalysisEngaged, type AnalysisEngagedState } from '../analysis-diagram-view-store';

const OFF: AnalysisEngagedState = {
  analysisLive: false,
  showAnalysisDiagrams: false,
  showUtilization: false,
};

describe('isAnalysisEngaged (ADR-488)', () => {
  it('dormant όταν τίποτα δεν είναι ενεργό (διατηρεί την απόφαση κόστους ADR-481)', () => {
    expect(isAnalysisEngaged(OFF)).toBe(false);
  });

  it('engaged όταν το ρητό latch «Ανάλυση» είναι οπλισμένο', () => {
    expect(isAnalysisEngaged({ ...OFF, analysisLive: true })).toBe(true);
  });

  it('engaged όταν το overlay διαγραμμάτων M/V/N είναι ορατό', () => {
    expect(isAnalysisEngaged({ ...OFF, showAnalysisDiagrams: true })).toBe(true);
  });

  it('engaged όταν το overlay επάρκειας (utilization) είναι ορατό', () => {
    expect(isAnalysisEngaged({ ...OFF, showUtilization: true })).toBe(true);
  });

  it('engaged όταν πολλαπλές πηγές είναι ταυτόχρονα ενεργές', () => {
    expect(
      isAnalysisEngaged({ analysisLive: true, showAnalysisDiagrams: true, showUtilization: true }),
    ).toBe(true);
  });
});
