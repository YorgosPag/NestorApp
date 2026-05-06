/**
 * Storage Showcase HTML email — thin config on top of the showcase-core
 * email builder factory (ADR-321 pattern).
 *
 * Surface-specific concerns:
 *   - Storage hero (name + code + type/status subtitle + description)
 *   - Specs key/value table wired to the storage snapshot shape
 *   - Label accessors bridging `StorageShowcasePDFLabels` to the core
 *
 * @module services/email-templates/storage-showcase-email
 */

import 'server-only';

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
import type { StorageShowcaseSnapshot } from '@/services/storage-showcase/snapshot-builder';
import type { StorageShowcasePDFLabels } from '@/services/storage-showcase/labels';

type HookParams = ShowcaseEmailRenderHookParams<StorageShowcaseSnapshot, StorageShowcasePDFLabels>;

function renderStorageHero({ snapshot, labels }: HookParams): string {
  const s = snapshot.storage;
  const code = s.code
    ? `<p style="margin:4px 0 0;font-size:12px;color:${BRAND.grayLight};">${escapeHtml(labels.specs.code)}: ${escapeHtml(s.code)}</p>`
    : '';
  const subtitleBits = [s.typeLabel, s.statusLabel].filter(Boolean).join(' · ');
  const subtitle = subtitleBits
    ? `<p style="margin:6px 0 0;font-size:13px;color:${BRAND.grayLight};">${escapeHtml(subtitleBits)}</p>`
    : '';
  const desc = s.description
    ? `<p style="margin:12px 0 0;font-size:14px;color:${BRAND.navyDark};line-height:1.6;white-space:pre-line;">${escapeHtml(s.description)}</p>`
    : '';
  return `<section>
    <h1 style="margin:0;padding:0;font-size:22px;color:${BRAND.navyDark};">${escapeHtml(s.name)}</h1>
    ${code}${subtitle}${desc}
  </section>`;
}

function formatMoneyAmount(value: number | null | undefined): string | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function renderStorageSpecs({ snapshot, labels }: HookParams): string {
  const s = snapshot.storage;
  const rows: ShowcaseKeyValueRow[] = [
    { label: labels.specs.type,     value: s.typeLabel },
    { label: labels.specs.status,   value: s.statusLabel },
    { label: labels.specs.area,     value: s.area, unit: labels.specs.areaUnit },
    { label: labels.specs.price,    value: formatMoneyAmount(s.price) },
    { label: labels.specs.floor,    value: s.floor },
    { label: labels.specs.building, value: s.buildingName },
  ];
  const table = renderKeyValueTable(rows);
  if (!table) return '';
  return `${renderSectionTitle(labels.specs.title)}${table}`;
}

export const buildStorageShowcaseEmail = createShowcaseEmailBuilder<
  StorageShowcaseSnapshot,
  StorageShowcasePDFLabels,
  ShowcaseEmailMedia
>({
  getEntityHeading: (snapshot) => {
    const s = snapshot.storage;
    return {
      name: s.name,
      codeSuffix: s.code ? ` (${s.code})` : '',
      description: s.description,
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
    renderHero:  renderStorageHero,
    renderSpecs: renderStorageSpecs,
  },
});

export type { BuildShowcaseEmailParams, BuiltShowcaseEmail };
