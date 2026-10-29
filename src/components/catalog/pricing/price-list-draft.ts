/**
 * **Το πρόχειρο της καρτέλας «Γενικά» ενός τιμοκαταλόγου** — καθαρό μοντέλο (ADR-923 §5.11 «3δ» Τμήμα 1).
 * @related server/catalog/price-list-writer.server.ts (ο γραφέας: οι ΙΔΙΟΙ τρεις έλεγχοι, εδώ πριν από την αποστολή)
 * @module components/catalog/pricing/price-list-draft
 *
 * 🔑 **Η ίδια επικύρωση με τον γραφέα** (`validatePriceList`) + οι δύο έλεγχοι που ο γραφέας κάνει μέσα στη συναλλαγή:
 *    - **κλείδωμα νοήματος**: είδος και τύπος τιμής δεν αλλάζουν όταν υπάρχει έκδοση (`typeLockedInUse`) — μια
 *      δημοσιευμένη λίστα «καθαρής πελάτη» δεν γίνεται σιωπηλά «λίστας» που δέχεται εκπτώσεις·
 *    - **ασάφεια κοινού**: δύο λίστες πώλησης στο ίδιο κοινό (`priceListAudienceAmbiguous`) — ίδιο κλειδί υποδοχής με
 *      τον γραφέα (`priceListAudienceSlotKey`), άρα ένα γνωστό 422 δεν στέλνεται ποτέ.
 * 🔑 Η λίστα **κόστους** δεν έχει κοινό: η αλλαγή είδους σε `cost` το καθαρίζει (αλλιώς ο άνθρωπος θα έβλεπε εύρημα για
 *    πεδίο που η φόρμα του κρύβει).
 */

import { priceListAudienceSlotKey } from '@/subapps/catalog/pricing/pricing-keys';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import { validatePriceList } from '@/subapps/catalog/schema/validate-pricing';
import type { PriceAudience, PriceListDefinition } from '@/subapps/catalog/types/price-list';
import type { PriceListWire } from '@/subapps/catalog/types/pricing-views';
import type { PriceListKind } from '@/subapps/catalog/vocabulary/pricing';

export function emptyPriceListDraft(): PriceListDefinition {
  return { code: '', labels: {}, kind: 'sales', priceType: 'net_list', audience: null, changeFenceBp: null };
}

/** Μόνο τα πεδία του ορισμού — ποτέ τα μεταδεδομένα της εγγραφής μέσα στο σώμα αιτήματος. */
export function priceListDraftOf(record: PriceListWire): PriceListDefinition {
  const { code, labels, kind, priceType, audience, changeFenceBp } = record;
  return { code, labels, kind, priceType, audience, changeFenceBp };
}

/** Αλλαγή είδους: η λίστα κόστους δεν προσφέρεται σε κοινό. */
export function withPriceListKind(draft: PriceListDefinition, kind: PriceListKind): PriceListDefinition {
  return { ...draft, kind, audience: kind === 'cost' ? null : draft.audience };
}

export interface PriceListDraftContext {
  /** Οι ομάδες πελατών του χώρου (για αναφορά κοινού `customerGroup`). */
  readonly customerGroupIds: ReadonlySet<string>;
  /** Όλες οι ζωντανές λίστες του χώρου — για την ασάφεια κοινού. */
  readonly lists: readonly PriceListWire[];
  /** Η αποθηκευμένη λίστα (`null` = νέα). */
  readonly record: PriceListWire | null;
  /** Η λίστα έχει έκδοση ⇒ είδος και τύπος τιμής κλειδώνουν. */
  readonly hasVersions: boolean;
}

function lockedMeaningIssues(draft: PriceListDefinition, context: PriceListDraftContext): CatalogIssue[] {
  const { record } = context;
  if (record === null || !context.hasVersions) return [];
  const issues: CatalogIssue[] = [];
  if (record.kind !== draft.kind) issues.push({ code: 'typeLockedInUse', path: 'kind' });
  if (record.priceType !== draft.priceType) issues.push({ code: 'typeLockedInUse', path: 'priceType' });
  return issues;
}

function audienceAmbiguityIssues(draft: PriceListDefinition, context: PriceListDraftContext): CatalogIssue[] {
  if (draft.kind !== 'sales' || draft.audience === null) return [];
  const slot = priceListAudienceSlotKey(draft.audience);
  const taken = context.lists.some(
    (other) =>
      other.id !== context.record?.id &&
      !other.isDeleted &&
      other.kind === 'sales' &&
      other.audience !== null &&
      priceListAudienceSlotKey(other.audience) === slot,
  );
  return taken ? [{ code: 'priceListAudienceAmbiguous', path: 'audience' }] : [];
}

/**
 * Συνεργάτης χωρίς επιλεγμένο συμβαλλόμενο — ο γραφέας θα έλεγε `unknownParty` (κενό id δεν υπάρχει). Ένας έλεγχος για
 * κάθε κοινό: λίστας **και** συνθήκης έκπτωσης.
 */
export function audiencePartyPresenceIssues(audience: PriceAudience | null): CatalogIssue[] {
  const party = audience?.kind === 'partner' ? audience.party : null;
  const missing = party !== null && (party.kind === 'contact' ? party.contactId : party.companyId) === '';
  return missing ? [{ code: 'unknownParty', path: 'audience.party' }] : [];
}

/** Τα ευρήματα του προχείρου — ό,τι θα έλεγε ο γραφέας, πριν από την αποστολή. */
export function priceListDraftIssues(draft: PriceListDefinition, context: PriceListDraftContext): readonly CatalogIssue[] {
  return [
    ...validatePriceList(draft, { customerGroupIds: context.customerGroupIds }),
    ...audiencePartyPresenceIssues(draft.audience),
    ...lockedMeaningIssues(draft, context),
    ...audienceAmbiguityIssues(draft, context),
  ];
}
