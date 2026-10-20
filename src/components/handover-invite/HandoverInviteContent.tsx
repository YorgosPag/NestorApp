'use client';

/**
 * @fileoverview **Η ΟΘΟΝΗ ΤΟΥ ΑΓΟΡΑΣΤΗ ΠΟΥ ΛΑΜΒΑΝΕΙ ΤΟΝ ΦΑΚΕΛΟ ΤΟΥ ΣΠΙΤΙΟΥ ΤΟΥ** — ποιος τον δίνει, ποιο σπίτι, τι θα βρει,
 * ως πότε — και η απάντηση («Αποδοχή του φακέλου» / «Δεν το θέλω»).
 * @related ADR-916 Φ-Β2 · `app/(auth)/handover-invite/[token]/page.tsx` · πρότυπα `CaseInviteContent` · `TourCaptureInviteContent`
 * @module components/handover-invite/HandoverInviteContent
 *
 * 🔑 **Στοιχεία ΠΡΙΝ από κουμπιά** (anti-phishing, ADR-853 §5 #4) και **το εύρος λέγεται ρητά**: η αποδοχή δίνει τον
 * φάκελο **ενός** σπιτιού — όχι ιδιότητα μέλους στην εταιρεία. Ανώνυμος ⇒ σύνδεση/εγγραφή με επιστροφή **εδώ**· άλλος
 * λογαριασμός ⇒ λέγεται **πριν** το κλικ. Μετά την αποδοχή: **ένα** κλικ στον φάκελο (Spaciable: portal αμέσως).
 * 🔑 **Κάθε αποτυχία έχει έξοδο** — ονομασμένη άρνηση ≠ παροδικό «δοκιμάστε ξανά» (ADR-853 μαθήματα).
 * ⚠️ Κάθε υπο-κομμάτι καλεί **μόνο του** `useTranslation` (ADR-744 §18) — κανένα `t` ως prop.
 * ⛔ Σύνδεσμοι μόνο από `@/lib/workspace/navigation` (CHECK 3.61).
 */

import { useCallback, useState } from 'react';

import { InvitationIdentityGate } from '@/components/invitations/InvitationIdentityGate';
import { InvitationMessageCard } from '@/components/invitations/InvitationMessageCard';
import { SwitchAccountButton } from '@/components/workspace-invite/SwitchAccount';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { InvitationPageView, InvitationPreviewView } from '@/lib/invitations/invitation-respond';
import { formatDateTime } from '@/lib/intl-formatting';
import { dossierDetailHref, MY_DOSSIERS_ROUTE } from '@/lib/property-dossier/property-dossier-routes';
import { Link } from '@/lib/workspace/navigation';
import {
  redeemHandoverInvitationFromScreen,
  type HandoverInvitationRedeemResult,
} from '@/services/property-handover/property-handover-invitation.client';
import type { InvitationRedeemAction } from '@/contracts/invitation-redeem-body';
import type { InvitationCoreRefusal } from '@/types/invitation-core';
import type { PropertyHandoverInvitationPreview, PropertyHandoverInvitationRefusal } from '@/types/property-handover-invitation';

import {
  HANDOVER_INVITE_ACCEPTED_BODY_KEY,
  HANDOVER_INVITE_INTRO_KEY,
  HANDOVER_INVITE_KEYS,
  HANDOVER_INVITE_NS,
  HANDOVER_INVITE_REFUSAL_KEY,
} from './handover-invite-labels';

// 🔴 ADR-744 §18 — ΤΟ SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ, ΣΤΑΤΙΚΑ ΚΑΙ ΣΕ ΕΜΒΕΛΕΙΑ MODULE (ποτέ `import()`, ποτέ σε Server Component).
import routeSlice from '@/i18n/generated/routes/handover-invite__token.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

export type HandoverInviteView = InvitationPageView<PropertyHandoverInvitationPreview, InvitationCoreRefusal>;

/** Ετικέτα όρου πάνω από την τιμή του (μία στήλη). */
const TERM_CLASS = 'mt-2 text-xs font-medium text-muted-foreground first:mt-0';

type PreviewView = InvitationPreviewView<PropertyHandoverInvitationPreview>;
type OnOutcome = (outcome: HandoverInvitationRedeemResult) => void;

export function HandoverInviteContent({ view }: { readonly view: HandoverInviteView }) {
  const [outcome, setOutcome] = useState<HandoverInvitationRedeemResult | null>(null);
  if (view.kind !== 'preview') return <Setback reason={view.kind === 'refused' ? view.reason : null} />;
  if (outcome !== null) return <Outcome outcome={outcome} view={view} onRetry={() => setOutcome(null)} />;
  return <Preview view={view} onOutcome={setOutcome} />;
}

function Preview({ view, onOutcome }: { readonly view: PreviewView; readonly onOutcome: OnOutcome }) {
  const { t } = useTranslation(HANDOVER_INVITE_NS);
  const layout = useLayoutClasses();
  const { preview } = view;
  return (
    <Card className={layout.cardAuthWidth}>
      <CardHeader>
        <CardTitle>{t(HANDOVER_INVITE_KEYS.title)}</CardTitle>
        <CardDescription>
          {t(HANDOVER_INVITE_INTRO_KEY[preview.occasion], {
            issuer: preview.issuerName ?? t(HANDOVER_INVITE_KEYS.unnamedIssuer),
            property: preview.propertyLabel ?? t(HANDOVER_INVITE_KEYS.unnamedProperty),
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Ετικέτα ΠΑΝΩ από την τιμή: οι τιμές είναι προτάσεις — σε δύο στήλες στένευαν σε ~4 λέξεις/γραμμή στο κινητό (γκαλερί 375px). */}
        <dl className="grid gap-y-1 text-sm">
          <dt className={TERM_CLASS}>{t(HANDOVER_INVITE_KEYS.findLabel)}</dt>
          <dd>{t(HANDOVER_INVITE_KEYS.find)}</dd>
          <dt className={TERM_CLASS}>{t(HANDOVER_INVITE_KEYS.costLabel)}</dt>
          <dd>{t(HANDOVER_INVITE_KEYS.cost)}</dd>
          <dt className={TERM_CLASS}>{t(HANDOVER_INVITE_KEYS.linkExpires)}</dt>
          {/* Η ΙΔΙΑ μορφή με το email («λήγει στις …») — ποτέ «σε N ημέρες» που θα στρογγυλευόταν αλλιώς. */}
          <dd>{formatDateTime(preview.expiresAt, { dateStyle: 'long', timeStyle: 'short' })}</dd>
        </dl>
        <p className="text-sm">{t(HANDOVER_INVITE_KEYS.scope)}</p>
        <InvitationIdentityGate
          respond={view.respond}
          switchAccountHref={view.switchAccountHref}
          signInLabel={t(HANDOVER_INVITE_KEYS.signIn)}
          signInHint={t(HANDOVER_INVITE_KEYS.signInHint)}
        >
          <Answer token={view.token} onOutcome={onOutcome} />
        </InvitationIdentityGate>
      </CardContent>
    </Card>
  );
}

/** «Αποδοχή» / «Δεν το θέλω» — ένα αίτημα τη φορά· το «σε εξέλιξη» **μόνο** στο κουμπί που πατήθηκε. */
function Answer({ token, onOutcome }: { readonly token: string; readonly onOutcome: OnOutcome }) {
  const { t } = useTranslation(HANDOVER_INVITE_NS);
  const [pending, setPending] = useState<InvitationRedeemAction | null>(null);
  const answer = useCallback(async (action: InvitationRedeemAction) => {
    setPending(action);
    const result = await redeemHandoverInvitationFromScreen(token, action);
    // Πρώτα το «τελείωσε», μετά η έκβαση: η έκβαση αντικαθιστά αυτό το κομμάτι — καμία ενημέρωση σε αποπροσαρτημένο.
    setPending(null);
    onOutcome(result);
  }, [onOutcome, token]);

  return (
    <section className="space-y-2">
      <section className="flex gap-2">
        {/* `data-invite-action` — δηλωμένο σήμα πράξης για τη γκαλερί καταστάσεων (`HandoverInviteHarness`), ποτέ κείμενο. */}
        <Button className="flex-1" data-invite-action="accept" disabled={pending !== null} aria-busy={pending === 'accept'} onClick={() => void answer('accept')}>
          {t(HANDOVER_INVITE_KEYS.accept)}
        </Button>
        <Button className="flex-1" variant="outline" data-invite-action="decline" disabled={pending !== null} aria-busy={pending === 'decline'} onClick={() => void answer('decline')}>
          {t(HANDOVER_INVITE_KEYS.decline)}
        </Button>
      </section>
      <p className="text-xs text-muted-foreground">{t(HANDOVER_INVITE_KEYS.declineHint)}</p>
    </section>
  );
}

function Outcome({ outcome, view, onRetry }: {
  readonly outcome: HandoverInvitationRedeemResult;
  readonly view: PreviewView;
  readonly onRetry: () => void;
}) {
  const { t } = useTranslation(HANDOVER_INVITE_NS);
  switch (outcome.kind) {
    case 'accepted':
      return (
        <InvitationMessageCard title={t(HANDOVER_INVITE_KEYS.accepted)} body={t(HANDOVER_INVITE_ACCEPTED_BODY_KEY[view.preview.occasion])}>
          <Button asChild className="w-full"><Link href={dossierDetailHref(outcome.dossierId)}>{t(HANDOVER_INVITE_KEYS.openDossier)}</Link></Button>
        </InvitationMessageCard>
      );
    case 'declined':
      // Κάθε έκβαση έχει έξοδο — και η άρνηση (εύρημα της γκαλερί καταστάσεων, 2026-10-20).
      return (
        <InvitationMessageCard title={t(HANDOVER_INVITE_KEYS.declined)} body={t(HANDOVER_INVITE_KEYS.declinedBody)}>
          <Button asChild variant="outline" className="w-full"><Link href="/">{t(HANDOVER_INVITE_KEYS.home)}</Link></Button>
        </InvitationMessageCard>
      );
    case 'refused':
      return <Refusal reason={outcome.reason} switchAccountHref={view.switchAccountHref} />;
    case 'failed':
      return (
        <InvitationMessageCard title={t(HANDOVER_INVITE_KEYS.title)} body={t(HANDOVER_INVITE_KEYS.answerFailed)}>
          <Button className="w-full" onClick={onRetry}>{t(HANDOVER_INVITE_KEYS.retry)}</Button>
        </InvitationMessageCard>
      );
  }
}

/** Ονομασμένη άρνηση, με την έξοδο **που ταιριάζει**: άλλος λογαριασμός ⇒ αλλαγή · ήδη απαντημένη ⇒ οι φάκελοί μου. */
function Refusal({ reason, switchAccountHref }: { readonly reason: PropertyHandoverInvitationRefusal; readonly switchAccountHref: string | null }) {
  const { t } = useTranslation(HANDOVER_INVITE_NS);
  return (
    <InvitationMessageCard title={t(HANDOVER_INVITE_KEYS.title)} body={t(HANDOVER_INVITE_REFUSAL_KEY[reason])}>
      <section className="space-y-2">
        {reason === 'wrong-recipient' && switchAccountHref !== null && <SwitchAccountButton href={switchAccountHref} />}
        {reason === 'already-used' && (
          <Button asChild className="w-full"><Link href={MY_DOSSIERS_ROUTE}>{t(HANDOVER_INVITE_KEYS.myDossiers)}</Link></Button>
        )}
        <Button asChild variant="outline" className="w-full"><Link href="/">{t(HANDOVER_INVITE_KEYS.home)}</Link></Button>
      </section>
    </InvitationMessageCard>
  );
}

/** Όψη που δεν δίνεται (ληγμένη · απαντημένη · ανακλημένη) ή «δεν μπόρεσα» — πάντα με έξοδο. */
function Setback({ reason }: { readonly reason: InvitationCoreRefusal | null }) {
  const { t } = useTranslation(HANDOVER_INVITE_NS);
  if (reason !== null) return <Refusal reason={reason} switchAccountHref={null} />;
  return (
    <InvitationMessageCard title={t(HANDOVER_INVITE_KEYS.title)} body={t(HANDOVER_INVITE_KEYS.unavailable)}>
      <Button asChild variant="outline" className="w-full"><Link href="/">{t(HANDOVER_INVITE_KEYS.home)}</Link></Button>
    </InvitationMessageCard>
  );
}
