'use client';

/**
 * ADR-510 Φ2E #4 — inline «Τμήματα Μοτίβου» tab (left Properties palette).
 *
 * When a style-editable primitive (line/polyline/circle/…) is the primary
 * selection, the left Properties palette surfaces its linetype pattern as an
 * editable segment list (Dash/Gap/Dot + mm). Figma-grade live edit: every change
 * applies to the line immediately.
 *
 * READ: the dash pattern is DERIVED from `entity.linetypeName` (the SSoT) via the
 * ONE `resolveLinetypeDef` name→def resolver → `dashPatternToSegments`. Solid /
 * Continuous / ByLayer / unknown ⇒ empty list + an affordance to author one.
 *
 * EDIT (copy-on-write, ΧΩΡΙΣ data-model change): the pattern is named+shared, so
 * editing a shared ISO linetype must NOT mutate it. On the first edit we fork into
 * a deterministic per-line OWNED name (`linePatternName`) and assign it via the
 * undoable `UpdateEntityCommand`; subsequent edits update that owned name IN PLACE
 * (`upsertUserLinetype`). Re-render: the fork changes `linetypeName` (entity change
 * → bitmap invalidate); same-name refinements repaint via the registry→bitmap-cache
 * subscription (`useDxfCanvasCacheInvalidation`, ADR-510 Φ2E #4). Shared ISO of
 * other lines is never touched.
 *
 * Reactive like `ColumnPropertiesTab`: re-derives from the `currentScene` prop and
 * subscribes to the LinetypeRegistry (low-frequency) so same-name upserts refresh
 * the shown segments.
 *
 * ADR-510 Φ2E #5 — AutoCAD-grade Properties palette: beyond «Τμήματα Μοτίβου», the
 * tab now hosts the FULL per-object surface (Γενικά + Γεωμετρία), migrated off the
 * overcrowded ribbon. Fields are descriptor-driven (`line-property-fields.ts`) and
 * read/write through the SAME `useRibbonLineToolBridge` the ribbon uses (one SSoT).
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useLevels } from '../../systems/levels';
import { isStyleEditablePrimitiveType } from '../../types/style-editable-primitives';
import {
  type LinePatternSegment,
  segmentsToDashPattern,
  dashPatternToSegments,
  describeSegments,
  linePatternName,
} from '../../config/line-pattern-segments';
import { resolveLinetypeDef } from '../../rendering/linetype-dash-resolver';
import {
  upsertUserLinetype,
  subscribeLinetypeRegistry,
  getLinetypeRegistrySnapshot,
} from '../../stores/LinetypeRegistry';
import { useEntityPatchCommand } from '../../hooks/commands/useEntityPatchCommand';
import {
  LinePatternSegmentsEditor,
  buildLinePatternSegmentsLabels,
} from '../panels/dimensions/LinePatternSegmentsEditor';
// ADR-510 Φ2E #5 — full per-object fields (Γενικά/Γεωμετρία) via the shared bridge.
import { useRibbonLineToolBridge } from '../ribbon/hooks/useRibbonLineToolBridge';
import { LINE_PROPERTY_GROUPS, LINE_SELECTION_ONLY_KEYS } from './line-property-fields';
import { LinePropertySection } from './LinePropertyRow';
import type { LinePropertyGroup } from './line-property-fields';
import type { SceneModel } from '../../types/scene';

export interface LinePropertiesTabProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly projectId?: string;
  readonly floorplanId?: string;
  /**
   * ADR-510 Φ2E #6 — draft mode: a line/primitive drawing tool is active with NO
   * selection → show «Γενικά» bound to draw-defaults (Revit «όρισε ιδιότητες →
   * σχεδίασε», mirror τοίχου/γραμμοσκίασης). Selection-only sections/fields drop.
   */
  readonly draftMode?: boolean;
}

/** Draft mode: keep only the fields that have a draw-default write path. */
function forDraft(group: LinePropertyGroup): LinePropertyGroup {
  return { ...group, fields: group.fields.filter((f) => !LINE_SELECTION_ONLY_KEYS.has(f.commandKey)) };
}

export function LinePropertiesTab({
  primarySelectedId,
  currentScene,
  draftMode,
}: LinePropertiesTabProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-panels');
  const e = (k: string) => t(`panels.dimensions.linePatternEditor.${k}`);
  const levelManager = useLevels();
  const patchEntity = useEntityPatchCommand(levelManager);

  // ADR-510 Φ2E #5 — the SAME bridge the ribbon uses (dual-mode). We feed it a
  // minimal selection view (this tab already knows the primary id) so its
  // get/onComboboxChange read/write the selected line — one SSoT, undoable.
  const universalSelection = React.useMemo(
    () => ({ getPrimaryId: () => primarySelectedId }),
    [primarySelectedId],
  );
  const bridge = useRibbonLineToolBridge({ levelManager, universalSelection });

  // Low-frequency reactivity to registry PATTERN edits: a same-name COW upsert
  // notifies here so the shown segments re-derive (the entity ref is unchanged).
  const registrySnapshot = React.useSyncExternalStore(
    subscribeLinetypeRegistry,
    getLinetypeRegistrySnapshot,
    getLinetypeRegistrySnapshot,
  );

  const entity = React.useMemo(() => {
    if (!primarySelectedId || !currentScene) return null;
    const found = currentScene.entities.find((x) => x.id === primarySelectedId);
    return found && isStyleEditablePrimitiveType(found.type) ? found : null;
  }, [primarySelectedId, currentScene]);

  const segments = React.useMemo<LinePatternSegment[]>(() => {
    if (!entity) return [];
    const pattern = resolveLinetypeDef(entity.linetypeName)?.pattern ?? [];
    return dashPatternToSegments(pattern);
    // registrySnapshot is a dep so a same-name upsert re-derives (entity ref stable).
  }, [entity, registrySnapshot]);

  const applyPattern = React.useCallback(
    (next: LinePatternSegment[]) => {
      if (!entity) return;
      const pattern = segmentsToDashPattern(next);
      const targetName = linePatternName(entity.id);
      // COW: own a per-line linetype (create-or-update-in-place), never the shared ISO.
      upsertUserLinetype(targetName, pattern, describeSegments(next));
      // First edit off a shared/other name → fork + assign (undoable, re-renders on
      // the linetypeName change); same owned name → the upsert above already repaints.
      if (entity.linetypeName !== targetName) {
        patchEntity(entity.id, { linetypeName: targetName }, 'Edit line pattern');
      }
    },
    [entity, patchEntity],
  );

  // Draft mode (tool active, no selection) still renders — showing draw-defaults.
  if (!entity && !draftMode) {
    return (
      <p className="px-3 py-6 text-center text-xs text-muted-foreground">
        {e('inlineTab.emptyState')}
      </p>
    );
  }

  const rawGeneral = LINE_PROPERTY_GROUPS.find((g) => g.id === 'general');
  // In draft mode drop selection-only fields (transparency) → only actionable defaults.
  const generalGroup = rawGeneral && (draftMode ? forDraft(rawGeneral) : rawGeneral);
  // Geometry (line-only) + polyline width (polyline-only) — gated via the SAME
  // panel-visibility predicate the ribbon used (`getPanelVisibility`). Rendered only
  // for a real selection: geometry has no draw-default meaning (Revit/AutoCAD parity).
  const gatedGroups = entity
    ? LINE_PROPERTY_GROUPS.filter(
        (g) => g.id !== 'general' && (!g.visibilityKey || bridge.getPanelVisibility(g.visibilityKey)),
      )
    : [];

  return (
    <section aria-label={e('inlineTab.title')} className="flex flex-col gap-3 p-2">
      {generalGroup && (
        <LinePropertySection
          title={t(generalGroup.titleKey)}
          group={generalGroup}
          getComboboxState={bridge.getComboboxState}
          onComboboxChange={bridge.onComboboxChange}
        />
      )}

      {/* «Τμήματα Μοτίβου» — selection-only (per-line COW edit); hidden in draft. */}
      {entity && (
        <div className="flex flex-col gap-1">
          <LinePatternSegmentsEditor
            segments={segments}
            onChange={applyPattern}
            labels={buildLinePatternSegmentsLabels(e)}
            allowText={false}
          />
          {segments.length === 0 && (
            <p className="px-1 text-xs text-muted-foreground">{e('inlineTab.hint')}</p>
          )}
        </div>
      )}

      {gatedGroups.map((g) => (
        <LinePropertySection
          key={g.id}
          title={t(g.titleKey)}
          group={g}
          getComboboxState={bridge.getComboboxState}
          onComboboxChange={bridge.onComboboxChange}
        />
      ))}
    </section>
  );
}
