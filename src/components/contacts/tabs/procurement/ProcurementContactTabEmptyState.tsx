'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingCart, FileText, Send } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useRouter } from 'next/navigation';

interface ProcurementContactTabEmptyStateProps {
  contactId: string;
  archived: boolean;
  onCreateManual?: () => void;
}

export function ProcurementContactTabEmptyState({
  contactId,
  archived,
  onCreateManual,
}: ProcurementContactTabEmptyStateProps) {
  const { t } = useTranslation('contacts');
  const router = useRouter();

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <ShoppingCart className="h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-semibold">{t('procurementTab.empty.title')}</h3>
        <p className="max-w-md text-sm text-muted-foreground">
          {t('procurementTab.empty.description')}
        </p>
        {!archived && (
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              size="sm"
              onClick={() => onCreateManual?.()}
            >
              <FileText className="mr-1 h-4 w-4" />
              {t('procurementTab.empty.cta.firstQuote')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                router.push(`/procurement/rfqs/new?vendorContactId=${encodeURIComponent(contactId)}`)
              }
            >
              <Send className="mr-1 h-4 w-4" />
              {t('procurementTab.empty.cta.firstRfq')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
