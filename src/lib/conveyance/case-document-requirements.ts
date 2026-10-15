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

import { itemsForProfile } from '@/config/conveyance-checklist/catalog';
import type { DocumentRequirement } from '@/lib/document-validity/document-requirement';
import type { ConveyanceCase } from '@/types/conveyance-case';
import { conveyanceRequirements } from './conveyance-requirements';
import { checklistItemApplicability } from './derive-checklist';
import type { FactValues } from './derive-facts';

export type CaseRequirementSource = Pick<ConveyanceCase, 'id' | 'profile' | 'overrides' | 'subject' | 'targetSigningDate'>;

/**
 * @param facts — τα **επιλυμένα** γεγονότα (`resolveFacts(deriveFacts(…), record.facts)`), ίδια με του καταλόγου.
 */
export function caseDocumentRequirements(record: CaseRequirementSource, facts: FactValues): readonly DocumentRequirement[] {
  const items = itemsForProfile(record.profile).filter((item) =>
    record.overrides[item.id]?.notApplicable === undefined && checklistItemApplicability(item, facts) !== false);
  return conveyanceRequirements({
    items,
    caseId: record.id,
    propertyId: record.subject.propertyId,
    targetSigningDate: record.targetSigningDate,
  });
}
