'use client';

/**
 * **Οι ερωτήσεις της αντικειμενικής, με τη σειρά της μηχανής** (ADR-898 Φ3β-2): πρώτα όσες στενεύουν περισσότερο το
 * εύρος, **τρεις τη φορά** (ADR-842 §6 #7 — coaching, όχι κατηγορητήριο)· οι υπόλοιπες ανοιχτές πίσω από ένα κουμπί που
 * λέει **πόσες** είναι (NN/g «information scent»)· και χωριστά, όσα ο υπολογισμός ξέρει ήδη — διορθώσιμα.
 */

import React, { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { IMPROVE_QUESTIONS_AT_A_TIME, type ImproveQuestion } from '@/lib/objective-value/objective-value-improve';

import { ObjectiveValueImproveQuestion, type ImproveQuestionProps } from './ObjectiveValueImproveQuestion';

const NS = 'objective-value';
const I = `${NS}:improve`;

type SharedProps = Omit<ImproveQuestionProps, 'question'>;

function QuestionList({ questions, ...props }: SharedProps & { readonly questions: readonly ImproveQuestion[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-4 p-0">
      {questions.map((question) => (
        <ObjectiveValueImproveQuestion key={question.field} question={question} {...props} />
      ))}
    </ul>
  );
}

function Group({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h3 id={headingId} className="m-0 text-base font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

export function ObjectiveValueImproveQuestions({ questions, ...props }: SharedProps & { readonly questions: readonly ImproveQuestion[] }) {
  const { t } = useTranslation([NS]);
  const [showAll, setShowAll] = useState(false);
  const open = questions.filter((question) => question.state === 'open');
  const known = questions.filter((question) => question.state !== 'open');
  const shown = showAll ? open : open.slice(0, IMPROVE_QUESTIONS_AT_A_TIME);
  const hidden = open.length - shown.length;
  return (
    <>
      <Group title={t(`${I}.suggested`)}>
        {open.length === 0 ? (
          <p className="m-0 text-sm text-muted-foreground">{t(`${I}.nothingOpen`)}</p>
        ) : (
          <QuestionList questions={shown} {...props} />
        )}
        {hidden > 0 && (
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setShowAll(true)}>
            {t(`${I}.more`, { count: hidden })}
          </Button>
        )}
      </Group>
      {known.length > 0 && (
        <Group title={t(`${I}.known`)}>
          <QuestionList questions={known} {...props} />
        </Group>
      )}
    </>
  );
}
