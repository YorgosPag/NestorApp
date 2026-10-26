'use client';

/**
 * @fileoverview **Μία γραμμή της εισαγωγής μέσων** — κωδικός · ετικέτα · ρόλος · είδος · κατάσταση (ADR-923 §5.10.4).
 * @module components/catalog/assets/AssetIntakeRow
 *
 * 🔑 Η γραμμή **επεξεργάζεται μόνο όσο δεν τρέχει** (πρόχειρο ή αποτυχία). Μόλις δημιουργηθεί το μέσο, ο κωδικός
 *    **κλειδώνει** (είναι η ταυτότητά του — ADR-923 §5.9): μια επανάληψη μετά από αποτυχημένο ανέβασμα δεν τον αλλάζει.
 * 🔑 Τα ευρήματα κάθονται **στο πεδίο τους** (`code` · `fileId`), με τις ίδιες λέξεις που θα έδινε ο γραφέας.
 */

import React from 'react';
import { RotateCcw, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EnumSelect } from '@/components/ui/enum-select';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { TableCell, TableRow } from '@/components/ui/table';
import { formatFileSize } from '@/utils/file-validation';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import { ASSET_ROLE_KINDS, CATALOG_ASSET_ROLES } from '@/subapps/catalog/vocabulary/asset-roles';
import { ASSET_KIND_KEYS } from '../shared/catalog-labels';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { FieldIssues } from '../shared/CatalogIssues';
import { isStartable, kindForRole, kindOfFile, fileFactsOf, type IntakeRow } from './asset-intake-model';
import { ASSET_ROLE_KEYS, INTAKE_STAGE_KEYS } from './asset-labels';
import type { AssetIntake } from './use-asset-intake';

/** Η κατάσταση μιας πράξης αρχείου, με λέξεις — κοινή για τη γραμμή εισαγωγής και το πάνελ αρχείου του επεξεργαστή. */
export function IntakeStatus({ row }: { readonly row: IntakeRow }) {
  const { t } = useCatalogText();
  const { status } = row;
  switch (status.kind) {
    case 'draft':
      return <span className="text-xs text-muted-foreground">{t('assets.intake.status.draft')}</span>;
    case 'queued':
      return <span className="text-xs text-muted-foreground">{t('assets.intake.status.queued')}</span>;
    case 'running':
      return (
        <span className="flex min-w-32 flex-col gap-1" aria-live="polite">
          <span className="text-xs">{t(INTAKE_STAGE_KEYS[status.stage])}</span>
          {status.stage === 'upload' ? <Progress value={Math.round(status.progress * 100)} aria-label={t('assets.intake.stages.upload')} /> : null}
        </span>
      );
    case 'failed':
      return <span className="text-xs text-destructive" role="alert">{t('assets.intake.status.failedAt', { stage: t(INTAKE_STAGE_KEYS[status.stage]) })}</span>;
    case 'done':
      return <Badge variant="success">{t('assets.intake.status.done')}</Badge>;
  }
}

interface AssetIntakeRowProps {
  readonly row: IntakeRow;
  readonly issues: readonly CatalogIssue[];
  /** Δείχνονται μόνο μετά την πρώτη απόπειρα ή όταν αγγίχτηκε η γραμμή (ανέγγιχτη φόρμα δεν κοκκινίζει). */
  readonly showIssues: boolean;
  readonly intake: Pick<AssetIntake, 'patch' | 'remove'>;
  readonly onRetry: (row: IntakeRow) => void;
}

export function AssetIntakeRow({ row, issues, showIssues, intake, onRetry }: AssetIntakeRowProps) {
  const { t, language } = useCatalogText();
  const editable = isStartable(row);
  const fileKind = kindOfFile(fileFactsOf(row.file));
  const kinds = ASSET_ROLE_KINDS[row.role];
  const shown = showIssues || row.status.kind === 'failed' ? issues : [];
  const id = (field: string) => `intake-${row.key}-${field}`;
  return (
    <TableRow aria-busy={row.status.kind === 'running' || undefined}>
      <TableCell className="max-w-48">
        <span className="block truncate text-sm font-medium">{row.file.name}</span>
        <span className="text-xs text-muted-foreground">{formatFileSize(row.file.size, language)}</span>
        <FieldIssues issues={shown} path="fileId" exact id={id('file-issues')} />
      </TableCell>
      <TableCell>
        <Input aria-label={t('assets.intake.columns.code')} value={row.code} disabled={!editable || row.asset !== null}
          aria-invalid={shown.some((issue) => issue.path === 'code')} aria-describedby={id('code-issues')}
          className="font-mono" onChange={(e) => intake.patch(row.key, { code: e.target.value })} />
        <FieldIssues issues={shown} path="code" exact id={id('code-issues')} />
      </TableCell>
      <TableCell>
        <Input aria-label={t('assets.intake.columns.label')} value={row.label} disabled={!editable || row.asset !== null}
          onChange={(e) => intake.patch(row.key, { label: e.target.value })} />
      </TableCell>
      <TableCell className="min-w-48">
        <span className="grid gap-1">
          <EnumSelect id={id('role')} ariaLabel={t('assets.intake.columns.role')} value={row.role} values={CATALOG_ASSET_ROLES}
            disabled={!editable || row.asset !== null} getLabel={(role) => t(ASSET_ROLE_KEYS[role])}
            onValueChange={(role) => intake.patch(row.key, { role, kind: kindForRole(role, fileKind) })} />
          {kinds.length > 1 ? (
            <EnumSelect id={id('kind')} ariaLabel={t('assets.editor.kind')} value={row.kind} values={kinds}
              disabled={!editable || row.asset !== null} getLabel={(kind) => t(ASSET_KIND_KEYS[kind])}
              onValueChange={(kind) => intake.patch(row.key, { kind })} />
          ) : null}
        </span>
      </TableCell>
      <TableCell><IntakeStatus row={row} /></TableCell>
      <TableCell className="whitespace-nowrap text-right">
        {row.status.kind === 'failed' ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onRetry(row)}>
            <RotateCcw className="mr-1 h-4 w-4" aria-hidden />{t('assets.intake.retry')}
          </Button>
        ) : null}
        {editable && row.asset === null ? (
          <Button type="button" variant="ghost" size="icon" aria-label={t('assets.intake.remove')} onClick={() => intake.remove(row.key)}>
            <X className="h-4 w-4" aria-hidden />
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  );
}
