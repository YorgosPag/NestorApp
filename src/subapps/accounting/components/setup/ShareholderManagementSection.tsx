'use client';

/**
 * @fileoverview Company Setup — Shareholder Management Section (AE)
 * @description ΓΕΜΗ, min capital 25k, shareholders list, board roles, EFKA dual-mode
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-12
 * @version 1.0.0
 * @see ADR-ACC-015 AE Setup & Shareholders
 * @compliance CLAUDE.md — no inline styles, semantic HTML, zero `any`
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, AlertTriangle, Info } from 'lucide-react';
import { ShareholderRow } from './ShareholderRow';
import type { Shareholder } from '../../types/entity';

// ============================================================================
// TYPES
// ============================================================================

interface ShareholderManagementSectionProps {
  shareholders: Shareholder[];
  gemiNumber: string;
  shareCapital: number;
  onShareholdersChange: (shareholders: Shareholder[]) => void;
  onGemiNumberChange: (gemiNumber: string) => void;
  onShareCapitalChange: (shareCapital: number) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Ελάχιστο μετοχικό κεφάλαιο ΑΕ (Ν.4548/2018) */
const MIN_SHARE_CAPITAL = 25000;

// ============================================================================
// HELPERS
// ============================================================================

function createEmptyShareholder(index: number): Shareholder {
  return {
    shareholderId: `shr_${Date.now()}_${index}`,
    fullName: '',
    vatNumber: '',
    taxOffice: '',
    sharesCount: 0,
    shareNominalValue: 0,
    capitalContribution: 0,
    dividendSharePercent: 0,
    isBoardMember: false,
    boardRole: null,
    monthlyCompensation: null,
    efkaMode: 'none',
    efkaConfig: null,
    isFirstFiveYears: false,
    joinDate: new Date().toISOString().split('T')[0],
    exitDate: null,
    isActive: true,
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ShareholderManagementSection({
  shareholders,
  gemiNumber,
  shareCapital,
  onShareholdersChange,
  onGemiNumberChange,
  onShareCapitalChange,
}: ShareholderManagementSectionProps) {
  const { t } = useTranslation('accounting');

  const activeShareSum = shareholders
    .filter((s) => s.isActive)
    .reduce((sum, s) => sum + s.dividendSharePercent, 0);

  const shareValid = Math.abs(activeShareSum - 100) <= 0.01;
  const capitalValid = shareCapital >= MIN_SHARE_CAPITAL;

  const totalShares = shareholders.reduce((sum, s) => sum + s.sharesCount, 0);

  const handleShareholderChange = useCallback(
    (index: number, updates: Partial<Shareholder>) => {
      const next = [...shareholders];
      next[index] = { ...next[index], ...updates };
      onShareholdersChange(next);
    },
    [shareholders, onShareholdersChange]
  );

  const handleAddShareholder = useCallback(() => {
    onShareholdersChange([...shareholders, createEmptyShareholder(shareholders.length)]);
  }, [shareholders, onShareholdersChange]);

  const handleRemoveShareholder = useCallback(
    (index: number) => {
      onShareholdersChange(shareholders.filter((_, i) => i !== index));
    },
    [shareholders, onShareholdersChange]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('setup.shareholders.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Double-entry notice */}
        <div
          className="flex items-start gap-2 rounded-md border border-blue-500/50 bg-blue-500/5 p-3 text-sm text-blue-700 dark:text-blue-400"
          role="status"
        >
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {t('setup.shareholders.doubleEntryNotice')}
        </div>

        {/* ΓΕΜΗ (υποχρεωτικό) */}
        <fieldset className="max-w-sm space-y-1">
          <Label htmlFor="gemiNumberAE">{t('setup.gemiNumber')} *</Label>
          <Input
            id="gemiNumberAE"
            value={gemiNumber}
            onChange={(e) => onGemiNumberChange(e.target.value)}
            placeholder={t('setup.gemiNumberPlaceholder')}
            required
          />
          <p className="text-xs text-muted-foreground">
            {t('setup.shareholders.gemiRequired')}
          </p>
        </fieldset>

        {/* Share Capital (min 25.000€) */}
        <fieldset className="max-w-sm space-y-1">
          <Label htmlFor="shareCapitalAE">{t('setup.shareholders.shareCapital')}</Label>
          <Input
            id="shareCapitalAE"
            type="number"
            min={MIN_SHARE_CAPITAL}
            step={0.01}
            value={shareCapital}
            onChange={(e) => onShareCapitalChange(parseFloat(e.target.value) || 0)}
          />
          {!capitalValid && shareCapital > 0 && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <AlertTriangle className="h-3 w-3" />
              {t('setup.shareholders.minCapitalNotice')}
            </p>
          )}
          {capitalValid && (
            <p className="text-xs text-muted-foreground">
              {t('setup.shareholders.minCapitalNotice')}
            </p>
          )}
        </fieldset>

        {/* Shareholders list */}
        <section className="space-y-3">
          {shareholders.map((shareholder, index) => (
            <ShareholderRow
              key={shareholder.shareholderId}
              shareholder={shareholder}
              index={index}
              totalShares={totalShares}
              onChange={handleShareholderChange}
              onRemove={handleRemoveShareholder}
            />
          ))}
        </section>

        {/* Dividend share sum validation */}
        {shareholders.length > 0 && (
          <div
            className={`flex items-center gap-2 rounded-md border p-3 text-sm ${
              shareValid
                ? 'border-green-500/50 bg-green-500/5 text-green-700 dark:text-green-400'
                : 'border-destructive/50 bg-destructive/5 text-destructive'
            }`}
            role={shareValid ? 'status' : 'alert'}
          >
            {!shareValid && <AlertTriangle className="h-4 w-4 flex-shrink-0" />}
            {t('setup.shareholders.shareSum', { sum: activeShareSum.toFixed(2) })}
            {shareValid
              ? ` — ${t('setup.shareholders.shareSumValid')}`
              : ` — ${t('setup.shareholders.shareSumInvalid')}`}
          </div>
        )}

        {/* Add shareholder button */}
        <Button variant="outline" onClick={handleAddShareholder}>
          <Plus className="mr-2 h-4 w-4" />
          {t('setup.shareholders.addShareholder')}
        </Button>
      </CardContent>
    </Card>
  );
}
