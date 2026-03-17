'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MoreHorizontal, Printer, Download, Mail, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Invoice, CompanyProfile } from '@/subapps/accounting/types';
import {
  exportInvoicePDF,
  printInvoicePDF,
  extractKadFromProfile,
} from '@/subapps/accounting/services/pdf/invoice-pdf-exporter';
import type { InvoicePDFSettings } from '@/subapps/accounting/services/pdf/invoice-pdf-exporter';

interface InvoiceActionsMenuProps {
  invoice: Invoice;
  onRefresh: () => void;
  companyProfile: CompanyProfile | null;
  onSendEmail: () => void;
}

/**
 * Build PDF settings from company profile (fallback for old invoices without snapshot).
 */
function buildPDFSettings(profile: CompanyProfile | null): InvoicePDFSettings {
  const settings: InvoicePDFSettings = {
    kadCode: extractKadFromProfile(profile),
    withholdingAmount: 0,
  };

  // Fallback bank accounts from company profile
  // Note: New invoices have bankAccounts in issuer snapshot (ADR-ACC-018)
  // This is only needed for backward compatibility with old invoices
  return settings;
}

export function InvoiceActionsMenu({ invoice, onRefresh, companyProfile, onSendEmail }: InvoiceActionsMenuProps) {
  const { t } = useTranslation('accounting');
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);

  const pdfSettings = buildPDFSettings(companyProfile);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await exportInvoicePDF(invoice, pdfSettings);
    } catch (err) {
      console.error('[InvoiceActionsMenu] PDF download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = async () => {
    setPrinting(true);
    try {
      await printInvoicePDF(invoice, pdfSettings);
    } catch (err) {
      console.error('[InvoiceActionsMenu] PDF print failed:', err);
    } finally {
      setPrinting(false);
    }
  };

  const isLoading = downloading || printing;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handlePrint} disabled={printing}>
          <Printer className="mr-2 h-4 w-4" />
          {t('forms.print')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownload} disabled={downloading}>
          <Download className="mr-2 h-4 w-4" />
          {t('forms.download')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSendEmail}>
          <Mail className="mr-2 h-4 w-4" />
          {t('forms.sendEmail')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
