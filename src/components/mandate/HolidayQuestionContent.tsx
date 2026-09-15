'use client';

/**
 * @fileoverview **«ΘΑ ΕΙΣΤΕ ΑΝΟΙΧΤΑ ΣΤΙΣ ΑΡΓΙΕΣ;» — Η ΟΘΟΝΗ ΤΟΥ ΔΙΑΧΕΙΡΙΣΤΗ, ΧΩΡΙΣ ΣΥΝΔΕΣΗ** (ADR-841 §7 Α21.21 Φάση Β).
 * @related app/(auth)/hours-question/[token]/page.tsx · components/mandate/ShowcaseEmailConfirmationContent.tsx (το πρότυπο) ·
 *   hooks/mandate/useHolidayQuestionDecision.ts · components/mandate/HolidayQuestionRows.tsx
 * @module components/mandate/HolidayQuestionContent
 *
 * 🏆 **Πού ξεπερνά τους μεγάλους** (Google Business Profile «Confirm holiday hours» · Yelp «special hours» — και οι δύο
 * θέλουν σύνδεση): απάντηση **χωρίς** λογαριασμό · «Κανονικό ωράριο» ως απάντηση (όχι μόνο «κλειστά») · **«Πέρσι: …»** ·
 * «Ίδιο για όλες» · μερική απάντηση που κρατά τις υπόλοιπες · και όταν στο μεταξύ απάντησε η **φόρμα**, η σελίδα το **λέει**.
 *
 * 🔑 **Η σελίδα ΔΕΝ γράφει τίποτα με το άνοιγμα** (σαρωτές αλληλογραφίας): η προεπιλογή από το κουμπί του email (`preset`) είναι
 * μόνο **προσυμπλήρωση** — η απόφαση φεύγει μόνο από το «Αποθήκευση».
 * ⚠️ «Άλλο ωράριο» ⇒ **πλήρης πλοήγηση** (`<a>`) στη φόρμα, σε **άλλο κόσμο διαδρομών** (`o/[χώρος]`, με σύνδεση) — όχι `Link`.
 */

import React, { useState } from 'react';

// 🧩 ADR-744 §15 — PER-ROUTE SLICE ΤΗΣ `/hours-question/[token]`. Στατική εισαγωγή σε εμβέλεια module, στο Client Component
//    (ίδιος λόγος με το `ShowcaseEmailConfirmationContent`): αλλιώς ωμά κλειδιά στο πρώτο καρέ μιας ψυχρής εισόδου από email.
import routeSlice from '@/i18n/generated/routes/hours-question__token.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

import { AuthCardSection } from '@/components/ui/auth-card-section';
import { Button } from '@/components/ui/button';
import { useHolidayQuestionDecision, type HolidayQuestionDecisionPhase } from '@/hooks/mandate/useHolidayQuestionDecision';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { HolidayAnswer } from '@/lib/agency/showcase-holiday-answers';
import type { HolidayAnswerKind } from '@/lib/calendar/holiday-question';
import type { HolidayQuestionLookup, HolidayQuestionRow, HolidayQuestionView } from '@/services/mandate/holiday-hours-question-decision';

import { HOLIDAY_QUESTION_KEYS, HOLIDAY_QUESTION_NS, HOLIDAY_QUESTION_REASON_KEYS } from './holiday-question-labels';
import { HolidayKindChoice, HolidayQuestionRows, holidayRowKey, type HolidayChoices } from './HolidayQuestionRows';

registerRouteSlice(routeSlice);

function presetChoices(rows: readonly HolidayQuestionRow[], kind: HolidayAnswerKind | null): HolidayChoices {
  return kind === null ? {} : Object.fromEntries(rows.map((row) => [holidayRowKey(row), kind]));
}

/** Η τιμή του «Ίδιο για όλες» — μόνο όταν **όλες** οι γραμμές λένε το ίδιο. */
function commonChoice(rows: readonly HolidayQuestionRow[], choices: HolidayChoices): HolidayAnswerKind | null {
  const first = rows.length > 0 ? choices[holidayRowKey(rows[0])] : undefined;
  return first !== undefined && rows.every((row) => choices[holidayRowKey(row)] === first) ? first : null;
}

function answersOf(rows: readonly HolidayQuestionRow[], choices: HolidayChoices): HolidayAnswer[] {
  return rows.flatMap((row) => {
    const kind = choices[holidayRowKey(row)];
    return kind === undefined ? [] : [{ locationId: row.locationId, date: row.date, kind }];
  });
}

function useQuestionForm(token: string, view: HolidayQuestionView, preset: HolidayAnswerKind | null) {
  const [rows, setRows] = useState(view.rows);
  const [choices, setChoices] = useState<HolidayChoices>(() => presetChoices(view.rows, preset));
  const { phase, decide } = useHolidayQuestionDecision(token);
  const answers = answersOf(rows, choices);

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const outcome = await decide(answers);
    if (outcome.kind !== 'answered') return;
    const settled = new Set(answers.map(holidayRowKey));
    // 🔑 `remaining === 0` ⇒ η κάρτα δεν περιμένει τίποτα άλλο — ακόμη κι αν κάποια γραμμή απαντήθηκε στο μεταξύ στη φόρμα.
    setRows((current) => (outcome.remaining === 0 ? [] : current.filter((row) => !settled.has(holidayRowKey(row)))));
  }

  return {
    rows, choices, phase, answers, submit,
    chooseAll: (kind: HolidayAnswerKind) => setChoices(presetChoices(rows, kind)),
    choose: (row: HolidayQuestionRow, kind: HolidayAnswerKind) => setChoices((current) => ({ ...current, [holidayRowKey(row)]: kind })),
  };
}

function Outcome({ phase }: { readonly phase: HolidayQuestionDecisionPhase }): React.ReactElement | null {
  const { t } = useTranslation([HOLIDAY_QUESTION_NS]);
  if (phase.kind === 'failed') {
    return <p role="alert" className="m-0 text-sm font-medium text-destructive">{t(HOLIDAY_QUESTION_REASON_KEYS[phase.reason])}</p>;
  }
  if (phase.kind !== 'answered') return null;
  return (
    <p role="status" className="m-0 flex flex-col gap-1 text-sm font-medium text-card-foreground">
      <span>{phase.remaining === 0 ? t(HOLIDAY_QUESTION_KEYS.done) : t(HOLIDAY_QUESTION_KEYS.remaining, { count: phase.remaining })}</span>
      {phase.outcomes.includes('already-answered') ? (
        <span className="font-normal text-muted-foreground">{t(HOLIDAY_QUESTION_KEYS.formWon)}</span>
      ) : null}
    </p>
  );
}

function OtherHours({ path }: { readonly path: string | null }): React.ReactElement | null {
  const { t } = useTranslation([HOLIDAY_QUESTION_NS]);
  if (path === null) return null;
  return (
    <p className="m-0 flex flex-col items-start gap-2 text-sm text-muted-foreground">
      {t(HOLIDAY_QUESTION_KEYS.otherHoursHint)}
      <Button asChild variant="outline"><a href={path}>{t(HOLIDAY_QUESTION_KEYS.otherHours)}</a></Button>
    </p>
  );
}

function QuestionForm({ token, view, preset }: {
  readonly token: string;
  readonly view: HolidayQuestionView;
  readonly preset: HolidayAnswerKind | null;
}): React.ReactElement {
  const { t } = useTranslation([HOLIDAY_QUESTION_NS]);
  const form = useQuestionForm(token, view, preset);
  const sameForAllId = React.useId();
  const sending = form.phase.kind === 'sending';
  if (form.rows.length === 0) return <Outcome phase={form.phase} />;
  return (
    <form onSubmit={(event) => void form.submit(event)} className="flex flex-col gap-5">
      {form.rows.length > 1 ? (
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend id={sameForAllId} className="text-sm font-medium text-card-foreground">{t(HOLIDAY_QUESTION_KEYS.sameForAll)}</legend>
          <HolidayKindChoice value={commonChoice(form.rows, form.choices)} labelledBy={sameForAllId} disabled={sending} onChange={form.chooseAll} />
        </fieldset>
      ) : null}
      <HolidayQuestionRows rows={form.rows} choices={form.choices} disabled={sending} onChoose={form.choose} />
      <Outcome phase={form.phase} />
      <footer className="flex flex-col gap-4">
        <Button type="submit" className="self-start" disabled={sending || form.answers.length === 0}>
          {sending ? t(HOLIDAY_QUESTION_KEYS.sending) : t(HOLIDAY_QUESTION_KEYS.submit)}
        </Button>
        <OtherHours path={view.cardFormPath} />
      </footer>
    </form>
  );
}

export function HolidayQuestionContent({ token, lookup, preset }: {
  readonly token: string;
  readonly lookup: HolidayQuestionLookup;
  readonly preset: HolidayAnswerKind | null;
}): React.ReactElement {
  const { t } = useTranslation([HOLIDAY_QUESTION_NS]);
  if (!lookup.ok) {
    return (
      <AuthCardSection gap={3}>
        <h1 className="m-0 text-lg font-semibold text-card-foreground">{t(HOLIDAY_QUESTION_KEYS.title)}</h1>
        <p role="alert" className="m-0 text-sm text-muted-foreground">{t(HOLIDAY_QUESTION_REASON_KEYS[lookup.reason])}</p>
      </AuthCardSection>
    );
  }
  return (
    <AuthCardSection gap={5}>
      <header className="flex flex-col gap-2">
        <h1 className="m-0 text-lg font-semibold text-card-foreground">{t(HOLIDAY_QUESTION_KEYS.title)}</h1>
        <p className="m-0 text-sm text-muted-foreground">{t(HOLIDAY_QUESTION_KEYS.intro, { agency: lookup.view.agencyName })}</p>
        <p className="m-0 text-sm text-muted-foreground">{t(HOLIDAY_QUESTION_KEYS.explain)}</p>
      </header>
      <QuestionForm token={token} view={lookup.view} preset={preset} />
    </AuthCardSection>
  );
}
