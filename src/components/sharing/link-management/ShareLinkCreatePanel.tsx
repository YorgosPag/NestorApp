/**
 * =============================================================================
 * ShareLinkCreatePanel — «Δημιουργία & αντιγραφή συνδέσμου» (ADR-315 Α11 · Α14)
 * =============================================================================
 *
 * Δύο καταστάσεις του ίδιου πάνελ:
 *   1. **Πριν** τον σύνδεσμο: «Για ποιον;» + (πτυσσόμενες) ρυθμίσεις + **ένα** κύριο κουμπί που
 *      γεννά **και** αντιγράφει (Dropbox «Copy link» / Box «Create and Copy Shared Link»).
 *   2. **Μετά**: ο σύνδεσμος σε πεδίο μόνο-ανάγνωσης με «Αντιγραφή» και η ρητή προειδοποίηση ότι
 *      **δεν θα ξαναεμφανιστεί** (πρότυπο GitHub PAT / Stripe keys — ο διακομιστής κρατά μόνο
 *      το αποτύπωμα) + «Νέος σύνδεσμος για άλλον παραλήπτη».
 *
 * @module components/sharing/link-management/ShareLinkCreatePanel
 */

'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Link2, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { LinkLabelField, LinkTokenFields } from '@/components/ui/sharing/panels/link-token/LinkTokenForm';
import type { LinkTokenDraft } from '@/components/ui/sharing/panels/link-token/types';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { ShareKindLinkPolicy } from '@/services/sharing/share-resolve-contract';
import type { MintedShare } from './useLinkMint';

export interface ShareLinkCreatePanelProps {
  readonly draft: LinkTokenDraft;
  readonly onDraftChange: (next: LinkTokenDraft) => void;
  /** Καλείται **συγχρόνως** από το κλικ — η αντιγραφή χρειάζεται φρέσκια χειρονομία. */
  readonly onCreateAndCopy: () => void;
  readonly minting: boolean;
  /** ADR-884 Κ3β — η πολιτική συνδέσμου του είδους (κρύβει κωδικό · απαιτεί «για ποιον»). */
  readonly policy?: ShareKindLinkPolicy;
}

export function ShareLinkCreatePanel({
  draft, onDraftChange, onCreateAndCopy, minting, policy,
}: ShareLinkCreatePanelProps): React.ReactElement {
  const missingLabel = policy?.labelRequired === true && draft.label.trim() === '';
  const { t } = useTranslation(['files', 'common', 'files-media']);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <section className="flex flex-col gap-3" aria-labelledby="share-link-create-title">
      <h3 id="share-link-create-title" className="sr-only">{t('share.createAndCopy')}</h3>
      <LinkLabelField draft={draft} onDraftChange={onDraftChange} policy={policy} />
      <section className={cn('border rounded-lg overflow-hidden', settingsOpen && 'border-primary/40')}>
        <button
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
          aria-expanded={settingsOpen}
        >
          <span>{t('common:share.linkSettings')}</span>
          {settingsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {settingsOpen && (
          <fieldset className="flex flex-col gap-4 p-3 border-t bg-muted/20">
            <LinkTokenFields draft={draft} onDraftChange={onDraftChange} mode="create" policy={policy} />
          </fieldset>
        )}
      </section>
      <Button type="button" onClick={onCreateAndCopy} disabled={minting || missingLabel} className="w-full">
        {minting ? <Spinner size="small" color="inherit" className="mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
        {t('share.createAndCopy')}
      </Button>
    </section>
  );
}

export interface MintedLinkCardProps {
  readonly minted: MintedShare;
  readonly onCopy: () => void;
  readonly onStartOver: () => void;
}

export function MintedLinkCard({ minted, onCopy, onStartOver }: MintedLinkCardProps): React.ReactElement {
  const { t } = useTranslation(['files', 'files-media']);
  const colors = useSemanticColors();
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-primary/40 p-3" aria-labelledby="share-link-minted-title">
      <h3 id="share-link-minted-title" className="text-sm font-semibold">{t('share.created')}</h3>
      <span className="flex gap-2">
        <Input readOnly value={minted.url} aria-label={t('share.linkUrl')} onFocus={(e) => e.currentTarget.select()} />
        <Button type="button" variant="outline" onClick={onCopy}>
          <Copy className="h-4 w-4 mr-1" />{t('share.copy')}
        </Button>
      </span>
      <p className={cn('text-xs', colors.text.muted)}>{t('share.shownOnce')}</p>
      <Button type="button" variant="ghost" size="sm" className="self-start" onClick={onStartOver}>
        <Plus className="h-4 w-4 mr-1" />{t('share.newLink')}
      </Button>
    </section>
  );
}
