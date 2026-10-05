'use client';

/**
 * EntityLinkSelectOptions — οι επιλογές του `EntityLinkCard` μέσα στο Radix Select (ADR-001).
 *
 * Όταν οι επιλογές φέρουν `group`, αποδίδονται σε ομάδες με ετικέτα (`SelectGroup` + `SelectLabel` ⇒ `role="group"`
 * με προσβάσιμο όνομα)· αλλιώς επίπεδη λίστα, όπως πάντα. Υπάρχει επειδή ομώνυμοι γονείς διαφορετικών πλαισίων
 * («Κτήριο Α» σε έξι έργα) δεν ξεχωρίζουν με το όνομά τους μόνο (ADR-898 §21.6 Ε6).
 *
 * @module components/shared/EntityLinkSelectOptions
 */

import { SelectGroup, SelectItem, SelectLabel } from '@/components/ui/select';
import type { EntityLinkOption } from '@/components/shared/EntityLinkCard';

/** Ομάδες με τη σειρά πρώτης εμφάνισης· `null` όταν καμία επιλογή δεν έχει ομάδα. */
export function groupEntityLinkOptions(
  options: readonly EntityLinkOption[],
): Array<readonly [string, EntityLinkOption[]]> | null {
  if (!options.some((option) => option.group)) return null;
  const groups = new Map<string, EntityLinkOption[]>();
  for (const option of options) {
    const label = option.group ?? '';
    const members = groups.get(label);
    if (members) members.push(option);
    else groups.set(label, [option]);
  }
  return [...groups.entries()];
}

function optionItem(option: EntityLinkOption) {
  return (
    <SelectItem key={option.id} value={option.id}>
      {option.name}
    </SelectItem>
  );
}

export function EntityLinkSelectOptions({ options }: { options: readonly EntityLinkOption[] }) {
  const groups = groupEntityLinkOptions(options);
  if (groups === null) return <>{options.map(optionItem)}</>;
  return (
    <>
      {groups.map(([label, members]) => (
        <SelectGroup key={label}>
          {label !== '' && <SelectLabel>{label}</SelectLabel>}
          {members.map(optionItem)}
        </SelectGroup>
      ))}
    </>
  );
}
