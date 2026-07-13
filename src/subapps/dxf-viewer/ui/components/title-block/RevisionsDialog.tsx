'use client';

/**
 * ADR-651 Φάση Η — διάλογος **«Αναθεωρήσεις Σχεδίου»** (Απόφαση #9).
 *
 * Τρία μέρη, με τη σειρά της ροής:
 *  1. **Ιστορία** — ο πίνακας αναθεωρήσεων του έργου (αρ. / ημερομηνία / περιγραφή / συντάκτης).
 *     Ο ΙΔΙΟΣ πίνακας τυπώνεται και στην πινακίδα (`{{revision.*}}`) — μία πηγή, μηδέν διπλή
 *     καταχώρηση (§7 must-have #4).
 *  2. **«Τι άλλαξε;»** — ο **ντετερμινιστικός** diff (τον μετράει ο κώδικας) + η **πρόταση**
 *     περιγραφής του AI (τη γράφει το μοντέλο). Το AI **δεν** καταχωρεί ποτέ μόνο του.
 *  3. **Έγκριση** — ο χρήστης διορθώνει την περιγραφή και καταχωρεί· ο **αριθμός** και η
 *     **ημερομηνία** μπαίνουν μόνα τους (ντετερμινιστικά).
 *
 * Controlled Radix Dialog, ίδιο μοτίβο με το `AiTitleBlockDialog`. Καμία hardcoded string
 * (N.11): όλα από `revisions.*`. ADR-040: μηδέν canvas subscriptions.
 *
 * @see ./useRevisions.ts — το state της ροής
 * @see ../../../app/RevisionsHost.tsx — ο lifecycle owner (EventBus gate)
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { toShortDate } from '../../../text-engine/templates/resolver/resolver';
import { toTitleBlockLocale } from '../../../text-engine/title-block/title-block-presets';
import { useRevisions } from './useRevisions';
import type {
  DrawingRevisionSummary,
  RevisionDiff,
  RevisionSheetChange,
} from '../../../text-engine/title-block/revisions/revision.types';

export interface RevisionsDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (next: boolean) => void;
  readonly projectId?: string;
}

/** Ο πίνακας αναθεωρήσεων — ό,τι ακριβώς τυπώνεται και στην πινακίδα. */
function RevisionHistory({
  revisions,
}: {
  readonly revisions: readonly DrawingRevisionSummary[];
}): React.JSX.Element {
  const { t, i18n } = useTranslation('dxf-viewer-shell');
  const formatting = { locale: toTitleBlockLocale(i18n.language) };
  if (revisions.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('revisions.history.empty')}</p>;
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-muted-foreground">
          <th className="pb-1 pr-3">{t('revisions.history.number')}</th>
          <th className="pb-1 pr-3">{t('revisions.history.date')}</th>
          <th className="pb-1 pr-3">{t('revisions.history.description')}</th>
          <th className="pb-1">{t('revisions.history.author')}</th>
        </tr>
      </thead>
      <tbody>
        {revisions.map((revision) => (
          <tr key={revision.id} className="border-t border-border align-top">
            <td className="py-1 pr-3 font-medium">{revision.number}</td>
            <td className="py-1 pr-3 whitespace-nowrap">
              {toShortDate(new Date(revision.issuedAt), formatting)}
            </td>
            <td className="py-1 pr-3 [overflow-wrap:anywhere]">{revision.description}</td>
            <td className="py-1 whitespace-nowrap">{revision.authorName}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** `{ wall: 3 }` → «wall×3» (κενό ⇒ τίποτα). */
function countsLabel(counts: Readonly<Record<string, number>>): string {
  return Object.entries(counts)
    .map(([type, count]) => `${type}×${count}`)
    .join(', ');
}

function SheetChangeRow({ sheet }: { readonly sheet: RevisionSheetChange }): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  return (
    <li className="flex flex-col gap-0.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{sheet.title}</span>
        {sheet.isNew && <Badge variant="secondary">{t('revisions.diff.newSheet')}</Badge>}
        {sheet.coarse && <Badge variant="outline">{t('revisions.diff.coarse')}</Badge>}
      </div>
      <p className="text-xs text-muted-foreground">
        {[
          countsLabel(sheet.added) && `${t('revisions.diff.added')}: ${countsLabel(sheet.added)}`,
          countsLabel(sheet.removed) && `${t('revisions.diff.removed')}: ${countsLabel(sheet.removed)}`,
          countsLabel(sheet.modified) && `${t('revisions.diff.modified')}: ${countsLabel(sheet.modified)}`,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </li>
  );
}

/** Τι άλλαξε — ντετερμινιστικά (ο κώδικας μέτρησε, όχι το AI). */
function DiffPanel({ diff }: { readonly diff: RevisionDiff }): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  const changed = diff.sheets.filter((sheet) => sheet.changed);

  return (
    <section className="flex flex-col gap-2 rounded border border-border bg-card p-3">
      <h3 className="text-xs font-medium text-muted-foreground">{t('revisions.diff.title')}</h3>
      {diff.baseline ? (
        <p className="text-sm">{t('revisions.diff.baseline')}</p>
      ) : !diff.hasChanges ? (
        <p className="text-sm">{t('revisions.diff.noChanges')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {changed.map((sheet) => (
            <SheetChangeRow key={sheet.levelId} sheet={sheet} />
          ))}
          {diff.removedSheets.length > 0 && (
            <li className="text-sm">
              {t('revisions.diff.removedSheets')}: {diff.removedSheets.join(', ')}
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

export function RevisionsDialog({
  open,
  onOpenChange,
  projectId,
}: RevisionsDialogProps): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  const revisions = useRevisions(projectId);
  const busy = revisions.analyzing || revisions.submitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('revisions.title')}</DialogTitle>
          <DialogDescription>{t('revisions.description')}</DialogDescription>
        </DialogHeader>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">{t('revisions.history.title')}</h3>
          <RevisionHistory revisions={revisions.revisions} />
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">
              {t('revisions.next.title', { number: revisions.nextNumber })}
            </h3>
            <Badge variant="secondary">
              {t('revisions.next.sheets', { count: revisions.sheetCount })}
            </Badge>
          </div>
          <Button variant="outline" onClick={() => void revisions.analyze()} disabled={busy}>
            {revisions.analyzing ? t('revisions.analyze.running') : t('revisions.analyze.action')}
          </Button>
          <p className="text-xs text-muted-foreground">{t('revisions.analyze.hint')}</p>
        </section>

        {revisions.errorKey && (
          <p role="alert" className="text-sm text-destructive">
            {t(`revisions.errors.${revisions.errorKey}`)}
          </p>
        )}

        {revisions.diff && <DiffPanel diff={revisions.diff} />}

        {revisions.highlights.length > 0 && (
          <ul className="flex flex-col gap-1">
            {revisions.highlights.map((highlight, index) => (
              <li key={index} className="text-sm text-muted-foreground">
                • {highlight}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-1">
          <Label htmlFor="revision-description">{t('revisions.form.description')}</Label>
          <Textarea
            id="revision-description"
            value={revisions.description}
            onChange={(event) => revisions.setDescription(event.target.value)}
            placeholder={t('revisions.form.placeholder')}
            rows={3}
            disabled={busy}
          />
          <p className="text-xs text-muted-foreground">{t('revisions.form.hint')}</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('revisions.close')}
          </Button>
          <Button
            onClick={() => void revisions.submit()}
            disabled={busy || !revisions.description.trim() || !projectId}
          >
            {revisions.submitting ? t('revisions.submitting') : t('revisions.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
