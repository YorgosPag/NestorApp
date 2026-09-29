/**
 * @fileoverview **ΟΙ ΛΕΞΕΙΣ ΤΟΥ ΘΟΛΩΜΑΤΟΣ ΣΤΟΝ ΕΠΕΞΕΡΓΑΣΤΗ** — αρνήσεις του γραφέα στις εντολές `redact/unredact`
 * (ADR-884 Φ2ζ · §4.15 · AIP-193 λεξιλόγιο ανά λειτουργία).
 * @related `tour-shape-labels.ts` (`tourGraphRefusalKey` — η ΜΙΑ διαμέριση που το διαβάζει) ·
 *   `lib/spatial-tour/tour-refusal-vocabulary.ts` (`TOUR_REDACTION_REFUSALS`)
 * @module components/spatial-tour/editor/tour-redaction-labels
 *
 * 🔑 Χωριστά σύμβολα για τον ίδιο λόγο με τις αρνήσεις σχημάτων (CHECK 3.34): τις ζητά **μόνο** ο επεξεργαστής.
 * ⛔ Κάθε κλειδί ολόγραφο με `spatial-tour:` (βλ. `spatial-tour-labels.ts`).
 */

import type { TourRedactionRefusal } from '@/lib/spatial-tour/tour-refusal-vocabulary';

export const TOUR_REDACTION_REFUSAL_KEY: Readonly<Record<TourRedactionRefusal, string>> = {
  'redaction-invalid': 'spatial-tour:refusal.redactionInvalid',
  'redaction-absent': 'spatial-tour:refusal.redactionAbsent',
  'redaction-exists': 'spatial-tour:refusal.redactionExists',
  'redaction-limit': 'spatial-tour:refusal.redactionLimit',
};

/**
 * Τα μηνύματα επιτυχίας των εντολών `redact/unredact/redactions` — λένε **και** ότι το σημείο ξαναψήνεται (είναι κρυφό ως τότε) —
 * και οι λέξεις του πινέλου θολώματος (ζ3).
 */
export const TOUR_REDACTION_KEYS = {
  redactionSaved: 'spatial-tour:editor.redactionSaved',
  redactionRemoved: 'spatial-tour:editor.redactionRemoved',
  applied: 'spatial-tour:editor.blur.applied',
  title: 'spatial-tour:editor.blur.title',
  hint: 'spatial-tour:editor.blur.hint',
  brush: 'spatial-tour:editor.blur.brush',
  brushHint: 'spatial-tour:editor.blur.brushHint',
  atReticle: 'spatial-tour:editor.blur.atReticle',
  empty: 'spatial-tour:editor.blur.empty',
  item: 'spatial-tour:editor.blur.item',
  itemAuto: 'spatial-tour:editor.blur.itemAuto',
  itemDraft: 'spatial-tour:editor.blur.itemDraft',
  size: 'spatial-tour:editor.blur.size',
  remove: 'spatial-tour:editor.blur.remove',
  removing: 'spatial-tour:editor.blur.removing',
  handleMove: 'spatial-tour:editor.blur.handleMove',
  handleResize: 'spatial-tour:editor.blur.handleResize',
  apply: 'spatial-tour:editor.blur.apply',
  applyNote: 'spatial-tour:editor.blur.applyNote',
  discard: 'spatial-tour:editor.blur.discard',
  rebaking: 'spatial-tour:editor.blur.rebaking',
  rebakingHint: 'spatial-tour:editor.blur.rebakingHint',
  rebakeFailed: 'spatial-tour:editor.blur.rebakeFailed',
  rebakingSection: 'spatial-tour:editor.blur.rebakingSection',
} as const;
