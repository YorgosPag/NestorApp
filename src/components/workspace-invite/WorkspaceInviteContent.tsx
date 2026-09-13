'use client';

/**
 * @fileoverview **Η ΟΘΟΝΗ ΤΟΥ ΠΡΟΣΚΕΚΛΗΜΕΝΟΥ** — ποιος τον καλεί, και τι απαντά.
 * @related app/(auth)/invite/[token]/page.tsx · types/workspace-invitation-view.ts · ADR-853 Φ6
 * @module components/workspace-invite/WorkspaceInviteContent
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΟ NAMESPACE ΔΗΛΩΝΕΤΑΙ ΕΔΩ, ΔΕΝ ΔΑΝΕΙΖΕΤΑΙ (ADR-744 §18)
 * ────────────────────────────────────────────────────────────────────────────
 * Κάθε υπο-κομμάτι που χρησιμοποιεί κλειδιά καλεί **μόνο του** `useTranslation(NS)` και
 * **κανένα δεν δέχεται `t` ως prop**. Ένα component που παίρνει το `t` δηλώνει **μηδέν**
 * namespace, και τότε ο γεννήτορας του shell slice αποδίδει τα κλειδιά του σε
 * `targets = []` — **τα χάνει σιωπηλά**, και η οθόνη βάφει ωμά κλειδιά σε άνθρωπο που
 * μόλις ήρθε από email.
 *
 * ⚠️ **ΚΑΜΙΑ ΜΠΑΡΑ, ΚΑΝΕΝΑ ΣΗΜΑ, ΚΑΝΕΝΑ `min-h-screen`**: το `(auth)/layout.tsx` δίνει ήδη
 * `<AuthToolbar />` (γλώσσα+θέμα, ADR-809) και `ShellSurface as="main"` με
 * `shellAuthStandalone`, που **είναι ήδη** `min-h-screen … items-center justify-center`.
 * Επανάληψη μετρήθηκε ζωντανά ως **48px φάντασμα κύλισης** (= 2×24 του διαδρόμου ADR-797).
 *
 * ⛔ **Σύνδεσμοι μόνο από το `@/lib/workspace/navigation`** (CHECK 3.61) — ποτέ `next/link`.
 */

import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatRelativeTime } from '@/lib/intl-formatting';
import { Link } from '@/lib/workspace/navigation';
import { cn } from '@/lib/utils';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import {
  redeemWorkspaceInvitationFromScreen,
  type RedeemInvitationResult,
} from '@/services/workspace/workspace-invitation.client';
import type {
  WorkspaceInvitationLinkView,
  WorkspaceInviteExitName,
  WorkspaceInviteSetback,
} from '@/types/workspace-invitation-view';
import type { WorkspaceInvitationPreview } from '@/types/workspace-invitation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import {
  EXIT_HREF,
  EXIT_KEY,
  INVITE_PAGE_KEYS,
  INVITED_ROLE_KEY,
  REFUSAL_KEY,
} from './workspace-invite-labels';
import { WORKSPACE_INVITE_NS } from './workspace-invite-namespace';

// 🔴 ADR-744 §18 — ΤΟ SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ, ΣΤΑΤΙΚΑ ΚΑΙ ΣΕ ΕΜΒΕΛΕΙΑ MODULE.
//
// Χωρίς αυτές τις δύο γραμμές το artifact **υπάρχει**, το manifest το υπογράφει, οι πύλες
// είναι **πράσινες** — και **κανείς δεν το φορτώνει ποτέ**: η θεραπεία μένει ΑΔΡΑΝΗΣ και η
// σελίδα βάφει ωμά κλειδιά σε άνθρωπο που μόλις ήρθε από email.
//
// ⚠️ **ΠΟΤΕ `import()`** — μετακινεί το ωμό κλειδί σε «ένα καρέ» και το **κρύβει** από το
//    CHECK 3.51.
// ⚠️ **ΠΟΤΕ σε Server Component** — Server και Client έχουν **ξεχωριστούς γράφους module**,
//    οπότε η εγγραφή από το `page.tsx` θα έγραφε σε **άλλο** στιγμιότυπο i18next: πράσινη
//    κλήση που δεν κάνει τίποτα. Γι' αυτό ζει **εδώ**, στο client component.
//
// 🔑 Μετρημένο: **3273 bytes · 1 ns [auth]** — τα 31 κλειδιά `auth:workspaceInvite.*`.
import routeSlice from '@/i18n/generated/routes/invite__token.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

export function WorkspaceInviteContent({ view }: { view: WorkspaceInvitationLinkView }) {
  const [outcome, setOutcome] = useState<RedeemInvitationResult | null>(null);

  if (view.kind !== 'preview') return <SetbackScreen setback={view} />;
  if (outcome !== null) return <OutcomeScreen outcome={outcome} />;

  return <PreviewScreen view={view} onSettled={setOutcome} />;
}

// =============================================================================
// ΤΟ ΠΛΑΙΣΙΟ — μία κάρτα, το ίδιο με τις υπόλοιπες οθόνες `(auth)`
// =============================================================================

function InviteCard({ title, children }: { title: string; children: React.ReactNode }) {
  const layout = useLayoutClasses();

  return (
    <section className={layout.flexColGap4}>
      <Card className={layout.cardAuthWidth}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className={layout.flexColGap4}>{children}</CardContent>
      </Card>
    </section>
  );
}

/**
 * **Η ΔΙΕΞΟΔΟΣ** — κάθε οθόνη που δεν προσφέρει πράξη, προσφέρει δρόμο.
 *
 * 🔴 Το μάθημα του ADR-844: *«η οθόνη **περιγράφει** την επόμενη κίνηση αντί να την
 * **προσφέρει**»*. Ο τύπος συνόρου κάνει το πεδίο **υποχρεωτικό**· εδώ γίνεται κουμπί.
 */
function ExitLink({ exit }: { exit: WorkspaceInviteExitName }) {
  const { t } = useTranslation([WORKSPACE_INVITE_NS]);

  return (
    <Link href={EXIT_HREF[exit]} className="w-full">
      <Button variant="outline" className="w-full">
        {t(EXIT_KEY[exit])}
      </Button>
    </Link>
  );
}

// =============================================================================
// ΟΙ ΤΡΕΙΣ ΟΘΟΝΕΣ
// =============================================================================

function SetbackScreen({ setback }: { setback: WorkspaceInviteSetback }) {
  const { t } = useTranslation([WORKSPACE_INVITE_NS]);

  const title = setback.kind === 'unavailable'
    ? t(INVITE_PAGE_KEYS.unavailableTitle)
    : t(INVITE_PAGE_KEYS.title);

  const body = setback.kind === 'unavailable'
    ? t(INVITE_PAGE_KEYS.unavailableBody)
    : t(REFUSAL_KEY[setback.reason]);

  return (
    <InviteCard title={title}>
      <p className="text-sm">{body}</p>
      <ExitLink exit={setback.exit} />
    </InviteCard>
  );
}

function OutcomeScreen({ outcome }: { outcome: RedeemInvitationResult }) {
  const { t } = useTranslation([WORKSPACE_INVITE_NS]);

  if (outcome.kind === 'accepted') {
    return (
      <InviteCard title={t(INVITE_PAGE_KEYS.acceptedTitle)}>
        {/* 🔴 §6 #1 — το «δεν άλλαξε ο ενεργός χώρος» λέγεται ΜΕ ΟΝΟΜΑ. */}
        <p className="text-sm">
          {outcome.activeWorkspaceChanged
            ? t(INVITE_PAGE_KEYS.acceptedActiveNow)
            : t(INVITE_PAGE_KEYS.acceptedNotActive)}
        </p>
        <ExitLink exit="sign-in" />
      </InviteCard>
    );
  }

  if (outcome.kind === 'declined') {
    return (
      <InviteCard title={t(INVITE_PAGE_KEYS.declinedTitle)}>
        <p className="text-sm">{t(INVITE_PAGE_KEYS.declinedBody)}</p>
        <ExitLink exit="home" />
      </InviteCard>
    );
  }

  return (
    <InviteCard title={t(INVITE_PAGE_KEYS.unavailableTitle)}>
      <p className="text-sm">
        {outcome.kind === 'refused'
          ? t(REFUSAL_KEY[outcome.reason])
          : t(INVITE_PAGE_KEYS.unavailableBody)}
      </p>
      <ExitLink exit="home" />
    </InviteCard>
  );
}

type PreviewBranch = Extract<WorkspaceInvitationLinkView, { kind: 'preview' }>;

function PreviewScreen({
  view,
  onSettled,
}: {
  view: PreviewBranch;
  onSettled: (outcome: RedeemInvitationResult) => void;
}) {
  const { t } = useTranslation([WORKSPACE_INVITE_NS]);
  const [busy, setBusy] = useState(false);

  const respond = useCallback(
    async (action: 'accept' | 'decline') => {
      setBusy(true);
      try {
        onSettled(await redeemWorkspaceInvitationFromScreen({ token: view.token, action }));
      } finally {
        setBusy(false);
      }
    },
    [view.token, onSettled],
  );

  return (
    <InviteCard title={t(INVITE_PAGE_KEYS.title)}>
      <InvitationFacts preview={view.preview} />
      {view.respond.kind === 'ready' ? (
        <nav className="flex flex-col gap-2" aria-label={t(INVITE_PAGE_KEYS.title)}>
          <Button disabled={busy} onClick={() => void respond('accept')}>
            {busy ? t(INVITE_PAGE_KEYS.working) : t(INVITE_PAGE_KEYS.accept)}
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void respond('decline')}>
            {t(INVITE_PAGE_KEYS.decline)}
          </Button>
        </nav>
      ) : (
        <SignInInvitation href={view.respond.href} />
      )}
    </InviteCard>
  );
}

// =============================================================================
// ΤΑ ΣΤΟΙΧΕΙΑ ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ
// =============================================================================

function InvitationFacts({ preview }: { preview: WorkspaceInvitationPreview }) {
  const { t } = useTranslation([WORKSPACE_INVITE_NS]);
  const colors = useSemanticColors();

  return (
    <article className="flex flex-col gap-2">
      <p className="text-sm font-medium">
        {t(INVITE_PAGE_KEYS.intro, { workspace: preview.workspaceName })}
      </p>
      <p className="text-sm">
        {t(INVITE_PAGE_KEYS.roleLine, { role: t(INVITED_ROLE_KEY[preview.role]) })}
      </p>
      <p className={cn('text-sm', colors.text.muted)}>
        {t(INVITE_PAGE_KEYS.expiresLine, { when: formatRelativeTime(preview.expiresAt) })}
      </p>
      {/*
        🔑 §5 #4 · ADR-798 — «ΔΗΛΩΜΕΝΗ, ΟΧΙ ΕΠΑΛΗΘΕΥΜΕΝΗ», γραμμένο στην οθόνη.
        Το `identityAssurance` έχει σήμερα **μία** τιμή· τη διαβάζουμε ώστε η οθόνη να μην
        μπορεί να **ξεχάσει** την ετικέτα τη μέρα που ο τύπος αποκτήσει δεύτερη.
      */}
      {preview.identityAssurance === 'declared' && (
        <CardDescription>{t(INVITE_PAGE_KEYS.identityDeclared)}</CardDescription>
      )}
    </article>
  );
}

/**
 * **Ο ανώνυμος βλέπει ΠΡΩΤΑ ποιος τον καλεί, και μετά συνδέεται** (§5 #4, αντι-phishing).
 *
 * ⚠️ Ο σύνδεσμος έρχεται **έτοιμος από τον διακομιστή** (`loginHref`, που περνά από τον
 * φρουρό `safeReturnPath`) — η οθόνη **δεν** συναρμολογεί `?next=` μόνη της.
 */
function SignInInvitation({ href }: { href: string }) {
  const { t } = useTranslation([WORKSPACE_INVITE_NS]);
  const colors = useSemanticColors();

  return (
    <section className="flex flex-col gap-2">
      <p className={cn('text-sm', colors.text.muted)}>{t(INVITE_PAGE_KEYS.signInHint)}</p>
      {/*
        ⚠️ Ωμό `href` από τον διακομιστή: δεν είναι κυριολεκτική διαδρομή του καταλόγου
        (κουβαλά `?next=`), γι' αυτό δεν περνά από τον γενικό `Link` του συνόρου αλλά
        δηλώνεται ρητά ως πλοήγηση ανώτατου επιπέδου προς τη **δική μας** σελίδα σύνδεσης.
      */}
      <Button asChild>
        <a href={href}>{t(INVITE_PAGE_KEYS.signInToAccept)}</a>
      </Button>
    </section>
  );
}
