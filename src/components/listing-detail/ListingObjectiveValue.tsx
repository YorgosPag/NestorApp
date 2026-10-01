'use client';

/**
 * **Η αντικειμενική αξία της αγγελίας** (ADR-898 Φ3) — μέσα στην ενότητα της ζώνης, κάτω από την τιμή ζώνης.
 *
 * Τρεις μορφές, όλες από τον server (`ListingObjectiveValue`) — η οθόνη **δεν** πολλαπλασιάζει τίποτα:
 * - **ποσό** με την ανάλυση της μηχανής (κάθε συντελεστής με παραπομπή στον νόμο)·
 * - **όρια** «από Χ έως Υ» και **από τι εξαρτώνται** (πρόσοψη, μέτωπο, θέρμανση…) — ακριβώς ό,τι επιτρέπει ο νόμος·
 * - **τι λείπει**, όταν το άγνωστο δεν απαριθμείται.
 * Σε κάθε μορφή: οι **δηλωμένες υποθέσεις**, η αποποίηση (myPROPERTY) και σύνδεσμος στον υπολογιστή **ήδη
 * συμπληρωμένο** από την αγγελία — ο αγοραστής απαντά μόνο όσα έμειναν ανοιχτά.
 *
 * 🔑 **Πάντα «αντικειμενική (ενδεικτική)», ποτέ «αξία του ακινήτου»** (ADR-889 §7 · ADR-898 §6).
 */

import React from 'react';

import { ObjectiveValueLink } from '@/components/objective-value/ObjectiveValueLink';
import { ObjectiveValueBreakdown, ObjectiveValuePending } from '@/components/objective-value/ObjectiveValueResult';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-formatting';
import type { OpenQuestion } from '@/lib/objective-value/objective-value-bounds';
import type { ListingObjectiveValue as Value, ListingObjectiveValueAssumption } from '@/lib/objective-value/listing-objective-value';
import { serializeObjectiveValuePrefill } from '@/lib/objective-value/objective-value-prefill';

const NS = 'objective-value';
const L = `${NS}:listing`;
const HEADING_ID = 'listing-objective-value';

type Evaluated = Extract<Value, { kind: 'evaluated' }>;

function useOpenLabel(): (question: OpenQuestion) => string {
  const { t } = useTranslation([NS]);
  return (question) => (question === 'zoneFront' ? t(`${L}.open.zoneFront`) : t(`${NS}:result.missing.${question}`));
}

function Amount({ bounds }: { readonly bounds: Evaluated['bounds'] }) {
  const { t } = useTranslation([NS]);
  const openLabel = useOpenLabel();
  if (bounds.kind === 'unresolved') return <ObjectiveValuePending result={bounds.result} />;
  const amount =
    bounds.kind === 'exact' ? formatCurrency(bounds.result.value) : t(`${L}.range`, { low: formatCurrency(bounds.low), high: formatCurrency(bounds.high) });
  return (
    <>
      <span className="text-sm text-muted-foreground">{t(`${NS}:result.label`)}</span>
      <span className="text-xl font-semibold tabular-nums text-foreground">{amount}</span>
      {bounds.kind === 'range' && (
        <span className="text-sm text-foreground">{t(`${L}.dependsOn`, { fields: bounds.open.map(openLabel).join(', ') })}</span>
      )}
    </>
  );
}

function Assumptions({ value }: { readonly value: Evaluated }) {
  const { t } = useTranslation([NS]);
  const { bounds, assumptions } = value;
  const commerciality = bounds.kind !== 'unresolved' && bounds.commercialityAssumed;
  if (assumptions.length === 0 && !commerciality) return null;
  const text = (assumption: ListingObjectiveValueAssumption) => {
    switch (assumption.kind) {
      case 'ageFromConstructionYear':
        return t(`${L}.assumptions.age.${assumption.provenance}`, { year: assumption.year });
      case 'declaredByLister':
        return t(`${L}.assumptions.declaredByLister`, {
          fields: assumption.fields.map((field) => t(`${L}.declaredFields.${field}`)).join(', '),
        });
      case 'areaWithoutCommon':
        return t(`${L}.assumptions.areaWithoutCommon`);
    }
  };
  return (
    <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-xs text-muted-foreground">
      {assumptions.map((assumption) => <li key={assumption.kind}>{text(assumption)}</li>)}
      {commerciality && <li>{t(`${NS}:questions.commercialityFactor.assumed`)}</li>}
    </ul>
  );
}

function EvaluatedBody({ value }: { readonly value: Evaluated }) {
  const { t } = useTranslation([NS]);
  const { bounds } = value;
  return (
    <>
      {/* `role="status"` όπως στον υπολογιστή: οι ελλείψεις είναι παράγραφοι και λίστα, που το `<output>` δεν δέχεται. */}
      <div role="status" className="flex flex-col gap-1">
        <Amount bounds={bounds} />
      </div>
      {bounds.kind === 'exact' && <ObjectiveValueBreakdown result={bounds.result} />}
      <Assumptions value={value} />
      <p className="m-0 text-xs text-muted-foreground">{t(`${NS}:result.disclaimer`)}</p>
      <ObjectiveValueLink className="text-sm" prefillQuery={serializeObjectiveValuePrefill(value.prefill)}>
        {t(bounds.kind === 'exact' ? `${L}.openCalculator` : `${L}.completeInCalculator`)}
      </ObjectiveValueLink>
    </>
  );
}

/**
 * Η ενότητα. `no-zone` ⇒ τίποτα (η ζώνη το εξηγεί ήδη)· είδος εκτός εμβέλειας ⇒ μία πρόταση και ο γενικός σύνδεσμος.
 *
 * 🔑 `hidden` ⇒ **τίποτα**, ούτε σύνδεσμος (ADR-898 Φ3β · πρότυπο NAR IDX: απενεργοποιείται η εκτίμηση **και** ο
 * σύνδεσμος προς αυτήν δίπλα στην αγγελία). Ο server δεν υπολόγισε τίποτα· ο γενικός υπολογιστής μένει στο υποσέλιδο.
 */
export function ListingObjectiveValue({ value }: { readonly value: Value }) {
  const { t } = useTranslation([NS]);
  if (value.kind === 'no-zone' || value.kind === 'hidden') return null;
  return (
    <section aria-labelledby={HEADING_ID} className="flex flex-col gap-2 rounded-md border border-border p-3">
      <h4 id={HEADING_ID} className="m-0 text-sm font-semibold text-foreground">{t(`${L}.title`)}</h4>
      {value.kind === 'evaluated' ? (
        <EvaluatedBody value={value} />
      ) : (
        <>
          <p className="m-0 text-sm text-muted-foreground">{t(`${L}.unsupported.${value.reason}`)}</p>
          <ObjectiveValueLink className="text-sm" />
        </>
      )}
    </section>
  );
}
