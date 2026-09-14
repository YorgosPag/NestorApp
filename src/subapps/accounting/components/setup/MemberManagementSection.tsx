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

import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MemberRow } from './MemberRow';
import { CompanyRosterCard } from './CompanyRosterCard';
import { useRosterEditing } from './useRosterEditing';
import type { Member } from '../../types/entity';
import { nowISO } from '@/lib/date-local';

// ============================================================================
// TYPES
// ============================================================================

interface MemberManagementSectionProps {
  members: Member[];
  gemiNumber: string;
  /** ADR-841 §7 Α23 — έτοιμο κείμενο σφάλματος μορφής του αριθμού ΓΕΜΗ. */
  gemiError?: string;
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
    joinDate: nowISO().split('T')[0],
    exitDate: null,
    isActive: true,
  };
}

const memberDividendShareOf = (member: Member): number => member.dividendSharePercent;

// ============================================================================
// COMPONENT
// ============================================================================

export function MemberManagementSection({
  members,
  gemiNumber,
  gemiError,
  shareCapital,
  onMembersChange,
  onGemiNumberChange,
  onShareCapitalChange,
}: MemberManagementSectionProps) {
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);
  const roster = useRosterEditing(members, onMembersChange, createEmptyMember, memberDividendShareOf);

  return (
    <CompanyRosterCard
      title={t('setup.members.title')}
      notice={t('setup.members.doubleEntryNotice')}
      gemi={{
        id: 'gemiNumber',
        value: gemiNumber,
        required: true,
        note: t('setup.members.gemiRequired'),
        error: gemiError,
        onChange: onGemiNumberChange,
      }}
      capital={
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
      }
      rows={members.map((member, index) => (
        <MemberRow
          key={member.memberId}
          member={member}
          index={index}
          onChange={roster.change}
          onRemove={roster.remove}
        />
      ))}
      rowCount={members.length}
      activeShareSum={roster.activeShareSum}
      shareSumTexts={{
        sumLabel: t('setup.members.shareSum', { sum: roster.activeShareSum.toFixed(2) }),
        validLabel: t('setup.members.shareSumValid'),
        invalidLabel: t('setup.members.shareSumInvalid'),
      }}
      addLabel={t('setup.members.addMember')}
      onAdd={roster.add}
    />
  );
}
