'use client';

/**
 * ADR-507 — sidebar «Properties» tab για ΓΡΑΜΜΟΣΚΙΑΣΗ. Mounted από τον
 * `BimPropertiesRouter` όταν το primary-selected entity είναι hatch, ή σε
 * **draft mode** όταν το εργαλείο «Γραμμοσκίαση» είναι ενεργό χωρίς επιλογή
 * (Revit-style «διάλεξε ιδιότητες → σχεδίασε»). Mirror του `LinePropertiesTab` /
 * `ColumnPropertiesTab`.
 *
 * SSoT: read/write μέσω του ΙΔΙΟΥ `useRibbonHatchBridge` που τροφοδοτεί το ribbon
 * (dual-mode: επιλεγμένο → `UpdateEntityCommand`, χωρίς επιλογή → draw-defaults) →
 * ribbon & αριστερό panel ποτέ δεν αποκλίνουν. Descriptor = `hatch-property-fields.ts`.
 *
 * Reactive: re-derive από το `currentScene` prop (re-render σε κάθε param edit)· τα
 * draw-defaults/gradient-visibility τα subscribe-άρει το ίδιο το bridge.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useLevels } from '../../systems/levels';
import { isHatchEntity } from '../../types/entities';
import { useRibbonHatchBridge } from '../ribbon/hooks/useRibbonHatchBridge';
import { EntityPropertySection } from '../entity-properties/EntityPropertyRow';
import { MaterialImagePicker } from './MaterialImagePicker';
import { HATCH_RIBBON_KEYS } from '../ribbon/hooks/bridge/hatch-command-keys';
import { HATCH_PROPERTY_GROUPS, HATCH_SELECTION_ONLY_KEYS } from './hatch-property-fields';
import type { EntityPropertyGroup } from '../entity-properties/entity-property-fields';
import type { SceneModel } from '../../types/scene';
import type { HatchEntity } from '../../types/entities';

export interface HatchPropertiesTabProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly projectId?: string;
  readonly floorplanId?: string;
  /** Draft mode: εργαλείο «Γραμμοσκίαση» ενεργό χωρίς επιλογή → ρύθμιση draw-defaults. */
  readonly draftMode?: boolean;
}

/** Draft mode: κρύψε τα selection-only πεδία (transparency / πίσω πλάνο / εμβαδόν). */
function forDraft(group: EntityPropertyGroup): EntityPropertyGroup {
  return { ...group, fields: group.fields.filter((f) => !HATCH_SELECTION_ONLY_KEYS.has(f.commandKey)) };
}

export function HatchPropertiesTab({
  primarySelectedId,
  currentScene,
  projectId,
  draftMode,
}: HatchPropertiesTabProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const levelManager = useLevels();

  // Ίδιο minimal selection view με το LinePropertiesTab — το bridge διαβάζει το primary id.
  const universalSelection = React.useMemo(
    () => ({ getPrimaryId: () => primarySelectedId }),
    [primarySelectedId],
  );
  const bridge = useRibbonHatchBridge({ levelManager, universalSelection });

  const hatch = React.useMemo<HatchEntity | null>(() => {
    if (!primarySelectedId || !currentScene) return null;
    const entity = currentScene.entities.find((e) => e.id === primarySelectedId);
    return entity && isHatchEntity(entity) ? entity : null;
  }, [primarySelectedId, currentScene]);

  const toggle = React.useMemo(
    () => ({ getToggleState: bridge.getToggleState, onToggle: bridge.onToggle }),
    [bridge],
  );

  // Gradient group gated από το bridge· στο draft mode πέφτουν τα selection-only πεδία.
  const visibleGroups = HATCH_PROPERTY_GROUPS
    .filter((g) => !g.visibilityKey || bridge.getPanelVisibility(g.visibilityKey))
    .map((g) => (draftMode ? forDraft(g) : g))
    .filter((g) => g.fields.length > 0);

  if (!hatch && !draftMode) {
    return (
      <p className="px-3 py-6 text-center text-xs text-muted-foreground">
        {t('hatchAdvancedPanel.emptyState')}
      </p>
    );
  }

  return (
    <section aria-label={t('hatchAdvancedPanel.title')} className="flex flex-col gap-3 p-2">
      {visibleGroups.map((g) => (
        <React.Fragment key={g.id}>
          {/* ADR-643 Φ3 — visual swatch grid πάνω από τις διαστάσεις, μόνο στο image group. */}
          {g.id === 'image' && (
            <MaterialImagePicker
              selectedAssetId={bridge.getComboboxState(HATCH_RIBBON_KEYS.stringParams.imageAsset)?.value ?? ''}
              onSelect={(id) => bridge.onComboboxChange(HATCH_RIBBON_KEYS.stringParams.imageAsset, id)}
              projectId={projectId}
            />
          )}
          <EntityPropertySection
            title={t(g.titleKey)}
            group={g}
            getComboboxState={bridge.getComboboxState}
            onComboboxChange={bridge.onComboboxChange}
            toggle={toggle}
          />
        </React.Fragment>
      ))}
    </section>
  );
}
