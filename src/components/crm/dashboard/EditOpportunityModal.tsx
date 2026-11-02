'use client';

import { updateOpportunityWithPolicy } from '@/services/crm/crm-mutation-gateway';
import { useNotifications } from '@/providers/NotificationProvider';
import type { Opportunity } from '@/types/crm';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';
import { OpportunityFormDialog } from './dialogs/OpportunityFormDialog';
import '@/lib/design-system';
import { pickChangedOpportunityFields } from '../utils/opportunity-utils';

const logger = createModuleLogger('EditOpportunityModal');

interface EditOpportunityModalProps {
  opportunity: Opportunity | null;
  isOpen: boolean;
  onClose: () => void;
  onLeadUpdated: () => void;
}

export function EditOpportunityModal({ opportunity, isOpen, onClose, onLeadUpdated }: EditOpportunityModalProps) {
  const { t } = useTranslation('crm');
  const notifications = useNotifications();

  const handleSave = async (formData: Partial<Opportunity>) => {
    if (!opportunity?.id) return;

    const updates = pickChangedOpportunityFields(opportunity, formData);
    if (Object.keys(updates).length === 0) return;

    try {
      await updateOpportunityWithPolicy({
        opportunityId: opportunity.id,
        updates,
      });
      notifications.success(t('opportunities.editModal.messages.success'));
      onLeadUpdated();
    } catch (error) {
      notifications.error(t('opportunities.editModal.messages.error'));
      logger.error('Error updating opportunity', { error });
      throw error;
    }
  };

  return (
    <OpportunityFormDialog
      title={t('opportunities.editModal.title')}
      open={isOpen}
      onClose={onClose}
      initialData={opportunity}
      onSave={handleSave}
    />
  );
}
