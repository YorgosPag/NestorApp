/**
 * @fileoverview VAT Deductibility Table — Πίνακας κανόνων εκπτωσιμότητας ΦΠΑ
 * @description Εμφανίζει expense category, deductibility %, legal basis (static data from config)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-004 VAT Engine
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getVatDeductibilityRules } from '../../services/config/vat-config';
import { getCategoryByCode } from '../../config/account-categories';
import type { VATDeductibilityRule } from '@/subapps/accounting/types';

// ============================================================================
// HELPERS
// ============================================================================

function getDeductibilityBadgeVariant(percent: number): 'default' | 'secondary' | 'destructive' {
  if (percent === 100) return 'default';
  if (percent > 0) return 'secondary';
  return 'destructive';
}

function getDeductibilityLabel(percent: number): string {
  if (percent === 100) return '100%';
  if (percent === 0) return '0%';
  return `${percent}%`;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function VATDeductibilityTable() {
  const { t } = useTranslation('accounting');

  const rules = useMemo(() => {
    const rulesMap = getVatDeductibilityRules();
    const rulesList: (VATDeductibilityRule & { categoryLabel: string })[] = [];

    for (const [code, rule] of rulesMap) {
      const categoryDef = getCategoryByCode(code);
      rulesList.push({
        ...rule,
        categoryLabel: categoryDef?.label ?? code,
      });
    }

    return rulesList;
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('vat.deductibility')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-52">
                  {t('vat.deductibility')} &mdash; Category
                </TableHead>
                <TableHead className="w-28 text-center">%</TableHead>
                <TableHead>Legal Basis</TableHead>
                <TableHead className="w-48">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.category}>
                  <TableCell className="font-medium">{rule.categoryLabel}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={getDeductibilityBadgeVariant(rule.deductiblePercent)}>
                      {getDeductibilityLabel(rule.deductiblePercent)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {rule.legalBasis}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {rule.notes ?? '\u2014'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
