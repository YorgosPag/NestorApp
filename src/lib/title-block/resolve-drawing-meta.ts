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
  /**
   * Απόν όταν το σχέδιο δεν είναι δεμένο σε έργο.
   *
   * 🔴 **Η τιμή ανήκει στο φύλλο, η ΑΠΟΔΕΙΞΗ όμως χρειάζεται έργο.** Το `TitleBlockBinding`
   * κουβαλά **υποχρεωτικό** `projectId` επειδή το διαβάζει ο καταρράκτης διαγραφής έργου
   * (`deletion-registry.ts:441`) — το `target` είναι ένωση και το Firestore δεν ερωτά μέσα σε
   * ένωση. Χωρίς έργο, η έγκριση θα άφηνε **ορφανή προέλευση**: εγγραφή που βεβαιώνει ποιος
   * ενέκρινε τι, και που κανένας μηχανισμός δεν μπορεί ποτέ να βρει ξανά.
   *
   * ⇒ Δεν γράφουμε «σχεδόν σωστά». Δηλώνουμε `no-project`, που έχει **ενέργεια** («δέσε το
   * σχέδιο»), σε αντίθεση με το παλιό `not-yet-writable` που δεν είχε καμία.
   */
  readonly projectId?: string;
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

  // 🔴 **ADR-759 Φ3 — ΕΓΓΡΑΨΙΜΟ.** Μέχρι τη Φ3β αυτή η γραμμή επέστρεφε `not-yet-writable`, και
  // ήταν σωστή: το `DxfLevelDocument` δεν είχε `scale`/`studyDate`/`drawingType`/`drawingNumber`.
  // Τώρα τα έχει — σε **τρεις** θέσεις (τύπος · `UpdateDxfLevelSchema` · allowlist του handler),
  // γιατί δύο από τις τρεις δίνουν «επιτυχία» χωρίς αποθήκευση.
  //
  // Η κατάσταση `not-yet-writable` **αφαιρέθηκε** αντί να μείνει αδρανής: είχε **έναν** παραγωγό,
  // αυτόν εδώ. Ένα μέλος ένωσης που κανείς δεν μπορεί πια να φτάσει είναι το ίδιο ελάττωμα που
  // αυτή η φάση διορθώνει στο `no-primary-address` (ADR-759 §4.4).
  if (!context.projectId) return { ...base, candidates: [], blockedBy: 'no-project' };

  return {
    ...base,
    // Κενή μαρτυρία **επίτηδες**: η τιμή διαβάστηκε, δεν ταιριάστηκε — δεν τίθεται ερώτημα
    // ταυτότητας. Ίδια σύμβαση με τον δήμο/το Ο.Τ. στο `resolve-location`.
    candidates: [
      {
        target: {
          kind: 'drawing-meta',
          levelId: context.levelId,
          projectId: context.projectId,
          field: target,
          value: field.rawValue,
        },
        label: field.rawValue,
        evidence: [],
      },
    ],
  };
}
