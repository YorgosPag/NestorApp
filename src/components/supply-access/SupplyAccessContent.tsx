'use client';

/**
 * @fileoverview **Η ΟΘΟΝΗ ΤΟΥ ΑΓΟΡΑΣΤΗ** στις δύο πόρτες της σχέσης προμήθειας (ADR-923 §5.12 Σ2 · Σ3): πρόσκληση από email ·
 *   αίτημα από σύνδεσμο/QR. Ένα component, δύο σελίδες: αλλάζει μόνο τι απαντά ο άνθρωπος.
 * @related `CaseInviteContent.tsx` (το πρότυπο) · `ActingWorkspaceField.tsx` (το ΕΝΑ πεδίο χώρου)
 * @module components/supply-access/SupplyAccessContent
 *
 * 🔑 **Στοιχεία ΠΡΙΝ από κουμπιά** (ADR-853 §5 #4), και το εύρος λέγεται ρητά: ο προμηθευτής δεν αποκτά πρόσβαση στο γραφείο.
 * 🔑 Ο χώρος τον δηλώνει ο άνθρωπος, με τον ίδιο κριτή που ξανατρέχει στην πράξη. Χωρίς γραφείο δεν προσφέρεται καμία
 *    απάντηση: το BOQ ζει σε χώρο εταιρείας (Σ3), ενώ η άρνηση παραμένει δυνατή στην πρόσκληση.
 * ⛔ Σύνδεσμοι μόνο από `@/lib/workspace/navigation` (CHECK 3.61).
 */

import { useCallback, useState } from 'react';

import { ActingWorkspaceField } from '@/components/conveyance/acting/ActingWorkspaceField';
import { InvitationIdentityGate } from '@/components/invitations/InvitationIdentityGate';
import { InvitationMessageCard } from '@/components/invitations/InvitationMessageCard';
import { SwitchAccountButton } from '@/components/workspace-invite/SwitchAccount';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { actingChoiceOf } from '@/lib/conveyance/acting-acceptance';
import type { InvitationPreviewView } from '@/lib/invitations/invitation-respond';
import { formatDateTime } from '@/lib/intl-formatting';
import { Link } from '@/lib/workspace/navigation';
import {
  redeemSupplyInvitationFromScreen,
  requestSupplyAccessFromScreen,
  type SupplyAccessRefusal,
  type SupplyAccessResult,
} from '@/services/catalog/supply-api.client';
import type { SupplyAccessPreview } from '@/subapps/catalog/types/supply-invitation';
import type { AcceptancePreview } from '@/types/conveyance-case';

import { SUPPLY_ACCESS_KEYS, SUPPLY_DONE_BODY_KEY, SUPPLY_DONE_TITLE_KEY, SUPPLY_NS, SUPPLY_REFUSAL_KEY } from '../catalog/supply/supply-labels';

// 🔴 ADR-744 §18 — ΤΟ SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ, ΣΤΑΤΙΚΑ ΚΑΙ ΣΕ ΕΜΒΕΛΕΙΑ MODULE. Ίδιο component ⇒ ίδιο σύνολο κλειδιών στις δύο σελίδες.
import inviteSlice from '@/i18n/generated/routes/supply-invite__token.el.json';
import requestSlice from '@/i18n/generated/routes/supply-request__token.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(inviteSlice);
registerRouteSlice(requestSlice);

export type SupplyAccessDoor = 'invitation' | 'link';

export type SupplyAccessView =
  | (InvitationPreviewView<SupplyAccessPreview & { readonly expiresAt?: string }> & { readonly acceptance: AcceptancePreview | null })
  | { readonly kind: 'refused'; readonly reason: SupplyAccessRefusal }
  | { readonly kind: 'unavailable' };

type PreviewView = Extract<SupplyAccessView, { kind: 'preview' }>;

const UNCHECKED: AcceptancePreview = { kind: 'unknown' };

export function SupplyAccessContent({ door, view }: { readonly door: SupplyAccessDoor; readonly view: SupplyAccessView }) {
  const [outcome, setOutcome] = useState<SupplyAccessResult | null>(null);
  if (view.kind !== 'preview') return <Setback door={door} reason={view.kind === 'refused' ? view.reason : null} />;
  if (outcome !== null) return <Outcome door={door} outcome={outcome} switchAccountHref={view.switchAccountHref} onRetry={() => setOutcome(null)} />;
  return <Preview door={door} view={view} onOutcome={setOutcome} />;
}

function Preview({ door, view, onOutcome }: { readonly door: SupplyAccessDoor; readonly view: PreviewView; readonly onOutcome: (outcome: SupplyAccessResult) => void }) {
  const { t } = useTranslation(SUPPLY_NS);
  const layout = useLayoutClasses();
  const supplier = view.preview.supplierName ?? t(SUPPLY_ACCESS_KEYS.unnamedSupplier);
  const { expiresAt } = view.preview;
  return (
    <Card className={layout.cardAuthWidth}>
      <CardHeader>
        <CardTitle>{t(door === 'invitation' ? SUPPLY_ACCESS_KEYS.inviteTitle : SUPPLY_ACCESS_KEYS.requestTitle)}</CardTitle>
        <CardDescription>{t(door === 'invitation' ? SUPPLY_ACCESS_KEYS.inviteIntro : SUPPLY_ACCESS_KEYS.requestIntro, { supplier })}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">{t(SUPPLY_ACCESS_KEYS.scope)}</p>
        {expiresAt ? <p className="text-xs text-muted-foreground">{t(SUPPLY_ACCESS_KEYS.linkExpires, { date: formatDateTime(expiresAt, { dateStyle: 'long', timeStyle: 'short' }) })}</p> : null}
        <InvitationIdentityGate respond={view.respond} switchAccountHref={view.switchAccountHref} signInLabel={t(SUPPLY_ACCESS_KEYS.signIn)} signInHint={t(SUPPLY_ACCESS_KEYS.signInHint)}>
          <Answer door={door} view={view} onOutcome={onOutcome} />
        </InvitationIdentityGate>
      </CardContent>
    </Card>
  );
}

/** Χώρος + απάντηση: ένα αίτημα τη φορά. */
function Answer({ door, view, onOutcome }: { readonly door: SupplyAccessDoor; readonly view: PreviewView; readonly onOutcome: (outcome: SupplyAccessResult) => void }) {
  const { t } = useTranslation(SUPPLY_NS);
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [customerRef, setCustomerRef] = useState('');
  const [showMissing, setShowMissing] = useState(false);
  const [pending, setPending] = useState<'positive' | 'decline' | null>(null);
  const acceptance = view.acceptance ?? UNCHECKED;
  const withoutOffice = acceptance.kind === 'personal-provisional';

  const send = useCallback(async () => {
    const acting = actingChoiceOf(acceptance, officeId);
    if (!acting.ok) { setShowMissing(true); return; }
    const request = acting.actingRequest ? { actingRequest: acting.actingRequest } : {};
    setPending('positive');
    onOutcome(door === 'invitation'
      ? await redeemSupplyInvitationFromScreen(view.token, 'accept', request)
      : await requestSupplyAccessFromScreen(view.token, customerRef, request));
    setPending(null);
  }, [acceptance, customerRef, door, officeId, onOutcome, view.token]);

  const decline = useCallback(async () => {
    setPending('decline');
    onOutcome(await redeemSupplyInvitationFromScreen(view.token, 'decline', {}));
    setPending(null);
  }, [onOutcome, view.token]);

  return (
    <section className="space-y-3">
      {withoutOffice
        ? <p className="text-sm" role="status">{t(SUPPLY_ACCESS_KEYS.officeRequired)}</p>
        : <ActingWorkspaceField preview={acceptance} selectedCompanyId={officeId} onSelect={setOfficeId} showMissing={showMissing} disabled={pending !== null} />}
      {door === 'link' && !withoutOffice ? (
        <section className="space-y-1">
          <Label htmlFor="supply-customer-ref">{t(SUPPLY_ACCESS_KEYS.customerRefLabel)}</Label>
          <Input id="supply-customer-ref" value={customerRef} maxLength={64} disabled={pending !== null} onChange={(event) => setCustomerRef(event.target.value)} />
          <p className="text-xs text-muted-foreground">{t(SUPPLY_ACCESS_KEYS.customerRefHint)}</p>
        </section>
      ) : null}
      <section className="flex gap-2">
        {withoutOffice ? null : (
          <Button className="flex-1" disabled={pending !== null} aria-busy={pending === 'positive'} onClick={() => void send()}>
            {t(door === 'invitation' ? SUPPLY_ACCESS_KEYS.accept : SUPPLY_ACCESS_KEYS.request)}
          </Button>
        )}
        {door === 'invitation' ? (
          <Button className="flex-1" variant="outline" disabled={pending !== null} aria-busy={pending === 'decline'} onClick={() => void decline()}>
            {t(SUPPLY_ACCESS_KEYS.decline)}
          </Button>
        ) : null}
      </section>
    </section>
  );
}

function Outcome({ door, outcome, switchAccountHref, onRetry }: {
  readonly door: SupplyAccessDoor;
  readonly outcome: SupplyAccessResult;
  readonly switchAccountHref: string;
  readonly onRetry: () => void;
}) {
  const { t } = useTranslation(SUPPLY_NS);
  const title = t(door === 'invitation' ? SUPPLY_ACCESS_KEYS.inviteTitle : SUPPLY_ACCESS_KEYS.requestTitle);
  switch (outcome.kind) {
    case 'done':
      return <InvitationMessageCard title={t(SUPPLY_DONE_TITLE_KEY[outcome.status])} body={t(SUPPLY_DONE_BODY_KEY[outcome.status])} />;
    case 'refused':
      return (
        <InvitationMessageCard title={title} body={t(SUPPLY_REFUSAL_KEY[outcome.reason])}>
          {outcome.reason === 'wrong-recipient' ? <SwitchAccountButton href={switchAccountHref} /> : null}
        </InvitationMessageCard>
      );
    case 'failed':
      return (
        <InvitationMessageCard title={title} body={t(SUPPLY_ACCESS_KEYS.unavailable)}>
          <Button className="w-full" onClick={onRetry}>{t(SUPPLY_ACCESS_KEYS.retry)}</Button>
        </InvitationMessageCard>
      );
  }
}

/** Όψη που δεν δίνεται, ή «δεν μπόρεσα»: πάντα με έξοδο. */
function Setback({ door, reason }: { readonly door: SupplyAccessDoor; readonly reason: SupplyAccessRefusal | null }) {
  const { t } = useTranslation(SUPPLY_NS);
  return (
    <InvitationMessageCard title={t(door === 'invitation' ? SUPPLY_ACCESS_KEYS.inviteTitle : SUPPLY_ACCESS_KEYS.requestTitle)} body={t(reason === null ? SUPPLY_ACCESS_KEYS.unavailable : SUPPLY_REFUSAL_KEY[reason])}>
      <Button asChild variant="outline" className="w-full"><Link href="/">{t(SUPPLY_ACCESS_KEYS.home)}</Link></Button>
    </InvitationMessageCard>
  );
}
