'use client';

/**
 * @fileoverview Company Setup — Partner Row
 * @description Single partner row: Name, VAT, share%, EFKA config
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-10
 * @version 1.0.0
 * @see ADR-ACC-012 OE Partnership Support
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
import type { Partner } from '../../types/entity';

// ============================================================================
// TYPES
// ============================================================================

interface PartnerRowProps {
  partner: Partner;
  index: number;
  onChange: (index: number, updates: Partial<Partner>) => void;
  onRemove: (index: number) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const EFKA_MAIN_CODES = ['main_1', 'main_2', 'main_3', 'main_4', 'main_5', 'main_6'] as const;

// ============================================================================
// COMPONENT
// ============================================================================

export function PartnerRow({ partner, index, onChange, onRemove }: PartnerRowProps) {
  const { t } = useTranslation('accounting');

  return (
    <article className="rounded-lg border p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h4 className="font-medium text-sm">
          {t('setup.partners.partnerLabel', { number: index + 1 })}
        </h4>
        <nav className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={partner.isActive}
              onCheckedChange={(checked) => onChange(index, { isActive: checked })}
            />
            {t('setup.partners.active')}
          </label>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(index)}
            aria-label={t('setup.partners.remove')}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </nav>
      </header>

      {/* Row 1: Name, VAT, Tax Office */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label>{t('setup.partners.fullName')}</Label>
          <Input
            value={partner.fullName}
            onChange={(e) => onChange(index, { fullName: e.target.value })}
            placeholder={t('setup.partners.fullNamePlaceholder')}
          />
        </div>
        <div className="space-y-1">
          <Label>{t('setup.partners.vatNumber')}</Label>
          <Input
            value={partner.vatNumber}
            onChange={(e) => onChange(index, { vatNumber: e.target.value })}
            placeholder="123456789"
            maxLength={9}
          />
        </div>
        <div className="space-y-1">
          <Label>{t('setup.partners.taxOffice')}</Label>
          <Input
            value={partner.taxOffice}
            onChange={(e) => onChange(index, { taxOffice: e.target.value })}
          />
        </div>
      </div>

      {/* Row 2: Share %, EFKA category, Join Date */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label>{t('setup.partners.profitShare')}</Label>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={partner.profitSharePercent}
            onChange={(e) => onChange(index, { profitSharePercent: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-1">
          <Label>{t('setup.partners.efkaMainCategory')}</Label>
          <Select
            value={partner.efkaConfig.selectedMainPensionCode}
            onValueChange={(v) =>
              onChange(index, {
                efkaConfig: { ...partner.efkaConfig, selectedMainPensionCode: v },
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
        </div>
        <div className="space-y-1">
          <Label>{t('setup.partners.joinDate')}</Label>
          <Input
            type="date"
            value={partner.joinDate}
            onChange={(e) => onChange(index, { joinDate: e.target.value })}
          />
        </div>
      </div>

      {/* First five years toggle */}
      <label className="flex items-center gap-2 text-sm">
        <Switch
          checked={partner.isFirstFiveYears}
          onCheckedChange={(checked) => onChange(index, { isFirstFiveYears: checked })}
        />
        {t('setup.partners.isFirstFiveYears')}
      </label>
    </article>
  );
}
