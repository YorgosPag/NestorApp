'use client';

/**
 * @fileoverview **ΤΟ ΚΟΥΜΠΙ ΤΗΣ ΠΡΩΤΗΣ ΕΠΑΦΗΣ (ΠΕ1)** — από δημόσια αγγελία ή βιτρίνα.
 * @related components/contact/FirstContactDialog.tsx (ό,τι υπάρχει ΜΕΤΑ το κλικ) · ADR-843 §10.13
 * @related components/contact/FirstContactStandIn.tsx (ό,τι μπαίνει ΣΤΗ ΘΕΣΗ του) · §10.18
 * @module components/contact/FirstContactAction
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΕΙΝΑΙ **ΟΡΙΟ**, ΟΧΙ ΑΠΛΩΣ ΚΟΥΜΠΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ό,τι μένει εδώ ταξιδεύει στη **στατική κλειστότητα** δύο **δημόσιων** διαδρομών
 * *(`/listing/[id]` και `/pro/[alias]`)*· ό,τι μπαίνει πίσω από το `dynamic` **δεν**.
 * Μετρημένο 2026-09-04 (ADR-744, CHECK 3.34): με τον διάλογο μέσα, οι δύο διαδρομές
 * πήγαν **12908 > 11476** και **6072 > 5507** — δηλαδή **+41%** και **+38%** πάνω από
 * τη σφράγιση της 02/09, για κλειδιά που **δεν μπορούν να φανούν πριν το κλικ**.
 *
 * 🔑 **Η ΓΡΑΜΜΗ ΠΕΡΝΑΕΙ ΑΚΡΙΒΩΣ ΕΔΩ, ΚΑΙ ΟΧΙ ΠΙΟ ΠΑΝΩ.** Από τα κλειδιά του
 * `contact.first.*`, **τρία** χρειάζονται στο πρώτο βάψιμο — το κείμενο του κουμπιού.
 * Αυτό είναι το **κύριο CTA** δημόσιας σελίδας: αν έμπαινε κι αυτό πίσω από
 * `ssr: false`, θα **έλειπε από το HTML του διακομιστή** μέχρι να φορτώσει η
 * JavaScript. Γι' αυτό το `t(ctaKey)` μένει **στατικό** και **δύο** φύλλα φορτώνονται
 * τεμπέλικα: ο **διάλογος** *(δεν φαίνεται πριν το κλικ)* και ο
 * **αντικαταστάτης** *(δεν φαίνεται πριν μάθουμε ποιος κοιτάζει)*.
 *
 * ⚠️ **`mounted` ΚΑΙ `open` ΕΙΝΑΙ ΔΥΟ ΠΡΑΓΜΑΤΑ.** Το `mounted` μένει `true` μετά το
 * πρώτο άνοιγμα ώστε το κλείσιμο να προλάβει να **παίξει** *(αποπροσάρτηση στο κλικ θα
 * έκοβε την κίνηση του Radix και θα ξαναζητούσε το chunk σε κάθε άνοιγμα)*.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ✅ ΤΟ ΟΡΙΟ ΤΟΥ §10.13 ΕΚΛΕΙΣΕ — ΚΑΙ **ΟΧΙ** ΜΕ ΠΕΔΙΟ ΣΤΟ ΔΗΜΟΣΙΟ ΣΧΗΜΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Εδώ έγραφε ότι *«η θεραπεία θα ήταν ένα `viewerCanContact` στην απάντηση της
 * σελίδας»*. **Δύο** από τις παραδοχές εκείνης της πρότασης μετρήθηκαν **λανθασμένες**:
 *
 * | Παραδοχή | Τι ισχύει |
 * |---|---|
 * | «υπάρχει απάντηση σελίδας» | ❌ Η σελίδα δηλώνει *«καμία απόδοση στον διακομιστή του περιεχομένου»*· η αγγελία είναι **κοινό έγγραφο** (`public_listings`) που διαβάζει ο **πελάτης**, ίδιο για κάθε επισκέπτη |
 * | «το ελαφρύ κέλυφος δεν έχει `AuthProvider`» | ❌ Τον στήνει το **ριζικό** `app/layout.tsx`, που τυλίγει **όλα** τα route groups. Ισχύει **μόνο** για τη σουίτα jest που αποδίδει χωρίς πάροχο — και το ζωντανό περπάτημα του §10.14 το απέδειξε: **τα πεδία ήρθαν προσυμπληρωμένα** |
 *
 * ⇒ Η ταυτότητα **ήταν ήδη εδώ**. Άρα το σωστό στρώμα δεν είναι το **σχήμα** αλλά ο
 * **θεατής**: ρωτάμε **ήσυχα** τον ίδιο κριτή που θα κρίνει την υποβολή, και το
 * δημόσιο σχήμα **δεν αποκτά ούτε ένα πεδίο** *(δες `first-contact-admission.ts`)*.
 *
 * 🔑 **Ο ΑΝΩΝΥΜΟΣ ΔΕΝ ΡΩΤΑ ΠΟΤΕ, ΚΑΙ ΕΙΝΑΙ ΤΟ ΜΙΣΟ ΤΗΣ ΣΧΕΔΙΑΣΗΣ.** Χωρίς ταυτότητα
 * **δεν μπορείς** να είσαι ο ιδιοκτήτης, δεν έχεις ανοιχτές πράξεις και δεν έχεις
 * χωρητικότητα να γεμίσει. Η συντριπτική πλειοψηφία των επισκεπτών μιας δημόσιας
 * αγγελίας πληρώνει **μηδέν αιτήματα**.
 *
 * ⚠️ **ΚΑΙ Η ΠΡΩΤΗ ΑΠΟΔΟΣΗ ΕΙΝΑΙ ΠΑΝΤΑ ΤΟ ΚΟΥΜΠΙ** — στον διακομιστή, και στον πελάτη
 * όσο η απάντηση δεν έχει έρθει. Είναι η **σωστή** εκδοχή για όλους εκτός από έναν, και
 * η εναλλακτική *(«μην αποδώσεις τίποτα μέχρι να μάθεις»)* θα **έσβηνε το κύριο CTA
 * δημόσιας σελίδας** από το HTML του διακομιστή για να εξυπηρετήσει τον έναν.
 */

import React from 'react';
import dynamic from 'next/dynamic';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAuthOptional } from '@/auth/contexts/AuthContext';
import {
  askContactAdmission,
  type ContactAdmissionAnswer,
} from '@/services/contact/first-contact.client';
import type { FirstContactTarget } from '@/types/first-contact';

import { ACT_KEYS, FIRST_CONTACT_NS } from './first-contact-labels';

/**
 * ⛔ **ΜΗΝ το κάνεις στατικό import.** Αυτή η γραμμή ΕΙΝΑΙ το όριο της κλειστότητας που
 * ζητά το CHECK 3.34 — δες το κεφάλι του αρχείου για τα δύο νούμερα που την επέβαλαν.
 */
const FirstContactDialog = dynamic(
  () => import('./FirstContactDialog').then((mod) => mod.FirstContactDialog),
  { ssr: false },
);

/**
 * ⛔ **ΚΑΙ ΑΥΤΟ ΤΕΜΠΕΛΙΚΑ, ΓΙΑ ΤΟΝ ΙΔΙΟ ΛΟΓΟ.** Τα κείμενά του δεν μπορούν να φανούν
 * πριν απαντήσει η ήσυχη ερώτηση — δηλαδή **ποτέ** στο πρώτο βάψιμο, και **ποτέ** για
 * τον ανώνυμο. Στατικό εδώ θα φόρτωνε επτά κλειδιά σε **κάθε** επισκέπτη κάθε αγγελίας
 * για να τα δει **ο ιδιοκτήτης**.
 */
const FirstContactStandIn = dynamic(
  () => import('./FirstContactStandIn').then((mod) => mod.FirstContactStandIn),
  { ssr: false },
);

export interface FirstContactActionProps {
  readonly target: FirstContactTarget;
  /** `null`/απών = «πάτησα χωρίς να έχω δηλώσει ζήτηση». **Κανονικό.** */
  readonly demandId?: string | null;
  /** Ποιο κείμενο κουμπιού — η αγγελία λέει `cta`, η βιτρίνα λέει `ctaPro`. */
  readonly variant?: 'listing' | 'professional';
}

export function FirstContactAction({
  target,
  demandId = null,
  variant = 'listing',
}: FirstContactActionProps): React.JSX.Element {
  const { t } = useTranslation([FIRST_CONTACT_NS]);

  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  /**
   * 🔴 **Η ΑΡΧΙΚΗ ΤΙΜΗ ΕΙΝΑΙ `null` ΚΑΙ ΣΗΜΑΙΝΕΙ «ΔΕΝ ΡΩΤΗΣΑ ΑΚΟΜΗ»** — που αποδίδεται
   * **ταυτόσημα** με το `open` και το `unknown`: **το κουμπί**. Τρεις καταστάσεις, μία
   * εμφάνιση, και είναι σωστό: όλες σημαίνουν *«δεν ξέρουμε λόγο να μην πατήσει»*.
   */
  const [answer, setAnswer] = React.useState<ContactAdmissionAnswer | null>(null);
  /** Αυξάνει στο **κλείσιμο** του διαλόγου — δες {@link handleOpenChange}. */
  const [round, setRound] = React.useState(0);

  const auth = useAuthOptional();
  const uid = auth?.user?.uid ?? null;

  /**
   * **Η ήσυχη ερώτηση.**
   *
   * ⚠️ **Οι εξαρτήσεις είναι τα ΠΕΔΙΑ του στόχου, όχι το αντικείμενο.** Και οι δύο
   * καλούντες γράφουν `target={{ kind: 'listing', listingId: … }}` **ενσωματωμένα**,
   * δηλαδή νέα ταυτότητα αντικειμένου σε **κάθε** απόδοση: με το αντικείμενο στις
   * εξαρτήσεις, αυτό το effect θα έτρεχε **ατέρμονα**, ένα αίτημα ανά render.
   *
   * ⚠️ **`ignore` και όχι `AbortController`**: δύο διαδοχικές απαντήσεις μπορούν να
   * έρθουν **ανάποδα**, και η παλιά θα έγραφε πάνω στη νέα. Δεν ακυρώνουμε το αίτημα —
   * αγνοούμε την **ξεπερασμένη** απάντηση, που είναι το πραγματικό πρόβλημα.
   */
  React.useEffect(() => {
    if (uid === null) {
      // Ο ανώνυμος δεν ρωτά — και αν κάποιος **αποσυνδεθεί** με τη σελίδα ανοιχτή, η
      // προηγούμενη απάντηση πρέπει να **σβήσει**: αφορούσε άλλον άνθρωπο.
      setAnswer(null);
      return;
    }

    let ignore = false;
    void askContactAdmission(target).then((verdict) => {
      if (!ignore) setAnswer(verdict);
    });

    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- δες τη σημείωση παραπάνω:
    // τα πεδία του στόχου καθορίζουν πλήρως το `target`, το αντικείμενο όχι.
  }, [uid, round, target.kind, target.listingId, target.agencyCompanyId]);

  function handleOpen(): void {
    setMounted(true);
    setOpen(true);
  }

  /**
   * 🔑 **ΣΤΟ ΚΛΕΙΣΙΜΟ ΞΑΝΑΡΩΤΑΜΕ, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΚΑΛΛΩΠΙΣΜΟΣ.** Αν ο άνθρωπος μόλις
   * άνοιξε την πράξη, το κουμπί από κάτω λέει ακόμη *«Πλησιάστε τον ιδιοκτήτη»* — για
   * κάτι που **μόλις έκανε**. Η οθόνη οφείλει να ξέρει τι συνέβη πάνω της.
   *
   * ⚠️ Το κόστος είναι **ένα** αίτημα, και μόνο για όποιον **άνοιξε** τον διάλογο.
   */
  function handleOpenChange(next: boolean): void {
    setOpen(next);
    if (!next) setRound((previous) => previous + 1);
  }

  const ctaKey = variant === 'professional' ? ACT_KEYS.ctaPro : ACT_KEYS.cta;

  // 🔑 **Η ΜΙΑ ΕΡΩΤΗΣΗ ΤΗΣ ΑΠΟΔΟΣΗΣ**: υπάρχει ετυμηγορία που αντικαθιστά την πράξη;
  //    `null` · `open` · `unknown` ⇒ **όχι** — δείχνουμε το κουμπί (fail-open, N.12).
  const standIn =
    answer !== null && (answer.kind === 'already' || answer.kind === 'refused')
      ? answer
      : null;

  if (standIn !== null) {
    return <FirstContactStandIn answer={standIn} variant={variant} />;
  }

  return (
    <>
      <Button onClick={handleOpen}>{t(ctaKey)}</Button>
      {mounted ? (
        <FirstContactDialog
          target={target}
          demandId={demandId}
          open={open}
          onOpenChange={handleOpenChange}
        />
      ) : null}
    </>
  );
}
