'use client';

/**
 * **Βήμα 3 — μόνο ό,τι μετρά για ΑΥΤΟ το ακίνητο** (ADR-898 §4.3, Φ2).
 *
 * 🔑 **Η λίστα έρχεται από τη μηχανή** (`relevantQuestions`), όχι από κανόνες γραμμένους εδώ: ΣΕ μόνο ως τον Γ'
 * όροφο, ανελκυστήρας μόνο πάνω από τον Β', ΣΑΟ μόνο σε ημιτελές, τίποτα για ανοιχτή θέση στάθμευσης.
 *
 * 🔑 **ΣΕ «δεν τον ξέρω» = 1,0 ΜΕ ρητή σήμανση** — ο γεννήτορας ζωνών δεν κρατά ακόμη τον ΣΕ (ADR-898 Φ5)· η υπόθεση
 * φαίνεται και στο αποτέλεσμα, ποτέ σιωπηλά.
 */

import React, { useId } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { frontageLabel } from '@/lib/listings/frontage-label';
import type { ConditionalQuestion, ObjectiveValueDraft } from '@/lib/objective-value/objective-value-draft';
import { RESIDENCE_FRONTAGES } from '@/lib/objective-value/objective-value-types';

import { CalculatorStep, ChoiceSelect, LabelledNumber, YesNo } from './objective-value-inputs';
import type { UpdateDraft } from './ObjectiveValueProperty';

const NS = 'objective-value';

interface QuestionProps {
  readonly draft: ObjectiveValueDraft;
  readonly update: UpdateDraft;
  readonly today: string;
}

/** Οι τιμές ονομάζονται από το **ένα** λεξιλόγιο ακινήτου — ίδιες λέξεις με την αγγελία και τα φίλτρα (ADR-898 Φ3β). */
function FrontageQuestion({ draft, update }: QuestionProps) {
  const { t } = useTranslation([NS, 'properties-enums']);
  const id = useId();
  return (
    <>
      <Label htmlFor={id}>{t(`${NS}:questions.frontage.label`)}</Label>
      <ChoiceSelect
        id={id}
        value={draft.frontage}
        values={RESIDENCE_FRONTAGES}
        getLabel={(value) => frontageLabel(t, value)}
        placeholder={t(`${NS}:questions.frontage.label`)}
        onChange={(frontage) => update({ frontage })}
      />
    </>
  );
}

function YesNoQuestion({ draft, update, field }: QuestionProps & { readonly field: 'hasCentralHeating' | 'hasElevator' }) {
  const { t } = useTranslation([NS]);
  const labelId = useId();
  return (
    <>
      <span id={labelId} className="text-sm font-medium text-foreground">{t(`${NS}:questions.${field}.label`)}</span>
      <YesNo
        name={labelId}
        labelledBy={labelId}
        value={draft[field]}
        labels={{ yes: t(`${NS}:questions.yes`), no: t(`${NS}:questions.no`) }}
        onChange={(value) => update(field === 'hasElevator' ? { hasElevator: value } : { hasCentralHeating: value })}
      />
    </>
  );
}

function CommercialityQuestion({ draft, update }: QuestionProps) {
  const { t } = useTranslation([NS]);
  return (
    <>
      <LabelledNumber
        label={t(`${NS}:questions.commercialityFactor.label`)}
        help={t(`${NS}:questions.commercialityFactor.help`)}
        value={draft.commercialityFactor}
        step={0.1}
        onChange={(value) => update({ commercialityFactor: value, commercialityAssumed: false })}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => update({ commercialityFactor: 1, commercialityAssumed: true })}
      >
        {t(`${NS}:questions.commercialityFactor.unknown`)}
      </Button>
    </>
  );
}

function PermitDateQuestion({ draft, update, today }: QuestionProps) {
  const { t } = useTranslation([NS]);
  const id = useId();
  const helpId = useId();
  return (
    <>
      <Label htmlFor={id}>{t(`${NS}:questions.ageYears.label`)}</Label>
      <Input
        id={id}
        type="date"
        max={today}
        value={draft.permitDate ?? ''}
        aria-describedby={helpId}
        onChange={(event) => update({ permitDate: event.target.value === '' ? null : event.target.value })}
        className="w-auto self-start"
      />
      <span id={helpId} className="text-xs text-muted-foreground">{t(`${NS}:questions.ageYears.help`)}</span>
    </>
  );
}

function PlotUtilisationQuestion({ draft, update }: QuestionProps) {
  const { t } = useTranslation([NS]);
  return (
    <LabelledNumber
      label={t(`${NS}:questions.plotUtilisation.label`)}
      help={t(`${NS}:questions.plotUtilisation.help`)}
      value={draft.plotUtilisation}
      step={0.01}
      onChange={(plotUtilisation) => update({ plotUtilisation })}
    />
  );
}

function Question({ question, ...props }: QuestionProps & { readonly question: ConditionalQuestion }) {
  switch (question) {
    case 'frontage':
      return <FrontageQuestion {...props} />;
    case 'hasCentralHeating':
    case 'hasElevator':
      return <YesNoQuestion {...props} field={question} />;
    case 'commercialityFactor':
      return <CommercialityQuestion {...props} />;
    case 'ageYears':
      return <PermitDateQuestion {...props} />;
    case 'plotUtilisation':
      return <PlotUtilisationQuestion {...props} />;
  }
}

export function ObjectiveValueQuestions({ questions, ...props }: QuestionProps & { readonly questions: readonly ConditionalQuestion[] }) {
  const { t } = useTranslation([NS]);
  return (
    <CalculatorStep title={t(`${NS}:questions.title`)}>
      {questions.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:questions.none`)}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {questions.map((question) => (
            <li key={question} className="flex flex-col gap-1">
              <Question question={question} {...props} />
            </li>
          ))}
        </ul>
      )}
    </CalculatorStep>
  );
}
