'use client';

import React from 'react';

// ============================================================================
// 🏢 ENTERPRISE IMPORTS - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ SYSTEMS
// ============================================================================

import {
  CommunicationRowShell,
  CommunicationInputCell,
  type PrimaryCommunicationRendererProps
} from './shared/communication-row-primitives';

// ============================================================================
// 🏢 EMAIL RENDERER - ENTERPRISE RENDERER COMPONENT
// ============================================================================

/**
 * 📧 ENTERPRISE EMAIL RENDERER
 *
 * Specialized renderer για email communication items.
 * Frame + Type/Label/Actions = SSoT shell (ADR-593)· εδώ μόνο το email cell.
 */
export const EmailRenderer: React.FC<PrimaryCommunicationRendererProps> = (props) => (
  <CommunicationRowShell {...props} columns={4}>
    <CommunicationInputCell
      inputType="email"
      value={props.item.email || ''}
      placeholder="john@example.com"
      disabled={props.disabled}
      onValueChange={(value) => props.updateItem(props.index, 'email', value)}
    />
  </CommunicationRowShell>
);
