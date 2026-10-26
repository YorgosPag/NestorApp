'use client';

/**
 * @fileoverview **Το αρχείο ενός μέσου** — πρωτότυπο (χρώμα · προφίλ · πυκνότητα), αποδόσεις web/εκτύπωσης, νέα έκδοση,
 *   ιστορικό εκδόσεων (ADR-923 §5.10.3 · §5.10.4).
 * @related renditions/catalog-renditions.ts (η καταγεγραμμένη κατάσταση) · lib/files/file-companion-objects.ts (οι
 *   διαδρομές των αποδόσεων — **μόνο** από εκεί) · use-asset-intake.ts (`replaceFile`)
 * @module components/catalog/assets/AssetFilePanel
 *
 * 🔑 **Ό,τι λέει το αρχείο, όχι ό,τι υποθέτουμε**: «CMYK · Coated FOGRA39 · 300 ppi» διαβάζεται από το `imageColour`
 *    (μετρημένο από τον διακομιστή)· απόδοση χωρίς προφίλ στην πηγή το **λέει** (`assumedProfile`) — η έκδοση θα
 *    ρωτήσει τον άνθρωπο, όχι θα μαντέψει.
 * 🔑 **Νέα έκδοση = νέο αρχείο κάτω από το ίδιο μέσο** (Δ9): ο προέλεγχος (`judgeAssetUpload`) τρέχει **πριν** από κάθε byte.
 */

import React, { useRef, useState } from 'react';
import { ExternalLink, FileUp } from 'lucide-react';

import { FileThumbnail } from '@/components/shared/files/FileThumbnail';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fileCompanionPath, type FileCompanionKind } from '@/lib/files/file-companion-objects';
import { fileDisplayUrl } from '@/lib/files/file-display-url';
import type { ImageColour, ImageColourModel } from '@/lib/images/image-colour';
import type { AssetRecord } from '@/services/catalog/catalog-api.client';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import { judgeAssetUpload } from '@/subapps/catalog/schema/judge-asset-file';
import {
  catalogRenditionsStanding,
  CATALOG_RENDITION_USES,
  type CatalogRenditionFacts,
  type CatalogRenditionUse,
} from '@/subapps/catalog/renditions/catalog-renditions';
import { assetAcceptAttribute } from '@/subapps/catalog/vocabulary/asset-files';
import type { FileRecord } from '@/types/file-record';
import { formatFileSize } from '@/utils/file-validation';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { FieldIssues } from '../shared/CatalogIssues';
import { fileFactsOf, type IntakeRow } from './asset-intake-model';
import { IntakeStatus } from './AssetIntakeRow';
import {
  ASSUMED_PROFILE_KEYS,
  assumedProfileKind,
  COLOUR_PRESERVED_KEYS,
  COLOUR_MODEL_KEYS,
  RENDITION_FAILURE_KEYS,
  RENDITION_STANDING_KEYS,
  RENDITION_USE_KEYS,
} from './asset-labels';

const COMPANION_OF_USE: Readonly<Record<CatalogRenditionUse, FileCompanionKind>> = {
  web: 'catalogWebRendition',
  print: 'catalogPrintRendition',
};

/** «CMYK · Coated FOGRA39 · 300 ppi · 16 bit» — τα μέρη που ξέρει το αρχείο, με τη σειρά που ρωτά ένας τυπογράφος. */
export function useColourSummary(): (colour: ImageColour) => string {
  const { t } = useCatalogText();
  return (colour) => [
    t(COLOUR_MODEL_KEYS[colour.model]),
    colour.profile?.name ?? (colour.profile ? t('assets.colour.unnamedProfile') : t('assets.colour.noProfile')),
    colour.density !== null ? t('assets.colour.density', { ppi: colour.density }) : null,
    colour.bitsPerSample !== null ? t('assets.colour.bits', { bits: colour.bitsPerSample }) : null,
    colour.hasAlpha ? t('assets.colour.alpha') : null,
  ].filter((part): part is string => part !== null).join(' · ');
}

function RenditionFacts({ use, facts, file, sourceModel }: {
  readonly use: CatalogRenditionUse;
  readonly facts: CatalogRenditionFacts;
  readonly file: FileRecord;
  readonly sourceModel: ImageColourModel | null;
}) {
  const { t, language } = useCatalogText();
  const colour = useColourSummary();
  const url = file.storagePath
    ? fileDisplayUrl({ storagePath: fileCompanionPath(file.storagePath, COMPANION_OF_USE[use]), storagePlacement: file.storagePlacement, contentType: facts.contentType })
    : null;
  return (
    <li className="flex flex-col gap-0.5 rounded-md border border-border p-2">
      <span className="flex items-center justify-between gap-2 text-sm font-medium">
        {t(RENDITION_USE_KEYS[use])}
        {url ? <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs underline">{t('assets.renditions.open')}<ExternalLink className="h-3 w-3" aria-hidden /></a> : null}
      </span>
      <span className="text-xs text-muted-foreground">
        {t('assets.renditions.dimensions', { width: facts.width, height: facts.height })} · {formatFileSize(facts.sizeBytes, language)} · {facts.contentType}
      </span>
      <span className="text-xs">{colour(facts.colour)}</span>
      {facts.assumedProfile ? <Badge variant="warning" className="w-fit">{t(ASSUMED_PROFILE_KEYS[assumedProfileKind(use, sourceModel)])}</Badge> : null}
      {use === 'print' && facts.colourPreserved ? (
        <span className="text-xs text-muted-foreground">{t(facts.colour.profile !== null ? COLOUR_PRESERVED_KEYS.withProfile : COLOUR_PRESERVED_KEYS.withoutProfile)}</span>
      ) : null}
    </li>
  );
}

/** Ο χώρος της πηγής, όπως τον κράτησε η απόδοση εκτύπωσης (late binding)· αλλιώς άγνωστος. */
function sourceModelOf(print: CatalogRenditionFacts): ImageColourModel | null {
  return print.colourPreserved ? print.colour.model : null;
}

function Renditions({ file, onRefresh }: { readonly file: FileRecord; readonly onRefresh: (() => void) | null }) {
  const { t } = useCatalogText();
  const recorded = file.catalogRenditions;
  const standing = catalogRenditionsStanding(recorded);
  return (
    <section aria-labelledby="asset-renditions-title" className="flex flex-col gap-2">
      <h4 id="asset-renditions-title" className="m-0 flex items-center gap-2 text-sm font-semibold">
        {t('assets.renditions.title')}
        <Badge variant={standing === 'ready' ? 'success' : standing === 'failed' ? 'destructive' : 'muted'}>{t(RENDITION_STANDING_KEYS[standing])}</Badge>
      </h4>
      {recorded?.status === 'failed' ? <p className="m-0 text-xs text-destructive">{t(RENDITION_FAILURE_KEYS[recorded.failure])}</p> : null}
      {standing !== 'ready' && onRefresh ? (
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={onRefresh}>{t('assets.renditions.refresh')}</Button>
      ) : null}
      {recorded?.status === 'ready' && standing === 'ready' ? (
        <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
          {CATALOG_RENDITION_USES.map((use) => (
            <RenditionFacts key={use} use={use} facts={recorded[use]} file={file} sourceModel={sourceModelOf(recorded.print)} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function ReplaceFileButton({ asset, disabled, onReplace }: {
  readonly asset: AssetRecord;
  readonly disabled: boolean;
  readonly onReplace: (file: File) => void;
}) {
  const { t } = useCatalogText();
  const input = useRef<HTMLInputElement>(null);
  const [issues, setIssues] = useState<readonly CatalogIssue[]>([]);
  const choose = (file: File | undefined) => {
    if (!file) return;
    const found = judgeAssetUpload(asset.kind, { ...fileFactsOf(file), sizeBytes: file.size });
    setIssues(found);
    if (found.length === 0) onReplace(file);
  };
  return (
    <section className="flex flex-col gap-1">
      <Button type="button" variant="outline" size="sm" className="w-fit" disabled={disabled} onClick={() => input.current?.click()}>
        <FileUp className="mr-1 h-4 w-4" aria-hidden />{asset.fileId ? t('assets.editor.replaceFile') : t('assets.editor.attachFile')}
      </Button>
      <input ref={input} type="file" className="sr-only" tabIndex={-1} aria-hidden accept={assetAcceptAttribute([asset.kind])}
        onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ''; }} />
      <FieldIssues issues={issues} path="fileId" exact />
    </section>
  );
}

interface AssetFilePanelProps {
  readonly asset: AssetRecord;
  readonly current: FileRecord | null;
  readonly versions: readonly FileRecord[];
  readonly canManage: boolean;
  readonly fileRow: IntakeRow | null;
  readonly onReplace: (file: File) => void;
  readonly onRetry: (row: IntakeRow) => void;
  readonly onRefreshRenditions: () => void;
}

/** Η πράξη αρχείου που τρέχει ή απέτυχε για αυτό το μέσο — με επανάληψη από το στάδιο της αποτυχίας. */
function FileOperation({ row, onRetry }: { readonly row: IntakeRow; readonly onRetry: (row: IntakeRow) => void }) {
  const { t } = useCatalogText();
  if (row.status.kind === 'done' || row.status.kind === 'draft') return null;
  return (
    <section className="flex flex-col gap-1 rounded-md border border-border p-2" aria-live="polite">
      <IntakeStatus row={row} />
      <FieldIssues issues={row.status.kind === 'failed' ? row.status.issues : []} path="fileId" />
      {row.status.kind === 'failed' ? (
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => onRetry(row)}>{t('assets.intake.retry')}</Button>
      ) : null}
    </section>
  );
}

export function AssetFilePanel({ asset, current, versions, canManage, fileRow, onReplace, onRetry, onRefreshRenditions }: AssetFilePanelProps) {
  const { t, language } = useCatalogText();
  const colour = useColourSummary();
  const busy = fileRow !== null && (fileRow.status.kind === 'queued' || fileRow.status.kind === 'running');
  return (
    <section aria-labelledby="asset-file-title" className="flex flex-col gap-3">
      <h3 id="asset-file-title" className="m-0 text-sm font-semibold">{t('assets.editor.file')}</h3>
      {current ? (
        <article className="flex gap-3">
          <FileThumbnail file={current} displayName={current.displayName} size="lg" />
          <section className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium">{current.originalFilename}</span>
            <span className="text-xs text-muted-foreground">{formatFileSize(current.sizeBytes ?? 0, language)} · {current.contentType}</span>
            {current.imageColour ? <span className="text-xs">{colour(current.imageColour)}</span> : null}
          </section>
        </article>
      ) : (
        <p className="m-0 text-sm text-muted-foreground">{t('assets.editor.fileMissing')}</p>
      )}
      {current && asset.kind === 'image' ? <Renditions file={current} onRefresh={canManage && !busy ? onRefreshRenditions : null} /> : null}
      {fileRow ? <FileOperation row={fileRow} onRetry={onRetry} /> : null}
      {canManage ? <ReplaceFileButton asset={asset} disabled={busy} onReplace={onReplace} /> : null}
      {versions.length > 1 ? (
        <section aria-labelledby="asset-versions-title" className="flex flex-col gap-1">
          <h4 id="asset-versions-title" className="m-0 text-sm font-semibold">{t('assets.editor.versions', { count: versions.length })}</h4>
          <ol className="m-0 flex list-none flex-col gap-1 p-0">
            {versions.map((version) => (
              <li key={version.id} className="flex items-center gap-2 text-xs">
                <FileThumbnail file={version} displayName={version.displayName} size="xs" />
                <span className="truncate">{version.originalFilename}</span>
                {version.id === asset.fileId ? <Badge variant="info">{t('assets.editor.current')}</Badge> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </section>
  );
}
