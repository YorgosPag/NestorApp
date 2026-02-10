'use client';

/**
 * @fileoverview Accounting Subapp — Extracted Data Display
 * @description Readonly display of AI-extracted document data with confidence indicators
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-10
 * @version 1.0.0
 * @see ADR-ACC-005 AI Document Processing
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import type { ExtractedDocumentData } from '@/subapps/accounting/types';
import { formatCurrencyOrDash } from '../../utils/format';

// ============================================================================
// TYPES
// ============================================================================

interface ExtractedDataDisplayProps {
  data: ExtractedDocumentData;
}

// ============================================================================
// HELPERS
// ============================================================================

function getConfidenceBadge(confidence: number): { variant: 'default' | 'secondary' | 'destructive'; label: string } {
  if (confidence >= 80) return { variant: 'default', label: `${confidence}%` };
  if (confidence >= 50) return { variant: 'secondary', label: `${confidence}%` };
  return { variant: 'destructive', label: `${confidence}%` };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ExtractedDataDisplay({ data }: ExtractedDataDisplayProps) {
  const { t } = useTranslation('accounting');

  const confidenceBadge = getConfidenceBadge(data.overallConfidence);

  return (
    <section className="space-y-4">
      {/* Confidence Badge */}
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {t('documents.aiExtractedData')}
        </h3>
        <Badge variant={confidenceBadge.variant}>
          {t('documents.confidence')}: {confidenceBadge.label}
        </Badge>
      </header>

      {/* Extracted Fields */}
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <DataField label={t('documents.issuerName')} value={data.issuerName} />
        <DataField label={t('documents.issuerVat')} value={data.issuerVatNumber} />
        <DataField label={t('documents.documentNumber')} value={data.documentNumber} />
        <DataField label={t('documents.issueDate')} value={data.issueDate} />
        <DataField label={t('invoices.netAmount')} value={formatCurrencyOrDash(data.netAmount)} />
        <DataField label={t('invoices.vatAmount')} value={formatCurrencyOrDash(data.vatAmount)} />
        <DataField label={t('invoices.grossAmount')} value={formatCurrencyOrDash(data.grossAmount)} />
        <DataField
          label={t('journal.vatRate')}
          value={data.vatRate !== null ? `${data.vatRate}%` : null}
        />
      </dl>

      {/* Line Items */}
      {data.lineItems.length > 0 && (
        <section className="mt-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            {t('documents.lineItems')} ({data.lineItems.length})
          </h4>
          <ul className="space-y-2">
            {data.lineItems.map((item, index) => (
              <li
                key={index}
                className="flex items-center justify-between text-sm bg-muted/50 rounded-md px-3 py-2"
              >
                <span className="text-foreground">{item.description}</span>
                <span className="font-medium">{formatCurrencyOrDash(item.netAmount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

// ============================================================================
// SUB-COMPONENT
// ============================================================================

function DataField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground mt-0.5">
        {value ?? <span className="text-muted-foreground italic">—</span>}
      </dd>
    </div>
  );
}
