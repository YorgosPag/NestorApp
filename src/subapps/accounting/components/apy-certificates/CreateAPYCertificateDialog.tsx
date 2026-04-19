'use client';

/**
 * @fileoverview Create APY Certificate Dialog — Δημιουργία Βεβαίωσης Παρακράτησης
 * @description Dialog για δημιουργία νέας βεβαίωσης. Auto-fetches invoices με withholding > 0
 *   για τον επιλεγμένο πελάτη + έτος. Duplicate check → navigation προς existing.
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-17
 * @see ADR-ACC-020 Βεβαίωση Παρακράτησης Φόρου
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, AlertCircle, Loader2, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { API_ROUTES } from '@/config/domain-constants';
import { useAPYCertificates } from '../../hooks/useAPYCertificates';
import { useCompanySetup } from '../../hooks/useCompanySetup';
import type { APYCertificate, APYCertificateLineItem, Invoice } from '../../types';
import { formatAccountingCurrency } from '../../utils/format';

// ============================================================================
// TYPES
// ============================================================================

interface CreateAPYCertificateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (certificateId: string) => void;
  defaultFiscalYear: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function buildFiscalYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  return [currentYear, currentYear - 1, currentYear - 2];
}

function buildInvoiceNumber(invoice: Invoice): string {
  return `${invoice.series}-${invoice.number}`;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CreateAPYCertificateDialog({
  open,
  onOpenChange,
  onCreated,
  defaultFiscalYear,
}: CreateAPYCertificateDialogProps) {
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);
  const { user } = useAuth();
  const { profile: companyProfile } = useCompanySetup();
  const { createCertificate } = useAPYCertificates({ autoFetch: false });

  const [fiscalYear, setFiscalYear] = useState<number>(defaultFiscalYear);
  const [customerVatNumber, setCustomerVatNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);

  const [eligibleInvoices, setEligibleInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setFiscalYear(defaultFiscalYear);
      setCustomerVatNumber('');
      setCustomerName('');
      setCustomerId(null);
      setEligibleInvoices([]);
      setInvoicesError(null);
      setDuplicateId(null);
      setSubmitError(null);
    }
  }, [open, defaultFiscalYear]);

  const fetchEligibleInvoices = useCallback(async () => {
    if (!user || !customerVatNumber.trim()) return;

    try {
      setInvoicesLoading(true);
      setInvoicesError(null);
      setEligibleInvoices([]);

      const token = await user.getIdToken();
      const params = new URLSearchParams({
        fiscalYear: String(fiscalYear),
        vatNumber: customerVatNumber.trim(),
      });

      const response = await fetch(`${API_ROUTES.ACCOUNTING.INVOICES.LIST}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: { invoices?: Invoice[] } = await response.json();
      const allInvoices = data.invoices ?? [];

      // Filter: only invoices with withholdingAmount > 0, exclude credit_invoice
      const eligible = allInvoices.filter(
        (inv) =>
          inv.type !== 'credit_invoice' &&
          inv.withholdingAmount !== undefined &&
          inv.withholdingAmount !== null &&
          inv.withholdingAmount > 0
      );

      setEligibleInvoices(eligible);

      // Auto-fill customer info from first invoice
      if (eligible.length > 0) {
        setCustomerName(eligible[0].customer.name);
        setCustomerId(eligible[0].customer.contactId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch invoices';
      setInvoicesError(message);
    } finally {
      setInvoicesLoading(false);
    }
  }, [user, fiscalYear, customerVatNumber]);

  const totalNetAmount = eligibleInvoices.reduce(
    (sum, inv) => sum + inv.totalNetAmount,
    0
  );
  const totalWithholdingAmount = eligibleInvoices.reduce(
    (sum, inv) => sum + (inv.withholdingAmount ?? 0),
    0
  );

  const handleCreate = async () => {
    if (!companyProfile || eligibleInvoices.length === 0) return;

    setSubmitting(true);
    setSubmitError(null);
    setDuplicateId(null);

    const lineItems: APYCertificateLineItem[] = eligibleInvoices.map((inv) => ({
      invoiceId: inv.invoiceId,
      invoiceNumber: buildInvoiceNumber(inv),
      issueDate: inv.issueDate,
      netAmount: inv.totalNetAmount,
      withholdingRate: inv.withholdingRate ?? 20,
      withholdingAmount: inv.withholdingAmount ?? 0,
    }));

    const provider: APYCertificate['provider'] = {
      name: companyProfile.businessName,
      vatNumber: companyProfile.vatNumber,
      taxOffice: companyProfile.taxOffice ?? '',
      address: companyProfile.address ?? '',
      city: companyProfile.city ?? '',
      postalCode: companyProfile.postalCode ?? '',
      profession: companyProfile.profession ?? '',
      phone: companyProfile.phone ?? null,
      email: companyProfile.email ?? null,
    };

    const customer: APYCertificate['customer'] = {
      name: customerName,
      vatNumber: customerVatNumber.trim(),
      taxOffice: eligibleInvoices[0]?.customer.taxOffice ?? null,
      address: eligibleInvoices[0]?.customer.address ?? null,
      city: eligibleInvoices[0]?.customer.city ?? null,
    };

    const result = await createCertificate({
      fiscalYear,
      customerId,
      provider,
      customer,
      lineItems,
      totalNetAmount,
      totalWithholdingAmount,
    });

    setSubmitting(false);

    if (!result) {
      setSubmitError(t('apy.createFailed'));
      return;
    }

    if ('existingCertificateId' in result) {
      setDuplicateId(result.existingCertificateId);
      return;
    }

    onCreated(result.id);
  };

  const canCreate =
    eligibleInvoices.length > 0 && customerVatNumber.trim().length > 0 && !submitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            {t('apy.createDialogTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Fiscal Year */}
          <div className="flex items-center gap-4">
            <div className="w-36">
              <Label htmlFor="apy-fiscal-year">{t('apy.fields.fiscalYear')}</Label>
              <Select
                value={String(fiscalYear)}
                onValueChange={(v) => setFiscalYear(parseInt(v, 10))}
              >
                <SelectTrigger id="apy-fiscal-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {buildFiscalYearOptions().map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Customer VAT */}
            <div className="flex-1">
              <Label htmlFor="apy-vat">{t('apy.fields.customerVat')}</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="apy-vat"
                  value={customerVatNumber}
                  onChange={(e) => setCustomerVatNumber(e.target.value)}
                  placeholder={t('apy.fields.vatPlaceholder')}
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  onClick={fetchEligibleInvoices}
                  disabled={!customerVatNumber.trim() || invoicesLoading}
                >
                  {invoicesLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Invoices Preview */}
          {invoicesError && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="h-4 w-4" />
              {invoicesError}
            </div>
          )}

          {eligibleInvoices.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                {t('apy.invoices.withholdingHeading', { count: eligibleInvoices.length })}
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('apy.invoiceTable.number')}</TableHead>
                    <TableHead>{t('apy.invoiceTable.date')}</TableHead>
                    <TableHead className="text-right">{t('apy.invoiceTable.netAmount')}</TableHead>
                    <TableHead className="text-center">{t('apy.invoiceTable.rate')}</TableHead>
                    <TableHead className="text-right">{t('apy.invoiceTable.withholding')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eligibleInvoices.map((inv) => (
                    <TableRow key={inv.invoiceId}>
                      <TableCell className="font-mono">{buildInvoiceNumber(inv)}</TableCell>
                      <TableCell>{inv.issueDate.substring(0, 10)}</TableCell>
                      <TableCell className="text-right">{formatAccountingCurrency(inv.totalNetAmount)}</TableCell>
                      <TableCell className="text-center">{inv.withholdingRate ?? 20}%</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatAccountingCurrency(inv.withholdingAmount ?? 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-gray-50 font-semibold">
                    <TableCell colSpan={4} className="text-right">
                      {t('apy.invoiceTable.totalWithholding')}
                    </TableCell>
                    <TableCell className="text-right text-blue-900">
                      {formatAccountingCurrency(totalWithholdingAmount)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}

          {eligibleInvoices.length === 0 && !invoicesLoading && customerVatNumber.trim() && (
            <p className="text-sm text-gray-500 text-center py-4">
              {t('apy.invoices.empty')}
            </p>
          )}

          {/* Duplicate warning */}
          {duplicateId && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">{t('apy.duplicate.title')}</p>
                <p>{t('apy.duplicate.message', { year: fiscalYear })}</p>
                <button
                  className="underline mt-1"
                  onClick={() => { onOpenChange(false); onCreated(duplicateId); }}
                >
                  {t('apy.duplicate.viewExisting')}
                </button>
              </div>
            </div>
          )}

          {submitError && (
            <p className="text-sm text-red-600">{submitError}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('apy.cancel')}
          </Button>
          <Button onClick={handleCreate} disabled={!canCreate}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('apy.createButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
