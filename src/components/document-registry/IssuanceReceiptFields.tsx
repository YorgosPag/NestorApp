'use client';

/**
 * @fileoverview ADR-915 §42 · ADR-943 Φ5δ — **τα πεδία ενός παραστατικού**: ΜΑΡΚ myDATA + ημέρα έκδοσης. Ένα συστατικό για
 *   το τελικό παραστατικό (γραφείο) και για το παραστατικό της προκαταβολής (γραφείο · μηχανικός) — το ποσό **δεν** είναι
 *   πεδίο: το λέει η συμφωνία ή ό,τι εισπράχθηκε.
 * @related RegistryIssuanceQuoteForms.tsx (`ReceiptForm`) · RegistryIssuanceAdvanceReceipt.tsx · EngagedAdvanceReceipt.tsx
 * @module components/document-registry/IssuanceReceiptFields
 */

import React, { useId, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { conveyanceToday } from '@/lib/conveyance/conveyance-calendar';
import { MYDATA_MARK_PATTERN } from '@/lib/document-validity/issuance-quote';
import { REGISTRY_NS } from '@/components/document-registry/document-registry-labels';
import { RECEIPT_KEYS } from '@/components/document-registry/issuance-labels';

export interface ReceiptDraft {
  readonly mark: string;
  readonly issuedOn: string;
}

/** Το πρόχειρο + η κρίση «στέκει;» — η ΙΔΙΑ μορφή ΜΑΡΚ με το σύνορο (`MYDATA_MARK_PATTERN`). */
export function useReceiptDraft() {
  const [draft, setDraft] = useState<ReceiptDraft>(() => ({ mark: '', issuedOn: conveyanceToday() }));
  const valid = MYDATA_MARK_PATTERN.test(draft.mark.trim()) && draft.issuedOn !== '';
  return { draft, setDraft, valid, value: { mark: draft.mark.trim(), issuedOn: draft.issuedOn } };
}

export function IssuanceReceiptFields({ draft, onChange }: { readonly draft: ReceiptDraft; readonly onChange: (next: ReceiptDraft) => void }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const markId = useId();
  const dateId = useId();
  return (
    <>
      <Label htmlFor={markId} className="text-sm font-medium">{t(RECEIPT_KEYS.markLabel)}</Label>
      <Input id={markId} inputMode="numeric" autoComplete="off" maxLength={15} value={draft.mark} onChange={(event) => onChange({ ...draft, mark: event.target.value })} />
      <Label htmlFor={dateId} className="text-sm font-medium">{t(RECEIPT_KEYS.issuedOnLabel)}</Label>
      <Input id={dateId} type="date" value={draft.issuedOn} max={conveyanceToday()} onChange={(event) => onChange({ ...draft, issuedOn: event.target.value })} />
    </>
  );
}
