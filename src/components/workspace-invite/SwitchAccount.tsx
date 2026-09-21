'use client';

/**
 * @fileoverview **«ΑΛΛΑΓΗ ΛΟΓΑΡΙΑΣΜΟΥ»** — ο δρόμος για όποιον είναι συνδεδεμένος με άλλον
 * λογαριασμό από εκείνον που έλαβε την πρόσκληση (ADR-853 §13 ε.δ).
 * @related components/workspace-invite/WorkspaceInviteContent.tsx · app/(auth)/invite/[token]/page.tsx
 * @module components/workspace-invite/SwitchAccount
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΑΔΙΕΞΟΔΟ ΠΟΥ ΚΛΕΙΝΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 * Η έξοδος ήταν σκέτο `/login`, **χωρίς** `?next=`: ο άνθρωπος ήταν ήδη συνδεδεμένος (η
 * σελίδα σύνδεσης δεν του ζητούσε τίποτα), και μετά από νέα σύνδεση **δεν γύριζε** στην
 * πρόσκληση — έπρεπε να ξαναβρεί το email.
 *
 * 🔑 **Πρότυπο Google/Slack**: «Είστε συνδεδεμένοι ως Χ» + «Αλλαγή λογαριασμού» =
 * αποσύνδεση **και** σύνδεση με επιστροφή εδώ. **Και πάμε ένα βήμα πιο πέρα**: η αναντιστοιχία
 * λέγεται **πριν** το κλικ (ο διακομιστής τη γνωρίζει ήδη στην όψη), όχι ως άρνηση μετά.
 *
 * ⚠️ Το `href` έρχεται **έτοιμο από τον διακομιστή** (`loginHref`, φρουρός `safeReturnPath`)
 * — η οθόνη δεν συναρμολογεί `?next=` μόνη της. Και είναι **πλοήγηση ανώτατου επιπέδου**
 * (`navigateDocument`), όχι μετάβαση του router: μετά την αποσύνδεση το δέντρο του React
 * κουβαλά ακόμη τον παλιό χρήστη, και μόνο νέα φόρτωση το καθαρίζει.
 */

import { useCallback, useState } from 'react';

import { useAuthOptional } from '@/auth';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { navigateDocument } from '@/lib/browser/document-navigation';
import { createModuleLogger } from '@/lib/telemetry';

import { INVITE_PAGE_KEYS } from './workspace-invite-labels';
import { WORKSPACE_INVITE_NS } from './workspace-invite-namespace';

const logger = createModuleLogger('workspace-invite-switch-account');

/** **Αποσύνδεση → σύνδεση με επιστροφή σε ΑΥΤΗ την πρόσκληση.** */
export function SwitchAccountButton({ href }: { href: string }) {
  const { t } = useTranslation([WORKSPACE_INVITE_NS]);
  const auth = useAuthOptional();
  const [switching, setSwitching] = useState(false);

  const onSwitch = useCallback(async () => {
    setSwitching(true);
    try {
      await auth?.signOut();
    } catch (error: unknown) {
      // ⚠️ Προχωράμε: η σελίδα σύνδεσης είναι ο σωστός τόπος και για να ξαναδοκιμάσει.
      logger.warn('Η αποσύνδεση πριν την αλλαγή λογαριασμού απέτυχε', { error });
    }
    navigateDocument(href);
  }, [auth, href]);

  return (
    <Button className="w-full" disabled={switching} aria-busy={switching} onClick={() => void onSwitch()}>
      {switching ? t(INVITE_PAGE_KEYS.switchingAccount) : t(INVITE_PAGE_KEYS.switchAccount)}
    </Button>
  );
}

/**
 * **«Είστε συνδεδεμένοι ως Χ — η πρόσκληση είναι για άλλη διεύθυνση»**, πριν από κάθε κλικ.
 *
 * ⚠️ Δείχνει **μόνο** το email του θεατή — του παραλήπτη δεν φτάνει ποτέ στον φυλλομετρητή.
 */
export function OtherAccountNotice({ signedInAs, href }: { signedInAs: string; href: string }) {
  const { t } = useTranslation([WORKSPACE_INVITE_NS]);

  return (
    <section className="flex flex-col gap-2">
      <p className="text-sm">{t(INVITE_PAGE_KEYS.otherAccount, { email: signedInAs })}</p>
      <SwitchAccountButton href={href} />
    </section>
  );
}
