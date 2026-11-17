'use client';

/**
 * @fileoverview ADR-915 §42 — οι **φόρμες** του γραφείου για την προσφορά: καταγραφή προσφοράς (ή της μίας αναθεώρησης
 *   μετά την αυτοψία) που ήρθε εκτός συνδέσμου, και καταγραφή του παραστατικού (ΜΑΡΚ myDATA). Φορτώνονται με
 *   `next/dynamic` **μόνο όταν ανοίξει ο διάλογος** (CHECK 3.34).
 * @related RegistryIssuanceDialogs.tsx (το κέλυφος) · IssuanceQuoteFields.tsx (τα ΙΔΙΑ πεδία με τη σελίδα-σύνδεσμο)
 * @module components/document-registry/RegistryIssuanceQuoteForms
 *
 * 🔑 **Το παραστατικό δεν έχει δικό του ποσό**: το σύνολο **είναι** η εγκεκριμένη τιμή. Αν η πραγματικότητα διαφέρει,
 *    καταγράφεται πρώτα αναθεώρηση — ποτέ δεύτερο ποσό για την ίδια δουλειά.
 */

import React, { useId, useState } from 'react';

import { DialogActionFooter } from '@/components/ui/dialog-action-footer';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ISSUANCE_NOTE_MAX } from '@/lib/document-validity/issuance-assignment';
import { useIssuanceAssignmentActions } from '@/components/document-registry/issuance-assignment-context';
import { IssuanceReceiptFields, useReceiptDraft } from '@/components/document-registry/IssuanceReceiptFields';
import { IssuanceQuoteFields } from '@/components/document-registry/IssuanceQuoteFields';
import { emptyQuoteDraft, quoteTermsFromDraft, type QuoteDraft } from '@/components/document-registry/issuance-quote-draft';
import { issuanceTargetOf, type RegistryIssuanceView } from '@/components/document-registry/registry-issuance';
import { REGISTRY_NS } from '@/components/document-registry/document-registry-labels';
import { ISSUANCE_KEYS, PROPOSE_KEYS, QUOTE_KEYS, RECEIPT_KEYS } from '@/components/document-registry/issuance-labels';

interface FormProps {
  readonly view: RegistryIssuanceView;
  readonly close: () => void;
}

export function QuoteRecordForm({ view, close }: FormProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const actions = useIssuanceAssignmentActions();
  const [draft, setDraft] = useState<QuoteDraft>(() => emptyQuoteDraft());
  const [note, setNote] = useState('');
  const noteId = useId();
  const terms = quoteTermsFromDraft(draft);
  const submit = () => {
    if (actions === null || terms === null) return;
    close();
    actions.act({ action: 'record-quote', ...issuanceTargetOf(view), terms, note: note.trim() || null });
  };
  return (
    <>
      <IssuanceQuoteFields draft={draft} onChange={setDraft} />
      <Label htmlFor={noteId} className="text-sm font-medium">{t(QUOTE_KEYS.noteLabel)}</Label>
      <Textarea id={noteId} value={note} maxLength={ISSUANCE_NOTE_MAX} onChange={(event) => setNote(event.target.value)} />
      <DialogActionFooter
        cancelLabel={t(PROPOSE_KEYS.cancel)} confirmLabel={t(QUOTE_KEYS.submit)} busyLabel={t(ISSUANCE_KEYS.saving)}
        onCancel={close} onConfirm={submit} isSubmitting={false} canSubmit={terms !== null}
      />
    </>
  );
}

/**
 * Το παραστατικό στο γραφείο — το **τελικό** (`record-receipt`, σύνολο = συμφωνία − προκαταβολή) ή, ADR-943 Φ5δ, της
 * **προκαταβολής** (`record-advance-receipt`, σύνολο = ό,τι εισπράχθηκε). Ίδια πεδία, ίδια φόρμα.
 */
export function ReceiptForm({ view, close, totalMinor, purpose = 'final' }: FormProps & { readonly totalMinor: number; readonly purpose?: 'final' | 'advance' }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const actions = useIssuanceAssignmentActions();
  const { draft, setDraft, valid, value } = useReceiptDraft();
  const submit = () => {
    if (actions === null || !valid) return;
    close();
    actions.act({ action: purpose === 'advance' ? 'record-advance-receipt' : 'record-receipt', ...issuanceTargetOf(view), ...value, totalMinor });
  };
  return (
    <>
      <IssuanceReceiptFields draft={draft} onChange={setDraft} />
      <DialogActionFooter
        cancelLabel={t(PROPOSE_KEYS.cancel)} confirmLabel={t(RECEIPT_KEYS.submit)} busyLabel={t(ISSUANCE_KEYS.saving)}
        onCancel={close} onConfirm={submit} isSubmitting={false} canSubmit={valid}
      />
    </>
  );
}
