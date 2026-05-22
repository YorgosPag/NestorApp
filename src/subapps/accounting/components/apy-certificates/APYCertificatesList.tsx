'use client';

/**
 * @fileoverview APY Certificates List — Λίστα Βεβαιώσεων Παρακράτησης Φόρου
 * @description Table view με φίλτρα έτους + κατάστασης. Δημιουργία νέας βεβαίωσης.
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-17
 * @see ADR-ACC-020 Βεβαίωση Παρακράτησης Φόρου
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardCheck, Plus, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { PageLoadingState, PageErrorState } from '@/core/states';
import { useAPYCertificates } from '../../hooks/useAPYCertificates';
import type { APYCertificate } from '../../types';
import { formatAccountingCurrency } from '../../utils/format';
import { CreateAPYCertificateDialog } from './CreateAPYCertificateDialog';

// ============================================================================
// TYPES
// ============================================================================

interface APYCertificatesListProps {
  onSelectCertificate: (certificateId: string) => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function buildFiscalYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  return [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
}

// ============================================================================
// COMPONENT
// ============================================================================

export function APYCertificatesList({ onSelectCertificate }: APYCertificatesListProps) {
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);
  const currentYear = new Date().getFullYear();

  const [fiscalYear, setFiscalYear] = useState<number>(currentYear);
  const [statusFilter, setStatusFilter] = useState<'all' | 'received' | 'pending'>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { certificates, loading, error, refetch } = useAPYCertificates({ fiscalYear });

  const filteredCertificates = certificates.filter((cert) => {
    if (statusFilter === 'received') return cert.isReceived;
    if (statusFilter === 'pending') return !cert.isReceived;
    return true;
  });

  const handleCreated = (certificateId: string) => {
    setCreateDialogOpen(false);
    refetch();
    onSelectCertificate(certificateId);
  };

  if (loading) return <PageLoadingState message={t('apy.loading')} />;
  if (error) return <PageErrorState title={t('apy.errorTitle')} message={error} onRetry={refetch} />;

  return (
    <section>
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-6 w-6 text-navy-600" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {t('apy.pageTitle')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('apy.pageDescription')}
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('apy.newCertificate')}
        </Button>
      </header>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('apy.filters.year')}</span>
          <Select
            value={String(fiscalYear)}
            onValueChange={(v) => setFiscalYear(parseInt(v, 10))}
          >
            <SelectTrigger className="w-28">
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

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('apy.filters.status')}</span>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('apy.filters.all')}</SelectItem>
              <SelectItem value="received">{t('apy.filters.received')}</SelectItem>
              <SelectItem value="pending">{t('apy.filters.pending')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <span className="text-sm text-muted-foreground ml-auto">
          {t('apy.count', { count: filteredCertificates.length })}
        </span>
      </div>

      {/* Table */}
      {filteredCertificates.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardCheck className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium">{t('apy.empty.title')}</p>
          <p className="text-sm mt-1">{t('apy.empty.hint')}</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('apy.table.customer')}</TableHead>
              <TableHead>{t('apy.table.vatNumber')}</TableHead>
              <TableHead className="text-center">{t('apy.table.year')}</TableHead>
              <TableHead className="text-center">{t('apy.table.invoiceCount')}</TableHead>
              <TableHead className="text-right">{t('apy.table.totalWithholding')}</TableHead>
              <TableHead className="text-center">{t('apy.table.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCertificates.map((cert) => (
              <APYCertificateRow
                key={cert.certificateId}
                cert={cert}
                onClick={() => onSelectCertificate(cert.certificateId)}
              />
            ))}
          </TableBody>
        </Table>
      )}

      <CreateAPYCertificateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={handleCreated}
        defaultFiscalYear={fiscalYear}
      />
    </section>
  );
}

// ============================================================================
// ROW COMPONENT
// ============================================================================

interface APYCertificateRowProps {
  cert: APYCertificate;
  onClick: () => void;
}

function APYCertificateRow({ cert, onClick }: APYCertificateRowProps) {
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);
  return (
    <TableRow
      className="cursor-pointer hover:bg-accent transition-colors"
      onClick={onClick}
    >
      <TableCell className="font-medium text-foreground">{cert.customer.name}</TableCell>
      <TableCell className="text-muted-foreground font-mono text-sm">{cert.customer.vatNumber}</TableCell>
      <TableCell className="text-center text-foreground">{cert.fiscalYear}</TableCell>
      <TableCell className="text-center text-muted-foreground">{cert.lineItems.length}</TableCell>
      <TableCell className="text-right font-semibold text-foreground">
        {formatAccountingCurrency(cert.totalWithholdingAmount)}
      </TableCell>
      <TableCell className="text-center">
        {cert.isReceived ? (
          <Badge className="bg-[hsl(var(--bg-success))]/40 text-green-707 border-[hsl(var(--bg-success))]">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {t('apy.status.received')}
          </Badge>
        ) : (
          <Badge className="bg-[hsl(var(--bg-warning))]/40 text-[hsl(var(--bg-warning))] border-[hsl(var(--bg-warning))]">
            <Clock className="h-3 w-3 mr-1" />
            {t('apy.status.pending')}
          </Badge>
        )}
      </TableCell>
    </TableRow>
  );
}
