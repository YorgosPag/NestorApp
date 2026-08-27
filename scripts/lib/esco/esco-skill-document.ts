/**
 * ADR-132 — **ΤΟ ΕΓΓΡΑΦΟ ΔΕΞΙΟΤΗΤΑΣ**.
 *
 * 🔑 Οι δεξιότητες **δεν έχουν** κωδικό ISCO *(είναι δια-επαγγελματικές)*, οπότε
 * εδώ δεν υπάρχει το ερώτημα του `esco-occupation-document`. Ό,τι μοιράζονται τα
 * δύο λεξιλόγια — συγκομιδή, τοκενιστής, κορμός εγγράφου, id, γραφή, πύλη — ζει
 * στα κοινά module· αυτό που **διαφέρει** ζει εδώ. Και επειδή εδώ δεν διαφέρει
 * τίποτα, το αρχείο είναι **σχεδόν άδειο**: αυτό είναι το σωστό μέγεθος.
 *
 * @module scripts/lib/esco/esco-skill-document
 */

import type { EscoSkillDocument } from '../../../src/types/contacts/esco-types';
import type { EscoSearchResult } from './esco-api';
import {
  escoDocumentBase,
  createLabelTally,
  labelTallyNotes,
} from './esco-document-base';
import type { EscoTransformResult } from './esco-import-runner';

/**
 * Μετασχηματίζει έννοιες ESCO σε έγγραφα δεξιοτήτων, **με κλειστή λογιστική**.
 *
 * ⚠️ Δεξιότητα **χωρίς καμία** ετικέτα παραλείπεται· η παράλειψη μετριέται από
 * τον δρομέα *(δηλωμένα − έγγραφα)*, ποτέ δεν εξαφανίζεται.
 */
export function transformSkills(
  concepts: readonly EscoSearchResult[],
): EscoTransformResult<EscoSkillDocument> {
  const labels = createLabelTally();
  const documents: EscoSkillDocument[] = [];

  for (const concept of concepts) {
    const base = escoDocumentBase(concept, labels);
    if (base !== null) documents.push(base);
  }

  return { documents, notes: labelTallyNotes(labels), warnings: [] };
}
