/**
 * bim-entity-formatter — pure format functions for QuickProperties 3D tooltip.
 *
 * Returns [typeLine, dimensionLine, categoryLine] for each BIM entity type.
 * Numbers: thickness/width/depth in mm (raw), height/length displayed as m.
 *
 * ADR-366 B.2.Q1. No React imports — pure TS.
 */

import type { WallEntity } from '../../bim/types/wall-types';
import type { ColumnEntity } from '../../bim/types/column-types';
import type { BeamEntity } from '../../bim/types/beam-types';
import type { SlabEntity } from '../../bim/types/slab-types';

export type TFn = (key: string) => string;
export type TooltipLines = readonly [string, string, string];

function mmToM(mm: number): string {
  return `${(mm / 1000).toFixed(2)}m`;
}

export function formatWallTooltip(wall: WallEntity, t: TFn): TooltipLines {
  const { thickness, height, category } = wall.params;
  return [
    t('entityTypes.wall'),
    `${thickness}mm × ${mmToM(height)}`,
    t(`wallCategories.${category}`),
  ];
}

export function formatColumnTooltip(column: ColumnEntity, t: TFn): TooltipLines {
  const { kind, width, depth } = column.params;
  const dimLine = kind === 'circular'
    ? `Ø${width}mm`
    : `${width}×${depth}mm`;
  return [
    t('entityTypes.column'),
    dimLine,
    t(`columnKinds.${kind}`),
  ];
}

export function formatBeamTooltip(beam: BeamEntity, t: TFn): TooltipLines {
  const { kind, width, depth } = beam.params;
  const lengthStr = `${beam.geometry.length.toFixed(2)}m`;
  return [
    t('entityTypes.beam'),
    `${width}×${depth}mm / ${lengthStr}`,
    t(`beamKinds.${kind}`),
  ];
}

export function formatSlabTooltip(slab: SlabEntity, t: TFn): TooltipLines {
  const { kind, thickness } = slab.params;
  const areaStr = `${slab.geometry.area.toFixed(1)}m²`;
  return [
    t('entityTypes.slab'),
    `${thickness}mm / ${areaStr}`,
    t(`slabKinds.${kind}`),
  ];
}
