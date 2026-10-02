'use client';

/**
 * **«Πριν → Τώρα»** (ADR-898 Φ3β-2): πώς άλλαξε η αντικειμενική της αγγελίας από την αρχή της επίσκεψης — όπως το
 * «Edit facts» της Zillow, αλλά **με τον νόμο**: τα όρια είναι ακριβώς ό,τι επιτρέπει ο νόμος, όχι εκτίμηση.
 *
 * 🔑 **Αφετηρία = η πρώτη απάντηση της μηχανής σε αυτή την επίσκεψη**, όχι η τελευταία αποθήκευση: μετά από κάθε
 *   «αποθηκεύτηκε» το «πριν» θα γινόταν ίσο με το «τώρα» και ο άνθρωπος δεν θα έβλεπε ποτέ τι κέρδισε.
 */

import React, { useState } from 'react';

import { useObjectiveValueAmountText } from '@/components/objective-value/ObjectiveValueEvaluated';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ObjectiveValueBounds } from '@/lib/objective-value/objective-value-bounds';

const NS = 'objective-value';
const I = `${NS}:improve.beforeAfter`;

export function ObjectiveValueBeforeAfter({ bounds }: { readonly bounds: ObjectiveValueBounds }) {
  const { t } = useTranslation([NS]);
  const [baseline] = useState(bounds);
  const labelOf = useObjectiveValueAmountText();
  const before = labelOf(baseline);
  const now = labelOf(bounds);
  if (now === null || before === now) return null;
  return (
    <aside aria-live="polite" className="flex flex-col gap-1 rounded-md border border-border bg-muted p-3">
      <span className="text-xs text-muted-foreground">{t(`${I}.title`)}</span>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {before !== null && (
          <>
            <dt className="text-muted-foreground">{t(`${I}.before`)}</dt>
            <dd className="m-0 tabular-nums text-muted-foreground line-through">{before}</dd>
          </>
        )}
        <dt className="font-medium text-foreground">{t(`${I}.now`)}</dt>
        <dd className="m-0 font-semibold tabular-nums text-foreground">{now}</dd>
      </dl>
    </aside>
  );
}
