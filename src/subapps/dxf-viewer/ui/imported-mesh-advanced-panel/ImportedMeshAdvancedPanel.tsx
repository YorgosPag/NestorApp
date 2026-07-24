'use client';

/**
 * ADR-683 Φ3.1γ (B1) — left-sidebar Properties panel for a selected
 * `ImportedMeshEntity`. Mirrors `RailingAdvancedPanel` (ADR-407 Φ9) /
 * `BlockAdvancedPanel` (ADR-641) — same `containerClassName` contract so the
 * sidebar tab host treats every BIM per-type panel identically.
 *
 * Widget choice (documented in `imported-mesh-param-keys.ts` for B1/B2):
 * position/elevation/rotation are CONTINUOUS coordinates, not a discrete
 * engineering ladder, so this panel reuses the generic `EntityPropertySection`
 * / `EntityPropertyRow` (`control:'numeric'`) — the SAME free-typed-input
 * engine `BlockAdvancedPanel` uses for its INSERT transform — instead of the
 * select-only `BimPropertyRow` (railing's widget, which fits a finite ladder).
 *
 * Read/write goes through the ONE imported-mesh param SSoT
 * (`readImportedMeshField` / `patchImportedMeshField`, ADR-683 Φ3.1γ A1) so
 * this component never touches `ImportedMeshParams` fields directly.
 *
 * ⚠️ No `scale` control: `ImportedMeshParams` has no resize field at all —
 * `UpdateImportedMeshParamsCommand.validate()` REJECTS any change to the
 * measured dimensions (ADR-683 §3). The pre-allocated
 * `importedMeshAdvancedPanel.field.scale` i18n key is intentionally unused
 * here; see this file's PR notes.
 *
 * «Υλικό»/«Υλικά ανά κομμάτι»/«Προμέτρηση» are NOT part of the generic
 * descriptor table — a swatch + fallback text, a literal per-slot name list,
 * and a literal identity summary respectively don't fit the single
 * label+value row shape, so they render as small dedicated sections below.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { EntityPropertySection } from '../entity-properties/EntityPropertyRow';
import { MaterialSwatch } from '../components/shared/MaterialSwatch';
import { resolveEntityCurrentMaterialId } from '../../bim-3d/materials/resolve-entity-current-material';
import {
  IMPORTED_MESH_NUMBER_KEYS,
  IMPORTED_MESH_READONLY_KEYS,
} from '../../bim/entities/imported-mesh/imported-mesh-param-keys';
import {
  readImportedMeshField,
  patchImportedMeshField,
} from '../../bim/entities/imported-mesh/imported-mesh-param-access';
import type { ImportedMeshEntity } from '../../bim/entities/imported-mesh/imported-mesh-types';
import type { DispatchImportedMeshParamPatch } from './commands/dispatchImportedMeshParamPatch';
import type { EntityPropertyField, EntityPropertyGroup } from '../entity-properties/entity-property-fields';
import type { RibbonComboboxState } from '../ribbon/context/RibbonCommandContext';
import type { RibbonNumericInputConfig } from '../ribbon/types/ribbon-types';

/** Editable signed continuous coordinate/elevation (mirror block's COORD_INPUT). */
const COORD_INPUT: RibbonNumericInputConfig = { editable: true, allowNegative: true, allowDecimal: true };
/** Editable rotation in degrees (signed). */
const ANGLE_INPUT: RibbonNumericInputConfig = { editable: true, allowNegative: true, allowDecimal: true };

const field = (
  commandKey: string,
  labelKey: string,
  control: EntityPropertyField['control'],
  numericInput?: RibbonNumericInputConfig,
): EntityPropertyField => ({ commandKey, labelKey, control, options: [], numericInput });

const IDENTITY_GROUP: EntityPropertyGroup = {
  id: 'identity',
  titleKey: 'importedMeshAdvancedPanel.section.identity',
  fields: [
    field(IMPORTED_MESH_READONLY_KEYS.name, 'importedMeshAdvancedPanel.field.name', 'readout'),
    field(IMPORTED_MESH_READONLY_KEYS.level, 'importedMeshAdvancedPanel.field.level', 'readout'),
  ],
};

const TRANSFORM_GROUP: EntityPropertyGroup = {
  id: 'transform',
  titleKey: 'importedMeshAdvancedPanel.section.transform',
  fields: [
    field(IMPORTED_MESH_NUMBER_KEYS.posX, 'importedMeshAdvancedPanel.field.posX', 'numeric', COORD_INPUT),
    field(IMPORTED_MESH_NUMBER_KEYS.posY, 'importedMeshAdvancedPanel.field.posY', 'numeric', COORD_INPUT),
    field(IMPORTED_MESH_NUMBER_KEYS.elevation, 'importedMeshAdvancedPanel.field.posZ', 'numeric', COORD_INPUT),
    field(IMPORTED_MESH_NUMBER_KEYS.rotation, 'importedMeshAdvancedPanel.field.rotation', 'numeric', ANGLE_INPUT),
  ],
};

const DIMENSIONS_GROUP: EntityPropertyGroup = {
  id: 'dimensions',
  titleKey: 'importedMeshAdvancedPanel.section.dimensions',
  fields: [
    field(IMPORTED_MESH_READONLY_KEYS.width, 'importedMeshAdvancedPanel.field.width', 'readout'),
    field(IMPORTED_MESH_READONLY_KEYS.depth, 'importedMeshAdvancedPanel.field.depth', 'readout'),
    field(IMPORTED_MESH_READONLY_KEYS.height, 'importedMeshAdvancedPanel.field.height', 'readout'),
  ],
};

export interface ImportedMeshAdvancedPanelProps {
  readonly mesh: ImportedMeshEntity;
  readonly dispatchPatch: DispatchImportedMeshParamPatch;
  /** Override container className (sidebar-tab mode passes a flow-layout class). */
  readonly containerClassName?: string;
}

/** «Υλικό» — dominant source material as a swatch (live override, ADR-687 Φ8) + name/fallback text. */
function MaterialSection({ mesh, t }: { mesh: ImportedMeshEntity; t: (key: string) => string }): React.ReactElement {
  const materialId = resolveEntityCurrentMaterialId(mesh) ?? undefined;
  const sourceName = readImportedMeshField(IMPORTED_MESH_READONLY_KEYS.currentMaterial, mesh.params);
  return (
    <section className="flex flex-col gap-1">
      <header>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('importedMeshAdvancedPanel.section.material')}
        </h4>
      </header>
      <div className="flex items-center justify-between gap-2 py-0.5">
        <span className="truncate text-xs text-muted-foreground">
          {t('importedMeshAdvancedPanel.field.currentMaterial')}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <MaterialSwatch materialId={materialId} />
          <span className="text-xs font-medium text-foreground">
            {sourceName ?? t('importedMeshAdvancedPanel.field.noMaterial')}
          </span>
        </span>
      </div>
    </section>
  );
}

/** «Υλικά ανά κομμάτι» — per-slot .glb material names (literal, ADR-683 Φ5); hidden when single/anonymous. */
function PartsSection({ mesh, t }: { mesh: ImportedMeshEntity; t: (key: string) => string }): React.ReactElement | null {
  const slots = mesh.params.materialSlots ?? [];
  if (slots.length === 0) return null;
  return (
    <section className="flex flex-col gap-1">
      <header>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('importedMeshAdvancedPanel.section.parts')}
        </h4>
      </header>
      <ul className="flex flex-col gap-0.5">
        {slots.map((slotName) => (
          <li key={slotName} className="truncate text-xs text-foreground">{slotName}</li>
        ))}
      </ul>
    </section>
  );
}

/** «Προμέτρηση» — BOQ costing identity (literal ATOE code/title/unit, ADR-683 §10.2); hidden when unassigned. */
function BoqSection({ mesh, t }: { mesh: ImportedMeshEntity; t: (key: string) => string }): React.ReactElement | null {
  const identity = mesh.params.importedMeshIdentity;
  if (!identity) return null;
  return (
    <section className="flex flex-col gap-1">
      <header>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('importedMeshAdvancedPanel.section.boq')}
        </h4>
      </header>
      <p className="text-xs text-foreground">
        {identity.categoryCode} · {identity.titleEL} ({identity.unit})
      </p>
    </section>
  );
}

export function ImportedMeshAdvancedPanel({
  mesh,
  dispatchPatch,
  containerClassName,
}: ImportedMeshAdvancedPanelProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const resolvedClassName = containerClassName ?? 'flex flex-col gap-3 p-2';

  const getComboboxState = (commandKey: string): RibbonComboboxState | null => (
    { value: readImportedMeshField(commandKey, mesh.params), options: [] }
  );
  const onComboboxChange = (commandKey: string, value: string): void => {
    dispatchPatch(mesh, patchImportedMeshField(commandKey, mesh.params, value));
  };

  return (
    <section className={resolvedClassName}>
      {[IDENTITY_GROUP, TRANSFORM_GROUP, DIMENSIONS_GROUP].map((group) => (
        <EntityPropertySection
          key={group.id}
          title={t(group.titleKey)}
          group={group}
          getComboboxState={getComboboxState}
          onComboboxChange={onComboboxChange}
        />
      ))}
      <MaterialSection mesh={mesh} t={t} />
      <PartsSection mesh={mesh} t={t} />
      <BoqSection mesh={mesh} t={t} />
    </section>
  );
}
