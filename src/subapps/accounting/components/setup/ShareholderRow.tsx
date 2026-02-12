'use client';

/**
 * @fileoverview Company Setup — Shareholder Row (AE)
 * @description Single shareholder row: Name, VAT, shares, board role, compensation, EFKA mode
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-12
 * @version 1.0.0
 * @see ADR-ACC-015 AE Setup & Shareholders
 * @compliance CLAUDE.md — no inline styles, semantic HTML, zero `any`
 */

import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import type { Shareholder, BoardRole, ShareholderEFKAConfig, ShareholderEFKAMode } from '../../types/entity';

// ============================================================================
// TYPES
// ============================================================================

interface ShareholderRowProps {
  shareholder: Shareholder;
  index: number;
  totalShares: number;
  onChange: (index: number, updates: Partial<Shareholder>) => void;
  onRemove: (index: number) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BOARD_ROLES: BoardRole[] = ['president', 'vice_president', 'ceo', 'member'];

const EFKA_MAIN_CODES = ['main_1', 'main_2', 'main_3', 'main_4', 'main_5', 'main_6'] as const;

const DEFAULT_EFKA_CONFIG: ShareholderEFKAConfig = {
  selectedMainPensionCode: 'main_1',
  selectedSupplementaryCode: 'supplementary_1',
  selectedLumpSumCode: 'lump_sum_1',
  efkaRegistrationNumber: '',
  activityStartDate: '',
  notes: null,
};

// ============================================================================
// HELPERS
// ============================================================================

function deriveEfkaMode(
  isBoardMember: boolean,
  compensation: number | null,
  sharesCount: number,
  totalShares: number
): ShareholderEFKAMode {
  if (!isBoardMember || !compensation || compensation <= 0) return 'none';
  const sharePercent = totalShares > 0 ? (sharesCount / totalShares) * 100 : 0;
  return sharePercent < 3 ? 'employee' : 'self_employed';
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ShareholderRow({ shareholder, index, totalShares, onChange, onRemove }: ShareholderRowProps) {
  const { t } = useTranslation('accounting');

  const capitalContribution = shareholder.sharesCount * shareholder.shareNominalValue;
  const efkaMode = deriveEfkaMode(
    shareholder.isBoardMember,
    shareholder.monthlyCompensation,
    shareholder.sharesCount,
    totalShares
  );

  return (
    <article className="rounded-lg border p-4 space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-sm">
            {t('setup.shareholders.shareholderLabel', { number: index + 1 })}
          </h4>
          {shareholder.isBoardMember && shareholder.boardRole && (
            <Badge variant="secondary" className="text-xs">
              {t(`setup.shareholders.boardRoles.${shareholder.boardRole}`)}
            </Badge>
          )}
          {efkaMode !== 'none' && (
            <Badge
              variant={efkaMode === 'employee' ? 'default' : 'outline'}
              className="text-xs"
            >
              {t(`setup.shareholders.efkaModes.${efkaMode}`)}
            </Badge>
          )}
        </div>
        <nav className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={shareholder.isActive}
              onCheckedChange={(checked) => onChange(index, { isActive: checked })}
            />
            {t('setup.shareholders.active')}
          </label>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(index)}
            aria-label={t('setup.shareholders.remove')}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </nav>
      </header>

      {/* Row 1: Name, VAT, Tax Office */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <fieldset className="space-y-1">
          <Label>{t('setup.shareholders.fullName')}</Label>
          <Input
            value={shareholder.fullName}
            onChange={(e) => onChange(index, { fullName: e.target.value })}
            placeholder={t('setup.shareholders.fullNamePlaceholder')}
          />
        </fieldset>
        <fieldset className="space-y-1">
          <Label>{t('setup.shareholders.vatNumber')}</Label>
          <Input
            value={shareholder.vatNumber}
            onChange={(e) => onChange(index, { vatNumber: e.target.value })}
            placeholder="123456789"
            maxLength={9}
          />
        </fieldset>
        <fieldset className="space-y-1">
          <Label>{t('setup.shareholders.taxOffice')}</Label>
          <Input
            value={shareholder.taxOffice}
            onChange={(e) => onChange(index, { taxOffice: e.target.value })}
          />
        </fieldset>
      </div>

      {/* Row 2: Shares, Nominal Value, Capital, Dividend % */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <fieldset className="space-y-1">
          <Label>{t('setup.shareholders.sharesCount')}</Label>
          <Input
            type="number"
            min={0}
            value={shareholder.sharesCount}
            onChange={(e) => {
              const newCount = parseInt(e.target.value, 10) || 0;
              const newEfkaMode = deriveEfkaMode(
                shareholder.isBoardMember,
                shareholder.monthlyCompensation,
                newCount,
                totalShares - shareholder.sharesCount + newCount
              );
              onChange(index, {
                sharesCount: newCount,
                capitalContribution: newCount * shareholder.shareNominalValue,
                efkaMode: newEfkaMode,
              });
            }}
          />
        </fieldset>
        <fieldset className="space-y-1">
          <Label>{t('setup.shareholders.shareNominalValue')}</Label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={shareholder.shareNominalValue}
            onChange={(e) => onChange(index, {
              shareNominalValue: parseFloat(e.target.value) || 0,
              capitalContribution: shareholder.sharesCount * (parseFloat(e.target.value) || 0),
            })}
          />
        </fieldset>
        <fieldset className="space-y-1">
          <Label>{t('setup.shareholders.capitalContribution')}</Label>
          <Input
            type="number"
            value={capitalContribution}
            disabled
            className="bg-muted"
          />
        </fieldset>
        <fieldset className="space-y-1">
          <Label>{t('setup.shareholders.dividendSharePercent')}</Label>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={shareholder.dividendSharePercent}
            onChange={(e) => onChange(index, { dividendSharePercent: parseFloat(e.target.value) || 0 })}
          />
        </fieldset>
      </div>

      {/* Row 3: Board Member toggle, Board Role, Compensation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <fieldset className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Switch
              checked={shareholder.isBoardMember}
              onCheckedChange={(checked) => {
                const updates: Partial<Shareholder> = {
                  isBoardMember: checked,
                  boardRole: checked ? 'member' : null,
                  monthlyCompensation: checked ? shareholder.monthlyCompensation : null,
                  efkaMode: deriveEfkaMode(checked, shareholder.monthlyCompensation, shareholder.sharesCount, totalShares),
                };
                if (!checked) {
                  updates.efkaConfig = null;
                }
                onChange(index, updates);
              }}
            />
            {t('setup.shareholders.isBoardMember')}
          </label>
          <p className="text-xs text-muted-foreground">
            {t('setup.shareholders.boardMemberOnlyEfka')}
          </p>
        </fieldset>

        {shareholder.isBoardMember && (
          <fieldset className="space-y-1">
            <Label>{t('setup.shareholders.boardRole')}</Label>
            <Select
              value={shareholder.boardRole ?? 'member'}
              onValueChange={(v) => onChange(index, { boardRole: v as BoardRole })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BOARD_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {t(`setup.shareholders.boardRoles.${role}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </fieldset>
        )}

        {shareholder.isBoardMember && (
          <fieldset className="space-y-1">
            <Label>{t('setup.shareholders.monthlyCompensation')}</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={shareholder.monthlyCompensation ?? ''}
              onChange={(e) => {
                const comp = parseFloat(e.target.value) || 0;
                const newEfkaMode = deriveEfkaMode(true, comp, shareholder.sharesCount, totalShares);
                const updates: Partial<Shareholder> = {
                  monthlyCompensation: comp > 0 ? comp : null,
                  efkaMode: newEfkaMode,
                };
                // Auto-init EFKA config for self-employed mode
                if (newEfkaMode === 'self_employed' && !shareholder.efkaConfig) {
                  updates.efkaConfig = { ...DEFAULT_EFKA_CONFIG };
                }
                if (newEfkaMode !== 'self_employed') {
                  updates.efkaConfig = null;
                }
                onChange(index, updates);
              }}
            />
          </fieldset>
        )}
      </div>

      {/* EFKA Config (self-employed mode only) */}
      {efkaMode === 'self_employed' && shareholder.efkaConfig && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <fieldset className="space-y-1">
            <Label>{t('setup.shareholders.efkaMainCategory')}</Label>
            <Select
              value={shareholder.efkaConfig.selectedMainPensionCode}
              onValueChange={(v) =>
                onChange(index, {
                  efkaConfig: { ...(shareholder.efkaConfig ?? DEFAULT_EFKA_CONFIG), selectedMainPensionCode: v },
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EFKA_MAIN_CODES.map((code, i) => (
                  <SelectItem key={code} value={code}>
                    {t('setup.efkaCategoryLabel', { number: i + 1 })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('setup.shareholders.efkaSelfEmployedExplain')}
            </p>
          </fieldset>

          <fieldset className="space-y-1">
            <Label>{t('setup.shareholders.joinDate')}</Label>
            <Input
              type="date"
              value={shareholder.joinDate}
              onChange={(e) => onChange(index, { joinDate: e.target.value })}
            />
          </fieldset>

          <fieldset className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={shareholder.isFirstFiveYears}
                onCheckedChange={(checked) => onChange(index, { isFirstFiveYears: checked })}
              />
              {t('setup.shareholders.isFirstFiveYears')}
            </label>
          </fieldset>
        </div>
      )}

      {/* Employee mode info */}
      {efkaMode === 'employee' && (
        <div className="flex items-start gap-2 rounded-md border border-blue-500/50 bg-blue-500/5 p-3 text-xs text-blue-700 dark:text-blue-400">
          {t('setup.shareholders.efkaEmployeeExplain')}
        </div>
      )}

      {/* Join Date (when not self-employed — self-employed has it in EFKA section) */}
      {efkaMode !== 'self_employed' && (
        <fieldset className="max-w-sm space-y-1">
          <Label>{t('setup.shareholders.joinDate')}</Label>
          <Input
            type="date"
            value={shareholder.joinDate}
            onChange={(e) => onChange(index, { joinDate: e.target.value })}
          />
        </fieldset>
      )}
    </article>
  );
}
