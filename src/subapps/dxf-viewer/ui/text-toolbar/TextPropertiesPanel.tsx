'use client';

/**
 * ADR-344 Phase 5.F — Text Properties tab content.
 *
 * Shown when a text entity is selected but NOT in active edit mode.
 * All formatting, scale and layer controls live in the Ribbon contextual
 * tab "Επεξεργαστής Κειμένου" (SSoT — ADR-345 Fase 6).
 * This panel retains only special-character token insertion.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { InsertPanel } from './panels';
import { useCanEditText } from '../../hooks/useCanEditText';

interface TextPropertiesPanelProps {
  readonly onInsertToken: (token: string) => void;
}

export function TextPropertiesPanel({ onInsertToken }: TextPropertiesPanelProps) {
  const { t } = useTranslation(['textToolbar']);
  const caps = useCanEditText();
  const disabled = !caps.canEdit;

  return (
    <section
      aria-label={t('textToolbar:properties.label')}
      className="flex flex-col gap-3 p-2"
    >
      <header>
        <h3 className="text-sm font-medium">{t('textToolbar:properties.title')}</h3>
      </header>

      <InsertPanel onInsert={onInsertToken} disabled={disabled} />
    </section>
  );
}
