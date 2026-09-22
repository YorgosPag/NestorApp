'use client';

import { useState, useEffect, useCallback, useMemo, useId } from 'react';
import { useRouter } from '@/lib/workspace/navigation';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FormActions } from '@/components/ui/form/FormActions';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Upload } from 'lucide-react';
import { useTranslation, type Translate } from '@/i18n/hooks/useTranslation';
import { useFormSubmission } from '@/hooks/useFormSubmission';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { fetchJson } from '@/lib/api/fetch-json';
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

type SetForm = (update: (prev: FormState) => FormState) => void;

/** Το μήνυμα για το πρώτο κενό υποχρεωτικό πεδίο· `null` όταν η φόρμα είναι πλήρης. */
function missingFieldMessage(form: FormState, t: Translate): string | null {
  if (!form.file) return t('quotes.scan.missingFile');
  if (!form.projectId) return t('quotes.scan.missingProject');
  if (!form.vendorContactId) return t('quotes.scan.missingVendor');
  if (!form.trade) return t('quotes.scan.missingTrade');
  return null;
}

/** multipart POST → id της προσφοράς. Μήνυμα του server μέσω `fetchJson`, όχι ωμό σώμα. */
async function uploadForScan(form: FormState, t: Translate): Promise<string> {
  const missing = missingFieldMessage(form, t);
  if (missing || !form.file) throw new Error(missing ?? t('quotes.scan.missingFile'));
  const fd = new FormData();
  fd.append('file', form.file);
  fd.append('projectId', form.projectId);
  fd.append('vendorContactId', form.vendorContactId);
  fd.append('trade', form.trade);
  if (form.rfqId) fd.append('rfqId', form.rfqId);
  const json = await fetchJson<{ data?: { quoteId?: string } }>('/api/quotes/scan', { method: 'POST', body: fd });
  const quoteId = json?.data?.quoteId;
  if (!quoteId) throw new Error(t('quotes.scan.processingFailed'));
  return quoteId;
}

/** Οι παράμετροι της διεύθυνσης (από RFQ) γεμίζουν τη φόρμα. */
function useScanParamsPrefill(setForm: SetForm) {
  const search = useSearchParams();
  useEffect(() => {
    const raw = search.get('rfqId') ?? '';
    const rfqId = /^[a-zA-Z0-9_-]+$/.test(raw) ? raw : '';
    const projectId = search.get('projectId') ?? '';
    const tradeParam = search.get('trade') ?? '';
    const trade = (TRADE_CODES as readonly string[]).includes(tradeParam)
      ? (tradeParam as TradeCode)
      : '';
    setForm((prev) => ({ ...prev, rfqId, projectId, trade }));
  }, [search, setForm]);
}

/**
 * Κατάσταση + υποβολή (ADR-598 «(η)»). `keepLockedOnSuccess`: η επιτυχία πλοηγεί στην επισκόπηση ⇒
 * το κουμπί μένει κλειδωμένο ώσπου να φύγει η σελίδα (πριν: το ίδιο, χειρόγραφα — δεν χάνεται).
 * Όσο λείπει πεδίο το κουμπί είναι απενεργοποιημένο ⇒ και το Enter δεν υποβάλλει (HTML: απενεργοποιημένο
 * προεπιλεγμένο κουμπί = καμία implicit submission)· ο έλεγχος στο `uploadForScan` είναι 2η γραμμή άμυνας.
 */
function useScanQuoteForm(t: Translate) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({ file: null, projectId: '', vendorContactId: '', trade: '', rfqId: '' });
  const [fileError, setFileError] = useState<string | null>(null);
  useScanParamsPrefill(setForm);

  const handleFile = useCallback((file: File | null) => {
    setFileError(null);
    if (file && file.size > MAX_BYTES) { setFileError(t('quotes.scan.fileTooLarge')); return; }
    if (file && !ALLOWED_MIME.has(file.type)) { setFileError(t('quotes.scan.invalidMime')); return; }
    setForm((prev) => ({ ...prev, file }));
  }, [t]);

  const isValid = missingFieldMessage(form, t) === null;
  const submission = useFormSubmission({
    canSubmit: isValid,
    submit: () => uploadForScan(form, t),
    onSuccess: (quoteId) => router.push(`/procurement/quotes/${quoteId}/review`),
    errorFallback: t('quotes.scan.processingFailed'),
    keepLockedOnSuccess: true,
  });

  return { form, setForm, fileError, handleFile, isValid, ...submission };
}

interface ScanQuoteFieldsProps {
  idBase: string;
  form: FormState;
  setForm: SetForm;
  t: Translate;
}

function ScanQuoteFields({ idBase, form, setForm, t }: ScanQuoteFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={`${idBase}-project`}>
          {t('quotes.project')}
          <span className="ml-0.5 text-destructive">*</span>
        </Label>
        <POProjectSelector
          id={`${idBase}-project`}
          value={form.projectId}
          onSelect={(id) => setForm((prev) => ({ ...prev, projectId: id }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idBase}-vendor`}>
          {t('quotes.vendor')}
          <span className="ml-0.5 text-destructive">*</span>
        </Label>
        <POSupplierSelector
          id={`${idBase}-vendor`}
          value={form.vendorContactId}
          onSelect={(id) => setForm((prev) => ({ ...prev, vendorContactId: id }))}
        />
      </div>
      <div className="col-span-full space-y-1.5">
        <Label htmlFor={`${idBase}-trade`}>
          {t('quotes.trade')}
          <span className="ml-0.5 text-destructive">*</span>
        </Label>
        <TradeSelector
          id={`${idBase}-trade`}
          value={form.trade}
          onChange={(code) => setForm((prev) => ({ ...prev, trade: code }))}
        />
      </div>
    </div>
  );
}

interface ScanFilePickerProps {
  file: File | null;
  onFileSelect: (file: File | null) => void;
  disabled: boolean;
  t: Translate;
}

function ScanFilePicker({ file, onFileSelect, disabled, t }: ScanFilePickerProps) {
  return (
    <section className="space-y-1.5">
      <Label>{t('quotes.scan.selectFile')}</Label>
      <div className="flex items-center gap-3 min-w-0">
        <FileUploadButton
          onFileSelect={onFileSelect}
          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
          maxSize={MAX_BYTES}
          buttonText={t('quotes.scan.chooseFileButton')}
          disabled={disabled}
        />
        <span className="text-sm text-muted-foreground truncate min-w-0">
          {file ? `${file.name} (${Math.round(file.size / 1024)} KB)` : t('quotes.scan.noFileChosen')}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{t('quotes.scan.uploadHint')}</p>
    </section>
  );
}

/** Όταν έχει επιλεγεί αρχείο: ποια υποχρεωτικά πεδία λείπουν ακόμα. */
function useMissingFieldLabels(form: FormState, t: Translate): string[] {
  return useMemo(() => {
    if (!form.file) return [];
    const m: string[] = [];
    if (!form.projectId) m.push(t('quotes.project'));
    if (!form.vendorContactId) m.push(t('quotes.vendor'));
    if (!form.trade) m.push(t('quotes.trade'));
    return m;
  }, [form.file, form.projectId, form.vendorContactId, form.trade, t]);
}

export default function ScanQuotePage() {
  const { t } = useTranslation('quotes');
  const idBase = useId(); // `${idBase}-<πεδίο>`: η <Label> ονομάζει το combobox (ADR-598 G11)
  const formId = `${idBase}-form`;
  const router = useRouter();
  const spacing = useSpacingTokens();
  const f = useScanQuoteForm(t);
  const missingFields = useMissingFieldLabels(f.form, t);

  return (
    <main className={`container mx-auto max-w-3xl space-y-6 py-6 ${spacing.padding.x.sm}`}>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          {f.form.rfqId ? t('quotes.scan.backToRfq') : t('rfqs.title')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('quotes.scan.title')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('quotes.scan.description')}</p>
        </CardHeader>
        <CardContent>
          <form id={formId} onSubmit={f.handleSubmit} className="space-y-5">
            <ScanFilePicker file={f.form.file} onFileSelect={f.handleFile} disabled={f.submitting} t={t} />
            <ScanQuoteFields idBase={idBase} form={f.form} setForm={f.setForm} t={t} />
            {missingFields.length > 0 && (
              <p className="rounded-md bg-[hsl(var(--bg-warning))]/40 px-3 py-2 text-sm text-[hsl(var(--text-warning))]">
                {t('quotes.scan.requiredHint')} <strong>{missingFields.join(', ')}</strong>
              </p>
            )}
            {f.fileError && <p className="text-sm text-destructive" role="alert">{f.fileError}</p>}
            <FormActions
              formId={formId}
              submitLabel={t('quotes.scan.uploadAndScan')}
              pendingLabel={t('quotes.scan.uploading')}
              cancelLabel={t('quotes.cancel')}
              submitting={f.submitting}
              submitDisabled={!f.isValid}
              error={f.error}
              submitIcon={Upload}
            />
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
