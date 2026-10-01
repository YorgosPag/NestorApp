'use client';

/**
 * **Οι συχνές ερωτήσεις, ορατές** (ADR-898 Φ2) — η ΙΔΙΑ λίστα με το `FAQPage` του JSON-LD (`OBJECTIVE_VALUE_FAQ`):
 * η Google απαιτεί το δομημένο περιεχόμενο να φαίνεται στη σελίδα.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { OBJECTIVE_VALUE_FAQ } from '@/lib/objective-value/objective-value-page-sections';

import { CalculatorStep } from './objective-value-inputs';

const NS = 'objective-value';

export function ObjectiveValueFaq() {
  const { t } = useTranslation([NS]);
  return (
    <CalculatorStep title={t(`${NS}:faq.title`)}>
      <dl className="m-0 flex flex-col gap-3">
        {OBJECTIVE_VALUE_FAQ.map((id) => (
          <React.Fragment key={id}>
            <dt className="text-sm font-semibold text-foreground">{t(`${NS}:faq.${id}.q`)}</dt>
            <dd className="m-0 text-sm text-muted-foreground">{t(`${NS}:faq.${id}.a`)}</dd>
          </React.Fragment>
        ))}
      </dl>
    </CalculatorStep>
  );
}
