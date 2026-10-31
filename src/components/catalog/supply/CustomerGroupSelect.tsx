'use client';

/**
 * @fileoverview **Η ομάδα πελάτη μιας σύνδεσης** (ADR-923 §5.12 Σ2 προέγκριση): προαιρετική. Κανένας προμηθευτής δεν
 *   υποχρεώνεται να κατατάξει αμέσως· χωρίς ομάδα, ο πελάτης βλέπει ό,τι καλύπτει όποιον συνδεδεμένο.
 * @module components/catalog/supply/CustomerGroupSelect
 */

import React from 'react';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CustomerGroupWire } from '@/subapps/catalog/types/pricing-views';
import { useCatalogText } from '../shared/catalog-ui-hooks';

/** Το Radix δεσμεύει το `''` (CHECK 3.48): «καμία» είναι δική μας τιμή. */
const NO_GROUP = 'none';

interface CustomerGroupSelectProps {
  readonly groups: readonly CustomerGroupWire[];
  readonly value: string | null;
  readonly onChange: (next: string | null) => void;
  readonly disabled: boolean;
}

export function CustomerGroupSelect({ groups, value, onChange, disabled }: CustomerGroupSelectProps) {
  const { t, text } = useCatalogText();
  return (
    <section className="flex flex-col gap-1">
      <Label htmlFor="supply-customer-group">{t('supply.customers.group')}</Label>
      <Select value={value ?? NO_GROUP} onValueChange={(next) => onChange(next === NO_GROUP ? null : next)} disabled={disabled}>
        <SelectTrigger id="supply-customer-group"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_GROUP}>{t('supply.customers.noGroup')}</SelectItem>
          {groups.map((group) => <SelectItem key={group.id} value={group.id}>{text(group.labels) || group.code}</SelectItem>)}
        </SelectContent>
      </Select>
      <p className="m-0 text-xs text-muted-foreground">{t('supply.customers.groupHint')}</p>
    </section>
  );
}
