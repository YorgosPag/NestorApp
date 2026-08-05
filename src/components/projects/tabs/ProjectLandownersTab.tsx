/* eslint-disable design-system/prefer-design-system-imports */
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

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OwnersList } from '@/components/shared/owners/OwnersList';
import { LandownerRemovalDialog } from '@/components/shared/owners/LandownerRemovalDialog';
import { isOptionalOwnersValid } from '@/lib/ownership/owner-utils';
import { updateProjectWithPolicy } from '@/services/projects/project-mutation-gateway';
import { useLandownerUnlinkGuard } from '@/hooks/useLandownerUnlinkGuard';
import { useGuardedLandownersSave } from '@/hooks/useGuardedLandownersSave';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { useIconSizes } from '@/hooks/useIconSizes';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { cn } from '@/lib/utils';
import { useTypography } from '@/hooks/useTypography';
import { Landmark, Save } from 'lucide-react';
import {
  LandownerAcquisitionSelect,
  LandownerAcquisitionSummary,
} from '@/components/projects/tabs/landowners/LandownerAcquisitionControl';
import {
  hasChanges,
  landownersMateriallyChanged,
  pruneStatuses,
  rehydrateStatuses,
  buildLandownersUpdate,
  toLandownerEntries,
  toPropertyOwners,
  type AcquisitionStatusMap,
} from '@/components/projects/tabs/landowners/landowner-form-model';
import type { AcquisitionStatus, LandownerEntry, PropertyOwnerEntry } from '@/types/ownership-table';
import type { UnlinkDependency } from '@/lib/firestore/landowner-unlink-guard.types';

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

/** State for the removal safety dialog */
interface RemovalDialogState {
  open: boolean;
  variant: 'confirm' | 'warning' | 'blocked';
  index: number;
  contactName: string;
  blockingDeps: UnlinkDependency[];
  warningDeps: UnlinkDependency[];
  /** Extra note when the landowner's acquisition is `secured` (ADR-745 Φ3α) */
  extraNote?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ProjectLandownersTab({ project, data }: ProjectLandownersTabProps) {
  const projectData = project ?? data;
  const projectId = projectData?.id;

  const { t } = useTranslation(COMMON_NAMESPACES);
  const { t: tProjects } = useTranslation(['projects', 'projects-data', 'projects-ika']);
  const { success: showSuccess, error: showError } = useNotifications();
  const typography = useTypography();
  const iconSizes = useIconSizes();

  // ── State ──────────────────────────────────────────────────────────────
  const [owners, setOwners] = useState<PropertyOwnerEntry[]>([]);
  const [statuses, setStatuses] = useState<AcquisitionStatusMap>({});
  const [bartexPct, setBartexPct] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  /**
   * Σ3 — the ONLY way owners change in this tab.
   *
   * Both `OwnersList`'s `onChange` and `handleConfirmRemoval` go through here, so
   * the "status keys ⊆ current contactIds" invariant holds on every path. Pruning
   * in just one of them works in a manual demo and leaks in the removal-dialog flow.
   */
  const updateOwners = useCallback((next: PropertyOwnerEntry[]) => {
    setOwners(next);
    setStatuses(prev => pruneStatuses(prev, next));
  }, []);

  const handleStatusChange = useCallback((contactId: string, next: AcquisitionStatus) => {
    setStatuses(prev => ({ ...prev, [contactId]: next }));
  }, []);

  // Save guard (ownership table snapshot staleness)
  const { ImpactDialog: SaveImpactDialog, runSaveOperation } = useGuardedLandownersSave(projectId ?? '');

  // Removal guard
  const { checkBeforeRemove, resetCheck } = useLandownerUnlinkGuard();
  const [removalDialog, setRemovalDialog] = useState<RemovalDialogState>({
    open: false, variant: 'confirm', index: -1, contactName: '',
    blockingDeps: [], warningDeps: [],
  });

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
    setStatuses(rehydrateStatuses(loadedEntries)); // Σ1 — see landowner-form-model
    setBartexPct(loadedBartex);
    setPersisted({ entries: loadedEntries, bartexPct: loadedBartex });
  }, [projectData]);

  // ── Derived state ──────────────────────────────────────────────────────
  // `allowEmpty` is passed to OwnersList below: a project may legitimately have
  // zero landowners while still carrying a bartex percentage, so the gate must
  // accept an empty list (isOptionalOwnersValid, not isOwnersValid).
  const canSave = isOptionalOwnersValid(owners) && !saving;
  const isDirty = hasChanges(owners, persisted.entries, bartexPct, persisted.bartexPct, statuses);

  /** Live view of the form (not the persisted snapshot) for the acquisition summary */
  const draftEntries = useMemo(
    () => toLandownerEntries(owners, statuses),
    [owners, statuses],
  );

  // SINGLE submit gate — the button's enabled state and handleSave's guard MUST
  // read the same value. Deriving them separately is what made the button
  // clickable while handleSave returned on its first line (bartex-only save was
  // silently dropped: no request, no toast, no error).
  const canSubmit = canSave && isDirty;

  // ── Removal guard handlers ─────────────────────────────────────────────

  /**
   * Guard callback for OwnersList — intercepts trash click.
   * Returns false to cancel removal (dialog handles it instead).
   */
  const handleBeforeRemove = useCallback(async (index: number, owner: PropertyOwnerEntry): Promise<boolean> => {
    // Skip check for entries without a contact (empty slots)
    if (!owner.contactId) return true;

    // Skip check for entries not yet persisted (newly added, unsaved)
    const isPersisted = persisted.entries.some(e => e.contactId === owner.contactId);
    if (!isPersisted) return true;

    // Server-side dependency check
    if (!projectId) return true;
    const result = await checkBeforeRemove(projectId, owner.contactId);

    // Removing someone whose acquisition is `secured` discards a signed deed
    // record. The `warning` variant carries its own fixed note about the ownership
    // table, so reusing it here would print the wrong sentence — hence a separate
    // note that shows in any variant.
    const contactName = owner.name || owner.contactId;
    const extraNote = statuses[owner.contactId] === 'secured'
      ? t('ownership.landownersTab.acquisition.removalNote', { name: contactName })
      : undefined;

    setRemovalDialog({
      open: true,
      variant: result.variant,
      index,
      contactName,
      blockingDeps: result.blockingDeps,
      warningDeps: result.warningDeps,
      extraNote,
    });

    return false; // Always false — dialog handles the actual removal
  }, [projectId, persisted.entries, checkBeforeRemove, statuses, t]);

  /**
   * Confirm removal from dialog (confirm / warning variants only)
   */
  const handleConfirmRemoval = useCallback(() => {
    const { index } = removalDialog;
    if (index < 0 || index >= owners.length) return;

    const updated = owners.filter((_, i) => i !== index);
    if (updated.length === 1) {
      updated[0] = { ...updated[0], ownershipPct: 100, role: 'landowner' as const };
    }
    updateOwners(updated); // Σ3 — never bare setOwners; the status map must be pruned too
    setRemovalDialog(prev => ({ ...prev, open: false }));
    resetCheck();
  }, [removalDialog, owners, updateOwners, resetCheck]);

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

  const executeSave = useCallback(async () => {
    if (!projectId) return;

    setSaving(true);
    // Prevent stale projectData from overwriting local state after save
    skipNextLoad.current = true;
    try {
      const landownerEntries = toLandownerEntries(owners, statuses);
      // ADR-745 Φ3β: the three fields that must travel together now have ONE home
      // (`buildLandownersUpdate`), shared with the DXF canvas writer. The
      // denormalized `landownerContactIds` feeds the contact deletion guard, and
      // a second writer that forgot it would make landowners invisible to that
      // guard — the contact would be deleted with no warning.
      // This tab OWNS the bartex share, so it declares it explicitly.
      const result = await updateProjectWithPolicy({
        projectId,
        updates: buildLandownersUpdate(landownerEntries, { set: bartexPct }),
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
  }, [projectId, owners, statuses, bartexPct, showSuccess, showError, t]);

  const handleSave = useCallback(async () => {
    if (!projectId || !canSubmit) return;

    // Σ4 — deliberately ASYMMETRIC with `isDirty`: see landownersMateriallyChanged.
    const landownersChanged =
      hasChanges(owners, persisted.entries, bartexPct, persisted.bartexPct, statuses)
      && landownersMateriallyChanged(owners, persisted.entries);
    const bartexChanged = bartexPct !== persisted.bartexPct;

    await runSaveOperation(
      { landownersChanged, bartexChanged },
      executeSave,
    );
  }, [projectId, canSubmit, owners, statuses, bartexPct, persisted, runSaveOperation, executeSave]);

  // ── Loading guard ──────────────────────────────────────────────────────
  if (!projectData) {
    return (
      <section className="flex items-center justify-center p-2">
        <p className={cn(typography.body.sm, COLOR_BRIDGE.text.muted)}>{tProjects('common.loading')}</p>
      </section>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <section className="space-y-2 p-2">
      {/* Header */}
      <header className="flex items-center justify-between">
        <h3 className={cn("flex items-center gap-2", typography.heading.md)}>
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
        onChange={updateOwners}
        defaultRole="landowner"
        disabled={saving}
        allowEmpty
        onBeforeRemove={handleBeforeRemove}
        renderRowExtra={(owner) => owner.contactId ? (
          <LandownerAcquisitionSelect
            value={statuses[owner.contactId]}
            onChange={(next) => handleStatusChange(owner.contactId, next)}
            ownerName={owner.name || owner.contactId}
            disabled={saving}
          />
        ) : null}
        labels={{
          singular: t('ownership.landownersTab.selectContact'),
          plural: t('ownership.bartex.landowners'),
          addButton: t('ownership.landownersTab.addLandowner'),
          required: t('ownership.landownersTab.selectContact'),
          placeholder: t('ownership.landownersTab.selectContact'),
        }}
      />

      {/* Save impact guard dialog */}
      {SaveImpactDialog}

      {/* Safety dialog for landowner removal */}
      <LandownerRemovalDialog
        open={removalDialog.open}
        onOpenChange={(open) => {
          setRemovalDialog(prev => ({ ...prev, open }));
          if (!open) resetCheck();
        }}
        variant={removalDialog.variant}
        contactName={removalDialog.contactName}
        blockingDeps={removalDialog.blockingDeps}
        warningDeps={removalDialog.warningDeps}
        extraNote={removalDialog.extraNote}
        onConfirm={handleConfirmRemoval}
      />

      {/* Save button + acquisition summary.
          The summary reads the DRAFT entries, not the persisted snapshot, so the
          "secured %" moves as the user edits — same as the 100% total above it. */}
      <footer className="flex items-center justify-between gap-2">
        <LandownerAcquisitionSummary entries={draftEntries} />
        <Button
          onClick={handleSave}
          disabled={!canSubmit}
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
  const typography = useTypography();

  return (
    <fieldset className="flex items-center gap-2">
      <Label className={cn("shrink-0", typography.label.sm)}>
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
      <span className={cn(typography.body.sm, COLOR_BRIDGE.text.muted)}>%</span>
    </fieldset>
  );
}
