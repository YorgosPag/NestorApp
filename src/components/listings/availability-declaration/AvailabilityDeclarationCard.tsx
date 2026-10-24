'use client';

/**
 * **Η ΚΑΡΤΑ ΤΗΣ ΔΗΜΟΣΙΑΣ ΥΠΟΣΧΕΣΗΣ** — μία για κτίριο («Δημόσια υπόσχεση παράδοσης») και μονάδα («Διαθέσιμο από»).
 *
 * @related ADR-919 §11 · ADR-777 §8.99.4 Δ1 · ADR-842 Α7
 *
 * 🔑 **Δ1 σε μοτίβο Figma**: η πρόταση του χρονοδιαγράμματος εμφανίζεται ως **φάντασμα τιμής** με «Αποδοχή και
 * δημοσίευση» — ποτέ ως σιωπηλή προσυμπλήρωση. Ο άνθρωπος εγκρίνει, και τότε γράφεται `inferred` + `confirmedAt`.
 *
 * 🔑 **Ρητή πράξη, ξεχωριστή από τη φόρμα**: η υπόσχεση είναι **δημόσια δέσμευση** με δική της ιστορία (μετράει
 * μεταθέσεις, ειδοποιεί ζητούντες, βήμα 6). Δεν γράφεται «παρεμπιπτόντως» με την αυτόματη αποθήκευση άλλων πεδίων.
 */

import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarDate } from '@/lib/intl-formatting';
import { getCurrentLocale } from '@/lib/intl-utils';
import { initialDraft, isSameDeclaration } from '@/lib/listings/availability-declaration-draft';
import type { AvailabilityDeclarationIntent } from '@/lib/listings/availability-declaration-write';
import { isPubliclyPresentable } from '@/lib/property/attribute-provenance';
import type { AvailabilityDeclaration } from '@/types/listing-availability';
import { AvailabilityDeclarationEditor, useDraftPhrase } from './AvailabilityDeclarationEditor';
import type { AvailabilityDeclarationSave, DeclarationSaveStatus, StoredDeclaration } from './useAvailabilityDeclarationSave';

const NS = ['building', 'common-shared'];

export interface DeclarationProposal {
  readonly declaration: AvailabilityDeclaration;
  readonly isLowerBound: boolean;
}

interface AvailabilityDeclarationCardProps {
  readonly idPrefix: string;
  readonly title: string;
  readonly hint: string;
  /** Η αποθήκευση — στον γονέα, ώστε ό,τι κρίνει την υπόσχεση (σύγκριση, πρόταση) να βλέπει την ΙΔΙΑ αισιόδοξη τιμή. */
  readonly save: AvailabilityDeclarationSave;
  readonly today: string;
  readonly proposal?: DeclarationProposal | null;
  /** Η εσωτερική σύγκριση σχεδίου · πρόβλεψης · υπόσχεσης (μόνο κτίριο). */
  readonly schedule?: React.ReactNode;
}

const STATUS_KEYS: Readonly<Record<Exclude<DeclarationSaveStatus, 'idle'>, string>> = {
  saving: 'building:availabilityPromise.saving',
  saved: 'building:availabilityPromise.saved',
  failed: 'building:availabilityPromise.saveFailed',
};

function PublishedStatus({ stored }: { readonly stored: StoredDeclaration }) {
  const { t } = useTranslation(NS);
  const phrase = useDraftPhrase(stored?.value ?? { precision: 'quarter', anchor: '' });
  if (stored === null || phrase === null) return <p className="text-sm">{t('building:availabilityPromise.currentNone')}</p>;
  if (!isPubliclyPresentable(stored)) return <p className="text-sm">{t('building:availabilityPromise.currentPending')}</p>;
  const date = formatCalendarDate(stored.at.slice(0, 10), getCurrentLocale());
  const originKey = stored.provenance === 'inferred' ? 'building:availabilityPromise.origin.schedule' : 'building:availabilityPromise.origin.declared';
  return (
    <p className="text-sm">
      <strong className="font-medium">{t('building:availabilityPromise.current', { promise: phrase })}</strong>
      <span className="ml-2 text-muted-foreground">{t(originKey, { date })}</span>
    </p>
  );
}

interface ProposalCalloutProps {
  readonly proposal: DeclarationProposal;
  readonly busy: boolean;
  readonly onAccept: () => void;
  readonly onEdit: () => void;
}

function ProposalCallout({ proposal, busy, onAccept, onEdit }: ProposalCalloutProps) {
  const { t } = useTranslation(NS);
  const phrase = useDraftPhrase(proposal.declaration);
  if (phrase === null) return null;
  return (
    <aside className="flex flex-col gap-2 rounded-md border border-dashed p-2">
      <p className="text-sm font-medium">{t('building:availabilityPromise.proposal.title', { promise: phrase })}</p>
      {proposal.isLowerBound && <p className="text-xs text-muted-foreground">{t('building:availabilityPromise.proposal.lowerBound')}</p>}
      <nav className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onAccept} disabled={busy}>{t('building:availabilityPromise.proposal.accept')}</Button>
        <Button type="button" size="sm" variant="outline" onClick={onEdit} disabled={busy}>{t('building:availabilityPromise.proposal.edit')}</Button>
      </nav>
    </aside>
  );
}

function intentOf(draft: AvailabilityDeclaration, proposal: DeclarationProposal | null | undefined): AvailabilityDeclarationIntent {
  const fromSchedule = proposal != null && isSameDeclaration(draft, proposal.declaration);
  return fromSchedule
    ? { ...draft, origin: 'schedule-proposal', isLowerBound: proposal.isLowerBound }
    : { ...draft, origin: 'declared' };
}

export function AvailabilityDeclarationCard(props: AvailabilityDeclarationCardProps) {
  const { t } = useTranslation(NS);
  const { stored, status, commit } = props.save;
  const [draft, setDraft] = useState(() => initialDraft(stored?.value ?? null, props.proposal?.declaration ?? null, props.today));
  const busy = status === 'saving';
  const unchanged = stored !== null && isPubliclyPresentable(stored) && isSameDeclaration(stored.value, draft);
  const proposal = props.proposal ?? null;
  return (
    <Card>
      <CardHeader className="p-2"><CardTitle className="text-base">{props.title}</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3 p-2 pt-0">
        <p className="text-xs text-muted-foreground">{props.hint}</p>
        <PublishedStatus stored={stored} />
        {props.schedule}
        {proposal !== null && (
          <ProposalCallout proposal={proposal} busy={busy} onEdit={() => setDraft(proposal.declaration)}
            onAccept={() => { setDraft(proposal.declaration); void commit(intentOf(proposal.declaration, proposal)); }} />
        )}
        <AvailabilityDeclarationEditor idPrefix={props.idPrefix} draft={draft} onDraftChange={setDraft} today={props.today} disabled={busy} />
        <footer className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={() => void commit(intentOf(draft, proposal))} disabled={busy || unchanged}>{t('building:availabilityPromise.publish')}</Button>
          {stored !== null && <Button type="button" size="sm" variant="outline" onClick={() => void commit(null)} disabled={busy}>{t('building:availabilityPromise.withdraw')}</Button>}
          <span className="text-xs text-muted-foreground" role="status" aria-live="polite">{status === 'idle' ? '' : t(STATUS_KEYS[status])}</span>
        </footer>
        <p className="text-xs text-muted-foreground">{t('building:availabilityPromise.privacyNote')}</p>
      </CardContent>
    </Card>
  );
}
