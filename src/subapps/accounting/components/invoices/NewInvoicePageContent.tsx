'use client';

import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InvoiceForm } from './forms/InvoiceForm';

import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { cn } from '@/lib/utils';

export function NewInvoicePageContent() {
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);
  const colors = useSemanticColors();
  const router = useRouter();

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('invoices.newInvoice')}</h1>
            <p className={cn("text-sm mt-1", colors.text.muted)}>{t('invoices.description')}</p>
          </div>
        </div>
      </header>

      <section className="p-6 max-w-5xl mx-auto">
        <InvoiceForm
          onSuccess={(invoiceId) => {
            router.push(`/accounting/invoices?view=${invoiceId}`);
          }}
          onCancel={() => router.back()}
        />
      </section>
    </main>
  );
}
