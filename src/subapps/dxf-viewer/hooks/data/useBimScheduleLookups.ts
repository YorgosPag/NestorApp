'use client';

/**
 * USE BIM SCHEDULE LOOKUPS — SSoT builder για `ScheduleLookups` + filter
 * options του «Πίνακα BIM» (ADR-363 §6 Phase 8 mount).
 *
 * Αντικαθιστά τον inline `buildLookupsFromLevels` του `OpeningSchedulePdfHost`
 * (N.0.2 — μία πηγή αλήθειας για το πώς χτίζονται τα lookups). Συνθέτει:
 *   - `floor`     → localized όνομα ορόφου από `useLevels().levels`.
 *   - `material`  → localized υλικό (dxf-viewer-shell) μέσω
 *                   `constructionMaterialLabelKey`· fallback στο raw id.
 *   - `floorFinish` → undefined v1 (ToS derivation = ξεχωριστό concern,
 *                     όπως στον υπάρχοντα PDF host).
 *   - `building`  → `BuildingRef` resolver από `useFirestoreBuildings()`.
 *   - `translateKind` → opening kind enum → label (dxf-schedule).
 * + multi-select options (`availableFloors` / `availableCategories` /
 *   `availableBuildings`) που τροφοδοτούν το `ScheduleFilterBar`.
 *
 * Google-level N.7.2: pure derivation (useMemo), idempotent, single owner.
 * ADR-040: zero canvas, zero useSyncExternalStore — panel-side hook.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 8
 * @module hooks/data/useBimScheduleLookups
 */

import * as React from 'react';

import { useFirestoreBuildings } from '@/hooks/useFirestoreBuildings';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { useLevels } from '../../systems/levels';
import {
  constructionMaterialLabelKey,
  isConstructionMaterialId,
} from '../../bim/materials/construction-materials';
import type { AnyBimEntity } from '../../bim/schedule/schedule-presets';
import type { ScheduleLookups } from '../../bim/schedule/types';
import type { BuildingRef } from '../../bim/utils/bim-floor-utils';
import type { FilterOption } from '../../ui/components/bim-schedule/ScheduleFilterBar';

export interface BimScheduleLookupsResult {
  readonly lookups: ScheduleLookups;
  readonly availableFloors: readonly FilterOption[];
  readonly availableCategories: readonly FilterOption[];
  readonly availableBuildings: readonly FilterOption[];
}

/** Type-safe read ενός string πεδίου από τα ετερογενή `params` ενός entity. */
function readParam(entity: AnyBimEntity, field: 'material' | 'kind'): string | undefined {
  const params = entity.params as Readonly<Record<string, unknown>>;
  const value = params[field];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function useBimScheduleLookups(
  entities: readonly AnyBimEntity[],
): BimScheduleLookupsResult {
  const { levels } = useLevels();
  const { buildings } = useFirestoreBuildings();
  const { t: tShell } = useTranslation('dxf-viewer-shell');
  const { t: tSchedule } = useTranslation('dxf-schedule');

  const floorNames = React.useMemo(
    () => new Map(levels.map((l) => [l.id, l.name])),
    [levels],
  );

  const materialLabel = React.useCallback(
    (materialId: string | undefined): string => {
      if (!materialId) return '';
      if (!isConstructionMaterialId(materialId)) return materialId;
      return tShell(constructionMaterialLabelKey(materialId));
    },
    [tShell],
  );

  const translateKind = React.useCallback(
    (kind: string): string => tSchedule(`openingKind.${kind}`, { defaultValue: kind }),
    [tSchedule],
  );

  const lookups = React.useMemo<ScheduleLookups>(
    () => ({
      floor: (floorId) => (floorId ? (floorNames.get(floorId) ?? floorId) : ''),
      material: materialLabel,
      floorFinish: () => undefined,
      building: (buildingId): BuildingRef | undefined => {
        if (!buildingId) return undefined;
        const b = buildings.find((x) => x.id === buildingId);
        return b ? { id: b.id, name: b.name } : undefined;
      },
      translateKind,
    }),
    [floorNames, materialLabel, buildings, translateKind],
  );

  const availableFloors = React.useMemo<readonly FilterOption[]>(
    () => levels.map((l) => ({ id: l.id, label: l.name })),
    [levels],
  );

  const availableBuildings = React.useMemo<readonly FilterOption[]>(
    () => buildings.map((b) => ({ id: b.id, label: b.name })),
    [buildings],
  );

  // Category axis = unique material ids + unique kinds across the live entities
  // (matched heterogeneously by the schedule-builder: material first, then kind).
  const availableCategories = React.useMemo<readonly FilterOption[]>(() => {
    const seen = new Map<string, string>();
    for (const entity of entities) {
      const material = readParam(entity, 'material');
      if (material && !seen.has(material)) seen.set(material, materialLabel(material));
      const kind = readParam(entity, 'kind');
      if (kind && !seen.has(kind)) seen.set(kind, translateKind(kind));
    }
    return [...seen.entries()].map(([id, label]) => ({ id, label }));
  }, [entities, materialLabel, translateKind]);

  return { lookups, availableFloors, availableCategories, availableBuildings };
}
