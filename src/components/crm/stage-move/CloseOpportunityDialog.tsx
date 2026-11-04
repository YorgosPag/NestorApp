'use client';

/**
 * @fileoverview **Ο διάλογος κλεισίματος ευκαιρίας** — όταν η κάρτα πέφτει σε «Κλειστό» (ADR-929).
 * @module components/crm/stage-move/CloseOpportunityDialog
 *
 * Πρακτική HubSpot/Pipedrive: επιτυχία ⇒ τελικό ποσό + ημερομηνία (προσυμπληρωμένα, επεξεργάσιμα)· απώλεια ⇒ λόγος
 * από **κατάλογο** + προαιρετικό σχόλιο. Άκυρο / Esc / κλικ έξω ⇒ `onAnswer(null)` ⇒ η κάρτα γυρίζει πίσω.
 * Οι ίδιοι κανόνες επικυρώνονται και στον server (zod + πυρήνας) — εδώ είναι μόνο για άμεση ανατροφοδότηση.
 */

import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  LOST_REASON_NOTE_MAX,
  lostReasonCatalogKey,
  OPPORTUNITY_LOST_REASONS,
  type OpportunityLostReason,
} from '@/config/crm/opportunity-lost-reasons';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { todayLocalDate } from '@/lib/date-local';
import type { Opportunity } from '@/types/crm';
import type { ClosingKind, ClosingRequest } from './useStageDialogs';

interface CloseOpportunityDialogProps {
  readonly opportunity: Opportunity;
  readonly closing: ClosingKind;
  readonly onAnswer: (answer: ClosingRequest | null) => void;
}

function WonFields({ value, date, onValue, onDate }: {
  readonly value: string; readonly date: string; readonly onValue: (v: string) => void; readonly onDate: (v: string) => void;
}) {
  const { t } = useTranslation('crm');
  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <Label htmlFor="close-final-value">{t('pipeline.close.finalValue')}</Label>
      <Input id="close-final-value" type="number" inputMode="decimal" min={1} value={value} onChange={(e) => onValue(e.target.value)} required />
      <Label htmlFor="close-date">{t('pipeline.close.closeDate')}</Label>
      <Input id="close-date" type="date" value={date} max={todayLocalDate()} onChange={(e) => onDate(e.target.value)} required />
    </fieldset>
  );
}

function LostFields({ reason, note, onReason, onNote }: {
  readonly reason: OpportunityLostReason | ''; readonly note: string;
  readonly onReason: (v: OpportunityLostReason) => void; readonly onNote: (v: string) => void;
}) {
  const { t } = useTranslation('crm');
  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <Label htmlFor="close-lost-reason">{t('pipeline.close.lostReason')}</Label>
      <Select value={reason || undefined} onValueChange={(v) => onReason(v as OpportunityLostReason)}>
        <SelectTrigger id="close-lost-reason"><SelectValue placeholder={t('pipeline.close.lostReasonPlaceholder')} /></SelectTrigger>
        <SelectContent>
          {OPPORTUNITY_LOST_REASONS.map((id) => (
            <SelectItem key={id} value={id}>{t(`opportunities.lostReasons.${lostReasonCatalogKey(id)}`)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Label htmlFor="close-lost-note">{t('pipeline.close.lostNote')}</Label>
      <Textarea id="close-lost-note" value={note} maxLength={LOST_REASON_NOTE_MAX} onChange={(e) => onNote(e.target.value)} />
    </fieldset>
  );
}

/** Το αίτημα που βγαίνει από τη φόρμα — ή `null` όσο λείπει κάτι υποχρεωτικό. */
function requestOf(closing: ClosingKind, form: { value: string; date: string; reason: OpportunityLostReason | ''; note: string }): ClosingRequest | null {
  if (closing === 'won') {
    const finalValue = Number(form.value);
    return Number.isFinite(finalValue) && finalValue > 0 && form.date ? { kind: 'won', finalValue, closedOn: form.date } : null;
  }
  return form.reason ? { kind: 'lost', lostReason: form.reason, lostReasonNote: form.note.trim() || undefined } : null;
}

export function CloseOpportunityDialog({ opportunity, closing, onAnswer }: CloseOpportunityDialogProps) {
  const { t } = useTranslation('crm');
  const [value, setValue] = useState(opportunity.estimatedValue ? String(opportunity.estimatedValue) : '');
  const [date, setDate] = useState(todayLocalDate());
  const [reason, setReason] = useState<OpportunityLostReason | ''>('');
  const [note, setNote] = useState('');
  const request = requestOf(closing, { value, date, reason, note });
  const name = opportunity.fullName || opportunity.title;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onAnswer(null); }}>
      <DialogContent>
        <form onSubmit={(e) => { e.preventDefault(); if (request) onAnswer(request); }} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t(closing === 'won' ? 'pipeline.close.wonTitle' : 'pipeline.close.lostTitle')}</DialogTitle>
            <DialogDescription>{t('pipeline.close.description', { name })}</DialogDescription>
          </DialogHeader>
          {closing === 'won'
            ? <WonFields value={value} date={date} onValue={setValue} onDate={setDate} />
            : <LostFields reason={reason} note={note} onReason={setReason} onNote={setNote} />}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onAnswer(null)}>{t('pipeline.close.cancel')}</Button>
            <Button type="submit" disabled={!request}>{t(closing === 'won' ? 'pipeline.close.confirmWon' : 'pipeline.close.confirmLost')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
