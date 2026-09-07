'use client';

/**
 * @fileoverview **Η ΠΡΟΕΠΙΣΚΟΠΗΣΗ ΣΤΟ ΤΕΛΙΚΟ ΣΧΗΜΑ** (ADR-841 §7 Α21, Φάση 2).
 * @related components/mandate/showcase-mark-frame · components/mandate/ShowcaseMarkView
 * @module components/mandate/ShowcaseMarkPreview
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 ΔΕΙΧΝΕΙ ΑΚΡΙΒΩΣ Ο,ΤΙ ΘΑ ΔΕΙ Ο ΕΠΙΣΚΕΠΤΗΣ — ΟΧΙ ΟΥΔΕΤΕΡΟ ΤΕΤΡΑΓΩΝΟ
 * ════════════════════════════════════════════════════════════════════════════
 *
 * *(Απόφαση Giorgio, 2026-09-07.)* Η εναλλακτική — τετράγωνη προεπισκόπηση και για τα
 * δύο είδη — είναι λιγότερος κώδικας και **αφήνει τον άνθρωπο να μάθει ότι το πρόσωπό
 * του κόπηκε αφού έχει ήδη φύγει στον κόσμο**.
 *
 * 🔑 **Και το σχήμα ΔΕΝ γράφεται εδώ**: έρχεται από το `SHOWCASE_MARK_FRAME`, το ίδιο
 * που ζωγραφίζει το `ShowcaseMarkView` για τον επισκέπτη. Αν αυτό το αρχείο είχε δικές
 * του κλάσεις, οι δύο θα απέκλιναν στην πρώτη αλλαγή — και θα γεννούσαν από την πίσω
 * πόρτα ακριβώς την παγίδα που η απόφαση πήγε να αποφύγει.
 *
 * ⚠️ **ΤΟ ΜΕΓΕΘΟΣ ΕΙΝΑΙ ΜΕΓΑΛΟ ΕΠΙΤΗΔΕΣ** *(`h-24`, όχι `h-11`)*. Δεν είναι η κάρτα:
 * είναι η στιγμή που ο άνθρωπος **κρίνει** αν η εικόνα του δουλεύει. Σε 44px δεν
 * φαίνεται αν κόπηκε το πηγούνι.
 *
 * ⛔ **ΔΕΝ επαναχρησιμοποιεί το `PhotoPreview`** *(`components/ui/utils`)*: εκείνο είναι
 * καρφωμένο στα `PHOTO_SIZES` και **δεν ξέρει από σχήμα ανά είδος** — η μία ερώτηση που
 * ορίζει αυτό το component. Ένα πέρασμα κλάσεων από έξω θα το έκανε δοχείο χωρίς γνώμη
 * και θα άφηνε το σχήμα να ζει **στον καλούντα**, δηλαδή σε δύο μέρη ξανά.
 */

import React from 'react';

import { cn } from '@/lib/utils';
import { frameOf } from '@/components/mandate/showcase-mark-frame';
import type { ShowcaseMarkKind } from '@/lib/agency/showcase-mark-kind';

interface ShowcaseMarkPreviewProps {
  /** Τοπικό `blob:` της επιλογής, ή το δημόσιο URL του δημοσιευμένου σήματος. */
  readonly src: string;
  readonly kind: ShowcaseMarkKind;
  /** Τι δείχνει η εικόνα, για όποιον δεν τη βλέπει — **έτοιμο κείμενο**, ποτέ κλειδί. */
  readonly alt: string;
}

/**
 * **Το σήμα, όπως θα φανεί.**
 *
 * ⚠️ **`bg-card` κάτω από την εικόνα, και είναι απαίτηση όχι στιλ**: το ράφι **διατηρεί
 * τη διαφάνεια** επίτηδες *(«μια ψημένη πλάκα φόντου είναι απόφαση για ΕΝΑ θέμα και
 * λάθος στο άλλο»)*. Χωρίς επιφάνεια από κάτω, ένα διαφανές λογότυπο με σκούρα γράμματα
 * γίνεται **αόρατο** στο σκοτεινό θέμα — και ο άνθρωπος θα νόμιζε ότι η εικόνα του
 * χάλασε.
 *
 * ⛔ **Ποτέ `next/image`**: οι δημόσιες εικόνες πάνε με σκέτο `<img>`, και το τοπικό
 * `blob:` δεν είναι καν διαδρομή που ο optimizer μπορεί να δει.
 */
export function ShowcaseMarkPreview({
  src,
  kind,
  alt,
}: ShowcaseMarkPreviewProps): React.JSX.Element {
  const frame = frameOf(kind);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={96}
      height={96}
      decoding="async"
      className={cn(
        'h-24 w-24 shrink-0 border border-border bg-card',
        frame.shape,
        frame.fit,
      )}
    />
  );
}
