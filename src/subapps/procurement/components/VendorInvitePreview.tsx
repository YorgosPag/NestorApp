'use client';

/**
 * @fileoverview **«Προεπισκόπηση ως: <παραλήπτης>» — το email όπως θα το λάβει** (ADR-327 §7.5).
 * @module subapps/procurement/components/VendorInvitePreview
 *
 * Το HTML έρχεται από τον server (ίδιος composer με την αποστολή) και αποδίδεται σε `<iframe sandbox>`:
 * κανένα script, καμία πλοήγηση (`pointer-events-none`· ο σύνδεσμος είναι δείγμα), και τα styles του email
 * δεν διαρρέουν στην εφαρμογή. Κάθε παραλήπτης μπορεί να έχει **άλλη γλώσσα** — γι' αυτό διαλέγεις «ως ποιον».
 */

import { useId, useState } from 'react';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Translate } from '@/i18n/hooks/useTranslation';

import { useVendorInvitePreview, type VendorInvitePreviewState } from '../hooks/useVendorInvitePreview';
import type { VendorInvitePreviewRecipient } from '../types/vendor-invite-preview';

export interface VendorInvitePreviewOption {
  /** Σταθερό κλειδί του παραλήπτη στην παρτίδα (`contact:<id>` / `adhoc:<email>`). */
  readonly key: string;
  readonly label: string;
  readonly recipient: VendorInvitePreviewRecipient;
}

export interface VendorInvitePreviewProps {
  readonly rfqId: string;
  readonly options: readonly VendorInvitePreviewOption[];
  readonly expiresOn: string;
  readonly buyerNote: string;
  readonly t: Translate;
}

function PreviewBody({ state, t }: { state: VendorInvitePreviewState; t: Translate }) {
  if (state.kind === 'failed') return <p className="p-3 text-sm text-destructive" role="alert">{t('rfqs.invite.preview.failed')}</p>;
  const data = state.kind === 'ready' ? state.data : state.kind === 'loading' ? state.last : null;
  if (data === null) return <p className="p-3 text-sm text-muted-foreground">{t('rfqs.invite.preview.loading')}</p>;
  return (
    <>
      <p className="border-b px-3 py-2 text-sm">
        <span className="text-muted-foreground">{t('rfqs.invite.preview.subject')}: </span>
        <strong>{data.subject}</strong>
      </p>
      <iframe
        // Προσβάσιμο όνομα πλαισίου με `aria-label`, όχι `title` (CHECK 3.23: χωρίς native tooltip).
        aria-label={t('rfqs.invite.preview.frameTitle')}
        sandbox=""
        srcDoc={data.html}
        className="pointer-events-none h-96 w-full"
        aria-busy={state.kind === 'loading'}
      />
    </>
  );
}

export function VendorInvitePreview({ rfqId, options, expiresOn, buyerNote, t }: VendorInvitePreviewProps) {
  const selectId = useId();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = options.find((option) => option.key === selectedKey) ?? options[0] ?? null;
  const state = useVendorInvitePreview(rfqId, selected === null ? null : { recipient: selected.recipient, expiresOn, buyerNote });

  return (
    <section className="space-y-1.5" aria-labelledby={`${selectId}-heading`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`${selectId}-heading`} className="text-sm font-medium">{t('rfqs.invite.preview.title')}</h3>
        {options.length > 1 && selected !== null && (
          <span className="flex items-center gap-2">
            <Label htmlFor={selectId} className="text-xs text-muted-foreground">{t('rfqs.invite.preview.as')}</Label>
            <Select value={selected.key} onValueChange={setSelectedKey}>
              <SelectTrigger id={selectId} className="h-8 w-56 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </span>
        )}
      </header>
      <figure className="overflow-hidden rounded-md border">
        {selected === null
          ? <p className="p-3 text-sm text-muted-foreground">{t('rfqs.invite.preview.empty')}</p>
          : <PreviewBody state={state} t={t} />}
      </figure>
    </section>
  );
}
