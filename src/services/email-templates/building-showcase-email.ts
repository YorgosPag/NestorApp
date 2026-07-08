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
type SnapshotBuilding = BuildingShowcaseSnapshot['building'];
type HookParams = ShowcaseEmailRenderHookParams<BuildingShowcaseSnapshot, BuildingShowcasePDFLabels>;

function renderBuildingHero({ snapshot, labels }: HookParams): string {
  const b = snapshot.building;
  return renderShowcaseHero({
    name: b.name,
    code: b.code,
    codeLabel: labels.specs.code,
    subtitleBits: [b.typeLabel, b.statusLabel].filter(Boolean).join(' · '),
    description: b.description,
  });
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
    { label: labels.specs.progress,         value: formatShowcasePercent(b.progress) },
    { label: labels.specs.totalArea,        value: b.totalArea,  unit: labels.specs.areaUnit },
    { label: labels.specs.builtArea,        value: b.builtArea,  unit: labels.specs.areaUnit },
    { label: labels.specs.floors,           value: b.floors },
    { label: labels.specs.units,            value: b.units },
    { label: labels.specs.energyClass,      value: b.energyClassLabel },
    { label: labels.specs.renovation,       value: b.renovationLabel },
    { label: labels.specs.constructionYear, value: b.constructionYear },
    { label: labels.specs.totalValue,       value: formatShowcaseMoney(b.totalValue) },
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
  labels: standardShowcaseEmailLabels<BuildingShowcasePDFLabels>(),
  hooks: {
    renderHero:  renderBuildingHero,
    renderSpecs: renderBuildingSpecs,
  },
});
