/* eslint-disable custom/no-hardcoded-strings */
/**
 * =============================================================================
 * ISO 19650 VIRTUAL FOLDER TREE BUILDER
 * =============================================================================
 *
 * Builds a virtual hierarchy: Discipline → Series → CDE State → files.
 * Files without ISO metadata land in the "Unclassified" bucket.
 * Storage paths are NOT affected (ADR-293 immutable).
 *
 * @module components/file-manager/company-file-tree-iso19650-builder
 * @see ADR-373 — FileRecord ISO 19650 Metadata Enrichment
 * @see ADR-031 — Canonical File Storage System
 */

import React from 'react';
import {
  Layers,
  Clock,
  Share2,
  CheckCircle2,
  Archive,
  Folder,
  FileText,
} from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import {
  DISCIPLINE_CODES,
  DOCUMENT_SERIES,
  CDE_STATES,
  type DisciplineCode,
  type CdeState,
  type DocumentSeries,
} from '@/config/iso19650-constants';
import type { FileRecord } from '@/types/file-record';
import { getFileIconInfo } from '@/components/shared/files/utils/file-icons';
import type { TreeNodeData, DisplayNameTranslator, TranslationFn } from './company-file-tree-builders'; // type-only — no circular runtime dep

function getFileIcon(file: FileRecord): React.ReactNode {
  const { icon: Icon, colorClass } = getFileIconInfo(file.ext, file.contentType);
  return <Icon className={`h-4 w-4 ${colorClass}`} />;
}

// ============================================================================
// CDE STATE HELPERS
// ============================================================================

const CDE_STATE_ORDER: CdeState[] = ['WIP', 'SHARED', 'PUBLISHED', 'SUPERSEDED'];

function getCdeStateIcon(state: CdeState): React.ReactNode {
  switch (state) {
    case 'WIP':        return <Clock        className="h-4 w-4 text-[hsl(var(--text-warning))]" />;
    case 'SHARED':     return <Share2       className="h-4 w-4 text-primary" />;
    case 'PUBLISHED':  return <CheckCircle2 className="h-4 w-4 text-[hsl(var(--text-success))]" />;
    case 'SUPERSEDED': return <Archive      className="h-4 w-4 text-muted-foreground" />;
  }
}

// ============================================================================
// BUILDER
// ============================================================================

type CdeBucket    = { files: FileRecord[] };
type SeriesBucket = { byState: Map<string, CdeBucket>; unstationed: FileRecord[] };
type DiscBucket   = { bySeries: Map<number, SeriesBucket>; unseriesed: FileRecord[] };

export function buildTreeByISO19650(
  files: FileRecord[],
  t: TranslationFn,
  companyName: string,
  translateDisplayName?: DisplayNameTranslator,
): TreeNodeData {
  const byDiscipline = new Map<DisciplineCode, DiscBucket>();
  const unclassified: FileRecord[] = [];

  for (const file of files) {
    const disc = file.disciplineCode as DisciplineCode | undefined;
    if (!disc || !(disc in DISCIPLINE_CODES)) {
      unclassified.push(file);
      continue;
    }
    if (!byDiscipline.has(disc)) {
      byDiscipline.set(disc, { bySeries: new Map(), unseriesed: [] });
    }
    const discBucket = byDiscipline.get(disc)!;

    const seriesNum = file.documentSeries as DocumentSeries | undefined;
    if (!seriesNum || !(seriesNum in DOCUMENT_SERIES)) {
      discBucket.unseriesed.push(file);
      continue;
    }
    if (!discBucket.bySeries.has(seriesNum)) {
      discBucket.bySeries.set(seriesNum, { byState: new Map(), unstationed: [] });
    }
    const seriesBucket = discBucket.bySeries.get(seriesNum)!;

    const state = file.cdeState as CdeState | undefined;
    if (!state || !(state in CDE_STATES)) {
      seriesBucket.unstationed.push(file);
      continue;
    }
    if (!seriesBucket.byState.has(state)) {
      seriesBucket.byState.set(state, { files: [] });
    }
    seriesBucket.byState.get(state)!.files.push(file);
  }

  function makeFileNode(file: FileRecord): TreeNodeData {
    return {
      id: file.id,
      label: translateDisplayName ? translateDisplayName(file) : (file.displayName || file.originalFilename),
      type: 'file' as const,
      icon: getFileIcon(file),
      path: [companyName, file.disciplineCode ?? '?', String(file.documentSeries ?? ''), file.cdeState ?? '', file.displayName || ''],
      file,
    };
  }

  function makeSeriesChildren(seriesBucket: SeriesBucket, discCode: DisciplineCode, seriesNum: DocumentSeries): TreeNodeData[] {
    const stateNodes: TreeNodeData[] = CDE_STATE_ORDER
      .filter(s => seriesBucket.byState.has(s) && seriesBucket.byState.get(s)!.files.length > 0)
      .map(s => ({
        id: `iso-${discCode}-${seriesNum}-${s}`,
        label: `${s} — ${t(`iso19650:cdeState.${s}`)}`,
        type: 'folder' as const,
        icon: getCdeStateIcon(s),
        path: [companyName, discCode, String(seriesNum), s],
        children: seriesBucket.byState.get(s)!.files.map(makeFileNode),
      }));

    if (seriesBucket.unstationed.length > 0) {
      stateNodes.push({
        id: `iso-${discCode}-${seriesNum}-no-cde`,
        label: t('iso19650:virtualFolders.noCdeState'),
        type: 'folder' as const,
        icon: <Folder className="h-4 w-4 text-muted-foreground" />,
        path: [companyName, discCode, String(seriesNum), 'no-cde'],
        children: seriesBucket.unstationed.map(makeFileNode),
      });
    }
    return stateNodes;
  }

  const disciplineNodes: TreeNodeData[] = [...byDiscipline.keys()]
    .sort()
    .map(disc => {
      const discBucket = byDiscipline.get(disc)!;

      const seriesNodes: TreeNodeData[] = [...discBucket.bySeries.keys()]
        .sort((a, b) => a - b)
        .map(seriesNum => ({
          id: `iso-${disc}-${seriesNum}`,
          label: `${seriesNum} — ${t(`iso19650:documentSeries.${seriesNum}`)}`,
          type: 'folder' as const,
          icon: <FileText className="h-4 w-4 text-muted-foreground" />,
          path: [companyName, disc, String(seriesNum)],
          children: makeSeriesChildren(discBucket.bySeries.get(seriesNum)!, disc, seriesNum as DocumentSeries),
        }));

      if (discBucket.unseriesed.length > 0) {
        seriesNodes.push({
          id: `iso-${disc}-no-series`,
          label: t('iso19650:virtualFolders.noSeries'),
          type: 'folder' as const,
          icon: <FileText className="h-4 w-4 text-muted-foreground" />,
          path: [companyName, disc, 'no-series'],
          children: discBucket.unseriesed.map(makeFileNode),
        });
      }

      return {
        id: `iso-disc-${disc}`,
        label: `${disc} — ${t(`iso19650:discipline.${disc}`)}`,
        type: 'folder' as const,
        icon: <Layers className="h-4 w-4 text-primary" />,
        path: [companyName, disc],
        children: seriesNodes,
      };
    });

  if (unclassified.length > 0) {
    disciplineNodes.push({
      id: 'iso-unclassified',
      label: t('iso19650:virtualFolders.unclassified'),
      type: 'folder' as const,
      icon: <Folder className="h-4 w-4 text-muted-foreground" />,
      path: [companyName, 'unclassified'],
      children: unclassified.map(makeFileNode),
    });
  }

  return {
    id: 'root',
    label: companyName,
    type: 'root' as const,
    icon: React.createElement(NAVIGATION_ENTITIES.company.icon, { className: `h-4 w-4 ${NAVIGATION_ENTITIES.company.color}` }),
    path: [companyName],
    children: disciplineNodes,
  };
}
