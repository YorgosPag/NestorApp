'use client';

/**
 * ADR-915 §14 — το πεδίο «Ισχύει έως (όπως είναι τυπωμένο)» του διαλόγου ελέγχου.
 *
 * Μόνο για είδη με κανόνα `printed` (φορολογική · ΕΦΚΑ · ΕΝΦΙΑ): η διάρκειά τους εξαρτάται από ό,τι ξέρει μόνο το ίδιο
 * το έγγραφο (οφειλές πωλητή, κύκλος ΕΝΦΙΑ), άρα η λήξη **διαβάζεται από το χαρτί** — πρακτική Procore/ACC.
 *
 * 🏆 Πέρα από αυτούς: ο ελεγκτής βλέπει **ζωντανά** το νόμιμο εύρος για την έκδοση που δήλωσε, και ό,τι πέφτει έξω από
 * αυτό λέγεται πριν την αποθήκευση — ο ίδιος υπολογισμός (`documentExpiry`) που θα κρίνει μετά.
 * Κενό πεδίο = «δεν το έγραψε» ⇒ ισχύει το εγγυημένο κατώτατο («τουλάχιστον έως»), ποτέ «σε ισχύ» στα τυφλά.
 *
 * @module components/sales/conveyance/ConveyanceValidUntilField
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { Label } from '@/components/ui/label';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { formatDate } from '@/lib/intl-utils';
import { dateKeyOfPicker } from '@/lib/calendar/date-key';
import { cn } from '@/lib/utils';
import type { DocumentClassification, DocumentValidityRule } from '@/config/document-validity/document-validity';
import { documentExpiry } from '@/lib/document-validity/document-expiry';
import { printedBoundsOf, type PrintedBounds } from '@/lib/document-validity/validity-bounds';

interface ConveyanceValidUntilFieldProps {
  readonly rule: DocumentValidityRule;
  readonly issuedOn: Date | undefined;
  readonly value: Date | undefined;
  readonly onChange: (date: Date | undefined) => void;
  /** Διαβάστηκε από το ίδιο το έγγραφο ⇒ μόνο ανάγνωση (ίδιο δόγμα με την ημερομηνία έκδοσης). */
  readonly locked: boolean;
  /**
   * ADR-915 §33 — η κατηγορία που δηλώνεται στο **ίδιο** έγγραφο (ΥΔΕ Α/Β/Γ): το ανώτατο εξαρτάται από αυτήν. Απουσία
   * ⇒ `null` = το μέγιστο του καθεστώτος (ADR-915 §32 Υ4) — ό,τι έκανε το πεδίο πριν.
   */
  readonly classification?: DocumentClassification | null;
}

/** Η υπόδειξη: το νόμιμο εύρος για αυτή την έκδοση, ή η γενική οδηγία όταν η έκδοση δεν δηλώθηκε ακόμη. */
function useBoundsHint(bounds: PrintedBounds | null): string {
  const { t } = useTranslation(['conveyance']);
  if (bounds === null || bounds.ceiling === null) return t('dialogs.validUntilHint');
  if (bounds.floor === null) return t('dialogs.validUntilRangeCeiling', { ceiling: formatDate(bounds.ceiling) });
  return t('dialogs.validUntilRange', { floor: formatDate(bounds.floor), ceiling: formatDate(bounds.ceiling) });
}

export function ConveyanceValidUntilField({ rule, issuedOn, value, onChange, locked, classification = null }: ConveyanceValidUntilFieldProps) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  const issuedKey = dateKeyOfPicker(issuedOn);
  const bounds = printedBoundsOf(rule, issuedKey, classification);
  const hint = useBoundsHint(bounds);
  const discrepancy = documentExpiry({ rule, issuedOn: issuedKey, printedValidUntil: dateKeyOfPicker(value), classification }).discrepancy;
  return (
    <fieldset className="space-y-1">
      <Label htmlFor="conveyance-valid-until">{t('dialogs.validUntilLabel')}</Label>
      <DatePickerField
        id="conveyance-valid-until"
        value={value}
        onSelect={onChange}
        placeholder={t('signing.notSet')}
        disabled={locked}
        disabledDates={issuedOn ? { before: issuedOn } : undefined}
      />
      <p className={cn('text-xs', colors.text.muted)}>{hint}</p>
      {discrepancy && (
        <p role="note" className={cn('text-xs', colors.text.warning)}>
          {t('dialogs.validUntilOutOfRange', { printed: formatDate(discrepancy.printed), rule: formatDate(discrepancy.rule) })}
        </p>
      )}
    </fieldset>
  );
}
