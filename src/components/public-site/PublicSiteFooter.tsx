'use client';

/**
 * ⚖️ **ΤΟ ΥΠΟΣΕΛΙΔΟ ΤΟΥ ΔΗΜΟΣΙΟΥ ΙΣΤΟΤΟΠΟΥ, ΜΙΑ ΦΟΡΑ** (ADR-861 Φ2 · ADR-898 Φ2 · ADR-896 §7Α.8).
 *
 * Δύο θέσεις, **ένα** component:
 * - **το κάδρο** του `(light)/layout.tsx`, κάτω από κάθε δημόσια σελίδα·
 * - **το τέλος της λίστας** μιας κλειδωμένης επιφάνειας που δηλώνει `data-shell-footer="hosted"`
 *   (σήμερα το `/search/results`). Τότε το `shell-surface.css` κρύβει το υποσέλιδο του κάδρου.
 *
 * 🔑 **ΓΙΑΤΙ ΜΕΤΑΚΟΜΙΖΕΙ ΣΤΗΝ ΚΛΕΙΔΩΜΕΝΗ ΟΘΟΝΗ** (πρότυπο Zillow · Airbnb): σε οθόνη κλειδωμένη
 * στο παράθυρο, το υποσέλιδο του κάδρου τρώει τον πυθμένα. Το φύλλο αποτελεσμάτων του στενού
 * κοβόταν πάνω από αυτό αντί να αγκυρώνεται στην κάτω άκρη. Οι μεγάλοι βάζουν τα νομικά
 * **στο τέλος της λίστας**, μέσα στην κύλισή της. Το Π.Δ. 131/2003 («συνεχής πρόσβαση») μένει
 * ικανοποιημένο: ίδιοι σύνδεσμοι, ένα scroll μακριά, σε κάθε πλάτος.
 *
 * ⚠️ Το `data-site-footer` είναι το **συμβόλαιο** με το `shell-surface.css`: χωρίς αυτό το
 * υποσέλιδο του κάδρου δεν κρύβεται και εμφανίζεται δύο φορές.
 */

import React from 'react';

import { cn } from '@/lib/utils';
import { LegalLinksNav } from '@/components/legal/LegalLinksNav';
import { ObjectiveValueLink } from '@/components/objective-value/ObjectiveValueLink';
import { TOUCH_TARGET_MIN } from '@/design-system/touch-target';

/** Το γνώρισμα με το οποίο το κέλυφος βρίσκει το υποσέλιδο του κάδρου. */
export const SITE_FOOTER_ATTRIBUTE = 'data-site-footer';

/** Η δήλωση της επιφάνειας «το υποσέλιδο το φιλοξενώ εγώ» (`data-shell-footer="hosted"`). */
export const SHELL_FOOTER_HOSTED = { 'data-shell-footer': 'hosted' } as const;

export function PublicSiteFooter({ className }: { readonly className?: string }): React.ReactElement {
  return (
    <footer
      {...{ [SITE_FOOTER_ATTRIBUTE]: '' }}
      className={cn('flex w-full flex-col items-center gap-1 border-t border-border px-4 py-2', className)}
    >
      {/* ADR-898 Φ2 — τα δημόσια εργαλεία, μία γραμμή πάνω από τα νομικά. */}
      <p className="m-0 text-xs text-muted-foreground">
        <ObjectiveValueLink className={`${TOUCH_TARGET_MIN} hover:text-foreground`} />
      </p>
      <LegalLinksNav variant="standalone" />
    </footer>
  );
}
