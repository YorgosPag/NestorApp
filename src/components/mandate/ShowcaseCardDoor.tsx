'use client';

/**
 * @fileoverview **Η ΠΟΡΤΑ ΠΡΟΣ ΤΗΝ ΕΠΑΓΓΕΛΜΑΤΙΚΗ ΚΑΡΤΑ** — πάνω στη σελίδα της βιτρίνας (ADR-841 §7 Α21.16.7).
 * @related components/mandate/ShowcaseCardContent.tsx · components/mandate/ShowcaseDoorLink.tsx
 * @module components/mandate/ShowcaseCardDoor
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΟΣΕΛΙΔΑ ΚΑΙ ΟΧΙ ΕΝΟΤΗΤΑ ΣΤΗΝ ΙΔΙΑ ΣΕΛΙΔΑ** — δύο λόγοι, ο δεύτερος μετρημένος:
 *   1. **Η πρακτική των μεγάλων**: Google Business Profile (Επικοινωνία · Ωράριο · Τοποθεσία ως
 *      χωριστές ενότητες επεξεργασίας), GitHub/Google settings, LinkedIn — κάθε **ανεξάρτητη πράξη**
 *      έχει **δικό της** «Αποθήκευση». Η κάρτα είναι ήδη δική της πράξη (τα κανάλια ζουν σε `deny_all`).
 *   2. **Το route slice της βιτρίνας** πήγαινε 14.536 → 18.549 bytes, και η τελευταία σφράγιση
 *      γράφει ρητά *«επόμενη αύξηση εδώ ΔΕΝ πρέπει να λυθεί με τέταρτη σφράγιση — η σωστή απάντηση
 *      είναι να σπάσει η ΙΔΙΑ Η ΟΘΟΝΗ σε δεύτερη διαδρομή»*. Αυτό ακριβώς είναι αυτή η πόρτα.
 *
 * ⚠️ **Μόνο με δημοσιευμένη βιτρίνα** — ίδιο δόγμα με το `ShowcasePublicDoor`: πόρτα που ανοίγει
 * σε «δημοσιεύστε πρώτα» είναι αδιέξοδο με κουμπί.
 */

import React from 'react';
import { IdCard } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { AGENCY_SHOWCASE_CARD_ROUTE } from '@/lib/mandate/mandate-routes';
import { SHOWCASE_CARD_KEYS, SHOWCASE_NS } from '@/components/mandate/agency-showcase-labels';
import { ShowcaseDoorLink } from '@/components/mandate/ShowcaseDoorLink';

export function ShowcaseCardDoor({ published }: { readonly published: boolean }): React.ReactElement | null {
  const { t } = useTranslation([SHOWCASE_NS]);
  if (!published) return null;

  return (
    <ShowcaseDoorLink
      href={AGENCY_SHOWCASE_CARD_ROUTE}
      icon={IdCard}
      title={t(SHOWCASE_CARD_KEYS.door)}
      detail={t(SHOWCASE_CARD_KEYS.doorHint)}
    />
  );
}
