'use client';

/**
 * @fileoverview **Επιλογέας ιδιότητας** — ένας για όλες τις καρτέλες της οικογένειας (άξονες, γραμμές, κανόνες,
 *   όνομα/εικόνα) (ADR-923 Φάση 1γ). Και ο κοινός τύπος props των καρτελών.
 * @module components/catalog/families/AttributePicker
 *
 * 🔑 Η λίστα επιλογών τη δίνει ο καλών **ήδη φιλτραρισμένη** (π.χ. μόνο αριθμητικές για κανόνα) — ο επιλογέας δεν
 *    ξέρει κανόνες τομέα, άρα δεν μπορεί να προσφέρει κάτι που ο επικυρωτής θα απέρριπτε.
 * ⚠️ Τιμή εκτός λίστας (π.χ. ιδιότητα που αφαιρέθηκε) ⇒ placeholder, όχι κενό αόρατο κουτί· το εύρημα το δείχνει η
 *    καρτέλα. Κανένα `<SelectItem value="">` (CHECK 3.48).
 */

import React from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CatalogLibrary } from '@/hooks/catalog/useCatalogLibrary';
import type { AttributeRecord } from '@/services/catalog/catalog-api.client';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { CatalogFamilyDefinition } from '@/subapps/catalog/types/family';
import { ATTRIBUTE_TYPE_ICONS } from '../shared/catalog-labels';
import { useCatalogText } from '../shared/catalog-ui-hooks';

/** Ό,τι παίρνει κάθε καρτέλα του επεξεργαστή οικογένειας. */
export interface FamilyTabProps {
  readonly draft: CatalogFamilyDefinition;
  readonly update: (draft: CatalogFamilyDefinition) => void;
  readonly issues: readonly CatalogIssue[];
  readonly disabled: boolean;
  readonly library: CatalogLibrary;
  /** Οι ιδιότητες της οικογένειας (εγγραφές βιβλιοθήκης), με τη σειρά της οικογένειας. */
  readonly inFamily: readonly AttributeRecord[];
}

interface AttributePickerProps {
  readonly value: string | null;
  readonly options: readonly AttributeRecord[];
  readonly onChange: (attributeId: string) => void;
  readonly placeholder: string;
  readonly ariaLabel?: string;
  readonly id?: string;
  readonly describedBy?: string;
  readonly disabled?: boolean;
  readonly className?: string;
  /** Προαιρετική τιμή ⇒ κουμπί καθαρισμού (επιστροφή σε «κανένα»). */
  readonly onClear?: () => void;
}

export function AttributePicker({ onClear, ...props }: AttributePickerProps) {
  const { t } = useCatalogText();
  if (!onClear) return <AttributeSelect {...props} />;
  return (
    <span className="flex items-center gap-1">
      <AttributeSelect {...props} />
      <Button type="button" variant="ghost" size="icon" disabled={props.disabled || props.value === null} aria-label={t('common.clear')} onClick={onClear}>
        <X className="h-4 w-4" aria-hidden />
      </Button>
    </span>
  );
}

function AttributeSelect({ value, options, onChange, placeholder, ariaLabel, id, describedBy, disabled, className }: Omit<AttributePickerProps, 'onClear'>) {
  const { text } = useCatalogText();
  const known = value !== null && options.some((option) => option.id === value);
  return (
    <Select value={known ? value : ''} disabled={disabled} onValueChange={onChange}>
      <SelectTrigger id={id} aria-label={ariaLabel} aria-describedby={describedBy} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => {
          const Icon = ATTRIBUTE_TYPE_ICONS[option.type];
          return (
            <SelectItem key={option.id} value={option.id}>
              <span className="flex items-center gap-2"><Icon className="h-4 w-4" aria-hidden />{text(option.labels, option.code)}</span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
