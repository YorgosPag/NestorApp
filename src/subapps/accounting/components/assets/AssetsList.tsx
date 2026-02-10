'use client';

/**
 * @fileoverview Accounting Subapp — Fixed Assets List Table
 * @description Table displaying fixed assets with depreciation info and status badges
 * @author Claude Code (Anthropic AI) + Georgios Pagonis
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-007 Fixed Assets & Depreciation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { FixedAsset, AssetStatus } from '@/subapps/accounting/types';
import { formatCurrency, formatDate } from '../../utils/format';

// ============================================================================
// TYPES
// ============================================================================

interface AssetsListProps {
  assets: FixedAsset[];
  onRefresh: () => Promise<void>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ASSET_STATUS_VARIANTS: Record<
  AssetStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  active: 'default',
  fully_depreciated: 'secondary',
  disposed: 'destructive',
  inactive: 'outline',
};

// ============================================================================
// COMPONENT
// ============================================================================

export function AssetsList({ assets }: AssetsListProps) {
  const { t } = useTranslation('accounting');

  if (assets.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-lg font-medium text-foreground mb-1">{t('assets.noAssets')}</p>
        <p className="text-muted-foreground">{t('assets.noAssetsDescription')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('assets.name')}</TableHead>
            <TableHead className="w-36">{t('assets.category')}</TableHead>
            <TableHead className="w-28">{t('assets.acquisitionDate')}</TableHead>
            <TableHead className="w-28 text-right">{t('assets.acquisitionCost')}</TableHead>
            <TableHead className="w-32 text-right">{t('assets.accumulatedDepreciation')}</TableHead>
            <TableHead className="w-28 text-right">{t('assets.netBookValue')}</TableHead>
            <TableHead className="w-28">{t('assets.status')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.map((asset) => (
            <TableRow key={asset.assetId}>
              <TableCell className="font-medium max-w-[200px] truncate">
                {asset.description}
              </TableCell>
              <TableCell className="text-sm">
                {t(`assets.categories.${asset.category}`)}
              </TableCell>
              <TableCell className="text-sm">
                {formatDate(asset.acquisitionDate)}
              </TableCell>
              <TableCell className="text-right text-sm">
                {formatCurrency(asset.acquisitionCost)}
              </TableCell>
              <TableCell className="text-right text-sm text-muted-foreground">
                {formatCurrency(asset.accumulatedDepreciation)}
              </TableCell>
              <TableCell className="text-right font-medium text-sm">
                {formatCurrency(asset.netBookValue)}
              </TableCell>
              <TableCell>
                <Badge variant={ASSET_STATUS_VARIANTS[asset.status]}>
                  {t(`assets.statuses.${asset.status}`)}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
