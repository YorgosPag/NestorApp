'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { AddressWithHierarchy } from '@/components/shared/addresses/AddressWithHierarchy';
import type { AddressWithHierarchyValue } from '@/components/shared/addresses/AddressWithHierarchy';
import { AddressEditor } from '@/components/shared/addresses/editor';
import { fromHierarchyValue, EMPTY_HIERARCHY } from '@/components/projects/tabs/locations/location-converters';

interface FrontageAddressCreateDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  project: Project;
  frontageIndex: number;
  onCreated(addressId: string): void;
}

export function FrontageAddressCreateDialog({
  open,
  onOpenChange,
  project,
  frontageIndex,
  onCreated,
}: FrontageAddressCreateDialogProps) {
  const { t } = useTranslation('buildingCode');
  const [hierarchy, setHierarchy] = useState<Partial<AddressWithHierarchyValue>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = Boolean(
    (hierarchy as Partial<AddressWithHierarchyValue>).settlementName?.trim() ||
    (hierarchy as Partial<AddressWithHierarchyValue>).municipalityName?.trim(),
  );

  const handleClose = () => {
    setHierarchy({});
    setError(null);
    onOpenChange(false);
  };

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    setError(null);
    try {
      const addressFields = fromHierarchyValue({ ...EMPTY_HIERARCHY, ...hierarchy });
      if (!addressFields.city) {
        setError(t('frontages.cityRequired'));
        return;
      }

      const newAddress = createProjectAddress({
        street: addressFields.street?.trim() ?? '',
        number: addressFields.number?.trim() || undefined,
        city: addressFields.city.trim(),
        postalCode: addressFields.postalCode?.trim() ?? '',
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('frontages.createDialogTitle', { index: frontageIndex })}
          </DialogTitle>
        </DialogHeader>

        <div className="py-2">
          {/* AddressEditor: activity log, field badges, reconciliation, undo */}
          <AddressEditor
            value={{
              street: hierarchy.street,
              number: hierarchy.number,
              postalCode: hierarchy.postalCode,
              city: hierarchy.settlementName || hierarchy.municipalityName,
            }}
            onChange={(resolved) => {
              setHierarchy((prev) => ({
                ...prev,
                street: resolved.street ?? prev.street ?? '',
                number: resolved.number ?? prev.number ?? '',
                postalCode: resolved.postalCode ?? prev.postalCode ?? '',
                settlementName: resolved.city ?? prev.settlementName ?? '',
              }));
            }}
            mode="edit"
            domain="project"
            formOptions={{ hideGrid: true }}
            activityLog={{ collapsed: true }}
          >
            <AddressWithHierarchy
              value={hierarchy}
              onChange={setHierarchy}
            />
          </AddressEditor>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

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
