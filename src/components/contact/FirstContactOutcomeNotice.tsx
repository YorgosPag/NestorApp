'use client';

/**
 * @fileoverview **ΤΙ ΑΠΕΓΙΝΕ Η ΠΡΩΤΗ ΕΠΑΦΗ** — η έκβαση, στην οθόνη.
 * @related components/mandate/MandateRequestOutcomeNotice.tsx (το πρότυπο) · ADR-843 §10
 * @module components/contact/FirstContactOutcomeNotice
 *
 * ⚠️ **ΔΕΝ κρίνει τίποτα.** Διαβάζει το κλειστό `OpenContactResult` (μεταφορέας
 * `services/contact/first-contact.client.ts`) και αποδίδει το αντίστοιχο κείμενο. Ποιος
 * κωδικός έχει διέξοδο το λέει ο στατικός πίνακας {@link REJECTION_REMEDY} — εδώ γίνεται
 * μόνο η **απόδοση**.
 *
 * 🔑 **`opened` + `created:false` είναι ΕΠΙΤΥΧΙΑ, όχι προειδοποίηση**: ο άνθρωπος είχε
 * ήδη ανοιχτή την πράξη — ίδια ουδέτερη μορφή με `created:true`, ποτέ destructive.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Link } from '@/lib/workspace/navigation';
import type { OpenContactResult } from '@/services/contact/first-contact.client';
import type { FirstContactRejection } from '@/services/contact/first-contact-vocabulary';
import type { FirstContactInvariant } from '@/types/first-contact';

import {
  ACT_KEYS,
  FIRST_CONTACT_NS,
  INVARIANT_KEYS,
  MY_CONTACTS_ROUTE,
  REJECTION_KEYS,
  REJECTION_REMEDY,
} from './first-contact-labels';
import { OPEN_CONTACT_CAPACITY } from '@/lib/contact/first-contact-limits';

export type Translator = ReturnType<typeof useTranslation>['t'];

export interface FirstContactOutcomeNoticeProps {
  readonly result: OpenContactResult;
  /**
   * Ο αριθμός χωρητικότητας για το `{capacity}` του μηνύματος `capacity-full`.
   *
   * 🔴 **ΓΙΑΤΙ ΕΧΕΙ ΠΡΟΕΠΙΛΟΓΗ ΚΑΙ ΔΕΝ ΜΕΝΕΙ `undefined`.** Η άρνηση του διακομιστή
   * κουβαλά **μόνο** τον λόγο (`{ error: 'CONTACT_REFUSED', reason }`) — και σωστά:
   * το 422 απαντά *«δεν επιτρέπεται»*, δεν είναι προβολή κατάστασης. Χωρίς
   * προεπιλογή όμως, η οθόνη θα τύπωνε *«Έχετε __ ανοιχτές επαφές»* με **τρύπα**.
   *
   * 🔑 **ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΔΕΥΤΕΡΗ ΑΥΘΕΝΤΙΑ** *(που θα έσπαγε το Κ9)*: το
   * {@link OPEN_CONTACT_CAPACITY} είναι **η ΙΔΙΑ σταθερά** που ρωτά ο γραφέας μέσα
   * στο `runTransaction` — ένα `import`, όχι δεύτερος μετρητής. Το Κ9 απαγορεύει στην
   * οθόνη να **ξαναγράψει** τον αριθμό· εδώ τον **ζητά από τη μία πηγή**.
   *
   * ⚠️ Το `first-contact-limits.ts` είναι **leaf** *(μηδέν imports, κανένα
   * `server-only`)* — γι' αυτό η εισαγωγή είναι ασφαλής στον φυλλομετρητή. Αν κάποτε
   * αποκτήσει εξάρτηση διακομιστή, **αυτή η γραμμή σπάει πρώτη**.
   *
   * 🔶 Πέρασέ το ρητά **μόνο** αν κάποτε η άρνηση αρχίσει να κουβαλά τον δικό της
   * αριθμό — τότε ο δικός του υπερισχύει, γιατί ξέρει **πότε** κρίθηκε.
   */
  readonly capacity?: number;
}

/** Η ειδοποίηση της έκβασης — **μία** μορφή, τέσσερις δυνατές αναγνώσεις. */
export function FirstContactOutcomeNotice({
  result,
  capacity = OPEN_CONTACT_CAPACITY,
}: FirstContactOutcomeNoticeProps): React.JSX.Element {
  const { t } = useTranslation([FIRST_CONTACT_NS]);

  return (
    // ⚠️ `role="alert"` στο δοχείο, όπως το πρότυπο `MandateRequestOutcomeNotice` —
    //    ο σύνδεσμος της διεξόδου ανακοινώνεται μαζί με τον λόγο.
    <aside
      role="alert"
      className="flex flex-col items-start gap-2 rounded-md border border-border bg-card p-3 text-sm text-foreground"
    >
      {renderOutcomeBody(result, t, capacity)}
    </aside>
  );
}

function renderOutcomeBody(
  result: OpenContactResult,
  t: Translator,
  capacity: number,
): React.JSX.Element {
  switch (result.kind) {
    case 'opened':
      return <OpenedBody created={result.created} t={t} />;
    case 'refused':
      return <RefusedBody reason={result.reason} capacity={capacity} t={t} />;
    case 'invalid':
      return <InvalidBody violations={result.violations} t={t} />;
    case 'failed':
      return <p className="m-0">{t(ACT_KEYS.failed)}</p>;
  }
}

/** `opened` — **επιτυχία και στις δύο περιπτώσεις** (Κ7): μόνο ο τίτλος αλλάζει. */
function OpenedBody({
  created,
  t,
}: {
  readonly created: boolean;
  readonly t: Translator;
}): React.JSX.Element {
  return (
    <>
      <p className="m-0 font-medium">
        {t(created ? ACT_KEYS.openedTitle : ACT_KEYS.alreadyOpenTitle)}
      </p>
      <p className="m-0 text-muted-foreground">
        {t(created ? ACT_KEYS.openedLead : ACT_KEYS.alreadyOpenLead)}
      </p>
      <Link
        href={MY_CONTACTS_ROUTE}
        className="font-medium text-foreground underline underline-offset-4"
      >
        {t(ACT_KEYS.seeMine)}
      </Link>
    </>
  );
}

/**
 * `refused` — λόγος **και** διέξοδος, αν {@link REJECTION_REMEDY} έχει μία.
 *
 * 🔑 **ΕΞΑΓΕΤΑΙ, ΕΠΕΙΔΗ ΤΟ ΙΔΙΟ ΕΡΩΤΗΜΑ ΡΩΤΙΕΤΑΙ ΣΕ ΔΥΟ ΣΤΙΓΜΕΣ** *(ADR-843 §10.18)*:
 * εδώ **μετά** την υποβολή, και στο {@link FirstContactStandIn} **πριν** πατήσει
 * κανείς. Είναι η **ίδια** μετάφραση *«κωδικός άρνησης → πρόταση + διέξοδος»*, και
 * δεύτερο αντίγραφό της θα απέκλινε την πρώτη φορά που κάποιος διόρθωνε τη μία
 * διατύπωση — ή θα ξεχνούσε τον **έκτο** κωδικό στο ένα από τα δύο σημεία.
 *
 * ⚠️ **Ο ΞΕΝΙΣΤΗΣ ΔΙΝΕΙ ΤΟ ΔΟΧΕΙΟ, ΚΑΙ ΕΙΝΑΙ ΟΥΣΙΑΣΤΙΚΟ**: εδώ τυλίγεται σε
 * `role="alert"` γιατί **μόλις έγινε πράξη**· εκεί **όχι**, γιατί τίποτα δεν συνέβη —
 * ο άνθρωπος απλώς άνοιξε μια σελίδα. Ένα `alert` σε φόρτωση σελίδας είναι ανακοίνωση
 * χωρίς γεγονός.
 */
export function RefusedBody({
  reason,
  capacity = OPEN_CONTACT_CAPACITY,
  t,
}: {
  readonly reason: FirstContactRejection;
  /** Δες {@link FirstContactOutcomeNoticeProps.capacity} — **μία** σταθερά, ποτέ δεύτερος μετρητής. */
  readonly capacity?: number;
  readonly t: Translator;
}): React.JSX.Element {
  const remedy = REJECTION_REMEDY[reason];
  // 🔴 Η παρεμβολή {capacity} περνά ΜΟΝΟ για τον λόγο που τη χρησιμοποιεί — τα άλλα
  //    τέσσερα κλειδιά δεν έχουν `{capacity}` στο κείμενό τους.
  const options = reason === 'capacity-full' ? { capacity } : undefined;

  return (
    <>
      <p className="m-0">{t(REJECTION_KEYS[reason], options)}</p>
      {remedy !== null && (
        <Link
          href={remedy.href}
          className="font-medium text-foreground underline underline-offset-4"
        >
          {t(remedy.labelKey)}
        </Link>
      )}
    </>
  );
}

/** `invalid` — κλειστή λίστα αμετάβλητων, καθένα με το δικό του κλειδί. */
function InvalidBody({
  violations,
  t,
}: {
  readonly violations: readonly FirstContactInvariant[];
  readonly t: Translator;
}): React.JSX.Element {
  return (
    <>
      <p className="m-0 font-medium">{t(ACT_KEYS.issuesHeading)}</p>
      <ul className="m-0 flex list-disc flex-col gap-1 pl-5">
        {violations.map((violation) => (
          <li key={violation}>{t(INVARIANT_KEYS[violation])}</li>
        ))}
      </ul>
    </>
  );
}
