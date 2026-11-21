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
  /** Το περιεχόμενο ανανεώνεται (το παλιό μένει ορατό) — `aria-busy`. */
  readonly busy?: boolean;
}

/**
 * ⚠️ ΜΗΝ προσθέσεις `pointer-events-none` για να «κλειδώσεις» συνδέσμους: κόβει και τη ροδέλα, άρα το
 * email δεν κυλά και ο άνθρωπος βλέπει μόνο την κορυφή του (ADR-327 §7.5, ζωντανός έλεγχος 21/11).
 * Σενάρια, φόρμες και αναδυόμενα τα κόβει ήδη το `sandbox`.
 */
export function SandboxedHtmlFrame({ html, title, className, busy }: SandboxedHtmlFrameProps): React.ReactElement {
  return (
    <iframe
      srcDoc={html}
      aria-label={title}
      aria-busy={busy}
      className={cn('w-full border-0 bg-white', className)}
      sandbox="allow-same-origin"
    />
  );
}
