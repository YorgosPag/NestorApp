'use client';

/**
 * @fileoverview **ΠΡΙΝ ΤΗΝ ΑΠΑΝΤΗΣΗ: ΠΟΙΟΣ ΚΟΙΤΑΖΕΙ;** — ανώνυμος ⇒ σύνδεση/εγγραφή με επιστροφή· άλλος λογαριασμός ⇒
 * λέγεται **πριν** το κλικ· έτοιμος ⇒ η απάντηση του είδους.
 * @related ADR-853 §13 ε.δ · `lib/invitations/invitation-respond.ts` · ADR-884 Κ3α · ADR-901 Φ3
 * @module components/invitations/InvitationIdentityGate
 *
 * Εξήχθη 2026-10-03 (ADR-901 Φ3, CHECK 3.28): οι σελίδες φωτογράφου και υπόθεσης το έγραφαν δίδυμα. Τα **λόγια** της
 * σύνδεσης τα δίνει το είδος (ήδη μεταφρασμένα) — ο φύλακας δεν ξέρει namespace.
 * ⛔ Σύνδεσμοι μόνο από `@/lib/workspace/navigation` (CHECK 3.61).
 */

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { OtherAccountNotice } from '@/components/workspace-invite/SwitchAccount';
import type { InvitationRespond } from '@/lib/invitations/invitation-respond';
import { Link } from '@/lib/workspace/navigation';

interface InvitationIdentityGateProps {
  readonly respond: InvitationRespond;
  readonly switchAccountHref: string;
  readonly signInLabel: string;
  readonly signInHint: string;
  /** Η απάντηση του είδους — αποδίδεται **μόνο** όταν ο θεατής είναι ο παραλήπτης (ή φαίνεται να είναι). */
  readonly children: ReactNode;
}

export function InvitationIdentityGate({ respond, switchAccountHref, signInLabel, signInHint, children }: InvitationIdentityGateProps) {
  if (respond.kind === 'other-account') return <OtherAccountNotice signedInAs={respond.signedInAs} href={switchAccountHref} />;
  if (respond.kind === 'sign-in') {
    return (
      <section className="space-y-2">
        <Button asChild className="w-full"><Link href={respond.href}>{signInLabel}</Link></Button>
        <p className="text-xs text-muted-foreground">{signInHint}</p>
      </section>
    );
  }
  return <>{children}</>;
}
