'use client';

/**
 * =============================================================================
 * ENTERPRISE: FloorInlineCreateForm — SSoT Inline Create Form για Ορόφους
 * =============================================================================
 *
 * **Single Source of Truth** για inline floor creation UX. Self-contained
 * component with: state, auto-suggest logic (Revit/ArchiCAD pattern), mismatch
 * warnings, API call, και Check/X action buttons.
 *
 * **Χρησιμοποιείται από:**
 *   - `FloorsTabContent` (Building tab → Floors) — υπάρχον place
 *   - `NewUnitHierarchySection` (empty state CTA "Πρόσθεσε Όροφο") — νέο place
 *
 * **Auto-suggest λογική** (Revit/ArchiCAD standard):
 *   - Number → Name (π.χ. 0 → "Ισόγειο", 1 → "1ος όροφος")
 *   - Number → Elevation (floor × 3.0m — residential standard)
 *   - Manual edits disable auto-suggest for that field
 *
 * @module components/building-management/tabs/FloorInlineCreateForm
 * @enterprise SSoT — Google-level reusable form (Γιώργος 2026-04-05)
 */

import React, { useCallback, useMemo, useState, type MouseEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Check, X, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { getStatusColor } from '@/lib/design-system';
import { formatFloorLabel } from '@/lib/intl-domain';
import { createFloorWithPolicy } from '@/services/floor-mutation-gateway';
import { ApiClientError } from '@/lib/api/enterprise-api-client';
import { useNotifications } from '@/providers/NotificationProvider';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Residential standard floor-to-floor height (meters). */
const DEFAULT_STOREY_HEIGHT = 3.0;

type ExistingFloorElevation = { number: number; elevation?: number | null };

interface FloorMutationResponse {
  floorId?: string;
  data?: { floorId: string };
}

// =============================================================================
// TYPES
// =============================================================================

export interface FloorInlineCreateFormProps {
  /** Building που ανήκει ο νέος όροφος (required). */
  buildingId: string;
  /** Project που ανήκει το Building (για server policy — ADR-284). */
  projectId?: string;
  /** Callback μετά από επιτυχή δημιουργία — parent refreshes list.
   *  Second arg: floor data for immediate use (no need to wait for subscription). */
  onCreated: (floorId?: string, floorData?: { number: number; name: string }) => void;
  /** Callback όταν ο user κάνει cancel. */
  onCancel: () => void;
  /** Existing floor numbers — stepper skips these (optional, SSoT). */
  existingFloorNumbers?: ReadonlySet<number>;
  /** Existing floors with elevations — used for smart elevation suggestion. */
  existingFloors?: ReadonlyArray<ExistingFloorElevation>;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Smart elevation: infers start elevation for a new floor from actual existing
 * floor elevations instead of the fixed 3m-per-floor default.
 * Falls back to DEFAULT_STOREY_HEIGHT when no elevation data is available.
 */
function computeSmartElevation(
  floorNumber: number,
  existingFloors: ReadonlyArray<ExistingFloorElevation>,
): string {
  const withElev = existingFloors
    .filter((f): f is { number: number; elevation: number } =>
      f.elevation != null && Number.isFinite(f.elevation as number))
    .sort((a, b) => a.number - b.number);

  if (withElev.length === 0) return (floorNumber * DEFAULT_STOREY_HEIGHT).toFixed(2);

  const below = [...withElev].reverse().find((f) => f.number < floorNumber);
  const above = withElev.find((f) => f.number > floorNumber);

  if (below && above) {
    const heightPerFloor = (above.elevation - below.elevation) / (above.number - below.number);
    return (below.elevation + (floorNumber - below.number) * heightPerFloor).toFixed(2);
  }

  if (below) {
    const belowBelow = [...withElev].reverse().find((f) => f.number < below.number);
    const h = belowBelow
      ? (below.elevation - belowBelow.elevation) / (below.number - belowBelow.number)
      : DEFAULT_STOREY_HEIGHT;
    return (below.elevation + (floorNumber - below.number) * h).toFixed(2);
  }

  if (above) {
    const aboveAbove = withElev.find((f) => f.number > above.number);
    const h = aboveAbove
      ? (aboveAbove.elevation - above.elevation) / (aboveAbove.number - above.number)
      : DEFAULT_STOREY_HEIGHT;
    return (above.elevation - (above.number - floorNumber) * h).toFixed(2);
  }

  return (floorNumber * DEFAULT_STOREY_HEIGHT).toFixed(2);
}

/** True if floor N is contiguous with at least one existing floor. */
function isContiguous(n: number, existing: ReadonlySet<number>): boolean {
  if (existing.size === 0) return true;
  return existing.has(n - 1) || existing.has(n + 1);
}

/** Find next available AND contiguous number in direction; returns current if none found. */
function findNextContiguous(current: number, dir: 1 | -1, existing: ReadonlySet<number>): number {
  let next = current + dir;
  for (let i = 0; i < 100; i++) {
    if (!existing.has(next) && isContiguous(next, existing)) return next;
    next += dir;
  }
  return current;
}

/** Find first available number starting from max+1 (or 0 if no existing). */
function firstAvailableNumber(existing: ReadonlySet<number>): number {
  if (existing.size === 0) return 0;
  const max = Math.max(...existing);
  // Next contiguous above the max is always max+1
  return max + 1;
}

// =============================================================================
// COMPONENT
// =============================================================================

const EMPTY_SET = new Set<number>();

export function FloorInlineCreateForm({
  buildingId,
  projectId,
  onCreated,
  onCancel,
  existingFloorNumbers = EMPTY_SET,
  existingFloors = [],
}: FloorInlineCreateFormProps) {
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  const { success, error: notifyError } = useNotifications();
  const colors = useSemanticColors();

  // ── State — initialize to first available number ──
  const initNum = useMemo(() => firstAvailableNumber(existingFloorNumbers), [existingFloorNumbers]);
  const [createNumber, setCreateNumber] = useState(String(initNum));
  const [createName, setCreateName] = useState(formatFloorLabel(initNum));
  const [createNameManuallyEdited, setCreateNameManuallyEdited] = useState(false);
  const [createElevation, setCreateElevation] = useState(() => computeSmartElevation(initNum, existingFloors));
  const [createElevationManuallyEdited, setCreateElevationManuallyEdited] = useState(false);
  const [creating, setCreating] = useState(false);

  // ── Handlers with auto-suggest (Revit/ArchiCAD pattern) ──
  const applyNumber = useCallback((num: number) => {
    setCreateNumber(String(num));
    if (!createNameManuallyEdited) setCreateName(formatFloorLabel(num));
    if (!createElevationManuallyEdited) setCreateElevation(computeSmartElevation(num, existingFloors));
  }, [createNameManuallyEdited, createElevationManuallyEdited, existingFloors]);

  const handleNumberChange = useCallback((value: string) => {
    setCreateNumber(value);
    const num = parseInt(value, 10);
    if (!createNameManuallyEdited) {
      setCreateName(Number.isNaN(num) ? '' : formatFloorLabel(num));
    }
    if (!createElevationManuallyEdited) {
      setCreateElevation(Number.isNaN(num) ? '' : computeSmartElevation(num, existingFloors));
    }
  }, [createNameManuallyEdited, createElevationManuallyEdited, existingFloors]);

  const handleStepUp = useCallback((e: MouseEvent) => {
    e.preventDefault();
    const cur = parseInt(createNumber, 10) || 0;
    applyNumber(findNextContiguous(cur, 1, existingFloorNumbers));
  }, [createNumber, existingFloorNumbers, applyNumber]);

  const handleStepDown = useCallback((e: MouseEvent) => {
    e.preventDefault();
    const cur = parseInt(createNumber, 10) || 0;
    applyNumber(findNextContiguous(cur, -1, existingFloorNumbers));
  }, [createNumber, existingFloorNumbers, applyNumber]);

  const handleNameChange = useCallback((value: string) => {
    setCreateName(value);
    setCreateNameManuallyEdited(true);
  }, []);

  const handleElevationChange = useCallback((value: string) => {
    setCreateElevation(value);
    setCreateElevationManuallyEdited(true);
  }, []);

  // ── Mismatch warning: name manually edited but differs from auto-suggest ──
  const createNameMismatch = useMemo((): boolean => {
    if (!createNameManuallyEdited || !createName.trim()) return false;
    const num = parseInt(createNumber, 10);
    if (Number.isNaN(num)) return false;
    return createName.trim() !== formatFloorLabel(num);
  }, [createNumber, createName, createNameManuallyEdited]);

  // ── Non-contiguous warning: selected number breaks floor sequence ──
  const createNumberNonContiguous = useMemo((): boolean => {
    if (existingFloorNumbers.size === 0) return false;
    const num = parseInt(createNumber, 10);
    if (Number.isNaN(num)) return false;
    return !isContiguous(num, existingFloorNumbers);
  }, [createNumber, existingFloorNumbers]);

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    if (!createName.trim()) {
      notifyError(t('tabs.floors.validationNameRequired'));
      return;
    }
    setCreating(true);
    try {
      const result = await createFloorWithPolicy<FloorMutationResponse>({
        payload: {
          number: parseInt(createNumber, 10) || 0,
          name: createName.trim(),
          elevation: createElevation ? parseFloat(createElevation) : null,
          buildingId,
          ...(projectId ? { projectId } : {}),
        },
      });
      success(t('tabs.floors.createSuccess'));
      const createdId = result?.floorId ?? result?.data?.floorId;
      const num = parseInt(createNumber, 10) || 0;
      onCreated(createdId, { number: num, name: createName.trim() });
    } catch (err) {
      if (ApiClientError.isApiClientError(err) && err.statusCode === 409) {
        notifyError(t('tabs.floors.duplicateNumber'));
      } else {
        const msg = err instanceof Error ? err.message : '';
        notifyError(t('tabs.floors.createError') + (msg ? `: ${msg}` : ''));
      }
    } finally {
      setCreating(false);
    }
  }, [buildingId, projectId, createName, createNumber, createElevation, onCreated, t, success, notifyError]);

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-2"
      role="group"
    >
      <section className="grid grid-cols-[80px_1fr_120px_auto] items-end gap-2">
        <fieldset className="flex flex-col gap-1">
          <label className={cn('text-xs font-medium', colors.text.muted)}>
            {t('tabs.floors.number')}
          </label>
          <section className="flex items-center gap-0.5">
            <Input
              type="number"
              value={createNumber}
              onChange={(e) => handleNumberChange(e.target.value)}
              placeholder={t('tabs.floors.numberPlaceholder')}
              className="h-9 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              disabled={creating}
              autoFocus
            />
            <nav className="flex flex-col">
              <button type="button" onClick={handleStepUp} disabled={creating} className="h-[18px] w-5 flex items-center justify-center rounded-t-sm border border-border hover:bg-muted">
                <ChevronUp className="h-3 w-3" />
              </button>
              <button type="button" onClick={handleStepDown} disabled={creating} className="h-[18px] w-5 flex items-center justify-center rounded-b-sm border border-t-0 border-border hover:bg-muted">
                <ChevronDown className="h-3 w-3" />
              </button>
            </nav>
          </section>
        </fieldset>
        <fieldset className="flex flex-col gap-1">
          <label className={cn('text-xs font-medium', colors.text.muted)}>
            {t('tabs.floors.name')}
          </label>
          <Input
            value={createName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder={t('tabs.floors.namePlaceholder')}
            className="h-9"
            disabled={creating}
          />
        </fieldset>
        <fieldset className="flex flex-col gap-1">
          <label className={cn('text-xs font-medium', colors.text.muted)}>
            {t('tabs.floors.elevation')}
          </label>
          <Input
            type="number"
            step="0.01"
            value={createElevation}
            onChange={(e) => handleElevationChange(e.target.value)}
            placeholder={t('tabs.floors.elevationPlaceholder')}
            className="h-9"
            disabled={creating}
          />
        </fieldset>
        <nav className="flex gap-1">
          <Button
            type="button"
            size="sm"
            disabled={!createName.trim() || creating || createNumberNonContiguous}
            className="h-9"
            onClick={handleSubmit}
          >
            {creating ? <Spinner size="small" color="inherit" /> : <Check className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={creating}
            className="h-9"
          >
            <X className="h-4 w-4" />
          </Button>
        </nav>
      </section>
      {createNameMismatch && (
        <p className={cn('flex items-center gap-1.5 text-xs', getStatusColor('warning', 'text'))}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {t('tabs.floors.mismatchWarning')}
        </p>
      )}
      {createNumberNonContiguous && (
        <p className={cn('flex items-center gap-1.5 text-xs', getStatusColor('error', 'text'))}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {t('tabs.floors.nonContiguousWarning')}
        </p>
      )}
    </div>
  );
}

export default FloorInlineCreateForm;
