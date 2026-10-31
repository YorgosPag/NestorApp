'use client';
/* eslint-disable custom/no-hardcoded-strings */
/* eslint-disable design-system/enforce-semantic-colors */

/**
 * ChequeRegistrySection — Container for cheque registry in PaymentTabContent
 * Displays cheque table + dialogs. Uses useChequeRegistry hook.
 *
 * @enterprise ADR-234 Phase 3 — SPEC-234A
 */

import React, { useState } from 'react';
import { FileText, Plus, Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useChequeRegistry } from '@/hooks/useChequeRegistry';
import { ChequeTable } from '@/components/sales/payments/ChequeTable';
import { AddChequeDialog } from '@/components/sales/payments/AddChequeDialog';
import { ChequeDetailDialog } from '@/components/sales/payments/ChequeDetailDialog';
import { Button } from '@/components/ui/button';
import type { ChequeRecord } from '@/types/cheque-registry';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// ============================================================================
// COMPONENT
// ============================================================================

interface ChequeRegistrySectionProps {
  propertyId: string;
  projectId?: string;
  paymentPlanId?: string;
  contactId?: string;
}

export function ChequeRegistrySection({
  propertyId,
  projectId,
  paymentPlanId,
  contactId,
}: ChequeRegistrySectionProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation('payments');
  const {
    cheques,
    isLoading,
    error,
    createCheque,
    updateCheque,
    transitionStatus,
    endorseCheque,
    bounceCheque,
  } = useChequeRegistry(propertyId);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [detailCheque, setDetailCheque] = useState<ChequeRecord | null>(null);

  if (isLoading) {
    return (
      <section className="flex items-center justify-center p-4">
        <Loader2 className={cn("h-4 w-4 animate-spin", colors.text.muted)} />
      </section>
    );
  }

  if (error) {
    return (
      <section className="p-3 text-center text-xs text-destructive">{error}</section>
    );
  }

  return (
    <section className="rounded-lg border p-3 space-y-3">
      <header className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <FileText className={cn("h-4 w-4", colors.text.muted)} />
          <h3 className="text-sm font-semibold">
            {t('chequeRegistry.title')}
          </h3>
        </span>
        <Button
          size="sm"
          variant="outline"
          className="gap-1 text-xs h-7"
          onClick={() => setAddDialogOpen(true)}
        >
          <Plus className="h-3 w-3" />
          {t('chequeRegistry.actions.addCheque')}
        </Button>
      </header>

      {cheques.length === 0 ? (
        <p className={cn("text-xs text-center py-2", colors.text.muted)}>
          {t('chequeRegistry.noCheques')}
        </p>
      ) : (
        <ChequeTable cheques={cheques} onSelectCheque={setDetailCheque} />
      )}

      <AddChequeDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={createCheque}
        projectId={projectId ?? ''}
        paymentPlanId={paymentPlanId}
        contactId={contactId}
      />

      {detailCheque && (
        <ChequeDetailDialog
          open={!!detailCheque}
          onOpenChange={(open) => { if (!open) setDetailCheque(null); }}
          cheque={detailCheque}
          onUpdate={(input) => updateCheque(detailCheque.chequeId, input)}
          onTransition={(input) => transitionStatus(detailCheque.chequeId, input)}
          onEndorse={(input) => endorseCheque(detailCheque.chequeId, input)}
          onBounce={(input) => bounceCheque(detailCheque.chequeId, input)}
        />
      )}
    </section>
  );
}
