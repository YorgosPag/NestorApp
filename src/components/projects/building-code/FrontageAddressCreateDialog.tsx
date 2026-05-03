'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Project } from '@/types/project';
import { createProjectAddress } from '@/types/project/address-helpers';
import { updateProjectWithPolicy } from '@/services/projects/project-mutation-gateway';

interface FrontageAddressCreateDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  project: Project;
  frontageIndex: number;
  onCreated(addressId: string): void;
}

interface FrontageFormData {
  street: string;
  number: string;
  city: string;
  postalCode: string;
}

const EMPTY_FORM: FrontageFormData = {
  street: '',
  number: '',
  city: '',
  postalCode: '',
};

export function FrontageAddressCreateDialog({
  open,
  onOpenChange,
  project,
  frontageIndex,
  onCreated,
}: FrontageAddressCreateDialogProps) {
  const { t } = useTranslation('buildingCode');
  const { t: tAddr } = useTranslation('addresses');
  const [form, setForm] = useState<FrontageFormData>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = form.city.trim().length > 0;

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setError(null);
    onOpenChange(false);
  };

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    setError(null);
    try {
      const newAddress = createProjectAddress({
        street: form.street.trim(),
        number: form.number.trim() || undefined,
        city: form.city.trim(),
        postalCode: form.postalCode.trim(),
        type: 'frontage',
        frontageIndex,
        isPrimary: false,
        sortOrder: (project.addresses?.length ?? 0) + 1,
      });

      const existing = project.addresses ?? [];
      const result = await updateProjectWithPolicy({
        projectId: project.id,
        updates: { addresses: [...existing, newAddress] },
      });

      if (!result.success) {
        setError(result.error ?? 'Save failed');
        return;
      }

      onCreated(newAddress.id);
      handleClose();
    } finally {
      setIsSaving(false);
    }
  };

  const set = (field: keyof FrontageFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('frontages.createDialogTitle', { index: frontageIndex })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="fa-street">{tAddr('form.street')}</Label>
              <Input
                id="fa-street"
                value={form.street}
                onChange={set('street')}
                placeholder={tAddr('form.streetPlaceholder')}
                disabled={isSaving}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fa-number">{tAddr('form.number')}</Label>
              <Input
                id="fa-number"
                value={form.number}
                onChange={set('number')}
                placeholder={tAddr('form.numberPlaceholder')}
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fa-city">
                {tAddr('form.city')} <span aria-hidden className="text-destructive">*</span>
              </Label>
              <Input
                id="fa-city"
                value={form.city}
                onChange={set('city')}
                placeholder={tAddr('form.cityPlaceholder')}
                disabled={isSaving}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fa-postal">{tAddr('form.postalCode')}</Label>
              <Input
                id="fa-postal"
                value={form.postalCode}
                onChange={set('postalCode')}
                placeholder={tAddr('form.postalCodePlaceholder')}
                disabled={isSaving}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={handleClose} disabled={isSaving}>
            {t('editMode.cancel')}
          </Button>
          <Button onClick={() => void handleSave()} disabled={!canSave || isSaving}>
            {isSaving ? t('editMode.saving') : t('editMode.save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
