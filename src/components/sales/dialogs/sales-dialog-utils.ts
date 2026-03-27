'use client';

/**
 * @fileoverview Shared utilities for sales action dialogs
 * @description Shared types, error translation, and helpers used by all sales dialogs
 * @see ADR-197
 */

import type { Unit } from '@/types/unit';

// =============================================================================
// TYPES
// =============================================================================

export interface BaseDialogProps {
  unit: Unit;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// =============================================================================
// HELPERS
// =============================================================================

/** Resolve projectId — Unit.project is the canonical field */
export function resolveProjectId(unit: Unit): string {
  return unit.project;
}

// =============================================================================
// SERVER ERROR → i18n TRANSLATION MAP
// =============================================================================

/** Maps known server error messages to i18n keys for localized display */
export function translateServerError(
  serverMsg: string,
  t: (key: string, opts?: Record<string, string>) => string,
): string {
  /* eslint-disable custom/no-hardcoded-strings -- Server error keys mapped to i18n, not user-facing */
  const errorMap: Record<string, string> = {
    'Unit is not linked to a building': 'sales.errors.noBuilding',
    'Unit is not linked to a floor': 'sales.errors.noFloor',
    'Building is not linked to a project': 'sales.errors.noProject',
    'Project is not linked to a company': 'sales.errors.noCompany',
    'Unit must be assigned to a building and floor before reservation or sale': 'sales.errors.noFloor',
    'Unit must belong to a project with a company before reservation or sale': 'sales.errors.noCompany',
    'Unit must have an asking price before reservation or sale': 'sales.errors.noAskingPrice',
    'Unit must have area (sqm) before reservation or sale': 'sales.errors.noArea',
    'Buyer contact is required': 'sales.errors.noBuyer',
    'Buyer contact not found': 'sales.errors.buyerNotFound',
    'Service contacts cannot be buyers': 'sales.errors.serviceNotBuyer',
  };
  /* eslint-enable custom/no-hardcoded-strings */

  // Check for exact match
  const i18nKey = errorMap[serverMsg];
  if (i18nKey) return t(i18nKey);

  // Check for partial match (e.g. "Buyer missing required fields: vatNumber")
  if (serverMsg.startsWith('Buyer missing required fields:')) {
    const fields = serverMsg.replace('Buyer missing required fields: ', '');
    return t('sales.errors.buyerMissingFields', { fields });
  }

  // Fallback — return original message
  return serverMsg;
}
