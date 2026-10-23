'use client';

/**
 * **«Τι τις σταμάτησε»** — η κλειστή λογιστική της Α5, εφαρμοσμένη στην άρνηση.
 *
 * @related ADR-777 §7 (Α9 · Α5 κανόνας 27) · SPEC-777B §12.6 · lib/demand/demand-answer.ts
 * @module components/demand/DemandBlockerList
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΑΥΤΟ ΤΟ ΚΟΥΤΙ ΕΙΝΑΙ Ο ΟΡΟΣ ΕΠΙΒΙΩΣΗΣ, ΟΧΙ ΔΙΑΚΟΣΜΗΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το §12.6 απαιτεί να λέμε *«τι υπάρχει κοντά **και τι το εμποδίζει**»*. Χωρίς αυτή
 * τη λίστα, το «0 αποτελέσματα» είναι **αδιάκριτο** από «δεν υπάρχει τέτοιο ακίνητο
 * στην Ελλάδα» — και σήμερα θα ήταν **ψευδές στη συντριπτική πλειοψηφία**: το επίπεδο
 * Α δεν έχει γραμμές, η διαθεσιμότητα δεν αντλείται, οι αποστάσεις γειτονιάς δεν
 * μετρώνται. Δηλαδή η συνηθέστερη αιτία άρνησης είναι **η δική μας άγνοια**.
 *
 * 🔑 Η **Α5** το λέει ως κανόνα: δεν μετατρέπουμε *«δεν ξέρουμε πού είναι»* σε *«δεν
 * είναι εδώ»*. Αυτή η λίστα είναι ο τόπος όπου ο κανόνας γίνεται ορατός στον χρήστη.
 *
 * ⚠️ **Ταξινομημένη κατά πλήθος, φθίνουσα, με το όνομα ως τελικό διαχωριστή** — ώστε
 * η σειρά να μην εξαρτάται από τη σειρά που ήρθαν τα έγγραφα από το Firestore. Δύο
 * φορτώσεις της ίδιας οθόνης οφείλουν να διαβάζονται το ίδιο.
 */

import React from 'react';
import { SectionFrame } from '@/components/ui/section-frame';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { DemandBlocker } from '@/lib/demand/demand-match-vocabulary';
import { getCurrentLocale } from '@/lib/intl-utils';
import { availabilityPromisePhrase } from '@/lib/listings/availability-phrase';
import type { ScheduledAvailability } from '@/types/availability-history';

/** Πλήθος ανά εμπόδιο → ταξινομημένη, σταθερή λίστα. */
function orderedEntries(
  tally: ReadonlyMap<DemandBlocker, number>,
): readonly (readonly [DemandBlocker, number])[] {
  return [...tally.entries()].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
}

/**
 * ADR-919 §11 — «πότε θα υπάρχει»: η νωρίτερη υπόσχεση των αγγελιών που σταμάτησε ο χρόνος, με την ΙΔΙΑ φράση με
 * κάρτα, σελίδα και email. Η κρίση έγινε στη μηχανή (`earliestTimingBlockedPromise`)· εδώ μόνο αποδίδεται.
 */
function TimingHorizon({ horizon }: { horizon: ScheduledAvailability }): React.ReactElement {
  const { t } = useTranslation(['property-market', 'common-shared']);
  const promise = availabilityPromisePhrase(horizon, t, getCurrentLocale());
  return <span className="block text-xs">{t('property-market:demand.blocker.earliestDelivery', { promise })}</span>;
}

export function DemandBlockerList({
  blockedBy,
  timingHorizon = null,
}: {
  blockedBy: ReadonlyMap<DemandBlocker, number>;
  timingHorizon?: ScheduledAvailability | null;
}): React.ReactElement | null {
  const { t } = useTranslation(['property-market']);

  const entries = orderedEntries(blockedBy);
  if (entries.length === 0) return null;

  return (
    <SectionFrame title={t('property-market:demand.blocker.heading')} headingLevel="h3" titleSize="sm">

      <dl className="mt-2 flex flex-col gap-1 text-sm">
        {entries.map(([blocker, count]) => (
          <div key={blocker} className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">
              {t(`property-market:demand.blocker.${blocker}`)}
              {blocker === 'not-available-then' && timingHorizon !== null && <TimingHorizon horizon={timingHorizon} />}
            </dt>
            {/*
              Ο αριθμός περνά από κλειδί i18n αντί να γραφτεί ωμός στο JSX: ο
              **N.11** δεν κάνει εξαίρεση για ψηφία, και η μορφοποίηση χιλιάδων
              διαφέρει ανά γλώσσα — κάτι που θα φαινόταν μόνο στην πρώτη τετραψήφια.
            */}
            <dd className="font-medium tabular-nums text-foreground">
              {t('property-market:demand.blocker.count', { count })}
            </dd>
          </div>
        ))}
      </dl>
    </SectionFrame>
  );
}
