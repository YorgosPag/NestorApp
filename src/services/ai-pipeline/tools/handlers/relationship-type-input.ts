/**
 * AI relationship-type INPUT resolution (ADR-372 §Β1/§Β2).
 *
 * The agent may name a role by canonical key (`shareholder`), by an input alias
 * (`client`, `supplier`, `advisor`…), or in Greek («μέτοχος», «πελάτης»,
 * «εργαζόμενος σε»). Every Greek role word comes from the locale file — the ONE
 * place a role is named — so this handler can never drift from the UI again.
 * Only kinship words (σύζυγος, αδελφός…) are listed here: they are input
 * vocabulary for the single `family` role, not labels.
 *
 * Semantics of the tool call: «`source` IS <role> OF `target`». An input that
 * names the INVERSE reading («πελάτης», «εργαζόμενος σε») flips the pair.
 */

import elRelationships from '@/i18n/locales/el/contacts-relationships.json';
import type { ContactType } from '@/types/contacts/contracts';
import { RELATIONSHIP_TYPES, type RelationshipType } from '@/types/contacts/relationships/core/relationship-types';
import {
  isStoredCrossingValid,
  relationshipTypeI18nSegment,
  resolveRelationshipTypeInput,
} from '@/types/contacts/relationships/core/relationship-orientation';

interface ResolvedInput {
  type: RelationshipType;
  inverse: boolean;
}

const KINSHIP_INPUT_ALIASES: readonly string[] = [
  'οικογένεια', 'σύζυγος', 'αδερφός', 'αδελφός', 'αδερφή', 'αδελφή',
  'γονέας', 'πατέρας', 'μητέρα', 'παιδί', 'γιος', 'κόρη',
];

type RoleBundle = { relationships: { types: Record<string, string>; inverseTypes: Record<string, string> } };

function buildGreekIndex(): ReadonlyMap<string, ResolvedInput> {
  const bundle = elRelationships as RoleBundle;
  const index = new Map<string, ResolvedInput>();
  for (const type of RELATIONSHIP_TYPES) {
    const segment = relationshipTypeI18nSegment(type);
    const role = bundle.relationships.types[segment];
    const inverse = bundle.relationships.inverseTypes[segment];
    if (role) index.set(role.toLowerCase(), { type, inverse: false });
    if (inverse) index.set(inverse.toLowerCase(), { type, inverse: true });
  }
  for (const word of KINSHIP_INPUT_ALIASES) index.set(word, { type: 'family', inverse: false });
  index.set('φίλη', { type: 'friend', inverse: false });
  return index;
}

const GREEK_INDEX = buildGreekIndex();

/** Canonical key · input alias · Greek role word → canonical type (+ inverse reading flag). */
export function resolveAiRelationshipType(raw: string): ResolvedInput | null {
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  return resolveRelationshipTypeInput(key) ?? GREEK_INDEX.get(key) ?? null;
}

/** Human-readable list for the tool error message. */
export function describeAcceptedRelationshipTypes(): string {
  return RELATIONSHIP_TYPES.join(', ');
}

/**
 * Stored direction for «source IS <role> OF target». If the stated direction is
 * not a valid crossing but the reverse is (the agent mixed up the sides of a
 * directed role, e.g. company «employee» of a person), the pair is flipped —
 * the matrix, not the phrasing, decides. `null` ⇒ invalid in both directions.
 */
export function orientAiRelationship(
  resolved: ResolvedInput,
  ids: { sourceContactId: string; targetContactId: string },
  types: { source: ContactType; target: ContactType }
): { sourceContactId: string; targetContactId: string } | null {
  const stated = resolved.inverse
    ? { sourceContactId: ids.targetContactId, targetContactId: ids.sourceContactId, s: types.target, t: types.source }
    : { sourceContactId: ids.sourceContactId, targetContactId: ids.targetContactId, s: types.source, t: types.target };
  if (isStoredCrossingValid(resolved.type, stated.s, stated.t)) {
    return { sourceContactId: stated.sourceContactId, targetContactId: stated.targetContactId };
  }
  if (isStoredCrossingValid(resolved.type, stated.t, stated.s)) {
    return { sourceContactId: stated.targetContactId, targetContactId: stated.sourceContactId };
  }
  return null;
}
