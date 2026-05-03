'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Upload, Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { FileUploadButton } from '@/components/shared/files/FileUploadButton';
import { TradeSelector } from '@/subapps/procurement/components/TradeSelector';
import {
  POProjectSelector,
  POSupplierSelector,
} from '@/components/procurement/POEntitySelectors';
import { TRADE_CODES } from '@/subapps/procurement/types/trade';
import type { TradeCode } from '@/subapps/procurement/types/trade';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic',
  'application/pdf',
]);

interface FormState {
  file: File | null;
  projectId: string;
  vendorContactId: string;
  trade: TradeCode | '';
  rfqId: string;
}

export default function ScanQuotePage() {
  const { t } = useTranslation('quotes');
  const router = useRouter();
  const search = useSearchParams();
  const spacing = useSpacingTokens();

  const [form, setForm] = useState<FormState>({
    file: null,
    projectId: '',
    vendorContactId: '',
    trade: '',
    rfqId: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = search.get('rfqId') ?? '';
    const rfqId = /^[a-zA-Z0-9_-]+$/.test(raw) ? raw : '';
    const projectId = search.get('projectId') ?? '';
    const tradeParam = search.get('trade') ?? '';
    const trade = (TRADE_CODES as readonly string[]).includes(tradeParam)
      ? (tradeParam as TradeCode)
      : '';
    setForm((prev) => ({ ...prev, rfqId, projectId, trade }));
  }, [search]);

  const handleFile = useCallback((file: File | null) => {
    setError(null);
    if (!file) {
      setForm((prev) => ({ ...prev, file: null }));
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(t('quotes.scan.fileTooLarge'));
      return;
    }
    if (!ALLOWED_MIME.has(file.type)) {
      setError(t('quotes.scan.invalidMime'));
      return;
    }
    setForm((prev) => ({ ...prev, file }));
  }, [t]);

  const isValid = Boolean(form.file && form.projectId && form.vendorContactId && form.trade);

  const handleSubmit = async () => {
    if (!form.file) { setError(t('quotes.scan.missingFile')); return; }
    if (!form.projectId) { setError(t('quotes.scan.missingProject')); return; }
    if (!form.vendorContactId) { setError(t('quotes.scan.missingVendor')); return; }
    if (!form.trade) { setError(t('quotes.scan.missingTrade')); return; }

    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', form.file);
      fd.append('projectId', form.projectId);
      fd.append('vendorContactId', form.vendorContactId);
      fd.append('trade', form.trade);
      if (form.rfqId) fd.append('rfqId', form.rfqId);

      const res = await fetch('/api/quotes/scan', { method: 'POST', body: fd });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Scan failed: ${res.status}`);
      }
      const json = await res.json();
      const quoteId = json?.data?.quoteId;
      if (!quoteId) throw new Error('No quoteId returned');
      router.push(`/procurement/quotes/${quoteId}/review`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('quotes.scan.processingFailed'));
      setSubmitting(false);
    }
  };

  const fileSize = form.file ? Math.round(form.file.size / 1024) : 0;

  const missingFields = useMemo(() => {
    if (!form.file) return [];
    const m: string[] = [];
    if (!form.projectId) m.push(t('quotes.project'));
    if (!form.vendorContactId) m.push(t('quotes.vendor'));
    if (!form.trade) m.push(t('quotes.trade'));
    return m;
  }, [form.file, form.projectId, form.vendorContactId, form.trade, t]);

  return (
    <main className={`container mx-auto max-w-3xl space-y-6 py-6 ${spacing.padding.x.sm}`}>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          {form.rfqId ? t('quotes.scan.backToRfq') : t('rfqs.title')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('quotes.scan.title')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('quotes.scan.description')}</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <section className="space-y-1.5">
            <Label>{t('quotes.scan.selectFile')}</Label>
            <div className="flex items-center gap-3 min-w-0">
              <FileUploadButton
                onFileSelect={(file) => handleFile(file)}
                accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                maxSize={MAX_BYTES}
                buttonText={t('quotes.scan.chooseFileButton')}
                disabled={submitting}
              />
              <span className="text-sm text-muted-foreground truncate min-w-0">
                {form.file
                  ? `${form.file.name} (${fileSize} KB)`
                  : t('quotes.scan.noFileChosen')}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{t('quotes.scan.uploadHint')}</p>
          </section>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>
                {t('quotes.project')}
                <span className="ml-0.5 text-destructive">*</span>
              </Label>
              <POProjectSelector
                value={form.projectId}
                onSelect={(id) => setForm((prev) => ({ ...prev, projectId: id }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                {t('quotes.vendor')}
                <span className="ml-0.5 text-destructive">*</span>
              </Label>
              <POSupplierSelector
                value={form.vendorContactId}
                onSelect={(id) => setForm((prev) => ({ ...prev, vendorContactId: id }))}
              />
            </div>
            <div className="col-span-full space-y-1.5">
              <Label>
                {t('quotes.trade')}
                <span className="ml-0.5 text-destructive">*</span>
              </Label>
              <TradeSelector
                value={form.trade}
                onChange={(code) => setForm((prev) => ({ ...prev, trade: code }))}
              />
            </div>
          </div>

          {missingFields.length > 0 && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              {t('quotes.scan.requiredHint')} <strong>{missingFields.join(', ')}</strong>
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button onClick={handleSubmit} disabled={!isValid || submitting}>
              {submitting ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-1 h-4 w-4" />
              )}
              {submitting ? t('quotes.scan.uploading') : t('quotes.scan.uploadAndScan')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
