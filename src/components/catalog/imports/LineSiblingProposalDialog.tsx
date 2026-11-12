'use client';

/**
 * @fileoverview **«Θέλεις να την προσθέσω;»** (ADR-923 §5.5.2 Β3 Γ11): η σύνοψη της νέας ιδιότητας που προτείνεται από την αδελφή της —
 *   τι θα δημιουργηθεί, σε ποια οικογένεια, σε ποιο επίπεδο, πού είναι υποχρεωτική — και **ένα** «Ναι». Τίποτα δεν γράφεται πριν.
 * @module components/catalog/imports/LineSiblingProposalDialog
 *
 * 🔑 Πολλές γραμμές μαζί (M + L) = μία σύνοψη, ένα «Ναι»· κάθε γραμμή γράφεται ατομικά, η μία μετά την άλλη, γιατί κάθε απόφαση
 *    ξαναχτίζει τον **ίδιο** πίνακα. Άρνηση σε μία σταματά τις επόμενες και φαίνεται δίπλα στη γραμμή της.
 * 🔑 «Επεξεργασία…» (μόνο για μία γραμμή) ανοίγει την πλήρη φόρμα με την ίδια αφετηρία.
 */

import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { FamilyRecord } from '@/services/catalog/catalog-api.client';
import { suggestAttributeFromLine } from '@/subapps/catalog/import/suggest-attribute-from-line';
import type { MeasurementRegistry } from '@/subapps/catalog/measurement/measurement-registry';
import type { SetImportLineResult } from '@/subapps/catalog/types/catalog-import-requests';
import type { ImportLineBindLevel } from '@/subapps/catalog/vocabulary/catalog-import';
import { CHANNEL_KEYS } from '../shared/catalog-labels';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { LINE_LEVEL_KEYS, useImportText } from './import-text';
import type { LineAttributeToolsProps } from './line-tool-props';
import type { SiblingProposal } from './sibling-attribute-draft';

interface Props {
  readonly proposals: readonly SiblingProposal[];
  readonly familyName: string;
  /** Το επίπεδο που μπαίνει όταν η αδελφή δεν το λέει (ενδιάμεσο επίπεδο): η πρόταση από τις τιμές της γραμμής. */
  readonly fallbackLevel: (proposal: SiblingProposal) => ImportLineBindLevel;
  readonly onClose: () => void;
  readonly onEdit: (() => void) | null;
  readonly onConfirm: () => Promise<void>;
}

function ProposalItem({ proposal, familyName, level }: { readonly proposal: SiblingProposal; readonly familyName: string; readonly level: ImportLineBindLevel }) {
  const { t } = useImportText();
  const catalog = useCatalogText();
  const { definition, requiredChannels } = proposal.create;
  const channels = requiredChannels.map((channel) => catalog.t(CHANNEL_KEYS[channel])).join(', ');
  return (
    <li className="flex flex-col gap-1 rounded-md border p-3 text-sm">
      <span className="font-medium">{t('review.lines.siblingCreates', { label: catalog.text(definition.labels), code: definition.code })}</span>
      <span className="text-muted-foreground">{t('review.lines.siblingLike', { label: catalog.text(proposal.sibling.labels), code: proposal.sibling.code })}</span>
      <span>{t('review.lines.siblingFamily', { family: familyName })}</span>
      <span>{t('review.lines.siblingLevel', { level: t(LINE_LEVEL_KEYS[level]) })}</span>
      <span>{channels === '' ? t('review.lines.siblingRequiredNone') : t('review.lines.siblingRequired', { channels })}</span>
    </li>
  );
}

/** Η απάντηση του διακομιστή λέει «έγινε»; Οτιδήποτε άλλο (άρνηση · αποτυχία μεταφοράς) σταματά τη μαζική πράξη. */
const settled = (result: unknown): boolean =>
  typeof result === 'object' && result !== null && 'outcome' in result && (result as SetImportLineResult).outcome.kind === 'settled';

interface StepProps {
  readonly proposals: readonly SiblingProposal[];
  readonly family: FamilyRecord;
  readonly registry: MeasurementRegistry;
  readonly onCreate: LineAttributeToolsProps['onCreate'];
  readonly onEdit: (() => void) | null;
  readonly onClose: () => void;
}

/** Η σύνοψη με τη ροή της: «Ναι» γράφει κάθε γραμμή με τη σειρά· η πρώτη άρνηση σταματά τις επόμενες. */
export function LineSiblingStep({ proposals, family, registry, onCreate, onEdit, onClose }: StepProps) {
  const { text } = useCatalogText();
  const fallbackLevel = (proposal: SiblingProposal) => suggestAttributeFromLine(proposal.line, registry).level;
  const confirm = async () => {
    for (const proposal of proposals) {
      const result = await onCreate(proposal.line, proposal.create, proposal.level ?? fallbackLevel(proposal));
      if (!settled(result)) break;
    }
    onClose();
  };
  return (
    <LineSiblingProposalDialog proposals={proposals} familyName={text(family.labels, family.code)} fallbackLevel={fallbackLevel}
      onClose={onClose} onEdit={onEdit} onConfirm={confirm} />
  );
}

export function LineSiblingProposalDialog({ proposals, familyName, fallbackLevel, onClose, onEdit, onConfirm }: Props) {
  const { t } = useImportText();
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('review.lines.siblingTitle', { count: proposals.length })}</DialogTitle>
          <DialogDescription>{t('review.lines.siblingLead')}</DialogDescription>
        </DialogHeader>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {proposals.map((proposal) => (
            <ProposalItem key={proposal.create.definition.code} proposal={proposal} familyName={familyName} level={proposal.level ?? fallbackLevel(proposal)} />
          ))}
        </ul>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>{t('review.lines.cancel')}</Button>
          {onEdit ? <Button type="button" variant="outline" disabled={busy} onClick={onEdit}>{t('review.lines.siblingEdit')}</Button> : null}
          <Button type="button" disabled={busy} onClick={() => void confirm()}>{t('review.lines.siblingConfirm', { count: proposals.length })}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
