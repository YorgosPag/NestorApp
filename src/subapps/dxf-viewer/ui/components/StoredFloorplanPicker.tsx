'use client';
// ADR-309 Phase 5: Picker for loading saved DXF floorplans from Storage
import React, { useState, useMemo } from 'react';
import { Download } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { useAuth } from '@/auth/hooks/useAuth';
import { useFloorplanFiles } from '@/hooks/useFloorplanFiles';
import { DxfFirestoreService } from '../../services/dxf-firestore.service';
import { useNotifications } from '../../../../providers/NotificationProvider';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { ENTITY_TYPES } from '@/config/domain-constants';
import type { EntityType } from '@/config/domain-constants';
import type { Level } from '../../systems/levels/config';
import type { SceneModel } from '../../types/scene';

interface StoredFloorplanPickerProps {
  level: Level;
  currentLevelId: string;
  setLevelScene: (levelId: string, scene: SceneModel) => void;
  onClose: () => void;
}

function getLevelEntityContext(level: Level): { entityId: string | undefined; entityType: EntityType } {
  switch (level.floorplanType) {
    case 'floor': return { entityId: level.floorId, entityType: ENTITY_TYPES.FLOOR };
    case 'building': return { entityId: level.buildingId, entityType: ENTITY_TYPES.BUILDING };
    case 'project': return { entityId: level.projectId, entityType: ENTITY_TYPES.PROJECT };
    default: return { entityId: undefined, entityType: ENTITY_TYPES.PROJECT };
  }
}

export function StoredFloorplanPicker({ level, currentLevelId, setLevelScene, onClose }: StoredFloorplanPickerProps) {
  const { t } = useTranslation(['dxf-viewer-panels']);
  const { user } = useAuth();
  const colors = useSemanticColors();
  const notifications = useNotifications();
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);

  const { entityId, entityType } = useMemo(() => getLevelEntityContext(level), [level]);

  const { files, loading } = useFloorplanFiles({
    companyId: user?.companyId,
    entityType,
    entityId,
  });

  const handleLoad = async (fileId: string) => {
    if (loadingFileId) return;
    try {
      setLoadingFileId(fileId);
      const record = await DxfFirestoreService.loadFromStorage(fileId);
      if (!record?.scene) {
        notifications.error(t('panels.levels.storagePicker.error'));
        return;
      }
      setLevelScene(currentLevelId, record.scene);
      onClose();
    } catch {
      notifications.error(t('panels.levels.storagePicker.error'));
    } finally {
      setLoadingFileId(null);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className={PANEL_LAYOUT.TYPOGRAPHY.SM}>
            {t('panels.levels.storagePicker.title')}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-72">
          {loading ? (
            <p className={`text-center ${PANEL_LAYOUT.PADDING.VERTICAL_XXXL} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.muted}`}>
              {t('panels.levels.storagePicker.loading')}
            </p>
          ) : files.length === 0 ? (
            <p className={`text-center ${PANEL_LAYOUT.PADDING.VERTICAL_XXXL} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.muted}`}>
              {t('panels.levels.storagePicker.empty')}
            </p>
          ) : (
            <ul className="space-y-2 p-2">
              {files.map(file => (
                <li key={file.id} className={`flex items-center justify-between gap-2 p-2 rounded ${colors.bg.hover}`}>
                  <span className={`flex-1 truncate ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>{file.displayName}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!!loadingFileId}
                    onClick={() => handleLoad(file.id)}
                  >
                    <Download className="size-3.5" />
                    {t('panels.levels.storagePicker.loadButton')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('panels.levels.storagePicker.cancel')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
