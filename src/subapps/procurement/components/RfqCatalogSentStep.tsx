'use client';

/**
 * **Μετά την αποστολή ενός «Ζητήστε προσφορά» από τη βιτρίνα** (ADR-923 §5.13 Ε6δ, Τ6): το επόμενο βήμα.
 *
 * 🔑 Το αποφασίζει **η απάντηση της δημιουργίας** (`catalogSuppliers` → `suppliersToOfferAccess`), όχι το πρόχειρο: όποιος
 *    έσβησε τη γραμμή καταλόγου πριν στείλει δεν βλέπει ποτέ «προσκλήθηκε ο προμηθευτής».
 * 🔑 Η πρόταση δεν μπλοκάρει: το αίτημα έχει ήδη γίνει, και το «Προβολή αιτήματος» είναι πάντα εκεί.
 * ⚠️ Το κείμενο λέει «προσκλήθηκε», όχι «ειδοποιήθηκε»: η παράδοση email και ειδοποίησης στον προμηθευτή είναι το Τ5.
 *
 * @module subapps/procurement/components/RfqCatalogSentStep
 */

import { CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { declaredHref } from '@/lib/workspace/route-worlds';
import { Link } from '@/lib/workspace/navigation';

import type { SupplierWithAccess } from './rfq-builder-lines';

/** Ο λόγος του `declaredHref`: η διαδρομή φτιάχτηκε στον διακομιστή από το `supplyRequestHref`. */
const ACCESS_HREF_REASON =
  'Σελίδα-πύλη αιτήματος πρόσβασης στους τιμοκαταλόγους: τη συνθέτει ο διακομιστής με το supplyRequestHref (ADR-923 §5.13 Ε6δ).';

interface RfqCatalogSentStepProps {
  readonly suppliers: readonly SupplierWithAccess[];
  readonly onViewRfq: () => void;
}

export function RfqCatalogSentStep({ suppliers, onViewRfq }: RfqCatalogSentStepProps) {
  const { t } = useTranslation('quotes');
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
          {t('rfqs.catalogSent.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {suppliers.map((supplier) => (
            <li key={supplier.supplierCompanyId} className="flex flex-col gap-2">
              <p className="m-0 text-sm">{t('rfqs.catalogSent.body', { supplier: supplier.supplierName })}</p>
              <p className="m-0 text-sm text-muted-foreground">{t('rfqs.catalogSent.accessPrompt', { supplier: supplier.supplierName })}</p>
              <Button asChild className="self-start">
                <Link href={declaredHref(ACCESS_HREF_REASON, supplier.priceListAccessHref)}>{t('rfqs.catalogSent.requestAccess')}</Link>
              </Button>
            </li>
          ))}
        </ul>
        <Button type="button" variant="outline" onClick={onViewRfq}>{t('rfqs.catalogSent.viewRfq')}</Button>
      </CardContent>
    </Card>
  );
}
