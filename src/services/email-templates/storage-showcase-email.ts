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
import type { StorageShowcaseSnapshot } from '@/services/storage-showcase/snapshot-builder';
import type { StorageShowcasePDFLabels } from '@/services/storage-showcase/labels';

type HookParams = ShowcaseEmailRenderHookParams<StorageShowcaseSnapshot, StorageShowcasePDFLabels>;

function renderStorageHero({ snapshot, labels }: HookParams): string {
  const s = snapshot.storage;
  return renderShowcaseHero({
    name: s.name,
    code: s.code,
    codeLabel: labels.specs.code,
    subtitleBits: [s.typeLabel, s.statusLabel].filter(Boolean).join(' · '),
    description: s.description,
  });
}

function renderStorageSpecs({ snapshot, labels }: HookParams): string {
  const s = snapshot.storage;
  const rows: ShowcaseKeyValueRow[] = [
    { label: labels.specs.type,     value: s.typeLabel },
    { label: labels.specs.status,   value: s.statusLabel },
    { label: labels.specs.area,     value: s.area, unit: labels.specs.areaUnit },
    { label: labels.specs.price,    value: formatShowcaseMoney(s.price) },
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
  labels: standardShowcaseEmailLabels<StorageShowcasePDFLabels>(),
  hooks: {
    renderHero:  renderStorageHero,
    renderSpecs: renderStorageSpecs,
  },
});

export type { BuildShowcaseEmailParams, BuiltShowcaseEmail };
