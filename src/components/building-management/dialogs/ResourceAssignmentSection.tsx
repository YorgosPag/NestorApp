'use client';

/**
 * @module ResourceAssignmentSection
 * @enterprise ADR-266 Phase C, Sub-phase 4 — Resource Allocation
 *
 * Inline resource assignment panel for the task edit dialog.
 * Lists assigned workers/equipment, allows adding/removing, editing hours.
 */

import { useState, useCallback } from 'react';
import { UserPlus, Wrench, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import '@/lib/design-system';
import { useResourceAssignments } from '@/hooks/useResourceAssignments';
import type { ResourceAssignmentCreatePayload } from '@/types/building/construction';

// ─── Props ───────────────────────────────────────────────────────────────

interface ResourceAssignmentSectionProps {
  taskId: string;
  phaseId: string;
  buildingId: string;
  /** Available workers (contacts linked to this project) */
  workers: WorkerOption[];
  disabled?: boolean;
}

export interface WorkerOption {
  contactId: string;
  name: string;
  specialty?: string | null;
}

// ─── Constants ──────────────────────────────────────────────────────────

const MAX_ASSIGNMENTS = 20;
const MIN_HOURS = 0.5;
const MAX_HOURS = 999;
const HOURS_STEP = 0.5;

// ─── Component ──────────────────────────────────────────────────────────

export function ResourceAssignmentSection({
  taskId,
  phaseId,
  buildingId,
  workers,
  disabled,
}: ResourceAssignmentSectionProps) {
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const tBase = 'tabs.timeline.gantt.dialog.resources';

  const {
    assignments,
    loading,
    addAssignment,
    editAssignment,
    removeAssignment,
  } = useResourceAssignments({ buildingId, taskId });

  // ─── Add worker state ───────────────────────────────────────────────
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [workerHours, setWorkerHours] = useState(8);

  // ─── Add equipment state ────────────────────────────────────────────
  const [equipmentLabel, setEquipmentLabel] = useState('');
  const [equipmentHours, setEquipmentHours] = useState(8);

  const isMaxReached = assignments.length >= MAX_ASSIGNMENTS;

  // Filter out already-assigned workers
  const availableWorkers = workers.filter(
    w => !assignments.some(a => a.contactId === w.contactId)
  );

  // ─── Handlers ─────────────────────────────────────────────────────
  const handleAddWorker = useCallback(async () => {
    const worker = workers.find(w => w.contactId === selectedWorkerId);
    if (!worker || workerHours <= 0) return;

    const payload: ResourceAssignmentCreatePayload = {
      taskId,
      phaseId,
      resourceType: 'worker',
      contactId: worker.contactId,
      resourceName: worker.name,
      allocatedHours: workerHours,
    };
    await addAssignment(payload);
    setSelectedWorkerId('');
    setWorkerHours(8);
  }, [selectedWorkerId, workerHours, workers, taskId, phaseId, addAssignment]);

  const handleAddEquipment = useCallback(async () => {
    if (!equipmentLabel.trim() || equipmentHours <= 0) return;

    const payload: ResourceAssignmentCreatePayload = {
      taskId,
      phaseId,
      resourceType: 'equipment',
      resourceName: equipmentLabel.trim(),
      equipmentLabel: equipmentLabel.trim(),
      allocatedHours: equipmentHours,
    };
    await addAssignment(payload);
    setEquipmentLabel('');
    setEquipmentHours(8);
  }, [equipmentLabel, equipmentHours, taskId, phaseId, addAssignment]);

  const handleHoursChange = useCallback(async (assignmentId: string, hours: number) => {
    const clamped = Math.max(MIN_HOURS, Math.min(MAX_HOURS, hours));
    await editAssignment(assignmentId, { allocatedHours: clamped });
  }, [editAssignment]);

  return (
    <section className="space-y-3 pt-3 border-t" aria-label={t(`${tBase}.title`)}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{t(`${tBase}.title`)}</h4>
        <span className={cn('text-xs', colors.text.muted)}>
          {assignments.length}/{MAX_ASSIGNMENTS}
        </span>
      </div>

      {/* Assignment list */}
      {assignments.length > 0 && (
        <ul className="space-y-1.5">
          {assignments.map(a => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm"
            >
              {a.resourceType === 'worker' ? (
                <UserPlus className={cn('h-3.5 w-3.5 shrink-0', colors.text.muted)} />
              ) : (
                <Wrench className={cn('h-3.5 w-3.5 shrink-0', colors.text.muted)} />
              )}
              <span className="truncate flex-1 min-w-0">{a.resourceName}</span>
              <Input
                type="number"
                min={MIN_HOURS}
                max={MAX_HOURS}
                step={HOURS_STEP}
                value={a.allocatedHours}
                onChange={e => handleHoursChange(a.id, parseFloat(e.target.value) || MIN_HOURS)}
                className="w-20 h-7 text-right text-xs"
                disabled={disabled}
              />
              <span className={cn('text-xs shrink-0', colors.text.muted)}>
                {t(`${tBase}.hours`)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                onClick={() => removeAssignment(a.id)}
                disabled={disabled}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {loading && <p className={cn('text-xs', colors.text.muted)}>{t(`${tBase}.loading`)}</p>}

      {/* Add Worker */}
      {!isMaxReached && !disabled && (
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0 space-y-1">
            <Label className="text-xs">{t(`${tBase}.addWorker`)}</Label>
            <Select value={selectedWorkerId} onValueChange={setSelectedWorkerId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder={t(`${tBase}.selectWorker`)} />
              </SelectTrigger>
              <SelectContent>
                {availableWorkers.length === 0 ? (
                  <SelectItem value="_none" disabled>
                    {t(`${tBase}.noWorkers`)}
                  </SelectItem>
                ) : (
                  availableWorkers.map(w => (
                    <SelectItem key={w.contactId} value={w.contactId}>
                      {w.name}{w.specialty ? ` (${w.specialty})` : ''}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <Input
            type="number"
            min={MIN_HOURS}
            max={MAX_HOURS}
            step={HOURS_STEP}
            value={workerHours}
            onChange={e => setWorkerHours(parseFloat(e.target.value) || MIN_HOURS)}
            className="w-20 h-8 text-right text-xs"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={handleAddWorker}
            disabled={!selectedWorkerId || workerHours <= 0}
          >
            <UserPlus className={cn(iconSizes.sm, 'mr-1')} />
            {t(`${tBase}.add`)}
          </Button>
        </div>
      )}

      {/* Add Equipment */}
      {!isMaxReached && !disabled && (
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0 space-y-1">
            <Label className="text-xs">{t(`${tBase}.addEquipment`)}</Label>
            <Input
              value={equipmentLabel}
              onChange={e => setEquipmentLabel(e.target.value)}
              placeholder={t(`${tBase}.equipmentPlaceholder`)}
              className="h-8 text-xs"
            />
          </div>
          <Input
            type="number"
            min={MIN_HOURS}
            max={MAX_HOURS}
            step={HOURS_STEP}
            value={equipmentHours}
            onChange={e => setEquipmentHours(parseFloat(e.target.value) || MIN_HOURS)}
            className="w-20 h-8 text-right text-xs"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={handleAddEquipment}
            disabled={!equipmentLabel.trim() || equipmentHours <= 0}
          >
            <Wrench className={cn(iconSizes.sm, 'mr-1')} />
            {t(`${tBase}.add`)}
          </Button>
        </div>
      )}

      {isMaxReached && (
        <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          {t(`${tBase}.maxReached`)}
        </p>
      )}
    </section>
  );
}
