'use client';

/**
 * LegalTabContent — Composition: Timeline + Cards + Professionals + Brokerage
 *
 * @enterprise ADR-230 (SPEC-230D Task B)
 */

import React, { useCallback, useState } from 'react';
import { Plus, Scale, Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ADR-241: Centralized fullscreen system
import { useFullscreen } from '@/hooks/useFullscreen';
import { FullscreenOverlay, FullscreenToggleButton } from '@/core/containers/FullscreenOverlay';
import { useLegalContracts } from '@/hooks/useLegalContracts';
// 🏢 ADR-197/ADR-284: Centralized hierarchy validation (Company→Project→Building→Floor)
import { usePropertyHierarchyValidation } from '@/hooks/sales/usePropertyHierarchyValidation';
import { ContractTimeline } from '@/components/sales/legal/ContractTimeline';
import { ContractCard } from '@/components/sales/legal/ContractCard';
import { ProfessionalsCard } from '@/components/sales/legal/ProfessionalsCard';
import { BrokerageCard } from '@/components/sales/brokerage/BrokerageCard';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/providers/NotificationProvider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEntityContactLinks } from '@/hooks/useEntityAssociations';
import type { Property } from '@/types/property';
import type { ContractPhase } from '@/types/legal-contracts';
import type { PropertyOwnerEntry } from '@/types/ownership-table';
import { getPrimaryBuyerContactId } from '@/lib/ownership/owner-utils';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// ============================================================================
// TYPES
// ============================================================================

interface LegalTabContentProps {
  unit: Property;
}

// ============================================================================
// HELPERS
// ============================================================================

// eslint-disable-next-line custom/no-hardcoded-strings
const CREATABLE_PHASES: { value: ContractPhase; label: string }[] = [
  { value: 'preliminary', label: 'Προσύμφωνο' }, // eslint-disable-line custom/no-hardcoded-strings
  { value: 'final', label: 'Οριστικό Συμβόλαιο' }, // eslint-disable-line custom/no-hardcoded-strings
  { value: 'payoff', label: 'Εξοφλητήριο' }, // eslint-disable-line custom/no-hardcoded-strings
];

// ============================================================================
// COMPONENT
// ============================================================================

export function LegalTabContent({ unit }: LegalTabContentProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  const { success, error: notifyError } = useNotifications();
  // 🏢 SSoT hierarchy resolver — reads building.projectId real-time (cascade-safe).
  // Do NOT trust unit.project (legacy denormalized field, may be stale).
  const hierarchy = usePropertyHierarchyValidation(unit, true);
  const resolvedProjectId = hierarchy.projectId ?? unit.project ?? null;
  const {
    contracts,
    agreements,
    isLoading,
    error,
    createContract,
    transitionStatus,
    overrideProfessional,
  } = useLegalContracts(unit.id, resolvedProjectId ?? undefined);

  // Self-contained: load associations directly (page.tsx does NOT pass them)
  const { links, addLink, removeLink, LinkRemovalBlockedDialog } = useEntityContactLinks('property', unit.id);

  const [selectedPhase, setSelectedPhase] = useState<ContractPhase>('preliminary');
  const [creating, setCreating] = useState(false);
  // 🏢 ADR-241: Fullscreen state
  const fullscreen = useFullscreen();

  // Filter out phases that already have a contract
  const availablePhases = CREATABLE_PHASES.filter(
    (p) => !contracts.some((c) => c.phase === p.value)
  );

  const handleCreate = useCallback(async () => {
    const primaryBuyerContactId = getPrimaryBuyerContactId(
      (unit.commercial?.owners as PropertyOwnerEntry[] | null) ?? []
    );
    if (!primaryBuyerContactId) {
      notifyError(t('sales.legal.noBuyer'));
      return;
    }
    // 🏢 SSoT: surface first hierarchy error (Company→Project→Building→Floor order).
    // Errors come from usePropertyHierarchyValidation which resolves building.projectId real-time.
    if (hierarchy.loading) return;
    if (hierarchy.errors.length > 0) {
      notifyError(t(hierarchy.errors[0].i18nKey));
      return;
    }
    if (!unit.buildingId || !resolvedProjectId) {
      notifyError(t(resolvedProjectId ? 'sales.errors.noBuilding' : 'sales.errors.noProject'));
      return;
    }

    setCreating(true);
    const result = await createContract({
      propertyId: unit.id,
      projectId: resolvedProjectId,
      buildingId: unit.buildingId,
      primaryBuyerContactId,
      phase: selectedPhase,
    });
    setCreating(false);

    if (result.success) {
      success(CREATABLE_PHASES.find((p) => p.value === selectedPhase)?.label ?? t('sales.legal.created'));
    } else {
      notifyError(result.error ?? t('sales.legal.createError'));
    }
  }, [unit, selectedPhase, createContract, success, notifyError, t, hierarchy, resolvedProjectId]);

  // Loading state
  if (isLoading) {
    return (
      <section className="flex items-center justify-center p-8">
        <Loader2 className={cn("h-5 w-5 animate-spin", colors.text.muted)} />
      </section>
    );
  }

  // Error state
  if (error) {
    return (
      <section className="p-4 text-center text-sm text-destructive">
        {error}
      </section>
    );
  }

  return (
    <FullscreenOverlay
      isFullscreen={fullscreen.isFullscreen}
      onToggle={fullscreen.toggle}
      ariaLabel="Legal Process"
      className="space-y-4 p-3"
      fullscreenClassName="p-4 overflow-auto"
    >
      {/* Title */}
      <header className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <Scale className={cn("h-4 w-4", colors.text.muted)} />
          <h2 className="text-sm font-semibold">
            {t('sales.legal.title')}
          </h2>
        </span>
        {/* 🏢 ADR-241: Fullscreen toggle */}
        <FullscreenToggleButton isFullscreen={fullscreen.isFullscreen} onToggle={fullscreen.toggle} />
      </header>

      {/* Timeline */}
      <ContractTimeline contracts={contracts} />

      {/* Create new contract */}
      {availablePhases.length > 0 && (
        <section className="flex items-center gap-2">
          <Select
            value={selectedPhase}
            onValueChange={(v) => setSelectedPhase(v as ContractPhase)}
          >
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availablePhases.map((p) => (
                <SelectItem key={p.value} value={p.value} className="text-xs">
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCreate}
            disabled={creating || hierarchy.loading}
            className="text-xs gap-1"
          >
            {(creating || hierarchy.loading) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            {t('sales.legal.create')}
          </Button>
        </section>
      )}

      {/* Contract Cards */}
      {contracts.length > 0 ? (
        <ul className="space-y-2">
          {contracts.map((c) => (
            <li key={c.id}>
              <ContractCard
                contract={c}
                onTransition={transitionStatus}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className={cn("text-xs text-center py-4", colors.text.muted)}>
          {t('sales.legal.noContracts')}
        </p>
      )}

      {/* Professionals — interactive assign/remove */}
      <ProfessionalsCard
        propertyId={unit.id}
        associations={links}
        contracts={contracts}
        onAssign={addLink}
        onRemove={removeLink}
        onOverrideProfessional={overrideProfessional}
      />

      {/* Brokerage */}
      <BrokerageCard agreements={agreements} />

      {LinkRemovalBlockedDialog}
    </FullscreenOverlay>
  );
}
