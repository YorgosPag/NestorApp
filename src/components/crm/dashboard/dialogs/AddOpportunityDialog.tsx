/**
 * Νέο lead από τη Ροή Πωλήσεων.
 *
 * Η φόρμα είναι η κοινή `OpportunityFormDialog`. Αν ο χρήστης δεν δώσει τίτλο, η
 * ευκαιρία παίρνει το όνομα του πελάτη, γιατί το σχήμα απαιτεί τίτλο.
 *
 * @module components/crm/dashboard/dialogs/AddOpportunityDialog
 * @see ADR-251
 */

'use client';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Opportunity } from '@/types/crm';
import { OpportunityFormDialog } from './OpportunityFormDialog';

interface AddOpportunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<Opportunity>) => Promise<void>;
}

const NEW_LEAD_DEFAULTS: Partial<Opportunity> = { stage: 'initial_contact' };

export function AddOpportunityDialog({ open, onOpenChange, onSubmit }: AddOpportunityDialogProps) {
  const { t } = useTranslation('crm');

  return (
    <OpportunityFormDialog
      title={t('pipeline.newLead')}
      open={open}
      onClose={() => onOpenChange(false)}
      initialData={NEW_LEAD_DEFAULTS}
      onSave={(data) => {
        const fullName = data.fullName?.trim() ?? '';
        return onSubmit({ ...data, fullName, title: data.title?.trim() || fullName });
      }}
    />
  );
}
