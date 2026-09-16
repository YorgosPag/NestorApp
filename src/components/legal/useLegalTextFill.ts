'use client';

/**
 * Συμπληρωτής θέσεων τιμών (`{agency}` · `{expiresOn}`). Χωρίς τιμές ⇒ ονομασμένες ετικέτες.
 * ⚠️ Ρητές κλήσεις `t('…')` — ο σαρωτής του route slice (ADR-744) δεν βλέπει αναζητήσεις σε χάρτη.
 *
 * 🔑 **Χωριστό module (ADR-864 Φ3)**: η φόρμα συναίνεσης στο `/mandate/[token]` χρειάζεται **μόνο**
 * αυτό· μέσα από το `LegalDocumentBody` θα έσερνε στη στατική κλειστότητα της σελίδας και την
 * ταυτότητα φορέα — μετρημένο στο CHECK 3.34.
 *
 * @module components/legal/useLegalTextFill
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { fillLegalText, type PlaceholderValues } from '@/lib/legal/legal-text-placeholders';

export function useLegalTextFill(values: PlaceholderValues = {}): (text: string) => string {
  const { t } = useTranslation('legal');
  const labels = { agency: t('versions.placeholders.agency'), expiresOn: t('versions.placeholders.expiresOn') };
  return (text) => fillLegalText(text, values, labels);
}
