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

import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { nowISO } from '@/lib/date-local';
import { ShareholderRow } from './ShareholderRow';
import { CompanyRosterCard } from './CompanyRosterCard';
import { useRosterEditing } from './useRosterEditing';
import type { Shareholder } from '../../types/entity';

// ============================================================================
// TYPES
// ============================================================================

interface ShareholderManagementSectionProps {
  shareholders: Shareholder[];
  gemiNumber: string;
  /** ADR-841 §7 Α23 — έτοιμο κείμενο σφάλματος μορφής του αριθμού ΓΕΜΗ. */
  gemiError?: string;
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
    joinDate: nowISO().split('T')[0],
    exitDate: null,
    isActive: true,
  };
}

const shareholderDividendShareOf = (shareholder: Shareholder): number => shareholder.dividendSharePercent;

/** Το πεδίο κεφαλαίου της ΑΕ — με το ελάχιστο των 25.000€ και την ανακοίνωσή του. */
function AeShareCapitalField({
  shareCapital,
  onShareCapitalChange,
}: {
  readonly shareCapital: number;
  readonly onShareCapitalChange: (shareCapital: number) => void;
}) {
  const { t } = useTranslation(['accounting', 'accounting-setup']);
  const colors = useSemanticColors();
  const capitalValid = shareCapital >= MIN_SHARE_CAPITAL;

  return (
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
        <p className={cn('text-xs', colors.text.muted)}>{t('setup.shareholders.minCapitalNotice')}</p>
      )}
    </fieldset>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ShareholderManagementSection({
  shareholders,
  gemiNumber,
  gemiError,
  shareCapital,
  onShareholdersChange,
  onGemiNumberChange,
  onShareCapitalChange,
}: ShareholderManagementSectionProps) {
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);
  const roster = useRosterEditing(
    shareholders,
    onShareholdersChange,
    createEmptyShareholder,
    shareholderDividendShareOf,
  );
  const totalShares = shareholders.reduce((sum, s) => sum + s.sharesCount, 0);

  return (
    <CompanyRosterCard
      title={t('setup.shareholders.title')}
      notice={t('setup.shareholders.doubleEntryNotice')}
      gemi={{
        id: 'gemiNumberAE',
        value: gemiNumber,
        required: true,
        note: t('setup.shareholders.gemiRequired'),
        error: gemiError,
        onChange: onGemiNumberChange,
      }}
      capital={<AeShareCapitalField shareCapital={shareCapital} onShareCapitalChange={onShareCapitalChange} />}
      rows={shareholders.map((shareholder, index) => (
        <ShareholderRow
          key={shareholder.shareholderId}
          shareholder={shareholder}
          index={index}
          totalShares={totalShares}
          onChange={roster.change}
          onRemove={roster.remove}
        />
      ))}
      rowCount={shareholders.length}
      activeShareSum={roster.activeShareSum}
      shareSumTexts={{
        sumLabel: t('setup.shareholders.shareSum', { sum: roster.activeShareSum.toFixed(2) }),
        validLabel: t('setup.shareholders.shareSumValid'),
        invalidLabel: t('setup.shareholders.shareSumInvalid'),
      }}
      addLabel={t('setup.shareholders.addShareholder')}
      onAdd={roster.add}
    />
  );
}
