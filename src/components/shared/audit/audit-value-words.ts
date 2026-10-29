/**
 * 🌐 Οι λέξεις του μορφοποιητή τιμών, λυμένες με το `t` του λεξιλογίου — ADR-195 (ζ)
 *
 * Το κομμάτι του `AuditValueFormat` που **δεν** αλλάζει ανά αλλαγή: πώς βγαίνει η λέξη μιας τιμής από κατάλογο, και
 * οι λίγες λέξεις που δεν είναι τιμές (Ναι/Όχι, «τ.μ.», «εσωτ.», «Φωτογραφία»). Κάθε κλειδί λύνεται με **ρητό** `ns`.
 *
 * @module components/shared/audit/audit-value-words
 */

import { AUDIT_VALUE_WORDS, type AuditValueWord } from '@/config/audit-value-vocabularies';
import type { AuditValueFormat } from './activity-tab-helpers';
import { translateCatalogValue, type AuditTranslator } from './audit-value-resolver';

export type AuditValueWords = Pick<AuditValueFormat, 'catalogWord' | 'word'>;

export function auditValueWords(t: AuditTranslator): AuditValueWords {
  return {
    catalogWord: (catalog, value) => translateCatalogValue(catalog, value, t),
    word: (word: AuditValueWord) => {
      const { ns, key } = AUDIT_VALUE_WORDS[word];
      return t(key, { ns });
    },
  };
}
