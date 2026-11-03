'use client';

/**
 * Η ζωντανή προεπισκόπηση του επεξεργαστή (ADR-928 Φ3γ απόφαση 4): το **ίδιο** μοντέλο εγγράφου της Φ3β πάνω στο
 * **τοπικό** πρόχειρο (`projectDraftAgreement`), άρα ό,τι φαίνεται εδώ είναι ό,τι θα παγώσει το `issue`.
 *
 * 🔑 `useDeferredValue`: η πληκτρολόγηση δεν περιμένει την απόδοση του εγγράφου (React 18 concurrent) — η φόρμα μένει
 *    άμεση, η προεπισκόπηση ακολουθεί μόλις ελευθερωθεί ο νήμα.
 * 🔑 Μέρος που περιμένει τον γραφέα (άλλος υπεργολάβος, ονομαστικοί οικοπεδούχοι) **δεν μαντεύεται**: φαίνεται η
 *    αποθηκευμένη τιμή με ορατή σημείωση «ενημερώνεται στην αποθήκευση».
 */

import { useDeferredValue } from 'react';
import { Info } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { AgreementDocumentColumns, AgreementPaymentCalendar } from '../document/AgreementDocumentColumns';
import type { AgreementEditor } from './useAgreementEditor';

export function AgreementLivePreview({ editor }: { readonly editor: AgreementEditor }) {
  const { t } = useTranslation('procurement');
  const projected = useDeferredValue(editor.projected);
  return (
    <section aria-labelledby="editor-preview" className="space-y-4">
      <h3 id="editor-preview" className="text-base font-semibold">{t('subcontracts.editor.preview.title')}</h3>
      {projected.stale.length > 0 && (
        <ul className="space-y-1 rounded-lg border bg-muted/40 p-3 text-sm">
          {projected.stale.map((part) => (
            <li key={part} className="flex items-center gap-2">
              <Info className="h-4 w-4 shrink-0" aria-hidden />
              {t(`subcontracts.editor.preview.stale.${part}`)}
            </li>
          ))}
        </ul>
      )}
      <AgreementDocumentColumns agreement={projected.agreement} />
      <AgreementPaymentCalendar agreement={projected.agreement} />
    </section>
  );
}
