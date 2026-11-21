// ============================================================================
// RELATIONSHIP FORM — ORIENTATION + VALIDATION MESSAGES (ADR-372 §Β2)
// ============================================================================
//
// Pure helpers for `useRelationshipForm` (extracted to keep the hook < 500 lines).
// The form's role combobox holds an ENCODED oriented role; this module turns it
// into the stored (canonical) direction, and turns typed validation errors into
// translated messages whose ICU params are themselves i18n keys.
// ============================================================================

import { RelationshipValidationError } from '@/services/contact-relationships/core/RelationshipValidationService';
import {
  decodeOrientedRole,
  isRelationshipType,
  orientRelationship,
} from '@/types/contacts/relationships/core/relationship-orientation';
import { relationshipChannelOwnerSide } from '@/services/contact-relationships/core/relationship-field-codec';
import { contactOwnerKindOf, type ContactOwnerKind } from '@/lib/contact/contact-owner-kind';

/** A translatable validation outcome: i18n key + ICU params that are themselves i18n keys. */
export interface ValidationMessage {
  key: string;
  labelParams?: Readonly<Record<string, string>>;
}

export function describeValidationError(error: unknown, fallbackKey: string): ValidationMessage {
  if (error instanceof RelationshipValidationError) {
    return { key: error.message, labelParams: error.labelParams };
  }
  if (error instanceof Error) return { key: error.message };
  return { key: fallbackKey };
}

export function translateValidationMessage(
  message: ValidationMessage,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  const params: Record<string, string> = {};
  for (const [name, labelKey] of Object.entries(message.labelParams ?? {})) {
    params[name] = t(labelKey);
  }
  return t(message.key, { ...params, defaultValue: '' }) || message.key;
}

/**
 * ADR-372 §Β2: the combobox value is an ENCODED oriented role. Static roles are
 * oriented by the crossing matrix; custom (registry) types keep current → picked.
 */
export function orientFormRole(
  encodedRole: string,
  currentContactId: string,
  pickedContactId: string
): { sourceContactId: string; targetContactId: string; relationshipType: string } {
  const decoded = decodeOrientedRole(encodedRole);
  if (!isRelationshipType(decoded.type)) {
    return { sourceContactId: currentContactId, targetContactId: pickedContactId, relationshipType: encodedRole };
  }
  const endpoints = orientRelationship(
    { type: decoded.type, pickedSide: decoded.pickedSide },
    currentContactId,
    pickedContactId
  );
  return { ...endpoints, relationshipType: decoded.type };
}

const CURRENT_SIDE = 'current';
const PICKED_SIDE = 'picked';

/** Which contact of the form holds the relationship's channels. */
export interface FormChannelOwner {
  side: 'current' | 'picked';
  kind: ContactOwnerKind;
}

/**
 * ADR-372 §8.5 b1: whose channels these are, from what the form knows — the encoded role
 * (→ which side becomes the stored source) and both contact types. Unknown picked type
 * (still loading) ⇒ the current contact; no role yet ⇒ the current contact is taken as the
 * source. The rule itself is the codec's `relationshipChannelOwnerSide` (one place).
 */
export function formChannelOwner(
  encodedRole: string,
  currentContactType: unknown,
  pickedContactType: unknown
): FormChannelOwner {
  if (pickedContactType === undefined) {
    return { side: 'current', kind: contactOwnerKindOf(currentContactType) };
  }
  const currentIsSource = !encodedRole
    || orientFormRole(encodedRole, CURRENT_SIDE, PICKED_SIDE).sourceContactId === CURRENT_SIDE;
  const [sourceType, targetType] = currentIsSource
    ? [currentContactType, pickedContactType]
    : [pickedContactType, currentContactType];
  const ownerIsSource = relationshipChannelOwnerSide(sourceType, targetType) === 'source';
  const side = ownerIsSource === currentIsSource ? 'current' : 'picked';
  return { side, kind: contactOwnerKindOf(side === 'current' ? currentContactType : pickedContactType) };
}
