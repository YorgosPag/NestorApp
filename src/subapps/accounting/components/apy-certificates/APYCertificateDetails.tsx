'use client';

/**
 * @fileoverview APY Certificate Details — Λεπτομέρειες Βεβαίωσης Παρακράτησης
 * @description Detail view βεβαίωσης με: Header, Πελάτης/Πάροχος, Πίνακας ΤΠΥ,
 *   Σύνολα, Email history, Actions: [Ελήφθη] | [PDF] | [Reminder].
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-17
 * @see ADR-ACC-020 Βεβαίωση Παρακράτησης Φόρου
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useState, useCallback, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileDown,
  Mail,
  Loader2,
  AlertCircle,
  Building2,
  User,
  CalendarCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageLoadingState, PageErrorState } from '@/core/states';
import { useAuth } from '@/hooks/useAuth';
import { API_ROUTES } from '@/config/domain-constants';
import { useAPYCertificates } from '../../hooks/useAPYCertificates';
import type { APYCertificate, APYEmailSendRecord } from '../../types';
import { formatCurrency } from '../../utils/format';
import { SendReminderEmailDialog } from './SendReminderEmailDialog';

// ============================================================================
// TYPES
// ============================================================================

interface APYCertificateDetailsProps {
  certificateId: string;
  onBack: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatDate(iso: string): string {
  return iso.substring(0, 10);
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('el-GR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface InfoRowProps {
  label: string;
  value: string | null | undefined;
}

function InfoRow({ label, value }: InfoRowProps) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-gray-500 min-w-28 shrink-0">{label}:</span>
      <span className="text-gray-900">{value}</span>
    </div>
  );
}

interface EmailHistoryRowProps {
  record: APYEmailSendRecord;
  index: number;
}

function EmailHistoryRow({ record, index }: EmailHistoryRowProps) {
  return (
    <TableRow>
      <TableCell className="text-gray-600 text-sm">{index + 1}</TableCell>
      <TableCell className="text-sm">{formatDateTime(record.sentAt)}</TableCell>
      <TableCell className="text-sm font-mono">{record.recipientEmail}</TableCell>
      <TableCell className="text-sm text-gray-700">{record.subject}</TableCell>
      <TableCell className="text-center">
        {record.status === 'sent' ? (
          <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Εστάλη
          </Badge>
        ) : (
          <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
            <AlertCircle className="h-3 w-3 mr-1" />
            Αποτυχία
          </Badge>
        )}
      </TableCell>
    </TableRow>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function APYCertificateDetails({
  certificateId,
  onBack,
}: APYCertificateDetailsProps) {
  const { user } = useAuth();
  const { updateCertificate } = useAPYCertificates({ autoFetch: false });

  const [cert, setCert] = useState<APYCertificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [markingReceived, setMarkingReceived] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);

  const fetchCertificate = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setFetchError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch(API_ROUTES.ACCOUNTING.APY_CERTIFICATES.BY_ID(certificateId), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData: { error?: string } = await response.json();
        throw new Error(errorData.error ?? `HTTP ${response.status}`);
      }
      const data: { data: APYCertificate } = await response.json();
      setCert(data.data);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Αποτυχία φόρτωσης βεβαίωσης');
    } finally {
      setLoading(false);
    }
  }, [user, certificateId]);

  useEffect(() => {
    fetchCertificate();
  }, [fetchCertificate]);

  const handleMarkReceived = async () => {
    if (!cert) return;
    setMarkingReceived(true);
    const success = await updateCertificate(cert.certificateId, {
      isReceived: true,
      receivedAt: new Date().toISOString(),
    });
    setMarkingReceived(false);
    if (success) {
      await fetchCertificate();
    }
  };

  const handleExportPDF = async () => {
    if (!cert) return;
    setPdfLoading(true);
    try {
      const { exportAPYCertificatePDF } = await import(
        '../../services/pdf/apy-certificate-pdf-exporter'
      );
      await exportAPYCertificatePDF(cert);
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) return <PageLoadingState message="Φόρτωση βεβαίωσης..." />;
  if (fetchError) return <PageErrorState title="Σφάλμα" message={fetchError} onRetry={fetchCertificate} />;
  if (!cert) return <PageErrorState title="Δεν βρέθηκε" message="Η βεβαίωση δεν βρέθηκε." onRetry={onBack} />;

  const emailHistory = cert.emailHistory ?? [];
  const totalNetFormatted = formatCurrency(cert.totalNetAmount);
  const totalWithholdingFormatted = formatCurrency(cert.totalWithholdingAmount);

  return (
    <article className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Πίσω στη λίστα">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900">
                Βεβαίωση Παρακράτησης {cert.fiscalYear}
              </h1>
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
            </div>
            <p className="text-sm text-gray-500 mt-0.5 font-mono">{cert.certificateId}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {!cert.isReceived && (
            <Button
              variant="outline"
              onClick={handleMarkReceived}
              disabled={markingReceived}
              className="text-green-700 border-green-300 hover:bg-green-50"
            >
              {markingReceived ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CalendarCheck className="h-4 w-4 mr-2" />
              )}
              Ελήφθη
            </Button>
          )}
          <Button variant="outline" onClick={handleExportPDF} disabled={pdfLoading}>
            {pdfLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4 mr-2" />
            )}
            PDF
          </Button>
          <Button onClick={() => setReminderDialogOpen(true)}>
            <Mail className="h-4 w-4 mr-2" />
            Reminder
          </Button>
        </div>
      </header>

      {/* ── Parties ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Provider */}
        <section
          aria-labelledby="provider-heading"
          className="rounded-lg border border-gray-200 p-4 space-y-1.5"
        >
          <header className="flex items-center gap-2 mb-2">
            <Building2 className="h-4 w-4 text-gray-400" />
            <h2 id="provider-heading" className="text-sm font-semibold text-gray-700">
              Πάροχος (Εσείς)
            </h2>
          </header>
          <p className="text-base font-medium text-gray-900">{cert.provider.name}</p>
          <InfoRow label="ΑΦΜ" value={cert.provider.vatNumber} />
          <InfoRow label="ΔΟΥ" value={cert.provider.taxOffice} />
          <InfoRow
            label="Διεύθυνση"
            value={
              cert.provider.address
                ? `${cert.provider.address}, ${cert.provider.city} ${cert.provider.postalCode}`
                : null
            }
          />
          <InfoRow label="Email" value={cert.provider.email} />
          <InfoRow label="Τηλέφωνο" value={cert.provider.phone} />
        </section>

        {/* Customer */}
        <section
          aria-labelledby="customer-heading"
          className="rounded-lg border border-gray-200 p-4 space-y-1.5"
        >
          <header className="flex items-center gap-2 mb-2">
            <User className="h-4 w-4 text-gray-400" />
            <h2 id="customer-heading" className="text-sm font-semibold text-gray-700">
              Πελάτης (Παρακρατών)
            </h2>
          </header>
          <p className="text-base font-medium text-gray-900">{cert.customer.name}</p>
          <InfoRow label="ΑΦΜ" value={cert.customer.vatNumber} />
          <InfoRow label="ΔΟΥ" value={cert.customer.taxOffice} />
          <InfoRow
            label="Διεύθυνση"
            value={
              cert.customer.address && cert.customer.city
                ? `${cert.customer.address}, ${cert.customer.city}`
                : cert.customer.address ?? null
            }
          />
          {cert.isReceived && cert.receivedAt && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <InfoRow
                label="Ελήφθη"
                value={formatDateTime(cert.receivedAt)}
              />
            </div>
          )}
        </section>
      </div>

      {/* ── Invoice Table ───────────────────────────────────────────────────── */}
      <section aria-labelledby="invoices-heading">
        <h2 id="invoices-heading" className="text-sm font-semibold text-gray-700 mb-2">
          Τιμολόγια ({cert.lineItems.length})
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Αρ. ΤΠΥ</TableHead>
              <TableHead>Ημερομηνία</TableHead>
              <TableHead className="text-right">Καθαρό Ποσό</TableHead>
              <TableHead className="text-center">Συντ. %</TableHead>
              <TableHead className="text-right">Παρακράτηση</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cert.lineItems.map((item) => (
              <TableRow key={item.invoiceId}>
                <TableCell className="font-mono">{item.invoiceNumber}</TableCell>
                <TableCell>{formatDate(item.issueDate)}</TableCell>
                <TableCell className="text-right">{formatCurrency(item.netAmount)}</TableCell>
                <TableCell className="text-center">{item.withholdingRate}%</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(item.withholdingAmount)}
                </TableCell>
              </TableRow>
            ))}
            {/* Totals row */}
            <TableRow className="bg-gray-50 font-semibold">
              <TableCell colSpan={2} className="text-right text-gray-700">
                Σύνολα
              </TableCell>
              <TableCell className="text-right">{totalNetFormatted}</TableCell>
              <TableCell />
              <TableCell className="text-right text-blue-900 text-base">
                {totalWithholdingFormatted}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </section>

      {/* ── Notes ──────────────────────────────────────────────────────────── */}
      {cert.notes && (
        <section aria-labelledby="notes-heading" className="rounded-lg border border-gray-200 p-4">
          <h2 id="notes-heading" className="text-sm font-semibold text-gray-700 mb-1">
            Σημειώσεις
          </h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{cert.notes}</p>
        </section>
      )}

      {/* ── Email History ───────────────────────────────────────────────────── */}
      {emailHistory.length > 0 && (
        <section aria-labelledby="email-history-heading">
          <h2 id="email-history-heading" className="text-sm font-semibold text-gray-700 mb-2">
            Ιστορικό Αποστολών Reminder ({emailHistory.length})
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Ημερομηνία</TableHead>
                <TableHead>Παραλήπτης</TableHead>
                <TableHead>Θέμα</TableHead>
                <TableHead className="text-center">Κατάσταση</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emailHistory.map((record, idx) => (
                <EmailHistoryRow key={record.sentAt} record={record} index={idx} />
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      {/* ── Footer metadata ─────────────────────────────────────────────────── */}
      <footer className="text-xs text-gray-400 pt-2 border-t border-gray-100">
        Δημιουργήθηκε: {formatDateTime(cert.createdAt)} · Τελ. ενημέρωση:{' '}
        {formatDateTime(cert.updatedAt)}
      </footer>

      {/* ── Reminder Dialog ─────────────────────────────────────────────────── */}
      <SendReminderEmailDialog
        cert={cert}
        open={reminderDialogOpen}
        onOpenChange={setReminderDialogOpen}
        onSent={fetchCertificate}
      />
    </article>
  );
}
