'use client';

/**
 * @fileoverview **«ΜΕ ΠΟΙΟ EMAIL; ΕΧΩ ΛΟΓΑΡΙΑΣΜΟ; ΤΙ ΚΑΝΩ ΤΩΡΑ;»** — το βήμα λογαριασμού (ADR-915 §39, 2026-11-14).
 * @related `lib/invitations/invitation-respond.ts` (`InvitationAccountStep`) · `server/invitations/invitation-account-step.ts`
 * @module components/invitations/InvitationAccountStepPanel
 *
 * 🔴 **Το κενό που κλείνει (μετρημένο ζωντανά)**: ο νέος επαγγελματίας έβλεπε ένα «Σύνδεση», δοκίμαζε, έπαιρνε «Μη
 * έγκυρα στοιχεία» και δεν μάθαινε ποτέ ότι έπρεπε να κάνει **Εγγραφή** — ούτε με **ποια** διεύθυνση.
 * 🔑 **Μία ενέργεια ανά κατάσταση** (Procore: ο υπάρχων δεν καλείται να φτιάξει κωδικό · Google: «συνδεδεμένοι ως Χ»
 * → αποσύνδεση και συνέχεια). Η διεύθυνση εμφανίζεται **μόνο καλυμμένη**.
 * ⛔ Σύνδεσμοι μόνο από `@/lib/workspace/navigation` (CHECK 3.61) · τα `href` έρχονται έτοιμα από τον διακομιστή.
 */

import { Button } from '@/components/ui/button';
import { SwitchAccountButton } from '@/components/workspace-invite/SwitchAccount';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { InvitationAccountStep } from '@/lib/invitations/invitation-respond';
import { Link } from '@/lib/workspace/navigation';

import { INVITATION_ACCOUNT_KEYS, INVITATION_ACCOUNT_NS } from './invitation-account-labels';

/** Ανώνυμος θεατής: «δημιουργήστε» ή «συνδεθείτε» — ποτέ και τα δύο ισοβαρή. */
export function AccountEntryPanel({ account, href }: { readonly account: InvitationAccountStep; readonly href: string }) {
  const { t } = useTranslation([INVITATION_ACCOUNT_NS]);
  const creating = account.kind === 'create';
  const email = account.maskedEmail;
  return (
    <section className="space-y-2" aria-labelledby="invitation-account-title">
      <h2 id="invitation-account-title" className="text-sm font-semibold">
        {t(creating ? INVITATION_ACCOUNT_KEYS.createTitle : INVITATION_ACCOUNT_KEYS.signInTitle)}
      </h2>
      <p className="text-sm">{t(creating ? INVITATION_ACCOUNT_KEYS.createBody : INVITATION_ACCOUNT_KEYS.signInBody, { email })}</p>
      <Button asChild className="w-full">
        <Link href={href}>{t(creating ? INVITATION_ACCOUNT_KEYS.createAction : INVITATION_ACCOUNT_KEYS.signInAction)}</Link>
      </Button>
      {account.googleSuggested ? <p className="text-xs text-muted-foreground">{t(INVITATION_ACCOUNT_KEYS.googleHint)}</p> : null}
    </section>
  );
}

/** Συνδεδεμένος με **άλλον** λογαριασμό: το λέμε πριν το κλικ, και ο δρόμος είναι ένα κουμπί. */
export function AccountMismatchPanel(props: { readonly account: InvitationAccountStep; readonly signedInAs: string; readonly href: string }) {
  const { t } = useTranslation([INVITATION_ACCOUNT_NS]);
  const email = props.account.maskedEmail;
  return (
    <section className="flex flex-col gap-2">
      <p className="text-sm">{t(INVITATION_ACCOUNT_KEYS.otherAccount, { signedInAs: props.signedInAs, email })}</p>
      <SwitchAccountButton href={props.href} label={t(INVITATION_ACCOUNT_KEYS.switchAction, { email })} />
    </section>
  );
}
