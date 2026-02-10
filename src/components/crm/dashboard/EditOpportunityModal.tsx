'use client';

import { useState, useEffect, useCallback } from 'react';
import { updateOpportunity } from '@/services/opportunities.service';
import { useNotifications } from '@/providers/NotificationProvider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Loader2 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { Opportunity } from '@/types/crm';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('EditOpportunityModal');

interface EditOpportunityModalProps {
  opportunity: Opportunity | null;
  isOpen: boolean;
  onClose: () => void;
  onLeadUpdated: () => void;
}

type OpportunityStage = Opportunity['stage'];

// 🏢 ENTERPRISE: Stage IDs for iteration
const STAGE_IDS: OpportunityStage[] = [
    'initial_contact',
    'qualification',
    'viewing',
    'proposal',
    'negotiation',
    'contract',
    'closed_won',
    'closed_lost',
];

const EMPTY_FORM_DATA: Partial<Opportunity> = {};

export function EditOpportunityModal({ opportunity, isOpen, onClose, onLeadUpdated }: EditOpportunityModalProps) {
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('crm');
  const [formData, setFormData] = useState<Partial<Opportunity>>(EMPTY_FORM_DATA);
  const [loading, setLoading] = useState(false);
  const notifications = useNotifications();

  useEffect(() => {
    if (isOpen && opportunity) {
      setFormData(opportunity);
    } else {
      setFormData(EMPTY_FORM_DATA);
    }
  }, [isOpen, opportunity]);

  const handleClose = useCallback(() => {
    setFormData(EMPTY_FORM_DATA);
    onClose();
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !opportunity?.id) return;
    
    setLoading(true);

    try {
      await updateOpportunity(opportunity.id, formData);
      notifications.success(t('opportunities.editModal.messages.success'));
      onLeadUpdated();
      handleClose();
    } catch (error) {
      notifications.error(t('opportunities.editModal.messages.error'));
      logger.error('Error updating opportunity', { error });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleSelectChange = (name: keyof Opportunity, value: OpportunityStage) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('opportunities.editModal.title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">{t('opportunities.editModal.labels.name')}</Label>
            <Input id="fullName" name="fullName" value={formData.fullName || ''} onChange={handleChange} required disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t('opportunities.editModal.labels.email')}</Label>
            <Input id="email" name="email" type="email" value={formData.email || ''} onChange={handleChange} required disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">{t('opportunities.editModal.labels.phone')}</Label>
            <Input id="phone" name="phone" value={formData.phone || ''} onChange={handleChange} disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactId">{t('opportunities.editModal.labels.contactId')}</Label>
            <Input id="contactId" name="contactId" value={formData.contactId || ''} onChange={handleChange} placeholder={t('opportunities.editModal.labels.contactIdPlaceholder')} disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stage">{t('opportunities.editModal.labels.stage')}</Label>
            <Select
              name="stage"
              value={formData.stage ?? undefined}
              onValueChange={(value) => handleSelectChange('stage', value as OpportunityStage)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('opportunities.editModal.labels.stagePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {STAGE_IDS.map(stageId => (
                  <SelectItem key={stageId} value={stageId}>{t(`opportunities.stages.${stageId}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">{t('opportunities.editModal.labels.notes')}</Label>
            <Textarea id="notes" name="notes" value={formData.notes || ''} onChange={handleChange} disabled={loading} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose} disabled={loading}>{t('opportunities.editModal.buttons.cancel')}</Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className={`mr-2 ${iconSizes.sm} animate-spin`} />
                  {t('opportunities.editModal.buttons.saving')}
                </>
              ) : (
                <>
                  <Save className={`mr-2 ${iconSizes.sm}`} />
                  {t('opportunities.editModal.buttons.save')}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
