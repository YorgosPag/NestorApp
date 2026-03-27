'use client';

import React, { useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CONTACT_ICONS, ALL_CONTACT_TYPES, CONTACT_COLORS, type ContactType } from '@/constants/contacts';
import { useIconSizes } from '@/hooks/useIconSizes';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

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
  const iconSizes = useIconSizes();

  const handleKeyDown = useCallback(
    (type: ContactType) => (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(type);
      }
    },
    [onSelect]
  );

  return (
    <section className="flex flex-col items-center justify-center h-full px-2 py-2 gap-2">
      <header className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-foreground">
          {t('creation.selectType.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('creation.selectType.description')}
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full max-w-xl">
        {ALL_CONTACT_TYPES.map((type) => {
          const Icon = CONTACT_ICONS[type];
          const colors = CONTACT_COLORS[type];

          return (
            <Card
              key={type}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(type)}
              onKeyDown={handleKeyDown(type)}
              className={`cursor-pointer border-2 border-transparent ${INTERACTIVE_PATTERNS.BUTTON_SUBTLE} ${TRANSITION_PRESETS.STANDARD_COLORS} hover:${colors.border} hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40`}
            >
              <CardContent className="flex flex-col items-center gap-2 p-2 text-center">
                <span className={`${colors.primary} ${colors.bg} p-2 rounded-full`}>
                  <Icon className={iconSizes.lg} />
                </span>
                <h3 className="font-medium text-foreground">
                  {t(`types.${type}`)}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t(TYPE_DESCRIPTION_KEYS[type])}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Button variant="ghost" onClick={onCancel} className="mt-2">
        {t('creation.selectType.cancel')}
      </Button>
    </section>
  );
}
