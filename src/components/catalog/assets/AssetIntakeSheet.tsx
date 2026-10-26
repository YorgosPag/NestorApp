'use client';

/**
 * @fileoverview **«Νέα μέσα»** — ρίψη πολλών αρχείων, μία γραμμή ανά αρχείο, **μία** δήλωση δικαιωμάτων για όλη τη δέσμη
 *   (ADR-923 §5.10.4).
 * @related asset-intake-model.ts · use-asset-intake.ts · components/shared/media-rights/MediaRightsFields.tsx
 * @module components/catalog/assets/AssetIntakeSheet
 *
 * 🔑 **Χωρίς συμπίεση, ποτέ**: τα bytes φεύγουν όπως τα έδωσε ο προμηθευτής. Η κοινή ζώνη ανεβάσματος της πλατφόρμας
 *    συμπιέζει εικόνες — εδώ αυτό θα έσβηνε το CMYK και το προφίλ ICC που χρειάζεται η εκτύπωση. Γι' αυτό η ρίψη είναι δική
 *    της, με τα όρια **ανά είδος** του καταλόγου (όχι τα γενικά όρια ανά τύπο της ζώνης).
 * 🔑 Το φύλλο **κλείνει χωρίς να σταματά τίποτα**: η κατάσταση ζει στον γονέα (`useAssetIntake`), όχι εδώ.
 */

import React, { useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';

import { useAuth } from '@/auth/hooks/useAuth';
import { MediaRightsFields } from '@/components/shared/media-rights/MediaRightsFields';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  emptyMediaRightsDraft,
  mediaRightsDraftIssues,
  mediaRightsOf,
  type MediaRightsAuthor,
  type MediaRightsDraft,
} from '@/lib/media-rights/media-rights-draft';
import { ASSET_KINDS } from '@/subapps/catalog/vocabulary/attribute-types';
import { assetAcceptAttribute } from '@/subapps/catalog/vocabulary/asset-files';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { intakeRowIssues, intakeRowsFor, isStartable, type IntakeRow } from './asset-intake-model';
import { AssetIntakeRow } from './AssetIntakeRow';
import type { AssetIntake } from './use-asset-intake';
import { useCatalogRightsWords } from './use-catalog-rights-words';

const ACCEPT = assetAcceptAttribute(ASSET_KINDS);

function useAuthor(): MediaRightsAuthor {
  const { user } = useAuth();
  return useMemo(() => ({ uid: user?.uid ?? null, name: user?.displayName ?? '' }), [user]);
}

function DropArea({ onFiles, disabled }: { readonly onFiles: (files: readonly File[]) => void; readonly disabled: boolean }) {
  const { t } = useCatalogText();
  const [over, setOver] = useState(false);
  const take = (list: FileList | null) => {
    if (list && list.length > 0) onFiles(Array.from(list));
  };
  return (
    <label
      htmlFor="asset-intake-files"
      data-over={over || undefined}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) take(e.dataTransfer.files); }}
      className="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed border-border p-6 text-center data-[over]:border-primary data-[over]:bg-accent/40"
    >
      <Upload className="h-6 w-6 text-muted-foreground" aria-hidden />
      <span className="text-sm font-medium">{t('assets.intake.chooseFiles')}</span>
      <span className="text-xs text-muted-foreground">{t('assets.intake.dropHint')}</span>
      <input id="asset-intake-files" type="file" multiple accept={ACCEPT} disabled={disabled} className="sr-only"
        onChange={(e) => { take(e.target.files); e.target.value = ''; }} />
    </label>
  );
}

interface AssetIntakeSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly intake: AssetIntake;
  /** Οι κωδικοί που έχει ήδη η βιβλιοθήκη — ο κωδικός είναι η ταυτότητα του μέσου. */
  readonly takenCodes: ReadonlySet<string>;
}

export function AssetIntakeSheet({ open, onOpenChange, intake, takenCodes }: AssetIntakeSheetProps) {
  const { t } = useCatalogText();
  const words = useCatalogRightsWords();
  const author = useAuthor();
  const [rights, setRights] = useState<MediaRightsDraft<'catalog'>>(() => emptyMediaRightsDraft('catalog', author));
  const [attempted, setAttempted] = useState(false);
  const sequence = useRef(0);
  const batchCodes = intake.rows.filter((row) => row.asset === null).map((row) => row.code);
  const issuesOf = (row: IntakeRow) => intakeRowIssues(row, takenCodes, batchCodes);
  const rightsIssues = mediaRightsDraftIssues(rights);
  const ready = intake.rows.filter((row) => isStartable(row) && issuesOf(row).length === 0);

  const run = (rows: readonly IntakeRow[]) => {
    setAttempted(true);
    if (rightsIssues.length > 0 || rows.length === 0) return;
    void intake.start(rows, mediaRightsOf(rights, author, new Date().getFullYear()));
  };
  const addFiles = (files: readonly File[]) => {
    const taken = new Set([...takenCodes, ...batchCodes]);
    intake.add(intakeRowsFor(files, taken, () => `intake-${(sequence.current += 1)}`));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-5xl">
        <SheetHeader>
          <SheetTitle>{t('assets.intake.title')}</SheetTitle>
          <SheetDescription>{t('assets.intake.lead')}</SheetDescription>
        </SheetHeader>
        <DropArea onFiles={addFiles} disabled={false} />
        {intake.rows.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('assets.intake.columns.file')}</TableHead>
                <TableHead>{t('assets.intake.columns.code')}</TableHead>
                <TableHead>{t('assets.intake.columns.label')}</TableHead>
                <TableHead>{t('assets.intake.columns.role')}</TableHead>
                <TableHead>{t('assets.intake.columns.status')}</TableHead>
                <TableHead><span className="sr-only">{t('assets.intake.columns.actions')}</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {intake.rows.map((row) => (
                <AssetIntakeRow key={row.key} row={row} issues={issuesOf(row)} showIssues={attempted} intake={intake} onRetry={(retry) => run([retry])} />
              ))}
            </TableBody>
          </Table>
        ) : null}
        <MediaRightsFields context="catalog" idPrefix="asset-intake-rights" draft={rights} onChange={setRights} words={words}
          issues={attempted ? rightsIssues : []} />
        <SheetFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={intake.clearDone} disabled={!intake.rows.some((row) => row.status.kind === 'done')}>
            {t('assets.intake.clearDone')}
          </Button>
          <Button type="button" onClick={() => run(ready)} disabled={ready.length === 0}>
            {t('assets.intake.start', { count: ready.length })}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
