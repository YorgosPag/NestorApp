'use client';

/**
 * Persona Conditional Sections — Collapsible field groups (ADR-282)
 *
 * Renders collapsible sections for each active persona's fields
 * INSIDE the Professional tab (instead of separate top-level tabs).
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/design-system';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { IndividualFormRenderer } from '@/components/generic/IndividualFormRenderer';
import type { PersonaType } from '@/types/contacts/personas';
import { getPersonaSections, getPersonaMetadata } from '@/config/persona-config';
import type { PersonaSectionConfig } from '@/config/persona-config';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { CustomFieldRenderer } from '@/components/generic/IndividualFormRenderer';
import {
  HardHat, Ruler, Calculator, Scale, Home,
  UserCheck, Package, FileSignature, Key,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

const SECTION_ICON_MAP: Record<string, LucideIcon> = {
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

interface PersonaConditionalSectionsProps {
  activePersonas: PersonaType[];
  formData: ContactFormData;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSelectChange: (name: string, value: string) => void;
  disabled: boolean;
  customRenderers?: Record<string, CustomFieldRenderer>;
}

export function PersonaConditionalSections({
  activePersonas,
  formData,
  onChange,
  onSelectChange,
  disabled,
  customRenderers,
}: PersonaConditionalSectionsProps) {
  const { t } = useTranslation('contacts');
  const colors = useSemanticColors();

  const sections = useMemo(
    () => getPersonaSections(activePersonas),
    [activePersonas]
  );

  if (sections.length === 0) return null;

  return (
    <div className="space-y-3 w-full">
      {sections.map((section) => (
        <CollapsiblePersonaSection
          key={section.id}
          section={section}
          formData={formData}
          onChange={onChange}
          onSelectChange={onSelectChange}
          disabled={disabled}
          customRenderers={customRenderers}
          t={t}
          colors={colors}
        />
      ))}
    </div>
  );
}

// ── Collapsible Section ────────────────────────────────────────────

interface CollapsibleSectionProps {
  section: PersonaSectionConfig;
  formData: ContactFormData;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSelectChange: (name: string, value: string) => void;
  disabled: boolean;
  customRenderers?: Record<string, CustomFieldRenderer>;
  t: (key: string, opts?: Record<string, unknown> | string) => string;
  colors: ReturnType<typeof useSemanticColors>;
}

function CollapsiblePersonaSection({
  section,
  formData,
  onChange,
  onSelectChange,
  disabled,
  customRenderers,
  t,
  colors,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const metadata = getPersonaMetadata(section.personaType);
  const IconComponent = metadata ? SECTION_ICON_MAP[metadata.icon] : null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-2 w-full py-2 px-3 rounded-md',
            'text-sm font-semibold transition-colors',
            'hover:bg-accent/50 border border-border/50',
            colors.text.default
          )}
        >
          {IconComponent && <IconComponent className={cn('h-4 w-4', colors.text.muted)} />}
          <span>{t(section.title)}</span>
          <ChevronDown
            className={cn(
              'h-4 w-4 ml-auto transition-transform',
              colors.text.muted,
              isOpen && 'rotate-180'
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3 pb-1 px-1">
        <IndividualFormRenderer
          sections={[section]}
          formData={formData as Record<string, unknown>}
          onChange={onChange}
          onSelectChange={onSelectChange}
          disabled={disabled}
          customRenderers={customRenderers}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}
