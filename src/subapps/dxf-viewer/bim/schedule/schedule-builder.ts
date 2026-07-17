/**
 * BIM Schedule Export — Builder (ADR-363 §6 Phase 8).
 *
 * Pure orchestrator: heterogeneous `BimEntity[]` → typed `Schedule`.
 *
 * Pipeline:
 *   1. Select candidates by `entityType` (door/window route through
 *      `openingKindToScheduleType`; stair / slab / column / beam / wall /
 *      slab-opening match `entity.type`; 'combined' accepts all).
 *   2. Apply 4-axis `ScheduleFilterCriteria` (floor / category / region /
 *      selection) via `applyScheduleFilters`.
 *   3. Map survivors through preset's `map` function → `ScheduleRow[]`.
 *   4. Return `Schedule` με columns + rows + timestamp.
 *
 * Zero React, zero canvas coupling, zero Firestore — entities, lookups,
 * config injected. Deterministic: same inputs → same `rows` order
 * (preserves caller's entity order).
 *
 * SSoT:
 *   - Column schema returned exactly as preset defines, unless
 *     `config.columnsOverride` provided (Phase 8+ UI customisation).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 8
 */

import { compareByLocale } from '@/lib/intl-formatting';
import { applyScheduleFilters, asFilterable, type FilterableBimEntity } from './filters';
import { openingHasOperableHardware } from '../family-types/opening-hardware-set';
import {
  type AnyBimEntity,
  getPreset,
  openingKindToScheduleType,
} from './schedule-presets';
import type {
  Schedule,
  ScheduleConfig,
  ScheduleEntityType,
  ScheduleLookups,
  ScheduleRow,
} from './types';

// ─── Candidate selection ─────────────────────────────────────────────────────

/**
 * Filter entity list by schedule entity-type. Handles the 3 routing rules:
 *   - 'combined'         → all entities
 *   - 'door' / 'window'  → only openings, routed by kind
 *   - others             → entity.type matches
 */
function selectCandidates(
  entities: readonly AnyBimEntity[],
  entityType: ScheduleEntityType,
): AnyBimEntity[] {
  if (entityType === 'combined') return [...entities];
  if (entityType === 'door' || entityType === 'window') {
    return entities.filter(
      (e) => e.type === 'opening' && openingKindToScheduleType(e.params.kind) === entityType,
    );
  }
  // ADR-674 Φ Β — hardware schedule: every opening carrying user-operable hardware
  // (excludes fixed / bay-window / overhead-door / revolving-door → empty catalog set).
  if (entityType === 'hardware') {
    return entities.filter(
      (e) => e.type === 'opening' && openingHasOperableHardware(e.params.kind),
    );
  }
  return entities.filter((e) => e.type === entityType);
}

// ─── Row mapping ─────────────────────────────────────────────────────────────

/**
 * Map a typed entity to its schedule row via preset. Encapsulates the
 * common shape: entityId + entityType + entityKind + floorId + cells.
 */
function buildRow(
  entity: AnyBimEntity,
  entityType: ScheduleEntityType,
  lookups: ScheduleLookups,
  mapFn: (e: AnyBimEntity, l: ScheduleLookups) => ScheduleRow['cells'],
): ScheduleRow {
  return {
    entityId: entity.id,
    entityType,
    entityKind: entity.kind,
    floorId: entity.floorId,
    buildingId: entity.buildingId,
    cells: mapFn(entity, lookups),
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Build a Schedule from heterogeneous BIM entities + config.
 *
 * Pure function: no side effects. Same inputs → same output (rows ordered
 * by the caller's entity sequence — typically Firestore subscribe order).
 *
 * @param entities - Heterogeneous BIM entities (typically union of all 7 types).
 * @param config   - Entity-type selector + filter criteria + optional column override.
 * @param lookups  - Floor + material label resolvers (decouples from Firestore).
 * @returns        Schedule με columns + rows + generation timestamp.
 */
export function buildSchedule(
  entities: readonly AnyBimEntity[],
  config: ScheduleConfig,
  lookups: ScheduleLookups,
): Schedule {
  const preset = getPreset(config.entityType);
  const columns = config.columnsOverride ?? preset.columns;

  const candidates = selectCandidates(entities, config.entityType);

  // Filters operate on the FilterableBimEntity shape — structural compatible
  // με όλα τα BimEntity sub-types (id + kind + params + geometry.bbox).
  const filterables: FilterableBimEntity[] = candidates.map((e) => asFilterable(e));
  const survivorIds = new Set(
    applyScheduleFilters(filterables, config.filters).map((f) => f.id),
  );
  const survivors = candidates.filter((e) => survivorIds.has(e.id));

  // ADR-363 §6 Phase 8 — «Κωδικός» = αναγνώσιμη σήμανση «<Τύπος> <αύξων>» ανά τύπο
  // (Revit auto-mark), αντί για raw GUID. Το πλήρες id μένει στο `row.entityId`.
  const typeCounters = new Map<string, number>();
  const rows = survivors.map((e) => {
    const row = buildRow(e, config.entityType, lookups, preset.map);
    const n = (typeCounters.get(e.type) ?? 0) + 1;
    typeCounters.set(e.type, n);
    const typeLabel = lookups.translateType ? lookups.translateType(e.type) : e.type;
    return { ...row, cells: { ...row.cells, id: `${typeLabel} ${n}` } };
  });

  if (config.groupByBuilding === true) {
    rows.sort((a, b) => compareByLocale(a.buildingId ?? '', b.buildingId ?? ''));
  }

  return {
    entityType: config.entityType,
    columns,
    rows,
    generatedAt: Date.now(),
  };
}

// ─── Convenience: empty schedule (used by UI when no entities loaded) ────────

/**
 * Empty schedule με preset columns but zero rows. Used by UI to render the
 * "no entities" state without losing the column header schema.
 */
export function emptySchedule(entityType: ScheduleEntityType): Schedule {
  const preset = getPreset(entityType);
  return {
    entityType,
    columns: preset.columns,
    rows: [],
    generatedAt: Date.now(),
  };
}
