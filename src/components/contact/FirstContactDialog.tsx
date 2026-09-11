'use client';

/**
 * @fileoverview **Ο ΔΙΑΛΟΓΟΣ ΤΗΣ ΠΡΩΤΗΣ ΕΠΑΦΗΣ (ΠΕ1)** — ό,τι υπάρχει **μετά το κλικ**.
 * @related components/contact/FirstContactAction.tsx (το κουμπί) · ADR-843 §10.13
 * @module components/contact/FirstContactDialog
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΔΙΑΛΟΓΟΣ, ΟΧΙ ΔΙΚΗ ΤΟΥ ΔΙΕΥΘΥΝΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το Σ1 (`MandateRequestFormContent`) ζει σε δική του διεύθυνση επειδή χρειάζεται
 * ταυτότητα και `noindex`. Εδώ η πράξη είναι **δήλωση στοιχείων πάνω σε ήδη ανοιχτή
 * σελίδα** (αγγελία ή βιτρίνα), και ξεχωριστή διεύθυνση θα έσπαγε το πλαίσιο *(ποια
 * αγγελία; ποιο γραφείο;)* χωρίς κέρδος.
 *
 * ⛔ **ΚΑΜΙΑ κρίση εδώ** — μόνο δήλωση + μεταφορά. Ο μεταφορέας απαγορεύει ρητά
 * χωρητικότητα, αποκάλυψη και «γιατί ταιριάζει» σε πελατικό κώδικα· η **μορφή** της
 * φόρμας κρίνεται από το `lib/contact/first-contact-form-values.ts`, που είναι
 * **πρόληψη**, όχι δεύτερη αυθεντία.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΙΝΑΙ ΧΩΡΙΣΤΟ ΑΡΧΕΙΟ — ΤΟ ΖΗΤΗΣΕ **ΠΥΛΗ**, ΟΧΙ ΓΟΥΣΤΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Όσο ο διάλογος ζούσε μαζί με το κουμπί, **ολόκληρο** το `contact.first.*` έμπαινε στη
 * **στατική κλειστότητα** δύο **δημόσιων** διαδρομών. Μετρημένο 2026-09-04 (ADR-744,
 * CHECK 3.34):
 *
 * | Διαδρομή | Σφράγιση 02/09 | Με τον διάλογο μέσα | Ταβάνι (+25%) |
 * |---|---|---|---|
 * | `/listing/[id]` | 9181 | **12908** ❌ | 11476 |
 * | `/pro/[alias]` | 4406 | **6072** ❌ | 5507 |
 *
 * 🔑 **Η ΑΝΑΛΟΓΙΑ ΕΙΝΑΙ ΤΟ ΕΠΙΧΕΙΡΗΜΑ**: από τα **31** κλειδιά του `contact.first.*`,
 * **τρία** χρειάζονται στο πρώτο βάψιμο *(`cta` · `ctaPro` · `ctaHint` — το κουμπί)*.
 * Τα υπόλοιπα **28** *(τίτλος διαλόγου, πεδία, μηνύματα απόρριψης, αναλλοίωτα)* δεν
 * μπορούν να φανούν **πριν** πατήσει κάποιος. Τα κατέβαζε **κάθε** επισκέπτης κάθε
 * αγγελίας — και τα περισσότερα δεν πατούν.
 *
 * ⚠️ **ΤΟ ΚΟΥΜΠΙ ΔΕΝ ΜΠΗΚΕ ΕΔΩ ΜΕΣΑ, ΕΠΙΤΗΔΕΣ.** Είναι το **κύριο CTA** δημόσιας
 * σελίδας: με `ssr: false` θα εξαφανιζόταν από το HTML του διακομιστή μέχρι να φορτώσει
 * η JavaScript. Το όριο μπαίνει **ΜΕΤΑ** το κουμπί, όχι πριν — γι' αυτό το `t(ctaKey)`
 * έμεινε στο `FirstContactAction`.
 *
 * ⛔ **ΜΗΝ το ξαναενώσεις με το κουμπί** «για να είναι μαζί». Η πύλη θα κοκκινίσει με τα
 * ίδια δύο νούμερα, και η μόνη άλλη διέξοδος θα ήταν να **σφραγίσεις** +41% σε δημόσια
 * σελίδα για περιεχόμενο πίσω από κλικ.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAuthOptional } from '@/auth/contexts/AuthContext';
import { boundEmailOf, firstContactChannelOf } from '@/lib/contact/first-contact-channel';
import {
  disclosureChannelOf,
  type FirstContactFormValues,
} from '@/lib/contact/first-contact-form-values';
import {
  openFirstContactFromScreen,
  submitGuestContact,
  type GuestInviteResult,
  type OpenContactResult,
} from '@/services/contact/first-contact.client';
import type { FirstContactDeclaration } from '@/services/contact/first-contact-vocabulary';
import type { FirstContactTarget } from '@/types/first-contact';

import { ACT_KEYS, FIRST_CONTACT_NS, FORM_BLOCKER_KEYS } from './first-contact-labels';
import { GUEST_KEYS } from './first-contact-guest-labels';
import { FirstContactAwaitingProof } from './FirstContactAwaitingProof';
import { FirstContactDisclosureForm } from './FirstContactDisclosureForm';
import { FirstContactOutcomeNotice } from './FirstContactOutcomeNotice';

export interface FirstContactDialogProps {
  readonly target: FirstContactTarget;
  /** `null` = «πάτησα χωρίς να έχω δηλώσει ζήτηση». **Κανονικό.** */
  readonly demandId: string | null;
  readonly open: boolean;
  readonly onOpenChange: (next: boolean) => void;
}

/** Ό,τι έμαθε ο διάλογος — ποτέ `boolean` + μήνυμα (N.7.2 #3). */
type ActState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'sending' }
  /**
   * 🔑 **Η ΚΑΤΑΣΤΑΣΗ ΠΟΥ ΠΡΟΣΘΕΣΕ ΤΟ ADR-844, ΚΑΙ ΔΕΝ ΕΙΝΑΙ «ΕΝΔΙΑΜΕΣΗ»**: εδώ
   * **έχει γραφτεί πρόσκληση** και **δεν έχει γεννηθεί πράξη**. Ο ιδιοκτήτης δεν έμαθε
   * τίποτα, και δεν θα μάθει αν ο άνθρωπος φύγει τώρα.
   */
  | {
      readonly kind: 'awaiting';
      readonly invitationId: string;
      readonly maskedEmail: string;
      /**
       * ⚠️ **ΜΕΣΑ ΣΤΗΝ «ΑΝΑΜΟΝΗ», ΟΧΙ ΩΣ ΕΠΙΣΤΡΟΦΗ ΣΤΟ `sending`.** Το `sending`
       * ζωγραφίζει τη **φόρμα** — μια επαναποστολή θα πετούσε τον άνθρωπο πίσω σε
       * οθόνη που **έχει ήδη αφήσει**, για να τον ξαναφέρει εδώ ένα δευτερόλεπτο
       * μετά. Η οθόνη μένει· αλλάζει **μόνο** το κουμπί.
       */
      readonly resending: boolean;
    }
  | { readonly kind: 'done'; readonly result: OpenContactResult }
  /** Η πρόσκληση **δεν ζητήθηκε**. Άλλο πράγμα από «η πράξη απορρίφθηκε». */
  | { readonly kind: 'invite-refused'; readonly reason: InviteSetback };

/** Τα τρία μη-επιτυχή σκέλη του {@link GuestInviteResult}, χωρίς το `sent`. */
type InviteSetback = Exclude<GuestInviteResult['kind'], 'sent'>;

/**
 * **Έκβαση πρόσκλησης → κατάσταση οθόνης** — γραμμένη **μία** φορά.
 *
 * 🔑 **ΕΞΑΓΕΤΑΙ ΕΠΕΙΔΗ ΤΗΝ ΚΑΛΟΥΝ ΔΥΟ**: η **πρώτη** υποβολή και η **επαναποστολή**.
 * Όσο ζούσε ενσωματωμένη στο `handleSubmit`, το δεύτερο σημείο θα την **αντέγραφε** —
 * και η αντιγραφή θα ξεχνούσε το `resending: false`, αφήνοντας το κουμπί κλειδωμένο
 * σε «Στέλνεται…» **για πάντα** μετά από κάθε επιτυχημένη επαναποστολή.
 */
function stateOfInvite(invite: GuestInviteResult): ActState {
  return invite.kind === 'sent'
    ? {
        kind: 'awaiting',
        invitationId: invite.invitationId,
        maskedEmail: invite.maskedEmail,
        resending: false,
      }
    : { kind: 'invite-refused', reason: invite.kind };
}

/**
 * ⚠️ **Προσυμπλήρωση από τον συνδεδεμένο, όχι εφεύρεση**: το `FirebaseAuthUser` έχει
 * `displayName`/`email` — **όχι** τηλέφωνο, γι' αυτό εκείνο ξεκινά κενό.
 *
 * 🔑 Ξαναϋπολογίζεται σε **κάθε άνοιγμα**: ο άνθρωπος που έκλεισε, συνδέθηκε και
 * ξανάνοιξε πρέπει να δει τα στοιχεία του — όχι το κενό της προηγούμενης φοράς.
 */
function initialValues(name: string | null, email: string | null): FirstContactFormValues {
  return { name: name ?? '', email: email ?? '', phone: '' };
}

/** Η δήλωση, **μία φορά** — και οι δύο δρόμοι στέλνουν το **ίδιο** σώμα. */
function declarationOf(
  target: FirstContactTarget,
  demandId: string | null,
  values: FirstContactFormValues,
): FirstContactDeclaration {
  return {
    target,
    demandId,
    disclosure: {
      displayName: values.name.trim(),
      // ⚠️ `null`, ΟΧΙ κενό string — το `hasReplyChannel` του διακομιστή ρωτά
      //    `!== null`, και κενό string θα περνούσε ως «κανάλι» που δεν υπάρχει.
      email: disclosureChannelOf(values.email),
      phone: disclosureChannelOf(values.phone),
      // ⚠️ Ο χώρος συνομιλίας είναι ξεχωριστό στάδιο (ΠΕ4) — πάντα `false` εδώ.
      acceptsPlatformMessages: false,
    },
  };
}

export function FirstContactDialog({
  target,
  demandId,
  open,
  onOpenChange,
}: FirstContactDialogProps): React.JSX.Element {
  const { t } = useTranslation([FIRST_CONTACT_NS]);
  /**
   * 🔴 **`useAuthOptional`, ΠΟΤΕ `useAuth` — ΚΑΙ ΤΟ ΜΑΘΗΜΑ ΗΤΑΝ ΗΔΗ ΓΡΑΜΜΕΝΟ ΣΤΟ ΙΔΙΟ ADR.**
   *
   * Το `useAuth()` **πετά** *«must be used within an AuthProvider»* όταν λείπει ο
   * πάροχος. Και οι **δύο** ξενιστές αυτού του διαλόγου *(`/listing/[id]` και
   * `/pro/[alias]`)* ζουν στο **ελαφρύ κέλυφος**, που **δεν έχει `AuthProvider`** —
   * μόνο το `app/layout.tsx` και το `(me)` τον στήνουν.
   *
   * ⇒ Με το `useAuth`, το πρώτο κλικ σε **δημόσια αγγελία** έριχνε ολόκληρη την
   * επιφάνεια. Το έπιασαν **6 κόκκινα σκέλη** στο `agency-showcase-listings.test.tsx`,
   * που αποδίδει τη βιτρίνα **χωρίς** πάροχο — ακριβώς όπως η παραγωγή.
   *
   * ⚠️ **Το ίδιο το ADR-843 §10.9 το είχε ΗΔΗ μετρήσει** για τη σειρά του ΠΕ7:
   * *«το ελαφρύ κέλυφος **δεν έχει AuthProvider** ⇒ `useAuth()` εκεί θα ήταν
   * εξαίρεση»*. Γράφτηκε, και μετά παραβιάστηκε **τρεις ενότητες παρακάτω**.
   *
   * 🔑 Το `null` είναι **κανονικό**: ο ανώνυμος επισκέπτης **επιτρέπεται** να πλησιάσει
   * — απλώς γράφει τα στοιχεία του μόνος του, χωρίς προσυμπλήρωση.
   */
  const auth = useAuthOptional();
  const user = auth?.user ?? null;

  const [values, setValues] = React.useState<FirstContactFormValues>(() =>
    initialValues(user?.displayName ?? null, user?.email ?? null),
  );
  const [state, setState] = React.useState<ActState>({ kind: 'idle' });

  // ⚠️ **Ακμή `false → true`, ΟΧΙ «όσο είναι ανοιχτό».** Η προσυμπλήρωση διαβάζει τον
  //    συνδεδεμένο, και ο `useAuth` μπορεί να εκπέμψει ξανά όσο ο άνθρωπος
  //    πληκτρολογεί — χωρίς αυτή τη φύλαξη θα του **έσβηνε ό,τι έγραψε**.
  const wasOpen = React.useRef(false);
  React.useEffect(() => {
    if (open && !wasOpen.current) {
      setValues(initialValues(user?.displayName ?? null, user?.email ?? null));
      setState({ kind: 'idle' });
    }
    wasOpen.current = open;
  }, [open, user?.displayName, user?.email]);

  /**
   * 🔴 **ΤΟ ΔΕΜΕΝΟ EMAIL ΠΑΡΑΓΕΤΑΙ ΣΕ ΚΑΘΕ ΑΠΟΔΟΣΗ — ΔΕΝ ΑΝΤΙΓΡΑΦΕΤΑΙ** (ADR-844 §12).
   *
   * Η προσυμπλήρωση γράφει το email **μία** φορά, στην ακμή του ανοίγματος. Αν ο διάλογος
   * άνοιξε **πριν** φτάσει η ταυτότητα (`user === null`), η τιμή έμενε κενή και ο
   * άνθρωπος έγραφε ό,τι ήθελε — δηλαδή, ενδεχομένως, **ξένη** διεύθυνση, που μετά την
   * επιβεβαίωση γράφει την επαφή σε **άλλον** λογαριασμό και **αλλάζει τη συνεδρία**.
   * Παραγόμενη από τον λογαριασμό σε **κάθε** απόδοση, η τιμή δένεται τη στιγμή που ο
   * λογαριασμός γίνεται γνωστός — χωρίς effect, χωρίς κούρσα.
   *
   * 🔑 **ΕΝΑ `channel`, ΔΥΟ ΚΑΤΑΝΑΛΩΤΕΣ**: το `handleSubmit` διαλέγει **δρόμο** και η φόρμα
   * διαλέγει **κείμενο** από την ίδια τιμή της ίδιας απόδοσης
   * *(`lib/contact/first-contact-channel.ts`)* — να διαφωνήσουν είναι αδύνατο.
   */
  const boundEmail = boundEmailOf(user);
  const effective: FirstContactFormValues =
    boundEmail === null ? values : { ...values, email: boundEmail };
  const channel = firstContactChannelOf(user, effective.email);

  /**
   * **Η διακλάδωση του ADR-844, και είναι η ΜΟΝΗ.**
   *
   * ⚠️ Η δήλωση χτίζεται **πριν** τον φρουρό: το σώμα είναι **ταυτόσημο** και στους δύο
   * δρόμους *(`guestContactBodySchema` = `firstContactBodySchema`, αυτούσιο)*. Δύο
   * χωριστές κατασκευές θα απέκλιναν στην πρώτη προσθήκη πεδίου — σιωπηλά, γιατί το zod
   * αφαιρεί ό,τι δεν δηλώθηκε.
   */
  async function handleSubmit(): Promise<void> {
    setState({ kind: 'sending' });
    const declaration = declarationOf(target, demandId, effective);

    if (channel === 'proven') {
      setState({ kind: 'done', result: await openFirstContactFromScreen(declaration) });
      return;
    }

    setState(stateOfInvite(await submitGuestContact(declaration)));
  }

  /**
   * **Ο άνθρωπος ζητά ΝΕΟ σύνδεσμο** — και είναι η **ίδια** υποβολή, όχι δεύτερη.
   *
   * 🔑 **ΞΑΝΑΣΤΕΛΝΕΙ ΤΗΝ ΙΔΙΑ ΔΗΛΩΣΗ, ΚΑΙ Η ΠΑΛΙΑ ΠΡΟΣΚΛΗΣΗ ΣΒΗΝΕΙ ΜΟΝΗ ΤΗΣ.** Ο
   * `supersedePreviousInvitations` του διακομιστή σημειώνει την προηγούμενη ως
   * `superseded` **μέσα** στην ίδια έκδοση — δηλαδή **μηδέν** νέα μηχανική εδώ, και
   * **ποτέ** δύο ζωντανοί σύνδεσμοι. Ο δρόμος υπήρχε ήδη· έλειπε το **κουμπί**.
   *
   * ⚠️ **ΔΕΝ ξαναρωτά τον ταξινομητή καναλιού, και σωστά**: αν το κανάλι ήταν
   * αποδεδειγμένο, ο άνθρωπος **δεν θα ήταν** ποτέ σε αυτή την οθόνη. Ένας δεύτερος
   * έλεγχος εδώ θα ήταν κώδικας που δεν εκτελείται — δηλαδή κώδικας που κανείς δεν
   * μαθαίνει ότι χάλασε.
   */
  async function handleResend(): Promise<void> {
    if (state.kind !== 'awaiting') return;

    setState({ ...state, resending: true });
    setState(stateOfInvite(await submitGuestContact(declarationOf(target, demandId, effective))));
  }

  function close(): void {
    onOpenChange(false);
  }

  /**
   * **Ποια οθόνη είναι μπροστά** — εξαντλητικά πάνω στην κλειστή ένωση, χωρίς `default`.
   *
   * 🔑 **Έκτη κατάσταση ΔΕΝ μεταγλωττίζεται** χωρίς απάντηση στο *«τι βλέπει ο άνθρωπος
   * τότε;»* — ο ίδιος φρουρός με το `respond()` της πόρτας επιβεβαίωσης.
   */
  function renderBody(): React.JSX.Element {
    switch (state.kind) {
      case 'done':
        return (
          <FirstContactDone onClose={close}>
            <FirstContactOutcomeNotice result={state.result} />
          </FirstContactDone>
        );

      case 'invite-refused':
        return (
          <FirstContactDone onClose={close}>
            <p role="alert" className="m-0 rounded-md border border-border bg-card p-3 text-sm">
              {t(INVITE_SETBACK_KEYS[state.reason])}
            </p>
          </FirstContactDone>
        );

      case 'awaiting':
        return (
          <FirstContactAwaitingProof
            /**
             * 🔴 **ΤΟ `key` ΔΕΝ ΕΙΝΑΙ ΤΥΠΙΚΟΤΗΤΑ — ΕΙΝΑΙ Η ΣΩΣΤΟΤΗΤΑ.** Νέα πρόσκληση
             * σημαίνει ότι ο κωδικός που ίσως έχει **ήδη πληκτρολογήσει** ο άνθρωπος
             * **έπαψε να ισχύει**, και ότι η προηγούμενη άρνηση *(«έληξε»)* μιλά για
             * έγγραφο που **δεν υπάρχει πια**. Η αλλαγή ταυτότητας **ξαναγεννά** την
             * οθόνη: άδειο πεδίο, καμία άρνηση, νέα αναμονή. Χωρίς αυτό, η οθόνη θα
             * κρατούσε κατάσταση **ξένης** πρόσκλησης — σιωπηλά.
             */
            key={state.invitationId}
            invitationId={state.invitationId}
            resending={state.resending}
            onProven={(result) => setState({ kind: 'done', result })}
            onResend={() => void handleResend()}
            onCancel={close}
          />
        );

      case 'idle':
      case 'sending':
        return (
          <FirstContactDisclosureForm
            values={effective}
            onValuesChange={setValues}
            channel={channel}
            emailLocked={boundEmail !== null}
            sending={state.kind === 'sending'}
            onSubmit={handleSubmit}
            onCancel={close}
          />
        );
    }
  }

  const heading = headingOf(state);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(heading.titleKey)}</DialogTitle>
          {/*
            🔑 **Η ΠΕΡΙΓΡΑΦΗ ΑΛΛΑΖΕΙ ΜΑΖΙ ΜΕ ΤΗΝ ΚΑΤΑΣΤΑΣΗ, ΚΑΙ ΕΙΝΑΙ ΠΡΟΣΒΑΣΙΜΟΤΗΤΑ.**
            Το Radix τη δένει με `aria-describedby` στον διάλογο: όταν η οθόνη γίνεται
            «κοιτάξτε το email σας», ο αναγνώστης οθόνης **ανακοινώνει** τη νέα περιγραφή.
            Μια σταθερή περιγραφή θα του έλεγε ακόμη *«ο άλλος βλέπει όσα αφήσετε εδώ»* —
            για φόρμα που **δεν υπάρχει πια** μπροστά του.
          */}
          <DialogDescription>{t(heading.leadKey, heading.leadOptions)}</DialogDescription>
        </DialogHeader>

        {renderBody()}
      </DialogContent>
    </Dialog>
  );
}

/**
 * **Τι λέει η κεφαλίδα, ανά κατάσταση** — πλήρες, χωρίς `default`.
 *
 * ⚠️ Το `{email}` περνά **μόνο** στην κατάσταση που το χρησιμοποιεί: τα άλλα κείμενα δεν
 * έχουν παρεμβολή, και ένα καθολικό όρισμα θα ήταν αθόρυβο ψέμα για το τι διαβάζεται.
 */
function headingOf(state: ActState): {
  readonly titleKey: string;
  readonly leadKey: string;
  readonly leadOptions?: Record<string, string>;
} {
  if (state.kind === 'awaiting') {
    return {
      titleKey: GUEST_KEYS.title,
      leadKey: GUEST_KEYS.lead,
      leadOptions: { email: state.maskedEmail },
    };
  }
  return { titleKey: ACT_KEYS.dialogTitle, leadKey: ACT_KEYS.dialogLead };
}

/**
 * **Γιατί δεν ζητήθηκε η πρόσκληση** — τρία, και το καθένα αλλού.
 *
 * 🔑 **Το `email-required` ξαναχρησιμοποιεί το κλειδί της ΦΟΡΜΑΣ** και δεν αποκτά δικό
 * του: είναι **ακριβώς** το ίδιο πράγμα *(«γράψτε το email σας»)* ειπωμένο από τον
 * διακομιστή αντί από τον κριτή της φόρμας. Δεύτερο κείμενο θα απέκλινε στην πρώτη
 * διόρθωση διατύπωσης — και ο άνθρωπος θα διάβαζε **δύο** εκδοχές της ίδιας απαίτησης.
 *
 * ⚠️ Στην πράξη **δεν φτάνει εδώ**: το `contact-email-unset` το σταματά πριν φύγει
 * αίτημα. Υπάρχει επειδή η πόρτα το απαντά, και ό,τι απαντά η πόρτα οφείλει να έχει
 * κείμενο — αλλιώς η οθόνη θα έλεγε *«κάτι πήγε στραβά»* για κάτι **ονομάσιμο**.
 */
const INVITE_SETBACK_KEYS: Record<InviteSetback, string> = {
  'email-required': FORM_BLOCKER_KEYS['contact-email-unset'],
  'not-sent': GUEST_KEYS.notSent,
  failed: ACT_KEYS.failed,
};

/**
 * **Η έκβαση, με τρόπο να φύγεις.**
 *
 * 🔴 **ΤΟ ΚΟΥΜΠΙ ΚΛΕΙΣΙΜΑΤΟΣ ΔΕΝ ΕΙΝΑΙ ΔΙΑΚΟΣΜΗΤΙΚΟ.** Όταν η φόρμα αντικαθίσταται από
 * την ειδοποίηση, **κάθε** εστιάσιμο στοιχείο του διαλόγου εξαφανίζεται — και η εστίαση
 * πέφτει στο σώμα. Ο χρήστης πληκτρολογίου έμενε με διάλογο **χωρίς σημείο εισόδου**·
 * ο `Escape` του Radix δούλευε, αλλά **κανείς δεν του το είπε**.
 *
 * ⚠️ Η εστίαση μετακινείται εδώ ρητά: το `role="alert"` της ειδοποίησης **ανακοινώνει**,
 * αλλά δεν **μεταφέρει** — δύο διαφορετικά πράγματα.
 */
function FirstContactDone({
  children,
  onClose,
}: {
  /**
   * ⚠️ **Παιδί, όχι `result` — και άλλαξε επίτηδες (ADR-844).** Ο διάλογος έχει πλέον
   * **δύο** τελικές οθόνες: η μία λέει τι απέγινε η **πράξη**, η άλλη τι απέγινε η
   * **πρόσκληση**. Ό,τι είναι κοινό —η εστίαση και ο τρόπος να φύγεις— ζει εδώ· ό,τι
   * διαφέρει το δίνει ο καλών. Ένα δεύτερο `FirstContactDone` θα ξέχναγε την εστίαση.
   */
  readonly children: React.ReactNode;
  readonly onClose: () => void;
}): React.JSX.Element {
  const { t } = useTranslation([FIRST_CONTACT_NS]);
  const closeRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <>
      {children}
      <DialogFooter>
        <Button ref={closeRef} type="button" onClick={onClose}>
          {t(ACT_KEYS.closeAfterDone)}
        </Button>
      </DialogFooter>
    </>
  );
}
