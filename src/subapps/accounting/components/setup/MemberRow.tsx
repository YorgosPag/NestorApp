'use client';

/**
 * @fileoverview Company Setup — Member Row (EPE)
 * @description Single member row: Name, VAT, shares, manager toggle, EFKA config
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-12
 * @version 1.0.0
 * @see ADR-ACC-014 EPE LLC Support
 * @compliance CLAUDE.md — no inline styles, semantic HTML, zero `any`
 */

import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import type { Member, MemberEFKAConfig } from '../../types/entity';

// ============================================================================
// TYPES
// ============================================================================

interface MemberRowProps {
  member: Member;
  index: number;
  onChange: (index: number, updates: Partial<Member>) => void;
  onRemove: (index: number) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const EFKA_MAIN_CODES = ['main_1', 'main_2', 'main_3', 'main_4', 'main_5', 'main_6'] as const;

const DEFAULT_EFKA_CONFIG: MemberEFKAConfig = {
  selectedMainPensionCode: 'main_1',
  selectedSupplementaryCode: 'supplementary_1',
  selectedLumpSumCode: 'lump_sum_1',
  efkaRegistrationNumber: '',
  activityStartDate: '',
  notes: null,
};

// ============================================================================
// COMPONENT
// ============================================================================

export function MemberRow({ member, index, onChange, onRemove }: MemberRowProps) {
  const { t } = useTranslation('accounting');

  const capitalContribution = member.sharesCount * member.shareNominalValue;

  return (
    <article className="rounded-lg border p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h4 className="font-medium text-sm">
          {t('setup.members.memberLabel', { number: index + 1 })}
        </h4>
        <nav className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={member.isActive}
              onCheckedChange={(checked) => onChange(index, { isActive: checked })}
            />
            {t('setup.members.active')}
          </label>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(index)}
            aria-label={t('setup.members.remove')}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </nav>
      </header>

      {/* Row 1: Name, VAT, Tax Office */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <fieldset className="space-y-1">
          <Label>{t('setup.members.fullName')}</Label>
          <Input
            value={member.fullName}
            onChange={(e) => onChange(index, { fullName: e.target.value })}
            placeholder={t('setup.members.fullNamePlaceholder')}
          />
        </fieldset>
        <fieldset className="space-y-1">
          <Label>{t('setup.members.vatNumber')}</Label>
          <Input
            value={member.vatNumber}
            onChange={(e) => onChange(index, { vatNumber: e.target.value })}
            placeholder="123456789"
            maxLength={9}
          />
        </fieldset>
        <fieldset className="space-y-1">
          <Label>{t('setup.members.taxOffice')}</Label>
          <Input
            value={member.taxOffice}
            onChange={(e) => onChange(index, { taxOffice: e.target.value })}
          />
        </fieldset>
      </div>

      {/* Row 2: Shares, Nominal Value, Capital, Dividend % */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <fieldset className="space-y-1">
          <Label>{t('setup.members.sharesCount')}</Label>
          <Input
            type="number"
            min={0}
            value={member.sharesCount}
            onChange={(e) => onChange(index, {
              sharesCount: parseInt(e.target.value, 10) || 0,
              capitalContribution: (parseInt(e.target.value, 10) || 0) * member.shareNominalValue,
            })}
          />
        </fieldset>
        <fieldset className="space-y-1">
          <Label>{t('setup.members.shareNominalValue')}</Label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={member.shareNominalValue}
            onChange={(e) => onChange(index, {
              shareNominalValue: parseFloat(e.target.value) || 0,
              capitalContribution: member.sharesCount * (parseFloat(e.target.value) || 0),
            })}
          />
        </fieldset>
        <fieldset className="space-y-1">
          <Label>{t('setup.members.capitalContribution')}</Label>
          <Input
            type="number"
            value={capitalContribution}
            disabled
            className="bg-muted"
          />
        </fieldset>
        <fieldset className="space-y-1">
          <Label>{t('setup.members.dividendSharePercent')}</Label>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={member.dividendSharePercent}
            onChange={(e) => onChange(index, { dividendSharePercent: parseFloat(e.target.value) || 0 })}
          />
        </fieldset>
      </div>

      {/* Row 3: Manager toggle, EFKA (only for managers), Join Date */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <fieldset className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Switch
              checked={member.isManager}
              onCheckedChange={(checked) => {
                const updates: Partial<Member> = { isManager: checked };
                if (checked && !member.efkaConfig) {
                  updates.efkaConfig = { ...DEFAULT_EFKA_CONFIG };
                }
                if (!checked) {
                  updates.efkaConfig = null;
                }
                onChange(index, updates);
              }}
            />
            {t('setup.members.isManager')}
          </label>
          <p className="text-xs text-muted-foreground">
            {t('setup.members.managerOnlyEfka')}
          </p>
        </fieldset>

        {member.isManager && member.efkaConfig && (
          <fieldset className="space-y-1">
            <Label>{t('setup.members.efkaMainCategory')}</Label>
            <Select
              value={member.efkaConfig.selectedMainPensionCode}
              onValueChange={(v) =>
                onChange(index, {
                  efkaConfig: { ...(member.efkaConfig ?? DEFAULT_EFKA_CONFIG), selectedMainPensionCode: v },
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
          </fieldset>
        )}

        <fieldset className="space-y-1">
          <Label>{t('setup.members.joinDate')}</Label>
          <Input
            type="date"
            value={member.joinDate}
            onChange={(e) => onChange(index, { joinDate: e.target.value })}
          />
        </fieldset>
      </div>

      {/* First five years toggle (managers only) */}
      {member.isManager && (
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={member.isFirstFiveYears}
            onCheckedChange={(checked) => onChange(index, { isFirstFiveYears: checked })}
          />
          {t('setup.members.isFirstFiveYears')}
        </label>
      )}
    </article>
  );
}
