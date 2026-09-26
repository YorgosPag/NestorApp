'use client';

/**
 * @fileoverview **Η ΟΘΟΝΗ ΤΟΥ ΠΡΟΣΚΕΚΛΗΜΕΝΟΥ ΦΩΤΟΓΡΑΦΟΥ** — ποιος τον καλεί, για ποιο ακίνητο, ως πότε — και τι απαντά.
 * @related ADR-884 Φ0.5 · §4.5 (Κ3α) · `app/(auth)/tour-invite/[token]/page.tsx` · πρότυπο `WorkspaceInviteContent`
 * @module components/spatial-tour/TourCaptureInviteContent
 *
 * 🔑 **Στοιχεία ΠΡΙΝ από κουμπιά** (anti-phishing, ADR-853 §5 #4) και **το εύρος λέγεται ρητά**: η αποδοχή δίνει
 * ανέβασμα σε **ένα** ακίνητο, για **περιορισμένο** χρόνο — δεν γίνεται μέλος κανενός γραφείου (Φ0.5).
 * ⚠️ Κάθε υπο-κομμάτι καλεί **μόνο του** `useTranslation` (ADR-744 §18) — κανένα `t` ως prop.
 * ⛔ Σύνδεσμοι μόνο από `@/lib/workspace/navigation` (CHECK 3.61).
 */

import { useCallback, useState } from 'react';

import { OtherAccountNotice, SwitchAccountButton } from '@/components/workspace-invite/SwitchAccount';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { InvitationRespond } from '@/lib/invitations/invitation-respond';
import { formatDate, formatDateTime } from '@/lib/intl-formatting';
import { myTourCapturesHref } from '@/lib/spatial-tour/tour-routes';
import { Link } from '@/lib/workspace/navigation';
import {
  redeemTourCaptureInvitationFromScreen,
  type TourInvitationRedeemResult,
} from '@/services/spatial-tour/spatial-tour.client';
import type { InvitationCoreRefusal } from '@/types/invitation-core';
import type { TourCaptureInvitationPreview } from '@/types/spatial-tour';

import { INVITE_KEYS, INVITE_REFUSAL_KEY } from './spatial-tour-labels';
import { SPATIAL_TOUR_NS } from './spatial-tour-namespace';

// 🔴 ADR-744 §18 — ΤΟ SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ, ΣΤΑΤΙΚΑ ΚΑΙ ΣΕ ΕΜΒΕΛΕΙΑ MODULE (ποτέ `import()`, ποτέ σε Server Component):
//    χωρίς αυτό το artifact υπάρχει, οι πύλες είναι πράσινες, και η σελίδα βάφει ωμά κλειδιά.
import routeSlice from '@/i18n/generated/routes/tour-invite__token.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

export type TourCaptureInviteView =
  | {
      readonly kind: 'preview';
      readonly preview: TourCaptureInvitationPreview;
      /** Το ωμό token — ταξιδεύει μόνο στο **σώμα** της πράξης, ποτέ σε νέα διεύθυνση. */
      readonly token: string;
      readonly respond: InvitationRespond;
      readonly switchAccountHref: string;
    }
  | { readonly kind: 'refused'; readonly reason: InvitationCoreRefusal }
  | { readonly kind: 'unavailable' };

type InviteAction = 'accept' | 'decline';

interface PreviewProps {
  readonly view: Extract<TourCaptureInviteView, { kind: 'preview' }>;
  readonly pending: InviteAction | null;
  readonly onRespond: (action: InviteAction) => void;
}

export function TourCaptureInviteContent({ view }: { readonly view: TourCaptureInviteView }) {
  const [outcome, setOutcome] = useState<TourInvitationRedeemResult | null>(null);
  const [pending, setPending] = useState<InviteAction | null>(null);
  const token = view.kind === 'preview' ? view.token : null;

  const respond = useCallback(async (action: InviteAction) => {
    if (token === null) return;
    setPending(action);
    setOutcome(await redeemTourCaptureInvitationFromScreen(token, action));
    setPending(null);
  }, [token]);

  if (view.kind !== 'preview') return <Setback reason={view.kind === 'refused' ? view.reason : null} />;
  if (outcome !== null) {
    return <Outcome outcome={outcome} switchAccountHref={view.switchAccountHref} onRetry={() => setOutcome(null)} />;
  }
  return <Preview view={view} pending={pending} onRespond={(action) => void respond(action)} />;
}

function Preview({ view, pending, onRespond }: PreviewProps) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const layout = useLayoutClasses();
  const { preview } = view;
  return (
    <Card className={layout.cardAuthWidth}>
      <CardHeader>
        <CardTitle>{t(INVITE_KEYS.title)}</CardTitle>
        <CardDescription>
          {t(INVITE_KEYS.intro, {
            host: preview.hostName ?? t(INVITE_KEYS.unnamedHost),
            property: preview.propertyLabel ?? t(INVITE_KEYS.unnamedProperty),
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{t(INVITE_KEYS.reason)}</dt>
          <dd>{preview.reason}</dd>
          <dt className="text-muted-foreground">{t(INVITE_KEYS.uploadUntil)}</dt>
          <dd>{formatDate(preview.grantExpiresAt)}</dd>
          <dt className="text-muted-foreground">{t(INVITE_KEYS.linkExpires)}</dt>
          <dd>{formatDateTime(preview.expiresAt, { dateStyle: 'long', timeStyle: 'short' })}</dd>
        </dl>
        <p className="text-sm">{t(INVITE_KEYS.scope)}</p>
        <p className="text-xs text-muted-foreground">{t(INVITE_KEYS.identityDeclared)}</p>
        <RespondArea view={view} pending={pending} onRespond={onRespond} />
      </CardContent>
    </Card>
  );
}

function RespondArea({ view, pending, onRespond }: PreviewProps) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const { respond } = view;
  if (respond.kind === 'other-account') return <OtherAccountNotice signedInAs={respond.signedInAs} href={view.switchAccountHref} />;
  if (respond.kind === 'sign-in') {
    return (
      <section className="space-y-2">
        <Button asChild className="w-full"><Link href={respond.href}>{t(INVITE_KEYS.signIn)}</Link></Button>
        <p className="text-xs text-muted-foreground">{t(INVITE_KEYS.signInHint)}</p>
      </section>
    );
  }
  return (
    <section className="flex gap-2">
      <Button className="flex-1" disabled={pending !== null} aria-busy={pending === 'accept'} onClick={() => onRespond('accept')}>
        {t(INVITE_KEYS.accept)}
      </Button>
      <Button className="flex-1" variant="outline" disabled={pending !== null} aria-busy={pending === 'decline'} onClick={() => onRespond('decline')}>
        {t(INVITE_KEYS.decline)}
      </Button>
    </section>
  );
}

function Outcome({ outcome, switchAccountHref, onRetry }: {
  readonly outcome: TourInvitationRedeemResult;
  readonly switchAccountHref: string;
  readonly onRetry: () => void;
}) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  switch (outcome.kind) {
    case 'accepted':
      return (
        <Message title={t(INVITE_KEYS.accepted)} body={t(INVITE_KEYS.acceptedBody)}>
          <Button asChild className="w-full"><Link href={myTourCapturesHref()}>{t(INVITE_KEYS.goToCaptures)}</Link></Button>
        </Message>
      );
    case 'declined':
      return <Message title={t(INVITE_KEYS.declined)} body={t(INVITE_KEYS.declinedBody)} />;
    case 'refused':
      return (
        <Message title={t(INVITE_KEYS.title)} body={t(INVITE_REFUSAL_KEY[outcome.reason])}>
          {outcome.reason === 'wrong-recipient' && <SwitchAccountButton href={switchAccountHref} />}
        </Message>
      );
    case 'failed':
      return (
        <Message title={t(INVITE_KEYS.title)} body={t(INVITE_KEYS.unavailable)}>
          <Button className="w-full" onClick={onRetry}>{t(INVITE_KEYS.retry)}</Button>
        </Message>
      );
  }
}

/** Όψη που δεν δίνεται (ληγμένη · απαντημένη · ανακλημένη) ή «δεν μπόρεσα» — πάντα με έξοδο. */
function Setback({ reason }: { readonly reason: InvitationCoreRefusal | null }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  return (
    <Message title={t(INVITE_KEYS.title)} body={t(reason === null ? INVITE_KEYS.unavailable : INVITE_REFUSAL_KEY[reason])}>
      <Button asChild variant="outline" className="w-full"><Link href="/">{t(INVITE_KEYS.home)}</Link></Button>
    </Message>
  );
}

function Message({ title, body, children }: { readonly title: string; readonly body: string; readonly children?: React.ReactNode }) {
  const layout = useLayoutClasses();
  return (
    <Card className={layout.cardAuthWidth}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription role="status">{body}</CardDescription>
      </CardHeader>
      {children && <CardContent>{children}</CardContent>}
    </Card>
  );
}
