'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';

// ============================================================================
// 🏢 ENTERPRISE IMPORTS - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ SYSTEMS
// ============================================================================

import {
  CommunicationRowShell,
  CommunicationInputCell,
  type PrimaryCommunicationRendererProps
} from './shared/communication-row-primitives';

// ============================================================================
// 🏢 PHONE RENDERER - ENTERPRISE RENDERER COMPONENT
// ============================================================================

/**
 * 📞 ENTERPRISE PHONE RENDERER
 *
 * Specialized renderer για phone communication items.
 * Frame + Type/Label/Actions = SSoT shell (ADR-593)· εδώ τα
 * countryCode / number / extension cells.
 */
export const PhoneRenderer: React.FC<PrimaryCommunicationRendererProps> = (props) => {
  const { item, index, disabled, updateItem } = props;
  const { t } = useTranslation(['contacts', 'contacts-banking', 'contacts-core', 'contacts-form', 'contacts-lifecycle', 'contacts-relationships']);

  return (
    <CommunicationRowShell {...props} columns={6}>
      {/* Κωδικός Χώρας */}
      <CommunicationInputCell
        value={item.countryCode || '+30'}
        placeholder="+30"
        disabled={disabled}
        onValueChange={(value) => updateItem(index, 'countryCode', value)}
      />

      {/* Αριθμός Τηλεφώνου */}
      <CommunicationInputCell
        inputType="tel"
        value={item.number || ''}
        placeholder="2310 123456"
        disabled={disabled}
        onValueChange={(value) => updateItem(index, 'number', value)}
      />

      {/* Εσωτερικό (extension / PBX internal) */}
      <CommunicationInputCell
        value={(item.extension as string | undefined) || ''}
        placeholder={t('communication.placeholders.phoneExtension')}
        disabled={disabled}
        onValueChange={(value) => updateItem(index, 'extension', value)}
      />
    </CommunicationRowShell>
  );
};
