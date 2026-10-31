'use client';

import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ChoiceCards, type ChoiceCardOption } from '@/components/ui/choice-cards';
import { CONTACT_ICONS, ALL_CONTACT_TYPES, CONTACT_COLORS, type ContactType } from '@/constants/contacts';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

interface ContactTypeSelectorProps {
  onSelect: (type: ContactType) => void;
  onCancel: () => void;
}

const TYPE_DESCRIPTION_KEYS: Record<ContactType, string> = {
  individual: 'creation.typeDescription.individual',
  company: 'creation.typeDescription.company',
  service: 'creation.typeDescription.service',
};

export function ContactTypeSelector({ onSelect, onCancel }: ContactTypeSelectorProps) {
  const { t } = useTranslation('contacts');
  const colors = useSemanticColors();

  // Οι κάρτες αποδίδονται από το κοινό `ChoiceCards` (ADR-914)· εδώ μένει μόνο ό,τι ξέρει ο τομέας.
  const options = useMemo<ChoiceCardOption<ContactType>[]>(
    () => ALL_CONTACT_TYPES.map((type) => {
      const typeColors = CONTACT_COLORS[type];
      return {
        id: type,
        icon: CONTACT_ICONS[type],
        title: t(`types.${type}`),
        description: t(TYPE_DESCRIPTION_KEYS[type]),
        tone: {
          icon: typeColors.primary,
          iconBackground: typeColors.bg,
          hoverBorder: `hover:${typeColors.border}`,
        },
      };
    }),
    [t],
  );

  return (
    <section className="flex flex-col items-center justify-center h-full px-2 py-2 gap-2">
      <header className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-foreground">
          {t('creation.selectType.title')}
        </h2>
        <p className={cn("text-sm", colors.text.muted)}>
          {t('creation.selectType.description')}
        </p>
      </header>

      <ChoiceCards
        options={options}
        onSelect={onSelect}
        className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full max-w-xl"
        ariaLabel={t('creation.selectType.title')}
      />

      <Button variant="ghost" onClick={onCancel} className="mt-2">
        {t('creation.selectType.cancel')}
      </Button>
    </section>
  );
}
