'use client';

/**
 * @fileoverview **SSoT: ο επιλογέας κωδικού ΑΤΟΕ μιας γραμμής — «προτεινόμενοι πρώτα».**
 * @module subapps/procurement/components/AtoeCategoryCodeSelect
 * @related ADR-598 §3 procurement · ADR-584 (CHECK 3.28) · `lib/a11y/accessible-name`
 *
 * Ήταν γραμμένος **δύο** φορές (γραμμή προσφοράς `QuoteForm` · γραμμή RFQ `RfqBuilder`),
 * με την ίδια λογική τομέα: οι κωδικοί της ειδικότητας **πάνω**, διαχωριστικό, οι υπόλοιποι
 * του καταλόγου ΑΤΟΕ **κάτω** — και μια επιλογή «κανένας κωδικός». Το CHECK 3.28 έπιασε
 * τρία δίδυμα σε αυτό το σημείο. Η μία εκδοχή είχε όνομα (`aria-label`), η άλλη **όχι**:
 * εδώ το όνομα το **απαιτεί ο τύπος** (`FieldAccessibleName`), όπως στα combobox.
 *
 * Δέχεται **κείμενο, όχι κλειδιά** (δόγμα `hinted-field`): κάθε `t()` μένει στον γονέα
 * με κυριολεκτικό κλειδί — ορατό στη CHECK 3.8.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ATOE_MASTER_CATEGORIES } from '@/config/boq-categories';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';
import type { FieldAccessibleName } from '@/lib/a11y/accessible-name';
import { cn } from '@/lib/utils';

export interface AtoeCodePartition {
  readonly suggested: readonly string[];
  readonly remaining: readonly string[];
}

/** Οι προτεινόμενοι όπως δόθηκαν· οι υπόλοιποι = ο κατάλογος ΑΤΟΕ χωρίς αυτούς, με τη σειρά του. */
export function partitionAtoeCodes(suggested: readonly string[]): AtoeCodePartition {
  const taken = new Set(suggested);
  return {
    suggested,
    remaining: ATOE_MASTER_CATEGORIES.map((c) => c.code).filter((code) => !taken.has(code)),
  };
}

export type AtoeCategoryCodeSelectProps = FieldAccessibleName & {
  readonly value: string | null | undefined;
  /** `null` = «κανένας κωδικός». */
  readonly onChange: (code: string | null) => void;
  readonly suggestedCodes: readonly string[];
  readonly placeholder: string;
  readonly noneLabel: string;
  readonly className?: string;
};

export function AtoeCategoryCodeSelect({
  value,
  onChange,
  suggestedCodes,
  placeholder,
  noneLabel,
  className,
  ...name
}: AtoeCategoryCodeSelectProps) {
  const { suggested, remaining } = partitionAtoeCodes(suggestedCodes);

  return (
    <Select
      value={value ?? SELECT_CLEAR_VALUE}
      onValueChange={(v) => onChange(v === SELECT_CLEAR_VALUE ? null : v)}
    >
      <SelectTrigger {...name} className={cn('h-8 text-sm', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={SELECT_CLEAR_VALUE}>{noneLabel}</SelectItem>
        {suggested.map((code) => (
          <SelectItem key={code} value={code}>{code}</SelectItem>
        ))}
        {suggested.length > 0 && remaining.length > 0 && <SelectSeparator />}
        {remaining.map((code) => (
          <SelectItem key={code} value={code}>{code}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
