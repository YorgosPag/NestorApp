'use client';

/**
 * Professional Chip Selector — Toggle professional personas (ADR-282)
 *
 * Renders chip buttons for professional personas:
 * construction_worker, engineer, accountant, lawyer, notary
 *
 * Each activates conditional field sections in the Professional tab.
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/design-system';
import { X, HardHat, Ruler, Calculator, Scale, FileSignature } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PersonaType } from '@/types/contacts/personas';
import { getProfessionalPersonaMetadata } from '@/config/persona-config';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

const PROFESSIONAL_ICON_MAP: Record<string, LucideIcon> = {
  'hard-hat': HardHat,
  'ruler': Ruler,
  'calculator': Calculator,
  'scale': Scale,
  'file-signature': FileSignature,
};

interface ProfessionalChipSelectorProps {
  activeProfessionals: PersonaType[];
  onToggle: (personaType: PersonaType) => void;
  disabled?: boolean;
}

export function ProfessionalChipSelector({ activeProfessionals, onToggle, disabled = false }: ProfessionalChipSelectorProps) {
  const { t } = useTranslation('contacts');
  const colors = useSemanticColors();
  const metadata = getProfessionalPersonaMetadata();

  const handleToggle = useCallback(
    (personaType: PersonaType) => onToggle(personaType),
    [onToggle]
  );

  return (
    <fieldset>
      <legend className={cn('text-xs font-semibold uppercase tracking-wider mb-2', colors.text.muted)}>
        {t('persona.categories.specialties', { defaultValue: 'Ειδικότητες' })}
      </legend>
      <div role="group" className="flex flex-wrap gap-2">
        {metadata.map((persona) => {
          const isActive = activeProfessionals.includes(persona.type);
          const IconComponent = PROFESSIONAL_ICON_MAP[persona.icon];
          const isButtonDisabled = disabled && !isActive;

          return (
            <button
              key={persona.type}
              type="button"
              role="switch"
              aria-checked={isActive}
              disabled={isButtonDisabled}
              onClick={() => handleToggle(persona.type)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5',
                'text-sm font-medium transition-all duration-200',
                'border-2 focus-visible:outline-none focus-visible:ring-2',
                'focus-visible:ring-ring focus-visible:ring-offset-2',
                isActive
                  ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                  : cn('border-border bg-background hover:bg-accent hover:text-accent-foreground', colors.text.muted),
                isButtonDisabled && 'cursor-not-allowed opacity-50'
              )}
            >
              {IconComponent && <IconComponent className={cn('h-3.5 w-3.5', isActive ? 'text-primary-foreground' : colors.text.muted)} />}
              <span>{t(persona.label)}</span>
              {isActive && <X className="h-3.5 w-3.5 ml-0.5 text-primary-foreground/80" />}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
