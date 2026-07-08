'use client';

import React from 'react';

// ============================================================================
// 🏢 ENTERPRISE IMPORTS - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ SYSTEMS
// ============================================================================

import {
  CommunicationRowShell,
  CommunicationSelectCell,
  CommunicationInputCell,
  type CommunicationRendererProps
} from './shared/communication-row-primitives';

// ============================================================================
// 🏢 SOCIAL RENDERER - ENTERPRISE RENDERER COMPONENT
// ============================================================================

/**
 * 📱 ENTERPRISE SOCIAL RENDERER
 *
 * Specialized renderer για social media communication items.
 * Note: Social media δεν έχει Primary (config.supportsPrimary === false).
 * Frame + Type/Label/Actions = SSoT shell (ADR-593)· εδώ platform/username/url.
 */
export const SocialRenderer: React.FC<CommunicationRendererProps> = (props) => {
  const { item, index, config, disabled, updateItem } = props;

  return (
    <CommunicationRowShell {...props} columns={6}>
      {/* Πλατφόρμα */}
      <CommunicationSelectCell
        value={item.platform || item.type || config.defaultType}
        options={config.platformTypes || config.types}
        disabled={disabled}
        onValueChange={(value) => updateItem(index, 'platform', value)}
      />

      {/* Username */}
      <CommunicationInputCell
        value={item.username || ''}
        placeholder="john-doe"
        disabled={disabled}
        onValueChange={(value) => updateItem(index, 'username', value)}
      />

      {/* Auto-generated URL */}
      <CommunicationInputCell
        value={item.url || ''}
        placeholder="https://..."
        className="text-sm"
        disabled={disabled}
        onValueChange={(value) => updateItem(index, 'url', value)}
      />
    </CommunicationRowShell>
  );
};
