/**
 * Parking Showcase HTML email — thin config on top of the showcase-core
 * email builder factory (ADR-321 pattern).
 *
 * Surface-specific concerns:
 *   - Parking hero (number + code + type/status subtitle + description)
 *   - Specs key/value table wired to the parking snapshot shape
 *   - Label accessors bridging `ParkingShowcasePDFLabels` to the core
 *
 * @module services/email-templates/parking-showcase-email
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
import type { ParkingShowcaseSnapshot } from '@/services/parking-showcase/snapshot-builder';
import type { ParkingShowcasePDFLabels } from '@/services/parking-showcase/labels';

type HookParams = ShowcaseEmailRenderHookParams<ParkingShowcaseSnapshot, ParkingShowcasePDFLabels>;

function renderParkingHero({ snapshot, labels }: HookParams): string {
  const p = snapshot.parking;
  const code = p.code
    ? `<p style="margin:4px 0 0;font-size:12px;color:${BRAND.grayLight};">${escapeHtml(labels.specs.code)}: ${escapeHtml(p.code)}</p>`
    : '';
  const subtitleBits = [p.typeLabel, p.statusLabel].filter(Boolean).join(' · ');
  const subtitle = subtitleBits
    ? `<p style="margin:6px 0 0;font-size:13px;color:${BRAND.grayLight};">${escapeHtml(subtitleBits)}</p>`
    : '';
  const desc = p.description
    ? `<p style="margin:12px 0 0;font-size:14px;color:${BRAND.navyDark};line-height:1.6;white-space:pre-line;">${escapeHtml(p.description)}</p>`
    : '';
  return `<section>
    <h1 style="margin:0;padding:0;font-size:22px;color:${BRAND.navyDark};">${escapeHtml(p.number)}</h1>
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

function renderParkingSpecs({ snapshot, labels }: HookParams): string {
  const p = snapshot.parking;
  const rows: ShowcaseKeyValueRow[] = [
    { label: labels.specs.type,         value: p.typeLabel },
    { label: labels.specs.status,       value: p.statusLabel },
    { label: labels.specs.locationZone, value: p.locationZoneLabel },
    { label: labels.specs.area,         value: p.area, unit: labels.specs.areaUnit },
    { label: labels.specs.price,        value: formatMoneyAmount(p.price) },
    { label: labels.specs.floor,        value: p.floor },
    { label: labels.specs.building,     value: p.buildingName },
  ];
  const table = renderKeyValueTable(rows);
  if (!table) return '';
  return `${renderSectionTitle(labels.specs.title)}${table}`;
}

export const buildParkingShowcaseEmail = createShowcaseEmailBuilder<
  ParkingShowcaseSnapshot,
  ParkingShowcasePDFLabels,
  ShowcaseEmailMedia
>({
  getEntityHeading: (snapshot) => {
    const p = snapshot.parking;
    return {
      name: p.number,
      codeSuffix: p.code ? ` (${p.code})` : '',
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
    renderHero:  renderParkingHero,
    renderSpecs: renderParkingSpecs,
  },
});

export type { BuildShowcaseEmailParams, BuiltShowcaseEmail };
