/**
 * ADR-929 Δ20 Σ1.3β — τα i18n κλειδιά της στρώσης «Διαστάσεις» του βοηθού, ΕΝΑ σημείο για τους δύο αναγνώστες
 * (προεπισκόπηση πάνελ · ειδοποίηση έγκρισης). Κάθε κλειδί γράφεται ΡΗΤΑ, όχι συναρμολογημένο: το CHECK 3.8 βλέπει
 * ότι υπάρχουν όλα, και ο τύπος `Record` αρνείται να μεταγλωττιστεί αν η πόρτα του layer αποκτήσει νέο λόγο άρνησης
 * χωρίς κείμενο (ίδιο σχήμα με το `opening-label-keys.ts`).
 *
 * Οι λόγοι «άκυρο όνομα» **δεν** ξαναγράφονται: είναι τα ίδια κείμενα με τη μετονομασία layer στο πάνελ στρώσεων
 * (`dxf-viewer-panels:layerValidation.*`, ο ίδιος validator AutoCAD-strict). Ένα κείμενο ανά λόγο σε όλη την εφαρμογή.
 *
 * ΚΑΘΑΡΟ (pure).
 */

import type { NamedLayerRefusal } from '../../services/named-layer';

/** Γιατί δεν γράφονται (ή δεν θα γραφτούν) οι διαστάσεις. */
export const DIMENSION_LAYER_REFUSAL_LABEL_KEY: Readonly<Record<NamedLayerRefusal, string>> = {
  'no-scene': 'modelFromDrawing.dimensions.refusal.no-scene',
  'no-layer': 'modelFromDrawing.dimensions.refusal.no-layer',
  EMPTY: 'dxf-viewer-panels:layerValidation.EMPTY',
  WHITESPACE_ONLY: 'dxf-viewer-panels:layerValidation.WHITESPACE_ONLY',
  LEADING_TRAILING_WS: 'dxf-viewer-panels:layerValidation.LEADING_TRAILING_WS',
  TOO_LONG: 'dxf-viewer-panels:layerValidation.TOO_LONG',
  INVALID_CHARS: 'dxf-viewer-panels:layerValidation.INVALID_CHARS',
  RESERVED: 'dxf-viewer-panels:layerValidation.RESERVED',
  DUPLICATE: 'dxf-viewer-panels:layerValidation.DUPLICATE',
};
