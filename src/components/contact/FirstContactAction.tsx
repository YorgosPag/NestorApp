'use client';

/**
 * @fileoverview **ΤΟ ΚΟΥΜΠΙ ΤΗΣ ΠΡΩΤΗΣ ΕΠΑΦΗΣ (ΠΕ1)** — από δημόσια αγγελία ή βιτρίνα.
 * @related components/contact/FirstContactDialog.tsx (ό,τι υπάρχει ΜΕΤΑ το κλικ) · ADR-843 §10.13
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
 * 🔑 **Η ΓΡΑΜΜΗ ΠΕΡΝΑΕΙ ΑΚΡΙΒΩΣ ΕΔΩ, ΚΑΙ ΟΧΙ ΠΙΟ ΠΑΝΩ.** Από τα 31 κλειδιά του
 * `contact.first.*`, **τρία** χρειάζονται στο πρώτο βάψιμο — το κείμενο του κουμπιού.
 * Αυτό είναι το **κύριο CTA** δημόσιας σελίδας: αν έμπαινε κι αυτό πίσω από
 * `ssr: false`, θα **έλειπε από το HTML του διακομιστή** μέχρι να φορτώσει η
 * JavaScript. Γι' αυτό το `t(ctaKey)` μένει **στατικό** και μόνο ο διάλογος φορτώνεται
 * τεμπέλικα.
 *
 * ⚠️ **`mounted` ΚΑΙ `open` ΕΙΝΑΙ ΔΥΟ ΠΡΑΓΜΑΤΑ.** Το `mounted` μένει `true` μετά το
 * πρώτο άνοιγμα ώστε το κλείσιμο να προλάβει να **παίξει** *(αποπροσάρτηση στο κλικ θα
 * έκοβε την κίνηση του Radix και θα ξαναζητούσε το chunk σε κάθε άνοιγμα)*.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔶 ΔΗΛΩΜΕΝΟ ΟΡΙΟ: ΤΟ ΚΟΥΜΠΙ ΦΑΙΝΕΤΑΙ ΚΑΙ ΣΕ ΟΠΟΙΟΝ ΘΑ ΠΑΡΕΙ `contact-own-target`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * *«Καλύτερα από καλό μήνυμα σφάλματος είναι σχεδίαση που το αποτρέπει»* — και εδώ
 * **δεν εφαρμόζεται πλήρως**: η κρίση *«είναι δικό σου;»* απαιτεί
 * `mayAdminister(custodyOf(…))`, και το `PublicListing` **δεν κουβαλά** θεματοφυλακή —
 * **σωστά**, είναι δημόσια προβολή *(ό,τι μπει εκεί, φεύγει στον κόσμο)*.
 *
 * ⇒ Ο ιδιοκτήτης που πατά θα δει άρνηση **ονομαστική** *(«είναι δικό σας»)*, όχι
 * γενικό σφάλμα. Δηλωμένο κόστος, **όχι** παράβλεψη. Η θεραπεία θα ήταν ένα
 * `viewerCanContact` στην απάντηση της σελίδας — **ξεχωριστή πράξη**, γιατί προσθέτει
 * πεδίο σε δημόσιο σχήμα και θέλει τη δική του απόφαση αποκάλυψης.
 */

import React from 'react';
import dynamic from 'next/dynamic';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
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

  function handleOpen(): void {
    setMounted(true);
    setOpen(true);
  }

  const ctaKey = variant === 'professional' ? ACT_KEYS.ctaPro : ACT_KEYS.cta;

  return (
    <>
      <Button onClick={handleOpen}>{t(ctaKey)}</Button>
      {mounted ? (
        <FirstContactDialog
          target={target}
          demandId={demandId}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
    </>
  );
}
