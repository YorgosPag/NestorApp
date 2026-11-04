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
import { useStageTransitionCommand } from '../stage-move/useStageTransitionCommand';
import { StageMoveDialogs } from '../stage-move/StageMoveDialogs';

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
  const stageCommand = useStageTransitionCommand();

  /** Τα υπόλοιπα πεδία — όπως πριν. Το στάδιο ΔΕΝ γράφεται εδώ (ADR-929). */
  const saveFields = async (id: string, updates: Partial<Opportunity>) => {
    if (Object.keys(updates).length === 0) return;
    try {
      await updateOpportunityWithPolicy({ opportunityId: id, updates });
      notifications.success(t('opportunities.editModal.messages.success'));
    } catch (error) {
      notifications.error(t('opportunities.editModal.messages.error'));
      logger.error('Error updating opportunity', { error });
      throw error;
    }
  };

  const handleSave = async (formData: Partial<Opportunity>) => {
    if (!opportunity?.id) return;
    // ADR-929: το στάδιο περνά από την ΙΔΙΑ εντολή με το σύρσιμο (διάλογος κλεισίματος, έλεγχος σύγκρουσης,
    // ιστορικό) — η φόρμα μένει ανοιχτή μέχρι να απαντήσει ο άνθρωπος στον διάλογο.
    const { stage, ...updates } = pickChangedOpportunityFields(opportunity, formData);
    await saveFields(opportunity.id, updates);
    if (stage && stage !== opportunity.stage) await stageCommand.requestMove(opportunity, stage);
    onLeadUpdated();
  };

  return (
    <>
      <StageMoveDialogs dialogs={stageCommand.dialogs} />
      <OpportunityFormDialog
        title={t('opportunities.editModal.title')}
        open={isOpen}
        onClose={onClose}
        initialData={opportunity}
        onSave={handleSave}
      />
    </>
  );
}
