/**
 * =============================================================================
 * Conveyance — οι απαιτήσεις εγγράφων μιας ΑΠΟΘΗΚΕΥΜΕΝΗΣ υπόθεσης (ADR-915 Φ4β)
 * =============================================================================
 *
 * `υπόθεση + γεγονότα → απαιτήσεις` — χωρίς συλλογή τεκμηρίων. Ο παραγωγός (`conveyanceRequirements`) δέχεται γραμμές·
 * εδώ αποφασίζεται **ποιες**: του προφίλ, **μείον** όσες ο άνθρωπος δήλωσε «δεν εφαρμόζεται» και όσες ο **ίδιος** κριτής
 * του καταλόγου (`checklistItemApplicability`) κρίνει ανεφάρμοστες. Αλλιώς το μητρώο θα έλεγε «σταματά η υπογραφή» για
 * γραμμή που η ίδια η υπόθεση έχει βγάλει από τη μέση.
 *
 * 🔑 Γεγονός **άγνωστο** ⇒ η απαίτηση **μένει**: η υπόθεση μπορεί να τη χρειαστεί, και η σιωπή θα ήταν «ισχύει».
 *
 * **Layering**: leaf — καθαρή συνάρτηση, μηδέν I/O, μηδέν ρολόι. Χωριστό αρχείο ώστε ο παραγωγός να μην εισάγει τον
 * `deriveChecklist` (που ήδη εισάγει εκείνον) — κανένας κύκλος.
 *
 * @module lib/conveyance/case-document-requirements
 */

import type { DocumentRequirement, RequirementAttestation } from '@/lib/document-validity/document-requirement';
import type { ConveyanceCase } from '@/types/conveyance-case';
import { caseRows, rowFacts, type CaseFacts, type CaseRow } from './case-rows';
import { conveyanceRequirements } from './conveyance-requirements';
import { checklistItemApplicability } from './derive-checklist';

type CaseRequirementSource = Pick<ConveyanceCase, 'id' | 'profile' | 'parties' | 'overrides' | 'subject' | 'targetSigningDate'>;

/**
 * ADR-915 Φ4δ Ε8 — ο **εγκεκριμένος** έλεγχος της γραμμής: ο επαγγελματίας δέχτηκε έγγραφο (αρχείο ή παραλαβή εκτός
 * πλατφόρμας). Απορριφθέν ⇒ `null`. ⚠️ Το αν ο έλεγχος έμεινε `stale` (νεότερο αρχείο μετά) το ξέρει μόνο ο κατάλογος με
 * τα τεκμήρια της υπόθεσης — δηλωμένο όριο του μητρώου (ADR-915 §11.5).
 */
function attestationOf(record: CaseRequirementSource, row: CaseRow): RequirementAttestation | null {
  const review = record.overrides[row.key]?.review;
  if (review?.verdict !== 'accepted') return null;
  return { fileId: review.fileId, issuedOn: review.issuedOn, printedValidUntil: review.printedValidUntil ?? null };
}

/**
 * @param facts — τα **επιλυμένα** γεγονότα της υπόθεσης και κάθε προσώπου (`resolveCaseFacts`), ίδια με του καταλόγου.
 *                ADR-915 §22: κάθε γραμμή κρίνεται με τα **δικά της** γεγονότα (`rowFacts`) — η εταιρεία-συμπωλητής
 *                θέλει ΕΦΚΑ από τον νόμο, ο ιδιώτης συμπωλητής μόνο αν απαντηθεί «ναι».
 *
 * 🔑 ADR-915 Φ4δ Ε7 — `required` **μόνο** όταν ο ίδιος κριτής λέει «εφαρμόζεται» (`true`). Γεγονός άγνωστο ⇒ η απαίτηση
 *    μένει (`tracked`), αλλά το μητρώο **δεν** γράφει «λείπει» για κάτι που ίσως δεν χρειάζεται.
 */
export function caseDocumentRequirements(record: CaseRequirementSource, facts: CaseFacts): readonly DocumentRequirement[] {
  const applicability = (row: CaseRow) => checklistItemApplicability(row.item, rowFacts(row, facts));
  const rows = caseRows(record).filter((row) => record.overrides[row.key]?.notApplicable === undefined && applicability(row) !== false);
  return conveyanceRequirements({
    rows,
    caseId: record.id,
    propertyId: record.subject.propertyId,
    targetSigningDate: record.targetSigningDate,
    presenceOf: (row) => (applicability(row) === true ? 'required' : 'tracked'),
    attestationOf: (row) => attestationOf(record, row),
  });
}
