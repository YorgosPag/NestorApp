'use client';

/**
 * **Η αποτίμηση μιας μονάδας** (ADR-898 Φ3 · Φ4β) — το ΕΝΑ σώμα για την αγγελία (`ListingObjectiveValue`) και για τον
 * πίνακα του κτιρίου (συρτάρι ανά μονάδα). Τρεις μορφές, όλες από τον server — η οθόνη **δεν** πολλαπλασιάζει τίποτα:
 * - **ποσό** με την ανάλυση της μηχανής (κάθε συντελεστής με παραπομπή στον νόμο)·
 * - **όρια** «από Χ έως Υ» και **από τι εξαρτώνται** — ακριβώς ό,τι επιτρέπει ο νόμος·
 * - **τι λείπει**, όταν το άγνωστο δεν απαριθμείται.
 * Με τις **δηλωμένες υποθέσεις** και την αποποίηση (myPROPERTY, ADR-898 §6).
 *
 * 🔑 `voice` αλλάζει **μόνο** ποιος «δήλωσε» και γιατί λείπουν επίπεδα (αγγελιοδότης/αγγελία vs μονάδα του κτιρίου)·
 * όλα τα υπόλοιπα είναι κοινά — ένα σημείο να διορθωθούν.
 */

import React from 'react';

import { ObjectiveValueBreakdown, ObjectiveValuePending } from '@/components/objective-value/ObjectiveValueResult';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-formatting';
import type { ObjectiveValueBounds, OpenQuestion } from '@/lib/objective-value/objective-value-bounds';
import type { ListingObjectiveValueAssumption, ObjectiveValueEvaluated as Value } from '@/lib/objective-value/listing-objective-value';

const NS = 'objective-value';
const L = `${NS}:listing`;

/** Ποιος μιλά: η δημόσια αγγελία ή ο πίνακας του κτιρίου. */
export type ObjectiveValueVoice = 'listing' | 'building';

/** Η ετικέτα μιας ανοιχτής ερώτησης — η ΜΙΑ αντιστοίχιση (αγγελία · πίνακας · εξαγωγή). */
export function useObjectiveValueOpenLabel(): (question: OpenQuestion) => string {
  const { t } = useTranslation([NS]);
  return (question) => (question === 'zoneFront' ? t(`${L}.open.zoneFront`) : t(`${NS}:result.missing.${question}`));
}

/** Το ποσό ως κείμενο: ακριβές ή «Χ έως Υ» · `null` = κανένα ποσό (τι λείπει). Η ΜΙΑ μορφή (οθόνη · πίνακας · «πριν → τώρα»). */
export function useObjectiveValueAmountText(): (bounds: ObjectiveValueBounds) => string | null {
  const { t } = useTranslation([NS]);
  return (bounds) => {
    if (bounds.kind === 'exact') return formatCurrency(bounds.result.value);
    if (bounds.kind === 'range') return t(`${L}.range`, { low: formatCurrency(bounds.low), high: formatCurrency(bounds.high) });
    return null;
  };
}

function Amount({ bounds }: { readonly bounds: Value['bounds'] }) {
  const { t } = useTranslation([NS]);
  const openLabel = useObjectiveValueOpenLabel();
  const amountText = useObjectiveValueAmountText();
  if (bounds.kind === 'unresolved') return <ObjectiveValuePending result={bounds.result} />;
  return (
    <>
      <span className="text-sm text-muted-foreground">{t(`${NS}:result.label`)}</span>
      <span className="text-xl font-semibold tabular-nums text-foreground">{amountText(bounds)}</span>
      {bounds.kind === 'range' && (
        <span className="text-sm text-foreground">{t(`${L}.dependsOn`, { fields: bounds.open.map(openLabel).join(', ') })}</span>
      )}
    </>
  );
}

function Assumptions({ value, voice }: { readonly value: Value; readonly voice: ObjectiveValueVoice }) {
  const { t } = useTranslation([NS]);
  const { bounds, assumptions } = value;
  const commerciality = bounds.kind !== 'unresolved' && bounds.commercialityAssumed;
  if (assumptions.length === 0 && !commerciality) return null;
  const text = (assumption: ListingObjectiveValueAssumption) => {
    switch (assumption.kind) {
      case 'ageFromConstructionYear':
        return t(`${L}.assumptions.age.${assumption.provenance}`, { year: assumption.year });
      case 'declaredByLister':
        return t(voice === 'listing' ? `${L}.assumptions.declaredByLister` : `${NS}:building.assumptions.declaredByUnit`, {
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

interface ObjectiveValueEvaluatedProps {
  readonly value: Value;
  readonly voice: ObjectiveValueVoice;
  /** Ό,τι ακολουθεί την αποποίηση (π.χ. ο σύνδεσμος της αγγελίας προς τον υπολογιστή). */
  readonly children?: React.ReactNode;
}

export function ObjectiveValueEvaluated({ value, voice, children }: ObjectiveValueEvaluatedProps) {
  const { t } = useTranslation([NS]);
  const { bounds, levelBasis } = value;
  const levelsMissingKey = voice === 'listing' ? `${L}.levelsMissing` : `${NS}:building.levelsMissing`;
  return (
    <>
      {/* `role="status"` όπως στον υπολογιστή: οι ελλείψεις είναι παράγραφοι και λίστα, που το `<output>` δεν δέχεται. */}
      <div role="status" className="flex flex-col gap-1">
        <Amount bounds={bounds} />
        {/* ADR-898 Φ3β-3β — πολυεπίπεδο χωρίς εμβαδόν ανά όροφο: το «γιατί» πίσω από το «λείπουν όροφος, επιφάνεια». */}
        {levelBasis.kind === 'missing' && (
          <p className="m-0 text-sm text-muted-foreground">{t(levelsMissingKey, { count: levelBasis.count })}</p>
        )}
      </div>
      {bounds.kind === 'exact' && <ObjectiveValueBreakdown result={bounds.result} />}
      <Assumptions value={value} voice={voice} />
      <p className="m-0 text-xs text-muted-foreground">{t(`${NS}:result.disclaimer`)}</p>
      {children}
    </>
  );
}
