'use client';

/**
 * ADR-901 §15 (Γ1) — **«Αναλαμβάνετε για λογαριασμό …»**: η δήλωση ιδιότητας χώρου, γραμμένη **πριν** από το πάτημα.
 *
 * | Τι είπε ο διακομιστής | Τι βλέπει ο άνθρωπος |
 * |---|---|
 * | ένα γραφείο | «Αναλαμβάνετε για λογαριασμό του γραφείου …» — καμία ερώτηση |
 * | κανένα | «…προσωρινά στον προσωπικό σας χώρο» |
 * | 2+ | επιλογέας (ADR-001 — `@/components/ui/select`), **χωρίς** προεπιλογή |
 * | άγνωστο | το λέμε — η αποδοχή δεν προχωρά |
 *
 * 🔑 **Ένα** πεδίο για τις δύο πόρτες (διάλογος «Αναλαμβάνω» · σελίδα πρόσκλησης). Δεν αποφασίζει τίποτα: δείχνει
 *    την ετυμηγορία του διακομιστή και κρατά **μόνο** την επιλογή του ανθρώπου.
 * ⛔ Καμία επιλογή «προσωπικά» για όποιον έχει γραφείο (Α1γ) — δεν υπάρχει καν στη λίστα.
 *
 * @module components/conveyance/acting/ActingWorkspaceField
 */

import React, { useId } from 'react';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { AcceptancePreview, ActingForView, ActingOffice } from '@/types/conveyance-case';

import { ACTING_KEYS, ACTING_NS } from './acting-workspace-labels';

/** Το όνομα του γραφείου όπως λέγεται στην οθόνη — κενό όνομα ⇒ τα λόγια του locale, ποτέ το αναγνωριστικό. */
function useOfficeName(): (office: ActingOffice) => string {
  const { t } = useTranslation(ACTING_NS);
  return (office) => (office.name.length > 0 ? office.name : t(ACTING_KEYS.unnamedOffice));
}

interface ActingWorkspaceFieldProps {
  readonly preview: AcceptancePreview;
  /** Το γραφείο που διάλεξε ο άνθρωπος — έχει νόημα μόνο όταν υπάρχουν 2+. */
  readonly selectedCompanyId: string | null;
  readonly onSelect: (companyId: string) => void;
  /** Πατήθηκε αποδοχή χωρίς επιλογή — το λάθος λέγεται **δίπλα** στο πεδίο. */
  readonly showMissing: boolean;
  readonly disabled: boolean;
}

function OfficeChooser({ offices, selectedCompanyId, onSelect, showMissing, disabled }: Omit<ActingWorkspaceFieldProps, 'preview'> & { readonly offices: readonly ActingOffice[] }) {
  const { t } = useTranslation(ACTING_NS);
  const colors = useSemanticColors();
  const officeName = useOfficeName();
  const fieldId = useId();
  const errorId = useId();
  const missing = showMissing && selectedCompanyId === null;
  return (
    <section className="space-y-1">
      <Label htmlFor={fieldId}>{t(ACTING_KEYS.chooseLabel)}</Label>
      <Select value={selectedCompanyId ?? undefined} onValueChange={onSelect} disabled={disabled}>
        <SelectTrigger id={fieldId} aria-invalid={missing} aria-describedby={missing ? errorId : undefined}>
          <SelectValue placeholder={t(ACTING_KEYS.choosePlaceholder)} />
        </SelectTrigger>
        <SelectContent>
          {offices.map((office) => (
            <SelectItem key={office.companyId} value={office.companyId}>{officeName(office)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {missing && <p id={errorId} role="alert" className={cn('text-xs', colors.text.error)}>{t(ACTING_KEYS.chooseRequired)}</p>}
    </section>
  );
}

export function ActingWorkspaceField({ preview, ...chooser }: ActingWorkspaceFieldProps) {
  const { t } = useTranslation(ACTING_NS);
  const colors = useSemanticColors();
  const officeName = useOfficeName();
  switch (preview.kind) {
    case 'office':
      return <p className="text-sm text-foreground">{t(ACTING_KEYS.office, { office: officeName(preview.office) })}</p>;
    case 'personal-provisional':
      return <p className={cn('text-sm', colors.text.muted)}>{t(ACTING_KEYS.personalProvisional)}</p>;
    case 'choice-required':
      return <OfficeChooser offices={preview.offices} {...chooser} />;
    case 'unknown':
      return <p role="alert" className={cn('text-sm', colors.text.error)}>{t(ACTING_KEYS.unknown)}</p>;
  }
}

/** Η ίδια δήλωση **μετά** την αποδοχή — μία γραμμή στην κάρτα: για ποιον ενεργώ. */
export function ActingForLine({ actingFor }: { readonly actingFor: ActingForView }) {
  const { t } = useTranslation(ACTING_NS);
  const officeName = useOfficeName();
  return (
    <span>
      {actingFor.kind === 'office'
        ? t(ACTING_KEYS.cardOffice, { office: officeName(actingFor.office) })
        : t(ACTING_KEYS.cardPersonal)}
    </span>
  );
}
