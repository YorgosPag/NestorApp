/**
 * 🏢 ENTERPRISE CARD IDENTITY - Primitive Utility
 *
 * Single Source of Truth for which props make up a card's identity.
 *
 * Card shells accept a flat public API, so each of them would otherwise forward
 * the identity props to its header one-by-one — parallel lists that drift apart
 * the moment a field is added. This picks the set once; both shells spread it.
 *
 * @fileoverview Identity prop selection shared by all card shells.
 * @enterprise Fortune 500 compliant - Zero duplicates
 * @see CardIdentityProps in ./types
 * @see GridCard, ListCard for consumers
 * @author Enterprise Architecture Team
 * @since 2026-07-16
 */

import type { CardIdentityProps } from './types';

/**
 * 🏢 pickCardIdentity
 *
 * Narrows a card shell's full props down to the identity its header needs.
 * Returns an exact `CardIdentityProps` — never a loose index-signature object —
 * so an added field is a type error at the header, not a silent drop.
 *
 * @example
 * ```tsx
 * <CardHeaderBlock {...pickCardIdentity(props)} badges={badges} />
 * ```
 */
export function pickCardIdentity(props: CardIdentityProps): CardIdentityProps {
  const { entityType, customIcon, customIconColor, title, subtitle, compact, hideIcon } = props;

  return { entityType, customIcon, customIconColor, title, subtitle, compact, hideIcon };
}
