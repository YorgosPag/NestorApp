'use client';

/**
 * **«Με +20.000 € υπάρχουν 6»** — η πρόταση υποχώρησης, ως πρόταση λόγου.
 *
 * @related ADR-777 §7 (Α9) · SPEC-777B §12.6 · lib/demand/demand-concessions.ts
 * @module components/demand/DemandConcessionList
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΔΕΝ ΑΠΟΦΑΣΙΖΕΙ ΤΙΠΟΤΑ — ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΤΟ ΝΟΗΜΑ ΤΟΥ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ποιο σκαλί λέγεται πρώτο, με ποιο κατώφλι, με ποια σειρά μεταξύ αξόνων: **όλα**
 * κρίθηκαν στο `demand-concessions.ts`, σε καθαρές συναρτήσεις με δοκιμές. Εδώ
 * γίνεται **μόνο** η μετάφραση αριθμού σε γλώσσα.
 *
 * Ο λόγος είναι μετρημένος, όχι αισθητικός: ένα `steps.filter(s => s.amount <
 * budget * 0.15)` γραμμένο σε JSX είναι **πολιτική σε component** — θα ξαναγραφόταν
 * με άλλο κατώφλι στην επόμενη επιφάνεια (ειδοποίηση · email · θερμοχάρτης Ε2) και οι
 * δύο θα έλεγαν **διαφορετικό αριθμό για την ίδια ζήτηση**, χωρίς κανείς να μπορεί να
 * πει ποιος έχει δίκιο.
 *
 * ⚠️ **Η ΜΟΡΦΟΠΟΙΗΣΗ ΤΟΥ ΠΟΣΟΥ ΕΙΝΑΙ ΜΙΑ ΠΡΟΤΑΣΗ, ΟΧΙ «ΑΡΙΘΜΟΣ + ΜΟΝΑΔΑ».** Στα
 * ελληνικά το «1 υπνοδωμάτιο **λιγότερο**» και το «2 υπνοδωμάτια **λιγότερα**»
 * διαφέρουν στο επίθετο, όχι μόνο στο ουσιαστικό — άρα η συμφωνία **δεν** μπορεί να
 * προκύψει από συνένωση δύο ανεξάρτητων κομματιών. Γι' αυτό κάθε άξονας έχει **δική
 * του φράση ποσού** (`demand.concession.amount.<άξονας>`) και **μία** κοινή πρόταση
 * που την περιβάλλει.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency, formatNumber } from '@/lib/intl-formatting';
import type {
  ConcessionLadder,
  ConcessionStep,
  DemandConcessionReport,
} from '@/lib/demand/demand-concessions';

/**
 * Ποσό → **φράση**, στη μονάδα του άξονα.
 *
 * 🔑 **Το `eur` περνά από τον SSoT νομίσματος** (`formatCurrency`, ο ίδιος που
 * χρησιμοποιεί η κάρτα αγγελίας): στα ελληνικά δίνει `20.000 €` — τελεία για χιλιάδες
 * και σύμβολο **μετά**. Ένα χειρόγραφο `${amount} €` θα έδινε `20000 €`, δηλαδή
 * αριθμό που ο αναγνώστης πρέπει να μετρήσει με το δάχτυλο.
 */
function useAmountPhrase(): (ladder: ConcessionLadder, step: ConcessionStep) => string {
  const { t } = useTranslation(['property-market']);

  return React.useCallback(
    (ladder, step) => {
      const key = `property-market:demand.concession.amount.${ladder.concession}`;
      // Τα `rooms` περνούν τον **ωμό** αριθμό: η φράση τους είναι ICU plural και
      // πρέπει να δει `number`, όχι μορφοποιημένο κείμενο.
      if (ladder.unit === 'rooms') return t(key, { value: step.amount });
      const value =
        ladder.unit === 'eur'
          ? formatCurrency(step.amount, 'EUR', { maximumFractionDigits: 0 })
          : formatNumber(step.amount, { maximumFractionDigits: 0 });
      return t(key, { value });
    },
    [t],
  );
}

/** Μία πρόταση υποχώρησης. */
function ConcessionSentence({ ladder }: { ladder: ConcessionLadder }): React.ReactElement | null {
  const { t } = useTranslation(['property-market']);
  const phraseOf = useAmountPhrase();

  if (ladder.headline === null) return null;

  return (
    <li className="text-foreground">
      {t('property-market:demand.concession.sentence', {
        amount: phraseOf(ladder, ladder.headline),
        count: ladder.headline.unlocks,
      })}
    </li>
  );
}

/**
 * Οι προτάσεις, **και η λογιστική τους**.
 *
 * 🔴 **Το `multiAxis` και το `unquantified` τυπώνονται, δεν σιωπούν.** Είναι κοντινές
 * αγγελίες που **δεν επιτρέπεται** να μπουν σε πρόταση (η μία αλλαγή δεν τις
 * ξεκλειδώνει· ή δεν υπάρχει «πόσο» να ειπωθεί). Χωρίς αυτές, μια οθόνη που δείχνει
 * «3 προτάσεις» ενώ η μηχανή βρήκε **11 κοντινές** θα φαινόταν σωστή — και το λάθος
 * θα ήταν **ακριβώς εκεί όπου η βοήθεια είναι πιο χρήσιμη**.
 */
export function DemandConcessionList({
  report,
}: {
  report: DemandConcessionReport;
}): React.ReactElement | null {
  const { t } = useTranslation(['property-market']);

  const suggested = report.ladders.filter((ladder) => ladder.headline !== null);
  const { multiAxis, unquantified } = report.census;

  if (suggested.length === 0 && multiAxis === 0 && unquantified === 0) return null;

  return (
    <section
      aria-label={t('property-market:demand.concession.heading')}
      className="rounded-md border border-border bg-card p-4"
    >
      <h3 className="text-sm font-semibold text-foreground">
        {t('property-market:demand.concession.heading')}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {t('property-market:demand.concession.lead')}
      </p>

      {suggested.length > 0 && (
        <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-sm">
          {suggested.map((ladder) => (
            <ConcessionSentence key={ladder.concession} ladder={ladder} />
          ))}
        </ul>
      )}

      {suggested.length === 0 && (
        <p className="mt-3 text-sm text-foreground">
          {t('property-market:demand.concession.unreachable')}
        </p>
      )}

      {(multiAxis > 0 || unquantified > 0) && (
        <ul className="mt-3 flex flex-col gap-1 text-sm text-muted-foreground">
          {multiAxis > 0 && (
            <li>{t('property-market:demand.concession.multiAxis', { count: multiAxis })}</li>
          )}
          {unquantified > 0 && (
            <li>
              {t('property-market:demand.concession.unquantified', { count: unquantified })}
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
