'use client';

/**
 * @fileoverview **ΠΡΙΝ ΤΗΝ ΑΠΑΝΤΗΣΗ: ΠΟΙΟΣ ΚΟΙΤΑΖΕΙ;** — ανώνυμος ⇒ σύνδεση/εγγραφή με επιστροφή· άλλος λογαριασμός ⇒
 * λέγεται **πριν** το κλικ· έτοιμος ⇒ η απάντηση του είδους.
 * @related ADR-853 §13 ε.δ · `lib/invitations/invitation-respond.ts` · ADR-884 Κ3α · ADR-901 Φ3 · ADR-915 §39
 * @module components/invitations/InvitationIdentityGate
 *
 * Εξήχθη 2026-10-03 (ADR-901 Φ3, CHECK 3.28): οι σελίδες φωτογράφου και υπόθεσης το έγραφαν δίδυμα. Τα **λόγια** της
 * σύνδεσης τα δίνει το είδος (ήδη μεταφρασμένα) — ο φύλακας δεν ξέρει namespace.
 * 2026-11-14 (ADR-915 §39): όταν το είδος δίνει **βήμα λογαριασμού** (`respond.account`), ο φύλακας λέει **ποια**
 * διεύθυνση, **νέος ή υπάρχων**, και **τι ακολουθεί** (`InvitationSteps`). Χωρίς βήμα ⇒ ακριβώς η παλιά συμπεριφορά.
 * ⚠️ Τα πάνελ μένουν **στατικά, επίτηδες** (ADR-915 §39.6): είναι η κύρια ενέργεια του πρώτου καρέ για τον ανώνυμο
 * παραλήπτη ⇒ πρέπει να είναι στο HTML του διακομιστή (τεμπέλικο `ssr:false` = κουμπί που «πηδά» μετά — LCP/CLS).
 * Το κόστος τους στο slice δηλώνεται με επανασφράγιση + `why` στο κατάστιχο διαδρομών (CHECK 3.34 Κ2).
 * ⛔ Σύνδεσμοι μόνο από `@/lib/workspace/navigation` (CHECK 3.61).
 */

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { OtherAccountNotice } from '@/components/workspace-invite/SwitchAccount';
import type { InvitationRespond } from '@/lib/invitations/invitation-respond';
import { Link } from '@/lib/workspace/navigation';

import { AccountEntryPanel, AccountMismatchPanel } from './InvitationAccountStepPanel';
import { InvitationSteps } from './InvitationSteps';

type NotReady = Exclude<InvitationRespond, { readonly kind: 'ready' }>;

interface IdentityStepProps {
  readonly respond: NotReady;
  readonly switchAccountHref: string;
  readonly signInLabel: string;
  readonly signInHint: string;
}

interface InvitationIdentityGateProps extends Omit<IdentityStepProps, 'respond'> {
  readonly respond: InvitationRespond;
  /** Τα βήματα **μετά** τον λογαριασμό (μεταφρασμένα) — δίνονται ⇒ η οθόνη δείχνει «πού είμαι, πόσα μένουν». */
  readonly stepsAfterAccount?: readonly string[];
  /** Η απάντηση του είδους — αποδίδεται **μόνο** όταν ο θεατής είναι ο παραλήπτης (ή φαίνεται να είναι). */
  readonly children: ReactNode;
}

function IdentityStep({ respond, switchAccountHref, signInLabel, signInHint }: IdentityStepProps) {
  if (respond.kind === 'other-account') {
    return respond.account
      ? <AccountMismatchPanel account={respond.account} signedInAs={respond.signedInAs} href={switchAccountHref} />
      : <OtherAccountNotice signedInAs={respond.signedInAs} href={switchAccountHref} />;
  }
  if (respond.account) return <AccountEntryPanel account={respond.account} href={respond.href} />;
  return (
    <section className="space-y-2">
      <Button asChild className="w-full"><Link href={respond.href}>{signInLabel}</Link></Button>
      <p className="text-xs text-muted-foreground">{signInHint}</p>
    </section>
  );
}

export function InvitationIdentityGate({ respond, stepsAfterAccount, children, ...labels }: InvitationIdentityGateProps) {
  const ready = respond.kind === 'ready';
  return (
    <>
      {stepsAfterAccount ? <InvitationSteps after={stepsAfterAccount} current={ready ? 1 : 0} /> : null}
      {respond.kind === 'ready' ? children : <IdentityStep respond={respond} {...labels} />}
    </>
  );
}
