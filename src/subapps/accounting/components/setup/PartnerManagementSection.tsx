'use client';

/**
 * @fileoverview Company Setup — Partner Management Section
 * @description Λίστα εταίρων, add/edit/remove, sum=100% validation
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-10
 * @version 1.0.0
 * @see ADR-ACC-012 OE Partnership Support
 * @compliance CLAUDE.md — no inline styles, semantic HTML, zero `any`
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, AlertTriangle } from 'lucide-react';
import { PartnerRow } from './PartnerRow';
import type { Partner } from '../../types/entity';

// ============================================================================
// TYPES
// ============================================================================

interface PartnerManagementSectionProps {
  partners: Partner[];
  gemiNumber: string | null;
  onPartnersChange: (partners: Partner[]) => void;
  onGemiNumberChange: (gemiNumber: string | null) => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function createEmptyPartner(index: number): Partner {
  return {
    partnerId: `prt_${Date.now()}_${index}`,
    fullName: '',
    vatNumber: '',
    taxOffice: '',
    profitSharePercent: 0,
    efkaConfig: {
      selectedMainPensionCode: 'main_1',
      selectedSupplementaryCode: 'supplementary_1',
      selectedLumpSumCode: 'lump_sum_1',
      efkaRegistrationNumber: '',
      activityStartDate: '',
      notes: null,
    },
    isFirstFiveYears: false,
    joinDate: new Date().toISOString().split('T')[0],
    exitDate: null,
    isActive: true,
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PartnerManagementSection({
  partners,
  gemiNumber,
  onPartnersChange,
  onGemiNumberChange,
}: PartnerManagementSectionProps) {
  const { t } = useTranslation('accounting');

  const activeShareSum = partners
    .filter((p) => p.isActive)
    .reduce((sum, p) => sum + p.profitSharePercent, 0);

  const shareValid = Math.abs(activeShareSum - 100) <= 0.01;

  const handlePartnerChange = useCallback(
    (index: number, updates: Partial<Partner>) => {
      const next = [...partners];
      next[index] = { ...next[index], ...updates };
      onPartnersChange(next);
    },
    [partners, onPartnersChange]
  );

  const handleAddPartner = useCallback(() => {
    onPartnersChange([...partners, createEmptyPartner(partners.length)]);
  }, [partners, onPartnersChange]);

  const handleRemovePartner = useCallback(
    (index: number) => {
      onPartnersChange(partners.filter((_, i) => i !== index));
    },
    [partners, onPartnersChange]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('setup.partners.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ΓΕΜΗ */}
        <div className="max-w-sm space-y-1">
          <Label htmlFor="gemiNumber">{t('setup.gemiNumber')}</Label>
          <Input
            id="gemiNumber"
            value={gemiNumber ?? ''}
            onChange={(e) => onGemiNumberChange(e.target.value || null)}
            placeholder={t('setup.gemiNumberPlaceholder')}
          />
        </div>

        {/* Partners list */}
        <section className="space-y-3">
          {partners.map((partner, index) => (
            <PartnerRow
              key={partner.partnerId}
              partner={partner}
              index={index}
              onChange={handlePartnerChange}
              onRemove={handleRemovePartner}
            />
          ))}
        </section>

        {/* Share sum validation */}
        {partners.length > 0 && (
          <div
            className={`flex items-center gap-2 rounded-md border p-3 text-sm ${
              shareValid
                ? 'border-green-500/50 bg-green-500/5 text-green-700 dark:text-green-400'
                : 'border-destructive/50 bg-destructive/5 text-destructive'
            }`}
            role={shareValid ? 'status' : 'alert'}
          >
            {!shareValid && <AlertTriangle className="h-4 w-4 flex-shrink-0" />}
            {t('setup.partners.shareSum', { sum: activeShareSum.toFixed(2) })}
            {shareValid
              ? ` — ${t('setup.partners.shareSumValid')}`
              : ` — ${t('setup.partners.shareSumInvalid')}`}
          </div>
        )}

        {/* Add partner button */}
        <Button variant="outline" onClick={handleAddPartner}>
          <Plus className="mr-2 h-4 w-4" />
          {t('setup.partners.addPartner')}
        </Button>
      </CardContent>
    </Card>
  );
}
