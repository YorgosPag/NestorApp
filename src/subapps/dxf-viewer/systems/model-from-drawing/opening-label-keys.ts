/**
 * ADR-911 Φ4-3β — τα i18n κλειδιά των ανοιγμάτων του βοηθού, ΕΝΑ σημείο για τους δύο αναγνώστες
 * (φύλλο καμβά · πάνελ). Κάθε κλειδί γράφεται ΡΗΤΑ, όχι συναρμολογημένο: το CHECK 3.8 βλέπει ότι
 * υπάρχουν όλα, και ο τύπος `Record` αρνείται να μεταγλωττιστεί αν ο πυρήνας αποκτήσει νέο λόγο
 * χωρίς κείμενο.
 *
 * ΚΑΘΑΡΟ (pure).
 */

import type { OpeningDecisionReason, OpeningProposalStatus } from '../../bim/model-from-drawing/opening-proposal';
import type { OpeningReviewChoice } from '../../bim/model-from-drawing/opening-review';
import type { AddOpeningsRefusal } from '../../bim/model-from-drawing/add-openings-to-scene';

export const OPENING_STATUS_LABEL_KEY: Readonly<Record<OpeningProposalStatus, string>> = {
  door: 'modelFromDrawing.openings.status.door',
  window: 'modelFromDrawing.openings.status.window',
  'needs-decision': 'modelFromDrawing.openings.status.needs-decision',
  existing: 'modelFromDrawing.openings.status.existing',
};

export const OPENING_CHOICE_LABEL_KEY: Readonly<Record<OpeningReviewChoice, string>> = {
  door: 'modelFromDrawing.openings.choice.door',
  window: 'modelFromDrawing.openings.choice.window',
  none: 'modelFromDrawing.openings.choice.none',
};

/** Γιατί ρωτήθηκε ο άνθρωπος. */
export const OPENING_REASON_LABEL_KEY: Readonly<Record<OpeningDecisionReason, string>> = {
  'not-a-door-arc': 'modelFromDrawing.openings.reason.not-a-door-arc',
  'no-jamb': 'modelFromDrawing.openings.reason.no-jamb',
  'jambs-not-drawn': 'modelFromDrawing.openings.reason.jambs-not-drawn',
  'frame-implausible': 'modelFromDrawing.openings.reason.frame-implausible',
  'host-undetermined': 'modelFromDrawing.openings.reason.host-undetermined',
  'sparse-symbol': 'modelFromDrawing.openings.reason.sparse-symbol',
  'no-symbol': 'modelFromDrawing.openings.reason.no-symbol',
};

/** Γιατί το σχέδιο εγγραφής (ή ο γραφέας) αρνείται ολόκληρη την παρτίδα. */
export const OPENING_REFUSAL_LABEL_KEY: Readonly<Record<AddOpeningsRefusal, string>> = {
  overlap: 'modelFromDrawing.openings.planRefusal.overlap',
  'invalid-opening': 'modelFromDrawing.openings.planRefusal.invalid-opening',
  'missing-host-wall': 'modelFromDrawing.openings.planRefusal.missing-host-wall',
  'unmergeable-run': 'modelFromDrawing.openings.planRefusal.unmergeable-run',
  'invalid-host-wall': 'modelFromDrawing.openings.planRefusal.invalid-host-wall',
  'nothing-to-write': 'modelFromDrawing.openings.planRefusal.nothing-to-write',
  'no-active-scene': 'modelFromDrawing.openings.planRefusal.no-active-scene',
};
