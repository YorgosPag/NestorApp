/**
 * @fileoverview Building Showcase HTML email — thin config on top of the
 * showcase-core email builder factory (ADR-320 + ADR-321 Phase 2).
 *
 * Surface-specific concerns:
 *   - Building hero (name + code suffix + type/status subtitle + description)
 *   - Specs key/value table wired to the building snapshot shape
 *   - Label accessors bridging `BuildingShowcasePDFLabels` to the core
 *
 * Everything else (subject composition, intro text, photo grid, floorplans
 * media list, CTA, branded wrap, text fallback) lives in
 * `createShowcaseEmailBuilder`.
 */

import 'server-only';

import type { BuildingShowcaseSnapshot } from '@/types/building-showcase';
import type { BuildingShowcasePDFLabels } from '@/services/building-showcase/labels';
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

export type BuildBuildingShowcaseEmailParams = BuildShowcaseEmailParams<
  BuildingShowcaseSnapshot,
  BuildingShowcasePDFLabels,
  ShowcaseEmailMedia
>;

export type BuiltBuildingShowcaseEmail = BuiltShowcaseEmail;

type SnapshotBuilding = BuildingShowcaseSnapshot['building'];
type HookParams = ShowcaseEmailRenderHookParams<BuildingShowcaseSnapshot, BuildingShowcasePDFLabels>;

function renderBuildingHero({ snapshot, labels }: HookParams): string {
  const b = snapshot.building;
  const code = b.code
    ? `<p style="margin:4px 0 0;font-size:12px;color:${BRAND.grayLight};">${escapeHtml(labels.specs.code)}: ${escapeHtml(b.code)}</p>`
    : '';
  const subtitleBits = [b.typeLabel, b.statusLabel].filter(Boolean).join(' · ');
  const subtitle = subtitleBits
    ? `<p style="margin:6px 0 0;font-size:13px;color:${BRAND.grayLight};">${escapeHtml(subtitleBits)}</p>`
    : '';
  const desc = b.description
    ? `<p style="margin:12px 0 0;font-size:14px;color:${BRAND.navyDark};line-height:1.6;white-space:pre-line;">${escapeHtml(b.description)}</p>`
    : '';
  return `<section>
    <h1 style="margin:0;padding:0;font-size:22px;color:${BRAND.navyDark};">${escapeHtml(b.name)}</h1>
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

function composeLocation(b: SnapshotBuilding): string | undefined {
  const parts = [b.address, b.city, b.location].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

function renderBuildingSpecs({ snapshot, labels }: HookParams): string {
  const b = snapshot.building;
  const rows: ShowcaseKeyValueRow[] = [
    { label: labels.specs.type,             value: b.typeLabel },
    { label: labels.specs.status,           value: b.statusLabel },
    { label: labels.specs.progress,         value: formatProgress(b.progress) },
    { label: labels.specs.totalArea,        value: b.totalArea,  unit: labels.specs.areaUnit },
    { label: labels.specs.builtArea,        value: b.builtArea,  unit: labels.specs.areaUnit },
    { label: labels.specs.floors,           value: b.floors },
    { label: labels.specs.units,            value: b.units },
    { label: labels.specs.energyClass,      value: b.energyClassLabel },
    { label: labels.specs.renovation,       value: b.renovationLabel },
    { label: labels.specs.constructionYear, value: b.constructionYear },
    { label: labels.specs.totalValue,       value: formatMoneyAmount(b.totalValue) },
    { label: labels.specs.startDate,        value: b.startDate },
    { label: labels.specs.completionDate,   value: b.completionDate },
    { label: labels.specs.location,         value: composeLocation(b) },
    { label: labels.specs.project,          value: b.projectName },
    { label: labels.specs.linkedCompany,    value: b.linkedCompanyName },
  ];
  const table = renderKeyValueTable(rows);
  if (!table) return '';
  return `${renderSectionTitle(labels.specs.title)}${table}`;
}

export const buildBuildingShowcaseEmail = createShowcaseEmailBuilder<
  BuildingShowcaseSnapshot,
  BuildingShowcasePDFLabels,
  ShowcaseEmailMedia
>({
  getEntityHeading: (snapshot) => {
    const b = snapshot.building;
    return {
      name: b.name,
      codeSuffix: b.code ? ` (${b.code})` : '',
      description: b.description,
    };
  },
  getCompany: (snapshot) => snapshot.company,
  labels: {
    subjectPrefix:  (l) => l.email.subjectPrefix,
    introText:      (l) => l.email.introText,
    ctaLabel:       (l) => l.email.ctaLabel,
    headerSubtitle: (l) => l.header.subtitle,
    contactLabels:  (l) => l.header.contacts,
    photosTitle:    (l) => l.photos.title,
    floorplansTitle:(l) => l.floorplans.title,
  },
  hooks: {
    renderHero:  renderBuildingHero,
    renderSpecs: renderBuildingSpecs,
  },
});
