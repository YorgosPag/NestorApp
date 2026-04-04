'use client';

/**
 * =============================================================================
 * ENTERPRISE: AddFloorDialog Component
 * =============================================================================
 *
 * Dialog for creating a new floor under a building.
 *
 * @module components/building-management/dialogs/AddFloorDialog
 * @enterprise ADR-284 (Unit Creation Hierarchy Enforcement, Batch 0)
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FormField, FormGrid, FormInput } from '@/components/ui/form/FormComponents';
import { SaveButton, CancelButton } from '@/components/ui/form/ActionButtons';
import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DIALOG_SIZES } from '@/styles/design-tokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { toast } from 'sonner';
import { ApiClientError } from '@/lib/api/enterprise-api-client';
import { createFloorWithPolicy } from '@/services/floor-mutation-gateway';

// =============================================================================
// TYPES
// =============================================================================

export interface AddFloorDialogProps {
  buildingId: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: (floorId: string) => void;
}

interface AddFloorFormData {
  name: string;
  level: string;
}

interface AddFloorFormErrors {
  name?: string;
  level?: string;
}

interface FloorCreateApiResponse {
  success: boolean;
  floorId?: string;
  data?: { floorId: string };
  error?: string;
}

const INITIAL_FORM_DATA: AddFloorFormData = {
  name: '',
  level: '',
};

const LEVEL_MIN = -5;
const LEVEL_MAX = 100;

// =============================================================================
// COMPONENT
// =============================================================================

export function AddFloorDialog({ buildingId, open, onClose, onSuccess }: AddFloorDialogProps) {
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();

  const [formData, setFormData] = useState<AddFloorFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<AddFloorFormErrors>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setFormData(INITIAL_FORM_DATA);
      setErrors({});
      setLoading(false);
    }
  }, [open]);

  const validate = useCallback((): { valid: boolean; level: number } => {
    const newErrors: AddFloorFormErrors = {};
    const trimmedName = formData.name.trim();

    if (!trimmedName) {
      newErrors.name = t('dialog.addFloor.validation.nameRequired');
    }

    const parsedLevel = Number.parseInt(formData.level, 10);
    if (formData.level === '' || Number.isNaN(parsedLevel)) {
      newErrors.level = t('dialog.addFloor.validation.levelRequired');
    } else if (parsedLevel < LEVEL_MIN || parsedLevel > LEVEL_MAX) {
      newErrors.level = t('dialog.addFloor.validation.levelRange');
    }

    setErrors(newErrors);
    return {
      valid: Object.keys(newErrors).length === 0,
      level: parsedLevel,
    };
  }, [formData, t]);

  const handleNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setFormData((prev) => ({ ...prev, name: value }));
    if (errors.name) {
      setErrors((prev) => ({ ...prev, name: undefined }));
    }
  }, [errors.name]);

  const handleLevelChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setFormData((prev) => ({ ...prev, level: value }));
    if (errors.level) {
      setErrors((prev) => ({ ...prev, level: undefined }));
    }
  }, [errors.level]);

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();

    const { valid, level } = validate();
    if (!valid) {
      return;
    }

    setLoading(true);
    try {
      const result = await createFloorWithPolicy<FloorCreateApiResponse>({
        payload: {
          number: level,
          name: formData.name.trim(),
          buildingId,
        },
      });

      const createdId = result?.floorId ?? result?.data?.floorId;
      toast.success(t('dialog.addFloor.messages.success'));
      onSuccess?.(createdId ?? '');
      onClose();
    } catch (err) {
      if (ApiClientError.isApiClientError(err) && err.statusCode === 409) {
        toast.error(t('dialog.addFloor.messages.duplicate'));
      } else {
        const message = err instanceof Error ? err.message : '';
        toast.error(t('dialog.addFloor.messages.error') + (message ? `: ${message}` : ''));
      }
    } finally {
      setLoading(false);
    }
  }, [buildingId, formData.name, onClose, onSuccess, t, validate]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      onClose();
    }
  }, [onClose]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={cn(DIALOG_SIZES.md)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className={iconSizes.md} />
            {t('dialog.addFloor.title')}
          </DialogTitle>
          <DialogDescription>
            {t('dialog.addFloor.description')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <FormGrid>
            <FormField label={t('dialog.addFloor.fields.name')} htmlFor="floorName" required>
              <FormInput>
                <Input
                  id="floorName"
                  name="floorName"
                  value={formData.name}
                  onChange={handleNameChange}
                  placeholder={t('dialog.addFloor.fields.namePlaceholder')}
                  disabled={loading}
                  className={errors.name ? 'border-destructive' : ''}
                  autoFocus
                />
                {errors.name ? <p className="mt-1 text-xs text-destructive">{errors.name}</p> : null}
              </FormInput>
            </FormField>

            <FormField label={t('dialog.addFloor.fields.level')} htmlFor="floorLevel" required>
              <FormInput>
                <Input
                  id="floorLevel"
                  name="floorLevel"
                  type="number"
                  step={1}
                  min={LEVEL_MIN}
                  max={LEVEL_MAX}
                  value={formData.level}
                  onChange={handleLevelChange}
                  placeholder={t('dialog.addFloor.fields.levelPlaceholder')}
                  disabled={loading}
                  className={errors.level ? 'border-destructive' : ''}
                />
                {errors.level ? <p className="mt-1 text-xs text-destructive">{errors.level}</p> : null}
              </FormInput>
            </FormField>
          </FormGrid>

          <DialogFooter className="mt-4">
            <CancelButton onClick={onClose} disabled={loading} />
            <SaveButton loading={loading} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AddFloorDialog;
