'use client';

/**
 * @fileoverview **ΑΙΤΗΜΑΤΑ ΘΕΑΣΗΣ** — εκκρεμή (μαζική έγκριση/απόρριψη) · όσοι έχουν πρόσβαση (ίχνος, ανάκληση) (ADR-884 Κ3β).
 * @related `useTourViewing.ts` · `server/spatial-tour/tour-access-inbox.ts` · πρότυπο Google Drive «Request access»
 * @module components/spatial-tour/TourAccessRequestsSection
 *
 * 🏆 **Πέρα από το Drive**: μαζική απόφαση από μία λίστα · λήξη **υποχρεωτική** και ορατή · δίπλα σε κάθε άνθρωπο το
 * **ίχνος** («την είδε 3 φορές, τελευταία χθες») και αν είναι ήδη **επαφή στο CRM**. Το email δείχνει αν είναι
 * **επαληθευμένο** — ο μεσίτης ξέρει με ποιον μιλά.
 */

import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';
import type { TourAccessInboxRow } from '@/server/spatial-tour/tour-access-inbox';
import type { TourSubject } from '@/types/spatial-tour';

import { TOUR_FAILURE_KEYS, TOUR_REFUSAL_KEY } from './spatial-tour-labels';
import { SPATIAL_TOUR_NS } from './spatial-tour-namespace';
import { VIEWING_KEYS } from './spatial-tour-viewing-labels';
import { useTourAccessRequests, type TourViewingNotice } from './useTourViewing';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Ο ορίζοντας της οθόνης — ο διακομιστής ξανακρίνει (`TOUR_ACCESS_MAX_DAYS`). */
const MAX_DAYS_AHEAD = 365;
const DEFAULT_DAYS = 30;

export function TourAccessRequestsSection({ subject }: { readonly subject: TourSubject }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  return (
    <section className="space-y-3" aria-labelledby="tour-requests-heading">
      <h3 id="tour-requests-heading" className="text-base font-semibold">{t(VIEWING_KEYS.requestsTitle)}</h3>
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">{t(VIEWING_KEYS.tabPending)}</TabsTrigger>
          <TabsTrigger value="approved">{t(VIEWING_KEYS.tabApproved)}</TabsTrigger>
        </TabsList>
        <TabsContent value="pending"><PendingRequests subject={subject} /></TabsContent>
        <TabsContent value="approved"><ApprovedViewers subject={subject} /></TabsContent>
      </Tabs>
    </section>
  );
}

/** Ποιος είναι — όνομα (ή «άγνωστος λογαριασμός»), email, και αν είναι επαληθευμένο. */
function Who({ row }: { readonly row: TourAccessInboxRow }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="font-medium">{row.name ?? row.email ?? t(VIEWING_KEYS.unknownAccount)}</span>
      {row.email !== null && <span className="text-muted-foreground">{row.email}</span>}
      <Badge variant={row.emailVerified ? 'secondary' : 'outline'}>
        {t(row.emailVerified ? VIEWING_KEYS.verifiedEmail : VIEWING_KEYS.unverifiedEmail)}
      </Badge>
    </span>
  );
}

function PendingRequests({ subject }: { readonly subject: TourSubject }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const { rows, decide, notice } = useTourAccessRequests(subject, 'pending');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [until, setUntil] = useState<Date | undefined>(() => new Date(Date.now() + DEFAULT_DAYS * DAY_MS));
  if (rows === null) return null;
  const chosen = rows.filter((row) => selected.has(row.requesterUid)).map((row) => row.requesterUid);
  const toggle = (uid: string, on: boolean) => setSelected((prev) => {
    const next = new Set(prev);
    if (on) next.add(uid); else next.delete(uid);
    return next;
  });
  const act = async (decision: 'approved' | 'declined') => {
    await decide(chosen, decision, decision === 'approved' ? until?.toISOString() ?? null : null);
    setSelected(new Set());
  };
  return (
    <section className="space-y-3">
      <DecisionNotice notice={notice} />
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t(VIEWING_KEYS.noPending)}</p> : (
        <>
          <DecisionBar count={chosen.length} until={until} onUntil={setUntil}
            onApprove={() => void act('approved')} onDecline={() => void act('declined')}
            allSelected={chosen.length === rows.length}
            onSelectAll={(on) => setSelected(on ? new Set(rows.map((row) => row.requesterUid)) : new Set())} />
          <ul className="divide-y rounded-md border">
            {rows.map((row) => (
              <li key={row.requesterUid} className="flex items-start gap-3 p-2 text-sm">
                <Checkbox checked={selected.has(row.requesterUid)} onCheckedChange={(on) => toggle(row.requesterUid, on === true)}
                  aria-label={t(VIEWING_KEYS.selectRequest, { name: row.name ?? row.email ?? row.requesterUid })} />
                <section className="space-y-1">
                  <Who row={row} />
                  {row.message !== null && <blockquote className="border-s-2 ps-2 text-muted-foreground">{row.message}</blockquote>}
                  <p className="text-xs text-muted-foreground">
                    {t(VIEWING_KEYS.requestedAt, { date: formatDate(row.requestedAt) })} · {t(VIEWING_KEYS.requestedTimes, { count: row.requestCount })}
                  </p>
                </section>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function DecisionBar({ count, until, onUntil, onApprove, onDecline, allSelected, onSelectAll }: {
  readonly count: number;
  readonly until: Date | undefined;
  readonly onUntil: (date: Date | undefined) => void;
  readonly onApprove: () => void;
  readonly onDecline: () => void;
  readonly allSelected: boolean;
  readonly onSelectAll: (on: boolean) => void;
}) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  return (
    <section className="flex flex-wrap items-end gap-3">
      <Label className="flex items-center gap-2">
        <Checkbox checked={allSelected} onCheckedChange={(on) => onSelectAll(on === true)} />
        {t(VIEWING_KEYS.selectAll)}
      </Label>
      <section className="space-y-1">
        <Label htmlFor="tour-approve-until">{t(VIEWING_KEYS.approveUntil)}</Label>
        <DatePickerField id="tour-approve-until" value={until} onSelect={onUntil} placeholder={t(VIEWING_KEYS.approveUntil)}
          disabledDates={[{ before: new Date(Date.now() + DAY_MS) }, { after: new Date(Date.now() + MAX_DAYS_AHEAD * DAY_MS) }]} />
      </section>
      <Button type="button" size="sm" disabled={count === 0 || until === undefined} onClick={onApprove}>
        {t(VIEWING_KEYS.approveSelected, { count })}
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={count === 0} onClick={onDecline}>
        {t(VIEWING_KEYS.declineSelected, { count })}
      </Button>
    </section>
  );
}

function ApprovedViewers({ subject }: { readonly subject: TourSubject }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const { rows, revoke, notice } = useTourAccessRequests(subject, 'approved');
  if (rows === null) return null;
  const active = rows.filter((row) => row.standing === 'active');
  return (
    <section className="space-y-3">
      <DecisionNotice notice={notice} />
      {active.length === 0 ? <p className="text-sm text-muted-foreground">{t(VIEWING_KEYS.noApproved)}</p> : (
        <ul className="divide-y rounded-md border">
          {active.map((row) => (
            <li key={row.requesterUid} className="flex flex-wrap items-center gap-2 p-2 text-sm">
              <Who row={row} />
              {row.hasContact && <Badge variant="secondary">{t(VIEWING_KEYS.inCrm)}</Badge>}
              <span className="text-muted-foreground">
                {row.expiresAt !== null && t(VIEWING_KEYS.accessUntil, { date: formatDate(row.expiresAt) })}
                {' · '}{t(VIEWING_KEYS.viewTrace, { count: row.viewCount })}
                {row.lastViewedAt !== null && ` · ${t(VIEWING_KEYS.lastViewed, { date: formatDate(row.lastViewedAt) })}`}
              </span>
              <Button type="button" size="sm" variant="ghost" className="ms-auto" onClick={() => void revoke(row.requesterUid)}>
                {t(VIEWING_KEYS.revokeAccess)}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Τι έγινε — ανά άνθρωπο σε μαζική απόφαση, ώστε «δεν άλλαξαν 2» να φαίνεται, όχι να χάνεται. */
function DecisionNotice({ notice }: { readonly notice: TourViewingNotice | null }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  if (notice === null || notice.kind === 'saved') return null;
  if (notice.kind === 'refused' || notice.kind === 'failed') {
    return (
      <p className="text-sm text-destructive" role="alert">
        {notice.kind === 'refused' ? t(TOUR_REFUSAL_KEY[notice.result.reason]) : t(TOUR_FAILURE_KEYS.unavailable)}
      </p>
    );
  }
  const decided = notice.rows.filter((row) => row.kind === 'decided');
  const skipped = notice.rows.length - decided.length;
  const approved = decided.filter((row) => row.kind === 'decided' && row.state === 'approved').length;
  const contactUnavailable = decided.some((row) => row.kind === 'decided' && row.contact === 'unavailable');
  return (
    <section role="status" className="space-y-1 text-sm">
      {approved > 0 && <p>{t(VIEWING_KEYS.decidedApproved, { count: approved })}</p>}
      {decided.length - approved > 0 && <p>{t(VIEWING_KEYS.decidedDeclined, { count: decided.length - approved })}</p>}
      {skipped > 0 && <p className="text-muted-foreground">{t(VIEWING_KEYS.decidedSkipped, { count: skipped })}</p>}
      {contactUnavailable && <p className="text-muted-foreground">{t(VIEWING_KEYS.contactUnavailable)}</p>}
    </section>
  );
}
