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
    at: field.at,
    snapshotValue: field.rawValue,
  } as const;

  const target = DRAWING_FIELD_BY_KEY[field.key];
  if (!target) return { ...base, candidates: [], blockedBy: 'unsupported-field' };

  // 🔴 Φ3β: ΑΝΑΓΝΩΡΙΣΜΕΝΟ ΑΛΛΑ ΜΗ ΕΓΓΡΑΨΙΜΟ — και **φαίνεται**, δεν κρύβεται (§8 κανόνας 3).
  //
  // Το `DxfLevelDocument` (`api/dxf-levels/dxf-levels.types.ts:3-15`) **δεν έχει** `scale`,
  // `studyDate` ή `drawingType`, και το `UpdateDxfLevelSchema` κλείνει με **`.passthrough()`**
  // (`dxf-levels.schemas.ts:138`) ⇒ ένα άγνωστο πεδίο θα γραφόταν **αβασάνιστο**, χωρίς σχήμα,
  // χωρίς όριο μήκους, χωρίς κανέναν να το έχει δηλώσει. Αυτό είναι ακριβώς το είδος σιωπής που
  // αυτό το ADR κυνηγά — άρα ο σωστός χειρισμός δεν είναι «γράψ' το όπως-όπως», αλλά **δήλωσε
  // ότι δεν χωράει ακόμη**.
  //
  // ⚠️ Το `scale` **δεν** πάει στο `bimRenderSettings.drawingScale` παρότι «ταιριάζει»: εκείνο
  // είναι η **δική μας** κλίμακα απόδοσης (οδηγεί πάχη γραμμών και μεγέθη συμβόλων), όχι η
  // κλίμακα του **ξένου** τοπογραφικού. Θα ήταν ψέμα με σωστή μορφή, ένα επίπεδο πιο πάνω.
  //
  // Ο στόχος `drawing-meta` **παραμένει στον τύπο** και ο χάρτης παραπάνω μένει ζωντανός: η Φ4
  // (Λ3 Projection) κατέχει το level και θα δώσει τα πεδία. Μέχρι τότε η πρόταση είναι ορατή,
  // με τη δική της αιτία — ώστε η μέρα που θα αποκτήσει πεδίο να φαίνεται σε κάποιον.
  return { ...base, candidates: [], blockedBy: 'not-yet-writable' };
}
