/**
 * @fileoverview Project Showcase HTML email — thin config on top of the
 * showcase-core email builder factory (ADR-316 + ADR-321 Phase 3).
 *
 * Surface-specific concerns:
 *   - Project hero (name + projectCode suffix + type/status subtitle + description)
 *   - Specs key/value table wired to the project snapshot shape
 *   - Label accessors bridging `ProjectShowcasePDFLabels` to the core
 *
 * Everything else (subject composition, intro text, photo grid, floorplans
 * media list, CTA, branded wrap, text fallback) lives in
 * `createShowcaseEmailBuilder`.
 */

import 'server-only';

import type { ProjectShowcaseSnapshot } from '@/types/project-showcase';
import type { ProjectShowcasePDFLabels } from '@/services/project-showcase/labels';
import {
  createShowcaseEmailBuilder,
  standardShowcaseEmailLabels,
  type BuildShowcaseEmailParams,
  type BuiltShowcaseEmail,
  type ShowcaseEmailRenderHookParams,
} from '@/services/showcase-core';
import {
  renderKeyValueTable,
  renderSectionTitle,
  renderShowcaseHero,
  formatShowcaseMoney,
  formatShowcasePercent,
  type ShowcaseEmailMedia,
  type ShowcaseKeyValueRow,
} from './showcase-email-shared';
type SnapshotProject = ProjectShowcaseSnapshot['project'];
type HookParams = ShowcaseEmailRenderHookParams<ProjectShowcaseSnapshot, ProjectShowcasePDFLabels>;

function renderProjectHero({ snapshot, labels }: HookParams): string {
  const p = snapshot.project;
  return renderShowcaseHero({
    name: p.name,
    code: p.projectCode,
    codeLabel: labels.specs.code,
    subtitleBits: [p.typeLabel, p.statusLabel].filter(Boolean).join(' · '),
    description: p.description,
  });
}

function composeLocation(p: SnapshotProject): string | undefined {
  const parts = [p.address, p.city, p.location].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

function renderProjectSpecs({ snapshot, labels }: HookParams): string {
  const p = snapshot.project;
  const rows: ShowcaseKeyValueRow[] = [
    { label: labels.specs.type,           value: p.typeLabel },
    { label: labels.specs.status,         value: p.statusLabel },
    { label: labels.specs.progress,       value: formatShowcasePercent(p.progress) },
    { label: labels.specs.totalArea,      value: p.totalArea,  unit: labels.specs.areaUnit },
    { label: labels.specs.totalValue,     value: formatShowcaseMoney(p.totalValue) },
    { label: labels.specs.startDate,      value: p.startDate },
    { label: labels.specs.completionDate, value: p.completionDate },
    { label: labels.specs.location,       value: composeLocation(p) },
    { label: labels.specs.client,         value: p.linkedCompanyName ?? p.client },
  ];
  const table = renderKeyValueTable(rows);
  if (!table) return '';
  return `${renderSectionTitle(labels.specs.title)}${table}`;
}

export const buildProjectShowcaseEmail = createShowcaseEmailBuilder<
  ProjectShowcaseSnapshot,
  ProjectShowcasePDFLabels,
  ShowcaseEmailMedia
>({
  getEntityHeading: (snapshot) => {
    const p = snapshot.project;
    return {
      name: p.name,
      codeSuffix: p.projectCode ? ` (${p.projectCode})` : '',
      description: p.description,
    };
  },
  getCompany: (snapshot) => snapshot.company,
  labels: standardShowcaseEmailLabels<ProjectShowcasePDFLabels>(),
  hooks: {
    renderHero:  renderProjectHero,
    renderSpecs: renderProjectSpecs,
  },
});
