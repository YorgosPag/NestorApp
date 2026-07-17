'use client';

/**
 * ADR-674 Φ C — «Edit Opening Hardware» dialog (INSTANCE-level override).
 *
 * Edits ONE placed opening's `params.hardwareOverrides` («this door: 4
 * hinges», not every door of the type). Sibling of `EditOpeningTypeDialog`
 * (which edits `typeParams.hardwareOverrides` — TYPE-wide) but scoped to a
 * single entity id via `edit-opening-hardware-store`. The resolver
 * (`resolveOpeningHardwareSet`) folds catalog → type → instance, LAST wins,
 * so this dialog's writes always take final precedence for this one opening.
 *
 * One undoable op via `useOpeningParamsDispatcher` → `UpdateOpeningParamsCommand`
 * (optimistic store + persist + BOQ re-feed). Mounted always-on in
 * `OpeningPersistenceHost`; opened via `openEditOpeningHardware(opening.id)`
 * from the contextual ribbon (`RibbonOpeningHardwareWidget`).
 *
 * @see ../../../bim/family-types/edit-opening-hardware-store.ts
 * @see ../hooks/bridge/useOpeningParamsDispatcher.ts — SSoT writer
 * @see ./OpeningHardwareSetEditor.tsx — shared quantity-row editor block
 * @see ./EditOpeningTypeDialog.tsx — TYPE-level sibling (mirror of this dialog's chrome)
 */

import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Wrench } from 'lucide-react';
import { FloatingPanel } from '@/components/ui/floating';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { PanelPositionCalculator } from '../../../config/panel-tokens';
import {
  closeEditOpeningHardware,
  getEditOpeningHardwareState,
  subscribeEditOpeningHardware,
} from '../../../bim/family-types/edit-opening-hardware-store';
import { useOpeningParamsDispatcher } from '../hooks/bridge/useOpeningParamsDispatcher';
import { OpeningHardwareSetEditor } from './OpeningHardwareSetEditor';
import type { OpeningHardwareComponent } from '../../../bim/family-types/opening-hardware-set';
import type { OpeningEntity, OpeningHardwareOverrides } from '../../../bim/types/opening-types';
import type { LevelSceneWriter } from '../../../systems/levels/level-scene-accessor';

/** Floating-panel size (px) — used for drag-bounds + top-right anchoring. */
const PANEL_DIMENSIONS = { width: 380, height: 360 } as const;
/** SSR-safe fallback; the real spot is computed client-side (top-right). */
const SSR_FALLBACK_POSITION = { x: 220, y: 80 } as const;
const getClientPosition = (): { x: number; y: number } =>
  PanelPositionCalculator.getTopRightPosition(PANEL_DIMENSIONS.width);

export interface EditOpeningHardwareDialogProps {
  readonly opening: OpeningEntity | null;
  readonly levelManager: LevelSceneWriter;
}

export function EditOpeningHardwareDialog({
  opening,
  levelManager,
}: EditOpeningHardwareDialogProps): React.ReactElement | null {
  const state = useSyncExternalStore(
    subscribeEditOpeningHardware,
    getEditOpeningHardwareState,
    getEditOpeningHardwareState,
  );

  // Non-modal panel: nothing to show once the dialog is closed, there's no
  // selected opening, or the selection moved away from the opening the dialog
  // was opened for.
  if (!state.open || !opening || state.openingId !== opening.id) return null;

  return <EditOpeningHardwareDialogContent opening={opening} levelManager={levelManager} />;
}

interface EditOpeningHardwareDialogContentProps {
  readonly opening: OpeningEntity;
  readonly levelManager: LevelSceneWriter;
}

function EditOpeningHardwareDialogContent({
  opening,
  levelManager,
}: EditOpeningHardwareDialogContentProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const dispatch = useOpeningParamsDispatcher({ levelManager });

  // Independent deep copy so editing the draft can NEVER bleed into the live
  // store object (Cancel must fully discard).
  const [draft, setDraft] = useState<OpeningHardwareOverrides>(() =>
    structuredClone(opening.params.hardwareOverrides ?? {}),
  );

  // (Re)seed the draft (deep copy) when the selected opening changes.
  useEffect(() => {
    setDraft(structuredClone(opening.params.hardwareOverrides ?? {}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opening.id]);

  const onClose = useCallback(() => closeEditOpeningHardware(), []);

  // Per-component hardware quantity override (ADR-674 Φ C). Immutable patch;
  // `undefined` deletes the key entirely so `resolveOpeningHardwareSet` falls
  // back to the type/catalog default (zero regression).
  const setHardwareOverride = useCallback(
    (component: OpeningHardwareComponent, quantity: number | undefined) =>
      setDraft((d) => {
        const next = { ...d };
        if (quantity === undefined) delete next[component];
        else next[component] = quantity;
        return next;
      }),
    [],
  );

  const onSave = useCallback(() => {
    dispatch(opening, {
      ...opening.params,
      // An empty draft clears the field entirely rather than persisting `{}`
      // — same "zero regression" contract as the TYPE-level dialog.
      hardwareOverrides: Object.keys(draft).length > 0 ? draft : undefined,
    });
    closeEditOpeningHardware();
  }, [dispatch, opening, draft]);

  const title = t('ribbon.commands.bimFamilyType.editOpeningHardwareTitle');

  return (
    <FloatingPanel
      defaultPosition={SSR_FALLBACK_POSITION}
      dimensions={PANEL_DIMENSIONS}
      onClose={onClose}
      draggableOptions={{ getClientPosition }}
      className="w-[380px] max-w-[95vw]"
      data-testid="edit-opening-hardware-panel"
    >
      <FloatingPanel.Header title={title} icon={<Wrench />} />
      <FloatingPanel.Content className="max-h-[80vh] overflow-y-auto">
        <p className="mb-2 text-xs text-muted-foreground">
          {t('ribbon.commands.bimFamilyType.editOpeningHardwareDescription')}
        </p>

        <OpeningHardwareSetEditor
          kind={opening.params.kind}
          overrides={draft}
          onChange={setHardwareOverride}
        />

        <footer className="mt-3 flex justify-end gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-accent"
          >
            {t('ribbon.commands.bimFamilyType.cancel')}
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded border border-primary bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
          >
            {t('ribbon.commands.bimFamilyType.save')}
          </button>
        </footer>
      </FloatingPanel.Content>
    </FloatingPanel>
  );
}
