'use client';
/**
 * @fileoverview **ΜΙΑ ΓΡΑΜΜΗ ΤΗΣ ΦΟΡΜΑΣ ΔΙΕΥΘΥΝΣΗΣ** — ετικέτα, πεδίο, σήμα κατάστασης.
 * @related AddressEditor · components/AddressFieldBadge
 *
 * Βγήκε από το `AddressEditor.tsx` όταν εκείνο πέρασε το όριο των 500 γραμμών (N.7.1,
 * 2026-09-02) — **κόψιμο σε σύνορο που ήδη υπήρχε**: η γραμμή δεν διαβάζει τίποτα από
 * την κατάσταση του συντονιστή, δέχεται **μόνο** τιμή και κατάσταση πεδίου.
 */
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AddressFieldBadge } from './AddressFieldBadge';
import { AddressFieldControlRow } from './AddressFieldControlRow';
import type { AddressFieldStatus, ResolvedAddressFields } from '../types';

interface FormFieldRowProps {
  field: keyof ResolvedAddressFields;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  status: AddressFieldStatus;
  disabled: boolean;
}

export function FormFieldRow({
  field,
  label,
  placeholder,
  value,
  onChange,
  status,
  disabled,
}: FormFieldRowProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={`addr-${field}`} className="text-xs font-medium">
        {label}
      </Label>
      {/*
        ADR-332 D27 Ζ7 — ο κανόνας «το σχόλιο δεν τρώει τον χώρο του δεδομένου» ζει στο
        `AddressFieldControlRow`, **όχι** εδώ. Ήταν γραμμένος ως ωμό `flex items-center`
        σε **πέντε** σημεία, και τα πέντε είχαν το ίδιο ελάττωμα.
      */}
      <AddressFieldControlRow field={field} badge={<AddressFieldBadge status={status} />}>
        <Input
          id={`addr-${field}`}
          data-address-field={field}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="h-8 text-sm"
        />
      </AddressFieldControlRow>
    </div>
  );
}
