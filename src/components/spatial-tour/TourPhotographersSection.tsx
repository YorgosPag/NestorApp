'use client';

/**
 * @fileoverview **ΟΙ ΦΩΤΟΓΡΑΦΟΙ ΤΗΣ ΠΕΡΙΗΓΗΣΗΣ** — πρόσκληση · εκκρεμείς (επαναποστολή/ανάκληση) · άδειες (ανάκληση).
 * @related ADR-884 Φ0.5 · §4.5 (Κ3α) · `useTourPhotographers.ts` · πρότυπο Zillow Showcase «invite photographer»
 * @module components/spatial-tour/TourPhotographersSection
 *
 * 🔑 **Η λήξη της άδειας είναι ΥΠΟΧΡΕΩΤΙΚΗ και φαίνεται** (Φ0.5): ο φωτογράφος δεν γίνεται «μέλος για πάντα» — παίρνει
 * **μία δουλειά** με ημερομηνία. Προεπιλογή 30 ημέρες· η οθόνη δεν αφήνει να διαλεχτεί παρελθόν ή πέρα από έναν χρόνο.
 * 🔑 **Επαναποστολή = ίδια πράξη με την έκδοση** (ADR-853 §7.3): νέος σύνδεσμος, ο παλιός ανακαλείται ατομικά.
 * 🔑 Το «στάλθηκε» λέγεται **όπως το ξέρουμε** (`delivery`): «ο πάροχος το δέχτηκε», ποτέ «παραδόθηκε».
 */

import { useState, type FormEvent } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';
import type { TourCaptureInvitationView } from '@/app/api/spatial-tours/[kind]/[subjectId]/capture-invitations/route';
import type { TourCaptureGrantView } from '@/server/spatial-tour/tour-capture-invitation';
import type { TourSubject } from '@/types/spatial-tour';

import { DELIVERY_KEY, PANEL_KEYS, STANDING_KEY, TOUR_FAILURE_KEYS, TOUR_REFUSAL_KEY } from './spatial-tour-labels';
import { SPATIAL_TOUR_NS } from './spatial-tour-namespace';
import { useTourPhotographers, type PhotographerActResult } from './useTourPhotographers';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Ο ορίζοντας της οθόνης — ίδιος με του διακομιστή (`TOUR_ACCESS_MAX_DAYS`, 366)· ο διακομιστής ξανακρίνει. */
const MAX_DAYS_AHEAD = 365;
const DEFAULT_DAYS = 30;

export function TourPhotographersSection({ subject }: { readonly subject: TourSubject }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const photographers = useTourPhotographers(subject);
  const { load } = photographers;
  return (
    <section className="space-y-4" aria-labelledby="tour-photographers-heading">
      <h3 id="tour-photographers-heading" className="text-base font-semibold">{t(PANEL_KEYS.photographers)}</h3>
      <InviteForm busy={photographers.busy} onIssue={photographers.issue} />
      <ActResultLine result={photographers.last} />
      {load.kind === 'failed' && (
        <p className="text-sm text-destructive" role="alert">
          {t(PANEL_KEYS.loadFailed)}{' '}
          <Button type="button" variant="link" size="sm" onClick={() => void photographers.refresh()}>{t(PANEL_KEYS.retry)}</Button>
        </p>
      )}
      {load.kind === 'loaded' && (
        <>
          <PendingInvitations invitations={load.invitations} busy={photographers.busy}
            onResend={(i) => photographers.issue({ email: i.inviteeEmail, grantExpiresAt: i.grantExpiresAt, reason: i.reason })}
            onRevoke={(i) => photographers.revokeInvitation(i.id)} />
          <Grants grants={load.grants} busy={photographers.busy} onRevoke={(g) => photographers.revokeGrant(g.granteeUid)} />
        </>
      )}
    </section>
  );
}

function InviteForm({ busy, onIssue }: {
  readonly busy: boolean;
  readonly onIssue: (input: { email: string; grantExpiresAt: string; reason: string }) => Promise<void>;
}) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const [email, setEmail] = useState('');
  const [until, setUntil] = useState<Date | undefined>(() => new Date(Date.now() + DEFAULT_DAYS * DAY_MS));
  const [reason, setReason] = useState('');
  const ready = email.trim().length > 0 && reason.trim().length > 0 && until !== undefined;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready || until === undefined) return;
    await onIssue({ email, grantExpiresAt: until.toISOString(), reason });
    setEmail('');
    setReason('');
  };

  return (
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-3" aria-busy={busy}>
      <section className="space-y-1">
        <Label htmlFor="tour-invite-email">{t(PANEL_KEYS.inviteEmail)}</Label>
        <Input id="tour-invite-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </section>
      <section className="space-y-1">
        <Label htmlFor="tour-invite-until">{t(PANEL_KEYS.inviteGrantUntil)}</Label>
        <DatePickerField id="tour-invite-until" value={until} onSelect={setUntil} placeholder={t(PANEL_KEYS.inviteGrantUntil)}
          disabledDates={[{ before: new Date(Date.now() + DAY_MS) }, { after: new Date(Date.now() + MAX_DAYS_AHEAD * DAY_MS) }]} />
      </section>
      <section className="space-y-1">
        <Label htmlFor="tour-invite-reason">{t(PANEL_KEYS.inviteReason)}</Label>
        <Input id="tour-invite-reason" value={reason} maxLength={500} placeholder={t(PANEL_KEYS.inviteReasonPlaceholder)}
          onChange={(e) => setReason(e.target.value)} required />
      </section>
      <Button type="submit" className="sm:col-span-3 sm:justify-self-start" disabled={busy || !ready}>{t(PANEL_KEYS.inviteSubmit)}</Button>
    </form>
  );
}

/** Τι απέγινε η τελευταία πράξη — `status` για επιτυχία, `alert` για άρνηση. */
function ActResultLine({ result }: { readonly result: PhotographerActResult | null }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  if (result === null) return null;
  if (result.kind === 'issued') return <p className="text-sm" role="status">{t(DELIVERY_KEY[result.issued.delivery])}</p>;
  return (
    <p className="text-sm text-destructive" role="alert">
      {result.kind === 'refused' ? t(TOUR_REFUSAL_KEY[result.reason]) : t(TOUR_FAILURE_KEYS.unavailable)}
    </p>
  );
}

function PendingInvitations({ invitations, busy, onResend, onRevoke }: {
  readonly invitations: readonly TourCaptureInvitationView[];
  readonly busy: boolean;
  readonly onResend: (invitation: TourCaptureInvitationView) => void;
  readonly onRevoke: (invitation: TourCaptureInvitationView) => void;
}) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  return (
    <section aria-labelledby="tour-pending-heading" className="space-y-2">
      <h4 id="tour-pending-heading" className="text-sm font-medium">{t(PANEL_KEYS.pendingInvitations)}</h4>
      {invitations.length === 0 ? <p className="text-sm text-muted-foreground">{t(PANEL_KEYS.noPendingInvitations)}</p> : (
        <ul className="divide-y rounded-md border">
          {invitations.map((invitation) => (
            <li key={invitation.id} className="flex flex-wrap items-center gap-2 p-2 text-sm">
              <span className="font-medium">{invitation.inviteeEmail}</span>
              <span className="text-muted-foreground">{t(PANEL_KEYS.invitationUntil, { date: formatDate(invitation.expiresAt) })}</span>
              {invitation.openedAt !== null && <Badge variant="secondary">{t(PANEL_KEYS.opened)}</Badge>}
              {invitation.state === 'expired' && <Badge variant="outline">{t(STANDING_KEY.expired)}</Badge>}
              <span className="ms-auto flex gap-1">
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onResend(invitation)}>{t(PANEL_KEYS.resend)}</Button>
                <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onRevoke(invitation)}>{t(PANEL_KEYS.revoke)}</Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Grants({ grants, busy, onRevoke }: {
  readonly grants: readonly TourCaptureGrantView[];
  readonly busy: boolean;
  readonly onRevoke: (grant: TourCaptureGrantView) => void;
}) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  return (
    <section aria-labelledby="tour-grants-heading" className="space-y-2">
      <h4 id="tour-grants-heading" className="text-sm font-medium">{t(PANEL_KEYS.grants)}</h4>
      {grants.length === 0 ? <p className="text-sm text-muted-foreground">{t(PANEL_KEYS.noGrants)}</p> : (
        <ul className="divide-y rounded-md border">
          {grants.map((grant) => (
            <li key={grant.granteeUid} className="flex flex-wrap items-center gap-2 p-2 text-sm">
              <span className="font-medium">{grant.inviteeEmail ?? t(PANEL_KEYS.photographers)}</span>
              <Badge variant={grant.standing === 'active' ? 'default' : 'outline'}>{t(STANDING_KEY[grant.standing])}</Badge>
              <span className="text-muted-foreground">{t(PANEL_KEYS.grantUntil, { date: formatDate(grant.expiresAt) })}</span>
              {grant.standing === 'active' && (
                <Button type="button" size="sm" variant="ghost" className="ms-auto" disabled={busy} onClick={() => onRevoke(grant)}>
                  {t(PANEL_KEYS.revoke)}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
