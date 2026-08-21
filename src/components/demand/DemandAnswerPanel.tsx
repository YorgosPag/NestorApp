'use client';

/**
 * **Η ΕΠΙΦΑΝΕΙΑ ΠΟΥ ΔΕΙΧΝΕΙ ΤΗΝ ΑΠΑΝΤΗΣΗ ΟΤΑΝ Η ΑΠΑΝΤΗΣΗ ΕΙΝΑΙ «ΤΙΠΟΤΑ»**.
 *
 * @related ADR-777 §7 (Α9 · Α5) · SPEC-777B §12.6 · lib/demand/demand-answer.ts
 * @module components/demand/DemandAnswerPanel
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΚΡΙΤΗΡΙΟ ΤΗΣ ΟΘΟΝΗΣ, ΓΡΑΜΜΕΝΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * > *«αν η οθόνη δεν μπορεί να πει “δεν βρέθηκε τίποτα, αλλά με +20.000 € υπάρχουν 6
 * > και άλλοι 8 ζητούν το ίδιο”, δεν έχει τελειώσει»*
 *
 * Οι τρεις προτάσεις αντιστοιχούν σε τρία παιδιά, και **καθένα έχει τη δική του
 * πηγή αλήθειας**:
 *
 * | Πρόταση | Ποιος την παράγει |
 * |---|---|
 * | «δεν βρέθηκε τίποτα» | {@link demandAnswerShape} — **έξι** ονομασμένα σχήματα |
 * | «με +20.000 € υπάρχουν 6» | {@link DemandConcessionList} ← `demand-concessions.ts` |
 * | «άλλοι 8 ζητούν το ίδιο» | {@link DemandCompetitionPanel} ← διαδρομή διακομιστή |
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΣΧΗΜΑ ΔΕΝ ΣΥΜΠΕΡΑΙΝΕΤΑΙ ΕΔΩ ΜΕ `if`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ένα `matchedCount > 0 ? … : ladders.length > 0 ? … : …` γραμμένο σε JSX είναι
 * **πολιτική σε component**: θα ξαναγραφόταν με **άλλη σειρά** στην επόμενη επιφάνεια
 * (ειδοποίηση · email · θερμοχάρτης Ε2), και οι δύο θα διαφωνούσαν για την **ίδια**
 * ζήτηση. Η σειρά των ερωτήσεων είναι **συμβόλαιο** και ζει στο
 * `demand-answer.ts` — ίδιο ιδίωμα με τη σειρά ταξινόμησης του CHECK 3.47.
 *
 * Εδώ υπάρχει **ένα** `switch` πάνω σε κλειστό σύνολο· ένα νέο σχήμα **δεν
 * μεταγλωττίζεται** χωρίς μήνυμα.
 *
 * ⚠️ **Η λογιστική ελέγχεται ΠΡΙΝ ζωγραφιστεί αριθμός.** Αν δεν κλείνει, δεν
 * δείχνουμε «περίπου» — δηλώνουμε ότι δεν στεκόμαστε πίσω από τον αριθμό. Είναι το
 * fail-closed των πυλών, μεταφερμένο στην οθόνη.
 */

import React from 'react';
import Link from 'next/link';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  demandAnswerBalances,
  demandAnswerShape,
  type DemandAnswer,
  type DemandAnswerShape,
} from '@/lib/demand/demand-answer';
import { demandResultsHref } from '@/lib/demand/demand-listing-filters';
import type { PropertyDemand } from '@/types/property-demand';
import type { CompetitionState } from '@/hooks/demand/useDemandAnswer';
import { DemandBlockerList } from './DemandBlockerList';
import { DemandCompetitionPanel } from './DemandCompetitionPanel';
import { DemandConcessionList } from './DemandConcessionList';

/** Η κύρια πρόταση — **μία** ανά σχήμα, ποτέ συνένωση. */
function HeadlineSentence({
  shape,
  answer,
}: {
  shape: DemandAnswerShape;
  answer: DemandAnswer;
}): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const K = 'property-market:demand.answer';

  switch (shape) {
    case 'has-matches':
      return <p className="text-foreground">{t(`${K}.matched`, { count: answer.matchedCount })}</p>;
    case 'has-concession':
      return <p className="text-foreground">{t(`${K}.none`)}</p>;
    case 'near-but-unreachable':
      return (
        <p className="text-foreground">
          {t(`${K}.nearButUnreachable`, { count: answer.results.nearMissed.length })}
        </p>
      );
    case 'blocked-by-unknowns':
      return (
        <>
          <p className="text-foreground">{t(`${K}.blockedByUnknowns`)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t(`${K}.blockedByUnknownsWhy`)}</p>
        </>
      );
    case 'no-match':
      return (
        <p className="text-foreground">
          {t(`${K}.noMatch`, { count: answer.results.considered })}
        </p>
      );
    case 'nothing-to-judge':
      return <p className="text-foreground">{t(`${K}.nothingToJudge`)}</p>;
  }
}

/**
 * Οι άξονες που **δεν ταξιδεύουν** στον σύνδεσμο αποτελεσμάτων.
 *
 * 🔑 **Χωρίς αυτό, ο σύνδεσμος λέει ψέματα σιωπηλά.** Η προβολή προς τα φίλτρα είναι
 * **υπερσύνολο** — χαλαρώνει, ποτέ δεν σφίγγει — οπότε ο χρήστης που ζήτησε «από
 * Μάρτιο, 3ος όροφος, κοντά σε σχολείο» και πατάει «δες τα αποτελέσματα» βλέπει
 * απάντηση σε **χαλαρότερο** αίτημα από το δικό του.
 */
function AxesLostNote({ answer }: { answer: DemandAnswer }): React.ReactElement | null {
  const { t } = useTranslation(['property-market']);
  if (answer.axesLost.length === 0) return null;

  return (
    <p className="text-sm text-muted-foreground">
      {t('property-market:demand.answer.axesLostHeading')}{' '}
      {answer.axesLost.map((axis) => t(`property-market:demand.axisLost.${axis}`)).join(' · ')}
    </p>
  );
}

export function DemandAnswerPanel({
  demand,
  answer,
  competition,
}: {
  demand: PropertyDemand;
  answer: DemandAnswer;
  competition: CompetitionState;
}): React.ReactElement {
  const { t } = useTranslation(['property-market']);

  // 🔴 **Fail-closed.** Αν το άθροισμα δεν κλείνει, κάποια αγγελία χάθηκε ανάμεσα
  // στους κάδους — δηλαδή κάθε αριθμός παρακάτω είναι αναπόδεικτος. Δεν δείχνουμε
  // «περίπου»: το λέμε.
  if (!demandAnswerBalances(answer)) {
    return (
      <section aria-label={t('property-market:demand.answer.heading')}>
        <p className="text-foreground">{t('property-market:demand.answer.balanceError')}</p>
      </section>
    );
  }

  const shape = demandAnswerShape(answer);

  return (
    <section
      aria-label={t('property-market:demand.answer.heading')}
      className="flex flex-col gap-4"
    >
      <h2 className="text-lg font-semibold text-foreground">
        {t('property-market:demand.answer.heading')}
      </h2>

      <HeadlineSentence shape={shape} answer={answer} />

      {/*
        Ο σύνδεσμος εμφανίζεται **πάντα**, ακόμη και με μηδέν ταιριάσματα — και είναι
        σκόπιμο: οδηγεί στην οθόνη 2 με τα φίλτρα της ζήτησης, όπου ο άνθρωπος βλέπει
        **γιατί** με τα δικά του μάτια. Η μόνη εξαίρεση είναι ο άδειος κατάλογος, όπου
        δεν υπάρχει τίποτα να δει.
      */}
      {shape !== 'nothing-to-judge' && (
        <nav className="flex flex-col gap-2">
          <Link
            href={demandResultsHref(demand)}
            className="inline-block w-fit rounded-md border border-border bg-card px-4 py-2 font-medium text-foreground"
          >
            {t('property-market:demand.answer.seeResults')}
          </Link>
          <AxesLostNote answer={answer} />
        </nav>
      )}

      <DemandConcessionList report={answer.concessions} />
      <DemandBlockerList blockedBy={answer.blockedBy} />
      <DemandCompetitionPanel competition={competition} />
    </section>
  );
}
