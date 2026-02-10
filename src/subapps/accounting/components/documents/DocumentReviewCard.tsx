'use client';

/**
 * @fileoverview Accounting Subapp — Document Review Card
 * @description Card for reviewing AI-extracted data + confirm/reject actions
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-10
 * @version 1.0.0
 * @see ADR-ACC-005 AI Document Processing
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { ExtractedDataDisplay } from './ExtractedDataDisplay';
import type { ReceivedExpenseDocument, ExpenseCategory } from '@/subapps/accounting/types';

// ============================================================================
// TYPES
// ============================================================================

interface DocumentReviewCardProps {
  document: ReceivedExpenseDocument;
  onConfirm: (params: {
    confirmedCategory: ExpenseCategory;
    confirmedNetAmount: number;
    confirmedVatAmount: number;
    confirmedDate: string;
    confirmedIssuerName: string;
  }) => Promise<boolean>;
  onReject: (notes?: string) => Promise<boolean>;
  confirming: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const EXPENSE_CATEGORY_CODES: ExpenseCategory[] = [
  'third_party_fees', 'rent', 'utilities', 'telecom', 'fuel',
  'vehicle_expenses', 'vehicle_insurance', 'office_supplies', 'software',
  'equipment', 'travel', 'training', 'advertising', 'efka',
  'professional_tax', 'bank_fees', 'tee_fees', 'depreciation', 'other_expense',
];

// ============================================================================
// HELPERS
// ============================================================================

const STATUS_VARIANT_MAP: Record<ReceivedExpenseDocument['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  processing: 'secondary',
  review: 'outline',
  confirmed: 'default',
  rejected: 'destructive',
};

// ============================================================================
// COMPONENT
// ============================================================================

export function DocumentReviewCard({
  document: doc,
  onConfirm,
  onReject,
  confirming,
}: DocumentReviewCardProps) {
  const { t } = useTranslation('accounting');

  // Editable confirmed fields — pre-populated from AI extraction
  const [category, setCategory] = useState<ExpenseCategory>(
    doc.confirmedCategory ?? 'other_expense'
  );
  const [netAmount, setNetAmount] = useState(
    String(doc.confirmedNetAmount ?? doc.extractedData.netAmount ?? '')
  );
  const [vatAmount, setVatAmount] = useState(
    String(doc.confirmedVatAmount ?? doc.extractedData.vatAmount ?? '')
  );
  const [date, setDate] = useState(
    doc.confirmedDate ?? doc.extractedData.issueDate ?? ''
  );
  const [issuerName, setIssuerName] = useState(
    doc.confirmedIssuerName ?? doc.extractedData.issuerName ?? ''
  );

  const statusVariant = STATUS_VARIANT_MAP[doc.status];
  const statusLabel = t(`documents.statuses.${doc.status}`);
  const isEditable = doc.status === 'review';

  const handleConfirm = useCallback(async () => {
    await onConfirm({
      confirmedCategory: category,
      confirmedNetAmount: parseFloat(netAmount) || 0,
      confirmedVatAmount: parseFloat(vatAmount) || 0,
      confirmedDate: date,
      confirmedIssuerName: issuerName,
    });
  }, [category, netAmount, vatAmount, date, issuerName, onConfirm]);

  const handleReject = useCallback(async () => {
    await onReject();
  }, [onReject]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{doc.fileName}</CardTitle>
          <Badge variant={statusVariant}>{statusLabel}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {doc.mimeType} — {(doc.fileSize / 1024).toFixed(1)} KB
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* AI Extracted Data */}
        <ExtractedDataDisplay data={doc.extractedData} />

        {/* Editable Confirmed Fields */}
        {isEditable && (
          <section className="space-y-4 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">
              {t('documents.confirmedFields')}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <fieldset>
                <Label htmlFor="doc-category">{t('journal.category')}</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
                  <SelectTrigger id="doc-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORY_CODES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {t(`categories.expense.${code}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </fieldset>

              <fieldset>
                <Label htmlFor="doc-issuer">{t('documents.issuerName')}</Label>
                <Input
                  id="doc-issuer"
                  value={issuerName}
                  onChange={(e) => setIssuerName(e.target.value)}
                />
              </fieldset>

              <fieldset>
                <Label htmlFor="doc-net">{t('invoices.netAmount')}</Label>
                <Input
                  id="doc-net"
                  type="number"
                  step="0.01"
                  value={netAmount}
                  onChange={(e) => setNetAmount(e.target.value)}
                />
              </fieldset>

              <fieldset>
                <Label htmlFor="doc-vat">{t('invoices.vatAmount')}</Label>
                <Input
                  id="doc-vat"
                  type="number"
                  step="0.01"
                  value={vatAmount}
                  onChange={(e) => setVatAmount(e.target.value)}
                />
              </fieldset>

              <fieldset>
                <Label htmlFor="doc-date">{t('invoices.issueDate')}</Label>
                <Input
                  id="doc-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </fieldset>
            </div>
          </section>
        )}
      </CardContent>

      {/* Action Buttons */}
      {isEditable && (
        <CardFooter className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={confirming}
          >
            {t('documents.reject')}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={confirming}
          >
            {confirming ? <Spinner size="small" className="mr-2" /> : null}
            {t('documents.confirm')}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
