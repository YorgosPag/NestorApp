'use client';

/**
 * ADR-362 Phase G1 — Text override dialog (connected to DimTextOverrideStore).
 *
 * 2026-07-06 fix — the dialog is now PURE with respect to the scene: it reads the target
 * dim's current `userText` from the store (`initialUserText`, populated by the
 * `useDimensionModify` host from the level-scene SSoT) and writes back by emitting
 * `dim:text-override-apply-requested`, which the host applies as an undoable
 * `UpdateEntityCommand`. It no longer touches the module `SceneUpdateManager` singleton —
 * that dead instance (never fed the live scene) was why the dialog reported «Δεν
 * επιλέχθηκε διάσταση» and Apply did nothing.
 *
 * Mounted once in FloatingPanelsSection — portal handles z-index stacking.
 */

import React, { useSyncExternalStore } from 'react';
import { useTranslation } from '@/i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  getDimTextOverrideState,
  subscribeDimTextOverride,
  closeDimTextOverride,
} from './DimTextOverrideStore';
import { TextOverrideEditor } from './TextOverrideEditor';
import { EventBus } from '../../../systems/events/EventBus';

export function TextOverrideDialog() {
  const { t } = useTranslation('dxf-viewer-panels');
  const k = (key: string) => t(`panels.dimensions.textOverride.${key}`);

  const { isOpen, entityId, initialUserText } = useSyncExternalStore(
    subscribeDimTextOverride,
    getDimTextOverrideState,
    getDimTextOverrideState,
  );

  const [localUserText, setLocalUserText] = React.useState<string | undefined>(undefined);

  // Re-seed the editor from the level-scene value the host captured at open time.
  React.useEffect(() => {
    if (!isOpen || !entityId) return;
    setLocalUserText(initialUserText);
  }, [isOpen, entityId, initialUserText]);

  // The host only opens the dialog once it has resolved a real dimension, so a live
  // entityId denotes a valid target — no scene re-read needed here.
  const hasEntity = isOpen && !!entityId;

  function handleSave() {
    if (!entityId) return;
    EventBus.emit('dim:text-override-apply-requested', { entityId, userText: localUserText });
    closeDimTextOverride();
  }

  function handleOpenChange(open: boolean) {
    if (!open) closeDimTextOverride();
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">{k('dialogTitle')}</DialogTitle>
        </DialogHeader>

        {hasEntity ? (
          <TextOverrideEditor
            userText={localUserText}
            onChange={setLocalUserText}
          />
        ) : (
          <p className="text-sm text-muted-foreground py-2">{k('noEntitySelected')}</p>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={closeDimTextOverride}>
            {k('cancel')}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!hasEntity}>
            {k('apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
