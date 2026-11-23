'use client';

/**
 * @fileoverview Η λωρίδα **«Προτάθηκε από το ΓΕΜΗ»** μέσα στον editor της έδρας (ADR-948 §8 Βήμα 7 · ADR-332).
 * @module components/contacts/dynamic/HqAddressProposalNotice
 *
 * Λέει **από πού** και **πότε** ήρθε το κείμενο, ζητά επιβεβαίωση της θέσης στον χάρτη, και προσφέρει
 * **ακριβή** αναίρεση (η έδρα όπως ήταν, με τη θέση της) ή «Κράτα» (κλείνει τη λωρίδα).
 */

import React from 'react';

import { HQ_ADDRESS_PROPOSAL_KEYS as KEYS } from '@/components/contacts/contact-company-registry-labels';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';

import type { AppliedHqAddressProposal } from './use-hq-address-proposal-intake';

interface HqAddressProposalNoticeProps {
  readonly applied: AppliedHqAddressProposal;
  readonly onUndo: () => void;
  readonly onKeep: () => void;
}

export function HqAddressProposalNotice({ applied, onUndo, onKeep }: HqAddressProposalNoticeProps) {
  const { t } = useTranslation('contacts-form');
  return (
    <aside className="flex flex-wrap items-center gap-2 rounded-md border bg-muted p-2" role="status">
      <p className="m-0 flex-1 text-xs text-foreground">
        {applied.proposal.origin.kind === 'document'
          ? t(KEYS.noticeDocument, { fileName: applied.proposal.origin.fileName, date: formatDate(applied.proposal.observedAt) })
          : t(KEYS.notice, { date: formatDate(applied.proposal.observedAt) })}
      </p>
      <Button type="button" variant="ghost" size="sm" onClick={onKeep}>{t(KEYS.keep)}</Button>
      <Button type="button" variant="outline" size="sm" onClick={onUndo}>{t(KEYS.undo)}</Button>
    </aside>
  );
}
