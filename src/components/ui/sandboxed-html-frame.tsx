'use client';

/**
 * @fileoverview **Η ΜΙΑ απόδοση ξένου HTML μέσα στην εφαρμογή** — προεπισκόπηση αρχείου HTML και
 * προεπισκόπηση email.
 *
 * Το HTML ενός email ή ενός αρχείου είναι γραμμένο για **δικό του χαρτί** (λευκό φόντο, δικά του
 * χρώματα). Χυμένο με `dangerouslySetInnerHTML` μέσα σε επιφάνεια της εφαρμογής κληρονομεί το θέμα
 * της: στο σκοτεινό θέμα οι λευκές γραμμές πίνακα γίνονται «άσπρα κουτιά» και το κείμενο χωρίς δικό
 * του χρώμα γίνεται ανοιχτό πάνω σε λευκό. Το iframe `srcDoc` απομονώνει έγγραφο και στυλ (όπως το
 * Gmail και το Stripe δείχνουν προεπισκόπηση email), και το `sandbox` χωρίς `allow-scripts` κόβει
 * σενάρια, φόρμες και αναδυόμενα.
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface SandboxedHtmlFrameProps {
  /** Πλήρες ή μερικό έγγραφο HTML. */
  readonly html: string;
  /** Προσβάσιμο όνομα του πλαισίου. */
  readonly title: string;
  /** Διαστάσεις/περίγραμμα από τον καταναλωτή· το λευκό χαρτί το εγγυάται το στοιχείο. */
  readonly className?: string;
}

export function SandboxedHtmlFrame({ html, title, className }: SandboxedHtmlFrameProps): React.ReactElement {
  return (
    <iframe
      srcDoc={html}
      aria-label={title}
      className={cn('w-full border-0 bg-white', className)}
      sandbox="allow-same-origin"
    />
  );
}
