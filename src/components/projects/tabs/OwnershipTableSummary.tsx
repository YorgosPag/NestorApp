/**
 * ============================================================================
 * Ownership Table — Summary Sections
 * ============================================================================
 *
 * Extracted from OwnershipTableTab.tsx (ADR-235) for SRP compliance.
 * Contains: BARTEX summary, category summary cards, calculation note,
 * revision history (collapsible), and status/validation badge components.
 *
 * @module components/projects/tabs/OwnershipTableSummary
 */

import '@/lib/design-system';
import React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { TableRow, TableCell } from '@/components/ui/table';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { TOTAL_SHARES_TARGET } from '@/types/ownership-table';
import type { MutableOwnershipTableRow, MutableOwnershipPercentageTable, OwnershipTableRevision } from '@/types/ownership-table';
import { ownerLabel } from '@/components/projects/tabs/ownership-table-config';

// ============================================================================
// TYPES
// ============================================================================

interface TypographyTokens {
  heading: Record<string, string>;
  body: Record<string, string>;
  label: Record<string, string>;
  special: Record<string, string>;
}

interface SpacingTokens {
  padding: Record<string, string>;
  margin: { bottom: Record<string, string>; top: Record<string, string> };
  gap: Record<string, string>;
  spaceBetween: Record<string, string>;
}

interface ColorTokens {
  text: Record<string, string>;
}

interface BorderTokens {
  quick: Record<string, string>;
}

// ============================================================================
// STATUS BADGE
// ============================================================================

/** Status badge — colors via COLOR_BRIDGE (semantic, theme-aware) */
export function StatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const variants: Record<string, string> = {
    draft: cn(COLOR_BRIDGE.bg.warningSubtle, COLOR_BRIDGE.text.warning),
    finalized: cn(COLOR_BRIDGE.bg.successSubtle, COLOR_BRIDGE.text.success),
    registered: cn(COLOR_BRIDGE.bg.infoSubtle, COLOR_BRIDGE.text.info),
  };
  const labels: Record<string, string> = {
    draft: t('common:ownership.statusDraft'),
    finalized: t('common:ownership.statusFinalized'),
    registered: t('common:ownership.statusRegistered'),
  };

  return (
    <Badge className={cn('text-xs', variants[status] ?? variants.draft)}>
      {labels[status] ?? status}
    </Badge>
  );
}

// ============================================================================
// VALIDATION INDICATOR
// ============================================================================

/** Validation indicator — colors via COLOR_BRIDGE */
export function ValidationIndicator({
  total,
  valid,
  t,
}: {
  total: number;
  valid: boolean;
  t: (key: string) => string;
}) {
  if (valid) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-sm', COLOR_BRIDGE.text.success)}>
        <CheckCircle className="h-4 w-4" />
        {t('common:ownership.validation.totalCorrect')}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-1 text-sm', COLOR_BRIDGE.text.error)}>
      <AlertTriangle className="h-4 w-4" />
      {total}‰ / {TOTAL_SHARES_TARGET}‰ ({total - TOTAL_SHARES_TARGET > 0 ? '+' : ''}
      {total - TOTAL_SHARES_TARGET})
    </span>
  );
}

// ============================================================================
// BARTEX SUMMARY
// ============================================================================

interface BartexSummaryProps {
  bartex: NonNullable<MutableOwnershipPercentageTable['bartex']>;
  t: (key: string) => string;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  colors: ColorTokens;
  borders: BorderTokens;
}

/** BARTEX (αντιπαροχή) breakdown section */
export function BartexSummary({ bartex, t, typography, spacing, colors, borders }: BartexSummaryProps) {
  return (
    <section className={cn(borders.quick.card, spacing.padding.md)}>
      <h3 className={cn(spacing.margin.bottom.sm, typography.heading.sm)}>
        {t('common:ownership.bartex.title')}
      </h3>
      <dl className={cn('grid grid-cols-2 sm:grid-cols-4', typography.body.sm, spacing.gap.sm)}>
        <div>
          <dt className={colors.text.muted}>{t('common:ownership.bartex.percentage')}</dt>
          <dd className={typography.heading.xs}>{bartex.bartexPercentage}%</dd>
        </div>
        <div>
          <dt className={colors.text.muted}>{t('common:ownership.bartex.contractor')}</dt>
          <dd className={cn(typography.special.codeId, 'font-semibold')}>
            {bartex.contractorShares}‰ ({(bartex.contractorShares / 10).toFixed(1)}%)
          </dd>
        </div>
        <div>
          <dt className={colors.text.muted}>{t('common:ownership.bartex.landowners')}</dt>
          <dd className={cn(typography.special.codeId, 'font-semibold')}>
            {bartex.totalLandownerShares}‰ (
            {(bartex.totalLandownerShares / 10).toFixed(1)}%)
          </dd>
        </div>
      </dl>
    </section>
  );
}

// ============================================================================
// CATEGORY SUMMARY
// ============================================================================

interface CategorySummaryProps {
  summaryByCategory: MutableOwnershipPercentageTable['summaryByCategory'];
  t: (key: string) => string;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  colors: ColorTokens;
  borders: BorderTokens;
}

/** Category breakdown cards (main vs auxiliary) */
export function CategorySummary({ summaryByCategory, t, typography, spacing, colors, borders }: CategorySummaryProps) {
  return (
    <section className={cn('grid grid-cols-2', typography.body.sm, spacing.gap.md)}>
      <article className={cn(borders.quick.card, spacing.padding.sm)}>
        <h4 className={colors.text.muted}>{t('common:ownership.categoryMain')}</h4>
        <p className={typography.heading.lg}>
          {summaryByCategory.main.shares}‰
        </p>
        <p className={typography.special.tertiary}>
          {summaryByCategory.main.count} {t('common:ownership.categoryMain').toLowerCase()}
        </p>
      </article>
      <article className={cn(borders.quick.card, spacing.padding.sm)}>
        <h4 className={colors.text.muted}>{t('common:ownership.categoryAuxiliary')}</h4>
        <p className={typography.heading.lg}>
          {summaryByCategory.auxiliary.shares}‰
        </p>
        <p className={typography.special.tertiary}>
          {summaryByCategory.auxiliary.count} {t('common:ownership.categoryAuxiliary').toLowerCase()}
        </p>
      </article>
    </section>
  );
}

// ============================================================================
// REVISION HISTORY
// ============================================================================

interface RevisionHistoryProps {
  revisions: OwnershipTableRevision[];
  t: (key: string) => string;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  colors: ColorTokens;
  borders: BorderTokens;
}

/** Collapsible revision history list */
export function RevisionHistory({ revisions, t, typography, spacing, colors, borders }: RevisionHistoryProps) {
  if (revisions.length === 0) return null;

  return (
    <details className={cn(borders.quick.card, spacing.padding.sm)}>
      <summary className={cn('cursor-pointer', typography.label.sm)}>
        {t('common:ownership.revisionHistory')} ({revisions.length})
      </summary>
      <ul className={cn(typography.body.sm, spacing.margin.top.sm, spacing.spaceBetween.xs)}>
        {revisions.map(rev => (
          <li key={rev.id} className={cn('flex items-center', colors.text.muted, spacing.gap.sm)}>
            <Badge variant="outline" className={typography.body.xs}>
              v{rev.version}
            </Badge>
            <span>{rev.finalizedAt?.toDate?.().toLocaleDateString?.() ?? '—'}</span>
            {rev.changeReason && (
              <span className="italic">({rev.changeReason})</span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

// ============================================================================
// LINKED SPACE CHILD ROWS (tree-branch accordion)
// ============================================================================

interface LinkedSpaceRowsProps {
  row: MutableOwnershipTableRow;
  globalIndex: number;
  isLocked: boolean;
  t: (key: string) => string;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  colors: ColorTokens;
  iconSizes: Record<string, string>;
  onNavigate: (path: string) => void;
  updateLinkedSpace: (rowIndex: number, spaceIndex: number, field: 'hasOwnShares' | 'millesimalShares', value: boolean | number) => void;
}

/** Renders the linked parking/storage child rows for an expanded ownership row */
export function LinkedSpaceRows({
  row, globalIndex, isLocked, t,
  typography, spacing, colors, iconSizes,
  onNavigate, updateLinkedSpace,
}: LinkedSpaceRowsProps) {
  if (!row.linkedSpacesSummary || row.linkedSpacesSummary.length === 0) return null;

  return (
    <>
      {row.linkedSpacesSummary.map((ls, idx) => {
        const isLast = idx === (row.linkedSpacesSummary?.length ?? 0) - 1;
        return (
          <TableRow key={`${row.entityRef.id}-ls-${idx}`} className="bg-muted/20 dark:bg-muted/10">
            <TableCell className={cn("pl-5 select-none", typography.special.tertiary)}>{isLast ? '└─' : '├─'}</TableCell>
            <TableCell className={cn(typography.special.codeId, 'whitespace-nowrap')}>
              {ls.spaceType === 'parking'
                ? <NAVIGATION_ENTITIES.parking.icon className={cn('inline', iconSizes.xs, NAVIGATION_ENTITIES.parking.color)} />
                : <NAVIGATION_ENTITIES.storage.icon className={cn('inline', iconSizes.xs, NAVIGATION_ENTITIES.storage.color)} />}
              {' '}
              <button type="button" className="hover:underline cursor-pointer" onClick={() => onNavigate(ls.spaceType === 'parking' ? `/spaces/parking?parkingId=${ls.spaceId}` : `/spaces/storage?storageId=${ls.spaceId}`)}>
                {ls.entityCode}
              </button>
            </TableCell>
            <TableCell className={typography.special.tertiary}>{ls.description}</TableCell>
            <TableCell>
              {ls.spaceType === 'storage' && !isLocked ? (
                <label className={cn('inline-flex items-center cursor-pointer', spacing.gap.xs)}>
                  <input type="checkbox" checked={ls.hasOwnShares} onChange={e => updateLinkedSpace(globalIndex, idx, 'hasOwnShares', e.target.checked)} className="accent-current" />
                  <span className={typography.body.xs}>‰</span>
                </label>
              ) : (
                <Badge variant="outline" className={cn(typography.body.xs, COLOR_BRIDGE.border.info, COLOR_BRIDGE.text.info)}>{t('common:ownership.categoryAuxiliary')}</Badge>
              )}
            </TableCell>
            <TableCell className={typography.body.xs}>{ls.floor}</TableCell>
            <TableCell className={cn('text-right', typography.special.codeId)}>{ls.areaNetSqm > 0 ? ls.areaNetSqm.toFixed(2) : '—'}</TableCell>
            <TableCell className={cn('text-right', typography.special.codeId)}>{ls.areaSqm > 0 ? ls.areaSqm.toFixed(2) : '—'}</TableCell>
            <TableCell className="text-right">
              {ls.spaceType === 'storage' ? (
                ls.hasOwnShares ? (
                  <Input type="number" min={0} value={ls.millesimalShares || ''} onChange={e => updateLinkedSpace(globalIndex, idx, 'millesimalShares', parseInt(e.target.value, 10) || 0)} className={cn('w-20 text-right', typography.special.codeId)} disabled={isLocked} />
                ) : <span className={cn(typography.special.codeId, colors.text.muted)}>—</span>
              ) : <span className={cn(typography.special.codeId, colors.text.muted)}>—</span>}
            </TableCell>
            <TableCell className={typography.special.tertiary}>{ownerLabel(row.ownerParty, t)}</TableCell>
            <TableCell className={typography.special.tertiary}>{row.buyerName ?? '—'}</TableCell>
            <TableCell className={typography.special.codeId}>{row.preliminaryContract ?? '—'}</TableCell>
            <TableCell className={typography.special.codeId}>{row.finalContract ?? '—'}</TableCell>
          </TableRow>
        );
      })}
    </>
  );
}
