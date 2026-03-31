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
import { ContractTimeline } from '@/components/sales/legal/ContractTimeline';
import { ContractCard } from '@/components/sales/legal/ContractCard';
import { ProfessionalsCard } from '@/components/sales/legal/ProfessionalsCard';
import { BrokerageCard } from '@/components/sales/brokerage/BrokerageCard';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
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
  const { t } = useTranslation('common');
  const {
    contracts,
    agreements,
    isLoading,
    error,
    createContract,
    transitionStatus,
    overrideProfessional,
  } = useLegalContracts(unit.id, unit.project);

  // Self-contained: load associations directly (page.tsx does NOT pass them)
  const { links, addLink, removeLink } = useEntityContactLinks('property', unit.id);

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
      toast.error(t('sales.legal.noBuyer', { defaultValue: 'Δεν υπάρχει αγοραστής' }));
      return;
    }
    if (!unit.buildingId) {
      toast.error(t('sales.errors.noBuilding', { defaultValue: 'Η μονάδα δεν είναι συνδεδεμένη με κτίριο' }));
      return;
    }
    const resolvedProjectId = unit.project;
    if (!resolvedProjectId) {
      toast.error(t('sales.errors.noProject', { defaultValue: 'Η μονάδα δεν ανήκει σε έργο' }));
      return;
    }

    setCreating(true);
    const result = await createContract({
      unitId: unit.id,
      projectId: resolvedProjectId,
      buildingId: unit.buildingId,
      primaryBuyerContactId,
      phase: selectedPhase,
    });
    setCreating(false);

    if (result.success) {
      toast.success(CREATABLE_PHASES.find((p) => p.value === selectedPhase)?.label ?? t('sales.legal.created', { defaultValue: 'Δημιουργήθηκε' }));
    } else {
      toast.error(result.error ?? t('sales.legal.createError', { defaultValue: 'Σφάλμα' }));
    }
  }, [unit, selectedPhase, createContract, toast, t]);

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
            {t('sales.legal.title', { defaultValue: 'Νομική Διαδικασία' })}
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
            disabled={creating}
            className="text-xs gap-1"
          >
            {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            {t('sales.legal.create', { defaultValue: 'Δημιουργία' })}
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
          {t('sales.legal.noContracts', { defaultValue: 'Δεν υπάρχουν συμβόλαια. Δημιουργήστε το πρώτο.' })}
        </p>
      )}

      {/* Professionals — interactive assign/remove */}
      <ProfessionalsCard
        unitId={unit.id}
        associations={links}
        contracts={contracts}
        onAssign={addLink}
        onRemove={removeLink}
        onOverrideProfessional={overrideProfessional}
      />

      {/* Brokerage */}
      <BrokerageCard agreements={agreements} />
    </FullscreenOverlay>
  );
}
