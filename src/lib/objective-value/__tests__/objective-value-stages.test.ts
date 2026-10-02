/**
 * ADR-898 Φ4 — τα στάδια του νόμου όπως τα «φτάνει» ένα κτίριο: μετρά το ΟΛΟΚΛΗΡΩΜΕΝΟ (άρθ. 3 §9), η παροχή ρεύματος
 * τεκμαίρει αποπεράτωση (άρθ. 2 §24), τα παρακολουθήματα δεν έχουν θεμελίωση/δάπεδα (άρθ. 6 §8 · 7 §8).
 */

import {
  ancillaryCompletionOf,
  LEGAL_STAGES,
  residenceCompletionOf,
  stageReached,
  type LegalStage,
} from '../objective-value-stages';
import { ANCILLARY_COMPLETIONS, RESIDENCE_COMPLETIONS } from '../objective-value-types';

const done = (legalStage: LegalStage) => ({ legalStage, status: 'completed' });
const open = (legalStage: LegalStage) => ({ legalStage, status: 'inProgress' });

describe('stageReached', () => {
  it('καμία φάση με ετικέτα ⇒ `null` (το χρονοδιάγραμμα δεν απαντά — όχι «καθόλου»)', () => {
    expect(stageReached([])).toBeNull();
    expect(stageReached([{ status: 'completed' }, { legalStage: null, status: 'completed' }])).toBeNull();
  });

  it('στάδιο σε εξέλιξη ΔΕΝ μετρά — μετρά το τελευταίο ολοκληρωμένο', () => {
    expect(stageReached([done('foundation'), done('frame'), open('masonry')])).toBe('frame');
  });

  it('ετικέτες χωρίς ολοκλήρωση ούτε του πρώτου ⇒ `none`', () => {
    expect(stageReached([open('foundation'), open('frame')])).toBe('none');
  });

  it('συντηρητικό: ολοκληρωμένα επιχρίσματα με τοιχοποιία ανοιχτή ⇒ σκελετός', () => {
    expect(stageReached([done('frame'), open('masonry'), done('plaster')])).toBe('frame');
  });

  it('όλες οι φάσεις του ίδιου σταδίου πρέπει να έχουν κλείσει', () => {
    expect(stageReached([done('frame'), open('frame')])).toBe('none');
  });

  it('η παροχή ρεύματος υπερισχύει (άρθ. 2 §24 «θεωρούνται αποπερατωμένα»)', () => {
    expect(stageReached([done('frame'), open('flooring'), done('electricity')])).toBe('electricity');
  });
});

describe('στάδιο κτιρίου → στάδιο εντύπου', () => {
  it('κατοικία: ένα προς ένα · ρεύμα ⇒ πλήρης · `none` ⇒ κανένα έντυπο', () => {
    const mapped = LEGAL_STAGES.map(residenceCompletionOf);
    expect(mapped).toEqual(['foundation', 'frame', 'masonry', 'plaster', 'flooring', 'complete']);
    expect(mapped.every((stage) => stage !== null && RESIDENCE_COMPLETIONS.includes(stage))).toBe(true);
    expect(residenceCompletionOf('none')).toBeNull();
  });

  it('παρακολουθήματα: χωρίς θεμελίωση (⇒ `null`) · δάπεδα ⇒ επιχρίσματα · ρεύμα ⇒ πλήρης', () => {
    expect(LEGAL_STAGES.map(ancillaryCompletionOf)).toEqual([null, 'frame', 'masonry', 'plaster', 'plaster', 'complete']);
    expect(ANCILLARY_COMPLETIONS).not.toContain('foundation');
    expect(ancillaryCompletionOf('none')).toBeNull();
  });
});
