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
import { formatCurrency } from '../../utils/format';
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

  if (loading) return <PageLoadingState message="Φόρτωση βεβαιώσεων..." />;
  if (error) return <PageErrorState title="Σφάλμα" message={error} onRetry={refetch} />;

  return (
    <section>
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-6 w-6 text-navy-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Βεβαιώσεις Παρακράτησης Φόρου
            </h1>
            <p className="text-sm text-gray-500">
              Tracking παρακρατήσεων από πελάτες
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Νέα Βεβαίωση
        </Button>
      </header>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Έτος:</span>
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
          <span className="text-sm text-gray-600">Κατάσταση:</span>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Όλες</SelectItem>
              <SelectItem value="received">Ελήφθησαν</SelectItem>
              <SelectItem value="pending">Εκκρεμείς</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <span className="text-sm text-gray-500 ml-auto">
          {filteredCertificates.length} βεβαιώσεις
        </span>
      </div>

      {/* Table */}
      {filteredCertificates.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <ClipboardCheck className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Δεν βρέθηκαν βεβαιώσεις</p>
          <p className="text-sm mt-1">Δημιουργήστε μια νέα βεβαίωση για να ξεκινήσετε.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Πελάτης</TableHead>
              <TableHead>ΑΦΜ</TableHead>
              <TableHead className="text-center">Έτος</TableHead>
              <TableHead className="text-center">Τιμολόγια</TableHead>
              <TableHead className="text-right">Σύνολο Παρακράτησης</TableHead>
              <TableHead className="text-center">Κατάσταση</TableHead>
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
  return (
    <TableRow
      className="cursor-pointer hover:bg-gray-50 transition-colors"
      onClick={onClick}
    >
      <TableCell className="font-medium text-gray-900">{cert.customer.name}</TableCell>
      <TableCell className="text-gray-600 font-mono text-sm">{cert.customer.vatNumber}</TableCell>
      <TableCell className="text-center text-gray-700">{cert.fiscalYear}</TableCell>
      <TableCell className="text-center text-gray-600">{cert.lineItems.length}</TableCell>
      <TableCell className="text-right font-semibold text-gray-900">
        {formatCurrency(cert.totalWithholdingAmount)}
      </TableCell>
      <TableCell className="text-center">
        {cert.isReceived ? (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Ελήφθη
          </Badge>
        ) : (
          <Badge className="bg-orange-100 text-orange-800 border-orange-200">
            <Clock className="h-3 w-3 mr-1" />
            Εκκρεμεί
          </Badge>
        )}
      </TableCell>
    </TableRow>
  );
}
