'use client';

/**
 * ============================================================================
 * PERSONA SELECTOR — Chip Badge Toggle Component
 * ============================================================================
 *
 * SAP Business Partner pattern: Toggle personas on/off via chip badges.
 * Each active persona adds a conditional tab with role-specific fields.
 *
 * - Edit mode: all personas clickable (toggle on/off)
 * - View mode: active personas show X button for removal, inactive are disabled
 *
 * @see ADR-121 Contact Persona System
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/design-system';
import { X } from 'lucide-react';
import type { PersonaType } from '@/types/contacts/personas';
import { PERSONA_METADATA } from '@/config/persona-config';
import {
  HardHat, Ruler, Calculator, Scale, Home,
  UserCheck, Package, FileSignature, Key,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// ============================================================================
// ICON MAPPING
// ============================================================================

const PERSONA_ICON_MAP: Record<string, LucideIcon> = {
  'hard-hat': HardHat,
  'ruler': Ruler,
  'calculator': Calculator,
  'scale': Scale,
  'home': Home,
  'user-check': UserCheck,
  'package': Package,
  'file-signature': FileSignature,
  'key': Key,
};

// ============================================================================
// COMPONENT
// ============================================================================

interface PersonaSelectorProps {
  activePersonas: PersonaType[];
  onToggle: (personaType: PersonaType) => void;
  disabled?: boolean;
  className?: string;
}

export function PersonaSelector({
  activePersonas,
  onToggle,
  disabled = false,
  className,
}: PersonaSelectorProps) {
  const { t } = useTranslation(['contacts', 'contacts-banking', 'contacts-core', 'contacts-form', 'contacts-lifecycle', 'contacts-relationships']);
  const colors = useSemanticColors();

  const handleToggle = useCallback(
    (personaType: PersonaType) => {
      onToggle(personaType);
    },
    [onToggle]
  );

  return (
    <section
      aria-labelledby="persona-selector-heading"
      className={cn('w-full', className)}
    >
      <header className="mb-3">
        <p className={cn("text-sm", colors.text.muted)}>
          {t('persona.selector.description')}
        </p>
      </header>

      <fieldset>
        <legend className="sr-only">
          {t('persona.selector.legend')}
        </legend>

        <div role="group" className="flex flex-wrap gap-2">
          {PERSONA_METADATA.map((persona) => {
            const isActive = activePersonas.includes(persona.type);
            const IconComponent = PERSONA_ICON_MAP[persona.icon];

            // In view mode: inactive personas are disabled, active can be removed
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
                {IconComponent && (
                  <IconComponent
                    className={cn(
                      'h-3.5 w-3.5',
                      isActive ? 'text-primary-foreground' : colors.text.muted
                    )}
                  />
                )}
                <span>{t(persona.label)}</span>
                {isActive && (
                  <X
                    className="h-3.5 w-3.5 ml-0.5 text-primary-foreground/80 hover:text-destructive-foreground transition-colors"
                    aria-label={t('persona.selector.remove')}
                  />
                )}
              </button>
            );
          })}
        </div>

        {activePersonas.length === 0 && (
          <p className={cn("mt-2 text-xs italic", colors.text.muted)}>
            {t('persona.selector.empty')}
          </p>
        )}
      </fieldset>
    </section>
  );
}
