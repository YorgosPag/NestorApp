'use client';

import { useEffect } from 'react';

import { isOpportunityWriteConflict, updateOpportunityWithPolicy } from '@/services/crm/crm-mutation-gateway';
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
import { OpportunityOwnerField } from '../owner/OpportunityOwnerField';
import { useOwnerTransferCommand } from '../owner/useOwnerTransferCommand';

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
  const ownerCommand = useOwnerTransferCommand();
  const { reset: resetOwnerDraft } = ownerCommand;

  // Κάθε άνοιγμα (και κάθε φρεσκάρισμα της ευκαιρίας) ξεκινά από τον κάτοχο που βλέπει τώρα ο άνθρωπος — αυτός γίνεται
  // το `expectedOwnerUid` της πόρτας (CAS, ADR-930 §3.8).
  useEffect(() => { resetOwnerDraft(isOpen ? opportunity : null); }, [isOpen, opportunity, resetOwnerDraft]);

  /**
   * Τα υπόλοιπα πεδία, από την ΜΙΑ πόρτα πεδίων (ADR-930 §3.10). Το στάδιο και ο κάτοχος ΔΕΝ γράφονται εδώ. Το `original`
   * (ό,τι είδε ο άνθρωπος) γίνεται το `expected` της σύγκρουσης κατά πεδίο: αν άλλος άλλαξε στο μεταξύ ΤΑ ΙΔΙΑ πεδία,
   * η φόρμα μένει ανοιχτή και η ευκαιρία φρεσκάρεται — καμία σιωπηλή αντικατάσταση της δουλειάς του άλλου.
   */
  const saveFields = async (original: Opportunity, updates: Partial<Opportunity>) => {
    if (!original.id || Object.keys(updates).length === 0) return;
    try {
      await updateOpportunityWithPolicy({ opportunityId: original.id, original, updates });
      notifications.success(t('opportunities.editModal.messages.success'));
    } catch (error) {
      if (isOpportunityWriteConflict(error)) {
        notifications.error(t('opportunities.editModal.messages.conflict'));
        onLeadUpdated();
      } else {
        notifications.error(t('opportunities.editModal.messages.error'));
      }
      logger.error('Error updating opportunity', { error });
      throw error;
    }
  };

  const handleSave = async (formData: Partial<Opportunity>) => {
    if (!opportunity?.id) return;
    // ADR-930: πεδία → στάδιο (από τη δική του πόρτα) → κάτοχος (§3.8) ΤΕΛΕΥΤΑΙΟΣ: όποιος τη δίνει σε άλλον χάνει μετά
    // το δικαίωμα επεξεργασίας, άρα ό,τι άλλο ζήτησε πρέπει να έχει ήδη γραφτεί. Άρνηση κατόχου ⇒ η φόρμα μένει ανοιχτή
    // και η ευκαιρία φρεσκάρεται (το πρόχειρο ξαναξεκινά από τον πραγματικό κάτοχο).
    const { stage, ...updates } = pickChangedOpportunityFields(opportunity, formData);
    await saveFields(opportunity, updates);
    if (stage && stage !== opportunity.stage) await stageCommand.requestMove(opportunity, stage);
    try {
      await ownerCommand.commit(opportunity);
    } finally {
      onLeadUpdated();
    }
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
        extraFields={(disabled) => opportunity && (
          <OpportunityOwnerField
            opportunity={opportunity}
            draft={ownerCommand.draft}
            onChange={ownerCommand.setDraft}
            disabled={disabled}
          />
        )}
      />
    </>
  );
}
