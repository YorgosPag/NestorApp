/**
 * =============================================================================
 * ActiveShareLinkRow — ένας ενεργός σύνδεσμος στη λίστα του κατόχου (ADR-315 §5)
 * =============================================================================
 *
 * Τι δείχνει (πρότυπο Drive «Manage access» + DocSend «All Links», και πέρα από αυτά):
 * ετικέτα «για ποιον» · δημιουργός + πότε · λήξη · 🔒 κωδικός · ανοίγματα `N / όριο` ·
 * τελευταίο άνοιγμα · **εξαντλημένος** · **κλειδωμένος από λάθος κωδικούς** (κανένας από τους
 * μεγάλους δεν δείχνει στον κάτοχο ότι ο σύνδεσμός του δέχεται επίθεση μαντέματος).
 *
 * Ενέργειες: «Ρυθμίσεις» (ίδιο URL — Α13) · «Ανάκληση». Καθαρά παρουσιαστικό: την κατάσταση
 * και τις κλήσεις τις κρατά η λίστα.
 *
 * @module components/sharing/link-management/ActiveShareLinkRow
 */

'use client';

import React from 'react';
import { Ban, Eye, Link2, Lock, Settings2, ShieldAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDeadlineRelative, formatRelativeTime } from '@/lib/intl-formatting';
import { cn } from '@/lib/utils';
import type { ShareLinkSummary } from '@/types/sharing';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

export interface ActiveShareLinkRowProps {
  readonly link: ShareLinkSummary;
  /** Ο σύνδεσμος που μόλις γεννήθηκε σε αυτή τη συνεδρία του διαλόγου. */
  readonly isCurrent: boolean;
  readonly busy: boolean;
  readonly onEdit: (link: ShareLinkSummary) => void;
  readonly onRevoke: (link: ShareLinkSummary) => void;
  /** Η φόρμα ρυθμίσεων, όταν ο σύνδεσμος είναι σε επεξεργασία — αποδίδεται μέσα στη γραμμή. */
  readonly children?: React.ReactNode;
}

function useRowFacts(link: ShareLinkSummary): readonly string[] {
  const { t } = useTranslation(['files', 'files-media']);
  const creator = link.createdBy.name ?? t('share.links.unknownCreator');
  const facts = [
    link.createdAt
      ? t('share.links.createdByWhen', { name: creator, when: formatRelativeTime(link.createdAt) })
      : creator,
    t('share.links.expires', { when: formatDeadlineRelative(link.expiresAt) }),
    link.maxAccesses > 0
      ? t('share.links.opensOf', { count: link.accessCount, max: link.maxAccesses })
      : t('share.links.opens', { count: link.accessCount }),
    link.lastAccessedAt
      ? t('share.links.lastOpened', { when: formatRelativeTime(link.lastAccessedAt) })
      : t('share.links.neverOpened'),
  ];
  return facts;
}

function StateBadges({ link, isCurrent }: Pick<ActiveShareLinkRowProps, 'link' | 'isCurrent'>): React.ReactElement {
  const { t } = useTranslation(['files', 'files-media']);
  return (
    <>
      {isCurrent && <Badge variant="secondary">{t('share.links.thisLink')}</Badge>}
      {link.requiresPassword && (
        <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" />{t('share.passwordProtected')}</Badge>
      )}
      {link.state === 'exhausted' && (
        <Badge variant="outline" className="gap-1"><Ban className="h-3 w-3" />{t('share.links.stateExhausted')}</Badge>
      )}
      {link.state === 'locked' && link.lockedUntil && (
        <Badge variant="destructive" className="gap-1" aria-describedby={`lock-hint-${link.shareId}`}>
          <ShieldAlert className="h-3 w-3" />
          {t('share.links.stateLocked', { when: formatDeadlineRelative(link.lockedUntil) })}
        </Badge>
      )}
    </>
  );
}

export function ActiveShareLinkRow({
  link, isCurrent, busy, onEdit, onRevoke, children,
}: ActiveShareLinkRowProps): React.ReactElement {
  const { t } = useTranslation(['files', 'files-media']);
  const colors = useSemanticColors();
  const facts = useRowFacts(link);
  const title = link.label ?? t('share.links.unlabeled');

  return (
    <li className={cn('flex flex-col gap-2 rounded-md border p-3', isCurrent && 'border-primary/40', busy && 'opacity-60')}>
      <header className="flex flex-wrap items-center gap-2">
        <Link2 className={cn('h-4 w-4 shrink-0', colors.text.muted)} aria-hidden="true" />
        <strong className={cn('text-sm font-medium', !link.label && colors.text.muted)}>{title}</strong>
        <StateBadges link={link} isCurrent={isCurrent} />
      </header>
      <p className={cn('flex flex-wrap gap-x-3 gap-y-1 text-xs', colors.text.muted)}>
        {facts.map((fact) => <span key={fact}>{fact}</span>)}
      </p>
      {link.state === 'locked' && (
        <p id={`lock-hint-${link.shareId}`} className="flex items-center gap-1 text-xs text-destructive">
          <Eye className="h-3 w-3" aria-hidden="true" />
          {t('share.links.lockedHint')}
        </p>
      )}
      <nav className="flex justify-end gap-2" aria-label={t('share.links.actionsFor', { label: title })}>
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onEdit(link)}>
          <Settings2 className="h-4 w-4 mr-1" />{t('share.links.settings')}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => onRevoke(link)}>
          <Ban className="h-4 w-4 mr-1" />{t('share.links.revoke')}
        </Button>
      </nav>
      {children}
    </li>
  );
}
