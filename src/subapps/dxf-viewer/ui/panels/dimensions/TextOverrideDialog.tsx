'use client';

/**
 * ADR-362 Phase G1 — Text override dialog (connected to DimTextOverrideStore).
 *
 * Reads open state + entityId from DimTextOverrideStore via useSyncExternalStore.
 * Reads the entity's current userText from SceneUpdateManager at open time.
 * Writes back via updateEntity on save.
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
import { getCurrentScene, updateEntity } from '../../../managers/SceneUpdateManager';
import type { DimensionEntity } from '../../../types/dimension';
import type { AnySceneEntity } from '../../../types/scene';

function asDimensionEntity(entity: AnySceneEntity | undefined): DimensionEntity | null {
  if (!entity || entity.type !== 'dimension') return null;
  return entity as DimensionEntity;
}

export function TextOverrideDialog() {
  const { t } = useTranslation('dxf-viewer-panels');
  const k = (key: string) => t(`panels.dimensions.textOverride.${key}`);

  const { isOpen, entityId } = useSyncExternalStore(
    subscribeDimTextOverride,
    getDimTextOverrideState,
    getDimTextOverrideState,
  );

  const [localUserText, setLocalUserText] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    if (!isOpen || !entityId) return;
    const scene = getCurrentScene();
    const raw = scene?.entities.find((e) => e.id === entityId);
    const dim = asDimensionEntity(raw);
    setLocalUserText(dim?.userText);
  }, [isOpen, entityId]);

  const entity: DimensionEntity | null = React.useMemo(() => {
    if (!isOpen || !entityId) return null;
    const scene = getCurrentScene();
    const raw = scene?.entities.find((e) => e.id === entityId);
    return asDimensionEntity(raw);
  }, [isOpen, entityId]);

  function handleSave() {
    if (!entityId) return;
    updateEntity(entityId, { userText: localUserText });
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

        {entity ? (
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
          <Button size="sm" onClick={handleSave} disabled={!entity}>
            {k('apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
