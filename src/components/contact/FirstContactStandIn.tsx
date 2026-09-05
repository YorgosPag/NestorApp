'use client';

/**
 * @fileoverview **ΤΙ ΜΠΑΙΝΕΙ ΣΤΗ ΘΕΣΗ ΤΟΥ ΚΟΥΜΠΙΟΥ** — ADR-843 §10.18.
 * @related components/contact/FirstContactAction.tsx *(το κουμπί που ρωτά ήσυχα)*
 * @related components/contact/FirstContactOutcomeNotice.tsx *(ο ΕΝΑΣ πίνακας αρνήσεων)*
 * @module components/contact/FirstContactStandIn
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΑΝΤΙΚΑΤΑΣΤΑΣΗ, ΟΧΙ ΑΠΟΚΡΥΨΗ — ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ ΤΟΥ GIORGIO (2026-09-05)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο ιδιοκτήτης **δεν ήρθε εδώ κατά λάθος**: άνοιξε τη δημόσια σελίδα του για να δει
 * **πώς φαίνεται το ακίνητό του**. Ένα κουμπί που απλώς **λείπει** τον αφήνει να
 * απορεί *«γιατί δεν το βλέπω;»*· η αντικατάσταση του δίνει **ακριβώς αυτό που ήθελε**.
 *
 * 🏆 **Είναι η πρακτική των μεγάλων, και μετρήθηκε**: το Airbnb δεν κρύβει σιωπηλά την
 * κράτηση στο δικό σου κατάλυμα — λέει *«you can't book your own listing»*· το Zillow
 * δίνει στον ιδιοκτήτη **Owner Dashboard** *(«edit your home information»)* αντί για
 * φόρμα επικοινωνίας. Και στα δύο, η απάντηση κρίνεται **ανά θεατή στον διακομιστή** —
 * ποτέ ως πεδίο μέσα σε κοινό, cacheable φορτίο.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΓΙΑΤΙ ΕΙΝΑΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ, ΤΕΜΠΕΛΙΚΑ ΦΟΡΤΩΜΕΝΟ — ΤΟ ΖΗΤΗΣΕ ΠΥΛΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ό,τι ζει στη **στατική κλειστότητα** του {@link FirstContactAction} ταξιδεύει σε
 * **δύο δημόσιες** διαδρομές, για **κάθε** επισκέπτη (CHECK 3.34 / ADR-744). Αυτά τα
 * κείμενα **δεν μπορούν να φανούν** πριν μάθουμε **ποιος** κοιτάζει — και το μαθαίνουμε
 * μόνο μετά από αίτημα δικτύου, δηλαδή **ποτέ** στο πρώτο βάψιμο.
 *
 * ⇒ Ίδιο ακριβώς επιχείρημα με τον `FirstContactDialog`, που μετρήθηκε σε **+41%** και
 * **+38%** πάνω από τη σφράγιση όταν ζούσε μέσα στο κουμπί. ⛔ **ΜΗΝ το ενώσεις με το
 * κουμπί «για να είναι μαζί».**
 *
 * ⚠️ **ΚΑΜΙΑ ΚΡΙΣΗ ΕΔΩ.** Διαβάζει την ετυμηγορία που έφερε ο μεταφορέας και την
 * αποδίδει. Αν βρεθείς να συγκρίνεις ταυτότητες ή να ρωτάς `custody`, φτιάχνεις τη
 * **δεύτερη αυθεντία** που το `first-contact-admission.ts` υπάρχει για να μην υπάρξει.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Link } from '@/lib/workspace/navigation';
import type { ContactAdmissionAnswer } from '@/services/contact/first-contact.client';

import { ACT_KEYS, FIRST_CONTACT_NS, MY_CONTACTS_ROUTE } from './first-contact-labels';
import { RefusedBody, type Translator } from './FirstContactOutcomeNotice';

/**
 * **Οι δύο ετυμηγορίες που αντικαθιστούν το κουμπί** — και **μόνο** αυτές.
 *
 * 🔑 Το `open` και το `unknown` **δεν φτάνουν ποτέ εδώ**, και ο τύπος το κάνει
 * **ανέκφραστο**: και τα δύο σημαίνουν *«δείξε το κουμπί»*, άρα ένα φύλλο που θα τα
 * δεχόταν θα έπρεπε να αποδώσει **τίποτα** — δηλαδή θα υπήρχε διαδρομή όπου αυτό το
 * αρχείο φορτώνεται **χωρίς λόγο**, στη δημόσια σελίδα.
 */
export type FirstContactStandInAnswer = Extract<
  ContactAdmissionAnswer,
  { readonly kind: 'already' } | { readonly kind: 'refused' }
>;

export interface FirstContactStandInProps {
  readonly answer: FirstContactStandInAnswer;
  /** Ίδιο λεξιλόγιο με το κουμπί: η αγγελία λέει `listing`, η βιτρίνα `professional`. */
  readonly variant: 'listing' | 'professional';
}

export function FirstContactStandIn({
  answer,
  variant,
}: FirstContactStandInProps): React.JSX.Element {
  const { t } = useTranslation([FIRST_CONTACT_NS]);

  return (
    // ⚠️ **ΚΑΝΕΝΑ `role="alert"`, ΕΠΙΤΗΔΕΣ.** Ο `FirstContactOutcomeNotice` το βάζει
    //    γιατί εκεί **μόλις έγινε πράξη**· εδώ ο άνθρωπος απλώς άνοιξε μια σελίδα.
    //    Ανακοίνωση χωρίς γεγονός είναι θόρυβος για όποιον ακούει την οθόνη του.
    <aside className="flex flex-col items-start gap-2 rounded-md border border-border bg-card p-3 text-sm text-foreground">
      {answer.kind === 'already' ? (
        <AlreadySentBody t={t} />
      ) : answer.reason === 'contact-own-target' ? (
        <OwnTargetBody variant={variant} manageHref={answer.manageHref} t={t} />
      ) : (
        // 🔑 **Ο ΕΝΑΣ πίνακας αρνήσεων**, δανεισμένος αυτούσιος: κάθε κωδικός έχει ήδη
        //    πρόταση και διέξοδο, και η χωρητικότητα διαβάζει τη **μία** σταθερά.
        <RefusedBody reason={answer.reason} t={t} />
      )}
    </aside>
  );
}

/**
 * **«Αυτή είναι η αγγελία σας»** — η δήλωση, και ο δρόμος προς τα δικά του.
 *
 * 🔶 **ΤΟ `manageHref === null` ΕΙΝΑΙ ΟΝΟΜΑΣΜΕΝΗ ΑΠΟΥΣΙΑ**: η σελίδα διαχείρισης μιας
 * **εταιρικής** αγγελίας ζει **μέσα σε χώρο**, και από δημόσια σελίδα κανείς δεν μπορεί
 * να τον ονομάσει — δες `manageHrefOfOwnTarget` για τους δύο ανεξάρτητους λόγους. Η
 * δήλωση μένει· ο σύνδεσμος λείπει **δηλωμένα**, αντί να οδηγεί σε 404.
 */
function OwnTargetBody({
  variant,
  manageHref,
  t,
}: {
  readonly variant: 'listing' | 'professional';
  readonly manageHref: string | null;
  readonly t: Translator;
}): React.JSX.Element {
  const listing = variant === 'listing';

  return (
    <>
      <p className="m-0 font-medium">
        {t(listing ? ACT_KEYS.ownListingTitle : ACT_KEYS.ownProTitle)}
      </p>
      <p className="m-0 text-muted-foreground">
        {t(listing ? ACT_KEYS.ownListingLead : ACT_KEYS.ownProLead)}
      </p>
      {manageHref !== null && (
        <Link
          href={manageHref}
          className="font-medium text-foreground underline underline-offset-4"
        >
          {t(ACT_KEYS.ownListingAction)}
        </Link>
      )}
    </>
  );
}

/**
 * **«Έχετε ήδη ανοιχτή επαφή»** — κατάσταση, **ποτέ** σφάλμα.
 *
 * 🔑 Η ιδεμποτησία είναι **επιτυχία** (Στάδιο Γ, Κ7): ο άνθρωπος **πέτυχε ήδη** αυτό
 * που θα πήγαινε να κάνει. Η διέξοδος είναι η **ίδια** που δίνει η έκβαση της πράξης —
 * ο κατάλογος των δικών του επαφών, από τον **ένα** ορισμό της διεύθυνσης.
 */
function AlreadySentBody({ t }: { readonly t: Translator }): React.JSX.Element {
  return (
    <>
      <p className="m-0 font-medium">{t(ACT_KEYS.alreadySentTitle)}</p>
      <p className="m-0 text-muted-foreground">{t(ACT_KEYS.alreadySentLead)}</p>
      <Link
        href={MY_CONTACTS_ROUTE}
        className="font-medium text-foreground underline underline-offset-4"
      >
        {t(ACT_KEYS.seeMine)}
      </Link>
    </>
  );
}
