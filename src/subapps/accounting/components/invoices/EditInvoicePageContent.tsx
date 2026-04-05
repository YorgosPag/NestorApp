'use client';

/**
 * @fileoverview Edit Invoice Page Content
 * @description Loads existing invoice and renders InvoiceForm in edit mode (draft/rejected only)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see ADR-ACC-002 Invoicing System, AUDIT-2026-03-29 B-2
 * @compliance CLAUDE.md — no inline styles, semantic HTML, zero `any`
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageLoadingState } from '@/core/states';
import { useAuth } from '@/hooks/useAuth';
import { API_ROUTES } from '@/config/domain-constants';
import { InvoiceForm } from './forms/InvoiceForm';
import type { Invoice } from '@/subapps/accounting/types';

import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface EditInvoicePageContentProps {
  invoiceId: string;
}

/** Statuses that allow editing */
const EDITABLE_STATUSES = new Set(['draft', 'rejected']);

// ============================================================================
// COMPONENT
// ============================================================================

export function EditInvoicePageContent({ invoiceId }: EditInvoicePageContentProps) {
  const { t } = useTranslation('accounting');
  const colors = useSemanticColors();
  const router = useRouter();
  const { user } = useAuth();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoice = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(API_ROUTES.ACCOUNTING.INVOICES.BY_ID(invoiceId), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setInvoice(data.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  }, [user, invoiceId]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <PageLoadingState message={t('invoices.loading')} layout="contained" />
      </main>
    );
  }

  if (error || !invoice) {
    return (
      <main className="min-h-screen bg-background p-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">{error ?? 'Invoice not found'}</p>
            <Button variant="outline" className="mt-4" onClick={() => router.back()}>
              {t('forms.back')}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  // Guard: only draft/rejected invoices are editable
  const mydataStatus = invoice.mydata?.status;
  if (mydataStatus && !EDITABLE_STATUSES.has(mydataStatus)) {
    return (
      <main className="min-h-screen bg-background p-6">
        <Card>
          <CardContent className="pt-6 flex flex-col items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <p className="text-sm text-center">
              {t('invoices.editNotAllowed', { status: mydataStatus })}
            </p>
            <Button variant="outline" onClick={() => router.back()}>
              {t('forms.back')}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {t('invoices.editInvoice')}
            </h1>
            <p className={cn("text-sm mt-1", colors.text.muted)}>
              {invoice.series}-{invoice.number}
            </p>
          </div>
        </div>
      </header>

      <section className="p-6 max-w-5xl mx-auto">
        <InvoiceForm
          editMode
          initialData={invoice}
          onSuccess={(id) => {
            router.push(`/accounting/invoices?view=${id}`);
          }}
          onCancel={() => router.back()}
        />
      </section>
    </main>
  );
}
