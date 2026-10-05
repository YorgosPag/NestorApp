'use client';

/**
 * @fileoverview **Η ΟΘΟΝΗ ΤΟΥ ΠΡΟΣΚΕΚΛΗΜΕΝΟΥ ΕΠΑΓΓΕΛΜΑΤΙΑ** — ποιος τον καλεί, για ποιο ακίνητο, με ποιον ρόλο, τι θα
 * βρει — και τι απαντά (με δήλωση ιδιότητας).
 * @related ADR-901 Φ3 · §5.3 βήματα 5-9 · `app/(auth)/case-invite/[token]/page.tsx` · πρότυπο `TourCaptureInviteContent`
 * @module components/case-invite/CaseInviteContent
 *
 * 🔑 **Στοιχεία ΠΡΙΝ από κουμπιά** (anti-phishing, ADR-853 §5 #4) και **το εύρος λέγεται ρητά**: η αποδοχή δίνει
 * πρόσβαση σε **μία** υπόθεση — όχι στο γραφείο (ADR-901 Α1). Ανώνυμος ⇒ σύνδεση/εγγραφή με επιστροφή **εδώ**
 * (το `AuthForm` σέβεται το `next` και στην εγγραφή — ADR-859)· άλλος λογαριασμός ⇒ λέγεται **πριν** το κλικ.
 * ⚠️ Κάθε υπο-κομμάτι καλεί **μόνο του** `useTranslation` (ADR-744 §18) — κανένα `t` ως prop.
 * ⛔ Σύνδεσμοι μόνο από `@/lib/workspace/navigation` (CHECK 3.61).
 */

import { useCallback, useState } from 'react';

import { ActingWorkspaceField } from '@/components/conveyance/acting/ActingWorkspaceField';
import { InvitationMessageCard } from '@/components/invitations/InvitationMessageCard';
import { InvitationIdentityGate } from '@/components/invitations/InvitationIdentityGate';
import { SwitchAccountButton } from '@/components/workspace-invite/SwitchAccount';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { actingChoiceOf } from '@/lib/conveyance/acting-acceptance';
import { myCaseHref } from '@/lib/conveyance/conveyance-routes';
import type { InvitationPreviewView } from '@/lib/invitations/invitation-respond';
import { formatDateTime } from '@/lib/intl-formatting';
import { Link } from '@/lib/workspace/navigation';
import {
  redeemCaseInvitationFromScreen,
  type CaseInvitationRedeemResult,
} from '@/services/conveyance/conveyance-engagement-gateway';
import type { AcceptancePreview } from '@/types/conveyance-case';
import type { EngagementInvitationPreview } from '@/types/engagement-invitation';
import type { InvitationCoreRefusal } from '@/types/invitation-core';

import { CASE_INVITE_KEYS, CASE_INVITE_NS, CASE_INVITE_REFUSAL_KEY, CASE_INVITE_ROLE_KEY } from './case-invite-labels';
import { CredentialDeclarationForm, credentialDraftOf, credentialFromDraft, type CredentialDraft } from './CredentialDeclarationForm';

// 🔴 ADR-744 §18 — ΤΟ SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ, ΣΤΑΤΙΚΑ ΚΑΙ ΣΕ ΕΜΒΕΛΕΙΑ MODULE (ποτέ `import()`, ποτέ σε Server Component).
import routeSlice from '@/i18n/generated/routes/case-invite__token.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

export type CaseInviteView =
  /**
   * ADR-901 §15 (Γ1) — `acceptance`: για λογαριασμό ποιου γραφείου θα αναλάβει ο **συνδεδεμένος παραλήπτης**.
   * `null` ⇒ κανείς συνδεδεμένος, ή άλλος λογαριασμός (η πύλη ταυτότητας δεν δείχνει τότε την απάντηση).
   */
  | (InvitationPreviewView<EngagementInvitationPreview> & { readonly acceptance: AcceptancePreview | null })
  | { readonly kind: 'refused'; readonly reason: InvitationCoreRefusal }
  | { readonly kind: 'unavailable' };

type PreviewView = Extract<CaseInviteView, { kind: 'preview' }>;
type InviteAction = 'accept' | 'decline';

const UNCHECKED: AcceptancePreview = { kind: 'unknown' };

export function CaseInviteContent({ view }: { readonly view: CaseInviteView }) {
  const [outcome, setOutcome] = useState<CaseInvitationRedeemResult | null>(null);
  if (view.kind !== 'preview') return <Setback reason={view.kind === 'refused' ? view.reason : null} />;
  if (outcome !== null) return <Outcome outcome={outcome} switchAccountHref={view.switchAccountHref} onRetry={() => setOutcome(null)} />;
  return <Preview view={view} onOutcome={setOutcome} />;
}

function Preview({ view, onOutcome }: { readonly view: PreviewView; readonly onOutcome: (outcome: CaseInvitationRedeemResult) => void }) {
  const { t } = useTranslation(CASE_INVITE_NS);
  const layout = useLayoutClasses();
  const { preview } = view;
  return (
    <Card className={layout.cardAuthWidth}>
      <CardHeader>
        <CardTitle>{t(CASE_INVITE_KEYS.title)}</CardTitle>
        <CardDescription>
          {t(CASE_INVITE_KEYS.intro, {
            host: preview.hostName ?? t(CASE_INVITE_KEYS.unnamedHost),
            property: preview.propertyLabel ?? t(CASE_INVITE_KEYS.unnamedProperty),
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{t(CASE_INVITE_KEYS.roleLabel)}</dt>
          <dd>{t(CASE_INVITE_ROLE_KEY[preview.role])}</dd>
          {preview.checklist && (
            <>
              <dt className="text-muted-foreground">{t(CASE_INVITE_KEYS.findLabel)}</dt>
              <dd>{t(CASE_INVITE_KEYS.find, { ...preview.checklist })}</dd>
            </>
          )}
          <dt className="text-muted-foreground">{t(CASE_INVITE_KEYS.linkExpires)}</dt>
          <dd>{formatDateTime(preview.expiresAt, { dateStyle: 'long', timeStyle: 'short' })}</dd>
        </dl>
        <p className="text-sm">{t(CASE_INVITE_KEYS.scope)}</p>
        <p className="text-xs text-muted-foreground">{t(CASE_INVITE_KEYS.identityDeclared)}</p>
        <RespondArea view={view} onOutcome={onOutcome} />
      </CardContent>
    </Card>
  );
}

function RespondArea({ view, onOutcome }: { readonly view: PreviewView; readonly onOutcome: (outcome: CaseInvitationRedeemResult) => void }) {
  const { t } = useTranslation(CASE_INVITE_NS);
  return (
    <InvitationIdentityGate
      respond={view.respond}
      switchAccountHref={view.switchAccountHref}
      signInLabel={t(CASE_INVITE_KEYS.signIn)}
      signInHint={t(CASE_INVITE_KEYS.signInHint)}
    >
      <Answer view={view} onOutcome={onOutcome} />
    </InvitationIdentityGate>
  );
}

/** Δήλωση + «Αποδοχή» / «Δεν αναλαμβάνω» — ένα αίτημα τη φορά (Gmail «Sending…»). */
function Answer({ view, onOutcome }: { readonly view: PreviewView; readonly onOutcome: (outcome: CaseInvitationRedeemResult) => void }) {
  const { t } = useTranslation(CASE_INVITE_NS);
  const [draft, setDraft] = useState<CredentialDraft>(() => credentialDraftOf(view.preview.credentialHint));
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  const [pending, setPending] = useState<InviteAction | null>(null);
  // Η απάντηση αποδίδεται μόνο για τον συνδεδεμένο παραλήπτη· χωρίς προεπισκόπηση ⇒ «δεν ελέγχθηκε», ποτέ σιωπηλά.
  const acceptance = view.acceptance ?? UNCHECKED;

  const answer = useCallback(async (action: InviteAction) => {
    if (action === 'decline') {
      setPending(action);
      onOutcome(await redeemCaseInvitationFromScreen(view.token, { action }));
      setPending(null);
      return;
    }
    const credential = credentialFromDraft(draft);
    const acting = actingChoiceOf(acceptance, officeId);
    if (credential === null || !acting.ok) { setShowMissing(true); return; }
    setPending(action);
    onOutcome(await redeemCaseInvitationFromScreen(view.token, {
      action, credential, ...(acting.actingRequest ? { actingRequest: acting.actingRequest } : {}),
    }));
    setPending(null);
  }, [acceptance, draft, officeId, onOutcome, view.token]);

  return (
    <section className="space-y-3">
      <ActingWorkspaceField preview={acceptance} selectedCompanyId={officeId} onSelect={setOfficeId} showMissing={showMissing} disabled={pending !== null} />
      <CredentialDeclarationForm role={view.preview.role} draft={draft} onChange={setDraft} showMissing={showMissing} disabled={pending !== null} />
      <section className="flex gap-2">
        <Button className="flex-1" disabled={pending !== null} aria-busy={pending === 'accept'} onClick={() => void answer('accept')}>
          {t(CASE_INVITE_KEYS.accept)}
        </Button>
        <Button className="flex-1" variant="outline" disabled={pending !== null} aria-busy={pending === 'decline'} onClick={() => void answer('decline')}>
          {t(CASE_INVITE_KEYS.decline)}
        </Button>
      </section>
    </section>
  );
}

function Outcome({ outcome, switchAccountHref, onRetry }: {
  readonly outcome: CaseInvitationRedeemResult;
  readonly switchAccountHref: string;
  readonly onRetry: () => void;
}) {
  const { t } = useTranslation(CASE_INVITE_NS);
  switch (outcome.kind) {
    case 'accepted':
      return (
        <InvitationMessageCard title={t(CASE_INVITE_KEYS.accepted)} body={t(CASE_INVITE_KEYS.acceptedBody)}>
          <Button asChild className="w-full"><Link href={myCaseHref(outcome.engagementId)}>{t(CASE_INVITE_KEYS.openCase)}</Link></Button>
        </InvitationMessageCard>
      );
    case 'declined':
      return <InvitationMessageCard title={t(CASE_INVITE_KEYS.declined)} body={t(CASE_INVITE_KEYS.declinedBody)} />;
    case 'refused':
      return (
        <InvitationMessageCard title={t(CASE_INVITE_KEYS.title)} body={t(CASE_INVITE_REFUSAL_KEY[outcome.reason])}>
          {outcome.reason === 'wrong-recipient' && <SwitchAccountButton href={switchAccountHref} />}
        </InvitationMessageCard>
      );
    case 'failed':
      return (
        <InvitationMessageCard title={t(CASE_INVITE_KEYS.title)} body={t(CASE_INVITE_KEYS.unavailable)}>
          <Button className="w-full" onClick={onRetry}>{t(CASE_INVITE_KEYS.retry)}</Button>
        </InvitationMessageCard>
      );
  }
}

/** Όψη που δεν δίνεται (ληγμένη · απαντημένη · ακυρωμένη) ή «δεν μπόρεσα» — πάντα με έξοδο. */
function Setback({ reason }: { readonly reason: InvitationCoreRefusal | null }) {
  const { t } = useTranslation(CASE_INVITE_NS);
  return (
    <InvitationMessageCard title={t(CASE_INVITE_KEYS.title)} body={t(reason === null ? CASE_INVITE_KEYS.unavailable : CASE_INVITE_REFUSAL_KEY[reason])}>
      <Button asChild variant="outline" className="w-full"><Link href="/">{t(CASE_INVITE_KEYS.home)}</Link></Button>
    </InvitationMessageCard>
  );
}
