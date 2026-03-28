/**
 * =============================================================================
 * 🔗 ENTERPRISE: LinkToBuildingModal Component
 * =============================================================================
 *
 * Modal dialog for linking a project file to one or more buildings.
 * Uses Firestore linkedTo[] array for cross-entity file references.
 *
 * @module components/shared/files/LinkToBuildingModal
 * @enterprise ADR-031 - Canonical File Storage System (entity linking extension)
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { FileRecordService } from '@/services/file-record.service';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import type { FileRecord } from '@/types/file-record';
import '@/lib/design-system';

// ============================================================================
// MODULE LOGGER
// ============================================================================

const logger = createModuleLogger('LinkToBuildingModal');

// ============================================================================
// TYPES
// ============================================================================

/** Lightweight building for selection */
interface BuildingOption {
  id: string;
  name: string;
  status?: string;
}

/** API response shape */
interface BuildingsApiResponse {
  buildings: BuildingOption[];
  count: number;
}

export interface LinkToBuildingModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Open state handler */
  onOpenChange: (open: boolean) => void;
  /** The file to link */
  file: FileRecord;
  /** Project ID to fetch buildings for */
  projectId: string;
  /** Callback after links are saved */
  onSaved: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function LinkToBuildingModal({
  open,
  onOpenChange,
  file,
  projectId,
  onSaved,
}: LinkToBuildingModalProps) {
  const { t } = useTranslation('files');
  const colors = useSemanticColors();
  const { success, error: showError } = useNotifications();

  // State
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [loadingBuildings, setLoadingBuildings] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // =========================================================================
  // LOAD BUILDINGS
  // =========================================================================

  useEffect(() => {
    if (!open || !projectId) return;

    const loadBuildings = async () => {
      setLoadingBuildings(true);
      setLoadError(null);

      try {
        const data = await apiClient.get<BuildingsApiResponse>(
          `${API_ROUTES.BUILDINGS.LIST}?projectId=${encodeURIComponent(projectId)}`
        );
        setBuildings(data.buildings);

        // Initialize selected from current linkedTo
        const currentLinks = file.linkedTo ?? [];
        const linkedBuildingIds = new Set(
          currentLinks
            .filter(tag => tag.startsWith('building:'))
            .map(tag => tag.replace('building:', ''))
        );
        setSelectedIds(linkedBuildingIds);

        logger.info('Buildings loaded', { count: data.buildings.length, currentLinks: linkedBuildingIds.size });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Failed to load buildings', { error: msg });
        setLoadError(msg);
      } finally {
        setLoadingBuildings(false);
      }
    };

    loadBuildings();
  }, [open, projectId, file.linkedTo]);

  // =========================================================================
  // TOGGLE SELECTION
  // =========================================================================

  const toggleBuilding = useCallback((buildingId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(buildingId)) {
        next.delete(buildingId);
      } else {
        next.add(buildingId);
      }
      return next;
    });
  }, []);

  // =========================================================================
  // SAVE
  // =========================================================================

  const handleSave = useCallback(async () => {
    setSaving(true);

    try {
      // Determine current linked building IDs
      const currentLinks = file.linkedTo ?? [];
      const currentBuildingIds = new Set(
        currentLinks
          .filter(tag => tag.startsWith('building:'))
          .map(tag => tag.replace('building:', ''))
      );

      // Determine additions and removals
      const toAdd = [...selectedIds].filter(id => !currentBuildingIds.has(id));
      const toRemove = [...currentBuildingIds].filter(id => !selectedIds.has(id));

      logger.info('Saving link changes', { toAdd, toRemove, fileId: file.id });

      // Execute link/unlink operations
      const operations: Promise<void>[] = [
        ...toAdd.map(id => FileRecordService.linkFileToEntity(file.id, 'building', id)),
        ...toRemove.map(id => FileRecordService.unlinkFileFromEntity(file.id, 'building', id)),
      ];

      await Promise.all(operations);

      success(t('linkModal.saveSuccess'));
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Failed to save links', { error: msg });
      showError(t('linkModal.saveError'));
    } finally {
      setSaving(false);
    }
  }, [file, selectedIds, onSaved, onOpenChange, success, showError, t]);

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" aria-hidden="true" />
            {t('linkModal.title')}
          </DialogTitle>
          <DialogDescription>
            {t('linkModal.description')}
          </DialogDescription>
        </DialogHeader>

        <section className="py-4 space-y-3">
          {/* Loading state */}
          {loadingBuildings && (
            <div className="flex items-center justify-center py-6">
              <Spinner />
              <span className={cn("ml-2 text-sm", colors.text.muted)}>
                {t('linkModal.loadingBuildings')}
              </span>
            </div>
          )}

          {/* Error state */}
          {loadError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">{t('linkModal.loadError')}</p>
            </div>
          )}

          {/* Empty state */}
          {!loadingBuildings && !loadError && buildings.length === 0 && (
            <p className={cn("text-sm text-center py-4", colors.text.muted)}>
              {t('linkModal.noBuildings')}
            </p>
          )}

          {/* Building checkboxes */}
          {!loadingBuildings && buildings.map(building => (
            <Label
              key={building.id}
              className="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:bg-accent/50 transition-colors"
            >
              <Checkbox
                checked={selectedIds.has(building.id)}
                onCheckedChange={() => toggleBuilding(building.id)}
                aria-label={building.name}
              />
              <div className="flex items-center gap-2">
                <Building2 className={cn("h-4 w-4", colors.text.muted)} aria-hidden="true" />
                <span className="text-sm font-medium">{building.name}</span>
              </div>
            </Label>
          ))}
        </section>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t('linkModal.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || loadingBuildings}
          >
            {saving ? (
              <>
                <Spinner size="small" color="inherit" className="mr-2" />
                {t('linkModal.saving')}
              </>
            ) : (
              t('linkModal.save')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
