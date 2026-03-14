'use client';

/**
 * LegalTabContent — Composition: Timeline + Cards + Professionals + Brokerage
 *
 * @enterprise ADR-230 (SPEC-230D Task B)
 */

import React, { useCallback, useState } from 'react';
import { Plus, Scale, Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
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
import type { Unit } from '@/types/unit';
import type { ContractPhase } from '@/types/legal-contracts';
import type { EntityAssociationLink } from '@/types/entity-associations';

// ============================================================================
// TYPES
// ============================================================================

interface LegalTabContentProps {
  unit: Unit;
  /** Live associations from unit (for ProfessionalsCard) */
  associations: EntityAssociationLink[];
}

// ============================================================================
// HELPERS
// ============================================================================

const CREATABLE_PHASES: { value: ContractPhase; label: string }[] = [
  { value: 'preliminary', label: 'Προσύμφωνο' },
  { value: 'final', label: 'Οριστικό Συμβόλαιο' },
  { value: 'payoff', label: 'Εξοφλητήριο' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function LegalTabContent({ unit, associations }: LegalTabContentProps) {
  const { t } = useTranslation('common');
  const {
    contracts,
    agreements,
    isLoading,
    error,
    createContract,
    transitionStatus,
  } = useLegalContracts(unit.id, unit.project);

  const [selectedPhase, setSelectedPhase] = useState<ContractPhase>('preliminary');
  const [creating, setCreating] = useState(false);

  // Filter out phases that already have a contract
  const availablePhases = CREATABLE_PHASES.filter(
    (p) => !contracts.some((c) => c.phase === p.value)
  );

  const handleCreate = useCallback(async () => {
    if (!unit.commercial?.buyerContactId) {
      toast.error(t('sales.legal.noBuyer', { defaultValue: 'Δεν υπάρχει αγοραστής' }));
      return;
    }
    if (!unit.buildingId) {
      toast.error(t('sales.errors.noBuilding', { defaultValue: 'Η μονάδα δεν είναι συνδεδεμένη με κτίριο' }));
      return;
    }
    if (!unit.project) {
      toast.error(t('sales.errors.noProject', { defaultValue: 'Η μονάδα δεν ανήκει σε έργο' }));
      return;
    }

    setCreating(true);
    const result = await createContract({
      unitId: unit.id,
      projectId: unit.project,
      buildingId: unit.buildingId,
      buyerContactId: unit.commercial.buyerContactId,
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
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
    <section className="space-y-4 p-3">
      {/* Title */}
      <header className="flex items-center gap-2">
        <Scale className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">
          {t('sales.legal.title', { defaultValue: 'Νομική Διαδικασία' })}
        </h2>
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
        <p className="text-xs text-muted-foreground text-center py-4">
          {t('sales.legal.noContracts', { defaultValue: 'Δεν υπάρχουν συμβόλαια. Δημιουργήστε το πρώτο.' })}
        </p>
      )}

      {/* Professionals */}
      <ProfessionalsCard associations={associations} />

      {/* Brokerage */}
      <BrokerageCard agreements={agreements} />
    </section>
  );
}
