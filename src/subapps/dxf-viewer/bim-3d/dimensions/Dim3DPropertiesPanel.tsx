'use client';

/**
 * ADR-366 Phase 9 / C.3.Q5 + C.3.Q6 — Selected 3D Dimension Properties Panel.
 *
 * Edits the currently selected dim:
 *  - text offset (Vec2 fields)
 *  - text plane lock (billboard / world-locked)
 *  - precision + unit
 *  - mode (read-only for now — mode swap would re-compute value off new placement)
 *
 * Persists via BimDimensions3DService.update().
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBimDimensions3DStore } from '../stores/BimDimensions3DStore';
import { BimDimensions3DService } from './bim-dimensions-3d.service';
import type {
  BimDimension3D,
  Dim3DTextPlane,
  Dim3DUnit,
} from './dim3d-types';

const PRECISIONS: readonly number[] = [0, 1, 2, 3, 4];
const UNITS: readonly Dim3DUnit[] = ['mm', 'm'];
const TEXT_PLANES: readonly Dim3DTextPlane[] = ['billboard', 'world'];

function resolveSelectedDimension(): BimDimension3D | null {
  const state = useBimDimensions3DStore.getState();
  const id = state.selectedDimId;
  if (!id) return null;
  for (const projectId of Object.keys(state.dimensionsByProjectId)) {
    const list = state.dimensionsByProjectId[projectId];
    const found = list.find((d) => d.id === id);
    if (found) return found;
  }
  return null;
}

export function Dim3DPropertiesPanel() {
  const { t } = useTranslation('bim3d');
  const selectedDimId = useBimDimensions3DStore((s) => s.selectedDimId);

  const dim = selectedDimId ? resolveSelectedDimension() : null;

  const handleUpdate = useCallback(
    async (patch: Partial<BimDimension3D>) => {
      if (!dim) return;
      try {
        await BimDimensions3DService.update(dim.id, dim, patch);
      } catch (err) {
        console.error('[Dim3DPropertiesPanel] update failed', err);
      }
    },
    [dim],
  );

  if (!dim) {
    return (
      <section className="p-3 text-sm text-muted-foreground">
        {t('quickProperties.noData')}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 p-3 text-sm" aria-label={t('dimensions.title')}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('dimensions.title')}
      </h3>

      <FieldRow label={t('dimensions.fields.value')}>
        <span className="font-mono text-foreground">{dim.value.toFixed(dim.precision)}</span>
      </FieldRow>

      <FieldRow label={t('dimensions.fields.unit')}>
        <Select
          value={dim.unit}
          onValueChange={(v) => handleUpdate({ unit: v as Dim3DUnit })}
        >
          <SelectTrigger className="h-7 w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UNITS.map((u) => (
              <SelectItem key={u} value={u}>
                {t(`dimensions.units.${u}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label={t('dimensions.fields.precision')}>
        <Select
          value={String(dim.precision)}
          onValueChange={(v) => handleUpdate({ precision: Number(v) })}
        >
          <SelectTrigger className="h-7 w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRECISIONS.map((p) => (
              <SelectItem key={p} value={String(p)}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label={t('dimensions.textPlane.toggleLabel')}>
        <Select
          value={dim.textPlane}
          onValueChange={(v) => handleUpdate({ textPlane: v as Dim3DTextPlane })}
        >
          <SelectTrigger className="h-7 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEXT_PLANES.map((p) => (
              <SelectItem key={p} value={p}>
                {t(`dimensions.textPlane.${p === 'world' ? 'worldLocked' : 'billboard'}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label={t('dimensions.fields.offset')}>
        <span className="font-mono text-xs text-muted-foreground">
          ({dim.textOffset.x.toFixed(2)}, {dim.textOffset.y.toFixed(2)})
        </span>
      </FieldRow>
    </section>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
