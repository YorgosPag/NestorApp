'use client';

/**
 * @fileoverview Company Setup — **Εγγραφή στο ΓΕΜΗ της ατομικής επιχείρησης** (ADR-841 §7 Α23).
 * @module subapps/accounting/components/setup/SoleProprietorRegistrySection
 *
 * 🔴 Ως τις 2026-09-14 η ατομική **δεν είχε** πού να γράψει αριθμό ΓΕΜΗ (ADR-ACC-012). Ατομική με
 * **εμπορική** δραστηριότητα όμως εγγράφεται (ν. 4919/2022 άρθ. 16)· ο ελεύθερος επαγγελματίας
 * (μηχανικός, δικηγόρος) όχι. Γι' αυτό το πεδίο είναι **προαιρετικό** και το κενό σημαίνει
 * «χωρίς ΓΕΜΗ» (`null`), ποτέ «δεν συμπληρώθηκε ακόμα».
 */

import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { GemiNumberField } from './GemiNumberField';

interface SoleProprietorRegistrySectionProps {
  readonly gemiNumber: string | null;
  readonly error?: string;
  readonly onGemiNumberChange: (gemiNumber: string | null) => void;
}

export function SoleProprietorRegistrySection({
  gemiNumber,
  error,
  onGemiNumberChange,
}: SoleProprietorRegistrySectionProps) {
  const { t } = useTranslation(['accounting', 'accounting-setup']);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('setup.gemiRegistration.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <GemiNumberField
          id="gemiNumberSole"
          value={gemiNumber ?? ''}
          required={false}
          note={t('setup.gemiRegistration.soleProprietorNote')}
          error={error}
          onChange={(value) => onGemiNumberChange(value.trim() === '' ? null : value)}
        />
      </CardContent>
    </Card>
  );
}
