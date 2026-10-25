/**
 * =============================================================================
 * ΤΟ ΑΠΟΤΥΠΩΜΑ ΕΙΣΟΔΩΝ ΤΗΣ ΠΛΗΡΟΤΗΤΑΣ — η μπαγιατίλα ΑΠΟΔΕΙΚΝΥΕΤΑΙ, δεν γράφεται (Δ7)
 * =============================================================================
 *
 * Το Akeneo, όταν αλλάξουν οι απαιτήσεις μιας οικογένειας, ξαναγράφει την πληρότητα **κάθε**
 * προϊόντος της (ασύγχρονη εργασία) — και ως τότε δείχνει παλιό ποσοστό **χωρίς να το ξέρει**.
 * Εδώ κάθε αποθηκευμένη πληρότητα κουβαλά το αποτύπωμα των εισόδων της· η ανάγνωση ξαναϋπολογίζει
 * **μόνο** το αποτύπωμα (φθηνό, σύγχρονο) και αν διαφέρει ξέρει ότι το νούμερο είναι μπαγιάτικο —
 * χωρίς καμία εγγραφή σε χιλιάδες έγγραφα. Η εργασία επανυπολογισμού (2β) είναι ιδεμπότητη **ανά
 * αποτύπωμα**: ό,τι έχει ήδη το τρέχον, παραλείπεται.
 *
 * 🔑 **Τι μπαίνει — και τι επίτηδες ΟΧΙ**:
 *   - ✅ ανά ιδιότητα της οικογένειας: υποχρεωτικά κανάλια · `localizable` · `scopable` (αλλάζουν
 *     **ποια θέση** διαβάζεται) · ύπαρξη στη βιβλιοθήκη · **επίπεδο** (ποιος την κατέχει)·
 *   - ✅ οι γλώσσες κάθε καναλιού (ρυθμίσεις χώρου)·
 *   - ✅ οι **αναθεωρήσεις** όλης της αλυσίδας (ρίζα · υπο-μοντέλο · SKU) — οι τιμές των προγόνων
 *     μετρούν στην πληρότητα του SKU·
 *   - ✅ η **έκδοση της μηχανής**: αλλαγή αλγορίθμου ⇒ όλα μπαγιάτικα, ρητά·
 *   - ❌ ετικέτες, περιγραφές, κανόνες, πίνακας: μια μετονομασία οικογένειας **δεν** πρέπει να
 *     στείλει 10.000 προϊόντα σε επανυπολογισμό που θα έδινε το ίδιο αποτέλεσμα.
 *
 * Hash: FNV-1a 64 (`lib/hash/fnv1a.ts`) — σύγχρονο (η ερώτηση γίνεται σε render), όχι κρυπτογραφικό
 * (μια σύγκρουση = ένα μπαγιάτικο νούμερο ως την επόμενη εγγραφή, πιθανότητα ~5·10⁻²⁰).
 *
 * @module subapps/catalog/completeness/inputs-hash
 */

import { fnv1a64Hex } from '@/lib/hash/fnv1a';
import type { CatalogAttributeDefinition } from '../types/attribute';
import type { CatalogSettingsDefinition } from '../types/catalog-settings';
import type { CatalogFamilyDefinition, VariantScheme } from '../types/family';
import { attributeOwnerDepth } from '../values/attribute-levels';
import type { InheritanceLink } from '../values/resolve-inherited';
import { CATALOG_CHANNELS } from '../vocabulary/channels';

/** Αλλάζει ⇒ κάθε αποθηκευμένη πληρότητα κρίνεται μπαγιάτικη. Ανέβασέ το σε κάθε αλλαγή του αλγορίθμου. */
export const COMPLETENESS_ENGINE_VERSION = 1;

export interface CompletenessHashInput {
  readonly family: CatalogFamilyDefinition;
  readonly attributes: ReadonlyMap<string, CatalogAttributeDefinition>;
  readonly settings: CatalogSettingsDefinition;
  readonly scheme: VariantScheme | null;
  /** Η αλυσίδα **με** τον ίδιο τον φορέα (ρίζα → φύλλο). */
  readonly chain: ReadonlyArray<Pick<InheritanceLink, 'id' | 'kind' | 'revision'>>;
}

const sorted = <T extends string>(items: readonly T[]): T[] => [...items].sort();

function requirementsOf(input: CompletenessHashInput): unknown[] {
  return input.family.attributes.map((binding) => {
    const attribute = input.attributes.get(binding.attributeId);
    return [
      binding.attributeId,
      sorted(binding.requiredChannels),
      attribute ? [attribute.localizable, attribute.scopable] : null,
      attributeOwnerDepth(input.scheme, binding.attributeId),
    ];
  });
}

/** Το αποτύπωμα — `c<έκδοση>:<16 hex>`. Ίδιες είσοδοι ⇒ ίδιο αποτύπωμα σε κάθε μηχανή JS. */
export function completenessInputsHash(input: CompletenessHashInput): string {
  const material = JSON.stringify([
    COMPLETENESS_ENGINE_VERSION,
    requirementsOf(input),
    CATALOG_CHANNELS.map((channel) => [channel, sorted(input.settings.channelLocales[channel])]),
    input.chain.map((link) => [link.kind, link.id, link.revision]),
  ]);
  return `c${COMPLETENESS_ENGINE_VERSION}:${fnv1a64Hex(material)}`;
}

/** Είναι μπαγιάτικη η αποθηκευμένη πληρότητα; (`null` = δεν υπολογίστηκε ποτέ ⇒ μπαγιάτικη.) */
export function isCompletenessStale(storedHash: string | null, input: CompletenessHashInput): boolean {
  return storedHash !== completenessInputsHash(input);
}
