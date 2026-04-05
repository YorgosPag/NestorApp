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

import React, { useCallback, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Check, X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { getStatusColor } from '@/lib/design-system';
import { formatFloorLabel } from '@/lib/intl-domain';
import { createFloorWithPolicy } from '@/services/floor-mutation-gateway';
import { ApiClientError } from '@/lib/api/enterprise-api-client';
import { toast } from 'sonner';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Residential standard floor-to-floor height (meters). */
const DEFAULT_STOREY_HEIGHT = 3.0;

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
  /** Callback μετά από επιτυχή δημιουργία — parent refreshes list. */
  onCreated: (floorId?: string) => void;
  /** Callback όταν ο user κάνει cancel. */
  onCancel: () => void;
}

// =============================================================================
// HELPERS
// =============================================================================

/** Compute default elevation for a floor number (0 = ground = 0m). */
function computeDefaultElevation(floorNumber: number): string {
  return (floorNumber * DEFAULT_STOREY_HEIGHT).toFixed(2);
}

// =============================================================================
// COMPONENT
// =============================================================================

export function FloorInlineCreateForm({
  buildingId,
  projectId,
  onCreated,
  onCancel,
}: FloorInlineCreateFormProps) {
  const { t } = useTranslation('building');
  const colors = useSemanticColors();

  // ── State ──
  const [createNumber, setCreateNumber] = useState('0');
  const [createName, setCreateName] = useState(formatFloorLabel(0));
  const [createNameManuallyEdited, setCreateNameManuallyEdited] = useState(false);
  const [createElevation, setCreateElevation] = useState(computeDefaultElevation(0));
  const [createElevationManuallyEdited, setCreateElevationManuallyEdited] = useState(false);
  const [creating, setCreating] = useState(false);

  // ── Handlers with auto-suggest (Revit/ArchiCAD pattern) ──
  const handleNumberChange = useCallback((value: string) => {
    setCreateNumber(value);
    const num = parseInt(value, 10);
    if (!createNameManuallyEdited) {
      setCreateName(Number.isNaN(num) ? '' : formatFloorLabel(num));
    }
    if (!createElevationManuallyEdited) {
      setCreateElevation(Number.isNaN(num) ? '' : computeDefaultElevation(num));
    }
  }, [createNameManuallyEdited, createElevationManuallyEdited]);

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

  // ── Submit ──
  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (!createName.trim()) {
      toast.error(t('tabs.floors.validationNameRequired'));
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
      toast.success(t('tabs.floors.createSuccess'));
      const createdId = result?.floorId ?? result?.data?.floorId;
      onCreated(createdId);
    } catch (err) {
      if (ApiClientError.isApiClientError(err) && err.statusCode === 409) {
        toast.error(t('tabs.floors.duplicateNumber'));
      } else {
        const msg = err instanceof Error ? err.message : '';
        toast.error(t('tabs.floors.createError') + (msg ? `: ${msg}` : ''));
      }
    } finally {
      setCreating(false);
    }
  }, [buildingId, projectId, createName, createNumber, createElevation, onCreated, t]);

  return (
    <form
      className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-2"
      onSubmit={handleSubmit}
    >
      <section className="grid grid-cols-[80px_1fr_120px_auto] items-end gap-2">
        <fieldset className="flex flex-col gap-1">
          <label className={cn('text-xs font-medium', colors.text.muted)}>
            {t('tabs.floors.number')}
          </label>
          <Input
            type="number"
            value={createNumber}
            onChange={(e) => handleNumberChange(e.target.value)}
            placeholder={t('tabs.floors.numberPlaceholder')}
            className="h-9"
            disabled={creating}
            autoFocus
          />
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
            type="submit"
            size="sm"
            disabled={!createName.trim() || creating}
            className="h-9"
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
    </form>
  );
}

export default FloorInlineCreateForm;
