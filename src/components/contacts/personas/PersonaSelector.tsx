'use client';

/**
 * ============================================================================
 * 🎭 PERSONA SELECTOR — Chip Badge Toggle Component
 * ============================================================================
 *
 * SAP Business Partner pattern: Toggle personas on/off via chip badges.
 * Each active persona adds a conditional tab with role-specific fields.
 *
 * @see ADR-121 Contact Persona System
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { PersonaType } from '@/types/contacts/personas';
import { PERSONA_METADATA } from '@/config/persona-config';
import {
  HardHat, Ruler, Calculator, Scale, Home,
  UserCheck, Package, FileSignature, Key,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

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
  const { t } = useTranslation('contacts');

  const handleToggle = useCallback(
    (personaType: PersonaType) => {
      if (!disabled) {
        onToggle(personaType);
      }
    },
    [disabled, onToggle]
  );

  return (
    <section
      aria-labelledby="persona-selector-heading"
      className={cn('w-full', className)}
    >
      <header className="mb-3">
        <p className="text-sm text-muted-foreground">
          {t('persona.selector.description')}
        </p>
      </header>

      <fieldset disabled={disabled}>
        <legend className="sr-only">
          {t('persona.selector.legend')}
        </legend>

        <div role="group" className="flex flex-wrap gap-2">
          {PERSONA_METADATA.map((persona) => {
            const isActive = activePersonas.includes(persona.type);
            const IconComponent = PERSONA_ICON_MAP[persona.icon];

            return (
              <button
                key={persona.type}
                type="button"
                role="switch"
                aria-checked={isActive}
                onClick={() => handleToggle(persona.type)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5',
                  'text-sm font-medium transition-all duration-200',
                  'border focus-visible:outline-none focus-visible:ring-2',
                  'focus-visible:ring-ring focus-visible:ring-offset-2',
                  isActive
                    ? 'border-primary bg-primary/10 text-primary hover:bg-primary/20'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  disabled && 'cursor-not-allowed opacity-50'
                )}
              >
                {IconComponent && (
                  <IconComponent
                    className={cn(
                      'h-3.5 w-3.5',
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                )}
                <span>{t(persona.label)}</span>
              </button>
            );
          })}
        </div>

        {activePersonas.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground italic">
            {t('persona.selector.empty')}
          </p>
        )}
      </fieldset>
    </section>
  );
}
