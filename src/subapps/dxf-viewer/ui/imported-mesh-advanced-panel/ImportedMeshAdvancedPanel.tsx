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
 *
 * ADR-683 Φ3.1γ follow-up (6 fixes on top of the original B1 panel):
 *  - `displayName` (click-to-edit, `control:'rename'`) is a NEW writable identity row — separate
 *    from the still-read-only `nodeName` (labelled "source name" here to disambiguate the two).
 *  - The `level` readout now shows the resolved `Level.name` (threaded in as `levelName` by
 *    `ImportedMeshPropertiesTab`), not the raw `storeyId`.
 *  - «Υλικό» resolves the LIVE override label (via `libraryEntries`, ADR-687 Φ8 general library),
 *    not just the raw embedded `.glb` material name — reading the FULL applied-material SET
 *    (`resolveEntityMaterialIdSet`, ADR-688 follow-up) so a multi-slot mesh with only one part
 *    painted shows «multiple materials» instead of silently reporting just the base slot.
 *  - Position/elevation now go through the SAME display-unit boundary (`toDisp`/`fromDisp`) and
 *    rotation the same `formatAngleValue` rounding `BlockAdvancedPanel` uses for its INSERT
 *    transform — the SSoT (`readImportedMeshField`/`patchImportedMeshField`) itself stays
 *    canonical-mm; the conversion happens ONLY at this UI boundary, exactly like Block's bridge.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { EntityPropertySection } from '../entity-properties/EntityPropertyRow';
import { MaterialSwatch } from '../components/shared/MaterialSwatch';
import { resolveEntityMaterialIdSet } from '../../bim-3d/materials/resolve-entity-current-material';
import { toDisp, fromDisp } from '../ribbon/units/ribbon-display-unit';
import { formatAngleValue } from '../../config/units';
import {
  IMPORTED_MESH_NUMBER_KEYS,
  IMPORTED_MESH_READONLY_KEYS,
  IMPORTED_MESH_STRING_KEYS,
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
import type { LibraryEntry } from '../../bim-3d/ui/material-library-index';

/** Editable signed continuous coordinate/elevation (mirror block's COORD_INPUT). */
const COORD_INPUT: RibbonNumericInputConfig = { editable: true, allowNegative: true, allowDecimal: true };
/** Editable rotation in degrees (signed). */
const ANGLE_INPUT: RibbonNumericInputConfig = { editable: true, allowNegative: true, allowDecimal: true };

/** Placeholder dash for an unresolved readout — same glyph `InlineRenameRow` already falls back to. */
const UNKNOWN_READOUT = '—';

/** posX/posY/elevation are model-length mm — the fields that flow through the display unit. */
const DISPLAY_UNIT_KEYS: ReadonlySet<string> = new Set([
  IMPORTED_MESH_NUMBER_KEYS.posX,
  IMPORTED_MESH_NUMBER_KEYS.posY,
  IMPORTED_MESH_NUMBER_KEYS.elevation,
]);

/**
 * SSoT canonical-mm string (from `readImportedMeshField`) → what the palette shows. Mirrors
 * `useBlockPropertyBridge.getComboboxState`'s manual `toDisp`/`formatAngleValue` calls — the
 * `EntityPropertyRow` engine itself has no `quantityKind` concept (that's a ribbon-combobox-only
 * mechanism), so Block does the conversion at the bridge boundary, and this panel does the same.
 */
function formatTransformDisplay(commandKey: string, raw: string | null): string | null {
  if (raw === null) return null;
  if (DISPLAY_UNIT_KEYS.has(commandKey)) return toDisp(Number(raw));
  if (commandKey === IMPORTED_MESH_NUMBER_KEYS.rotation) return formatAngleValue(Number(raw));
  return raw;
}

/** Typed display-unit string → canonical mm string for `patchImportedMeshField`. Inverse of the above. */
function parseTransformInput(commandKey: string, value: string): string {
  return DISPLAY_UNIT_KEYS.has(commandKey) ? String(fromDisp(value)) : value;
}

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
    // Click-to-edit display identity (NEW, ADR-683 Φ3.1γ follow-up) — falls back to nodeName.
    field(IMPORTED_MESH_STRING_KEYS.displayName, 'importedMeshAdvancedPanel.field.displayName', 'rename'),
    // The immutable `.glb` node identity — labelled "source name" now that `displayName` owns
    // the primary "name" row (avoids two rows both reading "Name").
    field(IMPORTED_MESH_READONLY_KEYS.name, 'importedMeshAdvancedPanel.field.sourceName', 'readout'),
    field(IMPORTED_MESH_READONLY_KEYS.level, 'importedMeshAdvancedPanel.field.level', 'readout'),
  ],
};

const TRANSFORM_GROUP: EntityPropertyGroup = {
  id: 'transform',
  titleKey: 'importedMeshAdvancedPanel.section.transform',
  fields: [
    field(IMPORTED_MESH_NUMBER_KEYS.posX, 'importedMeshAdvancedPanel.field.posX', 'numeric', COORD_INPUT),
    field(IMPORTED_MESH_NUMBER_KEYS.posY, 'importedMeshAdvancedPanel.field.posY', 'numeric', COORD_INPUT),
    // `field.elevation` (not the old `field.posZ`) — matches the label the contextual ribbon tab
    // already uses for this same commandKey (`contextual-imported-mesh-tab.ts`), so palette and
    // ribbon never disagree about what this field is called.
    field(IMPORTED_MESH_NUMBER_KEYS.elevation, 'importedMeshAdvancedPanel.field.elevation', 'numeric', COORD_INPUT),
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
  /**
   * ADR-683 Φ3.1γ follow-up — resolved `Level.name` for the identity readout (threaded from
   * `ImportedMeshPropertiesTab`, mirror of how `level` is resolved everywhere else in the shell —
   * see `overlay-store.tsx` / `useFloorplanBackgroundForLevel`). `undefined`/`null` → «—».
   */
  readonly levelName?: string | null;
  /**
   * ADR-687 Φ8 — the general material library (catalog + user Firestore + paints), ONE union, so
   * «Υλικό» can resolve the LIVE override's display label instead of just its raw id. Optional:
   * when the caller cannot supply it yet, the section falls back to the embedded `.glb` name.
   */
  readonly libraryEntries?: readonly LibraryEntry[];
}

/** The library entry for the applied override materialId — drives BOTH the display label AND the
 * swatch appearance (`appearance`/`thumbnailUrl`/`color`), so the panel chip renders the SAME real
 * material as the «Υλικά όψης» bar instead of the neutral-grey `materialId`-only fallback. */
function findOverrideEntry(
  materialId: string | undefined,
  libraryEntries: readonly LibraryEntry[] | undefined,
): LibraryEntry | undefined {
  if (!materialId || !libraryEntries) return undefined;
  return libraryEntries.find((entry) => entry.id === materialId);
}

/**
 * «Υλικό» — the CURRENT material(s) as a swatch + display name. Reads the FULL applied-material
 * set (`resolveEntityMaterialIdSet`, ADR-688 follow-up) — the same set the 3D renderer's per-slot
 * cascade (`resolveSlotMaterial`: `appearance[slot:name] ?? appearance['*'] ?? embedded`) actually
 * paints — instead of just the base `'*'` slot. For a named-multi-slot `.glb` with only ONE part
 * painted, the base-only read used to disagree with the canvas; this panel now matches it exactly:
 *   - 0 overrides → embedded `.glb` source material name → «no material».
 *   - 1 override → its library label + swatch (unchanged single-material UX).
 *   - 2+ overrides (different materials on different slots) → «multiple materials», no single swatch
 *     (a single swatch would misrepresent a mesh painted with more than one material).
 */
function MaterialSection({
  mesh, t, libraryEntries,
}: {
  mesh: ImportedMeshEntity;
  t: (key: string) => string;
  libraryEntries?: readonly LibraryEntry[];
}): React.ReactElement {
  const materialIds = resolveEntityMaterialIdSet(mesh);
  const sourceName = readImportedMeshField(IMPORTED_MESH_READONLY_KEYS.currentMaterial, mesh.params);
  const isMultiple = materialIds.length > 1;
  const singleMaterialId = materialIds.length === 1 ? materialIds[0] : undefined;
  const entry = findOverrideEntry(singleMaterialId, libraryEntries);
  const displayLabel = isMultiple
    ? t('importedMeshAdvancedPanel.field.multipleMaterials')
    : entry?.label ?? sourceName ?? t('importedMeshAdvancedPanel.field.noMaterial');
  return (
    <section className="flex flex-col gap-1">
      <header>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('importedMeshAdvancedPanel.section.material')}
        </h4>
      </header>
      <div className="flex flex-col gap-1 py-0.5">
        <span className="truncate text-xs text-muted-foreground">
          {t('importedMeshAdvancedPanel.field.currentMaterial')}
        </span>
        <div className="flex items-center gap-2">
          {!isMultiple && (
            <MaterialSwatch
              sphere
              className="!h-16 !w-16 rounded-md"
              materialId={entry?.materialId ?? singleMaterialId}
              category={entry?.category}
              thumbnailUrl={entry?.thumbnailUrl}
              albedoUrl={entry?.albedoUrl}
              appearance={entry?.appearance}
              color={entry?.color}
            />
          )}
          <span className="truncate text-xs font-medium text-foreground">{displayLabel}</span>
        </div>
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
  levelName,
  libraryEntries,
}: ImportedMeshAdvancedPanelProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const resolvedClassName = containerClassName ?? 'flex flex-col gap-3 p-2';

  const getComboboxState = (commandKey: string): RibbonComboboxState | null => {
    // The `level` readout shows the resolved Level NAME (threaded in from the tab), not the raw
    // `storeyId` the SSoT stores — special-cased here, same as `useBlockPropertyBridge` special-
    // cases `layer` (id → live name) before falling through to the generic SSoT read.
    if (commandKey === IMPORTED_MESH_READONLY_KEYS.level) {
      return { value: levelName && levelName.length > 0 ? levelName : UNKNOWN_READOUT, options: [] };
    }
    const raw = readImportedMeshField(commandKey, mesh.params);
    return { value: formatTransformDisplay(commandKey, raw), options: [] };
  };
  const onComboboxChange = (commandKey: string, value: string): void => {
    const mmValue = parseTransformInput(commandKey, value);
    dispatchPatch(mesh, patchImportedMeshField(commandKey, mesh.params, mmValue));
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
      <MaterialSection mesh={mesh} t={t} libraryEntries={libraryEntries} />
      <PartsSection mesh={mesh} t={t} />
      <BoqSection mesh={mesh} t={t} />
    </section>
  );
}
