'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface CheckboxRowProps {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}

/**
 * Αποδίδει ακριβώς <div class="flex items-center space-x-2"> με Checkbox + Label.
 */
export function CheckboxRow({ id, checked, onCheckedChange, label }: CheckboxRowProps) {
  return (
    <div className="flex items-center space-x-2">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(!!v)}
      />
      <Label htmlFor={id} className="text-sm font-normal cursor-pointer">
        {label}
      </Label>
    </div>
  );
}
