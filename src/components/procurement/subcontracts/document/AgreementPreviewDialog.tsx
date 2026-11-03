'use client';

/**
 * Το παράθυρο «Προεπισκόπηση εγγράφου» (ADR-928 §5.17): το έγγραφο ανά γλώσσα και, κάτω, το ημερολόγιο πληρωμών
 * (εκτίμηση). Η απόδοση ζει στο `AgreementDocumentColumns` — η ίδια με τη ζωντανή προεπισκόπηση του επεξεργαστή (Φ3γ).
 *
 * Φορτώνεται με `import()` από τη λίστα: το slice της καρτέλας δεν κουβαλά μοντέλο, bundles εγγράφου ή ολογράφως.
 */

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { SubcontractAgreement } from '@/subapps/procurement/subcontracts/types/agreement';
import { AgreementDocumentColumns, AgreementPaymentCalendar } from './AgreementDocumentColumns';

interface AgreementPreviewDialogProps {
  readonly agreement: SubcontractAgreement;
  readonly onClose: () => void;
}

export default function AgreementPreviewDialog({ agreement, onClose }: AgreementPreviewDialogProps) {
  const { t } = useTranslation('procurement');
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="2xl" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('subcontracts.preview.title', { number: agreement.documentNumber })}</DialogTitle>
          <DialogDescription>{t('subcontracts.preview.description')}</DialogDescription>
        </DialogHeader>
        <AgreementDocumentColumns agreement={agreement} />
        <AgreementPaymentCalendar agreement={agreement} />
      </DialogContent>
    </Dialog>
  );
}
