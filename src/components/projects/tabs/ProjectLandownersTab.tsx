'use client';

/**
 * ProjectLandownersTab — Διαχείριση οικοπεδούχων σε επίπεδο έργου (SSoT)
 *
 * Χρησιμοποιεί OwnersList (SSoT component) για τη φόρμα multi-contact + percentage.
 * Προσθέτει: bartex percentage, allocatedShares computation, Firestore save.
 *
 * @module components/projects/tabs/ProjectLandownersTab
 * @enterprise ADR-244 / SPEC-244A
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OwnersList } from '@/components/shared/owners/OwnersList';
import { isOwnersValid } from '@/lib/ownership/owner-utils';
import { updateProjectClient } from '@/services/projects-client.service';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { useIconSizes } from '@/hooks/useIconSizes';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { cn } from '@/lib/utils';
import { Landmark, Save } from 'lucide-react';
import type { LandownerEntry, PropertyOwnerEntry } from '@/types/ownership-table';

// ============================================================================
// TYPES
// ============================================================================

interface ProjectLandownersTabProps {
  project?: { id: string; name?: string; [key: string]: unknown };
  data?: { id: string; name?: string; [key: string]: unknown };
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Max millesimal shares (1000‰) */
const TOTAL_SHARES = 1000;

// ============================================================================
// BOUNDARY CONVERTERS (LandownerEntry ↔ PropertyOwnerEntry)
// ============================================================================

/**
 * LandownerEntry → PropertyOwnerEntry for OwnersList consumption.
 * Maps landOwnershipPct → ownershipPct, adds role + paymentPlanId.
 */
function toPropertyOwners(entries: LandownerEntry[]): PropertyOwnerEntry[] {
  return entries.map(e => ({
    contactId: e.contactId,
    name: e.name,
    ownershipPct: e.landOwnershipPct,
    role: 'landowner' as const,
    paymentPlanId: null,
  }));
}

/**
 * PropertyOwnerEntry → LandownerEntry for Firestore save.
 * Maps ownershipPct → landOwnershipPct, computes allocatedShares.
 */
function toLandownerEntries(owners: PropertyOwnerEntry[]): LandownerEntry[] {
  return owners.map(o => ({
    contactId: o.contactId,
    name: o.name,
    landOwnershipPct: o.ownershipPct,
    allocatedShares: Math.round((o.ownershipPct / 100) * TOTAL_SHARES),
  }));
}

/**
 * Check if form has unsaved changes compared to persisted data.
 */
function hasChanges(
  currentOwners: PropertyOwnerEntry[],
  persistedEntries: LandownerEntry[],
  formBartex: number | null,
  persistedBartex: number | null,
): boolean {
  if (formBartex !== persistedBartex) return true;
  if (currentOwners.length !== persistedEntries.length) return true;
  return currentOwners.some((o, i) => {
    const pe = persistedEntries[i];
    return o.contactId !== pe?.contactId
      || o.name !== pe?.name
      || o.ownershipPct !== pe?.landOwnershipPct;
  });
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ProjectLandownersTab({ project, data }: ProjectLandownersTabProps) {
  const projectData = project ?? data;
  const projectId = projectData?.id;

  const { t } = useTranslation('common');
  const { success: showSuccess, error: showError } = useNotifications();
  const iconSizes = useIconSizes();

  // ── State ──────────────────────────────────────────────────────────────
  const [owners, setOwners] = useState<PropertyOwnerEntry[]>([]);
  const [bartexPct, setBartexPct] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Persisted snapshot for dirty-check
  const [persisted, setPersisted] = useState<{
    entries: LandownerEntry[];
    bartexPct: number | null;
  }>({ entries: [], bartexPct: null });

  // Skip next projectData effect after local save (prevents stale data overwrite)
  const skipNextLoad = useRef(false);

  // ── Load from project data ─────────────────────────────────────────────
  useEffect(() => {
    if (!projectData) return;

    // After a local save, skip the next effect to avoid race condition
    // with stale projectData from parent re-render
    if (skipNextLoad.current) {
      skipNextLoad.current = false;
      return;
    }

    const rawLandowners = projectData.landowners as LandownerEntry[] | null | undefined;
    const rawBartex = projectData.bartexPercentage as number | null | undefined;

    const loadedEntries = rawLandowners ?? [];
    const loadedBartex = rawBartex ?? null;

    setOwners(toPropertyOwners(loadedEntries));
    setBartexPct(loadedBartex);
    setPersisted({ entries: loadedEntries, bartexPct: loadedBartex });
  }, [projectData]);

  // ── Derived state ──────────────────────────────────────────────────────
  const canSave = isOwnersValid(owners) && !saving;
  const isDirty = hasChanges(owners, persisted.entries, bartexPct, persisted.bartexPct);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleBartexChange = useCallback((value: string) => {
    if (value === '') {
      setBartexPct(null);
      return;
    }
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) {
      setBartexPct(Math.max(0, Math.min(100, parsed)));
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!projectId || !canSave) return;

    setSaving(true);
    // Prevent stale projectData from overwriting local state after save
    skipNextLoad.current = true;
    try {
      const landownerEntries = toLandownerEntries(owners);
      // ADR-244: Denormalized IDs for Firestore array-contains queries (contact details page)
      const contactIds = owners.filter(o => o.contactId).map(o => o.contactId);
      const result = await updateProjectClient(projectId, {
        landowners: landownerEntries.length > 0 ? landownerEntries : null,
        bartexPercentage: bartexPct,
        landownerContactIds: contactIds.length > 0 ? contactIds : null,
      });

      if (result.success) {
        showSuccess(t('ownership.landownersTab.saved'));
        setPersisted({ entries: landownerEntries, bartexPct });
      } else {
        showError(result.error ?? t('ownership.landownersTab.saveError'));
      }
    } catch {
      showError(t('ownership.landownersTab.saveError'));
    } finally {
      setSaving(false);
    }
  }, [projectId, canSave, owners, bartexPct, showSuccess, showError, t]);

  // ── Loading guard ──────────────────────────────────────────────────────
  if (!projectData) {
    return (
      <section className="flex items-center justify-center p-8">
        <p className={cn('text-sm', COLOR_BRIDGE.text.muted)}>Loading...</p>
      </section>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <section className="space-y-6 p-4">
      {/* Header */}
      <header className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Landmark className={iconSizes.md} />
          {t('ownership.landownersTab.title')}
        </h3>
      </header>

      {/* Bartex percentage */}
      <BartexPercentageField
        value={bartexPct}
        onChange={handleBartexChange}
        t={t}
      />

      {/* SSoT: OwnersList handles contact search + percentage + validation */}
      <OwnersList
        owners={owners}
        onChange={setOwners}
        defaultRole="landowner"
        disabled={saving}
        allowEmpty
        labels={{
          singular: t('ownership.landownersTab.selectContact'),
          plural: t('ownership.bartex.landowners'),
          addButton: t('ownership.landownersTab.addLandowner'),
          required: t('ownership.landownersTab.selectContact'),
          placeholder: t('ownership.landownersTab.selectContact'),
        }}
      />

      {/* Save button */}
      <footer className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={!(canSave && isDirty) && owners.length > 0}
          size="sm"
        >
          <Save className={iconSizes.sm} />
          {isDirty ? t('ownership.landownersTab.save') : t('ownership.landownersTab.noChanges')}
        </Button>
      </footer>
    </section>
  );
}

// ============================================================================
// SUB-COMPONENTS (private — not exported)
// ============================================================================

/** Bartex percentage input field */
function BartexPercentageField({
  value,
  onChange,
  t,
}: {
  value: number | null;
  onChange: (value: string) => void;
  t: (key: string) => string;
}) {
  return (
    <fieldset className="flex items-center gap-3">
      <Label className="shrink-0 text-sm font-medium">
        {t('ownership.bartex.percentage')}
      </Label>
      <Input
        type="number"
        min={0}
        max={100}
        step={0.1}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-24 text-right"
        placeholder="0"
      />
      <span className={cn('text-sm', COLOR_BRIDGE.text.muted)}>%</span>
    </fieldset>
  );
}
