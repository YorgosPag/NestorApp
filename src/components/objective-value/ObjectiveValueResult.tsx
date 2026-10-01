'use client';

/**
 * **Βήμα 4 — το αποτέλεσμα** (ADR-898 §4.2, §6 · Φ2): το ποσό **και** το «γιατί» — κάθε συντελεστής με την παραπομπή
 * του στον νόμο, όπως τον επέστρεψε η μηχανή. Η οθόνη **δεν** πολλαπλασιάζει τίποτα· μόνο διαβάζει.
 *
 * 🔑 **Πάντα «αντικειμενική (ενδεικτική)», ποτέ «αξία του ακινήτου»**, και πάντα η αποποίηση με τον σύνδεσμο στο
 * myPROPERTY: η φορολογητέα αξία οριστικοποιείται εκεί, και δεν είναι εκτίμηση αγοραίας αξίας (ADR-889 §7).
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency, formatNumber } from '@/lib/intl-formatting';
import { AADE_MYPROPERTY_URL } from '@/lib/objective-value/objective-value-page-sections';
import { missingOf } from '@/lib/objective-value/objective-value-draft';
import type { AppliedFactor, ComputedObjectiveValue, ObjectiveValueResult as Result } from '@/lib/objective-value/objective-value-types';
import { VISIBLE_LINK_CLASS } from '@/lib/ui/link-style';

import { CalculatorStep } from './objective-value-inputs';

const NS = 'objective-value';
const R = `${NS}:result`;


function FactorRow({ factor }: { readonly factor: AppliedFactor }) {
  const { t } = useTranslation([NS]);
  const level = factor.level === undefined ? '' : ` ${t(`${R}.levelSuffix`, { number: factor.level + 1 })}`;
  return (
    <tr className="border-t border-border">
      <th scope="row" className="py-1 pr-3 text-left font-normal">{`${t(`${R}.factors.${factor.key}`)}${level}`}</th>
      <td className="py-1 pr-3 tabular-nums">{formatNumber(factor.factor, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
      <td className="py-1 text-xs text-muted-foreground">{factor.ref}</td>
    </tr>
  );
}

/** «Πώς προέκυψε» — κοινό με την αγγελία (ADR-898 Φ3): η ανάλυση της μηχανής, ποτέ δεύτερος πολλαπλασιασμός. */
export function ObjectiveValueBreakdown({ result }: { readonly result: ComputedObjectiveValue }) {
  const { t } = useTranslation([NS]);
  return (
    <details>
      <summary className="cursor-pointer text-sm font-medium text-foreground">{t(`${R}.breakdown`)}</summary>
      <p className="m-0 mt-2 text-sm text-foreground">
        {t(`${R}.base`, { price: formatCurrency(result.zonePrice), area: formatNumber(result.area) })}
      </p>
      <table className="mt-2 w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th scope="col" className="pr-3 font-medium">{t(`${R}.factorColumn`)}</th>
            <th scope="col" className="pr-3 font-medium">{t(`${R}.valueColumn`)}</th>
            <th scope="col" className="font-medium">{t(`${R}.refColumn`)}</th>
          </tr>
        </thead>
        <tbody>
          {result.factors.map((factor, index) => (
            <FactorRow key={`${factor.key}-${factor.level ?? 'all'}-${index}`} factor={factor} />
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** Τι λείπει ή τι δεν επιτρέπεται — κοινό με την αγγελία (ADR-898 Φ3). */
export function ObjectiveValuePending({ result }: { readonly result: Result }) {
  const { t } = useTranslation([NS]);
  const missing = missingOf(result);
  return (
    <>
      {result.kind === 'invalid' && (
        <>
          <p className="m-0 text-sm font-medium text-foreground">{t(`${R}.invalid`)}</p>
          <ul className="m-0 list-disc pl-5 text-sm text-foreground">
            {result.problems.map((problem) => <li key={problem}>{t(`${R}.problems.${problem}`)}</li>)}
          </ul>
        </>
      )}
      {missing.length > 0 && (
        <p className="m-0 text-sm text-muted-foreground">
          {t(`${R}.pending`, { fields: missing.map((key) => t(`${R}.missing.${key}`)).join(', ') })}
        </p>
      )}
    </>
  );
}

export function ObjectiveValueResult({ result, commercialityAssumed }: { readonly result: Result; readonly commercialityAssumed: boolean }) {
  const { t } = useTranslation([NS]);
  return (
    <CalculatorStep title={t(`${R}.title`)} className="rounded-md border border-border bg-card p-4">
      {/* `role="status"` και όχι `<output>`: οι ελλείψεις είναι παράγραφοι και λίστα, που το `<output>` δεν δέχεται. */}
      <div role="status" className="flex flex-col gap-1">
        {result.kind === 'computed' ? (
          <>
            <span className="text-sm text-muted-foreground">{t(`${R}.label`)}</span>
            <span className="text-2xl font-semibold tabular-nums text-foreground">{formatCurrency(result.value)}</span>
          </>
        ) : (
          <ObjectiveValuePending result={result} />
        )}
      </div>
      {result.kind === 'computed' && commercialityAssumed && (
        <p className="m-0 text-sm text-foreground">{t(`${NS}:questions.commercialityFactor.assumed`)}</p>
      )}
      {result.kind === 'computed' && <ObjectiveValueBreakdown result={result} />}
      <p className="m-0 text-xs text-muted-foreground">{t(`${R}.disclaimer`)}</p>
      <a href={AADE_MYPROPERTY_URL} target="_blank" rel="noopener noreferrer" className={`self-start text-sm ${VISIBLE_LINK_CLASS}`}>
        {t(`${R}.myProperty`)}
      </a>
    </CalculatorStep>
  );
}
