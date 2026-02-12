'use client';

/**
 * @fileoverview Company Setup — Member Management Section (EPE)
 * @description Λίστα μελών ΕΠΕ, add/edit/remove, dividendSharePercent sum=100% validation
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-12
 * @version 1.0.0
 * @see ADR-ACC-014 EPE LLC Support
 * @compliance CLAUDE.md — no inline styles, semantic HTML, zero `any`
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, AlertTriangle, Info } from 'lucide-react';
import { MemberRow } from './MemberRow';
import type { Member } from '../../types/entity';

// ============================================================================
// TYPES
// ============================================================================

interface MemberManagementSectionProps {
  members: Member[];
  gemiNumber: string;
  shareCapital: number;
  onMembersChange: (members: Member[]) => void;
  onGemiNumberChange: (gemiNumber: string) => void;
  onShareCapitalChange: (shareCapital: number) => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function createEmptyMember(index: number): Member {
  return {
    memberId: `mbr_${Date.now()}_${index}`,
    fullName: '',
    vatNumber: '',
    taxOffice: '',
    sharesCount: 0,
    shareNominalValue: 0,
    capitalContribution: 0,
    dividendSharePercent: 0,
    isManager: false,
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

export function MemberManagementSection({
  members,
  gemiNumber,
  shareCapital,
  onMembersChange,
  onGemiNumberChange,
  onShareCapitalChange,
}: MemberManagementSectionProps) {
  const { t } = useTranslation('accounting');

  const activeShareSum = members
    .filter((m) => m.isActive)
    .reduce((sum, m) => sum + m.dividendSharePercent, 0);

  const shareValid = Math.abs(activeShareSum - 100) <= 0.01;

  const handleMemberChange = useCallback(
    (index: number, updates: Partial<Member>) => {
      const next = [...members];
      next[index] = { ...next[index], ...updates };
      onMembersChange(next);
    },
    [members, onMembersChange]
  );

  const handleAddMember = useCallback(() => {
    onMembersChange([...members, createEmptyMember(members.length)]);
  }, [members, onMembersChange]);

  const handleRemoveMember = useCallback(
    (index: number) => {
      onMembersChange(members.filter((_, i) => i !== index));
    },
    [members, onMembersChange]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('setup.members.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Double-entry notice */}
        <div
          className="flex items-start gap-2 rounded-md border border-blue-500/50 bg-blue-500/5 p-3 text-sm text-blue-700 dark:text-blue-400"
          role="status"
        >
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {t('setup.members.doubleEntryNotice')}
        </div>

        {/* ΓΕΜΗ (υποχρεωτικό) */}
        <fieldset className="max-w-sm space-y-1">
          <Label htmlFor="gemiNumber">{t('setup.gemiNumber')} *</Label>
          <Input
            id="gemiNumber"
            value={gemiNumber}
            onChange={(e) => onGemiNumberChange(e.target.value)}
            placeholder={t('setup.gemiNumberPlaceholder')}
            required
          />
          <p className="text-xs text-muted-foreground">
            {t('setup.members.gemiRequired')}
          </p>
        </fieldset>

        {/* Share Capital */}
        <fieldset className="max-w-sm space-y-1">
          <Label htmlFor="shareCapital">{t('setup.members.shareCapital')}</Label>
          <Input
            id="shareCapital"
            type="number"
            min={0}
            step={0.01}
            value={shareCapital}
            onChange={(e) => onShareCapitalChange(parseFloat(e.target.value) || 0)}
          />
        </fieldset>

        {/* Members list */}
        <section className="space-y-3">
          {members.map((member, index) => (
            <MemberRow
              key={member.memberId}
              member={member}
              index={index}
              onChange={handleMemberChange}
              onRemove={handleRemoveMember}
            />
          ))}
        </section>

        {/* Dividend share sum validation */}
        {members.length > 0 && (
          <div
            className={`flex items-center gap-2 rounded-md border p-3 text-sm ${
              shareValid
                ? 'border-green-500/50 bg-green-500/5 text-green-700 dark:text-green-400'
                : 'border-destructive/50 bg-destructive/5 text-destructive'
            }`}
            role={shareValid ? 'status' : 'alert'}
          >
            {!shareValid && <AlertTriangle className="h-4 w-4 flex-shrink-0" />}
            {t('setup.members.shareSum', { sum: activeShareSum.toFixed(2) })}
            {shareValid
              ? ` — ${t('setup.members.shareSumValid')}`
              : ` — ${t('setup.members.shareSumInvalid')}`}
          </div>
        )}

        {/* Add member button */}
        <Button variant="outline" onClick={handleAddMember}>
          <Plus className="mr-2 h-4 w-4" />
          {t('setup.members.addMember')}
        </Button>
      </CardContent>
    </Card>
  );
}
