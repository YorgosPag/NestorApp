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

import { ObjectiveValueEvaluated } from '@/components/objective-value/ObjectiveValueEvaluated';
import { ObjectiveValueLink } from '@/components/objective-value/ObjectiveValueLink';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ListingObjectiveValue as Value } from '@/lib/objective-value/listing-objective-value';
import { serializeObjectiveValuePrefill } from '@/lib/objective-value/objective-value-prefill';

const NS = 'objective-value';
const L = `${NS}:listing`;
const HEADING_ID = 'listing-objective-value';

type Evaluated = Extract<Value, { kind: 'evaluated' }>;

/** Το κοινό σώμα (ADR-898 Φ4β: ένα για αγγελία και κτίριο) + ο σύνδεσμος στον υπολογιστή, ήδη συμπληρωμένος. */
function EvaluatedBody({ value }: { readonly value: Evaluated }) {
  const { t } = useTranslation([NS]);
  return (
    <ObjectiveValueEvaluated value={value} voice="listing">
      <ObjectiveValueLink className="text-sm" prefillQuery={serializeObjectiveValuePrefill(value.prefill)}>
        {t(value.bounds.kind === 'exact' ? `${L}.openCalculator` : `${L}.completeInCalculator`)}
      </ObjectiveValueLink>
    </ObjectiveValueEvaluated>
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
