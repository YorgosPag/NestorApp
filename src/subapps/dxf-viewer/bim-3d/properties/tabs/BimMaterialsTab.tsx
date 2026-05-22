"use client";

/**
 * BimMaterialsTab — 4-section read-only material view for a selected BIM entity.
 *
 * Sections: current material badge → top-5 alternatives → DNA multi-layer →
 * cost rollup (Phase 6+ placeholder).
 *
 * Data from Bim3DEntitiesStore.getState() — no subscription (parent panel
 * re-renders on Selection3DStore change). ADR-366 C.4.Q1–Q2.
 */

import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useBim3DEntitiesStore } from '../../stores/Bim3DEntitiesStore';
import { resolveTopAlternatives } from './material-alternatives-resolver';
import {
  defaultWallMaterialCatalog,
} from '../../../bim/walls/wall-material-catalog';
import type { WallEntity } from '../../../bim/types/wall-types';

interface BimMaterialsTabProps {
  bimId: string;
  bimType: string;
}

function resolveEntityMaterial(bimId: string, bimType: string) {
  const { walls, columns, beams, slabs } = useBim3DEntitiesStore.getState();
  switch (bimType) {
    case 'wall': {
      const e = walls.find((w) => w.id === bimId) as WallEntity | undefined;
      return { materialId: e?.params.material, dna: e?.params.dna };
    }
    case 'column': {
      const e = columns.find((c) => c.id === bimId);
      return { materialId: e?.params.material, dna: undefined };
    }
    case 'beam': {
      const e = beams.find((b) => b.id === bimId);
      return { materialId: e?.params.material, dna: undefined };
    }
    case 'slab': {
      const e = slabs.find((s) => s.id === bimId);
      return { materialId: e?.params.material, dna: undefined };
    }
    default:
      return { materialId: undefined, dna: undefined };
  }
}

export function BimMaterialsTab({ bimId, bimType }: BimMaterialsTabProps) {
  const { t } = useTranslation('bim3d');
  const { materialId, dna } = resolveEntityMaterial(bimId, bimType);

  const isPreset = materialId
    ? defaultWallMaterialCatalog.resolvePreset(materialId) !== null
    : false;
  const alternatives = resolveTopAlternatives(materialId);
  const hasMultiLayer = (dna?.layers.length ?? 0) > 1;

  return (
    <div className="flex flex-col gap-4 p-4 text-sm">
      {/* Section 1: Current material */}
      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('entityCard.materials.currentSection')}
        </h4>
        {materialId ? (
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
            <span className="font-medium text-foreground">
              {isPreset
                ? t(`wallAdvancedPanel.materials.preset.${materialId}`, { defaultValue: '' }) || materialId
                : materialId}
            </span>
            {!isPreset && (
              <span className="ml-2 text-xs text-muted-foreground">
                ({t('entityCard.materials.customLabel')})
              </span>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">{t('entityCard.materials.empty')}</p>
        )}
      </section>

      {/* Section 2: Alternatives */}
      {alternatives.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('entityCard.materials.alternativesSection')}
          </h4>
          <ul className="flex flex-col gap-1">
            {alternatives.map((opt) => (
              <li
                key={opt.id}
                className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted/50"
              >
                {t(`wallAdvancedPanel.materials.preset.${opt.id}`, { defaultValue: '' }) || opt.id}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Section 3: DNA multi-layer composition */}
      {hasMultiLayer && dna && (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('entityCard.materials.multiLayerSection')}
          </h4>
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
            {dna.layers.map((layer, idx) => (
              <Fragment key={layer.id}>
                <dt className="text-muted-foreground">
                  {t('entityCard.materials.layerLabel', { index: idx + 1 })}
                  {layer.name ? ` — ${layer.name}` : ''}
                </dt>
                <dd className="font-mono text-foreground text-right">{layer.thickness} mm</dd>
              </Fragment>
            ))}
          </dl>
        </section>
      )}

      {/* Section 4: Cost rollup — Phase 6+ */}
      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('entityCard.materials.costRollupSection')}
        </h4>
        <p className="text-xs text-muted-foreground">
          {t('entityCard.materials.costPerUnit')}: —
        </p>
      </section>
    </div>
  );
}
