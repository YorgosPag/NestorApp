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
  type ShowcaseEmailMedia,
  type ShowcaseKeyValueRow,
} from './showcase-email-shared';
import type { ParkingShowcaseSnapshot } from '@/services/parking-showcase/snapshot-builder';
import type { ParkingShowcasePDFLabels } from '@/services/parking-showcase/labels';

type HookParams = ShowcaseEmailRenderHookParams<ParkingShowcaseSnapshot, ParkingShowcasePDFLabels>;

function renderParkingHero({ snapshot, labels }: HookParams): string {
  const p = snapshot.parking;
  return renderShowcaseHero({
    name: p.number,
    code: p.code,
    codeLabel: labels.specs.code,
    subtitleBits: [p.typeLabel, p.statusLabel].filter(Boolean).join(' · '),
    description: p.description,
  });
}

function renderParkingSpecs({ snapshot, labels }: HookParams): string {
  const p = snapshot.parking;
  const rows: ShowcaseKeyValueRow[] = [
    { label: labels.specs.type,         value: p.typeLabel },
    { label: labels.specs.status,       value: p.statusLabel },
    { label: labels.specs.locationZone, value: p.locationZoneLabel },
    { label: labels.specs.area,         value: p.area, unit: labels.specs.areaUnit },
    { label: labels.specs.price,        value: formatShowcaseMoney(p.price) },
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
  labels: standardShowcaseEmailLabels<ParkingShowcasePDFLabels>(),
  hooks: {
    renderHero:  renderParkingHero,
    renderSpecs: renderParkingSpecs,
  },
});

export type { BuildShowcaseEmailParams, BuiltShowcaseEmail };
