'use client';

/**
 * Η κατάσταση κάθε μετάφρασης μιας έκδοσης ως σήμα — «Αγγλικά · μπαγιάτικη» (ADR-928 §5.2.2 · Φ3γ-0). Το όνομα της
 * γλώσσας από το `Intl.DisplayNames` στη γλώσσα του UI: καμία λίστα ονομάτων γλωσσών να συντηρείται.
 */

import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { translationRowsOf } from '@/subapps/procurement/subcontracts/library/translation-status';
import type { SubcontractClauseVersion } from '@/subapps/procurement/subcontracts/types/clause';
import { TRANSLATION_STATE_VARIANT } from './library-labels';

/** Το όνομα μιας γλώσσας στη γλώσσα του UI (π.χ. `en` → «Αγγλικά»), με εφεδρεία τον κωδικό. */
export function useLanguageName(): (language: string) => string {
  const { i18n } = useTranslation('procurement');
  const names = new Intl.DisplayNames([i18n.language], { type: 'language' });
  return (language) => names.of(language) ?? language;
}

export function TranslationBadges({ version }: { readonly version: Pick<SubcontractClauseVersion, 'sourceHash' | 'translations'> }) {
  const { t } = useTranslation('procurement');
  const languageName = useLanguageName();
  return (
    <ul className="m-0 flex list-none flex-wrap gap-1 p-0">
      {translationRowsOf(version).map((row) => (
        <li key={row.language}>
          <Badge variant={TRANSLATION_STATE_VARIANT[row.state]}>{languageName(row.language)} · {t(`subcontracts.library.translations.state.${row.state}`)}</Badge>
        </li>
      ))}
    </ul>
  );
}
