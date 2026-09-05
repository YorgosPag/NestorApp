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
import type { FirebaseAuthUser } from '@/auth/types/auth.types';
import { sameChannelEmail } from '@/lib/contact/channel-email';
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
  | { readonly kind: 'awaiting'; readonly invitationId: string; readonly maskedEmail: string }
  | { readonly kind: 'done'; readonly result: OpenContactResult }
  /** Η πρόσκληση **δεν ζητήθηκε**. Άλλο πράγμα από «η πράξη απορρίφθηκε». */
  | { readonly kind: 'invite-refused'; readonly reason: InviteSetback };

/** Τα τρία μη-επιτυχή σκέλη του {@link GuestInviteResult}, χωρίς το `sent`. */
type InviteSetback = Exclude<GuestInviteResult['kind'], 'sent'>;

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

/**
 * 🔴 **Ο ΕΝΑΣ ΦΡΟΥΡΟΣ ΤΟΥ ADR-844: «ΕΙΝΑΙ ΤΟ ΚΑΝΑΛΙ ΗΔΗ ΑΠΟΔΕΔΕΙΓΜΕΝΟ;»**
 *
 * Απαντά **ένα** πράγμα, και από αυτό κρέμονται δύο εντελώς διαφορετικοί δρόμοι:
 * ✅ ⇒ **η σημερινή διαδρομή, μηδέν αλλαγή** *(η πράξη φεύγει αμέσως)*·
 * ❌ ⇒ πρόσκληση, email, απόδειξη.
 *
 * **Τρεις όροι, και κανένας δεν περισσεύει:**
 *
 * | Όρος | Τι πιάνει |
 * |---|---|
 * | συνδεδεμένος | ο ανώνυμος **δεν έχει** τίποτα αποδεδειγμένο |
 * | `email === email λογαριασμού` | ο συνδεδεμένος που γράφει **άλλη** διεύθυνση — αυτήν **δεν** την αποδείξαμε ποτέ |
 * | `emailVerified` | ο λογαριασμός που **δεν πάτησε ποτέ** το δικό του email επιβεβαίωσης |
 *
 * ⛔ **ΜΗΝ αφαιρέσεις τον τρίτο «γιατί είναι συνδεδεμένος, άρα εντάξει».** Η σύνδεση
 * αποδεικνύει ότι κάποιος ξέρει τον **κωδικό**, όχι ότι διαβάζει το **γραμματοκιβώτιο**.
 * Ήταν ακριβώς η ανισότητα του ADR-844: το `first-contact-body.ts` δηλώνει
 * `email: z.string().max(320).nullable()` — **δεν ελέγχεται καν ως email** — και
 * **καμία** σύγκριση με το email του λογαριασμού δεν υπήρχε πουθενά στο `src/`. Ο
 * **ανώνυμος** θα ήταν ο μόνος με αποδεδειγμένα στοιχεία.
 *
 * ⚠️ Η σύγκριση περνά από το {@link sameChannelEmail} — τον **ίδιο** κανονικοποιητή που
 * χρησιμοποιεί ο διακομιστής. Μια ωμή `===` εδώ θα έστελνε περιττή πρόσκληση σε άνθρωπο
 * που απλώς έγραψε `Maria@` με κεφαλαίο.
 */
function isChannelProven(user: FirebaseAuthUser | null, typedEmail: string): boolean {
  if (user === null || !user.emailVerified) return false;
  return sameChannelEmail(user.email, typedEmail);
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
   * **Η διακλάδωση του ADR-844, και είναι η ΜΟΝΗ.**
   *
   * ⚠️ Η δήλωση χτίζεται **πριν** τον φρουρό: το σώμα είναι **ταυτόσημο** και στους δύο
   * δρόμους *(`guestContactBodySchema` = `firstContactBodySchema`, αυτούσιο)*. Δύο
   * χωριστές κατασκευές θα απέκλιναν στην πρώτη προσθήκη πεδίου — σιωπηλά, γιατί το zod
   * αφαιρεί ό,τι δεν δηλώθηκε.
   */
  async function handleSubmit(): Promise<void> {
    setState({ kind: 'sending' });
    const declaration = declarationOf(target, demandId, values);

    if (isChannelProven(user, values.email)) {
      setState({ kind: 'done', result: await openFirstContactFromScreen(declaration) });
      return;
    }

    const invite = await submitGuestContact(declaration);
    setState(
      invite.kind === 'sent'
        ? { kind: 'awaiting', invitationId: invite.invitationId, maskedEmail: invite.maskedEmail }
        : { kind: 'invite-refused', reason: invite.kind },
    );
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
            invitationId={state.invitationId}
            onProven={(result) => setState({ kind: 'done', result })}
            onCancel={close}
          />
        );

      case 'idle':
      case 'sending':
        return (
          <FirstContactDisclosureForm
            values={values}
            onValuesChange={setValues}
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
