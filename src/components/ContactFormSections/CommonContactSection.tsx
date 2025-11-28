'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormInput } from '@/components/ui/form/FormComponents';
import type { ContactFormData } from '@/types/ContactFormTypes';

interface CommonContactSectionProps {
  formData: ContactFormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  disabled?: boolean;
}

export function CommonContactSection({
  formData,
  handleChange,
  disabled = false
}: CommonContactSectionProps) {
  return (
    <>
      {/* Κοινά πεδία */}
      <FormField label="Email" htmlFor="email">
        <FormInput>
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            disabled={disabled}
          />
        </FormInput>
      </FormField>

      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="phone" className="text-right">Τηλέφωνο</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          value={formData.phone}
          onChange={handleChange}
          className="col-span-3"
          disabled={disabled}
        />
      </div>

      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="notes" className="text-right">Σημειώσεις</Label>
        <Textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          className="col-span-3"
          rows={2}
          disabled={disabled}
        />
      </div>
    </>
  );
}