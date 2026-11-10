'use client';

/**
 * @fileoverview **Πρόταση ΦΠΑ από τον πελάτη** — με την πηγή της, τα τεκμήρια, τις επιφυλάξεις και την ακριβή
 *   προεπισκόπηση του τι θα αλλάξει (ADR-ACC-003 §22.5).
 * @module subapps/accounting/components/invoices/forms/CustomerVatSuggestionNotice
 *
 * 🔑 Ο άνθρωπος αποφασίζει: «Εφαρμογή» / «Απόρριψη», και μετά την εφαρμογή «Αναίρεση». Τίποτα δεν αλλάζει μόνο του.
 * 🔑 Η παραπομπή είναι η **ίδια** με εκείνη που θα τυπωθεί στο PDF (`vatExemptionCitation`, έκδοση νόμου κατά την
 *    ημερομηνία έκδοσης).
 */

import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { countryLabelKey } from '@/utils/address/country-codes';
import {
  VAT_EXEMPTION_NAMESPACE,
  vatExemptionCitation,
} from '@/subapps/accounting/services/config/vat-exemption-reasons';
import type { CustomerVatSuggestion } from '@/subapps/accounting/services/tax/customer-vat-treatment';
import type { InvoiceType } from '@/subapps/accounting/types';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import type { CustomerVatLineChange } from './customer-vat-application';
import type { CustomerVatSuggestionControls } from './use-customer-vat-suggestion';

type Translate = ReturnType<typeof useTranslation>['t'];

interface CustomerVatSuggestionNoticeProps {
  readonly controls: CustomerVatSuggestionControls;
  readonly issueDate: string;
}

const NOTICE_CLASS = 'mt-4 rounded-lg border border-border p-4 space-y-2';

function countryName(t: Translate, code: string): string {
  const key = countryLabelKey(code);
  return key ? t(key) : code;
}

function SuggestionBasis({ t, suggestion, issueDate }: { t: Translate; suggestion: CustomerVatSuggestion; issueDate: string }) {
  const colors = useSemanticColors();
  const citation = vatExemptionCitation(t, suggestion.vatExemptionCategory, issueDate);
  return (
    <>
      <p className="text-sm">
        {t('invoices.vatSuggestion.proposal', { provision: citation.provision, law: citation.law })}
      </p>
      <p className={cn('text-xs', colors.text.muted)}>
        {t(`${VAT_EXEMPTION_NAMESPACE}:placeOfSupply.${suggestion.basis}`)}
      </p>
      <ul className={cn('list-disc pl-5 text-xs space-y-1', colors.text.muted)}>
        {suggestion.caveats.map((caveat) => (
          <li key={caveat}>{t(`${VAT_EXEMPTION_NAMESPACE}:placeOfSupply.caveats.${caveat}`)}</li>
        ))}
      </ul>
    </>
  );
}

function SuggestionPreview({ t, suggestion, changes, fromType }: {
  t: Translate; suggestion: CustomerVatSuggestion; changes: readonly CustomerVatLineChange[]; fromType: InvoiceType;
}) {
  const lines = changes.map((change) => change.lineNumber).join(', ');
  return (
    <ul className="text-sm space-y-1">
      {fromType !== suggestion.invoiceType && (
        <li>
          {t('invoices.vatSuggestion.typeChange', {
            from: t(`invoices.types.${fromType}`),
            to: t(`invoices.types.${suggestion.invoiceType}`),
          })}
        </li>
      )}
      <li>
        {changes.length > 0 ? t('invoices.vatSuggestion.linesChange', { lines }) : t('invoices.vatSuggestion.noLineChanges')}
      </li>
    </ul>
  );
}

export function CustomerVatSuggestionNotice({ controls, issueDate }: CustomerVatSuggestionNoticeProps) {
  const { t } = useTranslation(['accounting', VAT_EXEMPTION_NAMESPACE, 'common']);
  const colors = useSemanticColors();
  const titleId = useId();
  const { view, apply, dismiss, undo } = controls;

  if (view.status === 'hidden') return null;
  if (view.status === 'unknown_country') {
    return (
      <aside role="status" className={cn(NOTICE_CLASS, 'text-sm', colors.text.muted)}>
        {t('invoices.vatSuggestion.unknownCountry', { country: view.country })}
      </aside>
    );
  }
  if (view.status === 'applied') {
    return (
      <aside role="status" className={cn(NOTICE_CLASS, 'flex items-center justify-between gap-4')}>
        <p className="text-sm">{t('invoices.vatSuggestion.applied')}</p>
        <Button type="button" variant="outline" size="sm" onClick={undo}>{t('invoices.vatSuggestion.undo')}</Button>
      </aside>
    );
  }

  const { suggestion, changes, fromType } = view;
  return (
    <aside role="status" aria-labelledby={titleId} className={NOTICE_CLASS}>
      <h3 id={titleId} className="text-sm font-semibold">
        {t(`invoices.vatSuggestion.scenario.${suggestion.scenario}`, { country: countryName(t, suggestion.countryCode) })}
      </h3>
      <SuggestionBasis t={t} suggestion={suggestion} issueDate={issueDate} />
      <SuggestionPreview t={t} suggestion={suggestion} changes={changes} fromType={fromType} />
      <p className={cn('text-xs', colors.text.muted)}>{t('invoices.vatSuggestion.disclaimer')}</p>
      <footer className="flex gap-2">
        <Button type="button" size="sm" onClick={apply}>{t('invoices.vatSuggestion.apply')}</Button>
        <Button type="button" variant="outline" size="sm" onClick={dismiss}>{t('invoices.vatSuggestion.dismiss')}</Button>
      </footer>
    </aside>
  );
}
