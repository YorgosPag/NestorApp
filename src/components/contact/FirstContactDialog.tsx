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
import {
  disclosureChannelOf,
  type FirstContactFormValues,
} from '@/lib/contact/first-contact-form-values';
import {
  openFirstContactFromScreen,
  type OpenContactResult,
} from '@/services/contact/first-contact.client';
import type { FirstContactTarget } from '@/types/first-contact';

import { ACT_KEYS, FIRST_CONTACT_NS } from './first-contact-labels';
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
  | { readonly kind: 'done'; readonly result: OpenContactResult };

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

  async function handleSubmit(): Promise<void> {
    setState({ kind: 'sending' });

    const result = await openFirstContactFromScreen({
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
    });

    setState({ kind: 'done', result });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(ACT_KEYS.dialogTitle)}</DialogTitle>
          <DialogDescription>{t(ACT_KEYS.dialogLead)}</DialogDescription>
        </DialogHeader>

        {state.kind === 'done' ? (
          <FirstContactDone result={state.result} onClose={() => onOpenChange(false)} />
        ) : (
          <FirstContactDisclosureForm
            values={values}
            onValuesChange={setValues}
            sending={state.kind === 'sending'}
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

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
  result,
  onClose,
}: {
  readonly result: OpenContactResult;
  readonly onClose: () => void;
}): React.JSX.Element {
  const { t } = useTranslation([FIRST_CONTACT_NS]);
  const closeRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <>
      <FirstContactOutcomeNotice result={result} />
      <DialogFooter>
        <Button ref={closeRef} type="button" onClick={onClose}>
          {t(ACT_KEYS.closeAfterDone)}
        </Button>
      </DialogFooter>
    </>
  );
}
