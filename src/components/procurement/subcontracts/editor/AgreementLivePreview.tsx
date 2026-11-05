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
import type { DocumentEditHandler } from '../document/EditInFormButton';
import type { AgreementEditor } from './useAgreementEditor';

interface AgreementLivePreviewProps {
  readonly editor: AgreementEditor;
  /** Το μολύβι «Επεξεργασία» κάθε ενότητας/ρήτρας (§5.23). */
  readonly onEdit: DocumentEditHandler;
}

/** Ο τίτλος «Προεπισκόπηση εγγράφου» ζει στην κεφαλίδα της στήλης (`EditorSplitLayout`), μαζί με το «Μόνο έγγραφο». */
export function AgreementLivePreview({ editor, onEdit }: AgreementLivePreviewProps) {
  const { t } = useTranslation('procurement');
  const projected = useDeferredValue(editor.projected);
  return (
    <section aria-label={t('subcontracts.editor.preview.title')} className="space-y-4">
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
      <AgreementDocumentColumns agreement={projected.agreement} fit="width" onEdit={onEdit} />
      <AgreementPaymentCalendar agreement={projected.agreement} />
    </section>
  );
}
