/**
 * @module components/reports/builder/ReportResults
 * @enterprise ADR-268 — Report Results with ReportTable (REUSE ADR-265)
 *
 * Wraps existing ReportTable. Builds dynamic column defs.
 * Features: entity links, status colors, row limit warning, share URL.
 */

'use client';

import '@/lib/design-system';
import { useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, Clock, Link2 } from 'lucide-react';
import { useState } from 'react';
import { ReportTable, type ReportColumnDef } from '@/components/reports/core/ReportTable';
import { ReportEmptyState } from '@/components/reports/core/ReportEmptyState';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getStatusColor as dsGetStatusColor } from '@/lib/design-system';
import type {
  BuilderQueryResponse,
  DomainDefinition,
} from '@/config/report-builder/report-builder-types';
import { BUILDER_LIMITS } from '@/config/report-builder/report-builder-types';

interface ReportResultsProps {
  results: BuilderQueryResponse | null;
  columns: string[];
  domainDefinition: DomainDefinition;
  loading: boolean;
  error: string | null;
  limit: number;
  onLimitChange: (limit: number) => void;
  _onSort?: (field: string, direction: 'asc' | 'desc') => void;
  shareUrl: string;
}

export function ReportResults({
  results,
  columns,
  domainDefinition,
  loading,
  error,
  limit,
  onLimitChange,
  shareUrl,
}: ReportResultsProps) {
  const { t } = useTranslation('report-builder');
  const { t: tDomains } = useTranslation('report-builder-domains');
  const router = useRouter();

  // Build dynamic column definitions
  const columnDefs = useMemo(
    () =>
      buildColumnDefs(columns, domainDefinition, results?.resolvedRefs ?? {}, tDomains),
    [columns, domainDefinition, results?.resolvedRefs, tDomains],
  );

  // Row click → navigate to entity page
  const handleRowClick = useCallback(
    (row: Record<string, unknown>) => {
      const id = row['id'] as string;
      if (!id) return;
      const path = domainDefinition.entityLinkPath.replace('{id}', id);
      router.push(path);
    },
    [domainDefinition.entityLinkPath, router],
  );

  // Error state
  if (error) {
    return <ReportEmptyState type="error" message={error} />;
  }

  // No results yet
  if (!results && !loading) {
    return null;
  }

  // Empty results
  if (results && results.rows.length === 0 && !loading) {
    return <ReportEmptyState type="noResults" />;
  }

  return (
    <section className="space-y-3" aria-label={t('results.title')}>
      {/* Row limit warning banner */}
      {results?.truncated && (
        <TruncationBanner
          shown={results.rows.length}
          total={results.totalMatched}
          limit={limit}
          onShowMore={onLimitChange}
        />
      )}

      {/* Metadata bar */}
      {results && (
        <MetadataBar
          totalMatched={results.totalMatched}
          generatedAt={results.generatedAt}
          shareUrl={shareUrl}
        />
      )}

      {/* Table */}
      <ReportTable
        columns={columnDefs}
        data={results?.rows ?? []}
        loading={loading}
        sortable
        onRowClick={handleRowClick}
        pageSize={25}
      />
    </section>
  );
}

// ============================================================================
// Column Def Builder
// ============================================================================

function buildColumnDefs(
  columns: string[],
  domainDef: DomainDefinition,
  resolvedRefs: Record<string, Record<string, string>>,
  t: (key: string) => string,
): ReportColumnDef<Record<string, unknown>>[] {
  return columns.map((key) => {
    const field = domainDef.fields.find((f) => f.key === key);
    if (!field) {
      return { key, header: key, sortable: false };
    }

    const def: ReportColumnDef<Record<string, unknown>> = {
      key,
      header: t(field.labelKey),
      sortable: field.sortable,
      format: field.format,
    };

    // Ref fields — show resolved name instead of ID
    if (field.refDomain && resolvedRefs[field.refDomain]) {
      const refMap = resolvedRefs[field.refDomain];
      def.render = (value: unknown) => {
        const id = String(value ?? '');
        return refMap[id] ?? id;
      };
    }

    // Enum fields — colored status badges
    if (field.type === 'enum' && field.enumLabelPrefix) {
      const prefix = field.enumLabelPrefix;
      def.render = (value: unknown) => {
        const val = String(value ?? '');
        const label = t(`${prefix}.${val}`);
        const color = getStatusColorClasses(val);
        return (
          <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium', color)}>
            {label || val}
          </span>
        );
      };
    }

    return def;
  });
}

// Status color — reuse design system
function getStatusColorClasses(value: string): string {
  const bg = dsGetStatusColor(value, 'bg');
  const text = dsGetStatusColor(value, 'text');
  return `${bg} ${text}`;
}

// ============================================================================
// Sub-Components
// ============================================================================

function TruncationBanner({
  shown, total, limit, onShowMore,
}: { shown: number; total: number; limit: number; onShowMore: (n: number) => void }) {
  const { t } = useTranslation('report-builder');
  const nextLimit = Math.min(limit * 2, BUILDER_LIMITS.MAX_ROW_LIMIT);
  const canShowMore = limit < BUILDER_LIMITS.MAX_ROW_LIMIT;

  return (
    <div
      className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm dark:border-amber-800 dark:bg-amber-950"
      role="alert"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
      <span>
        {t('results.truncated', { shown, total })}
      </span>
      {canShowMore && (
        <Button variant="link" size="sm" onClick={() => onShowMore(nextLimit)}>
          {t('results.showMore', { limit: nextLimit })}
        </Button>
      )}
    </div>
  );
}

function MetadataBar({
  totalMatched, generatedAt, shareUrl,
}: { totalMatched: number; generatedAt: string; shareUrl: string }) {
  const { t } = useTranslation('report-builder');
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareUrl]);

  const time = new Date(generatedAt).toLocaleTimeString();

  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span>{t('results.showing', { count: totalMatched })}</span>
      <span className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {time}
      </span>
      {shareUrl && (
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-foreground"
        >
          {copied ? <Check className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
          {copied ? t('share.copied') : t('share.copy')}
        </button>
      )}
    </div>
  );
}
