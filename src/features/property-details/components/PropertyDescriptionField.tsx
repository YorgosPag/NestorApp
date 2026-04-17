'use client';

/**
 * =============================================================================
 * PropertyDescriptionField — description textarea + AI-generation trigger
 * =============================================================================
 *
 * Extracted from PropertyFieldsEditForm (ADR N.7.1 SRP — 500-line limit).
 * Owns the "Περιγραφή" label, the optional "Δημιουργία με AI" button, the
 * textarea, and the AI preview dialog. Persistence stays in the parent form
 * via the onChange callback — this component only updates local form state.
 *
 * @module features/property-details/components/PropertyDescriptionField
 * @see ADR-310 — AI Property Description Generator
 */

import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { TFunction } from 'i18next';
import { PropertyDescriptionAIDialog } from './PropertyDescriptionAIDialog';

interface PropertyDescriptionFieldProps {
  value: string;
  onChange: (next: string) => void;
  propertyId: string | undefined;
  isEditing: boolean;
  isHierarchyLocked: boolean;
  t: TFunction;
}

export function PropertyDescriptionField({
  value,
  onChange,
  propertyId,
  isEditing,
  isHierarchyLocked,
  t,
}: PropertyDescriptionFieldProps) {
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const canGenerateAI = isEditing && !isHierarchyLocked && Boolean(propertyId);

  return (
    <fieldset className="space-y-1">
      <header className="flex items-center justify-between gap-2">
        <Label className={cn('text-xs', colors.text.muted)}>
          {t('fields.identity.description')}
        </Label>
        {canGenerateAI && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-xs"
            onClick={() => setIsDialogOpen(true)}
            title={t('fields.identity.aiGenerateTooltip')}
            aria-label={t('fields.identity.aiGenerateTooltip')}
          >
            <Sparkles className={iconSizes.xs} />
            {t('fields.identity.aiGenerateButton')}
          </Button>
        )}
      </header>
      <Textarea
        id="unit-description"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-16 text-xs resize-none"
        placeholder={t('fields.identity.descriptionPlaceholder')}
        disabled={!isEditing || isHierarchyLocked}
      />
      {canGenerateAI && propertyId && (
        <PropertyDescriptionAIDialog
          isOpen={isDialogOpen}
          propertyId={propertyId}
          onAccept={(generated) => {
            onChange(generated);
            setIsDialogOpen(false);
          }}
          onClose={() => setIsDialogOpen(false)}
        />
      )}
    </fieldset>
  );
}
