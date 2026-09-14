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

import { useTranslation } from 'react-i18next';
import { PartnerRow } from './PartnerRow';
import { CompanyRosterCard } from './CompanyRosterCard';
import { useRosterEditing } from './useRosterEditing';
import type { Partner } from '../../types/entity';
import { nowISO } from '@/lib/date-local';

// ============================================================================
// TYPES
// ============================================================================

interface PartnerManagementSectionProps {
  partners: Partner[];
  gemiNumber: string | null;
  /** ADR-841 §7 Α23 — έτοιμο κείμενο σφάλματος μορφής του αριθμού ΓΕΜΗ. */
  gemiError?: string;
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
    joinDate: nowISO().split('T')[0],
    exitDate: null,
    isActive: true,
  };
}

const profitShareOf = (partner: Partner): number => partner.profitSharePercent;

// ============================================================================
// COMPONENT
// ============================================================================

export function PartnerManagementSection({
  partners,
  gemiNumber,
  gemiError,
  onPartnersChange,
  onGemiNumberChange,
}: PartnerManagementSectionProps) {
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);
  const roster = useRosterEditing(partners, onPartnersChange, createEmptyPartner, profitShareOf);

  return (
    <CompanyRosterCard
      title={t('setup.partners.title')}
      // ΓΕΜΗ — προαιρετικό στην ΟΕ: κενό ⇒ `null`
      gemi={{
        id: 'gemiNumber',
        value: gemiNumber ?? '',
        required: false,
        error: gemiError,
        onChange: (value) => onGemiNumberChange(value.trim() === '' ? null : value),
      }}
      rows={partners.map((partner, index) => (
        <PartnerRow
          key={partner.partnerId}
          partner={partner}
          index={index}
          onChange={roster.change}
          onRemove={roster.remove}
        />
      ))}
      rowCount={partners.length}
      activeShareSum={roster.activeShareSum}
      shareSumTexts={{
        sumLabel: t('setup.partners.shareSum', { sum: roster.activeShareSum.toFixed(2) }),
        validLabel: t('setup.partners.shareSumValid'),
        invalidLabel: t('setup.partners.shareSumInvalid'),
      }}
      addLabel={t('setup.partners.addPartner')}
      onAdd={roster.add}
    />
  );
}
