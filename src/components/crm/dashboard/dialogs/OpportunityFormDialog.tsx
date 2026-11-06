/**
 * Η μία φόρμα ευκαιρίας/lead, κοινή για δημιουργία και επεξεργασία.
 *
 * Κατέχει τα πεδία, την κατάσταση της φόρμας και το κλείσιμο. Η εγγραφή και οι
 * ειδοποιήσεις ανήκουν στον καταναλωτή μέσω του `onSave`. Αν το `onSave` απορριφθεί,
 * το dialog μένει ανοιχτό με ό,τι έγραψε ο χρήστης.
 *
 * @module components/crm/dashboard/dialogs/OpportunityFormDialog
 * @see ADR-251
 */

'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Save } from 'lucide-react';
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
import { Spinner } from '@/components/ui/spinner';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Opportunity } from '@/types/crm';
import '@/lib/design-system';
import { OPPORTUNITY_STAGE_IDS } from '@/config/crm/opportunity-stages';
import { OpportunityContactField, type OpportunityContactValue } from '../OpportunityContactField';
import { OpportunityDealFields } from '../OpportunityDealFields';

type OpportunityStage = Opportunity['stage'];

const EMPTY_FORM_DATA: Partial<Opportunity> = {};

interface OpportunityFormDialogProps {
  /** Ο τίτλος του dialog, μεταφρασμένος από τον καταναλωτή. */
  title: string;
  open: boolean;
  onClose: () => void;
  /** Οι αρχικές τιμές. Πρέπει να είναι σταθερή αναφορά όσο το dialog είναι ανοιχτό. */
  initialData: Partial<Opportunity> | null;
  /** Αποθηκεύει και ειδοποιεί. Απόρριψη σημαίνει ότι το dialog μένει ανοιχτό. */
  onSave: (data: Partial<Opportunity>) => Promise<void>;
  /**
   * Πεδία που ανήκουν σε **άλλη πόρτα** από την εγγραφή της φόρμας (π.χ. «Κάτοχος», ADR-930 §3.8): ο καταναλωτής κατέχει
   * την κατάστασή τους και τα εκτελεί μέσα στο δικό του `onSave`. Μπαίνουν μετά το στάδιο.
   */
  extraFields?: (disabled: boolean) => ReactNode;
}

export function OpportunityFormDialog({
  title,
  open,
  onClose,
  initialData,
  onSave,
  extraFields,
}: OpportunityFormDialogProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('crm');
  const [formData, setFormData] = useState<Partial<Opportunity>>(EMPTY_FORM_DATA);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFormData(open && initialData ? initialData : EMPTY_FORM_DATA);
  }, [open, initialData]);

  const handleClose = useCallback(() => {
    setFormData(EMPTY_FORM_DATA);
    onClose();
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    try {
      await onSave(formData);
      handleClose();
    } catch {
      // Ο καταναλωτής έχει ήδη ειδοποιήσει και καταγράψει το σφάλμα.
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFieldChange = useCallback((field: keyof Opportunity, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Νέος πελάτης: όνομα και `contactId` μαζί· email/τηλέφωνο μόνο αν τα έχει η επαφή.
  const handleContactChange = useCallback((value: OpportunityContactValue) => {
    setFormData(prev => ({
      ...prev,
      fullName: value.fullName,
      contactId: value.contactId,
      email: value.email ?? prev.email,
      phone: value.phone ?? prev.phone,
    }));
  }, []);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <OpportunityContactField
            fullName={formData.fullName ?? ''}
            contactId={formData.contactId}
            disabled={loading}
            onChange={handleContactChange}
          />
          {formData.contactId ? (
            <p className="text-sm text-muted-foreground">{t('opportunities.editModal.linkedContactHint')}</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">{t('opportunities.editModal.labels.email')}</Label>
                <Input id="email" name="email" type="email" value={formData.email || ''} onChange={handleChange} required disabled={loading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t('opportunities.editModal.labels.phone')}</Label>
                <Input id="phone" name="phone" value={formData.phone || ''} onChange={handleChange} disabled={loading} />
              </div>
            </>
          )}
          <OpportunityDealFields
            values={formData}
            disabled={loading}
            onTextChange={handleFieldChange}
            onNumberChange={handleFieldChange}
          />
          <div className="space-y-2">
            <Label htmlFor="stage">{t('opportunities.editModal.labels.stage')}</Label>
            <Select
              name="stage"
              value={formData.stage ?? undefined}
              onValueChange={(value) => handleFieldChange('stage', value as OpportunityStage)}
              disabled={loading}
            >
              <SelectTrigger id="stage">
                <SelectValue placeholder={t('opportunities.editModal.labels.stagePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {OPPORTUNITY_STAGE_IDS.map(stageId => (
                  <SelectItem key={stageId} value={stageId}>{t(`opportunities.stages.${stageId}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {extraFields?.(loading)}
          <div className="space-y-2">
            <Label htmlFor="notes">{t('opportunities.editModal.labels.notes')}</Label>
            <Textarea id="notes" name="notes" value={formData.notes || ''} onChange={handleChange} disabled={loading} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose} disabled={loading}>{t('opportunities.editModal.buttons.cancel')}</Button>
            <Button type="submit" disabled={loading || !formData.fullName?.trim()}>
              {loading ? (
                <>
                  <Spinner size="small" color="inherit" className="mr-2" />
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
