'use client';

import React from 'react';

// ============================================================================
// 🏢 ENTERPRISE IMPORTS - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ SYSTEMS
// ============================================================================

import {
  CommunicationRowShell,
  CommunicationInputCell,
  type CommunicationRendererProps
} from './shared/communication-row-primitives';

// ============================================================================
// 🏢 WEBSITE RENDERER - ENTERPRISE RENDERER COMPONENT
// ============================================================================

/**
 * 🌐 ENTERPRISE WEBSITE RENDERER
 *
 * Specialized renderer για website communication items.
 * Note: Websites δεν έχουν Primary (config.supportsPrimary === false).
 * Frame + Type/Label/Actions = SSoT shell (ADR-593)· εδώ μόνο το url cell.
 */
export const WebsiteRenderer: React.FC<CommunicationRendererProps> = (props) => (
  <CommunicationRowShell {...props} columns={4}>
    <CommunicationInputCell
      inputType="url"
      value={props.item.url || ''}
      placeholder="https://example.com"
      disabled={props.disabled}
      onValueChange={(value) => props.updateItem(props.index, 'url', value)}
    />
  </CommunicationRowShell>
);
