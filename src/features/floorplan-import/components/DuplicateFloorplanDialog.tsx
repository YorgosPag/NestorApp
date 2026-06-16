'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: Cross-Floor Floorplan Duplicate Dialog (ADR-465)
 * =============================================================================
 *
 * «Copy floorplan to another floor». Functionally identical to the wizard's
 * Step-6 upload, but with a PRE-SUPPLIED source file and a FIXED destination
 * floor:
 *   1. Resolve the source floor's stored DXF (`useFloorplanFiles` → primaryFile).
 *   2. User picks a destination floor (+ wipe preview when it has content).
 *   3. Confirm → download the source `.dxf` → `uploadSmart(file)` on the dest
 *      config → reuse the host's import-complete handler to render + wire it.
 *
 * v1 keeps the destination's BIM (wipeBim = false), matching the wizard default.
 * Duplicate-with-BIM is deferred (ADR-465 option B).
 *
 * @module features/floorplan-import/components/DuplicateFloorplanDialog
 * @enterprise ADR-465 - Cross-Floor Floorplan Duplicate
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/hooks/useAuth';
import { useNotifications } from '@/providers/NotificationProvider';
import { useFloorplanFiles } from '@/hooks/useFloorplanFiles';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { useFloorplanSmartUpload } from '../hooks/useFloorplanSmartUpload';
import type { FloorWipePreview } from '../hooks/useFloorplanSmartUpload';
import type { WizardCompleteMeta } from '../FloorplanImportWizard';
import {
  downloadFileRecordAsFile,
  buildFloorDuplicateConfig,
} from '../utils/floorplan-duplicate-core';

const logger = createModuleLogger('DuplicateFloorplanDialog');

// =============================================================================
// TYPES
// =============================================================================

/** A candidate destination floor. */
export interface DuplicateDestinationFloor {
  id: string;
  name: string;
}

interface DuplicateFloorplanDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Source floor whose floorplan is copied (the clicked level's floor). */
  source: { floorId: string; name: string };
  /** Project + building context of the destination floors. */
  projectId?: string;
  buildingId?: string;
  /** Selectable destination floors (source floor already excluded by caller). */
  destinations: DuplicateDestinationFloor[];
  /**
   * Reused host import-complete handler — the SAME callback the FloorplanImport
   * Wizard fires, so rendering + scene wiring stay a single SSoT path.
   */
  onComplete: (file: File, meta: WizardCompleteMeta) => void | Promise<void>;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function DuplicateFloorplanDialog({
  isOpen,
  onClose,
  source,
  projectId,
  buildingId,
  destinations,
  onComplete,
}: DuplicateFloorplanDialogProps) {
  const { t } = useTranslation(['dxf-viewer-panels']);
  const notifications = useNotifications();
  const { user } = useAuth();
  const companyId = user?.companyId;

  const [destFloorId, setDestFloorId] = useState<string | null>(null);
  const [preview, setPreview] = useState<FloorWipePreview | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  // Reset transient state whenever the dialog (re)opens.
  useEffect(() => {
    if (isOpen) {
      setDestFloorId(null);
      setPreview(null);
      setIsRunning(false);
    }
  }, [isOpen]);

  // ── Source floor's stored DXF (the bytes we re-feed into the pipeline) ──
  const { primaryFile: sourceFile, loading: sourceLoading } = useFloorplanFiles({
    companyId,
    entityType: ENTITY_TYPES.FLOOR,
    entityId: source.floorId,
    autoProcess: false,
  });

  const destName = useMemo(
    () => destinations.find((d) => d.id === destFloorId)?.name,
    [destinations, destFloorId],
  );

  // ── Destination upload config (floor-level, identical to wizard) ──
  const destConfig = useMemo(
    () =>
      buildFloorDuplicateConfig({
        companyId: companyId ?? '',
        projectId,
        userId: user?.uid ?? '',
        destFloorId: destFloorId ?? '',
        destFloorName: destName,
        buildingId,
      }),
    [companyId, projectId, user?.uid, destFloorId, destName, buildingId],
  );

  const smart = useFloorplanSmartUpload(destConfig);
  const { fetchPreview } = smart;

  // ── Wipe preview for the chosen destination ──
  useEffect(() => {
    if (!destFloorId) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    fetchPreview(destFloorId)
      .then((p) => { if (!cancelled) setPreview(p); })
      .catch(() => { if (!cancelled) setPreview(null); });
    return () => { cancelled = true; };
  }, [destFloorId, fetchPreview]);

  const wipePolygons = preview
    ? preview.totalPolygons + preview.floorplanBackgroundCount
    : 0;

  const handleConfirm = useCallback(async () => {
    if (!destFloorId || !sourceFile || !companyId || !user?.uid) return;
    setIsRunning(true);
    try {
      const file = await downloadFileRecordAsFile(sourceFile);
      const result = await smart.uploadSmart(file, { wipeBim: false });
      if (!result.success) {
        notifications.error(result.error ?? t('panels.levels.duplicateFloorplan.error'));
        return;
      }
      const meta: WizardCompleteMeta = {
        companyId: destConfig.companyId,
        projectId: destConfig.projectId,
        entityType: ENTITY_TYPES.FLOOR,
        entityId: destFloorId,
        buildingId,
        purpose: destConfig.purpose ?? '',
        entityLabel: destName,
        fileId: result.fileId,
        format: result.format,
        loadAllFloors: false,
      };
      await onComplete(file, meta);
      notifications.success(
        t('panels.levels.duplicateFloorplan.success', { destination: destName ?? '' }),
      );
      onClose();
    } catch (err) {
      const msg = getErrorMessage(err, t('panels.levels.duplicateFloorplan.error'));
      logger.error('Duplicate failed', { error: msg, source: source.floorId, destFloorId });
      notifications.error(msg);
    } finally {
      setIsRunning(false);
    }
  }, [
    destFloorId, sourceFile, companyId, user?.uid, smart, destConfig, destName,
    buildingId, onComplete, onClose, notifications, t, source.floorId,
  ]);

  const hasSource = !sourceLoading && !!sourceFile;
  const hasDestinations = destinations.length > 0;
  const canConfirm = hasSource && !!destFloorId && !isRunning;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isRunning) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('panels.levels.duplicateFloorplan.title')}</DialogTitle>
          <DialogDescription>
            {t('panels.levels.duplicateFloorplan.description', { source: source.name })}
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-3 py-2">
          {sourceLoading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t('panels.levels.storagePicker.loading')}
            </p>
          )}

          {!sourceLoading && !sourceFile && (
            <p className="rounded-md border border-destructive bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {t('panels.levels.duplicateFloorplan.noSourceFloorplan')}
            </p>
          )}

          {hasSource && !hasDestinations && (
            <p className="text-sm text-muted-foreground">
              {t('panels.levels.duplicateFloorplan.noDestinations')}
            </p>
          )}

          {hasSource && hasDestinations && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">
                {t('panels.levels.duplicateFloorplan.destinationLabel')}
              </span>
              <Select
                value={destFloorId ?? undefined}
                onValueChange={(v) => setDestFloorId(v)}
                disabled={isRunning}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t('panels.levels.duplicateFloorplan.destinationPlaceholder')}
                  />
                </SelectTrigger>
                <SelectContent>
                  {destinations.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          )}

          {destFloorId && wipePolygons > 0 && (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {t('panels.levels.duplicateFloorplan.wipeWarning', { polygons: wipePolygons })}
            </p>
          )}
        </section>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isRunning}>
            {t('panels.levels.duplicateFloorplan.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {isRunning && <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />}
            {isRunning
              ? t('panels.levels.duplicateFloorplan.running')
              : t('panels.levels.duplicateFloorplan.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DuplicateFloorplanDialog;
