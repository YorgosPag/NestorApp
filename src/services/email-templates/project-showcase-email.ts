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
  type BuildShowcaseEmailParams,
  type BuiltShowcaseEmail,
  type ShowcaseEmailRenderHookParams,
} from '@/services/showcase-core';
import {
  BRAND,
  escapeHtml,
  renderKeyValueTable,
  renderSectionTitle,
  type ShowcaseEmailMedia,
  type ShowcaseKeyValueRow,
} from './showcase-email-shared';

export type BuildProjectShowcaseEmailParams = BuildShowcaseEmailParams<
  ProjectShowcaseSnapshot,
  ProjectShowcasePDFLabels,
  ShowcaseEmailMedia
>;

export type BuiltProjectShowcaseEmail = BuiltShowcaseEmail;

type SnapshotProject = ProjectShowcaseSnapshot['project'];
type HookParams = ShowcaseEmailRenderHookParams<ProjectShowcaseSnapshot, ProjectShowcasePDFLabels>;

function renderProjectHero({ snapshot, labels }: HookParams): string {
  const p = snapshot.project;
  const code = p.projectCode
    ? `<p style="margin:4px 0 0;font-size:12px;color:${BRAND.grayLight};">${escapeHtml(labels.specs.code)}: ${escapeHtml(p.projectCode)}</p>`
    : '';
  const subtitleBits = [p.typeLabel, p.statusLabel].filter(Boolean).join(' · ');
  const subtitle = subtitleBits
    ? `<p style="margin:6px 0 0;font-size:13px;color:${BRAND.grayLight};">${escapeHtml(subtitleBits)}</p>`
    : '';
  const desc = p.description
    ? `<p style="margin:12px 0 0;font-size:14px;color:${BRAND.navyDark};line-height:1.6;white-space:pre-line;">${escapeHtml(p.description)}</p>`
    : '';
  return `<section>
    <h1 style="margin:0;padding:0;font-size:22px;color:${BRAND.navyDark};">${escapeHtml(p.name)}</h1>
    ${code}${subtitle}${desc}
  </section>`;
}

function formatProgress(value: number | null | undefined): string | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
  return `${Math.round(value)}%`;
}

function formatMoneyAmount(value: number | null | undefined): string | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
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
    { label: labels.specs.progress,       value: formatProgress(p.progress) },
    { label: labels.specs.totalArea,      value: p.totalArea,  unit: labels.specs.areaUnit },
    { label: labels.specs.totalValue,     value: formatMoneyAmount(p.totalValue) },
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
  labels: {
    subjectPrefix:   (l) => l.email.subjectPrefix,
    introText:       (l) => l.email.introText,
    ctaLabel:        (l) => l.email.ctaLabel,
    headerSubtitle:  (l) => l.header.subtitle,
    contactLabels:   (l) => l.header.contacts,
    photosTitle:     (l) => l.photos.title,
    floorplansTitle: (l) => l.floorplans.title,
  },
  hooks: {
    renderHero:  renderProjectHero,
    renderSpecs: renderProjectSpecs,
  },
});
