/**
 * @fileoverview Λ2 — μεταδεδομένα **σχεδίου** (κλίμακα, χρόνος, αριθμός, είδος).
 *
 * Αυτά **δεν αγγίζουν το έργο** (ADR-745 §7): ανήκουν στο φύλλο, όχι στο ακίνητο. Ένα έργο έχει
 * δεκάδες σχέδια σε διαφορετικές κλίμακες και ημερομηνίες — γράφοντάς τα στο έργο, το τελευταίο
 * που ανοίγεις θα ξανάγραφε το προηγούμενο, σιωπηλά.
 *
 * Δεν τίθεται ερώτημα ταυτότητας: η τιμή **διαβάστηκε**, δεν ταιριάστηκε. Γι' αυτό οι υποψήφιοι
 * εδώ έχουν κενή μαρτυρία — και ένας μόνο ο καθένας.
 *
 * @module lib/title-block/resolve-drawing-meta
 */

import type { BindableDrawingField, BindingProposal } from '@/types/title-block-binding';
import type { TitleBlockField, TitleBlockFieldKey } from '@/types/title-block-reading';

/**
 * Ποιο κλειδί της πινακίδας γίνεται ποιο μεταδεδομένο σχεδίου.
 *
 * Ρητός χάρτης και όχι «ίδιο όνομα άρα ίδιο πράγμα»: τα δύο λεξιλόγια ανήκουν σε διαφορετικά
 * υποσυστήματα και μπορούν να αποκλίνουν χωρίς να το μάθει κανείς.
 */
const DRAWING_FIELD_BY_KEY: Partial<Record<TitleBlockFieldKey, BindableDrawingField>> = {
  scale: 'scale',
  studyDate: 'studyDate',
  drawingNumber: 'drawingNumber',
  drawingType: 'drawingType',
};

export interface DrawingMetaResolveContext {
  readonly levelId: string;
  readonly titleBlockIndex: number;
}

/** Το πεδίο είναι μεταδεδομένο σχεδίου; (Ο διαχωρισμός ζει **εδώ**, όχι σπαρμένος στη σύνθεση.) */
export function isDrawingMetaField(key: TitleBlockFieldKey): boolean {
  return key in DRAWING_FIELD_BY_KEY;
}

export function resolveDrawingMetaProposal(
  field: TitleBlockField,
  context: DrawingMetaResolveContext,
): BindingProposal {
  const base = {
    fieldKey: field.key,
    titleBlockIndex: context.titleBlockIndex,
    sourceHandle: field.sourceHandle,
    labelHandle: field.labelHandle,
    snapshotValue: field.rawValue,
  } as const;

  const target = DRAWING_FIELD_BY_KEY[field.key];
  if (!target) return { ...base, candidates: [], blockedBy: 'unsupported-field' };

  return {
    ...base,
    candidates: [
      {
        target: { kind: 'drawing-meta', levelId: context.levelId, field: target, value: field.rawValue },
        label: field.rawValue,
        evidence: [],
      },
    ],
  };
}
