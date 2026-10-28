'use client';

/**
 * Οι απαντήσεις στις ζητούμενες γραμμές (ADR-327 §8.5): **μία ανά γραμμή RFQ** — τιμή, «περιλαμβάνεται» ή
 * «εξαιρείται» (Procore Amount / Include / Exclude) — και κάτω από κάθε γραμμή οι εναλλακτικές που την αντικαθιστούν.
 * Η περιγραφή είναι της γραμμής RFQ: ο προμηθευτής δεν μετονομάζει το ζητούμενο, γράφει σημείωση.
 *
 * @module app/(auth)/vendor/quote/VendorPortalAnswers
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { VISIBLE_LINK_CLASS } from '@/lib/ui/link-style';
import type { PublicRfqLine } from '@/subapps/procurement/types/rfq-line';
import type { RfqResponseLock } from '@/subapps/procurement/types/rfq';
import { lockedFieldsOf } from '@/subapps/procurement/utils/rfq-response-lock';
import type { AlternateDraft, RfqAnswerDraft, RfqAnswerKind } from './types';
import type { VendorQuoteDraftActions } from './useVendorQuoteDraft';
import { VendorPortalLineFields } from './VendorPortalLineFields';
import { useVendorUomLabel } from './useVendorUomOptions';

const ANSWER_KINDS: readonly RfqAnswerKind[] = ['priced', 'included', 'excluded'];
const INPUT = 'mt-1 w-full rounded-md border border-border px-3 py-2 text-sm';

interface Props {
  rfqLines: readonly PublicRfqLine[];
  answers: readonly RfqAnswerDraft[];
  alternates: readonly AlternateDraft[];
  actions: VendorQuoteDraftActions;
  /** §8.5 Β — από τον server (`resolveResponseLock`). */
  responseLock: RfqResponseLock;
}

export function VendorPortalAnswers({ rfqLines, answers, alternates, actions, responseLock }: Props) {
  const byId = new Map(answers.map((a) => [a.rfqLineId, a] as const));
  return (
    <ol className="space-y-3">
      {rfqLines.map((rfqLine, index) => {
        const answer = byId.get(rfqLine.id);
        return answer ? (
          <AnswerRow
            key={rfqLine.id}
            position={index + 1}
            rfqLine={rfqLine}
            answer={answer}
            alternates={alternates.filter((a) => a.rfqLineId === rfqLine.id)}
            actions={actions}
            responseLock={responseLock}
          />
        ) : null;
      })}
    </ol>
  );
}

function AnswerRow({ position, rfqLine, answer, alternates, actions, responseLock }: {
  position: number;
  rfqLine: PublicRfqLine;
  answer: RfqAnswerDraft;
  alternates: readonly AlternateDraft[];
  actions: VendorQuoteDraftActions;
  responseLock: RfqResponseLock;
}) {
  const { t } = useTranslation(['vendor-portal']);
  const uomLabel = useVendorUomLabel();
  const update = (patch: Partial<RfqAnswerDraft>) => actions.updateAnswer(rfqLine.id, patch);
  return (
    <li className="rounded-md border border-border p-3">
      <header className="mb-2">
        <h3 className="text-sm font-semibold text-foreground">{position}. {rfqLine.description}</h3>
        {rfqLine.quantity != null && (
          <p className="text-xs text-muted-foreground">
            {t('vendor-portal:form.requested', { quantity: rfqLine.quantity, unit: uomLabel(rfqLine.unit) })}
          </p>
        )}
        {rfqLine.notes && <p className="mt-1 text-xs text-muted-foreground">{rfqLine.notes}</p>}
      </header>
      <AnswerChoice rfqLineId={rfqLine.id} value={answer.answer} onChange={(kind) => update({ answer: kind })} />
      {answer.answer === 'priced' && (
        <VendorPortalLineFields line={answer} onChange={update} locked={lockedFieldsOf(responseLock, rfqLine)} />
      )}
      <label className="mt-2 block">
        <span className="text-xs font-medium text-foreground">{t('vendor-portal:form.answerNote')}</span>
        <input
          value={answer.notes}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder={answer.answer === 'included'
            ? t('vendor-portal:form.answer.includedHint')
            : answer.answer === 'excluded' ? t('vendor-portal:form.answer.excludedHint') : ''}
          className={INPUT}
        />
      </label>
      <AlternateList rfqLine={rfqLine} alternates={alternates} actions={actions} />
    </li>
  );
}

function AnswerChoice({ rfqLineId, value, onChange }: {
  rfqLineId: string;
  value: RfqAnswerKind;
  onChange: (kind: RfqAnswerKind) => void;
}) {
  const { t } = useTranslation(['vendor-portal']);
  // ADR-877 §6 — κλειστό σύνολο ⇒ ΣΤΑΤΙΚΗ `t()` ανά μέλος.
  const label: Readonly<Record<RfqAnswerKind, string>> = {
    priced: t('vendor-portal:form.answer.priced'),
    included: t('vendor-portal:form.answer.included'),
    excluded: t('vendor-portal:form.answer.excluded'),
  };
  return (
    <fieldset className="mb-2 flex flex-wrap gap-2">
      <legend className="sr-only">{t('vendor-portal:form.answer.legend')}</legend>
      {ANSWER_KINDS.map((kind) => (
        <label
          key={kind}
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground has-[:checked]:border-primary has-[:checked]:bg-accent"
        >
          <input
            type="radio"
            name={`answer-${rfqLineId}`}
            value={kind}
            checked={value === kind}
            onChange={() => onChange(kind)}
          />
          {label[kind]}
        </label>
      ))}
    </fieldset>
  );
}

function AlternateList({ rfqLine, alternates, actions }: {
  rfqLine: PublicRfqLine;
  alternates: readonly AlternateDraft[];
  actions: VendorQuoteDraftActions;
}) {
  const { t } = useTranslation(['vendor-portal']);
  return (
    <section className="mt-3 space-y-2" aria-label={t('vendor-portal:form.alternate.title')}>
      {alternates.map((alt) => (
        <article key={alt.key} className="rounded-md border border-dashed border-border bg-muted p-3">
          <header className="mb-1 flex items-center justify-between">
            <h4 className="text-xs font-semibold text-foreground">{t('vendor-portal:form.alternate.title')}</h4>
            <button
              type="button"
              onClick={() => actions.removeAlternate(alt.key)}
              className={`text-xs text-destructive ${VISIBLE_LINK_CLASS}`}
            >
              {t('vendor-portal:form.alternate.remove')}
            </button>
          </header>
          <p className="mb-2 text-xs text-muted-foreground">{t('vendor-portal:form.alternate.hint')}</p>
          <label className="mb-2 block">
            <span className="text-xs font-medium text-foreground">{t('vendor-portal:form.description')}</span>
            <input
              value={alt.description}
              onChange={(e) => actions.updateAlternate(alt.key, { description: e.target.value })}
              className={INPUT}
              required
            />
          </label>
          <VendorPortalLineFields line={alt} onChange={(patch) => actions.updateAlternate(alt.key, patch)} />
        </article>
      ))}
      <button
        type="button"
        onClick={() => actions.addAlternate(rfqLine)}
        className={`text-xs font-medium text-foreground ${VISIBLE_LINK_CLASS}`}
      >
        + {t('vendor-portal:form.alternate.add')}
      </button>
    </section>
  );
}
