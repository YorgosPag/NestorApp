'use client';

/**
 * @fileoverview Create APY Certificate Dialog — Δημιουργία Βεβαίωσης Παρακράτησης
 * @description Επιλογή πελάτη (επαφή) + έτους ⇒ προεπισκόπηση που ΥΠΟΛΟΓΙΖΕΙ ο διακομιστής από ΟΛΑ τα παραστατικά
 *   του πελάτη (`useAPYCertificateDraft`) ⇒ δημιουργία με τον ΙΔΙΟ υπολογισμό. Duplicate check → navigation προς existing.
 *
 * 🔴 2026-10-30 (ADR-ACC-010 §2.1.1): ο διάλογος διάβαζε `data.invoices` από τη ΣΕΛΙΔΑ της λίστας τιμολογίων (το
 *   πεδίο είναι `items`) με φίλτρο `vatNumber` που η λίστα δεν γνωρίζει ⇒ «κανένα επιλέξιμο τιμολόγιο» ΠΑΝΤΑ· και
 *   έστελνε σύνολα υπολογισμένα στον browser, με ακυρωμένα/πιστωμένα μέσα. Ο διάλογος πλέον **δεν αθροίζει τίποτα**.
 *
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-17
 * @see ADR-ACC-020 Βεβαίωση Παρακράτησης Φόρου
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Loader2, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { ContactSearchManager } from '@/components/contacts/relationships/ContactSearchManager';
import { useAPYCertificates } from '../../hooks/useAPYCertificates';
import { useAPYCertificateDraft } from '../../hooks/useAPYCertificateDraft';
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

// ============================================================================
// COMPONENT
// ============================================================================

export function CreateAPYCertificateDialog({
  open,
  onOpenChange,
  onCreated,
  defaultFiscalYear,
}: CreateAPYCertificateDialogProps) {
  const { t } = useTranslation(['accounting', 'accounting-tax-offices']);
  const { createCertificate } = useAPYCertificates({ autoFetch: false });

  const [fiscalYear, setFiscalYear] = useState<number>(defaultFiscalYear);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const { draft, loading, failed } = useAPYCertificateDraft(open ? customerId : null, fiscalYear);

  const [submitting, setSubmitting] = useState(false);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setFiscalYear(defaultFiscalYear);
      setCustomerId(null);
      setDuplicateId(null);
      setSubmitError(null);
    }
  }, [open, defaultFiscalYear]);

  const lineItems = draft?.lineItems ?? [];

  const handleCreate = async () => {
    if (!customerId || lineItems.length === 0) return;

    setSubmitting(true);
    setSubmitError(null);
    setDuplicateId(null);

    const result = await createCertificate({ fiscalYear, customerId });

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

  const canCreate = customerId !== null && lineItems.length > 0 && !loading && !submitting;

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
          <div className="flex items-start gap-4">
            {/* Fiscal Year */}
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

            {/* Customer (contact) — το κλειδί της σάρωσης είναι η επαφή, όχι ελεύθερο ΑΦΜ */}
            <fieldset className="flex-1 space-y-1">
              <Label>{t('apy.fields.customer')}</Label>
              <ContactSearchManager
                selectedContactId={customerId ?? ''}
                onContactSelect={(contact) => setCustomerId(contact?.id ?? null)}
                allowedContactTypes={['individual', 'company', 'service']}
                label=""
                placeholder={t('setup.searchContact')}
                searchConfig={{ autoLoadContacts: true, maxResults: 20 }}
              />
              {draft?.customer && (
                <p className="text-sm text-muted-foreground">
                  {draft.customer.name}
                  {draft.customer.vatNumber && ` · ${t('apy.fields.vatNumber')} ${draft.customer.vatNumber}`}
                </p>
              )}
            </fieldset>
          </div>

          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {failed && (
            <div role="alert" className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              {t('apy.invoices.loadFailed')}
            </div>
          )}

          {draft && lineItems.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2">
                {t('apy.invoices.withholdingHeading', { count: lineItems.length })}
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
                  {lineItems.map((line) => (
                    <TableRow key={line.invoiceId}>
                      <TableCell className="font-mono">{line.invoiceNumber}</TableCell>
                      <TableCell>{line.issueDate.substring(0, 10)}</TableCell>
                      <TableCell className="text-right">{formatAccountingCurrency(line.netAmount)}</TableCell>
                      <TableCell className="text-center">{line.withholdingRate}%</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatAccountingCurrency(line.withholdingAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={2} className="text-right">
                      {t('apy.invoiceTable.totals')}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatAccountingCurrency(draft.totalNetAmount)}
                    </TableCell>
                    <TableCell />
                    <TableCell className="text-right text-primary">
                      {formatAccountingCurrency(draft.totalWithholdingAmount)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <p className="mt-2 text-xs text-muted-foreground">{t('apy.invoices.excludedNote')}</p>
            </div>
          )}

          {draft && lineItems.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t('apy.invoices.empty', { year: fiscalYear })}
            </p>
          )}

          {/* Duplicate warning */}
          {duplicateId && (
            <div className="flex items-start gap-2 p-3 bg-[hsl(var(--bg-warning))]/40 border border-[hsl(var(--text-warning))] rounded-md">
              <AlertCircle className="h-4 w-4 text-[hsl(var(--text-warning))] mt-0.5 shrink-0" />
              <div className="text-sm text-foreground">
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
            <p className="text-sm text-destructive">{submitError}</p>
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
