'use client';

/**
 * **Μία ερώτηση της οθόνης «Βελτίωσε την αγγελία σου»** (ADR-898 Φ3β-2): το χειριστήριο, **τι κερδίζει** η απάντηση,
 * σε ποια κατάσταση είναι, και καθαρισμός.
 *
 * 🔑 **Ίδια χειριστήρια με τον υπολογιστή** (`ObjectiveValueQuestion`) για πρόσοψη, θέρμανση, ανελκυστήρα, άδεια —
 * ο κάτοχος και ο αγοραστής βλέπουν την ίδια διατύπωση. Μόνο το μέτωπο και οι κοινόχρηστοι έχουν δικό τους, γιατί
 * ο υπολογιστής τα ρωτά αλλιώς (χάρτης · σημαία με προεπιλογή).
 */

import React, { useId } from 'react';

import { ObjectiveValueQuestion, questionClearsItself, useYesNoLabels } from '@/components/objective-value/ObjectiveValueQuestions';
import { ChoiceSelect, YesNo } from '@/components/objective-value/objective-value-inputs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-formatting';
import type { ValueZoneVerdict } from '@/lib/market/value-zone-at-point';
import type {
  ObjectiveValueDeclarations,
  ObjectiveValueDeclarationsPatch,
  ZoneFrontDeclaration,
} from '@/lib/objective-value/objective-value-declarations';
import {
  clearedPatchOf,
  draftOfDeclarations,
  ENGINE_QUESTION_OF,
  patchOfDraft,
  type ImproveQuestion,
} from '@/lib/objective-value/objective-value-improve';
import { zoneFrontAnswers } from '@/lib/objective-value/objective-value-zone';

const NS = 'objective-value';
const I = `${NS}:improve`;

export interface ImproveQuestionProps {
  readonly question: ImproveQuestion;
  readonly declarations: ObjectiveValueDeclarations;
  readonly verdict: ValueZoneVerdict;
  readonly today: string;
  readonly onAnswer: (patch: ObjectiveValueDeclarationsPatch) => void;
}

const NONE_KEY = 'none';
const zoneFrontKey = (answer: ZoneFrontDeclaration) => (answer.kind === 'none' ? NONE_KEY : `street:${answer.street}`);

function ZoneFrontControl({ declarations, verdict, onAnswer }: ImproveQuestionProps) {
  const { t } = useTranslation([NS]);
  const id = useId();
  const answers = zoneFrontAnswers(verdict);
  const byKey = new Map(answers.map((answer) => [zoneFrontKey(answer), answer]));
  const current = declarations.zoneFront === null ? null : zoneFrontKey(declarations.zoneFront);
  return (
    <>
      <Label htmlFor={id}>{t(`${I}.zoneFront.label`)}</Label>
      <ChoiceSelect
        id={id}
        value={current !== null && byKey.has(current) ? current : null}
        values={[...byKey.keys()]}
        getLabel={(key) => {
          const answer = byKey.get(key);
          return answer === undefined || answer.kind === 'none' ? t(`${I}.zoneFront.none`) : answer.street;
        }}
        placeholder={t(`${NS}:questions.choose`)}
        onChange={(key) => onAnswer({ zoneFront: byKey.get(key) ?? null })}
      />
      <span className="text-xs text-muted-foreground">{t(`${I}.zoneFront.help`)}</span>
    </>
  );
}

function AreaIncludesCommonControl({ declarations, onAnswer }: ImproveQuestionProps) {
  const { t } = useTranslation([NS]);
  const labels = useYesNoLabels('undeclared');
  const labelId = useId();
  return (
    <>
      <span id={labelId} className="text-sm font-medium text-foreground">{t(`${I}.areaIncludesCommon.label`)}</span>
      <YesNo
        name={labelId}
        labelledBy={labelId}
        value={declarations.areaIncludesCommon}
        labels={labels}
        onChange={(areaIncludesCommon) => onAnswer({ areaIncludesCommon })}
      />
      <span className="text-xs text-muted-foreground">{t(`${I}.areaIncludesCommon.help`)}</span>
    </>
  );
}

/** Το χειριστήριο — ή, όταν το κρίνει γενικό χαρακτηριστικό, μόνο η ερώτηση (χωρίς χειριστήριο: η δήλωση δεν θα μετρούσε). */
function Control(props: ImproveQuestionProps) {
  const { t } = useTranslation([NS]);
  const { question, declarations, today, onAnswer } = props;
  const engineQuestion = ENGINE_QUESTION_OF[question.field];
  if (question.state === 'byAttribute' && engineQuestion !== undefined) {
    return <span className="text-sm font-medium text-foreground">{t(`${NS}:questions.${engineQuestion}.label`)}</span>;
  }
  if (question.field === 'zoneFront') return <ZoneFrontControl {...props} />;
  if (question.field === 'areaIncludesCommon') return <AreaIncludesCommonControl {...props} />;
  if (engineQuestion === undefined) return null;
  return (
    <ObjectiveValueQuestion
      question={engineQuestion}
      draft={draftOfDeclarations(declarations)}
      today={today}
      unsetVoice="undeclared"
      update={(change) => {
        const patch = patchOfDraft(change);
        if (patch !== null) onAnswer(patch);
      }}
    />
  );
}

/** «Τι κερδίζει» και «σε ποια κατάσταση» — δύο σύντομες γραμμές, ποτέ κατηγορητήριο. */
function Notes({ question }: { readonly question: ImproveQuestion }) {
  const { t } = useTranslation([NS]);
  const { impact, state, field } = question;
  const impactText =
    impact.kind === 'unblocks'
      ? t(`${I}.impact.unblocks`)
      : impact.kind === 'narrows'
        ? t(`${I}.impact.narrows`, { amount: formatCurrency(impact.amount) })
        : null;
  const stateText =
    state === 'answered' || state === 'byAttribute'
      ? t(`${I}.state.${state}`)
      : state === 'assumed' && (field === 'permitDate' || field === 'areaIncludesCommon')
        ? t(`${I}.state.assumed.${field}`)
        : null;
  return (
    <>
      {impactText !== null && <span className="text-sm text-foreground">{impactText}</span>}
      {stateText !== null && <span className="text-xs text-muted-foreground">{stateText}</span>}
    </>
  );
}

/** Το πεδίο αναιρείται από το ίδιο του το χειριστήριο (`YesNo`) ⇒ κανένα δεύτερο κουμπί «καθαρισμός» (ADR-898 §18.1). */
function clearsItself(field: ImproveQuestion['field']): boolean {
  const engineQuestion = ENGINE_QUESTION_OF[field];
  return field === 'areaIncludesCommon' || (engineQuestion !== undefined && questionClearsItself(engineQuestion));
}

export function ObjectiveValueImproveQuestion(props: ImproveQuestionProps) {
  const { t } = useTranslation([NS]);
  const { question, declarations, onAnswer } = props;
  const declared = declarations[question.field] !== null;
  return (
    <li className="flex flex-col gap-1">
      <Control {...props} />
      <Notes question={question} />
      {declared && question.state !== 'byAttribute' && !clearsItself(question.field) && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="self-start px-0"
          onClick={() => onAnswer(clearedPatchOf(question.field))}
        >
          {t(`${I}.clear`)}
        </Button>
      )}
    </li>
  );
}
