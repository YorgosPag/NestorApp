// ============================================================================
// RELATIONSHIP ORIENTATION — RECIPROCAL-ROLE MODEL (ADR-372 §Β1/§Β2) · SSoT
// ============================================================================
//
// Industry practice: HubSpot "paired association labels", Dynamics 365
// "reciprocal connection roles", Salesforce FSC `ReciprocalRole.InverseRole`.
// A directed relationship has ONE role and TWO readings:
//   employee ⇄ «Εργοδότης», shareholder ⇄ «Εταιρεία συμμετοχής», vendor ⇄ «Πελάτης».
//
// Nestor goes one step further than FSC (which stores a SECOND record for the
// inverse and keeps it in sync with triggers): we store EXACTLY ONE record, in
// CANONICAL direction (`source` IS <role> OF `target`), and derive the inverse
// reading at display time from the viewer's side. No twin records ⇒ nothing to
// sync ⇒ nothing to drift.
//
// The card the user starts from is irrelevant: every writer (form, CRUD, AI)
// asks `orientRelationship()`, which derives direction from the crossing matrix
// in `relationship-metadata.ts`. Pure leaf module — no React, no I/O.
// ============================================================================

import type { ContactType } from '../../contracts';
import { RELATIONSHIP_TYPES, type RelationshipType } from './relationship-types';
import { CROSSING_CONTACT_TYPES, RELATIONSHIP_METADATA, isCrossingAllowed } from './relationship-metadata';

/** Which side of the stored record a contact occupies. */
export type RoleSide = 'source' | 'target';

/**
 * A role as offered to a user who adds a relationship FROM one contact's card:
 * «the picked contact is <label> of the current contact».
 * `pickedSide === 'source'` ⇒ the picked contact holds the role (label = `types.*`);
 * `pickedSide === 'target'` ⇒ the current contact holds it (label = `inverseTypes.*`).
 */
export interface OrientedRole {
  type: RelationshipType;
  pickedSide: RoleSide;
}

export function isRelationshipType(value: string): value is RelationshipType {
  return Object.prototype.hasOwnProperty.call(RELATIONSHIP_METADATA, value);
}

/** Unknown / custom types have no declared direction ⇒ treated as symmetric. */
export function isSymmetricRelationshipType(type: string): boolean {
  return isRelationshipType(type) ? RELATIONSHIP_METADATA[type].symmetric : true;
}

/** Is a STORED record (source → target) valid for its type? Symmetric types accept either order. */
export function isStoredCrossingValid(type: RelationshipType, source: ContactType, target: ContactType): boolean {
  if (isCrossingAllowed(type, source, target)) return true;
  return RELATIONSHIP_METADATA[type].symmetric && isCrossingAllowed(type, target, source);
}

/**
 * Roles offered when the user, on `currentType`'s card, links a `pickedType` contact.
 * Derived ONLY from the crossing matrix — no hand-written lists.
 */
export function getOrientedRolesForCrossing(
  currentType: ContactType,
  pickedType: ContactType,
  types: readonly RelationshipType[] = RELATIONSHIP_TYPES,
): OrientedRole[] {
  const roles: OrientedRole[] = [];
  for (const type of types) {
    if (RELATIONSHIP_METADATA[type].symmetric) {
      if (isStoredCrossingValid(type, currentType, pickedType)) roles.push({ type, pickedSide: 'source' });
      continue;
    }
    if (isCrossingAllowed(type, pickedType, currentType)) roles.push({ type, pickedSide: 'source' });
    if (isCrossingAllowed(type, currentType, pickedType)) roles.push({ type, pickedSide: 'target' });
  }
  return roles;
}

/**
 * Types a user can pick between two contacts: every type except property roles
 * (ADR-244 — owned by the property module). Read from the registry flag, not from
 * which types happen to have an icon.
 */
export const CONTACT_OFFERED_RELATIONSHIP_TYPES: readonly RelationshipType[] =
  RELATIONSHIP_TYPES.filter((type) => !RELATIONSHIP_METADATA[type].isProperty);

/**
 * ADR-372 §Β2: oriented roles offered on `currentType`'s card for a `pickedType`
 * contact — derived from the crossing matrix only. Without `pickedType`, every
 * role the current contact can take part in (deduplicated, first occurrence wins).
 */
export function getOfferedOrientedRoles(currentType: ContactType, pickedType?: ContactType): OrientedRole[] {
  const pickedTypes: readonly ContactType[] = pickedType ? [pickedType] : CROSSING_CONTACT_TYPES;
  const seen = new Set<string>();
  const roles: OrientedRole[] = [];
  for (const picked of pickedTypes) {
    for (const role of getOrientedRolesForCrossing(currentType, picked, CONTACT_OFFERED_RELATIONSHIP_TYPES)) {
      const key = encodeOrientedRole(role);
      if (seen.has(key)) continue;
      seen.add(key);
      roles.push(role);
    }
  }
  return roles;
}

/** The ONE place that turns (role, current card, picked contact) into a stored direction. */
export function orientRelationship(
  role: OrientedRole,
  currentContactId: string,
  pickedContactId: string,
): { sourceContactId: string; targetContactId: string } {
  const pickedIsSource = role.pickedSide === 'source' && !isSymmetricRelationshipType(role.type);
  return pickedIsSource
    ? { sourceContactId: pickedContactId, targetContactId: currentContactId }
    : { sourceContactId: currentContactId, targetContactId: pickedContactId };
}

interface Endpoints { sourceContactId: string; targetContactId: string }

/** The contact on the OTHER side of a stored record, as seen from `viewerId`'s card. */
export function otherContactIdOf(rel: Endpoints, viewerId: string): string {
  return rel.sourceContactId === viewerId ? rel.targetContactId : rel.sourceContactId;
}

/** Side occupied by the OTHER contact, as seen from `viewerId`'s card. */
export function otherSideOf(rel: Endpoints, viewerId: string): RoleSide {
  return rel.sourceContactId === viewerId ? 'target' : 'source';
}

/** Reconstructs the form's oriented role when editing a stored record from `viewerId`'s card. */
export function orientedRoleOf(rel: Endpoints & { relationshipType: RelationshipType }, viewerId: string): OrientedRole {
  return { type: rel.relationshipType, pickedSide: otherSideOf(rel, viewerId) };
}

/** `board_member` → `boardMember` — the i18n segment under `relationships.types|inverseTypes`. */
export function relationshipTypeI18nSegment(type: string): string {
  return type.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());
}

/**
 * i18n key of the role held by the contact on `holderSide`.
 * Symmetric types (and the source side) read `types.*`; the target side of a
 * directed type reads `inverseTypes.*`.
 */
export function relationshipRoleLabelKey(type: string, holderSide: RoleSide): string {
  const segment = relationshipTypeI18nSegment(type);
  const inverse = holderSide === 'target' && !isSymmetricRelationshipType(type);
  return `relationships.${inverse ? 'inverseTypes' : 'types'}.${segment}`;
}

// ----------------------------------------------------------------------------
// Combobox value encoding (one string per oriented role)
// ----------------------------------------------------------------------------

const INVERSE_SUFFIX = '@inverse';

export function encodeOrientedRole(role: OrientedRole): string {
  return role.pickedSide === 'target' && !isSymmetricRelationshipType(role.type)
    ? `${role.type}${INVERSE_SUFFIX}`
    : role.type;
}

/** Custom (registry) types decode as `{ type: raw, pickedSide: 'source' }` — the caller keeps them as-is. */
export function decodeOrientedRole(value: string): { type: string; pickedSide: RoleSide } {
  return value.endsWith(INVERSE_SUFFIX)
    ? { type: value.slice(0, -INVERSE_SUFFIX.length), pickedSide: 'target' }
    : { type: value, pickedSide: 'source' };
}

// ----------------------------------------------------------------------------
// Input aliases — synonyms are NOT types (ADR-372 §Β1). Accepted from AI / import only.
// ----------------------------------------------------------------------------

/**
 * `inverse: true` ⇒ the alias names the INVERSE reading: «A is client of B»
 * is stored as `vendor` with B as source and A as target.
 */
export const RELATIONSHIP_TYPE_INPUT_ALIASES: Readonly<Record<string, { type: RelationshipType; inverse: boolean }>> = {
  supplier: { type: 'vendor', inverse: false },
  client: { type: 'vendor', inverse: true },
  customer: { type: 'vendor', inverse: true },
  advisor: { type: 'consultant', inverse: false },
  protege: { type: 'mentor', inverse: true },
};

/** Canonical key or input alias → canonical type (+ whether the input named the inverse reading). */
export function resolveRelationshipTypeInput(raw: string): { type: RelationshipType; inverse: boolean } | null {
  const key = raw.trim().toLowerCase();
  if (isRelationshipType(key)) return { type: key, inverse: false };
  return RELATIONSHIP_TYPE_INPUT_ALIASES[key] ?? null;
}
